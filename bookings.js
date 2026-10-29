/* Bovitech Super App — Scheduling, part 1 of 4: the data and the rules.
   Appointments (with a column per person), procedures, statuses, held new times, repeating appointments and blocks
   (meetings, RDOs, leave…), lunch breaks, where each person starts and finishes the day, travel to, between and from
   farms and yards, yard rules and speeds, the on-call roster, and the Scheduling change log.
   Part 2 (bk-ui.js) draws the screens, part 3 (bk-form.js) has the appointment and block forms and the taps,
   part 4 (bk-oncall.js) has the on-call pattern, the CSV export and the Google Calendar sync.
   Loaded before app.js; uses app.js helpers (D, S, h, uid, touch, save, toast, ask, openSheet…) only at run time.
   Everything syncs like contacts: each item is a record (kinds below). */
'use strict';
const BOOK_KINDS = ['bookings', 'blocks', 'oncall', 'bkcfg', 'followups', 'bklog'];
const BK_FOLLOWUPS_ON = false; // follow-ups come back with the clinical records module
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
const bkTime = (t) => { const m = typeof t === 'number' ? t : bkMin(t), hh = Math.floor(m / 60), mm = m % 60; return `${hh % 12 || 12}${mm ? ':' + bkPad(mm) : ''}${hh < 12 || hh === 24 ? 'am' : 'pm'}`; };
const bkDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m} min`);
const bkWeekStart = (s) => bkAdd(s, -((bkDow(s) + 6) % 7)); // Monday
const bkQ = (m) => Math.ceil(m / 15) * 15; // appointments start on the quarter hour
const bkRound15 = (t) => { if (!t) return t; const m = bkMin(t); return bkHHMM(Math.min(1425, Math.round(m / 15) * 15)); };
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BK = { view: 'day', date: bkToday(), page: 'cal', showAll: false, showCancelled: false, jobFilter: '' };
try { const p = JSON.parse(localStorage.getItem('bvp-bkview') || '{}'); if (p.view) BK.view = p.view; } catch (e) { }
const bkClone = (x) => JSON.parse(JSON.stringify(x));

/* ---------------- settings records (kind bkcfg) — fixed ids for the starting set so two devices never make duplicates ---------------- */
const BK_WHO_DEF = { clientBiz: true, nonclientBiz: false, clientInd: false, nonclientInd: false };
const BK_DEFAULTS = [
  { id: 'type-farm', cfg: 'type', order: 1, name: 'On-farm', colour: '#2f7a55', where: 'farm', fixedMins: null, who: { ...BK_WHO_DEF } },
  { id: 'type-inhouse', cfg: 'type', order: 2, name: 'In-house', colour: '#3a6ea5', where: 'base', fixedMins: null, who: { ...BK_WHO_DEF } },
  { id: 'type-phone', cfg: 'type', order: 3, name: 'Phone', colour: '#8a5a9e', where: 'phone', fixedMins: 15, who: { ...BK_WHO_DEF } },
  { id: 'type-fec', cfg: 'type', order: 4, name: 'In-house FEC', colour: '#b5791c', where: 'base', fixedMins: 15, who: { ...BK_WHO_DEF } },
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
  { id: 'bt-meeting', cfg: 'blocktype', order: 1, name: 'Morning meeting', colour: '#64748b', where: 'base' },
  { id: 'bt-admin', cfg: 'blocktype', order: 2, name: 'Admin time', colour: '#7c8a6e', where: 'base' },
  { id: 'bt-rounds', cfg: 'blocktype', order: 3, name: 'Clinical rounds', colour: '#6f7fb0', where: 'base' },
  { id: 'bt-event', cfg: 'blocktype', order: 4, name: 'Industry event', colour: '#a0782f', where: 'anywhere' },
  { id: 'bt-rdo', cfg: 'blocktype', order: 5, name: 'RDO', colour: '#9a6b8a', where: 'anywhere' },
  { id: 'bt-leave', cfg: 'blocktype', order: 6, name: 'Leave / not available', colour: '#9b5050', where: 'anywhere' },
  { id: 'bt-lunch', cfg: 'blocktype', order: 7, name: 'Lunch break', colour: '#c2884a', where: 'anywhere', pattern: 'dots' },
  { id: 'lunch', cfg: 'lunch', name: 'Lunch breaks', on: true, mins: 30, def: '12:00', from: '11:00', to: '13:30' },
  { id: 'fu-recheck', cfg: 'futype', order: 1, name: 'Recheck', days: 14 },
  { id: 'fu-results', cfg: 'futype', order: 2, name: 'Lab results due', days: 7 },
  { id: 'fu-booster', cfg: 'futype', order: 3, name: 'Booster vaccination', days: 28 },
  { id: 'fu-pregre', cfg: 'futype', order: 4, name: 'Preg recheck', days: 42 },
  { id: 'fu-bullre', cfg: 'futype', order: 5, name: 'Bull retest', days: 56 },
  { id: 'sms-booked', cfg: 'sms', order: 1, use: 'booked', name: 'Booking made', text: 'Hi {first}, your {type} appointment with Bovitech Veterinary Services is booked for {day} {date} at {time}{at_farm}. Reply to this message or call 0499 489 919 if you need to change it.' },
  { id: 'sms-reminder', cfg: 'sms', order: 2, use: 'reminder', name: 'Reminder (5 days before)', text: 'Hi {first}, a reminder of your appointment with Bovitech Veterinary Services on {day} {date} at {time}{at_farm}. Please reply YES to confirm, or call 0499 489 919 to change it.' },
  { id: 'sms-proposal', cfg: 'sms', order: 3, use: 'proposal', name: 'New time suggested', text: 'Hi {first}, could we move your appointment from {old_date} to {day} {date} at {time}? Please reply YES to accept, or call 0499 489 919.' },
];
const BK_MIG = 4; // 2: more procedures and flags · 3: preg / bull testing take their speed from each farm · 4: lunch breaks, where blocks happen, who types can be booked for, on call midnight to midnight
const BK_NEW_V2 = ['svc-bruc', 'svc-vasec', 'svc-trace', 'svc-mischalf', 'svc-miscfull'];
const BK_USE = { '': 'Preg and bull testing', preg: 'Preg testing only (no bull testing)', bull: 'Bull testing only (no preg testing)', individual: 'Individual animal assessments only', none: 'Do not service' };
const BK_STATUS = { unconfirmed: 'Unconfirmed', confirmed: 'Confirmed', done: 'Completed — not invoiced', invoiced: 'Completed and invoiced' };
const BK_DEFAULT_BLOCKS = [{ id: 'blk-meeting', type: 'bt-meeting', staff: 'all', date: '2026-01-05', start: '08:00', end: '08:30', repeat: { every: 'weekdays' }, on: true, note: 'At homebase' }];
const BK_PERMS = [['book', 'Add, change and move appointments'], ['blocks', 'Add and change blocks (meetings, RDOs, leave…)'], ['roster', 'Change the on-call roster'], ['settings', 'Change appointment types, procedures, block types and SMS templates']];

const Bk = {
  on() { return !!(typeof PREF !== 'undefined' && PREF.showBook); },
  list(k) { return (D && D[k]) || (D[k] = []); },
  cfg(t) { return Bk.list('bkcfg').filter((x) => x.cfg === t && !x.gone).sort((a, b) => (a.order || 99) - (b.order || 99) || (a.name || '').localeCompare(b.name || '')); },
  get(id) { return Bk.list('bkcfg').find((x) => x.id === id); },
  type(id) { return Bk.get(id) || { name: 'Appointment', colour: '#777', where: 'farm' }; },
  svc(id) { return Bk.get(id) || { name: 'Procedure', mode: 'fixed', mins: 60 }; },
  btype(id) { return Bk.get(id) || { name: 'Block', colour: '#888' }; },
  lunchCfg() { return { on: true, mins: 30, def: '12:00', from: '11:00', to: '13:30', ...(Bk.get('lunch') || {}) }; },
  /* the starting settings, made once (after this device has the latest data, so nothing is duplicated) */
  seed() {
    if (!D || !D.sync || !D.sync.last) return;
    BK._quiet = true; // the change log doesn't list the starting settings
    try {
      let n = 0; const have = new Set(Bk.list('bkcfg').map((x) => x.id));
      if (!Bk.list('bkcfg').length) { BK_DEFAULTS.forEach((d) => { if (!have.has(d.id)) { const r = bkClone(d); touch(r); D.bkcfg.push(r); n++; } }); D.sync.bkMig = BK_MIG; }
      if (!Bk.list('blocks').length && !(D.sync.bkSeeded)) BK_DEFAULT_BLOCKS.forEach((d) => { const r = bkClone(d); touch(r); D.blocks.push(r); n++; });
      if ((D.sync.bkMig || 1) < 2) { // add the newer procedures and flags to an existing set (same fixed ids on every device, so nothing doubles up)
        BK_DEFAULTS.filter((d) => d.cfg === 'service').forEach((d) => { let r = Bk.get(d.id);
          if (!r) { if (BK_NEW_V2.includes(d.id)) { r = { ...d }; touch(r); D.bkcfg.push(r); n++; } return; }
          let ch = false; ['askLabour', 'alongside', 'yard'].forEach((k) => { if (d[k] != null && r[k] === undefined) { r[k] = d[k]; ch = true; } }); if (ch) { touch(r); n++; } });
        D.sync.bkMig = 2;
      }
      if ((D.sync.bkMig || 1) < 3) { ['svc-preg', 'svc-bull'].forEach((id) => { const r = Bk.get(id); if (r && r.rateFrom === undefined) { r.rateFrom = 'farm'; touch(r); n++; } }); D.sync.bkMig = 3; }
      if ((D.sync.bkMig || 1) < 4) {
        ['bt-lunch', 'lunch'].forEach((id) => { if (!Bk.get(id)) { const r = bkClone(BK_DEFAULTS.find((d) => d.id === id)); touch(r); D.bkcfg.push(r); n++; } });
        BK_DEFAULTS.filter((d) => d.cfg === 'blocktype' || d.cfg === 'type').forEach((d) => { const r = Bk.get(d.id); if (!r) return; let ch = false;
          if (d.where && r.where === undefined) { r.where = d.where; ch = true; } if (d.who && r.who === undefined) { r.who = { ...d.who }; ch = true; } if (ch) { touch(r); n++; } });
        Bk.list('bkcfg').filter((r) => r.cfg === 'service' && r.alongside && r.id !== 'svc-labour').forEach((r) => { delete r.alongside; touch(r); n++; }); // only additional labour runs alongside
        Bk.list('oncall').forEach((o) => { if (o.who === undefined && (o.all || o.night || o.evening)) { o.who = o.all || o.evening || o.night; touch(o); n++; } }); // on call is now one person, midnight to midnight
        D.sync.bkMig = 4;
      }
      if (n) D.sync.bkSeeded = true; save();
    } finally { BK._quiet = false; }
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
  hidden() { try { return new Set(JSON.parse(localStorage.getItem('bvp-bkhide') || '[]')); } catch (e) { return new Set(); } }, // people switched off on the calendar — this device only
  setHidden(set) { try { localStorage.setItem('bvp-bkhide', JSON.stringify([...set])); } catch (e) { } },
  person(id) { return Bk.people().find((s) => s.id === id) || ((window.SBAuth && SBAuth.list) || []).find((s) => s.id === id) || null; },
  pname(id) { const s = Bk.person(id); return s ? s.preferred_name || s.full_name.split(' ')[0] : '?'; },
  pini(id) { const s = Bk.person(id); return s ? s.initials : '?'; },
  scfg(s) { // a person's hours, what they can be booked for, and days they swap in or out
    const c = Bk.get('staff:' + s.id) || {};
    const tech = s.role === 'vet_tech' || s.role === 'assistant';
    const locum = !/@bovitech\.com\.au$/i.test(s.email || '') && s.role === 'vet';
    const end = tech ? '17:00' : '18:00';
    const def = { mode: locum ? 'locum' : 'regular', hours: { 1: ['08:00', end], 2: ['08:00', end], 3: ['08:00', end], 4: ['08:00', end], 5: ['08:00', end] }, endBuffer: tech ? 0 : 45, canDo: tech ? ['svc-ai', 'svc-labour'] : null, availDates: {}, offDates: {}, locumHours: ['08:00', '18:00'], mobile: '', home: null, startFrom: 'base' };
    return { ...def, ...c, hours: c.hours || def.hours, availDates: c.availDates || {}, offDates: c.offDates || {} };
  },
  usualHours(s, date) { const c = Bk.scfg(s); return c.mode === 'locum' ? null : c.hours[bkDow(date)] || null; },
  hours(s, date) { // [start, end] on that day, or null when they're not working
    const c = Bk.scfg(s); if (c.offDates[date]) return null;
    const a = c.availDates[date]; if (a) return Array.isArray(a) ? a : c.mode === 'locum' ? c.locumHours : Bk.usualHours(s, date) || c.locumHours;
    return c.mode === 'locum' ? null : c.hours[bkDow(date)] || null;
  },
  canDo(s, svcId) { const c = Bk.scfg(s); return !c.canDo || c.canDo.includes(svcId); },
  /* ---- permissions: everyone by default; the admin can turn them off per person ---- */
  can(p) {
    if (!window.SBAuth || !SBAuth.staff) return false; if (SBAuth.isAdmin()) return true;
    const pr = Bk.get('perms'); return !(pr && pr.staff && pr.staff[SBAuth.staff.id] && pr.staff[SBAuth.staff.id][p] === false);
  },
  need(p) { if (Bk.can(p)) return true; toast("You don't have permission for this — ask the office"); return false; },
  /* ---- blocks: repeating series, one-off changes to a single day, and lunch breaks ---- */
  blockOn(b, date) {
    if (!b.on || b.gone || b.lunch || b.of) return false; if ((b.skip || []).includes(date)) return false;
    if (!bkRuleOn(b.repeat, b.date, date, b.toDate)) return false;
    return !Bk.list('blocks').some((x) => x.of === b.id && x.occ === date && !x.gone); // this day was changed on its own
  },
  blocksFor(date, staffId) {
    const inStaff = (b) => b.staff === 'all' || (Array.isArray(b.staff) && b.staff.includes(staffId));
    return Bk.list('blocks').filter((b) => !b.lunch && inStaff(b) && ((b.of && !b.gone && b.on !== false && (b.date === date || (b.toDate && date >= b.date && date <= b.toDate))) || Bk.blockOn(b, date)));
  },
  /* ---- lunch: everyone working gets one (moveable); it can be taken during a long appointment instead ---- */
  lunch(staffId, date) {
    const lc = Bk.lunchCfg(); if (!lc.on) return null;
    const inAppt = Bk.bookingsFor(date, staffId).find((b) => b.lunch && b.lunch.start); if (inAppt) return { start: inAppt.lunch.start, end: bkHHMM(bkMin(inAppt.lunch.start) + lc.mins), inAppt };
    const rec = Bk.list('blocks').find((x) => x.id === 'lunch:' + staffId + ':' + date);
    if (rec) return rec.gone ? null : { start: rec.start, end: rec.end, rec };
    const p = Bk.person(staffId); const hr = p && Bk.hours(p, date); if (!hr) return null;
    if (Bk.blocksFor(date, staffId).some((b) => b.allDay)) return null; // on leave, at an event…
    if (bkMin(hr[0]) > bkMin(lc.def) || bkMin(hr[1]) < bkMin(lc.def) + lc.mins) return null;
    return { start: lc.def, end: bkHHMM(bkMin(lc.def) + lc.mins), virtual: true };
  },
  /* ---- appointments ---- */
  live(b) { return b.status !== 'cancelled' && !b.gone; },
  bookingsFor(date, staffId) { return Bk.list('bookings').filter((b) => Bk.live(b) && b.date === date && (b.staff || []).includes(staffId)).sort((a, c) => a.start.localeCompare(c.start)); },
  proposalsFor(date, staffId) { return Bk.list('bookings').filter((b) => Bk.live(b) && b.proposal && b.proposal.date === date && (b.proposal.staff || b.staff || []).includes(staffId)); },
  weekend(date) { const d = bkDow(date); return d === 0 || d === 6; },
  statusText(b) { return b.proposal ? 'Reschedule pending approval' : BK_STATUS[b.status] || 'Unconfirmed'; },
  unconf(b) { return !b.status || b.status === 'unconfirmed'; },
  done(b) { return b.status === 'done' || b.status === 'invoiced'; },
  who(b) { // client name for an appointment
    const bz = b.bid && IDX.biz && IDX.biz.get(b.bid); const c = b.cid && D.contacts.find((x) => x.id === b.cid);
    return bz ? bz.name : c ? fullName(c) : b.clientText || 'No client';
  },
  stops(b) { // the farms and yards visited, in order (the same yards can come up more than once)
    if (Array.isArray(b.stops)) return b.stops; // (older appointments only have the farms)
    return (b.fids && b.fids.length ? b.fids : b.fid ? [b.fid] : []).map((fid) => ({ fid, yid: null }));
  },
  fids(b) { return [...new Set(Bk.stops(b).map((x) => x.fid).filter(Boolean))]; },
  farms(b) { return IDX.farms ? Bk.fids(b).map((id) => IDX.farms.get(id)).filter(Boolean) : []; },
  farm(b) { return Bk.farms(b)[0] || null; },
  stopName(st, short) { const f = st && IDX.farms && IDX.farms.get(st.fid); if (!f) return 'Farm'; const ys = bkYardsOf(f); const y = st.yid ? ys.find((x) => x.yid === st.yid) : null; const fn = f.name || f.address || 'Farm'; return y && ys.length > 1 ? (short ? y.name : `${fn} — ${y.name}`) : fn; },
  farmName(b) { const st = Bk.stops(b); return st.map((x, i) => (i && st[i - 1].fid === x.fid ? Bk.stopName(x, true) : Bk.stopName(x))).join(' → '); },
  sstaff(b, x) { return Array.isArray(x.staff) ? x.staff : b.staff || []; }, // who is doing one procedure (older appointments: everyone on it)
  svcText(b, sid) { const all = b.svcs || []; const l = sid ? all.filter((x) => Bk.sstaff(b, x).includes(sid)) : all; return (l.length ? l : all).map((x) => Bk.svc(x.svc).name + (x.head ? ' ×' + x.head : '')).join(', '); },
  fsched(fid) { return (fid && Bk.get('fsched:' + fid)) || {}; }, // a farm's booking rules (set on the business page)
  bsched(bid) { return (bid && Bk.get('bsched:' + bid)) || {}; },
  pidText(b) { return (b.pids || []).map((p) => p.value).join(', '); },
  look(item, typeRec) { const l = item && item.look; return { colour: (l && l.colour) || typeRec.colour || '#777', pattern: (l && l.pattern) || typeRec.pattern || 'light' }; }, // default look from the type, or this one's own
};
Bk.sms = (bookingId) => ((D && D.smsLog) || []).filter((x) => x.booking_id === bookingId);
Bk.smsOk = (row) => row && ['queued', 'sending', 'sent', 'delivered'].includes(row.status);
Bk.smsKey = (key) => ((D && D.smsLog) || []).find((x) => x.key === key);
window.Bk = Bk;

/* ---------------- repeating: one rule for blocks and appointments ---------------- */
const BK_REPEATS = [['none', 'Does not repeat'], ['weekdays', 'Every weekday'], ['daily', 'Every day'], ['weekly', 'Weekly on…'], ['fortnightly', 'Fortnightly on…'], ['monthly', 'Monthly on this date']];
function bkRuleOn(r, anchor, date, toDate) {
  r = r || { every: 'none' }; if (date < anchor) return false; if (r.until && date > r.until) return false;
  if (r.every === 'none' || !r.every) return date === anchor || (!!toDate && date <= toDate);
  const d = bkDow(date);
  if (r.every === 'weekdays') return d >= 1 && d <= 5;
  if (r.every === 'daily') return true;
  if (r.every === 'monthly') return new Date(date + 'T12:00').getDate() === new Date(anchor + 'T12:00').getDate();
  const days = r.days && r.days.length ? r.days : [bkDow(anchor)]; if (!days.includes(d)) return false;
  if (r.every === 'weekly') return true;
  if (r.every === 'fortnightly') return Math.floor(bkDays(bkWeekStart(anchor), bkWeekStart(date)) / 7) % 2 === 0;
  return false;
}
function bkRuleDates(r, anchor, max) { // the dates a repeating appointment is made for (up to a year ahead, or the "until" date)
  const out = []; const end = r.until || bkAdd(anchor, 365);
  for (let d = anchor; d <= end && out.length < (max || 60); d = bkAdd(d, 1)) if (bkRuleOn(r, anchor, d)) out.push(d);
  return out;
}
function bkRuleText(r, anchor) {
  if (!r || !r.every || r.every === 'none') return 'Does not repeat';
  const days = (r.days && r.days.length ? r.days : [bkDow(anchor)]).map((d) => DOW_NAMES[d]).join(', ');
  return ({ weekdays: 'Every weekday', daily: 'Every day', weekly: 'Weekly on ' + days, fortnightly: 'Fortnightly on ' + days, monthly: 'Monthly on the ' + new Date(anchor + 'T12:00').getDate() })[r.every] + (r.until ? ' until ' + bkDate(r.until) : '');
}

/* ---------------- farms and yards ---------------- */
function bkYardsOf(f) { // the yards pins on a farm (the main pin counts when it's a yards pin)
  if (!f) return []; const out = []; const yt = (t) => (typeof isYardType === 'function' ? isYardType(t) : /cattle|sheep|yard/.test(t || ''));
  if (f.lat != null && yt(f.pinType)) out.push({ yid: 'm', name: f.yLabel || f.name || (typeof pinT === 'function' ? pinT(f.pinType).name : 'Yards'), lat: +f.lat, lng: +f.lng, safety: f.safety || {} });
  (f.extra || []).forEach((x) => { if (x.type !== 'turn' && yt(x.type) && x.lat != null) out.push({ yid: x.id, name: x.name || (typeof pinT === 'function' ? pinT(x.type).name : 'Yards'), lat: +x.lat, lng: +x.lng, safety: x.safety || {} }); });
  const seen = {}; out.forEach((y) => { seen[y.name] = (seen[y.name] || 0) + 1; }); const n = {}; out.forEach((y) => { if (seen[y.name] > 1) { n[y.name] = (n[y.name] || 0) + 1; y.name += ' ' + n[y.name]; } });
  return out;
}
function bkYardUse(fid, yid) { const fs = Bk.fsched(fid); if (fs.perYard && yid && fs.yards && fs.yards[yid]) return fs.yards[yid]; return fs; } // the rule for these yards
function bkRate(fid, yid, svc) { // head per hour at these yards: their own rate, or the farm's, when the procedure uses each farm's rate
  if (!fid) return null; const fs = Bk.fsched(fid);
  if (fs.ratesPerYard && yid) { const y = Bk.get(`yrate:${fid}:${yid}:${svc}`); if (y && !y.gone && y.hph) return { hph: y.hph, yard: true }; }
  const y = Bk.get('yard:' + fid + ':' + svc); return y && !y.gone && y.hph ? { hph: y.hph } : null;
}
function bkYard(fid, svc) { const y = fid ? Bk.get('yard:' + fid + ':' + svc) : null; return y && !y.gone ? y : null; }

/* ---------------- travel (rounded up to 5 minutes) ---------------- */
const Travel = {
  home() { const h0 = (D.settings && D.settings.home) || {}; return h0.lat != null ? { lat: +h0.lat, lng: +h0.lng, home: true, label: 'homebase' } : null; },
  pt(f) { if (!f) return null; if (f.turn && f.turn.lat != null) return { lat: +f.turn.lat, lng: +f.turn.lng, f, label: f.name || 'the farm' }; if (f.lat != null) return { lat: +f.lat, lng: +f.lng, f, label: f.name || 'the farm' }; return null; },
  stopPt(st) { const f = st && IDX.farms && IDX.farms.get(st.fid); if (!f) return null; const p = Travel.pt(f); if (!p) return null; const y = st.yid && bkYardsOf(f).find((x) => x.yid === st.yid); return { ...p, yard: y || null, fid: f.id, label: Bk.stopName(st) }; },
  loc(b) { const t = Bk.type(b.type); if (t.where === 'phone') return null; if (t.where === 'base') return Travel.home(); return Travel.stopPt(Bk.stops(b)[0]) || null; }, // where it starts
  locOut(b) { const t = Bk.type(b.type); if (t.where !== 'farm') return Travel.loc(b); const st = Bk.stops(b); return Travel.stopPt(st[st.length - 1]) || null; }, // where it finishes
  legs(stops) { const out = []; for (let i = 1; i < stops.length; i++) { const a = Travel.stopPt(stops[i - 1]), b = Travel.stopPt(stops[i]); out.push({ from: stops[i - 1], to: stops[i], mins: Travel.mins(a, b) }); } return out; },
  between(stops) { return Travel.legs(stops).reduce((s, l) => s + l.mins, 0); }, // driving between the farms and yards on one appointment
  km(a, b) { const R = 6371, r = Math.PI / 180; const dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); },
  raw(a, b) {
    if (!a || !b) return 0; if (a.home && b.home) return 0;
    if (a.fid && b.fid && a.fid === b.fid) { if (!a.yard || !b.yard || a.yard.yid === b.yard.yid) return 0; const k = Travel.km(a.yard, b.yard); return k < 0.2 ? 0 : (k * 1.3) / 30 * 60 + 2; } // yards on the same farm: farm tracks
    const far = a.home ? b : b.home ? a : null;
    if (far && far.f && far.f.driveMin != null) return +far.f.driveMin;
    const k = Travel.km(a, b); if (k < 0.3) return 0;
    return (k * 1.35) / 75 * 60 + 3; // road distance ≈ 1.35 × straight line, 75 km/h, a few minutes to get going
  },
  mins(a, b) { const m = Travel.raw(a, b); return m > 0 ? Math.ceil(m / 5) * 5 : 0; },
};
window.Travel = Travel;
function bkPlace(p) { if (!p) return null; if (p.kind === 'home') { return p.lat != null ? { lat: +p.lat, lng: +p.lng, label: 'home' } : null; } if (p.kind === 'farm') return Travel.stopPt({ fid: p.fid, yid: p.yid || null }); return Travel.home(); }
function bkDayLoc(staffId, date) { // where someone starts and finishes the day (homebase unless changed for that day)
  const p = Bk.person(staffId); const c = p ? Bk.scfg(p) : {}; const rec = Bk.get('dayloc:' + staffId + ':' + date) || {};
  const def = c.startFrom === 'home' && c.home && c.home.lat != null ? { kind: 'home', lat: c.home.lat, lng: c.home.lng } : { kind: 'base' };
  const st = rec.start || def, en = rec.end || def;
  const name = (x) => (x.kind === 'home' ? 'home' : x.kind === 'farm' ? Bk.stopName({ fid: x.fid, yid: x.yid }) : 'homebase');
  return { start: bkPlace(st) || Travel.home(), end: bkPlace(en) || Travel.home(), startName: name(st), endName: name(en), changed: !!(rec.start || rec.end), rec };
}

/* ---------------- one person's day: blocks, lunch, appointments and the driving in between ---------------- */
function bkBlockLoc(b) { const bt = Bk.btype(b.type); return (bt.where || 'base') === 'base' ? Travel.home() : null; }
function bkDay(staffId, date, o = {}) { // o: { skipId, add (an appointment-like item to put in), moves {id: start}, noLunch }
  const p = Bk.person(staffId); const hr = p ? Bk.hours(p, date) : null; const items = [];
  Bk.blocksFor(date, staffId).forEach((b) => { const bt = Bk.btype(b.type); items.push({ kind: 'block', s: b.allDay ? 0 : bkMin(b.start), e: b.allDay ? 1440 : bkMin(b.end), loc: b.allDay ? null : bkBlockLoc(b), what: bt.name, ref: b }); });
  const lu = o.noLunch ? null : Bk.lunch(staffId, date); if (lu && !lu.inAppt) items.push({ kind: 'lunch', s: bkMin(lu.start), e: bkMin(lu.end), loc: null, what: 'lunch', ref: lu });
  Bk.bookingsFor(date, staffId).filter((b) => b.id !== o.skipId).forEach((b) => { const s = o.moves && o.moves[b.id] != null ? o.moves[b.id] : bkMin(b.start); items.push({ kind: 'appt', s, e: s + b.mins, loc: Travel.loc(b), locOut: Travel.locOut(b), what: Bk.who(b), ref: b }); });
  Bk.proposalsFor(date, staffId).filter((b) => b.id !== o.skipId && !(o.moves && o.moves[b.id] != null)).forEach((b) => { const s = bkMin(b.proposal.start); items.push({ kind: 'held', s, e: s + (b.proposal.mins || b.mins), loc: Travel.loc(b), locOut: Travel.locOut(b), what: 'held for ' + Bk.who(b), ref: b }); });
  if (o.add) items.push({ kind: 'new', s: o.add.s, e: o.add.e, loc: o.add.loc, locOut: o.add.locOut, what: 'this appointment', ref: o.add.ref });
  items.sort((a, b) => a.s - b.s || (a.kind === 'block' ? -1 : 1));
  const dl = bkDayLoc(staffId, date);
  // the drives: from the start of the day to the first place, between places, and back at the end
  const legs = []; let cur = dl.start, curName = dl.startName, prevEnd = hr ? bkMin(hr[0]) : 0, anyAway = false, lastAt = prevEnd;
  items.forEach((it) => { if (it.kind === 'lunch' || !it.loc) { if (it.kind !== 'lunch' && it.kind !== 'block') prevEnd = Math.max(prevEnd, it.e); return; }
    const need = Travel.mins(cur, it.loc); if (need > 0) legs.push({ from: curName, to: it.loc.label || it.what, need, end: it.s, start: it.s - need, prevEnd, item: it });
    cur = it.locOut || it.loc; curName = (it.locOut || it.loc).label || it.what; prevEnd = Math.max(prevEnd, it.e); lastAt = it.e; if (!(it.loc && it.loc.home)) anyAway = true; });
  if (anyAway) { const need = Travel.mins(cur, dl.end); if (need > 0) legs.push({ from: curName, to: dl.endName, need, start: lastAt, end: lastAt + need, prevEnd: lastAt, home: true }); } // home straight after the last place (phone calls can happen on the way)
  return { hr, items, legs, dl, lunch: lu, person: p };
}

/* ---------------- how long: set times or per head (at these yards), plus set-up and pack-up, driving between yards, lunch ---------------- */
function bkSuggestMins(typeId, svcs, stopsIn, lunchIn) {
  const t = Bk.type(typeId); const stops = Array.isArray(stopsIn) ? stopsIn.map((x) => (typeof x === 'string' ? { fid: x, yid: null } : x)).filter((x) => x && x.fid) : stopsIn ? [{ fid: stopsIn, yid: null }] : [];
  const lunchAdd = lunchIn ? Bk.lunchCfg().mins : 0;
  if (t.fixedMins) return { mins: t.fixedMins + lunchAdd, why: `${t.name}: default ${bkDur(t.fixedMins)}${lunchAdd ? ` + lunch ${lunchAdd} min` : ''}` };
  const all = (svcs || []).filter((x) => x.svc && Bk.get(x.svc)); const main = all.filter((x) => !Bk.svc(x.svc).alongside);
  const use = main.length ? main : all; // additional labour runs alongside the other procedures, so it doesn't make the appointment longer
  const setups = {}; let mins = 0; const why = [];
  use.forEach((x) => { const sv = Bk.svc(x.svc); const st = t.where === 'farm' ? stops[x.stop || 0] || stops[0] : null; const at = st ? st.fid + ':' + (st.yid || '') : '-';
    setups[at] = Math.max(setups[at] || 0, sv.setup || 0); // set-up and pack-up, once at each set of yards
    if (sv.mode === 'perhead') { const y = sv.rateFrom === 'farm' && st ? bkRate(st.fid, st.yid, x.svc) : null; const hph = x.hph || (y && y.hph) || sv.hph || 60; const head = +x.head || 0;
      const m = head ? (head / hph) * 60 : 0; mins += m;
      why.push(`${sv.name}: ${head || '?'} head at ${hph}/hour${x.hph ? '' : y ? (y.yard ? ' (these yards)' : ' (this farm)') : sv.rateFrom === 'farm' ? (sv.hph ? ' (usual — no rate set for these yards)' : ' (no rate set — guessed)') : ''} = ${bkDur(Math.round(m))}`); }
    else { mins += +sv.mins || 0; why.push(`${sv.name}: ${bkDur(+sv.mins || 0)}`); } });
  all.filter((x) => main.length && Bk.svc(x.svc).alongside).forEach((x) => why.push(`${Bk.svc(x.svc).name}: alongside`));
  const setup = Object.values(setups).reduce((a, b) => a + b, 0); if (setup) why.push(`set-up and pack-up ${setup} min`);
  const drive = t.where === 'farm' && stops.length > 1 ? Travel.between(stops) : 0; if (drive) why.push(`driving between farms / yards ~${drive} min`);
  if (lunchAdd) why.push(`lunch ${lunchAdd} min`);
  const total = Math.max(15, Math.ceil((mins + setup + drive + lunchAdd) / 15) * 15);
  return { mins: total, why: why.join(' + ') || 'No procedures chosen' };
}

/* ---------------- yard and farm rules (do not service, individual animals only…) ---------------- */
function bkStopIssues(st, svcs, stops) {
  const f = st && st.fid && IDX.farms && IDX.farms.get(st.fid); if (!f) return [];
  const nm = Bk.stopName(st), fs = bkYardUse(st.fid, st.yid), out = [];
  const y = st.yid ? bkYardsOf(f).find((x) => x.yid === st.yid) : null; const sf = (y && y.safety && y.safety.status ? y.safety : f.safety) || {};
  if (fs.use === 'none') out.push({ hard: true, msg: `${nm} is marked DO NOT SERVICE${fs.note ? ' — ' + fs.note : ''}` });
  if (sf.status === 'stop') out.push({ hard: true, msg: `${nm}: no routine work until the safety problem is fixed${sf.note ? ' — ' + sf.note : ''}` });
  if (fs.use === 'individual' || fs.use === 'preg' || fs.use === 'bull') (svcs || []).forEach((x) => { const yk = x.svc && Bk.svc(x.svc).yard; if (!yk) return; const at = (stops || [])[x.stop || 0] || (stops || [])[0];
    if (!at || at.fid !== st.fid || (at.yid || null) !== (st.yid || null)) return;
    if (fs.use === 'individual' || fs.use !== yk) out.push({ msg: `${nm} is set to "${BK_USE[fs.use]}" — not ${Bk.svc(x.svc).name.toLowerCase()}` }); });
  return out;
}
function bkFarmIssues(fid, svcs) { return bkStopIssues({ fid, yid: null }, svcs, [{ fid, yid: null }]); }
function bkYardTag(fid, yid) { const fs = bkYardUse(fid, yid); const f = IDX.farms && IDX.farms.get(fid); const y = f && yid ? bkYardsOf(f).find((x) => x.yid === yid) : null; const sf = (y && y.safety && y.safety.status ? y.safety : f && f.safety) || {}; return (fs.use === 'none' ? ' — ⛔ DO NOT SERVICE' : fs.use ? ' — ' + BK_USE[fs.use] : '') + (sf.status === 'stop' ? ' — ⛔ safety stop' : ''); }
function bkFarmTag(fid) { const fs = Bk.fsched(fid); return fs.perYard ? ' — rules differ by yard' : bkYardTag(fid, null); }
function bkNeedsLabour(f) { // ask about additional labour: some procedures always ask, and some clients always need it
  const svcs = (f.svcs || []).filter((x) => x.svc); if (svcs.some((x) => Bk.svc(x.svc).alongside)) return null;
  if (f.bid && Bk.bsched(f.bid).labour) return 'always';
  return svcs.some((x) => Bk.svc(x.svc).askLabour) ? 'ask' : null;
}

/* ---------------- what's wrong with a time: hours, clashes, lunch, travel, rules ---------------- */
function bkBusy(date, staffId, skipId) { return bkDay(staffId, date, { skipId }).items.filter((x) => x.kind !== 'lunch'); }
function bkProblems(bk, alt) { // bk: appointment-like; alt: check the held new time instead
  const date = alt ? alt.date : bk.date, start = alt ? alt.start : bk.start, mins = alt ? alt.mins || bk.mins : bk.mins, staff = alt ? alt.staff || bk.staff : bk.staff;
  const out = []; if (!date || !start || !mins) return [...new Set(bkRuleProblems(bk))];
  const s0 = bkMin(start), e0 = s0 + mins; const add = { s: s0, e: e0, loc: Travel.loc(bk), locOut: Travel.locOut(bk), ref: bk };
  (staff || []).forEach((sid) => { const p = Bk.person(sid); if (!p) return; const nm = Bk.pname(sid); const c = Bk.scfg(p);
    const day = bkDay(sid, date, { skipId: bk.id, add }); const hr = day.hr;
    if (!hr) out.push(`${nm} isn't working on ${bkDate(date)}${c.mode === 'locum' ? ' (not marked available)' : ''}`);
    (bk.svcs || []).forEach((x) => { if (x.svc && Bk.sstaff(bk, x).includes(sid) && !Bk.canDo(p, x.svc)) out.push(`${nm} isn't set up to be booked for ${Bk.svc(x.svc).name}`); });
    day.items.filter((x) => x.kind !== 'new' && x.s < e0 && x.e > s0).forEach((x) => out.push(x.kind === 'lunch' ? `Overlaps ${nm}'s lunch (${bkTime(x.s)}–${bkTime(x.e)})` : `Clashes with ${x.what} (${bkTime(x.s)}–${bkTime(x.e)}) for ${nm}`));
    if (bk.lunch && bk.lunch.start && (bkMin(bk.lunch.start) < s0 || bkMin(bk.lunch.start) + Bk.lunchCfg().mins > e0)) out.push('The lunch break is outside the appointment time');
    const leg = day.legs.find((l) => l.item && l.item.kind === 'new'); if (leg && leg.start < leg.prevEnd) out.push(`Only ${Math.max(0, s0 - leg.prevEnd)} min to drive from ${leg.from} (needs about ${leg.need}) — ${nm}`);
    const nextLeg = day.legs.find((l) => l.prevEnd === e0 && l.item && l.item.kind !== 'new' && l.start < e0); if (nextLeg) out.push(`Only ${Math.max(0, nextLeg.end - e0)} min to get to ${nextLeg.item.what} afterwards (needs about ${nextLeg.need}) — ${nm}`);
    if (hr) { if (s0 < bkMin(hr[0])) out.push(`Starts before ${nm}'s day (${bkTime(hr[0])})`);
      const lastLeg = day.legs.filter((l) => l.home).pop(); const back = lastLeg ? lastLeg.end : Math.max(...day.items.filter((x) => x.kind !== 'lunch' && !(x.kind === 'block' && x.ref.allDay)).map((x) => x.e), e0);
      if (back > bkMin(hr[1])) out.push(`${nm} wouldn't be back until ${bkTime(back)} (finishes ${bkTime(hr[1])})`);
      else if (c.endBuffer && back > bkMin(hr[1]) - c.endBuffer) out.push(`Uses ${nm}'s end-of-day time for records and restocking`); } });
  if (Bk.type(bk.type).where === 'farm' && !Bk.stops(bk).length) out.push('No farm chosen — travel can\'t be worked out');
  return [...new Set([...out, ...bkRuleProblems(bk)])];
}
function bkRuleProblems(bk) { // farm and yard rules, people, herds / flocks, labour — these don't depend on the time
  const out = []; const st = Bk.stops(bk), isFarm = Bk.type(bk.type).where === 'farm';
  if (isFarm) { st.forEach((x) => bkStopIssues(x, bk.svcs, st).forEach((y) => out.push((y.hard ? '⛔ ' : '') + y.msg)));
    st.forEach((x) => { const f = IDX.farms && IDX.farms.get(x.fid); if (f && !bkYardsOf(f).length) out.push(`${f.name || 'The farm'} has no yards pin yet`); else if (f && !x.yid && bk.stops) out.push(`Choose which yards at ${f.name || 'the farm'}`); }); }
  (bk.svcs || []).forEach((x) => { if (x.svc && !Bk.sstaff(bk, x).length) out.push(`Nobody chosen for ${Bk.svc(x.svc).name}`); });
  const bz = bk.bid && IDX.biz && IDX.biz.get(bk.bid);
  if (bz && (bz.patientIds || []).length && !(bk.pids || []).length) out.push('No herd / flock chosen');
  if (bkNeedsLabour(bk) === 'always' && !bk.noLabour) out.push(`${Bk.who(bk)} always needs additional labour — none booked`);
  return out;
}

