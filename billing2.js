/* Bovitech Super App — v2.33: charging from the ezyVet templates.
   • The questions that charge the appointment type, travel, after hours and additional labour aren't asked in each procedure any more —
     the record charges them once for the whole appointment (appointment fee from the appointment type, travel from the route, after hours
     from the times, labour from the "Additional labour" box).
   • Additional labour asks what it was used for: the whole appointment, or only some of the procedures (e.g. preg testing but not the
     biosecurity plan review) — and is charged for that time.
   • Other charging answers in an ezyVet template (e.g. "Pregnancy testing charge: yes", "Sale certificate charge: yes") add that product
     to the invoice. An answer charged by the amount asks how many. A template that charges this way isn't also charged by the hour.
   • A choice that is an ezyVet shortcut (like #S4 or -EXAM-FULL) fills in its wording (and adds its products), and a typed box that used
     ezyVet shortcuts has buttons to fill them in. */
const B2_ONCE = { appt: 'Appointment type', ah: 'After hours', travel: 'Travel', labour: 'Additional labour' };
const b2Prod = (code) => (typeof shProdBy === 'function' ? shProdBy(code) : crList('crprod').find((p) => !p.gone && String(p.code || '').replace(/^\$/, '').toUpperCase() === String(code).replace(/^\$/, '').toUpperCase()));
const b2Inputs = (t) => (t.sections || []).flatMap((s) => s.inputs || []);
const b2Billed = (t) => !!t && t.from === 'ezyvet' && b2Inputs(t).some((i) => i.bill && !i.once);
/* the products an answered procedure adds */
function b2Lines(r, pr) { const t = crTpl(pr.tpl); if (!t) return []; const a = pr.answers || {}; const out = [];
  b2Inputs(t).forEach((inp) => { if (!inp.bill || inp.once || !crShown(pr, inp)) return; const i = (inp.opts || []).indexOf(a[inp.k]); const L = i >= 0 ? inp.bill[String(i)] : null; if (!L) return;
    L.forEach(([code, n]) => { const p = b2Prod(code); const q = n === 99999 ? +a['_q_' + inp.k] || 0 : n; if (p && q) out.push({ p, q, why: `${t.name}: ${inp.l}` }); }); });
  return out; }
crBuildLines = (function (orig) { return function (r) { const lab = r.labour || {}; let r2 = r;
    if (+lab.people && lab.for === 'all' && !(+lab.hours)) r2 = { ...r, labour: { ...lab, hours: crR2(crWorkedMins(r) / 60) } };
    let L = orig.call(this, r2); const fz = (r.procs || []).map((pr) => crTpl(pr.tpl)).filter(b2Billed);
    if (fz.length) L = L.filter((l) => !fz.some((t) => t.charge && l.prod === t.charge.hour && String(l.desc).startsWith(t.name + ' — ')));
    const lb = L.find((l) => l.prod === (crRole('labour') || {}).id); if (lb && lab.for) lb.desc = `Additional labour — ${lab.people} × ${r2.labour.hours} hours, ${lab.for === 'all' ? 'the whole appointment' : 'for ' + (lab.procs || []).map((id) => { const pr = (r.procs || []).find((x) => x.id === id); return pr ? (crTpl(pr.tpl) || {}).name : ''; }).filter(Boolean).join(', ')}`;
    (r.procs || []).forEach((pr) => b2Lines(r, pr).forEach(({ p, q, why }) => L.push({ id: uid('il'), prod: p.id, desc: p.name, qty: crR2(q), price: +p.price || 0, gst: p.gst !== false, auto: true, why })));
    return L; }; })(crBuildLines);
/* the record: "Additional labour" — used for the whole appointment, or some procedures */
crEditHtml = (function (orig) { return function (r) { let html = orig.apply(this, arguments); const lab = r.labour || {}; const fin = r.status === 'final';
    const box = `<div class="f b2-lab" ${+lab.people ? '' : 'hidden'}><label>Additional labour was used for</label><div class="cr-chks"><label class="bk-radio"><input type="radio" name="b2lab" data-crf="labour.for" value="all" ${lab.for === 'all' ? 'checked' : ''} ${fin ? 'disabled' : ''}> the whole appointment${lab.for === 'all' && !(+lab.hours) ? ` (${crR2(crWorkedMins(r) / 60)} hours)` : ''}</label><label class="bk-radio"><input type="radio" name="b2lab" data-crf="labour.for" value="part" ${lab.for === 'part' ? 'checked' : ''} ${fin ? 'disabled' : ''}> only some of the procedures</label></div>
      ${lab.for === 'part' ? `<div class="cr-chks" style="margin-top:4px">${(r.procs || []).map((pr) => `<label class="bk-radio"><input type="checkbox" data-b2lab="${pr.id}" ${(lab.procs || []).includes(pr.id) ? 'checked' : ''} ${fin ? 'disabled' : ''}> ${h((crTpl(pr.tpl) || {}).name || 'Procedure')}</label>`).join('') || '<span class="hint">Add the procedures first.</span>'}</div><div class="hint">Put the hours they helped in "Hours each".</div>` : lab.for === 'all' ? '<div class="hint">Leave "Hours each" at 0 to charge the whole appointment time.</div>' : ''}</div>`;
    html = html.replace(/(<div class="grid2"><div class="f"><label>Additional labour — people<\/label>[\s\S]*?<\/div><\/div>)/, '$1' + box);
    /* ezyVet shortcut buttons on typed boxes that used them */
    if (!fin && typeof shFind === 'function') (r.procs || []).forEach((pr) => { const t = crTpl(pr.tpl); if (!t) return; b2Inputs(t).forEach((inp) => { if (!inp.ezy || !inp.ezy.length) return; const codes = inp.ezy.map((c) => shFind('-' + c) || shFind(c)).filter(Boolean); if (!codes.length) return;
      const rx = new RegExp(`(<textarea data-crpr="${pr.id}" data-k="answers.${inp.k}"[^>]*>[\\s\\S]*?</textarea>)`); html = html.replace(rx, `$1<div class="cr-chks b2-sh">${codes.map((c) => `<button type="button" class="btn small" data-act="b2-sh" data-pr="${pr.id}" data-k="${h(inp.k)}" data-c="${h(c)}" title="${h(typeof shPreview === 'function' ? shPreview(c) : '')}">⌨️ ${h(c)}</button>`).join('')}</div>`); }); });
    return html; }; })(crEditHtml);
