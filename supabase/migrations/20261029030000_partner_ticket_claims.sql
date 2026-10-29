-- Partner Day Pass codes are claimed online (29 Oct). The partner sends each customer a link
-- (rewardfest.bvndle.com/?code=BRFV-61-K7QXM#ticket); the customer fills in the normal Day Pass form and the code
-- becomes a real Day Pass in free_passes. That insert fires the usual Customer.io sync, so they get the same
-- confirmation email as any Day Pass. An unclaimed code is not a ticket: it can't be checked in.
-- Concert codes are not claimed online.

alter table public.brf_partner_tickets add column if not exists pass_id uuid unique references public.free_passes(id) on delete set null;
alter table public.brf_partner_tickets add column if not exists claimed_at timestamptz;

-- what the site shows when someone opens a claim link (never returns personal details)
create or replace function public.partner_code_check(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare t public.brf_partner_tickets; pr public.brf_ticket_partners;
begin
  select * into t from public.brf_partner_tickets where code = upper(trim(coalesce(p_code, '')));
  if not found then raise exception 'unknown_code' using errcode = 'P0001'; end if;
  select * into pr from public.brf_ticket_partners where id = t.partner_id;
  return json_build_object('code', t.code, 'partner', pr.name, 'day_pass', t.ticket_type = 'Day Pass', 'claimed', t.pass_id is not null);
end;
$$;
grant execute on function public.partner_code_check(text) to anon, authenticated;

create or replace function public.claim_partner_ticket(
  p_code text, p_first_name text, p_last_name text, p_email text, p_phone text,
  p_has_tag boolean default false, p_tag text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code  text := upper(trim(coalesce(p_code, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := public.normalize_ng_phone(p_phone);
  v_tag   text := nullif(regexp_replace(trim(coalesce(p_tag, '')), '^@', ''), '');
  t public.brf_partner_tickets; pr public.brf_ticket_partners; v_row public.free_passes;
begin
  select * into t from public.brf_partner_tickets where code = v_code for update;
  if not found then raise exception 'unknown_code' using errcode = 'P0001'; end if;
  if t.ticket_type <> 'Day Pass' then raise exception 'not_day_pass' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_first_name, ''))) < 1 or length(trim(coalesce(p_last_name, ''))) < 1 then raise exception 'missing_name' using errcode = 'P0001'; end if;
  if v_phone is null or v_phone !~ '^\+234[789][01][0-9]{8}$' then raise exception 'invalid_phone' using errcode = 'P0001'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email' using errcode = 'P0001'; end if;
  if coalesce(p_has_tag, false) and v_tag is null then raise exception 'missing_tag' using errcode = 'P0001'; end if;

  if t.pass_id is not null then
    -- the same person opening their link again gets their pass back; anyone else is told the code is used
    select * into v_row from public.free_passes where id = t.pass_id;
    if found and v_row.email = v_email and v_row.phone = v_phone then
      return json_build_object('pass_code', v_row.pass_code, 'first_name', v_row.first_name, 'existing', true, 'token', v_row.player_token);
    end if;
    raise exception 'code_used' using errcode = 'P0001';
  end if;
  -- someone who already has a Day Pass doesn't need the code; it stays unused so it can go to someone else
  if exists (select 1 from public.free_passes where email = v_email or phone = v_phone) then
    raise exception 'already_has_pass' using errcode = 'P0001';
  end if;

  select * into pr from public.brf_ticket_partners where id = t.partner_id;
  begin
    insert into public.free_passes (first_name, last_name, email, phone, has_bvndle_tag, bvndle_tag, source)
    values (trim(p_first_name), trim(p_last_name), v_email, v_phone, coalesce(p_has_tag, false),
            case when coalesce(p_has_tag, false) then v_tag end, left('partner: ' || pr.name || ' / ' || t.code, 120))
    returning * into v_row;
  exception when unique_violation then
    raise exception 'already_has_pass' using errcode = 'P0001';
  end;
  update public.brf_partner_tickets set pass_id = v_row.id, claimed_at = now(), issued_to = v_row.first_name || ' ' || v_row.last_name where id = t.id;
  return json_build_object('pass_code', v_row.pass_code, 'first_name', v_row.first_name, 'existing', false, 'token', v_row.player_token, 'partner', pr.name);
end;
$$;
grant execute on function public.claim_partner_ticket(text, text, text, text, text, boolean, text) to anon, authenticated;
