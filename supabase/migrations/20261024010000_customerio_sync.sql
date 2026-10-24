-- Sends every new free ticket to Customer.io (EU, workspace 220452) straight from the database.
-- Person identified by email; BRF data lives in brf_* attributes so an existing app user's name, phone
-- and sign-up date are never overwritten. Event: free_pass_claimed (triggers the confirmation email).
--
-- The Track API credentials live in Supabase Vault as 'cio_track_basic' = base64("<site_id>:<api_key>").
-- They are NOT in this file. To set or rotate them, run in the SQL editor:
--   select vault.update_secret((select id from vault.secrets where name = 'cio_track_basic'),
--                              encode(convert_to('<site_id>:<api_key>', 'utf8'), 'base64'));

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

alter table public.free_passes add column if not exists cio_request_id bigint;

create or replace function public.brf_send_to_cio(p_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  r public.free_passes;
  v_auth text;
  v_req bigint;
begin
  select * into r from public.free_passes where id = p_id;
  if not found then return null; end if;
  select decrypted_secret into v_auth from vault.decrypted_secrets where name = 'cio_track_basic';
  if v_auth is null then return null; end if;

  select net.http_post(
    url := 'https://track-eu.customer.io/api/v2/batch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Basic ' || v_auth),
    body := jsonb_build_object('batch', jsonb_build_array(
      jsonb_build_object('type', 'person', 'identifiers', jsonb_build_object('email', r.email), 'action', 'identify',
        'attributes', jsonb_build_object(
          'brf_2026_free_pass', true, 'brf_pass_code', r.pass_code,
          'brf_first_name', r.first_name, 'brf_last_name', r.last_name, 'brf_phone', r.phone,
          'brf_has_bvndle_tag', r.has_bvndle_tag, 'brf_bvndle_tag', r.bvndle_tag,
          'brf_signup_source', r.source, 'brf_claimed_at', extract(epoch from r.created_at)::bigint)),
      jsonb_build_object('type', 'person', 'identifiers', jsonb_build_object('email', r.email), 'action', 'event',
        'name', 'free_pass_claimed',
        'attributes', jsonb_build_object(
          'pass_code', r.pass_code, 'first_name', r.first_name, 'last_name', r.last_name,
          'has_bvndle_tag', r.has_bvndle_tag, 'bvndle_tag', r.bvndle_tag,
          'event_name', 'Bvndle Rewards Festival 2026', 'dates', '11th – 12th December 2026',
          'venue', 'Landmark Event Centre, Lagos'))
    ))
  ) into v_req;

  update public.free_passes set cio_request_id = v_req where id = p_id;
  return v_req;
end;
$$;
revoke all on function public.brf_send_to_cio(uuid) from public, anon, authenticated;

create or replace function public.brf_free_pass_to_cio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.brf_send_to_cio(new.id);
  return new;
end;
$$;
revoke all on function public.brf_free_pass_to_cio() from public, anon, authenticated;

drop trigger if exists free_pass_to_cio on public.free_passes;
create trigger free_pass_to_cio after insert on public.free_passes
  for each row execute function public.brf_free_pass_to_cio();

-- Every 5 minutes: mark successful sends, and resend anything that failed or never went out.
create or replace function public.brf_cio_reconcile()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  update public.free_passes f set cio_synced_at = now()
    from net._http_response h
   where f.cio_synced_at is null and f.cio_request_id = h.id and h.status_code between 200 and 299;
  for r in
    select f.id from public.free_passes f
     left join net._http_response h on h.id = f.cio_request_id
     where f.cio_synced_at is null and f.created_at < now() - interval '2 minutes'
       and (f.cio_request_id is null or h.id is null or h.status_code is null or h.status_code not between 200 and 299)
     order by f.created_at limit 200
  loop
    perform public.brf_send_to_cio(r.id);
  end loop;
end;
$$;
revoke all on function public.brf_cio_reconcile() from public, anon, authenticated;

select cron.schedule('brf-cio-reconcile', '*/5 * * * *', 'select public.brf_cio_reconcile()');
