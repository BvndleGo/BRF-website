-- BRF (Bvndle Rewards Festival) — free pass sign-ups + admin access
-- Run once on the new BRF Supabase project.

-- ---------------------------------------------------------------------------
-- Admins: only users listed here can see or manage sign-ups.
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
-- Free passes
-- ---------------------------------------------------------------------------
create table if not exists public.free_passes (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  pass_code       text not null unique
                  default 'BRF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  first_name      text not null check (char_length(first_name) between 1 and 80),
  last_name       text not null check (char_length(last_name) between 1 and 80),
  email           text not null unique
                  check (email = lower(email) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  phone           text not null unique check (phone ~ '^\+234[789][01][0-9]{8}$'),
  has_bvndle_tag  boolean not null default false,
  bvndle_tag      text check (bvndle_tag is null or char_length(bvndle_tag) <= 40),
  source          text check (source is null or char_length(source) <= 120),
  checked_in_at   timestamptz,
  checked_in_by   uuid references auth.users (id),
  cio_synced_at   timestamptz
);

create index if not exists free_passes_created_at_idx on public.free_passes (created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: the public never reads or writes the table directly.
-- ---------------------------------------------------------------------------
alter table public.admins      enable row level security;
alter table public.free_passes enable row level security;

drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins" on public.admins
  for select to authenticated using (public.is_admin());

drop policy if exists "admins read passes" on public.free_passes;
create policy "admins read passes" on public.free_passes
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update passes" on public.free_passes;
create policy "admins update passes" on public.free_passes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete passes" on public.free_passes;
create policy "admins delete passes" on public.free_passes
  for delete to authenticated using (public.is_admin());

-- Admins may only change check-in fields from the dashboard.
revoke update on public.free_passes from authenticated;
grant  update (checked_in_at, checked_in_by) on public.free_passes to authenticated;

-- ---------------------------------------------------------------------------
-- Public claim endpoint (called by the site form with the anon key)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_ng_phone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when d ~ '^234[0-9]{10}$'  then '+' || d
    when d ~ '^0[0-9]{10}$'    then '+234' || substr(d, 2)
    when d ~ '^[789][01][0-9]{8}$' then '+234' || d
    else '+' || d
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) s;
$$;

create or replace function public.claim_free_pass(
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_phone      text,
  p_has_tag    boolean default false,
  p_tag        text    default null,
  p_source     text    default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_phone text := public.normalize_ng_phone(p_phone);
  v_tag   text := nullif(trim(coalesce(p_tag, '')), '');
  v_row   public.free_passes;
begin
  if v_phone !~ '^\+234[789][01][0-9]{8}$' then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if coalesce(p_has_tag, false) and v_tag is null then
    raise exception 'missing_tag' using errcode = 'P0001';
  end if;

  -- Same person claiming again: return their existing pass instead of failing.
  select * into v_row from public.free_passes
   where email = v_email and phone = v_phone;
  if found then
    return json_build_object('pass_code', v_row.pass_code, 'first_name', v_row.first_name, 'existing', true);
  end if;

  begin
    insert into public.free_passes (first_name, last_name, email, phone, has_bvndle_tag, bvndle_tag, source)
    values (trim(p_first_name), trim(p_last_name), v_email, v_phone,
            coalesce(p_has_tag, false), case when coalesce(p_has_tag, false) then v_tag end,
            left(p_source, 120))
    returning * into v_row;
  exception when unique_violation then
    if exists (select 1 from public.free_passes where email = v_email) then
      raise exception 'email_taken' using errcode = 'P0001';
    else
      raise exception 'phone_taken' using errcode = 'P0001';
    end if;
  end;

  return json_build_object('pass_code', v_row.pass_code, 'first_name', v_row.first_name, 'existing', false);
end;
$$;

-- Public counter for the "tokens claimed" section.
create or replace function public.free_pass_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.free_passes;
$$;

revoke all on function public.claim_free_pass(text, text, text, text, boolean, text, text) from public;
revoke all on function public.free_pass_count() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.normalize_ng_phone(text) from public, anon, authenticated;
grant execute on function public.claim_free_pass(text, text, text, text, boolean, text, text) to anon, authenticated;
grant execute on function public.free_pass_count() to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- After creating your admin login in Supabase Auth, make it an admin:
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
-- ---------------------------------------------------------------------------
