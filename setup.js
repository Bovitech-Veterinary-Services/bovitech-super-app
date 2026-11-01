/* Bovitech Super App — "Setup to do" in Jobs (admin logins only): each one-off setup task, with full
   step-by-step instructions and a button to copy the code that's needed. Tick ✓ Done when finished
   (it's remembered on every device). Some tick themselves once the app can see they're done. */
'use strict';
const SETUP_FILES = { sql05: 'supabase/05-calendar-sms.sql', sql06: 'supabase/06-admins.sql', gcal: 'supabase/functions/gcal/index.ts', jobs: 'supabase/functions/jobs/index.ts' };
const SETUP_REDIRECT = 'https://ymzweuhxdcxkzweacwdi.supabase.co/functions/v1/gcal';
const SETUP_SUPA = 'https://supabase.com/dashboard/project/ymzweuhxdcxkzweacwdi';
const setupCopy = (f, label) => `<button class="btn small greenbtn" data-act="setup-copy" data-f="${f}">📋 ${label}</button>`;
const SETUP = [
  { id: 'sql05', t: 'Run database update 5 (Google Calendar, day sheets, "Y" replies)', steps: [
    `On the office computer, open <a href="${SETUP_SUPA}/sql/new" target="_blank" rel="noopener">Supabase → SQL Editor → New query</a> and sign in if it asks.`,
    `Come back here and tap ${setupCopy('sql05', 'Copy update 5')} — it copies the whole update.`,
    'In Supabase, click in the big empty query box, press <b>Ctrl + A</b> then <b>Ctrl + V</b> to paste it in.',
    'Click <b>Run</b> (bottom right). If it asks about "destructive operations", click <b>Run this query</b>.',
    'At the bottom it should say <b>Step 5 finished</b>. If it shows a red error instead, copy the error and send it to Claude.',
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
  { id: 'redirect', t: 'Google: add the return address and copy the client secret', steps: [
    'Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud → Credentials</a>, signed in as <b>bovitechvetservices@gmail.com</b> (the account that made the app\'s Google project). At the top, check the right project is chosen.',
    'Under <b>OAuth 2.0 Client IDs</b>, click the <b>Web client</b> the app uses.',
    `Under <b>Authorized redirect URIs</b>, click <b>+ Add URI</b> and paste <b style="word-break:break-all">${SETUP_REDIRECT}</b> <button class="btn small greenbtn" data-act="setup-copytext" data-v="${SETUP_REDIRECT}">📋 Copy</button>`,
    'Click <b>Save</b> at the bottom.',
    'On the same page (right-hand side, under <b>Client secrets</b>), copy the <b>Client secret</b> — you need it in the next job. Don\'t paste it anywhere else, and never into Claude.',
    'Tick <b>✓ Done</b>.'] },
  { id: 'secret', t: 'Supabase: add GOOGLE_CLIENT_SECRET', after: 'redirect', steps: [
    `Open <a href="${SETUP_SUPA}/functions/secrets" target="_blank" rel="noopener">Supabase → Edge Functions → Secrets</a>.`,
    'Under <b>Add new secrets</b>: Name = <b>GOOGLE_CLIENT_SECRET</b> <button class="btn small greenbtn" data-act="setup-copytext" data-v="GOOGLE_CLIENT_SECRET">📋 Copy the name</button>',
    'Value = the Client secret you copied from Google in the last job.',
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
  { id: 'daysheet', t: 'Decide how day sheets are sent', steps: [
    'Day sheets are always in the app (Scheduling → Day sheet) and, once Google Calendar is connected, on each person\'s own Google Calendar.',
    'For texting them at 8am, choose one and tell Claude: <b>a second Android phone</b> (recommended — cheapest, texts come from that number), <b>an SMS service with a sender name</b>, or <b>email</b>.',
    'Then turn them on in Settings → Scheduling → Day sheets.',
    'Tick <b>✓ Done</b> once you\'ve told Claude.'] },
  { id: 'send', t: 'Things to send Claude', steps: [
    'The rest of your yearly reminder list.',
    'A sample Bull Reporter import file, or a screenshot of its columns.',
    'When biosecurity plan, J-BAS and NFAS reviews should come up — from the date of the last one (how it works now), or on a set date each year.',
    'The full ezyVet export (records, price list, inventory).',
    'The vControl CSV format (for the on-call export).',
    'Tick <b>✓ Done</b> when they\'re all sent.'] },
];
function setupJobs() { // admin logins only
  if (!(window.SBAuth && SBAuth.isAdmin && (SBAuth.isAdmin() || (typeof S !== 'undefined' && S.admin)))) return [];
  const dis = (D && D.dismissed) || {}; const done = (id) => !!dis['setup:' + id] || !!((SETUP.find((x) => x.id === id) || {}).auto && SETUP.find((x) => x.id === id).auto());
  return SETUP.filter((x) => !done(x.id)).map((x, i) => ({ type: 'setup', key: 'setup:' + x.id, kind: 'setup', id: x.id, who: x.t, note: x.after && !done(x.after) ? `Do "${(SETUP.find((y) => y.id === x.after) || {}).t}" first` : '', n: i }));
}
function setupJobHtml(j) {
  const x = SETUP.find((y) => y.id === j.id); if (!x) return '';
  return `<div class="job setupjob"><div class="t"><div class="who"><b>🛠 ${h(x.t)}</b></div>${j.note ? `<div class="note">⏳ ${h(j.note)}</div>` : ''}
    <details ${S.setupOpen === x.id ? 'open' : ''} data-setup="${x.id}"><summary class="hint" style="cursor:pointer">Step-by-step instructions (${x.steps.length} steps)</summary><ol class="setupsteps">${x.steps.map((s) => `<li>${s}</li>`).join('')}</ol></details>
    <div class="acts"><button class="btn small greenbtn" data-act="job-dismiss" data-key="${h(j.key)}">✓ Done</button><button class="btn small" data-act="job-ai" data-key="${h(j.key)}">🤖 Ask Claude</button></div></div></div>`;
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
window.setupJobs = setupJobs; window.setupJobHtml = setupJobHtml;
