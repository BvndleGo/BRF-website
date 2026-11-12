-- 12 Nov: Day Pass claims are closed. Any new Day Pass (website form, partner code, partner link) is refused unless an
-- admin creates it. Reopen with: update public.brf_flags set "on" = true where key = 'day_pass_claims';
create table if not exists public.brf_flags (key text primary key, "on" boolean not null, updated_at timestamptz not null default now());
alter table public.brf_flags enable row level security;
revoke all on public.brf_flags from anon, authenticated;
grant select, update on public.brf_flags to authenticated;
drop policy if exists brf_flags_admin on public.brf_flags;
create policy brf_flags_admin on public.brf_flags for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.brf_flags (key, "on") values ('day_pass_claims', false), ('concert_sales', false)
  on conflict (key) do update set "on" = excluded."on", updated_at = now();

create or replace function public.brf_flag(p_key text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select "on" from public.brf_flags where key = p_key), true);
$$;
grant execute on function public.brf_flag(text) to anon, authenticated;

create or replace function public.brf_free_pass_gate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.brf_flag('day_pass_claims') and not coalesce(public.is_admin(), false) then
    raise exception 'claims_closed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists brf_free_pass_gate on public.free_passes;
create trigger brf_free_pass_gate before insert on public.free_passes for each row execute function public.brf_free_pass_gate();
