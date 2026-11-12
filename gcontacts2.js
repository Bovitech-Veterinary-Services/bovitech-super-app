/* Bovitech Super App — v2.40: Google Contacts (caller ID on the phones) that keeps itself up to date.
   • Why it fell behind: the device that updates Google Contacts needed a Google sign-in, and Google's sign-in only lasts an hour.
     Now that device gets its Google access from the server (the same lasting connection Google Calendar uses), so it never runs out.
     (Connect Google Calendar again once — Settings → Scheduling — and tick every box, so the connection includes Contacts.)
   • Contacts deleted or merged in the app are removed from Google Contacts too (Settings → Google Contacts options).
   • Farm addresses and postal addresses can be left out of Google Contacts.
   • 🧹 Start Google Contacts again: downloads a backup (a vCard file Google can import back), deletes the contacts in Google
     (everything, or only the ones that came from the app), then sends every contact from the app again.
   • One contact with a problem no longer stops the rest; the status shows how many couldn't be sent and why. */
(function () {
  if (typeof GContacts === 'undefined') return;
  const G = GContacts; const PEOPLE = 'https://people.googleapis.com/v1/';
  G.st.gids = G.st.gids || {}; G.srvTok = null;
  G.OLDFN = 'the gcal server function needs updating first — Admin jobs → "Update the gcal server function (keeps Google Contacts up to date…)", then Settings → Scheduling → Connect Google Calendar again and tick every box';
  const gset = () => D.settings.gpush || {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /* Google access: from the server first (never runs out), otherwise this device's own Google sign-in */
  G.token = async function (interactive) {
    if (this.srvTok && Date.now() < this.srvTok.exp - 60000) return this.srvTok.t;
    if (typeof sbFetch === 'function' && window.SBAuth && SBAuth.staff && navigator.onLine && !(this.failAt && Date.now() - this.failAt < 10 * 60000 && !interactive)) {
      try { const r = await sbFetch('/functions/v1/gcal', { method: 'POST', body: JSON.stringify({ task: 'ctoken', k: Dev.k() }) }); const js = await r.json().catch(() => ({}));
        if (r.ok && js.t) { this.failAt = 0; this.srvTok = { t: js.t, exp: Date.now() + (js.exp || 3600) * 1000 }; this.st.srvErr = ''; this.persist(); return js.t; }
        this.failAt = Date.now(); this.st.srvErr = js.error || (r.status === 405 || r.status === 404 ? G.OLDFN : `The server said ${r.status}`); this.persist(); } catch (e) { this.failAt = Date.now(); this.st.srvErr = /reach|fetch|network/i.test(e.message) ? G.OLDFN : e.message; }
    }
    if (GAuth.valid() || interactive) return GAuth.get(interactive);
    throw Object.assign(new Error('signin'), { signin: true });
  };
  G.api = async function (url, opt) {
    const t = (this.srvTok && Date.now() < this.srvTok.exp - 60000) ? this.srvTok.t : GAuth.valid() ? GAuth.tok.t : await this.token(false); const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t } });
    if (r.status === 401) { this.srvTok = null; throw Object.assign(new Error('signin'), { signin: true }); }
    if (r.status === 429) throw Object.assign(new Error('rate'), { rate: true });
    return r;
  };
  /* what's sent: farm and postal addresses can be left out */
  G.person = (function (orig) { return function (c) { const p = orig.call(this, c); const g = gset(); p.addresses = (p.addresses || []).filter((a) => (a.type === 'Postal' ? g.postal !== false : g.farmAddr !== false)); return p; }; })(G.person);
  G.maybeRun = function () { if (this.st.on && !this.running && navigator.onLine) this.run(); };
  G.push = async function (c) {
    const body = this.person(c); let gid = c.gid && c.gid.startsWith('people/') ? c.gid : null;
    for (let tries = 0; gid && tries < 2; tries++) {
      const g = await this.api(`${PEOPLE}${gid}?personFields=metadata`); if (g.status === 404) { gid = null; break; } if (!g.ok) throw new Error(`Google said ${g.status} reading the contact`);
      const etag = (await g.json()).etag; const r = await this.api(`${PEOPLE}${gid}:updateContact?updatePersonFields=names,phoneNumbers,emailAddresses,organizations,addresses`, { method: 'PATCH', body: JSON.stringify({ ...body, etag }) });
      if (r.ok) break; if (r.status === 404) { gid = null; break; } const t = await r.text(); if (tries === 0 && /etag|failedPrecondition|FAILED_PRECONDITION/i.test(t)) continue; // changed in Google meanwhile — read it again
      throw new Error(`Google said ${r.status} updating: ${t.slice(0, 120)}`); }
    if (!gid) { const r = await this.api(`${PEOPLE}people:createContact?personFields=metadata`, { method: 'POST', body: JSON.stringify(body) }); if (!r.ok) throw new Error(`Google said ${r.status} adding: ${(await r.text()).slice(0, 120)}`);
      gid = (await r.json()).resourceName; c.gid = gid; if (!c._biz) { touch(c); save(); } }
    const src = await renderPhoto(this.spec(c), 480); const r = await this.api(`${PEOPLE}${gid}:updateContactPhoto`, { method: 'PATCH', body: JSON.stringify({ photoBytes: src.split(',')[1] }) });
    if (!r.ok) throw new Error(`Google said ${r.status} with the caller photo`);
  };
  /* everyone who should be in Google Contacts */
  G.wanted = function () { const skip = new Set(gset().skip || []);
    return [...D.contacts.filter((c) => !c.gone && !noDet(c)), ...D.businesses.filter((b) => !b.gone && bizHasDetails(b) && (!isClientBiz(b) || !(IDX.bizContacts.get(b.id) || []).length)).map(bizPseudo)].filter((c) => { try { return !skip.has(catOf(c)); } catch (e) { return true; } }); };
  G.run = async function () {
    if (this.running) return; this.running = true; let wake = null; const msg = (m) => { this.st.msg = m; this.persist(); };
    let n = 0, fails = 0, removed = 0, todo = [], why = '';
    try {
      try { await this.token(false); } catch (e) { msg(`Paused — ${this.st.srvErr || 'Google needs connecting'} (${new Date().toLocaleTimeString('en-AU')})`); return; }
      const want = this.wanted(); const live = new Set(want.map((c) => c.id));
      todo = want.filter((c) => { try { return this.st.done[c.id] !== this.hash(c); } catch (e) { fails++; why = why || `${fullName(c) || c.id}: ${e.message}`; return false; } });
      try { if (navigator.wakeLock && todo.length > 20) wake = await navigator.wakeLock.request('screen'); } catch (e) { }
      for (const c of todo) {
        if (!this.st.on || !navigator.onLine) break;
        try { await this.push(c); this.st.done[c.id] = this.hash(c); if (c.gid) this.st.gids[c.id] = c.gid; if (c._biz && c.gid && c._biz.gid !== c.gid) { c._biz.gid = c.gid; touch(c._biz); save(); } n++; }
        catch (e) { if (e.signin) { why = this.st.srvErr || 'Google needs connecting'; break; } if (e.rate) { await sleep(30000); continue; } fails++; why = why || `${fullName(c) || 'a contact'}: ${e.message}`; console.warn('Google Contacts', fullName(c), e); }
        if (n % 10 === 0) msg(`Updating… ${n} of ${todo.length}`);
        await sleep(900); // stay under Google's per-minute limit
      }
      /* deleted or merged in the app → out of Google Contacts too */
      if (gset().removeGone !== false && this.st.on && navigator.onLine) { const inUse = new Set(want.map((c) => c.gid).filter(Boolean));
        for (const [id, gid] of Object.entries(this.st.gids)) { if (live.has(id)) continue; if (!inUse.has(gid)) { try { const r = await this.api(`${PEOPLE}${gid}:deleteContact`, { method: 'DELETE' }); if (r.ok || r.status === 404) removed++; else continue; } catch (e) { if (e.signin) break; continue; } await sleep(900); }
          delete this.st.gids[id]; delete this.st.done[id]; } }
      const left = todo.length - n - fails;
      msg(`${left > 0 ? `Paused — ${left} still to update${why && !fails ? ' (' + why + ')' : ''}. ` : 'Up to date. '}${removed ? removed + ' removed. ' : ''}${fails ? `${fails} couldn't be sent — first problem: ${why}. ` : ''}(${new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })})`);
    } finally { this.running = false; this.persist(); try { if (wake) wake.release(); } catch (e) { } if (S.tab === 'settings') renderAll(); }
  };
  /* everything in Google Contacts (for the backup and for starting again) */
  G.listAll = async function () { const out = []; let pt = '';
    do { const r = await this.api(`${PEOPLE}people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,addresses,biographies,metadata&pageSize=1000${pt ? '&pageToken=' + encodeURIComponent(pt) : ''}`); if (!r.ok) throw new Error(`Google said ${r.status} listing contacts`); const js = await r.json(); out.push(...(js.connections || [])); pt = js.nextPageToken || ''; } while (pt);
    return out; };
  const vEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  G.vcard = (L) => L.map((p) => { const n = (p.names || [])[0] || {}; const o = (p.organizations || [])[0] || {}; const fn = n.displayName || [n.givenName, n.familyName].filter(Boolean).join(' ') || o.name || ((p.emailAddresses || [])[0] || {}).value || ((p.phoneNumbers || [])[0] || {}).value || 'No name';
    return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vEsc(fn)}`, `N:${vEsc(n.familyName)};${vEsc(n.givenName)};${vEsc(n.middleName)};;`, ...(o.name ? [`ORG:${vEsc(o.name)}`] : []), ...(o.title ? [`TITLE:${vEsc(o.title)}`] : []),
      ...(p.phoneNumbers || []).map((x) => `TEL;TYPE=${/mobile/i.test(x.type || '') ? 'CELL' : /home/i.test(x.type || '') ? 'HOME' : 'WORK'}:${x.value}`), ...(p.emailAddresses || []).map((x) => `EMAIL;TYPE=INTERNET:${x.value}`),
      ...(p.addresses || []).map((x) => `ADR;TYPE=${vEsc(x.type || 'other')}:;;${vEsc(x.streetAddress || x.formattedValue)};${vEsc(x.city)};${vEsc(x.region)};${vEsc(x.postalCode)};${vEsc(x.country)}`), ...((p.biographies || [])[0] ? [`NOTE:${vEsc(p.biographies[0].value)}`] : []), 'END:VCARD'].join('\r\n'); }).join('\r\n');
  const dl = (name, text, type) => { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); };
  G.backup = async function () { const L = await this.listAll(); dl(`google-contacts-backup-${bkToday()}.vcf`, this.vcard(L), 'text/vcard'); return L; };
  G.startAgain = async function () {
    if (this.running) { toast('Google Contacts is updating right now — try again when it says Up to date or Paused'); return; }
    let L; toast('Reading Google Contacts…', 'info'); try { this.failAt = 0; await this.token(true); L = await this.listAll(); } catch (e) { toast(e.signin ? `Google isn't connected for Google Contacts: ${this.st.srvErr || 'connect Google Calendar again in Settings → Scheduling'}` : e.message, 'warn'); return; }
    const appG = new Set([...D.contacts.map((c) => c.gid), ...D.businesses.map((b) => b.gid)].filter(Boolean)); const fromApp = L.filter((p) => appG.has(p.resourceName)).length; const mode0 = gset().wipe === 'app' ? 'app' : 'all';
    G._mode = mode0; const r = await askBox('🧹 Start Google Contacts again', `<p>Google Contacts (${h(practiceAccount())}) has <b>${L.length}</b> contacts — <b>${fromApp}</b> of them came from the app.</p>
      <p>First a backup file of all ${L.length} is downloaded (<b>google-contacts-backup-${bkToday()}.vcf</b> — Google Contacts → Import can put them back). Then:</p>
      <label class="bk-radio" style="display:flex;margin:4px 0"><input type="radio" name="gw" data-ask="mode" value="all" ${mode0 === 'all' ? 'checked' : ''}> <span>Delete <b>all ${L.length}</b> from Google Contacts</span></label>
      <label class="bk-radio" style="display:flex;margin:4px 0"><input type="radio" name="gw" data-ask="mode" value="app" ${mode0 === 'app' ? 'checked' : ''}> <span>Delete only the <b>${fromApp}</b> that came from the app — keep contacts that are only in Google (staff, personal…)</span></label>
      <p>and send every contact from the app again (about ${Math.max(1, Math.round(this.wanted().length * 1.4 / 60))} minutes — keep the app open on this device with the screen on). Caller ID on the phones is missing for those until they're sent again.</p>
      <p class="hint">Deleted contacts sit in Google Contacts → Trash for 30 days.</p>`, 'Download backup and start again', true);
    const mode = G._mode || mode0; G._mode = null; if (!r) return;
    const del = (mode === 'app' ? L.filter((p) => appG.has(p.resourceName)) : L).map((p) => p.resourceName);
    dl(`google-contacts-backup-${bkToday()}.vcf`, this.vcard(L), 'text/vcard');
    D.settings.gpush = { ...gset(), wipe: mode }; touch(D.settings); save();
    this.running = true; let gone = 0;
    try { for (let i = 0; i < del.length; i += 200) { const x = await this.api(`${PEOPLE}people:batchDeleteContacts`, { method: 'POST', body: JSON.stringify({ resourceNames: del.slice(i, i + 200) }) }); if (!x.ok) throw new Error(`Google said ${x.status} deleting: ${(await x.text()).slice(0, 120)}`); gone += Math.min(200, del.length - i); this.st.msg = `Deleting… ${gone} of ${del.length}`; this.persist(); await sleep(1500); } }
    catch (e) { this.running = false; this.st.msg = `Stopped after deleting ${gone} of ${del.length}: ${e.message}`; this.persist(); toast(this.st.msg, 'warn'); renderAll(); return; }
    this.running = false; this.st.done = {}; this.st.gids = {}; this.st.on = true; this.st.msg = `Deleted ${gone}. Sending every contact again…`; this.persist();     toast(`Backup downloaded and ${gone} deleted — sending every contact again now (keep the app open)`, 'info'); renderAll(); this.run(); };
  /* Settings → Sync & sign-in → Caller photos: status, problem and the buttons */
  if (typeof callerPhotosHtml === 'function') callerPhotosHtml = function () { const gp = G.st; const ok = !!(G.srvTok && Date.now() < G.srvTok.exp) || GAuth.valid();
    return `<div class="lbl" style="margin-top:14px">Caller photos (Google Contacts)</div>
    <label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0"><input type="checkbox" data-act="gpush-toggle" ${gp.on ? 'checked' : ''} ${S.admin ? '' : 'disabled title="Only the admin can change this"'}> <span>This device keeps Google Contacts up to date <span class="setlock fixed" style="font-size:11px;padding:1px 7px">🔒 Admin only</span><br><span class="hint">It updates whenever the app is open on this device. Google access comes from the practice's Google connection (Settings → Scheduling), so there's no Google sign-in to keep doing.</span></span></label>
    ${gp.on ? `<div class="kv"><div class="k">Status</div><div class="v">${h(gp.msg || 'Waiting')}${G.running ? ' <span class="hint">(working…)</span>' : ''}</div></div>${gp.srvErr && !ok ? `<div class="kv"><div class="k">Google connection</div><div class="v" style="color:var(--red)">${h(gp.srvErr)}</div></div>` : ''}<div class="actions"><button class="btn small" data-act="gpush-now">Update Google Contacts now</button></div>` : ''}
    ${S.admin ? `<div class="actions"><button class="btn small" data-act="gc2-backup">⬇️ Download a backup of Google Contacts</button><button class="btn small danger" data-act="gc2-again">🧹 Start Google Contacts again</button></div><div class="hint">Options (what's sent, removing deleted contacts): Settings → Contacts → Google Contacts (caller ID) options.</div>` : ''}`; };
  document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act="gpush-now"], [data-act="gpush-toggle"]'); if (!el) return; if (el.dataset.act === 'gpush-toggle' && !el.checked) return; e.stopPropagation(); if (el.dataset.act === 'gpush-now') e.preventDefault();
    if (!S.admin) { if (el.type === 'checkbox') el.checked = false; needAdmin(); return; }
    if (el.dataset.act === 'gpush-toggle') { G.st.on = true; G.persist(); }
    G.failAt = 0; try { await G.token(true); toast('Updating Google Contacts in the background — keep the app open on this device', 'info'); G.run(); } catch (x) { toast(x.signin ? `Google isn't connected for Google Contacts: ${G.st.srvErr || ''}` : x.message, 'warn'); } renderAll(); }, true);
  document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act^="gc2-"]'); if (!el) return; e.preventDefault(); e.stopPropagation();
    if (!S.admin) { needAdmin(); return; }
    if (el.dataset.act === 'gc2-backup') { toast('Reading Google Contacts…', 'info'); try { G.failAt = 0; await G.token(true); const L = await G.backup(); toast(`Backup of ${L.length} Google contacts downloaded`, 'info'); } catch (x) { toast(x.signin ? `Google isn't connected for Google Contacts: ${G.st.srvErr || 'connect Google Calendar again in Settings → Scheduling'}` : x.message, 'warn'); } }
    if (el.dataset.act === 'gc2-again') G.startAgain(); }, true);
  document.addEventListener('change', (e) => { if (e.target && e.target.name === 'gw') G._mode = e.target.value; }, true);
  setTimeout(() => G.maybeRun(), 8000);
})();
