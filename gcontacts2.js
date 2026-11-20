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
  /* nothing can hang the update any more: every step gives up after a while instead of waiting forever */
  const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} didn't answer within ${Math.round(ms / 1000)} seconds — it tries again next time`)), ms))]);
  G.api = async function (url, opt) {
    const t = (this.srvTok && Date.now() < this.srvTok.exp - 60000) ? this.srvTok.t : GAuth.valid() ? GAuth.tok.t : await withTimeout(this.token(false), 45000, 'Google access'); const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 45000); let r;
    try { r = await fetch(url, { ...opt, signal: ac.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t } }); } catch (e) { if (e.name === 'AbortError') throw new Error("Google didn't answer within 45 seconds — it tries again next time"); throw e; } finally { clearTimeout(tm); }
    if (r.status === 401) { this.srvTok = null; throw Object.assign(new Error('signin'), { signin: true }); }
    if (r.status === 429) throw Object.assign(new Error('rate'), { rate: true });
    return r;
  };
  /* what's sent: farm and postal addresses can be left out */
  G.person = (function (orig) { return function (c) { const p = orig.call(this, c); const g = gset(); p.addresses = (p.addresses || []).filter((a) => (a.type === 'Postal' ? g.postal !== false : g.farmAddr !== false)); return p; }; })(G.person);
  G.maybeRun = function () { if (this.st.on && !this.running && navigator.onLine) this.run(); };
  /* everyone who should be in Google Contacts */
  G.wanted = function () { const skip = new Set(gset().skip || []);
    return [...D.contacts.filter((c) => !c.gone && !noDet(c)), ...D.businesses.filter((b) => !b.gone && bizHasDetails(b) && (!isClientBiz(b) || !(IDX.bizContacts.get(b.id) || []).length)).map(bizPseudo)].filter((c) => { try { return !skip.has(catOf(c)); } catch (e) { return true; } }); };
  /* v2.51.2 — faster and more reliable:
     • names/numbers and the caller photo are tracked separately, so a contact whose photo hasn't changed doesn't have its photo sent again
     • changing a category's photo in Settings sends that photo again to everyone with it (before, Google kept the old one)
     • a caller photo is never sent while its picture hasn't loaded (that sent plain grey photos) — it tries again, then waits for next time
     • updates go to Google 100 at a time instead of one by one (three requests each); only photos still go one at a time */
  const fp = (s) => { s = String(s || ''); return s.length + ':' + s.slice(-24); };
  G.photoSig = function (c) { const sp = this.spec(c); return JSON.stringify([sp, sp.custom ? fp(sp.custom) : (sp.parts || []).map((p) => fp(tagPhotoSrc(p.tag))), D.settings.photoSig1 || '']); };
  G.dataHash = function (c) { const s = JSON.stringify(this.person(c)); let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x.toString(36); };
  G.st.dd = G.st.dd || {}; G.st.pd = G.st.pd || {}; /* dd: names/numbers sent · pd: caller photo sent */
  async function loadSure(src) { for (let t = 0; t < 4; t++) { if (t) { imgCache.delete(src); await sleep(800 * t); } const im = await Promise.race([loadImg(src), sleep(10000).then(() => null)]); if (im && im.width) return im; } imgCache.delete(src); return null; }
  G.photoBytes = async function (c) { const sp = this.spec(c); const srcs = sp.custom ? [sp.custom] : (sp.parts || []).map((p) => tagPhotoSrc(p.tag));
    for (let i = 0; i < srcs.length; i++) { if (!srcs[i]) continue; if (!(await loadSure(srcs[i]))) { const tg = sp.custom ? 'their own' : `"${tagName(sp.parts[i].tag)}"`; throw new Error(`the ${tg} photo couldn't be loaded on this device, so it wasn't sent (it tries again next time)`); } }
    photoCache.delete(JSON.stringify(sp) + 480); const src = await withTimeout(renderPhoto(sp, 480), 20000, 'Making the caller photo'); return src.split(',')[1]; };
  G.sendPhoto = async function (c) { const r = await this.api(`${PEOPLE}${c.gid}:updateContactPhoto`, { method: 'PATCH', body: JSON.stringify({ photoBytes: await this.photoBytes(c) }) });
    if (r.status === 404) { c.gid = null; throw new Error('it had been deleted from Google Contacts — it is added again next time'); } if (!r.ok) throw new Error(`Google said ${r.status} with the caller photo: ${(await r.text()).slice(0, 100)}`); };
  const FIELDS = 'names,phoneNumbers,emailAddresses,organizations,addresses';
  G.push = async function (c, photoOnly) { /* one contact on its own (also used when a batch had a problem) */
    const body = this.person(c); let gid = c.gid && c.gid.startsWith('people/') ? c.gid : null;
    for (let tries = 0; gid && !photoOnly && tries < 2; tries++) {
      const g = await this.api(`${PEOPLE}${gid}?personFields=metadata`); if (g.status === 404) { gid = null; break; } if (!g.ok) throw new Error(`Google said ${g.status} reading the contact`);
      const etag = (await g.json()).etag; const r = await this.api(`${PEOPLE}${gid}:updateContact?updatePersonFields=${FIELDS}`, { method: 'PATCH', body: JSON.stringify({ ...body, etag }) });
      if (r.ok) break; if (r.status === 404) { gid = null; break; } const t = await r.text(); if (tries === 0 && /etag|failedPrecondition|FAILED_PRECONDITION/i.test(t)) continue;
      throw new Error(`Google said ${r.status} updating: ${t.slice(0, 120)}`); }
    if (!gid) { const r = await this.api(`${PEOPLE}people:createContact?personFields=metadata`, { method: 'POST', body: JSON.stringify(body) }); if (!r.ok) throw new Error(`Google said ${r.status} adding: ${(await r.text()).slice(0, 120)}`);
      gid = (await r.json()).resourceName; c.gid = gid; if (!c._biz) { touch(c); save(); } }
    c.gid = gid; this.st.dd[c.id] = this.dataHash(c); await this.sendPhoto(c); this.st.pd[c.id] = this.photoSig(c); };
  const linkGid = (G0, c) => { if (!c.gid) return; G0.st.gids[c.id] = c.gid; if (c._biz) { if (c._biz.gid !== c.gid) { c._biz.gid = c.gid; touch(c._biz); } } else if (!c._gidSaved) { touch(c); } };
  G.run = async function () {
    if (this.running) return; this.running = true; let wake = null; const msg = (m) => { this.st.msg = m; this.persist(); if (S.tab === 'settings' && !SHEET) { const el = document.querySelector('[data-gc-status]'); if (el) el.textContent = m; const t = document.querySelector('[data-gc-time]'); if (t) t.textContent = `(working… last step ${new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', second: '2-digit' })})`; } };
    let fails = 0, removed = 0, why = '', sentD = 0, sentP = 0, waits = 0; const errs = this.st.errs = {}; const fail = (c, e) => { fails++; errs[c.id] = e.message; why = why || `${fullName(c) || (c._biz && c._biz.name) || 'a contact'}: ${e.message}`; console.warn('Google Contacts', fullName(c), e); };
    const stopWhy = () => this.st.srvErr || 'Google needs connecting'; const ok = () => this.st.on && navigator.onLine && !this.stopNow;
    const rated = async (label) => { if (++waits > 20) { why = "Google's limit kept being reached — it carries on next time"; return false; } msg(`Google's limit reached — waiting a minute, then carrying on (${label})`); await sleep(60000); return true; };
    try {
      try { await this.token(false); } catch (e) { msg(`Paused — ${stopWhy()} (${new Date().toLocaleTimeString('en-AU')})`); return; }
      const want = this.wanted(); const live = new Set(want.map((c) => c.id));
      /* first run after this update: anyone whose old record still matches only needs their photo checked */
      want.forEach((c) => { try { if (this.st.dd[c.id] == null && this.st.done[c.id] && this.st.done[c.id] === this.hash(c)) this.st.dd[c.id] = this.dataHash(c); } catch (e) { } });
      const needD = [], needP = [];
      want.forEach((c) => { try { const inG = c.gid && c.gid.startsWith('people/'); if (!inG || this.st.dd[c.id] !== this.dataHash(c)) needD.push(c); if (!inG || this.st.pd[c.id] !== this.photoSig(c)) needP.push(c); } catch (e) { fail(c, e); } });
      const total = new Set([...needD, ...needP].map((c) => c.id)).size;
      try { if (navigator.wakeLock && total > 20) wake = await navigator.wakeLock.request('screen'); } catch (e) { }
      /* 1. new ones: 100 at a time */
      const fresh = needD.filter((c) => !(c.gid && c.gid.startsWith('people/')));
      for (let i = 0; i < fresh.length && ok(); ) { const chunk = fresh.slice(i, i + 100);
        try { const r = await this.api(`${PEOPLE}people:batchCreateContacts`, { method: 'POST', body: JSON.stringify({ contacts: chunk.map((c) => ({ contactPerson: this.person(c) })), readMask: 'metadata' }) });
          if (!r.ok) { const t = await r.text(); if (r.status >= 400) { console.warn('batch add refused', r.status, t.slice(0, 200)); for (const c of chunk) { if (!ok()) break; try { await this.push(c); linkGid(this, c); sentD++; sentP++; } catch (e) { if (e.rate) { if (!(await rated('adding'))) break; } else if (e.signin) { why = stopWhy(); break; } else fail(c, e); } await sleep(1100); } i += 100; continue; } throw new Error(`Google said ${r.status} adding: ${t.slice(0, 120)}`); }
          const out = (await r.json()).createdPeople || []; chunk.forEach((c, k) => { const rn = out[k] && out[k].person && out[k].person.resourceName; if (!rn) { fail(c, new Error(((out[k] || {}).status || {}).message || 'Google didn\'t add it')); return; } c.gid = rn; linkGid(this, c); this.st.dd[c.id] = this.dataHash(c); sentD++; });
          save(); i += 100; msg(`Adding to Google… ${Math.min(i, fresh.length)} of ${fresh.length} added — caller photos next`); await sleep(2000); }
        catch (e) { if (e.signin) { why = stopWhy(); break; } if (e.rate) { if (await rated(`${i} of ${fresh.length} added`)) continue; break; } why = why || e.message; break; } }
      /* 2. changed ones: read their versions 200 at a time, then update 100 at a time */
      const upd = needD.filter((c) => c.gid && c.gid.startsWith('people/') && this.st.dd[c.id] !== this.dataHash(c));
      for (let i = 0; i < upd.length && ok() && why !== stopWhy(); ) { const chunk = upd.slice(i, i + 100);
        try { const q = chunk.map((c) => 'resourceNames=' + encodeURIComponent(c.gid)).join('&'); const g = await this.api(`${PEOPLE}people:batchGet?personFields=metadata&${q}`);
          if (!g.ok) { console.warn('batch read refused', g.status); for (const c of chunk) { if (!ok()) break; try { await this.push(c); sentD++; sentP++; } catch (e) { if (e.rate) { if (!(await rated('updating'))) break; } else if (e.signin) { why = stopWhy(); break; } else fail(c, e); } await sleep(1100); } i += 100; continue; }
          const et = {}; ((await g.json()).responses || []).forEach((x) => { if (x.person && x.person.etag) et[x.requestedResourceName] = x.person.etag; });
          const gone = chunk.filter((c) => !et[c.gid]); /* deleted in Google meanwhile → added again now */
          for (const c of gone) { if (!ok()) break; c.gid = null; delete this.st.pd[c.id]; try { await this.push(c); linkGid(this, c); sentD++; sentP++; } catch (e) { if (e.rate) { if (!(await rated('adding again'))) break; } else if (e.signin) { why = stopWhy(); break; } else fail(c, e); } await sleep(1100); }
          const send = chunk.filter((c) => et[c.gid]); const map = {}; send.forEach((c) => { map[c.gid] = { ...this.person(c), etag: et[c.gid] }; });
          if (send.length) { const r = await this.api(`${PEOPLE}people:batchUpdateContacts`, { method: 'POST', body: JSON.stringify({ contacts: map, updateMask: FIELDS, readMask: 'metadata' }) });
            if (r.ok) { const res = (await r.json()).updateResult || {}; send.forEach((c) => { const x = res[c.gid]; if (x && (x.httpStatusCode || 200) < 300) { this.st.dd[c.id] = this.dataHash(c); sentD++; } else fail(c, new Error((x && x.status && x.status.message) || 'Google didn\'t update it')); }); }
            else if (r.status >= 400) { for (const c of send) { if (!ok()) break; try { await this.push(c); sentD++; sentP++; } catch (e) { if (e.rate) { if (!(await rated('updating'))) break; } else if (e.signin) { why = stopWhy(); break; } else fail(c, e); } await sleep(1100); } }
            else throw new Error(`Google said ${r.status} updating: ${(await r.text()).slice(0, 120)}`); }
          i += 100; msg(`Updating names and numbers… ${Math.min(i, upd.length)} of ${upd.length}${fails ? ` · ${fails} couldn't be sent` : ''}`); await sleep(2000); }
        catch (e) { if (e.signin) { why = stopWhy(); break; } if (e.rate) { if (await rated(`${i} of ${upd.length} updated`)) continue; break; } why = why || e.message; break; } }
      /* 3. caller photos, one at a time (Google has no batch for photos) */
      const ph = needP.filter((c) => c.gid && c.gid.startsWith('people/') && this.st.pd[c.id] !== this.photoSig(c) && !errs[c.id]);
      for (let i = 0; i < ph.length && ok() && why !== stopWhy(); i++) { const c = ph[i];
        try { await this.sendPhoto(c); this.st.pd[c.id] = this.photoSig(c); sentP++; waits = 0; }
        catch (e) { if (e.signin) { why = stopWhy(); break; } if (e.rate) { if (await rated(`${i} of ${ph.length} caller photos`)) { i--; continue; } break; } fail(c, e); }
        msg(`Sending caller photos… ${i + 1} of ${ph.length}${fails ? ` · ${fails} couldn't be sent` : ''}`);
        await sleep(1100); }
      this.st.done = {}; /* old record no longer used */
      /* deleted or merged in the app → out of Google Contacts too */
      if (gset().removeGone !== false && this.st.on && navigator.onLine) { const inUse = new Set(want.map((c) => c.gid).filter(Boolean));
        for (const [id, gid] of Object.entries(this.st.gids)) { if (live.has(id)) continue; if (!inUse.has(gid)) { try { const r = await this.api(`${PEOPLE}${gid}:deleteContact`, { method: 'DELETE' }); if (r.ok || r.status === 404) removed++; else continue; } catch (e) { if (e.signin) break; continue; } await sleep(900); }
          delete this.st.gids[id]; delete this.st.dd[id]; delete this.st.pd[id]; } }
      const left = Math.max(0, total - Math.max(sentD, sentP) - fails);
      msg(`${left > 0 && why ? `Paused — ${why}. ` : 'Up to date. '}${removed ? removed + ' removed. ' : ''}${fails ? `${fails} couldn't be sent — first problem: ${why}. Full list below. ` : ''}(${new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })})`);
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
    this.running = false; this.st.done = {}; this.st.dd = {}; this.st.pd = {}; this.st.gids = {}; this.st.on = true; this.st.msg = `Deleted ${gone}. Sending every contact again…`; this.persist();     toast(`Backup downloaded and ${gone} deleted — sending every contact again now (keep the app open)`, 'info'); renderAll(); this.run(); };
  /* Settings → Sync & sign-in → Caller photos: status, problem and the buttons */
  if (typeof callerPhotosHtml === 'function') callerPhotosHtml = function () { const gp = G.st; const ok = !!(G.srvTok && Date.now() < G.srvTok.exp) || GAuth.valid();
    return `<div class="lbl" style="margin-top:14px">Caller photos (Google Contacts)</div>
    <label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0"><input type="checkbox" data-act="gpush-toggle" ${gp.on ? 'checked' : ''} ${S.admin ? '' : 'disabled title="Only the admin can change this"'}> <span>This device keeps Google Contacts up to date <span class="setlock fixed" style="font-size:11px;padding:1px 7px">🔒 Admin only</span><br><span class="hint">It updates whenever the app is open on this device. Google access comes from the practice's Google connection (Settings → Scheduling), so there's no Google sign-in to keep doing.</span></span></label>
    ${gp.on ? `<div class="kv"><div class="k">Status</div><div class="v"><span data-gc-status>${h(gp.msg || 'Waiting')}</span>${G.running ? ' <span class="hint" data-gc-time>(working…)</span>' : ''}</div></div>${gp.srvErr && !ok ? `<div class="kv"><div class="k">Google connection</div><div class="v" style="color:var(--red)">${h(gp.srvErr)}</div></div>` : ''}<div class="actions"><button class="btn small" data-act="gpush-now">Update Google Contacts now</button></div>` : ''}
    ${S.admin ? `<div class="actions"><button class="btn small" data-act="gc2-backup">⬇️ Download a backup of Google Contacts</button><button class="btn small danger" data-act="gc2-again">🧹 Start Google Contacts again</button></div><div class="hint">Options (what's sent, removing deleted contacts): Settings → Contacts → Google Contacts (caller ID) options.</div>` : ''}
    ${S.admin ? `<div class="actions"><button class="btn small primary" data-act="gc3-open">🔍 Compare the app with Google Contacts</button></div>` : ''}`; };
  /* the ones Google wouldn't take, with what Google said — under the status in Settings */
  if (typeof callerPhotosHtml === 'function') callerPhotosHtml = (function (orig) { return function () { const base = orig.apply(this, arguments); const E = Object.entries(G.st.errs || {}); if (!E.length || !G.st.on) return base;
    const who = (id) => { if (id.startsWith('b:')) { const b = IDX.biz.get(id.slice(2)); return b ? (typeof u13BizA === 'function' ? u13BizA(b) : h(b.name)) : h(id); } const c = (D.contacts || []).find((x) => x.id === id); return c ? (typeof u13PersonA === 'function' ? u13PersonA(c) : h(fullName(c))) : h(id); };
    return base + `<details class="card gc-errs"><summary><b>⚠️ Couldn't be sent — ${E.length}</b></summary><div class="hint">What went wrong for each one. They're tried again at the next update.</div>${E.map(([id, m]) => `<div style="margin:6px 0"><div><b>${who(id)}</b></div><div class="hint">${h(m)}</div></div>`).join('')}</details>`; }; })(callerPhotosHtml);
  document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act="gpush-now"], [data-act="gpush-toggle"]'); if (!el) return; if (el.dataset.act === 'gpush-toggle' && !el.checked) return; e.stopPropagation(); if (el.dataset.act === 'gpush-now') e.preventDefault();
    if (!S.admin) { if (el.type === 'checkbox') el.checked = false; needAdmin(); return; }
    if (el.dataset.act === 'gpush-toggle') { G.st.on = true; G.persist(); }
    G.failAt = 0; try { await G.token(true); toast('Updating Google Contacts in the background — keep the app open on this device', 'info'); G.run(); } catch (x) { toast(x.signin ? `Google isn't connected for Google Contacts: ${G.st.srvErr || ''}` : x.message, 'warn'); } renderAll(); }, true);
  document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act^="gc2-"]'); if (!el) return; e.preventDefault(); e.stopPropagation();
    if (!S.admin) { needAdmin(); return; }
    if (el.dataset.act === 'gc2-backup') { toast('Reading Google Contacts…', 'info'); try { G.failAt = 0; await G.token(true); const L = await G.backup(); toast(`Backup of ${L.length} Google contacts downloaded`, 'info'); } catch (x) { toast(x.signin ? `Google isn't connected for Google Contacts: ${G.st.srvErr || 'connect Google Calendar again in Settings → Scheduling'}` : x.message, 'warn'); } }
    if (el.dataset.act === 'gc2-again') G.startAgain(); }, true);
  /* 🔍 Compare the app with Google Contacts: everyone missing, different, only in Google, or doubled up — fix them in one go */
  const dig = (v) => String(v || '').replace(/\D/g, '').replace(/^61/, '0');
  const gName = (p) => { const n = (p.names || [])[0] || {}; return (n.displayName || [n.givenName, n.familyName].filter(Boolean).join(' ') || ((p.organizations || [])[0] || {}).name || '').trim(); };
  G.compare = async function () {
    const L = await this.listAll(); const byGid = new Map(L.map((p) => [p.resourceName, p])); const want = this.wanted(); const used = new Set();
    const missing = [], diff = [], skipped = [];
    want.forEach((c) => { const gp = c.gid && byGid.get(c.gid); if (!gp) { missing.push(c); return; } used.add(c.gid); let me; try { me = this.person(c); } catch (e) { diff.push({ c, why: e.message }); return; }
      const why = []; const an = [me.names[0].givenName, me.names[0].familyName].filter(Boolean).join(' ').trim().toLowerCase(), gn = [((gp.names || [])[0] || {}).givenName, ((gp.names || [])[0] || {}).familyName].filter(Boolean).join(' ').trim().toLowerCase(); if (an !== gn) why.push(`name (Google: ${gName(gp) || 'none'})`);
      const ap = new Set(me.phoneNumbers.map((x) => dig(x.value))), gpn = new Set((gp.phoneNumbers || []).map((x) => dig(x.value))); if (ap.size !== gpn.size || [...ap].some((x) => !gpn.has(x))) why.push('phone numbers');
      const ae = new Set(me.emailAddresses.map((x) => x.value.toLowerCase())), ge = new Set((gp.emailAddresses || []).map((x) => (x.value || '').toLowerCase())); if (ae.size !== ge.size || [...ae].some((x) => !ge.has(x))) why.push('emails');
      const ao = (me.organizations[0] || {}).name || '', go = ((gp.organizations || [])[0] || {}).name || ''; if (ao !== go) why.push('business');
      if (why.length) diff.push({ c, why: why.join(', ') }); });
    const onlyG = L.filter((p) => !used.has(p.resourceName));
    const seen = {}; L.forEach((p) => { const k = gName(p).toLowerCase(); if (k) (seen[k] = seen[k] || []).push(p); }); const dups = Object.values(seen).filter((x) => x.length > 1);
    const skip = new Set(gset().skip || []); D.contacts.filter((c) => !c.gone).forEach((c) => { if (want.some((w) => w.id === c.id)) return; let cat = ''; try { cat = catOf(c); } catch (e) { } skipped.push({ c, why: noDet(c) ? 'no phone, email or address' : cat && skip.has(cat) ? `category "${tagName(cat)}" is switched off` : 'not sent' }); });
    this.cmp = { at: Date.now(), total: L.length, want: want.length, missing, diff, onlyG, dups, skipped }; return this.cmp; };
  function gcCmpHtml(R) { const nm = (c) => h(fullName(c) || (c._biz && c._biz.name) || '?'); const sec = (open, title, body) => `<details class="card" ${open ? 'open' : ''}><summary><b>${title}</b></summary>${body}</details>`;
    return `<div class="hint" style="margin-bottom:8px">Google Contacts has <b>${R.total}</b>; the app should have <b>${R.want}</b> there. Checked ${new Date(R.at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}.</div>
    ${!R.missing.length && !R.diff.length && !R.onlyG.length && !R.dups.length ? '<div class="card" style="border:2px solid var(--green)"><b>✓ Google Contacts matches the app.</b></div>' : ''}
    ${R.missing.length || R.diff.length ? `<div class="actions"><button class="btn primary" data-act="gc3-send">📤 Send the ${R.missing.length + R.diff.length} missing or different now</button></div>` : ''}
    ${R.missing.length ? sec(true, `❌ In the app but not in Google Contacts — ${R.missing.length}`, `<div class="ezy-list">${R.missing.map((c) => `<div>${nm(c)}</div>`).join('')}</div>`) : ''}
    ${R.diff.length ? sec(true, `✏️ Different in Google Contacts — ${R.diff.length}`, `<div class="ezy-list">${R.diff.map((x) => `<div>${nm(x.c)} <span class="hint">— ${h(x.why)}</span></div>`).join('')}</div>`) : ''}
    ${R.onlyG.length ? sec(false, `☁ Only in Google Contacts (not from the app) — ${R.onlyG.length}`, `<div class="hint">Staff, personal contacts, or old copies the app no longer uses. Tick the ones to delete from Google.</div><div class="actions"><button class="btn small" data-act="gc3-all">Tick all</button><button class="btn small" data-act="gc3-none">Untick all</button></div><div class="ezy-list">${R.onlyG.map((p) => `<label class="bk-radio" style="display:flex;margin:2px 0"><input type="checkbox" class="gc3-del" value="${h(p.resourceName)}"> ${h(gName(p) || 'No name')} <span class="hint">${h(((p.phoneNumbers || [])[0] || {}).value || ((p.emailAddresses || [])[0] || {}).value || '')}</span></label>`).join('')}</div><div class="actions"><button class="btn small danger" data-act="gc3-delsel">🗑️ Delete the ticked ones from Google</button></div>`) : ''}
    ${R.dups.length ? sec(false, `👥 Same name more than once in Google Contacts — ${R.dups.length}`, `<div class="ezy-list">${R.dups.map((L) => `<div>${h(gName(L[0]))} <span class="hint">× ${L.length}</span></div>`).join('')}</div><div class="hint">Copies not used by the app are in "Only in Google Contacts" above.</div>`) : ''}
    ${R.skipped.length ? sec(false, `ℹ️ Not sent on purpose — ${R.skipped.length}`, `<div class="ezy-list">${R.skipped.map((x) => `<div>${nm(x.c)} <span class="hint">— ${h(x.why)}</span></div>`).join('')}</div>`) : ''}`; }
  G.compareOpen = async function () { toast('Comparing the app with Google Contacts…', 'info'); let R; try { this.failAt = 0; await this.token(true); R = await this.compare(); } catch (e) { toast(e.signin ? `Google isn't connected for Google Contacts: ${this.st.srvErr || ''}` : e.message, 'warn'); return; }
    openSheet('🔍 App vs Google Contacts', `<div id="gc3-box">${gcCmpHtml(R)}</div>`, () => true); };
  document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act^="gc3-"]'); if (!el) return; e.preventDefault(); e.stopPropagation(); const a = el.dataset.act; const R = G.cmp;
    if (a === 'gc3-open') { if (!S.admin) { needAdmin(); return; } G.compareOpen(); return; }
    if (!R) return;
    if (a === 'gc3-all' || a === 'gc3-none') { document.querySelectorAll('.gc3-del').forEach((c) => { c.checked = a === 'gc3-all'; }); return; }
    if (a === 'gc3-send') { const L = [...R.missing, ...R.diff.map((x) => x.c)]; if (!(await askBox('Send to Google Contacts?', `<p>Send <b>${L.length}</b> contacts from the app to Google Contacts (adding the missing ones and correcting the different ones)?</p>`, 'Send'))) return; L.forEach((c) => { delete G.st.done[c.id]; delete G.st.dd[c.id]; delete G.st.pd[c.id]; }); G.st.on = true; G.persist(); if (typeof closeSheet === 'function') closeSheet(); toast(`Sending ${L.length} to Google Contacts — keep the app open`, 'info'); G.run(); return; }
    if (a === 'gc3-delsel') { const ids = [...document.querySelectorAll('.gc3-del:checked')].map((c) => c.value); if (!ids.length) { toast('Tick the ones to delete first', 'warn'); return; }
      if (!(await askBox('Delete from Google Contacts?', `<p>Delete <b>${ids.length}</b> contacts from Google Contacts? They're not in the app. They go to Google Contacts → Trash for 30 days.</p>`, 'Delete', true))) return;
      try { for (let i = 0; i < ids.length; i += 200) { const x = await G.api(`${PEOPLE}people:batchDeleteContacts`, { method: 'POST', body: JSON.stringify({ resourceNames: ids.slice(i, i + 200) }) }); if (!x.ok) throw new Error(`Google said ${x.status}`); } toast(`${ids.length} deleted from Google Contacts`, 'info'); R.onlyG = R.onlyG.filter((p) => !ids.includes(p.resourceName)); const b = document.getElementById('gc3-box'); if (b) b.innerHTML = gcCmpHtml(R); } catch (x) { toast(x.message, 'warn'); } } }, true);
  document.addEventListener('change', (e) => { if (e.target && e.target.name === 'gw') G._mode = e.target.value; }, true);
  setTimeout(() => G.maybeRun(), 8000);
})();
