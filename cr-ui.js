/* Bovitech Super App — Clinical records and invoicing (part 2: the pages — records, the record itself,
   quick entry in the crush, invoices, overdue, follow-ups, the price list, settings and PDFs). */
'use strict';
const CR_SUBS = [['recs', 'Records'], ['invs', 'Invoices'], ['overdue', 'Overdue'], ['fus', 'Follow-ups'], ['prods', 'Price list']];
const crPill = (t, cls) => `<span class="cr-pill ${cls || ''}">${h(t)}</span>`;
const CR_RST = { draft: ['Draft', 'draft'], final: ['Finalised', 'final'] };
const CR_IST = { notready: 'notready', pending: 'pending', approved: 'approved', sent: 'sent', paid: 'paid' };
function crInvPill(inv) { if (!inv) return ''; return crOverdue(inv) ? crPill('Overdue', 'over') : crPill(CR_INV_ST[inv.status] || inv.status, CR_IST[inv.status]); }
const crBizName = (bid) => { const b = bid && IDX.biz.get(bid); return b ? b.name || 'Business' : 'No client chosen'; };
const crInvName = (bid) => { const b = bid && IDX.biz.get(bid); return b ? b.tradingName || b.name || '' : ''; };
function crPerm(p) { // approve / send invoices: the admin, plus anyone ticked in Settings → Users
  if (crAdmin() || S.admin) return true; const pm = crCfg('perms') || {}; const me = crMe(); return !!me && (pm[p] || []).includes(me);
}
const crSave = (rec) => { touch(rec); save(); };
function crBadge() { if (!crOn()) return 0; const inv = crList('crinv').filter((x) => !x.gone); return inv.filter((x) => crOverdue(x)).length + (crPerm('approve') ? inv.filter((x) => x.status === 'pending').length : 0); }
window.crBadge = crBadge;

/* ---------------- the Records tab ---------------- */
function crRender() {
  crSeed(); const pg = CR.page || 'recs';
  if (pg === 'edit') { const r = crGet('crrec', CR.id); if (r) return crEditHtml(r); CR.page = 'recs'; }
  if (pg === 'inv') { const inv = crGet('crinv', CR.id); if (inv) return crInvHtml(inv); CR.page = 'invs'; }
  if (CR.page === 'invs') return crInvsHtml(); if (CR.page === 'overdue') return crOverdueHtml(); if (CR.page === 'fus') return crFusHtml(); if (CR.page === 'prods') return crProdsHtml();
  return crRecsHtml();
}
window.crRender = crRender;
function crTodayAppts() { // appointments in the last week (and today) with no record yet — tap to start one
  const t = bkToday(), from = bkAdd(t, -7), me = crMe(); const has = new Set(crList('crrec').filter((x) => !x.gone).map((x) => x.bkId));
  return Bk.list('bookings').filter((b) => Bk.live(b) && !b.proposal && b.date >= from && b.date <= t && !has.has(b.id) && b.bid).sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')))
    .sort((a, b) => ((b.staff || []).includes(me) - (a.staff || []).includes(me)));
}
function crRecsHtml() {
  const q = (CR.q || '').toLowerCase().trim(), f = CR.rf || 'all', me = crMe();
  let L = crList('crrec').filter((x) => !x.gone);
  if (f === 'draft') L = L.filter((x) => x.status !== 'final'); if (f === 'mine') L = L.filter((x) => (x.staff || []).includes(me)); if (f === 'final') L = L.filter((x) => x.status === 'final');
  if (q) L = L.filter((x) => (crBizName(x.bid) + ' ' + (x.procs || []).map((p) => (crTpl(p.tpl) || {}).name).join(' ') + ' ' + (x.notes || '')).toLowerCase().includes(q));
  L.sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')));
  const ap = crTodayAppts().slice(0, 12);
  return `<div class="d-wrap cr"><h2 class="sec-h" style="font-size:26px">Clinical records</h2>
  ${ap.length ? `<div class="card"><h3>Start a record from an appointment</h3>${ap.map((b) => `<div class="kv bk-tap" data-act="cr-frombk" data-id="${b.id}" style="align-items:center"><div class="v"><b>${h(Bk.who(b))}</b> — ${h(Bk.type(b.type).name)}<br><span class="hint">${bkDate(b.date)}${b.start ? ' ' + bkTime(b.start) : ''} · ${h((b.staff || []).map(Bk.pname).join(', '))}${Bk.svcText ? ' · ' + h(Bk.svcText(b)) : ''}</span></div><button class="btn small" data-act="cr-frombk" data-id="${b.id}">📋 Start</button></div>`).join('')}</div>` : ''}
  <div class="actions"><button class="btn primary" data-act="cr-new">➕ New record</button></div>
  <div class="search" style="margin:8px 0"><input id="cr-q" type="search" placeholder="Search records" value="${h(CR.q || '')}" autocomplete="off" aria-label="Search records"></div>
  <div class="chips">${[['all', 'All'], ['mine', 'Mine'], ['draft', 'Not finalised'], ['final', 'Finalised']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="cr-rf" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="card">${L.length ? L.slice(0, 300).map(crRecRow).join('') : '<div class="hint">No records yet.</div>'}</div></div>`;
}
function crRecRow(r) {
  const inv = crInvFor(r); const pr = (r.procs || []).map((p) => (crTpl(p.tpl) || {}).name).filter(Boolean);
  return `<div class="kv bk-tap" data-act="cr-open" data-id="${r.id}" style="align-items:center"><div class="v"><b>${h(crBizName(r.bid))}</b> ${crPill(...CR_RST[r.status === 'final' ? 'final' : 'draft'])} ${crInvPill(inv)}<br><span class="hint">${bkDate(r.date)} · ${h(Bk.type(r.type).name)}${pr.length ? ' · ' + h(pr.join(', ')) : ''} · ${h((r.staff || []).map(Bk.pname).join(', '))}</span></div></div>`;
}
function crBizCard(b) { // the business page: its clinical records
  if (!crOn() || (typeof isClientBiz === 'function' && !isClientBiz(b))) return '';
  const L = crList('crrec').filter((x) => !x.gone && x.bid === b.id).sort((a, c) => c.date.localeCompare(a.date));
  return `<div class="card"><h3><span class="sp">📋 Clinical records${L.length ? ` (${L.length})` : ''}</span><button class="btn small" data-act="cr-new" data-bid="${b.id}">➕ New</button></h3>${L.length ? L.slice(0, 20).map(crRecRow).join('') : '<div class="hint">No records yet.</div>'}${L.length > 20 ? `<div class="hint">…and ${L.length - 20} older — see the Records tab.</div>` : ''}</div>`;
}
window.crBizCard = crBizCard;
function crOpen(id) { CR.page = 'edit'; CR.id = id; S.tab = 'rec'; renderAll(); const l = document.getElementById('list'); if (l) l.scrollTop = 0; window.scrollTo(0, 0); }
function crStart(o) { const r = crNewRec(o); r.patients.forEach((p) => p.species === 'cattle' && !p.pid && null); touch(r); D.crrec.push(r); crInvSync(r); save(); crOpen(r.id); }
async function crPickBiz() { // choose the client for a new record
  return new Promise((res) => {
    const list = (q) => D.businesses.filter((b) => !b.gone && (typeof isClientBiz !== 'function' || isClientBiz(b)) && (!q || (b.name || '').toLowerCase().includes(q))).sort((a, b) => (a.name || '').localeCompare(b.name || '')).slice(0, 40)
      .map((b) => `<div class="kv bk-tap" data-act="cr-pickb" data-id="${b.id}"><div class="v"><b>${h(b.name)}</b></div></div>`).join('') || '<div class="hint">No client businesses match.</div>';
    openSheet('New record — choose the client', `<div class="search"><input id="cr-pbq" type="search" placeholder="Search businesses" autocomplete="off" aria-label="Search businesses"></div><div id="cr-pbl" style="margin-top:6px">${list('')}</div>`, () => { res(null); return true; });
    const sv = document.getElementById('sheet-save'); if (sv) sv.textContent = 'Close';
    const sh = document.getElementById('sheet'); sh.addEventListener('input', (e) => { if (e.target.id === 'cr-pbq') document.getElementById('cr-pbl').innerHTML = list(e.target.value.toLowerCase().trim()); });
    sh.addEventListener('click', (e) => { const el = e.target.closest('[data-act=cr-pickb]'); if (!el) return; closeSheet(); res(el.dataset.id); });
  });
}

