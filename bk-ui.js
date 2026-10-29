/* Bovitech Super App — Scheduling, part 2 of 4: the screens.
   Calendar (day / week / month, a column per person that can be switched on and off, swipe to change day),
   the Scheduling jobs list, the Scheduling change log, Settings → Scheduling, the business page Scheduling card,
   the colour picker and the look of everything. */
'use strict';

/* ---------------- calendar ---------------- */
const BK_START = 0, BK_END = 24 * 60, BK_PX = 1.1, BK_SCROLL_TO = 7 * 60; // the whole day (after-hours work too), pixels per minute; opens at about 7am
function bkColumns(date) { const hid = Bk.hidden(); return Bk.people().filter((s) => !hid.has(s.id) && (BK.showAll || Bk.hours(s, date) || Bk.bookingsFor(date, s.id).length)); }
function bkLookStyle(item, typeRec) { const l = Bk.look(item, typeRec); return { cls: 'pat-' + l.pattern, c: l.colour }; }
function bkRender() {
  Bk.seed();
  if (BK.page === 'settings') BK.page = 'cal'; // the Scheduling settings live in Settings → Scheduling
  if (BK.page === 'followups') BK.page = 'cal'; // follow-ups come back with clinical records
  if (BK.page === 'jobs') return bkJobsHtml();
  if (BK.page === 'roster') return bkRosterHtml();
  if (BK.page === 'log') return bkLogHtml();
  const hid = Bk.hidden();
  const head = `<div class="bk-top">
    <div class="bk-nav"><button class="btn small" data-act="bk-go" data-v="-1" aria-label="Back">‹</button><button class="btn small" data-act="bk-today">Today</button><button class="btn small" data-act="bk-go" data-v="1" aria-label="Forward">›</button>
      <input type="date" id="bk-date" value="${BK.date}" data-act="bk-date" aria-label="Date"><b class="bk-title">${bkTitle()}</b></div>
    <div class="bk-nav"><span class="bk-seg">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([v, l]) => `<button class="btn small ${BK.view === v ? 'on' : ''}" data-act="bk-view" data-v="${v}">${l}</button>`).join('')}</span>
      ${Bk.can('book') ? '<button class="btn small primary" data-act="bk-new">➕ Appointment</button>' : ''}${Bk.can('blocks') ? '<button class="btn small" data-act="bk-newblock">➕ Block</button>' : ''}</div></div>
  ${BK.view !== 'month' ? `<div class="bk-people">${Bk.people().map((s) => { const off = BK.view === 'day' && !Bk.hours(s, BK.date); return `<label class="bk-pp ${off ? 'off' : ''}" title="Show or hide ${h(s.preferred_name || s.full_name)} on this device"><input type="checkbox" data-act="bk-person" data-staff="${s.id}" ${hid.has(s.id) ? '' : 'checked'}> ${h(s.preferred_name || s.full_name)}${off ? ' <span class="hint">off</span>' : ''}</label>`; }).join('')}</div>` : ''}`;
  const body = BK.view === 'month' ? bkMonthHtml() : BK.view === 'week' ? bkWeekHtml() : bkDayHtml();
  if (BK.view === 'day') setTimeout(() => { const el = document.querySelector('.bk-dayscroll.v'); if (!el) return; el.scrollTop = BK._yDate === BK.date && BK._y != null ? BK._y : Math.max(0, (BK_SCROLL_TO - BK_START) * BK_PX - 6); BK._yDate = BK.date;
    el.onscroll = () => { BK._y = el.scrollTop; BK._yDate = BK.date; }; }, 0);
  return `<div class="d-wrap bk-wrap">${head}${body}<label class="bk-opt"><input type="checkbox" data-act="bk-showall" ${BK.showAll ? 'checked' : ''}> Show everyone ticked above, even on days they don't work (to make them available)</label><div class="hint" style="margin-top:4px">Swipe left or right to change ${BK.view === 'month' ? 'month' : BK.view === 'week' ? 'week' : 'day'}.</div></div>`;
}
function bkTitle() {
  if (BK.view === 'day') return bkDate(BK.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (BK.view === 'week') { const a = bkWeekStart(BK.date), b = bkAdd(a, 6); return `${bkDate(a, { day: 'numeric', month: 'short' })} – ${bkDate(b, { day: 'numeric', month: 'short', year: 'numeric' })}`; }
  return new Date(BK.date + 'T12:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}
function bkOncallText(date, short) { const w = bkOncallWho(date); if (!w) return short ? '' : '<span class="bk-warn">On call not set</span>'; return short ? Bk.pini(w) : `${h(Bk.pname(w))} (midnight to midnight)`; }
function bkDayHtml() {
  const date = BK.date, cols = bkColumns(date);
  const hrs = []; for (let m = BK_START; m <= BK_END; m += 60) hrs.push(m);
  const H = (BK_END - BK_START) * BK_PX;
  const y = (m) => ((typeof m === 'number' ? m : bkMin(m)) - BK_START) * BK_PX;
  const colHtml = (s) => {
    const c = Bk.scfg(s); const day = bkDay(s.id, date); const hrsOn = day.hr;
    let shade = '';
    if (!hrsOn) shade = `<div class="bk-off" style="top:0;height:${H}px"><span>${c.mode === 'locum' ? 'Not available' : 'Not working'}</span></div>`;
    else { shade = `<div class="bk-off" style="top:0;height:${Math.max(0, y(hrsOn[0]))}px"></div><div class="bk-off" style="top:${y(hrsOn[1])}px;height:${Math.max(0, H - y(hrsOn[1]))}px"></div>`;
      if (c.endBuffer) shade += `<div class="bk-buffer" style="top:${y(bkMin(hrsOn[1]) - c.endBuffer)}px;height:${c.endBuffer * BK_PX}px"><span>Records &amp; restock</span></div>`; }
    const parts = day.items.map((it) => {
      if (it.kind === 'block') { const b = it.ref, bt = Bk.btype(b.type), lk = bkLookStyle(b, bt);
        return `<div class="bk-block ${lk.cls}" data-act="bk-openblock" data-id="${b.id}" data-day="${date}" style="top:${y(it.s)}px;height:${Math.max(14, (it.e - it.s) * BK_PX)}px;--c:${lk.c}"><b>${h(bt.name)}</b>${b.note ? ' · ' + h(b.note) : ''}${b.of ? ' <span class="hint">(this day only)</span>' : ''}</div>`; }
      if (it.kind === 'lunch') { const bt = Bk.btype('bt-lunch'), lk = bkLookStyle(null, bt.id ? bt : { colour: '#c2884a', pattern: 'dots' });
        return `<div class="bk-block bk-lunch ${lk.cls}" data-act="bk-lunch" data-staff="${s.id}" data-day="${date}" style="top:${y(it.s)}px;height:${Math.max(14, (it.e - it.s) * BK_PX)}px;--c:${lk.c}"><b>🥪 Lunch</b> ${bkTime(it.s)}${it.ref.virtual ? '' : ''}</div>`; }
      if (it.kind === 'appt') { const b = it.ref, t = Bk.type(b.type), lk = bkLookStyle(b, t);
        const lunchIn = b.lunch && b.lunch.start ? `<div class="bk-inlunch" style="top:${(bkMin(b.lunch.start) - it.s) * BK_PX}px;height:${Bk.lunchCfg().mins * BK_PX}px">🥪 lunch</div>` : '';
        return `<div class="bk-appt ${lk.cls} ${Bk.unconf(b) ? 'unconf' : ''} ${Bk.done(b) ? 'done' : ''} ${b.urgent ? 'urgent' : ''}" data-act="bk-open" data-id="${b.id}" style="top:${y(it.s)}px;height:${Math.max(18, b.mins * BK_PX)}px;--c:${lk.c}">${lunchIn}
        <div class="bk-at">${bkTime(it.s)}–${bkTime(it.e)} · ${h(t.name)} · <i>${h(Bk.statusText(b))}</i>${b.series ? ' 🔁' : ''}</div>
        <div class="bk-aw">${b.urgent ? '⚡ ' : ''}${h(Bk.who(b))}${Bk.farmName(b) ? ' — ' + h(Bk.farmName(b)) : ''}</div><div class="bk-as">${h(Bk.svcText(b, s.id))}${(b.pids || []).length ? ' · ' + h(Bk.pidText(b)) : ''}${(b.staff || []).length > 1 ? ' · with ' + b.staff.filter((x) => x !== s.id).map(Bk.pname).join(', ') : ''}</div></div>`; }
      if (it.kind === 'held') { const b = it.ref; return `<div class="bk-prop" data-act="bk-open" data-id="${b.id}" style="top:${y(it.s)}px;height:${Math.max(18, (it.e - it.s) * BK_PX)}px"><b>Held — reschedule pending approval</b><br>${h(Bk.who(b))} · waiting for the client (from ${bkDate(b.date)} ${bkTime(b.start)})</div>`; }
      return ''; }).join('');
    const legs = day.legs.map((l) => { const bad = l.start < l.prevEnd; const top = Math.max(l.start, l.prevEnd); return `<div class="bk-drive ${bad ? 'bad' : ''} ${l.home ? 'home' : ''}" style="top:${y(top)}px;height:${Math.max(12, (l.end - top) * BK_PX)}px"><span>🚗 ~${l.need} min ${l.home ? 'back to ' + h(l.to) : 'from ' + h(l.from)}${bad ? ' — not enough time' : ''}</span></div>`; }).join('');
    return `<div class="bk-col" data-staff="${s.id}" style="height:${H}px">${shade}${legs}${parts}</div>`;
  };
  if (!cols.length) return `<div class="card bk-empty">Nobody ticked above is working on ${bkDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}.${Bk.people().length ? ' Tick "Show everyone" below to book anyway, or to make someone available.' : ' The staff list loads the first time you sign in with internet.'}<div class="hint" style="margin-top:6px">On call: ${bkOncallText(date)}</div></div>`;
  return `<div class="bk-oncall" data-act="bk-page" data-v="roster">📟 On call: ${bkOncallText(date)}</div>
  <div class="bk-dayscroll v"><div class="bk-day" style="grid-template-columns:44px repeat(${cols.length}, minmax(150px, 1fr))">
    <div class="bk-colh bk-corner"></div>${cols.map((s, ci) => { const hr = Bk.hours(s, date); const usual = Bk.usualHours(s, date); const c = Bk.scfg(s); const dl = bkDayLoc(s.id, date); const swapped = !!(c.availDates[date] || c.offDates[date]);
      return `<div class="bk-colh" draggable="true" data-colstaff="${s.id}"><div class="bk-colord">${ci ? `<button class="btn small" data-act="bk-colmove" data-staff="${s.id}" data-v="-1" aria-label="Move ${h(s.preferred_name || s.full_name)} left" title="Move left">‹</button>` : ''}<b>${h(s.preferred_name || s.full_name)}</b>${ci < cols.length - 1 ? `<button class="btn small" data-act="bk-colmove" data-staff="${s.id}" data-v="1" aria-label="Move ${h(s.preferred_name || s.full_name)} right" title="Move right">›</button>` : ''}</div>
      <span class="hint">${hr ? `${bkTime(hr[0])}–${bkTime(hr[1])}` : c.mode === 'locum' ? 'locum — not available' : 'not working'}${swapped ? ' (this day only)' : ''}${dl.changed ? ` · 📍 ${h(dl.startName)}` : ''}</span>
      <button class="btn small" data-act="bk-colmenu" data-staff="${s.id}">${hr ? '⚙ This day' : usual || c.mode === 'locum' ? '➕ Make available' : '➕ Make available'}</button></div>`; }).join('')}
    <div class="bk-times" style="height:${H}px">${hrs.map((m) => `<span style="top:${(m - BK_START) * BK_PX}px">${bkTime(bkHHMM(m))}</span>`).join('')}</div>
    ${cols.map(colHtml).join('')}
  </div></div>`;
}
function bkWeekHtml() {
  const a = bkWeekStart(BK.date), days = [...Array(7)].map((_, i) => bkAdd(a, i)); const hid = Bk.hidden();
  const ppl = Bk.people().filter((s) => !hid.has(s.id) && (BK.showAll || days.some((d) => Bk.hours(s, d) || Bk.bookingsFor(d, s.id).length)));
  return `<div class="bk-dayscroll"><table class="bk-week"><thead><tr><th></th>${days.map((d) => `<th class="${d === bkToday() ? 'today' : ''}"><button class="lnk" data-act="bk-openday" data-v="${d}">${bkDate(d)}</button><div class="hint">📟 ${bkOncallText(d, true) || '—'}</div></th>`).join('')}</tr></thead>
  <tbody>${ppl.map((s) => `<tr><th>${h(s.preferred_name || s.full_name)}</th>${days.map((d) => { const hr = Bk.hours(s, d); const bl = Bk.blocksFor(d, s.id).filter((b) => b.type !== 'bt-meeting'); const bs = Bk.bookingsFor(d, s.id), ps = Bk.proposalsFor(d, s.id);
    return `<td class="${hr ? '' : 'off'}" data-act="bk-openday" data-v="${d}">${bl.map((b) => { const lk = bkLookStyle(b, Bk.btype(b.type)); return `<div class="bk-chip blk ${lk.cls}" style="--c:${lk.c}">${h(Bk.btype(b.type).name)}</div>`; }).join('')}${bs.map((b) => { const lk = bkLookStyle(b, Bk.type(b.type)); return `<div class="bk-chip ${lk.cls} ${Bk.unconf(b) ? 'unconf' : ''}" style="--c:${lk.c}" data-act="bk-open" data-id="${b.id}">${bkTime(b.start)} ${h(Bk.who(b))}</div>`; }).join('')}${ps.map((b) => `<div class="bk-chip held" data-act="bk-open" data-id="${b.id}">Held ${bkTime(b.proposal.start)} ${h(Bk.who(b))}</div>`).join('')}${!hr && !bs.length ? '<span class="hint">off</span>' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function bkMonthHtml() {
  const first = BK.date.slice(0, 8) + '01', start = bkWeekStart(first); const days = [...Array(42)].map((_, i) => bkAdd(start, i));
  const m = first.slice(0, 7);
  return `<div class="bk-month">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="bk-mh">${d}</div>`).join('')}${days.map((d) => { const bs = Bk.list('bookings').filter((b) => Bk.live(b) && b.date === d); const un = bs.filter(Bk.unconf).length; const oc = bkOncallText(d, true);
    return `<button class="bk-md ${d.slice(0, 7) === m ? '' : 'other'} ${d === bkToday() ? 'today' : ''}" data-act="bk-openday" data-v="${d}"><span class="n">${+d.slice(8)}</span>${bs.length ? `<span class="c">${bs.length} appt${bs.length === 1 ? '' : 's'}${un ? ` · ${un} unconf.` : ''}</span>` : ''}<span class="o">${oc ? '📟 ' + h(oc) : ''}</span></button>`; }).join('')}</div>`;
}
/* swipe left / right on the calendar to change day (week, month) — unless the columns are being scrolled sideways */
(function () {
  let sx = 0, sy = 0, t0 = 0, sc = null;
  document.addEventListener('touchstart', (e) => { if (typeof S === 'undefined' || S.tab !== 'book' || BK.page !== 'cal' || e.touches.length !== 1) return; if (e.target.closest('input,select,textarea,.sheet-bg,#askbox')) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = Date.now(); sc = e.target.closest('.bk-dayscroll'); sc = sc ? { el: sc, left: sc.scrollLeft } : null; }, { passive: true });
  document.addEventListener('touchend', (e) => { if (!t0) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy, dt = Date.now() - t0; t0 = 0;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || dt > 700) return;
    if (sc) { const el = sc.el; const max = el.scrollWidth - el.clientWidth; if (max > 4 && (Math.abs(el.scrollLeft - sc.left) > 4 || (dx < 0 && sc.left < max - 2) || (dx > 0 && sc.left > 2))) return; } // they were scrolling the columns
    bkGo(dx < 0 ? 1 : -1); }, { passive: true });
})();
function bkGo(n) { BK.date = BK.view === 'month' ? (() => { const x = new Date(BK.date + 'T12:00'); x.setDate(1); x.setMonth(x.getMonth() + n); return bkD(x); })() : bkAdd(BK.date, BK.view === 'week' ? 7 * n : n); renderAll(); }

/* ---------------- Scheduling jobs list ---------------- */
function bkJobs() {
  if (!D || !Bk.list) return []; const t = bkToday(), soon = bkAdd(t, 7), fort = bkAdd(t, 14); const out = [];
  const live = Bk.list('bookings').filter((b) => Bk.live(b) && b.date >= t && !Bk.done(b));
  live.forEach((b) => {
    if (b.sms && b.sms.send && !b.sms.booked && !b.sms.skip && !Bk.smsOk(Bk.smsKey('booked:' + b.id))) out.push({ k: 'sms', b, t: 'Booking SMS not sent', d: `${bkDate(b.date)} ${bkTime(b.start)} — ${Bk.who(b)}${b.cid ? '' : ' (no one chosen to text)'}` });
    if (b.proposal && !b.proposal.smsSent && !b.proposal.smsSkip && !Bk.smsOk(Bk.smsKey(`proposal:${b.id}:${b.proposal.at}`))) out.push({ k: 'psms', b, t: 'New-time SMS not sent', d: `${Bk.who(b)}: suggested ${bkDate(b.proposal.date)} ${bkTime(b.proposal.start)}` });
    if (b.proposal) out.push({ k: 'prop', b, t: 'Reschedule pending approval', d: `${Bk.who(b)}: ${bkDate(b.date)} ${bkTime(b.start)} → ${bkDate(b.proposal.date)} ${bkTime(b.proposal.start)} (held since ${new Date(b.proposal.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })})` });
    if (Bk.unconf(b) && b.date <= soon) out.push({ k: 'unconf', b, t: 'Unconfirmed — within a week', d: `${bkDate(b.date)} ${bkTime(b.start)} — ${Bk.who(b)}` });
    if (b.date <= fort) { const pr = bkProblems(b); if (pr.length) out.push({ k: 'clash', b, t: 'Check this appointment', d: `${bkDate(b.date)} ${bkTime(b.start)} — ${Bk.who(b)}: ${pr[0]}${pr.length > 1 ? ` (+${pr.length - 1} more)` : ''}` }); }
  });
  Bk.list('bookings').filter((b) => Bk.live(b) && b.date < t && b.date >= bkAdd(t, -30) && !Bk.done(b) && b.status === 'confirmed').forEach((b) => out.push({ k: 'past', b, t: 'Past appointment not marked completed', d: `${bkDate(b.date)} ${bkTime(b.start)} — ${Bk.who(b)}` }));
  for (let i = 0; i < 14; i++) { const d = bkAdd(t, i); if (!bkOncallWho(d)) out.push({ k: 'oncall', d0: d, t: 'On call not set', d: bkDate(d, { weekday: 'long', day: 'numeric', month: 'short' }) }); }
  ((D && D.smsLog) || []).forEach((x) => {
    if (x.kind === 'reply' && !x.handled) out.push({ k: 'reply', x, t: 'SMS reply', d: `${bkSmsWho(x)}: “${(x.body || '').slice(0, 160)}” · ${new Date(x.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` });
    if (x.status === 'failed' && x.kind !== 'reply' && Date.now() - Date.parse(x.at) < 14 * 864e5) out.push({ k: 'smsfail', x, b: x.booking_id ? bkRec(x.booking_id) : null, t: 'SMS failed', d: `${({ booked: 'Booking made', reminder: 'Reminder', proposal: 'New time', manual: 'Text' })[x.kind] || 'Text'} to ${bkSmsWho(x)}: ${x.error || 'not delivered'}` });
  });
  return out;
}
const BK_JOB_NAMES = { reply: 'SMS replies', smsfail: 'SMS failed', sms: 'Booking SMS not sent', psms: 'New-time SMS not sent', prop: 'Reschedule pending approval', unconf: 'Unconfirmed this week', clash: 'Clashes, travel and rules', past: 'Past — mark completed', oncall: 'On call not set' };
function bkJobsHtml() {
  const all = bkJobs(); const q = (BK.jobFilter || '').toLowerCase(); const list = all.filter((j) => !q || (j.t + ' ' + j.d).toLowerCase().includes(q));
  const vets = Bk.people().filter((s) => s.role === 'vet');
  const btns = (j) => { const b = j.b; switch (j.k) {
    case 'sms': return `<button class="btn small" data-act="bkj-smsdone" data-id="${b.id}">Mark as sent</button><button class="btn small" data-act="bkj-smsskip" data-id="${b.id}">Don't send</button>`;
    case 'psms': return `<button class="btn small" data-act="bkj-psmsdone" data-id="${b.id}">Mark as sent</button><button class="btn small" data-act="bkj-psmsskip" data-id="${b.id}">Don't send</button>`;
    case 'prop': return `<button class="btn small primary" data-act="bkj-propyes" data-id="${b.id}">Client agreed — move</button><button class="btn small" data-act="bkj-propno" data-id="${b.id}">Client said no</button>`;
    case 'unconf': return `<button class="btn small primary" data-act="bkj-confirm" data-id="${b.id}">✓ Confirmed</button>`;
    case 'clash': return `<button class="btn small" data-act="bkj-suggest" data-id="${b.id}">🔎 Find a better time</button>`;
    case 'past': return `<button class="btn small primary" data-act="bkj-done" data-id="${b.id}">✓ Completed</button>`;
    case 'oncall': return `<select data-act="bk-oc" data-d="${j.d0}" ${Bk.can('roster') ? '' : 'disabled'} aria-label="On call ${j.d}"><option value="">Choose…</option>${vets.map((s) => `<option value="${s.id}">${h(s.preferred_name || s.full_name)}</option>`).join('')}</select>`;
    case 'smsfail': return `<button class="btn small primary" data-act="bkj-smsretry" data-id="${j.x.id}">Try again</button>`;
    case 'reply': { const x = j.x; const mine = Bk.list('bookings').filter((b) => Bk.live(b) && b.date >= bkToday() && ((x.contact_id && b.cid === x.contact_id) || (x.business_id && b.bid === x.business_id))).sort((a, c) => a.date.localeCompare(c.date));
      const un = mine.find(Bk.unconf), pr = mine.find((b) => b.proposal);
      return `${pr ? `<button class="btn small primary" data-act="bkj-replyprop" data-id="${pr.id}" data-sms="${x.id}">✓ Agree new time (${bkDate(pr.proposal.date)})</button>` : ''}${un && !pr ? `<button class="btn small primary" data-act="bkj-replyconf" data-id="${un.id}" data-sms="${x.id}">✓ Confirm ${bkDate(un.date)} appointment</button>` : ''}<button class="btn small" data-act="bk-text" data-cid="${x.contact_id || ''}" data-bid="${x.business_id || ''}" data-phone="${h(x.phone || '')}">Reply…</button><button class="btn small" data-act="bkj-replydone" data-sms="${x.id}">Done</button>`; }
  } return ''; };
  const groups = Object.keys(BK_JOB_NAMES).map((k) => [k, list.filter((j) => j.k === k)]).filter(([, l]) => l.length);
  return `<div class="d-wrap bk-wrap"><div class="bk-top"><div class="bk-nav"><b class="bk-title">Scheduling jobs</b></div></div>
  ${bkAiCard('jobs')}<div class="search" style="margin-bottom:8px"><input id="bkj-q" placeholder="Search jobs" value="${h(BK.jobFilter || '')}" data-act="bkj-q"></div>
  ${groups.length ? groups.map(([k, l]) => `<details class="card bk-jobs" open><summary><b>${BK_JOB_NAMES[k]}</b> <span class="badge">${l.length}</span></summary>${l.map((j) => `<div class="bk-job"><div class="v"><div>${h(j.d)}</div></div><div class="actions">${btns(j)}${j.b ? `<button class="btn small" data-act="bk-open" data-id="${j.b.id}">Open</button>` : ''}</div></div>`).join('')}</details>`).join('') : '<div class="card"><div class="hint">Nothing to do — all appointments are sorted.</div></div>'}
  <div class="hint">Texts go from the office phone automatically once it's set up (see the manual). If a text was sent another way, use "Mark as sent".</div></div>`;
}

/* ---------------- the Scheduling change log ---------------- */
function bkLogHtml() {
  const q = (BK.logQ || '').toLowerCase(); const all = Bk.list('bklog').filter((e) => !e.gone).sort((a, b) => b.at - a.at);
  const txt = (e) => `${e.label} ${e.by ? Bk.pname(e.by) : ''} ${e.dev || ''} ${new Date(e.at).toLocaleString('en-AU')}`.toLowerCase();
  const list = all.filter((e) => !q || txt(e).includes(q)).slice(0, 300); const ed = Bk.can('book');
  const det = (it) => { const a = it.after || {}, b = it.before || {}; const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !['_u', '_dev', '_rev'].includes(k) && stable(a[k]) !== stable(b[k]));
    const show = (v) => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v).slice(0, 140) : String(v));
    return keys.slice(0, 12).map((k) => `<div class="hint">${h(k)}: ${h(show(b[k]))} → <b>${h(show(a[k]))}</b></div>`).join('') || '<div class="hint">Created</div>'; };
  return `<div class="d-wrap bk-wrap"><div class="bk-top"><div class="bk-nav"><b class="bk-title">Scheduling change log</b></div></div>
  <div class="hint" style="margin-bottom:8px">Every change to appointments, blocks, lunch breaks, the on-call roster and Scheduling settings, on every device, with who made it. <b>↶ Undo</b> puts things back as they were; <b>↷ Redo</b> does the change again. Contacts changes are in Settings → General → Change log.</div>
  <div class="search" style="margin-bottom:8px"><input id="bklog-q" placeholder="Search the change log (name, person, date…)" value="${h(BK.logQ || '')}"></div>
  <div class="card">${list.map((e) => `<div class="kv bk-logrow ${e.undone ? 'undone' : ''}" style="align-items:flex-start"><div class="v"><b>${h(e.label)}</b>${e.undone ? ' <span class="hint">(undone)</span>' : ''}<br><span class="hint">${new Date(e.at).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · ${h(e.by ? Bk.pname(e.by) : 'someone')}${e.dev ? ' · ' + h(e.dev) : ''}</span>
    <details><summary class="hint" style="cursor:pointer">What changed (${e.items.length})</summary>${e.items.map((it) => `<div style="margin:4px 0">${det(it)}</div>`).join('')}</details></div>
    ${ed && !e.undoOf ? (e.undone ? `<button class="btn small" data-act="bklog-redo" data-id="${e.id}">↷ Redo</button>` : `<button class="btn small" data-act="bklog-undo" data-id="${e.id}">↶ Undo</button>`) : ''}</div>`).join('') || '<div class="hint">No changes yet.</div>'}</div></div>`;
}
document.addEventListener('input', (e) => { if (e.target.id !== 'bklog-q') return; BK.logQ = e.target.value; const pos = e.target.selectionStart; renderAll(); const q = document.getElementById('bklog-q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } });

/* ---------------- colour: palette, colours in use, and "Edit colours" like Windows 11 Paint ---------------- */
const BK_BASIC = ['#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
  '#2f7a55', '#3a6ea5', '#8a5a9e', '#b5791c', '#b42318', '#d97706', '#0f766e', '#64748b', '#7c8a6e', '#6f7fb0', '#a0782f', '#9a6b8a', '#9b5050', '#1f2937', '#c2884a'];
const bkHex = (v) => { v = String(v || '').trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) return ('#' + v.replace('#', '')).toLowerCase(); if (/^#?[0-9a-f]{3}$/i.test(v)) return ('#' + v.replace('#', '').split('').map((c) => c + c).join('')).toLowerCase(); return null; };
const bkRgb = (hex) => { const x = parseInt(hex.slice(1), 16); return [(x >> 16) & 255, (x >> 8) & 255, x & 255]; };
const bkToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function bkHsv2rgb(h0, s, v) { const f = (n) => { const k = (n + h0 / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5) * 255, f(3) * 255, f(1) * 255]; }
function bkRgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h0 = 0; if (d) { h0 = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h0 *= 60; if (h0 < 0) h0 += 360; } return [h0, mx ? d / mx : 0, mx]; }
function bkUsedColours(selfId) { return Bk.list('bkcfg').filter((y) => !y.gone && (y.cfg === 'type' || y.cfg === 'blocktype') && y.colour && y.id !== selfId); }
function bkColourField(c, selfId, idp) { // idp: id prefix ('bc' in settings, 'lk' for one appointment's own look)
  idp = idp || 'bc'; const used = bkUsedColours(selfId);
  return `<div class="f bk-colfield" data-idp="${idp}"><label for="${idp}-colourtxt">Colour</label><div class="bk-hrow"><span class="bk-colnow" id="${idp}-colnow" style="--c:${h(c)}"></span><input type="hidden" id="${idp}-colour" value="${h(c)}"><input id="${idp}-colourtxt" value="${h(c)}" maxlength="7" style="max-width:110px;font-family:monospace" aria-label="Colour code" autocomplete="off" spellcheck="false"><button type="button" class="btn small" data-act="bk-editcol" data-idp="${idp}">🎨 Edit colours…</button></div>
    <div class="bk-palette">${BK_BASIC.map((x) => `<button type="button" class="bk-sw dot" data-act="bks-colour" data-idp="${idp}" data-c="${x}" style="--c:${x}" aria-label="${x}" title="${x}"><span></span></button>`).join('')}</div>
    ${used.length ? `<div class="hint" style="margin-top:6px">Already used — tap to use the same:</div><div class="bk-swrow">${used.map((y) => `<button type="button" class="bk-sw" data-act="bks-colour" data-idp="${idp}" data-c="${h(y.colour)}" style="--c:${h(y.colour)}" title="${h(y.name)} ${h(y.colour)}"><span></span>${h(y.name)}</button>`).join('')}</div>` : ''}</div>`;
}
function bkSetColour(idp, c) { const a = document.getElementById(idp + '-colour'), b = document.getElementById(idp + '-colourtxt'), n = document.getElementById(idp + '-colnow'); if (a) a.value = c; if (b && b.value !== c) b.value = c; if (n) n.style.setProperty('--c', c); document.querySelectorAll(`.bk-patdemo[data-idp="${idp}"]`).forEach((d) => d.style.setProperty('--c', c)); }
document.addEventListener('input', (e) => { const m = /^(\w+)-colourtxt$/.exec(e.target.id || ''); if (!m) return; const c = bkHex(e.target.value); if (c) bkSetColour(m[1], c); });
function bkColourDialog(start) { // the "Edit colours" window: spectrum square, brightness slider, red / green / blue, hue / saturation / value, colour code
  return new Promise((res) => {
    let [hu, sa, va] = bkRgb2hsv(...bkRgb(bkHex(start) || '#3a6ea5'));
    askBox('Edit colours', `<div class="bk-cdlg"><div class="bk-cspec-wrap"><canvas id="cd-spec" width="260" height="200" class="bk-cspec" aria-label="Colour spectrum"></canvas><div id="cd-dot" class="bk-cdot"></div></div>
      <input type="range" id="cd-val" min="0" max="100" class="bk-cval" aria-label="Brightness">
      <div class="bk-hrow" style="margin-top:8px"><span class="bk-colnow big" id="cd-new"></span><span class="hint">New</span><span class="bk-colnow big" style="--c:${h(start)}"></span><span class="hint">Current</span></div>
      <div class="grid2" style="margin-top:8px"><div class="f"><label>Red / Green / Blue</label><div class="bk-hrow">${['r', 'g', 'b'].map((k) => `<input type="number" min="0" max="255" id="cd-${k}" style="width:72px" aria-label="${({ r: 'Red', g: 'Green', b: 'Blue' })[k]}">`).join('')}</div></div>
        <div class="f"><label>Hue / Saturation / Value</label><div class="bk-hrow"><input type="number" min="0" max="359" id="cd-h" style="width:72px" aria-label="Hue"><input type="number" min="0" max="100" id="cd-s" style="width:72px" aria-label="Saturation"><input type="number" min="0" max="100" id="cd-v" style="width:72px" aria-label="Value"></div></div></div>
      <div class="f"><label for="cd-hex">Hex</label><input id="cd-hex" data-ask="hex" maxlength="7" style="max-width:120px;font-family:monospace" autocomplete="off" spellcheck="false"></div></div>`, 'Done', false, 'Cancel').then((ok) => res(ok ? bkHex(ASK_FORM.hex) : null));
    setTimeout(() => {
      const g = (id) => document.getElementById(id), cv = g('cd-spec'); if (!cv) return; const ctx = cv.getContext('2d');
      const paint = () => { const W = cv.width, Hh = cv.height; for (let x = 0; x < W; x += 2) { const hue = x / W * 360; const gr = ctx.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, `hsl(${hue},100%,50%)`); gr.addColorStop(1, '#ffffff'); ctx.fillStyle = gr; ctx.fillRect(x, 0, 2, Hh); } };
      const show = (from) => { const rgb = bkHsv2rgb(hu, sa, va), hex = bkToHex(...rgb);
        g('cd-new').style.setProperty('--c', hex); if (from !== 'hex') g('cd-hex').value = hex;
        if (from !== 'rgb') { g('cd-r').value = Math.round(rgb[0]); g('cd-g').value = Math.round(rgb[1]); g('cd-b').value = Math.round(rgb[2]); }
        if (from !== 'hsv') { g('cd-h').value = Math.round(hu); g('cd-s').value = Math.round(sa * 100); g('cd-v').value = Math.round(va * 100); }
        g('cd-val').value = Math.round(va * 100); g('cd-val').style.setProperty('--c', bkToHex(...bkHsv2rgb(hu, sa, 1)));
        const dot = g('cd-dot'); dot.style.left = (hu / 360 * cv.clientWidth) + 'px'; dot.style.top = ((1 - sa) * cv.clientHeight) + 'px'; };
      paint(); show();
      const pick = (e) => { const r = cv.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; hu = Math.max(0, Math.min(359.9, (p.clientX - r.left) / r.width * 360)); sa = Math.max(0, Math.min(1, 1 - (p.clientY - r.top) / r.height)); if (va < 0.05) va = 1; show(); };
      let down = false; cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); pick(e); }); cv.addEventListener('pointermove', (e) => { if (down) pick(e); }); cv.addEventListener('pointerup', () => { down = false; });
      g('cd-val').addEventListener('input', (e) => { va = +e.target.value / 100; show(); });
      ['r', 'g', 'b'].forEach((k) => g('cd-' + k).addEventListener('input', () => { [hu, sa, va] = bkRgb2hsv(+g('cd-r').value || 0, +g('cd-g').value || 0, +g('cd-b').value || 0); show('rgb'); }));
      ['h', 's', 'v'].forEach((k) => g('cd-' + k).addEventListener('input', () => { hu = (+g('cd-h').value || 0) % 360; sa = Math.min(1, (+g('cd-s').value || 0) / 100); va = Math.min(1, (+g('cd-v').value || 0) / 100); show('hsv'); }));
      g('cd-hex').addEventListener('input', (e) => { const c = bkHex(e.target.value); if (c) { [hu, sa, va] = bkRgb2hsv(...bkRgb(c)); show('hex'); } });
    }, 30);
  });
}
const BK_PATTERNS = [['light', 'Pale fill'], ['solid', 'Solid colour'], ['stripes', 'Stripes'], ['dots', 'Dots'], ['checks', 'Checks'], ['outline', 'Outline only']];
function bkPatternField(p, c, idp) { idp = idp || 'bc'; return `<div class="f"><label>Pattern on the calendar</label><div class="bk-swrow">${BK_PATTERNS.map(([v, l]) => `<label class="bk-patopt"><input type="radio" name="${idp}-pat" value="${v}" ${p === v ? 'checked' : ''}><span class="bk-patdemo pat-${v}" data-idp="${idp}" style="--c:${h(c)}"></span>${l}</label>`).join('')}</div></div>`; }
const bkPat = (x) => 'pat-' + ((x && x.pattern) || 'light');
function bkLookField(item, typeRec, idp) { // one appointment's or block's own look, or the default for its type
  const own = !!(item && item.look); const l = Bk.look(item, typeRec || {});
  return `<details class="bk-lookbox" ${own ? 'open' : ''}><summary class="hint" style="cursor:pointer">🎨 Appearance: ${own ? 'its own colour and pattern' : 'default for the type'}</summary>
    <label class="bk-radio" style="margin:6px 0"><input type="radio" name="${idp}-lookmode" value="def" ${own ? '' : 'checked'}> Default for the type</label><label class="bk-radio" style="margin:6px 0"><input type="radio" name="${idp}-lookmode" value="own" ${own ? 'checked' : ''}> Its own look:</label>
    ${bkColourField(l.colour, null, idp)}${bkPatternField(l.pattern, l.colour, idp)}</details>`;
}
function bkLookRead(idp) { const m = (document.querySelector(`input[name="${idp}-lookmode"]:checked`) || {}).value; if (m !== 'own') return null; return { colour: bkHex((document.getElementById(idp + '-colourtxt') || {}).value) || (document.getElementById(idp + '-colour') || {}).value || '#777777', pattern: (document.querySelector(`input[name="${idp}-pat"]:checked`) || {}).value || 'light' }; }
document.addEventListener('change', (e) => { const m = /^(\w+)-pat$/.exec(e.target.name || ''); if (!m) return; const own = document.querySelector(`input[name="${m[1]}-lookmode"][value=own]`); if (own) own.checked = true; });

/* ---------------- Settings → Scheduling ---------------- */
function bkWhoText(w) { w = w || {}; const l = [w.clientBiz && 'client businesses', w.nonclientBiz && 'non-client businesses', w.clientInd && 'client individuals', w.nonclientInd && 'non-client individuals'].filter(Boolean); return l.length ? 'for ' + l.join(', ') : 'no client'; }
function bkSettingsHtml() {
  const ed = Bk.can('settings'), adm = window.SBAuth && SBAuth.isAdmin(), ppl = Bk.people(); const lc = Bk.lunchCfg();
  const row = (x, extra) => `<div class="kv" style="align-items:center">${x.colour ? `<span class="bk-dot ${bkPat(x)}" style="--c:${x.colour}"></span>` : ''}<div class="v"><b>${h(x.name)}</b>${extra ? `<br><span class="hint">${extra}</span>` : ''}</div>${ed ? `<button class="btn small" data-act="bks-edit" data-id="${x.id}" aria-label="Edit ${h(x.name)}">✏️</button>` : ''}</div>`;
  const where = { farm: 'On a farm (travel worked out)', base: 'At homebase', phone: 'Phone — no travel' };
  return `<div class="bk-setwrap">
  ${ed ? '' : '<div class="hint" style="margin-bottom:8px">You can see these but not change them — ask the office.</div>'}
  <div class="card"><h3><span class="sp">Appointment types</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="type">➕ New</button>' : ''}</h3>${Bk.cfg('type').map((x) => row(x, `${where[x.where] || ''}${x.fixedMins ? ' · default ' + bkDur(x.fixedMins) : ' · length from the procedures'} · ${bkWhoText(x.who || BK_WHO_DEF)}`)).join('')}</div>
  <div class="card"><h3><span class="sp">Procedures</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="service">➕ New</button>' : ''}</h3><div class="hint" style="margin-bottom:6px">Per-head procedures work out the length from the head count — either at one rate for every farm, or at each farm's or yard's own rate (set on the business page, or by ticking "Remember the speed for these yards" on an appointment). Additional labour runs alongside the other procedures; everything else adds to the length.</div>${Bk.cfg('service').map((x) => row(x, (x.mode === 'perhead' ? (x.rateFrom === 'farm' ? `rate from each farm / yard${x.hph ? ` (usual ${x.hph} an hour)` : ''}` : `${x.hph} head an hour`) : `set time ${bkDur(+x.mins || 0)}`) + (x.setup ? ` + ${x.setup} min set-up and pack-up` : '') + (x.alongside ? ' · runs alongside the other procedures (doesn\'t add time)' : '') + (x.askLabour ? ' · asks about additional labour' : '') + (x.yard ? ` · counts as ${x.yard === 'preg' ? 'preg' : 'bull'} testing` : ''))).join('')}</div>
  <div class="card"><h3><span class="sp">Lunch breaks</span>${ed ? '<button class="btn small" data-act="bks-lunch">✏️</button>' : ''}</h3><div class="kv"><div class="v">${lc.on ? `<b>${lc.mins} min</b>, usually at ${bkTime(lc.def)}, anywhere between ${bkTime(lc.from)} and ${bkTime(lc.to)}` : 'Off'}<br><span class="hint">Everyone working gets one each day; it can be taken anywhere (no travel). Tap a lunch on the calendar to move it. Booking over it gives a warning, and the app moves it within ${bkTime(lc.from)}–${bkTime(lc.to)} when it can — moving it outside that asks first. Long appointments can have the lunch break inside them.</span></div></div></div>
  <div class="card"><h3>People — hours, phones and where they start</h3><div class="hint" style="margin-bottom:6px">Working hours, the time kept at the end of the day for records and restocking, mobile (for the on-call list), where they usually start the day, and locums (only bookable on days marked available). To swap a day, use ⚙ / ➕ Make available at the top of their column on the calendar.${adm ? '' : ' Only the admin can change what each person can be booked for.'}</div>
    ${ppl.map((s) => { const c = Bk.scfg(s); return `<div class="kv" style="align-items:center"><div class="v"><b>${h(s.preferred_name || s.full_name)}</b><br><span class="hint">${c.mode === 'locum' ? 'Locum — available on chosen days' : [1, 2, 3, 4, 5, 6, 0].filter((d) => c.hours[d]).map((d) => DOW_NAMES[d]).join(', ') + ' ' + (Object.values(c.hours)[0] ? `${bkTime(Object.values(c.hours)[0][0])}–${bkTime(Object.values(c.hours)[0][1])}` : '')}${c.endBuffer ? ` · ${c.endBuffer} min end of day` : ''} · ${c.canDo ? 'only ' + c.canDo.map((x) => Bk.svc(x).name).join(', ') : 'all procedures'}${c.mobile ? ' · ' + h(c.mobile) : ''} · starts at ${c.startFrom === 'home' && c.home ? 'home' : 'homebase'}</span></div>${ed || adm ? `<button class="btn small" data-act="bks-staff" data-id="${s.id}" aria-label="Edit ${h(s.preferred_name || s.full_name)}">✏️</button>` : ''}</div>`; }).join('') || '<div class="hint">The staff list loads when you are online and signed in.</div>'}</div>
  <div class="card"><h3><span class="sp">Block types</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="blocktype">➕ New</button>' : ''}</h3>${Bk.cfg('blocktype').map((x) => row(x, `${x.where === 'anywhere' ? 'anywhere (no travel)' : 'at homebase'} · ${bkWhoText(x.who || {})}`)).join('')}
    <div class="lbl" style="margin-top:8px">Blocks</div>${Bk.list('blocks').filter((b) => !b.gone && !b.lunch && !b.of).map((b) => { const lk = bkLookStyle(b, Bk.btype(b.type)); return `<div class="kv" style="align-items:center"><span class="bk-dot ${lk.cls}" style="--c:${lk.c}"></span><div class="v">${h(Bk.btype(b.type).name)}${b.note ? ' — ' + h(b.note) : ''}<br><span class="hint">${b.staff === 'all' ? 'Everyone' : b.staff.map(Bk.pname).join(', ')} · ${b.allDay ? 'all day' : bkTime(b.start) + '–' + bkTime(b.end)} · ${h(bkRuleText(b.repeat, b.date))}${b.on ? '' : ' · <b>off</b>'}</span></div>${Bk.can('blocks') ? `<label class="bk-radio"><input type="checkbox" data-act="bks-blockon" data-id="${b.id}" ${b.on ? 'checked' : ''}> On</label><button class="btn small" data-act="bk-openblock" data-id="${b.id}" aria-label="Edit block">✏️</button>` : ''}</div>`; }).join('')}</div>
  <div class="card"><h3><span class="sp">SMS templates</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="sms">➕ New</button>' : ''}</h3><div class="hint" style="margin-bottom:6px">Fill-ins: {first} {name} {business} {type} {day} {date} {time} {farm} {at_farm} {vet} {old_date}. Sent from the office phone: "booking made" within a few minutes of booking, reminders 5 days before at 8:30am, and new-time texts as soon as a new time is held.</div>${Bk.cfg('sms').map((x) => row(x, `${({ booked: 'Sent when an appointment is made', reminder: 'Reminder, 5 days before at 8:30am', proposal: 'When a new time is suggested', other: 'Sent by hand' })[x.use] || ''} · “${h((x.text || '').slice(0, 90))}${(x.text || '').length > 90 ? '…' : ''}”`)).join('')}</div>
  ${bkOcGoogleCard()}
  ${adm ? `<div class="card"><h3>Permissions (admin only)</h3><div class="hint" style="margin-bottom:6px">Everyone can do all of these to start with. Untick to stop someone.</div><div class="bk-dayscroll"><table class="bk-perm"><thead><tr><th></th>${BK_PERMS.map(([k, l]) => `<th>${h(l)}</th>`).join('')}</tr></thead><tbody>${ppl.map((s) => { const pr = ((Bk.get('perms') || {}).staff || {})[s.id] || {}; return `<tr><th>${h(s.preferred_name || s.full_name)}</th>${BK_PERMS.map(([k]) => `<td><input type="checkbox" data-act="bks-perm" data-staff="${s.id}" data-k="${k}" ${pr[k] === false ? '' : 'checked'} aria-label="${h(k)}"></td>`).join('')}</tr>`; }).join('')}</tbody></table></div></div>` : ''}
  </div>`;
}
function bkSettingsCard() { return `<div class="card"><h3>Scheduling (testing)</h3><label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-act="bk-toggle" ${Bk.on() ? 'checked' : ''}> <span>Show the Scheduling tab on this device<br><span class="hint">The new calendar is being tested. Appointments made here don't change anything else in the app, and ezyVet stays the real booking system until you switch over.</span></span></label></div>`; }

/* ---------------- the business page: how this client's farms and yards are booked ---------------- */
function bkRateSvcs() { return Bk.cfg('service').filter((x) => x.mode === 'perhead' && x.rateFrom === 'farm'); } // procedures whose speed is set per farm / yard
function bkRateOk(use, sv) { if (use === 'none' || (use === 'individual' && sv.yard)) return false; return !(sv.yard && (use === 'preg' || use === 'bull') && sv.yard !== use); }
function bkBizCard(b) {
  if (!Bk.on() || (typeof isClientBiz === 'function' && !isClientBiz(b))) return '';
  const bs = Bk.bsched(b.id), ed = Bk.can('book'), fs = bkFarmsOf(b.id), rs = bkRateSvcs();
  const sp = (fid, yid, sv) => { const y = bkRate(fid, yid, sv.id); return y && y.hph ? `<b>${y.hph}/hour</b>` : `${sv.hph ? sv.hph + '/hour (usual)' : '<b style="color:var(--red)">not set</b>'}`; };
  const ruleLine = (fid, yid) => { const x = bkYardUse(fid, yid), use = x.use || ''; const rr = rs.filter((sv) => bkRateOk(use, sv));
    return `${use === 'none' ? '<b style="color:var(--red)">⛔ Do not service</b>' : h(BK_USE[use])}${rr.length ? `<br><span class="hint">${rr.map((sv) => h(sv.name) + ' ' + sp(fid, yid, sv)).join(' · ')}</span>` : ''}${x.note ? `<br><span class="hint">${h(x.note)}</span>` : ''}`; };
  return `<div class="card bk-bizcard"><h3><span class="sp">📅 Scheduling</span>${ed ? `<button class="btn small" data-act="bks-bsched" data-id="${b.id}" aria-label="Edit scheduling">✏️</button>` : ''}</h3>
    <div class="kv"><div class="k">Additional labour</div><div class="v">${bs.labour ? '<b>Needed at every appointment</b> — you\'re reminded when booking' : 'Only when asked for'}${bs.note ? `<br><span class="hint">${h(bs.note)}</span>` : ''}</div></div>
    ${fs.map((f) => { const x = Bk.fsched(f.id), stop = (f.safety || {}).status === 'stop', ys = bkYardsOf(f);
      return `<div class="kv bk-fsrow" style="align-items:flex-start"><div class="k">${h(f.name || f.address || 'Farm')}</div><div class="v">${stop ? '<b style="color:var(--red)">⛔ Safety: no routine work until fixed</b><br>' : ''}${!ys.length ? '<b style="color:var(--red)">No yards pin yet — add one before it can be booked</b><br>' : ''}
        ${x.perYard || x.ratesPerYard ? ys.map((y) => `<div class="bk-yrow"><b>${h(y.name)}</b>: ${ruleLine(f.id, y.yid)}</div>`).join('') : `${ruleLine(f.id, null)}${ys.length > 1 ? `<br><span class="hint">Same for all ${ys.length} yards</span>` : ''}`}</div>${ed ? `<button class="btn small" data-act="bks-fsched" data-id="${f.id}" data-bid="${b.id}" aria-label="Edit ${h(f.name || 'farm')} scheduling">✏️</button>` : ''}</div>`; }).join('') || '<div class="hint">No farms saved for this business yet.</div>'}
    <div class="hint" style="margin-top:4px">Used when booking: the head-per-hour rates set how long those procedures take at each farm or yard, and "what can be booked here" warns you if an appointment doesn't fit.</div></div>`;
}
window.bkBizCard = bkBizCard;

/* ---------------- Ask Claude (Scheduling Jobs and On call): copies the question with what's on this page ---------------- */
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
  if (pg === 'roster') { L.push('', 'ON-CALL ROSTER (one vet per day, midnight to midnight):'); for (let i = 0; i < 28; i++) { const d = bkAdd(bkWeekStart(BK.date), i), w = bkOncallWho(d); L.push(`- ${bkDate(d)}: ${w ? Bk.pname(w) : 'NOT SET'}${bkOncallRec(d) ? ' (changed by hand)' : ''}`); } }
  L.push('', 'APPOINTMENTS IN THE NEXT 3 WEEKS:');
  Bk.list('bookings').filter((b) => Bk.live(b) && b.date >= t && b.date <= bkAdd(t, 21)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).forEach((b) => L.push(`- ${bkDate(b.date)} ${bkTime(b.start)}–${bkTime(bkHHMM(bkMin(b.start) + b.mins))}: ${Bk.who(b)}${Bk.farmName(b) ? ' at ' + Bk.farmName(b) : ''} — ${(b.svcs || []).map((x) => Bk.svc(x.svc).name + (x.head ? ' ×' + x.head : '') + ' (' + Bk.sstaff(b, x).map(Bk.pname).join(' + ') + ')').join(', ') || Bk.type(b.type).name} [${Bk.statusText(b)}]`));
  L.push('', 'Please answer in plain English. If something should be changed, list the changes step by step so I can make them in the app.');
  return L.join('\n');
}

/* ---------------- look ---------------- */
(function () { const st = document.createElement('style'); st.id = 'bk-css'; st.textContent = `
.bk-wrap{max-width:none}
.bk-top{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;margin-bottom:8px}
.bk-nav{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.bk-title{font-size:17px;margin-left:4px}
.bk-seg{display:inline-flex;gap:4px;flex-wrap:wrap}
.bk-seg .btn.on{background:var(--ink,#222);color:var(--bg,#fff)}
.bk-opt{display:flex;gap:6px;align-items:center;margin-top:8px;font-size:14px;color:var(--ink3,#666)}
.bk-people{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.bk-pp.off{opacity:.65}
.bk-oncall{padding:6px 10px;border:1px dashed var(--line,#ddd);border-radius:8px;margin-bottom:8px;cursor:pointer;font-size:14px}
.bk-warn{color:var(--red,#b42318);font-weight:600}
.bk-dayscroll{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}
.bk-dayscroll.v{max-height:calc(100dvh - 290px);min-height:320px;overflow:auto;overscroll-behavior:contain;border-top:1px solid var(--line,#ddd)}
.bk-day{display:grid;gap:0 6px;min-width:min-content}
.bk-colh{position:sticky;top:0;background:var(--bg,#fff);z-index:3;padding:4px 2px 6px;display:flex;flex-direction:column;gap:2px;font-size:14px}
.bk-colh .btn{align-self:flex-start;font-size:12px;padding:2px 8px}
.bk-corner{left:0}
.bk-colh[draggable=true]{cursor:grab}.bk-colh.dropto{outline:2px dashed #2f7a55;outline-offset:-2px;border-radius:6px}
.bk-colord{display:flex;gap:4px;align-items:center}.bk-colord b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bk-colord .btn{padding:0 7px;font-size:14px;line-height:20px}
.bk-times{position:relative;font-size:11px;color:var(--ink3,#777)}
.bk-times span{position:absolute;right:4px;transform:translateY(-6px)}
.bk-col{position:relative;border-left:1px solid var(--line,#ddd);background:repeating-linear-gradient(to bottom,transparent 0,transparent ${60 * BK_PX - 1}px,var(--line,#e5e5e5) ${60 * BK_PX - 1}px,var(--line,#e5e5e5) ${60 * BK_PX}px);cursor:copy;border-radius:4px}
.bk-off{position:absolute;left:0;right:0;background:repeating-linear-gradient(135deg,rgba(120,120,120,.10) 0 6px,rgba(120,120,120,.18) 6px 12px);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink3,#777);pointer-events:none}
.bk-buffer{position:absolute;left:0;right:0;background:rgba(181,121,28,.10);border-top:1px dashed rgba(181,121,28,.6);font-size:11px;color:var(--ink3,#777);padding:1px 4px;pointer-events:none;overflow:hidden}
.bk-block{position:absolute;left:2px;right:2px;border-radius:6px;background:color-mix(in srgb,var(--c) 22%,var(--bg,#fff));border:1px solid color-mix(in srgb,var(--c) 55%,transparent);font-size:12px;padding:2px 6px;overflow:hidden;cursor:pointer;z-index:1}
.bk-lunch{z-index:2}
.bk-appt{position:absolute;left:3px;right:3px;border-radius:7px;background:color-mix(in srgb,var(--c) 16%,var(--bg,#fff));border:1.5px solid var(--c);border-left-width:5px;padding:3px 6px;font-size:12.5px;overflow:hidden;cursor:pointer;z-index:2;line-height:1.25}
.bk-appt.unconf{border-style:dashed}.bk-appt.unconf.pat-light{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--c) 10%,var(--bg,#fff)) 0 8px,color-mix(in srgb,var(--c) 18%,var(--bg,#fff)) 8px 16px)}
.bk-appt.done{opacity:.7}
.bk-appt.urgent{box-shadow:0 0 0 2px var(--red,#b42318) inset}
.bk-inlunch{position:absolute;left:0;right:0;background:repeating-linear-gradient(45deg,rgba(194,136,74,.25) 0 5px,transparent 5px 10px);font-size:10.5px;color:var(--ink3,#666);text-align:right;padding-right:4px;pointer-events:none}
.bk-at{font-weight:600;font-size:11.5px}.bk-at i{font-weight:500}
.bk-aw{font-weight:600}.bk-as{color:var(--ink3,#666);font-size:11.5px}
.bk-prop{position:absolute;left:3px;right:3px;border-radius:7px;border:2px dotted var(--ink3,#888);background:repeating-linear-gradient(45deg,rgba(130,130,130,.10) 0 6px,transparent 6px 12px);font-size:11.5px;padding:3px 6px;overflow:hidden;cursor:pointer;z-index:2}
.bk-drive{position:absolute;left:10px;right:10px;font-size:11px;color:var(--ink3,#777);display:flex;align-items:center;pointer-events:none;z-index:1;border-left:2px dotted var(--ink3,#aaa);padding-left:4px}
.bk-drive.bad{color:var(--red,#b42318);font-weight:700;border-left-color:var(--red,#b42318)}
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
.bk-roster{border-collapse:collapse;width:100%;min-width:420px}.bk-roster th,.bk-roster td{border-bottom:1px solid var(--line,#ddd);padding:5px;text-align:left;font-size:14px}.bk-roster tr.we{background:rgba(120,120,120,.06)}.bk-roster tr.today th{color:#2f7a55}
.bk-ocpat{border-collapse:collapse}.bk-ocpat th,.bk-ocpat td{padding:3px 4px;font-size:13px;text-align:center}.bk-ocpat select{max-width:96px}
.bk-perm{border-collapse:collapse;min-width:520px}.bk-perm th,.bk-perm td{border-bottom:1px solid var(--line,#ddd);padding:5px;font-size:13px;text-align:center}.bk-perm th:first-child{text-align:left}
.bk-dot{width:14px;height:14px;border-radius:50%;background:var(--c);flex:none;margin-right:6px;border:1px solid var(--c)}
.bk-svcrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.bk-svcrow select{min-width:0}.bk-svcrow select[data-bksvc],.bk-svcrow select[data-bkfarm]{flex:1 1 200px}.bk-svcrow select[data-bkyard]{flex:1 1 160px}
.bk-svcrow input[type=number]{width:84px!important;flex:0 0 84px;min-width:0}.bk-svcrow .hint{flex:0 0 auto}
.bk-svcblk{border:1px solid var(--line,#ddd);border-radius:8px;padding:6px 8px 4px;margin-bottom:6px}.bk-svcblk.along{border-style:dashed;background:color-mix(in srgb,#3a6ea5 5%,transparent)}
.bk-svcblk .bk-svcrow{margin-bottom:4px}
.bk-who{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;margin-bottom:2px}
.bk-pp{display:inline-flex;gap:4px;align-items:center;border:1px solid var(--line,#ccc);border-radius:16px;padding:2px 9px;font-size:14px;cursor:pointer}.bk-pp:has(input:checked){border-color:#2f7a55;background:color-mix(in srgb,#2f7a55 12%,transparent);font-weight:600}.bk-pp.bad{opacity:.6}
.bk-radio{display:inline-flex;gap:6px;align-items:center;font-size:14.5px;margin-right:12px}
.bk-picked{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.bk-res{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;border:1px solid var(--line,#ddd);background:var(--bg,#fff);color:inherit;border-radius:8px;padding:6px 10px;margin-top:4px;font:inherit;cursor:pointer}
.bk-sugg{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;margin:6px 0}
.bk-sopt{display:flex;flex-direction:column;align-items:flex-start;text-align:left;border:1.5px solid #2f7a55;border-radius:8px;padding:6px 10px;background:color-mix(in srgb,#2f7a55 8%,var(--bg,#fff));color:inherit;font:inherit;cursor:pointer}
.bk-sopt .lg{font-size:12.5px;color:var(--ink3,#666);margin-top:3px;line-height:1.35}.bk-sopt.out{border-color:#b5791c;background:color-mix(in srgb,#b5791c 8%,var(--bg,#fff))}
.bk-warnbox{border:1px solid #e3b25c;background:color-mix(in srgb,#e3b25c 14%,var(--bg,#fff));border-radius:8px;padding:6px 10px;font-size:14px;margin:6px 0}
.bk-actions{margin-top:10px}
.bk-hrow{display:flex;gap:6px;align-items:center;margin:3px 0;flex-wrap:wrap}.bk-hrow .bk-radio{min-width:70px}
.bk-times2{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.bk-jobs summary{cursor:pointer;display:flex;gap:8px;align-items:center}
.bk-job{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-top:1px solid var(--line,#eee);padding:8px 0}
.bk-job .v{min-width:0;flex:1 1 240px}
.bk-empty{padding:16px}
.bk-texts{margin-top:10px}.bk-text{border-left:3px solid var(--line,#ccc);padding:4px 8px;margin:6px 0;font-size:14px}.bk-text.in{border-left-color:#2f7a55;background:color-mix(in srgb,#2f7a55 7%,transparent)}
.bk-labour{margin-top:6px}
.bk-ai summary{cursor:pointer}.bk-ai{margin-bottom:8px}
.bk-logrow.undone{opacity:.6}
.bk-yrow{margin:2px 0}
.bk-appt.pat-solid,.bk-block.pat-solid,.bk-chip.pat-solid{background:var(--c)!important;color:#fff}.pat-solid .bk-as,.pat-solid .bk-at i{color:rgba(255,255,255,.85)}
.bk-appt.pat-stripes,.bk-block.pat-stripes,.bk-chip.pat-stripes,.bk-patdemo.pat-stripes,.bk-dot.pat-stripes{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--c) 34%,var(--bg,#fff)) 0 6px,color-mix(in srgb,var(--c) 9%,var(--bg,#fff)) 6px 12px)!important}
.bk-appt.pat-dots,.bk-block.pat-dots,.bk-chip.pat-dots,.bk-patdemo.pat-dots,.bk-dot.pat-dots{background:radial-gradient(color-mix(in srgb,var(--c) 60%,transparent) 1.6px,transparent 1.9px) 0 0/8px 8px,color-mix(in srgb,var(--c) 7%,var(--bg,#fff))!important}
.bk-appt.pat-checks,.bk-block.pat-checks,.bk-chip.pat-checks,.bk-patdemo.pat-checks,.bk-dot.pat-checks{background:repeating-conic-gradient(color-mix(in srgb,var(--c) 28%,var(--bg,#fff)) 0 25%,color-mix(in srgb,var(--c) 7%,var(--bg,#fff)) 0 50%) 0 0/12px 12px!important}
.bk-appt.pat-outline,.bk-block.pat-outline,.bk-chip.pat-outline,.bk-patdemo.pat-outline,.bk-dot.pat-outline{background:var(--bg,#fff)!important}
.bk-patdemo{display:inline-block;width:34px;height:22px;border:1.5px solid var(--c);border-radius:5px;background:color-mix(in srgb,var(--c) 16%,var(--bg,#fff));vertical-align:middle}.bk-patdemo.pat-solid{background:var(--c)}
.bk-patopt{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line,#ccc);border-radius:8px;padding:4px 8px;font-size:14px;cursor:pointer}.bk-patopt:has(input:checked){border-color:#2f7a55;background:color-mix(in srgb,#2f7a55 10%,transparent)}
.bk-swrow{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.bk-sw{display:inline-flex;gap:5px;align-items:center;border:1px solid var(--line,#ccc);border-radius:14px;background:var(--bg,#fff);color:inherit;font:inherit;font-size:13px;padding:2px 9px 2px 4px;cursor:pointer}.bk-sw span{width:18px;height:18px;border-radius:50%;background:var(--c);display:inline-block;border:1px solid rgba(0,0,0,.15)}.bk-sw.dot{padding:2px;border-radius:6px}.bk-sw.dot span{border-radius:4px;width:22px;height:22px}
.bk-palette{display:grid;grid-template-columns:repeat(auto-fill,minmax(30px,1fr));gap:3px;margin-top:6px;max-width:420px}
.bk-colnow{display:inline-block;width:40px;height:40px;border-radius:8px;background:var(--c);border:1px solid var(--line,#ccc)}.bk-colnow.big{width:54px;height:34px}
.bk-cspec-wrap{position:relative;width:100%;max-width:420px}.bk-cspec{width:100%;height:200px;border-radius:8px;border:1px solid var(--line,#ccc);touch-action:none;cursor:crosshair;display:block}
.bk-cdot{position:absolute;width:14px;height:14px;border:2px solid #fff;box-shadow:0 0 0 1px #000;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
.bk-cval{width:100%;max-width:420px;margin-top:8px;accent-color:var(--c)}
.bk-lookbox{border:1px dashed var(--line,#ccc);border-radius:8px;padding:6px 8px;margin:8px 0}
`; document.head.appendChild(st); })();
