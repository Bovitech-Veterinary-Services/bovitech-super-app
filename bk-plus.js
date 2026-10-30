/* Bovitech Super App — Scheduling, part 5: moving things by dragging, "can this day / week be more efficient?",
   the day sheet (run sheet for each person), the "To schedule" list and the waitlist. */
'use strict';

/* ---------------- the waitlist: clients who'd like an earlier time if one comes up ---------------- */
const BKW = { key: null, jobs: [] };
function bkWaitJobs() {
  if (!D || !Bk.list) return []; const t = bkToday();
  const wl = Bk.list('bookings').filter((b) => Bk.live(b) && b.waitlist && !b.proposal && b.date > t && (b.staff || []).length);
  if (!wl.length) return [];
  const key = t + stable(Bk.list('bookings').filter((b) => Bk.live(b) && b.date >= t).map((b) => [b.id, b.date, b.start, b.mins, b.staff, !!b.proposal, !!b.waitlist])) + Bk.list('blocks').length + Bk.list('bkcfg').length;
  if (BKW.key === key) return BKW.jobs;
  const out = [];
  wl.forEach((b) => { const last = bkAdd(b.date, -1); const end = last < bkAdd(t, 28) ? last : bkAdd(t, 28);
    for (let d = t; d <= end; d = bkAdd(d, 1)) { let best = null;
      for (const sid of b.staff) { const sl = bkSlots(sid, d, { type: b.type, stops: Bk.stops(b), mins: b.mins, skipId: b.id }).filter((x) => !x.lunchOut).map((x) => bkMin(x.start)); if (!sl.length) { best = null; break; } best = best == null ? Math.min(...sl) : Math.max(best, Math.min(...sl)); }
      if (best == null || bkClientRuleIssues(b, d, bkHHMM(best), b.mins).some((x) => x.hard)) continue;
      out.push({ k: 'wait', b, date: d, start: bkHHMM(best), staff: b.staff.join(','), t: 'Waitlist — earlier time free', d: `${Bk.who(b)} (booked ${bkDate(b.date)} ${bkTime(b.start)}) could come in ${bkDate(d, { weekday: 'short', day: 'numeric', month: 'short' })} at ${bkTime(best)} with ${b.staff.map(Bk.pname).join(', ')}` }); break; } });
  BKW.key = key; BKW.jobs = out; return out;
}
function bkHold(b, date, start, staff, extra) { b.proposal = { date, start, mins: b.mins, staff: [...(staff || b.staff || [])], at: Date.now(), by: SBAuth.staff && SBAuth.staff.id, smsSent: null, ...(extra || {}) }; touch(b); if (window.SupaSync) SupaSync.kickSms = true; }

