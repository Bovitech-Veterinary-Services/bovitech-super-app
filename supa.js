/* Bovitech Practice — staff sign-in, device checks, app lock and syncing through the practice database (Supabase, Sydney).
   Loaded before app.js. Talks to Supabase directly with fetch (no library), so it also works offline:
   once someone has signed in on a device, the app opens without signal and syncs when it's back.
   Security: password, then a code from an authenticator app the first time on each device (that device is then
   remembered); the shared app PIN after a few minutes unused; the admin can wipe a device remotely. */
/* passwords and PINs: hidden as you type, but never offered to the browser's "save password" (the box isn't a password box to the browser) */
const PWT = (window.CSS && CSS.supports && (CSS.supports('-webkit-text-security', 'disc') || CSS.supports('text-security', 'disc'))) ? 'text' : 'password';
function bvpShowSecret(el, show) { if (!el) return; if (PWT === 'text') el.classList.toggle('show', !!show); else el.type = show ? 'text' : 'password'; }
(function () { const st = document.createElement('style'); st.textContent = '.bvp-secret{-webkit-text-security:disc;text-security:disc}.bvp-secret.show{-webkit-text-security:none;text-security:none}'; (document.head || document.documentElement).appendChild(st); })();
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
const randHex = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, '0')).join(''); };

/* each signed-in person gets a secret key on each device; the database remembers devices that passed two-step sign-in */
const Dev = {
  key(uid) { const all = LSJ.get('bvp-devkeys') || {}; if (!all[uid]) { all[uid] = randHex(32); LSJ.set('bvp-devkeys', all); } return all[uid]; },
  k() { return SBAuth.s ? this.key(SBAuth.s.user.id) : null; },
  label() {
    const ua = navigator.userAgent; const phone = /Android|iPhone|iPad|Mobile/i.test(ua);
    const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'Linux';
    const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'browser';
    let nick = ''; try { nick = localStorage.getItem('bvp-devmodel') || ''; } catch (e) { }
    return (nick ? nick + ' · ' : '') + `${os} ${phone ? 'phone' : 'computer'} (${br})`;
  },
};

