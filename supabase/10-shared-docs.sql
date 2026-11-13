-- =====================================================================
--  Bovitech Super App — database update 10 (v2.46): secure links
--  • Invoices and statements can be sent to clients as a private link
--    (a long random code nobody can guess). The app records when the
--    client opens the link ("👁 Viewed").
--  • Also keeps "email opened" notices from Resend (a hint only — some
--    phones mark emails opened by themselves, some email programs block it).
--  • Only the "doc" server function can read or write these tables.
--  Safe to run more than once.
--  Supabase → SQL Editor → New query → paste ALL of this → Run.
-- =====================================================================

create table if not exists public.shared_docs (
  token      text primary key,               -- the private code in the link
  kind       text not null,                  -- inv (invoice) or stm (statement)
  ref        text,                           -- the invoice id (or statement period)
  bid        text,                           -- the business it was sent to
  title      text not null default '',
  html       text not null,                  -- the invoice / statement page
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '400 days')
);
create index if not exists shared_docs_ref on public.shared_docs (ref);
alter table public.shared_docs enable row level security;   -- no policies: only the "doc" function (service role) can reach it
revoke all on table public.shared_docs from anon, authenticated;

create table if not exists public.doc_views (
  id     bigint generated always as identity primary key,
  token  text not null,
  at     timestamptz not null default now(),
  ua     text not null default ''
);
create index if not exists doc_views_token on public.doc_views (token);
alter table public.doc_views enable row level security;
revoke all on table public.doc_views from anon, authenticated;

create table if not exists public.email_events (
  id        bigint generated always as identity primary key,
  email_id  text not null,                   -- Resend's id for the email
  type      text not null,                   -- email.opened, email.clicked, email.bounced…
  at        timestamptz not null default now(),
  unique (email_id, type, at)
);
create index if not exists email_events_email on public.email_events (email_id);
alter table public.email_events enable row level security;
revoke all on table public.email_events from anon, authenticated;

select 'Update 10 done — secure links are ready for the "doc" function.' as result;