/* ---------------- one record ---------------- */
function crSel(k, val, opts, attrs) { return `<select ${attrs || ''} data-k="${k}">${opts.map(([v, l]) => `<option value="${h(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`; }
function crTimeIn(k, v) { return `<input type="time" data-crf="${k}" value="${h(v || '')}" step="300">`; }
function crEditHtml(r) {
  const fin = r.status === 'final'; const inv = crInvFor(r); const t = Bk.type(r.type); const b = IDX.biz.get(r.bid);
  const farms = b ? (b.farms || []).filter((f) => !f.gone) : []; const worked = crWorkedMins(r); const ahS = crAhSuggest(r), ahE = crAhEff(r); const tr = crTravel(r);
  const warn = crWarnings(r);
  const ppl = Bk.people();
  return `<div class="d-wrap cr cr-edit"><div class="actions" style="margin-bottom:6px"><button class="btn small" data-act="cr-back">‹ Records</button><button class="btn small" data-act="cr-pdf" data-id="${r.id}">🖨 Record PDF</button>${b ? `<button class="btn small" data-act="cr-biz" data-id="${b.id}">🏠 Business page</button>` : ''}</div>
  <h2 class="sec-h" style="font-size:24px">${h(crBizName(r.bid))} ${crPill(...CR_RST[fin ? 'final' : 'draft'])} ${crInvPill(inv)}</h2>
  ${fin ? `<div class="cr-warn">✓ Finalised${r.finBy ? ' by ' + h(Bk.pname(r.finBy)) : ''}${r.finAt ? ' on ' + new Date(r.finAt).toLocaleDateString('en-AU') : ''}. <button class="btn small" data-act="cr-reopen">Reopen to change it</button></div>` : ''}
  ${warn.length ? `<div class="cr-warn">${warn.map((w) => '⚠ ' + h(w)).join('<br>')}</div>` : ''}
  <fieldset ${fin ? 'disabled' : ''} class="cr-fs">
  <div class="card"><h3>Visit</h3>
    <div class="grid2"><div class="f"><label>Date</label><input type="date" data-crf="date" value="${h(r.date)}"></div><div class="f"><label>Appointment type</label><select data-crf="type">${Bk.cfg('type').map((x) => `<option value="${x.id}" ${x.id === r.type ? 'selected' : ''}>${h(x.name)}</option>`).join('')}</select></div></div>
    <div class="f"><label>Vets and techs</label><div class="cr-chks">${ppl.map((s) => `<label class="bk-radio"><input type="checkbox" data-crstaff="${s.id}" ${(r.staff || []).includes(s.id) ? 'checked' : ''}> ${h(s.preferred_name || s.full_name)}</label>`).join('')}</div></div>
    <div class="grid2"><div class="f"><label>Start on farm</label>${crTimeIn('start', r.start)}</div><div class="f"><label>Finish on farm</label>${crTimeIn('end', r.end)}</div></div>
    <div class="f"><label>Breaks (not charged)</label>${(r.breaks || []).map((x, i) => `<div class="cr-row"><input type="number" min="0" step="5" data-crbr="${i}" value="${+x.mins || 0}" style="width:90px" aria-label="Break minutes"> min${x.lunch ? ' (lunch)' : ''} <button class="btn small" data-act="cr-brdel" data-i="${i}" aria-label="Remove break">✕</button></div>`).join('')}<button class="btn small" data-act="cr-bradd">➕ Break</button></div>
    <div class="hint">Time worked: <b>${worked ? bkDur(worked) : '—'}</b>${(r.breaks || []).length ? ' (breaks taken off)' : ''}</div>
  </div>
  ${t.where === 'farm' ? `<div class="card"><h3>Farms visited and travel</h3>
    ${(r.stops || []).map((st, i) => `<div class="cr-row">${i + 1}. <b>${h(Bk.stopName(st))}</b> <button class="btn small" data-act="cr-stopdel" data-i="${i}" aria-label="Remove farm">✕</button></div>`).join('') || '<div class="hint">No farms yet.</div>'}
    ${farms.length ? `<div class="cr-row"><select id="cr-addfarm" aria-label="Add a farm"><option value="">➕ Add a farm…</option>${farms.map((f) => `<option value="${f.id}">${h(f.name || f.address || 'Farm')}</option>`).join('')}</select></div>` : ''}
    <label class="bk-radio cr-must" style="display:flex;margin-top:6px"><input type="checkbox" data-crf="routeOk" ${r.routeOk ? 'checked' : ''}> <b>This is the route we actually took</b></label>
    <div class="f"><label>Travel charged at</label>${crSel('subsidy', r.subsidy || '', [['', 'Normal rate'], ['TSE', 'Subsidised — TSE (DPIRD)'], ['SDI', 'Subsidised — SDI (DPIRD)']], 'data-crf="subsidy"')}</div>
    ${tr.map((x) => `<div class="hint">🚗 ${h(x.name)}: ${x.km == null ? '<b style="color:var(--red)">no return km saved for this farm</b>' : x.km + ' km return'}${x.pct ? ' — ' + h(x.why) : ''}</div>`).join('')}
  </div>` : ''}
  <div class="card"><h3>After hours and additional labour</h3>
    <div class="f"><label>After-hours fee</label>${crSel('ah', r.ah == null ? '' : r.ah, [['', `Automatic — ${ahS === 'late' ? 'late fee' : ahS === 'early' ? 'early fee' : 'none'}`], ['none', 'None'], ['early', 'Early fee'], ['late', 'Late fee']], 'data-crf="ah"')}
    <div class="hint">Weekdays: early 6–7pm and 7–8am, late 7pm–7am. Weekends and public holidays: early 7am–7pm, late 7pm–7am. Charged: <b>${ahE === 'late' ? 'late fee' : ahE === 'early' ? 'early fee' : 'none'}</b></div></div>
    <div class="grid2"><div class="f"><label>Additional labour — people</label><input type="number" min="0" step="1" data-crf="labour.people" value="${(r.labour || {}).people || 0}"></div><div class="f"><label>Hours each</label><input type="number" min="0" step="0.25" data-crf="labour.hours" value="${(r.labour || {}).hours || 0}"></div></div>
  </div>
  <div class="card"><h3>Patients</h3><div class="hint" style="margin-bottom:6px">The whole herd or flock, a mob, or individual animals. Each procedure says which one it was for.</div>
    ${(r.patients || []).map((p) => crPatHtml(r, p)).join('')}
    <div class="actions"><button class="btn small" data-act="cr-ptadd" data-v="herd">➕ Herd / flock</button><button class="btn small" data-act="cr-ptadd" data-v="mob">➕ Mob</button><button class="btn small" data-act="cr-ptadd" data-v="animal">➕ Individual animal</button></div>
  </div>
  <div class="card"><h3>Procedures</h3>${(r.procs || []).map((p) => crProcHtml(r, p)).join('') || '<div class="hint">No procedures yet.</div>'}
    <div class="cr-row"><select id="cr-addproc" aria-label="Add a procedure"><option value="">➕ Add a procedure…</option>${crTpls().map((x) => `<option value="${x.id}">${h(x.name)}${x.draft ? ' (notes only for now)' : ''}</option>`).join('')}</select></div></div>
  <div class="card"><h3>Medications, consumables and merchandise</h3>${(r.items || []).map((it) => crItemHtml(r, it)).join('') || '<div class="hint">Nothing added.</div>'}
    <div class="actions"><button class="btn small" data-act="cr-itadd">➕ Add from the price list</button>${(r.items || []).some((it) => { const p = crProd(it.prod); return p && (p.whpMeat || p.whpMilk || p.esi); }) ? '<button class="btn small" data-act="cr-whp">📤 Send WHP / ESI to the client</button>' : ''}</div></div>
  <div class="card"><h3>Lab tests</h3>${(r.labs || []).map((l) => `<div class="cr-item"><div class="grid2"><div class="f"><label>Laboratory</label><select data-crlab="${l.id}" data-k="lab">${['', ...crLabs()].map((x) => `<option ${x === l.lab ? 'selected' : ''} value="${h(x)}">${h(x || 'Choose…')}</option>`).join('')}</select></div><div class="f"><label>Test</label><select data-crlab="${l.id}" data-k="prod"><option value="">Not charged</option>${crProds('lab').map((p) => `<option value="${p.id}" ${p.id === l.prod ? 'selected' : ''}>${h(p.name)}</option>`).join('')}</select></div></div>
      <div class="f"><label>Samples and what was asked for</label><textarea data-crlab="${l.id}" data-k="what" rows="2">${h(l.what || '')}</textarea></div><div class="f"><label>Results (link to the results in OneDrive, for now)</label><input data-crlab="${l.id}" data-k="results" value="${h(l.results || '')}"></div><button class="btn small" data-act="cr-labdel" data-id="${l.id}">✕ Remove</button></div>`).join('') || '<div class="hint">No lab tests.</div>'}
    <div class="actions"><button class="btn small" data-act="cr-labadd">➕ Lab test</button></div></div>
  <div class="card"><h3>Certificates</h3>${(r.certs || []).map((c, i) => `<div class="cr-row"><b>${h((crProd(c.prod) || {}).name || 'Certificate')}</b> × <input type="number" min="1" data-crcert="${i}" value="${c.qty || 1}" style="width:70px" aria-label="How many"> <button class="btn small" data-act="cr-certdel" data-i="${i}" aria-label="Remove">✕</button></div>`).join('') || '<div class="hint">None.</div>'}
    <div class="cr-row"><select id="cr-addcert" aria-label="Add a certificate"><option value="">➕ Add a certificate…</option>${crProds('cert').map((p) => `<option value="${p.id}">${h(p.name)}</option>`).join('')}</select></div><div class="hint">The certificate documents themselves come next (BBSE, PD, fit to load, insurance, PM report).</div></div>
  <div class="card"><h3><span class="sp">Clinical notes</span><button class="btn small" data-act="cr-dict" data-tgt="notes" type="button">🎤 Speak</button></h3><textarea data-crf="notes" rows="5">${h(r.notes || '')}</textarea><div class="hint">Words it gets wrong? <button class="btn small" data-act="cr-teach" type="button">🗣 Teach it a word</button></div></div>
  </fieldset>
  <div class="card"><h3><span class="sp">Follow-ups</span><button class="btn small" data-act="cr-fuadd">➕ Follow-up</button></h3>${Bk.list('followups').filter((f) => !f.gone && f.rec === r.id).map((f) => `<div class="kv bk-tap" data-act="cr-fuopen" data-id="${f.id}"><div class="v"><b>${h((Bk.get(f.type) || {}).name || 'Follow-up')}</b> — due ${bkDate(f.due)}${f.status === 'done' ? ' ✓ done' : ''}${f.notes ? `<br><span class="hint">${h(f.notes)}</span>` : ''}</div></div>`).join('') || '<div class="hint">None.</div>'}</div>
  <div class="card"><h3>Related records</h3>${(r.links || []).map((id) => { const o = crGet('crrec', id); return o ? `<div class="cr-row"><a href="#" data-act="cr-open" data-id="${o.id}">${bkDate(o.date)} — ${h(Bk.type(o.type).name)}${(o.procs || []).length ? ' · ' + h(o.procs.map((p) => (crTpl(p.tpl) || {}).name).join(', ')) : ''}</a> <button class="btn small" data-act="cr-unlink" data-id="${id}" aria-label="Unlink">✕</button></div>` : ''; }).join('') || '<div class="hint">None linked.</div>'}
    ${crList('crrec').some((o) => !o.gone && o.bid === r.bid && o.id !== r.id && !(r.links || []).includes(o.id)) ? `<div class="cr-row"><select id="cr-link" aria-label="Link a related record"><option value="">🔗 Link an earlier record for this client…</option>${crList('crrec').filter((o) => !o.gone && o.bid === r.bid && o.id !== r.id && !(r.links || []).includes(o.id)).sort((a, c) => c.date.localeCompare(a.date)).map((o) => `<option value="${o.id}">${bkDate(o.date)} — ${h(Bk.type(o.type).name)}</option>`).join('')}</select></div>` : ''}</div>
  ${crInvPreview(r)}
  <div class="actions" style="margin:10px 0 30px">${fin ? '' : `<button class="btn primary" data-act="cr-final">✓ Finalise record</button>`}<button class="btn" data-act="cr-del" style="color:var(--red)">Delete record</button></div>
  </div>`;
}
function crWarnings(r) {
  const w = []; const t = Bk.type(r.type);
  if (!r.bid) w.push('Choose the client');
  if (!r.start || !r.end) w.push('Enter the start and finish times on farm');
  if (t.where === 'farm' && !r.routeOk) w.push('Confirm the route actually taken (Farms visited) before it goes for billing');
  if (t.where === 'farm' && crTravel(r).some((x) => x.km == null)) w.push('A farm has no return km saved — add it on the farm, or travel is left off');
  const inv = crInvFor(r); if (inv && (inv.lines || []).some((l) => !(+l.price) && (crProd(l.prod) || {}).placeholder)) w.push('Some prices are still to be set in the price list (they show as $0)');
  return w;
}
function crPatHtml(r, p) {
  const pf = crPfields(); const flds = p.level === 'animal' ? pf.animal : p.level === 'mob' ? pf.mob : [];
  return `<div class="cr-item"><div class="cr-row"><b>${h(crPatName(r, p.id))}</b>${p.level === 'herd' ? crSel('species', p.species, [['cattle', 'Cattle'], ['sheep', 'Sheep']], `data-crpt="${p.id}" aria-label="Species"`) : ''}<span style="flex:1"></span><button class="btn small" data-act="cr-ptdel" data-id="${p.id}" aria-label="Remove">✕</button></div>
    ${flds.length ? `<div class="grid2">${flds.map((x) => `<div class="f"><label>${h(x.l)}${x.inv ? ' <span class="hint">· on invoice</span>' : ''}</label><input data-crpt="${p.id}" data-k="${x.k}" value="${h(p[x.k] || '')}" ${/size|weight/.test(x.k) ? 'type="number" min="0"' : ''}></div>`).join('')}</div>` : ''}</div>`;
}
function crProcHtml(r, pr) {
  const t = crTpl(pr.tpl); if (!t) return ''; const a = pr.answers || {}; const pats = r.patients || [];
  const inputs = (t.sections || []).flatMap((s) => s.inputs).filter((inp) => crShown(pr, inp)).map((inp) => {
    const v = a[inp.k] || ''; if (inp.text) return `<div class="f"><label>${h(inp.l)}</label><textarea data-crpr="${pr.id}" data-k="answers.${inp.k}" rows="2">${h(v)}</textarea></div>`;
    const isOther = v && !inp.opts.includes(v);
    return `<div class="f"><label>${h(inp.l)}</label><select data-crpr="${pr.id}" data-k="answers.${inp.k}"><option value="">Choose…</option>${inp.opts.map((o) => `<option value="${h(o)}" ${o === v ? 'selected' : ''}>${h(o.length > 110 ? o.slice(0, 107) + '…' : o)}</option>`).join('')}${inp.other ? `<option value="__other" ${isOther ? 'selected' : ''}>Other — type it</option>` : ''}</select>${isOther || a['_o_' + inp.k] ? `<input data-crpr="${pr.id}" data-k="answers.${inp.k}" value="${h(isOther ? v : '')}" style="margin-top:4px" aria-label="${h(inp.l)} — other">` : ''}</div>`; }).join('');
  const pd = t.quick === 'pd'; const c = pd ? crPdSummary(pr) : null; const split = pd && /split/.test(a.diagnosis || '');
  return `<div class="cr-item cr-proc"><div class="cr-row"><b>${h(t.name)}</b><span style="flex:1"></span>${pd ? `<button class="btn small" data-act="cr-voicefill" data-id="${pr.id}" type="button">🎤 Say the answers</button>` : ''}<button class="btn small" data-act="cr-prdel" data-id="${pr.id}" aria-label="Remove procedure">✕</button></div>
    <div class="f"><label>For</label><select data-crpr="${pr.id}" data-k="pat">${pats.map((p) => `<option value="${p.id}" ${p.id === pr.pat ? 'selected' : ''}>${h(crPatName(r, p.id))}</option>`).join('')}</select></div>
    ${inputs}
    ${split ? `<div class="f"><label>Early / late cut-off (days — this many or more counts as early)</label><input type="number" min="0" data-crpr="${pr.id}" data-k="answers.cut" value="${h(a.cut || '')}"></div>` : ''}
    ${pd ? `<div class="cr-pdres"><b>Results:</b> ${c.n ? `${c.n} examined — ${c.P + c.H} pregnant${c.H ? ` (${c.H} heavy)` : ''}${c.early || c.late ? ` · early ${c.early}, late ${c.late}` : ''} · ${c.NDP} NDP${c.R ? ` · ${c.R} recheck` : ''}` : 'none yet'}
      <div class="actions"><button class="btn primary" data-act="cr-chute" data-id="${pr.id}">🐄 Crush quick entry</button></div></div>`
      : t.charge && t.charge.head ? `<div class="f"><label>Number of head</label><input type="number" min="0" data-crpr="${pr.id}" data-k="head" value="${pr.head || ''}"></div>` : ''}
    <div class="f"><label>Notes for this procedure</label><textarea data-crpr="${pr.id}" data-k="notes" rows="2">${h(pr.notes || '')}</textarea></div></div>`;
}
function crItemHtml(r, it) {
  const p = crProd(it.prod); if (!p) return ''; const md = p.cat === 'med' || p.cat === 'consumable';
  const whp = [p.whpMeat ? `Meat WHP ${h(p.whpMeat)}` : '', p.whpMilk ? `Milk WHP ${h(p.whpMilk)}` : '', p.esi ? `ESI ${h(p.esi)}` : ''].filter(Boolean).join(' · ');
  return `<div class="cr-item"><div class="cr-row"><b>${h(p.name)}</b><span style="flex:1"></span><button class="btn small" data-act="cr-itdel" data-id="${it.id}" aria-label="Remove">✕</button></div>
    <div class="cr-row"><input type="number" min="0" step="any" data-crit="${it.id}" data-k="qty" value="${it.qty}" style="width:90px" aria-label="Quantity">
    ${md ? crSel('as', it.as || 'dose', [['dose', `${p.unit || 'mL'} (single dose)`], ['pack', `${p.packName || 'bottle'}s (${p.pack || '?'} ${p.unit || 'mL'})`]], `data-crit="${it.id}" aria-label="Single dose or whole pack"`) : `<span>${h(p.unit || 'each')}</span>`}
    ${crSel('mode', it.mode || (p.cat === 'merch' ? 'merch' : p.cat === 'consumable' ? 'cons' : 'admin'), [['admin', 'Given'], ['disp', 'Dispensed'], ['cons', 'Used'], ['merch', 'Sold']], `data-crit="${it.id}" aria-label="Given or dispensed"`)}</div>
    <div class="hint">= ${h(crProdLabel(p, it.qty, it.as))}${p.dose ? ` · dose ${h(p.dose)}` : ''}${p.route ? ` · ${h(p.route)}` : ''}${whp ? ` · <b>${whp}</b>` : ''}</div>
    ${md ? `<div class="f"><label>Batch number (optional)</label><input data-crit="${it.id}" data-k="batch" value="${h(it.batch || '')}"></div>` : ''}</div>`;
}
function crInvPreview(r) {
  const inv = crInvFor(r) || { lines: crBuildLines(r), status: 'notready' }; const tt = crInvTotals(inv);
  return `<div class="card"><h3><span class="sp">Invoice ${crInvPill(inv)}</span>${inv.id ? `<button class="btn small" data-act="cr-invopen" data-id="${inv.id}">Open invoice</button>` : ''}</h3>
    <div class="cr-gst">All prices exclude GST — GST is added at the bottom.</div>
    ${crLinesTable(inv, false)}
    <div class="cr-tot"><div>Subtotal (ex GST) <b>${crMoney(tt.sub)}</b></div><div>GST <b>${crMoney(tt.gst)}</b></div><div>Total (inc GST) <b>${crMoney(tt.total)}</b></div></div>
    <div class="actions">${inv.status === 'notready' ? '<button class="btn primary" data-act="cr-topending">Ready for billing — send for approval</button>' : ''}${inv.status === 'pending' ? '<button class="btn" data-act="cr-tonotready">Not ready for billing yet</button>' : ''}</div>
    <div class="hint">The invoice is built from this record (time, procedures, travel, after hours, labour and items). Change a line in the invoice and your change is kept. Once approved, changes to the record no longer change the invoice.</div></div>`;
}
function crLinesTable(inv, edit) {
  const L = inv.lines || []; if (!L.length) return '<div class="hint">Nothing to charge yet.</div>';
  if (edit) return `<div class="cr-elines">${L.map((l) => `<div class="cr-eline"><input data-crline="${l.id}" data-k="desc" value="${h(l.desc)}" aria-label="Description">
    <div class="cr-row"><label class="hint">Qty <input type="number" step="any" data-crline="${l.id}" data-k="qty" value="${l.qty}" style="width:76px"></label><label class="hint">Price ex GST <input type="number" step="0.0001" data-crline="${l.id}" data-k="price" value="${l.price}" style="width:96px"></label><b style="margin-left:auto">${crMoney(l.qty * l.price)}</b><button class="btn small" data-act="cr-linedel" data-id="${l.id}" aria-label="Remove line">✕</button></div></div>`).join('')}</div>`;
  return `<div class="cr-vlines">${L.map((l) => `<div class="cr-vline"><div>${h(l.desc)}${!(+l.price) && (crProd(l.prod) || {}).placeholder ? ' <span class="cr-pill notready">price to be set</span>' : ''}<br><span class="hint">${l.qty} × ${crMoney(l.price)}</span></div><b>${crMoney(l.qty * l.price)}</b></div>`).join('')}</div>`;
}

/* ---------------- quick entry in the crush (pregnancy testing) ---------------- */
const CRC = { r: null, pr: null, voice: null, heard: '', mode: 'each' };
function crChute(r, pr) {
  CRC.r = r; CRC.pr = pr; pr.animals = pr.animals || []; pr.counts = pr.counts || { P: 0, NDP: 0, R: 0, H: 0 };
  const ov = document.createElement('div'); ov.id = 'cr-chute'; ov.className = 'cr-chute'; document.body.appendChild(ov); crChuteDraw(); try { safePush({ chute: 1 }); } catch (e) { }
}
function crChuteDraw() {
  const ov = document.getElementById('cr-chute'); if (!ov) return; const pr = CRC.pr, c = crPdSummary(pr); const noAge = /^pregnant or not detectably pregnant only/.test((pr.answers || {}).diagnosis || '');
  const days = []; for (let d = 40; d <= 100; d += 5) days.push(d); const last = pr.animals.slice(-6).reverse();
  const each = CRC.mode === 'each';
  ov.innerHTML = `<div class="cr-ch-h"><button class="btn" data-act="crc-close">‹ Done</button><b>${c.n} done</b><span class="hint">P ${c.P + c.H} · NDP ${c.NDP}${c.R ? ' · R ' + c.R : ''}</span></div>
  <div class="chips" style="margin:6px 0"><button class="chip ${each ? 'on' : ''}" data-act="crc-mode" data-v="each">Each animal</button><button class="chip ${each ? '' : 'on'}" data-act="crc-mode" data-v="mob">Mob counts</button></div>
  ${each ? `<div class="cr-row"><label for="crc-tag" class="hint" style="width:100%;margin-bottom:-4px">Visual tag (optional)</label><input id="crc-tag" autocomplete="off" inputmode="text" style="flex:1;font-size:20px;padding:10px"><button class="btn ${CRC.voice ? 'primary' : ''}" data-act="crc-voice" style="font-size:20px">${CRC.voice ? '🎙 Listening' : '🎤 Voice'}</button></div>
    ${CRC.heard ? `<div class="hint">Heard: “${h(CRC.heard)}” <button class="btn small" data-act="cr-teach" data-heard="${h(CRC.heard)}">Wrong word? Fix it</button></div>` : ''}
    <div class="cr-chb">${noAge ? '<button data-act="crc-res" data-res="P" class="p big">P<br><small>pregnant</small></button>' : days.map((d) => `<button data-act="crc-res" data-res="P" data-days="${d}" class="p">${d}</button>`).join('') + '<button data-act="crc-res" data-res="H" class="p">Heavy</button><button data-act="crc-res" data-res="P" class="p">P<br><small>no age</small></button>'}
      <button data-act="crc-res" data-res="NDP" class="n">NDP</button>${noAge ? '' : '<button data-act="crc-res" data-res="R" class="r">Recheck</button>'}</div>
    <div class="cr-last">${last.map((x) => `<div>#${x.n} ${x.tag ? h(x.tag) + ' — ' : ''}<b>${x.res === 'P' ? 'P' + (x.days ? ' ' + x.days + ' d' : '') : x.res === 'H' ? 'Heavy' : x.res === 'R' ? 'Recheck' : 'NDP'}</b></div>`).join('')}</div>
    <div class="actions"><button class="btn" data-act="crc-undo" ${pr.animals.length ? '' : 'disabled'}>↶ Undo last</button></div>
    <div class="hint">Voice: say “40”, “65 tag 123”, “empty”, “NDP”, “heavy”, “recheck” or “undo”. It needs mobile signal; without it, use the buttons.</div>`
    : `<div class="cr-cnt">${[['P', 'Pregnant'], ['NDP', 'NDP'], ['H', 'Heavy'], ['R', 'Recheck']].map(([k, l]) => `<div class="cr-cntr"><b>${l}</b><div class="cr-row"><button class="btn" data-act="crc-cnt" data-k="${k}" data-v="-1" style="font-size:24px">−</button><span style="font-size:28px;min-width:60px;text-align:center">${pr.counts[k] || 0}</span><button class="btn primary" data-act="crc-cnt" data-k="${k}" data-v="1" style="font-size:24px">+</button></div></div>`).join('')}</div>
    <div class="hint">Counts for the mob as a whole (no tags). Added to any animals done one by one.</div>`}`;
  const tg = document.getElementById('crc-tag'); if (tg && !CRC.voice) tg.focus({ preventScroll: true });
}
function crChuteAdd(res, days, tag) {
  const pr = CRC.pr; const tg = document.getElementById('crc-tag'); const t = tag != null ? tag : tg ? tg.value.trim() : '';
  pr.animals.push({ n: pr.animals.length + 1, tag: t || '', res, days: days ? +days : null, t: Date.now() }); crSave(CRC.r); crInvSync(CRC.r);
  if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) { } crChuteDraw();
}
function crChuteClose() { if (CRC.voice) { CRC.voice.stop(); CRC.voice = null; } const ov = document.getElementById('cr-chute'); if (ov) ov.remove(); CRC.heard = ''; save(); Sync.soon(); renderAll(); }