/* ---------------- "To schedule": work that needs booking, but not yet ---------------- */
function bkPendWho(x) { return Bk.who(x); }
function bkPendWhat(x) { const s = (x.svcs || []).filter((y) => y.svc && Bk.get(y.svc)).map((y) => Bk.svc(y.svc).name + (y.head ? ' ×' + y.head : '')).join(', '); return s || Bk.type(x.type).name; }
function bkPendingHtml() {
  const t = bkToday(); const all = Bk.list('bkpending').filter((x) => !x.gone); const open = all.filter((x) => !x.done).sort((a, b) => (a.urgent ? 0 : 1) - (b.urgent ? 0 : 1) || (a.by || '9999').localeCompare(b.by || '9999') || a.at - b.at);
  const done = all.filter((x) => x.done).sort((a, b) => b.done.at - a.done.at).slice(0, 20);
  const wl = Bk.list('bookings').filter((b) => Bk.live(b) && b.waitlist && b.date >= t).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)); const wj = bkWaitJobs();
  const ed = Bk.can('book');
  return `<div class="d-wrap bk-wrap"><div class="bk-top"><div class="bk-nav"><b class="bk-title">To schedule</b></div><div class="bk-nav">${ed ? '<button class="btn small primary" data-act="bkp-new">➕ Add to the list</button>' : ''}</div></div>
  ${bkAiCard('pending')}<div class="hint" style="margin-bottom:8px">Work a client has asked for that isn't booked yet. <b>📅 Book it</b> opens a new appointment with the details filled in and suggests times. Anything wanted within a week also shows in Jobs.</div>
  <div class="card">${open.map((x) => `<div class="bk-job"><div class="v"><b>${x.urgent ? '⚡ ' : ''}${h(bkPendWho(x))}</b> — ${h(bkPendWhat(x))}<br><span class="hint">${x.by ? `${x.by < t ? '<b style="color:var(--red)">was wanted by</b>' : 'wanted by'} ${bkDate(x.by, { weekday: 'short', day: 'numeric', month: 'short' })} · ` : ''}added ${new Date(x.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}${x.who ? ' by ' + h(Bk.pname(x.who)) : ''}${x.notes ? ' · ' + h(x.notes) : ''}</span></div>
    <div class="actions">${ed ? `<button class="btn small primary" data-act="bkp-book" data-id="${x.id}">📅 Book it</button><button class="btn small" data-act="bkp-edit" data-id="${x.id}">✏️</button><button class="btn small" data-act="bkp-drop" data-id="${x.id}">Not needed</button>` : ''}</div></div>`).join('') || '<div class="hint">Nothing waiting to be booked.</div>'}</div>
  <div class="card"><h3>⏳ Waitlist</h3><div class="hint" style="margin-bottom:6px">Booked appointments where the client would like an earlier time. Tick "⏳ Waitlist" on the appointment. When a time frees up (a cancellation or move) you're offered it, and earlier free times show here and in Jobs.</div>
    ${wl.map((b) => { const j = wj.find((x) => x.b.id === b.id); return `<div class="bk-job"><div class="v"><b>${h(Bk.who(b))}</b> — booked ${bkDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })} ${bkTime(b.start)} with ${h((b.staff || []).map(Bk.pname).join(', '))}${b.proposal ? '<br><span class="hint">New time held — waiting for the client</span>' : j ? `<br><span class="hint">Earlier: <b>${bkDate(j.date, { weekday: 'short', day: 'numeric', month: 'short' })} ${bkTime(j.start)}</b></span>` : '<br><span class="hint">No earlier time free yet</span>'}</div>
      <div class="actions">${j && ed && !b.proposal ? `<button class="btn small primary" data-act="bkj-waitoffer" data-id="${b.id}" data-date="${j.date}" data-start="${j.start}" data-staff="${j.staff}">↔ Suggest this time</button>` : ''}<button class="btn small" data-act="bk-open" data-id="${b.id}">Open</button></div></div>`; }).join('') || '<div class="hint">Nobody on the waitlist.</div>'}</div>
  ${done.length ? `<details class="card"><summary><b>Recently booked from this list</b></summary>${done.map((x) => `<div class="kv"><div class="v">${h(bkPendWho(x))} — ${h(bkPendWhat(x))}<br><span class="hint">booked ${new Date(x.done.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}${x.done.booking ? '' : ' (removed — not needed)'}</span></div>${x.done.booking && bkRec(x.done.booking) ? `<button class="btn small" data-act="bk-open" data-id="${x.done.booking}">Open</button>` : ''}</div>`).join('')}</details>` : ''}</div>`;
}
let BKPF = null;
function bkPendFormHtml() {
  const x = BKPF; const types = Bk.cfg('type'), svcs = Bk.cfg('service').filter((s) => !s.alongside);
  return `<div class="f"><label for="bkpf-q">Client</label>${x.bid || x.cid ? `<div class="bk-picked"><b>${h(Bk.who(x))}</b> <button type="button" class="btn small" data-act="bkpf-clear">Change</button></div>` : `<div class="search"><input id="bkpf-q" placeholder="Search a business, person or mobile" autocomplete="off"></div><div id="bkpf-res"></div>`}</div>
    <div class="f"><label for="bkpf-type">Appointment type</label><select id="bkpf-type">${types.map((t) => `<option value="${t.id}" ${t.id === x.type ? 'selected' : ''}>${h(t.name)}</option>`).join('')}</select></div>
    <div class="f"><label>Procedures</label>${(x.svcs.length ? x.svcs : [{}]).map((y, i) => { const sv = y.svc && Bk.svc(y.svc); return `<div class="bk-svcrow"><select data-bkpsvc="${i}" aria-label="Procedure ${i + 1}"><option value="">Choose…</option>${svcs.map((s) => `<option value="${s.id}" ${s.id === y.svc ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select>${sv && sv.mode === 'perhead' ? `<input type="number" min="0" inputmode="numeric" data-bkphead="${i}" value="${y.head || ''}" aria-label="Head"><span class="hint">head (about)</span>` : ''}</div>`; }).join('')}<button type="button" class="btn small" data-act="bkpf-svcadd">➕ Another procedure</button></div>
    <div class="grid2"><div class="f"><label for="bkpf-by">Wanted by</label><input id="bkpf-by" type="date" value="${x.by || ''}"><div class="hint">Optional.</div></div><div class="f"><label class="bk-radio" style="margin-top:24px"><input type="checkbox" id="bkpf-urgent" ${x.urgent ? 'checked' : ''}> ⚡ Urgent / emergency</label></div></div>
    <div class="f"><label for="bkpf-notes">Notes</label><textarea id="bkpf-notes" rows="3">${h(x.notes || '')}</textarea></div>`;
}
function bkPendRead() { const x = BKPF; const g = (id) => document.getElementById(id); if (!g('bkpf-type')) return; x.type = g('bkpf-type').value; x.by = g('bkpf-by').value || null; x.urgent = g('bkpf-urgent').checked; x.notes = g('bkpf-notes').value.trim();
  document.querySelectorAll('[data-bkpsvc]').forEach((el) => { const i = +el.dataset.bkpsvc; x.svcs[i] = x.svcs[i] || {}; x.svcs[i].svc = el.value; }); document.querySelectorAll('[data-bkphead]').forEach((el) => { x.svcs[+el.dataset.bkphead].head = +el.value || 0; }); }
function bkPendRefresh() { const f = document.querySelector('#sheet .form'); if (!f) return; f.innerHTML = bkPendFormHtml(); bkPendBind(); }
function bkPendBind() { const q = document.getElementById('bkpf-q'); if (!q) return; q.addEventListener('input', () => { const r = bkClientResults(q.value, BK_WHO_DEF); document.getElementById('bkpf-res').innerHTML = r.map((y) => `<button type="button" class="bk-res" data-act="bkpf-client" data-bid="${y.bid || ''}" data-cid="${y.cid || ''}"><b>${h(y.label)}</b><span class="hint">${h(y.sub || '')}</span></button>`).join(''); }); setTimeout(() => q.focus(), 50); }
function bkPendOpen(x) {
  if (!Bk.need('book')) return; const ex = x || null;
  BKPF = ex ? bkClone(ex) : { id: uid('pd'), type: (Bk.cfg('type')[0] || {}).id, svcs: [], notes: '', by: null, urgent: false };
  BKPF.svcs = BKPF.svcs || [];
  openSheet(ex ? 'To schedule — ' + Bk.who(ex) : 'Add to "To schedule"', bkPendFormHtml(), async () => {
    bkPendRead(); const x2 = BKPF; if (!x2.bid && !x2.cid) { toast('Choose the client'); return false; }
    x2.svcs = x2.svcs.filter((y) => y.svc).map((y) => ({ svc: y.svc, head: y.head || 0 }));
    const r = Bk.list('bkpending').find((y) => y.id === x2.id); if (r) { Object.assign(r, x2); touch(r); } else { x2.at = Date.now(); x2.who = SBAuth.staff && SBAuth.staff.id; touch(x2); Bk.list('bkpending').push(x2); }
    BKPF = null; save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
  const f = document.querySelector('#sheet .form');
  f.addEventListener('change', (e) => { if (e.target.dataset.bkpsvc != null) { bkPendRead(); bkPendRefresh(); } });
  f.addEventListener('click', (e) => { const el = e.target.closest('[data-act^="bkpf-"]'); if (!el) return; bkPendRead(); const a = el.dataset.act;
    if (a === 'bkpf-client') { BKPF.bid = el.dataset.bid || null; BKPF.cid = el.dataset.cid || null; if (BKPF.bid && !BKPF.cid) { const c = bkContactsOf(BKPF.bid).find(bkMobile); BKPF.cid = c ? c.id : null; } bkPendRefresh(); }
    if (a === 'bkpf-clear') { BKPF.bid = null; BKPF.cid = null; bkPendRefresh(); }
    if (a === 'bkpf-svcadd') { BKPF.svcs = BKPF.svcs.filter((y) => y.svc); BKPF.svcs.push({}); bkPendRefresh(); } });
  bkPendBind();
}

/* ---------------- the day sheet: one person's day, ready to print or send ---------------- */
function bkSheetPeople() { return Bk.people().filter((s) => Bk.hours(s, BK.date) || Bk.bookingsFor(BK.date, s.id).length); }
function bkSheetSid() { const ppl = bkSheetPeople(); const all = Bk.people(); if (BK.sheetStaff && all.some((s) => s.id === BK.sheetStaff)) return BK.sheetStaff; const me = SBAuth.staff && SBAuth.staff.id; return (ppl.find((s) => s.id === me) || ppl[0] || all[0] || {}).id; }
function bkMapLink(pt) { return pt && pt.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lng}` : null; }
function bkSheetData(sid, date) { // the day in order: drives, appointments, blocks, lunch
  const day = bkDay(sid, date); const rows = [];
  day.items.forEach((it) => rows.push({ at: it.s, it }));
  day.legs.forEach((l) => rows.push({ at: Math.max(l.start, l.prevEnd) - 0.5, leg: l }));
  rows.sort((a, b) => a.at - b.at); return { day, rows };
}
function bkSheetHtml() {
  const sid = bkSheetSid(); const date = BK.date; const p = Bk.person(sid);
  const pick = `<div class="bk-top bk-noprint"><div class="bk-nav"><button class="btn small" data-act="bks-go" data-v="-1" aria-label="Back a day">‹</button><button class="btn small" data-act="bk-today">Today</button><button class="btn small" data-act="bks-go" data-v="1" aria-label="Forward a day">›</button><input type="date" id="bks-date" value="${date}" aria-label="Date">
    <select id="bks-who" aria-label="Whose day">${Bk.people().map((s) => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${h(s.preferred_name || s.full_name)}${Bk.hours(s, date) || Bk.bookingsFor(date, s.id).length ? '' : ' (not working)'}</option>`).join('')}</select></div>
    <div class="bk-nav"><button class="btn small" data-act="bks-print">🖨 Print</button><button class="btn small" data-act="bks-copy">📋 Copy as text</button></div></div>`;
  if (!p) return `<div class="d-wrap bk-wrap">${pick}<div class="card"><div class="hint">The staff list loads the first time you sign in with internet.</div></div></div>`;
  const { day, rows } = bkSheetData(sid, date); const oc = bkOncallWho(date);
  const body = rows.map((r) => {
    if (r.leg) { const l = r.leg; const bad = l.start < l.prevEnd; return `<div class="drv">🚗 ${bkTime(Math.max(l.start, l.prevEnd))}–${bkTime(l.end)} · ~${l.need} min ${l.home ? 'back to ' + h(l.to) : 'from ' + h(l.from) + ' to ' + h(l.to)}${bad ? ' <b style="color:var(--red)">— not enough time</b>' : ''}</div>`; }
    const it = r.it;
    if (it.kind === 'lunch') return `<div class="bk-si"><span class="t">🥪 ${bkTime(it.s)}–${bkTime(it.e)} Lunch</span> <span class="hint">wherever you are</span></div>`;
    if (it.kind === 'block') { const b = it.ref; return `<div class="bk-si"><span class="t">${b.allDay ? 'All day' : bkTime(it.s) + '–' + bkTime(it.e)} ${h(Bk.btype(b.type).name)}</span>${b.note ? ' — ' + h(b.note) : ''}</div>`; }
    if (it.kind === 'held') return `<div class="bk-si"><span class="t">${bkTime(it.s)}–${bkTime(it.e)} Held</span> — ${h(it.what)} (waiting for the client)</div>`;
    const b = it.ref, t = Bk.type(b.type); const c = b.cid && D.contacts.find((x) => x.id === b.cid); const mob = bkMobile(c);
    const stops = Bk.stops(b).map((st, i) => { const pt = Travel.stopPt(st); const ln = bkMapLink(pt); return `${i + 1}. ${h(Bk.stopName(st))}${ln ? ` <a href="${ln}" target="_blank" rel="noopener">🧭 Directions</a>` : ''}`; }).join('<br>');
    const pr = bkProblems(b);
    return `<div class="bk-si"><div class="t">${bkTime(it.s)}–${bkTime(it.e)} · ${b.urgent ? '⚡ ' : ''}${bkPatientEmoji(b)}${h(Bk.who(b))}</div>
      <div class="hint">${h(t.name)} · ${h(Bk.statusText(b))}${(b.staff || []).length > 1 ? ' · with ' + h(b.staff.filter((x) => x !== sid).map(Bk.pname).join(', ')) : ''}</div>
      ${c ? `<div>📞 ${h(fullName(c))}${mob ? ` <a href="tel:${h(mob.replace(/\s/g, ''))}">${h(mob)}</a>` : ''}</div>` : ''}
      ${stops ? `<div>📍 ${stops}</div>` : ''}
      ${(b.pids || []).length ? `<div>${(b.pids || []).map((q) => `${typeof pidEmo === 'function' ? pidEmo(q) : ''}${h(q.value)}${q.label ? ' <span class="hint">' + h(q.label) + '</span>' : ''}`).join(' · ')}</div>` : ''}
      <div>🩺 ${(b.svcs || []).filter((x) => x.svc).map((x) => `${h(Bk.svc(x.svc).name)}${x.head ? ' ×' + x.head : ''} <span class="hint">(${h(Bk.sstaff(b, x).map(Bk.pname).join(', '))})</span>`).join(', ') || h(t.name)}</div>
      ${b.lunch && b.lunch.start ? `<div>🥪 Lunch during this appointment, about ${bkTime(b.lunch.start)}</div>` : ''}
      ${b.notes ? `<div>📝 ${h(b.notes)}</div>` : ''}
      ${bkWarnBlock(bkWarnings(b), true)}
      ${pr.length ? `<div class="bk-warnbox">${pr.map((x) => '⚠ ' + h(x)).join('<br>')}</div>` : ''}
      ${bkChecklistHtml(b, 'data-bkstick')}</div>`; }).join('');
  const back = day.legs.filter((l) => l.home).pop();
  return `<div class="d-wrap bk-wrap">${pick}<div class="card bk-sheet bk-print"><h3>Day sheet — ${h(p.preferred_name || p.full_name)}, ${bkDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
    <div class="hint">${day.hr ? `Working ${bkTime(day.hr[0])}–${bkTime(day.hr[1])}, starting at ${h(day.dl.startName)}` : 'Not working this day'} · 📟 On call: ${oc ? h(Bk.pname(oc)) : 'not set'}</div>
    ${body || '<div class="hint" style="margin-top:8px">Nothing booked.</div>'}
    ${back ? `<div class="drv">🏠 Back at ${h(back.to)} about ${bkTime(back.end)}</div>` : ''}</div>
    <div class="hint bk-noprint">Ticks on the checklists save straight away. The day sheet can also be sent each morning — ask in Settings if you'd like that set up.</div></div>`;
}
function bkSheetText(sid, date) {
  const p = Bk.person(sid); if (!p) return ''; const { day, rows } = bkSheetData(sid, date); const L = [`${p.preferred_name || p.full_name} — ${bkDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`];
  const strip = (x) => String(x || '').replace(/<[^>]+>/g, '').trim();
  rows.forEach((r) => { if (r.leg) { const l = r.leg; L.push(`  drive ~${l.need} min ${l.home ? 'back to ' + l.to : 'to ' + l.to}`); return; } const it = r.it;
    if (it.kind === 'lunch') { L.push(`${bkTime(it.s)} Lunch`); return; } if (it.kind === 'block') { L.push(`${it.ref.allDay ? 'All day' : bkTime(it.s) + '–' + bkTime(it.e)} ${Bk.btype(it.ref.type).name}${it.ref.note ? ' — ' + it.ref.note : ''}`); return; } if (it.kind === 'held') return;
    const b = it.ref; const c = b.cid && D.contacts.find((x) => x.id === b.cid);
    L.push(`${bkTime(it.s)}–${bkTime(it.e)} ${strip(bkPatientEmoji(b))}${Bk.who(b)}${Bk.farmName(b) ? ' @ ' + Bk.farmName(b) : ''}`);
    L.push('  ' + ((b.svcs || []).filter((x) => x.svc).map((x) => Bk.svc(x.svc).name + (x.head ? ' ×' + x.head : '')).join(', ') || Bk.type(b.type).name) + (c ? ` · ${fullName(c)} ${bkMobile(c) || ''}` : ''));
    Bk.stops(b).forEach((st) => { const ln = bkMapLink(Travel.stopPt(st)); if (ln) L.push('  ' + ln); });
    bkWarnings(b).forEach((w) => L.push(`  ${BK_WLVL[w.lvl][0]} ${w.text}`)); if (b.notes) L.push('  ' + b.notes); });
  const back = day.legs.filter((l) => l.home).pop(); if (back) L.push(`Back at ${back.to} about ${bkTime(back.end)}`);
  return L.join('\n');
}

