/* Bovitech Super App — Patients: every cattle herd and sheep flock (the patient IDs on client businesses),
   each with its business and all its clinical records. */
'use strict';
const PT = { q: '', sp: 'all', sel: null };
const ptSpecies = (p) => (/sheep|flock|ovine/i.test(p.label || '') ? 'sheep' : 'cattle');
function ptAll() { // [{ key, bid, b, value, label, sp }]
  const out = []; (D.businesses || []).forEach((b) => { if (b.gone) return; (b.patientIds || []).forEach((p) => { if (!p || !p.value) return; out.push({ key: b.id + '|' + p.value, bid: b.id, b, value: p.value, label: p.label || '', sp: ptSpecies(p) }); }); });
  return out.sort((x, y) => (x.b.name || '').localeCompare(y.b.name || '') || x.value.localeCompare(y.value));
}
function ptRecords(pt) { // records for this herd / flock: named on the record, or the business's only herd (or flock) of that kind
  if (typeof crList !== 'function') return []; const same = ptAll().filter((x) => x.bid === pt.bid && x.sp === pt.sp);
  return crList('crrec').filter((r) => !r.gone && r.bid === pt.bid && ((r.patients || []).some((p) => p.pid === pt.value) || (same.length === 1 && !(r.patients || []).some((p) => p.pid && same.every((s) => s.value !== p.pid)) && (r.patients || []).some((p) => (p.species || 'cattle') === pt.sp))))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
function ptLast(pt) { const r = ptRecords(pt)[0]; if (r) return r.date; return typeof bizLastVisit === 'function' ? bizLastVisit(pt.b) : null; }
function renderPatients() {
  const all = ptAll(); if (PT.sel) { const p = all.find((x) => x.key === PT.sel); if (p) return ptDetail(p); PT.sel = null; }
  const q = PT.q.toLowerCase().trim(); const L = all.filter((p) => (PT.sp === 'all' || p.sp === PT.sp) && (!q || (p.value + ' ' + p.label + ' ' + p.b.name).toLowerCase().includes(q)));
  const n = (sp) => all.filter((p) => sp === 'all' || p.sp === sp).length;
  return `<div class="d-wrap"><h2 class="sec-h" style="font-size:26px">${h(lab('pat'))}</h2><div class="hint" style="margin-bottom:8px">Every cattle herd and sheep flock — the patient IDs on client businesses. Add or change them on the business (🆔 Patient IDs). Tap one to see its clinical records.</div>
  <div class="search" style="margin-bottom:8px"><input id="pt-q" type="search" placeholder="Search herd ID, flock or business" value="${h(PT.q)}" autocomplete="off" aria-label="Search patients"></div>
  <div class="chips">${[['all', 'All'], ['cattle', '🐄 Cattle herds'], ['sheep', '🐑 Sheep flocks']].map(([k, l]) => `<button class="chip ${PT.sp === k ? 'on' : ''}" data-act="pt-sp" data-v="${k}">${l} <span class="cn">${n(k)}</span></button>`).join('')}</div>
  <div class="card">${L.length ? L.map((p) => { const nr = ptRecords(p).length, last = ptLast(p); return `<div class="kv bk-tap" data-act="pt-open" data-k="${h(p.key)}" style="align-items:center"><span style="font-size:22px;width:32px">${p.sp === 'sheep' ? '🐑' : '🐄'}</span><div class="v"><b>${h(p.value)}</b> <span class="hint">${h(p.label)}</span><br>${h(p.b.name)}<span class="hint">${nr ? ` · ${nr} record${nr === 1 ? '' : 's'}` : ''}${last ? ' · last seen ' + bkDate(last, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span></div></div>`; }).join('') : '<div class="hint">No herds or flocks match.</div>'}</div></div>`;
}
function ptDetail(p) {
  const recs = ptRecords(p); const on = typeof crOn === 'function' && crOn();
  return `<div class="d-wrap"><div class="actions" style="margin-bottom:6px"><button class="btn small" data-act="pt-back">‹ ${h(lab('pat'))}</button><button class="btn small" data-act="open" data-kind="business" data-id="${p.bid}">🏢 ${h(p.b.name)}</button>${on ? `<button class="btn small primary" data-act="pt-newrec" data-bid="${p.bid}" data-k="${h(p.key)}">➕ New record</button>` : ''}</div>
  <h2 class="sec-h" style="font-size:24px">${p.sp === 'sheep' ? '🐑' : '🐄'} ${h(p.value)}</h2>
  <div class="card"><div class="kv"><div class="k">${p.sp === 'sheep' ? 'Sheep flock' : 'Cattle herd'}</div><div class="v">${h(p.label || 'Patient ID')}: <b>${h(p.value)}</b></div></div><div class="kv"><div class="k">Business</div><div class="v"><span class="lnk" data-act="open" data-kind="business" data-id="${p.bid}">${h(p.b.name)}</span>${(p.b.pics || []).length ? `<br><span class="hint">PIC ${h(p.b.pics.map((x) => x.value).join(', '))}</span>` : ''}</div></div></div>
  <div class="card"><h3>Clinical records${recs.length ? ` (${recs.length})` : ''}</h3>${!on ? '<div class="hint">Turn on the Records tab (Settings → Clinical records) to see and add records.</div>' : recs.length ? recs.map((r) => crRecRow(r)).join('') : '<div class="hint">No records yet.</div>'}</div></div>`;
}
window.renderPatients = renderPatients;
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^pt-/.test(a)) return; const d = el.dataset;
  if (a === 'pt-sp') { PT.sp = d.v; renderAll(); }
  if (a === 'pt-open') { PT.sel = d.k; if (d.go) { S.tab = 'pat'; S.sel = null; document.body.classList.remove('show-detail'); } renderAll(); const l = document.getElementById('list'); if (l) l.scrollTop = 0; }
  if (a === 'pt-back') { PT.sel = null; renderAll(); }
  if (a === 'pt-newrec') { const p = ptAll().find((x) => x.key === d.k); if (!p) return; const r = crNewRec({ bid: p.bid }); r.patients = [{ id: uid('pt'), level: 'herd', pid: p.value, plabel: p.label, species: p.sp }]; touch(r); D.crrec.push(r); crInvSync(r); save(); crOpen(r.id); }
});
document.addEventListener('input', (e) => { if (e.target.id !== 'pt-q') return; PT.q = e.target.value; clearTimeout(PT._t); PT._t = setTimeout(() => { const pos = e.target.selectionStart; renderAll(); const n = document.getElementById('pt-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } }, 250); });
