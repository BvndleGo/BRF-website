-- Event logos (29 Oct): admins upload a logo per event; the passport and activity pages show it instead of the BRF logo.
-- Stored as a small data URL (the admin page resizes it to at most 480x240 before saving).
alter table public.brf_events add column if not exists logo text check (logo is null or (logo ~ '^data:image/(png|jpeg|webp);base64,' and length(logo) < 400000));

create or replace function public.brf_passport_view(p_att public.brf_event_attendees)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', p_att.full_name, 'number', upper(left(replace(p_att.token::text, '-', ''), 8)),
    'tag', p_att.bvndle_tag, 'coins', p_att.reward_coins, 'status', p_att.reward_status,
    'event', (select json_build_object('name', e.name, 'location', e.location, 'date', e.event_date, 'live', e.live, 'logo', e.logo) from public.brf_events e where e.id = p_att.event_id),
    'activities', coalesce((select json_agg(json_build_object('title', a.title, 'coins', a.coins, 'kind', a.kind,
                       'done', d.attendee_id is not null, 'earned', coalesce(d.coins, 0)) order by a.sort, a.created_at)
                     from public.brf_event_activities a left join public.brf_activity_done d on d.activity_id = a.id and d.attendee_id = p_att.id
                    where a.event_id = p_att.event_id and a.active), '[]'));
$$;

create or replace function public.passport_event(p_key text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('name', name, 'location', location, 'date', event_date, 'live', live, 'logo', logo)
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
    'event', json_build_object('name', e.name, 'location', e.location, 'live', e.live, 'passport_key', e.passport_key, 'logo', e.logo),
    'has_passport', a.id is not null,
    'done', d.attendee_id is not null, 'correct', d.correct, 'earned', coalesce(d.coins, 0),
    'passport', case when a.id is not null then public.brf_passport_view(a) end);
end;
$$;
