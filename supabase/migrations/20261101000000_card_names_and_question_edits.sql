-- Card names and question edits (1 Nov).
-- 1. Each event can rename its digital card (e.g. "Hero Card" for Daily Trust Heroes); empty = "passport".
-- 2. An activity's content can be edited only while nobody has answered or tried it. Its key never changes, so a
--    printed QR code keeps working. Enforced here, whatever the admin page does.

alter table public.brf_events add column if not exists card_name text check (card_name is null or length(trim(card_name)) between 2 and 30);

create or replace function public.brf_activity_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.key is distinct from old.key or new.event_id is distinct from old.event_id then
    raise exception 'activity_key_fixed' using errcode = 'P0001';
  end if;
  if (new.kind, new.title, new.prompt, new.options, new.correct, new.word, new.pin, new.coins)
     is distinct from (old.kind, old.title, old.prompt, old.options, old.correct, old.word, old.pin, old.coins)
     and (exists (select 1 from public.brf_activity_done where activity_id = old.id)
          or exists (select 1 from public.brf_activity_fails where activity_id = old.id)) then
    raise exception 'activity_in_use' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists brf_activity_guard on public.brf_event_activities;
create trigger brf_activity_guard before update on public.brf_event_activities for each row execute function public.brf_activity_guard();

-- admins can see failed attempts too (they count as taking part)
grant select on public.brf_activity_fails to authenticated;
drop policy if exists brf_activity_fails_admin on public.brf_activity_fails;
create policy brf_activity_fails_admin on public.brf_activity_fails for select to authenticated using (public.is_admin());

create or replace function public.brf_passport_view(p_att public.brf_event_attendees)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', p_att.full_name, 'number', upper(left(replace(p_att.token::text, '-', ''), 8)),
    'tag', p_att.bvndle_tag, 'coins', p_att.reward_coins, 'status', p_att.reward_status,
    'event', (select json_build_object('name', e.name, 'location', e.location, 'date', e.event_date, 'live', e.live, 'logo', e.logo, 'card_name', e.card_name) from public.brf_events e where e.id = p_att.event_id),
    'activities', coalesce((select json_agg(json_build_object('title', a.title, 'coins', a.coins, 'kind', a.kind,
                       'done', d.attendee_id is not null, 'earned', coalesce(d.coins, 0)) order by a.sort, a.created_at)
                     from public.brf_event_activities a left join public.brf_activity_done d on d.activity_id = a.id and d.attendee_id = p_att.id
                    where a.event_id = p_att.event_id and a.active), '[]'));
$$;

create or replace function public.passport_event(p_key text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('name', name, 'location', location, 'date', event_date, 'live', live, 'logo', logo, 'card_name', card_name)
    from public.brf_events where passport_key = p_key and not archived;
$$;

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
    'event', json_build_object('name', e.name, 'location', e.location, 'live', e.live, 'passport_key', e.passport_key, 'logo', e.logo, 'card_name', e.card_name),
    'has_passport', a.id is not null,
    'done', d.attendee_id is not null, 'correct', d.correct, 'earned', coalesce(d.coins, 0),
    'passport', case when a.id is not null then public.brf_passport_view(a) end);
end;
$$;
