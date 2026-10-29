-- Partner tickets by count (29 Oct): admin enters how many tickets a partner gets; the numbers are the next free ones
-- and every code gets a short random suffix, e.g. BRFV-61-K7QXM, so nobody can guess or forge another person's code
-- by changing the number.

create or replace function public.brf_code_suffix(p_len integer default 5)
returns text language plpgsql volatile set search_path = public as $$
declare abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := uuid_send(gen_random_uuid()); out text := ''; i integer;
begin
  for i in 0 .. p_len - 1 loop out := out || substr(abc, 1 + (get_byte(b, i) % 32), 1); end loop;  -- 32 divides 256: uniform
  return out;
end;
$$;
revoke all on function public.brf_code_suffix(integer) from public, anon, authenticated;

create or replace function public.admin_issue_partner_tickets(p_partner uuid, p_count integer, p_type text)
returns json language plpgsql security definer set search_path = public as $$
declare pr public.brf_ticket_partners; v_from integer; v_n integer;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = 'P0001'; end if;
  select * into pr from public.brf_ticket_partners where id = p_partner;
  if not found then raise exception 'unknown_partner' using errcode = 'P0001'; end if;
  if p_count is null or p_count < 1 then raise exception 'bad_count' using errcode = 'P0001'; end if;
  if p_count > 5000 then raise exception 'range_too_big' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_type, ''))) < 2 then raise exception 'missing_type' using errcode = 'P0001'; end if;
  -- one issue at a time, so two admins clicking together can't be handed the same numbers
  lock table public.brf_partner_tickets in share row exclusive mode;
  select coalesce(max(serial), 0) + 1 into v_from from public.brf_partner_tickets;
  insert into public.brf_partner_tickets (partner_id, serial, code, ticket_type)
  select pr.id, s, pr.prefix || s || '-' || public.brf_code_suffix(5), trim(p_type) from generate_series(v_from, v_from + p_count - 1) s;
  get diagnostics v_n = row_count;
  return json_build_object('allocated', v_n, 'from', pr.prefix || v_from, 'to', pr.prefix || (v_from + p_count - 1));
end;
$$;
revoke all on function public.admin_issue_partner_tickets(uuid, integer, text) from public, anon;
grant execute on function public.admin_issue_partner_tickets(uuid, integer, text) to authenticated;
