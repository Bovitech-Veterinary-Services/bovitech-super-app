-- =====================================================================
--  Bovitech Super App — database setup, step 7 (v2.4)
--  • Google Calendar: only one sync runs at a time (stops calendars and events being made twice)
--  Safe to run twice. Run: Supabase → SQL Editor → New query → paste ALL of this → Run.
-- =====================================================================

alter table private.gcal add column if not exists lock_at timestamptz;

-- the gcal function takes this before syncing; true = go ahead, false = another sync is running
create or replace function public.gcal_lock() returns boolean
language plpgsql security definer set search_path = public as $$
declare got boolean;
begin
  update private.gcal set lock_at = now() where id = 1 and (lock_at is null or lock_at < now() - interval '4 minutes') returning true into got;
  return coalesce(got, false);
end $$;
create or replace function public.gcal_unlock() returns void
language sql security definer set search_path = public as $$ update private.gcal set lock_at = null where id = 1 $$;
revoke all on function public.gcal_lock(), public.gcal_unlock() from public, anon, authenticated;
grant execute on function public.gcal_lock(), public.gcal_unlock() to service_role;

select 'Step 7 finished' as result;
