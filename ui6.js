/* Bovitech Super App — v2.43.
   • ⟳ Update: the app and the version file agree again (a version number had gone backwards, so the button thought it was up to date).
   • Opening screen says the same name as the top of the app ("Hi admin").
   • Records: farms visited can be added on any record (the business's farms, or 🔎 any farm); travel discount 0% / 25% / 50% / 100%;
     in-house and phone appointments default to no travel; a "Shared on-farm" appointment type (50% travel).
   • A record made without an appointment puts an appointment on the calendar (and keeps it matching the record).
   • Patients: only the business's real patients; one patient for the whole record, or several (then each procedure says which);
     ➕ Create new patient right on the record, with the next patient ID suggested.
   • The formatting bar stays at the top of the record, under Find in record.
   • Before go-live: "Start a record from an appointment" and Scheduling → Jobs stay empty. */
(function () { const st = document.createElement('style'); st.textContent = [
  '.cr-optfull{font-size:13px;color:var(--mut,#555);margin-top:3px;white-space:normal;overflow-wrap:anywhere}',
  '.cr-proc select,.cr-edit .f select{max-width:100%;width:100%;text-overflow:ellipsis}',
  '.ezy-top.cr-topbar{top:-16px;z-index:25;flex-wrap:wrap}.ezy-top.cr-topbar > .rt-gbar{flex:1 1 100%;position:static;margin:2px 0 0}',
  '.gl-wait{padding:10px 12px;border-radius:9px;background:var(--bg2,#f3f4f1);color:var(--mut,#555);font-size:14px}'].join(''); document.head.appendChild(st); })();