/* ---------------- "Can this day / week be more efficient?" ---------------- */
async function bkEffOpen() {
  if (!Bk.need('book')) return;
  const dates = BK.view === 'day' ? [BK.date] : [...Array(7)].map((_, i) => bkAdd(bkWeekStart(BK.date), i));
  const hid = Bk.hidden(); const sids = Bk.people().filter((s) => !hid.has(s.id)).map((s) => s.id);
  const list = bkEfficient(dates, sids); const what = BK.view === 'day' ? 'this day' : 'this week';
  if (!list.length) { await askBox('Already efficient', `<p style="font-size:16px">Nothing to improve for ${what} (${dates.length > 1 ? `${bkDate(dates[0])} – ${bkDate(dates[6])}` : bkDate(dates[0])}).</p><p class="hint">Checked: whether appointments could start earlier or close up gaps (for example 9:00 instead of 9:15), whether the farms and yards on an appointment could be visited in a quicker order from where you're coming from and going to next, and whether swapping two appointments saves driving. Past days aren't changed.</p>`, 'OK', false, 'Close'); return; }
  const icon = { earlier: '⏩', order: '🔀', swap: '🔁' };
  const ok = await askBox(`Make ${what} more efficient`, `<div class="bk-eff"><p class="hint">Tick the changes you want. 🔀 New stop orders change straight away. Time changes (⏩ ⏩ earlier, 🔁 swaps) can be suggested to the client (reschedule pending approval — they stay put until the client agrees), or moved now if it's already agreed.</p>
    ${list.map((x, i) => `<label><input type="checkbox" data-askchk="ef_${i}" checked> <span>${icon[x.kind]} ${h(x.why)}</span></label>`).join('')}
    ${list.some((x) => x.kind !== 'order') ? `<div class="f" style="margin-top:10px"><label>Time changes</label><label class="bk-radio" style="display:flex"><input type="radio" name="ef-how" value="propose" data-ask="how" checked> Suggest the new times to the clients (pending approval)</label><label class="bk-radio" style="display:flex"><input type="radio" name="ef-how" value="move" data-ask="how"> Move them now (already agreed)</label></div>` : ''}</div>`, 'Make these changes', false, 'No — leave it');
  if (!ok) return; const how = ASK_FORM.how || 'propose'; let n = 0, held = 0; const moved = [];
  list.forEach((x, i) => { if (!ASK_FORM['ef_' + i]) return; n++;
    if (x.kind === 'order') { const b = x.b; const old = Bk.stops(b); const sug0 = bkSuggestMins(b.type, b.svcs, old, b.lunch).mins; b.stops = x.stops.map((s) => ({ ...s })); b.svcs = (b.svcs || []).map((y) => { const o = { ...y }; const j = x.ord.indexOf(y.stop || 0); if (j > 0) o.stop = j; else delete o.stop; return o; });
      b.fids = Bk.fids(b); b.fid = b.fids[0] || null; if (b.mins === sug0) b.mins = bkSuggestMins(b.type, b.svcs, b.stops, b.lunch).mins; touch(b); return; }
    const moves = x.kind === 'swap' ? [[x.a, x.aTo], [x.b, x.bTo]] : [[x.b, x.to]];
    moves.forEach(([b, to]) => { if (how === 'move') { b.start = to; touch(b); moved.push(b); } else { bkHold(b, b.date, to, b.staff, { tidy: true }); held++; } }); });
  for (const b of moved) await bkLunchSort(b);
  if (n) bkDone(how === 'move' || !held ? `${n} change${n === 1 ? '' : 's'} made` : `${n} change${n === 1 ? '' : 's'} — ${held} new time${held === 1 ? '' : 's'} waiting for the client${held === 1 ? '' : 's'}`);
}

