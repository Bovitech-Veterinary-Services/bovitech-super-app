-- =====================================================================
--  Bovitech Super App — database setup, step 5 (v2.0)
--  • Google Calendar kept up to date by the server (no phone or computer needed)
--  • "Y" / "Yes" replies confirm the appointment automatically
--  • each person's day sheet texted at 8am (and again if their day changes)
--  • a note to the office when an appointment still isn't confirmed 48 hours before
--  Run once: Supabase → SQL Editor → New query → paste ALL of this → Run.
-- =====================================================================

-- texts: two more kinds (day sheets, and notices to the office), and a note on replies ("✓ confirmed automatically")
alter table public.sms_log drop constraint if exists sms_log_kind_check;
alter table public.sms_log add constraint sms_log_kind_check check (kind in ('booked', 'reminder', 'proposal', 'manual', 'reply', 'daysheet', 'notice'));
alter table public.sms_log add column if not exists note text;

-- the app's list of texts now includes the note
create or replace function public.sms_status(k text, days integer default 60) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.at desc) from (
    select id, at, kind, key, booking_id, contact_id, business_id, phone, body, status, error, handled, note,
           (select coalesce(preferred_name, full_name) from public.staff where id = sms_log.staff_id) as by
    from public.sms_log where at > now() - make_interval(days => least(greatest(days, 1), 400)) order by at desc limit 2000) s), '[]'::jsonb);
end $$;

-- a "Y" reply: mark the appointment confirmed (only the server can do this)
create or replace function public.sms_autoconfirm(booking text, sms_id bigint, note_ text) returns boolean
language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  select data into d from public.records where kind = 'bookings' and id = booking and not deleted for update;
  if d is null then return false; end if;
  if coalesce(d->>'status', 'unconfirmed') <> 'unconfirmed' then return false; end if;
  update public.records set data = d || jsonb_build_object('status', 'confirmed', 'autoConfirm', jsonb_build_object('at', (extract(epoch from now()) * 1000)::bigint, 'sms', sms_id)),
    rev = rev + 1, updated_at = now(), seq = nextval('public.records_seq'), device = 'SMS reply', updated_by = null
  where kind = 'bookings' and id = booking;
  update public.sms_log set note = note_ where id = sms_id;
  return true;
end $$;
revoke all on function public.sms_autoconfirm(text, bigint, text) from public, anon, authenticated;
grant execute on function public.sms_autoconfirm(text, bigint, text) to service_role;

-- Google Calendar: the practice Google account's sign-in, kept where only the server can read it
create table if not exists private.gcal (
  id int primary key default 1 check (id = 1),
  refresh_token text, account text, nonce text, nonce_at timestamptz,
  oncall_cal text, staff_cals jsonb not null default '{}'::jsonb,
  hash text, last jsonb, connected_at timestamptz, by uuid
);
insert into private.gcal (id) values (1) on conflict do nothing;

-- the app asks for a one-off code before sending you to Google's sign-in
create or replace function public.gcal_start(k text) returns text
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.require_device(k); n text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  update private.gcal set nonce = n, nonce_at = now(), by = sid where id = 1;
  return n;
end $$;
-- what the app shows: connected or not, and how the last sync went (never the sign-in itself)
create or replace function public.gcal_status(k text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return (select jsonb_build_object('connected', refresh_token is not null, 'account', account, 'connected_at', connected_at, 'last', last, 'staff_cals', staff_cals, 'oncall_cal', oncall_cal is not null) from private.gcal where id = 1);
end $$;
create or replace function public.call_gcal(body jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := (select value from private.settings where key = 'functions_url') || '/gcal',
    body := body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-job-secret', (select value from private.settings where key = 'job_secret')),
    timeout_milliseconds := 120000);
end $$;
create or replace function public.gcal_kick(k text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  perform public.call_gcal('{"task":"sync","force":true}'::jsonb);
end $$;
create or replace function public.gcal_disconnect(k text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  update private.gcal set refresh_token = null, account = null, last = jsonb_build_object('at', now(), 'msg', 'Disconnected') where id = 1;
end $$;
-- the "gcal" function reads and writes the sign-in through these (server only)
create or replace function public.gcal_get() returns jsonb
language sql stable security definer set search_path = public as $$ select to_jsonb(g) from private.gcal g where id = 1 $$;
create or replace function public.gcal_set(patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update private.gcal set
    refresh_token = case when patch ? 'refresh_token' then patch->>'refresh_token' else refresh_token end,
    account       = case when patch ? 'account' then patch->>'account' else account end,
    nonce         = case when patch ? 'nonce' then patch->>'nonce' else nonce end,
    oncall_cal    = case when patch ? 'oncall_cal' then patch->>'oncall_cal' else oncall_cal end,
    staff_cals    = case when patch ? 'staff_cals' then patch->'staff_cals' else staff_cals end,
    hash          = case when patch ? 'hash' then patch->>'hash' else hash end,
    last          = case when patch ? 'last' then patch->'last' else last end,
    connected_at  = case when patch ? 'connected_at' then now() else connected_at end
  where id = 1;
end $$;
revoke all on function public.gcal_start(text), public.gcal_status(text), public.gcal_kick(text), public.gcal_disconnect(text) from public, anon;
grant execute on function public.gcal_start(text), public.gcal_status(text), public.gcal_kick(text), public.gcal_disconnect(text) to authenticated;
revoke all on function public.call_gcal(jsonb), public.gcal_get(), public.gcal_set(jsonb) from public, anon, authenticated;
grant execute on function public.gcal_get(), public.gcal_set(jsonb) to service_role;

-- keep Google Calendar up to date every 5 minutes (it only writes to Google when something has changed)
select cron.schedule('bovitech-gcal', '*/5 * * * *', $$ select public.call_gcal('{"task":"sync"}'::jsonb) $$);

select 'Step 5 finished' as result;
