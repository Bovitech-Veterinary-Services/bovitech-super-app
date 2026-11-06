/* Bovitech Super App — "Setup to do" in Jobs (admin logins only): each one-off setup task, with full
   step-by-step instructions and a button to copy the code that's needed. Tick ✓ Done when finished
   (it's remembered on every device). Some tick themselves once the app can see they're done. */
'use strict';
const SETUP_FILES = { mail: 'supabase/functions/mail/index.ts', sql09: 'supabase/09-ezyvet-archive.sql', sql08: 'supabase/08-qr-reset.sql', sql07: 'supabase/07-gcal-lock.sql', users: 'supabase/functions/users/index.ts', sql03: 'supabase/03-sms.sql', sql04: 'supabase/04-users.sql', sql05: 'supabase/05-calendar-sms.sql', sql06: 'supabase/06-admins.sql', gcal: 'supabase/functions/gcal/index.ts', jobs: 'supabase/functions/jobs/index.ts' };
const SETUP_REDIRECT = 'https://ymzweuhxdcxkzweacwdi.supabase.co/functions/v1/gcal';
const SETUP_SUPA = 'https://supabase.com/dashboard/project/ymzweuhxdcxkzweacwdi';
const setupCopy = (f, label) => `<button class="btn small greenbtn" data-act="setup-copy" data-f="${f}">📋 ${label}</button>`;
const SETUP = [
  { id: 'sql03', t: 'Run database update 3 (texts from the office phone)', steps: [
    `On the office computer, open <a href="${SETUP_SUPA}/sql/new" target="_blank" rel="noopener">Supabase → SQL Editor → New query</a> and sign in if it asks.`,
    `Come back here and tap ${setupCopy('sql03', 'Copy update 3')}.`,
    'In Supabase, click in the big empty query box, press <b>Ctrl + A</b> then <b>Ctrl + V</b> to paste it in.',
    'Click <b>Run</b> (bottom right). If it asks about "destructive operations", click <b>Run this query</b>.',
    'It should finish with no red error. If it says <b>Update 3 was already run on this database. Nothing was changed.</b>, it was done before — that\'s fine, carry on.',
    'Tick <b>✓ Done</b> below.'] },
  { id: 'sql04', t: 'Run database update 4 (making logins and passwords from the app)', after: 'sql03', steps: [
    `Open <a href="${SETUP_SUPA}/sql/new" target="_blank" rel="noopener">Supabase → SQL Editor → New query</a>.`,
    `Tap ${setupCopy('sql04', 'Copy update 4')}.`,
    'Click in the query box in Supabase, press <b>Ctrl + A</b> then <b>Ctrl + V</b>, then click <b>Run</b>.',
    'It should finish with no red error. It\'s safe to run again even if it was done before.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'sql05', t: 'Run database update 5 (Google Calendar, day sheets, "Y" replies)', after: 'sql04', steps: [
    `On the office computer, open <a href="${SETUP_SUPA}/sql/new" target="_blank" rel="noopener">Supabase → SQL Editor → New query</a> and sign in if it asks.`,
    `Come back here and tap ${setupCopy('sql05', 'Copy update 5')} — it copies the whole update.`,
    'In Supabase, click in the big empty query box, press <b>Ctrl + A</b> then <b>Ctrl + V</b> to paste it in.',
    'Click <b>Run</b> (bottom right). If it asks about "destructive operations", click <b>Run this query</b>.',
    'At the bottom it should say <b>Step 5 finished</b> (it\'s safe to run again if you\'re not sure). If it says <b>relation "public.sms_log" does not exist</b>, do update 3 first. Any other red error: copy it and send it to Claude.',
    'Tick <b>✓ Done</b> below.'] },
  { id: 'sql06', t: 'Run database update 6 (admin access for chosen logins)', auto: () => !!(window.SBAuth && SBAuth.staff && 'admin_access' in SBAuth.staff), steps: [
    `Open <a href="${SETUP_SUPA}/sql/new" target="_blank" rel="noopener">Supabase → SQL Editor → New query</a>.`,
    `Tap ${setupCopy('sql06', 'Copy update 6')}.`,
    'Click in the query box in Supabase, press <b>Ctrl + A</b> then <b>Ctrl + V</b>, then click <b>Run</b>.',
    'It should say <b>Step 6 finished</b>.',
    'Close the app and open it again — this job ticks itself off. Then you can tick <b>Admin</b> for other people in Settings → Users → Staff.'] },
  { id: 'gcal', t: 'Add the "gcal" server function (keeps Google Calendar up to date)', after: 'sql05', steps: [
    `Open <a href="${SETUP_SUPA}/functions" target="_blank" rel="noopener">Supabase → Edge Functions</a>.`,
    'Click <b>Deploy a new function</b>, then <b>Via Editor</b>.',
    `Come back here and tap ${setupCopy('gcal', 'Copy the gcal code')}.`,
    'In Supabase, click in the code box, press <b>Ctrl + A</b> (to select the example code) then <b>Ctrl + V</b> to replace it.',
    'Change the function name (bottom left) to exactly <b>gcal</b> — all lower case.',
    'Click <b>Deploy function</b> and wait for it to say it’s deployed.',
    'Open the <b>Details</b> tab of the gcal function, turn <b>off</b> "Verify JWT with legacy secret" (or "Enforce JWT verification"), and click <b>Save changes</b>. Google has to be able to come back to it, so this must be off.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'jobs', t: 'Update the "jobs" server function (texts, day sheets, "Y" replies)', after: 'sql05', steps: [
    `Open <a href="${SETUP_SUPA}/functions/jobs/code" target="_blank" rel="noopener">Supabase → Edge Functions → jobs → Code</a>.`,
    `Come back here and tap ${setupCopy('jobs', 'Copy the jobs code')}.`,
    'In Supabase, click in the code box, press <b>Ctrl + A</b> then <b>Ctrl + V</b> to replace all of it.',
    'Click <b>Deploy updates</b> (bottom right) and wait for it to finish.',
    'Leave "Verify JWT" as it was. Tick <b>✓ Done</b>.'] },
  { id: 'smsapp', t: 'Texts from the office phone: set up the SMS app', after: 'jobs', steps: [
    '<b>On the office mobile (it must be an Android phone with a SIM that can send texts):</b> open the Play Store and install <b>SMS Gateway for Android</b> (by capcom6 — website sms-gate.app). If the Play Store hasn\'t got it, download the latest APK from <a href="https://github.com/capcom6/android-sms-gateway/releases" target="_blank" rel="noopener">github.com/capcom6/android-sms-gateway/releases</a> and allow "Install unknown apps" when the phone asks.',
    'Open it. When it asks, <b>Allow</b> it to send and view SMS messages (and phone access, if asked). Replies won\'t come back to the app without the SMS permission.',
    'Turn on the <b>Cloud server</b> switch, then tap <b>Start service</b> (or Online) at the bottom. It should say it is connected/online.',
    'Under <b>Cloud server</b> it now shows a <b>Username</b> and <b>Password</b>. Leave the phone open on this screen. (Don\'t send them to anyone — not even Claude.)',
    'Stop the phone from closing the app to save battery: phone <b>Settings → Apps → SMS Gateway → Battery → Unrestricted</b> (on Samsung: <b>Battery → Unrestricted</b>, and take it off "Sleeping apps"). Keep the phone charged, on, with mobile signal and internet (Wi-Fi or data).',
    `<b>On the office computer:</b> open <a href="${SETUP_SUPA}/functions/secrets" target="_blank" rel="noopener">Supabase → Edge Functions → Secrets</a>. Click <b>Add new secret</b>: Name <b>SMSGATE_USER</b> <button class="btn small greenbtn" data-act="setup-copytext" data-v="SMSGATE_USER">📋 Copy</button>, Value = the <b>Username</b> from the phone. Add another: Name <b>SMSGATE_PASS</b> <button class="btn small greenbtn" data-act="setup-copytext" data-v="SMSGATE_PASS">📋 Copy</button>, Value = the <b>Password</b> from the phone (type it exactly — capitals matter). Click <b>Save</b>.`,
    `Tell the phone where to send replies and delivery reports: open <a href="${SETUP_SUPA}/sql/new" target="_blank" rel="noopener">Supabase → SQL Editor → New query</a>, paste <b>select public.call_jobs('{"task":"sms_setup"}'::jsonb);</b> <button class="btn small greenbtn" data-act="setup-copytext" data-v="select public.call_jobs('{&quot;task&quot;:&quot;sms_setup&quot;}'::jsonb);">📋 Copy</button> and click <b>Run</b>.`,
    `Wait 10 seconds, then replace it with <b>select status_code, content::text from net._http_response order by id desc limit 1;</b> <button class="btn small greenbtn" data-act="setup-copytext" data-v="select status_code, content::text from net._http_response order by id desc limit 1;">📋 Copy</button> and click <b>Run</b>. It should show <b>200</b> and <b>"ok":true</b>. If it says <b>SMS isn't set up yet</b> or <b>401</b>, the username or password secret doesn't match the phone — fix the secret and run the first line again.`,
    'Test it <b>on the office computer</b> (on a phone, 💬 uses that phone\'s own messages instead): open a business page where you are a contact with your mobile, and tap <b>💬</b> beside your name. Write a short text and send it — it goes from the office phone within about 5 minutes. Reply <b>hello</b> to it from your mobile: the reply should appear in <b>Scheduling → Jobs → SMS replies</b>.',
    'Tick <b>✓ Done</b> when the test text and the reply both work.'] },
  { id: 'redirect', t: 'Google: add the return address and copy the client secret', steps: [
    'Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud → Credentials</a>, signed in as <b>bovitechvetservices@gmail.com</b> (the account that made the app\'s Google project). At the top, check the right project is chosen.',
    'Under <b>OAuth 2.0 Client IDs</b>, click the <b>Web client</b> the app uses.',
    `Under <b>Authorized redirect URIs</b>, click <b>+ Add URI</b> and paste <b style="word-break:break-all">${SETUP_REDIRECT}</b> <button class="btn small greenbtn" data-act="setup-copytext" data-v="${SETUP_REDIRECT}">📋 Copy</button>`,
    'Click <b>Save</b> at the bottom.',
    'Google no longer shows an existing secret, so make a new one: on the same page under <b>Client secrets</b>, click <b>+ Add secret</b>. (The old one keeps working — don\'t disable or delete it.)',
    'The new secret is shown in full <b>only once</b> — click its copy icon straight away, and go straight on to the next job (Supabase → Secrets) to paste it in. Never paste it anywhere else, and never into Claude. If you lose it before pasting, just click + Add secret again and use the newest one.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'secret', t: 'Supabase: add GOOGLE_CLIENT_SECRET', after: 'redirect', steps: [
    `Open <a href="${SETUP_SUPA}/functions/secrets" target="_blank" rel="noopener">Supabase → Edge Functions → Secrets</a>.`,
    'Under <b>Add new secrets</b>: Name = <b>GOOGLE_CLIENT_SECRET</b> <button class="btn small greenbtn" data-act="setup-copytext" data-v="GOOGLE_CLIENT_SECRET">📋 Copy the name</button>',
    'Value = the new client secret you just made and copied in Google (+ Add secret).',
    'Click <b>Save</b>.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'publish', t: 'Google: set the app to "In production"', steps: [
    'Open <a href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noopener">Google Cloud → Google Auth Platform → Audience</a> (older screens call it "OAuth consent screen"), same account and project as before.',
    'Under <b>Publishing status</b> it probably says <b>Testing</b>. Click <b>Publish app</b>, then <b>Confirm</b>.',
    'It should now say <b>In production</b>. (In "Testing", Google signs the app out every 7 days.) You don\'t need Google to verify it — it\'s only used by the practice account.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'connect', t: 'Connect Google Calendar in the app', after: 'secret', auto: () => !!(typeof BK !== 'undefined' && BK.gcalSt && BK.gcalSt.connected), steps: [
    'In this app go to <b>Settings → Scheduling → Google Calendar</b> (you may need to turn the Scheduling tab on in Settings → Scheduling first).',
    'Tap <b>Connect Google Calendar</b>.',
    'Choose <b>bovitechvetservices@gmail.com</b>. If Google says the app isn\'t verified, tap <b>Advanced</b> → <b>Go to … (unsafe)</b> — it\'s your own app.',
    'Tick every box Google asks about, then <b>Continue</b>.',
    'You\'ll see <b>Google Calendar connected</b>. Go back to the app — the Google Calendar card shows when it last updated.',
    'This job ticks itself off once the app sees it\'s connected (or tick ✓ Done).'] },
  { id: 'sig', t: 'Add each vet\'s signature and registration number', auto: () => { const l = ((typeof crCfg === 'function' && crCfg('sigs')) || {}).list || {}; const vets = ((window.SBAuth && SBAuth.list) || []).filter((s) => s.active && s.role === 'vet'); return vets.length > 0 && vets.every((s) => l[s.id] && l[s.id].img && l[s.id].reg); }, steps: [
    'Go to <b>Settings → Templates → Signatures</b>.',
    'Under your name: <b>Choose file</b> and pick <b>jess-signature.png</b> (Claude sent it in the chat — save it to the computer first).',
    'Type your <b>Registration number</b>: <b>V3220</b>. Check the name and qualifications (Dr Jessica Shilling, BSc/BVMS).',
    'Do the same for Milly and Rory: a photo or scan of their signature on white paper works (crop it close).',
    'This job ticks itself off once every vet has a signature and registration number.'] },
  { id: 'admins', t: 'Choose who else has admin access', after: 'sql06', steps: [
    'Go to <b>Settings → Users → Staff & permissions</b>.',
    'Tick <b>Admin</b> next to each person who should see and change the admin-only settings (the office login always has it).',
    'People with admin access no longer need the admin PIN. Everyone else doesn\'t see the admin-only settings at all.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'users', t: 'Add the "users" server function (making logins and resetting passwords)', steps: [
    `Open <a href="${SETUP_SUPA}/functions" target="_blank" rel="noopener">Supabase → Edge Functions</a>.`,
    'Click <b>Deploy a new function</b>, then <b>Via Editor</b>.',
    `Come back here and tap ${setupCopy('users', 'Copy the users code')}.`,
    'In Supabase, click in the code box, press <b>Ctrl + A</b> then <b>Ctrl + V</b> to replace the example code.',
    'Change the function name (bottom left) to exactly <b>users</b> — all lower case.',
    'Click <b>Deploy function</b> and wait for it to say it’s deployed. Leave "Verify JWT" on (as it is).',
    'Test it: Settings → Users → Staff & permissions → 🔑 Set a new password for someone. It should say the password was changed.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'gcal2', t: 'Update the "gcal" server function (goes straight back to the app after connecting)', after: 'gcal', steps: [
    `Open <a href="${SETUP_SUPA}/functions/gcal/code" target="_blank" rel="noopener">Supabase → Edge Functions → gcal → Code</a>.`,
    `Come back here and tap ${setupCopy('gcal', 'Copy the gcal code')}.`,
    'In Supabase, click in the code box, press <b>Ctrl + A</b> then <b>Ctrl + V</b> to replace all of it.',
    'Click <b>Deploy updates</b> and wait for it to finish. (Leave "Verify JWT" off.)',
    'Nothing else to do — Google Calendar is already connected. Next time you connect, Google sends you straight back to the app instead of showing a page of code.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'sql08', t: 'Run database update 8 (makes "🔑 New QR code" always work)', steps: [
    `Open <a href="${SETUP_SUPA}/sql/new" target="_blank" rel="noopener">Supabase → SQL Editor → New query</a>.`,
    `Tap ${setupCopy('sql08', 'Copy update 8')}.`,
    'Click in the query box in Supabase, press <b>Ctrl + A</b> then <b>Ctrl + V</b>, then click <b>Run</b>.',
    'It should say <b>Step 8 finished</b>. It\'s safe to run again.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'sql07', t: 'Run database update 7 (stops Google Calendar making things twice)', steps: [
    `Open <a href="${SETUP_SUPA}/sql/new" target="_blank" rel="noopener">Supabase → SQL Editor → New query</a>.`,
    `Tap ${setupCopy('sql07', 'Copy update 7')}.`,
    'Click in the query box in Supabase, press <b>Ctrl + A</b> then <b>Ctrl + V</b>, then click <b>Run</b>.',
    'It should say <b>Step 7 finished</b>. It\'s safe to run again.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'gcal4', t: 'Update the "gcal" server function (📦 Day prep on everyone\'s calendar; fixes the double calendar and events)', after: 'sql07', steps: [
    `Open <a href="${SETUP_SUPA}/functions/gcal/code" target="_blank" rel="noopener">Supabase → Edge Functions → gcal → Code</a>.`,
    `Come back here and tap ${setupCopy('gcal', 'Copy the gcal code')}.`,
    'In Supabase, click in the code box, press <b>Ctrl + A</b> then <b>Ctrl + V</b> to replace all of it.',
    'Click <b>Deploy updates</b> and wait for it to finish. (Leave "Verify JWT" off.)',
    'In this app: Settings → Scheduling → Google Calendar → <b>Sync now</b>. Within a minute or two each person\'s calendar gets a <b>📦 Day prep</b> event the half hour before their first appointment, every working day for the next 2 weeks (the day sheets are there too). Any second "Bovitech — Milly" calendar and second "On call" events go.',
    'On your phone, pull down to refresh Google Calendar if they still show.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'sharecal', t: 'Share each person\'s day sheet calendar with them', after: 'connect', steps: [
    'Day sheets go on Google Calendar only (not texted). Each person gets their own calendar called <b>Bovitech — their name</b>, owned by bovitechvetservices@gmail.com.',
    'A person\'s calendar is made the first time they have a day sheet — that is, once their appointments are booked in this app (Scheduling). While real bookings are still in ezyVet, there won\'t be any yet; come back to this job then.',
    'On a computer, open <a href="https://calendar.google.com/calendar/u/0/r/settings" target="_blank" rel="noopener">Google Calendar → Settings</a> signed in as <b>bovitechvetservices@gmail.com</b>.',
    'On the left under <b>Settings for my calendars</b>, click <b>Bovitech — Jess</b> (and so on for each person).',
    'Scroll to <b>Share with specific people or groups</b> → <b>+ Add people and groups</b> → type that person\'s Google email → permission <b>See all event details</b> → <b>Send</b>.',
    'They accept the email from Google, and the calendar appears in their Google Calendar app (tick it on in the calendar list if it\'s hidden).',
    'Do the same for <b>Bovitech On Call</b> if anyone can\'t see it yet (vets need "Make changes to events" to see each person\'s on-call colour).',
    'Tick <b>✓ Done</b> once everyone can see theirs.'] },
  { id: 'sql09', t: 'Run database update 9 (the ezyVet history and record search)', auto: () => !!(window.EZ && EZ.sql09), steps: [
    `Tap ${setupCopy('sql09', 'Copy update 9')}.`,
    'Open Supabase → <b>SQL Editor</b> → <b>New query</b>, paste it all, and tap <b>Run</b>. It says "Success. No rows returned".',
    'Tick <b>✓ Done</b>. (It is safe to run again.)'] },
  { id: 'ezyimport', t: 'Import the ezyVet export', after: 'sql09', auto: () => !!(D && D.settings && D.settings.ezyImport), steps: [
    'Use the office computer, signed in as an admin, with the ezyVet backup zip (bovitechvet_backup.zip — the small one, not the 13 GB attachments) downloaded.',
    '<button class="btn primary" data-act="ezy-start">📥 Choose the ezyVet backup zip…</button>',
    'A summary opens (clients matched, new, maybe the same; herds; price list and bundles; appointments; history). Check it, then tap <b>📥 Import now</b> at the top of that summary. Leave the app open until it says finished — the history takes a few minutes. If it stops, run it again: nothing is doubled.',
    'Then work through <b>Jobs</b>: "ezyVet import: the same client?", "ezyVet notes: a warning, or just info?" and "No category" (new active clients).'] },
  { id: 'mailfn', t: 'Email from the app (purchase orders to suppliers, from office@bovitech.com.au)', steps: [
    'Sign in to <a href="https://resend.com/domains" target="_blank" rel="noopener">resend.com → Domains</a> (the account the backups already use) and tap <b>Add domain</b>: <b>bovitech.com.au</b>, region Sydney if it asks.',
    'Resend shows a few DNS records (TXT and MX, mostly on <b>send</b> and <b>resend._domainkey</b>). Keep that page open.',
    'In another tab sign in to <b>HostPapa → cPanel → Zone Editor</b>, tap <b>Manage</b> next to bovitech.com.au, and add each record exactly as Resend shows it (type, name, value, priority). <b>Don\'t change or delete the records already there</b> — your normal email keeps working.',
    'Back in Resend tap <b>Verify DNS records</b>. It can take from a few minutes to a few hours to say <b>Verified</b>.',
    `In Supabase → <a href="${SETUP_SUPA}/functions/secrets" target="_blank" rel="noopener">Edge Functions → Secrets</a>, <b>+ Add secret</b>: name <b>MAIL_FROM</b>, value <b>Bovitech Veterinary Services &lt;office@bovitech.com.au&gt;</b>.`,
    `In Supabase → <a href="${SETUP_SUPA}/functions" target="_blank" rel="noopener">Edge Functions</a> → <b>Deploy a new function</b> → <b>Via Editor</b>, name it <b>mail</b>, tap ${setupCopy('mail', 'Copy the mail code')}, paste it over everything in the code box and <b>Deploy</b>. (Leave "Verify JWT" ON.)`,
    'Try it: Records → Stock → Orders → make an order to yourself and send it.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'ezyfinal', t: 'Final ezyVet import — just before closing ezyVet', after: 'ezyimport2', steps: [
    'Do this last, when you are ready to stop using ezyVet. Ask ezyVet for a fresh full export (the same backup zip as before).',
    'On the office computer, signed in as an admin: <button class="btn primary" data-act="ezy-start">📥 Choose the new ezyVet backup zip…</button>',
    'The summary says <b>Importing again keeps every change made in the app</b>. Everything you have fixed here stays as it is: merged or deleted clients, people, phone numbers, emails, notes, PICs and patients aren\'t brought back, and prices you changed aren\'t overwritten. Only what is new in ezyVet since the last import is added (new clients, herds, appointments, and the latest history).',
    'Tap <b>📥 Import now</b> and leave the app open until it says finished, then check Jobs for anything new to sort out.',
    'Tick <b>✓ Done</b> — then ezyVet can be closed.'] },
  { id: 'ezyimport2', t: 'Run the ezyVet import again (brings in stock minimums, barcodes and suppliers)', after: 'ezyimport', steps: [
    'On the office computer, signed in as an admin, with bovitechvet_backup.zip.',
    '<button class="btn primary" data-act="ezy-start">📥 Choose the ezyVet backup zip…</button>',
    'Tap <b>📥 Import now</b>. Nothing is doubled — it adds each product\'s minimum, usual order amount, barcodes and supplier (with their code and price) to the price list.',
    'Then Records → Stock → Vehicles: add your vehicles, and Records → Stock → 📝 Stocktake to put in what you have.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'vcontrol2', t: 'vControl: try uploading the on-call schedule files from the app', steps: [
    'In the app: <b>Scheduling → On call → 📟 vControl</b> (tap it to open). Choose the dates, then tap <b>⬇ 111097-Jess.csv</b> and <b>⬇ 111097-Milly.csv</b> (one file per vet, in the same layout as vControl\'s own download: Time and Label).',
    'In vControl, open the <b>111097-Jess</b> schedule and use its CSV import to upload 111097-Jess.csv. Check the times came in right. Do the same for Milly.',
    'If vControl rejects it or the times are wrong, send Claude the error message (or what it shows) — the layout is easy to change.',
    'Tick <b>✓ Done</b> when it works.'] },
];
function setupJobs() { // admin logins only
  if (!(window.SBAuth && SBAuth.isAdmin && (SBAuth.isAdmin() || (typeof S !== 'undefined' && S.admin)))) return [];
  const dis = (D && D.dismissed) || {}; const done = (id) => !!dis['setup:' + id] || !!((SETUP.find((x) => x.id === id) || {}).auto && SETUP.find((x) => x.id === id).auto());
  return SETUP.filter((x) => !done(x.id)).map((x, i) => ({ type: 'setup', key: 'setup:' + x.id, kind: 'setup', id: x.id, who: x.t, note: x.after && !done(x.after) ? `Do "${(SETUP.find((y) => y.id === x.after) || {}).t}" first` : '', n: i }));
}
function setupJobHtml(j) {
  const x = SETUP.find((y) => y.id === j.id); if (!x) return '';
  return `<div class="job setupjob"><div class="t"><div class="who"><b>🛠 ${h(x.t)}</b></div>${j.note ? `<div class="note">⏳ ${h(j.note)}</div>` : ''}${/^ezy(final|import2?)$/.test(x.id) ? (() => { const L = D.settings.ezyImports || (D.settings.ezyImport ? [D.settings.ezyImport] : []); return `<div class="note">${L.length ? `📥 ezyVet imports recorded in the app: ${h(L.map((y) => new Date(y.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + (y.clients ? ` (${y.clients} clients)` : '')).join(', '))}${L.length === 1 && !D.settings.ezyImports ? ' — the most recent one (earlier ones weren\'t listed before this version)' : ''}` : '⚠ No ezyVet import is recorded in the app yet.'}</div>`; })() : ''}
    <details ${S.setupOpen === x.id ? 'open' : ''} data-setup="${x.id}"><summary class="hint" style="cursor:pointer">Step-by-step instructions (${x.steps.length} steps)</summary><ol class="setupsteps">${x.steps.map((s) => `<li>${s}</li>`).join('')}</ol></details>
    <div class="acts"><button class="btn small greenbtn" data-act="job-dismiss" data-key="${h(j.key)}">✓ Done</button></div></div></div>`;
}
document.addEventListener('toggle', (e) => { const d = e.target; if (d && d.dataset && d.dataset.setup) S.setupOpen = d.open ? d.dataset.setup : null; }, true);
document.addEventListener('click', async (e) => {
  const el = e.target.closest && e.target.closest('[data-act=setup-copy],[data-act=setup-copytext]'); if (!el) return; e.preventDefault();
  try {
    let txt = el.dataset.v || '';
    if (el.dataset.act === 'setup-copy') { const r = await fetch(SETUP_FILES[el.dataset.f] + '?v=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('not found'); txt = await r.text(); }
    await navigator.clipboard.writeText(txt); const was = el.textContent; el.textContent = '✓ Copied — now paste it'; setTimeout(() => (el.textContent = was), 4000);
  } catch (x) { toast(el.dataset.act === 'setup-copy' ? "Couldn't fetch it — check the internet connection and try again" : "Couldn't copy — select it and copy it by hand"); }
});
function setupCard() { // Settings → Admin jobs (admin logins only): the same list as Jobs → Setup to do, plus what's been done
  if (!(window.SBAuth && SBAuth.isAdmin && (SBAuth.isAdmin() || (typeof S !== 'undefined' && S.admin)))) return '';
  const todo = setupJobs(); const dis = (D && D.dismissed) || {}; const done = SETUP.filter((x) => !todo.some((j) => j.id === x.id));
  return `<div class="card"><h3>Admin jobs</h3><div class="hint" style="margin-bottom:6px">One-off setup jobs, each with step-by-step instructions and 📋 buttons that copy the code to paste. Only admin logins see these.</div>
    ${todo.map(setupJobHtml).join('') || '<div class="hint">✓ All done.</div>'}
    ${done.length ? `<details style="margin-top:8px"><summary class="hint" style="cursor:pointer">Done (${done.length})</summary>${done.map((x) => `<div class="kv" style="align-items:center"><div class="v">✓ ${h(x.t)}</div>${dis['setup:' + x.id] ? `<button class="btn small" data-act="setup-undo" data-id="${x.id}">Not done</button>` : '<span class="hint">done automatically</span>'}</div>`).join('')}</details>` : ''}</div>`;
}
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=setup-undo]'); if (!el) return; D.dismissed = D.dismissed || {}; D.dismissed['setup:' + el.dataset.id] = 0; D._dismissDirty = true; if (typeof JOBS_CACHE !== 'undefined') JOBS_CACHE = null; save(); Sync.soon(); renderAll(); });
window.setupCard = setupCard; window.setupJobs = setupJobs; window.setupJobHtml = setupJobHtml;
