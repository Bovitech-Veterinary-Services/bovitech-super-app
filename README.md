# Bovitech Practice

The new Bovitech Veterinary Services practice app, built one module at a time. **Module 1: Clients** (contacts, businesses, farms, routes) — built from the Bovitech Contacts app.

**No client data is stored in this repository.** Staff sign in with their own email and password; data syncs through the practice database (Supabase, Sydney) and is cached on each device for offline use. `config.js` holds the database address and its publishable key, which is designed to be public — the database only lets signed-in, active staff read or change anything.

`supabase/01-setup.sql` creates the database tables, staff list and security rules (run once in Supabase → SQL Editor).
