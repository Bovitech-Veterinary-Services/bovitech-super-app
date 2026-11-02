# Database updates

Run them in order in Supabase → SQL Editor (each as a new query): 01, 02, 03, 04, 05, 06, 07, 08.

**Every update is safe to run twice.**
- 01, 02 and 03 stop straight away with "Update N was already run on this database. Nothing was changed." if they've been run before.
- 04 to 08 can simply be run again; they don't undo anything a later update did.

Rule for new updates: each one must be safe to run twice. It is either fully re-runnable (`create or replace`, `if not exists`, `on conflict do nothing`, `drop … if exists` before re-creating), or it checks at the top whether it has already run and stops with a clear message before changing anything. An update must never put back an older version of something a later update changed.
