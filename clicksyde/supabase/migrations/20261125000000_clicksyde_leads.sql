-- Clicksyde website: leads from the "Let's talk" form and newsletter sign-ups.
-- Run once on the Clicksyde Supabase project (not on Bvndle Go).
--
-- Visitors (the anon / publishable key) can only ADD rows. Nobody can read them
-- except users listed in public.admins.

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Leads: one row per completed "Let's talk" conversation
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 120),
  business    text not null check (char_length(business) between 1 and 160),
  needs       text[] not null default '{}' check (cardinality(needs) between 1 and 10),
  service     text check (service is null or char_length(service) <= 120),   -- note they came from on The Wall
  budget      text not null check (char_length(budget) <= 80),
  timeline    text not null check (char_length(timeline) <= 80),
  contact     text not null check (char_length(contact) between 5 and 254),   -- email or phone
  about       text check (about is null or char_length(about) <= 1000),
  page        text check (page is null or char_length(page) <= 200),
  status      text not null default 'new' check (status in ('new', 'contacted', 'call booked', 'proposal sent', 'won', 'lost')),
  notes       text
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- ---------------------------------------------------------------------------
-- Newsletter (The Syde Note)
-- ---------------------------------------------------------------------------
create table if not exists public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null unique
              check (email = lower(email) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  source      text check (source is null or char_length(source) <= 200),
  unsubscribed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.admins      enable row level security;
alter table public.leads       enable row level security;
alter table public.subscribers enable row level security;

-- Visitors: insert only, and only into the visitor-facing columns
revoke all on public.leads, public.subscribers, public.admins from anon;
grant insert (name, business, needs, service, budget, timeline, contact, about, page) on public.leads to anon;
grant insert (email, source) on public.subscribers to anon;

drop policy if exists "visitors add leads" on public.leads;
create policy "visitors add leads" on public.leads
  for insert to anon with check (status = 'new' and notes is null);

drop policy if exists "visitors subscribe" on public.subscribers;
create policy "visitors subscribe" on public.subscribers
  for insert to anon with check (unsubscribed_at is null);

-- Admins: read and update everything
grant select, update on public.leads, public.subscribers to authenticated;
grant select on public.admins to authenticated;

drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins" on public.admins
  for select to authenticated using (public.is_admin());

drop policy if exists "admins read leads" on public.leads;
create policy "admins read leads" on public.leads
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update leads" on public.leads;
create policy "admins update leads" on public.leads
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read subscribers" on public.subscribers;
create policy "admins read subscribers" on public.subscribers
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update subscribers" on public.subscribers;
create policy "admins update subscribers" on public.subscribers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
