/* Bovitech Super App — Patients: every cattle herd and sheep flock (the patient IDs on client businesses),
   each with its business and all its clinical records. */
'use strict';
const PT = { q: '', sp: 'all', sel: null, showIn: false };
const ptInactive = (p) => !!p.off || (typeof bizCat === 'function' && typeof INACT !== 'undefined' && INACT.includes(bizCat(p.b)));
const ptSpecies = (p) => (p.species === 'other' ? 'other' : p.species === 'sheep' ? 'sheep' : p.species === 'cattle' ? 'cattle' : /sheep|flock|ovine/i.test(p.label || '') ? 'sheep' : 'cattle');
function ptAll() { // [{ key, bid, b, value, label, sp }]
  const out = []; (D.businesses || []).forEach((b) => { if (b.gone) return; (b.patientIds || []).forEach((p) => { if (!p || !p.value) return; out.push({ key: b.id + '|' + p.value, bid: b.id, b, value: p.value, label: p.label || '', sp: ptSpecies(p), off: !!p.inactive, ezyId: p.ezyId || null, aka: p.aka || [] }); }); });
  return out.sort((x, y) => (x.b.name || '').localeCompare(y.b.name || '') || x.value.localeCompare(y.value));
}
function ptRecords(pt) { // records for this herd / flock: named on the record, or the business's only herd (or flock) of that kind
  if (typeof crList !== 'function') return []; const same = ptAll().filter((x) => x.bid === pt.bid && x.sp === pt.sp);
  const bids = new Set([pt.bid, ...(pt.aka || []).map((a) => a.bid)]);
  return crList('crrec').filter((r) => !r.gone && bids.has(r.bid) && ((r.patients || []).some((p) => p.pid === pt.value) || (same.length === 1 && !(r.patients || []).some((p) => p.pid && same.every((s) => s.value !== p.pid)) && (r.patients || []).some((p) => (p.species || 'cattle') === pt.sp))))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
function ptLast(pt) { const r = ptRecords(pt)[0]; if (r) return r.date; return typeof bizLastVisit === 'function' ? bizLastVisit(pt.b) : null; }
function renderPatients() {
  const all = ptAll(); if (PT.sel) { const p = all.find((x) => x.key === PT.sel); if (p) return ptDetail(p); PT.sel = null; }
  const q = PT.q.toLowerCase().trim(); const nIn = all.filter(ptInactive).length; const L = all.filter((p) => (PT.showIn || !ptInactive(p)) && (PT.sp === 'all' || p.sp === PT.sp) && (!q || (p.value + ' ' + p.label + ' ' + p.b.name).toLowerCase().includes(q)));
  const n = (sp) => all.filter((p) => (PT.showIn || !ptInactive(p)) && (sp === 'all' || p.sp === sp)).length;
  return `<div class="d-wrap"><h2 class="sec-h" style="font-size:26px">${h(lab('pat'))}</h2><div class="hint" style="margin-bottom:8px">Every cattle herd and sheep flock — the patient IDs on client businesses. Add or change them on the business (🆔 Patient IDs). Tap one to see its clinical records.</div>
  <div class="search" style="margin-bottom:8px"><input id="pt-q" type="search" placeholder="Search herd ID, flock or business" value="${h(PT.q)}" autocomplete="off" aria-label="Search patients"></div>
  <div class="chips">${[['all', 'All'], ['cattle', '🐄 Cattle herds'], ['sheep', '🐑 Sheep flocks'], ...(all.some((x) => x.sp === 'other') ? [['other', '🐾 Other (old records)']] : [])].map(([k, l]) => `<button class="chip ${PT.sp === k ? 'on' : ''}" data-act="pt-sp" data-v="${k}">${l} <span class="cn">${n(k)}</span></button>`).join('')}</div>
  <label class="bk-radio" style="display:flex;margin:6px 0"><input type="checkbox" data-act="pt-showin" ${PT.showIn ? 'checked' : ''}> Show inactive and do-not-answer clients${nIn ? ` (${nIn})` : ''}</label>
  <div class="card">${L.length ? L.map((p) => { const nr = ptRecords(p).length, last = ptLast(p); return `<div class="kv bk-tap" data-act="pt-open" data-k="${h(p.key)}" style="align-items:center"><span style="font-size:22px;width:32px">${p.sp === 'sheep' ? '🐑' : p.sp === 'other' ? '🐾' : '🐄'}</span><div class="v"><b>${h(p.value)}</b> <span class="hint">${h(p.label)}</span>${ptInactive(p) ? ' <span class="pill" style="font-size:11px">inactive</span>' : ''}<br>${h(p.b.name)}<span class="hint">${nr ? ` · ${nr} record${nr === 1 ? '' : 's'}` : ''}${last ? ' · last seen ' + bkDate(last, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span></div></div>`; }).join('') : '<div class="hint">No herds or flocks match.</div>'}</div></div>`;
}
function ptDetail(p) {
  const recs = ptRecords(p); const on = typeof crOn === 'function' && crOn();
  return `<div class="d-wrap"><div class="actions" style="margin-bottom:6px"><button class="btn small" data-act="pt-back">‹ ${h(lab('pat'))}</button><button class="btn small" data-act="open" data-kind="business" data-id="${p.bid}">🏢 ${h(p.b.name)}</button><button class="btn small" data-act="pt-merge" data-k="${h(p.key)}">⇄ Merge with…</button>${on && p.sp !== 'other' ? `<button class="btn small primary" data-act="pt-newrec" data-bid="${p.bid}" data-k="${h(p.key)}">➕ New record</button>` : ''}</div>
  <h2 class="sec-h" style="font-size:24px">${p.sp === 'sheep' ? '🐑' : p.sp === 'other' ? '🐾' : '🐄'} ${h(p.value)}</h2>
  <div class="card"><div class="kv"><div class="k">${p.sp === 'sheep' ? 'Sheep flock' : p.sp === 'other' ? 'Other animal (inactive)' : 'Cattle herd'}</div><div class="v">${h(p.label || 'Patient ID')}: <b>${h(p.value)}</b></div></div><div class="kv"><div class="k">Business</div><div class="v"><span class="lnk" data-act="open" data-kind="business" data-id="${p.bid}">${h(p.b.name)}</span>${(p.b.pics || []).length ? `<br><span class="hint">PIC ${h(p.b.pics.map((x) => x.value).join(', '))}</span>` : ''}</div></div></div>
  <div class="card"><h3>Clinical records${recs.length ? ` (${recs.length})` : ''}</h3>${!on ? '<div class="hint">Turn on the Records tab (Settings → Clinical records) to see and add records.</div>' : recs.length ? recs.map((r) => crRecRow(r)).join('') : '<div class="hint">No records yet.</div>'}</div>${typeof ezyPatCard === 'function' ? ezyPatCard(p) : ''}</div>`;
}
function ptMerge(keepKey, otherKey) { // merge one herd / flock into another: records, ezyVet history and details come across; the other is removed
  const find = (k) => { const [bid, ...v] = k.split('|'); const b = IDX.biz.get(bid); const p = b && (b.patientIds || []).find((x) => String(x.value) === v.join('|')); return p ? { b, p } : null; };
  const K = find(keepKey), O = find(otherKey); if (!K || !O || K.p === O.p) return null; const p = K.p, q = O.p; let recs = 0;
  p.ezyIds = [...new Set([p.ezyId, ...(p.ezyIds || []), q.ezyId, ...(q.ezyIds || [])].filter(Boolean))]; if (!p.ezyId && p.ezyIds.length) p.ezyId = p.ezyIds[0];
  p.aka = [...(p.aka || []), { v: q.value, bid: O.b.id }, ...(q.aka || [])]; if (!p.breed && q.breed) p.breed = q.breed; if (!p.species && q.species) p.species = q.species; if (p.inactive && !q.inactive) delete p.inactive;
  crList('crrec').forEach((r) => { if (r.bid !== O.b.id) return; let ch = false; (r.patients || []).forEach((x) => { if (x.pid === q.value) { x.pid = p.value; x.plabel = p.label || ''; ch = true; } }); if (ch) { touch(r); recs++; } });
  O.b.patientIds = O.b.patientIds.filter((x) => x !== q); touch(O.b); touch(K.b); if (typeof NEXT_LOG_LABEL !== 'undefined') NEXT_LOG_LABEL = `Merged patient ${q.value} into ${p.value}`; save(); if (window.Sync) Sync.soon(); return { recs }; }
// one-off: Jess asked for 100613 and BVS_1300 to be merged (keep 100613)
setInterval(() => { if (!window.APP_READY || !D || !D.settings || D.settings.pmerge1 || !D.sync || !D.sync.last) return; const all = ptAll(); const k = all.find((x) => String(x.value) === '100613'), o = all.find((x) => String(x.value) === 'BVS_1300');
  if (k && o) { ptMerge(k.key, o.key); D.settings.pmerge1 = Date.now(); touch(D.settings); save(); if (window.Sync) Sync.soon(); } }, 6000);
window.ptMerge = ptMerge;
window.renderPatients = renderPatients;
document.addEventListener('click', async (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^pt-/.test(a)) return; const d = el.dataset;
  if (a === 'pt-sp') { PT.sp = d.v; renderAll(); }
  if (a === 'pt-showin') { PT.showIn = el.checked; renderAll(); }
  if (a === 'pt-open') { PT.sel = d.k; if (d.go) { S.tab = 'pat'; S.sel = null; document.body.classList.remove('show-detail'); } renderAll(); const l = document.getElementById('list'); if (l) l.scrollTop = 0; }
  if (a === 'pt-back') { PT.sel = null; renderAll(); }
  if (a === 'pt-merge') { const all = ptAll(); const p = all.find((x) => x.key === d.k); if (!p) return; const others = all.filter((x) => x.key !== p.key).sort((x, y) => (y.bid === p.bid) - (x.bid === p.bid));
    const ok = await askBox('⇄ Merge patients', `<p>Merge another herd / flock into <b>${h(p.value)}</b> (${h(p.b.name)}). Its clinical records, ezyVet history and details move to ${h(p.value)}, and it's removed.</p><div class="f"><label>Merge this one into ${h(p.value)}</label><select data-ask="o" style="width:100%;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px"><option value="">Choose…</option>${others.map((x) => `<option value="${h(x.key)}">${h(x.value)}${x.label ? ' ' + h(x.label) : ''} — ${h(x.b.name)}${x.off ? ' (inactive)' : ''}</option>`).join('')}</select></div>`, 'Merge');
    if (!ok || !ASK_FORM.o) return; const n = ptMerge(p.key, ASK_FORM.o); if (n) { toast(`Merged — ${n.recs} record${n.recs === 1 ? '' : 's'} moved`); renderAll(); } }
  if (a === 'pt-newrec') { const p = ptAll().find((x) => x.key === d.k); if (!p) return; const r = crNewRec({ bid: p.bid }); r.patients = [{ id: uid('pt'), level: 'herd', pid: p.value, plabel: p.label, species: p.sp }]; touch(r); D.crrec.push(r); crInvSync(r); save(); crOpen(r.id); }
});
document.addEventListener('input', (e) => { if (e.target.id !== 'pt-q') return; PT.q = e.target.value; clearTimeout(PT._t); PT._t = setTimeout(() => { const pos = e.target.selectionStart; renderAll(); const n = document.getElementById('pt-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } }, 250); });