/* ---------------- voice: notes, and saying the template answers ---------------- */
const CR_SAY = { method: [/ultra ?sound|scan/, /palpat|manual/], restraint: [/crush/, /rotary|dairy|platform/, /race.*(palpat.*possible|can palpat)/, /race.*(not possible|no facilit|can'?t palpat)/, /lactating|dry.*crush/], diagnosis: [/pregnant or not|no (a|ag)ing|not aged/, /40 ?(to|-) ?90/, /heav|recheck|100/, /split/],
  bangtail: [/bang ?tail(ed)? (yes|done)|yes bang/, /spray/, /previously|some.*already/, /no bang|bang ?tail no/, /no ndps?|none empty/, /already bang/], drafted: [/draft(ed)? (yes|out)|yes draft/, /draft(ed)? no|not drafted/, /no ndps? to draft/],
  bull: [/(out|removed).*(more than|over) ?6|out >6|bull out (6|six) weeks/, /still in/, /(out|removed).*(less than|under) ?6/], vtags: [/no visual|visual tags? no/, /visual.*all.*bovitech|visual.*all.*us/, /visual.*ndp.*bovitech|visual.*ndp.*us/, /visual.*all.*client/, /visual.*ndp.*client/], nlis: [/no nlis|nlis no/, /nlis.*all.*(bovitech|us)/, /nlis.*all.*client/, /nlis.*ndp.*(bovitech|us)/, /nlis.*ndp.*client/] };
function crVoiceFill(pr, text) { const t = crTpl(pr.tpl); if (!t) return 0; let n = 0; pr.answers = pr.answers || {};
  t.sections.flatMap((s) => s.inputs).forEach((inp) => { const say = CR_SAY[inp.k]; if (!say || !inp.opts) return; const i = say.findIndex((re) => re && re.test(text)); if (i >= 0 && inp.opts[i]) { pr.answers[inp.k] = inp.opts[i]; n++; } });
  const nm = text.match(/notes? (.*)$/); if (nm) { pr.notes = ((pr.notes || '') + ' ' + nm[1]).trim(); n++; } return n; }
async function crTeach(heard) {
  const v = await new Promise((res) => { openSheet('Teach it a word', `<div class="hint" style="margin-bottom:6px">When voice hears something wrong, tell it what it heard and what you meant. It fixes it every time from now on (on every device).</div>
    <div class="f"><label for="crt-h">What it heard</label><input id="crt-h" value="${h(heard || '')}"></div><div class="f"><label for="crt-t">What you meant</label><input id="crt-t"></div>`, () => { const a = document.getElementById('crt-h').value.trim().toLowerCase(), b = document.getElementById('crt-t').value.trim(); if (!a || !b) { toast('Fill in both boxes'); return false; } res({ heard: a, to: b }); return true; }); });
  if (!v) return; const c = crCfg('vocab'); if (!c) return; c.list = [...(c.list || []).filter((x) => x.heard !== v.heard), v]; crSave(c); toast(`From now on “${v.heard}” becomes “${v.to}”`);
}

/* ---------------- invoices ---------------- */
function crInvsHtml() {
  const tab = CR.invTab || 'all'; const all = crList('crinv').filter((x) => !x.gone); const q = (CR.invQ || '').toLowerCase().trim();
  const cnt = (k) => all.filter((x) => x.status === k).length;
  let L = tab === 'all' ? all : all.filter((x) => x.status === tab); if (q) L = L.filter((x) => (crBizName(x.bid) + ' ' + (x.num || '')).toLowerCase().includes(q));
  L.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `<div class="d-wrap cr"><h2 class="sec-h" style="font-size:26px">Invoices</h2><div class="cr-gst">All prices exclude GST — GST is added at the bottom of each invoice.</div>
  <div class="search" style="margin:8px 0"><input id="cr-iq" type="search" placeholder="Search invoices" value="${h(CR.invQ || '')}" autocomplete="off" aria-label="Search invoices"></div>
  <div class="chips">${[['all', 'All'], ...Object.entries(CR_INV_ST)].map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-act="cr-itab" data-v="${k}">${h(l)}${k !== 'all' && cnt(k) ? ` (${cnt(k)})` : ''}</button>`).join('')}</div>
  <div class="card">${L.length ? L.map(crInvRow).join('') : '<div class="hint">None.</div>'}</div></div>`;
}
function crInvRow(inv) { const tt = crInvTotals(inv); return `<div class="kv bk-tap" data-act="cr-invopen" data-id="${inv.id}" style="align-items:center"><div class="v"><b>${h(crBizName(inv.bid))}</b> ${crInvPill(inv)}<br><span class="hint">${inv.num ? h(inv.num) + ' · ' : ''}${inv.date ? bkDate(inv.date) : ''} · ${crMoney(tt.total)} inc GST</span></div></div>`; }
function crInvHtml(inv) {
  const r = crGet('crrec', inv.rec); const tt = crInvTotals(inv); const st = inv.status; const ed = st === 'notready' || st === 'pending' || st === 'approved' || st === 'sent';
  const b = IDX.biz.get(inv.bid); const em = b ? (b.emails || []).filter((e) => emailUse(e).includes('invoice')).map((e) => e.value) : [];
  const due = inv.sentAt ? new Date(inv.sentAt + crFees().payDays * 864e5) : null;
  return `<div class="d-wrap cr"><div class="actions" style="margin-bottom:6px"><button class="btn small" data-act="cr-tab" data-v="invs">‹ Invoices</button>${r ? `<button class="btn small" data-act="cr-open" data-id="${r.id}">📋 The record</button>` : ''}<button class="btn small" data-act="cr-invpdf" data-id="${inv.id}">🖨 Preview / PDF</button></div>
  <h2 class="sec-h" style="font-size:24px">${h(crInvName(inv.bid) || crBizName(inv.bid))} ${crInvPill(inv)}</h2>
  <div class="card"><div class="kv"><div class="k">Invoice number</div><div class="v">${inv.num ? h(inv.num) : '<span class="hint">given when approved (continues from Xero)</span>'}</div></div><div class="kv"><div class="k">Date</div><div class="v">${inv.date ? bkDate(inv.date, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div></div>
    ${inv.sentAt ? `<div class="kv"><div class="k">Sent</div><div class="v">${new Date(inv.sentAt).toLocaleDateString('en-AU')} — due ${due.toLocaleDateString('en-AU')}</div></div>` : ''}${inv.paidAt ? `<div class="kv"><div class="k">Paid</div><div class="v">${new Date(inv.paidAt).toLocaleDateString('en-AU')}</div></div>` : ''}
    <div class="kv"><div class="k">Invoices go to</div><div class="v">${em.length ? em.map(h).join('<br>') : '<b style="color:var(--red)">No invoicing email on the business</b> — tick 🧾 Invoicing on an email'}</div></div></div>
  <div class="card"><h3><span class="sp">Lines</span>${ed ? '<button class="btn small" data-act="cr-lineadd">➕ Line</button>' : ''}${r && (st === 'notready' || st === 'pending') ? '<button class="btn small" data-act="cr-rebuild">↻ Rebuild from record</button>' : ''}</h3>
    <div class="cr-gst">All prices exclude GST — GST is added at the bottom.</div>${crLinesTable(inv, ed)}
    <div class="cr-tot"><div>Subtotal (ex GST) <b>${crMoney(tt.sub)}</b></div><div>GST <b>${crMoney(tt.gst)}</b></div><div>Total (inc GST) <b>${crMoney(tt.total)}</b></div></div>
    ${st === 'approved' || st === 'sent' ? '<div class="hint">Changes after approval are written in the change log below.</div>' : ''}</div>
  <div class="card"><h3>Status</h3><div class="cr-steps">${Object.entries(CR_INV_ST).map(([k, l]) => `<span class="${k === st ? 'on' : ''}">${h(l)}</span>`).join('<span>›</span>')}</div>
    <div class="actions">${st === 'notready' ? '<button class="btn primary" data-act="cr-istat" data-v="pending">Send for approval</button>' : ''}
      ${st === 'pending' ? `${crPerm('approve') ? '<button class="btn primary" data-act="cr-istat" data-v="approved">✓ Approve</button>' : '<span class="hint">Waiting for the office to approve.</span>'}<button class="btn" data-act="cr-istat" data-v="notready">Not ready yet</button>` : ''}
      ${st === 'approved' ? `${crPerm('send') ? '<button class="btn primary" data-act="cr-isend">📧 Send to the client</button><button class="btn" data-act="cr-istat" data-v="sent">Mark as sent</button>' : ''}${crPerm('approve') ? '<button class="btn" data-act="cr-istat" data-v="pending">Undo approval</button>' : ''}` : ''}
      ${st === 'sent' ? `<button class="btn primary" data-act="cr-istat" data-v="paid">✓ Mark paid</button>${crPerm('send') ? '<button class="btn" data-act="cr-isend">📧 Send again</button>' : ''}` : ''}
      ${st === 'paid' ? '<button class="btn" data-act="cr-istat" data-v="sent">Not paid after all</button>' : ''}</div>
    <div class="hint">Paid will come across from Xero automatically once Xero is connected (coming next). For now, mark it here.</div></div>
  <div class="card"><h3>Change log</h3>${(inv.log || []).slice().reverse().map((x) => `<div class="kv"><div class="k">${new Date(x.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div><div class="v">${h(x.what)}${x.by ? ` <span class="hint">— ${h(Bk.pname(x.by))}</span>` : ''}</div></div>`).join('') || '<div class="hint">No changes yet.</div>'}</div></div>`;
}
function crOverdueHtml() {
  const L = crList('crinv').filter((x) => !x.gone && crOverdue(x)).sort((a, b) => a.sentAt - b.sentAt); const fz = crFees();
  const sent = crList('crinv').filter((x) => !x.gone && x.status === 'sent' && !crOverdue(x));
  return `<div class="d-wrap cr"><h2 class="sec-h" style="font-size:26px">Overdue</h2><div class="hint" style="margin-bottom:8px">Sent more than ${fz.payDays} days ago and not paid. Totals include GST.</div>
  <div class="card">${L.length ? L.map((inv) => { const d = Math.floor((Date.now() - inv.sentAt) / 864e5) - fz.payDays; const tt = crInvTotals(inv); const rm = (inv.reminders || []).slice(-1)[0];
    return `<div class="cr-item cr-over"><div class="cr-row"><b>${h(crBizName(inv.bid))}</b><span style="flex:1"></span><b>${crMoney(tt.total)}</b></div><div class="hint">${inv.num ? h(inv.num) + ' · ' : ''}sent ${new Date(inv.sentAt).toLocaleDateString('en-AU')} · <b>${d} day${d === 1 ? '' : 's'} overdue</b>${rm ? ` · reminded ${new Date(rm.at).toLocaleDateString('en-AU')}` : ''}</div>
      <div class="actions"><button class="btn small" data-act="cr-remind" data-id="${inv.id}">📧 Send a reminder</button>${bizCallBtnsCr(inv.bid)}<button class="btn small" data-act="cr-paid" data-id="${inv.id}">✓ Paid</button><button class="btn small" data-act="cr-invopen" data-id="${inv.id}">Open</button></div></div>`; }).join('') : '<div class="hint">Nothing overdue. 🎉</div>'}</div>
  ${sent.length ? `<div class="card"><h3>Sent, not due yet (${sent.length})</h3>${sent.map(crInvRow).join('')}</div>` : ''}</div>`;
}
function bizCallBtnsCr(bid) { const b = IDX.biz.get(bid); if (!b) return ''; const ph = [...(b.phones || []), ...(b.mobiles || [])].map((p) => p.value || p.number).filter(Boolean)[0]; return ph ? `<a class="btn small" href="tel:${h(String(ph).replace(/\s/g, ''))}">📞 Ring</a>` : ''; }
function crFusHtml() {
  const L = Bk.list('followups').filter((f) => !f.gone && f.status !== 'done').sort((a, b) => (a.due || '').localeCompare(b.due || '')); const t = bkToday();
  return `<div class="d-wrap cr"><h2 class="sec-h" style="font-size:26px">Follow-ups</h2><div class="hint" style="margin-bottom:8px">Add them from a record. Types are in Settings → Clinical records.</div>
  <div class="card">${L.length ? L.map((f) => `<div class="cr-item ${f.due < t ? 'cr-over' : ''}"><div class="cr-row"><b>${h((Bk.get(f.type) || {}).name || 'Follow-up')}</b> — ${h(Bk.who(f))}<span style="flex:1"></span>${f.due < t ? '<b style="color:var(--red)">overdue</b>' : ''}</div><div class="hint">Due ${bkDate(f.due)}${f.staff ? ' · ' + h(Bk.pname(f.staff)) : ''}${f.notes ? ' · ' + h(f.notes) : ''}</div>
    <div class="actions"><button class="btn small" data-act="cr-fudone" data-id="${f.id}">✓ Done</button>${f.rec ? `<button class="btn small" data-act="cr-open" data-id="${f.rec}">📋 Record</button>` : ''}<button class="btn small" data-act="cr-fuopen" data-id="${f.id}">✏️ Change</button></div></div>`).join('') : '<div class="hint">No follow-ups to do.</div>'}</div></div>`;
}

/* ---------------- the price list ---------------- */
function crProdsHtml() {
  const cat = CR.pcat || 'service', q = (CR.prodQ || '').toLowerCase().trim(); const ed = crAdmin() || S.admin || crPerm('approve');
  let L = crList('crprod').filter((p) => !p.gone && (q ? true : p.cat === cat)); if (q) L = L.filter((p) => ((p.name || '') + ' ' + (p.barcode || '')).toLowerCase().includes(q)); L.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const n0 = crList('crprod').filter((p) => !p.gone && p.placeholder && !(+p.price)).length;
  return `<div class="d-wrap cr"><h2 class="sec-h" style="font-size:26px">Price list</h2><div class="cr-gst">All prices exclude GST.</div>${n0 ? `<div class="cr-warn">${n0} price${n0 === 1 ? ' is' : 's are'} still to be set — they'll come in with the ezyVet export, or set them here.</div>` : ''}
  <div class="search" style="margin:8px 0"><input id="cr-pq" type="search" placeholder="Search products and services" value="${h(CR.prodQ || '')}" autocomplete="off" aria-label="Search the price list"></div>
  ${q ? '' : `<div class="chips">${CR_PCATS.map(([k, l]) => `<button class="chip ${cat === k ? 'on' : ''}" data-act="cr-pcat" data-v="${k}">${h(l)}</button>`).join('')}</div>`}
  ${ed ? `<div class="actions"><button class="btn primary" data-act="cr-prodnew">➕ New</button></div>` : ''}
  <div class="card">${L.map((p) => `<div class="kv ${ed ? 'bk-tap' : ''}" ${ed ? `data-act="cr-prodedit" data-id="${p.id}"` : ''} style="align-items:center"><div class="v"><b>${h(p.name)}</b>${p.active === false ? ' <span class="hint">(not used)</span>' : ''}<br><span class="hint">${!(+p.price) && p.placeholder ? '<span class="cr-pill notready">price to be set</span>' : crMoney(p.price) + ' per ' + h(p.cat === 'med' || p.cat === 'consumable' ? p.unit || 'mL' : p.unit || 'each')}${p.pricePack ? ` · ${crMoney(p.pricePack)} per ${h(p.packName || 'bottle')} (${p.pack} ${h(p.unit || 'mL')})` : ''}${p.stock != null ? ` · in stock ${p.stock} ${h(p.unit || '')}${p.pack ? ` (${Math.floor(p.stock / p.pack * 10) / 10} ${h(p.packName || 'bottle')}s)` : ''}` : ''}${p.whpMeat || p.esi ? ' · WHP / ESI saved' : ''}</span></div></div>`).join('') || '<div class="hint">Nothing here yet.</div>'}</div></div>`;
}
function crProdOpen(p) {
  const isNew = !p; const x = p ? bkClone(p) : { id: uid('p'), cat: CR.pcat || 'service', name: '', unit: (CR.pcat === 'med' ? 'mL' : 'each'), price: 0 };
  const md = (c) => c === 'med' || c === 'consumable';
  openSheet(isNew ? 'New item' : x.name, `<div class="cr-gst">Prices exclude GST.</div>
    <div class="grid2"><div class="f"><label for="cp-cat">Type</label><select id="cp-cat">${CR_PCATS.map(([k, l]) => `<option value="${k}" ${k === x.cat ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></div><div class="f"><label for="cp-name">Name</label><input id="cp-name" value="${h(x.name)}"></div></div>
    ${x.role ? `<div class="hint" style="margin-bottom:6px">Used by the invoice for: <b>${h(CR_ROLES[x.role] || x.role)}</b></div>` : ''}
    <div class="grid2"><div class="f"><label for="cp-unit">Charged per (mL, head, hour, km, each…)</label><input id="cp-unit" value="${h(x.unit || '')}"></div><div class="f"><label for="cp-price">Price per ${h(x.unit || 'unit')} ex GST ($)</label><input id="cp-price" type="number" step="0.0001" min="0" value="${x.price || 0}"></div></div>
    ${x.role === 'subsidy' ? `<div class="f"><label for="cp-cap">Subsidy applies up to (km)</label><input id="cp-cap" type="number" min="0" value="${x.cap || 200}"></div>` : ''}
    ${x.role === 'appt' ? `<div class="f"><label>Charged for these appointment types</label><div class="cr-chks">${Bk.cfg('type').map((t) => `<label class="bk-radio"><input type="checkbox" class="cp-type" value="${t.id}" ${(x.types || []).includes(t.id) ? 'checked' : ''}> ${h(t.name)}</label>`).join('')}</div></div>` : ''}
    <div id="cp-med" ${md(x.cat) ? '' : 'hidden'}><div class="grid2"><div class="f"><label for="cp-pack">Bottle / pack size (in ${h(x.unit || 'mL')})</label><input id="cp-pack" type="number" min="0" step="any" value="${x.pack || ''}"></div><div class="f"><label for="cp-packname">Called a</label><input id="cp-packname" value="${h(x.packName || 'bottle')}"></div></div>
      <div class="grid2"><div class="f"><label for="cp-ppack">Price for a whole ${h(x.packName || 'bottle')} ex GST ($)</label><input id="cp-ppack" type="number" step="0.01" min="0" value="${x.pricePack || ''}"></div><div class="f"><label for="cp-dose">Dose</label><input id="cp-dose" value="${h(x.dose || '')}"></div></div>
      <div class="grid2"><div class="f"><label for="cp-route">Route</label><input id="cp-route" value="${h(x.route || '')}"></div><div class="f"><label for="cp-stock">In stock (in ${h(x.unit || 'mL')} — leave empty to not track)</label><input id="cp-stock" type="number" step="any" value="${x.stock ?? ''}"></div></div>
      <div class="grid2"><div class="f"><label for="cp-whpm">Meat WHP</label><input id="cp-whpm" value="${h(x.whpMeat || '')}"></div><div class="f"><label for="cp-whpk">Milk WHP</label><input id="cp-whpk" value="${h(x.whpMilk || '')}"></div></div>
      <div class="f"><label for="cp-esi">ESI (export slaughter interval)</label><input id="cp-esi" value="${h(x.esi || '')}"></div></div>
    <div class="f"><label for="cp-bar">Barcode</label><input id="cp-bar" value="${h(x.barcode || '')}"></div>
    <label class="bk-radio" style="display:flex"><input type="checkbox" id="cp-active" ${x.active === false ? '' : 'checked'}> In use</label>`, () => {
    const g = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    x.cat = g('cp-cat'); x.name = g('cp-name'); if (!x.name) { toast('Give it a name'); return false; } x.unit = g('cp-unit') || 'each'; x.price = +g('cp-price') || 0; if (x.price) x.placeholder = false;
    if (document.getElementById('cp-cap')) x.cap = +g('cp-cap') || 200; if (x.role === 'appt') x.types = [...document.querySelectorAll('.cp-type:checked')].map((c) => c.value);
    if (md(x.cat)) { x.pack = +g('cp-pack') || null; x.packName = g('cp-packname') || 'bottle'; x.pricePack = +g('cp-ppack') || null; x.dose = g('cp-dose'); x.route = g('cp-route'); x.stock = g('cp-stock') === '' ? null : +g('cp-stock'); x.whpMeat = g('cp-whpm'); x.whpMilk = g('cp-whpk'); x.esi = g('cp-esi'); }
    x.barcode = g('cp-bar'); x.active = document.getElementById('cp-active').checked;
    const ex = crProd(x.id) || crList('crprod').find((y) => y.id === x.id); if (ex) Object.assign(ex, x), touch(ex); else { touch(x); D.crprod.push(x); } save(); setTimeout(renderAll, 0); return true;
  }, isNew || x.role ? '' : `<button class="btn" data-act="cr-proddel" data-id="${x.id}" style="color:var(--red)">Delete</button>`);
  const sh = document.getElementById('sheet'); sh.addEventListener('change', (e) => { if (e.target.id === 'cp-cat') document.getElementById('cp-med').hidden = !md(e.target.value); });
}
function crPickProd(cats) { // → product id
  return new Promise((res) => {
    const list = (q) => crList('crprod').filter((p) => !p.gone && p.active !== false && cats.includes(p.cat) && (!q || ((p.name || '') + ' ' + (p.barcode || '')).toLowerCase().includes(q))).sort((a, b) => (a.name || '').localeCompare(b.name || '')).slice(0, 60)
      .map((p) => `<div class="kv bk-tap" data-act="cr-pickp" data-id="${p.id}"><div class="v"><b>${h(p.name)}</b><br><span class="hint">${h((CR_PCATS.find((c) => c[0] === p.cat) || [])[1] || '')}${+p.price ? ' · ' + crMoney(p.price) + ' per ' + h(p.unit || 'each') : ''}</span></div></div>`).join('') || '<div class="hint">Nothing matches. Add it in Records → Price list.</div>';
    openSheet('Add from the price list', `<div class="search"><input id="cr-ppq" type="search" placeholder="Search name or barcode" autocomplete="off" aria-label="Search the price list"></div><div id="cr-ppl" style="margin-top:6px">${list('')}</div><div class="hint" style="margin-top:6px">Barcode scanning and recognising a label from a photo are coming next.</div>`, () => { res(null); return true; });
    const sv = document.getElementById('sheet-save'); if (sv) sv.textContent = 'Close';
    const sh = document.getElementById('sheet'); sh.addEventListener('input', (e) => { if (e.target.id === 'cr-ppq') document.getElementById('cr-ppl').innerHTML = list(e.target.value.toLowerCase().trim()); });
    sh.addEventListener('click', (e) => { const el = e.target.closest('[data-act=cr-pickp]'); if (!el) return; closeSheet(); res(el.dataset.id); });
  });
}

/* ---------------- PDFs (print, or save as PDF) ---------------- */
function crLetterhead(use) { const br = crBrand(); if (br.use && br.use[use] === false) return '';
  return `<div class="lh">${br.logo ? `<img src="${br.logo}" alt="" class="logo">` : ''}<div>${(br.lines || []).map((l, i) => (i ? h(l) : `<b style="font-size:18px">${h(l)}</b>`)).join('<br>')}</div></div>`; }
function crSig(sid, use) { const s = (crCfg('sigs') || {}).list || {}; const x = s[sid]; if (!x || (x.use && x.use[use] === false)) return ''; return `<div class="sig">${x.img ? `<img src="${x.img}" alt="">` : ''}<div>${h(x.name || Bk.pname(sid))}${x.title ? '<br>' + h(x.title) : ''}</div></div>`; }
const CR_PCSS = `body{font:13px/1.45 system-ui,Arial,sans-serif;color:#141414;margin:24px}h1{font-size:20px;margin:14px 0 6px}h2{font-size:15px;margin:14px 0 4px;border-bottom:1px solid #ccc}.lh{display:flex;gap:14px;align-items:center;border-bottom:2px solid #2f7a55;padding-bottom:8px}.logo{max-height:70px;max-width:180px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f3f3f3}.num{text-align:right}.tot td{border:0}.sig{margin-top:24px}.sig img{max-height:60px}.muted{color:#666}pre{white-space:pre-wrap;font:inherit;margin:0}@media print{body{margin:10mm}}`;
function crRecordDoc(r) {
  const b = IDX.biz.get(r.bid); const items = (r.items || []).map((it) => ({ it, p: crProd(it.prod) })).filter((x) => x.p);
  const pf = crPfields();
  return `<!doctype html><html><head><meta charset="utf-8"><title>Clinical record — ${h(crBizName(r.bid))} — ${h(r.date)}</title><style>${CR_PCSS}</style></head><body>${crLetterhead('records')}
  <h1>Clinical record</h1><table><tr><th>Client</th><td>${h(crBizName(r.bid))}</td><th>Date</th><td>${bkDate(r.date, { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
  <tr><th>Appointment</th><td>${h(Bk.type(r.type).name)}</td><th>Vet / tech</th><td>${h((r.staff || []).map((s) => (Bk.person(s) || {}).full_name || Bk.pname(s)).join(', '))}</td></tr>
  <tr><th>Time on farm</th><td>${r.start ? bkTime(r.start) : ''}${r.end ? ' – ' + bkTime(r.end) : ''}</td><th>Farms</th><td>${h((r.stops || []).map((s) => Bk.stopName(s)).join(', '))}</td></tr>${b && (b.pics || []).length ? `<tr><th>PIC</th><td colspan="3">${h(b.pics.map((p) => p.value).join(', '))}</td></tr>` : ''}</table>
  <h2>Patients</h2>${(r.patients || []).map((p) => `<div><b>${h(crPatName(r, p.id))}</b>${p.level !== 'herd' ? ' — ' + h((p.level === 'animal' ? pf.animal : pf.mob).map((x) => (p[x.k] ? `${x.l}: ${p[x.k]}` : '')).filter(Boolean).join(' · ')) : ''}</div>`).join('')}
  ${(r.procs || []).map((pr) => { const t = crTpl(pr.tpl) || {}; const an = (pr.animals || []).filter((x) => x.tag || x.days);
    return `<h2>${h(t.name || 'Procedure')} — ${h(crPatName(r, pr.pat))}</h2><pre>${h(crProcText(r, pr))}</pre>${an.length ? `<table style="margin-top:6px"><tr><th>#</th><th>Tag</th><th>Result</th></tr>${pr.animals.map((x) => `<tr><td>${x.n}</td><td>${h(x.tag || '')}</td><td>${x.res === 'P' ? 'Pregnant' + (x.days ? ` — ${x.days} days` : '') : x.res === 'H' ? 'Pregnant — heavy' : x.res === 'R' ? 'Recheck' : 'Not detectably pregnant'}</td></tr>`).join('')}</table>` : ''}`; }).join('')}
  ${items.length ? `<h2>Medications and products</h2><table><tr><th>Product</th><th>Amount</th><th>Given / dispensed</th><th>Batch</th><th>WHP / ESI</th></tr>${items.map(({ it, p }) => `<tr><td>${h(p.name)}</td><td>${h(crProdLabel(p, it.qty, it.as))}</td><td>${({ admin: 'Given', disp: 'Dispensed', cons: 'Used', merch: 'Sold' })[it.mode] || ''}</td><td>${h(it.batch || '')}</td><td>${h([p.whpMeat ? 'Meat ' + p.whpMeat : '', p.whpMilk ? 'Milk ' + p.whpMilk : '', p.esi ? 'ESI ' + p.esi : ''].filter(Boolean).join(' · '))}</td></tr>`).join('')}</table>` : ''}
  ${(r.labs || []).length ? `<h2>Lab tests</h2>${r.labs.map((l) => `<div><b>${h(l.lab || 'Laboratory')}</b>${l.prod ? ' — ' + h((crProd(l.prod) || {}).name || '') : ''}${l.what ? '<br>' + h(l.what) : ''}</div>`).join('')}` : ''}
  ${r.notes ? `<h2>Clinical notes</h2><pre>${h(r.notes)}</pre>` : ''}
  ${(r.staff || []).filter(crIsVet).map((s) => crSig(s, 'records')).join('')}</body></html>`;
}
function crInvoiceDoc(inv) {
  const b = IDX.biz.get(inv.bid); const tt = crInvTotals(inv); const fz = crFees(); const due = inv.sentAt ? new Date(inv.sentAt + fz.payDays * 864e5) : null; const r = crGet('crrec', inv.rec);
  const pf = crPfields(); const pats = r ? (r.patients || []).filter((p) => p.level !== 'herd').map((p) => (p.level === 'animal' ? pf.animal : pf.mob).filter((x) => x.inv && p[x.k]).map((x) => `${x.l}: ${p[x.k]}`).join(', ')).filter(Boolean) : [];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Tax invoice ${h(inv.num || '')} — ${h(crInvName(inv.bid))}</title><style>${CR_PCSS}</style></head><body>${crLetterhead('invoices')}
  <h1>Tax invoice${inv.num ? ' ' + h(inv.num) : ''}</h1><table><tr><th>Bill to</th><td>${h(crInvName(inv.bid))}${b && (b.postal || [])[0] ? '<br>' + h(b.postal[0].value || b.postal[0].address || '') : ''}</td><th>Date</th><td>${inv.date ? bkDate(inv.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}${due ? `<br>Due ${due.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}` : `<br>Due ${fz.payDays} days from the date sent`}</td></tr>${pats.length ? `<tr><th>Animals</th><td colspan="3">${h(pats.join('; '))}</td></tr>` : ''}</table>
  <h2>Details</h2><table><tr><th>Item</th><th class="num">Qty</th><th class="num">Price ex GST</th><th class="num">Amount ex GST</th></tr>${(inv.lines || []).map((l) => `<tr><td>${h(l.desc)}</td><td class="num">${l.qty}</td><td class="num">${crMoney(l.price)}</td><td class="num">${crMoney(l.qty * l.price)}</td></tr>`).join('')}
  <tr class="tot"><td colspan="3" class="num">Subtotal (ex GST)</td><td class="num">${crMoney(tt.sub)}</td></tr><tr class="tot"><td colspan="3" class="num">GST ${fz.gst}%</td><td class="num">${crMoney(tt.gst)}</td></tr><tr class="tot"><td colspan="3" class="num"><b>Total (inc GST)</b></td><td class="num"><b>${crMoney(tt.total)}</b></td></tr></table>
  ${crBrand().payText ? `<h2>Payment</h2><pre>${h(crBrand().payText)}</pre>` : ''}</body></html>`;
}
function crPrint(doc) { // a printable copy — choose "Save as PDF" to keep it
  let fr = document.getElementById('cr-print'); if (fr) fr.remove(); fr = document.createElement('iframe'); fr.id = 'cr-print'; fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'; document.body.appendChild(fr);
  const w = fr.contentWindow; w.document.open(); w.document.write(doc); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { toast("Couldn't open printing"); } }, 400);
}
window.crRecordDoc = crRecordDoc; window.crInvoiceDoc = crInvoiceDoc;

/* ---------------- settings: Clinical records, Templates, and invoice permissions (in Users) ---------------- */
function crSettingsHtml() {
  crSeed(); const fz = crFees(); const pf = crPfields();
  const rec = `<div class="cr-setwrap" data-tab="records">
  <div class="card"><h3>Clinical records (testing) (this device)</h3><label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-act="cr-toggle" ${crOn() ? 'checked' : ''}> <span>Show the Records tab on this device<br><span class="hint">Records, invoices, overdue, follow-ups and the price list. Keep using ezyVet for real records until you switch over.</span></span></label></div>
  <div class="card"><h3>Fees, travel discounts and payment</h3><div class="cr-gst">Prices are in the price list (Records → Price list) and exclude GST.</div>
    <div class="grid2"><div class="f"><label>Farms count as close together within (km)</label><input type="number" min="0" data-crset="fees" data-k="nearKm" value="${fz.nearKm}"></div><div class="f"><label>Discount on each farm's travel when close together (%)</label><input type="number" min="0" max="100" data-crset="fees" data-k="nearPct" value="${fz.nearPct}"></div></div>
    <div class="grid2"><div class="f"><label>Two clients at the same farm — each pays (% off appointment fee and travel)</label><input type="number" min="0" max="100" data-crset="fees" data-k="sharedPct" value="${fz.sharedPct}"></div><div class="f"><label>Preg testing: charge by the hour when under (head an hour)</label><input type="number" min="0" data-crset="fees" data-k="pdMinHph" value="${fz.pdMinHph}"></div></div>
    <div class="grid2"><div class="f"><label>Days to pay (then it shows as overdue)</label><input type="number" min="0" data-crset="fees" data-k="payDays" value="${fz.payDays}"></div><div class="f"><label>GST (%)</label><input type="number" min="0" data-crset="fees" data-k="gst" value="${fz.gst}"></div></div>
    <div class="grid2"><div class="f"><label>Invoice number starts with</label><input data-crset="fees" data-k="invPrefix" value="${h(fz.invPrefix || 'INV-')}"></div><div class="f"><label>Next invoice number (continue from Xero)</label><input type="number" min="1" data-crset="fees" data-k="invNext" value="${fz.invNext || ''}"></div></div></div>
  <div class="card"><h3>Patient details</h3><div class="hint" style="margin-bottom:6px">What you can record for individual animals and mobs. Tick "on invoice" for the ones that also show on the invoice.</div>
    ${[['animal', 'Individual animals'], ['mob', 'Mobs']].map(([lv, ll]) => `<div class="lbl">${ll}</div>${pf[lv].map((x, i) => `<div class="cr-row"><input data-crpf="${lv}" data-i="${i}" data-k="l" value="${h(x.l)}" aria-label="Field name" style="flex:1"><label class="bk-radio"><input type="checkbox" data-crpf="${lv}" data-i="${i}" data-k="inv" ${x.inv ? 'checked' : ''}> on invoice</label><button class="btn small" data-act="cr-pfdel" data-lv="${lv}" data-i="${i}" aria-label="Remove field">✕</button></div>`).join('')}<button class="btn small" data-act="cr-pfadd" data-lv="${lv}">➕ Field</button>`).join('')}</div>
  <div class="card"><h3><span class="sp">Follow-up types</span><button class="btn small" data-act="bks-new" data-cfg="futype">➕ New</button></h3>${Bk.cfg('futype').map((x) => `<div class="kv bk-tap" data-act="bks-edit" data-id="${x.id}"><div class="v"><b>${h(x.name)}</b> <span class="hint">· due ${x.days || 0} days after</span></div></div>`).join('')}</div>
  <div class="card"><h3>Voice words</h3><div class="hint" style="margin-bottom:6px">What voice hears → what it writes. Add one whenever it gets a word wrong (🗣 Teach it a word on a record does the same).</div>${crVocab().map((v, i) => `<div class="cr-row">“${h(v.heard)}” → <b>${h(v.to)}</b><span style="flex:1"></span><button class="btn small" data-act="cr-vocdel" data-i="${i}" aria-label="Remove">✕</button></div>`).join('')}<button class="btn small" data-act="cr-teach">➕ Word</button></div>
  <div class="card"><h3>Procedure templates</h3><div class="hint" style="margin-bottom:6px">What each procedure asks, and how it's charged. Pregnancy testing is the first full template; the others are notes only for now.</div>${crTpls().map((t) => `<div class="kv bk-tap" data-act="cr-tpledit" data-id="${t.id}"><div class="v"><b>${h(t.name)}</b>${t.draft ? ' <span class="hint">(notes only for now)</span>' : ''}<br><span class="hint">${t.who === 'tech' ? 'Techs can finalise' : 'Vets finalise'} · ${t.charge && t.charge.rule === 'pd' ? `per head, or by the hour when under ${fz.pdMinHph} head an hour` : t.charge && t.charge.head ? 'per head' : 'by the hour'}</span></div></div>`).join('')}</div>
  <div class="card"><h3>Laboratories</h3><textarea data-crset="labs" data-k="list" rows="4" aria-label="Laboratories, one per line">${h(crLabs().join('\n'))}</textarea><div class="hint">One per line.</div></div></div>`;
  const br = crBrand(); const sg = (crCfg('sigs') || {}).list || {};
  const tpl = `<div class="cr-setwrap" data-tab="templates">
  <div class="card"><h3>Letterhead and logo</h3><div class="hint" style="margin-bottom:6px">Shown at the top of records, certificates and invoices.</div>
    <div class="f"><label>Header lines (the first is the business name)</label><textarea data-crset="brand" data-k="lines" rows="5">${h((br.lines || []).join('\n'))}</textarea></div>
    <div class="f"><label>Logo</label>${br.logo ? `<img src="${br.logo}" alt="Logo" style="max-height:70px;display:block;margin-bottom:6px">` : ''}<input type="file" accept="image/*" data-crlogo="1" aria-label="Choose a logo">${br.logo ? '<button class="btn small" data-act="cr-logodel">Remove logo</button>' : ''}</div>
    <div class="f"><label>Use it on</label><div class="cr-chks">${[['records', 'Records'], ['certs', 'Certificates'], ['invoices', 'Invoices']].map(([k, l]) => `<label class="bk-radio"><input type="checkbox" data-crset="brand" data-k="use.${k}" ${(br.use || {})[k] !== false ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
    <div class="f"><label>Payment details at the bottom of invoices</label><textarea data-crset="brand" data-k="payText" rows="4">${h(br.payText || '')}</textarea><div class="hint">For example your bank details, BSB and account, and "Payment due within 7 days". A tax invoice also needs your ABN — add it to the header lines.</div></div></div>
  <div class="card"><h3>Signatures</h3><div class="hint" style="margin-bottom:6px">Each vet's signature for records and certificates.</div>${Bk.people().map((s) => { const x = sg[s.id] || {}; return `<div class="cr-item"><b>${h(s.preferred_name || s.full_name)}</b>${x.img ? `<img src="${x.img}" alt="Signature" style="max-height:50px;display:block">` : ''}
    <div class="grid2"><div class="f"><label>Name as signed</label><input data-crsig="${s.id}" data-k="name" value="${h(x.name || s.full_name || '')}"></div><div class="f"><label>Qualifications / title</label><input data-crsig="${s.id}" data-k="title" value="${h(x.title || '')}"></div></div>
    <div class="cr-row"><input type="file" accept="image/*" data-crsigimg="${s.id}" aria-label="Signature picture">${x.img ? `<button class="btn small" data-act="cr-sigdel" data-id="${s.id}">Remove picture</button>` : ''}</div>
    <div class="cr-chks">${[['records', 'Records'], ['certs', 'Certificates']].map(([k, l]) => `<label class="bk-radio"><input type="checkbox" data-crsig="${s.id}" data-k="use.${k}" ${(x.use || {})[k] !== false ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>`; }).join('')}</div></div>`;
  const pm = crCfg('perms') || {}; const all = ((window.SBAuth && SBAuth.list) || []).filter((s) => s.active && s.role !== 'admin');
  const perms = `<div class="cr-setwrap" data-tab="users"><div class="card"><h3>Invoice permissions</h3><div class="hint" style="margin-bottom:6px">Anyone can send an invoice for approval. The admin can always approve and send; tick anyone else who can. Only vets finalise vet records; techs can finalise tech records (like AI).</div>
    <div class="bk-dayscroll"><table class="bk-perm"><thead><tr><th></th><th>Approve</th><th>Send</th></tr></thead><tbody>${all.map((s) => `<tr><td>${h(s.preferred_name || s.full_name)}</td>${['approve', 'send'].map((k) => `<td><input type="checkbox" data-crperm="${k}" data-id="${s.id}" ${(pm[k] || []).includes(s.id) ? 'checked' : ''} aria-label="${k}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
  return rec + tpl + perms;
}
window.crSettingsHtml = crSettingsHtml;
function crImgData(file, max) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; im.onerror = rej; im.src = fr.result; }; fr.onerror = rej; fr.readAsDataURL(file); }); }
function crCfgRec(id) { let c = crCfg(id); if (!c) { c = { id, cfg: id }; D.crcfg.push(c); } return c; }
const crSetPath = (o, path, v) => { const ks = path.split('.'); let x = o; ks.slice(0, -1).forEach((k) => { x[k] = x[k] && typeof x[k] === 'object' ? x[k] : {}; x = x[k]; }); x[ks[ks.length - 1]] = v; };

/* ---------------- finishing, billing, stock ---------------- */
function crCanFinalise(r) { const me = crMe(); const techOnly = (r.procs || []).length && r.procs.every((p) => (crTpl(p.tpl) || {}).who === 'tech'); if (crIsVet(me)) return true; if (techOnly && me) return true; return false; }
function crStock(r, dir) { (r.items || []).forEach((it) => { const p = crProd(it.prod); if (!p || p.stock == null) return; const u = it.as === 'pack' ? (+it.qty || 0) * (+p.pack || 0) : +it.qty || 0; p.stock = crR2(p.stock - dir * u); touch(p); }); }
async function crInvStatus(inv, to) {
  const from = inv.status; if (to === 'approved' && !crPerm('approve')) { toast('Only the office can approve invoices'); return; }
  if (to === 'pending') { const r = crGet('crrec', inv.rec); if (r) { const t = Bk.type(r.type); if (t.where === 'farm' && !r.routeOk) { toast('Confirm the route actually taken on the record first'); return; } if (!r.start || !r.end) { toast('Enter the start and finish times on the record first'); return; } } }
  if (to === 'approved') { const fz = crFees(); if (!inv.num) { if (!fz.invNext) { toast('Set the next invoice number (from Xero) in Settings → Clinical records first'); return; } const c = crCfgRec('fees'); inv.num = (fz.invPrefix || 'INV-') + String(fz.invNext).padStart(4, '0'); c.invNext = +fz.invNext + 1; touch(c); }
    const z = (inv.lines || []).filter((l) => !(+l.price)); if (z.length && !(await ask(`${z.length} line${z.length === 1 ? ' is' : 's are'} $0 (price to be set?). Approve anyway?`, 'Yes — approve'))) return; }
  if (to === 'sent' && !inv.sentAt) inv.sentAt = Date.now(); if (to === 'paid') inv.paidAt = Date.now(); if (to === 'sent' && from === 'paid') inv.paidAt = null;
  inv.status = to; crInvLog(inv, `${CR_INV_ST[from]} → ${CR_INV_ST[to]}`); crSave(inv); Sync.soon(); renderAll();
}
function crRemindText(inv) { const tt = crInvTotals(inv); return `Hi ${crInvName(inv.bid)},\n\nThis is a friendly reminder that invoice ${inv.num || ''} for ${crMoney(tt.total)} (inc GST), sent on ${new Date(inv.sentAt).toLocaleDateString('en-AU')}, is now overdue. If you've already paid, thank you and please ignore this.\n\nKind regards,\n${(crBrand().lines || [])[0] || 'Bovitech Veterinary Services'}`; }
function crInvEmails(bid) { const b = IDX.biz.get(bid); return b ? (b.emails || []).filter((e) => emailUse(e).includes('invoice')).map((e) => e.value).filter(Boolean) : []; }

/* ---------------- taps and changes ---------------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^(cr|crc)-/.test(a)) return; const d = el.dataset;
  const r = CR.page === 'edit' ? crGet('crrec', CR.id) : null; const inv = CR.page === 'inv' ? crGet('crinv', CR.id) : null;
  const done = (rec) => { if (rec) { crSave(rec); if (rec === r) crInvSync(r); } Sync.soon(); renderAll(); };
  if (el.tagName === 'A') e.preventDefault();
  switch (a) {
    case 'cr-tab': CR.page = d.v; renderAll(); break;
    case 'cr-back': CR.page = 'recs'; renderAll(); break;
    case 'cr-rf': CR.rf = d.v; renderAll(); break;
    case 'cr-itab': CR.invTab = d.v; renderAll(); break;
    case 'cr-pcat': CR.pcat = d.v; renderAll(); break;
    case 'cr-open': crOpen(d.id); break;
    case 'cr-biz': S.tab = 'biz'; S.sel = { kind: 'business', id: d.id }; document.body.classList.add('show-detail'); renderAll(); break;
    case 'cr-new': { const bid = d.bid || (await crPickBiz()); if (!bid) return; crStart({ bid }); break; }
    case 'cr-frombk': { e.stopPropagation(); const b = Bk.list('bookings').find((x) => x.id === d.id); if (!b) { toast('Save the appointment first'); return; } const ex = crList('crrec').find((x) => !x.gone && x.bkId === b.id); if (document.getElementById('sheet')) closeSheet(); if (ex) crOpen(ex.id); else crStart({ bk: b }); break; }
    case 'cr-toggle': savePref('showRec', el.checked); if (!el.checked && S.tab === 'rec') S.tab = 'contacts'; renderAll(); toast(el.checked ? 'Records tab is on for this device' : 'Records tab hidden'); break;
    case 'cr-pdf': crPrint(crRecordDoc(crGet('crrec', d.id))); break;
    case 'cr-invpdf': crPrint(crInvoiceDoc(crGet('crinv', d.id))); break;
    case 'cr-invopen': CR.page = 'inv'; CR.id = d.id; S.tab = 'rec'; renderAll(); window.scrollTo(0, 0); { const l = document.getElementById('list'); if (l) l.scrollTop = 0; } break;
    // the record
    case 'cr-bradd': if (!r) return; r.breaks = [...(r.breaks || []), { mins: 30 }]; done(r); break;
    case 'cr-brdel': if (!r) return; r.breaks.splice(+d.i, 1); done(r); break;
    case 'cr-stopdel': if (!r) return; r.stops.splice(+d.i, 1); r.routeOk = false; done(r); break;
    case 'cr-ptadd': if (!r) return; r.patients.push({ id: uid('pt'), level: d.v, species: 'cattle' }); done(r); break;
    case 'cr-ptdel': { if (!r) return; if (r.patients.length < 2) { toast('A record needs at least one patient'); return; } if ((r.procs || []).some((p) => p.pat === d.id) && !(await ask('A procedure is for this patient — remove it anyway? The procedure moves to the first patient.', 'Remove'))) return; r.patients = r.patients.filter((p) => p.id !== d.id); r.procs.forEach((p) => { if (p.pat === d.id) p.pat = r.patients[0].id; }); done(r); break; }
    case 'cr-prdel': { if (!r) return; const pr = r.procs.find((p) => p.id === d.id); if (pr && (pr.animals || []).length && !(await ask(`Remove this procedure and its ${pr.animals.length} results?`, 'Remove', true))) return; r.procs = r.procs.filter((p) => p.id !== d.id); done(r); break; }
    case 'cr-chute': { if (!r) return; const pr = r.procs.find((p) => p.id === d.id); if (pr) crChute(r, pr); break; }
    case 'crc-close': crChuteClose(); break;
    case 'crc-mode': CRC.mode = d.v; crChuteDraw(); break;
    case 'crc-res': crChuteAdd(d.res, d.days); break;
    case 'crc-undo': CRC.pr.animals.pop(); crSave(CRC.r); crInvSync(CRC.r); crChuteDraw(); break;
    case 'crc-cnt': { const c = CRC.pr.counts; c[d.k] = Math.max(0, (+c[d.k] || 0) + +d.v); crSave(CRC.r); crInvSync(CRC.r); crChuteDraw(); break; }
    case 'crc-voice': if (CRC.voice) { CRC.voice.stop(); CRC.voice = null; crChuteDraw(); break; }
      CRC.voice = crListen((t, raw) => { CRC.heard = raw; const x = crParsePd(t); if (!x) { toast(`Didn't catch a result in “${raw}”`); crChuteDraw(); return; } if (x.undo) { CRC.pr.animals.pop(); crSave(CRC.r); crChuteDraw(); return; } if (x.res) crChuteAdd(x.res, x.days, x.tag || ''); else { const tg = document.getElementById('crc-tag'); if (tg) tg.value = x.tag; crChuteDraw(); } }, { continuous: true, onEnd: () => { } });
      crChuteDraw(); break;
    case 'cr-voicefill': { if (!r) return; const pr = r.procs.find((p) => p.id === d.id); if (!pr) return; el.textContent = '🎙 Listening…';
      const v = crListen((t) => { const n = crVoiceFill(pr, t); toast(n ? `Filled in ${n} answer${n === 1 ? '' : 's'}` : `Didn't match anything in “${t}”`); if (n) done(r); }, { onEnd: () => { el.textContent = '🎤 Say the answers'; } }); if (!v) el.textContent = '🎤 Say the answers'; break; }
    case 'cr-dict': { if (!r) return; el.textContent = '🎙 Listening — tap to stop'; if (CR.dict) { CR.dict.stop(); CR.dict = null; break; }
      CR.dict = crListen((t) => { r.notes = ((r.notes || '') + (r.notes ? ' ' : '') + t).trim(); crSave(r); const ta = document.querySelector('[data-crf=notes]'); if (ta) ta.value = r.notes; }, { continuous: true, onEnd: () => { CR.dict = null; el.textContent = '🎤 Speak'; } }); break; }
    case 'cr-teach': crTeach(d.heard || ''); break;
    case 'cr-itadd': { if (!r) return; const id = await crPickProd(['med', 'consumable', 'merch']); if (!id) return; const p = crProd(id); r.items.push({ id: uid('it'), prod: id, qty: 1, as: 'dose', mode: p.cat === 'merch' ? 'merch' : p.cat === 'consumable' ? 'cons' : 'admin' }); done(r); break; }
    case 'cr-itdel': if (!r) return; r.items = r.items.filter((x) => x.id !== d.id); done(r); break;
    case 'cr-whp': { if (!r) return; const L = r.items.map((it) => crProd(it.prod)).filter((p) => p && (p.whpMeat || p.whpMilk || p.esi)); const txt = `Withholding periods for the treatment on ${bkDate(r.date, { day: 'numeric', month: 'long' })}:\n` + L.map((p) => `• ${p.name}: ${[p.whpMeat ? 'meat ' + p.whpMeat : '', p.whpMilk ? 'milk ' + p.whpMilk : '', p.esi ? 'ESI ' + p.esi : ''].filter(Boolean).join(', ')}`).join('\n') + `\n— ${(crBrand().lines || [])[0] || 'Bovitech Veterinary Services'}`;
      if (navigator.share) { try { await navigator.share({ text: txt }); break; } catch (x) { if (x && x.name === 'AbortError') break; } } try { await navigator.clipboard.writeText(txt); toast('Copied — paste it into a text or email'); } catch (x) { toast("Couldn't copy"); } break; }
    case 'cr-labadd': if (!r) return; r.labs.push({ id: uid('lb'), lab: '', prod: '', what: '' }); done(r); break;
    case 'cr-labdel': if (!r) return; r.labs = r.labs.filter((x) => x.id !== d.id); done(r); break;
    case 'cr-certdel': if (!r) return; r.certs.splice(+d.i, 1); done(r); break;
    case 'cr-fuadd': if (!r) return; bkFuOpen(null, { bid: r.bid, cid: r.cid, rec: r.id }); break;
    case 'cr-fuopen': { const f = Bk.list('followups').find((x) => x.id === d.id); if (f) bkFuOpen(f); break; }
    case 'cr-fudone': { const f = Bk.list('followups').find((x) => x.id === d.id); if (!f) return; f.status = 'done'; f.doneAt = Date.now(); touch(f); save(); Sync.soon(); renderAll(); toast('Follow-up done'); break; }
    case 'cr-unlink': if (!r) return; r.links = (r.links || []).filter((x) => x !== d.id); done(r); break;
    case 'cr-final': { if (!r) return; if (!crCanFinalise(r)) { toast('Only a vet can finalise this record (techs can finalise tech-only records, like AI)'); return; } const w = crWarnings(r).filter((x) => !/price/.test(x)); if (w.length && !(await ask(`Finalise anyway?<br>${w.map((x) => '⚠ ' + h(x)).join('<br>')}`, 'Yes — finalise'))) return;
      r.status = 'final'; r.finBy = crMe(); r.finAt = Date.now(); if (!r.stockDone) { crStock(r, 1); r.stockDone = true; } done(r); toast('Record finalised'); break; }
    case 'cr-reopen': { if (!r) return; if (!crCanFinalise(r)) { toast('Only a vet can reopen this record'); return; } r.status = 'draft'; if (r.stockDone) { crStock(r, -1); r.stockDone = false; } r.log = [...(r.log || []), { at: Date.now(), by: crMe(), what: 'Reopened' }]; done(r); break; }
    case 'cr-del': { if (!r) return; const iv = crInvFor(r); if (iv && !['notready', 'pending'].includes(iv.status)) { toast("The invoice has been approved — it can't be deleted from here"); return; } if (!(await ask('Delete this record' + (iv ? ' and its invoice' : '') + '?', 'Delete', true))) return; if (r.stockDone) crStock(r, -1); r.gone = true; touch(r); if (iv) { iv.gone = true; touch(iv); } save(); Sync.soon(); CR.page = 'recs'; renderAll(); break; }
    case 'cr-topending': { if (!r) return; crInvSync(r); await crInvStatus(crInvFor(r), 'pending'); break; }
    case 'cr-tonotready': { if (!r) return; await crInvStatus(crInvFor(r), 'notready'); break; }
    // the invoice
    case 'cr-istat': if (inv) await crInvStatus(inv, d.v); break;
    case 'cr-rebuild': { if (!inv) return; const rr = crGet('crrec', inv.rec); if (!rr) return; if (!(await ask('Rebuild the lines from the record? Lines you added or changed by hand are lost.', 'Rebuild'))) return; inv.lines = []; crInvSync(rr); crInvLog(inv, 'Rebuilt from the record'); done(inv); break; }
    case 'cr-lineadd': { if (!inv) return; const id = await crPickProd(CR_PCATS.map((c) => c[0])); if (!id) return; const p = crProd(id); inv.lines.push({ id: uid('il'), prod: id, desc: p.name, qty: 1, price: +p.price || 0, auto: false }); if (['approved', 'sent'].includes(inv.status)) crInvLog(inv, `Added "${p.name}"`); done(inv); break; }
    case 'cr-linedel': { if (!inv) return; const l = inv.lines.find((x) => x.id === d.id); inv.lines = inv.lines.filter((x) => x.id !== d.id); if (l && l.auto) inv.removed = [...(inv.removed || []), l.prod + '|' + l.desc]; if (l && ['approved', 'sent'].includes(inv.status)) crInvLog(inv, `Removed "${l.desc}"`); done(inv); break; }
    case 'cr-isend': { if (!inv) return; const em = crInvEmails(inv.bid); if (!em.length) { toast('Add an invoicing email to the business first'); return; } crPrint(crInvoiceDoc(inv));
      const ok = await askBox('Send the invoice', `<p>The invoice is open to print — choose <b>Save as PDF</b>, then attach it to the email that opens next, to <b>${em.map(h).join(', ')}</b>.</p><p class="hint">Emailing it straight from the app (no attaching) comes with the Xero connection.</p>`, 'Open the email', false, 'Cancel');
      if (!ok) return; const tt = crInvTotals(inv); location.href = `mailto:${em.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(`Invoice ${inv.num || ''} — ${(crBrand().lines || [])[0] || 'Bovitech Veterinary Services'}`)}&body=${encodeURIComponent(`Hi,\n\nPlease find attached invoice ${inv.num || ''} for ${crMoney(tt.total)} (inc GST). Payment is due within ${crFees().payDays} days.\n\nKind regards,\n${(crBrand().lines || [])[0] || 'Bovitech Veterinary Services'}`)}`;
      if (inv.status === 'approved' && (await ask('Mark the invoice as sent?', 'Yes — sent'))) await crInvStatus(inv, 'sent'); break; }
    case 'cr-remind': { const iv = crGet('crinv', d.id); if (!iv) return; const em = crInvEmails(iv.bid); location.href = `mailto:${em.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent('Overdue invoice ' + (iv.num || ''))}&body=${encodeURIComponent(crRemindText(iv))}`; iv.reminders = [...(iv.reminders || []), { at: Date.now(), by: crMe() }]; crInvLog(iv, 'Reminder sent'); done(iv); break; }
    case 'cr-paid': { const iv = crGet('crinv', d.id); if (iv) { const was = CR.page; await crInvStatus(iv, 'paid'); CR.page = was; renderAll(); } break; }
    // the price list
    case 'cr-prodnew': crProdOpen(null); break;
    case 'cr-prodedit': crProdOpen(crProd(d.id)); break;
    case 'cr-proddel': { const p = crProd(d.id); if (!p || !(await ask(`Delete "${p.name}"? Old records and invoices keep their lines.`, 'Delete', true))) return; p.gone = true; touch(p); save(); closeSheet(); renderAll(); break; }
    // settings
    case 'cr-pfadd': { const c = crCfgRec('pfields'); const pf = crPfields(); c.animal = c.animal || pf.animal; c.mob = c.mob || pf.mob; c[d.lv].push({ k: 'f' + Date.now().toString(36), l: 'New field', inv: false }); crSave(c); renderAll(); break; }
    case 'cr-pfdel': { const c = crCfgRec('pfields'); if (!(await ask('Remove this field? Anything already recorded in it stays on old records.', 'Remove'))) return; c[d.lv].splice(+d.i, 1); crSave(c); renderAll(); break; }
    case 'cr-vocdel': { const c = crCfg('vocab'); if (!c) return; c.list.splice(+d.i, 1); crSave(c); renderAll(); break; }
    case 'cr-tpledit': crTplOpen(crTpl(d.id)); break;
    case 'cr-logodel': { const c = crCfgRec('brand'); c.logo = null; crSave(c); renderAll(); break; }
    case 'cr-sigdel': { const c = crCfgRec('sigs'); c.list = c.list || {}; if (c.list[d.id]) c.list[d.id].img = null; crSave(c); renderAll(); break; }
  }
});
document.addEventListener('change', async (e) => {
  const t = e.target; if (!t.closest) return; const ds = t.dataset || {};
  const val = () => (t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? null : +t.value) : t.value);
  if (ds.crset) { const c = crCfgRec(ds.crset); let v = val(); if (ds.k === 'lines' || ds.k === 'list') v = String(v).split('\n').map((x) => x.trim()).filter(Boolean); if (ds.crset === 'brand' && ds.k === 'lines') c.lines = v; else crSetPath(c, ds.k, v); crSave(c); Sync.soon(); return; }
  if (ds.crpf) { const c = crCfgRec('pfields'); const pf = crPfields(); c.animal = c.animal || bkClone(pf.animal); c.mob = c.mob || bkClone(pf.mob); c[ds.crpf][+ds.i][ds.k] = val(); crSave(c); Sync.soon(); return; }
  if (ds.crperm) { const c = crCfgRec('perms'); c[ds.crperm] = (c[ds.crperm] || []).filter((x) => x !== ds.id); if (t.checked) c[ds.crperm].push(ds.id); crSave(c); Sync.soon(); return; }
  if (ds.crsig) { const c = crCfgRec('sigs'); c.list = c.list || {}; c.list[ds.crsig] = c.list[ds.crsig] || {}; crSetPath(c.list[ds.crsig], ds.k, val()); crSave(c); Sync.soon(); return; }
  if (ds.crlogo || ds.crsigimg) { const f = t.files && t.files[0]; if (!f) return; try { const img = await crImgData(f, ds.crlogo ? 600 : 400); if (ds.crlogo) { const c = crCfgRec('brand'); c.logo = img; crSave(c); } else { const c = crCfgRec('sigs'); c.list = c.list || {}; c.list[ds.crsigimg] = { ...(c.list[ds.crsigimg] || {}), img }; crSave(c); } Sync.soon(); renderAll(); } catch (x) { toast("Couldn't read that picture"); } return; }
  if (CR.page === 'inv' && ds.crline) { const inv = crGet('crinv', CR.id); const l = inv && inv.lines.find((x) => x.id === ds.crline); if (!l) return; const old = l[ds.k]; l[ds.k] = ds.k === 'desc' ? t.value : +t.value || 0; if (l.auto) l.edited = true; if (['approved', 'sent', 'paid'].includes(inv.status)) crInvLog(inv, `"${l.desc}": ${ds.k === 'desc' ? 'description' : ds.k === 'qty' ? 'quantity' : 'price'} ${old} → ${l[ds.k]}`); crSave(inv); Sync.soon(); renderAll(); return; }
  if (CR.page !== 'edit' || S.tab !== 'rec') return; const r = crGet('crrec', CR.id); if (!r || !t.closest('.cr-edit')) return;
  const fin = () => { crSave(r); crInvSync(r); Sync.soon(); renderAll(); };
  if (ds.crf) { let v = val(); if (ds.crf === 'ah' && v === '') v = null; crSetPath(r, ds.crf, v); if (ds.crf === 'date' || ds.crf === 'type') r.routeOk = ds.crf === 'date' ? r.routeOk : r.routeOk; return fin(); }
  if (ds.crstaff) { r.staff = (r.staff || []).filter((x) => x !== ds.crstaff); if (t.checked) r.staff.push(ds.crstaff); return fin(); }
  if (ds.crbr != null) { r.breaks[+ds.crbr].mins = +t.value || 0; return fin(); }
  if (ds.crpt) { const p = r.patients.find((x) => x.id === ds.crpt); if (p) p[ds.k] = t.value; return fin(); }
  if (ds.crpr) { const pr = r.procs.find((x) => x.id === ds.crpr); if (!pr) return; if (t.value === '__other') { pr.answers = pr.answers || {}; pr.answers['_o_' + ds.k.replace(/^answers\./, '')] = 1; pr.answers[ds.k.replace(/^answers\./, '')] = ''; return fin(); } crSetPath(pr, ds.k, ds.k === 'head' ? +t.value || 0 : t.value); return fin(); }
  if (ds.crit) { const it = r.items.find((x) => x.id === ds.crit); if (it) it[ds.k] = ds.k === 'qty' ? +t.value || 0 : t.value; return fin(); }
  if (ds.crlab) { const l = r.labs.find((x) => x.id === ds.crlab); if (l) l[ds.k] = t.value; return fin(); }
  if (ds.crcert != null) { r.certs[+ds.crcert].qty = +t.value || 1; return fin(); }
  if (t.id === 'cr-addfarm' && t.value) { const f = IDX.farms.get(t.value); const ys = typeof bkYardsOf === 'function' && f ? bkYardsOf(f) : []; r.stops = [...(r.stops || []), { fid: t.value, yid: ys[0] ? ys[0].yid : null }]; r.routeOk = false; return fin(); }
  if (t.id === 'cr-addproc' && t.value) { const tp = crTpl(t.value); r.procs.push({ id: uid('pr'), tpl: t.value, pat: r.patients[0].id, answers: {}, head: 0, animals: [] }); if (tp && tp.cert && false) r.certs.push({ prod: tp.cert, qty: 1 }); return fin(); }
  if (t.id === 'cr-addcert' && t.value) { r.certs = [...(r.certs || []), { prod: t.value, qty: 1 }]; return fin(); }
  if (t.id === 'cr-link' && t.value) { r.links = [...(r.links || []), t.value]; const o = crGet('crrec', t.value); if (o && !(o.links || []).includes(r.id)) { o.links = [...(o.links || []), r.id]; touch(o); } return fin(); }
});
document.addEventListener('input', (e) => { const id = e.target.id; if (id === 'cr-q' || id === 'cr-iq' || id === 'cr-pq') { const k = { 'cr-q': 'q', 'cr-iq': 'invQ', 'cr-pq': 'prodQ' }[id]; CR[k] = e.target.value; clearTimeout(CR._qt); CR._qt = setTimeout(() => { const pos = e.target.selectionStart; renderAll(); const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } }, 250); } });
document.addEventListener('keydown', (e) => { if (e.target.id === 'crc-tag' && e.key === 'Enter') e.preventDefault(); });
window.addEventListener('popstate', () => { if (document.getElementById('cr-chute')) crChuteClose(); });

/* ---------------- editing a procedure template ---------------- */
function crTplOpen(t) {
  if (!t) return; const x = bkClone(t); const ins = (x.sections || []).flatMap((s) => s.inputs);
  openSheet(x.name, `<div class="grid2"><div class="f"><label for="ct-name">Name</label><input id="ct-name" value="${h(x.name)}"></div><div class="f"><label for="ct-who">Who finalises</label><select id="ct-who"><option value="vet" ${x.who !== 'tech' ? 'selected' : ''}>Vets only</option><option value="tech" ${x.who === 'tech' ? 'selected' : ''}>Vets or techs</option></select></div></div>
    ${ins.map((inp, i) => `<div class="cr-item"><div class="f"><label>Question ${i + 1}</label><input class="ct-l" data-i="${i}" value="${h(inp.l)}"></div>${inp.opts ? `<div class="f"><label>Choices (one per line)</label><textarea class="ct-o" data-i="${i}" rows="${Math.min(8, inp.opts.length + 1)}">${h(inp.opts.join('\n'))}</textarea></div>` : '<div class="hint">Typed answer</div>'}</div>`).join('')}
    <div class="hint">Charging and the crush quick entry come with the template. New templates (BBSE, AI and the others) are being built from your ezyVet ones next.</div>`, () => {
    x.name = document.getElementById('ct-name').value.trim() || x.name; x.who = document.getElementById('ct-who').value;
    document.querySelectorAll('.ct-l').forEach((el) => (ins[+el.dataset.i].l = el.value.trim() || ins[+el.dataset.i].l));
    document.querySelectorAll('.ct-o').forEach((el) => { const o = el.value.split('\n').map((s) => s.trim()).filter(Boolean); if (o.length) ins[+el.dataset.i].opts = o; });
    const ex = crCfg(x.id); Object.assign(ex, x); touch(ex); save(); Sync.soon(); setTimeout(renderAll, 0); return true; });
}
