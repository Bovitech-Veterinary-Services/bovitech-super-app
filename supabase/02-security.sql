-- =====================================================================
--  Bovitech Practice — database setup, step 2 (security)
--  Two-step sign-in on each new device, remote wipe, sign-in alerts and the nightly backup job.
--  Before running: Database → Extensions → turn on pg_net and pg_cron.
--  Then paste ALL of this into SQL Editor → New query → Run. Run it once.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- private settings (not reachable from the app at all) ----------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.settings (key text primary key, value text not null);
insert into private.settings values
  ('functions_url', 'https://ymzweuhxdcxkzweacwdi.supabase.co/functions/v1'),
  ('job_secret', encode(extensions.gen_random_bytes(24), 'hex'));

-- ---------- devices that have passed two-step sign-in ----------
create table public.trusted_devices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  key_hash   text not null unique,          -- the device keeps the key; only its fingerprint is stored here
  label      text,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  revoked_at timestamptz,                    -- set by the admin: the device wipes itself next time it's online
  revoked_by uuid references public.staff(id)
);
alter table public.trusted_devices enable row level security;   -- no policies: only the functions below can use it
revoke all on public.trusted_devices from anon, authenticated;

-- ---------- security log (sign-ins on new devices, wipes, permission changes, backups) ----------
create table public.security_events (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  kind     text not null,
  staff_id uuid references public.staff(id),   -- who it's about
  actor_id uuid references public.staff(id),   -- who did it
  detail   jsonb not null default '{}'::jsonb,
  emailed  boolean not null default false
);
alter table public.security_events enable row level security;
revoke all on public.security_events from anon, authenticated;
alter table public.staff add column if not exists wipe_after timestamptz;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active and role = 'admin')
$$;
create function public.key_hash(k text) returns text
language sql immutable set search_path = public as $$
  select encode(extensions.digest(coalesce(k, ''), 'sha256'), 'hex')
$$;
-- is this device one that passed two-step sign-in for the person signed in (and not wiped)?
create function public.device_ok(k text) returns boolean
language plpgsql security definer set search_path = public as $$
declare d uuid;
begin
  if k is null or length(k) < 32 then return false; end if;
  select id into d from public.trusted_devices where key_hash = public.key_hash(k) and user_id = auth.uid() and revoked_at is null;
  if d is null then return false; end if;
  update public.trusted_devices set last_seen = now() where id = d and last_seen < now() - interval '1 hour';
  return true;
end $$;
create function public.require_device(k text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.current_staff_id();
begin
  if sid is null then raise exception 'Not signed in as active staff' using errcode = '42501'; end if;
  if not public.device_ok(k) then raise exception 'DEVICE_NOT_TRUSTED' using errcode = '42501'; end if;
  return sid;
end $$;

-- what should this device do? (works even for someone who has been made inactive, so a wipe still happens)
create function public.device_status(k text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'active',  exists (select 1 from public.staff where user_id = auth.uid() and active),
    'trusted', exists (select 1 from public.trusted_devices where key_hash = public.key_hash(k) and user_id = auth.uid() and revoked_at is null),
    'wipe',    exists (select 1 from public.trusted_devices where key_hash = public.key_hash(k) and user_id = auth.uid() and revoked_at is not null)
  )
$$;

-- after the person has just entered a code from their authenticator app, remember this device
create function public.trust_device(k text, label text) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid := public.current_staff_id();
  code_at timestamptz;
  wa timestamptz;
begin
  if sid is null then raise exception 'Not signed in as active staff' using errcode = '42501'; end if;
  if k is null or length(k) < 32 then raise exception 'Bad device key'; end if;
  select to_timestamp(max((x->>'timestamp')::double precision)) into code_at
    from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) x where x->>'method' = 'totp';
  select wipe_after into wa from public.staff where id = sid;
  if code_at is null or code_at < now() - interval '15 minutes' or (wa is not null and code_at < wa) then
    raise exception 'CODE_NEEDED' using errcode = '42501';
  end if;
  if exists (select 1 from public.trusted_devices where key_hash = public.key_hash(k) and user_id <> auth.uid()) then
    raise exception 'Bad device key';
  end if;
  insert into public.trusted_devices (user_id, key_hash, label) values (auth.uid(), public.key_hash(k), left(label, 120))
  on conflict (key_hash) do update set revoked_at = null, revoked_by = null, label = excluded.label, last_seen = now();
  insert into public.security_events (kind, staff_id, actor_id, detail) values ('new_device', sid, sid, jsonb_build_object('device', left(label, 120)));