/* ---------------- lunch: find a time for it inside the usual window ---------------- */
function bkLunchSpans(staffId, date, o) { const day = bkDay(staffId, date, { ...o, noLunch: true }); return { day, busy: day.items.filter((x) => x.kind !== 'lunch' && !(x.kind === 'block' && x.ref.allDay)).map((x) => [x.s, x.e]).concat(day.legs.map((l) => [l.start, l.end])) }; }
function bkLunchFit(staffId, date, o = {}) { // o: { add, skipId, moves, prefer } → a start time (minutes) inside the window, or null
  const lc = Bk.lunchCfg(); const { day, busy } = bkLunchSpans(staffId, date, o); if (!day.hr) return null;
  const want = o.prefer != null ? o.prefer : bkMin(lc.def); const c = [];
  for (let s = bkMin(lc.from); s + lc.mins <= bkMin(lc.to); s += 15) if (!busy.some(([a, b]) => a < s + lc.mins && b > s)) c.push(s);
  return c.sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0] ?? null;
}
function bkLunchFree(staffId, date, o = {}) { // any time at all for lunch, even outside the window (needs approval)
  const lc = Bk.lunchCfg(); const { day, busy } = bkLunchSpans(staffId, date, o); if (!day.hr) return null;
  const want = bkMin(lc.def); const c = []; for (let s = bkMin(day.hr[0]); s + lc.mins <= bkMin(day.hr[1]); s += 15) if (!busy.some(([a, b]) => a < s + lc.mins && b > s)) c.push(s);
  return c.sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0] ?? null;
}
function bkLunchOutside(startMin) { const lc = Bk.lunchCfg(); return startMin < bkMin(lc.from) || startMin + lc.mins > bkMin(lc.to); }
function bkSetLunch(staffId, date, startMin) { // move (or with null, remove) someone's lunch that day
  const lc = Bk.lunchCfg(); const id = 'lunch:' + staffId + ':' + date; let r = Bk.list('blocks').find((x) => x.id === id);
  if (!r) { r = { id, lunch: true, type: 'bt-lunch', staff: [staffId], date, on: true }; D.blocks.push(r); }
  if (startMin == null) r.gone = true; else { delete r.gone; r.start = bkHHMM(startMin); r.end = bkHHMM(startMin + lc.mins); }
  touch(r);
}

