-- =====================================================================
--  Bovitech Practice — database setup, step 1 (staff logins + Clients module)
--  Paste ALL of this into Supabase → SQL Editor → New query → Run.
--  Safe to run once on a new, empty project.
-- =====================================================================

-- ---------- Staff (one row per person who can sign in) ----------
create table public.staff (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users(id) on delete set null,  -- their login, linked automatically by email
  email            text not null unique check (email = lower(trim(email))),
  full_name        text not null,
  preferred_name   text,
  initials         text not null check (initials ~ '^[A-Z]{1,5}$'),
  role             text not null check (role in ('admin', 'vet', 'vet_tech', 'assistant', 'other')),
  can_reports      boolean not null default false,   -- sales / inventory reports (later modules)
  can_invoices     boolean not null default true,    -- create and edit invoices (later modules)
  can_manage_staff boolean not null default false,   -- add staff and change these permissions
  active           boolean not null default true,    -- untick to stop someone signing in and syncing
  created_at       timestamptz not null default now()
);

insert into public.staff (email, full_name, preferred_name, initials, role, can_reports, can_invoices, can_manage_staff) values
  ('office@bovitech.com.au',         'Bovitech Office',  'Office', 'ADMIN', 'admin',    true,  true, true),
  ('jess.shilling@bovitech.com.au',  'Jessica Shilling', 'Jess',   'JS',  'vet',      false, true, false),
  ('milly.watts@bovitech.com.au',    'Amelia Watts',     'Milly',  'MW',  'vet',      false, true, false),
  ('allison.watson@bovitech.com.au', 'Allison Watson',   'Ally',   'AW',  'vet_tech', false, true, false),
  ('rory.nevard@sydney.edu.au',      'Rory Nevard',      'Rory',   'RN',  'vet',      false, true, false);

-- who is signed in right now (null if not staff, or not active)
create function public.current_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.staff where user_id = auth.uid() and active
$$;
create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active)
$$;
create function public.can_manage_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active and can_manage_staff)
$$;

-- link a new login to its staff row (matched by email)
create function public.link_staff_login() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.staff set user_id = new.id where email = lower(trim(new.email)) and user_id is null;
  return new;
end $$;
create trigger link_staff_login after insert on auth.users
  for each row execute function public.link_staff_login();

-- and the other way round: a staff row added after their login was made
create function public.link_login_to_staff() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  if new.user_id is null then
    select id into new.user_id from auth.users where lower(email) = new.email limit 1;
  end if;
  return new;
end $$;
create trigger link_login_to_staff before insert or update of email on public.staff
  for each row execute function public.link_login_to_staff();

-- never leave the practice without someone who can manage staff
create function public.keep_one_manager() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.staff where active and can_manage_staff) then
    raise exception 'At least one active person must be able to manage staff';
  end if;
  return null;
end $$;
create constraint trigger keep_one_manager after update or delete on public.staff
  deferrable initially deferred for each row execute function public.keep_one_manager();

-- logins that already exist (made before this script ran)
update public.staff s set user_id = u.id from auth.users u where lower(u.email) = s.email and s.user_id is null;

-- ---------- Records (contacts, businesses, farms, tags, routes, settings…) ----------
create sequence public.records_seq;
create table public.records (
  kind       text not null check (kind ~ '^[a-z_]{1,30}$'),
  id         text not null check (length(id) between 1 and 100),
  data       jsonb,
  rev        integer not null default 1,
  deleted    boolean not null default false,
  seq        bigint not null default nextval('public.records_seq'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff(id),
  device     text,
  primary key (kind, id)
);
create index records_updated_idx on public.records (updated_at, seq);

-- every earlier version is kept, with who changed it and when
create table public.record_history (
  hid        bigserial primary key,
  kind       text not null,
  id         text not null,
  rev        integer,
  data       jsonb,
  deleted    boolean,
  changed_at timestamptz,
  changed_by uuid,
  device     text,
  replaced_at timestamptz not null default now()
);
create index record_history_rec_idx on public.record_history (kind, id, hid desc);

create function public.keep_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.record_history (kind, id, rev, data, deleted, changed_at, changed_by, device)
  values (old.kind, old.id, old.rev, old.data, old.deleted, old.updated_at, old.updated_by, old.device);
  return new;
end $$;
create trigger keep_history before update on public.records
  for each row execute function public.keep_history();

-- The app saves changes only through this function. Each change says which revision it was
-- based on; if someone else saved a newer one first, it is refused (ok:false) and the app
-- downloads theirs and shows a sync conflict instead of overwriting it.
create function public.push_records(items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  sid uuid := public.current_staff_id();
  it jsonb; cur_rev integer; is_del boolean; new_rev integer;
  result jsonb := '[]'::jsonb;
begin
  if sid is null then
    raise exception 'Not signed in as active staff' using errcode = '42501';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 500 then
    raise exception 'items must be an array of up to 500 records';
  end if;
  for it in select value from jsonb_array_elements(items) loop
    is_del := coalesce((it->>'deleted')::boolean, false);
    select rev into cur_rev from public.records where kind = it->>'kind' and id = it->>'id' for update;
    if found and not coalesce((it->>'force')::boolean, false)
       and cur_rev <> coalesce((it->>'base_rev')::integer, 0) then
      result := result || jsonb_build_object('kind', it->>'kind', 'id', it->>'id', 'ok', false, 'rev', cur_rev);
      continue;
    end if;
    new_rev := coalesce(cur_rev, 0) + 1;
    insert into public.records as r (kind, id, data, rev, deleted, updated_by, device)
    values (it->>'kind', it->>'id', case when is_del then null else it->'data' end, new_rev, is_del, sid, left(it->>'device', 100))
    on conflict (kind, id) do update
      set data = excluded.data, rev = excluded.rev, deleted = excluded.deleted,
          updated_by = excluded.updated_by, device = excluded.device,
          updated_at = now(), seq = nextval('public.records_seq');
    result := result || jsonb_build_object('kind', it->>'kind', 'id', it->>'id', 'ok', true, 'rev', new_rev);
  end loop;
  return result;
end $$;

-- ---------- Security: only signed-in, active staff can see anything ----------
alter table public.staff enable row level security;
alter table public.records enable row level security;
alter table public.record_history enable row level security;

create policy "staff can see staff list"   on public.staff for select to authenticated using (public.is_staff());
create policy "managers can add staff"     on public.staff for insert to authenticated with check (public.can_manage_staff());
create policy "managers can change staff"  on public.staff for update to authenticated using (public.can_manage_staff()) with check (public.can_manage_staff());
create policy "staff can read records"     on public.records for select to authenticated using (public.is_staff());
create policy "staff can read history"     on public.record_history for select to authenticated using (public.is_staff());
-- (no insert/update/delete policies on records: changes go through push_records only)

revoke all on public.records, public.record_history from anon;
revoke all on public.staff from anon;
revoke insert, update, delete on public.records, public.record_history from authenticated;
revoke delete on public.staff from authenticated;
revoke all on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;

-- done. Check: this should list the 5 staff.
select full_name, email, initials, role, can_reports, can_manage_staff, (user_id is not null) as has_login from public.staff order by full_name;