end $$;

-- ---------- reading and saving records now also needs a trusted device ----------
drop policy if exists "staff can read records" on public.records;
drop policy if exists "staff can read history" on public.record_history;
revoke select on public.records, public.record_history from authenticated;

create function public.pull_records(k text, since timestamptz, after_seq bigint, lim integer default 500) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.seq) from (
    select kind, id, data, rev, deleted, seq, updated_at from public.records
    where updated_at >= since and seq > after_seq order by seq limit least(greatest(lim, 1), 1000)) r), '[]'::jsonb);
end $$;
create function public.fetch_records(k text, kind_ text, ids text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return coalesce((select jsonb_agg(to_jsonb(r)) from (
    select kind, id, data, rev, deleted, seq, updated_at from public.records where kind = kind_ and id = any(ids[1:200])) r), '[]'::jsonb);
end $$;

-- same as before, plus the device check
create function public.push_records(items jsonb, k text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return public.push_records(items);
end $$;
revoke all on function public.push_records(jsonb) from authenticated;   -- the old one can't be called by the app any more

-- ---------- staff changes now go through functions that check the device too ----------
drop policy if exists "managers can add staff" on public.staff;
drop policy if exists "managers can change staff" on public.staff;
revoke insert, update on public.staff from authenticated;

create function public.staff_update(k text, staff_id uuid, patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.require_device(k); old public.staff;
begin
  if not public.can_manage_staff() then raise exception 'Only people who can manage staff can do this' using errcode = '42501'; end if;
  select * into old from public.staff where id = staff_id;
  if not found then raise exception 'No such person'; end if;
  update public.staff set
    full_name        = coalesce(patch->>'full_name', full_name),
    preferred_name   = case when patch ? 'preferred_name' then nullif(trim(patch->>'preferred_name'), '') else preferred_name end,
    initials         = coalesce(upper(patch->>'initials'), initials),
    role             = coalesce(patch->>'role', role),
    can_reports      = coalesce((patch->>'can_reports')::boolean, can_reports),
    can_invoices     = coalesce((patch->>'can_invoices')::boolean, can_invoices),
    can_manage_staff = coalesce((patch->>'can_manage_staff')::boolean, can_manage_staff),
    active           = coalesce((patch->>'active')::boolean, active)
  where id = staff_id;
  if (patch->>'role') = 'admin' or old.role = 'admin' and (patch ? 'role') and (patch->>'role') <> 'admin' then
    if not public.is_admin() then raise exception 'Only the admin can change who is admin' using errcode = '42501'; end if;
  end if;
  insert into public.security_events (kind, staff_id, actor_id, detail) values ('staff_changed', staff_id, sid, patch);
end $$;
create function public.staff_add(k text, person jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.require_device(k); nid uuid;
begin
  if not public.can_manage_staff() then raise exception 'Only people who can manage staff can do this' using errcode = '42501'; end if;
  if (person->>'role') = 'admin' and not public.is_admin() then raise exception 'Only the admin can add an admin' using errcode = '42501'; end if;
  insert into public.staff (email, full_name, preferred_name, initials, role)
  values (lower(trim(person->>'email')), person->>'full_name', nullif(trim(person->>'preferred_name'), ''), upper(person->>'initials'), coalesce(person->>'role', 'vet'))
  returning id into nid;
  insert into public.security_events (kind, staff_id, actor_id, detail) values ('staff_added', nid, sid, person);
  return nid;
end $$;

-- ---------- admin only: devices, wipe, reset two-step sign-in, security log ----------
create function public.require_admin(k text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.require_device(k);
begin
  if not public.is_admin() then raise exception 'Only the admin can do this' using errcode = '42501'; end if;
  return sid;
end $$;
create function public.list_devices(k text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin(k);
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'staff_id', s.id, 'label', d.label, 'created_at', d.created_at, 'last_seen', d.last_seen, 'revoked_at', d.revoked_at, 'this', d.key_hash = public.key_hash(k)) order by d.last_seen desc)
    from public.trusted_devices d join public.staff s on s.user_id = d.user_id), '[]'::jsonb);
end $$;
create function public.remove_device(k text, device_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.require_admin(k); s uuid; lbl text;
begin
  update public.trusted_devices set revoked_at = now(), revoked_by = sid where id = device_id and revoked_at is null
  returning (select st.id from public.staff st where st.user_id = trusted_devices.user_id), label into s, lbl;
  if s is not null then insert into public.security_events (kind, staff_id, actor_id, detail) values ('device_wiped', s, sid, jsonb_build_object('device', lbl)); end if;
end $$;
create function public.wipe_devices(k text, staff_id_ uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.require_admin(k); n integer;
begin
  update public.trusted_devices set revoked_at = now(), revoked_by = sid
  where user_id = (select user_id from public.staff where id = staff_id_) and revoked_at is null and key_hash <> public.key_hash(k);
  get diagnostics n = row_count;
  update public.staff set wipe_after = now() where id = staff_id_;
  insert into public.security_events (kind, staff_id, actor_id, detail) values ('devices_wiped', staff_id_, sid, jsonb_build_object('devices', n));
  return n;
end $$;
-- for a lost or replaced phone: they set up their authenticator app again at their next sign-in
create function public.reset_two_step(k text, staff_id_ uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare sid uuid := public.require_admin(k); uid uuid;
begin
  select user_id into uid from public.staff where id = staff_id_;
  if uid is null then raise exception 'They have no login yet'; end if;
  delete from auth.mfa_factors where user_id = uid;
  update public.trusted_devices set revoked_at = now(), revoked_by = sid where user_id = uid and revoked_at is null and key_hash <> public.key_hash(k);
  update public.staff set wipe_after = now() where id = staff_id_;
  insert into public.security_events (kind, staff_id, actor_id, detail) values ('two_step_reset', staff_id_, sid, '{}'::jsonb);
end $$;
create function public.security_log(k text, lim integer default 200) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin(k);
  return coalesce((select jsonb_agg(to_jsonb(e) order by e.at desc) from (
    select e.id, e.at, e.kind, e.detail, e.emailed, s.preferred_name as about_pref, s.full_name as about, a.preferred_name as by_pref, a.full_name as by
    from public.security_events e left join public.staff s on s.id = e.staff_id left join public.staff a on a.id = e.actor_id
    order by e.at desc limit least(greatest(lim, 1), 500)) e), '[]'::jsonb);
end $$;

revoke all on function public.device_ok(text), public.require_device(text), public.require_admin(text) from public, anon, authenticated;
revoke all on function public.pull_records(text, timestamptz, bigint, integer), public.fetch_records(text, text, text[]), public.push_records(jsonb, text),
  public.device_status(text), public.trust_device(text, text), public.staff_update(text, uuid, jsonb), public.staff_add(text, jsonb),
  public.list_devices(text), public.remove_device(text, uuid), public.wipe_devices(text, uuid), public.reset_two_step(text, uuid), public.security_log(text, integer) from public, anon;
grant execute on function public.pull_records(text, timestamptz, bigint, integer), public.fetch_records(text, text, text[]), public.push_records(jsonb, text),
  public.device_status(text), public.trust_device(text, text), public.staff_update(text, uuid, jsonb), public.staff_add(text, jsonb),
  public.list_devices(text), public.remove_device(text, uuid), public.wipe_devices(text, uuid), public.reset_two_step(text, uuid), public.security_log(text, integer) to authenticated;

-- ---------- email alerts and the nightly backup (run by the 'jobs' function) ----------
create function public.check_job_secret(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from private.settings where key = 'job_secret' and value = s)
$$;
revoke all on function public.check_job_secret(text) from public, anon, authenticated;
grant execute on function public.check_job_secret(text) to service_role;

create function public.call_jobs(body jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := (select value from private.settings where key = 'functions_url') || '/jobs',
    body := body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-job-secret', (select value from private.settings where key = 'job_secret')),
    timeout_milliseconds := 60000);
end $$;
revoke all on function public.call_jobs(jsonb) from public, anon, authenticated;

create function public.email_security_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind in ('new_device', 'device_wiped', 'devices_wiped', 'two_step_reset', 'staff_changed', 'staff_added', 'backup_failed') then
    perform public.call_jobs(jsonb_build_object('task', 'alert', 'id', new.id));
  end if;
  return new;
end $$;
create trigger email_security_event after insert on public.security_events
  for each row execute function public.email_security_event();

-- every night at 2:00 am Perth time (18:00 UTC)
select cron.schedule('bovitech-nightly-backup', '0 18 * * *', $$ select public.call_jobs('{"task":"backup"}'::jsonb) $$);

-- done
select 'Security setup finished' as result;
