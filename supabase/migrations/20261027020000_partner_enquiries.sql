-- Become a Partner enquiries (questions from "BRF 2026 Become a Sponsor Questions", 27 Oct).
create table if not exists public.partner_enquiries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  organisation  text not null,
  industry      text not null,
  contact_name  text not null,
  contact_role  text,
  email         text not null,
  phone         text,
  website       text,
  partnership_types   text[] not null default '{}',
  partnership_other   text,
  objectives          text[] not null default '{}',
  objectives_other    text,
  budget        text,
  contribution  text,
  source        text,
  status        text not null default 'new' check (status in ('new', 'contacted', 'in_talks', 'confirmed', 'declined')),
  admin_note    text,
  updated_at    timestamptz,
  cio_request_id bigint
);
alter table public.partner_enquiries enable row level security;
revoke all on public.partner_enquiries from anon, authenticated;
grant select, update on public.partner_enquiries to authenticated;
drop policy if exists partner_admin_read on public.partner_enquiries;
create policy partner_admin_read on public.partner_enquiries for select to authenticated using (public.is_admin());
drop policy if exists partner_admin_update on public.partner_enquiries;
create policy partner_admin_update on public.partner_enquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public submit: validates, trims, caps lengths and limits repeat submissions from one email.
create or replace function public.submit_partner_enquiry(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_id uuid;
  t text := 'Headline Sponsor|Gold Sponsor|Silver Sponsor|Brand Activation / Exhibition|Strategic or Ecosystem Partnership|Media Partnership|Other';
  o text := 'Brand visibility and awareness|Customer acquisition and engagement|Product sampling and brand activation|Sales and revenue generation|Access to new markets and audiences|Corporate Social Responsibility (CSR)|Other';
  b text := 'Below ₦5 million|₦5 million – ₦10 million|₦10 million – ₦25 million|₦25 million – ₦50 million|Above ₦50 million|Open to reviewing BRF''s sponsorship packages|Prefer to discuss this with the partnerships team';
  v_types text[]; v_objs text[];
  s text := '';
begin
  if coalesce(trim(p->>'website_url_hp'), '') <> '' then return json_build_object('ok', true); end if;   -- honeypot
  if length(trim(coalesce(p->>'organisation', ''))) < 2 then raise exception 'missing_organisation' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p->>'industry', ''))) < 2 then raise exception 'missing_industry' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p->>'contact_name', ''))) < 2 then raise exception 'missing_name' using errcode = 'P0001'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email' using errcode = 'P0001'; end if;
  select coalesce(array_agg(x), '{}') into v_types from jsonb_array_elements_text(coalesce(p->'partnership_types', '[]')) x where x = any(string_to_array(t, '|'));
  select coalesce(array_agg(x), '{}') into v_objs  from jsonb_array_elements_text(coalesce(p->'objectives', '[]')) x where x = any(string_to_array(o, '|'));
  if cardinality(v_types) = 0 then raise exception 'missing_type' using errcode = 'P0001'; end if;
  if cardinality(v_objs) = 0 then raise exception 'missing_objective' using errcode = 'P0001'; end if;
  if coalesce(p->>'budget', '') <> '' and not (p->>'budget' = any(string_to_array(b, '|'))) then raise exception 'bad_budget' using errcode = 'P0001'; end if;
  if (select count(*) from public.partner_enquiries where email = v_email and created_at > now() - interval '10 minutes') >= 2 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  insert into public.partner_enquiries (organisation, industry, contact_name, contact_role, email, phone, website,
    partnership_types, partnership_other, objectives, objectives_other, budget, contribution, source)
  values (left(trim(p->>'organisation'), 160), left(trim(p->>'industry'), 120), left(trim(p->>'contact_name'), 120),
    nullif(left(trim(coalesce(p->>'contact_role', '')), 120), ''), v_email,
    nullif(left(trim(coalesce(p->>'phone', '')), 40), ''), nullif(left(trim(coalesce(p->>'website', '')), 200), ''),
    v_types, nullif(left(trim(coalesce(p->>'partnership_other', '')), 300), ''),
    v_objs, nullif(left(trim(coalesce(p->>'objectives_other', '')), 300), ''),
    nullif(p->>'budget', ''), nullif(left(trim(coalesce(p->>'contribution', '')), 3000), ''),
    nullif(left(coalesce(p->>'source', ''), 120), ''))
  returning id into v_id;
  return json_build_object('ok', true);
end;
$$;
grant execute on function public.submit_partner_enquiry(jsonb) to anon, authenticated;

-- Team alert: one Customer.io event on the festival team's own profile (rewardsfestival@bvndle.com), so partners
-- are not added to the app's audience. The "BRF partner enquiry alert" automation emails the team from it.
create or replace function public.brf_partner_to_cio(p_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare r public.partner_enquiries; v_auth text; v_req bigint;
begin
  select * into r from public.partner_enquiries where id = p_id; if not found then return null; end if;
  select decrypted_secret into v_auth from vault.decrypted_secrets where name = 'cio_track_basic'; if v_auth is null then return null; end if;
  select net.http_post(
    url := 'https://track-eu.customer.io/api/v2/batch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Basic ' || v_auth),
    body := jsonb_build_object('batch', jsonb_build_array(
      jsonb_build_object('type', 'person', 'identifiers', jsonb_build_object('email', 'rewardsfestival@bvndle.com'), 'action', 'identify',
        'attributes', jsonb_build_object('brf_team_inbox', true)),
      jsonb_build_object('type', 'person', 'identifiers', jsonb_build_object('email', 'rewardsfestival@bvndle.com'), 'action', 'event',
        'name', 'brf_partner_enquiry',
        'attributes', jsonb_build_object(
          'organisation', r.organisation, 'industry', r.industry, 'contact_name', r.contact_name, 'contact_role', coalesce(r.contact_role, ''),
          'email', r.email, 'phone', coalesce(r.phone, ''), 'website', coalesce(r.website, ''),
          'partnership_types', array_to_string(r.partnership_types, ', ') || coalesce(' (Other: ' || r.partnership_other || ')', ''),
          'objectives', array_to_string(r.objectives, ', ') || coalesce(' (Other: ' || r.objectives_other || ')', ''),
          'budget', coalesce(r.budget, 'Not given'), 'contribution', coalesce(r.contribution, ''),
          'submitted_at', to_char(r.created_at at time zone 'Africa/Lagos', 'DD Mon YYYY, HH24:MI') || ' WAT',
          'admin_url', 'https://bvndle-rewards-festival.netlify.app/admin.html')))))
  into v_req;
  update public.partner_enquiries set cio_request_id = v_req where id = p_id;
  return v_req;
end;
$$;
revoke all on function public.brf_partner_to_cio(uuid) from public, anon, authenticated;

create or replace function public.brf_partner_enquiry_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.brf_partner_to_cio(new.id); return null; end;
$$;
revoke all on function public.brf_partner_enquiry_inserted() from public, anon, authenticated;
drop trigger if exists partner_enquiry_to_cio on public.partner_enquiries;
create trigger partner_enquiry_to_cio after insert on public.partner_enquiries for each row execute function public.brf_partner_enquiry_inserted();
