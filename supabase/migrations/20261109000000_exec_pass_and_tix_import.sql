-- 9 Nov: (1) Executive Day Pass as a partner ticket type: a numbered ticket (not a free Day Pass), emailed through the
-- partner ticket email with festival dates instead of the concert time. (2) Concert tickets bought on the old ticketing
-- site (Tix guest-list export) live in brf_paid_tickets too, so orders keep a quantity, ticket type and phone.

alter table public.brf_paid_tickets add column if not exists quantity integer not null default 1 check (quantity between 1 and 50);
alter table public.brf_paid_tickets add column if not exists ticket_type text;
alter table public.brf_paid_tickets add column if not exists phone text;
alter table public.brf_paid_tickets add column if not exists source text not null default 'bvndle app';

create or replace function public.brf_partner_ticket_to_cio(p_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare t public.brf_partner_tickets; pr public.brf_ticket_partners; v_auth text; v_req bigint; v_first text; v_last text; v_fest boolean;
begin
  select * into t from public.brf_partner_tickets where id = p_id;
  if not found or t.holder_email is null then return null; end if;
  select * into pr from public.brf_ticket_partners where id = t.partner_id;
  select decrypted_secret into v_auth from vault.decrypted_secrets where name = 'cio_track_basic';
  if v_auth is null then return null; end if;
  v_first := split_part(t.holder_name, ' ', 1); v_last := nullif(trim(substr(t.holder_name, length(v_first) + 1)), '');
  v_fest := t.ticket_type ilike '%day pass%';   -- Executive Day Pass: the festival days, not the concert night
  select net.http_post(
    url := 'https://track-eu.customer.io/api/v2/batch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Basic ' || v_auth),
    body := jsonb_build_object('batch', jsonb_build_array(
      jsonb_build_object('type', 'person', 'identifiers', jsonb_build_object('email', t.holder_email), 'action', 'identify',
        'attributes', jsonb_build_object('brf_first_name', v_first, 'brf_last_name', v_last, 'brf_phone', t.holder_phone,
          'brf_bvndle_tag', t.holder_tag, 'brf_partner_ticket', t.code)),
      jsonb_build_object('type', 'person', 'identifiers', jsonb_build_object('email', t.holder_email), 'action', 'event',
        'name', 'partner_ticket_claimed',
        'attributes', jsonb_build_object('ticket_code', t.code, 'ticket_type', t.ticket_type, 'partner', pr.name,
          'first_name', v_first, 'last_name', v_last,
          'event_name', case when v_fest then 'Bvndle Rewards Festival' else 'Bvndle Rewards Concert' end,
          'dates', case when v_fest then '11th – 12th December 2026' else 'Saturday, 12th December 2026, 9pm' end,
          'is_festival', v_fest, 'venue', 'Landmark Event Centre, Lagos'))))
  ) into v_req;
  update public.brf_partner_tickets set cio_request_id = v_req where id = p_id;
  return v_req;
end;
$$;
revoke all on function public.brf_partner_ticket_to_cio(uuid) from public, anon, authenticated;