/* ---------------- drag appointments and lunch breaks on the day calendar ---------------- */
const BKDR = { on: null };
function bkDragStart(el, x, y) {
  const col = el.closest('.bk-col'); if (!col) return; const r = col.getBoundingClientRect(); const top = parseFloat(el.style.top) || 0;
  BKDR.on = { el, kind: el.dataset.drag, id: el.dataset.id, staff: el.dataset.staff, day: el.dataset.day || BK.date, grab: (y - r.top) - top, x, y, col: col, startMin: Math.round(BK_START + top / BK_PX), h: el.offsetHeight, moved: false, ghost: null, min: null, toStaff: el.dataset.staff };
  el.classList.add('bk-dragging'); if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { }
}
function bkDragMove(x, y) {
  const d = BKDR.on; if (!d) return; d.moved = true;
  const sc = document.querySelector('.bk-dayscroll.v'); if (sc) { const r = sc.getBoundingClientRect(); if (y < r.top + 40) sc.scrollTop -= 12; else if (y > r.bottom - 40) sc.scrollTop += 12; }
  d.el.style.pointerEvents = 'none'; const under = document.elementFromPoint(x, y); d.el.style.pointerEvents = '';
  const col = (under && under.closest && under.closest('.bk-col')) || d.col; if (d.kind === 'lunch' && col.dataset.staff !== d.staff) { /* lunch stays with its person */ }
  const tcol = d.kind === 'lunch' ? d.el.closest('.bk-col') : col; const r = tcol.getBoundingClientRect();
  let m = Math.round((BK_START + (y - r.top - d.grab) / BK_PX) / 15) * 15; m = Math.max(BK_START, Math.min(BK_END - 15, m)); d.min = m; d.toStaff = tcol.dataset.staff;
  if (!d.ghost) { d.ghost = document.createElement('div'); d.ghost.className = 'bk-ghost'; }
  if (d.ghost.parentNode !== tcol) tcol.appendChild(d.ghost); document.querySelectorAll('.bk-col.dropcol').forEach((c) => c !== tcol && c.classList.remove('dropcol')); tcol.classList.add('dropcol');
  d.ghost.style.top = (m - BK_START) * BK_PX + 'px'; d.ghost.style.height = d.h + 'px'; d.ghost.textContent = `${bkTime(m)}${tcol.dataset.staff !== d.staff ? ' · ' + Bk.pname(tcol.dataset.staff) : ''}`;
}
function bkDragEnd(cancel) {
  const d = BKDR.on; BKDR.on = null; if (!d) return; d.el.classList.remove('bk-dragging'); if (d.ghost) d.ghost.remove(); document.querySelectorAll('.bk-col.dropcol').forEach((c) => c.classList.remove('dropcol'));
  if (!d.moved) return; BK._dragEnd = Date.now(); if (cancel || d.min == null) return;
  if (d.min === d.startMin && d.toStaff === d.staff) return;
  setTimeout(() => (d.kind === 'lunch' ? bkDropLunch(d) : bkDropAppt(d)), 0);
}
async function bkDropLunch(d) {
  const lc = Bk.lunchCfg(); const m = d.min; const sid = d.staff, date = d.day;
  const msgs = []; if (bkLunchOutside(m)) msgs.push(`${bkTime(m)} is outside the usual lunch time (${bkTime(lc.from)}–${bkTime(lc.to)}).`);
  if (!bkLunchOkAt(sid, date, m)) msgs.push('That\'s during an appointment, a block or a drive.');
  if (msgs.length && !(await ask(msgs.join('\n') + '\n\nMove lunch there anyway?', 'Yes — move it'))) { renderAll(); return; }
  bkSetLunch(sid, date, m); bkDone(`${Bk.pname(sid)}'s lunch moved to ${bkTime(m)}`);
}
async function bkDropAppt(d) {
  const b = bkRec(d.id); if (!b || !Bk.need('book')) { renderAll(); return; }
  const start = bkHHMM(d.min); const swap = d.toStaff !== d.staff ? [d.staff, d.toStaff] : null;
  if (swap && (b.staff || []).includes(d.toStaff)) { toast(`${Bk.pname(d.toStaff)} is already on this appointment`); renderAll(); return; }
  const staff = (b.staff || []).map((x) => (swap && x === swap[0] ? swap[1] : x)); const svcs = (b.svcs || []).map((x) => ({ ...x, staff: Bk.sstaff(b, x).map((y) => (swap && y === swap[0] ? swap[1] : y)) }));
  const cand = { ...bkClone(b), start, staff, svcs }; const pr = bkProblems(cand);
  const r = await askBox(`Move ${Bk.who(b)}?`, `<p style="font-size:16px">${bkDate(b.date)} <b>${bkTime(b.start)}</b>${swap ? ' with ' + h(Bk.pname(swap[0])) : ''} → <b>${bkTime(start)}</b>${swap ? ' with <b>' + h(Bk.pname(swap[1])) + '</b>' : ''}</p>${pr.length ? bkWarnHtml(pr) : '<p class="hint">No clashes, travel or rule problems.</p>'}${b.series ? '<p class="hint">This one only — the rest of the series stays where it is.</p>' : ''}`, 'Move it', false, 'Cancel', 'Suggest to the client (pending approval)');
  if (!r) { renderAll(); return; }
  if (!(await bkRuleOverride(cand))) { renderAll(); return; }
  if (r === 'alt') { bkHold(b, b.date, start, staff); bkDone('New time held — waiting for the client'); return; }
  const before = bkClone(b); b.start = start; b.staff = staff; b.svcs = svcs; if (cand.override) b.override = cand.override; if (b.lunch && b.lunch.start) b.lunch = { start: bkHHMM(bkMin(b.lunch.start) + d.min - bkMin(before.start)) }; touch(b);
  await bkLunchSort(b); bkDone(`Moved to ${bkTime(start)}`); setTimeout(() => bkTidyAsk(before), 450);
}
(function () {
  let pend = null; // a press that might become a drag
  const target = (e) => { const el = e.target.closest && e.target.closest('[data-drag]'); if (!el || !el.closest('.bk-day') || typeof S === 'undefined' || S.tab !== 'book' || !Bk.can('book')) return null; if (el.dataset.drag === 'appt') { const b = bkRec(el.dataset.id); if (!b || Bk.done(b)) return null; } return el; };
  document.addEventListener('mousedown', (e) => { if (e.button !== 0) return; const el = target(e); if (!el) return; pend = { el, x: e.clientX, y: e.clientY, mouse: true }; });
  document.addEventListener('mousemove', (e) => { if (BKDR.on) { e.preventDefault(); bkDragMove(e.clientX, e.clientY); return; } if (pend && pend.mouse && Math.hypot(e.clientX - pend.x, e.clientY - pend.y) > 6) { bkDragStart(pend.el, pend.x, pend.y); pend = null; bkDragMove(e.clientX, e.clientY); } });
  document.addEventListener('mouseup', () => { pend = null; if (BKDR.on) bkDragEnd(); });
  // touch: press and hold for a moment, then drag
  document.addEventListener('touchstart', (e) => { if (e.touches.length !== 1) return; const el = target(e); if (!el) return; const t = e.touches[0]; pend = { el, x: t.clientX, y: t.clientY, timer: setTimeout(() => { if (pend) { bkDragStart(pend.el, pend.x, pend.y); BKDR.on.moved = false; } }, 380) }; }, { passive: true });
  document.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (BKDR.on) { e.preventDefault(); bkDragMove(t.clientX, t.clientY); return; } if (pend && Math.hypot(t.clientX - pend.x, t.clientY - pend.y) > 8) { clearTimeout(pend.timer); pend = null; } }, { passive: false });
  document.addEventListener('touchend', () => { if (pend) { clearTimeout(pend.timer); pend = null; } if (BKDR.on) bkDragEnd(); });
  document.addEventListener('touchcancel', () => { if (pend) { clearTimeout(pend.timer); pend = null; } if (BKDR.on) bkDragEnd(true); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && BKDR.on) bkDragEnd(true); });
  document.addEventListener('click', (e) => { if (BK._dragEnd && Date.now() - BK._dragEnd < 500 && e.target.closest && e.target.closest('.bk-day')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true); // a drag isn't a tap
  document.addEventListener('contextmenu', (e) => { if (BKDR.on || (e.target.closest && e.target.closest('.bk-day [data-drag]'))) e.preventDefault(); });
})();

