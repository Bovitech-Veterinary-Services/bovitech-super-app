/* Bovitech Super App — v2.26: client texts and emails are OFF until go-live.
   Settings → Texts and emails before go-live: 🔴 Off (default) — nothing goes to clients; 🧪 Test — everything goes to the test mobile
   (0413 107 113) and the test email (office@bovitech.com.au) instead, marked TEST and saying who it would have gone to; 🟢 Live.
   • Emails and 📲 office texts sent from the app are stopped or redirected here, on every device.
   • Automatic booking texts (booking made, 5-day reminder, new time) are sent by the server: while not live, their templates are paused
     (so the server has nothing to send), and the updated "jobs" function also redirects or stops them (Admin jobs).
   • 💬 texts from your own phone (or Phone Link) aren't touched — you send those yourself. Day sheets to staff keep going. */
const GL_DEF = { mode: 'off', phone: '0413107113', email: 'office@bovitech.com.au' };
function glCfg() { const r = typeof Bk !== 'undefined' && Bk.get ? Bk.get('comms') : null; return { ...GL_DEF, ...(r || {}) }; }
const glMode = () => (typeof navigator !== 'undefined' && navigator.webdriver && !window.GL_TEST ? 'live' : glCfg().mode || 'off'); // (automated tests behave as live unless they're testing this)
const GL_AUTO = ['booked', 'reminder', 'proposal'];
function glPauseTemplates() { /* not live → the server's automatic booking texts have no template to use; live → back as they were (safe to run again) */ if (typeof Bk === 'undefined' || !Bk.on || !Bk.on()) return 0; const live = glMode() === 'live' || (glMode() === 'test' && glCfg().serverOk); let n = 0;
  Bk.list('bkcfg').filter((c) => c.cfg === 'sms').forEach((c) => { if (!live && GL_AUTO.includes(c.use)) { c.pausedUse = c.use; c.use = 'paused-' + c.use; touch(c); n++; } else if (live && c.pausedUse && c.use === 'paused-' + c.pausedUse) { c.use = c.pausedUse; delete c.pausedUse; touch(c); n++; } });
  return n; }
const glInternal = (a) => /@bovitech\.com\.au\s*>?\s*$/i.test(String(a || '').trim());
sbFetch = (function (orig) { return async function (path, opt = {}, retried) {
  const mode = glMode(); if (mode === 'live') return orig.apply(this, arguments); const c = glCfg();
  if (path === '/functions/v1/mail' && opt && opt.body) { const b = JSON.parse(opt.body); const all = [...[].concat(b.to || []), ...[].concat(b.cc || [])];
    if (all.every(glInternal)) return orig.apply(this, arguments); // only to the practice — fine
    if (mode === 'off') { toast('✉️ Not sent — emails to clients are switched off until go-live (Settings → Texts and emails before go-live)'); return new Response(JSON.stringify({ error: 'Emails to clients are switched off until go-live', off: true }), { status: 423, headers: { 'Content-Type': 'application/json' } }); }
    const was = all.filter((x) => !glInternal(x)).join(', '); b.to = [c.email]; b.cc = []; b.subject = `[TEST — would go to ${was}] ` + (b.subject || ''); b.html = b.html ? `<p style="background:#fff3c4;padding:6px 8px;border:1px solid #e0a800"><b>TEST</b> — this would have gone to ${h(was)}</p>` + b.html : b.html; b.text = b.text ? `TEST — would have gone to ${was}\n\n` + b.text : b.text;
    return orig.call(this, path, { ...opt, body: JSON.stringify(b) }, retried); }
  if (path === '/rest/v1/rpc/sms_queue' && opt && opt.body) { const b = JSON.parse(opt.body);
    if (mode === 'off') { toast('📲 Not sent — texts to clients are switched off until go-live (Settings → Texts and emails before go-live)'); throw new Error('Texts to clients are switched off until go-live'); }
    const was = b.phone; b.phone = String(c.phone).replace(/\D/g, ''); b.body = `[TEST — would go to ${was}] ` + (b.body || ''); return orig.call(this, path, { ...opt, body: JSON.stringify(b) }, retried); }
  return orig.apply(this, arguments); }; })(sbFetch);
