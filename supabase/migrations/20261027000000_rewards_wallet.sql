-- Rewards wallet (applied 27 Oct): one rulebook for every reward, the per-person wallet, Customer.io coin totals.
-- One rulebook for every reward on the site.
create table if not exists public.reward_rules (
  activity        text primary key,
  label           text not null,
  coins           integer not null check (coins > 0),
  max_per_person  integer,                 -- null = no limit (e.g. trivia awards repeat every 10 right answers)
  active          boolean not null default true,
  note            text
);
alter table public.reward_rules enable row level security;
revoke all on public.reward_rules from anon, authenticated;
insert into public.reward_rules (activity, label, coins, max_per_person, note) values
  ('trivia', '1 Million Questions', 5, null, '5 coins for every 10 right answers (rules in brf_trivia_rules)'),
  ('worth_zone', 'Explored the Worth zone', 2, 1, 'Open all 12 Worth stations on the site, once per ticket')
on conflict (activity) do nothing;

-- Awards can now be marked as paid once credited in the Bvndle app.
alter table public.coin_awards drop constraint if exists coin_awards_status_check;
alter table public.coin_awards add constraint coin_awards_status_check check (status in ('pending', 'approved', 'rejected', 'paid'));
alter table public.coin_awards add column if not exists paid_at timestamptz;

create or replace function public.admin_review_coins(p_ids bigint[], p_status text, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = 'P0001'; end if;
  if p_status not in ('pending', 'approved', 'rejected', 'paid') then raise exception 'bad_status' using errcode = 'P0001'; end if;
  update public.coin_awards
     set status = p_status,
         reviewed_at = case when p_status = 'pending' then null when p_status = 'paid' then coalesce(reviewed_at, now()) else now() end,
         reviewed_by = case when p_status = 'pending' then null else coalesce(case when p_status = 'paid' then reviewed_by end, auth.uid()) end,
         paid_at = case when p_status = 'paid' then now() else null end,
         note = coalesce(p_note, note)
   where id = any(p_ids)
     and (p_status <> 'paid' or status in ('approved', 'paid'));      -- only approved coins can be marked paid
  get diagnostics n = row_count;
  return n;
end;
$$;

-- A ticket holder's wallet: totals across every game, by status and by source.
create or replace function public.brf_wallet(p_pass uuid)
returns json language sql stable security definer set search_path = public as $$
  with a as (select c.*, coalesce(r.label, c.source) as label from public.coin_awards c left join public.reward_rules r on r.activity = c.source where c.pass_id = p_pass)
  select json_build_object(
    'earned',   coalesce((select sum(coins) from a where status <> 'rejected'), 0),
    'pending',  coalesce((select sum(coins) from a where status = 'pending'), 0),
    'approved', coalesce((select sum(coins) from a where status = 'approved'), 0),
    'paid',     coalesce((select sum(coins) from a where status = 'paid'), 0),
    'by_source', coalesce((select json_agg(x order by x.coins desc) from (
                   select source, min(label) as label, sum(coins) filter (where status <> 'rejected') as coins, count(*) filter (where status <> 'rejected') as awards
                     from a group by source having sum(coins) filter (where status <> 'rejected') > 0) x), '[]'),
    'done', coalesce((select json_agg(distinct source) from a where status <> 'rejected'), '[]'));
$$;
revoke all on function public.brf_wallet(uuid) from public, anon, authenticated;

create or replace function public.my_rewards(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare p public.free_passes := public.brf_pass_by_token(p_token);
begin
  return public.brf_wallet(p.id);
end;
$$;
grant execute on function public.my_rewards(uuid) to anon, authenticated;

-- Claim a one-off activity reward (anything except trivia, which pays out from trivia_answer).
create or replace function public.claim_activity_reward(p_token uuid, p_activity text, p_proof jsonb default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  p  public.free_passes := public.brf_pass_by_token(p_token);
  r  public.reward_rules;
  n  integer;
  v_new boolean := false;
begin
  select * into r from public.reward_rules where activity = p_activity and active and activity <> 'trivia';
  if not found then raise exception 'unknown_activity' using errcode = 'P0001'; end if;

  if p_activity = 'worth_zone' then
    -- proof: the station numbers opened; all twelve Worth stations are needed
    if p_proof is null or jsonb_typeof(p_proof) <> 'array'
       or (select count(distinct v) from jsonb_array_elements_text(p_proof) v where v in ('01','02','03','04','05','06','07','08','09','10','11','12')) < 12 then
      raise exception 'not_complete' using errcode = 'P0001';
    end if;
  end if;

  select count(*) into n from public.coin_awards where pass_id = p.id and source = p_activity and status <> 'rejected';
  if r.max_per_person is null or n < r.max_per_person then
    insert into public.coin_awards (pass_id, source, ref, coins) values (p.id, p_activity, 'claim-' || (n + 1), r.coins)
    on conflict do nothing;
    v_new := found;
  end if;
  return json_build_object('awarded', case when v_new then r.coins else 0 end, 'already', not v_new, 'wallet', public.brf_wallet(p.id));
end;
$$;
grant execute on function public.claim_activity_reward(uuid, text, jsonb) to anon, authenticated;

-- Keep each person's coin totals on their Customer.io profile.
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
                                       'brf_coins_approved', (w->>'approved')::int, 'brf_coins_paid', (w->>'paid')::int))
  ) into v_req;
  return v_req;
end;
$$;
revoke all on function public.brf_coins_to_cio(uuid) from public, anon, authenticated;

create or replace function public.brf_coin_award_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.brf_coins_to_cio(coalesce(new.pass_id, old.pass_id));
  return null;
end;
$$;
revoke all on function public.brf_coin_award_changed() from public, anon, authenticated;
drop trigger if exists coin_award_to_cio on public.coin_awards;
create trigger coin_award_to_cio after insert or update of status on public.coin_awards
  for each row execute function public.brf_coin_award_changed();