const U6 = {};
/* ---------- go-live ---------- */
const u6Live = () => (typeof PRE !== 'undefined' && PRE.live ? PRE.live() : true);
/* ---------- ⟳ Update: only chase a version that is really newer ---------- */
const u6Ver = (x) => String(x || '').split('.').map(Number);
const u6Newer = (a, b) => { const x = u6Ver(a), y = u6Ver(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
(function () { let u = null; try { u = JSON.parse(sessionStorage.getItem('bvp-upd') || 'null'); } catch (e) { } if (u && u.want && !u6Newer(u.want, APP_VERSION.split(' ')[0])) { try { sessionStorage.setItem('bvp-upd', JSON.stringify({ ...u, want: APP_VERSION.split(' ')[0] })); } catch (e) { } } })();
/* ---------- "Hi …" on the opening screen = the name at the top ---------- */
if (typeof updHi === 'function') updHi = (function (orig) { return function () { const r = orig.apply(this, arguments); try { const el = document.getElementById('hi'); const n = el && el.textContent.replace(/^Hi\s+/, '').trim(); const st = window.SBAuth && SBAuth.staff; if (el && st && st.role === 'admin' && (!n || /^office$/i.test(n))) { el.textContent = 'Hi Admin'; localStorage.setItem('bvp-hi', 'Admin'); } else if (n) localStorage.setItem('bvp-hi', n); } catch (e) { } return r; }; })(updHi);
/* ---------- appointment type: Shared on-farm (50% travel) — added once, safe to run again ---------- */
function u6SharedType() { if (typeof Bk === 'undefined' || !Bk.cfg || !Bk.cfg('type').length) return; if (Bk.get('type-sharedfarm') || Bk.cfg('type').some((t) => /shar(e|ed)\b.*farm/i.test(t.name || ''))) return;
  const base = Bk.get('type-farm') || Bk.cfg('type').find((t) => t.where === 'farm'); const who = {}; Bk.people().forEach((p) => { who[p.id] = true; });
  const r = { id: 'type-sharedfarm', cfg: 'type', name: 'Shared on-farm', colour: '#5b8c3a', where: 'farm', fixedMins: null, who: base && base.who ? bkClone(base.who) : who, travelPct: 50, order: 2 }; touch(r); D.bkcfg.push(r); save(); if (window.Sync) Sync.soon(); }
/* ---------- a record made without an appointment goes on the calendar ---------- */
function u6RecBk(r) { if (!r || typeof Bk === 'undefined' || !Bk.list) return; const L = Bk.list('bookings'); let b = r.bkId ? L.find((x) => x.id === r.bkId) : null;
  if (b && b.fromRec !== r.id) return; /* a real appointment — the record only marks it completed when finalised */
  if (r.gone) { if (b && !b.gone) { b.gone = true; touch(b); } return; }
  if (!r.date || !r.start) return; const s = crMins(r.start), e = crMins(r.end); const mins = s != null && e != null && e > s ? e - s : 60;
  const want = { type: r.type, bid: r.bid || null, cid: r.cid || null, date: r.date, start: r.start, mins, staff: [...(r.staff || [])], stops: bkClone(r.stops || []) };
  if (!b) { b = { id: uid('bk'), status: r.status === 'final' ? 'done' : 'confirmed', svcs: [{ staff: [...(r.staff || [])] }], sms: { send: false, noReminder: true }, notes: 'Made from the clinical record', fromRec: r.id, ...want }; touch(b); L.push(b); r.bkId = b.id; touch(r); return; }
  const diff = Object.keys(want).some((k) => JSON.stringify(b[k] == null ? null : b[k]) !== JSON.stringify(want[k] == null ? null : want[k])); if (diff) { Object.assign(b, want); if (!(b.svcs || []).length) b.svcs = [{ staff: [...want.staff] }]; touch(b); } }
if (typeof crInvSync === 'function') crInvSync = (function (orig) { return function (r) { const res = orig.apply(this, arguments); try { u6RecBk(r); } catch (e) { console.warn(e); } return res; }; })(crInvSync);
function u6RecBkSweep() { if (typeof Bk === 'undefined' || !Bk.list || typeof crList !== 'function') return; let ch = false; Bk.list('bookings').forEach((b) => { if (!b.fromRec || b.gone) return; const r = crGet('crrec', b.fromRec); if (!r || r.gone) { b.gone = true; touch(b); ch = true; } }); if (ch) { save(); if (window.Sync) Sync.soon(); } }
/* ---------- 🔎 another farm (not linked to this business) ---------- */
document.addEventListener('change', async (e) => { const t = e.target; if (t.id !== 'cr-addfarm' || t.value !== '__other') return; e.stopImmediatePropagation(); t.value = ''; const r = crGet('crrec', CR.id); if (!r) return;
  const all = [...IDX.farms.values()].filter((f) => !f.gone).sort((a, b) => (a.name || a.address || '').localeCompare(b.name || b.address || ''));
  /* v2.51: who owns (or uses) each farm shows too, and their name finds the farm */ const own = {}; (D.businesses || []).forEach((b) => { if (b.gone) return; (typeof bkFarmsOf === 'function' ? bkFarmsOf(b.id) : []).forEach((f) => { (own[f.id] = own[f.id] || []).push(b); }); });
  const list = (q) => { if (!q) return '<div class="hint">Start typing the farm name, its address or who owns it.</div>'; const L = all.filter((f) => ((f.name || '') + ' ' + (f.address || '') + ' ' + (own[f.id] || []).map((b) => b.name).join(' ')).toLowerCase().includes(q)).slice(0, 40); return L.map((f) => `<div class="kv bk-tap" data-act="u6-farm" data-id="${f.id}"><div class="v"><b>${h(f.name || 'Farm')}</b>${(own[f.id] || []).length ? `<div>Owner: ${own[f.id].map((b) => `<a href="#" class="golink" data-act="u13-bizlink" data-id="${b.id}">${h(b.name)}</a>`).join(', ')}</div>` : '<div class="hint">No business linked</div>'}${f.address ? `<div class="hint">${h(f.address)}</div>` : ''}</div></div>`).join('') || '<div class="hint">No farms match.</div>'; };
  openSheet('➕ Add a farm visited', `<div class="search"><input id="u6-fq" type="search" placeholder="Search farms or owners" autocomplete="off" aria-label="Search farms"></div><div id="u6-fl" style="margin-top:6px">${list('')}</div>`, () => true);
  const sv = document.getElementById('sheet-save'); if (sv) sv.textContent = 'Close'; const sh = document.getElementById('sheet');
  sh.addEventListener('input', (ev) => { if (ev.target.id === 'u6-fq') document.getElementById('u6-fl').innerHTML = list(ev.target.value.toLowerCase().trim()); });
  sh.addEventListener('click', (ev) => { const el = ev.target.closest('[data-act=u6-farm]'); if (!el) return; const f = IDX.farms.get(el.dataset.id); const r2 = crGet('crrec', CR.id); if (!f || !r2) return; const ys = typeof bkYardsOf === 'function' ? bkYardsOf(f) : []; r2.stops = [...(r2.stops || []), { fid: f.id, yid: ys[0] ? ys[0].yid : null }]; r2.routeOk = false; closeSheet(); crSave(r2); crInvSync(r2); Sync.soon(); renderAll(); });
  setTimeout(() => { const q = document.getElementById('u6-fq'); if (q) q.focus(); }, 50); }, true);
/* ---------- patients on the record ---------- */
function u6Herd(p) { return { id: uid('pt'), level: 'herd', pid: p.value, plabel: p.label || '', species: p.species === 'sheep' || (!p.species && /sheep|flock|ovine/i.test(p.label || '')) ? 'sheep' : 'cattle' }; }
function u6Fin(r) { crSave(r); crInvSync(r); Sync.soon(); renderAll(); }
function u6SetOne(r, val) { const p0 = crBizPats(r.bid).find((x) => String(x.value) === String(val)); if (!p0) return; const keep = (r.patients || []).filter((p) => p.level !== 'herd' && String(p.pid) === String(val)); const hd = (r.patients || []).find((p) => p.level === 'herd' && String(p.pid) === String(val)) || u6Herd(p0);
  r.patients = [hd, ...keep]; r.patMode = 'one'; (r.procs || []).forEach((pr) => { pr.pat = hd.id; }); }
document.addEventListener('change', (e) => { const t = e.target; if (!t.dataset || !(t.dataset.crpmode || t.dataset.crpat1 || t.dataset.crpatm)) return; if (typeof CR === 'undefined' || CR.page !== 'edit') return; const r = crGet('crrec', CR.id); if (!r || r.status === 'final') return;
  if (t.dataset.crpmode) { r.patMode = t.dataset.crpmode; const herds = (r.patients || []).filter((p) => p.level === 'herd' && crPatReal(r, p)); if (r.patMode === 'one' && herds.length > 1) { u6SetOne(r, herds[0].pid); toast('Kept ' + crPatName(r, r.patients[0].id).replace(/^\S+\s/, '') + ' — choose a different patient if needed'); } if (r.patMode === 'one' && herds.length === 1) (r.procs || []).forEach((pr) => { pr.pat = herds[0].id; }); return u6Fin(r); }
  if (t.dataset.crpat1) { if (!t.value) return; u6SetOne(r, t.value); return u6Fin(r); }
  if (t.dataset.crpatm) { const v = t.dataset.crpatm; const p0 = crBizPats(r.bid).find((x) => String(x.value) === String(v)); if (!p0) return; r.patMode = 'multi';
    if (t.checked) { if (!(r.patients || []).some((p) => p.level === 'herd' && String(p.pid) === String(v))) r.patients = [...(r.patients || []), u6Herd(p0)]; }
    else { const gone = new Set((r.patients || []).filter((p) => String(p.pid) === String(v)).map((p) => p.id)); r.patients = (r.patients || []).filter((p) => !gone.has(p.id)); (r.procs || []).forEach((pr) => { if (gone.has(pr.pat)) pr.pat = null; }); }
    const real = (r.patients || []).filter((p) => p.level === 'herd'); if (real.length === 1) (r.procs || []).forEach((pr) => { if (!pr.pat) pr.pat = real[0].id; }); return u6Fin(r); } }, true);
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=cr-ptnew]'); if (!el) return; e.preventDefault(); e.stopPropagation(); const r = crGet('crrec', CR.id); if (!r || !r.bid) return;
  window.PT_ADDED = (b, ent) => { const r2 = crGet('crrec', CR.id); if (!r2 || r2.bid !== b.id) return; reindex && typeof reindex === 'function' && reindex(); if (crPatMode(r2) === 'multi') { r2.patients = [...(r2.patients || []), u6Herd(ent)]; } else u6SetOne(r2, ent.value); setTimeout(() => u6Fin(r2), 30); };
  const b = document.createElement('button'); b.dataset.act = 'pt-add'; b.dataset.bid = r.bid; b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); }, true);
