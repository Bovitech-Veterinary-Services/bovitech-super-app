/* Bovitech Super App — Scheduling, part 3 of 4: the forms and the taps.
   The appointment form (client, farms and yards in visiting order, herds / flocks, procedures and who, lunch during
   the appointment, repeats, its own look, times free that day with the working shown), saving (lunch moved out of the
   way, farm rules, repeating series — this one / this and following / all), held new times, tidying a day after a
   cancellation or move, blocks (with the same three choices), lunch, a person's day (available / not, start and finish
   place), the Scheduling settings forms, and every tap. */
'use strict';
let BKF = null; // the appointment being edited

/* ---------------- client search: only the kinds of client this appointment type can be booked for ---------------- */
function bkWhoOf(typeRec) { return typeRec.who || (typeRec.cfg === 'blocktype' ? {} : BK_WHO_DEF); }
function bkClientOk(who, bid, cid) {
  const b = bid && IDX.biz.get(bid); if (b) return isClientBiz(b) ? !!who.clientBiz : !!who.nonclientBiz;
  const c = cid && D.contacts.find((x) => x.id === cid); if (!c) return false; return (typeof isClientPerson === 'function' ? isClientPerson(c) : true) ? !!who.clientInd : !!who.nonclientInd;
}
function bkClientResults(q, who) {
  q = (q || '').trim().toLowerCase(); if (q.length < 2) return []; who = who || BK_WHO_DEF;
  const bz = D.businesses.filter((b) => (b.name || '').toLowerCase().includes(q) && bkClientOk(who, b.id)).slice(0, 8).map((b) => ({ bid: b.id, label: b.name, sub: (isClientBiz(b) ? 'client business' : 'non-client business') + ' · ' + (IDX.bizContacts.get(b.id) || []).map(fullName).slice(0, 3).join(', ') }));
  const cs = D.contacts.filter((c) => fullName(c).toLowerCase().includes(q) || (c.mobiles || []).some((m) => (m.value || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')))).slice(0, 20).map((c) => { const b = bizOf(c).find((x) => bkClientOk(who, x.id));
    if (b) return { cid: c.id, bid: b.id, label: fullName(c), sub: b.name }; if (bkClientOk(who, null, c.id)) return { cid: c.id, bid: null, label: fullName(c), sub: 'as an individual' }; return null; }).filter(Boolean).slice(0, 8);
  return [...bz, ...cs].slice(0, 12);
}
function bkFarmsOf(bid) { const b = bid && IDX.biz.get(bid); return b ? b.farmLinks.filter((l) => !l.past).map((l) => IDX.farms.get(l.fid)).filter(Boolean) : []; }
function bkContactsOf(bid) { return bid ? IDX.bizContacts.get(bid) || [] : []; }
function bkMobile(c) { return c && ((c.mobiles || [])[0] || {}).value; }
function bkPidsOf(bid) { const b = bid && IDX.biz && IDX.biz.get(bid); return b ? (b.patientIds || []).filter((p) => p && p.value) : []; }
function bkWarnHtml(list) { return list.length ? `<div class="bk-warnbox">${list.map((x) => `<div>⚠ ${h(x)}</div>`).join('')}</div>` : ''; }
function bkFormStaff(f) { f.staff = [...new Set((f.svcs || []).flatMap((x) => x.staff || []))]; return f; } // everyone on the appointment = everyone on any of its procedures
function bkTimeOpts(sel, from, to) { let o = ''; for (let m = from; m <= to; m += 15) o += `<option value="${bkHHMM(m)}" ${bkHHMM(m) === sel ? 'selected' : ''}>${bkTime(m)}</option>`; return o; }

/* ---------------- the appointment form ---------------- */
function bkFormHtml() {
  const f = BKF, types = Bk.cfg('type'), svcs = Bk.cfg('service'), t = Bk.type(f.type);
  const farms = bkFarmsOf(f.bid), cons = bkContactsOf(f.bid); const isNew = !Bk.list('bookings').includes(f._orig);
  const sug = bkSuggestMins(f.type, f.svcs, f.stops, f.lunch);
  const ppl = Bk.people(), pids = bkPidsOf(f.bid), bz = f.bid && IDX.biz.get(f.bid), farmT = t.where === 'farm', multi = farmT && f.stops.length > 1;
  const need = bkNeedsLabour(f), labourSvc = svcs.find((x) => x.alongside); const lc = Bk.lunchCfg();
  const farmOpts = (sel) => `<option value="">${farms.length ? 'Choose the farm…' : 'No farms saved for this client'}</option>${farms.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${h(x.name || x.address || 'Farm')}${h(bkFarmTag(x.id))}${x.driveMin != null ? ` (${Math.round(x.driveMin)} min from base)` : ''}</option>`).join('')}`;
  const yardOpts = (st) => { const fm = IDX.farms.get(st.fid); const ys = bkYardsOf(fm); return ys.length ? `<option value="">Which yards…</option>${ys.map((y) => `<option value="${y.yid}" ${y.yid === st.yid ? 'selected' : ''}>${h(y.name)}${h(bkYardTag(st.fid, y.yid))}</option>`).join('')}` : ''; };
  const series = f.series && Bk.get('series:' + f.series);
  return `<div class="grid2"><div class="f"><label for="bkf-type">Appointment type</label><select id="bkf-type">${types.map((x) => `<option value="${x.id}" ${x.id === f.type ? 'selected' : ''}>${h(x.name)}</option>`).join('')}</select></div>
    <div class="f"><label>Status</label><div class="bk-seg">${Object.entries(BK_STATUS).map(([v, l]) => `<label class="bk-radio"><input type="radio" name="bkf-status" value="${v}" ${(f.status || 'unconfirmed') === v ? 'checked' : ''}> ${l}</label>`).join('')}</div>${f.proposal ? '<div class="hint"><b>Reschedule pending approval</b> — see below</div>' : ''}</div></div>
  <div class="f"><label for="bkf-q">Client</label>${f.bid || f.cid ? `<div class="bk-picked"><b>${h(Bk.who(f))}</b>${!f.bid ? ' <span class="hint">(individual)</span>' : ''} <button type="button" class="btn small" data-act="bkf-clear">Change</button></div>${bkClientOk(bkWhoOf(t), f.bid, f.cid) ? '' : `<div class="bk-warnbox">${h(t.name)} appointments can only be booked ${h(bkWhoText(bkWhoOf(t)))}.</div>`}` : `<div class="search"><input id="bkf-q" placeholder="Search a business, person or mobile" autocomplete="off"></div><div id="bkf-res"></div><div class="hint">${h(t.name)}: ${h(bkWhoText(bkWhoOf(t)))}</div>`}</div>
  ${f.bid || f.cid ? `${farmT ? `<div class="f"><label for="bkf-farm0">Farms and yards${multi ? ' (in the order you\'ll visit them)' : ''}</label>${(f.stops.length ? f.stops : [{ fid: '', yid: null }]).map((st, i) => { const fm = st.fid && IDX.farms.get(st.fid); const noY = fm && !bkYardsOf(fm).length;
      return `<div class="bk-svcrow"><span class="hint">${i + 1}.</span><select id="bkf-farm${i}" data-bkfarm="${i}" aria-label="Farm ${i + 1}">${farmOpts(st.fid)}</select>${fm && !noY ? `<select id="bkf-yard${i}" data-bkyard="${i}" aria-label="Yards ${i + 1}">${yardOpts(st)}</select>` : ''}${f.stops.length > 1 ? `<button type="button" class="x" data-act="bkf-stopdel" data-i="${i}" aria-label="Remove this stop">×</button>` : ''}</div>${noY ? `<div class="bk-warnbox">${h(fm.name || 'This farm')} has no yards pin yet — add one (Contacts → the farm → 📍 pins) before it can be booked. <button type="button" class="btn small" data-act="bkf-addyard" data-fid="${fm.id}">📍 Add a yards pin</button></div>` : ''}`; }).join('')}
      ${farms.length && f.stops.length && f.stops[f.stops.length - 1].fid ? '<button type="button" class="btn small" data-act="bkf-stopadd">➕ Another farm / yards</button>' : ''}${multi ? '<div class="hint">Travel is worked out to the first stop and home from the last; driving between them is added to the length. The same yards can be visited more than once.</div>' : ''}</div>` : ''}
    <div class="grid2"><div class="f"><label for="bkf-con">SMS goes to</label><select id="bkf-con"><option value="">Nobody</option>${(cons.length ? cons : f.cid ? D.contacts.filter((c) => c.id === f.cid) : []).map((c) => `<option value="${c.id}" ${c.id === f.cid ? 'selected' : ''} ${bkMobile(c) ? '' : 'disabled'}>${h(fullName(c))}${bkMobile(c) ? ' · ' + h(bkMobile(c)) : ' (no mobile)'}</option>`).join('')}</select></div>
    <div class="f"><label>Herds / flocks</label>${pids.length ? `<div class="checks">${pids.map((p, i) => `<label><input type="checkbox" data-bkpid="${i}" ${f.pids.some((q) => q.value === p.value) ? 'checked' : ''}> ${typeof pidEmo === 'function' ? pidEmo(p) : ''}${h(p.value)}${p.label ? ` <span class="hint">${h(p.label)}</span>` : ''}</label>`).join('')}</div><div class="hint">Tick each one this visit is for — each gets its own clinical record.</div>` : `<div class="hint">${bz ? 'No herd or flock IDs saved for this business yet — add them under Patient IDs on the business page.' : 'Choose a business to pick the herd or flock.'}</div>`}</div></div>` : ''}
  <div class="f"><label>Procedures, and who</label>${(f.svcs.length ? f.svcs : [{ staff: [] }]).map((x, i) => { const sv = x.svc && Bk.svc(x.svc); const st = f.stops[x.stop || 0] || f.stops[0]; const y = sv && sv.mode === 'perhead' && sv.rateFrom === 'farm' && st ? bkRate(st.fid, st.yid, x.svc) : null; const who = x.staff || [];
    return `<div class="bk-svcblk ${sv && sv.alongside ? 'along' : ''}"><div class="bk-svcrow"><select data-bksvc="${i}" aria-label="Procedure ${i + 1}"><option value="">Choose…</option>${svcs.map((s) => `<option value="${s.id}" ${s.id === x.svc ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select>${sv && sv.mode === 'perhead' ? `<input type="number" min="0" inputmode="numeric" data-bkhead="${i}" value="${x.head || ''}" aria-label="Head"><span class="hint">head</span>${st && st.fid ? `<input type="number" min="1" inputmode="numeric" data-bkhph="${i}" value="${x.hph || (y && y.hph) || sv.hph || ''}" aria-label="Head per hour"><span class="hint">per hour here</span>` : ''}` : ''}${sv && sv.alongside ? '<span class="hint">runs alongside — doesn\'t add time</span>' : ''}<button type="button" class="x" data-act="bkf-svcdel" data-i="${i}" aria-label="Remove">×</button></div>
      ${multi && sv && !sv.alongside ? `<div class="bk-svcrow"><span class="hint">At</span><select data-bksstop="${i}" aria-label="Which stop">${f.stops.map((s2, j) => `<option value="${j}" ${j === (x.stop || 0) ? 'selected' : ''}>${j + 1}. ${h(Bk.stopName(s2))}</option>`).join('')}</select></div>` : ''}
      <div class="bk-who"><span class="hint">Who:</span>${ppl.map((s) => { const bad = x.svc && !Bk.canDo(s, x.svc); return `<label class="bk-pp ${bad ? 'bad' : ''}" title="${bad ? 'Not set up for ' + h(sv.name) : ''}"><input type="checkbox" data-bkwho="${i}" data-staff="${s.id}" ${who.includes(s.id) ? 'checked' : ''}> ${h(s.preferred_name || s.full_name)}</label>`; }).join('') || '<span class="hint">The staff list loads the first time you sign in with internet.</span>'}</div></div>`; }).join('')}
    <button type="button" class="btn small" data-act="bkf-svcadd">➕ Another procedure</button>${labourSvc && !f.svcs.some((x) => x.svc && Bk.svc(x.svc).alongside) ? ` <button type="button" class="btn small" data-act="bkf-labour">➕ ${h(labourSvc.name)}</button>` : ''}
    ${need && !f.noLabour ? `<div class="bk-warnbox bk-labour">${need === 'always' ? `⚠ <b>${h(Bk.who(f))}</b> always needs ${h((labourSvc || { name: 'additional labour' }).name.toLowerCase())}.` : `Do you want ${h((labourSvc || { name: 'additional labour' }).name.toLowerCase())} booked for this?`}<div class="actions" style="margin-top:6px"><button type="button" class="btn small primary" data-act="bkf-labour">Yes — add it</button><button type="button" class="btn small" data-act="bkf-nolabour">${need === 'always' ? 'Not this time' : 'No'}</button></div></div>` : ''}
    ${need === 'always' && f.noLabour ? `<div class="hint">No additional labour this time (this client usually needs it). <button type="button" class="btn small" data-act="bkf-labour">Add it</button></div>` : ''}
    ${farmT && f.stops.length && f.svcs.some((x) => x.svc && Bk.svc(x.svc).mode === 'perhead' && Bk.svc(x.svc).rateFrom === 'farm') ? '<div class="hint">Change the "per hour here" number to match how fast these yards run — tick below to remember it (it shows on the business page too).</div>' : ''}</div>
  <div class="grid2"><div class="f"><label for="bkf-mins">How long (minutes)</label><input id="bkf-mins" type="number" min="5" step="5" inputmode="numeric" value="${f.mins}"><div class="hint" id="bkf-why">Suggested ${bkDur(sug.mins)} — ${h(sug.why)} ${f.mins !== sug.mins ? `<button type="button" class="btn small" data-act="bkf-usesug">Use ${bkDur(sug.mins)}</button>` : ''}</div></div>
    <div class="f"><label>&nbsp;</label>${farmT && f.stops.length && f.svcs.some((x) => x.svc && Bk.svc(x.svc).mode === 'perhead' && Bk.svc(x.svc).rateFrom === 'farm') ? `<label class="bk-radio"><input type="checkbox" id="bkf-rememberyard" ${f.rememberYard ? 'checked' : ''}> Remember the speed for these yards</label>` : ''}
      ${lc.on ? `<label class="bk-radio" style="margin-top:6px"><input type="checkbox" id="bkf-lunchon" ${f.lunch ? 'checked' : ''}> Lunch break during this appointment</label>${f.lunch ? `<select id="bkf-lunchat" aria-label="Lunch time">${bkTimeOpts(f.lunch.start, f.start ? bkMin(f.start) : bkMin(lc.from), f.start ? bkMin(f.start) + Math.max(0, f.mins - lc.mins) : bkMin(lc.to) - lc.mins)}</select>` : ''}` : ''}</div></div>
  <div class="grid2"><div class="f"><label for="bkf-date">Date</label><input id="bkf-date" type="date" value="${f.date || ''}"></div><div class="f"><label for="bkf-start">Start time</label><input id="bkf-start" type="time" step="900" value="${f.start || ''}"><div class="hint">On the quarter hour.</div></div></div>
  <div class="actions"><button type="button" class="btn" data-act="bkf-dayslots">⏱ Times free on this day</button><button type="button" class="btn" data-act="bkf-suggest">🔎 Suggest days and people</button><label class="bk-radio"><input type="checkbox" id="bkf-urgent" ${f.urgent ? 'checked' : ''}> ⚡ Urgent — soonest first</label></div>
  <div id="bkf-sugg"></div><div id="bkf-warn">${bkWarnHtml(bkProblems(bkFormStaff(f)))}</div>
  ${isNew ? `<div class="grid2"><div class="f"><label for="bkf-rep">Repeats</label><select id="bkf-rep">${BK_REPEATS.map(([v, l]) => `<option value="${v}" ${((f.repeat || {}).every || 'none') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>${(f.repeat || {}).every && f.repeat.every !== 'none' ? `<div class="f"><label for="bkf-repuntil">Until</label><input id="bkf-repuntil" type="date" value="${f.repeat.until || ''}"><div class="hint">Empty = a year ahead.</div></div>` : ''}</div>${['weekly', 'fortnightly'].includes((f.repeat || {}).every) ? `<div class="f"><label>On these days</label><div class="checks">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" data-bkrepday="${d}" ${((f.repeat.days && f.repeat.days.length) ? f.repeat.days : [f.date ? bkDow(f.date) : 1]).includes(d) ? 'checked' : ''}> ${DOW_NAMES[d]}</label>`).join('')}</div></div>` : ''}`
    : series ? `<div class="hint" style="margin:6px 0">🔁 ${h(bkRuleText(series.rule, series.anchor))} · ${Bk.list('bookings').filter((b) => b.series === f.series && Bk.live(b)).length} in the series. Changes ask whether they're for this one, this and the following ones, or all of them. <button type="button" class="btn small" data-act="bkf-rerule">Change the repeat from here</button></div>` : ''}
  ${isNew ? `<label class="bk-radio" style="margin:8px 0"><input type="checkbox" id="bkf-sms" ${f.sms.send ? 'checked' : ''}> Send the "booking made" SMS${f.cid && bkMobile(D.contacts.find((c) => c.id === f.cid)) ? '' : ' <span class="hint">(choose who it goes to above)</span>'}</label>` : `<div class="hint" style="margin:8px 0">${bkSmsStatus(f)}</div>`}
  <label class="bk-radio" style="margin:0 0 8px"><input type="checkbox" id="bkf-rem" ${f.sms.noReminder ? '' : 'checked'}> Send a reminder SMS 5 days before (8:30am)</label>
  ${bkLookField(f, t, 'bkl')}
  ${!isNew ? bkTextsHtml(f) : ''}
  <div class="f"><label for="bkf-notes">Notes</label><textarea id="bkf-notes" rows="3">${h(f.notes || '')}</textarea></div>
  ${!isNew ? bkExistingActions(f) : ''}`;
}
function bkExistingActions(f) {
  const p = f.proposal;
  return `<div class="card bk-actions"><div class="lbl">${p ? 'Reschedule pending approval' : 'Change this appointment'}</div>
  ${p ? `<p>Suggested <b>${bkDate(p.date)} ${bkTime(p.start)}</b> with ${h((p.staff || f.staff).map(Bk.pname).join(', '))}. That time is held on the calendar, and the original stays put until the client answers.</p>${bkWarnHtml(bkProblems(f, p))}
    <div class="actions"><button type="button" class="btn primary" data-act="bkf-propyes">✓ Client agreed — move it</button><button type="button" class="btn" data-act="bkf-propno">Client said no — keep the original</button><button type="button" class="btn small" data-act="bkf-propose">Change the suggested time</button></div>`
    : `<div class="actions"><button type="button" class="btn" data-act="bkf-propose">↔ Suggest a new time to the client</button><button type="button" class="btn" data-act="bkf-dup">⧉ Duplicate</button><button type="button" class="btn" data-act="bkf-cancel" style="color:var(--red)">Cancel appointment</button></div>`}
  <div class="hint" style="margin-top:6px">Booked ${f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}${f.by ? ' by ' + h(Bk.pname(f.by)) : ''}. To move it straight away (no need to ask the client), just change the date or time above and Save.</div></div>`;
}
function bkFormRead() {
  const f = BKF, q = (id) => document.getElementById(id); if (!q('bkf-type')) return;
  const oldType = f.type; f.type = q('bkf-type').value;
  const st = document.querySelector('input[name=bkf-status]:checked'); if (st) f.status = st.value;
  const fe = [...document.querySelectorAll('[data-bkfarm]')]; if (fe.length) f.stops = fe.map((el) => { const i = +el.dataset.bkfarm; const ye = document.querySelector(`[data-bkyard="${i}"]`); const old = f.stops[i] || {}; return { fid: el.value || '', yid: el.value && el.value === old.fid && ye ? ye.value || null : el.value && ye && el.value === old.fid ? ye.value || null : null }; });
  // a yard select belongs to the farm it was drawn for; a newly chosen farm starts with no yards picked (unless it has only one)
  f.stops = f.stops.map((s) => { if (s.fid && !s.yid) { const ys = bkYardsOf(IDX.farms.get(s.fid)); if (ys.length === 1) return { ...s, yid: ys[0].yid }; } return s; }).filter((s, i, a) => s.fid || a.length === 1);
  if (f.stops.length === 1 && !f.stops[0].fid) f.stops = [];
  f.fids = Bk.fids(f); f.fid = f.fids[0] || null; if (q('bkf-con')) f.cid = q('bkf-con').value || (f.bid ? null : f.cid);
  const pids = bkPidsOf(f.bid); if (document.querySelector('[data-bkpid]')) f.pids = [...document.querySelectorAll('[data-bkpid]:checked')].map((el) => pids[+el.dataset.bkpid]).filter(Boolean).map((p) => ({ value: p.value, label: p.label || '' }));
  document.querySelectorAll('[data-bksvc]').forEach((el) => { const i = +el.dataset.bksvc; f.svcs[i] = f.svcs[i] || { staff: [] }; f.svcs[i].svc = el.value; });
  document.querySelectorAll('[data-bkhead]').forEach((el) => { f.svcs[+el.dataset.bkhead].head = +el.value || 0; });
  document.querySelectorAll('[data-bkhph]').forEach((el) => { f.svcs[+el.dataset.bkhph].hph = +el.value || null; });
  document.querySelectorAll('[data-bksstop]').forEach((el) => { f.svcs[+el.dataset.bksstop].stop = +el.value || 0; });
  const who = {}; document.querySelectorAll('[data-bkwho]').forEach((el) => { const i = +el.dataset.bkwho; who[i] = who[i] || []; if (el.checked) who[i].push(el.dataset.staff); });
  Object.keys(who).forEach((i) => { if (f.svcs[i]) f.svcs[i].staff = who[i]; });
  f.svcs.forEach((x) => { if (x.stop && x.stop >= f.stops.length) x.stop = 0; });
  f.svcs = f.svcs.filter((x, i, a) => x.svc || a.length === 1);
  bkFormStaff(f);
  f.mins = +q('bkf-mins').value || f.mins;
  f.date = q('bkf-date').value; f.start = q('bkf-start').value; f.urgent = q('bkf-urgent').checked; f.notes = q('bkf-notes').value;
  if (q('bkf-lunchon')) { if (q('bkf-lunchon').checked) f.lunch = { start: (q('bkf-lunchat') && q('bkf-lunchat').value) || (f.lunch && f.lunch.start) || bkDefLunchIn(f) }; else f.lunch = null; }
  if (q('bkf-rep')) f.repeat = { every: q('bkf-rep').value, until: (q('bkf-repuntil') || {}).value || null, days: [...document.querySelectorAll('[data-bkrepday]:checked')].map((el) => +el.dataset.bkrepday) };
  if (q('bkf-sms')) f.sms.send = q('bkf-sms').checked; if (q('bkf-rem')) f.sms.noReminder = !q('bkf-rem').checked; if (q('bkf-rememberyard')) f.rememberYard = q('bkf-rememberyard').checked;
  if (document.querySelector('input[name="bkl-lookmode"]')) f.look = bkLookRead('bkl');
  return oldType !== f.type;
}
function bkDefLunchIn(f) { const lc = Bk.lunchCfg(); const s = f.start ? bkMin(f.start) : bkMin(lc.def); const want = Math.min(Math.max(bkMin(lc.def), s), s + Math.max(0, (f.mins || 60) - lc.mins)); return bkHHMM(Math.round(want / 15) * 15); }
function bkFormRefresh(full) {
  const form = document.querySelector('#sheet .form'); if (!form || !BKF) return;
  if (full) { const y = form.scrollTop; form.innerHTML = bkFormHtml(); form.scrollTop = y; bkFormBindSearch(); return; }
  const mi = document.getElementById('bkf-mins'); if (mi && +mi.value !== BKF.mins) mi.value = BKF.mins;
  const w = document.getElementById('bkf-warn'); if (w) w.innerHTML = bkWarnHtml(bkProblems(bkFormStaff(BKF)));
  const sug = bkSuggestMins(BKF.type, BKF.svcs, BKF.stops, BKF.lunch); const why = document.getElementById('bkf-why');
  if (why) why.innerHTML = `Suggested ${bkDur(sug.mins)} — ${h(sug.why)} ${BKF.mins !== sug.mins ? `<button type="button" class="btn small" data-act="bkf-usesug">Use ${bkDur(sug.mins)}</button>` : ''}`;
}
function bkFormBindSearch() {
  const q = document.getElementById('bkf-q'); if (!q) return;
  q.addEventListener('input', () => { const r = bkClientResults(q.value, bkWhoOf(Bk.type(BKF.type))); document.getElementById('bkf-res').innerHTML = r.map((x) => `<button type="button" class="bk-res" data-act="bkf-client" data-bid="${x.bid || ''}" data-cid="${x.cid || ''}"><b>${h(x.label)}</b><span class="hint">${h(x.sub || '')}</span></button>`).join('') || (q.value.trim().length > 1 ? '<div class="hint">No match for this appointment type</div>' : ''); });
  setTimeout(() => q.focus(), 50);
}
function bkAutoMins() { if (!BKF._minsTouched) BKF.mins = bkSuggestMins(BKF.type, BKF.svcs, BKF.stops, BKF.lunch).mins; }
async function bkStopCheck(st) { // pop up a warning straight away when do-not-service (or safety-stop) yards are chosen
  const hard = bkStopIssues(st, BKF.svcs, BKF.stops).filter((x) => x.hard); if (!hard.length) return;
  const ok = await askBox('⛔ Check these yards', `${hard.map((x) => `<p style="font-size:16px;font-weight:600;color:var(--red)">${h(x.msg)}</p>`).join('')}<p class="hint">You can still book it if you've checked it's OK.</p>`, 'Book it anyway', true, 'Take it off');
  if (ok) { BKF._farmOk = true; return; }
  BKF.stops = BKF.stops.filter((x) => !(x.fid === st.fid && (x.yid || null) === (st.yid || null))); BKF.fids = Bk.fids(BKF); BKF.fid = BKF.fids[0] || null; bkAutoMins(); bkFormRefresh(true);
}
function bkOpen(b, preset) {
  if (!b && !Bk.need('book')) return;
  const types = Bk.cfg('type'); if (!types.length) { toast('Scheduling settings are still loading — sync, then try again'); return; }
  const orig = b || null; preset = preset || {};
  BKF = b ? bkClone(b) : { id: uid('bk'), type: types[0].id, status: 'unconfirmed', staff: [], svcs: [{ staff: [...(preset.staff || [])] }], mins: 60, date: BK.date, start: '', sms: { send: true }, notes: '', ...preset };
  BKF._orig = orig; BKF.sms = BKF.sms || { send: true }; delete BKF.suggestNow; BKF.status = BKF.status || 'unconfirmed';
  BKF.stops = bkClone(Bk.stops(BKF)); BKF.fids = Bk.fids(BKF); BKF.fid = BKF.fids[0] || null; BKF.pids = BKF.pids || [];
  BKF.svcs = (BKF.svcs && BKF.svcs.length ? BKF.svcs : [{ staff: [...(BKF.staff || [])] }]).map((x) => { const o = { ...x, staff: [...Bk.sstaff(BKF, x)] }; if (o.fid != null && o.stop == null) { const j = BKF.stops.findIndex((s) => s.fid === o.fid); o.stop = j < 0 ? 0 : j; } delete o.fid; return o; });
  if (!b) { if (BKF.bid && !BKF.stops.length) { const fs = bkFarmsOf(BKF.bid); if (fs.length === 1) { const ys = bkYardsOf(fs[0]); BKF.stops = [{ fid: fs[0].id, yid: ys.length === 1 ? ys[0].yid : null }]; } } const ps = bkPidsOf(BKF.bid); if (ps.length === 1 && !BKF.pids.length) BKF.pids = [{ value: ps[0].value, label: ps[0].label || '' }]; }
  bkFormStaff(BKF);
  openSheet(b ? 'Appointment — ' + Bk.who(b) : 'New appointment', bkFormHtml(), async () => bkSaveForm());
  const form = document.querySelector('#sheet .form');
  form.addEventListener('change', (e) => { const before = bkClone(BKF.stops); const typeChanged = bkFormRead(); const id = e.target.id || ''; const dd = e.target.dataset;
    if (id === 'bkf-start' && e.target.value && bkMin(e.target.value) % 15) { BKF.start = bkRound15(e.target.value); e.target.value = BKF.start; toast('Appointments start on the quarter hour — ' + bkTime(BKF.start)); }
    const full = typeChanged || dd.bkfarm != null || dd.bkyard != null || dd.bksstop != null || id === 'bkf-con' || dd.bksvc != null || e.target.name === 'bkf-status' || dd.bkwho != null || id === 'bkf-lunchon' || id === 'bkf-rep';
    if (typeChanged || dd.bksvc != null || dd.bkhead != null || dd.bkhph != null || dd.bkfarm != null || dd.bkyard != null || dd.bksstop != null || id === 'bkf-lunchon') bkAutoMins();
    if (id === 'bkf-mins') BKF._minsTouched = true;
    bkFormRefresh(full);
    if (dd.bkyard != null || dd.bkfarm != null) { const i = +(dd.bkyard ?? dd.bkfarm); const st = BKF.stops[i]; const was = before[i] || {}; if (st && st.fid && (st.fid !== was.fid || st.yid !== was.yid)) bkStopCheck(st); } });
  form.addEventListener('input', (e) => { if (e.target.dataset.bkhph != null) { const i = +e.target.dataset.bkhph; BKF.svcs[i].hph = +e.target.value || null; BKF.rememberYard = true; const cb = document.getElementById('bkf-rememberyard'); if (cb) cb.checked = true; } });
  bkFormBindSearch();
  if (preset.suggestNow) setTimeout(() => document.querySelector('[data-act=bkf-suggest]') && document.querySelector('[data-act=bkf-suggest]').click(), 100);
}
function bkAddLabour() { const l = Bk.cfg('service').find((x) => x.alongside); if (!l) { toast('There is no additional labour procedure in Settings → Scheduling'); return false; } BKF.svcs = BKF.svcs.filter((x) => x.svc); BKF.svcs.push({ svc: l.id, staff: [] }); BKF.noLabour = false; bkFormRefresh(true); return true; }

/* ---------------- saving an appointment ---------------- */
const BK_SERIES_FIELDS = ['type', 'bid', 'cid', 'stops', 'fids', 'fid', 'pids', 'svcs', 'mins', 'start', 'notes', 'look', 'lunch', 'urgent', 'noLabour'];
async function bkScope(what, verb) { // "this one / this and following / all" — like Google Calendar
  const ok = await askBox(`${verb} a repeating ${what}`, `<div class="checks" style="flex-direction:column;align-items:flex-start">${[['this', `This ${what} only`], ['following', `This and the following ${what}s`], ['all', `All ${what}s (past and future)`]].map(([v, l], i) => `<label style="font-size:16px"><input type="radio" name="bk-scope" value="${v}" data-ask="scope" ${i ? '' : 'checked'}> ${l}</label>`).join('')}</div>`, 'OK', false, 'Cancel');
  if (!ok) return null; return ASK_FORM.scope || 'this';
}
function bkRec(id) { return Bk.list('bookings').find((b) => b.id === id); }
function bkDone(msg) { save(); Sync.soon(); renderAll(); if (msg) toast(msg); }
async function bkLunchSort(rec) { // move lunch out of the way of this appointment (inside the usual window if possible; outside only if you agree)
  if (rec.lunch && rec.lunch.start) return; const lc = Bk.lunchCfg(); if (!lc.on) return; const s0 = bkMin(rec.start), e0 = s0 + rec.mins; const add = { s: s0, e: e0, loc: Travel.loc(rec), locOut: Travel.locOut(rec), ref: rec };
  for (const sid of rec.staff || []) { const lu = Bk.lunch(sid, rec.date); if (!lu || lu.inAppt) continue; const ls = bkMin(lu.start);
    const plan = BKF && BKF._lunchPlan && BKF._lunchPlan[sid];
    const day = bkDay(sid, rec.date, { skipId: rec.id, add, noLunch: true }); const clash = (m) => day.items.some((x) => x.s < m + lc.mins && x.e > m) || day.legs.some((l) => l.start < m + lc.mins && l.end > m);
    if (plan != null && !clash(plan)) { if (bkLunchOutside(plan) && !(await ask(`Move ${Bk.pname(sid)}'s lunch to ${bkTime(plan)}? That's outside the usual ${bkTime(lc.from)}–${bkTime(lc.to)}.`, 'Yes — move it'))) continue; bkSetLunch(sid, rec.date, plan); toast(`${Bk.pname(sid)}'s lunch moved to ${bkTime(plan)}`); continue; }
    if (!clash(ls)) continue;
    const fit = bkLunchFit(sid, rec.date, { skipId: rec.id, add }); if (fit != null) { bkSetLunch(sid, rec.date, fit); toast(`${Bk.pname(sid)}'s lunch moved to ${bkTime(fit)}–${bkTime(fit + lc.mins)}`); continue; }
    const any = bkLunchFree(sid, rec.date, { skipId: rec.id, add });
    if (any != null && await ask(`There's no time for ${Bk.pname(sid)}'s lunch between ${bkTime(lc.from)} and ${bkTime(lc.to)} now. Move it to ${bkTime(any)}?`, 'Yes — move it')) bkSetLunch(sid, rec.date, any);
  }
}
async function bkSaveForm(skipRead) { // skipRead: the caller has already read the form and then changed BKF (moving it, cancelling…) — reading again would undo that
  if (!skipRead) bkFormRead(); const f = BKF; bkFormStaff(f); const t = Bk.type(f.type);
  if (!f.bid && !f.cid) { toast('Choose the client'); return false; }
  if (!skipRead && !bkClientOk(bkWhoOf(t), f.bid, f.cid)) { toast(`${t.name} appointments can only be booked ${bkWhoText(bkWhoOf(t))}`); return false; }
  if (!f.svcs.some((x) => x.svc) && !t.fixedMins) { toast('Choose the procedure'); return false; }
  const nobody = f.svcs.find((x) => x.svc && !(x.staff || []).length); if (nobody) { toast(`Choose who's doing ${Bk.svc(nobody.svc).name}`); return false; }
  if (!f.staff.length) { toast('Choose who'); return false; }
  if (!f.date || !f.start) { toast('Choose the date and start time'); return false; }
  if (bkMin(f.start) % 15) f.start = bkRound15(f.start);
  if (!skipRead && bkPidsOf(f.bid).length && !f.pids.length) { toast('Choose which herd or flock this is for'); return false; }
  if (!skipRead && t.where === 'farm') {
    if (!f.stops.length) { toast('Choose the farm and yards'); return false; }
    const noY = f.stops.find((s) => !bkYardsOf(IDX.farms.get(s.fid)).length); if (noY) { toast(`${(IDX.farms.get(noY.fid) || {}).name || 'That farm'} has no yards pin yet — add one first`); return false; }
    const noPick = f.stops.find((s) => !s.yid); if (noPick) { toast(`Choose which yards at ${(IDX.farms.get(noPick.fid) || {}).name || 'the farm'}`); return false; }
  }
  if (f.status !== 'cancelled' && !skipRead) {
    const need = bkNeedsLabour(f);
    if (need && !f.noLabour) { const r = await askBox('Additional labour?', `<p style="font-size:16px">${need === 'always' ? `<b>${h(Bk.who(f))}</b> always needs additional labour. Book someone for it?` : 'Do you want additional labour booked for this?'}</p>`, 'Yes — add additional labour', false, '‹ Back to the appointment', 'No — not needed');
      if (r === true) { if (bkAddLabour()) toast('Choose who is doing the additional labour, then Save'); return false; } if (r !== 'alt') return false; f.noLabour = true; }
    const hard = t.where === 'farm' ? f.stops.flatMap((s) => bkStopIssues(s, f.svcs, f.stops)).filter((x) => x.hard) : [];
    if (hard.length && !f._farmOk && !(await ask(hard.map((x) => '⛔ ' + x.msg).join('\n') + '\n\nBook it anyway?', 'Yes — book anyway', true))) return false;
  }
  // remember the yard speed (for these yards when the farm has its own rate per yard, otherwise for the farm)
  if (f.rememberYard) f.svcs.forEach((x) => { const st = f.stops[x.stop || 0] || f.stops[0]; if (!st || !x.svc || !x.hph || Bk.svc(x.svc).mode !== 'perhead' || Bk.svc(x.svc).rateFrom !== 'farm') return; const per = Bk.fsched(st.fid).ratesPerYard && st.yid;
    const id = per ? `yrate:${st.fid}:${st.yid}:${x.svc}` : 'yard:' + st.fid + ':' + x.svc; let y = Bk.get(id); if (!y) { y = { id, cfg: per ? 'yrate' : 'yard', fid: st.fid, yid: per ? st.yid : undefined, svc: x.svc }; D.bkcfg.push(y); } if (y.hph !== x.hph || y.gone) { y.hph = x.hph; delete y.gone; touch(y); } });
  const rec = { ...f }; ['_orig', 'rememberYard', '_minsTouched', '_farmOk', '_lunchPlan', 'repeat'].forEach((k) => delete rec[k]);
  rec.svcs = f.svcs.filter((x) => x.svc).map((x) => { const o = { svc: x.svc, head: x.head || 0, staff: [...(x.staff || [])] }; if (x.stop) o.stop = x.stop; if (x.hph) o.hph = x.hph; return o; });
  rec.stops = f.stops.map((s) => ({ fid: s.fid, yid: s.yid || null })); rec.fids = Bk.fids(rec); rec.fid = rec.fids[0] || null; if (!rec.noLabour) delete rec.noLabour; if (!rec.look) delete rec.look; if (!rec.lunch) delete rec.lunch;
  const orig = f._orig; const before = orig ? bkClone(orig) : null;
  if (orig) {
    let scope = 'this'; if (orig.series && !skipRead) { scope = await bkScope('appointment', 'Change'); if (!scope) return false; }
    Object.keys(orig).forEach((k) => delete orig[k]); Object.assign(orig, rec); touch(orig);
    if (scope !== 'this') bkSeriesApply(before, rec, scope);
  } else {
    rec.createdAt = Date.now(); rec.by = SBAuth.staff && SBAuth.staff.id;
    const rep = f.repeat && f.repeat.every && f.repeat.every !== 'none' ? f.repeat : null;
    if (rep) { const sid = uid('sr'); const dates = bkRuleDates(rep, rec.date, 60); const sr = { id: 'series:' + sid, cfg: 'series', name: Bk.who(rec) + ' — ' + bkRuleText(rep, rec.date), rule: rep, anchor: rec.date }; touch(sr); D.bkcfg.push(sr);
      dates.forEach((d, i) => { const r = i ? { ...bkClone(rec), id: uid('bk'), date: d } : rec; r.series = sid; if (i) r.sms = { ...r.sms, send: false }; touch(r); Bk.list('bookings').push(r); });
      toast(`${dates.length} appointments made (${bkRuleText(rep, rec.date)})`); }
    else { touch(rec); Bk.list('bookings').push(rec); }
  }
  await bkLunchSort(rec);
  BK.date = f.date; save(); Sync.soon(); setTimeout(renderAll, 0);
  if (before && Bk.live(before) && (before.date !== rec.date || before.start !== rec.start || rec.status === 'cancelled')) setTimeout(() => bkTidyAsk(before), 450);
  return true;
}
function bkSeriesApply(before, after, scope) { // copy a change to the other appointments in the series
  const changed = BK_SERIES_FIELDS.filter((k) => stable(before[k] ?? null) !== stable(after[k] ?? null)); const shift = before.date && after.date ? bkDays(before.date, after.date) : 0;
  const others = Bk.list('bookings').filter((b) => b.series === before.series && b.id !== after.id && Bk.live(b) && (scope === 'all' || b.date > before.date));
  others.forEach((b) => { changed.forEach((k) => { if (after[k] === undefined) delete b[k]; else b[k] = bkClone(after[k]); }); if (shift) b.date = bkAdd(b.date, shift); if (after.status === 'cancelled') b.status = 'cancelled'; touch(b); });
  if (others.length) toast(`Also changed ${others.length} other appointment${others.length === 1 ? '' : 's'} in the series`);
}
async function bkTidyAsk(before) { // after a cancellation or move: offer to bring that day's later appointments forward
  const list = bkTidy(before.staff || [], before.date, before.id); if (!list.length) return;
  const ok = await askBox('Make the day more efficient?', `<p>There's now a gap on <b>${bkDate(before.date, { weekday: 'long', day: 'numeric', month: 'short' })}</b>. These later appointments could start earlier. Tick the ones to suggest to the client — each becomes <b>reschedule pending approval</b> (the new-time text goes to the client) and stays where it is until they agree.</p>
    ${list.map((x, i) => `<label class="bk-radio" style="display:flex;margin:6px 0"><input type="checkbox" data-askchk="td_${i}" checked> ${h(Bk.who(x.b))}: ${bkTime(x.from)} → <b>${bkTime(x.to)}</b> <span class="hint">(${h((x.b.staff || []).map(Bk.pname).join(', '))})</span></label>`).join('')}`, 'Suggest the new times', false, 'No — leave them');
  if (!ok) return; let n = 0;
  list.forEach((x, i) => { if (!ASK_FORM['td_' + i]) return; x.b.proposal = { date: before.date, start: x.to, mins: x.b.mins, staff: [...(x.b.staff || [])], at: Date.now(), by: SBAuth.staff && SBAuth.staff.id, smsSent: null, tidy: true }; touch(x.b); n++; });
  if (n) { bkDone(`${n} new time${n === 1 ? '' : 's'} suggested — waiting for the client${n === 1 ? '' : 's'}`); if (SupaSync) SupaSync.kickSms = true; }
}
function bkProposeForm() {
  bkFormRead(); const f = BKF; const p = f.proposal || { date: f.date, start: f.start, mins: f.mins, staff: [...f.staff] };
  askBox('Suggest a new time', `<p class="hint">The original stays on the calendar. The new time is held so nobody books over it, until the client agrees.</p>
    <div class="grid2"><div class="f"><label for="bkp-date">New date</label><input id="bkp-date" data-ask="pdate" type="date" value="${p.date}"></div><div class="f"><label for="bkp-start">New start time</label><input id="bkp-start" data-ask="pstart" type="time" step="900" value="${p.start}"></div></div>
    <div class="f"><label>Who</label><div class="checks">${Bk.people().map((s) => `<label><input type="checkbox" data-askchk="ps_${s.id}" ${(p.staff || f.staff).includes(s.id) ? 'checked' : ''}> ${h(s.preferred_name || s.full_name)}</label>`).join('')}</div></div>
    <div class="actions"><button type="button" class="btn small" id="bkp-suggest">🔎 Suggest</button></div><div id="bkp-sugg"></div>`, 'Hold this time', false, 'Cancel').then((ok) => {
    if (!ok) return;
    const staff = Object.keys(ASK_FORM).filter((k) => k.startsWith('ps_') && ASK_FORM[k]).map((k) => k.slice(3));
    const pr = { date: ASK_FORM.pdate, start: bkRound15(ASK_FORM.pstart), mins: f.mins, staff, at: Date.now(), by: SBAuth.staff && SBAuth.staff.id, smsSent: null };
    if (!pr.date || !pr.start || !pr.staff.length) { toast('Choose the new date, time and who'); return; }
    f.proposal = pr; bkFormRefresh(true); toast('New time held — tap Save to keep it'); });
  setTimeout(() => { const g = (id) => document.getElementById(id); const sb = g('bkp-suggest'); if (!sb) return;
    sb.onclick = () => { const list = bkSuggest({ type: f.type, stops: f.stops, mins: f.mins, svcs: f.svcs.filter((x) => x.svc && !Bk.svc(x.svc).alongside), urgent: f.urgent, skipId: f.id });
      g('bkp-sugg').innerHTML = list.length ? `<div class="bk-sugg">${list.map((r, i) => `<button type="button" class="bk-sopt" data-i="${i}"><b>${bkDate(r.date)} ${bkTime(r.start)}</b> · ${h(Bk.pname(r.staff))}<span class="hint">${r.near ? 'near ' + h(r.near.x.what) + ' · ' : ''}adds ~${r.extra} min driving</span></button>`).join('')}</div>` : '<div class="hint">Nothing free found.</div>';
      g('bkp-sugg').querySelectorAll('.bk-sopt').forEach((b) => (b.onclick = () => { const r = list[+b.dataset.i]; g('bkp-date').value = r.date; g('bkp-start').value = r.start; document.querySelectorAll('[data-askchk^="ps_"]').forEach((el) => (el.checked = el.dataset.askchk === 'ps_' + r.staff)); })); }; }, 80);
}
function bkMove(b) { const p = b.proposal; if (!p) return; const before = bkClone(b); b.date = p.date; b.start = p.start; b.mins = p.mins || b.mins;
  if (p.staff && p.staff.length) { const keep = new Set(p.staff), added = p.staff.filter((x) => !(b.staff || []).includes(x)); // people swapped on the new time: take them off their procedures, put newcomers on the main work
    b.svcs = (b.svcs || []).map((x) => { const al = x.svc && Bk.svc(x.svc).alongside; let st = Bk.sstaff(b, x).filter((id) => keep.has(id)); if (!al) st = [...new Set([...st, ...added])]; return { ...x, staff: st.length ? st : [...p.staff] }; });
    b.staff = [...p.staff]; }
  b.status = 'confirmed'; b.moved = (b.moved || 0) + 1; delete b.proposal; touch(b); return before; }
function bkSlotsHtml(f) { // times free on the chosen day, for the people on the main procedures (or everyone)
  const main = [...new Set(f.svcs.filter((x) => !x.svc || !Bk.svc(x.svc).alongside).flatMap((x) => x.staff || []))]; const ppl = main.length ? main : Bk.people().map((s) => s.id);
  if (!f.date) return '<div class="hint">Choose the date first.</div>'; if (Bk.type(f.type).where === 'farm' && !f.stops.length) return '<div class="hint">Choose the farm and yards first.</div>';
  BK._slots = []; const out = ppl.map((sid) => { const sl = bkSlots(sid, f.date, { type: f.type, stops: f.stops, mins: f.mins, skipId: f.id }); const p = Bk.person(sid); if (!p) return '';
    if (!Bk.hours(p, f.date)) return `<div class="hint">${h(Bk.pname(sid))} isn't working on ${bkDate(f.date)}.</div>`;
    return `<div class="lbl" style="margin-top:6px">${h(Bk.pname(sid))} — ${bkDate(f.date, { weekday: 'long', day: 'numeric', month: 'short' })}</div>${sl.length ? `<div class="bk-sugg">${sl.map((r) => { BK._slots.push({ ...r, staff: sid }); const i = BK._slots.length - 1; return `<button type="button" class="bk-sopt ${r.lunchOut ? 'out' : ''}" data-act="bkf-slot" data-i="${i}"><b>${bkTime(r.start)}</b>${r.lunch != null ? ` <span class="hint">· lunch ${bkTime(r.lunch)}</span>` : ''}<span class="lg">${r.logic.map(h).join('<br>')}</span></button>`; }).join('')}</div>` : '<div class="hint">No time free that day for this long an appointment.</div>'}`; }).join('');
  return `<div class="card" style="margin:6px 0"><div class="hint">Earliest first. Travel is rounded up to 5 minutes and starts to the quarter hour. Lunch can be taken anywhere, so it doesn't change where the next drive starts.</div>${out}</div>`;
}

/* ---------------- blocks: meetings, admin time, RDOs, leave… (repeat, on/off, change one day / following / all) ---------------- */
function bkBlockOpen(b, preset) {
  if (!Bk.need('blocks')) return; preset = preset || {};
  const series = b && b.of ? Bk.list('blocks').find((x) => x.id === b.of) : null; // a one-day change of a repeating block
  const isNew = !b; const day = preset.day || BK.date;
  const f = b ? bkClone(b) : { id: uid('blk'), type: (Bk.cfg('blocktype').find((x) => x.id !== 'bt-lunch') || {}).id, staff: [], date: BK.date, start: '12:00', end: '13:00', allDay: false, repeat: { every: 'none', days: [] }, on: true, note: '', ...preset };
  const rep = !isNew && !b.of && b.repeat && b.repeat.every && b.repeat.every !== 'none'; if (rep) f.date = day; // show the day that was tapped
  const r = f.repeat || { every: 'none' }; const ppl = Bk.people(); const bt = Bk.btype(f.type); const bw = bkWhoOf(bt);
  openSheet(isNew ? 'New block' : 'Block — ' + bt.name + (b.of || rep ? ' · ' + bkDate(day) : ''), `<div class="grid2"><div class="f"><label for="bb-type">Type</label><select id="bb-type">${Bk.cfg('blocktype').filter((t) => t.id !== 'bt-lunch').map((t) => `<option value="${t.id}" ${t.id === f.type ? 'selected' : ''}>${h(t.name)}</option>`).join('')}</select><div class="hint">Add your own types in Settings → Scheduling.</div></div>
    <div class="f"><label class="bk-radio" style="margin-top:22px"><input type="checkbox" id="bb-on" ${f.on ? 'checked' : ''}> On (untick to turn it off without deleting it)</label></div></div>
  ${Object.values(bw).some(Boolean) ? `<div class="f"><label for="bb-client">Client (optional)</label><input id="bb-client" list="bb-clients" value="${h(f.bid ? (IDX.biz.get(f.bid) || {}).name || '' : f.cid ? fullName(D.contacts.find((c) => c.id === f.cid) || { first: '' }) : '')}" autocomplete="off"><datalist id="bb-clients">${D.businesses.filter((x) => bkClientOk(bw, x.id)).slice(0, 800).map((x) => `<option value="${h(x.name)}">`).join('')}</datalist><div class="hint">${h(bkWhoText(bw))}</div></div>` : ''}
  <div class="f"><label>Who</label><div class="checks"><label><input type="checkbox" id="bb-all" ${f.staff === 'all' ? 'checked' : ''}> Everyone</label>${ppl.map((s) => `<label><input type="checkbox" data-bbstaff="${s.id}" ${f.staff !== 'all' && f.staff.includes(s.id) ? 'checked' : ''}> ${h(s.preferred_name || s.full_name)}</label>`).join('')}</div></div>
  <div class="grid2"><div class="f"><label for="bb-date">${b && b.of ? 'Date' : r.every === 'none' ? 'Date' : rep ? 'This day' : 'Starting'}</label><input id="bb-date" type="date" value="${f.date}"></div><div class="f"><label for="bb-to">Until (several days in a row)</label><input id="bb-to" type="date" value="${f.toDate || ''}"></div></div>
  <div class="grid2"><div class="f"><label class="bk-radio"><input type="checkbox" id="bb-allday" ${f.allDay ? 'checked' : ''}> All day</label></div><div class="f bk-times2"><label for="bb-start">From</label><input id="bb-start" type="time" step="900" value="${f.start}"><label for="bb-end">to</label><input id="bb-end" type="time" step="900" value="${f.end}"></div></div>
  ${b && b.of ? `<div class="hint">This is a one-day change to a repeating ${h(bt.name.toLowerCase())}.</div>` : `<div class="grid2"><div class="f"><label for="bb-rep">Repeats</label><select id="bb-rep">${BK_REPEATS.map(([v, l]) => `<option value="${v}" ${r.every === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="f"><label for="bb-until">Repeat until</label><input id="bb-until" type="date" value="${r.until || ''}"></div></div>
  <div class="f"><label>On these days (weekly / fortnightly)</label><div class="checks">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" data-bbday="${d}" ${(r.days || []).includes(d) ? 'checked' : ''}> ${DOW_NAMES[d]}</label>`).join('')}</div></div>`}
  <div class="f"><label for="bb-note">Note</label><input id="bb-note" value="${h(f.note || '')}"></div>
  ${bkLookField(f, bt, 'bbl')}
  ${!isNew ? `<div class="actions"><button type="button" class="btn" data-act="bb-del" data-id="${f.id}" data-day="${day}" style="color:var(--red)">Delete${rep || b.of ? '…' : ' block'}</button></div>${(f.skip || []).length ? `<div class="hint">Skipped: ${f.skip.map((d) => bkDate(d)).join(', ')}</div>` : ''}` : ''}`, async () => {
    const g = (id) => document.getElementById(id);
    const v = { type: g('bb-type').value, on: g('bb-on').checked, staff: g('bb-all').checked ? 'all' : [...document.querySelectorAll('[data-bbstaff]:checked')].map((el) => el.dataset.bbstaff), date: g('bb-date').value, toDate: g('bb-to').value || null, allDay: g('bb-allday').checked, start: bkRound15(g('bb-start').value), end: bkRound15(g('bb-end').value), note: g('bb-note').value.trim(), look: bkLookRead('bbl') };
    if (g('bb-rep')) v.repeat = { every: g('bb-rep').value, until: g('bb-until').value || null, days: [...document.querySelectorAll('[data-bbday]:checked')].map((el) => +el.dataset.bbday) };
    if (g('bb-client')) { const nm = g('bb-client').value.trim().toLowerCase(); const bz = nm && D.businesses.find((x) => (x.name || '').toLowerCase() === nm); v.bid = bz ? bz.id : null; if (nm && !bz) { toast('Choose the client from the list'); return false; } }
    if (v.staff !== 'all' && !v.staff.length) { toast('Choose who it applies to'); return false; }
    if (!v.date) { toast('Choose the date'); return false; } if (!v.allDay && (!v.start || !v.end || v.end <= v.start)) { toast('Check the times'); return false; }
    if (!v.look) v.look = null;
    const ex = Bk.list('blocks').find((x) => x.id === f.id);
    if (!ex) { const nb = { id: f.id, ...v, repeat: v.repeat || { every: 'none' } }; if (!nb.look) delete nb.look; touch(nb); D.blocks.push(nb); }
    else if (ex.of || !rep) { Object.assign(ex, v); if (!ex.look) delete ex.look; touch(ex); }
    else { const scope = await bkScope('block', 'Change'); if (!scope) return false; bkBlockScopeSave(ex, day, v, scope); }
    save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
function bkBlockScopeSave(ex, day, v, scope) {
  if (scope === 'this') { const id = `${ex.id}~${day}`; let x = Bk.list('blocks').find((y) => y.id === id); if (!x) { x = { id, of: ex.id, occ: day }; D.blocks.push(x); } Object.assign(x, v, { repeat: { every: 'none' } }); delete x.gone; if (!x.look) delete x.look; touch(x); return; }
  if (scope === 'following' && day > ex.date) { const nw = { ...bkClone(ex), ...v, id: uid('blk'), skip: [] }; if (!nw.look) delete nw.look; nw.date = v.date; ex.repeat = { ...(ex.repeat || {}), until: bkAdd(day, -1) }; touch(ex);
    Bk.list('blocks').filter((x) => x.of === ex.id && x.occ >= day && !x.gone).forEach((x) => { x.gone = true; touch(x); }); touch(nw); D.blocks.push(nw); return; }
  const shift = bkDays(day, v.date); const anchor = shift ? bkAdd(ex.date, shift) : ex.date; Object.assign(ex, v, { date: anchor }); if (!ex.look) delete ex.look; touch(ex); // all (or following from the very first day)
}

/* ---------------- a person's day: available or not, hours, where they start and finish, lunch ---------------- */
async function bkColMenu(sid, date) {
  const p = Bk.person(sid); if (!p) return; const c = Bk.scfg(p); const hr = Bk.hours(p, date), usual = Bk.usualHours(p, date) || c.locumHours || ['08:00', '17:00'];
  const dl = bkDayLoc(sid, date); const rec = dl.rec || {}; const lu = Bk.lunch(sid, date); const lc = Bk.lunchCfg();
  const placeSel = (k, cur) => `<select data-ask="${k}" aria-label="${k === 'st' ? 'Start' : 'Finish'} place"><option value="base" ${!cur || cur.kind === 'base' ? 'selected' : ''}>Homebase</option>${c.home && c.home.lat != null ? `<option value="home" ${cur && cur.kind === 'home' ? 'selected' : ''}>Home</option>` : ''}<option value="farm" ${cur && cur.kind === 'farm' ? 'selected' : ''}>A farm…</option></select>`;
  const farmIn = (k, cur) => `<input data-ask="${k}f" list="bk-farmlist" value="${h(cur && cur.kind === 'farm' ? (IDX.farms.get(cur.fid) || {}).name || '' : '')}" aria-label="Farm name" autocomplete="off">`;
  const ok = await askBox(`${Bk.pname(sid)} — ${bkDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}`, `
    <div class="f"><label>Working this day?</label><label class="bk-radio"><input type="radio" name="cm-work" value="yes" data-ask="work" ${hr ? 'checked' : ''}> Yes</label><label class="bk-radio"><input type="radio" name="cm-work" value="no" data-ask="work" ${hr ? '' : 'checked'}> No</label>
      <div class="bk-hrow"><span class="hint">Hours</span><input type="time" step="900" data-ask="from" value="${(hr || usual)[0]}" aria-label="Start"><span>to</span><input type="time" step="900" data-ask="to" value="${(hr || usual)[1]}" aria-label="Finish"></div>
      <div class="hint">Usually ${Bk.usualHours(p, date) ? bkTime(Bk.usualHours(p, date)[0]) + '–' + bkTime(Bk.usualHours(p, date)[1]) : 'not working'} on ${DOW_NAMES[bkDow(date)]}s. Use this to swap a day off.</div></div>
    <div class="grid2"><div class="f"><label>Starts the day at</label>${placeSel('st', rec.start)}${farmIn('st', rec.start)}</div><div class="f"><label>Finishes the day at</label>${placeSel('en', rec.end)}${farmIn('en', rec.end)}</div></div>
    <datalist id="bk-farmlist">${(D.farms || []).filter((x) => x.name).slice(0, 1500).map((x) => `<option value="${h(x.name)}">`).join('')}</datalist>
    ${lc.on ? `<div class="f"><label>Lunch</label><select data-ask="lunch" aria-label="Lunch time"><option value="">No lunch break today</option>${bkTimeOpts(lu ? lu.start : lc.def, hr ? bkMin(hr[0]) : 6 * 60, hr ? bkMin(hr[1]) - lc.mins : 18 * 60)}</select><div class="hint">Usually ${bkTime(lc.from)}–${bkTime(lc.to)}.${lu && lu.inAppt ? ' Lunch is during an appointment that day.' : ''}</div></div>` : ''}`, 'Save', false, 'Cancel');
  if (!ok) return; const A = ASK_FORM;
  const id = 'staff:' + sid; let r = Bk.get(id); if (!r) { r = { id, cfg: 'staff', name: p.full_name }; D.bkcfg.push(r); }
  r.availDates = { ...(r.availDates || {}) }; r.offDates = { ...(r.offDates || {}) }; delete r.availDates[date]; delete r.offDates[date];
  const usualNow = Bk.usualHours(p, date);
  if (A.work === 'no') { if (usualNow) r.offDates[date] = true; }
  else { const hrs = [bkRound15(A.from || usual[0]), bkRound15(A.to || usual[1])]; if (!usualNow || hrs[0] !== usualNow[0] || hrs[1] !== usualNow[1]) r.availDates[date] = hrs; }
  touch(r);
  const place = (k) => { const v = A[k]; if (v === 'farm') { const nm = (A[k + 'f'] || '').trim().toLowerCase(); const fm = (D.farms || []).find((x) => (x.name || '').toLowerCase() === nm); if (!fm) { toast('Farm not found — choose it from the list'); return undefined; } const ys = bkYardsOf(fm); return { kind: 'farm', fid: fm.id, yid: ys[0] ? ys[0].yid : null }; } if (v === 'home') return { kind: 'home', lat: c.home.lat, lng: c.home.lng }; return null; };
  const st = place('st'), en = place('en');
  if (st !== undefined && en !== undefined) { const lid = 'dayloc:' + sid + ':' + date; let l = Bk.get(lid); if (st || en || l) { if (!l) { l = { id: lid, cfg: 'dayloc', name: Bk.pname(sid) + ' ' + date }; D.bkcfg.push(l); } l.start = st; l.end = en; touch(l); } }
  if (lc.on && !(lu && lu.inAppt)) { const v = A.lunch; const was = lu ? lu.start : null;
    if (!v && was) bkSetLunch(sid, date, null); else if (v && v !== was) { const m = bkMin(v); if (bkLunchOutside(m) && !(await ask(`${bkTime(m)} is outside the usual lunch time (${bkTime(lc.from)}–${bkTime(lc.to)}). Move it anyway?`, 'Yes — move it'))) { /* keep */ } else bkSetLunch(sid, date, m); } }
  bkDone('Saved');
}
async function bkLunchOpen(sid, date) {
  const lu = Bk.lunch(sid, date); const lc = Bk.lunchCfg(); const p = Bk.person(sid); const hr = p && Bk.hours(p, date);
  const r = await askBox(`Lunch — ${Bk.pname(sid)}, ${bkDate(date)}`, `<div class="f"><label for="lu-at">Time</label><select id="lu-at" data-ask="at">${bkTimeOpts(lu ? lu.start : lc.def, hr ? bkMin(hr[0]) : 6 * 60, hr ? bkMin(hr[1]) - lc.mins : 18 * 60)}</select><div class="hint">${lc.mins} minutes, taken anywhere. Usually between ${bkTime(lc.from)} and ${bkTime(lc.to)}.</div></div>`, 'Move it', false, 'Cancel', 'No lunch break today');
  if (!r) return; if (r === 'alt') { bkSetLunch(sid, date, null); bkDone('Lunch removed for that day'); return; }
  const m = bkMin(ASK_FORM.at); if (bkLunchOutside(m) && !(await ask(`${bkTime(m)} is outside the usual lunch time (${bkTime(lc.from)}–${bkTime(lc.to)}). Move it anyway?`, 'Yes — move it'))) return;
  bkSetLunch(sid, date, m); bkDone(`Lunch moved to ${bkTime(m)}`);
}

/* ---------------- Settings → Scheduling forms ---------------- */
function bkWhoField(w, label) { w = w || {}; return `<div class="f"><label>${label}</label><div class="checks">${[['clientBiz', 'Client businesses'], ['nonclientBiz', 'Non-client businesses'], ['clientInd', 'Client individuals'], ['nonclientInd', 'Non-client individuals']].map(([k, l]) => `<label><input type="checkbox" data-bcwho="${k}" ${w[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>`; }
function bkCfgOpen(x, cfgType) {
  if (!Bk.need('settings')) return;
  const isNew = !x; x = x ? bkClone(x) : { id: uid(cfgType.slice(0, 3)), cfg: cfgType, order: 50, name: '' }; if (isNew && cfgType === 'type') x.who = { ...BK_WHO_DEF };
  const t = x.cfg; let body = `<div class="f"><label for="bc-name">Name</label><input id="bc-name" value="${h(x.name)}"></div>`;
  if (t === 'type' || t === 'blocktype') body += bkColourField(x.colour || '#3a6ea5', x.id, 'bc') + bkPatternField(x.pattern || 'light', x.colour || '#3a6ea5', 'bc');
  if (t === 'type') body += `<div class="f"><label for="bc-where">Where</label><select id="bc-where">${[['farm', 'On a farm'], ['base', 'At homebase'], ['phone', 'Phone']].map(([v, l]) => `<option value="${v}" ${x.where === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="f"><label for="bc-fixed">Default length for appointment type (minutes)</label><input id="bc-fixed" type="number" min="0" step="5" value="${x.fixedMins || ''}"><div class="hint">Set a default time for this appointment type (it can be changed when booking or editing an appointment). Leave empty to work it out from the procedures.</div></div>${bkWhoField(x.who || BK_WHO_DEF, 'Can be booked for')}`;
  if (t === 'blocktype') body += `<div class="f"><label for="bc-bwhere">Where</label><select id="bc-bwhere"><option value="base" ${x.where !== 'anywhere' ? 'selected' : ''}>At homebase (travel worked out)</option><option value="anywhere" ${x.where === 'anywhere' ? 'selected' : ''}>Anywhere (no travel)</option></select></div>${bkWhoField(x.who || {}, 'Can be linked to a client (leave all unticked for none)')}`;
  if (t === 'service') { const per = x.mode === 'perhead';
    body += `<div class="f"><label for="bc-mode">How long</label><select id="bc-mode"><option value="fixed" ${per ? '' : 'selected'}>Set time</option><option value="perhead" ${per ? 'selected' : ''}>Calculate time based on per head rate</option></select></div>
    <div class="f bc-fixedonly" ${per ? 'hidden' : ''}><label for="bc-mins">Set time (minutes)</label><input id="bc-mins" type="number" min="0" step="5" value="${x.mins || ''}"></div>
    <div class="f bc-peronly" ${per ? '' : 'hidden'}><label>Head per hour</label>
      <label class="bk-radio" style="display:flex;margin:4px 0"><input type="radio" name="bc-rate" value="service" ${x.rateFrom === 'farm' ? '' : 'checked'}> Use this rate for every farm:</label>
      <label class="bk-radio" style="display:flex;margin:4px 0"><input type="radio" name="bc-rate" value="farm" ${x.rateFrom === 'farm' ? 'checked' : ''}> Use the rate set for each farm or yard on the business page (Contacts → business → 📅 Scheduling)</label>
      <div class="bk-hrow"><input id="bc-hph" type="number" min="1" inputmode="numeric" value="${x.hph || ''}" aria-label="Head per hour" style="max-width:110px"><span class="hint" id="bc-hphlbl">${x.rateFrom === 'farm' ? 'head per hour when a farm has no rate set yet' : 'head per hour'}</span></div></div>
    <div class="f"><label for="bc-setup">Set-up and pack-up time (minutes)</label><input id="bc-setup" type="number" min="0" step="5" value="${x.setup || ''}"><div class="hint">Added on top, whether the time is set or worked out from the head count.</div></div>
    ${x.alongside ? '<div class="hint" style="margin:4px 0">Additional labour runs alongside the other procedures (a separate person) — it doesn\'t make the appointment longer.</div>' : ''}
    <label class="bk-radio" style="margin:4px 0"><input type="checkbox" id="bc-asklab" ${x.askLabour ? 'checked' : ''}> Ask whether additional labour is needed when this is booked</label>
    <div class="f" style="margin-top:6px"><label for="bc-yard">Counts as (for each farm's "What can be booked here")</label><select id="bc-yard"><option value="">Neither — farms don't limit it</option><option value="preg" ${x.yard === 'preg' ? 'selected' : ''}>Preg testing</option><option value="bull" ${x.yard === 'bull' ? 'selected' : ''}>Bull testing</option></select><div class="hint">On the business page each farm or yard can be set to preg testing only, bull testing only, or individual animal assessments only. Choose which of those this procedure is, so you're warned if it's booked where it isn't allowed.</div></div>`; }
  if (t === 'sms') body += `<div class="f"><label for="bc-use">When it's used</label><select id="bc-use">${[['booked', 'When an appointment is made'], ['reminder', 'Reminder 5 days before'], ['proposal', 'When a new time is suggested'], ['other', 'Sent by hand']].map(([v, l]) => `<option value="${v}" ${x.use === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="f"><label for="bc-text">Message</label><textarea id="bc-text" rows="5">${h(x.text || '')}</textarea><div class="hint">Fill-ins: {first} {name} {business} {type} {day} {date} {time} {farm} {at_farm} {vet} {old_date}</div></div>`;
  if (t === 'futype') body += `<div class="f"><label for="bc-days">Due how many days after</label><input id="bc-days" type="number" min="0" value="${x.days || ''}"></div>`;
  if (!isNew && x.id !== 'svc-labour' && x.id !== 'bt-lunch') body += `<div class="actions"><button type="button" class="btn" data-act="bks-del" data-id="${x.id}" style="color:var(--red)">Remove</button></div>`;
  openSheet((isNew ? 'New ' : 'Edit ') + ({ type: 'appointment type', service: 'procedure', blocktype: 'block type', sms: 'SMS template', futype: 'follow-up type' })[t], body, async () => {
    const g = (id) => (document.getElementById(id) || {}).value; x.name = (g('bc-name') || '').trim(); if (!x.name) { toast('Enter a name'); return false; }
    if (t === 'type' || t === 'blocktype') { const c = bkHex(g('bc-colourtxt')) || bkHex(g('bc-colour')); if (!c) { toast('Enter a colour code like #2f7a55'); return false; } x.colour = c; x.pattern = (document.querySelector('input[name=bc-pat]:checked') || {}).value || 'light';
      x.who = {}; document.querySelectorAll('[data-bcwho]').forEach((el) => { if (el.checked) x.who[el.dataset.bcwho] = true; }); }
    if (t === 'type') { x.where = g('bc-where'); x.fixedMins = +g('bc-fixed') || null; if (!Object.values(x.who).some(Boolean)) { toast('Tick who this appointment type can be booked for'); return false; } }
    if (t === 'blocktype') x.where = g('bc-bwhere');
    if (t === 'service') { x.mode = g('bc-mode'); x.rateFrom = x.mode === 'perhead' ? ((document.querySelector('input[name=bc-rate]:checked') || {}).value || 'service') : null; x.mins = +g('bc-mins') || null; x.hph = +g('bc-hph') || null; x.setup = +g('bc-setup') || 0;
      if (x.mode === 'perhead' && x.rateFrom !== 'farm' && !x.hph) { toast('Enter the head per hour'); return false; } if (x.mode === 'fixed' && !x.mins) { toast('Enter the set time'); return false; }
      x.askLabour = document.getElementById('bc-asklab').checked; x.yard = g('bc-yard') || null; }
    if (t === 'sms') { x.use = g('bc-use'); x.text = (g('bc-text') || '').trim(); if (!x.text) { toast('Write the message'); return false; } }
    if (t === 'futype') x.days = +g('bc-days') || 0;
    const ex = Bk.get(x.id); if (ex) { Object.keys(ex).forEach((k) => { if (!k.startsWith('_')) delete ex[k]; }); Object.assign(ex, x); touch(ex); } else { touch(x); D.bkcfg.push(x); }
    save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
document.addEventListener('change', (e) => { if (e.target.id === 'bc-mode') { const per = e.target.value === 'perhead'; document.querySelectorAll('.bc-peronly').forEach((x) => (x.hidden = !per)); document.querySelectorAll('.bc-fixedonly').forEach((x) => (x.hidden = per)); }
  if (e.target.name === 'bc-rate') { const l = document.getElementById('bc-hphlbl'); if (l) l.textContent = e.target.value === 'farm' ? 'head per hour when a farm has no rate set yet' : 'head per hour'; } });
function bkLunchCfgOpen() {
  if (!Bk.need('settings')) return; const lc = Bk.lunchCfg();
  openSheet('Lunch breaks', `<label class="bk-radio" style="margin:4px 0 10px"><input type="checkbox" id="lc-on" ${lc.on ? 'checked' : ''}> Give everyone a lunch break each working day</label>
    <div class="grid2"><div class="f"><label for="lc-mins">How long (minutes)</label><input id="lc-mins" type="number" min="5" step="5" value="${lc.mins}"></div><div class="f"><label for="lc-def">Usual time</label><input id="lc-def" type="time" step="900" value="${lc.def}"></div></div>
    <div class="grid2"><div class="f"><label for="lc-from">Can be from</label><input id="lc-from" type="time" step="900" value="${lc.from}"></div><div class="f"><label for="lc-to">to (finished by)</label><input id="lc-to" type="time" step="900" value="${lc.to}"></div></div>
    <div class="hint">The app moves lunch within this window to fit appointments, and asks before moving it outside.</div>`, async () => {
    const g = (id) => document.getElementById(id); let r = Bk.get('lunch'); if (!r) { r = { id: 'lunch', cfg: 'lunch', name: 'Lunch breaks' }; D.bkcfg.push(r); }
    Object.assign(r, { on: g('lc-on').checked, mins: +g('lc-mins').value || 30, def: bkRound15(g('lc-def').value) || '12:00', from: bkRound15(g('lc-from').value) || '11:00', to: bkRound15(g('lc-to').value) || '13:30' }); touch(r);
    save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
function bkStaffOpen(s) {
  const c = Bk.scfg(s), adm = SBAuth.isAdmin(), ed = Bk.can('settings');
  openSheet('Hours — ' + (s.preferred_name || s.full_name), `<div class="f"><label for="bs-mode">Works</label><select id="bs-mode" ${ed ? '' : 'disabled'}><option value="regular" ${c.mode === 'regular' ? 'selected' : ''}>Set days and hours</option><option value="locum" ${c.mode === 'locum' ? 'selected' : ''}>Locum — only on days marked available</option></select></div>
  <div class="f"><label>Set days and hours</label>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<div class="bk-hrow"><label class="bk-radio"><input type="checkbox" data-bsday="${d}" ${c.hours[d] ? 'checked' : ''} ${ed ? '' : 'disabled'}> ${DOW_NAMES[d]}</label><input type="time" step="900" data-bsfrom="${d}" value="${(c.hours[d] || ['08:00'])[0]}" ${ed ? '' : 'disabled'} aria-label="${DOW_NAMES[d]} start"><span>to</span><input type="time" step="900" data-bsto="${d}" value="${(c.hours[d] || [, s.role === 'vet_tech' ? '17:00' : '18:00'])[1]}" ${ed ? '' : 'disabled'} aria-label="${DOW_NAMES[d]} finish"></div>`).join('')}</div>
  <div class="grid2"><div class="f"><label for="bs-lfrom">Work hours on available days</label><div class="bk-hrow"><input id="bs-lfrom" type="time" step="900" value="${c.locumHours[0]}" ${ed ? '' : 'disabled'}><span>to</span><input id="bs-lto" type="time" step="900" value="${c.locumHours[1]}" ${ed ? '' : 'disabled'}></div></div>
    <div class="f"><label for="bs-buf">End-of-day time for records and restocking (minutes)</label><input id="bs-buf" type="number" min="0" step="15" value="${c.endBuffer || 0}" ${ed ? '' : 'disabled'}></div></div>
  <div class="grid2"><div class="f"><label for="bs-mob">Mobile (for the on-call list)</label><input id="bs-mob" inputmode="tel" value="${h(c.mobile || '')}" ${ed ? '' : 'disabled'}></div>
    <div class="f"><label for="bs-from">Usually starts the day at</label><select id="bs-from" ${ed ? '' : 'disabled'}><option value="base" ${c.startFrom !== 'home' ? 'selected' : ''}>Homebase</option><option value="home" ${c.startFrom === 'home' ? 'selected' : ''}>Home</option></select></div></div>
  <div class="f"><label for="bs-home">Home GPS (only needed when they start or finish at home)</label><input id="bs-home" value="${c.home && c.home.lat != null ? c.home.lat + ', ' + c.home.lng : ''}" ${ed ? '' : 'disabled'}><div class="hint">Paste the GPS from Google Maps (for example -35.02, 117.88).</div></div>
  <div class="f"><label>Can be booked for${adm ? '' : ' (admin only)'}</label><label class="bk-radio"><input type="checkbox" id="bs-all" ${c.canDo ? '' : 'checked'} ${adm ? '' : 'disabled'}> Everything</label><div class="checks">${Bk.cfg('service').map((x) => `<label><input type="checkbox" data-bscan="${x.id}" ${!c.canDo || c.canDo.includes(x.id) ? 'checked' : ''} ${adm ? '' : 'disabled'}> ${h(x.name)}</label>`).join('')}</div></div>`, async () => {
    const id = 'staff:' + s.id; let r = Bk.get(id); if (!r) { r = { id, cfg: 'staff', name: s.full_name }; D.bkcfg.push(r); }
    if (ed) { const hrs = {}; document.querySelectorAll('[data-bsday]').forEach((el) => { const d = el.dataset.bsday; if (el.checked) hrs[d] = [document.querySelector(`[data-bsfrom="${d}"]`).value, document.querySelector(`[data-bsto="${d}"]`).value]; });
      r.hours = hrs; r.mode = document.getElementById('bs-mode').value; r.locumHours = [document.getElementById('bs-lfrom').value, document.getElementById('bs-lto').value]; r.endBuffer = +document.getElementById('bs-buf').value || 0; r.availDates = r.availDates || c.availDates || {};
      r.mobile = document.getElementById('bs-mob').value.trim(); r.startFrom = document.getElementById('bs-from').value;
      const gp = (document.getElementById('bs-home').value || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/); r.home = gp ? { lat: +gp[1], lng: +gp[2] } : null;
      if (r.startFrom === 'home' && !r.home) { toast('Enter the home GPS, or choose Homebase'); return false; } }
    if (adm) r.canDo = document.getElementById('bs-all').checked ? null : [...document.querySelectorAll('[data-bscan]:checked')].map((el) => el.dataset.bscan);
    touch(r); save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
function bkBschedOpen(bid) {
  const b = IDX.biz.get(bid); if (!b || !Bk.need('book')) return; const x = Bk.bsched(bid);
  openSheet('Scheduling — ' + b.name, `<label class="bk-radio" style="margin:4px 0 10px"><input type="checkbox" id="bz-lab" ${x.labour ? 'checked' : ''}> Always needs additional labour (you're reminded every time they're booked)</label>
    <div class="f"><label for="bz-note">Booking note</label><input id="bz-note" value="${h(x.note || '')}"><div class="hint">Shown on the business page, for example who usually helps in the yards.</div></div>`, async () => {
    const id = 'bsched:' + bid; let r = Bk.get(id); if (!r) { r = { id, cfg: 'bsched', bid, name: b.name }; D.bkcfg.push(r); }
    r.labour = document.getElementById('bz-lab').checked; r.note = document.getElementById('bz-note').value.trim(); delete r.gone; touch(r); save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
function bkFschedOpen(fid) {
  const f = IDX.farms.get(fid); if (!f || !Bk.need('book')) return; const x = Bk.fsched(fid); const rs = bkRateSvcs(); const ys = bkYardsOf(f);
  const useSel = (id, v) => `<select id="${id}" data-fzuse="${id}">${Object.entries(BK_USE).map(([k, l]) => `<option value="${k}" ${(v || '') === k ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`;
  const rateIn = (yid, sv) => { const r = yid ? Bk.get(`yrate:${fid}:${yid}:${sv.id}`) : Bk.get('yard:' + fid + ':' + sv.id); const v = r && !r.gone && r.hph ? r.hph : ''; return `<div class="f"><label for="fz-r-${yid || 'all'}-${sv.id}">${h(sv.name)} — head per hour</label><input id="fz-r-${yid || 'all'}-${sv.id}" data-fzrate="${sv.id}" data-yid="${yid || ''}" type="number" min="1" inputmode="numeric" value="${v}"><div class="hint">${sv.hph ? `Empty = the usual ${sv.hph}/hour.` : 'No usual rate — enter one.'}</div></div>`; };
  openSheet('Scheduling — ' + (f.name || f.address || 'Farm'), `${!ys.length ? `<div class="bk-warnbox">This farm has no yards pin yet. Add one (Contacts → the farm → 📍 pins) — it can't be booked until it has one.</div>` : ''}
    <div class="f"><label>What can be booked here</label>${ys.length > 1 ? `<label class="bk-radio"><input type="radio" name="fz-pery" value="0" ${x.perYard ? '' : 'checked'}> The same for all ${ys.length} yards</label><label class="bk-radio"><input type="radio" name="fz-pery" value="1" ${x.perYard ? 'checked' : ''}> Different for each yard</label>` : ''}
      <div class="fz-all" ${x.perYard && ys.length > 1 ? 'hidden' : ''}>${useSel('fz-use', x.use)}</div>
      <div class="fz-per" ${x.perYard && ys.length > 1 ? '' : 'hidden'}>${ys.map((y) => `<div class="bk-hrow"><span style="min-width:110px"><b>${h(y.name)}</b></span>${useSel('fz-use-' + y.yid, ((x.yards || {})[y.yid] || {}).use)}<input id="fz-note-${y.yid}" value="${h(((x.yards || {})[y.yid] || {}).note || '')}" aria-label="${h(y.name)} note"></div>`).join('')}</div>
      <div class="hint">"Do not service" pops up a warning if anyone tries to book those yards.</div></div>
    ${rs.length ? `<div class="f"><label>Speeds</label>${ys.length > 1 ? `<label class="bk-radio"><input type="radio" name="fz-perr" value="0" ${x.ratesPerYard ? '' : 'checked'}> The same rate across all yards</label><label class="bk-radio"><input type="radio" name="fz-perr" value="1" ${x.ratesPerYard ? 'checked' : ''}> A different rate for each yard</label>` : ''}
      <div class="fzr-all grid2" ${x.ratesPerYard && ys.length > 1 ? 'hidden' : ''}>${rs.map((sv) => rateIn(null, sv)).join('')}</div>
      <div class="fzr-per" ${x.ratesPerYard && ys.length > 1 ? '' : 'hidden'}>${ys.map((y) => `<div class="lbl" style="margin-top:6px">${h(y.name)}</div><div class="grid2">${rs.map((sv) => rateIn(y.yid, sv)).join('')}</div>`).join('')}<div class="hint">Empty = the farm's rate above, or the usual rate.</div></div></div>` : '<div class="hint">No procedures use a per-farm rate. Choose "Use the rate set for each farm or yard" on a procedure in Settings → Scheduling.</div>'}
    <div class="f"><label for="fz-note">Note</label><input id="fz-note" value="${h(x.note || '')}"><div class="hint">For example why it's not serviced, or which yards to use.</div></div>`, async () => {
    const g = (id) => document.getElementById(id); const id = 'fsched:' + fid; let r = Bk.get(id); if (!r) { r = { id, cfg: 'fsched', fid, name: f.name || '' }; D.bkcfg.push(r); }
    const pery = (document.querySelector('input[name=fz-pery]:checked') || {}).value === '1', perr = (document.querySelector('input[name=fz-perr]:checked') || {}).value === '1';
    r.perYard = pery && ys.length > 1; r.ratesPerYard = perr && ys.length > 1; r.use = g('fz-use').value; r.note = g('fz-note').value.trim(); r.yards = {};
    ys.forEach((y) => { const u = g('fz-use-' + y.yid); if (u) r.yards[y.yid] = { use: u.value, note: (g('fz-note-' + y.yid) || {}).value || '' }; }); delete r.gone; touch(r);
    document.querySelectorAll('[data-fzrate]').forEach((el) => { const sv = el.dataset.fzrate, yid = el.dataset.yid; const v = +el.value || null; const rid = yid ? `yrate:${fid}:${yid}:${sv}` : 'yard:' + fid + ':' + sv; let y = Bk.get(rid);
      if (v) { if (!y) { y = { id: rid, cfg: yid ? 'yrate' : 'yard', fid, svc: sv }; if (yid) y.yid = yid; D.bkcfg.push(y); } if (y.hph !== v || y.gone) { y.hph = v; delete y.gone; touch(y); } } else if (y && !y.gone) { y.gone = true; touch(y); } });
    save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
document.addEventListener('change', (e) => { if (e.target.name === 'fz-pery') { const p = e.target.value === '1'; document.querySelectorAll('.fz-all').forEach((x) => (x.hidden = p)); document.querySelectorAll('.fz-per').forEach((x) => (x.hidden = !p)); }
  if (e.target.name === 'fz-perr') { const p = e.target.value === '1'; document.querySelectorAll('.fzr-all').forEach((x) => (x.hidden = p)); document.querySelectorAll('.fzr-per').forEach((x) => (x.hidden = !p)); } });

/* ---------------- follow-ups (hidden until the clinical records module) ---------------- */
function bkFuOpen(fu, preset) {
  const isNew = !fu; const f = fu ? bkClone(fu) : { id: uid('fu'), type: (Bk.cfg('futype')[0] || {}).id, due: '', staff: SBAuth.staff && SBAuth.staff.role !== 'admin' ? SBAuth.staff.id : '', animal: '', notes: '', status: 'open', ...(preset || {}) };
  if (!f.due) { const t = Bk.get(f.type); f.due = bkAdd(bkToday(), (t && t.days) || 14); }
  openSheet(isNew ? 'New follow-up' : 'Follow-up', `<div class="f"><label>Client</label><b>${h(Bk.who(f))}</b></div>
  <div class="grid2"><div class="f"><label for="fu-type">Type</label><select id="fu-type">${Bk.cfg('futype').map((t) => `<option value="${t.id}" ${t.id === f.type ? 'selected' : ''}>${h(t.name)}</option>`).join('')}</select></div><div class="f"><label for="fu-due">Due</label><input id="fu-due" type="date" value="${f.due}"></div></div>
  <div class="f"><label for="fu-notes">Notes</label><textarea id="fu-notes" rows="3">${h(f.notes || '')}</textarea></div>`, async () => {
    const g = (id) => document.getElementById(id).value; f.type = g('fu-type'); f.due = g('fu-due'); f.notes = g('fu-notes').trim(); if (!f.due) { toast('Choose when it\'s due'); return false; }
    const ex = Bk.list('followups').find((x) => x.id === f.id); if (ex) { Object.keys(ex).forEach((k) => delete ex[k]); Object.assign(ex, f); touch(ex); } else { f.createdAt = Date.now(); f.by = SBAuth.staff && SBAuth.staff.id; touch(f); D.followups.push(f); }
    save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}

/* ---------------- who comes first on the calendar (this device only): arrows, or drag a name ---------------- */
function bkColMove(id, target, after) { const ids = Bk.people().map((x) => x.id).filter((x) => x !== id); let i = ids.indexOf(target); if (i < 0) return; if (after) i++; ids.splice(i, 0, id); Bk.setOrder(ids); renderAll(); }
document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('[data-colstaff]'); if (!c) return; BK._drag = c.dataset.colstaff; try { e.dataTransfer.setData('text/plain', c.dataset.colstaff); e.dataTransfer.effectAllowed = 'move'; } catch (x) { } });
document.addEventListener('dragover', (e) => { const c = BK._drag && e.target.closest && e.target.closest('[data-colstaff]'); if (c) { e.preventDefault(); document.querySelectorAll('.bk-colh.dropto').forEach((x) => x.classList.remove('dropto')); c.classList.add('dropto'); } });
document.addEventListener('drop', (e) => { const c = BK._drag && e.target.closest && e.target.closest('[data-colstaff]'); const id = BK._drag; BK._drag = null; document.querySelectorAll('.bk-colh.dropto').forEach((x) => x.classList.remove('dropto')); if (!c || c.dataset.colstaff === id) return; e.preventDefault(); const r = c.getBoundingClientRect(); bkColMove(id, c.dataset.colstaff, e.clientX > r.left + r.width / 2); });
document.addEventListener('dragend', () => { BK._drag = null; document.querySelectorAll('.bk-colh.dropto').forEach((x) => x.classList.remove('dropto')); });

/* ---------------- taps and changes ---------------- */
document.addEventListener('click', async (e) => {
  const col = e.target.closest && e.target.closest('.bk-col');
  if (col && !e.target.closest('.bk-appt, .bk-block, .bk-prop, .bk-drive')) { if (!Bk.can('book')) return; const r = col.getBoundingClientRect(); const m = Math.floor((BK_START + (e.clientY - r.top) / BK_PX) / 15) * 15; bkOpen(null, { staff: [col.dataset.staff], date: BK.date, start: bkHHMM(Math.max(BK_START, Math.min(BK_END - 15, m))) }); return; }
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^(bk|bkf|bkj|bks|bb|fu|bklog)-/.test(a)) return;
  const d = el.dataset;
  switch (a) {
    case 'bk-go': bkGo(+d.v); break;
    case 'bk-today': BK.date = bkToday(); renderAll(); break;
    case 'bk-view': BK.view = d.v; try { localStorage.setItem('bvp-bkview', JSON.stringify({ view: d.v })); } catch (x) { } renderAll(); break;
    case 'bk-colmove': { const cols = bkColumns(BK.date).map((x) => x.id), ci = cols.indexOf(d.staff), nb = cols[ci + +d.v]; if (!nb) return; bkColMove(d.staff, nb, +d.v > 0); break; }
    case 'bk-colmenu': if (!Bk.need('roster')) return; bkColMenu(d.staff, BK.date); break;
    case 'bk-lunch': e.stopPropagation(); if (!Bk.need('book')) return; bkLunchOpen(d.staff, d.day || BK.date); break;
    case 'bk-page': if (d.v === 'settings') { S.tab = 'settings'; S.setSub = 'sched'; } else BK.page = d.v; renderAll(); window.scrollTo(0, 0); { const l = document.getElementById('list'); if (l) l.scrollTop = 0; } break;
    case 'bk-openday': if (e.target.closest('[data-act=bk-open]') && e.target.closest('[data-act=bk-open]') !== el) return; BK.date = d.v; BK.view = 'day'; BK.page = 'cal'; renderAll(); break;
    case 'bk-new': bkOpen(null, { date: BK.date }); break;
    case 'bk-newblock': bkBlockOpen(null, { date: BK.date }); break;
    case 'bk-open': e.stopPropagation(); { const b = bkRec(d.id); if (b) bkOpen(b); } break;
    case 'bk-openblock': e.stopPropagation(); { const b = Bk.list('blocks').find((x) => x.id === d.id); if (b) bkBlockOpen(b, { day: d.day || BK.date }); } break;
    // appointment form
    case 'bkf-client': { BKF.bid = d.bid || null; BKF.cid = d.cid || null; if (BKF.bid && !BKF.cid) { const c = bkContactsOf(BKF.bid).find(bkMobile); BKF.cid = c ? c.id : null; }
      const fs = bkFarmsOf(BKF.bid); BKF.stops = []; if (fs.length === 1) { const ys = bkYardsOf(fs[0]); BKF.stops = [{ fid: fs[0].id, yid: ys.length === 1 ? ys[0].yid : null }]; } BKF.fids = Bk.fids(BKF); BKF.fid = BKF.fids[0] || null;
      const ps = bkPidsOf(BKF.bid); BKF.pids = ps.length === 1 ? [{ value: ps[0].value, label: ps[0].label || '' }] : []; BKF.noLabour = false;
      bkAutoMins(); bkFormRefresh(true); if (BKF.stops[0] && BKF.stops[0].yid) bkStopCheck(BKF.stops[0]); break; }
    case 'bkf-clear': BKF.bid = BKF.cid = BKF.fid = null; BKF.stops = []; BKF.fids = []; BKF.pids = []; bkFormRefresh(true); break;
    case 'bkf-stopadd': bkFormRead(); { const last = BKF.stops[BKF.stops.length - 1]; BKF.stops.push({ fid: last ? last.fid : '', yid: null }); bkFormRefresh(true); } break;
    case 'bkf-stopdel': bkFormRead(); BKF.stops.splice(+d.i, 1); BKF.svcs.forEach((x) => { if ((x.stop || 0) >= BKF.stops.length) x.stop = 0; }); BKF.fids = Bk.fids(BKF); BKF.fid = BKF.fids[0] || null; bkAutoMins(); bkFormRefresh(true); break;
    case 'bkf-addyard': { const f = IDX.farms.get(d.fid); if (f && typeof pinCheckSheet === 'function') { toast('Add the yards pin, save, then book again'); closeSheet(); setTimeout(() => pinCheckSheet(f), 350); } break; }
    case 'bkf-svcadd': bkFormRead(); BKF.svcs.push({ staff: [...((BKF.svcs.find((x) => !x.svc || !Bk.svc(x.svc).alongside) || {}).staff || [])] }); bkFormRefresh(true); break;
    case 'bkf-labour': bkFormRead(); if (bkAddLabour()) toast('Tick who is doing the additional labour'); break;
    case 'bkf-nolabour': bkFormRead(); BKF.noLabour = true; bkFormRefresh(true); break;
    case 'bkf-svcdel': bkFormRead(); BKF.svcs.splice(+d.i, 1); if (!BKF.svcs.length) BKF.svcs.push({ staff: [] }); bkAutoMins(); bkFormRefresh(true); break;
    case 'bkf-usesug': bkFormRead(); BKF.mins = bkSuggestMins(BKF.type, BKF.svcs, BKF.stops, BKF.lunch).mins; BKF._minsTouched = false; bkFormRefresh(true); break;
    case 'bkf-suggest': { bkFormRead(); if (Bk.type(BKF.type).where === 'farm' && !BKF.stops.length) { toast('Choose the client, farm and yards first'); return; } const o = { type: BKF.type, stops: BKF.stops, mins: BKF.mins, svcs: BKF.svcs.filter((x) => x.svc && !Bk.svc(x.svc).alongside), urgent: BKF.urgent, skipId: BKF.id }; BK._sugg = bkSuggest(o); document.getElementById('bkf-sugg').innerHTML = bkSuggHtml(BK._sugg, o); break; }
    case 'bkf-dayslots': bkFormRead(); document.getElementById('bkf-sugg').innerHTML = bkSlotsHtml(BKF); break;
    case 'bkf-slot': { const r = BK._slots && BK._slots[+d.i]; if (!r) return; bkFormRead(); BKF.start = r.start; const main = BKF.svcs.filter((x) => !x.svc || !Bk.svc(x.svc).alongside); if (!main.some((x) => (x.staff || []).includes(r.staff))) main.forEach((x) => (x.staff = [r.staff]));
      BKF._lunchPlan = { ...(BKF._lunchPlan || {}) }; if (r.lunch != null) BKF._lunchPlan[r.staff] = r.lunch; else delete BKF._lunchPlan[r.staff]; bkFormStaff(BKF); bkFormRefresh(true); toast(`${bkTime(r.start)} chosen${r.lunch != null ? ` — lunch ${bkTime(r.lunch)}` : ''}. Tap Save to book.`); break; }
    case 'bk-pick': { const r = BK._sugg && BK._sugg[+d.i]; if (!r) return; bkFormRead(); BKF.date = r.date; BKF.start = r.start;
      const main = BKF.svcs.filter((x) => !x.svc || !Bk.svc(x.svc).alongside); main.forEach((x) => (x.staff = [r.staff])); BKF._lunchPlan = r.lunch != null ? { [r.staff]: r.lunch } : {}; bkFormStaff(BKF); bkFormRefresh(true); toast(`${bkDate(r.date)} ${bkTime(r.start)} with ${Bk.pname(r.staff)} — tap Save to book`); break; }
    case 'bkf-rerule': { bkFormRead(); const f = BKF; const sr = Bk.get('series:' + f.series); if (!sr) return;
      const ok = await askBox('Change the repeat from this appointment', `<div class="f"><label for="rr-ev">Repeats</label><select id="rr-ev" data-ask="ev">${BK_REPEATS.map(([v, l]) => `<option value="${v}" ${sr.rule.every === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="f"><label>On these days (weekly / fortnightly)</label><div class="checks">${[1, 2, 3, 4, 5, 6, 0].map((x) => `<label><input type="checkbox" data-askchk="rd_${x}" ${(sr.rule.days && sr.rule.days.length ? sr.rule.days : [bkDow(f.date)]).includes(x) ? 'checked' : ''}> ${DOW_NAMES[x]}</label>`).join('')}</div></div><div class="f"><label for="rr-until">Until</label><input id="rr-until" type="date" data-ask="until" value="${sr.rule.until || ''}"></div><p class="hint">The appointments after this one are cancelled and made again on the new days; this one stays.</p>`, 'Change the repeat', false, 'Cancel');
      if (!ok) return; const rule = { every: ASK_FORM.ev, until: ASK_FORM.until || null, days: [0, 1, 2, 3, 4, 5, 6].filter((x) => ASK_FORM['rd_' + x]) };
      Bk.list('bookings').filter((b) => b.series === f.series && b.date > f.date && Bk.live(b)).forEach((b) => { b.status = 'cancelled'; touch(b); });
      const nsid = uid('sr'); const nsr = { id: 'series:' + nsid, cfg: 'series', name: Bk.who(f) + ' — ' + bkRuleText(rule, f.date), rule, anchor: f.date }; touch(nsr); D.bkcfg.push(nsr);
      const me = f._orig; const dates = rule.every === 'none' ? [] : bkRuleDates(rule, f.date, 60).slice(1);
      dates.forEach((dd) => { const r = { ...bkPlain(bkClone(me)), id: uid('bk'), date: dd, series: nsid, sms: { ...(me.sms || {}), send: false, booked: null } }; delete r.proposal; touch(r); Bk.list('bookings').push(r); });
      if (me) { me.series = nsid; touch(me); } BKF.series = nsid; save(); Sync.soon(); bkFormRefresh(true); toast(`Repeat changed — ${dates.length} more appointment${dates.length === 1 ? '' : 's'}`); break; }
    case 'bkf-propose': bkProposeForm(); break;
    case 'bkf-propyes': { bkFormRead(); const before = bkMove(BKF); if (await bkSaveForm(true)) { closeSheet(); toast('Moved to the new time and confirmed'); setTimeout(() => bkTidyAsk(before), 450); } break; }
    case 'bkf-propno': bkFormRead(); delete BKF.proposal; if (await bkSaveForm(true)) { closeSheet(); toast('Kept the original time — the held time is free again'); } break;
    case 'bkf-dup': { if (!Bk.need('book')) return; bkFormRead(); const src = bkClone(BKF); closeSheet();
      const copy = { type: src.type, bid: src.bid, cid: src.cid, stops: src.stops, pids: src.pids, svcs: src.svcs.map((x) => ({ ...x, staff: [...(x.staff || [])] })), mins: src.mins, date: src.date, start: src.start, notes: src.notes, urgent: src.urgent, noLabour: src.noLabour, look: src.look, lunch: src.lunch, _minsTouched: true };
      setTimeout(() => { bkOpen(null, copy); toast('Copy made — change the date and time, then Save'); }, 350); break; }
    case 'bkf-cancel': { bkFormRead(); let scope = 'this'; if (BKF.series) { scope = await bkScope('appointment', 'Cancel'); if (!scope) return; }
      const ok = await askBox('Cancel this appointment?', '<div class="f"><label for="bkc-why">Reason (optional)</label><input id="bkc-why" data-ask="why"></div>', 'Yes — cancel it', true, 'No — keep it'); if (!ok) return;
      BKF.status = 'cancelled'; BKF.cancelReason = ASK_FORM.why || ''; BKF.cancelledAt = Date.now(); delete BKF.proposal; const ser = BKF.series, dt = BKF.date, me = BKF.id;
      if (await bkSaveForm(true)) { if (scope !== 'this') { const n = Bk.list('bookings').filter((b) => b.series === ser && b.id !== me && Bk.live(b) && (scope === 'all' || b.date > dt)); n.forEach((b) => { b.status = 'cancelled'; b.cancelReason = ASK_FORM.why || ''; b.cancelledAt = Date.now(); touch(b); }); save(); toast(`Cancelled ${n.length + 1} appointments`); } else toast('Appointment cancelled'); closeSheet(); } break; }
    // jobs
    case 'bkj-smsdone': case 'bkj-smsskip': { const b = bkRec(d.id); b.sms = b.sms || {}; if (a === 'bkj-smsdone') b.sms.booked = Date.now(); else b.sms.skip = true; touch(b); bkDone(a === 'bkj-smsdone' ? 'Marked as sent' : "Won't be sent"); break; }
    case 'bkj-psmsdone': case 'bkj-psmsskip': { const b = bkRec(d.id); if (!b.proposal) return; if (a === 'bkj-psmsdone') b.proposal.smsSent = Date.now(); else b.proposal.smsSkip = true; touch(b); bkDone(); break; }
    case 'bkj-propyes': { const b = bkRec(d.id); if (!Bk.need('book')) return; const before = bkMove(b); bkDone('Moved to the new time and confirmed'); setTimeout(() => bkTidyAsk(before), 450); break; }
    case 'bkj-propno': { const b = bkRec(d.id); if (!Bk.need('book')) return; delete b.proposal; touch(b); bkDone('Kept the original time'); break; }
    case 'bkj-confirm': { const b = bkRec(d.id); if (!Bk.need('book')) return; b.status = 'confirmed'; touch(b); bkDone('Confirmed'); break; }
    case 'bkj-done': { const b = bkRec(d.id); if (!Bk.need('book')) return; b.status = 'done'; touch(b); bkDone('Marked completed — not invoiced'); break; }
    case 'bkj-suggest': { const b = bkRec(d.id); bkOpen(b, { suggestNow: true }); break; }
    case 'bk-text': BK._textBooking = d.booking ? bkRec(d.booking) : null; if (document.getElementById('sheet') && d.booking) { bkFormRead(); BK._textBooking = BKF; } bkTextOpen(d); break;
    case 'bkj-smsretry': try { await rpc('sms_retry', { k: Dev.k(), sms_id: +d.id }); toast('Trying again'); SupaSync.smsAt = 0; SupaSync.soon(); } catch (x) { toast(x.message); } break;
    case 'bkj-replydone': try { await rpc('sms_handled', { k: Dev.k(), sms_id: +d.sms }); const x = (D.smsLog || []).find((y) => y.id === +d.sms); if (x) x.handled = true; bkDone('Done'); } catch (x) { toast(x.message); } break;
    case 'bkj-replyconf': case 'bkj-replyprop': { if (!Bk.need('book')) return; const b = bkRec(d.id); let before = null; if (a === 'bkj-replyprop') before = bkMove(b); else { b.status = 'confirmed'; touch(b); }
      try { await rpc('sms_handled', { k: Dev.k(), sms_id: +d.sms }); const x = (D.smsLog || []).find((y) => y.id === +d.sms); if (x) x.handled = true; } catch (x) { }
      bkDone(a === 'bkj-replyprop' ? 'Moved to the new time and confirmed' : 'Appointment confirmed'); if (before) setTimeout(() => bkTidyAsk(before), 450); break; }
    // the change log
    case 'bklog-undo': case 'bklog-redo': { if (!Bk.need('book')) return; const ent = Bk.list('bklog').find((x) => x.id === d.id); if (!ent) return; const dir = a === 'bklog-undo' ? 'undo' : 'redo';
      const since = bkLogChangedSince(ent, dir); if (since.length && !(await ask(`${since.length === 1 ? 'This has' : 'Some of this has'} been changed again since. ${dir === 'undo' ? 'Undo' : 'Redo'} anyway? The later change will be replaced.`, dir === 'undo' ? 'Yes — undo' : 'Yes — redo', true))) return;
      bkLogApply(ent, dir); ent.undone = dir === 'undo'; touch(ent); BK._logLabel = (dir === 'undo' ? 'Undo: ' : 'Redo: ') + ent.label; BK._logOf = { id: ent.id, dir }; bkDone(dir === 'undo' ? 'Undone' : 'Redone'); break; }
    // settings
    case 'bks-new': bkCfgOpen(null, d.cfg); break;
    case 'bks-colour': bkSetColour(d.idp || 'bc', d.c); { const own = document.querySelector(`input[name="${d.idp}-lookmode"][value=own]`); if (own) own.checked = true; } break;
    case 'bk-editcol': { const cur = bkHex((document.getElementById(d.idp + '-colourtxt') || {}).value) || (document.getElementById(d.idp + '-colour') || {}).value || '#3a6ea5'; const c = await bkColourDialog(cur); if (c) { bkSetColour(d.idp, c); const own = document.querySelector(`input[name="${d.idp}-lookmode"][value=own]`); if (own) own.checked = true; } break; }
    case 'bk-ai': { const pg = d.v, box = document.getElementById('bkai-' + pg); const req = (box && box.value || '').trim(); BK['aiReq_' + pg] = req; if (!req) { toast('Type your question first'); return; }
      const txt = bkAiText(pg, req); let okc = false; try { await navigator.clipboard.writeText(txt); okc = true; } catch (x) { } const info = document.getElementById('bkai-info-' + pg);
      if (okc) { info.innerHTML = '✓ Copied. Paste it into Claude.'; window.open((D.settings && D.settings.aiChatUrl) || 'https://claude.ai/new', '_blank'); toast('Copied — now paste it into Claude'); }
      else info.innerHTML = `Couldn't copy automatically — select all of this, copy it, and paste it into Claude:<textarea readonly style="min-height:120px;margin-top:6px">${h(txt)}</textarea>`; break; }
    case 'bks-edit': bkCfgOpen(Bk.get(d.id)); break;
    case 'bks-lunch': bkLunchCfgOpen(); break;
    case 'bks-del': { const x = Bk.get(d.id); if (!x || !(await ask(`Remove ${x.name}? Appointments already using it keep it.`, 'Yes — remove', true))) return; x.gone = true; touch(x); closeSheet(); bkDone('Removed'); break; }
    case 'bks-staff': { const s = Bk.person(d.id); if (s) bkStaffOpen(s); break; }
    case 'bks-bsched': bkBschedOpen(d.id); break;
    case 'bks-fsched': bkFschedOpen(d.id); break;
    // blocks
    case 'bb-del': { const b = Bk.list('blocks').find((x) => x.id === d.id); if (!b) return; const day = d.day || BK.date; const rep = !b.of && b.repeat && b.repeat.every && b.repeat.every !== 'none';
      if (b.of) { if (!(await ask(`Delete this ${Bk.btype(b.type).name.toLowerCase()} on ${bkDate(b.occ)}?`, 'Yes — delete', true))) return; b.gone = true; touch(b); const s0 = Bk.list('blocks').find((x) => x.id === b.of); if (s0) { s0.skip = [...new Set([...(s0.skip || []), b.occ])]; touch(s0); } }
      else if (rep) { const scope = await bkScope('block', 'Delete'); if (!scope) return;
        if (scope === 'this') { b.skip = [...new Set([...(b.skip || []), day])]; touch(b); }
        else if (scope === 'following' && day > b.date) { b.repeat = { ...b.repeat, until: bkAdd(day, -1) }; touch(b); Bk.list('blocks').filter((x) => x.of === b.id && x.occ >= day && !x.gone).forEach((x) => { x.gone = true; touch(x); }); }
        else { b.gone = true; b.on = false; touch(b); } }
      else { if (!(await ask('Delete this block?', 'Yes — delete', true))) return; b.gone = true; b.on = false; touch(b); }
      closeSheet(); bkDone('Deleted'); break; }
  }
});
document.addEventListener('change', (e) => {
  const el = e.target; const a = el.dataset && el.dataset.act; if (!a) return;
  if (a === 'bk-toggle') { savePref('showBook', el.checked); if (!el.checked && S.tab === 'book') S.tab = 'contacts'; renderAll(); toast(el.checked ? 'Scheduling tab is on for this device' : 'Scheduling tab hidden'); }
  else if (a === 'bk-date' && el.value) { BK.date = el.value; renderAll(); }
  else if (a === 'bk-showall') { BK.showAll = el.checked; renderAll(); }
  else if (a === 'bk-person') { const s = Bk.hidden(); if (el.checked) s.delete(el.dataset.staff); else s.add(el.dataset.staff); Bk.setHidden(s); renderAll(); }
  else if (a === 'bk-oc') { if (!Bk.need('roster')) { renderAll(); return; } const v = el.value; if (!v) return; bkOncallSet(el.dataset.d, v === '__pat' ? undefined : v === '__none' ? null : v); save(); Sync.soon(); toast('On call updated'); renderAll(); }
  else if (a === 'bks-perm') { if (!SBAuth.isAdmin()) return; let p = Bk.get('perms'); if (!p) { p = { id: 'perms', cfg: 'perms', name: 'Permissions', staff: {} }; D.bkcfg.push(p); } p.staff = p.staff || {}; p.staff[el.dataset.staff] = { ...(p.staff[el.dataset.staff] || {}), [el.dataset.k]: el.checked }; touch(p); save(); Sync.soon(); toast('Permission updated'); }
  else if (a === 'bks-blockon') { if (!Bk.need('blocks')) return; const b = Bk.list('blocks').find((x) => x.id === el.dataset.id); b.on = el.checked; touch(b); bkDone(el.checked ? 'Block on' : 'Block off'); }
});
document.addEventListener('toggle', (e) => { const d = e.target; if (d.classList && d.classList.contains('bk-ai')) BK['aiOpen_' + d.dataset.pg] = d.open; }, true);
document.addEventListener('input', (e) => { if (/^bkai-/.test(e.target.id || '')) BK['aiReq_' + e.target.id.slice(5)] = e.target.value; });
document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.act === 'bkj-q') { BK.jobFilter = e.target.value; const pos = e.target.selectionStart; renderAll(); const q = document.getElementById('bkj-q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } } });
function bkSuggHtml(list, o) {
  if (!list.length) return '<div class="hint">No free time found in the next 6 weeks for the people who can do this. Try fewer procedures, a shorter time, or tick Urgent and book over something.</div>';
  return `<div class="bk-sugg">${list.map((r, i) => `<button type="button" class="bk-sopt" data-act="bk-pick" data-i="${i}"><b>${bkDate(r.date)} ${bkTime(r.start)}</b> · ${h(Bk.pname(r.staff))}<span class="hint">${r.near ? `near ${h(r.near.x.what)} (~${r.near.m} min apart) · ` : ''}${o.type && Bk.type(o.type).where === 'phone' ? 'phone' : `adds ~${r.extra} min driving`}</span>${r.logic ? `<span class="lg">${r.logic.map(h).join('<br>')}</span>` : ''}</button>`).join('')}</div>`;
}

/* ---------------- texts (SMS) ---------------- */
function bkSmsStatus(b) {
  const s = b.sms || {}; if (!s.send) return 'No "booking made" SMS for this appointment.';
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
