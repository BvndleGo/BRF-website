-- Digital passport + QR activities for admin-run events (28 Oct).
-- Passport QR -> passport.html?e=<passport_key>; activity QR -> passport.html?a=<activity key>.
-- A passport is a row in brf_event_attendees (source 'passport') with a private token kept on the person's phone.
-- Coins from activities are added to reward_coins, so they follow the same approve -> export -> paid flow.

alter table public.brf_events add column if not exists live boolean not null default false;
alter table public.brf_events add column if not exists passport_key text unique default replace(gen_random_uuid()::text, '-', '');
update public.brf_events set passport_key = replace(gen_random_uuid()::text, '-', '') where passport_key is null;

alter table public.brf_event_attendees add column if not exists token uuid unique default gen_random_uuid();
alter table public.brf_event_attendees add column if not exists source text not null default 'admin';
update public.brf_event_attendees set token = gen_random_uuid() where token is null;
-- the token is the passport holder's key: admins never need to read it
revoke select on public.brf_event_attendees from authenticated;
grant select (id, event_id, full_name, email, phone, bvndle_tag, checked_in_at, reward_coins, reward_status, reward_updated_at,
              reward_approved_at, reward_approved_by, reward_paid_at, note, created_at, created_by, source)
  on public.brf_event_attendees to authenticated;

create table if not exists public.brf_event_activities (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.brf_events(id) on delete cascade,
  key        text not null unique default replace(gen_random_uuid()::text, '-', ''),
  kind       text not null check (kind in ('quiz', 'puzzle', 'staff')),
  title      text not null check (length(trim(title)) > 1),
  prompt     text,
  options    jsonb,                 -- quiz: ["A", "B", "C", "D"]
  correct    smallint,              -- quiz: index into options
  word       text,                  -- puzzle: the word to spell
  pin        text,                  -- staff: the code booth staff type in
  coins      integer not null check (coins > 0),
  active     boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  check (kind <> 'quiz' or (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6 and correct between 0 and jsonb_array_length(options) - 1)),
  check (kind <> 'puzzle' or length(regexp_replace(coalesce(word, ''), '\s', '', 'g')) between 2 and 16),
  check (kind <> 'staff' or length(coalesce(pin, '')) between 3 and 12)
);
create index if not exists brf_event_activities_event on public.brf_event_activities (event_id);

create table if not exists public.brf_activity_done (
  attendee_id uuid not null references public.brf_event_attendees(id) on delete cascade,
  activity_id uuid not null references public.brf_event_activities(id) on delete cascade,
  correct     boolean not null,
  coins       integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (attendee_id, activity_id)
);
create table if not exists public.brf_activity_fails (
  attendee_id uuid not null references public.brf_event_attendees(id) on delete cascade,
  activity_id uuid not null references public.brf_event_activities(id) on delete cascade,
  n           integer not null default 0,
  primary key (attendee_id, activity_id)
);

alter table public.brf_event_activities enable row level security;
alter table public.brf_activity_done enable row level security;
alter table public.brf_activity_fails enable row level security;
revoke all on public.brf_event_activities, public.brf_activity_done, public.brf_activity_fails from anon, authenticated;
grant select, insert, update, delete on public.brf_event_activities to authenticated;
grant select on public.brf_activity_done to authenticated;
drop policy if exists brf_event_activities_admin on public.brf_event_activities;
create policy brf_event_activities_admin on public.brf_event_activities for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists brf_activity_done_admin on public.brf_activity_done;
create policy brf_activity_done_admin on public.brf_activity_done for select to authenticated using (public.is_admin());

-- ---------- public functions (the passport page calls these; no table access for visitors) ----------
create or replace function public.brf_passport_view(p_att public.brf_event_attendees)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', p_att.full_name, 'number', upper(left(replace(p_att.token::text, '-', ''), 8)),
    'tag', p_att.bvndle_tag, 'coins', p_att.reward_coins, 'status', p_att.reward_status,
    'event', (select json_build_object('name', e.name, 'location', e.location, 'date', e.event_date, 'live', e.live) from public.brf_events e where e.id = p_att.event_id),
    'activities', coalesce((select json_agg(json_build_object('title', a.title, 'coins', a.coins, 'kind', a.kind,
                       'done', d.attendee_id is not null, 'earned', coalesce(d.coins, 0)) order by a.sort, a.created_at)
                     from public.brf_event_activities a left join public.brf_activity_done d on d.activity_id = a.id and d.attendee_id = p_att.id
                    where a.event_id = p_att.event_id and a.active), '[]'));
$$;
revoke all on function public.brf_passport_view(public.brf_event_attendees) from public, anon, authenticated;

