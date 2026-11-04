-- Paid concert tickets (4 Nov). When someone buys a concert ticket in the Bvndle app, Customer.io sends the ticket
-- email and then calls record_paid_ticket (a webhook step in the "TICKETS - BRF Concert ticket email" automation), so
-- the admin dashboard has a list of every Ticket ID and buyer for the gate.
-- The webhook proves it is Customer.io with a shared secret kept in Supabase Vault as 'cio_webhook_secret'
-- (NOT in this file). To set or rotate it:
--   select vault.update_secret((select id from vault.secrets where name = 'cio_webhook_secret'), '<new secret>');
-- and paste the same value into the webhook body in Customer.io.

create table if not exists public.brf_paid_tickets (
  id             uuid primary key default gen_random_uuid(),
  ticket_code    text not null unique,
  cio_event_id   text unique,
  email          text,
  first_name     text,
  last_name      text,
  cio_id         text,
  merchant_name  text,
  details        jsonb,
  purchased_at   timestamptz not null default now(),
  checked_in_at  timestamptz,
  checked_in_by  uuid,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists brf_paid_tickets_email on public.brf_paid_tickets (lower(email));

alter table public.brf_paid_tickets enable row level security;
revoke all on public.brf_paid_tickets from anon, authenticated;
grant select, update on public.brf_paid_tickets to authenticated;
drop policy if exists brf_paid_tickets_admin on public.brf_paid_tickets;
create policy brf_paid_tickets_admin on public.brf_paid_tickets for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.record_paid_ticket(p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_secret text; v_code text := upper(trim(coalesce(p->>'ticket_code', ''))); r public.brf_paid_tickets;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cio_webhook_secret';
  if v_secret is null or coalesce(p->>'secret', '') <> v_secret then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if v_code !~ '^[A-Z0-9-]{4,40}$' then raise exception 'bad_code' using errcode = 'P0001'; end if;
  insert into public.brf_paid_tickets (ticket_code, cio_event_id, email, first_name, last_name, cio_id, merchant_name, details, purchased_at)
  values (v_code, nullif(p->>'event_id', ''), lower(nullif(trim(p->>'email'), '')), nullif(trim(p->>'first_name'), ''),
          nullif(trim(p->>'last_name'), ''), nullif(p->>'cio_id', ''), nullif(p->>'merchant_name', ''), p->'details',
          case when coalesce(p->>'timestamp', '') ~ '^\d{9,11}(\.\d+)?$' then to_timestamp((p->>'timestamp')::double precision) else now() end)
  on conflict (ticket_code) do update set email = excluded.email, first_name = coalesce(excluded.first_name, brf_paid_tickets.first_name),
     last_name = coalesce(excluded.last_name, brf_paid_tickets.last_name), details = coalesce(excluded.details, brf_paid_tickets.details)
  returning * into r;
  return json_build_object('ok', true, 'ticket_code', r.ticket_code);
end;
$$;
revoke all on function public.record_paid_ticket(jsonb) from public;
grant execute on function public.record_paid_ticket(jsonb) to anon, authenticated;
