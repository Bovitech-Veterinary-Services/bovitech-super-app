-- Bovitech Super App — Settings → Users: the admin creates logins and sets passwords from the app.
-- Run once in Supabase → SQL Editor. The "users" Edge Function calls this to check who is asking.
create or replace function public.login_check(k text, email_ text, action_ text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.require_device(k); st public.staff;
begin
  if not public.is_admin() then raise exception 'Only the admin can create logins or set passwords' using errcode = '42501'; end if;
  if action_ not in ('create', 'password') then raise exception 'Unknown action'; end if;
  select * into st from public.staff where email = lower(trim(email_));
  if not found then raise exception 'Add them to the staff list first' using errcode = '42501'; end if;
  insert into public.security_events (kind, staff_id, actor_id, detail)
    values (case when action_ = 'create' then 'login_created' else 'password_set' end, st.id, sid, jsonb_build_object('email', st.email));
  return jsonb_build_object('ok', true, 'staff_id', st.id, 'user_id', st.user_id);
end $$;
revoke all on function public.login_check(text, text, text) from public, anon;
grant execute on function public.login_check(text, text, text) to authenticated;
