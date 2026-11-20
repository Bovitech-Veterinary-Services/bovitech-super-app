/* Bovitech Super App — 2.52.0
   1. Booking rules aren't shown twice: the separate "📋 Booking rules" card is gone (its details are already in 📅 Scheduling)
   2. Each farm's "What can be booked here" is a set of ticks — Everything, Preg testing, Bull testing, Individual animals / emergencies, Do not service
      (Do not service on its own, linked to a ⛔ farm warning both ways)
   3. "Has not preg / bull tested before" isn't shown (and can be cleared) when their invoices, appointments or call sheets show testing
   4. 📋 Booking info job: rates filled in (the one already set, or the default in red); 💡 picked-up comments can be edited and sent to
      preg testing / bull testing / general booking comments, or removed
   5. Tabs on business, person, patient and record pages (like ezyVet) — set up in Settings → 🗂 Page tabs; each device chooses which tab opens
   6. ⭐ Favourites: this device's own, or the same on every device */
const U15 = { cur: {}, seen: {} };
const u15LS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const u15LSset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

/* ================= 1. no separate "📋 Booking rules" card; who to book under comes from Scheduling only ================= */
if (typeof rlCard === 'function') rlCard = function () { return ''; };
try { if (typeof RL_RX !== 'undefined') { const i = RL_RX.findIndex((x) => x[0] === 'who'); if (i >= 0) RL_RX.splice(i, 1); } } catch (e) { }

/* ================= 2. what can be booked at each farm / set of yards ================= */
const U15_CAN = [['preg', 'Preg testing'], ['bull', 'Bull testing'], ['ind', 'Individual animals / emergencies'], ['none', 'Do not service']];
function u15CanFromUse(use) { return use === 'none' ? ['none'] : use === 'preg' ? ['preg', 'ind'] : use === 'bull' ? ['bull', 'ind'] : use === 'individual' ? ['ind'] : ['preg', 'bull', 'ind']; }
function u15UseFromCan(can) { const c = new Set(can || []); if (c.has('none') || !c.size) return 'none'; if (c.has('preg') && c.has('bull')) return ''; if (c.has('preg')) return 'preg'; if (c.has('bull')) return 'bull'; return 'individual'; }
const U15_DNS_RX = /\bdo\s*not\s*service\b|\bdon'?t\s+service\b|\bnot\s+to\s+be\s+serviced\b|\bno\s+(?:future|longer|more)\s+servic/i;
function u15DnsNote(rec, type) { if (!rec || typeof notesOf !== 'function') return null; return notesOf(rec, type, 'warn').find((n) => n.dns || U15_DNS_RX.test(n.t || '')) || null; }
function u15DnsWhy(fid) { const f = IDX.farms && IDX.farms.get(fid); if (!f) return ''; const n = u15DnsNote(f, 'farm'); if (n) return 'the farm\'s warning'; const b = f.bid ? IDX.biz.get(f.bid) : null;
  const bs = b ? [b] : (D.businesses || []).filter((x) => !x.gone && (x.farms || []).some((y) => y.id === fid)); for (const x of bs) { if (u15DnsNote(x, 'business')) return `${x.name}'s warning`; if ((x.cats || []).includes('dna')) return `${x.name} is "Do not answer — no future service"`; } return ''; }
if (typeof bkYardUse === 'function') bkYardUse = (function (orig) { return function (fid, yid) { const x = orig.apply(this, arguments) || {}; const why = u15DnsWhy(fid); if (why) return { ...x, use: 'none', can: ['none'], autoWhy: why }; return { ...x, can: Array.isArray(x.can) && x.can.length ? x.can : u15CanFromUse(x.use || '') }; }; })(bkYardUse);
function u15CanText(fid, yid) { const x = bkYardUse(fid, yid); const can = x.can || u15CanFromUse(x.use || '');
  if (can.includes('none')) return `<b style="color:var(--red)">⛔ Do not service</b>${x.autoWhy ? `<div class="u15-auto">(automatically chosen based on ${h(x.autoWhy)})</div>` : ''}`;
  if (['preg', 'bull', 'ind'].every((k) => can.includes(k))) return '<b>Everything</b> <span class="hint">(preg testing, bull testing, individual animals / emergencies)</span>';
  return U15_CAN.filter(([k]) => can.includes(k)).map(([, l]) => h(l)).join(' · '); }
window.u15CanText = u15CanText;
/* the farm's ✏️ Scheduling form: ticks instead of the drop-down (the drop-down stays hidden and follows the ticks) */
function u15TickBox(sel, can, auto) { const id = sel.id; const on = new Set(can); const dns = on.has('none');
  return `<div class="u15-can" data-for="${h(id)}">${auto ? `<div class="u15-auto">(automatically chosen based on ${h(auto)} — change the warning to change this)</div>` : ''}
    <label class="bk-radio"><input type="checkbox" data-u15can="all" ${!dns && ['preg', 'bull', 'ind'].every((k) => on.has(k)) ? 'checked' : ''} ${auto ? 'disabled' : ''}> <b>Everything</b></label>
    ${U15_CAN.map(([k, l]) => `<label class="bk-radio"><input type="checkbox" data-u15can="${k}" ${on.has(k) ? 'checked' : ''} ${auto || (dns && k !== 'none') ? 'disabled' : ''}> ${k === 'none' ? '<b style="color:var(--red)">⛔ ' + h(l) + '</b>' : h(l)}</label>`).join('')}</div>`; }
function u15CanRead(box) { return [...box.querySelectorAll('[data-u15can]:checked')].map((x) => x.dataset.u15can).filter((k) => k !== 'all'); }
function u15CanSync(box) { const sel = document.getElementById(box.dataset.for); const all = box.querySelector('[data-u15can=all]'); const dns = box.querySelector('[data-u15can=none]').checked;
  box.querySelectorAll('[data-u15can]').forEach((x) => { if (x.dataset.u15can !== 'none' && !box.dataset.auto) x.disabled = dns; if (dns && x.dataset.u15can !== 'none') x.checked = false; });
  all.checked = !dns && ['preg', 'bull', 'ind'].every((k) => box.querySelector(`[data-u15can=${k}]`).checked); if (sel) sel.value = u15UseFromCan(u15CanRead(box)); }
document.addEventListener('change', (e) => { const el = e.target; if (!el.dataset || !el.dataset.u15can) return; const box = el.closest('.u15-can'); if (!box) return;
  if (el.dataset.u15can === 'all') box.querySelectorAll('[data-u15can=preg],[data-u15can=bull],[data-u15can=ind]').forEach((x) => { x.checked = el.checked; });
  if (el.dataset.u15can === 'none' && el.checked) box.querySelectorAll('[data-u15can]').forEach((x) => { if (x !== el) x.checked = false; });
  u15CanSync(box); });
