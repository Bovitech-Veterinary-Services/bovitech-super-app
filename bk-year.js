/* Bovitech Super App — Scheduling: yearly events and reminders (stocktake, lab prices, calving supplies …)
   and bulk scheduling lists (bull testing, preg testing and AI — early and late — plus biosecurity plan,
   J-BAS and NFAS reviews). Everything here is changed in Settings → Scheduling. */
'use strict';
const BK_YR_RULES = { firstwork: 'First working day of', lastdow: 'Last weekday on or before', date: 'Every year on' };
const BK_DOWS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BK_MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BK_YEARLY_DEF = [
  { id: 'yr-stock', cfg: 'yearly', order: 1, name: 'Annual stocktake', kind: 'event', rule: { t: 'lastdow', dow: 1, month: 6, day: 30 } },
  { id: 'yr-labprice', cfg: 'yearly', order: 2, name: 'Update lab prices in ezyVet', kind: 'reminder', rule: { t: 'firstwork', month: 8 } },
  { id: 'yr-calving', cfg: 'yearly', order: 3, name: 'Send the bulk email about ordering calving supplies', kind: 'reminder', rule: { t: 'firstwork', month: 1 } },
];
const BK_BULK_DEF = [
  { id: 'bl-bbse-early', cfg: 'bulk', order: 1, name: 'Bull testing — pre-sale season testers (Dec–Feb)', note: 'Test their bulls before the January / February bull sales, so they can buy replacements if needed', svc: 'svc-bull', key: 'bbse', val: 'early', rule: { t: 'firstwork', month: 12 } },
  { id: 'bl-bbse-spring', cfg: 'bulk', order: 2.5, name: 'Bull testing — spring calvers (Jul–Nov bull testing)', note: 'Spring calving herds — test their bulls before spring / summer mating', svc: 'svc-bull', key: 'bbse', val: 'spring', rule: { t: 'firstwork', month: 6 } },
  { id: 'bl-bbse-late', cfg: 'bulk', order: 2, name: 'Bull testing — autumn calvers (Mar–Jun bull testing)', note: 'Autumn calving herds — test their bulls closer to mating', svc: 'svc-bull', key: 'bbse', val: 'late', rule: { t: 'firstwork', month: 2 } },
  { id: 'bl-pd-early', cfg: 'bulk', order: 3, name: 'Preg testing — early testers (autumn calving)', note: 'Autumn calving herds', svc: 'svc-preg', key: 'pd', val: 'early', rule: { t: 'firstwork', month: 6 } },
  { id: 'bl-pd-late', cfg: 'bulk', order: 4, name: 'Preg testing — late testers (spring calving)', note: 'Spring calving herds', svc: 'svc-preg', key: 'pd', val: 'late', rule: { t: 'firstwork', month: 12 } },
  { id: 'bl-ai-early', cfg: 'bulk', order: 5, name: 'AI — early programs (autumn calving)', note: 'Autumn calving herds', svc: 'svc-ai', key: 'ai', val: 'early', rule: { t: 'firstwork', month: 1 } },
  { id: 'bl-ai-other', cfg: 'bulk', order: 7, name: 'AI — off-season / other times (Jan–Mar)', note: 'Clients who have started AI programs in January to March', svc: 'svc-ai', key: 'ai', val: 'other', rule: { t: 'firstwork', month: 10 } },
  { id: 'bl-ai-late', cfg: 'bulk', order: 6, name: 'AI — late programs (spring calving)', note: 'Spring calving herds', svc: 'svc-ai', key: 'ai', val: 'late', rule: { t: 'firstwork', month: 5 } },
];
const BK_BULK_KEYS = { bbse: 'Bull testing', pd: 'Preg testing', ai: 'AI' };
const BK_REVIEWS = [['bio', 'Biosecurity plan review', 12], ['jbas', 'J-BAS', 36], ['nfas', 'NFAS review', 6]];
const BK_OPEN_DAYS = 120; // a bulk list stays open (in Jobs) this long after its date