/* the next patient ID: carries on the numbering already used (the most common style, highest number + 1) */
function ptNextId() { /* 6-digit patient IDs, carrying on from the highest 6-digit ID already used (e.g. 100484 → 100485) */ const vals = []; (D.businesses || []).forEach((b) => (b.patientIds || []).forEach((p) => { if (p && p.value) vals.push(String(p.value).trim()); }));
  const six = vals.filter((v) => /^\d{6}$/.test(v)).map(Number); let next = six.length ? Math.max(...six) + 1 : 100001; const used = new Set(vals.map((v) => v.toLowerCase()));
  while (used.has(String(next)) && next < 999999) next++; return String(next); }
window.ptNextId = ptNextId;
/* ---------- the formatting bar: always at the top of the record, under Find in record ---------- */
if (typeof crRender === 'function') crRender = (function (orig) { return function () { const html = orig.apply(this, arguments); return (CR.page || 'recs') === 'edit' ? html.replace('<div class="ezy-top" style="top:0">', '<div class="ezy-top cr-topbar">') : html; }; })(crRender);
window.crRender = crRender;
function u6TopBar() { if (typeof S === 'undefined' || S.tab !== 'rec' || typeof CR === 'undefined' || CR.page !== 'edit') return; const top = document.querySelector('.ezy-top.cr-topbar'); if (!top || top.querySelector(':scope > .rt-gbar')) return; const r = crGet('crrec', CR.id); if (!r || r.status === 'final') return;
  const bar = document.createElement('div'); bar.className = 'rt-gbar'; bar.innerHTML = rtBar(); top.appendChild(bar); document.querySelectorAll('.d-wrap > .rt-gbar').forEach((x) => x.remove()); }
