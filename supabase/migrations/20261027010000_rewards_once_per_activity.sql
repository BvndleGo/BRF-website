-- Rewards rules from 27 Oct: each activity pays once per person (trivia: 5 coins once), Worth renamed Wealth,
-- coins are handed over at the festival ("collected" replaces "paid").
-- Rules from 27 Oct: each reward activity pays once per person; the zone is called Wealth; coins are collected at the festival.
update public.reward_rules set max_per_person = 1, note = '5 coins once, for the first 10 right answers' where activity = 'trivia';
delete from public.reward_rules where activity = 'worth_zone';
insert into public.reward_rules (activity, label, coins, max_per_person, note) values
  ('wealth_zone', 'Walked the Wealth zone', 2, 1, 'Go through all 12 Wealth stations on the site, once per ticket')
on conflict (activity) do update set label = excluded.label, coins = excluded.coins, max_per_person = 1, note = excluded.note;

-- 'paid' becomes 'collected' (handed over at the festival ground)
alter table public.coin_awards drop constraint if exists coin_awards_status_check;
update public.coin_awards set status = 'collected' where status = 'paid';
alter table public.coin_awards add constraint coin_awards_status_check check (status in ('pending', 'approved', 'rejected', 'collected'));
alter table public.coin_awards rename column paid_at to collected_at;