function glCard() { const c = glCfg(); const m = c.mode; const adm = !!(window.SBAuth && SBAuth.isAdmin && SBAuth.isAdmin()) || (typeof Bk !== 'undefined' && Bk.can && Bk.can('settings'));
  return `<div class="card gl-card gl-${m}"><h3>📵 Texts and emails before go-live</h3><div class="hint" style="margin-bottom:6px">Until the practice goes live, nothing goes to clients by text or email. Switch to Test to try them: they go to the test mobile and email instead, marked TEST with who they'd have gone to.</div>
    <div class="checks" style="flex-direction:column;align-items:flex-start">${[['off', '🔴 Off — nothing goes to clients (now)'], ['test', '🧪 Test — everything goes to the test mobile and email'], ['live', '🟢 Live — texts and emails go to clients']].map(([v, l]) => `<label style="font-size:16px"><input type="radio" name="gl-mode" value="${v}" data-act="gl-mode" ${m === v ? 'checked' : ''} ${adm ? '' : 'disabled'}> ${l}</label>`).join('')}</div>
    <div class="grid2" style="margin-top:6px"><div class="f"><label for="gl-phone">Test mobile</label><input id="gl-phone" data-act="gl-set" data-k="phone" value="${h(c.phone)}" ${adm ? '' : 'disabled'}></div><div class="f"><label for="gl-email">Test email</label><input id="gl-email" data-act="gl-set" data-k="email" value="${h(c.email)}" ${adm ? '' : 'disabled'}></div></div>
    <label class="bk-radio"><input type="checkbox" data-act="gl-server" ${c.serverOk ? 'checked' : ''} ${adm ? '' : 'disabled'}> The updated "jobs" function is deployed in Supabase (Admin jobs) — automatic booking texts can be tested too</label>
    <div class="hint">Automatic booking texts (booking made, reminder, new time) are ${m === 'live' || (m === 'test' && c.serverOk) ? 'on' : '<b>paused</b>'}. 💬 texts from your own phone aren't affected. Day sheets to staff keep going.</div></div>`; }
async function glSet(patch) { let r = Bk.get('comms'); if (!r) { r = { id: 'comms', cfg: 'comms', ...GL_DEF }; D.bkcfg.push(r); } Object.assign(r, patch); touch(r); glPauseTemplates(); NEXT_LOG_LABEL = 'Texts and emails before go-live: ' + (r.mode === 'off' ? 'off' : r.mode === 'test' ? 'test' : 'LIVE'); S.skipConfirm = true; await changed(); }
document.addEventListener('change', async (e) => { const el = e.target; if (!el.dataset) return; const a = el.dataset.act;
  if (a === 'gl-mode') { if (el.value === 'live' && !(await ask('Go live with texts and emails? From now on they go to clients.', '🟢 Yes — go live'))) { renderAll(); return; } await glSet({ mode: el.value }); toast(el.value === 'off' ? '🔴 Client texts and emails are off' : el.value === 'test' ? '🧪 Test — texts go to ' + glCfg().phone + ', emails to ' + glCfg().email : '🟢 Live'); }
  if (a === 'gl-set') await glSet({ [el.dataset.k]: el.value.trim() });
  if (a === 'gl-server') await glSet({ serverOk: el.checked }); });
