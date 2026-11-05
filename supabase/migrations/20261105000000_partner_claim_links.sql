-- Partner claim links (5 Nov). Instead of handing a partner a list of codes, the partner gets ONE link per ticket type
-- (rewardfest.bvndle.com/p/<slug>) with an allocation (cap). Each customer who fills it in takes the next ticket from
-- that allocation straight away. Partners with an app can open the link in a webview with the customer's details
-- pre-filled (?first=&last=&email=&phone=), so it's one tap. Day Pass links create a real Day Pass (same confirmation
-- email); concert/VIP links create a numbered ticket and send Customer.io a partner_ticket_claimed event (ticket email).

create table if not exists public.brf_partner_links (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.brf_ticket_partners(id) on delete restrict,
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  ticket_type text not null check (length(trim(ticket_type)) > 1),
  cap         integer not null check (cap between 1 and 5000),
  active      boolean not null default true,
  expires_at  timestamptz,
  stats_key   text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
alter table public.brf_partner_links enable row level security;
revoke all on public.brf_partner_links from anon, authenticated;
grant select, insert, update, delete on public.brf_partner_links to authenticated;
drop policy if exists brf_partner_links_admin on public.brf_partner_links;
create policy brf_partner_links_admin on public.brf_partner_links for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.brf_partner_tickets add column if not exists link_id uuid references public.brf_partner_links(id) on delete set null;
alter table public.brf_partner_tickets add column if not exists holder_name text;
alter table public.brf_partner_tickets add column if not exists holder_email text;
alter table public.brf_partner_tickets add column if not exists holder_phone text;
alter table public.brf_partner_tickets add column if not exists holder_tag text;
alter table public.brf_partner_tickets add column if not exists cio_request_id bigint;
create index if not exists brf_partner_tickets_link on public.brf_partner_tickets (link_id);

-- what the claim page shows before anyone fills it in (no personal data)
create or replace function public.partner_link_info(p_slug text)
returns json language plpgsql stable security definer set search_path = public as $$
declare l public.brf_partner_links; pr public.brf_ticket_partners; v_claimed integer;
begin
  select * into l from public.brf_partner_links where slug = lower(trim(coalesce(p_slug, '')));
  if not found then raise exception 'unknown_link' using errcode = 'P0001'; end if;
  select * into pr from public.brf_ticket_partners where id = l.partner_id;
  select count(*) into v_claimed from public.brf_partner_tickets where link_id = l.id;
  return json_build_object('partner', pr.name, 'ticket_type', l.ticket_type, 'cap', l.cap, 'claimed', v_claimed,
    'remaining', greatest(l.cap - v_claimed, 0), 'expires_at', l.expires_at,
    'status', case when not l.active then 'paused' when l.expires_at is not null and l.expires_at < now() then 'expired'
                   when v_claimed >= l.cap then 'full' else 'open' end);
end;
$$;
grant execute on function public.partner_link_info(text) to anon, authenticated;

-- tells Customer.io about a concert/VIP ticket claimed through a partner link (the ticket email automation listens)
create or replace function public.brf_partner_ticket_to_cio(p_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare t public.brf_partner_tickets; pr public.brf_ticket_partners; v_auth text; v_req bigint; v_first text; v_last text;
begin
  select * into t from public.brf_partner_tickets where id = p_id;
  if not found or t.holder_email is null then return null; end if;
  select * into pr from public.brf_ticket_partners where id = t.partner_id;
  select decrypted_secret into v_auth from vault.decrypted_secrets where name = 'cio_track_basic';
  if v_auth is null then return null; end if;
  v_first := split_part(t.holder_name, ' ', 1); v_last := nullif(trim(substr(t.holder_name, length(v_first) + 1)), '');
  select net.http_post(
    url := 'https://track-eu.customer.io/api/v2/batch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Basic ' || v_auth),
    body := jsonb_build_object('batch', jsonb_build_array(
      jsonb_build_object('type', 'person', 'identifiers', jsonb_build_object('email', t.holder_email), 'action', 'identify',
        'attributes', jsonb_build_object('brf_first_name', v_first, 'brf_last_name', v_last, 'brf_phone', t.holder_phone,
          'brf_bvndle_tag', t.holder_tag, 'brf_partner_ticket', t.code)),
      jsonb_build_object('type', 'person', 'identifiers', jsonb_build_object('email', t.holder_email), 'action', 'event',
        'name', 'partner_ticket_claimed',
        'attributes', jsonb_build_object('ticket_code', t.code, 'ticket_type', t.ticket_type, 'partner', pr.name,
          'first_name', v_first, 'last_name', v_last, 'event_name', 'Bvndle Rewards Concert',
          'dates', 'Saturday, 12th December 2026, 9pm', 'venue', 'Landmark Event Centre, Lagos'))))
  ) into v_req;
  update public.brf_partner_tickets set cio_request_id = v_req where id = p_id;
  return v_req;
end;
$$;
revoke all on function public.brf_partner_ticket_to_cio(uuid) from public, anon, authenticated;

create or replace function public.claim_partner_link(p_slug text, p_first_name text, p_last_name text, p_email text, p_phone text, p_tag text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  l public.brf_partner_links; pr public.brf_ticket_partners; t public.brf_partner_tickets; fp public.free_passes;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := public.normalize_ng_phone(p_phone);
  v_tag text := nullif(regexp_replace(trim(coalesce(p_tag, '')), '^@', ''), '');
  v_name text := trim(coalesce(p_first_name, '')) || ' ' || trim(coalesce(p_last_name, ''));
  v_claimed integer; v_serial integer; v_daypass boolean;
begin
  if length(trim(coalesce(p_first_name, ''))) < 1 or length(trim(coalesce(p_last_name, ''))) < 1 then raise exception 'missing_name' using errcode = 'P0001'; end if;
  if v_phone is null or v_phone !~ '^\+234[789][01][0-9]{8}$' then raise exception 'invalid_phone' using errcode = 'P0001'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email' using errcode = 'P0001'; end if;
  select * into l from public.brf_partner_links where slug = lower(trim(coalesce(p_slug, ''))) for update;
  if not found then raise exception 'unknown_link' using errcode = 'P0001'; end if;
  select * into pr from public.brf_ticket_partners where id = l.partner_id;
  v_daypass := l.ticket_type = 'Day Pass';

  -- the same person opening the link again gets their ticket back (it doesn't use up another one)
  -- (only with BOTH the same email and phone, so nobody can pull up someone else's ticket with one detail)
  select * into t from public.brf_partner_tickets where link_id = l.id and (holder_email = v_email or holder_phone = v_phone) limit 1;
  if found and (t.holder_email <> v_email or t.holder_phone <> v_phone) then raise exception 'details_mismatch' using errcode = 'P0001'; end if;
  if found then
    select * into fp from public.free_passes where id = t.pass_id;
    return json_build_object('existing', true, 'code', t.code, 'ticket_type', t.ticket_type, 'partner', pr.name, 'name', t.holder_name,
      'pass_code', fp.pass_code, 'token', fp.player_token);
  end if;
  if not l.active then raise exception 'link_paused' using errcode = 'P0001'; end if;
  if l.expires_at is not null and l.expires_at < now() then raise exception 'link_expired' using errcode = 'P0001'; end if;
  select count(*) into v_claimed from public.brf_partner_tickets where link_id = l.id;
  if v_claimed >= l.cap then raise exception 'link_full' using errcode = 'P0001'; end if;

  if v_daypass then
    -- someone who already has a Day Pass keeps it; the partner's allocation isn't used
    select * into fp from public.free_passes where email = v_email or phone = v_phone order by created_at limit 1;
    if found and (fp.email <> v_email or fp.phone <> v_phone) then raise exception 'already_has_pass' using errcode = 'P0001'; end if;
    if found then
      return json_build_object('existing', true, 'already_had_pass', true, 'ticket_type', 'Day Pass', 'partner', pr.name,
        'name', fp.first_name || ' ' || fp.last_name, 'pass_code', fp.pass_code, 'token', fp.player_token);
    end if;
    begin
      insert into public.free_passes (first_name, last_name, email, phone, has_bvndle_tag, bvndle_tag, source)
      values (trim(p_first_name), trim(p_last_name), v_email, v_phone, v_tag is not null, v_tag, left('partner: ' || pr.name || ' / link ' || l.slug, 120))
      returning * into fp;
    exception when unique_violation then raise exception 'already_has_pass' using errcode = 'P0001';
    end;
  end if;

  lock table public.brf_partner_tickets in share row exclusive mode;
  select coalesce(max(serial), 0) + 1 into v_serial from public.brf_partner_tickets;
  insert into public.brf_partner_tickets (partner_id, serial, code, ticket_type, issued_to, claimed_at, pass_id, link_id, holder_name, holder_email, holder_phone, holder_tag)
  values (pr.id, v_serial, pr.prefix || v_serial || '-' || public.brf_code_suffix(5), l.ticket_type, v_name, now(), fp.id, l.id, v_name, v_email, v_phone, v_tag)
  returning * into t;
  if not v_daypass then perform public.brf_partner_ticket_to_cio(t.id); end if;
  return json_build_object('existing', false, 'code', t.code, 'ticket_type', t.ticket_type, 'partner', pr.name, 'name', v_name,
    'pass_code', fp.pass_code, 'token', fp.player_token);
end;
$$;
grant execute on function public.claim_partner_link(text, text, text, text, text, text) to anon, authenticated;

-- the partner's own view: numbers only, no customer details; needs the link's stats key
create or replace function public.partner_link_stats(p_slug text, p_key text)
returns json language plpgsql stable security definer set search_path = public as $$
declare l public.brf_partner_links; pr public.brf_ticket_partners;
begin
  select * into l from public.brf_partner_links where slug = lower(trim(coalesce(p_slug, ''))) and stats_key = coalesce(p_key, '');
  if not found then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select * into pr from public.brf_ticket_partners where id = l.partner_id;
  return json_build_object('partner', pr.name, 'ticket_type', l.ticket_type, 'cap', l.cap, 'active', l.active, 'expires_at', l.expires_at,
    'claimed', (select count(*) from public.brf_partner_tickets where link_id = l.id),
    'checked_in', (select count(*) from public.brf_partner_tickets t left join public.free_passes f on f.id = t.pass_id
                    where t.link_id = l.id and coalesce(t.checked_in_at, f.checked_in_at) is not null),
    'by_day', coalesce((select json_agg(json_build_object('day', d, 'n', n) order by d) from
               (select (claimed_at at time zone 'Africa/Lagos')::date d, count(*) n from public.brf_partner_tickets where link_id = l.id group by 1) x), '[]'));
end;
$$;
grant execute on function public.partner_link_stats(text, text) to anon, authenticated;