if (typeof rtBarShow === 'function') rtBarShow = (function (orig) { return function (ed) { const top = document.querySelector('.ezy-top.cr-topbar > .rt-gbar'); if (top && !ed.closest('#sheet')) { top.hidden = false; return; } return orig.apply(this, arguments); }; })(rtBarShow);
/* ---------- before go-live: nothing in "Start a record from an appointment" or Scheduling → Jobs ---------- */
if (typeof crTodayAppts === 'function') crTodayAppts = (function (orig) { return function () { return u6Live() ? orig.apply(this, arguments) : []; }; })(crTodayAppts);
if (typeof crRecsHtml === 'function') crRecsHtml = (function (orig) { return function () { const html = orig.apply(this, arguments); if (u6Live()) return html; return html.replace('<div class="actions"><button class="btn primary" data-act="cr-new">', '<div class="gl-wait">📋 <b>Start a record from an appointment</b> switches on at go-live — until then use ➕ New record.</div><div class="actions"><button class="btn primary" data-act="cr-new">'); }; })(crRecsHtml);
const U6_KEEP_JOBS = new Set(['oncall', 'occheck', 'vcx']); /* the on-call roster and vControl are already in real use */
if (typeof bkJobs === 'function') bkJobs = (function (orig) { return function () { let L = orig.apply(this, arguments);
  const rep = L.filter((j) => j.k === 'reply'); L = L.filter((j) => j.k !== 'reply'); /* texts that need a reply live in Communications → Texts → 📥 Needs a reply */
  if (rep.length && typeof cmClass === 'function') { const all = typeof smsLog === 'function' ? smsLog() : []; const n = all.filter((x) => cmClass(x, all) === 'needs').length; if (n) L.unshift({ k: 'replies', t: '📥 Texts that need a reply', d: `${n} text${n === 1 ? '' : 's'} — see Communications → Texts → 📥 Needs a reply` }); }
  if (!u6Live()) L = L.filter((j) => U6_KEEP_JOBS.has(j.k)); return L; }; })(bkJobs);
if (typeof BK_JOB_NAMES !== 'undefined') BK_JOB_NAMES.replies = 'Texts that need a reply';
if (typeof bkJobsHtml === 'function') bkJobsHtml = (function (orig) { return function () { let html = orig.apply(this, arguments); if (!u6Live()) html = html.replace('<div class="bk-nav"><b class="bk-title">Scheduling jobs</b></div></div>', '$&<div class="gl-wait" style="margin-bottom:8px">Jobs from appointments, texts and checklists switch on at go-live. Until then only the on-call roster and vControl reminders show here.</div>');
  return html.replace(/(see Communications → Texts → 📥 Needs a reply<\/div><\/div><div class="actions">)/, '$1<button class="btn small primary" data-act="u6-texts">💬 Open the texts</button>'); }; })(bkJobsHtml);
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=u6-texts]'); if (!el) return; e.preventDefault(); e.stopPropagation(); if (typeof CM !== 'undefined') CM.f = 'needs'; if (typeof TX !== 'undefined') { TX.page = 'texts'; TX.open = null; } S.tab = 'texts'; renderAll(); }, true);
/* ---------- after every redraw ---------- */
if (typeof renderAll === 'function') renderAll = (function (orig) { return function () { const res = orig.apply(this, arguments); try { u6TopBar(); } catch (e) { console.warn(e); } return res; }; })(renderAll);
setTimeout(() => { try { u6SharedType(); u6RecBkSweep(); } catch (e) { console.warn(e); } }, 2500); setInterval(() => { try { u6SharedType(); u6RecBkSweep(); } catch (e) { } }, 60000);
/* Settings → Box colours and text */
if (typeof BOXES !== 'undefined' && !BOXES.some((x) => x.k === 'glwait')) BOXES.push({ k: 'glwait', l: 'Switches on at go-live (grey note)', sel: '.gl-wait', txt: '.gl-wait', sample: '<div class="gl-wait">📋 <b>Start a record from an appointment</b> switches on at go-live.</div>', d: { bg: '#f3f4f1', fg: '#555555', bd: '#f3f4f1', bold: false } });