/* ---------------- dates ---------------- */
const bkWorkDay = (d) => ![0, 6].includes(bkDow(d)) && !bkHoliday(d);
function bkRuleDate(rule, year) { // the date a yearly rule falls on in a year
  if (!rule) return null; const mm = String(rule.month || 1).padStart(2, '0');
  if (rule.t === 'firstwork') { let d = `${year}-${mm}-01`; for (let i = 0; i < 15 && !bkWorkDay(d); i++) d = bkAdd(d, 1); return d; }
  if (rule.t === 'lastdow') { const dim = new Date(Date.UTC(year, rule.month || 1, 0)).getUTCDate(); let d = `${year}-${mm}-${String(Math.min(rule.day || 28, dim)).padStart(2, '0')}`; for (let i = 0; i < 7 && bkDow(d) !== (rule.dow ?? 1); i++) d = bkAdd(d, -1); return d; }
  if (rule.t === 'date') { const dim = new Date(Date.UTC(year, rule.month || 1, 0)).getUTCDate(); return (rule.day || 1) > dim ? null : `${year}-${mm}-${String(rule.day || 1).padStart(2, '0')}`; }
  return null;
}
function bkRuleWordsY(rule) { if (!rule) return ''; const m = BK_MONTHS_LONG[(rule.month || 1) - 1];
  return rule.t === 'firstwork' ? `First working day of ${m}` : rule.t === 'lastdow' ? `Last ${BK_DOWS[rule.dow ?? 1]} on or before ${rule.day || 28} ${m}` : `${rule.day || 1} ${m} every year`; }
function bkYearly() { return Bk.cfg('yearly'); }
function bkYearlyOn(date) { const y = +date.slice(0, 4); return bkYearly().filter((x) => bkRuleDate(x.rule, y) === date); }
const bkYearChips = (date, short) => bkYearlyOn(date).map((x) => `<span class="bk-yev" title="${h(x.name)}">${x.kind === 'reminder' ? '🔔' : '📌'} ${h(short && x.name.length > 22 ? x.name.slice(0, 20) + '…' : x.name)}</span>`).join('');
function bkYearRefresh() { // keep each item's dates for this year and the next two (the server's Google Calendar sync reads these)
  if (!D || !D.sync || !D.sync.last) return 0; const y = +bkToday().slice(0, 4); let n = 0;
  [...bkYearly(), ...Bk.cfg('bulk')].forEach((x) => { const ds = [y, y + 1, y + 2].map((yy) => bkRuleDate(x.rule, yy)).filter(Boolean); if (JSON.stringify(ds) !== JSON.stringify(x.dates || [])) { x.dates = ds; touch(x); n++; } });
  if (n) save(); return n;
}
function bkYearSeed() { // the starting yearly events and bulk lists (fixed ids, so devices never double up)
  if (!D || !D.sync || !D.sync.last || !Bk.list('bkcfg').length) return; let n = 0;
  [...BK_YEARLY_DEF, ...BK_BULK_DEF].forEach((d) => { if (!Bk.get(d.id)) { const r = bkClone(d); touch(r); D.bkcfg.push(r); n++; } });
  [['bl-bbse-early', 'Bull testing — early testers'], ['bl-bbse-late', 'Bull testing — late testers']].forEach(([id, old]) => { const r = Bk.get(id); const d = BK_BULK_DEF.find((x) => x.id === id); if (r && d && r.name === old) { r.name = d.name; r.note = d.note; touch(r); n++; } }); // new names (Nov 2026)
  if (n) save(); bkYearRefresh();
}

/* ---------------- yearly reminders → Jobs ---------------- */
function bkYearJobs() { const t = bkToday(), y = +t.slice(0, 4), out = [];
  bkYearly().filter((x) => x.kind === 'reminder').forEach((x) => { [y - 1, y].forEach((yy) => { const d = bkRuleDate(x.rule, yy); if (!d || d > t || d < bkAdd(t, -60) || (x.done || {})[yy]) return; out.push({ k: 'year', yr: x, yy, t: 'Yearly reminder', d: `${x.name} — ${bkDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}` }); }); });
  Bk.cfg('bulk').forEach((l) => { const o = bkBulkOpen(l); if (!o) return; const rows = bkBulkRows(l, o.year); const left = rows.filter((r) => !r.st).length; if (left) out.push({ k: 'bulk', bl: l, t: 'Bulk scheduling', d: `${l.name}: ${left} client${left === 1 ? '' : 's'} to contact (opened ${bkDate(o.date)})` }); });
  bkReviewRows().filter((r) => r.due <= bkAdd(t, 30)).forEach((r) => out.push({ k: 'review', rv: r, t: 'Review due', d: `${r.what} — ${r.name}: ${r.due < t ? 'overdue since' : 'due'} ${bkDate(r.due, { day: 'numeric', month: 'short', year: 'numeric' })}` }));
  return out;
}