create or replace function public.admin_review_coins(p_ids bigint[], p_status text, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = 'P0001'; end if;
  if p_status not in ('pending', 'approved', 'rejected', 'collected') then raise exception 'bad_status' using errcode = 'P0001'; end if;
  update public.coin_awards
     set status = p_status,
         reviewed_at = case when p_status = 'pending' then null when p_status = 'collected' then coalesce(reviewed_at, now()) else now() end,
         reviewed_by = case when p_status = 'pending' then null when p_status = 'collected' then coalesce(reviewed_by, auth.uid()) else auth.uid() end,
         collected_at = case when p_status = 'collected' then now() else null end,
         note = coalesce(p_note, note)
   where id = any(p_ids)
     and (p_status <> 'collected' or status in ('approved', 'collected'));   -- only approved coins can be handed over
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.brf_wallet(p_pass uuid)
returns json language sql stable security definer set search_path = public as $$
  with a as (select c.*, coalesce(r.label, c.source) as label from public.coin_awards c left join public.reward_rules r on r.activity = c.source where c.pass_id = p_pass)
  select json_build_object(
    'earned',    coalesce((select sum(coins) from a where status <> 'rejected'), 0),
    'pending',   coalesce((select sum(coins) from a where status = 'pending'), 0),
    'approved',  coalesce((select sum(coins) from a where status = 'approved'), 0),
    'collected', coalesce((select sum(coins) from a where status = 'collected'), 0),
    'by_source', coalesce((select json_agg(x order by x.coins desc) from (
                   select source, min(label) as label, sum(coins) as coins, min(status) as status
                     from a where status <> 'rejected' group by source) x), '[]'),
    'available', coalesce((select json_agg(json_build_object('activity', r.activity, 'label', r.label, 'coins', r.coins) order by r.coins desc)
                             from public.reward_rules r where r.active), '[]'));
$$;
revoke all on function public.brf_wallet(uuid) from public, anon, authenticated;

create or replace function public.claim_activity_reward(p_token uuid, p_activity text, p_proof jsonb default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  p  public.free_passes := public.brf_pass_by_token(p_token);
  r  public.reward_rules;
  v_new boolean := false;
begin
  select * into r from public.reward_rules where activity = p_activity and active and activity <> 'trivia';
  if not found then raise exception 'unknown_activity' using errcode = 'P0001'; end if;
  if p_activity = 'wealth_zone' then
    if p_proof is null or jsonb_typeof(p_proof) <> 'array'
       or (select count(distinct v) from jsonb_array_elements_text(p_proof) v
            where v in ('01','02','03','04','05','06','07','08','09','10','11','12')) < 12 then
      raise exception 'not_complete' using errcode = 'P0001';
    end if;
  end if;
  if not exists (select 1 from public.coin_awards where pass_id = p.id and source = p_activity) then
    insert into public.coin_awards (pass_id, source, ref, coins) values (p.id, p_activity, 'once', r.coins)
    on conflict do nothing;
    v_new := found;
  end if;
  return json_build_object('awarded', case when v_new then r.coins else 0 end, 'already', not v_new, 'wallet', public.brf_wallet(p.id));
end;
$$;
grant execute on function public.claim_activity_reward(uuid, text, jsonb) to anon, authenticated;

create or replace function public.brf_coins_to_cio(p_pass uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare f public.free_passes; w json; v_auth text; v_req bigint;
begin
  select * into f from public.free_passes where id = p_pass; if not found then return null; end if;
  select decrypted_secret into v_auth from vault.decrypted_secrets where name = 'cio_track_basic'; if v_auth is null then return null; end if;
  w := public.brf_wallet(p_pass);
  select net.http_post(
    url := 'https://track-eu.customer.io/api/v2/entity',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Basic ' || v_auth),
    body := jsonb_build_object('type', 'person', 'identifiers', jsonb_build_object('email', f.email), 'action', 'identify',
      'attributes', jsonb_build_object('brf_coins_earned', (w->>'earned')::int, 'brf_coins_pending', (w->>'pending')::int,
                                       'brf_coins_approved', (w->>'approved')::int, 'brf_coins_collected', (w->>'collected')::int))
  ) into v_req;
  return v_req;
end;
$$;
revoke all on function public.brf_coins_to_cio(uuid) from public, anon, authenticated;

-- Trivia: 5 coins once, at the 10th right answer. Playing on still adds raffle entries.
create or replace function public.trivia_answer(p_token uuid, p_question_id integer, p_choice integer)
returns json language plpgsql security definer set search_path = public as $$
declare
  p      public.free_passes := public.brf_pass_by_token(p_token);
  rules  json := public.brf_trivia_rules();
  s      public.trivia_serves;
  q      public.trivia_questions;
  v_orig smallint;
  v_late boolean;
  v_ok   boolean;
  v_correct_total integer;
  v_award integer := 0;
begin
  select * into s from public.trivia_serves where pass_id = p.id and question_id = p_question_id;
  if not found then raise exception 'not_served' using errcode = 'P0001'; end if;
  if exists (select 1 from public.trivia_answers where pass_id = p.id and question_id = p_question_id) then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;
  select * into q from public.trivia_questions where id = p_question_id;
  v_late := now() > s.served_at + make_interval(secs => (rules->>'seconds')::int + (rules->>'grace_seconds')::int);
  v_orig := case when p_choice between 0 and 3 then s.perm[p_choice + 1] else null end;
  v_ok   := not v_late and v_orig is not null and v_orig = q.correct;
  insert into public.trivia_answers (pass_id, question_id, choice, correct, timed_out)
  values (p.id, p_question_id, v_orig, v_ok, v_late or v_orig is null);
  if v_ok then
    select count(*) into v_correct_total from public.trivia_answers where pass_id = p.id and correct;
    if v_correct_total >= (rules->>'correct_per_award')::int
       and not exists (select 1 from public.coin_awards where pass_id = p.id and source = 'trivia') then
      insert into public.coin_awards (pass_id, source, ref, coins)
      values (p.id, 'trivia', 'once', (rules->>'coins_per_award')::int) on conflict do nothing;
      if found then v_award := (rules->>'coins_per_award')::int; end if;
    end if;
  end if;
  return json_build_object('correct', v_ok, 'timed_out', v_late or v_orig is null,
    'correct_choice', array_position(s.perm, q.correct) - 1, 'explanation', q.explanation,
    'coins_awarded', v_award, 'summary', public.brf_trivia_summary(p.id));
end;
$$;

create or replace function public.brf_trivia_summary(p_pass uuid)
returns json language sql stable security definer set search_path = public as $$
  with r as (select public.brf_trivia_rules() j),
  a as (select count(*) filter (where correct) c, count(*) n from public.trivia_answers where pass_id = p_pass),
  q as (select count(*) t from public.trivia_questions where active),
  w as (select coalesce(sum(coins) filter (where status <> 'rejected'), 0) earned,
               coalesce(sum(coins) filter (where status in ('approved', 'collected')), 0) approved,
               count(*) > 0 as done
          from public.coin_awards where pass_id = p_pass and source = 'trivia')
  select json_build_object(
    'correct', a.c, 'answered', a.n, 'entries', a.c,
    'questions_left', greatest(q.t - a.n, 0),
    'coins_earned', w.earned, 'coins_approved', w.approved,
    'award_done', w.done,
    'next_award_in', case when w.done then null else greatest((r.j->>'correct_per_award')::int - a.c, 0) end,
    'rules', r.j)
  from a, q, w, r;
$$;
