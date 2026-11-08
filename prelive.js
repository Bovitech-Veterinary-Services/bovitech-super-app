/* Bovitech Super App — v2.28: before go-live.
   • Every setting is open to everyone (no admin-only sections or permissions) until go-live — just before then the app asks which to lock.
   • The testing pages (Scheduling, Records) are switched on for everyone.
   • Admin jobs "Set up: …" — one for each setting not done yet, with a go-there button and ✓ Done (they tick themselves off when the app can see it's done).
   • Client Scheduling: preg testing and bull testing details (frequency and type from lists — add your own — comments, "has not … before"). */
const PRE = { live: () => !!(typeof D !== 'undefined' && D && D.settings && D.settings.liveAt) || (navigator.webdriver && !window.PRELIVE_TEST) }; // automated tests check the go-live behaviour unless they ask for this
if (typeof setLocked === 'function') setLocked = (function (orig) { return function (title, devOnly) { return PRE.live() ? orig.apply(this, arguments) : false; }; })(setLocked);
if (typeof Bk !== 'undefined') Bk.can = (function (orig) { return function (p) { if (!PRE.live() && window.SBAuth && SBAuth.staff) return true; return orig.apply(this, arguments); }; })(Bk.can);
if (typeof needAdmin === 'function') needAdmin = (function (orig) { return function () { if (!PRE.live()) return true; return orig.apply(this, arguments); }; })(needAdmin);
(function () { const go = () => { try { if (PRE.live() || typeof PREF === 'undefined' || typeof savePref !== 'function') return; if (!PREF.testPagesOn1) { savePref('showBook', true); savePref('showRec', true); savePref('testPagesOn1', true); if (typeof renderAll === 'function') renderAll(); } if (typeof S !== 'undefined' && !S.admin) S.admin = true; } catch (e) { console.warn(e); } }; setTimeout(go, 1500); setInterval(go, 5000); })();
/* ---------- settings still to set up (admin job) ---------- */
function preTodo() { const out = []; const has = (fn) => { try { return !!fn(); } catch (e) { return false; } };
  const svcEdited = has(() => Bk.cfg('service').some((x) => x._u && x._u > 1792800000000 && (x.triage || x.edited)));
  [['Vehicle service providers', 'Settings → Scheduling → Vehicle service providers', () => typeof vehMechs === 'function' && vehMechs().length],
   ['Vehicles: where each is kept and what it can be booked for', 'Scheduling → Vehicles', () => typeof vehList === 'function' && vehList().some((v) => v.kept || Array.isArray(v.canDo))],
   ['Procedures: triage, speeds and set-up times checked', 'Settings → Scheduling → Procedures', () => svcEdited],
   ['Email templates checked', 'Settings → Templates', () => typeof crCfg === 'function' && crCfg('emltpls') && (crCfg('emltpls').list || []).some((t) => t._ed || t.edited)],
   ['SMS templates checked', 'Settings → Scheduling → SMS templates', () => Bk.cfg('sms').some((t) => t._u && t.edited)],
   ['Who goes on the on-call roster (📟 tick for each person)', 'Settings → Scheduling → People', () => Bk.list('bkcfg').some((x) => x.cfg === 'staff' && x.oncall != null)],
   ['Each person\'s hours, mobile and home GPS', 'Settings → Scheduling → People', () => Bk.people().every((p) => { const c = Bk.get('staff:' + p.id); return c && c.mobile; })],
   ['Who to book under — choices', 'Settings → Scheduling → Who to book under', () => Bk.cfg('bookunder').length >= 3],
   ['Bulk scheduling list dates', 'Settings → Scheduling → Bulk scheduling lists', () => Bk.cfg('bulk').some((l) => l._u && l.edited)],
   ['Vets\' signatures and registration numbers', 'Settings → Templates', () => typeof crCfg === 'function' && Object.keys((crCfg('sigs') || {}).vets || {}).length],
   ['Call sheet history loaded (bulk lists)', 'Scheduling → Bulk lists', () => !!Bk.get('bulkhist')],
   ['Booking info moved out of General info', 'Jobs', () => typeof ginfoJobs === 'function' && !ginfoJobs().length],
   ['Texts and emails — try them in 🧪 Test', 'Settings → Scheduling → Texts and emails before go-live', () => { const c = Bk.get('comms'); return c && (c.mode === 'test' || c.mode === 'live'); }]
  ].forEach(([t, where, ok]) => out.push({ t, where, done: has(ok) }));
  return out; }