/* keep the automatic templates paused on every device, whatever the last one did */
(function () { const go = () => { try { if (typeof Bk !== 'undefined' && Bk.on && Bk.on() && D && D.sync && D.sync.last && glPauseTemplates()) { save(); if (window.Sync) Sync.soon(); } } catch (e) { console.warn(e); } }; setInterval(go, 60000); setTimeout(go, 8000); })();
/* show the card at the top of Settings → Texts (and Settings → Scheduling) */
if (typeof bkSettingsHtml === 'function') bkSettingsHtml = (function (orig) { return function () { return glCard() + orig.apply(this, arguments); }; })(bkSettingsHtml);
(function () { const st = document.createElement('style'); st.textContent = '.gl-card.gl-off{border:2px solid #c62828}.gl-card.gl-test{border:2px solid #e0a800;background:#fffbe6}.gl-card.gl-live{border:2px solid #2f7a55}html[data-theme=dark] .gl-card.gl-test{background:#2b2410}'; document.head.appendChild(st); })();
window.glCard = glCard; window.glMode = glMode;
/* ---------- Admin jobs (Jobs → Setup to do) ---------- */
if (typeof SETUP !== 'undefined') {
  const S1 = (id) => SETUP.some((x) => x.id === id);
  if (!S1('jobs6')) SETUP.push({ id: 'jobs6', t: 'Update the "jobs" server function (client texts stay off until go-live)', steps: [
    `Open <a href="${SETUP_SUPA}/functions/jobs/code" target="_blank" rel="noopener">Supabase → Edge Functions → jobs → Code</a>.`,
    `Come back here and tap ${setupCopy('jobs', 'Copy the jobs code')}.`,
    'In Supabase, click in the code box, press <b>Ctrl + A</b> then <b>Ctrl + V</b> to replace all of it.',
    'Click <b>Deploy updates</b> (bottom right) and wait for it to finish. Leave "Verify JWT" as it was.',
    'Then in the app: Settings → Scheduling → 📵 Texts and emails before go-live, tick <b>The updated "jobs" function is deployed</b> (only needed if you want to test the automatic booking texts).',
    'Tick <b>✓ Done</b>.'] });
  if (!S1('mail2')) SETUP.push({ id: 'mail2', t: 'Update the "mail" server function (attachments and the unsubscribe header)', steps: [
    `Open <a href="${SETUP_SUPA}/functions/mail/code" target="_blank" rel="noopener">Supabase → Edge Functions → mail → Code</a>.`,
    `Come back here and tap ${setupCopy('mail', 'Copy the mail code')} (it's the index.ts file).`,
    'In Supabase, click in the code box, press <b>Ctrl + A</b> then <b>Ctrl + V</b> to replace everything.',
    'Click <b>Deploy</b> (bottom right) and wait for it to finish. Until this is done, emails go out without their attachments and without the unsubscribe header.',
    'Tick <b>✓ Done</b>.'] });
  if (!S1('resend2')) SETUP.push({ id: 'resend2', t: 'Finish the Resend setup (Verified, and the MAIL_FROM secret)', steps: [
    'Sign in to <a href="https://resend.com/domains" target="_blank" rel="noopener">resend.com → Domains</a> and open <b>bovitech.com.au</b>.',
    'It needs to say <b>Verified</b>. If it doesn\'t, check each DNS record it lists is in <b>HostPapa → cPanel → Zone Editor → bovitech.com.au → Manage</b> exactly as shown, then tap <b>Verify DNS records</b> in Resend (it can take a few hours).',
    `Once it says Verified: Supabase → <a href="${SETUP_SUPA}/functions/secrets" target="_blank" rel="noopener">Edge Functions → Secrets</a> → <b>+ Add secret</b>: name <b>MAIL_FROM</b>, value <b>Bovitech Veterinary Services &lt;office@bovitech.com.au&gt;</b> → Save.`,
    'Try it with Settings → Scheduling → 📵 set to 🧪 Test: send an email from the app — it should arrive at office@bovitech.com.au marked TEST.',
    'Tick <b>✓ Done</b>.'] });
  if (!S1('m365')) SETUP.push({ id: 'm365', t: 'Move to Microsoft 365 Business (email on Outlook, OneDrive for the practice, Claude connects to both)', steps: [
    '<b>Decide the plan.</b> Microsoft 365 <b>Business Basic</b> (cheapest: Outlook email on bovitech.com.au, OneDrive 1 TB each, Teams, web and mobile Office apps) or <b>Business Standard</b> (adds the desktop Word, Excel and Outlook apps). One licence per person who needs their own mailbox (Jess, Milly, Ally, Rory) plus <b>office@</b> — office@ can instead be a free <b>shared mailbox</b> that everyone opens, which saves a licence.',
    '<b>Before you start, write down what\'s there now:</b> in HostPapa cPanel → <b>Email Accounts</b>, list every address (office@, jess.shilling@, milly.watts@, allison.watson@ …) and any forwarders (cPanel → Forwarders). Note each mailbox size.',
    '<b>Back up the current email:</b> on the office computer, make sure every mailbox is in Outlook (or Thunderbird) with everything downloaded, or use cPanel → <b>Backup</b> → <b>Download Email Forwarders</b> and each account\'s email backup. Nothing should be deleted until the move is finished and checked.',
    '<b>Sign up:</b> go to <a href="https://www.microsoft.com/en-au/microsoft-365/business/compare-all-microsoft-365-business-products" target="_blank" rel="noopener">microsoft.com → Microsoft 365 for business</a>, choose the plan → <b>Buy now</b>. Use your <b>office@bovitech.com.au</b> details for the admin account; it gives you a temporary address like <b>bovitech.onmicrosoft.com</b>. Your current Microsoft 365 Personal can stay until the end, then be cancelled (Business replaces it).',
    '<b>Add your domain:</b> in the <a href="https://admin.microsoft.com" target="_blank" rel="noopener">Microsoft 365 admin centre</a> → <b>Settings → Domains → Add domain</b> → bovitech.com.au. It asks you to prove you own it with a <b>TXT record</b>: in HostPapa cPanel → <b>Zone Editor → bovitech.com.au → Manage → + Add Record</b>, type TXT, name and value exactly as Microsoft shows → Save. Back in Microsoft tap <b>Verify</b> (can take up to an hour).',
    '<b>Don\'t switch the email over yet.</b> When Microsoft asks how to connect the domain, choose to <b>add the DNS records yourself</b> and stop before changing the <b>MX</b> record — email keeps arriving at HostPapa until you\'re ready.',
    '<b>Make the users:</b> admin centre → <b>Users → Active users → Add a user</b> for each person, with the <b>same address</b> they have now (jess.shilling@bovitech.com.au …), and assign each a licence. For office@ either give it a licence or make it a <b>shared mailbox</b> (Teams &amp; groups → Shared mailboxes → Add) and add everyone as members.',
    '<b>Move the old email across:</b> admin centre → <b>Setup → Migrate your email</b> (Exchange admin centre → Migration → <b>IMAP migration</b>). For HostPapa use IMAP server <b>mail.bovitech.com.au</b>, port 993, SSL, and a CSV with each address and its current cPanel password. Start it and wait until each mailbox says <b>Synced</b> (it keeps syncing new mail until you finish).',
    '<b>Switch the email over (do this on a quiet afternoon):</b> in HostPapa Zone Editor change the <b>MX</b> record to the one Microsoft shows (like bovitech-com-au.mail.protection.outlook.com, priority 0) and delete the old HostPapa MX record. Add Microsoft\'s <b>autodiscover</b> CNAME. Update the <b>SPF</b> TXT record to include both Microsoft and Resend: <b>v=spf1 include:spf.protection.outlook.com include:amazonses.com ~all</b> (keep only one SPF record). Keep the <b>Resend</b> records (send and resend._domainkey) exactly as they are, so the app\'s emails keep working.',
    '<b>Finish the migration:</b> once new email is arriving in Outlook (send yourself a test from a Gmail address), go back to Migration → <b>Complete migration</b>. Add DKIM for Microsoft too: Microsoft Defender → Email &amp; collaboration → Policies → <b>DKIM</b> → bovitech.com.au → add the two CNAME records it shows to HostPapa → Enable.',
    '<b>Set up everyone\'s devices:</b> on each phone and computer, remove the old HostPapa email account and add the new one in Outlook (just type the address — it finds Microsoft 365). Install <b>OneDrive</b> and sign in with the work address. Move the practice files from the Personal OneDrive into the business OneDrive (or a SharePoint site called Bovitech) and share folders with the team.',
    '<b>Connect Claude:</b> in Claude → Settings → Connectors, connect <b>Microsoft 365</b> (Outlook and OneDrive) with the office@ admin account and approve it for the organisation. The app\'s Resend emails don\'t change.',
    '<b>Tidy up after a week or two:</b> when everything has been working, cancel the HostPapa <b>email</b> part (keep HostPapa for the website) and cancel Microsoft 365 Personal.',
    'Tick <b>✓ Done</b>.'] });
  if (!S1('golivexero')) SETUP.push({ id: 'golivexero', t: 'Go-live day: check every client\'s balance matches Xero', steps: [
    'On the day you go live, in Xero run <b>Accounting → Reports → Aged Receivables Summary</b> as at that date, and export it.',
    'In the app open Records → Overdue (and each client\'s statement) and compare each client\'s balance with Xero.',
    'Any difference: find the missing or extra invoice or payment and fix it before sending any statements.',
    'Tick <b>✓ Done</b> when every balance matches.'] });
}
