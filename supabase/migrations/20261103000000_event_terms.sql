-- Bvndle Event Terms (3 Nov): the card form asks people to agree to event-terms.html; the version they agreed to and
-- when are kept on their card. p_terms is optional so a page opened before this change still works.
alter table public.brf_event_attendees add column if not exists terms_version text;
alter table public.brf_event_attendees add column if not exists terms_accepted_at timestamptz;
grant select (terms_version, terms_accepted_at) on public.brf_event_attendees to authenticated;

drop function if exists public.passport_issue(text, text, text, text, text);
create or replace function public.passport_issue(p_key text, p_name text, p_email text, p_phone text, p_tag text default null, p_terms text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  e public.brf_events; a public.brf_event_attendees;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_tag text := nullif(regexp_replace(trim(coalesce(p_tag, '')), '^@', ''), '');
begin
  select * into e from public.brf_events where passport_key = p_key and not archived;
  if not found then raise exception 'unknown_event' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'missing_name' using errcode = 'P0001'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email' using errcode = 'P0001'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 10 then raise exception 'invalid_phone' using errcode = 'P0001'; end if;
  if v_phone ~ '^0\d{10}$' then v_phone := '+234' || substr(v_phone, 2); elsif v_phone ~ '^234\d{10}$' then v_phone := '+' || v_phone; end if;
  -- the same person scanning again (or on a new phone) gets their own passport back
  select * into a from public.brf_event_attendees where event_id = e.id and (email = v_email or phone = v_phone) order by created_at limit 1;
  if found then
    if a.bvndle_tag is null and v_tag is not null then update public.brf_event_attendees set bvndle_tag = v_tag where id = a.id returning * into a; end if;
    if a.checked_in_at is null then update public.brf_event_attendees set checked_in_at = now() where id = a.id returning * into a; end if;
    if p_terms is not null then update public.brf_event_attendees set terms_version = left(p_terms, 20), terms_accepted_at = now() where id = a.id returning * into a; end if;
    return json_build_object('token', a.token, 'existing', true, 'passport', public.brf_passport_view(a));
  end if;
  insert into public.brf_event_attendees (event_id, full_name, email, phone, bvndle_tag, checked_in_at, source, created_by, terms_version, terms_accepted_at)
  values (e.id, left(trim(p_name), 120), v_email, v_phone, v_tag, now(), 'passport', null, left(p_terms, 20), case when p_terms is not null then now() end) returning * into a;
  return json_build_object('token', a.token, 'existing', false, 'passport', public.brf_passport_view(a));
end;
$$;
grant execute on function public.passport_issue(text, text, text, text, text, text) to anon, authenticated;