/* ---------------- bulk lists ---------------- */
function bkCattleClient(b) { if (!b || b.gone || (typeof isClientBiz === 'function' && !isClientBiz(b))) return false; if (typeof bizCat === 'function' && typeof INACT !== 'undefined' && INACT.includes(bizCat(b))) return false;
  return (b.patientIds || []).some((p) => /cattle|herd|bovine/i.test(p.label || '')) || (b.farms || []).some((f) => f && f.pinType === 'cattle'); }
function bkBulkOpen(l) { const t = bkToday(), y = +t.slice(0, 4); for (const yy of [y, y - 1]) { const d = bkRuleDate(l.rule, yy); if (d && d <= t && d > bkAdd(t, -BK_OPEN_DAYS)) return { year: yy, date: d }; } return null; }
function bkBulkNext(l) { const t = bkToday(), y = +t.slice(0, 4); for (const yy of [y, y + 1]) { const d = bkRuleDate(l.rule, yy); if (d && d > t) return d; } return null; }
const bkBulkRun = (l, year) => Bk.get(`bulkrun:${l.id}:${year}`) || { st: {} };
function bkBulkRows(l, year) { // the clients on a list: marked for it, plus cattle clients not sorted yet
  const run = bkBulkRun(l, year); const out = [];
  (D.businesses || []).forEach((b) => { const bs = Bk.bsched(b.id), v = (bs.bulk || {})[l.key];
    const hi = (bs.hist || {})[l.key] || {};
    if (v === l.val || (v === 'both' && !['other', 'spring'].includes(l.val)) || (!v && !['other', 'spring'].includes(l.val) && bkCattleClient(b))) { const last = bkLastSvc(b.id, l.svc); const y0 = +bkToday().slice(0, 4); const reg = (last && +last.slice(0, 4) >= y0 - 1) || (hi.last && +hi.last.slice(0, 4) >= y0 - 1) || false; out.push({ b, sorted: !!v, both: v === 'both', st: run.st[b.id] || '', last: last || hi.last || null, reg, hi }); } });
  return out.sort((a, c) => (a.reg === c.reg ? 0 : a.reg ? -1 : 1) || (a.sorted === c.sorted ? 0 : a.sorted ? -1 : 1) || (a.b.name || '').localeCompare(c.b.name || '')); // regular testers first
}
function bkLastSvc(bid, svc) { let best = null; Bk.list('bookings').forEach((x) => { if (x.bid === bid && Bk.live(x) && x.date <= bkToday() && (x.svcs || []).some((s) => s.svc === svc) && (!best || x.date > best)) best = x.date; }); return best; }
function bkBulkSet(l, year, bid, st) { const id = `bulkrun:${l.id}:${year}`; let r = Bk.get(id); if (!r) { r = { id, cfg: 'bulkrun', list: l.id, year, st: {} }; D.bkcfg.push(r); } r.st = { ...(r.st || {}), [bid]: st }; if (!st) delete r.st[bid]; touch(r); save(); Sync.soon(); }
function bkBulkMark(bid, key, val) { const id = 'bsched:' + bid; let r = Bk.get(id); const b = IDX.biz.get(bid); if (!r) { r = { id, cfg: 'bsched', bid, name: b ? b.name : '' }; D.bkcfg.push(r); } r.bulk = { ...(r.bulk || {}), [key]: val }; delete r.gone; touch(r); save(); Sync.soon(); }
function bkReviewRows() { const out = [];
  Bk.cfg('bsched').forEach((bs) => { const b = IDX.biz.get(bs.bid); if (!b || b.gone) return; BK_REVIEWS.forEach(([k, what, months]) => { const rv = (bs.reviews || {})[k]; if (!rv || !rv.on) return;
    const due = rv.last ? bkAddMonths(rv.last, months) : bkToday(); out.push({ bid: b.id, name: b.name, k, what, due, last: rv.last || null }); }); });
  return out.sort((a, c) => a.due.localeCompare(c.due));
}
function bkAddMonths(d, m) { const [y, mo, da] = d.split('-').map(Number); const t = new Date(Date.UTC(y, mo - 1 + m, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(da, last)).padStart(2, '0')}`; }
const BK_BST = { contacted: ['Contacted', '#e3edfb', '#14315f'], added: ['On "To schedule"', '#ffe8d1', '#7a3300'], booked: ['Booked', '#e3f5e6', '#1d5b2c'], no: ['Not this year', '#ececec', '#555'] };
function bkPrimaryMobile(b) { const ids = typeof bkSmsTo === 'function' ? bkSmsTo(b.id) : []; const c = ids.map((id) => D.contacts.find((x) => x.id === id)).find(Boolean); return c ? bkMobile(c) : ''; }
function bkBulkHtml() { // Scheduling → Bulk lists
  const t = bkToday(); const lists = Bk.cfg('bulk'); const rv = bkReviewRows();
  const listCard = (l) => { const o = bkBulkOpen(l); const year = o ? o.year : +t.slice(0, 4); const show = o || BK.bulkShow === l.id; const rows = show ? bkBulkRows(l, year) : [];
    const left = rows.filter((r) => !r.st).length; const nx = bkBulkNext(l);
    return `<div class="card"><h3><span class="sp">${h(l.name)}</span>${o ? `<span class="bk-pill open">Open — ${left} to contact</span>` : ''}</h3><div class="hint">${h(l.note || '')}<br>${h(bkRuleWordsY(l.rule))}${o ? ` · opened ${bkDate(o.date, { day: 'numeric', month: 'short', year: 'numeric' })}` : nx ? ` · next opens ${bkDate(nx, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</div>
      ${show ? `${rows.length ? `<div class="actions"><button class="btn small" data-act="bkb-copy" data-id="${l.id}" data-y="${year}">📋 Copy the mobiles of everyone not contacted yet</button></div>` : ''}${rows.map((r, ri) => { const s = BK_BST[r.st]; const mob = bkPrimaryMobile(r.b); const grp = ri === 0 || rows[ri - 1].reg !== r.reg ? `<div class="lbl bk-bulkgrp">${r.reg ? `✅ Regular ${l.key === 'ai' ? 'AI clients' : 'testers'} (${rows.filter((x) => x.reg).length}) — did it this year or last` : `Not regular (${rows.filter((x) => !x.reg).length}) — still ask them`}</div>` : '';
        return `${grp}<div class="bk-bulkrow"><div class="v"><b>${h(r.b.name)}</b>${r.both ? ' <span class="bk-pill" title="Tests more than once a year — on both lists">🔁 more than once a year</span>' : ''}${s ? ` <span class="bk-pill" style="background:${s[1]};color:${s[2]}">${s[0]}</span>` : ''}${r.sorted ? '' : ` <span class="bk-pill">${h(BK_BULK_KEYS[l.key])} timing not set</span>`}<br><span class="hint">${r.last ? 'Last ' + h(Bk.svc(l.svc).name || '').toLowerCase() + ' ' + bkDate(r.last, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not booked for this before'}${mob ? ' · ' + h(mob) : ''}${typeof bkHistLine === 'function' ? bkHistLine(r, l) : ''}</span></div>
          <div class="actions">${r.sorted ? '' : `<button class="btn small" data-act="bkb-mark" data-bid="${r.b.id}" data-k="${l.key}" data-v="early">Early</button><button class="btn small" data-act="bkb-mark" data-bid="${r.b.id}" data-k="${l.key}" data-v="late">Late</button><button class="btn small" data-act="bkb-mark" data-bid="${r.b.id}" data-k="${l.key}" data-v="both">🔁 Both</button>${l.key === 'bbse' ? `<button class="btn small" data-act="bkb-mark" data-bid="${r.b.id}" data-k="${l.key}" data-v="spring">Spring</button>` : ''}<button class="btn small" data-act="bkb-mark" data-bid="${r.b.id}" data-k="${l.key}" data-v="no">Doesn't do it</button>`}
          ${mob ? `<a class="btn small" href="tel:${h(mob.replace(/\s/g, ''))}">📞</a>${smsBtns({ phone: mob, bid: r.b.id, who: r.b.name, cls: 'btn small' })}` : ''}
          <button class="btn small" data-act="bkb-st" data-id="${l.id}" data-y="${year}" data-bid="${r.b.id}" data-v="contacted">Contacted</button><button class="btn small" data-act="bkb-add" data-id="${l.id}" data-y="${year}" data-bid="${r.b.id}">➕ To schedule</button><button class="btn small" data-act="bkb-st" data-id="${l.id}" data-y="${year}" data-bid="${r.b.id}" data-v="booked">✓ Booked</button><button class="btn small" data-act="bkb-st" data-id="${l.id}" data-y="${year}" data-bid="${r.b.id}" data-v="no">Not this year</button>${r.st ? `<button class="btn small" data-act="bkb-st" data-id="${l.id}" data-y="${year}" data-bid="${r.b.id}" data-v="">↶</button>` : ''}</div></div>`; }).join('') || '<div class="hint">No clients on this list.</div>'}` : `<div class="actions"><button class="btn small" data-act="bkb-show" data-id="${l.id}">Show the list now</button></div>`}</div>`; };
  return `<div class="hint" style="margin-bottom:8px">Each list opens on its date (change the dates in Settings → Scheduling → Bulk scheduling lists) and shows in Jobs until everyone's been contacted. Clients are on a list when their business page says so (📅 Bulk lists), and cattle clients that haven't been sorted yet show on both early and late lists — tap Early or Late once and they're sorted for every year.</div>
  ${typeof bkHistCard === 'function' ? bkHistCard() : ''}
  ${lists.map(listCard).join('')}
  <div class="card"><h3>Biosecurity plan, J-BAS and NFAS reviews</h3><div class="hint" style="margin-bottom:6px">For clients marked on their business page (📅 Bulk lists): biosecurity plan reviews every year, J-BAS every 3 years and NFAS every 6 months, from the date of the last one.</div>
    ${rv.map((r) => `<div class="bk-bulkrow ${r.due < t ? 'over' : ''}"><div class="v"><b>${h(r.name)}</b> — ${h(r.what)}<br><span class="hint">${r.last ? 'Last done ' + bkDate(r.last, { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' : 'Never done · '}${r.due < t ? '<b style="color:var(--red)">due since</b> ' : 'due '}${bkDate(r.due, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div><div class="actions"><button class="btn small" data-act="bkb-revadd" data-bid="${r.bid}" data-k="${r.k}">➕ To schedule</button><button class="btn small" data-act="bkb-revdone" data-bid="${r.bid}" data-k="${r.k}">✓ Done today</button></div></div>`).join('') || '<div class="hint">No clients marked yet.</div>'}</div>`;
}
function bkBizBulk(b) { // the business page: which bulk lists this client is on
  const bs = Bk.bsched(b.id); const bu = bs.bulk || {}; const rv = bs.reviews || {}; const cattle = bkCattleClient(b);
  const words = Object.entries(BK_BULK_KEYS).map(([k, l]) => { const v = bu[k]; return v === 'early' ? `${l}: early` : v === 'late' ? `${l}: late` : v === 'both' ? `${l}: early and late` : v === 'spring' ? `${l}: spring calvers` : v === 'other' ? `${l}: off-season` : v === 'no' ? `${l}: doesn't do it` : cattle ? `${l}: not sorted yet` : ''; }).filter(Boolean);
  const rvs = BK_REVIEWS.filter(([k]) => (rv[k] || {}).on).map(([k, l, m]) => `${l}${rv[k].last ? ' — last ' + bkDate(rv[k].last, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`);
  return `<div class="kv bk-tap" data-act="bkb-edit" data-bid="${b.id}"><div class="k">Bulk lists</div><div class="v">${words.length ? words.map(h).join('<br>') : 'Not on any'}${rvs.length ? `<div class="bk-spnote">${rvs.map(h).join('<br>')}</div>` : ''}</div></div>`;
}
window.bkBizBulk = bkBizBulk;
function bkBulkEdit(bid) {
  const b = IDX.biz.get(bid); if (!b || !Bk.need('book')) return; const bs = Bk.bsched(bid); const bu = bs.bulk || {}; const rv = bs.reviews || {};
  const sel = (k) => `<select id="bkbe-${k}"><option value="">Not sorted yet</option><option value="early" ${bu[k] === 'early' ? 'selected' : ''}>Early</option><option value="late" ${bu[k] === 'late' ? 'selected' : ''}>Late</option><option value="both" ${bu[k] === 'both' ? 'selected' : ''}>🔁 Both (more than once a year)</option>${k === 'bbse' ? `<option value="spring" ${bu[k] === 'spring' ? 'selected' : ''}>Spring calvers (Jul–Nov)</option>` : ''}${k === 'ai' ? `<option value="other" ${bu[k] === 'other' ? 'selected' : ''}>Off-season (Jan–Mar)</option>` : ''}<option value="no" ${bu[k] === 'no' ? 'selected' : ''}>Doesn't do it</option></select>`;
  openSheet('Bulk lists — ' + b.name, `<div class="hint" style="margin-bottom:8px">Which bulk scheduling lists this client is on (Scheduling → Bulk lists).</div>
    <div class="grid2"><div class="f"><label for="bkbe-bbse">Bull testing</label>${sel('bbse')}<div class="hint">Pre-sale season: Dec–Feb, before the bull sales. Autumn calvers: Mar–Jun. Spring calvers: Jul–Nov.</div></div><div class="f"><label for="bkbe-pd">Preg testing</label>${sel('pd')}<div class="hint">Early: autumn calving. Late: spring calving.</div></div></div>
    <div class="f"><label for="bkbe-ai">AI</label>${sel('ai')}<div class="hint">Early: autumn calving. Late: spring calving.</div></div>
    ${BK_REVIEWS.map(([k, l, m]) => `<div class="f"><label class="bk-radio"><input type="checkbox" id="bkbe-r-${k}" ${(rv[k] || {}).on ? 'checked' : ''}> ${l} (every ${m === 12 ? 'year' : m === 36 ? '3 years' : m + ' months'})</label><div class="bk-hrow"><span class="hint">Last done</span><input type="date" id="bkbe-l-${k}" value="${h((rv[k] || {}).last || '')}"></div></div>`).join('')}`, () => {
    const id = 'bsched:' + bid; let r = Bk.get(id); if (!r) { r = { id, cfg: 'bsched', bid, name: b.name }; D.bkcfg.push(r); }
    r.bulk = {}; Object.keys(BK_BULK_KEYS).forEach((k) => { const v = document.getElementById('bkbe-' + k).value; if (v) r.bulk[k] = v; });
    r.reviews = {}; BK_REVIEWS.forEach(([k]) => { const on = document.getElementById('bkbe-r-' + k).checked, last = document.getElementById('bkbe-l-' + k).value; if (on || last) r.reviews[k] = { on, last: last || null }; });
    delete r.gone; touch(r); save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}

/* ---------------- settings ---------------- */
function bkYearCard(ed) {
  return `<div class="card"><h3><span class="sp">Yearly events and reminders</span>${ed ? '<button class="btn small" data-act="bky-new">➕ New</button>' : ''}</h3><div class="hint" style="margin-bottom:6px">Shown on the calendar every year (📌 events, 🔔 reminders) and on the shared on-call Google Calendar. Reminders also go in Scheduling → Jobs on the day, until someone ticks them done.</div>
    ${bkYearly().map((x) => { const d = bkRuleDate(x.rule, +bkToday().slice(0, 4)); const nx = d && d >= bkToday() ? d : bkRuleDate(x.rule, +bkToday().slice(0, 4) + 1); return `<div class="kv ${ed ? 'bk-tap' : ''}" ${ed ? `data-act="bky-edit" data-id="${x.id}"` : ''}><div class="v"><b>${x.kind === 'reminder' ? '🔔' : '📌'} ${h(x.name)}</b><br><span class="hint">${h(bkRuleWordsY(x.rule))}${nx ? ' · next ' + bkDate(nx, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span></div></div>`; }).join('') || '<div class="hint">None yet.</div>'}</div>`;
}
function bkBulkCard(ed) {
  return `<div class="card"><h3>Bulk scheduling lists</h3><div class="hint" style="margin-bottom:6px">When each list opens (Scheduling → Bulk lists). Tap one to change its date.</div>
    ${Bk.cfg('bulk').map((l) => `<div class="kv ${ed ? 'bk-tap' : ''}" ${ed ? `data-act="bky-edit" data-id="${l.id}"` : ''}><div class="v"><b>${h(l.name)}</b><br><span class="hint">${h(bkRuleWordsY(l.rule))} · next ${bkBulkNext(l) ? bkDate(bkBulkNext(l), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span></div></div>`).join('')}</div>`;
}
function bkYearOpen(x, isNew) {
  const r = x ? bkClone(x) : { id: uid('yr'), cfg: 'yearly', order: 50, name: '', kind: 'reminder', rule: { t: 'firstwork', month: 1 } }; const bulk = r.cfg === 'bulk';
  const ru = r.rule || {}; const mon = (id, v) => `<select id="${id}">${BK_MONTHS_LONG.map((m, i) => `<option value="${i + 1}" ${+v === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select>`;
  openSheet(bulk ? r.name : x ? 'Yearly event or reminder' : 'New yearly event or reminder', `${bulk ? '' : `<div class="f"><label for="bky-name">Name</label><input id="bky-name" value="${h(r.name)}"></div>
    <div class="f"><label for="bky-kind">Type</label><select id="bky-kind"><option value="event" ${r.kind === 'event' ? 'selected' : ''}>📌 Event (on the calendar)</option><option value="reminder" ${r.kind === 'reminder' ? 'selected' : ''}>🔔 Reminder (on the calendar and in Jobs until done)</option></select></div>`}
    <div class="f"><label for="bky-t">When</label><select id="bky-t">${Object.entries(BK_YR_RULES).map(([k, l]) => `<option value="${k}" ${ru.t === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="bk-hrow"><select id="bky-dow" ${ru.t === 'lastdow' ? '' : 'hidden'} aria-label="Weekday">${BK_DOWS.map((d, i) => `<option value="${i}" ${(ru.dow ?? 1) === i ? 'selected' : ''}>${d}</option>`).join('')}</select><input id="bky-day" type="number" min="1" max="31" value="${ru.day || (ru.t === 'lastdow' ? 30 : 1)}" ${ru.t === 'firstwork' ? 'hidden' : ''} style="width:70px" aria-label="Day of the month">${mon('bky-month', ru.month || 1)}</div>
    <div class="hint" id="bky-prev"></div>`, () => {
    const g = (id) => document.getElementById(id);
    if (!bulk) { r.name = g('bky-name').value.trim(); if (!r.name) { toast('Give it a name'); return false; } r.kind = g('bky-kind').value; }
    r.rule = { t: g('bky-t').value, month: +g('bky-month').value }; if (r.rule.t !== 'firstwork') r.rule.day = +g('bky-day').value || 1; if (r.rule.t === 'lastdow') r.rule.dow = +g('bky-dow').value;
    const ex = Bk.get(r.id); if (ex) Object.assign(ex, r), touch(ex); else { touch(r); D.bkcfg.push(r); } bkYearRefresh(); save(); Sync.soon(); setTimeout(renderAll, 0); return true;
  }, !bulk && x ? `<button class="btn" data-act="bky-del" data-id="${r.id}" style="color:var(--red)">Delete</button>` : '');
  const sh = document.getElementById('sheet'); const prev = () => { const g = (id) => document.getElementById(id); const t = g('bky-t').value; g('bky-dow').hidden = t !== 'lastdow'; g('bky-day').hidden = t === 'firstwork';
    const rr = { t, month: +g('bky-month').value, day: +g('bky-day').value || 1, dow: +g('bky-dow').value }; const y = +bkToday().slice(0, 4); g('bky-prev').textContent = 'Falls on: ' + [y, y + 1, y + 2].map((yy) => bkRuleDate(rr, yy)).filter(Boolean).map((d) => bkDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })).join(' · '); };
  sh.addEventListener('change', prev); sh.addEventListener('input', prev); prev();
}

/* ---------------- taps ---------------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^(bky|bkb)-/.test(a)) return; const d = el.dataset;
  const L = d.id && Bk.get(d.id);
  switch (a) {
    case 'bky-new': if (Bk.need('settings')) bkYearOpen(null); break;
    case 'bky-edit': if (Bk.need('settings')) bkYearOpen(L); break;
    case 'bky-del': { if (!L || !(await ask(`Delete "${L.name}"?`, 'Delete', true))) return; L.gone = true; touch(L); save(); Sync.soon(); closeSheet(); renderAll(); break; }
    case 'bky-done': { const x = Bk.get(d.id); if (!x) return; x.done = { ...(x.done || {}), [d.y]: { at: Date.now(), by: SBAuth.staff && SBAuth.staff.id } }; touch(x); save(); Sync.soon(); renderAll(); toast('Done'); break; }
    case 'bkb-show': BK.bulkShow = d.id; renderAll(); break;
    case 'bkb-open': BK.page = 'bulk'; renderAll(); break;
    case 'bkb-edit': bkBulkEdit(d.bid); break;
    case 'bkb-mark': bkBulkMark(d.bid, d.k, d.v); renderAll(); break;
    case 'bkb-st': if (!L) return; bkBulkSet(L, +d.y, d.bid, d.v); renderAll(); break;
    case 'bkb-add': { if (!L) return; const b = IDX.biz.get(d.bid); const ids = typeof bkSmsTo === 'function' ? bkSmsTo(d.bid) : []; const p = { id: uid('pd'), type: (Bk.cfg('type').find((t) => t.where === 'farm') || Bk.cfg('type')[0] || {}).id, bid: d.bid, cid: ids[0] || null, svcs: [{ svc: L.svc, head: 0 }], notes: L.name, by: null, urgent: false, at: Date.now(), who: SBAuth.staff && SBAuth.staff.id };
      touch(p); Bk.list('bkpending').push(p); bkBulkSet(L, +d.y, d.bid, 'added'); toast(`${b ? b.name : 'Client'} added to "To schedule"`); renderAll(); break; }
    case 'bkb-copy': { if (!L) return; const nums = bkBulkRows(L, +d.y).filter((r) => !r.st).map((r) => bkPrimaryMobile(r.b)).filter(Boolean); if (!nums.length) { toast('No mobiles to copy'); return; } try { await navigator.clipboard.writeText(nums.join(', ')); toast(`${nums.length} mobile${nums.length === 1 ? '' : 's'} copied`); } catch (x) { toast("Couldn't copy"); } break; }
    case 'bkb-revadd': { const svc = Bk.cfg('service').find((s) => /consult|herd health/i.test(s.name)); const what = (BK_REVIEWS.find((x) => x[0] === d.k) || [])[1]; const ids = typeof bkSmsTo === 'function' ? bkSmsTo(d.bid) : [];
      const p = { id: uid('pd'), type: (Bk.cfg('type').find((t) => t.where === 'farm') || Bk.cfg('type')[0] || {}).id, bid: d.bid, cid: ids[0] || null, svcs: svc ? [{ svc: svc.id, head: 0 }] : [], notes: what, by: null, urgent: false, at: Date.now(), who: SBAuth.staff && SBAuth.staff.id }; touch(p); Bk.list('bkpending').push(p); save(); Sync.soon(); toast('Added to "To schedule"'); renderAll(); break; }
    case 'bkb-revdone': { const id = 'bsched:' + d.bid; const r = Bk.get(id); if (!r) return; r.reviews = r.reviews || {}; r.reviews[d.k] = { ...(r.reviews[d.k] || { on: true }), last: bkToday() }; touch(r); save(); Sync.soon(); renderAll(); toast('Marked done today'); break; }
  }
});