/* ---------------- times free on one day for one person, with the working shown ---------------- */
function bkSlots(staffId, date, o) { // o: { type, stops, mins, skipId } → [{ start, lunch (new lunch start), lunchOut (needs approval), logic: [lines] }]
  const p = Bk.person(staffId); if (!p) return []; const hr = Bk.hours(p, date); if (!hr) return [];
  const c = Bk.scfg(p), lc = Bk.lunchCfg(); const t = Bk.type(o.type); const stops = o.stops || [];
  const tgtLoc = t.where === 'phone' ? null : t.where === 'base' ? Travel.home() : Travel.stopPt(stops[0]);
  const tgtOut = t.where === 'farm' ? Travel.stopPt(stops[stops.length - 1]) : tgtLoc;
  const tgtName = t.where === 'farm' ? (stops[0] ? Bk.stopName(stops[0]) : 'the farm') : t.where === 'base' ? 'homebase' : 'the phone';
  const day = bkDay(staffId, date, { skipId: o.skipId, noLunch: true }); const dl = day.dl;
  const lunch = Bk.lunch(staffId, date); const lunchFixed = !lunch || lunch.inAppt || !lc.on;
  const now = new Date(), today = bkToday(), nowMin = now.getHours() * 60 + now.getMinutes();
  const dayS = Math.max(bkMin(hr[0]), date === today ? bkQ(nowMin + 30) : 0), dayE = bkMin(hr[1]) - (c.endBuffer || 0);
  const items = day.items.filter((x) => x.kind !== 'lunch' && !(x.kind === 'block' && x.ref.allDay)); const out = [];
  if (day.items.some((x) => x.kind === 'block' && x.ref.allDay)) return [];
  let cur = { loc: dl.start, name: dl.startName, e: dayS, s: dayS, what: null };
  const anchors = [...items, { s: dayE, e: dayE, loc: dl.end, what: dl.endName, end: true }];
  for (const nx of anchors) {
    if (nx.s > cur.e) {
      const tIn = Travel.mins(cur.loc, tgtLoc), tOut = Travel.mins(tgtOut, nx.loc);
      const tryAt = (lunchBefore) => { // lunchBefore: take lunch first (straight after the last thing), then drive
        const lunchS = lunchBefore ? Math.max(cur.e, bkMin(lc.from)) : null; const ready = lunchBefore ? lunchS + lc.mins : cur.e;
        const st = Math.max(bkQ(ready + tIn), dayS); const en = st + o.mins;
        if (en + tOut > nx.s || en > dayE) return null;
        const logic = [];
        if (cur.what) logic.push(`${bkTime(cur.s)}–${bkTime(cur.e)} ${cur.what}`); else logic.push(`Day starts ${bkTime(dayS)}${dl.startName !== 'homebase' ? ' from ' + dl.startName : ' at homebase'}`);
        if (lunchBefore) logic.push(`${bkTime(lunchS)}–${bkTime(lunchS + lc.mins)} lunch`);
        if (tIn) logic.push(`${bkTime(ready)}–${bkTime(ready + tIn)} drive ~${tIn} min from ${cur.name} to ${tgtName}`);
        if (st !== ready + tIn) logic.push(`${bkTime(ready + tIn)} rounded up to the next quarter hour = ${bkTime(st)} start`); else logic.push(`Start ${bkTime(st)}`);
        logic.push(`${bkTime(st)}–${bkTime(en)} this appointment (${bkDur(o.mins)})${tOut ? `, then ~${tOut} min to ${nx.end ? dl.endName : nx.what}` : ''}`);
        const r = { start: bkHHMM(st), logic };
        if (lunchBefore) { if (lunchS + lc.mins > bkMin(lc.to)) return null; r.lunch = lunchS; return r; }
        if (lunchFixed) return r;
        const ls = bkMin(lunch.start); if (!(ls < en + tOut && ls + lc.mins > cur.e)) return r; // lunch isn't in the way
        const add = { s: st, e: en, loc: tgtLoc, locOut: tgtOut };
        const fit = bkLunchFit(staffId, date, { skipId: o.skipId, add }); if (fit != null) { r.lunch = fit; r.logic.push(`Lunch moves to ${bkTime(fit)}–${bkTime(fit + lc.mins)}`); return r; }
        const any = bkLunchFree(staffId, date, { skipId: o.skipId, add }); r.lunch = any; r.lunchOut = true;
        r.logic.push(any != null ? `Lunch would have to move to ${bkTime(any)} — outside ${bkTime(lc.from)}–${bkTime(lc.to)} (you'll be asked)` : 'No time left for lunch that day (you\'ll be asked)'); return r;
      };
      const a = tryAt(false); if (a) out.push(a);
      if (!lunchFixed && cur.e < bkMin(lc.to) && cur.e + lc.mins >= bkMin(lc.from) && (!a || a.lunch != null)) { const b = tryAt(true); if (b && (!a || b.start !== a.start || a.lunchOut)) out.push(b); }
    }
    if (nx.e > cur.e) { const lo = nx.locOut || nx.loc; cur = { loc: lo || cur.loc, name: lo ? lo.label || nx.what : cur.name, e: nx.e, s: nx.s, what: nx.end ? null : (nx.kind === 'block' ? nx.what : `${nx.kind === 'held' ? '' : 'appointment: '}${nx.what}${nx.loc && !nx.loc.home ? ' (' + (nx.loc.label || '') + ')' : ''}`) }; }
  }
  return out.sort((a, b) => bkMin(a.start) - bkMin(b.start) || (a.lunchOut ? 1 : 0) - (b.lunchOut ? 1 : 0));
}