/* ---------------- sign-in ---------------- */
const SBAuth = {
  s: LSJ.get('bvp-session'),        // { access_token, refresh_token, expires_at (seconds), user: { id, email } }
  staff: LSJ.get('bvp-staff'),      // this person's staff record (kept so the app opens offline)
  list: null,                       // everyone (Settings → Staff & permissions)
  refreshing: null,
  save() { LSJ.set('bvp-session', this.s); LSJ.set('bvp-staff', this.staff); },
  async auth(path, body, token, method) {
    let r;
    try { r = await fetch(SB.url() + '/auth/v1/' + path, { method: method || (path === 'user' ? 'PUT' : 'POST'), headers: { apikey: SB.key(), 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(method === 'GET' || method === 'DELETE' ? {} : { body: JSON.stringify(body || {}) }) }); }
    catch (e) { throw sbErr("Can't reach the practice database — check the internet connection.", { offline: true }); }
    const js = await r.json().catch(() => ({}));
    if (!r.ok) throw sbErr(js.error_description || js.msg || js.message || ('Sign-in error ' + r.status), { status: r.status, code: js.error_code || js.code, signin: r.status === 400 || r.status === 401 || r.status === 403 });
    return js;
  },
  keep(js) { this.s = { access_token: js.access_token, refresh_token: js.refresh_token, expires_at: js.expires_at || Math.floor(Date.now() / 1000) + (js.expires_in || 3600), user: { id: js.user.id, email: js.user.email } }; this.save(); },
  /* step 1: email + password. Returns { done } when this device is already trusted, or what's needed next. */
  async signIn(email, password) {
    let js; try { js = await this.auth('token?grant_type=password', { email: email.trim().toLowerCase(), password }); } catch (e) { if (e.status === 400 && /invalid_credentials|invalid_grant/.test(e.code || '') || /invalid login credentials/i.test(e.message)) e.badPw = true; e.tokenStep = true; throw e; } // only this step means the password is wrong
    this.keep(js);
    return this.afterPassword();
  },
  async afterPassword() {
    let st = await rpc('device_status', { k: Dev.k() });
    if (st.wipe) { wipeLocal(); st = await rpc('device_status', { k: Dev.k() }); } // this device was wiped by the admin: clear it, then carry on as a new device
    if (!st.active) { const e = this.s.user.email; await this.signOut(true); throw sbErr(`${e} isn't on the staff list (or has been made inactive). Ask the office.`); }
    if (st.trusted) { await this.finish(); return { done: true }; }
    const user = await this.auth('user', null, await this.token(), 'GET');
    const totp = (user.factors || []).filter((f) => f.factor_type === 'totp');
    const ok = totp.find((f) => f.status === 'verified');
    if (ok) return { need: 'code', factorId: ok.id };
    for (const f of totp) { try { await this.auth('factors/' + f.id, null, await this.token(), 'DELETE'); } catch (e) { } } // half-finished set-ups
    const en = await this.auth('factors', { factor_type: 'totp', friendly_name: 'Bovitech Practice ' + randHex(3), issuer: 'Bovitech Practice' }, await this.token());
    return { need: 'enrol', factorId: en.id, qr: en.totp && en.totp.qr_code, secret: en.totp && en.totp.secret };
  },
  /* step 2: the 6-digit code from the authenticator app — then this device is remembered */
  async verifyCode(factorId, code) {
    const ch = await this.auth('factors/' + factorId + '/challenge', {}, await this.token());
    const js = await this.auth('factors/' + factorId + '/verify', { challenge_id: ch.id, code: String(code).replace(/\D/g, '') }, await this.token());
    this.keep(js);
    await rpc('trust_device', { k: Dev.k(), label: Dev.label() });
    await this.finish();
  },
  async finish() {
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
  async loadList() { this.list = await (await sbFetch('/rest/v1/staff?select=*&order=full_name.asc')).json(); LSJ.set('bvp-stafflist', this.list); return this.list; },
  async changePassword(pw) { await this.auth('user', { password: pw }, await this.token()); },
  async signOut(quiet) {
    const t = this.s && this.s.access_token;
    this.s = null; this.staff = null; this.list = null; this.save();
    if (t) { try { await fetch(SB.url() + '/auth/v1/logout', { method: 'POST', headers: { apikey: SB.key(), Authorization: 'Bearer ' + t } }); } catch (e) { } }
    if (!quiet) showLogin();
  },
  can(k) { return !!(this.staff && this.staff[k]); },
  isAdmin() { return !!(this.staff && this.staff.role === 'admin'); },
};
async function sbFetch(path, opt = {}, retried) {
  const t = await SBAuth.token();
  let r;
  try { r = await fetch(SB.url() + path, { ...opt, headers: { apikey: SB.key(), Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(opt.headers || {}) } }); }
  catch (e) { throw sbErr("Can't reach the practice database — check the internet connection.", { offline: true }); }
  if (r.status === 401 && !retried) { await SBAuth.token(true); return sbFetch(path, opt, true); }
  if (!r.ok) {
    const js = await r.json().catch(() => ({})); const msg = js.message || js.hint || ('Database error ' + r.status);
    if (/DEVICE_NOT_TRUSTED/.test(msg)) throw sbErr('This device needs to be checked again — please sign in.', { status: r.status, device: true, signin: true });
    if (/CODE_NEEDED/.test(msg)) throw sbErr('Please enter a new code from your authenticator app.', { status: r.status, codeNeeded: true });
    throw sbErr(/not signed in as active staff/i.test(msg) ? "You're not on the active staff list any more — ask the office." : msg, { status: r.status, notStaff: /active staff/i.test(msg), signin: /active staff/i.test(msg) });
  }
  return r;
}
const rpc = async (fn, args) => { const t = await (await sbFetch('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(args || {}) })).text(); return t ? JSON.parse(t) : null; }; // functions that return nothing send an empty reply

/* ---------------- remote wipe: the admin removed this device ---------------- */
function wipeLocal(msg) {
  try { if (typeof Store !== 'undefined' && Store.db) { Store.db.close(); Store.db = null; } } catch (e) { }
  try { if (typeof Store !== 'undefined') { Store.open = () => Promise.reject(new Error('wiped')); } } catch (e) { }
  try { indexedDB.deleteDatabase('bovitech-practice'); } catch (e) { }
  try { Object.keys(localStorage).filter((x) => x.startsWith('bvp-') || /^sb-/.test(x)).forEach((x) => localStorage.removeItem(x)); } catch (e) { }
  try { sessionStorage.clear(); } catch (e) { }
  SBAuth.s = null; SBAuth.staff = null; SBAuth.list = null;
  if (msg) { try { localStorage.setItem('bvp-wiped-msg', msg); } catch (e) { } setTimeout(() => location.reload(), 300); }
}
async function checkWipe(reason) { // called when the database refuses this device
  try { const st = await rpc('device_status', { k: Dev.k() }); if (st.wipe) { wipeLocal('This device was cleared by the office. Sign in again to use the app.'); return true; } } catch (e) { }
  return false;
}

/* ---------------- sign-in screen (covers the app until someone signs in) ---------------- */
const LG = { mode: 'password', factorId: null, qr: null, secret: null };
function showLogin(msg) {
  let bg = document.getElementById('loginbox');
  if (!bg) {
    bg = document.createElement('div'); bg.id = 'loginbox';
    bg.style.cssText = 'position:fixed;inset:0;z-index:300;background:var(--bg,#f4f1ea);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
    document.body.appendChild(bg);
    bg.addEventListener('submit', onLoginSubmit);
    bg.addEventListener('click', (e) => {
      if (e.target.id === 'lg-back') { LG.mode = 'password'; SBAuth.signOut(true); drawLogin(''); }
      if (e.target.id === 'lg-copy' && LG.secret) { try { navigator.clipboard.writeText(LG.secret); e.target.textContent = 'Copied'; } catch (x) { } }
    });
    bg.addEventListener('change', (e) => { if (e.target.id === 'lg-show') bvpShowSecret(bg.querySelector('#lg-pw'), e.target.checked); });
    LG.mode = 'password';
  }
  drawLogin(msg || (navigator.onLine ? '' : "You're offline — signing in needs internet the first time on each device."));
}
function drawLogin(msg) {
  const bg = document.getElementById('loginbox'); if (!bg) return;
  const head = `<div style="text-align:center;margin-bottom:6px"><img src="img/icon-192.png" alt="" style="width:76px;height:76px;border-radius:18px"></div><h2 style="text-align:center;margin:4px 0 2px;font-size:24px">Bovitech Super App</h2>`;
  const inp = 'font-size:17px;width:100%;box-sizing:border-box';
  let body;
  if (LG.mode === 'password') body = `<div class="hint" style="text-align:center;margin-bottom:14px">Sign in with your own login</div>
      <div class="f"><label for="lg-email">Email</label><input id="lg-email" type="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" inputmode="email" style="${inp}"></div>
      <div class="f"><label for="lg-pw">Password</label><input id="lg-pw" type="${PWT}" class="bvp-secret" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" style="${inp}"></div>
      <label style="display:flex;gap:6px;align-items:center;font-size:14px;margin:-2px 0 10px"><input type="checkbox" id="lg-show"> Show password</label>
      <button class="btn primary" type="submit" id="lg-go" style="width:100%;font-size:17px;padding:12px">Sign in</button>
      <div id="lg-msg" style="margin-top:10px;color:var(--red,#b42318);font-size:15px"></div>
      <div class="hint" style="margin-top:12px">Forgotten your password, or don't have a login yet? Ask the office.</div>`;
  else if (LG.mode === 'enrol') body = `<div style="font-weight:700;font-size:17px;margin:6px 0">Set up two-step sign-in (one time)</div>
      <ol style="margin:4px 0 10px 18px;padding:0;line-height:1.5"><li>Install an authenticator app on your phone — <b>Microsoft Authenticator</b> or <b>Google Authenticator</b>.</li><li>In the app tap <b>+</b> / <b>Add account</b> and scan this code${/Android|iPhone/i.test(navigator.userAgent) ? ' (or, on this phone, copy the key below and choose "Enter a setup key")' : ''}.</li><li>Type the 6-digit code it shows.</li></ol>
      ${LG.qr ? `<div style="text-align:center;background:#fff;border-radius:10px;padding:8px"><img src="${LG.qr.startsWith('data:') ? LG.qr : 'data:image/svg+xml;utf-8,' + encodeURIComponent(LG.qr)}" alt="QR code" style="width:200px;height:200px"></div>` : ''}
      ${LG.secret ? `<div class="hint" style="margin:8px 0;word-break:break-all">Key: <b style="font-family:monospace">${h(LG.secret)}</b> <button type="button" class="btn small" id="lg-copy">Copy</button></div>` : ''}
      <div class="f"><label for="lg-code">6-digit code</label><input id="lg-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" style="${inp};letter-spacing:4px;font-size:22px"></div>
      <button class="btn primary" type="submit" id="lg-go" style="width:100%;font-size:17px;padding:12px">Confirm</button>
      <div id="lg-msg" style="margin-top:10px;color:var(--red,#b42318);font-size:15px"></div>
      <div class="hint" style="margin-top:10px">You'll only be asked for a code the first time you sign in on each phone or computer. <button type="button" class="btn small" id="lg-back">Back</button></div>`;
  else body = `<div style="font-weight:700;font-size:17px;margin:6px 0">New device — enter your code</div>
      <div class="hint" style="margin-bottom:10px">Open your authenticator app and type the 6-digit code for <b>Bovitech Practice</b>. This is only needed the first time on this ${/Android|iPhone|Mobile/i.test(navigator.userAgent) ? 'phone' : 'computer'}.</div>
      <div class="f"><label for="lg-code">6-digit code</label><input id="lg-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" style="${inp};letter-spacing:4px;font-size:22px"></div>
      <button class="btn primary" type="submit" id="lg-go" style="width:100%;font-size:17px;padding:12px">Confirm</button>
      <div id="lg-msg" style="margin-top:10px;color:var(--red,#b42318);font-size:15px"></div>
      <div class="hint" style="margin-top:10px">Lost or changed your phone? Ask the office to reset your two-step sign-in. <button type="button" class="btn small" id="lg-back">Back</button></div>`;
  const keep = {}; ['lg-email', 'lg-pw', 'lg-code'].forEach((id) => { const el = bg.querySelector('#' + id); if (el && el.value) keep[id] = el.value; }); const shown = !!(bg.querySelector('#lg-show') || {}).checked; const had = document.activeElement && document.activeElement.id; // redrawing never loses what's been typed
  bg.innerHTML = `<form class="card" style="width:100%;max-width:400px;margin:auto" autocomplete="off" novalidate>${head}${body}</form>`;
  Object.entries(keep).forEach(([id, v]) => { const el = bg.querySelector('#' + id); if (el) el.value = v; }); if (shown && bg.querySelector('#lg-show')) { bg.querySelector('#lg-show').checked = true; bvpShowSecret(bg.querySelector('#lg-pw'), true); }
  bg.querySelector('#lg-msg').textContent = msg || '';
  let pending = ''; try { pending = localStorage.getItem('bvp-wiped-msg') || ''; if (pending) { localStorage.removeItem('bvp-wiped-msg'); bg.querySelector('#lg-msg').textContent = pending; } } catch (e) { }
  if (LG.mode === 'password' && SBAuth.s && SBAuth.s.user) bg.querySelector('#lg-email').value = SBAuth.s.user.email;
  setTimeout(() => { const f = bg.querySelector(had && bg.querySelector('#' + had) ? '#' + had : LG.mode !== 'password' ? '#lg-code' : bg.querySelector('#lg-email').value ? '#lg-pw' : '#lg-email'); if (f) f.focus(); }, 50);
}
async function onLoginSubmit(e) {
  e.preventDefault();
  const bg = document.getElementById('loginbox'), out = bg.querySelector('#lg-msg'), go = bg.querySelector('#lg-go'), label = go.textContent;
  go.disabled = true; go.textContent = LG.mode === 'password' ? 'Signing in…' : 'Checking…'; out.textContent = '';
  try {
    if (LG.mode === 'password') {
      const em = bg.querySelector('#lg-email').value.trim(), pw = bg.querySelector('#lg-pw').value;
      if (!em || !pw) { out.textContent = 'Enter your email and password.'; return; }
      const r = await SBAuth.signIn(em, pw);
      if (!r.done) { Object.assign(LG, { mode: r.need, factorId: r.factorId, qr: r.qr || null, secret: r.secret || null }); drawLogin(''); return; }
    } else {
      const code = bg.querySelector('#lg-code').value.replace(/\D/g, '');
      if (code.length !== 6) { out.textContent = 'Type the 6-digit code from your authenticator app.'; return; }
      await SBAuth.verifyCode(LG.factorId, code);
    }
    signedIn();
  } catch (err) {
    out.textContent = LG.mode === 'password' && err.badPw ? 'That email and password don’t match. Check them and try again.'
      : LG.mode === 'password' && err.tokenStep ? `Sign-in was refused: ${err.message}${err.code ? ' (' + err.code + ')' : ''}`
      : LG.mode === 'password' && !err.offline ? `Your password was accepted, but signing in couldn't finish: ${err.message}${err.status ? ' (' + err.status + (err.code ? ' ' + err.code : '') + ')' : ''}. Tell the office (or Claude) exactly what this says.`
      : LG.mode !== 'password' && (err.status === 422 || err.status === 400 || /invalid|expired/i.test(err.message)) ? "That code didn't work — codes change every 30 seconds, so type the one showing now." : err.message;
  } finally { if (go.isConnected) { go.disabled = false; go.textContent = label; } }
}
function signedIn() {
  const me = SBAuth.staff; LG.mode = 'password'; LG.qr = LG.secret = null;
  const bg = document.getElementById('loginbox'); if (bg) bg.remove();
  if (typeof toast === 'function') toast(`✓ Signed in — hi ${typeof niceName === 'function' ? niceName(me.preferred_name || me.full_name) : me.preferred_name || me.full_name}`);
  if (typeof updHi === 'function') updHi();
  Lock.afterSignIn();
  SupaSync.run(true).then(() => { if (typeof renderAll === 'function') renderAll(); });
}

/* ---------------- app lock: one shared practice PIN after a few minutes unused (set by the admin, same for everyone) ---------------- */
const LOCK_DEFAULT = { salt: 'bovitech-app-pin', pin: '2015' };
const Lock = {
  locked: false, fails: 0,
  minutes() { const m = typeof D !== 'undefined' && D && D.settings && D.settings.appLockMin; return m === 0 ? 0 : m || 10; },
  rec() { return (typeof D !== 'undefined' && D && D.settings && D.settings.appPin) || null; }, // {salt, hash}; none yet = the starting PIN
  last() { return +(localStorage.getItem('bvp-active') || 0); },
  touch() { if (this.locked) return; const n = Date.now(); if (n - (this._t || 0) > 5000) { this._t = n; try { localStorage.setItem('bvp-active', String(n)); } catch (e) { } } },
  async hash(pin, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 150000 }, key, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },
  async ok(pin) { const r = this.rec(); if (!r) return pin === LOCK_DEFAULT.pin; return (await this.hash(pin, r.salt)) === r.hash; },
  async setPin(pin) { const salt = randHex(16); D.settings.appPin = { salt, hash: await this.hash(pin, salt), at: Date.now(), by: SBAuth.staff && SBAuth.staff.id }; touch(D.settings); save(); SupaSync.soon(); },
  start() {
    try { localStorage.removeItem('bvp-lock'); } catch (e) { } // the old per-person PINs
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((ev) => document.addEventListener(ev, () => this.touch(), { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); else this.touch(); });
    setInterval(() => this.check(), 15000);
    this.check(true);
  },
  check(atStart) {
    if (this.locked || !SBAuth.staff || !SBAuth.s || this.minutes() === 0) return;
    if (document.getElementById('loginbox')) return;
    if (Date.now() - this.last() > this.minutes() * 60000 || (atStart && !this.last())) this.show();
  },
  /* this device's own screen lock (fingerprint, face, PIN or pattern) can unlock the app instead of the app PIN */
  creds() { try { return JSON.parse(localStorage.getItem('bvp-unlock') || '{}'); } catch (e) { return {}; } },
  cred() { const u = SBAuth.s && SBAuth.s.user && SBAuth.s.user.id; return u ? this.creds()[u] || null : null; },
  setCred(v) { const u = SBAuth.s && SBAuth.s.user && SBAuth.s.user.id; if (!u) return; const a = this.creds(); if (v) a[u] = v; else delete a[u]; try { localStorage.setItem('bvp-unlock', JSON.stringify(a)); } catch (e) { } },
  async canDevice() { try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; } },
  async addDevice() {
    const me = SBAuth.staff || {}; const uid8 = new Uint8Array(16); crypto.getRandomValues(uid8); const ch = new Uint8Array(32); crypto.getRandomValues(ch);
    const c = await navigator.credentials.create({ publicKey: { challenge: ch, rp: { name: 'Bovitech Super App' }, user: { id: uid8, name: me.email || 'staff', displayName: me.preferred_name || me.full_name || 'Staff' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000 } });
    const id = btoa(String.fromCharCode(...new Uint8Array(c.rawId))); this.setCred(id); return id;
  },
  async useDevice() { const id = this.cred(); if (!id) throw new Error('none'); const ch = new Uint8Array(32); crypto.getRandomValues(ch);
    await navigator.credentials.get({ publicKey: { challenge: ch, allowCredentials: [{ type: 'public-key', id: Uint8Array.from(atob(id), (x) => x.charCodeAt(0)) }], userVerification: 'required', timeout: 60000 } }); },
  async offerDevice() { // once per person per device, after signing in
    const u = SBAuth.s && SBAuth.s.user && SBAuth.s.user.id; if (!u || this.cred()) return; let asked = {}; try { asked = JSON.parse(localStorage.getItem('bvp-unlockask') || '{}'); } catch (e) { } if (asked[u]) return;
    if (!(await this.canDevice())) return; asked[u] = Date.now(); try { localStorage.setItem('bvp-unlockask', JSON.stringify(asked)); } catch (e) { }
    if (typeof askBox !== 'function') return;
    const ok = await askBox('Unlock with this device\'s screen lock?', `<p style="font-size:16px">When the app locks, it can open with the screen lock you already use on this ${/Android|iPhone|Mobile/i.test(navigator.userAgent) ? 'phone' : 'device'} — fingerprint, face, PIN or pattern — instead of the app PIN. The app PIN still works too.</p>`, 'Yes — use the screen lock', false, 'No — just the app PIN');
    if (!ok) return; try { await this.addDevice(); if (typeof toast === 'function') toast('✓ This device\'s screen lock now unlocks the app'); } catch (e) { if (typeof toast === 'function') toast("The screen lock wasn't set up — you can turn it on later in Settings → General → App lock"); }
  },
  afterSignIn() { this.fails = 0; this.touch(); setTimeout(() => this.offerDevice(), 1500); },
  hide() { const b = document.getElementById('lockbox'); if (b) b.remove(); this.locked = false; this._t = 0; this.touch(); },
  show() {
    this.locked = true;
    let b = document.getElementById('lockbox'); if (b) return; // already showing
    b = document.createElement('div'); b.id = 'lockbox'; b.style.cssText = 'position:fixed;inset:0;z-index:290;background:var(--bg,#f4f1ea);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto'; document.body.appendChild(b);
    const me = SBAuth.staff || {};
    const inp = 'font-size:24px;letter-spacing:6px;text-align:center;width:100%;box-sizing:border-box';
    b.innerHTML = `<form class="card" style="width:100%;max-width:340px;margin:auto;text-align:center"><div style="font-size:42px">🔒</div><h2 style="margin:2px 0 4px;font-size:22px">Hi ${h(me.preferred_name || me.full_name || '')}</h2><div class="hint" style="margin-bottom:12px">Enter the app PIN to carry on</div>
      <input id="lk-pin" type="${PWT}" class="bvp-secret" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" inputmode="numeric" maxlength="8" aria-label="App PIN" style="${inp}">
      <button class="btn primary" type="submit" style="width:100%;font-size:17px;padding:12px;margin-top:10px">Unlock</button>
      ${this.cred() ? '<button class="btn" type="button" id="lk-dev" style="width:100%;margin-top:8px;font-size:16px;padding:10px">🔓 Use this device\'s screen lock</button>' : ''}
      <div id="lk-msg" style="margin-top:8px;color:var(--red,#b42318)"></div>
      <div class="hint" style="margin-top:10px">Forgotten the PIN? Ask the office, or <button type="button" class="btn small" id="lk-out">sign out</button></div></form>`;
    const f = b.querySelector('form'), msg = b.querySelector('#lk-msg');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const pin = b.querySelector('#lk-pin').value;
      if (await this.ok(pin)) { this.fails = 0; this.hide(); return; }
      this.fails++; b.querySelector('#lk-pin').value = '';
      if (this.fails >= 5) { this.fails = 0; this.hide(); await SBAuth.signOut(true); showLogin('Too many wrong PINs — please sign in again with your password.'); return; }
      msg.textContent = `Wrong PIN (${5 - this.fails} more tr${5 - this.fails === 1 ? 'y' : 'ies'} before you need to sign in again).`;
    };
    b.querySelector('#lk-out').onclick = async () => { this.hide(); await SBAuth.signOut(true); showLogin(''); };
    const dv = b.querySelector('#lk-dev'); if (dv) { const go = async () => { try { await this.useDevice(); this.fails = 0; this.hide(); } catch (x) { msg.textContent = 'Screen lock not recognised — use the app PIN, or try again.'; } }; dv.onclick = go; setTimeout(go, 300); }
    else setTimeout(() => { const i = b.querySelector('#lk-pin'); if (i) i.focus(); }, 50);
  },
};

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
    Lock.start();
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
      if (typeof GContacts !== 'undefined') GContacts.maybeRun(); // caller photos, on the one device that does them
      if (window.Bk && Bk.on()) { // bookings: texts sent / replies (only once 03-sms.sql has been run)
        if (this.kickSms) { this.kickSms = false; rpc('sms_kick', { k: Dev.k() }).catch(() => {}); }
        if (!this.smsAt || Date.now() - this.smsAt > 90000) { this.smsAt = Date.now(); rpc('sms_status', { k: Dev.k(), days: 60 }).then((l) => { D.smsLog = l || []; save(); if (S.tab === 'book' && !SHEET && !CONFIRM) renderAll(); else renderTabs(); }).catch(() => {}); }
      }
      if (!this.meChecked || Date.now() - this.meChecked > 15 * 60000) { this.meChecked = Date.now(); SBAuth.loadList().catch(() => {}); SBAuth.loadMe().then((me) => { if (!me) { SBAuth.signOut(true); showLogin("You're not on the active staff list any more — ask the office."); } else if (typeof updHi === 'function') updHi(); }).catch(() => {}); }
    } catch (e) {
      if (e.device || e.notStaff) { // the database refused this device or person: wiped by the admin, made inactive, or needs a code again
        if (!(await checkWipe())) { this.set('signin', e.message); if (e.notStaff) await SBAuth.signOut(true); showLogin(e.message); }
      } else if (e.signin) { this.set('signin', e.message); if (interactive) showLogin(e.message); }
      else if (e.offline) this.set('offline');
      else { this.set('error', e.message); console.error(e); }
    } finally { this.busy = false; save(); if (this.again) { this.again = false; this.soon(); } }
  },

  async pull() {
    const since = D.sync.since || '1970-01-01T00:00:00Z';
    const from = new Date(Date.parse(since) - 5 * 60000).toISOString();
    let lastSeq = 0, maxAt = since, changes = 0, rows;
    do {
      rows = await rpc('pull_records', { k: Dev.k(), since: from, after_seq: lastSeq, lim: 500 });
      rows.forEach((r) => { changes += this.apply(r); lastSeq = r.seq; if (Date.parse(r.updated_at) > Date.parse(maxAt)) maxAt = r.updated_at; });
    } while (rows.length === 500);
    D.sync.since = maxAt;
    return changes;
  },
  async fetchRows(list) {
    let changes = 0;
    const byKind = {}; list.forEach((x) => (byKind[x.kind] = byKind[x.kind] || []).push(x.id));
    for (const [kind, ids] of Object.entries(byKind)) for (let i = 0; i < ids.length; i += 100) {
      const rows = await rpc('fetch_records', { k: Dev.k(), kind_: kind, ids: ids.slice(i, i + 100) });
      rows.forEach((r) => (changes += this.apply(r)));
    }
    return changes;
  },

  apply(r) {
    const k = r.kind;
    if (KINDS.includes(k) || (window.BOOK_KINDS || []).includes(k)) return this.applyRec(k, r);
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
    const who = (o) => (k === 'contacts' ? fullName(o) : k === 'farms' ? farmLabel(o) : k === 'bookings' && window.Bk ? 'Booking — ' + Bk.who(o) : o.name || o.id);
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
    if (stable({ ...strip(l), _rev: 0, _u: 0, _dev: 0 }) === stable({ ...s, _rev: 0, _u: 0, _dev: 0 })) { adopt(l, s); return 1; } // same edit both sides (field order doesn't matter — the database stores fields in its own order)
    // changed here and somewhere else → keep theirs, never lose a link added here, and park the rest as a conflict to choose
    const mine0 = JSON.parse(JSON.stringify(strip(l))), mineAt0 = l._u;
    const lk = k === 'businesses' ? 'farmLinks' : k === 'contacts' ? 'links' : null, idk = k === 'businesses' ? 'fid' : 'bid';
    if (lk) {
      const theirs = s[lk] || [], have = new Set(theirs.map((x) => x[idk])); const add = (l[lk] || []).filter((x) => !have.has(x[idk])); const merged = { ...s, [lk]: [...theirs, ...add] };
      const rest = (o) => stable({ ...strip(o), [lk]: 0, _rev: 0, _u: 0, _dev: 0, _dirty: 0 }); const same = rest(l) === rest(merged);
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
    [...KINDS, ...(window.BOOK_KINDS || [])].forEach((k) => (D[k] || []).forEach((r) => {
      if (!r._dirty) return; const u = r._u, data = strip(r); delete data._rev;
      add({ kind: k, id: r.id, data, base_rev: r._rev || 0 }, (rev) => { r._rev = rev; if (r._u === u) delete r._dirty; if (k === 'bookings' && (data.sms || data.proposal)) this.kickSms = true; });
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
      // send in bundles of up to 100 records or ~250 KB (farm photos can be big; smaller bundles cope better with weak signal)
      for (let i = 0; i < items.length;) {
        let j = i, size = 0; while (j < items.length && j - i < 100 && (j === i || size + JSON.stringify(items[j]).length < 250000)) { size += JSON.stringify(items[j]).length; j++; }
        const res = await rpc('push_records', { items: items.slice(i, j), k: Dev.k() });
        res.forEach((x, n) => { const d = done[i + n]; if (x.ok) d.onOk && d.onOk(x.rev); else { refused.push({ kind: x.kind, id: x.id }); d.onNo && d.onNo(); } });
        i = j; if (items.length > 300) this.set('syncing', `Sending ${Math.min(i, items.length)} of ${items.length}…`);
      }
    } catch (e) { done.forEach((d) => d.onNo && d.onNo()); throw e; }
    if (force && !refused.length) delete D.sync.forceAll;
    return refused;
  },

  /* Settings → Backup → Restore backup: everything in the file replaces what's in the database */
  imported(oldIds) {
    const now = new Set(KINDS.flatMap((k) => (D[k] || []).map((r) => k + ':' + r.id)));
    oldIds.forEach(([k, id]) => { if (!now.has(k + ':' + id) && !D.deleted.some((x) => x.id === id)) D.deleted.push({ id, kind: k, at: Date.now() }); });
    [...KINDS, ...(window.BOOK_KINDS || [])].forEach((k) => (D[k] || []).forEach((r) => (r._dirty = true))); D.settings._dirty = true;
    D._dismissDirty = D._trashDirty = D._logDirty = D._infoDirty = true;
    (D.deleted || []).forEach((x) => { if (!now.has(x.kind + ':' + x.id)) delete x.synced; }); // send the backup's deletions too
    D.sync.forceAll = true; D.sync.gotSettings = true;
  },
};
window.SBAuth = SBAuth; window.SupaSync = SupaSync; window.Lock = Lock;

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
  ${callerPhotosHtml()}</div>`;
}
function callerPhotosHtml() { // one device (the office computer) keeps the practice Google Contacts up to date, so the phones show the right photo when a client rings
  const gp = GContacts.st;
  return `<div class="lbl" style="margin-top:14px">Caller photos (Google Contacts)</div>
  <label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0"><input type="checkbox" data-act="gpush-toggle" ${gp.on ? 'checked' : ''} ${S.admin ? '' : 'disabled title="Only the admin can change this"'}> <span>This device keeps Google Contacts up to date ${S.admin ? '<span class="setlock fixed" style="font-size:11px;padding:1px 7px">🔒 Admin only</span>' : '<button type="button" class="setlock" style="font-size:11px;padding:1px 7px" data-act="admin-unlock" title="Unlock admin">🔒 Admin only — unlock</button>'}<br><span class="hint">Turn this on for <b>one device only</b> — the office computer is best — and sign in to the practice Google account (${h(practiceAccount())}) when asked. It copies names, numbers, emails, business and the tag photo (with CHECK WARNING) so the phones show the right photo when a client rings. Turn it off in the old Bovitech Contacts app first.</span></span></label>
  ${gp.on ? `<div class="kv"><div class="k">Status</div><div class="v">${h(gp.msg || 'Waiting')}${GAuth.valid() ? '' : ' — <b>sign in to Google to carry on</b>'}</div></div><div class="actions"><button class="btn small" data-act="gpush-now">${GAuth.valid() ? 'Update Google Contacts now' : 'Sign in to Google and update'}</button></div>` : ''}`;
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
    <div class="checks" style="margin-top:6px">${PERMS.map(([k, l]) => `<label><input type="checkbox" data-staffperm="${k}" data-id="${s.id}" ${s[k] ? 'checked' : ''} ${mgr ? '' : 'disabled'}>${l}</label>`).join('')}</div>${SBAuth.isAdmin() ? Admin.personHtml(s) : ''}</div>`).join('')}
  ${mgr ? `<div class="actions" style="margin-top:8px"><button class="btn small" data-act="staff-add">➕ Add a person</button><a class="btn small" href="https://supabase.com/dashboard/project/${(SB.url() || '').replace(/^https:\/\/|\.supabase\.co.*$/g, '')}/auth/users" target="_blank" rel="noopener">Logins and passwords (Supabase) ↗</a></div>
  <div class="hint" style="margin-top:6px">To give someone a login: add them here, then in Supabase go to <b>Authentication → Users → Add user → Create new user</b>, enter the same email and a starting password, tick <b>Auto Confirm User</b>, and tell them the password (they can change it in Settings → Sync &amp; sign-in). Forgotten passwords are reset in the same place. Untick <b>Can sign in</b> to stop someone syncing straight away.</div>` : ''}`;
}
async function fillStaffBox(force) {
  const box = document.getElementById('staff-box'); if (!box) return;
  if (SBAuth.isAdmin() && (!Admin.devices || force) && navigator.onLine) { box.dataset.filled = '1'; try { Admin.devices = await rpc('list_devices', { k: Dev.k() }); } catch (e) { Admin.devices = []; } }
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
    await rpc('staff_update', { k: Dev.k(), staff_id: id, patch: { [k]: on } });
    toast(`✓ ${s ? s.preferred_name || s.full_name : 'Staff'}: ${PERMS.find((p) => p[0] === k)[1]} ${on ? 'on' : 'off'}`);
    await SBAuth.loadList(); if (s && SBAuth.staff && s.id === SBAuth.staff.id) await SBAuth.loadMe();
    if (k === 'active' && !on && SBAuth.isAdmin() && s && s.id !== SBAuth.staff.id && await ask(`Also wipe ${s.preferred_name || s.full_name}'s phones and computers? The app and its copy of the data are cleared from each one the next time it's online.`, 'Yes — wipe their devices')) {
      const n = await rpc('wipe_devices', { k: Dev.k(), staff_id_: s.id }); toast(`✓ ${n} device${n === 1 ? '' : 's'} will be wiped`); Admin.devices = null;
    }
  } catch (err) { t.checked = !on; toast(/manage staff/.test(err.message) ? 'At least one active person must be able to manage staff' : err.message); }
  fillStaffBox();
});
document.addEventListener('click', async (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'me-menu') {
    const st = SBAuth.staff; if (!st) { showLogin(); return; }
    const r = await askBox('Signed in', `<p style="margin:0 0 4px"><b>${h(st.full_name)}</b>${st.role === 'admin' ? ' (office / admin)' : ''}</p><p class="hint" style="margin:0">${h((SBAuth.s && SBAuth.s.user && SBAuth.s.user.email) || st.email || '')}</p><p class="hint">Signing out hides the app on this device until someone signs in again with their password. To change your password, go to Settings → Sync &amp; sign-in.</p>`, 'Sign out', false, 'Close', '🔒 Lock now');
    if (r === 'alt') { Lock.show(); return; }
    if (r) { if (pendingCount() && !(await ask(`${pendingCount()} change${pendingCount() === 1 ? " hasn't" : "s haven't"} synced yet. Sign out anyway? They'll sync when someone signs in again on this device.`, 'Yes — sign out'))) return;
      await SBAuth.signOut(); if (typeof updHi === 'function') updHi(); renderAll(); }
    return;
  }
  if (a === 'sb-signin') showLogin();
  else if (a === 'sb-signout') {
    if (pendingCount() && !(await ask(`${pendingCount()} change${pendingCount() === 1 ? " hasn't" : "s haven't"} synced yet. Sign out anyway? They'll sync when someone signs in again on this device.`, 'Yes — sign out'))) return;
    if (await ask('Sign out on this device? The app will be hidden until someone signs in again.', 'Yes — sign out')) { await SBAuth.signOut(); if (typeof updHi === 'function') updHi(); renderAll(); }
  } else if (a === 'sb-pw') {
    openSheet('Change my password', `<div class="f"><label>New password</label><input id="pw-1" type="${PWT}" class="bvp-secret" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true"><div class="hint">At least 8 characters.</div></div><div class="f"><label>New password again</label><input id="pw-2" type="${PWT}" class="bvp-secret" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true"></div>`, async () => {
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
        if (s) await rpc('staff_update', { k: Dev.k(), staff_id: s.id, patch: o });
        else { const em = (document.getElementById('sf-email').value || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('Enter their email'); return false; }
          await rpc('staff_add', { k: Dev.k(), person: { ...o, email: em } }); }
        await SBAuth.loadList(); if (s && SBAuth.staff && s.id === SBAuth.staff.id) await SBAuth.loadMe();
        toast(s ? '✓ Saved' : '✓ Added — now create their login in Supabase (see the steps below the list)'); setTimeout(() => fillStaffBox(), 50); return true;
      } catch (err) { toast(/duplicate key/.test(err.message) ? 'Someone with that email is already on the list' : err.message); return false; }
    });
  }
});