/* ---------------- taps ---------------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; const d = el.dataset;
  switch (a) {
    case 'bk-eff': bkEffOpen(); break;
    case 'bk-gocal': S.tab = 'book'; BK.page = 'cal'; BK.view = 'day'; BK.date = d.d; S.sel = null; renderAll(); window.scrollTo(0, 0); break;
    case 'bk-bizbook': if (!Bk.need('book')) return; { const c = bkContactsOf(d.bid).find(bkMobile); bkOpen(null, { bid: d.bid, cid: c ? c.id : null, date: BK.date < bkToday() ? bkToday() : BK.date }); } break;
    case 'bks-go': BK.date = bkAdd(BK.date, +d.v); renderAll(); break;
    case 'bks-print': window.print(); break;
    case 'bks-copy': { const t = bkSheetText(bkSheetSid(), BK.date); try { await navigator.clipboard.writeText(t); toast('Copied — paste it into a text or email'); } catch (x) { toast('Couldn\'t copy on this device'); } break; }
    case 'bkp-new': bkPendOpen(null); break;
    case 'bkp-edit': { const x = Bk.list('bkpending').find((y) => y.id === d.id); if (x) bkPendOpen(x); break; }
    case 'bkp-drop': { const x = Bk.list('bkpending').find((y) => y.id === d.id); if (!x || !Bk.need('book')) return; x.done = { at: Date.now(), booking: null, by: SBAuth.staff && SBAuth.staff.id }; touch(x); bkDone('Taken off the list'); break; }
    case 'bkp-book': { const x = Bk.list('bkpending').find((y) => y.id === d.id); if (!x) return; S.tab = 'book'; BK.page = 'cal'; renderAll();
      bkOpen(null, { bid: x.bid || null, cid: x.cid || null, type: x.type || (Bk.cfg('type')[0] || {}).id, svcs: (x.svcs || []).map((y) => ({ svc: y.svc, head: y.head || 0, staff: [] })), notes: x.notes || '', urgent: !!x.urgent, _pendingId: x.id, date: x.by && x.by > bkToday() ? bkToday() : BK.date }); break; }
    case 'bkj-waitoffer': { const b = bkRec(d.id); if (!b || !Bk.need('book')) return; bkHold(b, d.date, d.start, (d.staff || '').split(',').filter(Boolean)); bkDone(`New time held for ${Bk.who(b)} — waiting for the client`); break; }
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'bks-who') { BK.sheetStaff = t.value; renderAll(); }
  if (t.id === 'bks-date' && t.value) { BK.date = t.value; renderAll(); }
  if (t.dataset && t.dataset.bkstick != null) { const b = bkRec(t.dataset.id); if (!b) return; b.ticks = { ...(b.ticks || {}) }; if (t.checked) b.ticks[t.dataset.bkstick] = true; else delete b.ticks[t.dataset.bkstick]; touch(b); save(); Sync.soon(); }
});

/* ---------------- public holidays: check the worked-out list against an online list of WA holidays ---------------- */
const BK_HOL_SRC = 'https://date.nager.at/api/v3/PublicHolidays/', BK_HOL_GOV = 'https://www.wa.gov.au/service/employment/workplace-agreements/public-holidays-western-australia';
async function bkHolCheck() {
  if (!Bk.need('settings')) return; if (!navigator.onLine) { toast('Connect to the internet first'); return; }
  const y0 = new Date().getFullYear(); const years = [y0, y0 + 1]; let online = [];
  toast('Checking the WA public holidays…');
  try { for (const y of years) { const r = await fetch(BK_HOL_SRC + y + '/AU', { cache: 'no-store' }); if (!r.ok) throw new Error('status ' + r.status); const js = await r.json();
      js.filter((x) => (!x.counties || x.counties.includes('AU-WA')) && (!x.types || x.types.includes('Public'))).forEach((x) => online.push({ date: x.date, name: x.localName || x.name })); } }
  catch (e) { await askBox("Couldn't check online", `<p>The online list of public holidays couldn't be reached (${h(e.message || 'no answer')}).</p><p>You can check by hand on the <a href="${BK_HOL_GOV}" target="_blank" rel="noopener">WA government public holidays page</a>: tick <b>We work</b> for a day that isn't a holiday, or <b>➕ Practice closure</b> to add one.</p>`, 'OK', false, 'Close'); return; }
  const c0 = bkHolCfg(); const mine = years.flatMap((y) => bkWaOfficial(y)); const onDates = new Set(online.map((x) => x.date)), myDates = new Set(mine.map((x) => x.date));
  const adds = online.filter((x, i, a) => !myDates.has(x.date) && a.findIndex((z) => z.date === x.date) === i), drops = mine.filter((x) => !onDates.has(x.date));
  let r = Bk.get('hols'); if (!r) { r = { id: 'hols', cfg: 'hols', name: 'Public holidays', work: {}, extra: [] }; D.bkcfg.push(r); }
  const stamp = (n) => { r.checked = { at: Date.now(), by: SBAuth.staff && SBAuth.staff.id, n, updated: n ? Date.now() : ((c0.checked || {}).updated || null) }; touch(r); };
  if (!adds.length && !drops.length) { stamp(0); bkDone(`✓ WA public holidays checked for ${years.join(' and ')} — no changes`); return; }
  const row = (x, k, on, why) => `<label class="bk-radio" style="display:flex;margin:6px 0"><input type="checkbox" data-askchk="${k}" ${on ? 'checked' : ''}> <span><b>${bkDate(x.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b> — ${h(x.name)} <span class="hint">${why}</span></span></label>`;
  const ok = await askBox('Public holiday changes found', `<p class="hint">Compared with an online list of WA public holidays for ${years.join(' and ')}. Tick the changes to make. If unsure, check the <a href="${BK_HOL_GOV}" target="_blank" rel="noopener">WA government list</a> first.</p>
    ${adds.length ? `<div class="lbl">On the online list but not in the app — add them</div>${adds.map((x, i) => row(x, 'ha_' + i, true, '')).join('')}` : ''}
    ${drops.length ? `<div class="lbl" style="margin-top:8px">In the app but not on the online list — remove them?</div>${drops.map((x, i) => row(x, 'hd_' + i, false, '(left unticked — online lists sometimes miss WA-only days such as Easter Sunday or the extra Monday)')).join('')}` : ''}`, 'Make these changes', false, 'Cancel');
  if (!ok) return; let n = 0; r.add = [...(r.add || [])]; r.drop = { ...(r.drop || {}) };
  adds.forEach((x, i) => { if (ASK_FORM['ha_' + i]) { r.add.push({ date: x.date, name: x.name }); n++; } }); drops.forEach((x, i) => { if (ASK_FORM['hd_' + i]) { r.drop[x.date] = true; n++; } });
  stamp(n); bkDone(n ? `${n} public holiday change${n === 1 ? '' : 's'} made` : 'Checked — nothing changed');
}
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=bks-holcheck],[data-act=bkj-holcheck]'); if (el) bkHolCheck(); });