/* ---------------- suggest the best day and person: by nearby farms, or the soonest when urgent ---------------- */
function bkSuggest(o) { // o: { type, stops | fids, mins, svcs, urgent, skipId, from, staff (only these people) }
  const stops = o.stops || (o.fids || (o.fid ? [o.fid] : [])).map((fid) => ({ fid, yid: null }));
  const t = Bk.type(o.type); const target = t.where === 'farm' ? Travel.stopPt(stops[0]) : t.where === 'base' ? Travel.home() : null;
  const ppl = Bk.people().filter((s) => (!o.staff || !o.staff.length || o.staff.includes(s.id)) && (o.svcs || []).every((x) => Bk.canDo(s, x.svc)));
  const today = bkToday(); const from = o.from && o.from > today ? o.from : today; const res = [];
  for (let i = 0; i < 42; i++) { const d = bkAdd(from, i);
    for (const s of ppl) { const sl = bkSlots(s.id, d, { type: o.type, stops, mins: o.mins, skipId: o.skipId }).filter((x) => !x.lunchOut); if (!sl.length) continue;
      const day = bkDay(s.id, d, { skipId: o.skipId }); const farmsThatDay = day.items.filter((x) => (x.kind === 'appt' || x.kind === 'held') && x.loc && !x.loc.home);
      const near = target && !target.home ? farmsThatDay.map((x) => ({ m: Travel.mins(x.loc, target), x })).sort((a, b) => a.m - b.m)[0] : null;
      const best = sl.map((x) => ({ x, extra: bkExtraDrive(s.id, d, o, x.start, stops) })).sort((a, b) => a.extra - b.extra || bkMin(a.x.start) - bkMin(b.x.start))[0];
      res.push({ date: d, staff: s.id, start: best.x.start, extra: best.extra, near: near && near.m <= 20 ? near : null, days: i, logic: best.x.logic, lunch: best.x.lunch }); } }
  const score = (r) => (o.urgent ? r.days * 1000 + bkMin(r.start) : r.extra + r.days * 1.5 - (r.near ? 25 : 0));
  return res.sort((a, b) => score(a) - score(b)).slice(0, 8);
}
function bkExtraDrive(sid, date, o, start, stops) { // how much more driving this appointment adds to that person's day
  const t = Bk.type(o.type); const loc = t.where === 'farm' ? Travel.stopPt(stops[0]) : t.where === 'base' ? Travel.home() : null; const locOut = t.where === 'farm' ? Travel.stopPt(stops[stops.length - 1]) : loc;
  const base = bkDay(sid, date, { skipId: o.skipId }).legs.reduce((a, l) => a + l.need, 0); const s = bkMin(start);
  const withIt = bkDay(sid, date, { skipId: o.skipId, add: { s, e: s + o.mins, loc, locOut } }).legs.reduce((a, l) => a + l.need, 0);
  return Math.max(0, withIt - base);
}

