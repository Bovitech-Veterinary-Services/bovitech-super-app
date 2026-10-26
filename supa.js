/* Bovitech Practice — staff sign-in and syncing through the practice database (Supabase, Sydney).
   Loaded before app.js. Talks to Supabase directly with fetch (no library), so it also works offline:
   once someone has signed in on a device, the app opens without signal and syncs when it's back. */
'use strict';

const SB = {
  url: () => (window.BVT_CONFIG || {}).supabaseUrl,
  key: () => (window.BVT_CONFIG || {}).supabaseKey,
};
const LSJ = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
};
const sbErr = (msg, extra) => Object.assign(new Error(msg), extra || {});

/* ---------------- sign-in ---------------- */
const SBAuth = {
  s: LSJ.get('bvp-session'),        // { access_token, refresh_token, expires_at (seconds), user: { id, email } }
  staff: LSJ.get('bvp-staff'),      // this person's staff record (kept so the app opens offline)
  list: null,                       // everyone (Settings → Staff & permissions)
  refreshing: null,
  save() { LSJ.set('bvp-session', this.s); LSJ.set('bvp-staff', this.staff); },
  async auth(path, body, token) {
    let r;
    try { r = await fetch(SB.url() + '/auth/v1/' + path, { method: path === 'user' ? 'PUT' : 'POST', headers: { apikey: SB.key(), 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) }); }
    catch (e) { throw sbErr("Can't reach the practice database — check the internet connection.", { offline: true }); }
    const js = await r.json().catch(() => ({}));
    if (!r.ok) throw sbErr(js.error_description || js.msg || js.message || ('Sign-in error ' + r.status), { status: r.status, signin: r.status === 400 || r.status === 401 || r.status === 403 });
    return js;
  },
  keep(js) { this.s = { access_token: js.access_token, refresh_token: js.refresh_token, expires_at: js.expires_at || Math.floor(Date.now() / 1000) + (js.expires_in || 3600), user: { id: js.user.id, email: js.user.email } }; this.save(); },
  async signIn(email, password) {
    const js = await this.auth('token?grant_type=password', { email: email.trim().toLowerCase(), password });
    this.keep(js);
    const me = await this.loadMe();
    if (!me) { const e = this.s.user.email; await this.signOut(true); throw sbErr(`${e} isn't on the staff list (or has been made inactive). Ask the office.`); }
    return me;
  },
  async token(forceRefresh) {
    if (!this.s) throw sbErr('Please sign in', { signin: true });
    if (!forceRefresh && this.s.expires_at * 1000 - Date.now() > 60000) return this.s.access_token;
    if (!this.refreshing) this.refreshing = (async () => {
      try { this.keep(await this.auth('token?grant_type=refresh_token', { refresh_token: this.s.refresh_token })); }
      catch (e) { if (e.signin) { this.s = null; this.save(); throw sbErr('Your sign-in has run out — please sign in again', { signin: true }); } throw e; }
      finally { this.refreshing = null; }
    })();
    await this.refreshing; return this.s.access_token;
  },
  async loadMe() {
    const rows = await (await sbFetch('/rest/v1/staff?select=*&user_id=eq.' + encodeURIComponent(this.s.user.id))).json();
    const me = rows.find((x) => x.active) || null;
    this.staff = me; this.save();
    if (me) { try { localStorage.setItem('bvp-initials', me.initials); if (!localStorage.getItem('bvp-nick')) localStorage.setItem('bvp-nick', me.preferred_name || me.full_name.split(' ')[0]); } catch (e) { } }
    return me;
  },
  async loadList() { this.list = await (await sbFetch('/rest/v1/staff?select=*&order=full_name.asc')).json(); return this.list; },
  async changePassword(pw) { await this.auth('user', { password: pw }, await this.token()); },
  async signOut(quiet) {
    const t = this.s && this.s.access_token;
    this.s = null; this.staff = null; this.list = null; this.save();
    if (t) { try { await fetch(SB.url() + '/auth/v1/logout', { method: 'POST', headers: { apikey: SB.key(), Authorization: 'Bearer ' + t } }); } catch (e) { } }
    if (!quiet) showLogin();
  },
  can(k) { return !!(this.staff && this.staff[k]); },
};
async function sbFetch(path, opt = {}, retried) {
  const t = await SBAuth.token();
  let r;
  try { r = await fetch(SB.url() + path, { ...opt, headers: { apikey: SB.key(), Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(opt.headers || {}) } }); }
  catch (e) { throw sbErr("Can't reach the practice database — check the internet connection.", { offline: true }); }
  if (r.status === 401 && !retried) { await SBAuth.token(true); return sbFetch(path, opt, true); }
  if (!r.ok) { const js = await r.json().catch(() => ({})); const msg = js.message || js.hint || ('Database error ' + r.status);
    throw sbErr(/not signed in as active staff/i.test(msg) ? "You're not on the active staff list any more — ask the office." : msg, { status: r.status, notStaff: /active staff/i.test(msg), signin: /active staff/i.test(msg) }); }
  return r;
}

