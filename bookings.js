/* Bovitech Practice — Bookings module (testing).
   Calendar with a column per person, appointment types and services you can add to, confirmed / unconfirmed status,
   reschedule proposals that hold the new time until the client agrees, blocks (meetings, RDOs, leave… on/off and
   repeating), on-call roster, suggested lengths (per head, per set of yards) and suggested days/people by nearby farms.
   Loaded before app.js; uses app.js helpers (D, S, h, uid, touch, save, toast, ask, openSheet…) only at run time.
   Everything syncs like contacts: each item is a record (kinds below). */
'use strict';
const BOOK_KINDS = ['bookings', 'blocks', 'oncall', 'bkcfg', 'followups'];
window.BOOK_KINDS = BOOK_KINDS;
const BK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h3v3H8z"/></svg>';

/* ---------------- small helpers ---------------- */
const bkPad = (n) => String(n).padStart(2, '0');
const bkD = (d) => `${d.getFullYear()}-${bkPad(d.getMonth() + 1)}-${bkPad(d.getDate())}`;
const bkToday = () => bkD(new Date());
const bkAdd = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return bkD(d); };
const bkDow = (s) => new Date(s + 'T12:00').getDay(); // 0 Sunday … 6 Saturday
const bkMin = (t) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : 0);
const bkHHMM = (m) => bkPad(Math.floor(m / 60)) + ':' + bkPad(m % 60);
const bkDays = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const bkDate = (s, o) => new Date(s + 'T12:00').toLocaleDateString('en-AU', o || { weekday: 'short', day: 'numeric', month: 'short' });
const bkTime = (t) => { const m = bkMin(t), hh = Math.floor(m / 60), mm = m % 60; return `${hh % 12 || 12}${mm ? ':' + bkPad(mm) : ''}${hh < 12 || hh === 24 ? 'am' : 'pm'}`; };
const bkDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m} min`);
const bkWeekStart = (s) => bkAdd(s, -((bkDow(s) + 6) % 7)); // Monday
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BK = { view: 'day', date: bkToday(), page: 'cal', showAll: false, showCancelled: false, jobFilter: '' };
try { const p = JSON.parse(localStorage.getItem('bvp-bkview') || '{}'); if (p.view) BK.view = p.view; } catch (e) { }

/* ---------------- settings records (kind bkcfg) — fixed ids for the starting set so two devices never make duplicates ---------------- */
const BK_DEFAULTS = [
  { id: 'type-farm', cfg: 'type', order: 1, name: 'On-farm', colour: '#2f7a55', where: 'farm', fixedMins: null },
  { id: 'type-inhouse', cfg: 'type', order: 2, name: 'In-house', colour: '#3a6ea5', where: 'base', fixedMins: null },
  { id: 'type-phone', cfg: 'type', order: 3, name: 'Phone', colour: '#8a5a9e', where: 'phone', fixedMins: 15 },
  { id: 'type-fec', cfg: 'type', order: 4, name: 'In-house FEC', colour: '#b5791c', where: 'base', fixedMins: 15 },
  { id: 'svc-preg', cfg: 'service', order: 1, name: 'Preg testing', mode: 'perhead', setup: 20, hph: 150, askLabour: true, yard: 'preg', rateFrom: 'farm' },
  { id: 'svc-bull', cfg: 'service', order: 2, name: 'Bull testing', mode: 'perhead', setup: 20, hph: 6, askLabour: true, yard: 'bull', rateFrom: 'farm' },
  { id: 'svc-ai', cfg: 'service', order: 3, name: 'Artificial insemination', mode: 'perhead', setup: 20, hph: 40, askLabour: true },
  { id: 'svc-labour', cfg: 'service', order: 4, name: 'Additional labour', mode: 'fixed', mins: 120, alongside: true },
  { id: 'svc-sample', cfg: 'service', order: 5, name: 'Blood sampling (trace elements / BVD)', mode: 'perhead', setup: 20, hph: 60 },
  { id: 'svc-hh', cfg: 'service', order: 6, name: 'Herd health visit', mode: 'fixed', mins: 90 },
  { id: 'svc-pm', cfg: 'service', order: 7, name: 'Post-mortem', mode: 'fixed', mins: 90 },
  { id: 'svc-consult', cfg: 'service', order: 8, name: 'Consult / treatment', mode: 'fixed', mins: 60 },
  { id: 'svc-fec', cfg: 'service', order: 9, name: 'Faecal egg count', mode: 'fixed', mins: 15 },
  { id: 'svc-phone', cfg: 'service', order: 10, name: 'Phone consult', mode: 'fixed', mins: 15 },
  { id: 'svc-bruc', cfg: 'service', order: 11, name: 'Brucellosis testing', mode: 'perhead', setup: 20, hph: 60, askLabour: true },
  { id: 'svc-vasec', cfg: 'service', order: 12, name: 'Vasectomies', mode: 'perhead', setup: 30, hph: 3, askLabour: true },
  { id: 'svc-trace', cfg: 'service', order: 13, name: 'Trace element testing', mode: 'perhead', setup: 20, hph: 60, askLabour: true },
  { id: 'svc-mischalf', cfg: 'service', order: 14, name: 'Misc procedures — half day', mode: 'fixed', mins: 240, askLabour: true },
  { id: 'svc-miscfull', cfg: 'service', order: 15, name: 'Misc procedures — full day', mode: 'fixed', mins: 480, askLabour: true },
  { id: 'bt-meeting', cfg: 'blocktype', order: 1, name: 'Morning meeting', colour: '#64748b' },
  { id: 'bt-admin', cfg: 'blocktype', order: 2, name: 'Admin time', colour: '#7c8a6e' },
  { id: 'bt-rounds', cfg: 'blocktype', order: 3, name: 'Clinical rounds', colour: '#6f7fb0' },
  { id: 'bt-event', cfg: 'blocktype', order: 4, name: 'Industry event', colour: '#a0782f' },
  { id: 'bt-rdo', cfg: 'blocktype', order: 5, name: 'RDO', colour: '#9a6b8a' },
  { id: 'bt-leave', cfg: 'blocktype', order: 6, name: 'Leave / not available', colour: '#9b5050' },
  { id: 'fu-recheck', cfg: 'futype', order: 1, name: 'Recheck', days: 14 },
  { id: 'fu-results', cfg: 'futype', order: 2, name: 'Lab results due', days: 7 },
  { id: 'fu-booster', cfg: 'futype', order: 3, name: 'Booster vaccination', days: 28 },
  { id: 'fu-pregre', cfg: 'futype', order: 4, name: 'Preg recheck', days: 42 },
  { id: 'fu-bullre', cfg: 'futype', order: 5, name: 'Bull retest', days: 56 },
  { id: 'sms-booked', cfg: 'sms', order: 1, use: 'booked', name: 'Booking made', text: 'Hi {first}, your {type} appointment with Bovitech Veterinary Services is booked for {day} {date} at {time}{at_farm}. Reply to this message or call 0499 489 919 if you need to change it.' },
  { id: 'sms-reminder', cfg: 'sms', order: 2, use: 'reminder', name: 'Reminder (5 days before)', text: 'Hi {first}, a reminder of your appointment with Bovitech Veterinary Services on {day} {date} at {time}{at_farm}. Please reply YES to confirm, or call 0499 489 919 to change it.' },
  { id: 'sms-proposal', cfg: 'sms', order: 3, use: 'proposal', name: 'New time suggested', text: 'Hi {first}, could we move your appointment from {old_date} to {day} {date} at {time}? Please reply YES to accept, or call 0499 489 919.' },
];
const BK_MIG = 3; // 3: preg / bull testing take their speed from each farm // settings added after the first version: new services, and the "ask about additional labour" / "runs alongside" / yard flags
const BK_NEW_V2 = ['svc-bruc', 'svc-vasec', 'svc-trace', 'svc-mischalf', 'svc-miscfull'];
const BK_USE = { '': 'Preg and bull testing', preg: 'Preg testing only (no bull testing)', bull: 'Bull testing only (no preg testing)', individual: 'Individual animal assessments only', none: 'Do not service' };
const BK_DEFAULT_BLOCKS = [{ id: 'blk-meeting', type: 'bt-meeting', staff: 'all', date: '2026-01-05', start: '08:00', end: '08:30', repeat: { every: 'weekdays' }, on: true, note: 'At homebase' }];
const BK_PERMS = [['book', 'Add, change and move bookings'], ['blocks', 'Add and change blocks (meetings, RDOs, leave…)'], ['roster', 'Change the on-call roster'], ['settings', 'Change appointment types, services, block types and SMS templates']];

const Bk = {
  on() { return !!(typeof PREF !== 'undefined' && PREF.showBook); },
  list(k) { return (D && D[k]) || (D[k] = []); },
  cfg(t) { return Bk.list('bkcfg').filter((x) => x.cfg === t && !x.gone).sort((a, b) => (a.order || 99) - (b.order || 99) || (a.name || '').localeCompare(b.name || '')); },
  get(id) { return Bk.list('bkcfg').find((x) => x.id === id); },
  type(id) { return Bk.get(id) || { name: 'Appointment', colour: '#777', where: 'farm' }; },
  svc(id) { return Bk.get(id) || { name: 'Service', mode: 'fixed', mins: 60 }; },
  btype(id) { return Bk.get(id) || { name: 'Block', colour: '#888' }; },
  /* the starting settings, made once (after this device has the latest data, so nothing is duplicated) */
  seed() {
    if (!D || !D.sync || !D.sync.last) return;
    let n = 0; const have = new Set(Bk.list('bkcfg').map((x) => x.id));
    if (!Bk.list('bkcfg').length) { BK_DEFAULTS.forEach((d) => { if (!have.has(d.id)) { const r = { ...d }; touch(r); D.bkcfg.push(r); n++; } }); D.sync.bkMig = BK_MIG; }
    if (!Bk.list('blocks').length && !(D.sync.bkSeeded)) BK_DEFAULT_BLOCKS.forEach((d) => { const r = JSON.parse(JSON.stringify(d)); touch(r); D.blocks.push(r); n++; });
    if ((D.sync.bkMig || 1) < 2) { // add the newer services and flags to an existing set (same fixed ids on every device, so nothing doubles up)
      BK_DEFAULTS.filter((d) => d.cfg === 'service').forEach((d) => { let r = Bk.get(d.id);
        if (!r) { if (BK_NEW_V2.includes(d.id)) { r = { ...d }; touch(r); D.bkcfg.push(r); n++; } return; }
        let ch = false; ['askLabour', 'alongside', 'yard'].forEach((k) => { if (d[k] != null && r[k] === undefined) { r[k] = d[k]; ch = true; } }); if (ch) { touch(r); n++; } });
      D.sync.bkMig = 2; save();
    }
    if ((D.sync.bkMig || 1) < 3) { ['svc-preg', 'svc-bull'].forEach((id) => { const r = Bk.get(id); if (r && r.rateFrom === undefined) { r.rateFrom = 'farm'; touch(r); n++; } }); D.sync.bkMig = 3; save(); }
    if (n) { D.sync.bkSeeded = true; save(); }
  },
  /* ---- people ---- */
  people() {
    let l = (window.SBAuth && SBAuth.list) || null;
    if (l) { try { localStorage.setItem('bvp-stafflist', JSON.stringify(l)); } catch (e) { } } else { try { l = JSON.parse(localStorage.getItem('bvp-stafflist') || '[]'); } catch (e) { l = []; } }
    l = l.filter((s) => s.active && s.role !== 'admin').sort((a, b) => (a.role === 'vet_tech') - (b.role === 'vet_tech') || (a.preferred_name || a.full_name).localeCompare(b.preferred_name || b.full_name));
    const o = Bk.order(); if (o.length) { const ix = (s) => { const i = o.indexOf(s.id); return i < 0 ? 999 : i; }; l = l.map((s, i) => [s, i]).sort((a, b) => ix(a[0]) - ix(b[0]) || a[1] - b[1]).map((x) => x[0]); }
    return l;
  },
  order() { try { return JSON.parse(localStorage.getItem('bvp-bkorder') || '[]'); } catch (e) { return []; } }, // who comes first on the calendar — this device only
  setOrder(ids) { try { localStorage.setItem('bvp-bkorder', JSON.stringify(ids)); } catch (e) { } },
  person(id) { return Bk.people().find((s) => s.id === id) || ((window.SBAuth && SBAuth.list) || []).find((s) => s.id === id) || null; },
  pname(id) { const s = Bk.person(id); return s ? s.preferred_name || s.full_name.split(' ')[0] : '?'; },
  pini(id) { const s = Bk.person(id); return s ? s.initials : '?'; },
  scfg(s) { // a person's hours, what they can be booked for, and locum days
    const c = Bk.get('staff:' + s.id) || {};
    const tech = s.role === 'vet_tech' || s.role === 'assistant';
    const locum = !/@bovitech\.com\.au$/i.test(s.email || '') && s.role === 'vet';
    const end = tech ? '17:00' : '18:00';
    const def = { mode: locum ? 'locum' : 'regular', hours: { 1: ['08:00', end], 2: ['08:00', end], 3: ['08:00', end], 4: ['08:00', end], 5: ['08:00', end] }, endBuffer: tech ? 0 : 45, canDo: tech ? ['svc-ai', 'svc-labour'] : null, availDates: {}, locumHours: ['08:00', '18:00'] };
    return { ...def, ...c, hours: c.hours || def.hours, availDates: c.availDates || {} };
  },
  hours(s, date) { const c = Bk.scfg(s); if (c.mode === 'locum') return c.availDates[date] ? c.locumHours : null; return c.hours[bkDow(date)] || null; },
  canDo(s, svcId) { const c = Bk.scfg(s); return !c.canDo || c.canDo.includes(svcId); },
  /* ---- permissions: everyone by default; the admin can turn them off per person ---- */
  can(p) {
    if (!window.SBAuth || !SBAuth.staff) return false; if (SBAuth.isAdmin()) return true;
    const pr = Bk.get('perms'); return !(pr && pr.staff && pr.staff[SBAuth.staff.id] && pr.staff[SBAuth.staff.id][p] === false);
  },
  need(p) { if (Bk.can(p)) return true; toast("You don't have permission for this — ask the office"); return false; },
  /* ---- blocks (repeating, on/off) ---- */
  blockOn(b, date) {
    if (!b.on || b.gone) return false; if ((b.skip || []).includes(date)) return false;
    const r = b.repeat || { every: 'none' }; if (date < b.date) return false; if (r.until && date > r.until) return false;
    if (r.every === 'none' || !r.every) return date === b.date || (b.toDate && date <= b.toDate);
    const d = bkDow(date);
    if (r.every === 'weekdays') return d >= 1 && d <= 5;
    if (r.every === 'daily') return true;
    const days = r.days && r.days.length ? r.days : [bkDow(b.date)];
    if (!days.includes(d)) return false;
    if (r.every === 'weekly') return true;
    if (r.every === 'fortnightly') return Math.floor(bkDays(bkWeekStart(b.date), bkWeekStart(date)) / 7) % 2 === 0;
    if (r.every === 'monthly') return new Date(date + 'T12:00').getDate() === new Date(b.date + 'T12:00').getDate();
    return false;
  },
  blocksFor(date, staffId) { return Bk.list('blocks').filter((b) => Bk.blockOn(b, date) && (b.staff === 'all' || (Array.isArray(b.staff) && b.staff.includes(staffId)))); },
  /* ---- bookings ---- */
  live(b) { return b.status !== 'cancelled' && !b.gone; },
  bookingsFor(date, staffId) { return Bk.list('bookings').filter((b) => Bk.live(b) && b.date === date && (b.staff || []).includes(staffId)).sort((a, c) => a.start.localeCompare(c.start)); },
  proposalsFor(date, staffId) { return Bk.list('bookings').filter((b) => Bk.live(b) && b.proposal && b.proposal.date === date && (b.proposal.staff || b.staff || []).includes(staffId)); },
  oncall(date) { return Bk.list('oncall').find((o) => o.id === date) || null; },
  weekend(date) { const d = bkDow(date); return d === 0 || d === 6; },
  who(b) { // client name for a booking
    const bz = b.bid && IDX.biz && IDX.biz.get(b.bid); const c = b.cid && D.contacts.find((x) => x.id === b.cid);
    return bz ? bz.name : c ? fullName(c) : b.clientText || 'No client';
  },
  fids(b) { return b.fids && b.fids.length ? b.fids : b.fid ? [b.fid] : []; }, // farms / yards in the order they're visited
  farms(b) { return IDX.farms ? Bk.fids(b).map((id) => IDX.farms.get(id)).filter(Boolean) : []; },
  farm(b) { return Bk.farms(b)[0] || null; },
  farmName(b) { return Bk.farms(b).map((f) => f.name || f.address || 'Farm').join(' + '); },
  sstaff(b, x) { return Array.isArray(x.staff) ? x.staff : b.staff || []; }, // who is doing one service on a booking (older bookings: everyone on it)
  svcText(b, sid) { const all = b.svcs || []; const l = sid ? all.filter((x) => Bk.sstaff(b, x).includes(sid)) : all; return (l.length ? l : all).map((x) => Bk.svc(x.svc).name + (x.head ? ' ×' + x.head : '')).join(', '); },
  fsched(fid) { return (fid && Bk.get('fsched:' + fid)) || {}; }, // a farm's booking rules (set on the business page)
  bsched(bid) { return (bid && Bk.get('bsched:' + bid)) || {}; },
  pidText(b) { return (b.pids || []).map((p) => p.value).join(', '); },
};
Bk.sms = (bookingId) => ((D && D.smsLog) || []).filter((x) => x.booking_id === bookingId);
Bk.smsOk = (row) => row && ['queued', 'sending', 'sent', 'delivered'].includes(row.status);
Bk.smsKey = (key) => ((D && D.smsLog) || []).find((x) => x.key === key);
window.Bk = Bk;

/* ---------------- travel (estimates between turn-off pins; the farm's own drive time from homebase when known) ---------------- */
const Travel = {
  home() { const h0 = (D.settings && D.settings.home) || {}; return h0.lat != null ? { lat: +h0.lat, lng: +h0.lng, home: true } : null; },
  pt(f) { if (!f) return null; if (f.turn && f.turn.lat != null) return { lat: +f.turn.lat, lng: +f.turn.lng, f }; if (f.lat != null) return { lat: +f.lat, lng: +f.lng, f }; return null; },
  loc(b) { const t = Bk.type(b.type); if (t.where === 'phone') return null; if (t.where === 'base') return Travel.home(); return Travel.pt(Bk.farm(b)) || null; }, // where it starts
  locOut(b) { const t = Bk.type(b.type); if (t.where !== 'farm') return Travel.loc(b); const fs = Bk.farms(b); return Travel.pt(fs[fs.length - 1]) || null; }, // where it finishes (the last farm)
  between(fids) { let m = 0; for (let i = 1; i < fids.length; i++) m += Travel.mins(Travel.pt(IDX.farms.get(fids[i - 1])), Travel.pt(IDX.farms.get(fids[i]))); return m; }, // driving between the farms on one booking
  km(a, b) { const R = 6371, r = Math.PI / 180; const dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); },
  mins(a, b) { // drive minutes between two places (null = phone call, no travel)
    if (!a || !b) return 0;
    if (a.home && b.home) return 0;
    const far = a.home ? b : b.home ? a : null;
    if (far && far.f && far.f.driveMin != null) return Math.round(far.f.driveMin);
    const k = Travel.km(a, b); if (k < 0.3) return 0;
    return Math.round((k * 1.35) / 75 * 60 + 3); // road distance ≈ 1.35 × straight line, 75 km/h, a few minutes to get going
  },
};
window.Travel = Travel;

/* ---------------- calendar ---------------- */
const BK_START = 0, BK_END = 24 * 60, BK_PX = 1.1, BK_SCROLL_TO = 7 * 60; // the whole day (after-hours work too), pixels per minute; opens at about 7am
function bkColumns(date) {
  return Bk.people().filter((s) => BK.showAll || Bk.hours(s, date) || Bk.bookingsFor(date, s.id).length);
}
function bkRender() {
  Bk.seed();
  if (BK.page === 'settings') BK.page = 'cal'; // booking settings live in Settings → Scheduling now
  if (BK.page === 'jobs') return bkJobsHtml();
  if (BK.page === 'roster') return bkRosterHtml();
  if (BK.page === 'followups') return bkFollowupsHtml();
  const nj = bkJobs().length;
  const head = `<div class="bk-top">
    <div class="bk-nav"><button class="btn small" data-act="bk-go" data-v="-1" aria-label="Back">‹</button><button class="btn small" data-act="bk-today">Today</button><button class="btn small" data-act="bk-go" data-v="1" aria-label="Forward">›</button>
      <input type="date" id="bk-date" value="${BK.date}" data-act="bk-date"><b class="bk-title">${bkTitle()}</b></div>
    <div class="bk-nav"><span class="bk-seg">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([v, l]) => `<button class="btn small ${BK.view === v ? 'on' : ''}" data-act="bk-view" data-v="${v}">${l}</button>`).join('')}</span>
      ${Bk.can('book') ? '<button class="btn small primary" data-act="bk-new">➕ Booking</button>' : ''}${Bk.can('blocks') ? '<button class="btn small" data-act="bk-newblock">➕ Block</button>' : ''}
      ${nj ? `<button class="btn small bk-jobsbtn" data-act="bk-page" data-v="jobs">Jobs <span class="badge">${nj}</span></button>` : ''}<button class="btn small" data-act="bk-page" data-v="settings" aria-label="Scheduling settings" title="Scheduling settings">⚙</button></div></div>`;
  const body = BK.view === 'month' ? bkMonthHtml() : BK.view === 'week' ? bkWeekHtml() : bkDayHtml();
  if (BK.view === 'day') setTimeout(() => { const el = document.querySelector('.bk-dayscroll.v'); if (!el) return; el.scrollTop = BK._yDate === BK.date && BK._y != null ? BK._y : Math.max(0, (BK_SCROLL_TO - BK_START) * BK_PX - 6); BK._yDate = BK.date;
    el.onscroll = () => { BK._y = el.scrollTop; BK._yDate = BK.date; }; }, 0);
  return `<div class="d-wrap bk-wrap">${head}${body}<label class="bk-opt"><input type="checkbox" data-act="bk-showall" ${BK.showAll ? 'checked' : ''}> Show everyone, even on days they don't work</label></div>`;
}
function bkTitle() {
  if (BK.view === 'day') return bkDate(BK.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (BK.view === 'week') { const a = bkWeekStart(BK.date), b = bkAdd(a, 6); return `${bkDate(a, { day: 'numeric', month: 'short' })} – ${bkDate(b, { day: 'numeric', month: 'short', year: 'numeric' })}`; }
  return new Date(BK.date + 'T12:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}
function bkOncallText(date, short) {
  const o = Bk.oncall(date); if (!o) return short ? '' : '<span class="bk-warn">On call not set</span>';
  if (Bk.weekend(date)) return o.all ? `${short ? Bk.pini(o.all) : Bk.pname(o.all) + ' (all day)'}` : short ? '' : '<span class="bk-warn">On call not set</span>';
  const p = [o.night ? (short ? Bk.pini(o.night) : `${Bk.pname(o.night)} 12–8am`) : '', o.evening ? (short ? Bk.pini(o.evening) : `${Bk.pname(o.evening)} 6pm–12am`) : ''].filter(Boolean);
  return p.length ? p.join(short ? '/' : ' · ') : short ? '' : '<span class="bk-warn">On call not set</span>';
}
function bkDayHtml() {
  const date = BK.date, cols = bkColumns(date);
  const hrs = []; for (let m = BK_START; m <= BK_END; m += 60) hrs.push(m);
  const H = (BK_END - BK_START) * BK_PX;
  const y = (t) => (bkMin(t) - BK_START) * BK_PX;
  const colHtml = (s) => {
    const hrsOn = Bk.hours(s, date), c = Bk.scfg(s);
    let shade = '';
    if (!hrsOn) shade = `<div class="bk-off" style="top:0;height:${H}px"><span>${c.mode === 'locum' ? 'Not available' : 'Not working'}</span></div>`;
    else { shade = `<div class="bk-off" style="top:0;height:${Math.max(0, y(hrsOn[0]))}px"></div><div class="bk-off" style="top:${y(hrsOn[1])}px;height:${Math.max(0, H - y(hrsOn[1]))}px"></div>`;
      if (c.endBuffer) shade += `<div class="bk-buffer" style="top:${y(bkHHMM(bkMin(hrsOn[1]) - c.endBuffer))}px;height:${c.endBuffer * BK_PX}px"><span>Records &amp; restock</span></div>`; }
    const blocks = Bk.blocksFor(date, s.id).map((b) => { const bt = Bk.btype(b.type); const st = b.allDay ? bkHHMM(BK_START) : b.start, en = b.allDay ? bkHHMM(BK_END) : b.end;
      return `<div class="bk-block ${bkPat(bt)}" data-act="bk-openblock" data-id="${b.id}" style="top:${y(st)}px;height:${Math.max(14, (bkMin(en) - bkMin(st)) * BK_PX)}px;--c:${bt.colour}"><b>${h(bt.name)}</b>${b.note ? ' · ' + h(b.note) : ''}</div>`; }).join('');
    const bks = Bk.bookingsFor(date, s.id); let prev = null;
    const items = bks.map((b) => { const t = Bk.type(b.type); const top = y(b.start), ht = Math.max(18, b.mins * BK_PX); let gap = '';
      const loc = Travel.loc(b);
      if (prev) { const need = Travel.mins(Travel.locOut(prev), loc), have = bkMin(b.start) - (bkMin(prev.start) + prev.mins); if (need > 0 || have < 0) gap = `<div class="bk-drive ${have < need ? 'bad' : ''}" style="top:${y(bkHHMM(bkMin(prev.start) + prev.mins))}px;height:${Math.max(10, Math.max(have, 0) * BK_PX)}px"><span>🚗 ~${need} min${have < need ? ' — not enough time' : ''}</span></div>`; }
      prev = b;
      return gap + `<div class="bk-appt ${bkPat(t)} ${b.status === 'confirmed' ? '' : 'unconf'} ${b.urgent ? 'urgent' : ''}" data-act="bk-open" data-id="${b.id}" style="top:${top}px;height:${ht}px;--c:${t.colour}">
        <div class="bk-at">${bkTime(b.start)}–${bkTime(bkHHMM(bkMin(b.start) + b.mins))} · ${h(t.name)}${b.status === 'confirmed' ? ' ✓' : ' <i>unconfirmed</i>'}</div>
        <div class="bk-aw">${b.urgent ? '⚡ ' : ''}${h(Bk.who(b))}${Bk.farmName(b) ? ' — ' + h(Bk.farmName(b)) : ''}</div><div class="bk-as">${h(Bk.svcText(b, s.id))}${(b.pids || []).length ? ' · ' + h(Bk.pidText(b)) : ''}${(b.staff || []).length > 1 ? ' · with ' + b.staff.filter((x) => x !== s.id).map(Bk.pname).join(', ') : ''}${b.proposal ? ' · <b>new time suggested</b>' : ''}</div></div>`; }).join('');
    const props = Bk.proposalsFor(date, s.id).map((b) => `<div class="bk-prop" data-act="bk-open" data-id="${b.id}" style="top:${y(b.proposal.start)}px;height:${Math.max(18, (b.proposal.mins || b.mins) * BK_PX)}px"><b>Held — new time suggested</b><br>${h(Bk.who(b))} · waiting for client (from ${bkDate(b.date)} ${bkTime(b.start)})</div>`).join('');
    return `<div class="bk-col" data-staff="${s.id}" style="height:${H}px">${shade}${blocks}${items}${props}</div>`;
  };
  if (!cols.length) return `<div class="card bk-empty">Nobody is working on ${bkDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}.${Bk.people().length ? ' Tick "Show everyone" below to book anyway.' : ' The staff list loads the first time you sign in with internet.'}<div class="hint" style="margin-top:6px">On call: ${bkOncallText(date)}</div></div>`;
  return `<div class="bk-oncall" data-act="bk-page" data-v="roster">📟 On call: ${bkOncallText(date)}</div>
  <div class="bk-dayscroll v"><div class="bk-day" style="grid-template-columns:44px repeat(${cols.length}, minmax(150px, 1fr))">
    <div class="bk-colh bk-corner"></div>${cols.map((s, ci) => { const hr = Bk.hours(s, date); const c = Bk.scfg(s); return `<div class="bk-colh" draggable="true" data-colstaff="${s.id}"><div class="bk-colord">${ci ? `<button class="btn small" data-act="bk-colmove" data-staff="${s.id}" data-v="-1" aria-label="Move ${h(s.preferred_name || s.full_name)} left" title="Move left">‹</button>` : ''}<b>${h(s.preferred_name || s.full_name)}</b>${ci < cols.length - 1 ? `<button class="btn small" data-act="bk-colmove" data-staff="${s.id}" data-v="1" aria-label="Move ${h(s.preferred_name || s.full_name)} right" title="Move right">›</button>` : ''}</div><span class="hint">${hr ? `${bkTime(hr[0])}–${bkTime(hr[1])}` : c.mode === 'locum' ? 'locum' : 'off'}</span>${c.mode === 'locum' && Bk.can('roster') ? `<button class="btn small" data-act="bk-avail" data-staff="${s.id}">${hr ? 'Make unavailable' : 'Make available'}</button>` : ''}</div>`; }).join('')}
    <div class="bk-times" style="height:${H}px">${hrs.map((m) => `<span style="top:${(m - BK_START) * BK_PX}px">${bkTime(bkHHMM(m))}</span>`).join('')}</div>
    ${cols.map(colHtml).join('')}
  </div></div>`;
}
function bkWeekHtml() {
  const a = bkWeekStart(BK.date), days = [...Array(7)].map((_, i) => bkAdd(a, i));
  const ppl = Bk.people().filter((s) => BK.showAll || days.some((d) => Bk.hours(s, d) || Bk.bookingsFor(d, s.id).length));
  return `<div class="bk-dayscroll"><table class="bk-week"><thead><tr><th></th>${days.map((d) => `<th class="${d === bkToday() ? 'today' : ''}"><button class="lnk" data-act="bk-openday" data-v="${d}">${bkDate(d)}</button><div class="hint">📟 ${bkOncallText(d, true) || '—'}</div></th>`).join('')}</tr></thead>
  <tbody>${ppl.map((s) => `<tr><th>${h(s.preferred_name || s.full_name)}</th>${days.map((d) => { const hr = Bk.hours(s, d); const bl = Bk.blocksFor(d, s.id).filter((b) => b.type !== 'bt-meeting'); const bs = Bk.bookingsFor(d, s.id), ps = Bk.proposalsFor(d, s.id);
    return `<td class="${hr ? '' : 'off'}" data-act="bk-openday" data-v="${d}">${bl.map((b) => `<div class="bk-chip blk ${bkPat(Bk.btype(b.type))}" style="--c:${Bk.btype(b.type).colour}">${h(Bk.btype(b.type).name)}</div>`).join('')}${bs.map((b) => `<div class="bk-chip ${bkPat(Bk.type(b.type))} ${b.status === 'confirmed' ? '' : 'unconf'}" style="--c:${Bk.type(b.type).colour}" data-act="bk-open" data-id="${b.id}">${bkTime(b.start)} ${h(Bk.who(b))}</div>`).join('')}${ps.map((b) => `<div class="bk-chip held" data-act="bk-open" data-id="${b.id}">Held ${bkTime(b.proposal.start)} ${h(Bk.who(b))}</div>`).join('')}${!hr && !bs.length ? '<span class="hint">off</span>' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function bkMonthHtml() {
  const first = BK.date.slice(0, 8) + '01', start = bkWeekStart(first); const days = [...Array(42)].map((_, i) => bkAdd(start, i));
  const m = first.slice(0, 7);
  return `<div class="bk-month">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="bk-mh">${d}</div>`).join('')}${days.map((d) => { const bs = Bk.list('bookings').filter((b) => Bk.live(b) && b.date === d); const un = bs.filter((b) => b.status !== 'confirmed').length; const oc = bkOncallText(d, true);
    return `<button class="bk-md ${d.slice(0, 7) === m ? '' : 'other'} ${d === bkToday() ? 'today' : ''}" data-act="bk-openday" data-v="${d}"><span class="n">${+d.slice(8)}</span>${bs.length ? `<span class="c">${bs.length} booking${bs.length === 1 ? '' : 's'}${un ? ` · ${un} unconf.` : ''}</span>` : ''}<span class="o">${oc ? '📟 ' + h(oc) : ''}</span></button>`; }).join('')}</div>`;
}

/* ---------------- on-call roster ---------------- */
function bkRosterHtml() {
  const vets = Bk.people().filter((s) => s.role === 'vet'); const a = bkWeekStart(BK.date); const days = [...Array(28)].map((_, i) => bkAdd(a, i)); const ed = Bk.can('roster');
  const sel = (d, slot, v) => `<select data-act="bk-oc" data-d="${d}" data-slot="${slot}" ${ed ? '' : 'disabled'}><option value="">—</option>${vets.map((s) => `<option value="${s.id}" ${v === s.id ? 'selected' : ''}>${h(s.preferred_name || s.full_name)}</option>`).join('')}</select>`;
  return `<div class="d-wrap bk-wrap"><div class="bk-top"><div class="bk-nav"><b class="bk-title">On-call roster</b></div>
    <div class="bk-nav"><button class="btn small" data-act="bk-rgo" data-v="-28">‹ 4 weeks</button><button class="btn small" data-act="bk-rgo" data-v="28">4 weeks ›</button>${ed ? '<button class="btn small" data-act="bk-rcopy">Copy the week before into empty days</button>' : ''}</div></div>
  ${bkAiCard('roster')}<div class="hint" style="margin-bottom:8px">Weekdays: overnight (12am–8am) and evening (6pm–12am). Weekends: one vet for the whole day.${ed ? '' : ' You can see the roster but not change it.'}</div>
  <div class="bk-dayscroll"><table class="bk-roster"><thead><tr><th>Day</th><th>12am–8am</th><th>6pm–12am</th></tr></thead><tbody>
  ${days.map((d) => { const o = Bk.oncall(d) || {}; const we = Bk.weekend(d); return `<tr class="${we ? 'we' : ''} ${d === bkToday() ? 'today' : ''}"><th>${bkDate(d)}</th>${we ? `<td colspan="2">${sel(d, 'all', o.all)} <span class="hint">all day</span></td>` : `<td>${sel(d, 'night', o.night)}</td><td>${sel(d, 'evening', o.evening)}</td>`}</tr>`; }).join('')}
  </tbody></table></div></div>`;
}

/* ---------------- how long: set times, per head, or the speed of these particular yards ---------------- */
function bkYard(fid, svc) { const y = fid ? Bk.get('yard:' + fid + ':' + svc) : null; return y && !y.gone ? y : null; }
function bkSuggestMins(typeId, svcs, fids) {
  const t = Bk.type(typeId); const fl = Array.isArray(fids) ? fids.filter(Boolean) : fids ? [fids] : [];
  if (t.fixedMins) return { mins: t.fixedMins, why: `${t.name}: set time of ${bkDur(t.fixedMins)}` };
  const all = (svcs || []).filter((x) => x.svc && Bk.get(x.svc)); const main = all.filter((x) => !Bk.svc(x.svc).alongside);
  const use = main.length ? main : all; // additional labour runs alongside the other work, so it doesn't make the booking longer
  const setups = {}; let mins = 0; const why = [];
  use.forEach((x) => { const sv = Bk.svc(x.svc); const at = (t.where === 'farm' && (x.fid || fl[0])) || null;
    setups[at || '-'] = Math.max(setups[at || '-'] || 0, sv.setup || 0); // set-up and pack-up, once per farm
    if (sv.mode === 'perhead') { const y = sv.rateFrom === 'farm' ? bkYard(at, x.svc) : null; const hph = x.hph || (y && y.hph) || sv.hph || 60; const head = +x.head || 0;
      const m = head ? (head / hph) * 60 : 0; mins += m;
      why.push(`${sv.name}: ${head || '?'} head at ${hph}/hour${x.hph ? '' : y ? ' (this farm)' : sv.rateFrom === 'farm' ? (sv.hph ? ' (usual — no rate set for this farm)' : ' (no rate set — guessed)') : ''} = ${bkDur(Math.round(m))}`); }
    else { mins += +sv.mins || 0; why.push(`${sv.name}: ${bkDur(+sv.mins || 0)}`); } });
  all.filter((x) => main.length && Bk.svc(x.svc).alongside).forEach((x) => why.push(`${Bk.svc(x.svc).name}: alongside`));
  const setup = Object.values(setups).reduce((a, b) => a + b, 0); if (setup) why.push(`set-up and pack-up ${setup} min`);
  const drive = t.where === 'farm' && fl.length > 1 ? Travel.between(fl) : 0; if (drive) why.push(`driving between farms ~${drive} min`);
  const total = Math.max(15, Math.ceil((mins + setup + drive) / 15) * 15);
  return { mins: total, why: why.join(' + ') || 'No services chosen' };
}

/* ---------------- a farm's booking rules (do not service, individual animals only…) ---------------- */
function bkFarmIssues(fid, svcs, firstFid) {
  const f = fid && IDX.farms && IDX.farms.get(fid); if (!f) return [];
  const nm = f.name || f.address || 'This farm', fs = Bk.fsched(fid), sf = f.safety || {}; const out = [];
  if (fs.use === 'none') out.push({ hard: true, msg: `${nm} is marked DO NOT SERVICE${fs.note ? ' — ' + fs.note : ''}` });
  if (sf.status === 'stop') out.push({ hard: true, msg: `${nm}: no routine work until the safety problem is fixed${sf.note ? ' — ' + sf.note : ''}` });
  if (fs.use === 'individual' || fs.use === 'preg' || fs.use === 'bull') (svcs || []).forEach((x) => { const y = x.svc && Bk.svc(x.svc).yard; if (!y || (x.fid || firstFid || fid) !== fid) return;
    if (fs.use === 'individual' || fs.use !== y) out.push({ msg: `${nm} is set to "${BK_USE[fs.use]}" — not ${Bk.svc(x.svc).name.toLowerCase()}` }); });
  return out;
}
function bkFarmTag(fid) { const f = IDX.farms && IDX.farms.get(fid); const fs = Bk.fsched(fid); return (fs.use === 'none' ? ' — ⛔ DO NOT SERVICE' : fs.use ? ' — ' + BK_USE[fs.use] : '') + (f && (f.safety || {}).status === 'stop' ? ' — ⛔ safety stop' : ''); }
function bkNeedsLabour(f) { // ask about additional labour: some services always ask, and some clients always need it
  const svcs = (f.svcs || []).filter((x) => x.svc); if (svcs.some((x) => Bk.svc(x.svc).alongside)) return null;
  if (f.bid && Bk.bsched(f.bid).labour) return 'always';
  return svcs.some((x) => Bk.svc(x.svc).askLabour) ? 'ask' : null;
}

/* ---------------- what's wrong with a time (clashes, hours, travel) ---------------- */
function bkBusy(date, staffId, skipId) {
  const out = [];
  Bk.blocksFor(date, staffId).forEach((b) => out.push({ s: b.allDay ? 0 : bkMin(b.start), e: b.allDay ? 1440 : bkMin(b.end), loc: Travel.home(), what: Bk.btype(b.type).name, block: b }));
  Bk.bookingsFor(date, staffId).filter((b) => b.id !== skipId).forEach((b) => out.push({ s: bkMin(b.start), e: bkMin(b.start) + b.mins, loc: Travel.loc(b), locOut: Travel.locOut(b), what: Bk.who(b), b }));
  Bk.proposalsFor(date, staffId).filter((b) => b.id !== skipId).forEach((b) => out.push({ s: bkMin(b.proposal.start), e: bkMin(b.proposal.start) + (b.proposal.mins || b.mins), loc: Travel.loc(b), locOut: Travel.locOut(b), what: 'held for ' + Bk.who(b), b, held: true }));
  return out.sort((a, b) => a.s - b.s);
}
function bkProblems(bk, alt) { // bk: booking-like {type, fid, date, start, mins, staff, svcs, id}; alt: check the proposal instead
  const date = alt ? alt.date : bk.date, start = alt ? alt.start : bk.start, mins = alt ? alt.mins || bk.mins : bk.mins, staff = alt ? alt.staff || bk.staff : bk.staff;
  const out = []; if (!date || !start || !mins) return [...new Set(bkRuleProblems(bk))];
  const s0 = bkMin(start), e0 = s0 + mins; const me = Travel.loc(bk), meOut = Travel.locOut(bk);
  (staff || []).forEach((sid) => { const p = Bk.person(sid); if (!p) return; const nm = Bk.pname(sid); const hr = Bk.hours(p, date); const c = Bk.scfg(p);
    if (!hr) out.push(`${nm} ${c.mode === 'locum' ? "isn't marked available" : "doesn't work"} on ${bkDate(date)}`);
    else { if (s0 < bkMin(hr[0])) out.push(`Starts before ${nm}'s day (${bkTime(hr[0])})`);
      const back = e0 + Travel.mins(meOut, Travel.home()); if (back > bkMin(hr[1])) out.push(`${nm} wouldn't be back at the office until ${bkTime(bkHHMM(back))} (finishes ${bkTime(hr[1])})`);
      else if (c.endBuffer && back > bkMin(hr[1]) - c.endBuffer) out.push(`Uses ${nm}'s end-of-day time for records and restocking`); }
    (bk.svcs || []).forEach((x) => { if (x.svc && Bk.sstaff(bk, x).includes(sid) && !Bk.canDo(p, x.svc)) out.push(`${nm} isn't set up to be booked for ${Bk.svc(x.svc).name}`); });
    const busy = bkBusy(date, sid, bk.id);
    busy.forEach((x) => { if (x.s < e0 && x.e > s0) out.push(`Clashes with ${x.what} (${bkTime(bkHHMM(x.s))}–${bkTime(bkHHMM(x.e))}) for ${nm}`); });
    const before = busy.filter((x) => x.e <= s0 && !x.block).pop(), after = busy.find((x) => x.s >= e0 && !x.block);
    if (before) { const need = Travel.mins(before.locOut || before.loc, me); if (s0 - before.e < need) out.push(`Only ${s0 - before.e} min to drive from ${before.what} (needs about ${need}) — ${nm}`); }
    if (after) { const need = Travel.mins(meOut, after.loc); if (after.s - e0 < need) out.push(`Only ${after.s - e0} min to get to ${after.what} afterwards (needs about ${need}) — ${nm}`); } });
  if (Bk.type(bk.type).where === 'farm' && !Bk.fids(bk).length) out.push('No farm chosen — travel can\'t be worked out');
  return [...new Set([...out, ...bkRuleProblems(bk)])];
}

function bkRuleProblems(bk) { // farm rules, people, herds / flocks, labour — these don't depend on the time
  const out = [];
  const fl = Bk.fids(bk), isFarm = Bk.type(bk.type).where === 'farm';
  if (isFarm) fl.forEach((fid) => bkFarmIssues(fid, bk.svcs, fl[0]).forEach((x) => out.push((x.hard ? '⛔ ' : '') + x.msg)));
  (bk.svcs || []).forEach((x) => { if (x.svc && !Bk.sstaff(bk, x).length) out.push(`Nobody chosen for ${Bk.svc(x.svc).name}`); });
  const bz = bk.bid && IDX.biz && IDX.biz.get(bk.bid);
  if (bz && (bz.patientIds || []).length && !(bk.pids || []).length) out.push('No herd / flock chosen');
  if (bkNeedsLabour(bk) === 'always' && !bk.noLabour) out.push(`${Bk.who(bk)} always needs additional labour — none booked`);
  return out;
}

/* ---------------- suggest the best day and person: by nearby farms, or the soonest when urgent ---------------- */
function bkSuggest(o) { // o: { type, fids, mins, svcs, urgent, skipId, from, staff (only these people) }
  const t = Bk.type(o.type), home = Travel.home(); const fl = o.fids || (o.fid ? [o.fid] : []);
  const target = t.where === 'phone' ? null : t.where === 'base' ? home : Travel.pt(fl[0] && IDX.farms.get(fl[0]));
  const targetOut = t.where === 'farm' ? Travel.pt(fl[fl.length - 1] && IDX.farms.get(fl[fl.length - 1])) || target : target;
  const ppl = Bk.people().filter((s) => (!o.staff || !o.staff.length || o.staff.includes(s.id)) && (o.svcs || []).every((x) => Bk.canDo(s, x.svc)));
  const today = bkToday(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const from = o.from && o.from > today ? o.from : today; const res = [];
  for (let i = 0; i < 42; i++) { const d = bkAdd(from, i);
    for (const s of ppl) { const hr = Bk.hours(s, d); if (!hr) continue; const c = Bk.scfg(s);
      const dayS = Math.max(bkMin(hr[0]), d === today ? Math.ceil((nowMin + 30) / 15) * 15 : 0), dayE = bkMin(hr[1]) - (c.endBuffer || 0);
      const busy = bkBusy(d, s.id, o.skipId);
      const farmsThatDay = busy.filter((x) => x.b && x.loc && !x.loc.home);
      const near = target && !target.home ? farmsThatDay.map((x) => ({ m: Travel.mins(x.loc, target), x })).sort((a, b) => a.m - b.m)[0] : null;
      let prev = { e: dayS, loc: home }; let best = null;
      const stops = [...busy, { s: dayE, e: dayE, loc: home, end: true }];
      for (const nx of stops) {
        if (nx.s > prev.e) { const tIn = Travel.mins(prev.loc, target), tOut = Travel.mins(targetOut, nx.loc), base = Travel.mins(prev.loc, nx.loc);
          const st = Math.ceil((prev.e + tIn) / 15) * 15;
          if (st + o.mins + tOut <= nx.s && st + o.mins <= dayE + (nx.end ? 0 : 0)) { const extra = Math.max(0, tIn + tOut - base); if (!best || extra < best.extra) best = { date: d, staff: s.id, start: bkHHMM(st), extra, tIn }; } }
        if (nx.e > prev.e) prev = { e: nx.e, loc: nx.locOut || nx.loc || prev.loc };
      }
      if (best) { best.near = near && near.m <= 20 ? near : null; best.days = i; res.push(best); }
    } }
  const score = (r) => (o.urgent ? r.days * 1000 + bkMin(r.start) : r.extra + r.days * 1.5 - (r.near ? 25 : 0));
  return res.sort((a, b) => score(a) - score(b)).slice(0, 8);
}
function bkSuggHtml(list, o) {
  if (!list.length) return '<div class="hint">No free time found in the next 6 weeks for the people who can do this. Try fewer services, a shorter time, or tick Urgent and book over something.</div>';
  return `<div class="bk-sugg">${list.map((r, i) => `<button type="button" class="bk-sopt" data-act="bk-pick" data-i="${i}"><b>${bkDate(r.date)} ${bkTime(r.start)}</b> · ${h(Bk.pname(r.staff))}<span class="hint">${r.near ? `near ${h(r.near.x.what)} (~${r.near.m} min apart) · ` : ''}${o.type && Bk.type(o.type).where === 'phone' ? 'phone' : `adds ~${r.extra} min driving`}</span></button>`).join('')}</div>`;
}

/* ---------------- the booking form ---------------- */
let BKF = null; // the booking being edited
function bkClientResults(q) {
  q = (q || '').trim().toLowerCase(); if (q.length < 2) return [];
  const bz = D.businesses.filter((b) => (b.name || '').toLowerCase().includes(q)).slice(0, 8).map((b) => ({ bid: b.id, label: b.name, sub: (IDX.bizContacts.get(b.id) || []).map(fullName).slice(0, 3).join(', ') }));
  const cs = D.contacts.filter((c) => fullName(c).toLowerCase().includes(q) || (c.mobiles || []).some((m) => (m.value || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')))).slice(0, 8).map((c) => { const b = bizOf(c)[0]; return { cid: c.id, bid: b ? b.id : null, label: fullName(c), sub: b ? b.name : 'no business' }; });
  return [...bz, ...cs].slice(0, 12);
}
function bkFarmsOf(bid) { const b = bid && IDX.biz.get(bid); return b ? b.farmLinks.filter((l) => !l.past).map((l) => IDX.farms.get(l.fid)).filter(Boolean) : []; }
function bkContactsOf(bid) { return bid ? IDX.bizContacts.get(bid) || [] : []; }
function bkMobile(c) { return c && ((c.mobiles || [])[0] || {}).value; }
function bkPidsOf(bid) { const b = bid && IDX.biz && IDX.biz.get(bid); return b ? (b.patientIds || []).filter((p) => p && p.value) : []; }
function bkFormHtml() {
  const f = BKF, types = Bk.cfg('type'), svcs = Bk.cfg('service'), t = Bk.type(f.type);
  const farms = bkFarmsOf(f.bid), cons = bkContactsOf(f.bid); const isNew = !Bk.list('bookings').includes(f._orig);
  const sug = bkSuggestMins(f.type, f.svcs, f.fids);
  const ppl = Bk.people(), pids = bkPidsOf(f.bid), bz = f.bid && IDX.biz.get(f.bid), multi = t.where === 'farm' && f.fids.length > 1;
  const need = bkNeedsLabour(f), labourSvc = svcs.find((x) => x.alongside);
  const farmOpts = (sel) => `<option value="">${farms.length ? 'Choose…' : 'No farms saved for this client'}</option>${farms.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${h(x.name || x.address || 'Farm')}${h(bkFarmTag(x.id))}${x.driveMin != null ? ` (${Math.round(x.driveMin)} min from base)` : ''}</option>`).join('')}`;
  return `<div class="grid2"><div class="f"><label for="bkf-type">Appointment type</label><select id="bkf-type">${types.map((x) => `<option value="${x.id}" ${x.id === f.type ? 'selected' : ''}>${h(x.name)}</option>`).join('')}</select></div>
    <div class="f"><label>Status</label><div class="bk-seg">${[['unconfirmed', 'Unconfirmed'], ['confirmed', 'Confirmed']].map(([v, l]) => `<label class="bk-radio"><input type="radio" name="bkf-status" value="${v}" ${f.status === v ? 'checked' : ''}> ${l}</label>`).join('')}</div></div></div>
  <div class="f"><label for="bkf-q">Client</label>${f.bid || f.cid ? `<div class="bk-picked"><b>${h(Bk.who(f))}</b> <button type="button" class="btn small" data-act="bkf-clear">Change</button></div>` : `<div class="search"><input id="bkf-q" placeholder="Search a business, person or mobile" autocomplete="off"></div><div id="bkf-res"></div>`}</div>
  ${f.bid || f.cid ? `${t.where === 'farm' ? `<div class="f"><label for="bkf-farm0">Farm / yards${multi ? ' (in the order you\'ll visit them)' : ''}</label>${(f.fids.length ? f.fids : ['']).map((fid, i) => `<div class="bk-svcrow"><select id="bkf-farm${i}" data-bkfarm="${i}" aria-label="Farm ${i + 1}">${farmOpts(fid)}</select>${f.fids.length > 1 ? `<button type="button" class="x" data-act="bkf-farmdel" data-i="${i}" aria-label="Remove this farm">×</button>` : ''}</div>`).join('')}
      ${farms.length > 1 && f.fids.length && f.fids.length < farms.length ? '<button type="button" class="btn small" data-act="bkf-farmadd">➕ Another farm / yards</button>' : ''}${multi ? '<div class="hint">Travel is worked out to the first farm and home from the last; driving between them is added to the length.</div>' : ''}</div>` : ''}
    <div class="grid2"><div class="f"><label for="bkf-con">SMS goes to</label><select id="bkf-con"><option value="">Nobody</option>${cons.map((c) => `<option value="${c.id}" ${c.id === f.cid ? 'selected' : ''} ${bkMobile(c) ? '' : 'disabled'}>${h(fullName(c))}${bkMobile(c) ? ' · ' + h(bkMobile(c)) : ' (no mobile)'}</option>`).join('')}</select></div>
    <div class="f"><label>Herds / flocks</label>${pids.length ? `<div class="checks">${pids.map((p, i) => `<label><input type="checkbox" data-bkpid="${i}" ${f.pids.some((q) => q.value === p.value) ? 'checked' : ''}> ${typeof pidEmo === 'function' ? pidEmo(p) : ''}${h(p.value)}${p.label ? ` <span class="hint">${h(p.label)}</span>` : ''}</label>`).join('')}</div><div class="hint">Tick each one this visit is for — each gets its own clinical record.</div>` : `<div class="hint">${bz ? 'No herd or flock IDs saved for this business yet — add them under Patient IDs on the business page.' : 'Choose a business to pick the herd or flock.'}</div>`}</div></div>` : ''}
  <div class="f"><label>What's being done, and who</label>${(f.svcs.length ? f.svcs : [{ staff: [] }]).map((x, i) => { const sv = x.svc && Bk.svc(x.svc); const at = x.fid || f.fids[0]; const y = sv && sv.mode === 'perhead' && sv.rateFrom === 'farm' ? bkYard(at, x.svc) : null; const who = x.staff || [];
    return `<div class="bk-svcblk ${sv && sv.alongside ? 'along' : ''}"><div class="bk-svcrow"><select data-bksvc="${i}" aria-label="Service ${i + 1}"><option value="">Choose…</option>${svcs.map((s) => `<option value="${s.id}" ${s.id === x.svc ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select>${sv && sv.mode === 'perhead' ? `<input type="number" min="0" inputmode="numeric" data-bkhead="${i}" value="${x.head || ''}" aria-label="Head"><span class="hint">head</span>${at ? `<input type="number" min="1" inputmode="numeric" data-bkhph="${i}" value="${x.hph || (y && y.hph) || sv.hph || ''}" aria-label="Head per hour"><span class="hint">per hour here</span>` : ''}` : ''}${sv && sv.alongside ? '<span class="hint">runs alongside — doesn\'t add time</span>' : ''}<button type="button" class="x" data-act="bkf-svcdel" data-i="${i}" aria-label="Remove">×</button></div>
      ${multi && sv && !sv.alongside ? `<div class="bk-svcrow"><span class="hint">At</span><select data-bksfarm="${i}" aria-label="Which farm">${f.fids.map((fid) => { const fm = IDX.farms.get(fid); return `<option value="${fid}" ${fid === at ? 'selected' : ''}>${h(fm ? fm.name || fm.address || 'Farm' : 'Farm')}</option>`; }).join('')}</select></div>` : ''}
      <div class="bk-who"><span class="hint">Who:</span>${ppl.map((s) => { const bad = x.svc && !Bk.canDo(s, x.svc); return `<label class="bk-pp ${bad ? 'bad' : ''}" title="${bad ? 'Not set up for ' + h(sv.name) : ''}"><input type="checkbox" data-bkwho="${i}" data-staff="${s.id}" ${who.includes(s.id) ? 'checked' : ''}> ${h(s.preferred_name || s.full_name)}</label>`; }).join('') || '<span class="hint">The staff list loads the first time you sign in with internet.</span>'}</div></div>`; }).join('')}
    <button type="button" class="btn small" data-act="bkf-svcadd">➕ Another service</button>${labourSvc && !f.svcs.some((x) => x.svc && Bk.svc(x.svc).alongside) ? ` <button type="button" class="btn small" data-act="bkf-labour">➕ ${h(labourSvc.name)}</button>` : ''}
    ${need && !f.noLabour ? `<div class="bk-warnbox bk-labour">${need === 'always' ? `⚠ <b>${h(Bk.who(f))}</b> always needs ${h((labourSvc || { name: 'additional labour' }).name.toLowerCase())}.` : `Do you want ${h((labourSvc || { name: 'additional labour' }).name.toLowerCase())} booked for this?`}<div class="actions" style="margin-top:6px"><button type="button" class="btn small primary" data-act="bkf-labour">Yes — add it</button><button type="button" class="btn small" data-act="bkf-nolabour">${need === 'always' ? 'Not this time' : 'No'}</button></div></div>` : ''}
    ${need === 'always' && f.noLabour ? `<div class="hint">No additional labour this time (this client usually needs it). <button type="button" class="btn small" data-act="bkf-labour">Add it</button></div>` : ''}
    ${t.where === 'farm' && f.fids.length && f.svcs.some((x) => x.svc && Bk.svc(x.svc).mode === 'perhead' && Bk.svc(x.svc).rateFrom === 'farm') ? '<div class="hint">Change the "per hour here" number to match how fast these yards run — tick below to remember it for this farm (it shows on the business page too).</div>' : ''}</div>
  <div class="grid2"><div class="f"><label for="bkf-mins">How long (minutes)</label><input id="bkf-mins" type="number" min="5" step="5" inputmode="numeric" value="${f.mins}"><div class="hint" id="bkf-why">Suggested ${bkDur(sug.mins)} — ${h(sug.why)} ${f.mins !== sug.mins ? `<button type="button" class="btn small" data-act="bkf-usesug">Use ${bkDur(sug.mins)}</button>` : ''}</div></div>
    <div class="f"><label>&nbsp;</label>${t.where === 'farm' && f.fids.length && f.svcs.some((x) => x.svc && Bk.svc(x.svc).mode === 'perhead' && Bk.svc(x.svc).rateFrom === 'farm') ? `<label class="bk-radio"><input type="checkbox" id="bkf-rememberyard" ${f.rememberYard ? 'checked' : ''}> Remember the speed for these yards</label>` : ''}</div></div>
  <div class="grid2"><div class="f"><label for="bkf-date">Date</label><input id="bkf-date" type="date" value="${f.date || ''}"></div><div class="f"><label for="bkf-start">Start time</label><input id="bkf-start" type="time" step="900" value="${f.start || ''}"></div></div>
  <div class="actions"><button type="button" class="btn" data-act="bkf-suggest">🔎 Suggest days and people</button><label class="bk-radio"><input type="checkbox" id="bkf-urgent" ${f.urgent ? 'checked' : ''}> ⚡ Urgent — soonest first, nearby farms don't matter</label></div>
  <div id="bkf-sugg"></div><div id="bkf-warn">${bkWarnHtml(bkProblems(bkFormStaff(f)))}</div>
  ${isNew ? `<label class="bk-radio" style="margin:8px 0"><input type="checkbox" id="bkf-sms" ${f.sms.send ? 'checked' : ''}> Send the "booking made" SMS${f.cid && bkMobile(D.contacts.find((c) => c.id === f.cid)) ? '' : ' <span class="hint">(choose who it goes to above)</span>'}</label>` : `<div class="hint" style="margin:8px 0">${bkSmsStatus(f)}</div>`}
  <label class="bk-radio" style="margin:0 0 8px"><input type="checkbox" id="bkf-rem" ${f.sms.noReminder ? '' : 'checked'}> Send a reminder SMS 5 days before (8:30am)</label>
  ${!isNew ? bkTextsHtml(f) : ''}
  <div class="f"><label for="bkf-notes">Notes</label><textarea id="bkf-notes" rows="3">${h(f.notes || '')}</textarea></div>
  ${!isNew ? bkExistingActions(f) : ''}`;
}
function bkFormStaff(f) { f.staff = [...new Set((f.svcs || []).flatMap((x) => x.staff || []))]; return f; } // everyone on the booking = everyone on any of its services
function bkWarnHtml(list) { return list.length ? `<div class="bk-warnbox">${list.map((x) => `<div>⚠ ${h(x)}</div>`).join('')}</div>` : ''; }
function bkSmsStatus(b) {
  const s = b.sms || {}; if (!s.send) return 'No "booking made" SMS for this booking.';
  const row = Bk.smsKey('booked:' + b.id); if (row) return `"Booking made" SMS: ${bkSmsState(row)}.`;
  return s.booked ? `"Booking made" SMS marked as sent ${new Date(s.booked).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.` : '"Booking made" SMS not sent yet (it goes within a few minutes once the office phone is set up).';
}
function bkSmsState(x) { return ({ queued: '⏳ waiting to send', sending: '📤 sending', sent: '✓ sent', delivered: '✓✓ delivered', failed: '⚠ failed' + (x.error ? ' — ' + x.error : ''), received: '📥 received' })[x.status] || x.status; }
function bkSmsWho(x) { const c = x.contact_id && D.contacts.find((y) => y.id === x.contact_id); const b = x.business_id && IDX.biz && IDX.biz.get(x.business_id); return c ? fullName(c) + (b ? ' (' + b.name + ')' : '') : b ? b.name : x.phone || 'Unknown number'; }
function bkTextsHtml(b) {
  const rows = ((D && D.smsLog) || []).filter((x) => x.booking_id === b.id || (x.kind === 'reply' && ((b.cid && x.contact_id === b.cid) || (b.bid && x.business_id === b.bid)) && Date.parse(x.at) > (b.createdAt || 0) - 864e5)).sort((a, c) => Date.parse(c.at) - Date.parse(a.at));
  return `<div class="card bk-texts"><div class="lbl">Texts</div>${rows.map((x) => `<div class="bk-text ${x.kind === 'reply' ? 'in' : ''}"><span class="hint">${new Date(x.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · ${({ booked: 'Booking made', reminder: 'Reminder', proposal: 'New time', manual: 'Text' + (x.by ? ' from ' + x.by : ''), reply: 'Reply' })[x.kind]} · ${bkSmsState(x)}</span><div>${h(x.body || '')}</div></div>`).join('') || '<div class="hint">No texts yet.</div>'}
  <div class="actions"><button type="button" class="btn small" data-act="bk-text" data-booking="${b.id}" data-cid="${b.cid || ''}" data-bid="${b.bid || ''}">📱 Send a text…</button></div></div>`;
}
function bkFill(text, b) { // the same fill-ins the office phone uses
  const c = b.cid && D.contacts.find((x) => x.id === b.cid), f = Bk.farm(b), bz = b.bid && IDX.biz.get(b.bid);
  const v = { first: c ? c.first || '' : '', name: c ? fullName(c) : '', business: bz ? bz.name : '', type: Bk.type(b.type).name.toLowerCase(), day: bkDate(b.date, { weekday: 'long' }), date: bkDate(b.date, { day: 'numeric', month: 'long' }), time: b.start ? bkTime(b.start) : '', farm: f ? f.name || '' : '', at_farm: f && f.name ? ' at ' + f.name : '', vet: (b.staff || []).map(Bk.pname).join(' and '), old_date: bkDate(b.date, { weekday: 'long', day: 'numeric', month: 'long' }) };
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)).replace(/\s+([.,])/g, '$1');
}
async function bkTextOpen(d) {
  const b = d.booking ? bkRec(d.booking) : null; const cons = d.bid ? bkContactsOf(d.bid) : d.cid ? D.contacts.filter((c) => c.id === d.cid) : [];
  const opts = cons.filter(bkMobile).map((c) => ({ v: bkMobile(c), l: `${fullName(c)} · ${bkMobile(c)}`, cid: c.id }));
  if (d.phone && !opts.some((o) => o.v.replace(/\D/g, '').replace(/^61/, '0') === d.phone.replace(/\D/g, '').replace(/^61/, '0'))) opts.unshift({ v: d.phone, l: d.phone, cid: d.cid || '' });
  const tpls = Bk.cfg('sms');
  const ok = await askBox('Send a text', `<div class="f"><label for="bt-to">To</label><select id="bt-to" data-ask="to">${opts.map((o) => `<option value="${h(o.v)}" data-cid="${o.cid}" ${o.cid === (b && b.cid) ? 'selected' : ''}>${h(o.l)}</option>`).join('')}</select>${opts.length ? '' : '<div class="hint">No mobile number saved for this client.</div>'}</div>
    <div class="f"><label for="bt-tpl">Start from</label><select id="bt-tpl"><option value="">A blank message</option>${tpls.map((t) => `<option value="${t.id}">${h(t.name)}</option>`).join('')}</select></div>
    <div class="f"><label for="bt-body">Message</label><textarea id="bt-body" data-ask="body" rows="5"></textarea><div class="hint" id="bt-n">0 characters</div></div>
    <div class="hint">Sent from the office phone (0499 489 919). Replies show in Scheduling → Jobs.</div>`, 'Send', false, 'Cancel');
  if (!ok) return; const to = ASK_FORM.to, body = (ASK_FORM.body || '').trim(); if (!to || !body) { toast('Choose who to text and write the message'); return; }
  const c = cons.find((x) => bkMobile(x) === to);
  try { await rpc('sms_queue', { k: Dev.k(), phone: to, body, contact_id: c ? c.id : d.cid || null, business_id: d.bid || null, booking_id: b ? b.id : null }); toast('Text queued — it goes from the office phone in a moment'); SupaSync.smsAt = 0; SupaSync.soon(); }
  catch (e) { toast(e.offline ? 'No internet — the text wasn\'t sent. Try again when you have signal.' : e.message); }
}
document.addEventListener('change', (e) => { if (e.target.id !== 'bt-tpl') return; const t = Bk.get(e.target.value); const box = document.getElementById('bt-body'); if (!box) return; const b = BK._textBooking; box.value = t ? (b ? bkFill(t.text, b) : t.text) : ''; box.dispatchEvent(new Event('input', { bubbles: true })); });
document.addEventListener('input', (e) => { if (e.target.id !== 'bt-body') return; const n = e.target.value.length; const el = document.getElementById('bt-n'); if (el) el.textContent = `${n} characters${n > 160 ? ` · ${Math.ceil(n / 153)} texts` : ''}`; });
function bkExistingActions(f) {
  const p = f.proposal;
  return `<div class="card bk-actions"><div class="lbl">${p ? 'New time suggested to the client' : 'Change this booking'}</div>
  ${p ? `<p>Suggested <b>${bkDate(p.date)} ${bkTime(p.start)}</b> with ${h((p.staff || f.staff).map(Bk.pname).join(', '))}. That time is held on the calendar, and the original stays put until the client answers.</p>${bkWarnHtml(bkProblems(f, p))}
    <div class="actions"><button type="button" class="btn primary" data-act="bkf-propyes">✓ Client agreed — move it</button><button type="button" class="btn" data-act="bkf-propno">Client said no — keep the original</button><button type="button" class="btn small" data-act="bkf-propose">Change the suggested time</button></div>`
    : `<div class="actions"><button type="button" class="btn" data-act="bkf-propose">↔ Suggest a new time to the client</button><button type="button" class="btn" data-act="bkf-fu">➕ Follow-up</button><button type="button" class="btn" data-act="bkf-dup">⧉ Duplicate</button><button type="button" class="btn" data-act="bkf-cancel" style="color:var(--red)">Cancel booking</button></div>`}
  <div class="hint" style="margin-top:6px">Booked ${f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}${f.by ? ' by ' + h(Bk.pname(f.by)) : ''}. To move it straight away (no need to ask the client), just change the date or time above and Save.</div></div>`;
}
function bkFormRead() {
  const f = BKF, q = (id) => document.getElementById(id); if (!q('bkf-type')) return;
  const oldType = f.type; f.type = q('bkf-type').value;
  const st = document.querySelector('input[name=bkf-status]:checked'); if (st) f.status = st.value;
  const fe = [...document.querySelectorAll('[data-bkfarm]')]; if (fe.length) f.fids = [...new Set(fe.map((el) => el.value).filter(Boolean))];
  f.fid = f.fids[0] || null; if (q('bkf-con')) f.cid = q('bkf-con').value || null;
  const pids = bkPidsOf(f.bid); if (document.querySelector('[data-bkpid]')) f.pids = [...document.querySelectorAll('[data-bkpid]:checked')].map((el) => pids[+el.dataset.bkpid]).filter(Boolean).map((p) => ({ value: p.value, label: p.label || '' }));
  document.querySelectorAll('[data-bksvc]').forEach((el) => { const i = +el.dataset.bksvc; f.svcs[i] = f.svcs[i] || { staff: [] }; f.svcs[i].svc = el.value; });
  document.querySelectorAll('[data-bkhead]').forEach((el) => { f.svcs[+el.dataset.bkhead].head = +el.value || 0; });
  document.querySelectorAll('[data-bkhph]').forEach((el) => { f.svcs[+el.dataset.bkhph].hph = +el.value || null; });
  document.querySelectorAll('[data-bksfarm]').forEach((el) => { f.svcs[+el.dataset.bksfarm].fid = el.value === f.fids[0] ? null : el.value; });
  const who = {}; document.querySelectorAll('[data-bkwho]').forEach((el) => { const i = +el.dataset.bkwho; who[i] = who[i] || []; if (el.checked) who[i].push(el.dataset.staff); });
  Object.keys(who).forEach((i) => { if (f.svcs[i]) f.svcs[i].staff = who[i]; });
  f.svcs.forEach((x) => { if (x.fid && !f.fids.includes(x.fid)) x.fid = null; });
  f.svcs = f.svcs.filter((x, i, a) => x.svc || a.length === 1);
  bkFormStaff(f);
  f.mins = +q('bkf-mins').value || f.mins;
  f.date = q('bkf-date').value; f.start = q('bkf-start').value; f.urgent = q('bkf-urgent').checked; f.notes = q('bkf-notes').value;
  if (q('bkf-sms')) f.sms.send = q('bkf-sms').checked; if (q('bkf-rem')) f.sms.noReminder = !q('bkf-rem').checked; if (q('bkf-rememberyard')) f.rememberYard = q('bkf-rememberyard').checked;
  return oldType !== f.type;
}
function bkFormRefresh(full) {
  const form = document.querySelector('#sheet .form'); if (!form || !BKF) return;
  if (full) { const y = form.scrollTop; form.innerHTML = bkFormHtml(); form.scrollTop = y; bkFormBindSearch(); return; }
  const mi = document.getElementById('bkf-mins'); if (mi && +mi.value !== BKF.mins) mi.value = BKF.mins;
  const w = document.getElementById('bkf-warn'); if (w) w.innerHTML = bkWarnHtml(bkProblems(bkFormStaff(BKF)));
  const sug = bkSuggestMins(BKF.type, BKF.svcs, BKF.fids); const why = document.getElementById('bkf-why');
  if (why) why.innerHTML = `Suggested ${bkDur(sug.mins)} — ${h(sug.why)} ${BKF.mins !== sug.mins ? `<button type="button" class="btn small" data-act="bkf-usesug">Use ${bkDur(sug.mins)}</button>` : ''}`;
}
function bkFormBindSearch() {
  const q = document.getElementById('bkf-q'); if (!q) return;
  q.addEventListener('input', () => { const r = bkClientResults(q.value); document.getElementById('bkf-res').innerHTML = r.map((x, i) => `<button type="button" class="bk-res" data-act="bkf-client" data-bid="${x.bid || ''}" data-cid="${x.cid || ''}"><b>${h(x.label)}</b><span class="hint">${h(x.sub || '')}</span></button>`).join('') || (q.value.trim().length > 1 ? '<div class="hint">No match</div>' : ''); });
  setTimeout(() => q.focus(), 50);
}
function bkAutoMins() { if (!BKF._minsTouched) BKF.mins = bkSuggestMins(BKF.type, BKF.svcs, BKF.fids).mins; }
async function bkFarmCheck(fid) { // pop up a warning straight away when a do-not-service (or safety-stop) farm is chosen
  const hard = bkFarmIssues(fid, BKF.svcs, BKF.fids[0]).filter((x) => x.hard); if (!hard.length) return;
  const ok = await askBox('⛔ Check this farm', `${hard.map((x) => `<p style="font-size:16px;font-weight:600;color:var(--red)">${h(x.msg)}</p>`).join('')}<p class="hint">You can still book it if you've checked it's OK.</p>`, 'Book it anyway', true, 'Remove this farm');
  if (ok) { BKF._farmOk = true; return; }
  BKF.fids = BKF.fids.filter((x) => x !== fid); BKF.fid = BKF.fids[0] || null; bkAutoMins(); bkFormRefresh(true);
}
function bkOpen(b, preset) {
  if (!b && !Bk.need('book')) return;
  const types = Bk.cfg('type'); if (!types.length) { toast('Booking settings are still loading — sync, then try again'); return; }
  const orig = b || null; preset = preset || {};
  BKF = b ? JSON.parse(JSON.stringify(b)) : { id: uid('bk'), type: types[0].id, status: 'unconfirmed', staff: [], svcs: [{ staff: [...(preset.staff || [])] }], mins: 60, date: BK.date, start: '', sms: { send: true }, notes: '', ...preset };
  BKF._orig = orig; BKF.sms = BKF.sms || { send: true }; delete BKF.suggestNow;
  BKF.fids = Bk.fids(BKF).slice(); BKF.fid = BKF.fids[0] || null; BKF.pids = BKF.pids || [];
  BKF.svcs = (BKF.svcs && BKF.svcs.length ? BKF.svcs : [{ staff: [...(BKF.staff || [])] }]).map((x) => ({ ...x, staff: [...Bk.sstaff(BKF, x)] }));
  if (!b) { if (BKF.bid && !BKF.fids.length) { const fs = bkFarmsOf(BKF.bid); if (fs.length === 1) BKF.fids = [fs[0].id]; BKF.fid = BKF.fids[0] || null; } const ps = bkPidsOf(BKF.bid); if (ps.length === 1 && !BKF.pids.length) BKF.pids = [{ value: ps[0].value, label: ps[0].label || '' }]; }
  bkFormStaff(BKF);
  openSheet(b ? 'Booking — ' + Bk.who(b) : 'New booking', bkFormHtml(), async () => bkSaveForm());
  const form = document.querySelector('#sheet .form');
  form.addEventListener('change', (e) => { const before = [...BKF.fids]; const typeChanged = bkFormRead(); const id = e.target.id || ''; const dd = e.target.dataset;
    const full = typeChanged || dd.bkfarm != null || dd.bksfarm != null || id === 'bkf-con' || dd.bksvc != null || e.target.name === 'bkf-status' || dd.bkwho != null;
    if (typeChanged || dd.bksvc != null || dd.bkhead != null || dd.bkhph != null || dd.bkfarm != null || dd.bksfarm != null) bkAutoMins();
    if (id === 'bkf-mins') BKF._minsTouched = true;
    bkFormRefresh(full);
    if (dd.bkfarm != null && e.target.value && !before.includes(e.target.value)) bkFarmCheck(e.target.value); });
  form.addEventListener('input', (e) => { if (e.target.dataset.bkhph != null) { const i = +e.target.dataset.bkhph; BKF.svcs[i].hph = +e.target.value || null; BKF.rememberYard = true; const cb = document.getElementById('bkf-rememberyard'); if (cb) cb.checked = true; } });
  bkFormBindSearch();
  if (preset.suggestNow) setTimeout(() => document.querySelector('[data-act=bkf-suggest]') && document.querySelector('[data-act=bkf-suggest]').click(), 100);
}
function bkAddLabour() { const l = Bk.cfg('service').find((x) => x.alongside); if (!l) { toast('Add a service that runs alongside (Settings → Scheduling) first'); return false; } BKF.svcs = BKF.svcs.filter((x) => x.svc); BKF.svcs.push({ svc: l.id, staff: [] }); BKF.noLabour = false; bkFormRefresh(true); return true; }
async function bkSaveForm(skipRead) { // skipRead: the caller has already read the form and then changed BKF (moving it, cancelling…) — reading again would undo that
  if (!skipRead) bkFormRead(); const f = BKF; bkFormStaff(f);
  if (!f.bid && !f.cid) { toast('Choose the client'); return false; }
  if (!f.svcs.some((x) => x.svc) && !Bk.type(f.type).fixedMins) { toast("Choose what's being done"); return false; }
  const nobody = f.svcs.find((x) => x.svc && !(x.staff || []).length); if (nobody) { toast(`Choose who's doing ${Bk.svc(nobody.svc).name}`); return false; }
  if (!f.staff.length) { toast('Choose who'); return false; }
  if (!f.date || !f.start) { toast('Choose the date and start time'); return false; }
  if (!skipRead && bkPidsOf(f.bid).length && !f.pids.length) { toast('Choose which herd or flock this is for'); return false; }
  if (f.status !== 'cancelled' && !skipRead) {
    const need = bkNeedsLabour(f);
    if (need && !f.noLabour) { const r = await askBox('Additional labour?', `<p style="font-size:16px">${need === 'always' ? `<b>${h(Bk.who(f))}</b> always needs additional labour. Book someone for it?` : 'Do you want additional labour booked for this?'}</p>`, 'Yes — add additional labour', false, '‹ Back to the booking', 'No — not needed');
      if (r === true) { if (bkAddLabour()) toast('Choose who is doing the additional labour, then Save'); return false; } if (r !== 'alt') return false; f.noLabour = true; }
    const hard = Bk.type(f.type).where === 'farm' ? f.fids.flatMap((fid) => bkFarmIssues(fid, f.svcs, f.fids[0])).filter((x) => x.hard) : [];
    if (hard.length && !f._farmOk && !(await ask(hard.map((x) => '⛔ ' + x.msg).join('\n') + '\n\nBook it anyway?', 'Yes — book anyway', true))) return false;
  }
  // remember the yard speed for each farm
  if (f.rememberYard) f.svcs.forEach((x) => { const at = x.fid || f.fids[0]; if (!at || !x.svc || !x.hph || Bk.svc(x.svc).mode !== 'perhead' || Bk.svc(x.svc).rateFrom !== 'farm') return; const id = 'yard:' + at + ':' + x.svc; let y = Bk.get(id); if (!y) { y = { id, cfg: 'yard', fid: at, svc: x.svc }; D.bkcfg.push(y); } if (y.hph !== x.hph || y.gone) { y.hph = x.hph; delete y.gone; touch(y); } });
  const rec = { ...f }; ['_orig', 'rememberYard', '_minsTouched', '_farmOk'].forEach((k) => delete rec[k]);
  rec.svcs = f.svcs.filter((x) => x.svc).map((x) => { const o = { svc: x.svc, head: x.head || 0, staff: [...(x.staff || [])] }; if (x.fid) o.fid = x.fid; return o; });
  rec.fid = f.fids[0] || null; rec.fids = [...f.fids]; if (!rec.noLabour) delete rec.noLabour;
  if (f._orig) { Object.keys(f._orig).forEach((k) => delete f._orig[k]); Object.assign(f._orig, rec); touch(f._orig); }
  else { rec.createdAt = Date.now(); rec.by = SBAuth.staff && SBAuth.staff.id; touch(rec); Bk.list('bookings').push(rec); }
  BK.date = f.date; save(); Sync.soon(); setTimeout(renderAll, 0); return true;
}
function bkProposeForm() {
  bkFormRead(); const f = BKF; const p = f.proposal || { date: f.date, start: f.start, mins: f.mins, staff: [...f.staff] };
  askBox('Suggest a new time', `<p class="hint">The original stays on the calendar. The new time is held so nobody books over it, until the client agrees.</p>
    <div class="grid2"><div class="f"><label for="bkp-date">New date</label><input id="bkp-date" data-ask="pdate" type="date" value="${p.date}"></div><div class="f"><label for="bkp-start">New start time</label><input id="bkp-start" data-ask="pstart" type="time" step="900" value="${p.start}"></div></div>
    <div class="f"><label>Who</label><div class="checks">${Bk.people().map((s) => `<label><input type="checkbox" data-askchk="ps_${s.id}" ${(p.staff || f.staff).includes(s.id) ? 'checked' : ''}> ${h(s.preferred_name || s.full_name)}</label>`).join('')}</div></div>
    <div class="actions"><button type="button" class="btn small" id="bkp-suggest">🔎 Suggest</button></div><div id="bkp-sugg"></div>`, 'Hold this time', false, 'Cancel').then((ok) => {
    if (!ok) return;
    const staff = Object.keys(ASK_FORM).filter((k) => k.startsWith('ps_') && ASK_FORM[k]).map((k) => k.slice(3));
    const pr = { date: ASK_FORM.pdate, start: ASK_FORM.pstart, mins: f.mins, staff, at: Date.now(), by: SBAuth.staff && SBAuth.staff.id, smsSent: null };
    if (!pr.date || !pr.start || !pr.staff.length) { toast('Choose the new date, time and who'); return; }
    f.proposal = pr; bkFormRefresh(true); toast('New time held — tap Save to keep it'); });
  setTimeout(() => { const g = (id) => document.getElementById(id); const sb = g('bkp-suggest'); if (!sb) return;
    sb.onclick = () => { const list = bkSuggest({ type: f.type, fids: f.fids, mins: f.mins, svcs: f.svcs.filter((x) => x.svc && !Bk.svc(x.svc).alongside), urgent: f.urgent, skipId: f.id });
      g('bkp-sugg').innerHTML = list.length ? `<div class="bk-sugg">${list.map((r, i) => `<button type="button" class="bk-sopt" data-i="${i}"><b>${bkDate(r.date)} ${bkTime(r.start)}</b> · ${h(Bk.pname(r.staff))}<span class="hint">${r.near ? 'near ' + h(r.near.x.what) + ' · ' : ''}adds ~${r.extra} min driving</span></button>`).join('')}</div>` : '<div class="hint">Nothing free found.</div>';
      g('bkp-sugg').querySelectorAll('.bk-sopt').forEach((b) => (b.onclick = () => { const r = list[+b.dataset.i]; g('bkp-date').value = r.date; g('bkp-start').value = r.start; document.querySelectorAll('[data-askchk^="ps_"]').forEach((el) => (el.checked = el.dataset.askchk === 'ps_' + r.staff)); })); }; }, 80);
}

/* ---------------- blocks: meetings, admin time, RDOs, leave… (repeat, on/off, skip one day) ---------------- */
function bkBlockOpen(b, preset) {
  if (!Bk.need('blocks')) return;
  const isNew = !b; const f = b ? JSON.parse(JSON.stringify(b)) : { id: uid('blk'), type: (Bk.cfg('blocktype')[0] || {}).id, staff: [], date: BK.date, start: '12:00', end: '13:00', allDay: false, repeat: { every: 'none', days: [] }, on: true, note: '', ...(preset || {}) };
  const r = f.repeat || { every: 'none' }; const ppl = Bk.people();
  openSheet(isNew ? 'New block' : 'Block — ' + Bk.btype(f.type).name, `<div class="grid2"><div class="f"><label for="bb-type">Type</label><select id="bb-type">${Bk.cfg('blocktype').map((t) => `<option value="${t.id}" ${t.id === f.type ? 'selected' : ''}>${h(t.name)}</option>`).join('')}</select><div class="hint">Add your own types in Settings → Scheduling.</div></div>
    <div class="f"><label class="bk-radio" style="margin-top:22px"><input type="checkbox" id="bb-on" ${f.on ? 'checked' : ''}> On (untick to turn it off without deleting it)</label></div></div>
  <div class="f"><label>Who</label><div class="checks"><label><input type="checkbox" id="bb-all" ${f.staff === 'all' ? 'checked' : ''}> Everyone</label>${ppl.map((s) => `<label><input type="checkbox" data-bbstaff="${s.id}" ${f.staff !== 'all' && f.staff.includes(s.id) ? 'checked' : ''}> ${h(s.preferred_name || s.full_name)}</label>`).join('')}</div></div>
  <div class="grid2"><div class="f"><label for="bb-date">${r.every === 'none' ? 'Date' : 'Starting'}</label><input id="bb-date" type="date" value="${f.date}"></div><div class="f"><label for="bb-to">Until (several days in a row)</label><input id="bb-to" type="date" value="${f.toDate || ''}"></div></div>
  <div class="grid2"><div class="f"><label class="bk-radio"><input type="checkbox" id="bb-allday" ${f.allDay ? 'checked' : ''}> All day</label></div><div class="f bk-times2"><label for="bb-start">From</label><input id="bb-start" type="time" step="900" value="${f.start}"><label for="bb-end">to</label><input id="bb-end" type="time" step="900" value="${f.end}"></div></div>
  <div class="grid2"><div class="f"><label for="bb-rep">Repeats</label><select id="bb-rep">${[['none', 'Does not repeat'], ['weekdays', 'Every weekday'], ['daily', 'Every day'], ['weekly', 'Weekly on…'], ['fortnightly', 'Fortnightly on… (e.g. RDOs)'], ['monthly', 'Monthly on this date']].map(([v, l]) => `<option value="${v}" ${r.every === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="f"><label for="bb-until">Repeat until</label><input id="bb-until" type="date" value="${r.until || ''}"></div></div>
  <div class="f"><label>On these days (weekly / fortnightly)</label><div class="checks">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" data-bbday="${d}" ${(r.days || []).includes(d) ? 'checked' : ''}> ${DOW_NAMES[d]}</label>`).join('')}</div></div>
  <div class="f"><label for="bb-note">Note</label><input id="bb-note" value="${h(f.note || '')}"></div>
  ${!isNew ? `<div class="actions">${r.every !== 'none' ? `<button type="button" class="btn" data-act="bb-skip" data-id="${f.id}">Skip just ${bkDate(preset && preset.day || BK.date)}</button>` : ''}<button type="button" class="btn" data-act="bb-del" data-id="${f.id}" style="color:var(--red)">Delete block</button></div>${(f.skip || []).length ? `<div class="hint">Skipped: ${f.skip.map((d) => bkDate(d)).join(', ')}</div>` : ''}` : ''}`, async () => {
    const g = (id) => document.getElementById(id);
    f.type = g('bb-type').value; f.on = g('bb-on').checked; f.staff = g('bb-all').checked ? 'all' : [...document.querySelectorAll('[data-bbstaff]:checked')].map((el) => el.dataset.bbstaff);
    if (f.staff !== 'all' && !f.staff.length) { toast('Choose who it applies to'); return false; }
    f.date = g('bb-date').value; f.toDate = g('bb-to').value || null; f.allDay = g('bb-allday').checked; f.start = g('bb-start').value; f.end = g('bb-end').value; f.note = g('bb-note').value.trim();
    f.repeat = { every: g('bb-rep').value, until: g('bb-until').value || null, days: [...document.querySelectorAll('[data-bbday]:checked')].map((el) => +el.dataset.bbday) };
    if (!f.date) { toast('Choose the date'); return false; } if (!f.allDay && (!f.start || !f.end || f.end <= f.start)) { toast('Check the times'); return false; }
    const ex = Bk.list('blocks').find((x) => x.id === f.id); if (ex) { Object.keys(ex).forEach((k) => delete ex[k]); Object.assign(ex, f); touch(ex); } else { touch(f); D.blocks.push(f); }
    save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}

/* ---------------- booking settings ---------------- */
function bkSettingsHtml() {
  const ed = Bk.can('settings'), adm = window.SBAuth && SBAuth.isAdmin(), ppl = Bk.people();
  const row = (x, extra) => `<div class="kv" style="align-items:center">${x.colour ? `<span class="bk-dot" style="--c:${x.colour}"></span>` : ''}<div class="v"><b>${h(x.name)}</b>${extra ? `<br><span class="hint">${extra}</span>` : ''}</div>${ed ? `<button class="btn small" data-act="bks-edit" data-id="${x.id}">✏️</button>` : ''}</div>`;
  const where = { farm: 'On a farm (travel worked out)', base: 'At homebase', phone: 'Phone — no travel' };
  return `<div class="bk-setwrap">
  ${ed ? '' : '<div class="hint" style="margin-bottom:8px">You can see these but not change them — ask the office.</div>'}
  <div class="card"><h3><span class="sp">Appointment types</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="type">➕ New</button>' : ''}</h3>${Bk.cfg('type').map((x) => row(x, `${where[x.where] || ''}${x.fixedMins ? ' · always ' + bkDur(x.fixedMins) : ' · length from what\'s being done'}`)).join('')}</div>
  <div class="card"><h3><span class="sp">Services (what's being done)</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="service">➕ New</button>' : ''}</h3><div class="hint" style="margin-bottom:6px">Per-head services work out the length from the head count — either at one rate for every farm, or at each farm's own rate (set on the business page, or by ticking "Remember the speed for these yards" on a booking).</div>${Bk.cfg('service').map((x) => row(x, (x.mode === 'perhead' ? (x.rateFrom === 'farm' ? `rate from each farm${x.hph ? ` (usual ${x.hph} an hour)` : ''}` : `${x.hph} head an hour`) : `set time ${bkDur(+x.mins || 0)}`) + (x.setup ? ` + ${x.setup} min set-up and pack-up` : '') + (x.alongside ? ' · runs alongside' : '') + (x.askLabour ? ' · asks about additional labour' : '') + (x.yard ? ` · counts as ${x.yard === 'preg' ? 'preg' : 'bull'} testing` : ''))).join('')}
    ${Bk.cfg('yard').length ? `<details style="margin-top:6px"><summary class="hint" style="cursor:pointer">Remembered yard speeds (${Bk.cfg('yard').length})</summary>${Bk.cfg('yard').map((y) => { const f = IDX.farms && IDX.farms.get(y.fid); return `<div class="kv" style="align-items:center"><div class="v">${h(f ? farmLabel(f) : 'Farm')} — ${h(Bk.svc(y.svc).name)}: <b>${y.hph}/hour</b></div>${ed ? `<button class="btn small" data-act="bks-yarddel" data-id="${y.id}">Forget</button>` : ''}</div>`; }).join('')}</details>` : ''}</div>
  <div class="card"><h3>People — hours and what they can be booked for</h3><div class="hint" style="margin-bottom:6px">Working hours, the time kept at the end of the day for records and restocking, and locums (only bookable on days marked available).${adm ? '' : ' Only the admin can change what each person can be booked for.'}</div>
    ${ppl.map((s) => { const c = Bk.scfg(s); return `<div class="kv" style="align-items:center"><div class="v"><b>${h(s.preferred_name || s.full_name)}</b><br><span class="hint">${c.mode === 'locum' ? 'Locum — available on chosen days' : [1, 2, 3, 4, 5, 6, 0].filter((d) => c.hours[d]).map((d) => DOW_NAMES[d]).join(', ') + ' ' + (Object.values(c.hours)[0] ? `${bkTime(Object.values(c.hours)[0][0])}–${bkTime(Object.values(c.hours)[0][1])}` : '')}${c.endBuffer ? ` · ${c.endBuffer} min end of day` : ''} · ${c.canDo ? 'only ' + c.canDo.map((x) => Bk.svc(x).name).join(', ') : 'all services'}</span></div>${ed || adm ? `<button class="btn small" data-act="bks-staff" data-id="${s.id}">✏️</button>` : ''}</div>`; }).join('') || '<div class="hint">The staff list loads when you are online and signed in.</div>'}</div>
  <div class="card"><h3><span class="sp">Block types</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="blocktype">➕ New</button>' : ''}</h3>${Bk.cfg('blocktype').map((x) => row(x)).join('')}
    <div class="lbl" style="margin-top:8px">Blocks</div>${Bk.list('blocks').filter((b) => !b.gone).map((b) => `<div class="kv" style="align-items:center"><span class="bk-dot" style="--c:${Bk.btype(b.type).colour}"></span><div class="v">${h(Bk.btype(b.type).name)}${b.note ? ' — ' + h(b.note) : ''}<br><span class="hint">${b.staff === 'all' ? 'Everyone' : b.staff.map(Bk.pname).join(', ')} · ${b.allDay ? 'all day' : bkTime(b.start) + '–' + bkTime(b.end)} · ${({ none: bkDate(b.date), weekdays: 'every weekday', daily: 'every day', weekly: 'weekly', fortnightly: 'fortnightly', monthly: 'monthly' })[(b.repeat || {}).every || 'none']}${b.on ? '' : ' · <b>off</b>'}</span></div>${Bk.can('blocks') ? `<label class="bk-radio"><input type="checkbox" data-act="bks-blockon" data-id="${b.id}" ${b.on ? 'checked' : ''}> On</label><button class="btn small" data-act="bk-openblock" data-id="${b.id}">✏️</button>` : ''}</div>`).join('')}</div>
  <div class="card"><h3><span class="sp">SMS templates</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="sms">➕ New</button>' : ''}</h3><div class="hint" style="margin-bottom:6px">Fill-ins: {first} {name} {business} {type} {day} {date} {time} {farm} {at_farm} {vet} {old_date}. Sent from the office phone: "booking made" within a few minutes of booking, reminders 5 days before at 8:30am, and new-time texts as soon as a new time is held.</div>${Bk.cfg('sms').map((x) => row(x, `${({ booked: 'Sent when a booking is made', reminder: 'Reminder, 5 days before at 8:30am', proposal: 'When a new time is suggested', other: 'Sent by hand' })[x.use] || ''} · “${h((x.text || '').slice(0, 90))}${(x.text || '').length > 90 ? '…' : ''}”`)).join('')}</div>
  <div class="card"><h3><span class="sp">Follow-up types</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="futype">➕ New</button>' : ''}</h3>${Bk.cfg('futype').map((x) => row(x, `due ${x.days} days after`)).join('')}</div>
  ${adm ? `<div class="card"><h3>Permissions (admin only)</h3><div class="hint" style="margin-bottom:6px">Everyone can do all of these to start with. Untick to stop someone.</div><div class="bk-dayscroll"><table class="bk-perm"><thead><tr><th></th>${BK_PERMS.map(([k, l]) => `<th>${h(l)}</th>`).join('')}</tr></thead><tbody>${ppl.map((s) => { const pr = ((Bk.get('perms') || {}).staff || {})[s.id] || {}; return `<tr><th>${h(s.preferred_name || s.full_name)}</th>${BK_PERMS.map(([k]) => `<td><input type="checkbox" data-act="bks-perm" data-staff="${s.id}" data-k="${k}" ${pr[k] === false ? '' : 'checked'} aria-label="${h(k)}"></td>`).join('')}</tr>`; }).join('')}</tbody></table></div></div>` : ''}
  </div>`;
}
/* colour: a square to pick from, a box for the colour code, and the colours already in use */
const BK_SWATCH = ['#2f7a55', '#3a6ea5', '#8a5a9e', '#b5791c', '#b42318', '#d97706', '#0f766e', '#64748b', '#7c8a6e', '#6f7fb0', '#a0782f', '#9a6b8a', '#9b5050', '#1f2937'];
const bkHex = (v) => { v = String(v || '').trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) return ('#' + v.replace('#', '')).toLowerCase(); if (/^#?[0-9a-f]{3}$/i.test(v)) return ('#' + v.replace('#', '').split('').map((c) => c + c).join('')).toLowerCase(); return null; };
function bkColourField(c, selfId) {
  const used = Bk.list('bkcfg').filter((y) => !y.gone && (y.cfg === 'type' || y.cfg === 'blocktype') && y.colour && y.id !== selfId);
  return `<div class="f"><label for="bc-colourtxt">Colour</label><div class="bk-hrow"><input id="bc-colour" type="color" value="${h(c)}" aria-label="Pick a colour" class="bk-colsq"><input id="bc-colourtxt" value="${h(c)}" maxlength="7" style="max-width:120px;font-family:monospace" aria-label="Colour code" autocomplete="off" spellcheck="false"></div>
    ${used.length ? `<div class="hint" style="margin-top:6px">Already used — tap to use the same:</div><div class="bk-swrow">${used.map((y) => `<button type="button" class="bk-sw" data-act="bks-colour" data-c="${h(y.colour)}" style="--c:${h(y.colour)}" title="${h(y.name)} ${h(y.colour)}"><span></span>${h(y.name)}</button>`).join('')}</div>` : ''}
    <div class="hint" style="margin-top:6px">Suggestions:</div><div class="bk-swrow">${BK_SWATCH.map((x) => `<button type="button" class="bk-sw dot" data-act="bks-colour" data-c="${x}" style="--c:${x}" aria-label="${x}"><span></span></button>`).join('')}</div></div>`;
}
const BK_PATTERNS = [['light', 'Pale fill'], ['solid', 'Solid colour'], ['stripes', 'Stripes'], ['dots', 'Dots'], ['checks', 'Checks'], ['outline', 'Outline only']];
function bkPatternField(p, c) { return `<div class="f"><label>Pattern on the calendar</label><div class="bk-swrow">${BK_PATTERNS.map(([v, l]) => `<label class="bk-patopt"><input type="radio" name="bc-pat" value="${v}" ${p === v ? 'checked' : ''}><span class="bk-patdemo pat-${v}" style="--c:${h(c)}"></span>${l}</label>`).join('')}</div></div>`; }
const bkPat = (x) => 'pat-' + ((x && x.pattern) || 'light');
document.addEventListener('input', (e) => { const id = e.target.id; if (id !== 'bc-colour' && id !== 'bc-colourtxt') return; const c = id === 'bc-colour' ? e.target.value : bkHex(e.target.value); if (!c) return; if (id === 'bc-colour') document.getElementById('bc-colourtxt').value = c; else document.getElementById('bc-colour').value = c; document.querySelectorAll('.bk-patdemo').forEach((d) => d.style.setProperty('--c', c)); });
document.addEventListener('change', (e) => { if (e.target.id === 'bc-mode') { const per = e.target.value === 'perhead'; document.querySelectorAll('.bc-peronly').forEach((x) => (x.hidden = !per)); document.querySelectorAll('.bc-fixedonly').forEach((x) => (x.hidden = per)); }
  if (e.target.name === 'bc-rate') { const l = document.getElementById('bc-hphlbl'); if (l) l.textContent = e.target.value === 'farm' ? 'head per hour when a farm has no rate set yet' : 'head per hour'; } });

function bkCfgOpen(x, cfgType) {
  if (!Bk.need('settings')) return;
  const isNew = !x; x = x ? JSON.parse(JSON.stringify(x)) : { id: uid(cfgType.slice(0, 3)), cfg: cfgType, order: 50, name: '' };
  const t = x.cfg; let body = `<div class="f"><label for="bc-name">Name</label><input id="bc-name" value="${h(x.name)}"></div>`;
  if (t === 'type' || t === 'blocktype') body += bkColourField(x.colour || '#3a6ea5', x.id) + bkPatternField(x.pattern || 'light', x.colour || '#3a6ea5');
  if (t === 'type') body += `<div class="f"><label for="bc-where">Where</label><select id="bc-where">${[['farm', 'On a farm'], ['base', 'At homebase'], ['phone', 'Phone']].map(([v, l]) => `<option value="${v}" ${x.where === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="f"><label for="bc-fixed">Default length for appointment type (minutes)</label><input id="bc-fixed" type="number" min="0" step="5" value="${x.fixedMins || ''}"><div class="hint">Leave empty to work it out from what's being done.</div></div>`;
  if (t === 'service') { const per = x.mode === 'perhead';
    body += `<div class="f"><label for="bc-mode">How long</label><select id="bc-mode"><option value="fixed" ${per ? '' : 'selected'}>Set time</option><option value="perhead" ${per ? 'selected' : ''}>Calculate time based on per head rate</option></select></div>
    <div class="f bc-fixedonly" ${per ? 'hidden' : ''}><label for="bc-mins">Set time (minutes)</label><input id="bc-mins" type="number" min="0" step="5" value="${x.mins || ''}"></div>
    <div class="f bc-peronly" ${per ? '' : 'hidden'}><label>Head per hour</label>
      <label class="bk-radio" style="display:flex;margin:4px 0"><input type="radio" name="bc-rate" value="service" ${x.rateFrom === 'farm' ? '' : 'checked'}> Use this rate for every farm:</label>
      <label class="bk-radio" style="display:flex;margin:4px 0"><input type="radio" name="bc-rate" value="farm" ${x.rateFrom === 'farm' ? 'checked' : ''}> Use the rate set for each farm on the business page (Contacts → business → 📅 Scheduling)</label>
      <div class="bk-hrow"><input id="bc-hph" type="number" min="1" inputmode="numeric" value="${x.hph || ''}" aria-label="Head per hour" style="max-width:110px"><span class="hint" id="bc-hphlbl">${x.rateFrom === 'farm' ? 'head per hour when a farm has no rate set yet' : 'head per hour'}</span></div></div>
    <div class="f"><label for="bc-setup">Set-up and pack-up time (minutes)</label><input id="bc-setup" type="number" min="0" step="5" value="${x.setup || ''}"><div class="hint">Added on top, whether the time is set or worked out from the head count.</div></div>
    <label class="bk-radio" style="margin:4px 0"><input type="checkbox" id="bc-asklab" ${x.askLabour ? 'checked' : ''}> Ask whether additional labour is needed when this is booked</label>
    <label class="bk-radio" style="margin:4px 0"><input type="checkbox" id="bc-along" ${x.alongside ? 'checked' : ''}> Runs alongside the other work (like additional labour) — a separate person, doesn't make the booking longer</label>
    <div class="f" style="margin-top:6px"><label for="bc-yard">Counts as (for each farm's "What can be booked here")</label><select id="bc-yard"><option value="">Neither — farms don't limit it</option><option value="preg" ${x.yard === 'preg' ? 'selected' : ''}>Preg testing</option><option value="bull" ${x.yard === 'bull' ? 'selected' : ''}>Bull testing</option></select><div class="hint">On the business page each farm can be set to preg testing only, bull testing only, or individual animal assessments only. Choose which of those this service is, so you're warned if it's booked at a farm that doesn't allow it.</div></div>`; }
  if (t === 'sms') body += `<div class="f"><label for="bc-use">When it's used</label><select id="bc-use">${[['booked', 'When a booking is made'], ['reminder', 'Reminder 5 days before'], ['proposal', 'When a new time is suggested'], ['other', 'Sent by hand']].map(([v, l]) => `<option value="${v}" ${x.use === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="f"><label for="bc-text">Message</label><textarea id="bc-text" rows="5">${h(x.text || '')}</textarea><div class="hint">Fill-ins: {first} {name} {business} {type} {day} {date} {time} {farm} {at_farm} {vet} {old_date}</div></div>`;
  if (t === 'futype') body += `<div class="f"><label for="bc-days">Due how many days after</label><input id="bc-days" type="number" min="0" value="${x.days || ''}"></div>`;
  if (!isNew) body += `<div class="actions"><button type="button" class="btn" data-act="bks-del" data-id="${x.id}" style="color:var(--red)">Remove</button></div>`;
  openSheet((isNew ? 'New ' : 'Edit ') + ({ type: 'appointment type', service: 'service', blocktype: 'block type', sms: 'SMS template', futype: 'follow-up type' })[t], body, async () => {
    const g = (id) => (document.getElementById(id) || {}).value; x.name = (g('bc-name') || '').trim(); if (!x.name) { toast('Enter a name'); return false; }
    if (t === 'type' || t === 'blocktype') { const c = bkHex(g('bc-colourtxt')) || g('bc-colour'); if (!c) { toast('Enter a colour like #2f7a55'); return false; } x.colour = c; x.pattern = (document.querySelector('input[name=bc-pat]:checked') || {}).value || 'light'; }
    if (t === 'type') { x.where = g('bc-where'); x.fixedMins = +g('bc-fixed') || null; }
    if (t === 'service') { x.mode = g('bc-mode'); x.rateFrom = x.mode === 'perhead' ? ((document.querySelector('input[name=bc-rate]:checked') || {}).value || 'service') : null; x.mins = +g('bc-mins') || null; x.hph = +g('bc-hph') || null; x.setup = +g('bc-setup') || 0;
      if (x.mode === 'perhead' && x.rateFrom !== 'farm' && !x.hph) { toast('Enter the head per hour'); return false; } if (x.mode === 'fixed' && !x.mins) { toast('Enter the set time'); return false; }
      x.askLabour = document.getElementById('bc-asklab').checked; x.alongside = document.getElementById('bc-along').checked; x.yard = g('bc-yard') || null; }
    if (t === 'sms') { x.use = g('bc-use'); x.text = (g('bc-text') || '').trim(); if (!x.text) { toast('Write the message'); return false; } }
    if (t === 'futype') x.days = +g('bc-days') || 0;
    const ex = Bk.get(x.id); if (ex) { Object.keys(ex).forEach((k) => delete ex[k]); Object.assign(ex, x); touch(ex); } else { touch(x); D.bkcfg.push(x); }
    save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
function bkStaffOpen(s) {
  const c = Bk.scfg(s), adm = SBAuth.isAdmin(), ed = Bk.can('settings');
  openSheet('Hours — ' + (s.preferred_name || s.full_name), `<div class="f"><label for="bs-mode">Works</label><select id="bs-mode" ${ed ? '' : 'disabled'}><option value="regular" ${c.mode === 'regular' ? 'selected' : ''}>Set days and hours</option><option value="locum" ${c.mode === 'locum' ? 'selected' : ''}>Locum — only on days marked available</option></select></div>
  <div class="f"><label>Set days and hours</label>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<div class="bk-hrow"><label class="bk-radio"><input type="checkbox" data-bsday="${d}" ${c.hours[d] ? 'checked' : ''} ${ed ? '' : 'disabled'}> ${DOW_NAMES[d]}</label><input type="time" step="900" data-bsfrom="${d}" value="${(c.hours[d] || ['08:00'])[0]}" ${ed ? '' : 'disabled'} aria-label="${DOW_NAMES[d]} start"><span>to</span><input type="time" step="900" data-bsto="${d}" value="${(c.hours[d] || [, s.role === 'vet_tech' ? '17:00' : '18:00'])[1]}" ${ed ? '' : 'disabled'} aria-label="${DOW_NAMES[d]} finish"></div>`).join('')}</div>
  <div class="grid2"><div class="f"><label for="bs-lfrom">Work hours on available days</label><div class="bk-hrow"><input id="bs-lfrom" type="time" step="900" value="${c.locumHours[0]}" ${ed ? '' : 'disabled'}><span>to</span><input id="bs-lto" type="time" step="900" value="${c.locumHours[1]}" ${ed ? '' : 'disabled'}></div></div>
    <div class="f"><label for="bs-buf">End-of-day time for records and restocking (minutes)</label><input id="bs-buf" type="number" min="0" step="15" value="${c.endBuffer || 0}" ${ed ? '' : 'disabled'}></div></div>
  <div class="f"><label>Can be booked for${adm ? '' : ' (admin only)'}</label><label class="bk-radio"><input type="checkbox" id="bs-all" ${c.canDo ? '' : 'checked'} ${adm ? '' : 'disabled'}> Everything</label><div class="checks">${Bk.cfg('service').map((x) => `<label><input type="checkbox" data-bscan="${x.id}" ${!c.canDo || c.canDo.includes(x.id) ? 'checked' : ''} ${adm ? '' : 'disabled'}> ${h(x.name)}</label>`).join('')}</div></div>`, async () => {
    const id = 'staff:' + s.id; let r = Bk.get(id); if (!r) { r = { id, cfg: 'staff', name: s.full_name }; D.bkcfg.push(r); }
    if (ed) { const hrs = {}; document.querySelectorAll('[data-bsday]').forEach((el) => { const d = el.dataset.bsday; if (el.checked) hrs[d] = [document.querySelector(`[data-bsfrom="${d}"]`).value, document.querySelector(`[data-bsto="${d}"]`).value]; });
      r.hours = hrs; r.mode = document.getElementById('bs-mode').value; r.locumHours = [document.getElementById('bs-lfrom').value, document.getElementById('bs-lto').value]; r.endBuffer = +document.getElementById('bs-buf').value || 0; r.availDates = r.availDates || c.availDates || {}; }
    if (adm) r.canDo = document.getElementById('bs-all').checked ? null : [...document.querySelectorAll('[data-bscan]:checked')].map((el) => el.dataset.bscan);
    touch(r); save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}

/* ---------------- the business page: how this client's farms are booked ---------------- */
function bkRateSvcs() { return Bk.cfg('service').filter((x) => x.mode === 'perhead' && x.rateFrom === 'farm'); } // services whose speed is set per farm
function bkRateOk(use, sv) { if (use === 'none' || (use === 'individual' && sv.yard)) return false; return !(sv.yard && (use === 'preg' || use === 'bull') && sv.yard !== use); }
function bkBizCard(b) {
  if (!Bk.on() || (typeof isClientBiz === 'function' && !isClientBiz(b))) return '';
  const bs = Bk.bsched(b.id), ed = Bk.can('book'), fs = bkFarmsOf(b.id), rs = bkRateSvcs();
  const sp = (fid, sv) => { const y = bkYard(fid, sv.id); return y && y.hph ? `<b>${y.hph}/hour</b>` : `${sv.hph ? sv.hph + '/hour (usual)' : '<b style="color:var(--red)">not set</b>'}`; };
  return `<div class="card bk-bizcard"><h3><span class="sp">📅 Scheduling</span>${ed ? `<button class="btn small" data-act="bks-bsched" data-id="${b.id}" aria-label="Edit scheduling">✏️</button>` : ''}</h3>
    <div class="kv"><div class="k">Additional labour</div><div class="v">${bs.labour ? '<b>Needed at every appointment</b> — you\'re reminded when booking' : 'Only when asked for'}${bs.note ? `<br><span class="hint">${h(bs.note)}</span>` : ''}</div></div>
    ${fs.map((f) => { const x = Bk.fsched(f.id), stop = (f.safety || {}).status === 'stop', use = x.use || ''; const rr = rs.filter((sv) => bkRateOk(use, sv));
      return `<div class="kv" style="align-items:center"><div class="k">${h(f.name || f.address || 'Farm')}</div><div class="v">${use === 'none' ? '<b style="color:var(--red)">⛔ Do not service</b>' : h(BK_USE[use])}${stop ? '<br><b style="color:var(--red)">⛔ Safety: no routine work until fixed</b>' : ''}${rr.length ? `<br><span class="hint">${rr.map((sv) => h(sv.name) + ' ' + sp(f.id, sv)).join(' · ')}</span>` : ''}${x.note ? `<br><span class="hint">${h(x.note)}</span>` : ''}</div>${ed ? `<button class="btn small" data-act="bks-fsched" data-id="${f.id}" data-bid="${b.id}" aria-label="Edit ${h(f.name || 'farm')} scheduling">✏️</button>` : ''}</div>`; }).join('') || '<div class="hint">No farms saved for this business yet.</div>'}
    <div class="hint" style="margin-top:4px">Used when booking: the head-per-hour rates set how long those services take at each farm, and "what can be booked here" warns you if a booking doesn't fit.</div></div>`;
}
function bkBschedOpen(bid) {
  const b = IDX.biz.get(bid); if (!b || !Bk.need('book')) return; const x = Bk.bsched(bid);
  openSheet('Scheduling — ' + b.name, `<label class="bk-radio" style="margin:4px 0 10px"><input type="checkbox" id="bz-lab" ${x.labour ? 'checked' : ''}> Always needs additional labour (you're reminded every time they're booked)</label>
    <div class="f"><label for="bz-note">Booking note</label><input id="bz-note" value="${h(x.note || '')}"><div class="hint">Shown on the business page, e.g. who usually helps in the yards.</div></div>`, async () => {
    const id = 'bsched:' + bid; let r = Bk.get(id); if (!r) { r = { id, cfg: 'bsched', bid, name: b.name }; D.bkcfg.push(r); }
    r.labour = document.getElementById('bz-lab').checked; r.note = document.getElementById('bz-note').value.trim(); delete r.gone; touch(r); save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
function bkFschedOpen(fid) {
  const f = IDX.farms.get(fid); if (!f || !Bk.need('book')) return; const x = Bk.fsched(fid); const rs = bkRateSvcs();
  const yv = (sv) => { const y = bkYard(fid, sv.id); return y && y.hph ? y.hph : ''; };
  openSheet('Scheduling — ' + (f.name || f.address || 'Farm'), `<div class="f"><label for="fz-use">What can be booked here</label><select id="fz-use">${Object.entries(BK_USE).map(([k, l]) => `<option value="${k}" ${(x.use || '') === k ? 'selected' : ''}>${h(l)}</option>`).join('')}</select><div class="hint">"Do not service" pops up a warning if anyone tries to book these yards.</div></div>
    ${rs.length ? `<div class="grid2">${rs.map((sv) => `<div class="f"><label for="fz-r-${sv.id}">${h(sv.name)} — head per hour here</label><input id="fz-r-${sv.id}" data-fzrate="${sv.id}" type="number" min="1" inputmode="numeric" value="${yv(sv)}"><div class="hint">${sv.hph ? `Leave empty to use the usual ${sv.hph}/hour.` : 'No usual rate is set, so enter one for this farm.'}</div></div>`).join('')}</div>` : '<div class="hint">No services use a per-farm rate. Choose "Use the rate set for each farm" on a service in Settings → Scheduling.</div>'}
    <div class="f"><label for="fz-note">Note</label><input id="fz-note" value="${h(x.note || '')}"><div class="hint">For example why it's not serviced, or which yards to use.</div></div>`, async () => {
    const id = 'fsched:' + fid; let r = Bk.get(id); if (!r) { r = { id, cfg: 'fsched', fid, name: f.name || '' }; D.bkcfg.push(r); }
    r.use = document.getElementById('fz-use').value; r.note = document.getElementById('fz-note').value.trim(); delete r.gone; touch(r);
    document.querySelectorAll('[data-fzrate]').forEach((el) => { const sv = el.dataset.fzrate; const v = +el.value || null; const yid = 'yard:' + fid + ':' + sv; let y = Bk.get(yid);
      if (v) { if (!y) { y = { id: yid, cfg: 'yard', fid, svc: sv }; D.bkcfg.push(y); } if (y.hph !== v || y.gone) { y.hph = v; delete y.gone; touch(y); } } else if (y && !y.gone) { y.gone = true; touch(y); } });
    save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
window.bkBizCard = bkBizCard;

/* ---------------- follow-ups ---------------- */
function bkFuOpen(fu, preset) {
  const isNew = !fu; const f = fu ? JSON.parse(JSON.stringify(fu)) : { id: uid('fu'), type: (Bk.cfg('futype')[0] || {}).id, due: '', staff: SBAuth.staff && SBAuth.staff.role !== 'admin' ? SBAuth.staff.id : '', animal: '', notes: '', status: 'open', ...(preset || {}) };
  if (!f.due) { const t = Bk.get(f.type); f.due = bkAdd(bkToday(), (t && t.days) || 14); }
  openSheet(isNew ? 'New follow-up' : 'Follow-up', `<div class="f"><label>Client</label><b>${h(Bk.who(f))}</b>${f.bookingId ? ' <span class="hint">(from a booking)</span>' : ''}</div>
  <div class="grid2"><div class="f"><label for="fu-type">Type</label><select id="fu-type">${Bk.cfg('futype').map((t) => `<option value="${t.id}" ${t.id === f.type ? 'selected' : ''}>${h(t.name)}</option>`).join('')}</select></div><div class="f"><label for="fu-due">Due</label><input id="fu-due" type="date" value="${f.due}"></div></div>
  <div class="grid2"><div class="f"><label for="fu-animal">Animal(s) or mob</label><input id="fu-animal" value="${h(f.animal || '')}"></div><div class="f"><label for="fu-staff">Who follows up</label><select id="fu-staff"><option value="">Anyone</option>${Bk.people().map((s) => `<option value="${s.id}" ${s.id === f.staff ? 'selected' : ''}>${h(s.preferred_name || s.full_name)}</option>`).join('')}</select></div></div>
  <div class="f"><label for="fu-notes">Notes</label><textarea id="fu-notes" rows="3">${h(f.notes || '')}</textarea></div>
  ${!isNew ? `<div class="actions">${f.status === 'open' ? `<button type="button" class="btn primary" data-act="fu-done" data-id="${f.id}">✓ Done</button>` : `<button type="button" class="btn" data-act="fu-reopen" data-id="${f.id}">Reopen</button>`}${Bk.can('book') ? `<button type="button" class="btn" data-act="fu-book" data-id="${f.id}">📅 Book it</button>` : ''}</div>` : ''}`, async () => {
    const g = (id) => document.getElementById(id).value; f.type = g('fu-type'); f.due = g('fu-due'); f.animal = g('fu-animal').trim(); f.staff = g('fu-staff') || null; f.notes = g('fu-notes').trim();
    if (!f.due) { toast('Choose when it\'s due'); return false; }
    const ex = Bk.list('followups').find((x) => x.id === f.id); if (ex) { Object.keys(ex).forEach((k) => delete ex[k]); Object.assign(ex, f); touch(ex); } else { f.createdAt = Date.now(); f.by = SBAuth.staff && SBAuth.staff.id; touch(f); D.followups.push(f); }
    save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
function bkFollowupsHtml() {
  const all = Bk.list('followups').filter((f) => !f.gone); const open = all.filter((f) => f.status === 'open').sort((a, b) => a.due.localeCompare(b.due)); const t = bkToday();
  const row = (f) => `<div class="kv bk-fu ${f.status === 'open' && f.due < t ? 'over' : ''}" style="align-items:center"><div class="v"><b>${h(Bk.get(f.type) ? Bk.get(f.type).name : 'Follow-up')}</b> — ${h(Bk.who(f))}${f.animal ? ' · ' + h(f.animal) : ''}<br><span class="hint">Due ${bkDate(f.due)}${f.due < t && f.status === 'open' ? ' (overdue)' : ''}${f.staff ? ' · ' + h(Bk.pname(f.staff)) : ''}${f.notes ? ' · ' + h(f.notes.slice(0, 80)) : ''}</span></div>${f.status === 'open' ? `<button class="btn small" data-act="fu-done" data-id="${f.id}">✓ Done</button>` : ''}<button class="btn small" data-act="fu-open" data-id="${f.id}">Open</button></div>`;
  return `<div class="d-wrap bk-wrap"><div class="bk-top"><div class="bk-nav"><b class="bk-title">Follow-ups</b></div></div>
  ${bkAiCard('followups')}<div class="hint" style="margin-bottom:8px">Add a follow-up from any booking (open the booking → ➕ Follow-up). Clinical records and lab requests will add them too, once that part is built.</div>
  <div class="card">${open.map(row).join('') || '<div class="hint">No follow-ups waiting.</div>'}</div>
  ${all.some((f) => f.status !== 'open') ? `<details><summary class="hint" style="cursor:pointer">Done (${all.filter((f) => f.status !== 'open').length})</summary><div class="card">${all.filter((f) => f.status !== 'open').sort((a, b) => b.due.localeCompare(a.due)).slice(0, 50).map(row).join('')}</div></details>` : ''}</div>`;
}

/* ---------------- Bookings jobs list ---------------- */
function bkJobs() {
  if (!D || !Bk.list) return []; const t = bkToday(), soon = bkAdd(t, 7), fort = bkAdd(t, 14); const out = [];
  const live = Bk.list('bookings').filter((b) => Bk.live(b) && b.date >= t);
  live.forEach((b) => {
    if (b.sms && b.sms.send && !b.sms.booked && !b.sms.skip && !Bk.smsOk(Bk.smsKey('booked:' + b.id))) out.push({ k: 'sms', b, t: 'Booking SMS not sent', d: `${bkDate(b.date)} ${bkTime(b.start)} — ${Bk.who(b)}${b.cid ? '' : ' (no one chosen to text)'}` });
    if (b.proposal && !b.proposal.smsSent && !b.proposal.smsSkip && !Bk.smsOk(Bk.smsKey(`proposal:${b.id}:${b.proposal.at}`))) out.push({ k: 'psms', b, t: 'New-time SMS not sent', d: `${Bk.who(b)}: suggested ${bkDate(b.proposal.date)} ${bkTime(b.proposal.start)}` });
    if (b.proposal) out.push({ k: 'prop', b, t: 'Waiting for the client to agree a new time', d: `${Bk.who(b)}: ${bkDate(b.date)} → ${bkDate(b.proposal.date)} ${bkTime(b.proposal.start)} (held since ${new Date(b.proposal.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })})` });
    if (b.status !== 'confirmed' && b.date <= soon) out.push({ k: 'unconf', b, t: 'Unconfirmed — within a week', d: `${bkDate(b.date)} ${bkTime(b.start)} — ${Bk.who(b)}` });
    if (b.date <= fort) { const pr = bkProblems(b); if (pr.length) out.push({ k: 'clash', b, t: 'Check this booking', d: `${bkDate(b.date)} ${bkTime(b.start)} — ${Bk.who(b)}: ${pr[0]}${pr.length > 1 ? ` (+${pr.length - 1} more)` : ''}` }); }
  });
  for (let i = 0; i < 14; i++) { const d = bkAdd(t, i); const o = Bk.oncall(d) || {}; if (Bk.weekend(d) ? !o.all : !o.night || !o.evening) out.push({ k: 'oncall', d0: d, t: 'On call not set', d: bkDate(d) }); }
  ((D && D.smsLog) || []).forEach((x) => {
    if (x.kind === 'reply' && !x.handled) out.push({ k: 'reply', x, t: 'SMS reply', d: `${bkSmsWho(x)}: “${(x.body || '').slice(0, 160)}” · ${new Date(x.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` });
    if (x.status === 'failed' && x.kind !== 'reply' && Date.now() - Date.parse(x.at) < 14 * 864e5) out.push({ k: 'smsfail', x, b: x.booking_id ? bkRec(x.booking_id) : null, t: 'SMS failed', d: `${({ booked: 'Booking made', reminder: 'Reminder', proposal: 'New time', manual: 'Text' })[x.kind] || 'Text'} to ${bkSmsWho(x)}: ${x.error || 'not delivered'}` });
  });
  Bk.list('followups').filter((f) => !f.gone && f.status === 'open' && f.due <= t).forEach((f) => out.push({ k: 'fu', f, t: f.due < t ? 'Follow-up overdue' : 'Follow-up due today', d: `${Bk.get(f.type) ? Bk.get(f.type).name : 'Follow-up'} — ${Bk.who(f)}${f.animal ? ' · ' + f.animal : ''} (due ${bkDate(f.due)})` }));
  return out;
}
const BK_JOB_NAMES = { reply: 'SMS replies', smsfail: 'SMS failed', sms: 'Booking SMS not sent', psms: 'New-time SMS not sent', prop: 'Waiting for client', unconf: 'Unconfirmed this week', clash: 'Clashes and travel', oncall: 'On call not set', fu: 'Follow-ups due' };
function bkJobsHtml() {
  const all = bkJobs(); const q = (BK.jobFilter || '').toLowerCase(); const list = all.filter((j) => !q || (j.t + ' ' + j.d).toLowerCase().includes(q));
  const vets = Bk.people().filter((s) => s.role === 'vet');
  const btns = (j) => { const b = j.b; switch (j.k) {
    case 'sms': return `<button class="btn small" data-act="bkj-smsdone" data-id="${b.id}">Mark as sent</button><button class="btn small" data-act="bkj-smsskip" data-id="${b.id}">Don't send</button>`;
    case 'psms': return `<button class="btn small" data-act="bkj-psmsdone" data-id="${b.id}">Mark as sent</button><button class="btn small" data-act="bkj-psmsskip" data-id="${b.id}">Don't send</button>`;
    case 'prop': return `<button class="btn small primary" data-act="bkj-propyes" data-id="${b.id}">Client agreed — move</button><button class="btn small" data-act="bkj-propno" data-id="${b.id}">Client said no</button>`;
    case 'unconf': return `<button class="btn small primary" data-act="bkj-confirm" data-id="${b.id}">✓ Confirmed</button>`;
    case 'clash': return `<button class="btn small" data-act="bkj-suggest" data-id="${b.id}">🔎 Find a better time</button>`;
    case 'oncall': { const o = Bk.oncall(j.d0) || {}; const sel = (slot) => `<select data-act="bk-oc" data-d="${j.d0}" data-slot="${slot}" ${Bk.can('roster') ? '' : 'disabled'}><option value="">${slot === 'all' ? 'All day' : slot === 'night' ? '12–8am' : '6pm–12am'}…</option>${vets.map((s) => `<option value="${s.id}" ${o[slot] === s.id ? 'selected' : ''}>${h(s.preferred_name || s.full_name)}</option>`).join('')}</select>`; return Bk.weekend(j.d0) ? sel('all') : sel('night') + sel('evening'); }
    case 'fu': return `<button class="btn small primary" data-act="fu-done" data-id="${j.f.id}">✓ Done</button><button class="btn small" data-act="fu-book" data-id="${j.f.id}">📅 Book it</button>`;
    case 'smsfail': return `<button class="btn small primary" data-act="bkj-smsretry" data-id="${j.x.id}">Try again</button>`;
    case 'reply': { const x = j.x; const mine = Bk.list('bookings').filter((b) => Bk.live(b) && b.date >= bkToday() && ((x.contact_id && b.cid === x.contact_id) || (x.business_id && b.bid === x.business_id))).sort((a, c) => a.date.localeCompare(c.date));
      const un = mine.find((b) => b.status !== 'confirmed'), pr = mine.find((b) => b.proposal);
      return `${pr ? `<button class="btn small primary" data-act="bkj-replyprop" data-id="${pr.id}" data-sms="${x.id}">✓ Agree new time (${bkDate(pr.proposal.date)})</button>` : ''}${un && !pr ? `<button class="btn small primary" data-act="bkj-replyconf" data-id="${un.id}" data-sms="${x.id}">✓ Confirm ${bkDate(un.date)} booking</button>` : ''}<button class="btn small" data-act="bk-text" data-cid="${x.contact_id || ''}" data-bid="${x.business_id || ''}" data-phone="${h(x.phone || '')}">Reply…</button><button class="btn small" data-act="bkj-replydone" data-sms="${x.id}">Done</button>`; }
  } return ''; };
  const groups = Object.keys(BK_JOB_NAMES).map((k) => [k, list.filter((j) => j.k === k)]).filter(([, l]) => l.length);
  return `<div class="d-wrap bk-wrap"><div class="bk-top"><div class="bk-nav"><b class="bk-title">Scheduling jobs</b><button class="btn small" data-act="bk-page" data-v="followups">Follow-ups</button></div></div>
  <div class="search" style="margin-bottom:8px"><input id="bkj-q" placeholder="Search jobs" value="${h(BK.jobFilter || '')}" data-act="bkj-q"></div>${bkAiCard('jobs')}
  ${groups.length ? groups.map(([k, l]) => `<details class="card bk-jobs" open><summary><b>${BK_JOB_NAMES[k]}</b> <span class="badge">${l.length}</span></summary>${l.map((j) => `<div class="bk-job"><div class="v"><div>${h(j.d)}</div></div><div class="actions">${btns(j)}${j.b ? `<button class="btn small" data-act="bk-open" data-id="${j.b.id}">Open</button>` : ''}${j.f ? `<button class="btn small" data-act="fu-open" data-id="${j.f.id}">Open</button>` : ''}</div></div>`).join('')}</details>`).join('') : '<div class="card"><div class="hint">Nothing to do — all bookings are sorted.</div></div>'}
  <div class="hint">Texts go from the office phone automatically once it's set up (see the manual). If a text was sent another way, use "Mark as sent".</div></div>`;
}

/* ---------------- who comes first on the calendar (this device only): arrows, or drag a name ---------------- */
function bkColMove(id, target, after) { const ids = Bk.people().map((x) => x.id).filter((x) => x !== id); let i = ids.indexOf(target); if (i < 0) return; if (after) i++; ids.splice(i, 0, id); Bk.setOrder(ids); renderAll(); }
document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('[data-colstaff]'); if (!c) return; BK._drag = c.dataset.colstaff; try { e.dataTransfer.setData('text/plain', c.dataset.colstaff); e.dataTransfer.effectAllowed = 'move'; } catch (x) { } });
document.addEventListener('dragover', (e) => { const c = BK._drag && e.target.closest && e.target.closest('[data-colstaff]'); if (c) { e.preventDefault(); document.querySelectorAll('.bk-colh.dropto').forEach((x) => x.classList.remove('dropto')); c.classList.add('dropto'); } });
document.addEventListener('drop', (e) => { const c = BK._drag && e.target.closest && e.target.closest('[data-colstaff]'); const id = BK._drag; BK._drag = null; document.querySelectorAll('.bk-colh.dropto').forEach((x) => x.classList.remove('dropto')); if (!c || c.dataset.colstaff === id) return; e.preventDefault(); const r = c.getBoundingClientRect(); bkColMove(id, c.dataset.colstaff, e.clientX > r.left + r.width / 2); });
document.addEventListener('dragend', () => { BK._drag = null; document.querySelectorAll('.bk-colh.dropto').forEach((x) => x.classList.remove('dropto')); });

/* ---------------- Ask Claude (Scheduling Jobs, On call, Follow-ups): copies the question with what's on this page ---------------- */
const BK_AI_NAME = { jobs: 'Scheduling jobs', roster: 'On-call roster', followups: 'Follow-ups' };
function bkAiCard(pg) {
  return `<details class="card bk-ai" ${BK['aiOpen_' + pg] ? 'open' : ''} data-pg="${pg}"><summary><b>🤖 Ask Claude</b> <span class="hint">about the ${h(BK_AI_NAME[pg].toLowerCase())}</span></summary>
    <div class="hint" style="margin:6px 0">Free — uses your own Claude account. Type your question (for example how to cover a day, or which jobs to do first), tap the button, and paste into Claude. Claude answers and explains what to change; you make the changes here.</div>
    <div class="f"><label for="bkai-${pg}">What do you want to ask?</label><textarea id="bkai-${pg}" rows="3">${h(BK['aiReq_' + pg] || '')}</textarea></div>
    <div class="actions"><button class="btn primary" data-act="bk-ai" data-v="${pg}">Copy for Claude &amp; open Claude</button></div><div class="hint" id="bkai-info-${pg}"></div></details>`;
}
function bkAiText(pg, req) {
  const t = bkToday(), ppl = Bk.people(); const L = [];
  L.push(`I work at Bovitech Veterinary Services (mobile large-animal vets, cattle and sheep, Albany WA). This is from the Scheduling part of our practice app (${BK_AI_NAME[pg]} page), today ${bkDate(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`, '', 'MY QUESTION:', req, '', 'STAFF:');
  ppl.forEach((p) => { const c = Bk.scfg(p); L.push(`- ${p.preferred_name || p.full_name} (${p.role === 'vet_tech' ? 'vet tech' : p.role})${c.mode === 'locum' ? ' — locum, only on days marked available' : ': ' + [1, 2, 3, 4, 5, 6, 0].filter((d) => c.hours[d]).map((d) => `${DOW_NAMES[d]} ${c.hours[d][0]}–${c.hours[d][1]}`).join(', ')}`); });
  if (pg === 'jobs') { L.push('', 'JOBS LIST:'); bkJobs().forEach((j) => L.push(`- ${BK_JOB_NAMES[j.k]}: ${j.d}`)); }
  if (pg === 'roster') { L.push('', 'ON-CALL ROSTER (weekdays: overnight 12–8am and evening 6pm–12am; weekends one vet all day):'); for (let i = 0; i < 28; i++) { const d = bkAdd(bkWeekStart(BK.date), i), o = Bk.oncall(d) || {}; L.push(`- ${bkDate(d)}: ${Bk.weekend(d) ? 'all day ' + (o.all ? Bk.pname(o.all) : 'NOT SET') : `12–8am ${o.night ? Bk.pname(o.night) : 'NOT SET'}, 6pm–12am ${o.evening ? Bk.pname(o.evening) : 'NOT SET'}`}`); } }
  if (pg === 'followups') { L.push('', 'OPEN FOLLOW-UPS:'); Bk.list('followups').filter((f) => !f.gone && f.status === 'open').sort((a, b) => a.due.localeCompare(b.due)).forEach((f) => L.push(`- due ${bkDate(f.due)}${f.due < t ? ' (OVERDUE)' : ''}: ${(Bk.get(f.type) || {}).name || 'Follow-up'} — ${Bk.who(f)}${f.animal ? ' · ' + f.animal : ''}${f.staff ? ' · ' + Bk.pname(f.staff) : ''}${f.notes ? ' · ' + f.notes : ''}`)); }
  L.push('', 'BOOKINGS IN THE NEXT 3 WEEKS:');
  Bk.list('bookings').filter((b) => Bk.live(b) && b.date >= t && b.date <= bkAdd(t, 21)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).forEach((b) => L.push(`- ${bkDate(b.date)} ${bkTime(b.start)}–${bkTime(bkHHMM(bkMin(b.start) + b.mins))}: ${Bk.who(b)}${Bk.farmName(b) ? ' at ' + Bk.farmName(b) : ''} — ${(b.svcs || []).map((x) => Bk.svc(x.svc).name + (x.head ? ' ×' + x.head : '') + ' (' + Bk.sstaff(b, x).map(Bk.pname).join(' + ') + ')').join(', ') || Bk.type(b.type).name}${b.status === 'confirmed' ? '' : ' [unconfirmed]'}`));
  L.push('', 'Please answer in plain English. If something should be changed, list the changes step by step so I can make them in the app.');
  return L.join('\n');
}

/* ---------------- taps and changes ---------------- */
function bkRec(id) { return Bk.list('bookings').find((b) => b.id === id); }
function bkDone(msg) { save(); Sync.soon(); renderAll(); if (msg) toast(msg); }
function bkMove(b) { const p = b.proposal; if (!p) return; b.date = p.date; b.start = p.start; b.mins = p.mins || b.mins;
  if (p.staff && p.staff.length) { const keep = new Set(p.staff), added = p.staff.filter((x) => !(b.staff || []).includes(x)); // people swapped on the new time: take them off their services, put newcomers on the main work
    b.svcs = (b.svcs || []).map((x) => { const al = x.svc && Bk.svc(x.svc).alongside; let st = Bk.sstaff(b, x).filter((id) => keep.has(id)); if (!al) st = [...new Set([...st, ...added])]; return { ...x, staff: st.length ? st : [...p.staff] }; });
    b.staff = [...p.staff]; }
  b.status = 'confirmed'; b.moved = (b.moved || 0) + 1; delete b.proposal; touch(b); }
document.addEventListener('click', async (e) => {
  const col = e.target.closest && e.target.closest('.bk-col');
  if (col && !e.target.closest('.bk-appt, .bk-block, .bk-prop, .bk-drive')) { if (!Bk.can('book')) return; const r = col.getBoundingClientRect(); const m = Math.floor((BK_START + (e.clientY - r.top) / BK_PX) / 15) * 15; bkOpen(null, { staff: [col.dataset.staff], date: BK.date, start: bkHHMM(Math.max(BK_START, Math.min(BK_END - 15, m))) }); return; }
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^(bk|bkf|bkj|bks|bb|fu)-/.test(a)) return;
  const d = el.dataset;
  switch (a) {
    case 'bk-go': { const n = +d.v; BK.date = BK.view === 'month' ? (() => { const x = new Date(BK.date + 'T12:00'); x.setDate(1); x.setMonth(x.getMonth() + n); return bkD(x); })() : bkAdd(BK.date, BK.view === 'week' ? 7 * n : n); renderAll(); break; }
    case 'bk-today': BK.date = bkToday(); renderAll(); break;
    case 'bk-colmove': { const cols = bkColumns(BK.date).map((x) => x.id), ci = cols.indexOf(d.staff), nb = cols[ci + +d.v]; if (!nb) return; bkColMove(d.staff, nb, +d.v > 0); break; }
    case 'bk-view': BK.view = d.v; try { localStorage.setItem('bvp-bkview', JSON.stringify({ view: d.v })); } catch (x) { } renderAll(); break;
    case 'bk-page': if (d.v === 'settings') { S.tab = 'settings'; S.setSub = 'sched'; } else BK.page = d.v; renderAll(); window.scrollTo(0, 0); { const l = document.getElementById('list'); if (l) l.scrollTop = 0; } break;
    case 'bk-openday': if (e.target.closest('[data-act=bk-open]') && e.target.closest('[data-act=bk-open]') !== el) return; BK.date = d.v; BK.view = 'day'; BK.page = 'cal'; renderAll(); break;
    case 'bk-new': bkOpen(null, { date: BK.date }); break;
    case 'bk-newblock': bkBlockOpen(null, { date: BK.date }); break;
    case 'bk-open': e.stopPropagation(); { const b = bkRec(d.id); if (b) bkOpen(b); } break;
    case 'bk-openblock': { const b = Bk.list('blocks').find((x) => x.id === d.id); if (b) bkBlockOpen(b, { day: BK.date }); } break;
    case 'bk-avail': { if (!Bk.need('roster')) return; const s = Bk.person(d.staff); const id = 'staff:' + s.id; let r = Bk.get(id); if (!r) { r = { id, cfg: 'staff', name: s.full_name, ...Bk.scfg(s) }; D.bkcfg.push(r); } r.availDates = { ...(r.availDates || {}) }; if (r.availDates[BK.date]) delete r.availDates[BK.date]; else r.availDates[BK.date] = true; touch(r); bkDone(`${Bk.pname(s.id)} is ${r.availDates[BK.date] ? 'available' : 'not available'} on ${bkDate(BK.date)}`); break; }
    case 'bk-rgo': BK.date = bkAdd(BK.date, +d.v); renderAll(); break;
    case 'bk-rcopy': { if (!Bk.need('roster')) return; const a0 = bkWeekStart(BK.date); let n = 0; for (let i = 0; i < 28; i++) { const day = bkAdd(a0, i), prev = Bk.oncall(bkAdd(day, -7)); if (!prev) continue; let o = Bk.oncall(day); if (!o) { o = { id: day, date: day }; D.oncall.push(o); } let ch = false; ['night', 'evening', 'all'].forEach((k) => { if (!o[k] && prev[k]) { o[k] = prev[k]; ch = true; } }); if (ch) { touch(o); n++; } } bkDone(n ? `Filled ${n} day${n === 1 ? '' : 's'} from the week before` : 'Nothing to copy'); break; }
    // booking form
    case 'bkf-client': { BKF.bid = d.bid || null; BKF.cid = d.cid || null; if (BKF.bid && !BKF.cid) { const c = bkContactsOf(BKF.bid).find(bkMobile); BKF.cid = c ? c.id : null; }
      const fs = bkFarmsOf(BKF.bid); BKF.fids = fs.length === 1 ? [fs[0].id] : []; BKF.fid = BKF.fids[0] || null; const ps = bkPidsOf(BKF.bid); BKF.pids = ps.length === 1 ? [{ value: ps[0].value, label: ps[0].label || '' }] : []; BKF.noLabour = false;
      bkAutoMins(); bkFormRefresh(true); if (BKF.fids[0]) bkFarmCheck(BKF.fids[0]); break; }
    case 'bkf-clear': BKF.bid = BKF.cid = BKF.fid = null; BKF.fids = []; BKF.pids = []; bkFormRefresh(true); break;
    case 'bkf-svcadd': bkFormRead(); BKF.svcs.push({ staff: [...((BKF.svcs.find((x) => !x.svc || !Bk.svc(x.svc).alongside) || {}).staff || [])] }); bkFormRefresh(true); break;
    case 'bkf-labour': bkFormRead(); if (bkAddLabour()) toast('Tick who is doing the additional labour'); break;
    case 'bkf-nolabour': bkFormRead(); BKF.noLabour = true; bkFormRefresh(true); break;
    case 'bkf-farmadd': bkFormRead(); { const left = bkFarmsOf(BKF.bid).filter((x) => !BKF.fids.includes(x.id)); if (!left.length) return; bkFormRefresh(true);
      const box = document.querySelector('[data-act=bkf-farmadd]'); if (box) box.insertAdjacentHTML('beforebegin', `<div class="bk-svcrow"><select data-bkfarm="${BKF.fids.length}" aria-label="Farm ${BKF.fids.length + 1}"><option value="">Choose the next farm…</option>${left.map((x) => `<option value="${x.id}">${h(x.name || x.address || 'Farm')}${h(bkFarmTag(x.id))}</option>`).join('')}</select></div>`); } break;
    case 'bkf-farmdel': bkFormRead(); BKF.fids.splice(+d.i, 1); BKF.fid = BKF.fids[0] || null; bkAutoMins(); bkFormRefresh(true); break;
    case 'bkf-svcdel': bkFormRead(); BKF.svcs.splice(+d.i, 1); if (!BKF.svcs.length) BKF.svcs.push({ staff: [] }); bkAutoMins(); bkFormRefresh(true); break;
    case 'bkf-usesug': bkFormRead(); BKF.mins = bkSuggestMins(BKF.type, BKF.svcs, BKF.fids).mins; BKF._minsTouched = false; bkFormRefresh(true); break;
    case 'bkf-suggest': { bkFormRead(); if (Bk.type(BKF.type).where === 'farm' && !BKF.fids.length) { toast('Choose the client and farm first'); return; } const o = { type: BKF.type, fids: BKF.fids, mins: BKF.mins, svcs: BKF.svcs.filter((x) => x.svc && !Bk.svc(x.svc).alongside), urgent: BKF.urgent, skipId: BKF.id }; BK._sugg = bkSuggest(o); document.getElementById('bkf-sugg').innerHTML = bkSuggHtml(BK._sugg, o); break; }
    case 'bk-pick': { const r = BK._sugg && BK._sugg[+d.i]; if (!r) return; bkFormRead(); BKF.date = r.date; BKF.start = r.start;
      const main = BKF.svcs.filter((x) => !x.svc || !Bk.svc(x.svc).alongside); main.forEach((x) => (x.staff = [r.staff])); bkFormStaff(BKF); bkFormRefresh(true); toast(`${bkDate(r.date)} ${bkTime(r.start)} with ${Bk.pname(r.staff)} — tap Save to book`); break; }
    case 'bkf-propose': bkProposeForm(); break;
    case 'bkf-dup': { if (!Bk.need('book')) return; bkFormRead(); const src = JSON.parse(JSON.stringify(BKF)); closeSheet();
      const copy = { type: src.type, bid: src.bid, cid: src.cid, fids: src.fids, fid: src.fid, pids: src.pids, svcs: src.svcs.map((x) => ({ ...x, staff: [...(x.staff || [])] })), mins: src.mins, date: src.date, start: src.start, notes: src.notes, urgent: src.urgent, noLabour: src.noLabour, _minsTouched: true };
      setTimeout(() => { bkOpen(null, copy); toast('Copy made — change the date and time, then Save'); }, 350); break; }
    case 'bkf-propyes': bkFormRead(); bkMove(BKF); if (await bkSaveForm(true)) { closeSheet(); toast('Moved to the new time and confirmed'); } break;
    case 'bkf-propno': bkFormRead(); delete BKF.proposal; if (await bkSaveForm(true)) { closeSheet(); toast('Kept the original time — the held time is free again'); } break;
    case 'bkf-cancel': { bkFormRead(); const ok = await askBox('Cancel this booking?', '<div class="f"><label for="bkc-why">Reason (optional)</label><input id="bkc-why" data-ask="why"></div>', 'Yes — cancel it', true, 'No — keep it'); if (!ok) return; BKF.status = 'cancelled'; BKF.cancelReason = ASK_FORM.why || ''; BKF.cancelledAt = Date.now(); delete BKF.proposal; if (await bkSaveForm(true)) { closeSheet(); toast('Booking cancelled'); } break; }
    case 'bkf-fu': { bkFormRead(); const f = BKF; if (await bkSaveForm(true)) { closeSheet(); setTimeout(() => bkFuOpen(null, { bid: f.bid, cid: f.cid, bookingId: f.id, staff: f.staff[0] }), 350); } break; }
    // jobs
    case 'bkj-smsdone': case 'bkj-smsskip': { const b = bkRec(d.id); b.sms = b.sms || {}; if (a === 'bkj-smsdone') b.sms.booked = Date.now(); else b.sms.skip = true; touch(b); bkDone(a === 'bkj-smsdone' ? 'Marked as sent' : "Won't be sent"); break; }
    case 'bkj-psmsdone': case 'bkj-psmsskip': { const b = bkRec(d.id); if (!b.proposal) return; if (a === 'bkj-psmsdone') b.proposal.smsSent = Date.now(); else b.proposal.smsSkip = true; touch(b); bkDone(); break; }
    case 'bkj-propyes': { const b = bkRec(d.id); if (!Bk.need('book')) return; bkMove(b); bkDone('Moved to the new time and confirmed'); break; }
    case 'bkj-propno': { const b = bkRec(d.id); if (!Bk.need('book')) return; delete b.proposal; touch(b); bkDone('Kept the original time'); break; }
    case 'bkj-confirm': { const b = bkRec(d.id); if (!Bk.need('book')) return; b.status = 'confirmed'; touch(b); bkDone('Confirmed'); break; }
    case 'bkj-suggest': { const b = bkRec(d.id); bkOpen(b, { suggestNow: true }); break; }
    case 'bk-text': BK._textBooking = d.booking ? bkRec(d.booking) : null; if (document.getElementById('sheet') && d.booking) { bkFormRead(); BK._textBooking = BKF; } bkTextOpen(d); break;
    case 'bkj-smsretry': try { await rpc('sms_retry', { k: Dev.k(), sms_id: +d.id }); toast('Trying again'); SupaSync.smsAt = 0; SupaSync.soon(); } catch (x) { toast(x.message); } break;
    case 'bkj-replydone': try { await rpc('sms_handled', { k: Dev.k(), sms_id: +d.sms }); const x = (D.smsLog || []).find((y) => y.id === +d.sms); if (x) x.handled = true; bkDone('Done'); } catch (x) { toast(x.message); } break;
    case 'bkj-replyconf': case 'bkj-replyprop': { if (!Bk.need('book')) return; const b = bkRec(d.id); if (a === 'bkj-replyprop') bkMove(b); else { b.status = 'confirmed'; touch(b); }
      try { await rpc('sms_handled', { k: Dev.k(), sms_id: +d.sms }); const x = (D.smsLog || []).find((y) => y.id === +d.sms); if (x) x.handled = true; } catch (x) { }
      bkDone(a === 'bkj-replyprop' ? 'Moved to the new time and confirmed' : 'Booking confirmed'); break; }
    // settings
    case 'bks-new': bkCfgOpen(null, d.cfg); break;
    case 'bk-ai': { const pg = d.v, box = document.getElementById('bkai-' + pg); const req = (box && box.value || '').trim(); BK['aiReq_' + pg] = req; if (!req) { toast('Type your question first'); return; }
      const txt = bkAiText(pg, req); let okc = false; try { await navigator.clipboard.writeText(txt); okc = true; } catch (x) { } const info = document.getElementById('bkai-info-' + pg);
      if (okc) { info.innerHTML = '✓ Copied. Paste it into Claude.'; window.open((D.settings && D.settings.aiChatUrl) || 'https://claude.ai/new', '_blank'); toast('Copied — now paste it into Claude'); }
      else info.innerHTML = `Couldn't copy automatically — select all of this, copy it, and paste it into Claude:<textarea readonly style="min-height:120px;margin-top:6px">${h(txt)}</textarea>`; break; }
    case 'bks-colour': { const a = document.getElementById('bc-colour'), b = document.getElementById('bc-colourtxt'); if (a) a.value = d.c; if (b) b.value = d.c; document.querySelectorAll('.bk-patdemo').forEach((x) => x.style.setProperty('--c', d.c)); break; }
    case 'bks-edit': bkCfgOpen(Bk.get(d.id)); break;
    case 'bks-del': { const x = Bk.get(d.id); if (!x || !(await ask(`Remove ${x.name}? Bookings already using it keep it.`, 'Yes — remove', true))) return; x.gone = true; touch(x); closeSheet(); bkDone('Removed'); break; }
    case 'bks-yarddel': { const x = Bk.get(d.id); if (!x) return; x.gone = true; touch(x); bkDone('Forgotten'); break; }
    case 'bks-staff': { const s = Bk.person(d.id); if (s) bkStaffOpen(s); break; }
    case 'bks-bsched': bkBschedOpen(d.id); break;
    case 'bks-fsched': bkFschedOpen(d.id); break;
    // blocks
    case 'bb-skip': { const b = Bk.list('blocks').find((x) => x.id === d.id); b.skip = [...(b.skip || []), BK.date]; touch(b); closeSheet(); bkDone(`Skipped on ${bkDate(BK.date)}`); break; }
    case 'bb-del': { const b = Bk.list('blocks').find((x) => x.id === d.id); if (!(await ask('Delete this block?', 'Yes — delete', true))) return; b.gone = true; b.on = false; touch(b); closeSheet(); bkDone('Block deleted'); break; }
    // follow-ups
    case 'fu-open': { const f = Bk.list('followups').find((x) => x.id === d.id); if (f) bkFuOpen(f); break; }
    case 'fu-done': case 'fu-reopen': { const f = Bk.list('followups').find((x) => x.id === d.id); f.status = a === 'fu-done' ? 'done' : 'open'; f.doneAt = a === 'fu-done' ? Date.now() : null; f.doneBy = SBAuth.staff && SBAuth.staff.id; touch(f); if (document.getElementById('sheet')) closeSheet(); bkDone(a === 'fu-done' ? 'Follow-up done' : 'Reopened'); break; }
    case 'fu-book': { const f = Bk.list('followups').find((x) => x.id === d.id); if (document.getElementById('sheet')) closeSheet(); setTimeout(() => bkOpen(null, { bid: f.bid, cid: f.cid, staff: f.staff ? [f.staff] : [], notes: `${Bk.get(f.type) ? Bk.get(f.type).name : 'Follow-up'}${f.animal ? ': ' + f.animal : ''}`, fromFollowup: f.id }), 350); break; }
  }
});
document.addEventListener('change', (e) => {
  const el = e.target; const a = el.dataset && el.dataset.act; if (!a) return;
  if (a === 'bk-toggle') { savePref('showBook', el.checked); if (!el.checked && S.tab === 'book') S.tab = 'contacts'; renderAll(); toast(el.checked ? 'Scheduling tab is on for this device' : 'Scheduling tab hidden'); }
  else if (a === 'bk-date' && el.value) { BK.date = el.value; renderAll(); }
  else if (a === 'bk-showall') { BK.showAll = el.checked; renderAll(); }
  else if (a === 'bk-oc') { if (!Bk.need('roster')) { renderAll(); return; } let o = Bk.oncall(el.dataset.d); if (!o) { o = { id: el.dataset.d, date: el.dataset.d }; D.oncall.push(o); } o[el.dataset.slot] = el.value || null; touch(o); save(); Sync.soon(); toast('On call updated'); renderTabs(); }
  else if (a === 'bks-perm') { if (!SBAuth.isAdmin()) return; let p = Bk.get('perms'); if (!p) { p = { id: 'perms', cfg: 'perms', name: 'Permissions', staff: {} }; D.bkcfg.push(p); } p.staff = p.staff || {}; p.staff[el.dataset.staff] = { ...(p.staff[el.dataset.staff] || {}), [el.dataset.k]: el.checked }; touch(p); save(); Sync.soon(); toast('Permission updated'); }
  else if (a === 'bks-blockon') { if (!Bk.need('blocks')) return; const b = Bk.list('blocks').find((x) => x.id === el.dataset.id); b.on = el.checked; touch(b); bkDone(el.checked ? 'Block on' : 'Block off'); }
});
document.addEventListener('toggle', (e) => { const d = e.target; if (d.classList && d.classList.contains('bk-ai')) BK['aiOpen_' + d.dataset.pg] = d.open; }, true);
document.addEventListener('input', (e) => { if (/^bkai-/.test(e.target.id || '')) BK['aiReq_' + e.target.id.slice(5)] = e.target.value; });
document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.act === 'bkj-q') { BK.jobFilter = e.target.value; const pos = e.target.selectionStart; renderAll(); const q = document.getElementById('bkj-q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } } });

/* Settings → Bookings (testing) on/off for this device */
function bkSettingsCard() { return `<div class="card"><h3>Scheduling (testing)</h3><label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-act="bk-toggle" ${Bk.on() ? 'checked' : ''}> <span>Show the Scheduling tab on this device<br><span class="hint">The new calendar is being tested. Bookings made here don't change anything else in the app, and ezyVet stays the real booking system until you switch over.</span></span></label></div>`; }

/* ---------------- look ---------------- */
(function () { const st = document.createElement('style'); st.id = 'bk-css'; st.textContent = `
.bk-wrap{max-width:none}
.bk-top{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;margin-bottom:8px}
.bk-nav{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.bk-title{font-size:17px;margin-left:4px}
.bk-seg{display:inline-flex;gap:4px;flex-wrap:wrap}
.bk-seg .btn.on{background:var(--ink,#222);color:var(--bg,#fff)}
.bk-opt{display:flex;gap:6px;align-items:center;margin-top:8px;font-size:14px;color:var(--ink3,#666)}
.bk-oncall{padding:6px 10px;border:1px dashed var(--line,#ddd);border-radius:8px;margin-bottom:8px;cursor:pointer;font-size:14px}
.bk-warn{color:var(--red,#b42318);font-weight:600}
.bk-dayscroll{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}
.bk-day{display:grid;gap:0 6px;min-width:min-content}
.bk-colh{position:sticky;top:0;background:var(--bg,#fff);z-index:3;padding:4px 2px 6px;display:flex;flex-direction:column;gap:2px;font-size:14px}
.bk-colh .btn{align-self:flex-start;font-size:12px;padding:2px 8px}
.bk-times{position:relative;font-size:11px;color:var(--ink3,#777)}
.bk-times span{position:absolute;right:4px;transform:translateY(-6px)}
.bk-col{position:relative;border-left:1px solid var(--line,#ddd);background:repeating-linear-gradient(to bottom,transparent 0,transparent ${60 * BK_PX - 1}px,var(--line,#e5e5e5) ${60 * BK_PX - 1}px,var(--line,#e5e5e5) ${60 * BK_PX}px);cursor:copy;border-radius:4px}
.bk-off{position:absolute;left:0;right:0;background:repeating-linear-gradient(135deg,rgba(120,120,120,.10) 0 6px,rgba(120,120,120,.18) 6px 12px);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink3,#777);pointer-events:none}
.bk-buffer{position:absolute;left:0;right:0;background:rgba(181,121,28,.10);border-top:1px dashed rgba(181,121,28,.6);font-size:11px;color:var(--ink3,#777);padding:1px 4px;pointer-events:none;overflow:hidden}
.bk-block{position:absolute;left:2px;right:2px;border-radius:6px;background:color-mix(in srgb,var(--c) 22%,var(--bg,#fff));border:1px solid color-mix(in srgb,var(--c) 55%,transparent);font-size:12px;padding:2px 6px;overflow:hidden;cursor:pointer;z-index:1}
.bk-appt{position:absolute;left:3px;right:3px;border-radius:7px;background:color-mix(in srgb,var(--c) 16%,var(--bg,#fff));border:1.5px solid var(--c);border-left-width:5px;padding:3px 6px;font-size:12.5px;overflow:hidden;cursor:pointer;z-index:2;line-height:1.25}
.bk-appt.unconf{border-style:dashed}.bk-appt.unconf.pat-light{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--c) 10%,var(--bg,#fff)) 0 8px,color-mix(in srgb,var(--c) 18%,var(--bg,#fff)) 8px 16px)}
.bk-appt.urgent{box-shadow:0 0 0 2px var(--red,#b42318) inset}
.bk-at{font-weight:600;font-size:11.5px}.bk-at i{font-weight:500}
.bk-aw{font-weight:600}.bk-as{color:var(--ink3,#666);font-size:11.5px}
.bk-prop{position:absolute;left:3px;right:3px;border-radius:7px;border:2px dotted var(--ink3,#888);background:repeating-linear-gradient(45deg,rgba(130,130,130,.10) 0 6px,transparent 6px 12px);font-size:11.5px;padding:3px 6px;overflow:hidden;cursor:pointer;z-index:2}
.bk-drive{position:absolute;left:10px;right:10px;font-size:11px;color:var(--ink3,#777);display:flex;align-items:center;pointer-events:none;z-index:1}
.bk-drive.bad{color:var(--red,#b42318);font-weight:700}
.bk-week{border-collapse:collapse;min-width:760px;width:100%}
.bk-week th,.bk-week td{border:1px solid var(--line,#ddd);vertical-align:top;padding:4px;font-size:12.5px;text-align:left}
.bk-week td{cursor:pointer;min-width:100px}.bk-week td.off{background:rgba(120,120,120,.08)}
.bk-week th.today{background:color-mix(in srgb,#2f7a55 12%,transparent)}
.bk-chip{border-left:4px solid var(--c,#888);background:color-mix(in srgb,var(--c,#888) 14%,transparent);border-radius:4px;padding:2px 4px;margin:2px 0;font-size:12px;cursor:pointer}
.bk-chip.unconf{border-left-style:dashed}.bk-chip.blk{opacity:.8}.bk-chip.held{border:1px dotted var(--ink3,#888);background:none}
.bk-month{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.bk-mh{font-size:12px;color:var(--ink3,#777);text-align:center}
.bk-md{min-height:74px;border:1px solid var(--line,#ddd);border-radius:6px;background:var(--bg,#fff);color:inherit;text-align:left;padding:4px;display:flex;flex-direction:column;gap:2px;font:inherit;font-size:11.5px;cursor:pointer;min-width:0;overflow:hidden}
.bk-md.other{opacity:.45}.bk-md.today{outline:2px solid #2f7a55}
.bk-md .n{font-weight:700;font-size:13px}.bk-md .o{color:var(--ink3,#777)}
.bk-roster{border-collapse:collapse;width:100%;min-width:460px}.bk-roster th,.bk-roster td{border-bottom:1px solid var(--line,#ddd);padding:5px;text-align:left;font-size:14px}.bk-roster tr.we{background:rgba(120,120,120,.06)}.bk-roster tr.today th{color:#2f7a55}
.bk-perm{border-collapse:collapse;min-width:520px}.bk-perm th,.bk-perm td{border-bottom:1px solid var(--line,#ddd);padding:5px;font-size:13px;text-align:center}.bk-perm th:first-child{text-align:left}
.bk-dot{width:14px;height:14px;border-radius:50%;background:var(--c);flex:none;margin-right:6px}
.bk-svcrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.bk-svcrow select{flex:1;min-width:160px}.bk-svcrow input{width:80px}
.bk-radio{display:inline-flex;gap:6px;align-items:center;font-size:14.5px;margin-right:12px}
.bk-picked{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.bk-res{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;border:1px solid var(--line,#ddd);background:var(--bg,#fff);color:inherit;border-radius:8px;padding:6px 10px;margin-top:4px;font:inherit;cursor:pointer}
.bk-sugg{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;margin:6px 0}
.bk-sopt{display:flex;flex-direction:column;align-items:flex-start;text-align:left;border:1.5px solid #2f7a55;border-radius:8px;padding:6px 10px;background:color-mix(in srgb,#2f7a55 8%,var(--bg,#fff));color:inherit;font:inherit;cursor:pointer}
.bk-warnbox{border:1px solid #e3b25c;background:color-mix(in srgb,#e3b25c 14%,var(--bg,#fff));border-radius:8px;padding:6px 10px;font-size:14px;margin:6px 0}
.bk-actions{margin-top:10px}
.bk-hrow{display:flex;gap:6px;align-items:center;margin:3px 0;flex-wrap:wrap}.bk-hrow .bk-radio{min-width:70px}
.bk-times2{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.bk-jobs summary{cursor:pointer;display:flex;gap:8px;align-items:center}
.bk-job{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-top:1px solid var(--line,#eee);padding:8px 0}
.bk-job .v{min-width:0;flex:1 1 240px}
.bk-fu.over b{color:var(--red,#b42318)}
.bk-jobsbtn{border-color:var(--red,#b42318)}
.bk-empty{padding:16px}
.bk-texts{margin-top:10px}.bk-text{border-left:3px solid var(--line,#ccc);padding:4px 8px;margin:6px 0;font-size:14px}.bk-text.in{border-left-color:#2f7a55;background:color-mix(in srgb,#2f7a55 7%,transparent)}
.bk-dayscroll.v{max-height:calc(100dvh - 250px);min-height:320px;overflow:auto;overscroll-behavior:contain;border-top:1px solid var(--line,#ddd)}
.bk-corner{left:0}
.bk-colh[draggable=true]{cursor:grab}.bk-colh.dropto{outline:2px dashed #2f7a55;outline-offset:-2px;border-radius:6px}
.bk-colord{display:flex;gap:4px;align-items:center}.bk-colord b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bk-colord .btn{padding:0 7px;font-size:14px;line-height:20px}
.bk-svcblk{border:1px solid var(--line,#ddd);border-radius:8px;padding:6px 8px 4px;margin-bottom:6px}.bk-svcblk.along{border-style:dashed;background:color-mix(in srgb,#3a6ea5 5%,transparent)}
.bk-svcblk .bk-svcrow{margin-bottom:4px}
.bk-svcrow input[type=number]{width:84px!important;flex:0 0 84px;min-width:0}.bk-svcrow .hint{flex:0 0 auto}.bk-svcrow select{min-width:0}.bk-svcrow select[data-bksvc]{flex:1 1 220px}
.bk-who{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;margin-bottom:2px}
.bk-pp{display:inline-flex;gap:4px;align-items:center;border:1px solid var(--line,#ccc);border-radius:16px;padding:2px 9px;font-size:14px;cursor:pointer}.bk-pp:has(input:checked){border-color:#2f7a55;background:color-mix(in srgb,#2f7a55 12%,transparent);font-weight:600}.bk-pp.bad{opacity:.6}
.bk-labour{margin-top:6px}
.bk-ai summary{cursor:pointer}.bk-ai{margin-bottom:8px}
.bk-appt.pat-solid,.bk-block.pat-solid,.bk-chip.pat-solid{background:var(--c)!important;color:#fff}.pat-solid .bk-as,.pat-solid .bk-at i{color:rgba(255,255,255,.85)}
.bk-appt.pat-stripes,.bk-block.pat-stripes,.bk-chip.pat-stripes,.bk-patdemo.pat-stripes{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--c) 34%,var(--bg,#fff)) 0 6px,color-mix(in srgb,var(--c) 9%,var(--bg,#fff)) 6px 12px)!important}
.bk-appt.pat-dots,.bk-block.pat-dots,.bk-chip.pat-dots,.bk-patdemo.pat-dots{background:radial-gradient(color-mix(in srgb,var(--c) 60%,transparent) 1.6px,transparent 1.9px) 0 0/8px 8px,color-mix(in srgb,var(--c) 7%,var(--bg,#fff))!important}
.bk-appt.pat-checks,.bk-block.pat-checks,.bk-chip.pat-checks,.bk-patdemo.pat-checks{background:repeating-conic-gradient(color-mix(in srgb,var(--c) 28%,var(--bg,#fff)) 0 25%,color-mix(in srgb,var(--c) 7%,var(--bg,#fff)) 0 50%) 0 0/12px 12px!important}
.bk-appt.pat-outline,.bk-block.pat-outline,.bk-chip.pat-outline,.bk-patdemo.pat-outline{background:var(--bg,#fff)!important}
.bk-patdemo{display:inline-block;width:34px;height:22px;border:1.5px solid var(--c);border-radius:5px;background:color-mix(in srgb,var(--c) 16%,var(--bg,#fff));vertical-align:middle}.bk-patdemo.pat-solid{background:var(--c)}
.bk-patopt{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line,#ccc);border-radius:8px;padding:4px 8px;font-size:14px;cursor:pointer}.bk-patopt:has(input:checked){border-color:#2f7a55;background:color-mix(in srgb,#2f7a55 10%,transparent)}
.bk-swrow{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.bk-sw{display:inline-flex;gap:5px;align-items:center;border:1px solid var(--line,#ccc);border-radius:14px;background:var(--bg,#fff);color:inherit;font:inherit;font-size:13px;padding:2px 9px 2px 4px;cursor:pointer}.bk-sw span{width:18px;height:18px;border-radius:50%;background:var(--c);display:inline-block}.bk-sw.dot{padding:3px}
input.bk-colsq{width:64px;height:64px;padding:0;border:1px solid var(--line,#ccc);border-radius:10px;background:none;cursor:pointer}
`; document.head.appendChild(st); })();
