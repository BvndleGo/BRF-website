-- Partner tickets (29 Oct): tickets issued to partners in numbered blocks, e.g. Vbank gets BRFV-20025 … BRFV-20045.
-- Serial numbers are unique across all partners, so two partners can never hold the same number.
create table if not exists public.brf_ticket_partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 1),
  prefix      text not null unique check (prefix ~ '^[A-Z0-9]{2,12}-$'),
  contact     text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

create table if not exists public.brf_partner_tickets (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.brf_ticket_partners(id) on delete restrict,
  serial         integer not null unique check (serial > 0),
  code           text not null unique,
  ticket_type    text not null,
  issued_to      text,
  checked_in_at  timestamptz,
  checked_in_by  uuid,
  created_at     timestamptz not null default now()
);
create index if not exists brf_partner_tickets_partner on public.brf_partner_tickets (partner_id, serial);

alter table public.brf_ticket_partners enable row level security;
alter table public.brf_partner_tickets enable row level security;
revoke all on public.brf_ticket_partners, public.brf_partner_tickets from anon, authenticated;
grant select, insert, update, delete on public.brf_ticket_partners, public.brf_partner_tickets to authenticated;
drop policy if exists brf_ticket_partners_admin on public.brf_ticket_partners;
create policy brf_ticket_partners_admin on public.brf_ticket_partners for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists brf_partner_tickets_admin on public.brf_partner_tickets;
create policy brf_partner_tickets_admin on public.brf_partner_tickets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Allocate a block of serials to a partner. Refuses the whole block if any number in it is already taken.
create or replace function public.admin_allocate_partner_tickets(p_partner uuid, p_from integer, p_to integer, p_type text)
returns json language plpgsql security definer set search_path = public as $$
declare pr public.brf_ticket_partners; v_taken integer; v_first integer; v_n integer;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = 'P0001'; end if;
  select * into pr from public.brf_ticket_partners where id = p_partner;
  if not found then raise exception 'unknown_partner' using errcode = 'P0001'; end if;
  if p_from is null or p_to is null or p_from < 1 or p_to < p_from then raise exception 'bad_range' using errcode = 'P0001'; end if;
  if p_to - p_from + 1 > 5000 then raise exception 'range_too_big' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_type, ''))) < 2 then raise exception 'missing_type' using errcode = 'P0001'; end if;
  select count(*), min(serial) into v_taken, v_first from public.brf_partner_tickets where serial between p_from and p_to;
  if v_taken > 0 then raise exception 'serials_taken:% of these numbers are already allocated (first: %)', v_taken, v_first using errcode = 'P0001'; end if;
  insert into public.brf_partner_tickets (partner_id, serial, code, ticket_type)
  select pr.id, s, pr.prefix || s, trim(p_type) from generate_series(p_from, p_to) s;
  get diagnostics v_n = row_count;
  return json_build_object('allocated', v_n, 'from', pr.prefix || p_from, 'to', pr.prefix || p_to);
end;
$$;
revoke all on function public.admin_allocate_partner_tickets(uuid, integer, integer, text) from public, anon;
grant execute on function public.admin_allocate_partner_tickets(uuid, integer, integer, text) to authenticated;