/* ---------------- sign-in screen (covers the app until someone signs in) ---------------- */
function showLogin(msg) {
  let bg = document.getElementById('loginbox');
  if (!bg) {
    bg = document.createElement('div'); bg.id = 'loginbox';
    bg.style.cssText = 'position:fixed;inset:0;z-index:300;background:var(--bg,#f4f1ea);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    bg.innerHTML = `<form class="card" style="width:100%;max-width:400px;margin:auto" autocomplete="on" novalidate>
      <div style="text-align:center;margin-bottom:6px"><img src="img/icon-192.png" alt="" style="width:76px;height:76px;border-radius:18px"></div>
      <h2 style="text-align:center;margin:4px 0 2px;font-size:24px">Bovitech Practice</h2>
      <div class="hint" style="text-align:center;margin-bottom:14px">Sign in with your own login</div>
      <div class="f"><label for="lg-email">Email</label><input id="lg-email" type="email" autocomplete="username" inputmode="email" style="font-size:17px;width:100%;box-sizing:border-box"></div>
      <div class="f"><label for="lg-pw">Password</label><input id="lg-pw" type="password" autocomplete="current-password" style="font-size:17px;width:100%;box-sizing:border-box"></div>
      <label style="display:flex;gap:6px;align-items:center;font-size:14px;margin:-2px 0 10px"><input type="checkbox" id="lg-show"> Show password</label>
      <button class="btn primary" type="submit" id="lg-go" style="width:100%;font-size:17px;padding:12px">Sign in</button>
      <div id="lg-msg" style="margin-top:10px;color:var(--red,#b42318);font-size:15px"></div>
      <div class="hint" style="margin-top:12px">Forgotten your password, or don't have a login yet? Ask the office.</div></form>`;
    document.body.appendChild(bg);
    bg.querySelector('#lg-show').addEventListener('change', (e) => { bg.querySelector('#lg-pw').type = e.target.checked ? 'text' : 'password'; });
    bg.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const em = bg.querySelector('#lg-email').value.trim(), pw = bg.querySelector('#lg-pw').value, out = bg.querySelector('#lg-msg'), go = bg.querySelector('#lg-go');
      if (!em || !pw) { out.textContent = 'Enter your email and password.'; return; }
      go.disabled = true; go.textContent = 'Signing in…'; out.textContent = '';
      try {
        const me = await SBAuth.signIn(em, pw);
        bg.remove(); if (typeof toast === 'function') toast(`✓ Signed in — hi ${me.preferred_name || me.full_name}`);
        if (typeof updHi === 'function') updHi();
        SupaSync.run(true).then(() => { if (typeof renderAll === 'function') renderAll(); });
      } catch (err) { out.textContent = err.status === 400 ? 'That email and password don’t match. Check them and try again.' : err.message; }
      finally { go.disabled = false; go.textContent = 'Sign in'; }
    });
  }
  const m = bg.querySelector('#lg-msg'); m.textContent = msg || (navigator.onLine ? '' : "You're offline — signing in needs internet the first time on each device.");
  if (SBAuth.s && SBAuth.s.user) bg.querySelector('#lg-email').value = SBAuth.s.user.email;
  setTimeout(() => { const f = bg.querySelector(bg.querySelector('#lg-email').value ? '#lg-pw' : '#lg-email'); if (f) f.focus(); }, 50);
}

