-- Admin-run events: attendance, check-in and booklet rewards (27 Oct).
create table if not exists public.brf_events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 1),
  location    text,
  event_date  date,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

create table if not exists public.brf_event_attendees (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.brf_events(id) on delete cascade,
  full_name           text not null check (length(trim(full_name)) > 1),
  email               text,
  phone               text,
  bvndle_tag          text,
  checked_in_at       timestamptz,
  reward_coins        integer not null default 0 check (reward_coins >= 0),
  reward_status       text not null default 'none' check (reward_status in ('none', 'pending', 'approved', 'paid')),
  reward_updated_at   timestamptz,
  reward_approved_at  timestamptz,
  reward_approved_by  uuid,
  reward_paid_at      timestamptz,
  note                text,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid()
);
create index if not exists brf_event_attendees_event on public.brf_event_attendees (event_id);

-- Reward rules kept in the database: a new amount goes back to "pending" (needs approval again); paid rewards are locked.
create or replace function public.brf_attendee_reward_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.bvndle_tag is not null then new.bvndle_tag := nullif(regexp_replace(trim(new.bvndle_tag), '^@', ''), ''); end if;
  if new.email is not null then new.email := nullif(lower(trim(new.email)), ''); end if;
  if tg_op = 'UPDATE' then
    if old.reward_status = 'paid' and (new.reward_coins <> old.reward_coins or new.reward_status not in ('paid', 'approved')) then
      raise exception 'reward_already_paid' using errcode = 'P0001';
    end if;
    if new.reward_coins <> old.reward_coins then
      new.reward_status := case when new.reward_coins > 0 then 'pending' else 'none' end;
      new.reward_updated_at := now(); new.reward_approved_at := null; new.reward_approved_by := null; new.reward_paid_at := null;
    elsif new.reward_status <> old.reward_status then
      if new.reward_status = 'approved' then
        if new.reward_coins <= 0 then raise exception 'nothing_to_approve' using errcode = 'P0001'; end if;
        new.reward_approved_at := coalesce(new.reward_approved_at, now()); new.reward_approved_by := coalesce(new.reward_approved_by, auth.uid()); new.reward_paid_at := null;
      elsif new.reward_status = 'paid' then
        if old.reward_status <> 'approved' then raise exception 'approve_first' using errcode = 'P0001'; end if;
        new.reward_paid_at := now();
      elsif new.reward_status = 'pending' then
        new.reward_approved_at := null; new.reward_approved_by := null; new.reward_paid_at := null;
      end if;
    end if;
  elsif new.reward_coins > 0 then
    new.reward_status := 'pending'; new.reward_updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists brf_attendee_reward_guard on public.brf_event_attendees;
create trigger brf_attendee_reward_guard before insert or update on public.brf_event_attendees
  for each row execute function public.brf_attendee_reward_guard();

-- Admins only (same allowlist as the rest of the admin page).
alter table public.brf_events enable row level security;
alter table public.brf_event_attendees enable row level security;
revoke all on public.brf_events, public.brf_event_attendees from anon, authenticated;
grant select, insert, update, delete on public.brf_events, public.brf_event_attendees to authenticated;
drop policy if exists brf_events_admin on public.brf_events;
create policy brf_events_admin on public.brf_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists brf_event_attendees_admin on public.brf_event_attendees;
create policy brf_event_attendees_admin on public.brf_event_attendees for all to authenticated using (public.is_admin()) with check (public.is_admin());
