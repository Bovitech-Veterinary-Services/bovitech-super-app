-- =====================================================================
--  Bovitech Super App — database setup, step 6 (v2.2)
--  • Admin access can be given to any staff member's login (the office login stays the main admin)
--    Admins see the admin-only settings straight away — no admin PIN needed.
--  Run once: Supabase → SQL Editor → New query → paste ALL of this → Run.
-- =====================================================================

alter table public.staff add column if not exists admin_access boolean not null default false;

-- admin = the main admin (the office login) or anyone given admin access
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active and (role = 'admin' or admin_access))
$$;
-- admins can always manage staff
create or replace function public.can_manage_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active and (can_manage_staff or role = 'admin' or admin_access))
$$;

create or replace function public.staff_update(k text, staff_id uuid, patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.require_device(k); old public.staff;
begin
  if not public.can_manage_staff() then raise exception 'Only people who can manage staff can do this' using errcode = '42501'; end if;
  select * into old from public.staff where id = staff_id;
  if not found then raise exception 'No such person'; end if;
  if ((patch ? 'role') and ((patch->>'role') = 'admin' or old.role = 'admin') and (patch->>'role') is distinct from old.role)
     or ((patch ? 'admin_access') and (patch->>'admin_access')::boolean is distinct from old.admin_access) then
    if not public.is_admin() then raise exception 'Only an admin can change who is admin' using errcode = '42501'; end if;
  end if;
  if old.role = 'admin' and (patch ? 'active') and not (patch->>'active')::boolean then raise exception 'The main admin login can''t be turned off'; end if;
  update public.staff set
    full_name        = coalesce(patch->>'full_name', full_name),
    preferred_name   = case when patch ? 'preferred_name' then nullif(trim(patch->>'preferred_name'), '') else preferred_name end,
    initials         = coalesce(upper(patch->>'initials'), initials),
    role             = coalesce(patch->>'role', role),
    can_reports      = coalesce((patch->>'can_reports')::boolean, can_reports),
    can_invoices     = coalesce((patch->>'can_invoices')::boolean, can_invoices),
    can_manage_staff = coalesce((patch->>'can_manage_staff')::boolean, can_manage_staff),
    admin_access     = coalesce((patch->>'admin_access')::boolean, admin_access),
    active           = coalesce((patch->>'active')::boolean, active)
  where id = staff_id;
  insert into public.security_events (kind, staff_id, actor_id, detail) values ('staff_changed', staff_id, sid, patch);
end $$;
revoke all on function public.staff_update(text, uuid, jsonb) from public, anon;
grant execute on function public.staff_update(text, uuid, jsonb) to authenticated;

select 'Step 6 finished' as result;