/* ---------------- tidy up a day after a cancellation or a move: bring later appointments forward ---------------- */
function bkTidy(staffIds, date, skipId) { // → [{ b, from, to }] — later appointments that could start earlier (each stays put until the client agrees)
  const moves = {}; const out = [];
  const later = [...new Set(staffIds.flatMap((sid) => Bk.bookingsFor(date, sid)))].filter((b) => b.id !== skipId && !b.proposal && !Bk.done(b) && date >= bkToday()).sort((a, b) => a.start.localeCompare(b.start));
  for (const b of later) {
    let best = null;
    for (const sid of b.staff || []) { const sl = bkSlots(sid, date, { type: b.type, stops: Bk.stops(b), mins: b.mins, skipId: b.id }).filter((x) => !x.lunchOut && x.lunch == null).map((x) => bkMin(x.start)).filter((m) => m < bkMin(b.start)); if (!sl.length) { best = null; break; } const m = Math.min(...sl); best = best == null ? m : Math.max(best, m); }
    if (best == null || bkMin(b.start) - best < 15) continue;
    const ok = (b.staff || []).every((sid) => { const d = bkDay(sid, date, { skipId: b.id, moves, add: { s: best, e: best + b.mins, loc: Travel.loc(b), locOut: Travel.locOut(b) } }); return !d.items.some((x) => x.kind !== 'new' && x.kind !== 'lunch' && x.s < best + b.mins && x.e > best) && !d.legs.some((l) => l.start < l.prevEnd); });
    if (!ok) continue;
    moves[b.id] = best; out.push({ b, from: b.start, to: bkHHMM(best) });
  }
  return out;
}

