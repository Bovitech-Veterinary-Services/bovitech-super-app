-- =====================================================================
--  Bovitech Super App — database setup, step 8 (v2.5.3)
--  • "🔑 New QR code" (Settings → Users) finds the person's login by email too, and re-links it,
--    so it always works — even if their login was made more than once.
--  Safe to run twice. Run: Supabase → SQL Editor → New query → paste ALL of this → Run.
-- =====================================================================

create or replace function public.reset_two_step(k text, staff_id_ uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare sid uuid := public.require_admin(k); em text; uid uuid; n integer := 0;
begin
  select email into em from public.staff where id = staff_id_;
  if em is null then raise exception 'No such person'; end if;
  select id into uid from auth.users where lower(email) = lower(em) order by created_at desc limit 1;
  if uid is null then raise exception 'They have no login yet — tap "Create their login" first'; end if;
  update public.staff set user_id = uid where id = staff_id_ and user_id is distinct from uid; -- their staff entry points at the login they actually use
  delete from auth.mfa_factors where user_id in (select id from auth.users where lower(email) = lower(em));
  get diagnostics n = row_count;
  update public.trusted_devices set revoked_at = now(), revoked_by = sid where user_id in (select id from auth.users where lower(email) = lower(em)) and revoked_at is null and key_hash <> public.key_hash(k);
  update public.staff set wipe_after = now() where id = staff_id_;
  insert into public.security_events (kind, staff_id, actor_id, detail) values ('two_step_reset', staff_id_, sid, jsonb_build_object('factors_removed', n));
end $$;
revoke all on function public.reset_two_step(text, uuid) from public, anon;
grant execute on function public.reset_two_step(text, uuid) to authenticated;

select 'Step 8 finished' as result;
