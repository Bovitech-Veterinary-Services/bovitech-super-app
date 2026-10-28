-- =====================================================================
--  Bovitech Practice — database setup, step 3 (SMS from the office phone)
--  Run once, after 02-security.sql: SQL Editor → New query → paste ALL of this → Run.
-- =====================================================================

-- every text sent or received, with how it went
create table public.sms_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  kind        text not null check (kind in ('booked', 'reminder', 'proposal', 'manual', 'reply')),
  key         text unique,                 -- stops the same text going twice (e.g. 'booked:<booking id>')
  booking_id  text,
  contact_id  text,
  business_id text,
  phone       text,
  body        text,
  status      text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'delivered', 'failed', 'received')),
  gateway_id  text,
  error       text,
  staff_id    uuid references public.staff(id),
  handled     boolean not null default false  -- replies: someone has dealt with it
);
create index sms_log_at_idx on public.sms_log (at desc);
create index sms_log_gw_idx on public.sms_log (gateway_id);
alter table public.sms_log enable row level security;           -- no policies: only the functions below can use it
revoke all on public.sms_log from anon, authenticated;

-- the app reads recent texts (device-checked, like everything else)
create function public.sms_status(k text, days integer default 60) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.at desc) from (
    select id, at, kind, key, booking_id, contact_id, business_id, phone, body, status, error, handled,
           (select coalesce(preferred_name, full_name) from public.staff where id = sms_log.staff_id) as by
    from public.sms_log where at > now() - make_interval(days => least(greatest(days, 1), 400)) order by at desc limit 2000) s), '[]'::jsonb);
end $$;

-- send a text by hand (goes out within a minute)
create function public.sms_queue(k text, phone text, body text, contact_id text default null, business_id text default null, booking_id text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.require_device(k); nid bigint;
begin
  if coalesce(trim(body), '') = '' then raise exception 'The message is empty'; end if;
  if regexp_replace(coalesce(phone, ''), '\D', '', 'g') !~ '^(04\d{8}|614\d{8})$' then raise exception 'That isn''t an Australian mobile number'; end if;
  insert into public.sms_log (kind, phone, body, contact_id, business_id, booking_id, staff_id, status)
  values ('manual', phone, left(body, 1000), contact_id, business_id, booking_id, sid, 'queued') returning id into nid;
  perform public.call_jobs('{"task":"sms"}'::jsonb);
  return nid;
end $$;

-- send anything that's due now (called by the app after a booking is saved)
create function public.sms_kick(k text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  perform public.call_jobs('{"task":"sms"}'::jsonb);
end $$;

-- a text failed: let it be sent again
create function public.sms_retry(k text, sms_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  update public.sms_log set status = 'queued', error = null where id = sms_id and kind = 'manual' and status = 'failed';
  delete from public.sms_log where id = sms_id and kind <> 'manual' and status = 'failed';
  perform public.call_jobs('{"task":"sms"}'::jsonb);
end $$;

-- a reply has been dealt with
create function public.sms_handled(k text, sms_id bigint, done boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  update public.sms_log set handled = done where id = sms_id and kind = 'reply';
end $$;

-- where the phone app sends replies and delivery reports (used once, by the 'sms_setup' job)
create function public.sms_hook_url() returns text
language sql stable security definer set search_path = public as $$
  select (select value from private.settings where key = 'functions_url') || '/jobs?hook=' || (select value from private.settings where key = 'job_secret')
$$;

revoke all on function public.sms_status(text, integer), public.sms_queue(text, text, text, text, text, text), public.sms_kick(text), public.sms_retry(text, bigint), public.sms_handled(text, bigint, boolean), public.sms_hook_url() from public, anon;
grant execute on function public.sms_status(text, integer), public.sms_queue(text, text, text, text, text, text), public.sms_kick(text), public.sms_retry(text, bigint), public.sms_handled(text, bigint, boolean) to authenticated;
revoke all on function public.sms_hook_url() from authenticated;
grant execute on function public.sms_hook_url() to service_role;

-- check for texts that are due every 5 minutes (booking made, reminders at 8:30am, new times, hand-written)
select cron.schedule('bovitech-sms', '*/5 * * * *', $$ select public.call_jobs('{"task":"sms"}'::jsonb) $$);

select 'SMS setup finished' as result;