/* one admin job for each setting still to set up — each with a go-there button and ✓ Done; the ones the app can see are done tick themselves off */
if (typeof SETUP !== 'undefined') preTodo().forEach((x, i) => { const id = 'set-' + x.t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); if (SETUP.some((y) => y.id === id)) return;
  SETUP.push({ id, t: 'Set up: ' + x.t, auto: () => { const it = preTodo().find((y) => y.t === x.t); return !!(it && it.done); }, get steps() { return [`Where: ${typeof goBtn === 'function' ? goBtn(x.where, x.where) : h(x.where)}`, 'Check it or set it up, then tap <b>✓ Done</b>. (If the app can see it\'s been done, this job ticks itself off.)']; } }); });
/* ---------- the lists for preg / bull testing details ---------- */
const PRE_LISTS = { listFreq: ['All animals, yearly', 'Yearly', 'Twice a year', 'Several times a year', 'Heifers only, yearly', 'Cows only, yearly', 'Every second year', 'Occasionally'], listPType: ['PNP', 'FA', 'FA heifers, PNP cows', 'FA and PNP', 'DP/NDP', 'Sometimes FA, sometimes PNP'], listBFreq: ['All bulls, yearly', 'Yearly', 'Twice a year', 'New bulls only', 'Every second year', 'Occasionally'] };
const preList = (k) => { const v = (D.settings || {})[k]; return Array.isArray(v) && v.length ? v : PRE_LISTS[k]; };
function preSel(id, k, cur) { const L = preList(k); const opts = [...L, ...(cur && !L.includes(cur) ? [cur] : [])]; return `<select id="${id}" data-prelist="${k}"><option value=""></option>${opts.map((o) => `<option ${o === cur ? 'selected' : ''}>${h(o)}</option>`).join('')}<option value="__new">➕ Add a new one…</option></select>`; }
document.addEventListener('change', async (e) => { const el = e.target; if (!el.dataset || !el.dataset.prelist || el.value !== '__new') return; const ok = await askBox('➕ Add to the list', `<div class="f"><input data-ask="v" style="width:100%;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px"></div>`, 'Add', false, 'Cancel'); const v = ok ? (ASK_FORM.v || '').trim() : '';
  if (!v) { el.value = ''; return; } const k = el.dataset.prelist; D.settings[k] = [...new Set([...preList(k), v])]; touch(D.settings); save(); if (window.Sync) Sync.soon(); el.insertAdjacentHTML('beforeend', ''); const o = document.createElement('option'); o.textContent = v; el.insertBefore(o, el.querySelector('option[value=__new]')); el.value = v; });
/* the client's Scheduling sheet: preg testing and bull testing details */
if (typeof bkBzHtml === 'function') bkBzHtml = (function (orig) { return function () { const html = orig.apply(this, arguments); const x = BZR || {}; const pg = x.preg || {}, bl = x.bull || {};
  return html + `<div class="card" style="margin-top:8px"><h3>🐄 Preg testing</h3><label class="bk-radio"><input type="checkbox" id="bz-pnew" ${pg.never ? 'checked' : ''}> Has not preg tested before</label><div class="grid2"><div class="f"><label for="bz-pfreq">Frequency</label>${preSel('bz-pfreq', 'listFreq', pg.freq || '')}</div><div class="f"><label for="bz-ptype">Type</label>${preSel('bz-ptype', 'listPType', pg.type || '')}</div></div><div class="f"><label for="bz-pcom">Comments</label><textarea id="bz-pcom" rows="2">${h(pg.comment || '')}</textarea></div></div>
    <div class="card"><h3>🐂 Bull testing</h3><label class="bk-radio"><input type="checkbox" id="bz-bnew" ${bl.never ? 'checked' : ''}> Has not bull tested before</label><div class="f"><label for="bz-bfreq">Frequency</label>${preSel('bz-bfreq', 'listBFreq', bl.freq || '')}</div><div class="f"><label for="bz-bcom">Comments</label><textarea id="bz-bcom" rows="2">${h(bl.comment || '')}</textarea></div></div>`; }; })(bkBzHtml);