/* ---------------- admin only: devices, remote wipe, two-step reset, security log ---------------- */
const Admin = {
  devices: null, log: null,
  when(t) { return t ? new Date(t).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'; },
  personHtml(s) {
    if (!s.user_id) return '';
    const mine = (this.devices || []).filter((d) => d.staff_id === s.id && !d.revoked_at);
    return `<details style="margin-top:6px"><summary class="hint" style="cursor:pointer">📱 Devices (${mine.length}) · security</summary>
      ${mine.length ? mine.map((d) => `<div class="kv" style="align-items:center"><div class="v">${h(d.label || 'Device')}${d.this ? ' <span class="hint">(this one)</span>' : ''}<br><span class="hint">Added ${this.when(d.created_at)} · last used ${this.when(d.last_seen)}</span></div>${d.this ? '' : `<button class="btn small" data-act="adm-rmdev" data-id="${d.id}" data-who="${h(s.preferred_name || s.full_name)}" data-label="${h(d.label || 'this device')}">Remove &amp; wipe</button>`}</div>`).join('') : '<div class="hint">No devices signed in yet.</div>'}
      <div class="actions" style="margin-top:6px">${mine.some((d) => !d.this) ? `<button class="btn small" data-act="adm-wipe" data-id="${s.id}" data-who="${h(s.preferred_name || s.full_name)}">🧹 Wipe all their devices</button>` : ''}<button class="btn small" data-act="adm-reset2" data-id="${s.id}" data-who="${h(s.preferred_name || s.full_name)}">🔑 Reset two-step sign-in</button></div>
      <div class="hint" style="margin-top:4px">A removed device clears the app and its copy of the data the next time it's online. Reset two-step sign-in if they lose or change phones — they set up their authenticator app again when they next sign in.</div></details>`;
  },
  card() {
    if (!SBAuth.isAdmin()) return '';
    return `<div class="card"><h3>Security log</h3><div class="hint" style="margin-bottom:6px">Sign-ins on new devices, wipes, two-step resets, staff changes and backups. Each of these is also emailed to the office (once the email alerts are set up). Admin only.</div><div id="seclog-box"><div class="hint">Loading…</div></div></div>`;
  },
  kindText: { new_device: '📱 Signed in on a new device', device_wiped: '🧹 Device removed and wiped', devices_wiped: '🧹 All devices wiped', two_step_reset: '🔑 Two-step sign-in reset', staff_changed: '👤 Staff details or permissions changed', staff_added: '👤 Person added', backup_ok: '💾 Nightly backup saved', backup_failed: '⚠️ Nightly backup failed' },
  async fillLog() {
    const box = document.getElementById('seclog-box'); if (!box || box.dataset.filled) return; box.dataset.filled = '1';
    if (!navigator.onLine) { box.innerHTML = '<div class="hint">Connect to the internet to see the log.</div>'; return; }
    try { this.log = await rpc('security_log', { k: Dev.k(), lim: 200 }); } catch (e) { box.innerHTML = `<div class="hint" style="color:var(--red)">${h(e.message)}</div>`; return; }
    const det = (e) => { const d = e.detail || {}; if (e.kind === 'staff_changed') return Object.entries(d).map(([k, v]) => `${({ can_reports: 'Reports', can_invoices: 'Invoices', can_manage_staff: 'Manage staff', active: 'Can sign in', full_name: 'Name', preferred_name: 'Preferred name', initials: 'Initials', role: 'Role' })[k] || k}: ${v === true ? 'on' : v === false ? 'off' : v}`).join(', ');
      if (d.device) return d.device; if (d.devices != null) return d.devices + ' device' + (d.devices === 1 ? '' : 's'); if (d.file) return d.file + (d.size ? ` (${Math.round(d.size / 1024)} KB)` : ''); if (d.error) return d.error; return ''; };
    box.innerHTML = this.log.length ? this.log.map((e) => `<div class="kv"><div class="k" style="min-width:140px">${this.when(e.at)}</div><div class="v"><b>${h(this.kindText[e.kind] || e.kind)}</b>${e.about ? ' — ' + h(e.about_pref || e.about) : ''}${e.by && e.by !== e.about ? ` <span class="hint">by ${h(e.by_pref || e.by)}</span>` : ''}${det(e) ? `<br><span class="hint">${h(det(e))}</span>` : ''}</div></div>`).join('') : '<div class="hint">Nothing yet.</div>';
  },
};
new MutationObserver(() => { const b = document.getElementById('seclog-box'); if (b && !b.dataset.filled) Admin.fillLog(); const l = document.getElementById('lock-box'); if (l && !l.dataset.filled) fillLockBox(); }).observe(document.documentElement, { childList: true, subtree: true });

/* Settings → App lock */
function lockCard() { return `<div class="card"><h3>App lock</h3><div id="lock-box"></div></div>`; }
async function fillLockBox() {
  const box = document.getElementById('lock-box'); if (!box) return; box.dataset.filled = '1';
  const min = Lock.minutes(), r = Lock.rec();
  box.innerHTML = `<div class="hint" style="margin-bottom:6px">The app locks after <b>${min === 0 ? 'never' : min + ' minute' + (min === 1 ? '' : 's')}</b> without use and asks for the app PIN. Everyone uses the same PIN, set by the admin.${SBAuth.isAdmin() ? (r ? ` Last changed ${new Date(r.at || 0).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ' It is still the starting PIN (2015).') : ''}</div>
  <div class="actions"><button class="btn small" data-act="lk-now">🔒 Lock now</button>${(await Lock.canDevice()) ? (Lock.cred() ? '<button class="btn small" data-act="lk-devoff">Stop using this device\'s screen lock</button>' : '<button class="btn small" data-act="lk-devon">🔓 Unlock with this device\'s screen lock</button>') : ''}${SBAuth.isAdmin() ? '<button class="btn small" data-act="lk-change">Change the app PIN (everyone)</button>' : ''}</div>
  ${Lock.cred() ? '<div class="hint">This device\'s screen lock (fingerprint, face, PIN or pattern) unlocks the app; the app PIN works too.</div>' : ''}
  ${SBAuth.isAdmin() ? `<div class="f" style="margin-top:10px"><label for="lk-minsel">Lock after (everyone, admin only)</label><select id="lk-minsel" data-act="lk-min">${[1, 2, 5, 10, 15, 30, 60].map((v) => `<option value="${v}" ${min === v ? 'selected' : ''}>${v} minute${v === 1 ? '' : 's'}</option>`).join('')}</select></div>` : ''}`;
}
document.addEventListener('change', (e) => {
  if (e.target.dataset && e.target.dataset.act === 'lk-min' && SBAuth.isAdmin()) { D.settings.appLockMin = +e.target.value; touch(D.settings); save(); SupaSync.soon(); toast(`✓ The app now locks after ${e.target.value} minute${e.target.value === '1' ? '' : 's'} on every device`); const b = document.getElementById('lock-box'); if (b) fillLockBox(); }
});
document.addEventListener('click', async (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'lk-now') Lock.show();
  else if (a === 'lk-devon') { try { await Lock.addDevice(); toast('✓ This device\'s screen lock now unlocks the app'); } catch (x) { toast("The screen lock wasn't set up"); } const b = document.getElementById('lock-box'); if (b) fillLockBox(); }
  else if (a === 'lk-devoff') { Lock.setCred(null); toast('Screen lock unlock turned off on this device'); const b = document.getElementById('lock-box'); if (b) fillLockBox(); }
  else if (a === 'lk-change' && SBAuth.isAdmin()) {
    const ok = await askBox('Change the app PIN', `<div class="hint" style="margin-bottom:8px">This changes the PIN for everyone, on every device (after their next sync). 4 to 8 numbers.</div><div class="f"><label for="lk-1">New PIN</label><input id="lk-1" data-ask="p1" type="${PWT}" class="bvp-secret" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" inputmode="numeric" maxlength="8"></div><div class="f"><label for="lk-2">New PIN again</label><input id="lk-2" data-ask="p2" type="${PWT}" class="bvp-secret" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" inputmode="numeric" maxlength="8"></div>`, 'Change the PIN', false, 'Cancel');
    if (!ok) return; const p1 = ASK_FORM.p1 || '', p2 = ASK_FORM.p2 || '';
    if (!/^\d{4,8}$/.test(p1)) { toast('Use 4 to 8 numbers — the PIN was not changed'); return; }
    if (p1 !== p2) { toast("The two PINs don't match — the PIN was not changed"); return; }
    await Lock.setPin(p1); toast('✓ App PIN changed for everyone'); fillLockBox();
  }
  else if (a === 'adm-rmdev' && SBAuth.isAdmin()) {
    if (!(await ask(`Remove ${el.dataset.label} (${el.dataset.who})? The app and its copy of the data are wiped from it the next time it's online, and it will need a new code to sign in again.`, 'Yes — remove and wipe', true))) return;
    try { await rpc('remove_device', { k: Dev.k(), device_id: el.dataset.id }); toast('✓ Device removed — it wipes itself next time it goes online'); fillStaffBox(true); } catch (x) { toast(x.message); }
  } else if (a === 'adm-wipe' && SBAuth.isAdmin()) {
    if (!(await ask(`Wipe all of ${el.dataset.who}'s phones and computers? The app and its copy of the data are cleared from each one the next time it's online. They can sign in again with their password and a code.`, 'Yes — wipe them', true))) return;
    try { const n = await rpc('wipe_devices', { k: Dev.k(), staff_id_: el.dataset.id }); toast(`✓ ${n} device${n === 1 ? '' : 's'} will be wiped`); fillStaffBox(true); } catch (x) { toast(x.message); }
  } else if (a === 'adm-reset2' && SBAuth.isAdmin()) {
    if (!(await ask(`Reset ${el.dataset.who}'s two-step sign-in? Their devices are wiped and they set up their authenticator app again when they next sign in. Use this if they've lost or changed their phone.`, 'Yes — reset', true))) return;
    try { await rpc('reset_two_step', { k: Dev.k(), staff_id_: el.dataset.id }); toast('✓ Reset — they set it up again at their next sign-in'); fillStaffBox(true); } catch (x) { toast(x.message); }
  }
});
