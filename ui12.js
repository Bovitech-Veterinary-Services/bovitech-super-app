/* Bovitech Super App — v2.49.
   • ⚡ Opens straight away: the app opens from this device's saved copy, then checks the internet in the background.
   • ⟳ New versions download in the background and wait — the page is never reloaded by itself. When one is ready, ⟳ lights up;
     tap it to switch (the page you're on comes back afterwards). If GitHub is still handing out the old version (it can take a
     few minutes after a release), ⟳ says so and keeps checking. Settings → App version → 🧹 Full reload is the old "start again".
   • The page you're on is kept if the app reloads (same session).
   • Settings → General → Start-up defaults (this device) → Open on: any page (Scheduling calendar, Day sheet, Records, Reports…).
   • Herd numbers job: numbers come from invoices (this app's and ezyVet's) first, then bookings, then call sheets.
   • Patient IDs: ✏️ Change ID on a herd / flock (unique across every business; records and bookings follow). */
const U12 = { ready: false, told: false, poll: null, ez: null, ezBusy: false, ezAt: 0, t0: Date.now() };
const U12_HAD_OPEN = /#open=/.test(location.hash || '');
const u12Mine = () => String(typeof APP_VERSION !== 'undefined' ? APP_VERSION : '').split(' ')[0];
const u12Cmp = (a, b) => { const x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

/* ---------- keep the page you're on across a reload ---------- */
function u12SaveView(reason) { try { if (!window.APP_READY) return; const g = (o, k) => (o && o[k] != null ? o[k] : null);
  const v = { at: Date.now(), reason: reason || '', tab: S.tab, sel: S.sel || null, setSub: S.setSub || null, lastCTab: S.lastCTab || null,
    bk: typeof BK !== 'undefined' ? { page: BK.page, date: BK.date, view: BK.view } : null, cr: typeof CR !== 'undefined' ? { page: CR.page, id: g(CR, 'id') } : null,
    tx: typeof TX !== 'undefined' ? { page: TX.page, open: TX.open } : null, u11: typeof U11 !== 'undefined' ? { page: U11.page, rep: U11.rep } : null,
    pt: typeof PT !== 'undefined' ? { sel: PT.sel || null } : null, y: window.scrollY, ls: ($('#list') || {}).scrollTop || 0, ds: ($('#detail') || {}).scrollTop || 0, detail: document.body.classList.contains('show-detail') };
  sessionStorage.setItem('bvp-view', JSON.stringify(v)); } catch (e) { } }
function u12ReadView() { try { const v = JSON.parse(sessionStorage.getItem('bvp-view') || 'null'); return v && Date.now() - v.at < 30 * 60 * 1000 ? v : null; } catch (e) { return null; } }
function u12RestoreView(v) { try {
  if (v.sel) { const ok = v.sel.kind === 'business' ? IDX.biz.get(v.sel.id) : D.contacts.find((c) => c.id === v.sel.id); if (!ok) v.sel = null; }
  S.tab = v.tab || S.tab; S.sel = v.sel; if (v.setSub) S.setSub = v.setSub; if (v.lastCTab) S.lastCTab = v.lastCTab;
  if (v.bk && typeof BK !== 'undefined') Object.assign(BK, { page: v.bk.page || BK.page, date: v.bk.date || BK.date, view: v.bk.view || BK.view });
  if (v.cr && typeof CR !== 'undefined') { CR.page = v.cr.page || CR.page; if (v.cr.id) CR.id = v.cr.id; }
  if (v.tx && typeof TX !== 'undefined') Object.assign(TX, { page: v.tx.page || TX.page, open: v.tx.open || null });
  if (v.u11 && typeof U11 !== 'undefined') Object.assign(U11, { page: v.u11.page || U11.page, rep: v.u11.rep || null });
  if (v.pt && typeof PT !== 'undefined') PT.sel = v.pt.sel || null;
  document.body.classList.toggle('show-detail', !!(v.detail && S.sel)); renderAll();
  const put = () => { const L = $('#list'), Dt = $('#detail'); if (L && v.ls) L.scrollTop = v.ls; if (Dt && v.ds) Dt.scrollTop = v.ds; if (v.y) window.scrollTo(0, v.y); }; requestAnimationFrame(put); setTimeout(put, 150); setTimeout(put, 600);
  return true; } catch (e) { console.warn(e); return false; } }
window.addEventListener('pagehide', () => u12SaveView('hide'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') u12SaveView('hide'); });
window.addEventListener('beforeunload', () => u12SaveView('unload'));

/* ---------- 🏠 the page this device opens on ---------- */
function u12Pages() { const L = []; const add = (v, l, grp) => L.push({ v, l, grp });
  (typeof CONTACT_TABS !== 'undefined' ? CONTACT_TABS : ['contacts', 'biz']).forEach((k) => add(k, lab(k) || k, lab('cmain') || 'Contacts'));
  if (typeof Bk !== 'undefined' && Bk.on()) (typeof BK_SUBS !== 'undefined' ? BK_SUBS : []).forEach(([k, l]) => add('b:' + k, l, lab('book') || 'Scheduling'));
  [...(typeof TX_SUBS !== 'undefined' ? TX_SUBS : []), ['queue', 'Daily queue']].forEach(([k, l]) => { if (!L.some((x) => x.v === 't:' + k)) add('t:' + k, l, lab('texts') || 'Communications'); });
  if (typeof crOn === 'function' && crOn() && typeof CR_SUBS !== 'undefined') CR_SUBS.forEach(([k, l]) => add('r:' + k, l, lab('rec') || 'Records'));
  if (typeof U11 !== 'undefined') { add('u11:reports', '📊 Reports', 'Reports'); add('u11:xero', '🔗 Xero', 'Reports'); add('u11:help', '❓ Help', 'Help'); }
  (typeof SET_SUBS !== 'undefined' ? SET_SUBS : []).forEach(([k]) => add('s:' + k, typeof setSubName === 'function' ? setSubName(k) : k, lab('settings') || 'Settings'));
  return L; }
function u12Go(v) { if (!v) return false; const [a, b] = String(v).split(':');
  if (!b) { if (a === 'map') S.tab = 'route'; else S.tab = a; }
  else if (a === 'b') { S.tab = 'book'; if (typeof BK !== 'undefined') BK.page = b; }
  else if (a === 't') { S.tab = 'texts'; if (typeof TX !== 'undefined') { TX.page = b; TX.open = null; } }
  else if (a === 'r') { S.tab = 'rec'; if (typeof CR !== 'undefined') CR.page = b; }
  else if (a === 'u11') { S.tab = 'u11'; if (typeof U11 !== 'undefined') { U11.page = b; U11.rep = null; } }
  else if (a === 's') { S.tab = 'settings'; S.setSub = b; S.setQ = ''; }
  else return false;
  S.sel = null; document.body.classList.remove('show-detail'); renderAll(); window.scrollTo(0, 0); return true; }
function u12StartSelect() { const cur = PREF.tab || 'contacts'; const P = u12Pages(); const grps = [...new Set(P.map((x) => x.grp))];
  const known = P.some((x) => x.v === cur);
  return `<select data-u12start aria-label="Open on">${!known ? `<option value="${h(cur)}" selected>${h(cur)}</option>` : ''}${grps.map((g) => `<optgroup label="${h(g)}">${P.filter((x) => x.grp === g).map((x) => `<option value="${h(x.v)}" ${x.v === cur ? 'selected' : ''}>${h(x.l)}</option>`).join('')}</optgroup>`).join('')}</select>`; }
document.addEventListener('change', async (e) => { const el = e.target; if (!el || !el.matches || !el.matches('[data-u12start]')) return; e.stopPropagation();
  const v = el.value, was = PREF.tab || 'contacts'; const nm = (u12Pages().find((x) => x.v === v) || { l: v }).l;
  if (!(await ask(`Open the app on "${nm}" on this device from now on?`, 'Yes — open on ' + nm))) { el.value = was; return; }
  savePref('tab', v); toast('Saved for this device — the app opens on ' + nm, 'info'); }, true);
if (typeof renderSettings === 'function') renderSettings = (function (orig) { return function () { let html = orig.apply(this, arguments);
  html = html.replace(/<select data-pref="tab">[\s\S]*?<\/select>/, () => u12StartSelect());
  html = html.replace(/(<h3>App version<\/h3>)/, '$1<div class="actions" style="margin:0 0 6px"><button class="btn small" data-act="u12-hard">🧹 Full reload</button><span class="hint">Only if ⟳ doesn\'t help — clears this device\'s saved copy of the app (not your data) and downloads it all again.</span></div>');
  return html; }; })(renderSettings);

/* first opening: the page you were on (after a reload), else this device's start page */
(function u12Boot() { if (!window.APP_READY) { setTimeout(u12Boot, 40); return; }
  const v = u12ReadView(); if (v && !U12_HAD_OPEN) { u12RestoreView(v); return; }
  if (!U12_HAD_OPEN && PREF.tab && String(PREF.tab).includes(':')) u12Go(PREF.tab); })();

/* ---------- ⟳ updates without surprise reloads ---------- */
function u12Btn() { return document.querySelector('header [data-act=app-refresh]'); }
function u12Light() { const b = u12Btn(); if (!b || !U12.ready) return; b.classList.add('update'); b.title = 'A new version is ready — tap to update'; b.innerHTML = `⟳ <b>v${h(u12Mine())}</b><span> → new version ready</span>`; }
function u12Ready() { U12.ready = true; u12Light(); if (!U12.told) { U12.told = true; toast('New version ready — tap ⟳ to update', 'info'); } if (U12.poll) { clearInterval(U12.poll); U12.poll = null; } }
if (typeof checkLatest === 'function') checkLatest = (function (orig) { return async function () { const r = await orig.apply(this, arguments); if (U12.ready) u12Light(); return r; }; })(checkLatest);
async function u12Reg() { try { return navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null; } catch (e) { return null; } }
function u12Watch(reg) { if (!reg || reg.u12w) return; reg.u12w = true;
  const chk = () => { if (reg.waiting && navigator.serviceWorker.controller) u12Ready(); };
  reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') chk(); }); }); chk(); }
(async function u12SwInit() { if (window.SEED || !('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return; if (!window.APP_READY) { setTimeout(u12SwInit, 300); return; }
  const reg = await u12Reg(); if (reg) u12Watch(reg); setInterval(async () => { const r = await u12Reg(); if (r) { u12Watch(r); try { await r.update(); } catch (e) { } } }, 30 * 60 * 1000); })();
function u12WaitInstalled(reg, ms) { return new Promise((res) => { const end = Date.now() + ms; const tick = () => { if (reg.waiting) return res(reg.waiting); if (Date.now() > end) return res(null); setTimeout(tick, 500); }; tick(); }); }
function u12Activate(reg) { u12SaveView('update'); window.BVP_WANT_RELOAD = true; toast('Updating…', 'info'); try { reg.waiting.postMessage('skip'); } catch (e) { } setTimeout(() => location.reload(), 4000); }
const u12Hard = typeof refreshApp === 'function' ? refreshApp : null;
refreshApp = async function () {
  if (window.SEED || !('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return u12Hard && u12Hard();
  const reg = await u12Reg(); if (!reg) return u12Hard && u12Hard();
  u12Watch(reg); if (reg.waiting) return u12Activate(reg);
  if (typeof OFFMODE !== 'undefined' && OFFMODE.real && !OFFMODE.real()) { toast("You're offline — can't check for a newer version right now"); return; }
  toast('Checking for a new version…', 'info'); try { await reg.update(); } catch (e) { }
  const w = await u12WaitInstalled(reg, 20000); if (w) return u12Activate(reg);
  let latest = ''; try { latest = (await (await fetch('version.json?t=' + Date.now(), { cache: 'no-store' })).json()).version || ''; } catch (e) { }
  if (!latest || u12Cmp(latest, u12Mine()) <= 0) { toast(`✓ You're on the latest version (v${u12Mine()})`, 'info'); return; }
  toast(`Version ${latest} is still reaching the server — it can take a few minutes after a release. Keep working: ⟳ lights up when it's ready.`, 'warn');
  if (U12.poll) clearInterval(U12.poll); let n = 0; U12.poll = setInterval(async () => { n++; try { await reg.update(); } catch (e) { } if (reg.waiting) u12Ready(); else if (n >= 15) { clearInterval(U12.poll); U12.poll = null; } }, 60000); };
window.refreshApp = refreshApp;
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=u12-hard]'); if (!el) return; e.stopPropagation();
  if (!(await ask('Clear this device\'s saved copy of the app and download it all again?\n\nYour data stays — it\'s only the app itself. Use this only if ⟳ hasn\'t worked.', '🧹 Yes — full reload'))) return; u12SaveView('update'); if (u12Hard) u12Hard(); }, true);

/* ---------- 🐄 Herd numbers: invoices first, then bookings, then call sheets ---------- */
const U12_RANK = { invoice: 3, 'ezyVet invoice': 3, booking: 2, bookings: 2, 'call sheet': 1 };
function u12HerdKind(desc, prod) { const d = String(desc || '');
  if (/set ?-?up|wash ?down|consum|certif|travel|labour|kit|medication|per hour|\/hr\b/i.test(d)) return null;
  if (prod === 'p-pd-head' || (/\bPD\b|preg/i.test(d) && /per head|per hd|\/hd\b/i.test(d))) return 'f';
  if (prod === 'p-bbse' || (/\bBBSE\b|bull.*(test|soundness|breeding)/i.test(d) && /per head|per hd|\/hd\b/i.test(d))) return 'b';
  return null; }
function u12EzLoad() { if (U12.ez || U12.ezBusy || typeof rpc !== 'function' || !navigator.onLine || !window.APP_READY || typeof Dev === 'undefined') return;
  if (Date.now() - U12.t0 < 12000) { setTimeout(u12EzLoad, 12000 - (Date.now() - U12.t0)); return; } /* let the app finish opening first */
  if (Date.now() - U12.ezAt < 5 * 60 * 1000) return; U12.ezBusy = true; U12.ezAt = Date.now();
  const ids = [...new Set((D.businesses || []).filter((b) => !b.gone).flatMap((b) => b.ezyIds || []).filter(Boolean))];
  const M = new Map(); const get = async (chunk) => { const rows = (await rpc('ezy_list', { k: Dev.k(), contacts: chunk, animals: null, kinds: ['invoice'], lim: 3000 })) || [];
    if (rows.length >= 3000 && chunk.length > 1) { const m = Math.ceil(chunk.length / 2); await get(chunk.slice(0, m)); await get(chunk.slice(m)); return; } rows.forEach((r) => { if (!M.has(r.contact_id)) M.set(r.contact_id, []); M.get(r.contact_id).push(r); }); };
  (async () => { try { for (let i = 0; i < ids.length; i += 40) await get(ids.slice(i, i + 40)); U12.ez = M; if (typeof HERD_PL !== 'undefined') HERD_PL.L = null; if (typeof JOBS_CACHE !== 'undefined') JOBS_CACHE = null; if (S.tab === 'jobs' && !SHEET) renderAll(); }
    catch (e) { console.warn('herd: ezyVet invoices', e); } finally { U12.ezBusy = false; } })(); }
if (typeof herdYears === 'function') herdYears = function (bid, pval, one) { const y0 = +bkToday().slice(0, 4) - 8; const Y = {};
  const put = (y, k, v, src) => { if (!v || y < y0) return; Y[y] = Y[y] || { f: 0, b: 0, src: {} }; const cur = Y[y].src[k]; const rn = U12_RANK[src] || 0, rc = cur ? U12_RANK[cur] || 0 : -1; if (rn > rc || (rn === rc && v > Y[y][k])) { Y[y][k] = v; Y[y].src[k] = src; } };
  const b = IDX.biz.get(bid); const pe = b && (b.patientIds || []).find((q) => String(q.value) === String(pval)); const ezAnimals = new Set(pe ? [pe.ezyId, ...(pe.ezyIds || [])].filter(Boolean).map(String) : []);
  /* 1. this app's invoices (from records) */ const inv = {};
  if (typeof crList === 'function') crList('crinv').filter((x) => !x.gone && x.bid === bid && x.date && !/declined/i.test(x.status || '')).forEach((x) => { const r = typeof crGet === 'function' && x.rec ? crGet('crrec', x.rec) : null;
    if (!one && r && (r.patients || []).some((p) => p.pid) && !(r.patients || []).some((p) => String(p.pid) === String(pval))) return; const y = +x.date.slice(0, 4);
    (x.lines || []).forEach((l) => { const k = u12HerdKind(l.desc, l.prod); if (k && +l.qty > 0 && +l.qty < 9999) inv[y + k] = (inv[y + k] || 0) + (+l.qty || 0); }); });
  Object.entries(inv).forEach(([yk, v]) => put(+yk.slice(0, 4), yk.slice(4), v, 'invoice'));
  /* 2. ezyVet's invoices */ if (b && (b.ezyIds || []).length) { if (!U12.ez) u12EzLoad(); else { const ez = {};
    (b.ezyIds || []).forEach((cid) => (U12.ez.get(cid) || []).forEach((r) => { const d = r.data || {}; if (!r.d || /declined/i.test(d.status || d.title || '')) return; if (!one && r.animal_id && ezAnimals.size && !ezAnimals.has(String(r.animal_id))) return;
      const y = +String(r.d).slice(0, 4); (d.lines || []).forEach((l) => { const k = u12HerdKind(l.d, null); if (k && +l.q > 0 && +l.q < 9999) ez[y + k] = (ez[y + k] || 0) + (+l.q || 0); }); }));
    Object.entries(ez).forEach(([yk, v]) => put(+yk.slice(0, 4), yk.slice(4), v, 'ezyVet invoice')); } }
  /* 3. bookings */ const byYr = {}; (typeof HERD_BKIDX !== 'undefined' && HERD_BKIDX ? HERD_BKIDX.get(bid) || [] : Bk.list('bookings').filter((x) => x.bid === bid)).filter((x) => Bk.live(x) && x.date <= bkToday() && (one || !(x.pids || []).length || (x.pids || []).some((q) => String(q.value) === String(pval))))
    .forEach((x) => (x.svcs || []).forEach((s) => { const k = s.svc === 'svc-preg' ? 'f' : s.svc === 'svc-bull' ? 'b' : null; if (!k || !s.head) return; const y = +x.date.slice(0, 4); byYr[y + k] = (byYr[y + k] || 0) + (+s.head || 0); }));
  Object.entries(byYr).forEach(([yk, v]) => put(+yk.slice(0, 4), yk.slice(4), v, 'booking'));
  /* 4. the old call sheets */ const hi = (Bk.bsched(bid).hist) || {}; Object.entries((hi.pd || {}).years || {}).forEach(([y, x]) => put(+y, 'f', (x.cows || 0) + (x.heifers || 0), 'call sheet')); Object.entries((hi.bbse || {}).years || {}).forEach(([y, x]) => put(+y, 'b', x.bulls || 0, 'call sheet'));
  return Y; };

/* ---------- ✏️ patient (herd / flock) IDs: editable, unique across every business ---------- */
function u12PidTaken(v, exceptEnt) { const lv = String(v).trim().toLowerCase(); let hit = null;
  (D.businesses || []).forEach((b) => { if (b.gone) return; (b.patientIds || []).forEach((p) => { if (!p || p === exceptEnt) return; if (String(p.value).toLowerCase() === lv || (p.aka || []).some((a) => String(a.v).toLowerCase() === lv)) hit = hit || { b, p }; }); }); return hit; }
function u12PidRefs(b, oldV, newV) { let n = 0; if (String(oldV) === String(newV)) return 0;
  if (typeof crList === 'function') crList('crrec').forEach((r) => { if (r.bid !== b.id) return; let ch = false; (r.patients || []).forEach((x) => { if (String(x.pid) === String(oldV)) { x.pid = newV; ch = true; } }); if (ch) { touch(r); n++; } });
  if (typeof Bk !== 'undefined') Bk.list('bookings').forEach((x) => { if (x.bid !== b.id) return; let ch = false; (x.pids || []).forEach((q) => { if (String(q.value) === String(oldV)) { q.value = newV; ch = true; } }); if (ch) { touch(x); n++; } });
  if (typeof PT !== 'undefined' && PT.sel === b.id + '|' + oldV) PT.sel = b.id + '|' + newV;
  if (D.settings && (D.settings.ptGone || []).includes(String(newV))) { D.settings.ptGone = D.settings.ptGone.filter((x) => x !== String(newV)); touch(D.settings); }
  if (typeof HERD_PL !== 'undefined') HERD_PL.L = null; if (typeof JOBS_CACHE !== 'undefined') JOBS_CACHE = null; return n; }
window.u12PidTaken = u12PidTaken; window.u12PidRefs = u12PidRefs;
async function u12PidRename(key) { const p = ptAll().find((x) => x.key === key); if (!p) return; const ent = (p.b.patientIds || []).find((q) => String(q.value) === String(p.value)); if (!ent) return;
  const ok = await askBox('✏️ Change the ID — ' + p.value, `<div class="f"><label>New patient ID</label><input data-ask="v" value="${h(p.value)}" autocomplete="off" style="width:100%;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px" aria-label="New patient ID"></div><div class="hint">It must be different from every other herd and flock, on any business. Records and bookings for ${h(p.b.name)} move to the new ID.</div>`, 'Next');
  if (!ok) return; const v = String(ASK_FORM.v || '').trim(); if (!v) { toast('Type the new patient ID'); return; } if (v === String(p.value)) return;
  const t = u12PidTaken(v, ent); if (t) { toast(`${v} is already used by ${t.b.name}${t.p.value !== v ? ' (merged into ' + t.p.value + ')' : ''} — patient IDs must be unique`, 'warn'); return; }
  if (!(await ask(`Change ${p.value} to ${v}?\n\nIts records and bookings move to ${v}. You can undo it from Settings → Change log.`, 'Yes — change the ID'))) return;
  const old = ent.value; ent.value = v; ent.aka = [...(ent.aka || []), { v: old, bid: p.b.id, label: ent.label || '', why: 'ID changed', at: Date.now(), by: typeof myInitials === 'function' ? myInitials() : '' }]; touch(p.b);
  const n = u12PidRefs(p.b, old, v); if (typeof NEXT_LOG_LABEL !== 'undefined') NEXT_LOG_LABEL = `Patient ID changed: ${old} → ${v} (${p.b.name})`; save(); if (typeof SupaSync !== 'undefined' && SupaSync.soon) SupaSync.soon();
  toast(`✓ ${old} is now ${v}${n ? ` — ${n} record${n === 1 ? '' : 's'} / booking${n === 1 ? '' : 's'} updated` : ''}`, 'info'); renderAll(); }
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=u12-pidedit]'); if (!el) return; e.stopPropagation(); u12PidRename(el.dataset.k); }, true);
if (typeof ptDetail === 'function') ptDetail = (function (orig) { return function (p) { const html = orig.apply(this, arguments); return html.replace(/(<button class="btn small" data-act="pt-merge" data-k="[^"]*">⇄ Merge with…<\/button>)/, `<button class="btn small" data-act="u12-pidedit" data-k="${h(p.key)}">✏️ Change ID</button>$1`); }; })(ptDetail);
/* adding a patient: the ID must be unique across every business (it was only checked on the one business) */
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('#askbox [data-act=ask-yes]'); if (!el) return; const box = el.closest('#askbox'); if (!box || !/Add a patient/.test(box.textContent || '')) return;
  const i = box.querySelector('[data-ask=v]'); if (!i) return; const v = i.value.trim(); if (!v) return; const t = u12PidTaken(v, null); if (t) { e.stopPropagation(); e.preventDefault(); toast(`${v} is already used by ${t.b.name} — patient IDs must be unique. Try ${typeof ptNextId === 'function' ? ptNextId() : 'another ID'}.`, 'warn'); i.focus(); } }, true);
/* the business edit form: a changed ID must be unique, and its records and bookings follow it */
if (typeof pidMerge === 'function') pidMerge = (function (orig) { return function (old, rows) { const bid = S.sel && S.sel.kind === 'business' ? S.sel.id : null; const b = bid && IDX.biz.get(bid);
  const seen = new Set(); rows = rows.map((r, i) => { const v = String(r.value || '').trim(); const mine = (old || []).find((x) => String(x.value) === v); const t = v && !mine ? u12PidTaken(v, old[i] && !rows.some((y) => String(y.value) === String(old[i].value)) ? old[i] : null) : null;
    if (v && (seen.has(v.toLowerCase()) || (t && !(old || []).includes(t.p)))) { toast(`${v} is already used${t ? ' by ' + t.b.name : ''} — patient IDs must be unique, so it wasn't changed`, 'warn'); const back = old[i] && !rows.some((y) => String(y.value) === String(old[i].value)) ? old[i].value : ''; return { ...r, value: back }; }
    seen.add(v.toLowerCase()); return r; }).filter((r) => String(r.value || '').trim());
  const out = orig.call(this, old, rows);
  if (b) (old || []).forEach((o, i) => { const n = out[i]; if (n && String(n.value) !== String(o.value) && !out.some((y) => String(y.value) === String(o.value)) && (n.ezyId || null) === (o.ezyId || null)) u12PidRefs(b, o.value, n.value); });
  return out; }; })(pidMerge);

/* ---------- admin check jobs ---------- */
const U12_CHECKS = [
  ['chk250-herd2025', 'Check: 🐄 herd numbers use 2025', 'Jobs → "Herd numbers from preg / bull testing": the table marks the year used (← used) — 2025, or the most recent year before it when there\'s no 2025 data. Tap ✓ Make this change, then open that herd: a blue ℹ️ note says the numbers were filled in automatically. Tap ✏️, change the number of female breeders or bulls and save — the note goes. (Saving without changing the numbers keeps it.)', 'jobs'],
  ['chk250-labref', 'Check: 🧪 lab request numbers never double up', 'Records → Lab requests: every request has its own number (BV-DR…). If two devices ever give out the same number at the same time, the newer request gets the next free number and shows "(was BV-DR…)".', 'r:labreq'],
  ['chk250-formerly', 'Check: 🔎 old business names are found', 'Search a business by an old name from a joined business (⇄ Merge → Two businesses joining) with the search set to names only — it still finds the business.', 'biz'],
  ['chk249-open', 'Check: ⚡ the app opens quickly', 'Close the app completely and open it again (try somewhere with poor reception) — it should open straight away, without waiting for the internet.', 'u12:home'],
  ['chk249-noreload', 'Check: no surprise refresh', 'Open a business or a record and leave it there for a minute after opening the app — the page should stay put (it used to refresh itself a few seconds after opening).', 'u12:home'],
  ['chk249-update', 'Check: ⟳ updating', 'Next time a new version comes out, ⟳ at the top lights up with "new version ready". Tap it — the app updates and comes back to the page you were on. If it says the version is "still reaching the server", wait a few minutes.', 'u12:version'],
  ['chk249-start', 'Check: 🏠 the page this device opens on', 'Settings → General → Start-up defaults (this device) → Open on: choose e.g. Scheduling → Calendar. Close the app and open it again — it opens there.', 'u12:start'],
  ['chk249-herd', 'Check: 🐄 herd numbers from invoices', 'Jobs → "Herd numbers from preg / bull testing": each year\'s numbers now say where they came from — invoice, ezyVet invoice, booking or call sheet (invoices win).', 'jobs'],
  ['chk249-pid', 'Check: ✏️ changing a patient ID', 'Open a herd (Patients) → ✏️ Change ID. Try an ID another business already has — it should refuse. Then change it to a new one: its records and bookings follow.', 'pat'],
  ['chk249-pidnew', 'Check: 6-digit patient IDs', 'On a business, ➕ Add a patient — the suggested ID is 6 digits, one more than the highest in use. You can change it, but not to one that is already used.', 'biz']];
if (typeof u8Go === 'function') u8Go = (function (orig) { return function (k) { if (typeof k === 'string' && k.startsWith('u12:')) { if (typeof SHEET !== 'undefined' && SHEET) closeSheet(); const w = k.slice(4);
    if (w === 'start' || w === 'version') { S.tab = 'settings'; S.setSub = 'general'; S.setQ = ''; S.sel = null; renderAll(); setTimeout(() => { const t = [...document.querySelectorAll('details.setsec')].find((d) => (w === 'start' ? /Start-up defaults/ : /App version/).test(d.textContent || '')); if (t) { t.open = true; t.scrollIntoView({ block: 'start' }); } }, 120); return; }
    u12Go(PREF.tab || 'contacts'); return; }
  if (k === 'pat' || k === 'jobs' || k === 'biz' || k === 'r:labreq') { if (typeof SHEET !== 'undefined' && SHEET) closeSheet(); u12Go(k); return; } return orig.apply(this, arguments); }; })(u8Go);
if (typeof SETUP !== 'undefined' && typeof U8_TRY !== 'undefined') U12_CHECKS.forEach(([id, t, tryIt, go]) => { U8_TRY[id] = tryIt; U8_TO[id] = go; if (SETUP.some((x) => x.id === id)) return; SETUP.push({ id, t, steps: [tryIt, `<button type="button" class="btn small" data-act="u8-go" data-go="${go}">➡️ Take me there</button>`, 'If it does what you want, tick <b>✓ Done</b>. If not, tell Claude what\'s wrong.'] }); });