if (typeof bkBzRead === 'function') bkBzRead = (function (orig) { return function () { const r = orig.apply(this, arguments); const g = (id) => document.getElementById(id); if (BZR && g('bz-pfreq')) { BZR.preg = { freq: g('bz-pfreq').value === '__new' ? '' : g('bz-pfreq').value, type: g('bz-ptype').value === '__new' ? '' : g('bz-ptype').value, comment: g('bz-pcom').value.trim(), never: g('bz-pnew').checked }; BZR.bull = { freq: g('bz-bfreq').value === '__new' ? '' : g('bz-bfreq').value, comment: g('bz-bcom').value.trim(), never: g('bz-bnew').checked }; } return r; }; })(bkBzRead);
if (typeof bkBschedOpen === 'function') bkBschedOpen = (function (orig) { return function (bid) { const r = orig.apply(this, arguments); if (typeof SHEET !== 'undefined' && SHEET && SHEET.onSave) { const os = SHEET.onSave; SHEET.onSave = async () => { bkBzRead(); const keep = { preg: BZR && BZR.preg, bull: BZR && BZR.bull }; const res = await os(); if (res !== false) { const rec = Bk.get('bsched:' + bid); if (rec) { if (keep.preg) rec.preg = keep.preg; if (keep.bull) rec.bull = keep.bull; touch(rec); } } return res; }; } return r; }; })(bkBschedOpen);
window.preTodo = preTodo; window.preSel = preSel; window.preList = preList;
/* ---------- no records or invoices from appointments until go-live — 🧪 a test shows what they'd be ---------- */
if (typeof crStart === 'function') crStart = (function (orig) { return function (o) { if (!o || !o.bk || PRE.live()) return orig.apply(this, arguments); preRecTest(o); }; })(crStart);
async function preRecTest(o) { let r, L = []; try { r = crNewRec(o); L = crBuildLines(r); } catch (e) { toast("Couldn't work it out: " + e.message); return; }
  const tt = typeof crInvTotals === 'function' ? crInvTotals({ lines: L }) : { total: 0, gst: 0 }; const b = o.bk;
  const procs = (r.procs || []).map((p) => { const t = typeof crTpl === 'function' ? crTpl(p.tpl) : null; return t ? t.name : p.tpl; });
  await askBox('🧪 Test — the record and invoice this appointment would make', `<p class="hint">Records and invoices aren't made from appointments until go-live. This is what it <b>would</b> make — nothing has been saved.</p>
    <p><b>${h(Bk.who(b))}</b> — ${h(Bk.type(b.type).name)} · ${bkDate(b.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
    <p><b>Record:</b> ${procs.length ? procs.map(h).join(', ') : 'no procedures'}${(r.patients || []).length ? ' · ' + r.patients.map((p) => h(p.name || p.value || '')).join(', ') : ''}${(r.staff || []).length ? ' · ' + r.staff.map(Bk.pname).join(', ') : ''}</p>
    <table class="ezy-t"><tr><th>Invoice line</th><th>Qty</th><th>Price</th></tr>${L.map((l) => `<tr><td>${h(l.desc || (crProd(l.prod) || {}).name || '')}</td><td>${l.qty}</td><td>${crMoney(l.price)}</td></tr>`).join('') || '<tr><td colspan="3">No lines</td></tr>'}<tr><td colspan="2"><b>Total (inc GST)</b></td><td><b>${crMoney(tt.total)}</b></td></tr></table>`, 'Close', false, ''); }
window.preRecTest = preRecTest;