if (typeof bkFschedOpen === 'function') bkFschedOpen = (function (orig) { return function (fid) { const r = orig.apply(this, arguments); try {
  const form = document.querySelector('#sheet .form'); if (!form || !document.querySelector('[data-fzuse]')) return r; const why = u15DnsWhy(fid); const fs = Bk.fsched(fid);
  form.querySelectorAll('select[data-fzuse]').forEach((sel) => { const yid = sel.id === 'fz-use' ? null : sel.id.slice(7); const own = yid ? ((fs.yards || {})[yid] || {}) : fs;
    const can = why ? ['none'] : Array.isArray(own.can) && own.can.length ? own.can : u15CanFromUse(own.use || ''); sel.hidden = true; sel.insertAdjacentHTML('afterend', u15TickBox(sel, can, why)); if (why) { sel.value = 'none'; sel.closest('.f').querySelector('.u15-can').dataset.auto = '1'; } });
  const hint = [...form.querySelectorAll('.hint')].find((x) => /Do not service" pops up/.test(x.textContent)); if (hint) hint.textContent = '⛔ Do not service can\'t be ticked with anything else. It pops up a warning if anyone tries to book there, and adds a ⛔ warning to the farm.';
  if (SHEET && typeof SHEET.onSave === 'function' && !SHEET.u15) { const save0 = SHEET.onSave; SHEET.u15 = true;
    SHEET.onSave = async function () { const boxes = [...document.querySelectorAll('#sheet .u15-can')]; const read = boxes.map((b) => ({ id: b.dataset.for, can: u15CanRead(b) }));
      if (read.some((x) => !x.can.length)) { toast('Tick at least one thing that can be booked (or ⛔ Do not service)'); return false; }
      const ok = await save0.apply(this, arguments); if (ok === false) return ok;
      try { const rec = Bk.get('fsched:' + fid); if (rec) { read.forEach((x) => { if (x.id === 'fz-use') rec.can = x.can; else { const yid = x.id.slice(7); rec.yards = rec.yards || {}; rec.yards[yid] = { ...(rec.yards[yid] || {}), can: x.can }; } }); touch(rec); save(); }
        if (!why) await u15DnsLink(fid, read.some((x) => (x.id === 'fz-use' ? !(rec && rec.perYard) : rec && rec.perYard) && x.can.includes('none'))); } catch (e) { console.warn('u15 can save', e); } return ok; }; }
  } catch (e) { console.warn('u15 fsched', e); } return r; }; })(bkFschedOpen);
/* ⛔ Do not service ⇄ a major warning on the farm */
async function u15DnsLink(fid, dns) { const f = IDX.farms && IDX.farms.get(fid); if (!f || (D.settings.u15 || {}).dnsWarn === false) return; const n = u15DnsNote(f, 'farm');
  if (dns && !n) { if (!(await ask(`Add a ⛔ "Do not service" major warning to ${h(f.name || f.address || 'this farm')}?<br><span class="hint">It shows on the farm and the business, and puts CHECK WARNING on the photo. (Turn this question off in Settings → 🗂 Page tabs.)</span>`, 'Add the warning'))) return;
    addNote(f, 'farm', 'warn', '⛔ Do not service' + (Bk.fsched(fid).note ? ' — ' + Bk.fsched(fid).note : '')); const w = f.notes[f.notes.length - 1]; if (w) w.dns = 1; touch(f); NEXT_LOG_LABEL = `${f.name || 'Farm'}: ⛔ Do not service warning added`; S.skipConfirm = true; await changed(); }
  if (!dns && n && n.dns) { if (!(await ask(`${h(f.name || 'This farm')} can be booked again. Take off its ⛔ "Do not service" warning?`, 'Take it off'))) return; n.res = true; n.resAt = Date.now(); noteLog(n, 'Resolved — the farm can be booked again'); notesSync(f, 'farm'); touch(f); NEXT_LOG_LABEL = `${f.name || 'Farm'}: Do not service warning resolved`; S.skipConfirm = true; await changed(); } }
/* booking checks: no individual animals / emergencies where only preg or bull testing is ticked */
if (typeof bkStopIssues === 'function') bkStopIssues = (function (orig) { return function (st, svcs, stops) { const out = orig.apply(this, arguments) || []; try {
  const f = st && st.fid && IDX.farms && IDX.farms.get(st.fid); if (!f) return out; const x = bkYardUse(st.fid, st.yid); const can = x.can || []; if (can.includes('none') || can.includes('ind')) return out;
  (svcs || []).forEach((v) => { const sv = v.svc && Bk.svc(v.svc); if (!sv || sv.yard || sv.alongside || /travel|setup|set-up|after/i.test(sv.name || '')) return; out.push({ msg: `${Bk.stopName(st)} isn't set for individual animals / emergencies — only ${u15CanText(st.fid, st.yid).replace(/<[^>]+>/g, '')}` }); }); } catch (e) { console.warn(e); } return out; }; })(bkStopIssues);

/* ================= 3. "Has not tested before" when they have ================= */
function u15Tested(bid, k) { /* k 'f' (preg) or 'b' (bull) → { yr, src } of the latest year with testing, or null */
  try { if (typeof herdYears !== 'function') return null; const Y = herdYears(bid, null, true) || {}; const ys = Object.keys(Y).map(Number).filter((y) => Y[y] && Y[y][k] > 0).sort((a, b) => b - a); if (!ys.length) return null; const y = ys[0]; return { yr: y, src: (Y[y].src || {})[k] || 'history' }; } catch (e) { return null; } }
const u15TestWhy = (t) => `(automatically cleared based on their ${t.yr} ${t.src === 'call sheet' ? 'call sheet' : t.src === 'booking' ? 'appointments' : t.src.replace(/^ezyVet invoice$/, 'ezyVet invoices').replace(/^invoice$/, 'invoices')})`;
function u15FixNever(html, bid, fn) { [['f', 'preg'], ['b', 'bull']].forEach(([k, w]) => { const t = u15Tested(bid, k); if (!t) return; html = fn(html, w, t); }); return html; }
if (typeof giInfoRows === 'function') giInfoRows = (function (orig) { return function (bid) { return u15FixNever(orig.apply(this, arguments), bid, (s, w, t) => s.replace(`<div><b>Has not ${w} tested before</b></div>`, `<div class="u15-auto">"Has not ${w} tested" ${u15TestWhy(t)}</div>`)); }; })(giInfoRows);
if (typeof giInfoLines === 'function') giInfoLines = (function (orig) { return function (bid, svc) { return (orig.apply(this, arguments) || []).map((l) => u15FixNever(l, bid, (s, w) => s.replace(` · <b>has not ${w} tested before</b>`, ''))); }; })(giInfoLines);
if (typeof bkBschedOpen === 'function') bkBschedOpen = (function (orig) { return function (bid) { const r = orig.apply(this, arguments); try { [['bz-pnew', 'f', 'preg'], ['bz-bnew', 'b', 'bull']].forEach(([id, k, w]) => { const el = document.getElementById(id); const t = el && u15Tested(bid, k); if (!t) return; el.checked = false; el.disabled = true; el.closest('label').insertAdjacentHTML('afterend', `<div class="u15-auto">${u15TestWhy(t)}</div>`); }); } catch (e) { console.warn(e); } return r; }; })(bkBschedOpen);
/* a job to clear the ticks already saved */
if (typeof JOB_TYPES !== 'undefined') JOB_TYPES.u15never = { t: '"Has not tested before" ticked, but they have', manual: true };
function u15NeverList() { if (typeof Bk === 'undefined' || !Bk.on || !Bk.on()) return []; const out = []; Bk.cfg('bsched').forEach((bs) => { const b = IDX.biz.get(bs.bid); if (!b || b.gone) return; const L = [];
  if (bs.preg && bs.preg.never) { const t = u15Tested(b.id, 'f'); if (t) L.push(['preg', t]); } if (bs.bull && bs.bull.never) { const t = u15Tested(b.id, 'b'); if (t) L.push(['bull', t]); } if (L.length) out.push({ b, L }); }); return out; }
function u15NeverJobs() { const L = u15NeverList(); if (!L.length) return []; const key = 'u15never:' + L.map((x) => x.b.id + x.L.map((y) => y[0]).join('')).join('.'); if ((D.dismissed || {})[key]) return [];
  return [{ type: 'u15never', key, kind: 'business', id: L[0].b.id, who: `${L.length} client${L.length === 1 ? '' : 's'} ticked "has not tested before"`, note: 'Their invoices, appointments or call sheets show testing — clear the ticks?', herdpull: 'u15', u15never: 1 }]; }
async function u15ClearNever(silent) { const L = u15NeverList(); if (!L.length) return 0; if (!silent && !(await ask(`Clear "has not tested before" for ${L.length} client${L.length === 1 ? '' : 's'}?<br>${L.map((x) => `${h(x.b.name)}: ${x.L.map(([w, t]) => `${w} testing in ${t.yr}`).join(', ')}`).join('<br>')}`, '✓ Clear them'))) return 0;
  L.forEach(({ b, L: W }) => { const r = Bk.get('bsched:' + b.id); if (!r) return; W.forEach(([w]) => { r[w] = { ...(r[w] || {}), never: false }; }); touch(r); });
  if (typeof JOBS_CACHE !== 'undefined') JOBS_CACHE = null; NEXT_LOG_LABEL = `"Has not tested before" cleared for ${L.length} client${L.length === 1 ? '' : 's'} (automatically, based on their history)`; S.skipConfirm = true; await changed(); return L.length; }
window.u15ClearNever = u15ClearNever; window.u15Tested = u15Tested;

/* ================= 4. 📋 Booking info job ================= */
/* the default rate filled in isn't saved as the farm's own rate unless it's changed */
if (typeof giRead === 'function') giRead = (function (orig) { return function (box) { const A = orig.apply(this, arguments); try { ['preg', 'bull'].forEach((k) => { const L = A[k + 'Sp'] || []; L.forEach((s) => { const el = box.querySelector(`[data-gi="${k}sp"][data-i="${s.i}"]`); if (el && el.dataset.gidef && +el.value === +el.dataset.gidef) s.hph = 0; }); });
  A.u15 = [...box.querySelectorAll('.u15-sugto')].map((sel) => { const i = +sel.dataset.i; const ta = box.querySelector(`.u15-sugtxt[data-i="${i}"]`); return { i, to: sel.value, text: ta ? ta.value.trim() : '', edited: ta ? ta.value.trim() !== (ta.dataset.orig || '').trim() : false }; });
  const special = new Set(A.u15.filter((x) => x.to !== '' || x.edited).map((x) => x.i)); A.u13sugs = (A.u13sugs || []).filter((i) => !special.has(i)); } catch (e) { console.warn('u15 giRead', e); } return A; }; })(giRead);
if (typeof ginfoHtml === 'function') ginfoHtml = (function (orig) { return function (j) { let html = orig.apply(this, arguments); try { if (!html.includes('class="u13-sug"')) return html; let i = 0;
  html = html.replace(/<div class="u13-from">From: "([\s\S]*?)"<\/div>/g, (m, txt) => { const k = i++; const t = txt.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return `<div class="u15-sugedit"><label class="hint" for="u15st-${k}">The comment (you can change it)</label><textarea id="u15st-${k}" class="u15-sugtxt" data-i="${k}" rows="2" data-orig="${h(t)}">${h(t)}</textarea>
      <label class="hint" for="u15sg-${k}">What to do with it</label><select id="u15sg-${k}" class="u15-sugto" data-i="${k}"><option value="">Use it as suggested above (if ticked)</option><option value="preg">Add it to the preg testing comments</option><option value="bull">Add it to the bull testing comments</option><option value="note">Add it to the general booking comments</option><option value="remove">🗑️ Remove it — don't use it</option></select></div>`; });
  html = html.replace('Tick the ones to use. The comments stay as they are.', 'Tick the ones to use as suggested, or choose where each comment goes (and change its words) below it.');
  } catch (e) { console.warn('u15 ginfo', e); } return html; }; })(ginfoHtml);
if (typeof giApply === 'function') giApply = (function (orig) { return function (b, A, r) { const n = orig.apply(this, arguments) || 0; let m = 0;
  try { const L = (A && A.u15) || []; if (!L.length) return n; const R = typeof u13GiScan === 'function' ? u13GiScan(b) : { sugs: [] }; let bs = Bk.get('bsched:' + b.id); if (!bs) { bs = { id: 'bsched:' + b.id, cfg: 'bsched', bid: b.id, ...Bk.bsched(b.id) }; D.bkcfg.push(bs); }
    const add = (cur, t) => [cur, t].filter((x) => (x || '').trim()).filter((x, k, a) => a.indexOf(x) === k).join('\n');
    L.forEach((x) => { const s = R.sugs[x.i]; const t = x.text || (s && s.from) || ''; if (!t || x.to === 'remove') return;
      if (x.to === 'preg') { bs.preg = { ...(bs.preg || {}), comment: add((bs.preg || {}).comment, t) }; m++; }
      else if (x.to === 'bull') { bs.bull = { ...(bs.bull || {}), comment: add((bs.bull || {}).comment, t) }; m++; }
      else if (x.to === 'note') { bs.note = [bs.note, t].filter((y) => (y || '').trim()).filter((y, k, a) => a.indexOf(y) === k).join(' · '); m++; }
      else if (x.to === '' && x.edited && s) { const box = document.querySelector(`.ginfo[data-gibid="${CSS.escape(b.id)}"] [data-gi="u13s"][data-i="${x.i}"]`); if (box && !box.checked) return; /* edited and ticked: used as suggested, with the new words */
        if (s.k === 'caution') addNote(b, 'business', 'caution', t); else if (s.k === 'farm' || s.k === 'pin') { const f0 = (typeof bkFarmsOf === 'function' ? bkFarmsOf(b.id) : [])[0]; if (f0) { let fs = Bk.get('fsched:' + f0.id); if (!fs) { fs = { id: 'fsched:' + f0.id, cfg: 'fsched', fid: f0.id, ...Bk.fsched(f0.id) }; D.bkcfg.push(fs); } fs.note = [fs.note, t].filter(Boolean).join(' · '); touch(fs); } }
        else bs.note = [bs.note, t].filter((y) => (y || '').trim()).filter((y, k, a) => a.indexOf(y) === k).join(' · '); m++; } });
    if (m) { touch(bs); touch(b); } } catch (e) { console.warn('u15 giApply', e); } return n + m; }; })(giApply);

/* ================= 5. tabs on business, person, patient and record pages ================= */
const U15_PAGES = { biz: 'Business page', person: 'Person page', patient: 'Patient page', rec: 'Clinical record' };
const U15_DEF = {
  biz: { tabs: [['det', 'Details'], ['sch', 'Scheduling'], ['pat', 'Patients'], ['rec', 'Records & appointments'], ['com', 'Comms & attachments'], ['acc', 'Account']],
    rules: [['top', /warning|biosecurity|don.?t mention|^jobs/], ['acc', /account|invoice|credit|xero|statement|balance|estimate/], ['com', /communication|attachment|email|texts|messages/], ['sch', /scheduling|farm|location|pins|saved route|booking rule|yard/], ['pat', /^patients?\b|herd|flock/], ['rec', /appointment|clinical record|ezyvet|keep note|lab|result|summary|recording|record/]] },
  person: { tabs: [['det', 'Details'], ['biz', 'Businesses'], ['com', 'Comms'], ['his', 'History']],
    rules: [['top', /warning|\bice\b|^jobs/], ['his', /resolved|change history|history|change log/], ['com', /communication|texts|email|attachment|messages/], ['biz', /business|helper/]] },
  patient: { tabs: [['det', 'Details'], ['herd', 'Herd'], ['rec', 'Records'], ['lab', 'Lab']],
    rules: [['herd', /herd details|flock details|^herd|^flock|temperament/], ['lab', /\blab\b|laborator|result/], ['rec', /clinical record|appointment|ezyvet|record|history from ezyvet/]] },
  rec: { tabs: [['visit', 'Visit'], ['proc', 'Procedures'], ['notes', 'Notes'], ['sheets', 'Recording sheets'], ['inv', 'Invoice']],
    sec: { visit: 'visit', patients: 'visit', travel: 'visit', labour: 'visit', ah: 'visit', links: 'visit', procs: 'proc', items: 'proc', labs: 'proc', notes: 'notes', fus: 'notes', certs: 'notes' },
    rules: [['sheets', /recording sheet|eye|foot trim/], ['inv', /invoice|billing|estimate|discount|charge/], ['notes', /note|follow|certificate|summary/], ['proc', /procedure|medication|lab/]] } };
const u15Cfg = (pg) => { const c = ((D.settings || {}).u15tabs || {})[pg]; return { tabs: c && Array.isArray(c.tabs) && c.tabs.length ? c.tabs : U15_DEF[pg].tabs.map(([id, n]) => ({ id, n })), map: (c && c.map) || {} }; };
function u15SetCfg(pg, c) { D.settings.u15tabs = { ...(D.settings.u15tabs || {}), [pg]: c }; touch(D.settings); }
const u15Dev = () => u15LS('bvp-u15', { open: {}, last: {} });
function u15DevSet(fn) { const d = u15Dev(); fn(d); u15LSset('bvp-u15', d); }
/* v2.53: business and person sections are known by their layout name (the same in edit mode and on the page) */
function u15Key(el) { if (el.classList && el.classList.contains('edsec') && el.dataset.dk) return 'lk:' + el.dataset.dk; { const c0 = el.matches && el.matches('[data-lk]') ? el : el.querySelector && el.querySelector(':scope > [data-lk]'); if (c0) return 'lk:' + c0.dataset.lk; } return u15TextKey(el); }
function u15TextKey(el) { if (el.dataset && el.dataset.sec) return el.dataset.sec; const c = el.matches('.card,details') ? el : el.querySelector('.card,details') || el; try { if (typeof layKey === 'function') { const k = layKey(c); if (k) return k; } } catch (e) { } const t = c.querySelector('h3, summary, h2'); return t ? (t.textContent || '').replace(/\(\d+\)|\d+/g, '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40) : ''; }
function u15Label(el) { const c = el.matches('.card,details') ? el : el.querySelector('.card,details') || el; const t = c.querySelector('h3 .sp, h3, summary b, summary, h2'); return ((t && t.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 60); }
const U15_LK = { biz: { jobs: 'top', warn: 'top', biosec: 'top', nomention: 'top', cat: 'det', phone: 'det', texts: 'com', info: 'det', current: 'det', helpers: 'det', past: 'det', pic: 'pat', pid: 'pat', appts: 'rec', ezyhist: 'rec', recs: 'rec', sched: 'sch', keep: 'rec', routes: 'sch', farms: 'sch', farmsmap: 'sch', farmsused: 'sch', farmspast: 'sch', resolved: 'det', history: 'det', sfshares: 'det', sfmember: 'det', sfrecs: 'rec', sfinvs: 'acc' },
  person: { jobs: 'top', ice: 'top', warn: 'top', nomention: 'top', contact: 'det', texts: 'com', related: 'det', tags: 'det', info: 'det', biz: 'biz', pastbiz: 'biz', helps: 'biz', resolved: 'his', history: 'his' } };
function u15TabOf(pg, key, el) { const C = u15Cfg(pg); const ids = new Set(C.tabs.map((t) => t.id)); let m = C.map[key]; if (!m && el && String(key).startsWith('lk:')) { const tk = u15TextKey(el.classList && el.classList.contains('edsec') ? (el.querySelector('.card,details') || el) : el); m = C.map[tk]; } /* a section placed in 2.52 (by its heading) keeps its tab */
  if (m === 'top' || (m && ids.has(m))) return m; { const lk = String(key).startsWith('lk:') ? key.slice(3) : (U15_LK[pg] && U15_LK[pg][key] ? key : null); const t = lk && U15_LK[pg] && U15_LK[pg][lk]; if (t && (t === 'top' || ids.has(t))) return t; }
  const D0 = U15_DEF[pg]; if (D0.sec && D0.sec[key] && ids.has(D0.sec[key])) return D0.sec[key]; const lbl = (key + ' ' + (el ? u15Label(el) : '')).toLowerCase();
  for (const [t, rx] of D0.rules) if (rx.test(lbl) && (t === 'top' || ids.has(t))) return t; return C.tabs[0].id; }
const u15Force = (el) => (el.matches('.flagjob, .dnabanner, .inactivebox') || el.querySelector(':scope > .notesblock[data-k=warn], :scope > .notesblock[data-k=caution], :scope > .flagline') ? 'top' : null);
function u15Page() { if (S.pageEd) return null;
  if (S.tab === 'rec' && typeof CR !== 'undefined' && CR.page === 'edit') { const root = document.querySelector('#list .cr-edit'); return root ? { pg: 'rec', id: CR.id, root, secs: [...root.querySelectorAll('.cr-sec')] } : null; }
  return null; }
const U15_HEAD = '.dtop,.hero,.actions,.expandbar,.adminbar,.edhead,.lay-tools,.u16-edtools,.pe-top,.u15-tabs,h2,h1,.inactivebox,.dnabanner,.dnareason,.flagline,.flags,script,style';
function u15Secs(root) { return [...root.children].filter((el) => !el.matches(U15_HEAD) && (el.matches('.card, details') || (el.tagName === 'DIV' && el.firstElementChild && el.firstElementChild.matches('.card, details')))); }
function u15Apply(pg, id, root, secs) { if (!root || !secs.length) { return; } if (root.closest('#sheet')) return; const dev = u15Dev(); const pref = (dev.open || {})[pg] || 'last';
  root.querySelectorAll(':scope .u15-tabs').forEach((x) => x.remove()); secs.forEach((el) => el.classList.remove('u15-off'));
  if (pref === 'off' || (typeof showAllOn === 'function' && id && showAllOn(id))) return;
  const C = u15Cfg(pg); const seen = (U15.seen[pg] = U15.seen[pg] || u15LS('bvp-u15seen-' + pg, {})); let seenNew = false;
  const assign = secs.map((el) => { const k = u15Key(el); if (k && !seen[k]) { seen[k] = u15Label(el) || k; seenNew = true; } return { el, k, t: u15Force(el) || u15TabOf(pg, k, el) }; });
  if (seenNew) u15LSset('bvp-u15seen-' + pg, seen);
  const used = C.tabs.filter((t) => assign.some((a) => a.t === t.id)); if (used.length < 2) return; /* one tab only: just the page */
  let cur = U15.cur[pg]; if (!cur || cur.id !== id) { const want = pref !== 'last' ? pref : (dev.last || {})[pg]; cur = U15.cur[pg] = { id, t: used.some((t) => t.id === want) ? want : used[0].id }; }
  if (!used.some((t) => t.id === cur.t)) cur.t = used[0].id;
  assign.forEach((a) => { if (a.t !== 'top' && a.t !== cur.t) a.el.classList.add('u15-off'); a.el.dataset.u15t = a.t; });
  const first = assign.find((a) => a.t !== 'top'); if (!first) return; let anchor = first.el; while (anchor.parentElement && anchor.parentElement !== root) anchor = anchor.parentElement;
  const bar = document.createElement('div'); bar.className = 'u15-tabs'; bar.setAttribute('role', 'tablist'); bar.dataset.pg = pg;
  bar.innerHTML = used.map((t) => `<button type="button" role="tab" class="u15-tab ${t.id === cur.t ? 'on' : ''}" aria-selected="${t.id === cur.t}" data-act="u15-tab" data-pg="${pg}" data-t="${h(t.id)}">${h(t.n)} <span class="u15-n">${assign.filter((a) => a.t === t.id).length}</span></button>`).join('');
  root.insertBefore(bar, anchor); }
function u15Show(pg, t) { const cur = U15.cur[pg]; if (cur) cur.t = t; u15DevSet((d) => { d.last = d.last || {}; d.last[pg] = t; });
  document.querySelectorAll(`.u15-tabs[data-pg="${pg}"]`).forEach((bar) => { bar.querySelectorAll('.u15-tab').forEach((b) => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); const root = bar.parentElement; root.querySelectorAll('[data-u15t]').forEach((el) => el.classList.toggle('u15-off', el.dataset.u15t !== 'top' && el.dataset.u15t !== t)); }); }
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=u15-tab]'); if (!el) return; e.preventDefault(); e.stopPropagation(); u15Show(el.dataset.pg, el.dataset.t); }, true);
/* something on another tab that the app scrolls to (search result, a link to a section, "jump to") → that tab opens first */
(function () { const sv = Element.prototype.scrollIntoView; Element.prototype.scrollIntoView = function () { try { const sec = this.closest && this.closest('.u15-off[data-u15t]'); if (sec) { const bar = sec.parentElement && sec.parentElement.querySelector(':scope > .u15-tabs'); if (bar) u15Show(bar.dataset.pg, sec.dataset.u15t); } } catch (e) { } return sv.apply(this, arguments); }; })();
function u15Run() { try {
  /* business / person (the details pane) — in ✏️ Edit layout, one tab at a time */ const dt = document.querySelector('#detail .d-wrap'); if (dt && S.sel && (S.sel.kind === 'business' || S.sel.kind === 'contact') && !document.querySelector('#detail #sheet')) { const pg = S.sel.kind === 'business' ? 'biz' : 'person'; const ed = dt.querySelector('[data-dnd^="eplayout:"]'); u15Apply(pg, S.sel.id, dt, ed ? [...ed.querySelectorAll(':scope > .edsec')] : u15Secs(dt)); }
  /* patient */ if (S.tab === 'pat' && typeof PT !== 'undefined' && PT.sel && S.pageEd !== 'ptpage') { const root = document.querySelector('#list .d-wrap'); if (root && root.querySelector('[data-act=pt-back]')) u15Apply('patient', PT.sel, root, u15Secs(root)); }
  /* record */ const p = u15Page(); if (p) { const tops = p.secs; if (tops.length) { const root = p.root; const bar0 = root.querySelector('.u15-tabs'); if (bar0) bar0.remove(); u15ApplyNested(p.pg, p.id, root, tops); } }
  } catch (e) { console.warn('u15 tabs', e); } }
function u15ApplyNested(pg, id, root, secs) { /* record sections can sit inside the finalised-record lock: hide/show them where they are, the tab bar above the first */
  const dev = u15Dev(); const pref = (dev.open || {})[pg] || 'last'; secs.forEach((el) => el.classList.remove('u15-off')); if (pref === 'off') return;
  const C = u15Cfg(pg); const seen = (U15.seen[pg] = U15.seen[pg] || u15LS('bvp-u15seen-' + pg, {})); let nw = false;
  const assign = secs.map((el) => { const k = u15Key(el); if (k && !seen[k]) { seen[k] = u15Label(el) || k; nw = true; } return { el, k, t: u15Force(el) || u15TabOf(pg, k, el) }; }); if (nw) u15LSset('bvp-u15seen-' + pg, seen);
  const used = C.tabs.filter((t) => assign.some((a) => a.t === t.id)); if (used.length < 2) return;
  let cur = U15.cur[pg]; if (!cur || cur.id !== id) { const want = pref !== 'last' ? pref : (dev.last || {})[pg]; cur = U15.cur[pg] = { id, t: used.some((t) => t.id === want) ? want : used[0].id }; } if (!used.some((t) => t.id === cur.t)) cur.t = used[0].id;
  assign.forEach((a) => { a.el.dataset.u15t = a.t; if (a.t !== 'top' && a.t !== cur.t) a.el.classList.add('u15-off'); });
  const first = assign.find((a) => a.t !== 'top'); if (!first) return; const bar = document.createElement('div'); bar.className = 'u15-tabs'; bar.dataset.pg = pg; bar.setAttribute('role', 'tablist');
  bar.innerHTML = used.map((t) => `<button type="button" role="tab" class="u15-tab ${t.id === cur.t ? 'on' : ''}" aria-selected="${t.id === cur.t}" data-act="u15-tab" data-pg="${pg}" data-t="${h(t.id)}">${h(t.n)} <span class="u15-n">${assign.filter((a) => a.t === t.id).length}</span></button>`).join('');
  first.el.parentElement.insertBefore(bar, first.el);
  /* the tab bar may sit inside the lock — u15Show finds the sections through the root */ bar.dataset.root = '1'; }
/* u15Show for nested record sections: the sections aren't the bar's siblings */
const u15Show0 = u15Show; u15Show = function (pg, t) { u15Show0(pg, t); if (pg === 'rec') document.querySelectorAll('#list .cr-edit [data-u15t]').forEach((el) => el.classList.toggle('u15-off', el.dataset.u15t !== 'top' && el.dataset.u15t !== t)); };
if (typeof renderDetail === 'function') renderDetail = (function (orig) { return function () { const r = orig.apply(this, arguments); u15Run(); return r; }; })(renderDetail);
if (typeof renderAll === 'function') renderAll = (function (orig) { return function () { const r = orig.apply(this, arguments); u15Run(); return r; }; })(renderAll);
if (typeof layApply === 'function') layApply = (function (orig) { return function () { const r = orig.apply(this, arguments); u15Run(); return r; }; })(layApply);


/* Settings → 🗂 Page tabs (layout on every device: admin) and which tab opens (this device) */
U15.setPg = 'biz';
function u15SecList(pg) { const seen = { ...u15LS('bvp-u15seen-' + pg, {}), ...(U15.seen[pg] || {}) }; const C = u15Cfg(pg); Object.keys(C.map).forEach((k) => { if (!seen[k]) seen[k] = k; });
  if (pg === 'rec') Object.keys(U15_DEF.rec.sec).forEach((k) => { if (!seen[k]) seen[k] = k; });
  if ((pg === 'biz' || pg === 'person') && typeof LAYOUT_SECS !== 'undefined') { const kind = pg === 'biz' ? 'business' : 'contact'; const nrm = (v) => String(v).replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    (typeof layoutKeys === 'function' ? layoutKeys(kind) : LAYOUT_SECS[kind].map((x) => x[0])).forEach((k0) => { seen['lk:' + k0] = typeof layoutLabel === 'function' ? layoutLabel(kind, k0) : k0; });
    const lkL = new Set(Object.entries(seen).filter(([k]) => k.startsWith('lk:')).map(([, v]) => nrm(v))); Object.keys(seen).forEach((k) => { if (!k.startsWith('lk:') && lkL.has(nrm(seen[k]))) delete seen[k]; }); } /* v2.53: the page's own sections by their layout name */
  return Object.entries(seen).sort((a, b) => String(a[1]).localeCompare(String(b[1]))); }
function u15SettingsCard() { const pg = U15.setPg; const C = u15Cfg(pg); const dev = u15Dev(); const adm = !!S.admin;
  const tabs = C.tabs.map((t, i) => `<div class="kv dragrow" data-dk="${h(t.id)}" style="align-items:center"><span class="draghandle" title="Hold and drag">⠿</span><input class="u15-tname" data-id="${h(t.id)}" value="${h(t.n)}" aria-label="Tab name" ${adm ? '' : 'disabled'} style="flex:1;min-width:0"><button type="button" class="btn small" data-act="u15-tmv" data-id="${h(t.id)}" data-d="-1" ${i && adm ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" class="btn small" data-act="u15-tmv" data-id="${h(t.id)}" data-d="1" ${i < C.tabs.length - 1 && adm ? '' : 'disabled'} aria-label="Move down">↓</button><button type="button" class="btn small" data-act="u15-tdel" data-id="${h(t.id)}" ${C.tabs.length > 1 && adm ? '' : 'disabled'} aria-label="Delete tab">🗑️</button></div>`).join('');
  const opts = (sel) => `<option value="top" ${sel === 'top' ? 'selected' : ''}>Always shown (above the tabs)</option>` + C.tabs.map((t) => `<option value="${h(t.id)}" ${sel === t.id ? 'selected' : ''}>${h(t.n)}</option>`).join('');
  const secs = u15SecList(pg).map(([k, l], i) => `<div class="f u15-secrow"><label for="u15sm-${i}">${h(l)}</label><select id="u15sm-${i}" class="u15-smap" data-k="${h(k)}" ${adm ? '' : 'disabled'} style="width:100%">${opts(u15TabOf(pg, k, null))}</select></div>`).join('');
  return `<div class="card u15-set"><h3>🗂 Page tabs</h3><div class="hint">Long pages are split into tabs, like ezyVet. Warnings and the name stay above the tabs.</div>
    <div class="f"><label for="u15-setpg">Page</label><select id="u15-setpg">${Object.entries(U15_PAGES).map(([k, l]) => `<option value="${k}" ${k === pg ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></div>
    <div class="f"><label for="u15-open">Open on — this device</label><select id="u15-open" data-pg="${pg}"><option value="last" ${((dev.open || {})[pg] || 'last') === 'last' ? 'selected' : ''}>The last tab used</option>${C.tabs.map((t) => `<option value="${h(t.id)}" ${(dev.open || {})[pg] === t.id ? 'selected' : ''}>Always the "${h(t.n)}" tab</option>`).join('')}<option value="off" ${(dev.open || {})[pg] === 'off' ? 'selected' : ''}>No tabs — one long page</option></select><div class="hint">Only for this device.</div></div>
    <div class="lbl" style="margin-top:8px">Tabs ${adm ? '' : '<span class="hint">(🔒 admin — unlock to change; applies on every device)</span>'}</div><div data-dnd="u15tabs:${pg}">${tabs}</div>
    ${adm ? `<div class="actions"><button type="button" class="btn small" data-act="u15-tadd">➕ New tab</button>${(D.settings.u15tabs || {})[pg] ? '<button type="button" class="btn small" data-act="u15-treset">↺ Back to the standard tabs</button>' : ''}</div>` : ''}
    <div class="lbl" style="margin-top:8px">Which tab each section is on</div><div class="hint">Sections appear here once they've been seen on this device.</div>${secs}
    <div class="f" style="margin-top:8px"><label class="bk-radio"><input type="checkbox" id="u15-dnsask" ${(D.settings.u15 || {}).dnsWarn === false ? '' : 'checked'}> Ask to add a ⛔ farm warning when "Do not service" is ticked</label></div></div>`; }
function u15FavCard() { const m = u15LS('bvp-favmode', 'device'); return `<div class="card"><h3>⭐ Favourites</h3><div class="f"><label for="u15-fav">Favourites on this device</label><select id="u15-fav"><option value="device" ${m === 'device' ? 'selected' : ''}>This device's own favourites</option><option value="all" ${m === 'all' ? 'selected' : ''}>The same favourites on every device</option></select><div class="hint">"Every device" shares one list — a ⭐ added on any device that uses it shows on all of them.</div></div></div>`; }
if (typeof renderSettings === 'function') renderSettings = (function (orig) { return function () { let html = orig.apply(this, arguments); const at = html.lastIndexOf('</div>'); return at > 0 ? html.slice(0, at) + u15SettingsCard() + u15FavCard() + html.slice(at) : html + u15SettingsCard() + u15FavCard(); }; })(renderSettings);
async function u15Save(label, fn) { if (!needAdmin()) { renderAll(); return; } const c = JSON.parse(JSON.stringify(u15Cfg(U15.setPg))); fn(c); if (!(await ask(label + '?<br><span class="hint">Applies on every device.</span>', 'Yes'))) { renderAll(); return; } u15SetCfg(U15.setPg, c); NEXT_LOG_LABEL = `${U15_PAGES[U15.setPg]} tabs: ${label}`; S.skipConfirm = true; await changed(); }
document.addEventListener('change', async (e) => { const el = e.target; if (!el) return;
  if (el.id === 'u15-setpg') { U15.setPg = el.value; renderAll(); return; }
  if (el.id === 'u15-open') { const pg = el.dataset.pg; const v = el.value; const l = el.options[el.selectedIndex].text; if (!(await ask(`${h(U15_PAGES[pg])} on this device: ${h(l)}?`, 'Yes'))) { renderAll(); return; } u15DevSet((d) => { d.open = d.open || {}; d.open[pg] = v; }); delete U15.cur[pg]; toast('✓ Saved for this device'); renderAll(); return; }
  if (el.classList.contains('u15-smap')) { const k = el.dataset.k, v = el.value; await u15Save(`"${k}" goes on ${v === 'top' ? 'every tab (above the tabs)' : 'the ' + (u15Cfg(U15.setPg).tabs.find((t) => t.id === v) || {}).n + ' tab'}`, (c) => { c.map[k] = v; }); return; }
  if (el.classList.contains('u15-tname')) { const id = el.dataset.id, v = el.value.trim(); if (!v) { toast('Give the tab a name'); renderAll(); return; } await u15Save(`Rename the tab to "${v}"`, (c) => { const t = c.tabs.find((x) => x.id === id); if (t) t.n = v; }); return; }
  if (el.id === 'u15-dnsask') { const on = el.checked; if (!(await ask(on ? 'Ask to add a ⛔ farm warning when "Do not service" is ticked?' : 'Stop asking to add a ⛔ farm warning when "Do not service" is ticked?', 'Yes'))) { el.checked = !on; return; } D.settings.u15 = { ...(D.settings.u15 || {}), dnsWarn: on }; touch(D.settings); S.skipConfirm = true; NEXT_LOG_LABEL = 'Do not service warning question ' + (on ? 'on' : 'off'); await changed(); return; }
  if (el.id === 'u15-fav') { const v = el.value, was = u15LS('bvp-favmode', 'device'); if (v === was) return; const mine = [...favSet()];
    const ok = await ask(v === 'all' ? `Use the same favourites on every device?<br>Copy this device's ${mine.length} favourite${mine.length === 1 ? '' : 's'} into the shared list too?` : `Use this device's own favourites?<br>Start with the shared ones (${(D.settings.favsAll || []).length}) copied onto this device?`, 'Yes — copy them', 'No — don\'t copy');
    if (v === 'all' && ok) { D.settings.favsAll = [...new Set([...(D.settings.favsAll || []), ...mine])]; touch(D.settings); save(); if (window.Sync) Sync.soon(); }
    if (v === 'device' && ok) savePref('favs', [...new Set([...(Array.isArray(PREF.favs) ? PREF.favs : []), ...(D.settings.favsAll || [])])]);
    u15LSset('bvp-favmode', v); FAVS = null; u15FavSync(); toast(v === 'all' ? '✓ This device now uses the shared favourites' : '✓ This device now has its own favourites'); renderAll(); } });
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act^=u15-t]'); if (!el || el.dataset.act === 'u15-tab') return; e.preventDefault(); e.stopPropagation(); const a = el.dataset.act;
  if (a === 'u15-tadd') { const n = (prompt('Name for the new tab') || '').trim(); if (!n) return; await u15Save(`Add a "${n}" tab`, (c) => { c.tabs.push({ id: 't' + Date.now().toString(36), n }); }); }
  if (a === 'u15-tdel') { const C = u15Cfg(U15.setPg); const t = C.tabs.find((x) => x.id === el.dataset.id); if (!t) return; await u15Save(`Delete the "${t.n}" tab (its sections move to "${C.tabs.find((x) => x.id !== t.id).n}")`, (c) => { c.tabs = c.tabs.filter((x) => x.id !== t.id); Object.keys(c.map).forEach((k) => { if (c.map[k] === t.id) delete c.map[k]; }); }); }
  if (a === 'u15-tmv') { const id = el.dataset.id, d = +el.dataset.d; await u15Save('Move the tab ' + (d < 0 ? 'up' : 'down'), (c) => { const i = c.tabs.findIndex((x) => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= c.tabs.length) return; [c.tabs[i], c.tabs[j]] = [c.tabs[j], c.tabs[i]]; }); }
  if (a === 'u15-treset') { if (!needAdmin()) return; if (!(await ask(`Put the ${h(U15_PAGES[U15.setPg])} back to the standard tabs?`, 'Yes'))) return; const all = { ...(D.settings.u15tabs || {}) }; delete all[U15.setPg]; D.settings.u15tabs = all; touch(D.settings); NEXT_LOG_LABEL = `${U15_PAGES[U15.setPg]} tabs: back to standard`; S.skipConfirm = true; await changed(); } }, true);
/* drag a tab to a new place */
document.addEventListener('pointerup', () => setTimeout(async () => { const box = document.querySelector('[data-dnd^="u15tabs:"]'); if (!box || !S.admin) return; const pg = box.dataset.dnd.slice(8); const order = [...box.querySelectorAll(':scope > .dragrow')].map((r) => r.dataset.dk); const C = u15Cfg(pg);
  if (order.join() === C.tabs.map((t) => t.id).join()) return; const c = JSON.parse(JSON.stringify(C)); c.tabs = order.map((id) => c.tabs.find((t) => t.id === id)).filter(Boolean); u15SetCfg(pg, c); NEXT_LOG_LABEL = `${U15_PAGES[pg]} tabs reordered`; S.skipConfirm = true; await changed(); }, 30));

/* ================= 6. ⭐ favourites: this device's own, or shared ================= */
function u15FavSync() { if (u15LS('bvp-favmode', 'device') === 'all') FAVS = new Set(Array.isArray(D.settings.favsAll) ? D.settings.favsAll : []); }
if (typeof setFav === 'function') setFav = (function (orig) { return function (c, on) { if (u15LS('bvp-favmode', 'device') !== 'all') return orig.apply(this, arguments); const L = new Set(D.settings.favsAll || []); if (on) L.add(c.id); else L.delete(c.id); D.settings.favsAll = [...L]; touch(D.settings); save(); if (window.Sync) Sync.soon(); FAVS = new Set(L); }; })(setFav);
if (typeof renderAll === 'function') renderAll = (function (orig) { return function () { try { u15FavSync(); } catch (e) { } return orig.apply(this, arguments); }; })(renderAll);

/* ================= jobs, look, check jobs ================= */
if (typeof herdJobs === 'function') herdJobs = (function (orig) { return function () { let L = []; try { L = orig.apply(this, arguments) || []; } catch (e) { console.warn(e); } try { L = L.concat(u15NeverJobs()); } catch (e) { console.warn(e); } return L; }; })(herdJobs);
if (typeof herdJobHtml === 'function') herdJobHtml = (function (orig) { return function (j) { if (!j || !j.u15never) return orig.apply(this, arguments); const L = u15NeverList();
  return `</div><div style="width:100%">${L.map((x) => `<div class="kv"><div class="v">${typeof u13BizA === 'function' ? u13BizA(x.b) : h(x.b.name)}${x.L.map(([w, t]) => `<div class="hint">Has ${w} tested — ${t.yr} ${h(t.src)}</div>`).join('')}</div></div>`).join('')}
    <div class="actions"><button class="btn small primary" data-act="u15-never">✓ Clear the ticks</button><button class="btn small" data-act="job-dismiss" data-key="${h(j.key)}">Leave them</button></div></div><div>`; }; })(herdJobHtml);
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=u15-never]'); if (!el) return; e.preventDefault(); e.stopPropagation(); const n = await u15ClearNever(); if (n) toast(`✓ Cleared for ${n} client${n === 1 ? '' : 's'}`); }, true);
(function () { const st = document.createElement('style'); st.textContent = `.u15-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px;padding:4px 0;border-bottom:2px solid var(--line)}.u15-tab{border:1px solid var(--line);background:var(--card,#fff);color:var(--ink);border-radius:999px;padding:7px 12px;font-size:14px;font-weight:600;cursor:pointer;line-height:1.1}.u15-tab.on{background:var(--ink);color:#fff;border-color:var(--ink)}.u15-n{font-weight:400;opacity:.65;font-size:12px}.u15-off{display:none!important}.u15-auto{color:#8a5a00;font-size:12px;font-style:italic;margin-top:2px}.u15-can .bk-radio{display:flex;margin:2px 0}.u15-sugedit{margin:4px 0 0 26px}.u15-sugedit textarea{width:100%;font:inherit;font-size:14px}.u15-sugedit select{width:100%;margin-top:2px}.bk-canlbl{color:var(--ink3);font-size:13px}@media (max-width:420px){.u15-tab{padding:6px 9px;font-size:13px}}`; document.head.appendChild(st); })();
if (typeof BOXES !== 'undefined' && !BOXES.some((x) => x.k === 'u15tab')) BOXES.push({ k: 'u15tab', l: 'Page tabs — the chosen tab', sel: '.u15-tab.on', txt: '.u15-tab.on', sample: '<button class="u15-tab on">Details</button>', d: { bg: '#141414', fg: '#ffffff', bd: '#141414', bold: true } });
if (typeof SETUP !== 'undefined' && typeof U8_TRY !== 'undefined') [
  ['chk252-rules', 'Check: 📋 booking rules only under Scheduling', 'Open a client business that has preg / bull testing comments. There\'s no separate "📋 Booking rules" card any more — who to book under and the comments are only in 📅 Scheduling.', 'u13:biz'],
  ['chk252-can', 'Check: ✅ what can be booked at each farm', 'Business → 📅 Scheduling → tap a farm. "What can be booked here" is ticks: Everything, Preg testing, Bull testing, Individual animals / emergencies, ⛔ Do not service. Ticking Do not service unticks the rest and asks to add a ⛔ warning to the farm. A farm with a do-not-service warning shows it ticked automatically. On the card it reads "What can be booked here: …".', 'u13:biz'],
  ['chk252-never', 'Check: 🆕 "has not tested before" cleared from history', 'A client with preg or bull testing in their invoices, appointments or call sheets no longer shows "has not tested before" (it says it was cleared automatically). Jobs → "Has not tested before ticked, but they have" → ✓ Clear the ticks.', 'u13:jobs'],
  ['chk252-ginfo', 'Check: 📋 booking info job — rates and comments', 'Jobs → "Booking info to move": each yard\'s head-per-hour box has the rate already set, or the default rate with a red "This is the default rate". Under 💡, each comment can be changed and sent to preg testing, bull testing or general booking comments, or removed.', 'u13:jobs'],
  ['chk252-tabs', 'Check: 🗂 tabs on the business, person, patient and record pages', 'Open a business: tabs (Details · Scheduling · Patients · Records & appointments · Comms & attachments · Account) with warnings above them. Same on a person, a patient and a record. Settings → Contacts → 🗂 Page tabs: rename, add, delete and move tabs, choose which tab each section is on, and which tab opens on this device (or the last one used).', 'u13:biz'],
  ['chk252-fav', 'Check: ⭐ favourites per device or shared', 'Settings → Contacts → ⭐ Favourites: choose "The same favourites on every device" on two devices, star someone on one — it shows on the other after syncing.', 'settings']
].forEach(([id, t, tryIt, go]) => { U8_TRY[id] = tryIt; U8_TO[id] = go; if (SETUP.some((x) => x.id === id)) return; SETUP.push({ id, t, steps: [tryIt, `<button type="button" class="btn small" data-act="u8-go" data-go="${go}">➡️ Take me there</button>`, 'If it does what you want, tick <b>✓ Done</b>. If not, tell Claude what\'s wrong.'] }); });