/* ---------------- syncing ----------------
   Every record (contact, business, farm, tag, route) is one row in the database, with a revision number.
   Pull: download rows changed since the last pull (with a 5-minute overlap, so nothing is missed).
   Push: send changed records, each saying which revision it was based on. If someone else saved a newer
   revision first, the database refuses it; the app downloads theirs and, if both changed, shows a sync
   conflict (same screens as before) instead of overwriting anyone's work. */
const SupaSync = {
  state: 'idle', msg: '', timer: null, busy: false, again: false,
  enabled() { return !window.SEED && !!SB.url(); },
  start() {
    if (!this.enabled()) return;
    window.addEventListener('online', () => this.run(false));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.run(false); });
    setInterval(() => { if (!document.hidden) this.run(false); }, 60 * 1000); window.addEventListener('focus', () => this.run(false));
    if (!SBAuth.staff) { this.set('setup'); showLogin(); return; }
    this.run(false);
  },
  soon() { if (!this.enabled()) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.run(false), 4000); if (typeof renderSyncPill === 'function') renderSyncPill(); },
  set(state, msg = '') { this.state = state; this.msg = msg; if (typeof renderSyncPill === 'function') renderSyncPill(); },
  serial() { return DriveSync.serial(); },
  revs() { return (D.sync.revs = D.sync.revs || {}); },

  async run(interactive) {
    if (!this.enabled() || !D) return;
    if (this.busy) { this.again = true; return; }
    if (typeof CONFIRM !== 'undefined' && (CONFIRM || SHEET)) { this.soon(); return; } // not while a change is being made
    if (!navigator.onLine) { this.set('offline'); return; }
    if (!SBAuth.s || !SBAuth.staff) { this.set(SBAuth.staff ? 'signin' : 'setup'); if (interactive || !SBAuth.staff) showLogin(); return; }
    this.busy = true; this.set('syncing');
    try {
      let changes = 0;
      for (let round = 0; round < 4; round++) {
        changes += await this.pull();
        const refused = await this.push();
        if (!refused.length) break;
        changes += await this.fetchRows(refused); // someone saved first: get theirs, then try again
      }
      if (D.contacts.length) D.firstRun = false;
      D.sync.last = Date.now(); D.sync.fileId = 'supabase';
      if (changes || !S.migDone) { S.migDone = true; photoCache.clear(); JOBS_CACHE = null; reindex(); logChanges(); migrate(); logChanges('Automatic update'); baseline(); renderAll(); if (pendingCount()) this.soon(); }
      save(); this.set(D.conflicts.length ? 'conflict' : 'ok');
      if (!this.meChecked || Date.now() - this.meChecked > 15 * 60000) { this.meChecked = Date.now(); SBAuth.loadMe().then((me) => { if (!me) { SBAuth.signOut(true); showLogin("You're not on the active staff list any more — ask the office."); } else if (typeof updHi === 'function') updHi(); }).catch(() => {}); }
    } catch (e) {
      if (e.signin) { this.set('signin', e.message); if (interactive || e.notStaff) showLogin(e.message); }
      else if (e.offline) this.set('offline');
      else { this.set('error', e.message); console.error(e); }
    } finally { this.busy = false; save(); if (this.again) { this.again = false; this.soon(); } }
  },

  async pull() {
    const since = D.sync.since || '1970-01-01T00:00:00Z';
    const from = new Date(Date.parse(since) - 5 * 60000).toISOString();
    let lastSeq = 0, maxAt = since, changes = 0, rows;
    do {
      rows = await (await sbFetch(`/rest/v1/records?select=kind,id,data,rev,deleted,seq,updated_at&updated_at=gte.${encodeURIComponent(from)}&seq=gt.${lastSeq}&order=seq.asc&limit=500`)).json();
      rows.forEach((r) => { changes += this.apply(r); lastSeq = r.seq; if (Date.parse(r.updated_at) > Date.parse(maxAt)) maxAt = r.updated_at; });
    } while (rows.length === 500);
    D.sync.since = maxAt;
    return changes;
  },
  async fetchRows(list) {
    let changes = 0;
    const byKind = {}; list.forEach((x) => (byKind[x.kind] = byKind[x.kind] || []).push(x.id));
    for (const [k, ids] of Object.entries(byKind)) for (let i = 0; i < ids.length; i += 100) {
      const q = ids.slice(i, i + 100).map((id) => '"' + String(id).replace(/"/g, '') + '"').join(',');
      const rows = await (await sbFetch(`/rest/v1/records?select=kind,id,data,rev,deleted,seq,updated_at&kind=eq.${k}&id=in.(${encodeURIComponent(q)})`)).json();
      rows.forEach((r) => (changes += this.apply(r)));
    }
    return changes;
  },

  apply(r) {
    const k = r.kind;
    if (KINDS.includes(k)) return this.applyRec(k, r);
    const revs = this.revs();
    if (k === 'settings') {
      revs['settings:' + r.id] = r.rev; if (!r.data) return 0;
      const ss = r.data, ls = D.settings;
      if (D.sync.forceAll && ls._dirty) return 0;
      if (!ls._dirty || !D.sync.gotSettings) { D.sync.gotSettings = true; if (JSON.stringify(strip(ls)) === JSON.stringify(ss)) return 0; D.settings = ss; return 1; } // first sync on a device always takes the shared settings
      const m = { ...ss, ...ls }; Object.keys(ss).forEach((x) => { if (!(x in ls) || ls[x] == null) m[x] = ss[x]; }); D.settings = m; D.settings._dirty = true; return 1;
    }
    if (k === 'meta') {
      revs['meta:' + r.id] = r.rev; const v = r.data; if (v == null) return 0;
      const before = (x) => JSON.stringify(x || null);
      if (r.id === 'dismissed') { const b = before(D.dismissed); D.dismissed = { ...v, ...(D.dismissed || {}) }; return b === before(D.dismissed) ? 0 : 1; }
      if (r.id === 'trash') { const b = before(D.trash); const tm = new Map(); [...(v || []), ...(D.trash || [])].forEach((t) => { const e = tm.get(t.tid); if (!e || t.removed) tm.set(t.tid, t); }); D.trash = [...tm.values()]; return b === before(D.trash) ? 0 : 1; }
      if (r.id === 'changelog') { const b = (D.changelog || []).length; const lm = new Map(); [...(v || []), ...(D.changelog || [])].forEach((e) => { const x = lm.get(e.id); lm.set(e.id, x ? { ...e, undone: x.undone || e.undone } : e); }); D.changelog = [...lm.values()].sort((a, c) => c.at - a.at).slice(0, 400); return b === D.changelog.length ? 0 : 1; }
      if (r.id === 'info') { if (v.importedAt && v.importedAt !== D.importedAt) { D.importedAt = v.importedAt; return 1; } return 0; }
      return 0;
    }
    if (k === 'device') { if (r.id === DEVICE || !r.data) return 0; D.devices = D.devices || {}; const v = D.devices[r.id]; if (!v || (r.data.last || 0) > (v.last || 0)) D.devices[r.id] = r.data; return 0; }
    return 0;
  },
  applyRec(k, r) {
    const list = D[k] || (D[k] = []); const i = list.findIndex((x) => x.id === r.id); const l = i >= 0 ? list[i] : null;
    const who = (o) => (k === 'contacts' ? fullName(o) : k === 'farms' ? farmLabel(o) : o.name);
    if (D.sync.forceAll && l && l._dirty) return 0; // a backup was just restored here: it replaces what's in the database
    if (r.deleted) {
      if (!D.deleted.some((x) => x.id === r.id)) D.deleted.push({ id: r.id, kind: k, at: Date.parse(r.updated_at), synced: true });
      if (!l) return 0;
      if (l._dirty) D.conflicts.push({ key: k + ':' + r.id, kind: k, id: r.id, who: who(l), mine: strip(l), mineAt: l._u, deletedElsewhere: true });
      list.splice(i, 1); return 1;
    }
    if (D.deleted.some((x) => x.id === r.id && !x.synced)) return 0; // deleted on this device — that goes up next
    const s = { ...r.data, _rev: r.rev };
    if (!l) { list.push(s); return 1; }
    if (!l._dirty) { if ((l._rev || 0) === r.rev) return 0; adopt(l, s); return 1; } // update in place so open screens keep the same record
    if ((l._rev || 0) === r.rev) return 0; // our change is based on this version — it will upload
    if (JSON.stringify({ ...strip(l), _rev: 0, _u: 0, _dev: 0 }) === JSON.stringify({ ...s, _rev: 0, _u: 0, _dev: 0 })) { adopt(l, s); return 1; } // same edit both sides
    // changed here and somewhere else → keep theirs, never lose a link added here, and park the rest as a conflict to choose
    const mine0 = JSON.parse(JSON.stringify(strip(l))), mineAt0 = l._u;
    const lk = k === 'businesses' ? 'farmLinks' : k === 'contacts' ? 'links' : null, idk = k === 'businesses' ? 'fid' : 'bid';
    if (lk) {
      const theirs = s[lk] || [], have = new Set(theirs.map((x) => x[idk])); const add = (l[lk] || []).filter((x) => !have.has(x[idk])); const merged = { ...s, [lk]: [...theirs, ...add] };
      const rest = (o) => JSON.stringify({ ...strip(o), [lk]: 0, _rev: 0, _u: 0, _dev: 0, _dirty: 0 }); const same = rest(l) === rest(merged);
      if (add.length) { adopt(l, merged); l._dirty = true; } else adopt(l, s);
      if (same) return 1;
    } else adopt(l, s);
    for (let q = D.conflicts.length - 1; q >= 0; q--) if (D.conflicts[q].key === k + ':' + r.id) D.conflicts.splice(q, 1);
    D.conflicts.push({ key: k + ':' + r.id, kind: k, id: r.id, who: who(s), mine: mine0, mineAt: mineAt0, theirsAt: s._u, theirsDev: s._dev });
    return 1;
  },

  async push() {
    const revs = this.revs(), force = !!D.sync.forceAll, items = [], done = [];
    const add = (it, onOk, onNo) => { items.push({ ...it, device: DEVICE, ...(force ? { force: true } : {}) }); done.push({ onOk, onNo }); };
    KINDS.forEach((k) => (D[k] || []).forEach((r) => {
      if (!r._dirty) return; const u = r._u, data = strip(r); delete data._rev;
      add({ kind: k, id: r.id, data, base_rev: r._rev || 0 }, (rev) => { r._rev = rev; if (r._u === u) delete r._dirty; });
    }));
    const flag = (f, kind, id, data) => { if (!D[f]) return; delete D[f]; add({ kind, id, data, base_rev: revs[kind + ':' + id] || 0 }, (rev) => { revs[kind + ':' + id] = rev; }, () => { D[f] = true; }); };
    if (D.settings._dirty) { const st = D.settings, u = st._u, data = strip(st); delete data._rev; add({ kind: 'settings', id: 'main', data, base_rev: revs['settings:main'] || 0 }, (rev) => { revs['settings:main'] = rev; if (D.settings === st && st._u === u) delete st._dirty; }); }
    flag('_dismissDirty', 'meta', 'dismissed', D.dismissed || {});
    flag('_trashDirty', 'meta', 'trash', (D.trash || []).filter((t) => Date.now() - t.at < 90 * 864e5));
    flag('_logDirty', 'meta', 'changelog', (D.changelog || []).slice(0, 400));
    flag('_infoDirty', 'meta', 'info', { importedAt: D.importedAt || null });
    if (D._devDirty || Date.now() - (D.sync.devAt || 0) > 15 * 60000) {
      const me = SBAuth.staff || {};
      const dv = { name: deviceName(), nick: devInfo().nick || null, model: devInfo().dev || null, phone: devInfo().phone || null, last: Date.now(), ver: APP_VERSION.split(' ')[0], staff: me.initials || null };
      D.devices = D.devices || {}; D.devices[DEVICE] = dv; delete D._devDirty;
      items.push({ kind: 'device', id: DEVICE, data: dv, force: true, device: DEVICE }); done.push({ onOk: () => (D.sync.devAt = Date.now()) });
    }
    (D.deleted || []).filter((x) => !x.synced && x.kind).forEach((x) => { items.push({ kind: x.kind, id: x.id, deleted: true, force: true, device: DEVICE }); done.push({ onOk: () => (x.synced = true) }); });
    if (!items.length) { if (force) delete D.sync.forceAll; return []; }
    const refused = [];
    try {
      for (let i = 0; i < items.length; i += 100) {
        const res = await (await sbFetch('/rest/v1/rpc/push_records', { method: 'POST', body: JSON.stringify({ items: items.slice(i, i + 100) }) })).json();
        res.forEach((x, j) => { const d = done[i + j]; if (x.ok) d.onOk && d.onOk(x.rev); else { refused.push({ kind: x.kind, id: x.id }); d.onNo && d.onNo(); } });
      }
    } catch (e) { done.forEach((d) => d.onNo && d.onNo()); throw e; }
    if (force && !refused.length) delete D.sync.forceAll;
    return refused;
  },

  /* Settings → Backup → Restore backup: everything in the file replaces what's in the database */
  imported(oldIds) {
    const now = new Set(KINDS.flatMap((k) => (D[k] || []).map((r) => k + ':' + r.id)));
    oldIds.forEach(([k, id]) => { if (!now.has(k + ':' + id) && !D.deleted.some((x) => x.id === id)) D.deleted.push({ id, kind: k, at: Date.now() }); });
    KINDS.forEach((k) => (D[k] || []).forEach((r) => (r._dirty = true))); D.settings._dirty = true;
    D._dismissDirty = D._trashDirty = D._logDirty = D._infoDirty = true;
    (D.deleted || []).forEach((x) => { if (!now.has(x.kind + ':' + x.id)) delete x.synced; }); // send the backup's deletions too
    D.sync.forceAll = true; D.sync.gotSettings = true;
  },
};
window.SBAuth = SBAuth; window.SupaSync = SupaSync;

/* ---------------- Settings: sync & sign-in, staff & permissions ---------------- */
const ROLE_NAMES = { admin: 'Admin', vet: 'Vet', vet_tech: 'Vet technician', assistant: 'Vet assistant', other: 'Other' };
const PERMS = [['can_reports', 'Reports'], ['can_invoices', 'Invoices'], ['can_manage_staff', 'Manage staff'], ['active', 'Can sign in']];
function supaSyncCard() {
  const me = SBAuth.staff;
  return `<div class="card"><h3>Sync &amp; sign-in</h3>
  <div class="kv"><div class="k">Signed in as</div><div class="v">${me ? `<b>${h(me.preferred_name || me.full_name)}</b> (${h(me.initials)}) · ${h(ROLE_NAMES[me.role] || me.role)}<br><span class="hint">${h(me.email)}</span>` : 'Not signed in'}</div></div>
  <div class="kv"><div class="k">Practice database</div><div class="v">${D.sync.last ? `Connected · last synced ${new Date(D.sync.last).toLocaleString('en-AU')}` : 'Not synced yet'}</div></div>
  <div class="kv"><div class="k">Changes waiting</div><div class="v">${pendingCount()}</div></div>
  ${SupaSync.msg ? `<div class="kv"><div class="k">Last error</div><div class="v" style="color:var(--red)">${h(SupaSync.msg)}</div></div>` : ''}
  <div class="actions" style="margin-top:8px"><button class="btn primary" data-act="sync-now">Sync now</button>${me ? '<button class="btn" data-act="sb-pw">Change my password</button><button class="btn" data-act="sb-signout">Sign out</button>' : '<button class="btn" data-act="sb-signin">Sign in</button>'}</div>
  <div class="hint" style="margin-top:10px">Everyone signs in with their own email and password, so the change log shows who changed what. Your copy stays on this device and works offline; it syncs with the practice database (stored in Sydney) whenever you're online. Signing out hides the app on this device until someone signs in again.</div>
  <div class="hint" style="margin-top:6px"><b>Caller photos (Google Contacts)</b> are still updated by the Bovitech Contacts app while this one is being tested.</div></div>`;
}
function staffCard() {
  return `<div class="card"><h3>Staff &amp; permissions</h3><div id="staff-box"><div class="hint">Loading…</div></div></div>`;
}
function staffBoxHtml() {
  const mgr = SBAuth.can('can_manage_staff'), list = SBAuth.list || [];
  const initialsSeen = {}; list.filter((s) => s.active).forEach((s) => (initialsSeen[s.initials] = (initialsSeen[s.initials] || 0) + 1));
  return `${mgr ? '' : '<div class="hint" style="margin-bottom:6px">Only people who can manage staff can change these.</div>'}
  ${list.map((s) => `<div class="card" style="padding:10px;margin:6px 0${s.active ? '' : ';opacity:.6'}">
    <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:180px"><b>${h(s.preferred_name || s.full_name)}</b>${s.preferred_name && s.preferred_name !== s.full_name ? ` <span class="hint">(${h(s.full_name)})</span>` : ''} · ${h(s.initials)}${initialsSeen[s.initials] > 1 && s.active ? ' <span style="color:var(--red);font-size:13px">same initials as someone else</span>' : ''}<br><span class="hint">${h(ROLE_NAMES[s.role] || s.role)} · ${h(s.email)}${s.user_id ? '' : ' · <b>no login yet</b>'}</span></div>
    ${mgr ? `<button class="btn small" data-act="staff-edit" data-id="${s.id}">✏️ Edit</button>` : ''}</div>
    <div class="checks" style="margin-top:6px">${PERMS.map(([k, l]) => `<label><input type="checkbox" data-staffperm="${k}" data-id="${s.id}" ${s[k] ? 'checked' : ''} ${mgr ? '' : 'disabled'}>${l}</label>`).join('')}</div></div>`).join('')}
  ${mgr ? `<div class="actions" style="margin-top:8px"><button class="btn small" data-act="staff-add">➕ Add a person</button><a class="btn small" href="https://supabase.com/dashboard/project/${(SB.url() || '').replace(/^https:\/\/|\.supabase\.co.*$/g, '')}/auth/users" target="_blank" rel="noopener">Logins and passwords (Supabase) ↗</a></div>
  <div class="hint" style="margin-top:6px">To give someone a login: add them here, then in Supabase go to <b>Authentication → Users → Add user → Create new user</b>, enter the same email and a starting password, tick <b>Auto Confirm User</b>, and tell them the password (they can change it in Settings → Sync &amp; sign-in). Forgotten passwords are reset in the same place. Untick <b>Can sign in</b> to stop someone syncing straight away.</div>` : ''}`;
}
async function fillStaffBox(force) {
  const box = document.getElementById('staff-box'); if (!box) return;
  if (!SBAuth.s) { box.innerHTML = '<div class="hint">Sign in to see the staff list.</div>'; return; }
  if (SBAuth.list && !force) { box.innerHTML = staffBoxHtml(); box.dataset.filled = '1'; return; }
  if (!navigator.onLine) { box.innerHTML = '<div class="hint">Connect to the internet to see the staff list.</div>'; return; }
  box.dataset.filled = '1';
  try { await SBAuth.loadList(); const b2 = document.getElementById('staff-box'); if (b2) { b2.innerHTML = staffBoxHtml(); b2.dataset.filled = '1'; } }
  catch (e) { const b2 = document.getElementById('staff-box'); if (b2) b2.innerHTML = `<div class="hint" style="color:var(--red)">${h(e.message)}</div>`; }
}
new MutationObserver(() => { const b = document.getElementById('staff-box'); if (b && !b.dataset.filled) fillStaffBox(); }).observe(document.documentElement, { childList: true, subtree: true });

function staffForm(s) {
  s = s || { full_name: '', preferred_name: '', initials: '', email: '', role: 'vet' };
  return `<div class="f"><label>Full name</label><input id="sf-full" value="${h(s.full_name)}"></div>
  <div class="grid2"><div class="f"><label>Preferred name</label><input id="sf-pref" value="${h(s.preferred_name || '')}"></div>
  <div class="f"><label>Initials</label><input id="sf-ini" value="${h(s.initials)}" maxlength="5" style="max-width:120px;text-transform:uppercase"><div class="hint">Shown next to everything they add. Best kept different for each person.</div></div></div>
  <div class="f"><label>Email (their login)</label><input id="sf-email" type="email" value="${h(s.email)}" ${s.id ? 'disabled' : ''}>${s.id ? '<div class="hint">To change someone\'s email, change it in Supabase (Authentication → Users) and here — ask Claude for help.</div>' : ''}</div>
  <div class="f"><label>Role</label><select id="sf-role">${Object.entries(ROLE_NAMES).map(([v, l]) => `<option value="${v}" ${s.role === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
}
function staffFromForm() {
  const v = (id) => (document.getElementById(id).value || '').trim();
  const o = { full_name: v('sf-full'), preferred_name: v('sf-pref') || null, initials: v('sf-ini').toUpperCase(), role: v('sf-role') };
  if (!o.full_name) throw new Error('Enter their full name');
  if (!/^[A-Z]{1,5}$/.test(o.initials)) throw new Error('Initials must be 1 to 5 letters');
  return o;
}
document.addEventListener('change', async (e) => {
  const t = e.target; if (!t.dataset || !t.dataset.staffperm) return;
  const k = t.dataset.staffperm, id = t.dataset.id, on = t.checked;
  const s = (SBAuth.list || []).find((x) => x.id === id);
  if (s && SBAuth.staff && s.id === SBAuth.staff.id && !on && (k === 'can_manage_staff' || k === 'active') && !(await ask(k === 'active' ? "Stop yourself signing in? You'll be signed out on every device." : "Remove your own permission to manage staff? Someone else will have to give it back.", 'Yes — remove'))) { t.checked = true; return; }
  try {
    await sbFetch('/rest/v1/staff?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ [k]: on }), headers: { Prefer: 'return=minimal' } });
    toast(`✓ ${s ? s.preferred_name || s.full_name : 'Staff'}: ${PERMS.find((p) => p[0] === k)[1]} ${on ? 'on' : 'off'}`);
    await SBAuth.loadList(); if (s && SBAuth.staff && s.id === SBAuth.staff.id) await SBAuth.loadMe();
  } catch (err) { t.checked = !on; toast(/manage staff/.test(err.message) ? 'At least one active person must be able to manage staff' : err.message); }
  fillStaffBox();
});
document.addEventListener('click', async (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'sb-signin') showLogin();
  else if (a === 'sb-signout') {
    if (pendingCount() && !(await ask(`${pendingCount()} change${pendingCount() === 1 ? " hasn't" : "s haven't"} synced yet. Sign out anyway? They'll sync when someone signs in again on this device.`, 'Yes — sign out'))) return;
    if (await ask('Sign out on this device? The app will be hidden until someone signs in again.', 'Yes — sign out')) { await SBAuth.signOut(); renderAll(); }
  } else if (a === 'sb-pw') {
    openSheet('Change my password', `<div class="f"><label>New password</label><input id="pw-1" type="password" autocomplete="new-password"><div class="hint">At least 8 characters.</div></div><div class="f"><label>New password again</label><input id="pw-2" type="password" autocomplete="new-password"></div>`, async () => {
      const p1 = document.getElementById('pw-1').value, p2 = document.getElementById('pw-2').value;
      if (p1.length < 8) { toast('Use at least 8 characters'); return false; }
      if (p1 !== p2) { toast("The two passwords don't match"); return false; }
      try { await SBAuth.changePassword(p1); toast('✓ Password changed'); return true; } catch (err) { toast(err.message); return false; }
    });
  } else if (a === 'staff-add' || a === 'staff-edit') {
    const s = a === 'staff-edit' ? (SBAuth.list || []).find((x) => x.id === el.dataset.id) : null;
    openSheet(s ? 'Edit ' + (s.preferred_name || s.full_name) : 'Add a person', staffForm(s), async () => {
      let o; try { o = staffFromForm(); } catch (err) { toast(err.message); return false; }
      const clash = (SBAuth.list || []).find((x) => x.active && x.initials === o.initials && (!s || x.id !== s.id));
      if (clash && !(await ask(`${clash.preferred_name || clash.full_name} already uses ${o.initials}. Use the same initials anyway?`, 'Yes — keep'))) return false;
      try {
        if (s) await sbFetch('/rest/v1/staff?id=eq.' + s.id, { method: 'PATCH', body: JSON.stringify(o), headers: { Prefer: 'return=minimal' } });
        else { const em = (document.getElementById('sf-email').value || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('Enter their email'); return false; }
          await sbFetch('/rest/v1/staff', { method: 'POST', body: JSON.stringify({ ...o, email: em }), headers: { Prefer: 'return=minimal' } }); }
        await SBAuth.loadList(); if (s && SBAuth.staff && s.id === SBAuth.staff.id) await SBAuth.loadMe();
        toast(s ? '✓ Saved' : '✓ Added — now create their login in Supabase (see the steps below the list)'); setTimeout(() => fillStaffBox(), 50); return true;
      } catch (err) { toast(/duplicate key/.test(err.message) ? 'Someone with that email is already on the list' : err.message); return false; }
    });
  }
});