document.addEventListener('change', (e) => { const el = e.target; if (!el.dataset || !el.dataset.b2lab) return; const r = crGet('crrec', CR.id); if (!r) return; r.labour = r.labour || {}; const s = new Set(r.labour.procs || []); if (el.checked) s.add(el.dataset.b2lab); else s.delete(el.dataset.b2lab); r.labour.procs = [...s]; crSave(r); crInvSync(r); Sync.soon(); renderAll(); });
/* show the "used for" question as soon as people is filled in */
document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.crf === 'labour.people') { const b = document.querySelector('.b2-lab'); if (b) b.hidden = !(+e.target.value); } });
/* finalising: the labour question has to be answered too */
if (typeof crMissing === 'function') crMissing = (function (orig) { return function (r) { const M = orig.apply(this, arguments); const lab = r.labour || {}; if (+lab.people && (!lab.for || (lab.for === 'part' && !(lab.procs || []).length))) M.push({ lab: true }); return M; }; })(crMissing);
/* answers: charged by the amount → how many?  a shortcut choice → its wording */
document.addEventListener('change', async (e) => { const el = e.target; if (el.tagName !== 'SELECT' || !el.dataset.crpr || !/^answers\./.test(el.dataset.k || '')) return; const r = crGet('crrec', CR.id); const pr = r && (r.procs || []).find((p) => p.id === el.dataset.crpr); const t = pr && crTpl(pr.tpl); if (!t) return; const k = el.dataset.k.slice(8); const inp = b2Inputs(t).find((i) => i.k === k); if (!inp) return;
  const i = (inp.opts || []).indexOf(el.value); const L = i >= 0 && inp.bill ? inp.bill[String(i)] : null;
  if (L && L.some(([, n]) => n === 99999)) { const p = b2Prod(L[0][0]); setTimeout(async () => { const ok = await askBox('How many?', `<p>${h(inp.l)}: <b>${h(el.value)}</b>${p ? ` — ${h(p.name)}${p.unit ? ' (per ' + h(p.unit) + ')' : ''}` : ''}</p><div class="f"><label for="b2-q">How many to charge</label><input id="b2-q" data-ask="q" inputmode="decimal" value="${h((pr.answers || {})['_q_' + k] || '')}"></div>`, 'OK', false, 'Cancel'); const q = ok ? parseFloat(ASK_FORM.q) : NaN; const r2 = crGet('crrec', CR.id); const pr2 = r2 && r2.procs.find((x) => x.id === pr.id); if (!pr2) return; pr2.answers = pr2.answers || {}; if (q > 0) pr2.answers['_q_' + k] = q; else delete pr2.answers['_q_' + k]; crSave(r2); crInvSync(r2); Sync.soon(); renderAll(); if (!(q > 0)) toast('Nothing charged for it yet — choose the answer again to put in how many'); }, 60); return; }
  const sc = typeof shFind === 'function' && /^[-#]/.test(el.value) ? shFind(el.value) : null; if (!sc) return;
  setTimeout(async () => { const res = await shExpand(sc); const r2 = crGet('crrec', CR.id); const pr2 = r2 && r2.procs.find((x) => x.id === pr.id); if (!pr2) return; pr2.answers = pr2.answers || {}; if (!res) { pr2.answers[k] = ''; crSave(r2); renderAll(); return; } pr2.answers[k] = res.text.trim(); pr2.answers['_o_' + k] = 1; crSave(r2); if (res.prods.length && typeof shAddProds === 'function') shAddProds(res.prods); else { crInvSync(r2); Sync.soon(); renderAll(); } if (res.miss.length) toast(`Not in the price list: ${[...new Set(res.miss)].join(', ')}`); }, 60); });
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=b2-sh]'); if (!el) return; e.preventDefault(); e.stopPropagation(); const res = await shExpand(el.dataset.c); if (!res) return; const r = crGet('crrec', CR.id); const pr = r && r.procs.find((x) => x.id === el.dataset.pr); if (!pr) return; pr.answers = pr.answers || {}; const cur = String(pr.answers[el.dataset.k] || '').trim(); pr.answers[el.dataset.k] = (cur ? cur + '\n' : '') + res.text.trim(); crSave(r); if (res.prods.length && typeof shAddProds === 'function') shAddProds(res.prods); else { crInvSync(r); Sync.soon(); renderAll(); } }, true);
window.b2Lines = b2Lines; window.b2Billed = b2Billed;
