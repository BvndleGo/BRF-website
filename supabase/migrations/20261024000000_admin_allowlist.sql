-- Approved admin emails: any login created with one of these emails becomes an admin automatically.
create table if not exists public.admin_emails (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;

create or replace function public.grant_admin_from_allowlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.admin_emails where email = lower(new.email)) then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.grant_admin_from_allowlist() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_grant_admin on auth.users;
create trigger on_auth_user_created_grant_admin
  after insert or update of email on auth.users
  for each row execute function public.grant_admin_from_allowlist();

insert into public.admin_emails (email) values ('help@bvndle.com') on conflict do nothing;
insert into public.admins (user_id)
select u.id from auth.users u join public.admin_emails a on a.email = lower(u.email)
on conflict do nothing;

revoke execute on function public.is_admin() from anon;
