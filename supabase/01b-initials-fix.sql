-- Only needed if you already ran 01-setup.sql before 26 Oct 2026: changes the initials to ADMIN / MW / AW.
alter table public.staff drop constraint if exists staff_initials_check;
alter table public.staff add constraint staff_initials_check check (initials ~ '^[A-Z]{1,5}$');
update public.staff set initials = 'ADMIN' where email = 'office@bovitech.com.au';
update public.staff set initials = 'MW'    where email = 'milly.watts@bovitech.com.au';
update public.staff set initials = 'AW'    where email = 'allison.watson@bovitech.com.au';
select full_name, initials from public.staff order by full_name;