create or replace function public.passport_event(p_key text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('name', name, 'location', location, 'date', event_date, 'live', live)
    from public.brf_events where passport_key = p_key and not archived;
$$;
grant execute on function public.passport_event(text) to anon, authenticated;

create or replace function public.passport_issue(p_key text, p_name text, p_email text, p_phone text, p_tag text default null)
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
    return json_build_object('token', a.token, 'existing', true, 'passport', public.brf_passport_view(a));
  end if;
  insert into public.brf_event_attendees (event_id, full_name, email, phone, bvndle_tag, checked_in_at, source, created_by)
  values (e.id, left(trim(p_name), 120), v_email, v_phone, v_tag, now(), 'passport', null) returning * into a;
  return json_build_object('token', a.token, 'existing', false, 'passport', public.brf_passport_view(a));
end;
$$;
grant execute on function public.passport_issue(text, text, text, text, text) to anon, authenticated;

create or replace function public.passport_me(p_token uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare a public.brf_event_attendees;
begin
  select * into a from public.brf_event_attendees where token = p_token;
  if not found then raise exception 'invalid_token' using errcode = 'P0001'; end if;
  return public.brf_passport_view(a);
end;
$$;
grant execute on function public.passport_me(uuid) to anon, authenticated;

-- what the activity QR opens: never returns the answer, the word or the PIN
create or replace function public.activity_open(p_key text, p_token uuid default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare x public.brf_event_activities; e public.brf_events; a public.brf_event_attendees; d public.brf_activity_done; v_letters json;
begin
  select * into x from public.brf_event_activities where key = p_key;
  if not found then raise exception 'unknown_activity' using errcode = 'P0001'; end if;
  select * into e from public.brf_events where id = x.event_id;
  if p_token is not null then
    select * into a from public.brf_event_attendees where token = p_token and event_id = x.event_id;
    if found then select * into d from public.brf_activity_done where attendee_id = a.id and activity_id = x.id; end if;
  end if;
  if x.kind = 'puzzle' then
    select json_agg(l order by random()) into v_letters from regexp_split_to_table(upper(regexp_replace(x.word, '\s', '', 'g')), '') l;
  end if;
  return json_build_object(
    'title', x.title, 'prompt', x.prompt, 'kind', x.kind, 'coins', x.coins, 'active', x.active,
    'options', case when x.kind = 'quiz' then x.options end, 'letters', v_letters,
    'event', json_build_object('name', e.name, 'live', e.live, 'passport_key', e.passport_key),
    'has_passport', a.id is not null,
    'done', d.attendee_id is not null, 'correct', d.correct, 'earned', coalesce(d.coins, 0),
    'passport', case when a.id is not null then public.brf_passport_view(a) end);
end;
$$;
grant execute on function public.activity_open(text, uuid) to anon, authenticated;

create or replace function public.activity_submit(p_key text, p_token uuid, p_answer text)
returns json language plpgsql security definer set search_path = public as $$
declare x public.brf_event_activities; e public.brf_events; a public.brf_event_attendees; v_ok boolean; v_fails integer;
begin
  select * into x from public.brf_event_activities where key = p_key;
  if not found then raise exception 'unknown_activity' using errcode = 'P0001'; end if;
  select * into e from public.brf_events where id = x.event_id;
  select * into a from public.brf_event_attendees where token = p_token and event_id = x.event_id for update;
  if not found then raise exception 'no_passport' using errcode = 'P0001'; end if;
  if not e.live then raise exception 'event_not_live' using errcode = 'P0001'; end if;
  if not x.active then raise exception 'activity_closed' using errcode = 'P0001'; end if;
  if exists (select 1 from public.brf_activity_done where attendee_id = a.id and activity_id = x.id) then raise exception 'already_done' using errcode = 'P0001'; end if;
  if a.reward_status = 'paid' then raise exception 'already_paid' using errcode = 'P0001'; end if;
  select n into v_fails from public.brf_activity_fails where attendee_id = a.id and activity_id = x.id;
  if x.kind = 'staff' and coalesce(v_fails, 0) >= 5 then raise exception 'too_many_tries' using errcode = 'P0001'; end if;

  v_ok := case x.kind
    when 'quiz'   then trim(coalesce(p_answer, '')) ~ '^\d+$' and trim(p_answer)::int = x.correct
    when 'puzzle' then upper(regexp_replace(coalesce(p_answer, ''), '\s', '', 'g')) = upper(regexp_replace(x.word, '\s', '', 'g'))
    when 'staff'  then trim(coalesce(p_answer, '')) = trim(x.pin) end;

  if x.kind = 'quiz' or v_ok then                      -- quiz: one attempt, right or wrong. Puzzle and staff: only a success counts
    insert into public.brf_activity_done (attendee_id, activity_id, correct, coins) values (a.id, x.id, v_ok, case when v_ok then x.coins else 0 end);
    if v_ok then update public.brf_event_attendees set reward_coins = reward_coins + x.coins where id = a.id returning * into a; end if;
  else
    insert into public.brf_activity_fails (attendee_id, activity_id, n) values (a.id, x.id, 1)
      on conflict (attendee_id, activity_id) do update set n = public.brf_activity_fails.n + 1;
  end if;
  return json_build_object('correct', v_ok, 'earned', case when v_ok then x.coins else 0 end,
    'retry', x.kind <> 'quiz' and not v_ok, 'passport', public.brf_passport_view(a));
end;
$$;
grant execute on function public.activity_submit(text, uuid, text) to anon, authenticated;