/* ---------------- the Scheduling change log: every change to appointments, blocks, the roster and Scheduling settings, with undo ---------------- */
const BKLOG = { snap: null };
const bkPlain = (r) => { const o = {}; Object.keys(r).forEach((k) => { if (!k.startsWith('_')) o[k] = r[k]; }); return o; };
const bkLogKinds = BOOK_KINDS.filter((k) => k !== 'bklog');
function bkLogInit() { BKLOG.snap = new Map(); bkLogKinds.forEach((k) => (D[k] || []).forEach((r) => BKLOG.snap.set(k + ':' + r.id, stable(bkPlain(r))))); }
function bkLogCapture() { // called on every save: anything changed on this device since the last save is written to the log
  if (!D || !Array.isArray(D.contacts)) return; if (!BKLOG.snap) { bkLogInit(); return; }
  const items = [];
  bkLogKinds.forEach((k) => (D[k] || []).forEach((r) => { const key = k + ':' + r.id; const now = stable(bkPlain(r)); const was = BKLOG.snap.get(key);
    if (was === now) return; BKLOG.snap.set(key, now); if (!r._dirty || BK._quiet) return; // pulled from another device, or the starting settings
    items.push({ k, id: r.id, before: was ? JSON.parse(was) : null, after: JSON.parse(now) }); }));
  if (!items.length) return;
  const e = { id: uid('lg'), at: Date.now(), by: window.SBAuth && SBAuth.staff ? SBAuth.staff.id : null, dev: typeof deviceName === 'function' ? deviceName() : '', label: BK._logLabel || bkLogLabel(items), items };
  if (BK._logOf) { e.undoOf = BK._logOf.id; e.dir = BK._logOf.dir; }
  BK._logLabel = null; BK._logOf = null; touch(e); Bk.list('bklog').push(e);
  const cut = Date.now() - 400 * 864e5; D.bklog.forEach((x) => { if (x.at < cut && !x.gone) { x.gone = true; touch(x); } }); // keep about a year
}
function bkLogLabel(items) {
  const one = (it) => { const a = it.after, b = it.before;
    if (it.k === 'bookings') { const nm = Bk.who(a) + ' — ' + bkDate(a.date) + ' ' + (a.start ? bkTime(a.start) : '');
      if (!b) return 'New appointment: ' + nm; if (a.status === 'cancelled' && b.status !== 'cancelled') return 'Cancelled: ' + nm; if (a.gone && !b.gone) return 'Removed: ' + nm;
      if (a.date !== b.date || a.start !== b.start) return `Moved: ${Bk.who(a)} — ${bkDate(b.date)} ${bkTime(b.start)} → ${bkDate(a.date)} ${bkTime(a.start)}`;
      if (a.proposal && !b.proposal) return `New time suggested: ${Bk.who(a)} — ${bkDate(a.proposal.date)} ${bkTime(a.proposal.start)}`;
      if (a.status !== b.status) return `${Bk.statusText(a)}: ${nm}`; return 'Changed: ' + nm; }
    if (it.k === 'blocks') { if (a.lunch) return `Lunch: ${Bk.pname((a.staff || [])[0])} ${bkDate(a.date)} ${a.gone ? 'removed' : bkTime(a.start)}`; const nm = Bk.btype(a.type).name + (a.of ? ' on ' + bkDate(a.occ) : '');
      if (a.of) return (a.gone && !(b && b.gone) ? 'Back to normal: ' : 'Changed block: ') + nm + ' (that day only)';
      return (!b ? 'New block: ' : a.gone && !b.gone ? 'Deleted block: ' : 'Changed block: ') + nm; }
    if (it.k === 'oncall') return `On call ${bkDate(a.id)}: ${b && b.who ? Bk.pname(b.who) + ' → ' : ''}${a.who ? Bk.pname(a.who) : a.who === null ? 'nobody' : 'back to the pattern'}`;
    if (it.k === 'bkcfg') return `${a.cfg === 'staff' ? 'Hours' : a.cfg === 'dayloc' ? 'Start / finish place' : a.cfg === 'ocpat' ? 'On-call pattern' : 'Setting'}: ${a.name || a.id}`;
    return 'Changed ' + it.k; };
  return items.length === 1 ? one(items[0]) : `${one(items[0])} (+${items.length - 1} more change${items.length === 2 ? '' : 's'})`;
}
function bkLogFind(k, id) { return (D[k] || []).find((r) => r.id === id); }
function bkLogApply(e, dir) { // dir 'undo' puts back what was there before; 'redo' does the change again
  e.items.forEach((it) => { const want = dir === 'undo' ? it.before : it.after; let r = bkLogFind(it.k, it.id);
    if (!want) { if (r) { r.gone = true; if (it.k === 'bookings') r.status = 'cancelled'; touch(r); } return; }
    if (!r) { r = bkClone(want); D[it.k].push(r); } else { Object.keys(r).forEach((x) => { if (!x.startsWith('_')) delete r[x]; }); Object.assign(r, bkClone(want)); }
    touch(r); });
}
function bkLogChangedSince(e, dir) { return e.items.filter((it) => { const r = bkLogFind(it.k, it.id); const cur = r ? stable(bkPlain(r)) : null; const exp = dir === 'undo' ? it.after : it.before; return (exp ? stable(exp) : null) !== cur; }); }
window.bkLogInit = bkLogInit; window.bkLogCapture = bkLogCapture;
