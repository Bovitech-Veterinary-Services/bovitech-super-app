/* Bovitech Super App — v2.33: completing records.
   • ✓ Finalise: every question in every procedure has to be answered first. Anything missing is outlined in orange, listed, and the
     page goes to the first one.
   • "Other — type it": after typing your own answer, the app asks whether to keep it as an answer for next time — in this template only,
     or in every template that asks the same question. */
/* outline what still needs completing (kept through re-draws until the record is finalised) */
function crReqMark(M) { document.querySelectorAll('.need-fill').forEach((x) => x.classList.remove('need-fill', 'need-req')); let first = null;
  M.forEach((m) => { const n = m.lab ? document.querySelector('[data-sec=labour] input') : m.pat ? document.querySelector('[data-crpat1], [data-crpatm], [data-act=cr-ptnew]') : document.querySelector(`[data-crpr="${m.pr.id}"][data-k="answers.${m.inp.k}"]`); const box = n && (n.closest('.f') || n.closest('.actions') || n.parentElement); if (box) { box.classList.add('need-fill', 'need-req'); first = first || box; } }); return first; }
if (typeof renderAll === 'function') renderAll = (function (orig) { return function () { const res = orig.apply(this, arguments); try { const q = window.CR_REQ; if (q && typeof CR !== 'undefined' && S.tab === 'rec' && CR.page === 'edit' && CR.id === q.id) { const r = crGet('crrec', q.id); if (!r || r.status === 'final') window.CR_REQ = null; else crReqMark(crMissing(r)); } } catch (e) { } return res; }; })(renderAll);
function crMissing(r) { const out = []; (r.procs || []).forEach((pr) => { const t = crTpl(pr.tpl); if (!t) return; const a = pr.answers || {};
  (t.sections || []).forEach((sec) => (sec.inputs || []).forEach((inp) => { if (inp.fixed || inp.optional || (typeof crShown === 'function' && !crShown(pr, inp))) return; const v = a[inp.k]; if (v == null || String(v).trim() === '' || v === '__other') out.push({ pr, t, sec, inp }); })); });
  if (!(r.patients || []).some((p) => typeof crPatReal === 'function' ? crPatReal(r, p) : true)) out.push({ pat: true });
  else if (typeof crPatMode === 'function' && crPatMode(r) === 'multi') (r.procs || []).forEach((pr) => { if (!pr.pat || !(r.patients || []).some((p) => p.id === pr.pat)) out.push({ pr, t: crTpl(pr.tpl) || { name: 'Procedure' }, sec: {}, inp: { k: '__pat', l: 'Which patient it was for' } }); });
  return out; }
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=cr-final]'); if (!el) return; const r = typeof CR !== 'undefined' && crGet && crGet('crrec', CR.id); if (!r) return;
  if (typeof crCanFinalise === 'function' && !crCanFinalise(r)) return; /* someone who can't finalise is told that first */
  const M = crMissing(r); if (!M.length) return; e.preventDefault(); e.stopImmediatePropagation();
  const first = crReqMark(M); window.CR_REQ = { id: r.id };
  const by = {}; M.forEach((m) => { const k = m.lab ? 'Additional labour' : m.pat ? 'Patients' : m.t.name; (by[k] = by[k] || []).push(m.lab ? 'How many people, and whether it was the whole appointment (or how long)' : m.pat ? 'Choose the patient (a real patient of this business)' : (m.inp.l || m.sec.title || 'An answer')); });
  await askBox(`⚠ ${M.length} thing${M.length === 1 ? '' : 's'} still to complete`, `<p>Every section needs completing before the record can be finalised. They're outlined in orange:</p>${Object.entries(by).map(([k, L]) => `<p><b>${h(k)}</b><br>${L.map((x) => '• ' + h(x)).join('<br>')}</p>`).join('')}`, 'Show me', false, '');
  if (first) { if (typeof navPoint === 'function') navPoint(first); else first.scrollIntoView({ block: 'center' }); } }, true);
/* clear the orange as each one is answered */
document.addEventListener('change', (e) => { const f = e.target.closest && e.target.closest('.need-req'); if (f && String(e.target.value || '').trim() && e.target.value !== '__other') f.classList.remove('need-fill', 'need-req'); }, true);
/* "Other — type it": keep it as an answer for next time? (asked once for each answer) */
const RQ_NO = new Set();
document.addEventListener('change', async (e) => { const el = e.target; if (!el || el.tagName !== 'INPUT' || !el.dataset || !el.dataset.crpr || !/^answers\./.test(el.dataset.k || '')) return; const v = el.value.trim(); if (!v) return;
  const r = typeof CR !== 'undefined' && crGet && crGet('crrec', CR.id); const pr = r && (r.procs || []).find((p) => p.id === el.dataset.crpr); const t = pr && crTpl(pr.tpl); if (!t) return; const k = el.dataset.k.slice(8);
  const inp = (t.sections || []).flatMap((s) => s.inputs).find((i) => i.k === k); if (!inp || !inp.opts || inp.opts.includes(v)) return; const dk = pr.id + '|' + k + '|' + v; if (RQ_NO.has(dk)) return;
  const same = crTpls().filter((x) => x.id !== t.id && (x.sections || []).some((s) => (s.inputs || []).some((i) => i.opts && String(i.l || '').toLowerCase() === String(inp.l || '').toLowerCase())));
  const res = await askBox('Keep this answer for next time?', `<p>“${h(v)}” for <b>${h(inp.l || 'this question')}</b>.</p><div class="hint">It's added to the choices. "Every template" adds it wherever the same question is asked${same.length ? ` (${same.length} other template${same.length === 1 ? '' : 's'})` : ' (no other templates ask it)'}.</div>`, 'This template only', false, 'No, just this once', same.length ? 'Every template' : '');
  if (!res) { RQ_NO.add(dk); return; } const add = (tp) => { const rec = crCfg(tp.id) || tp; (rec.sections || []).forEach((s) => (s.inputs || []).forEach((i) => { if (i.opts && (i === inp || (tp.id !== t.id && String(i.l || '').toLowerCase() === String(inp.l || '').toLowerCase())) && !i.opts.includes(v)) i.opts.push(v); })); if (rec.from === 'ezyvet') rec.edited = true; touch(rec); };
  add(t); if (res === 'alt') same.forEach(add); save(); if (window.Sync) Sync.soon(); toast(res === 'alt' ? `Added to ${same.length + 1} templates` : 'Added to this template'); }, false);
(function () { const st = document.createElement('style'); st.textContent = '.need-req>label::after{content:" — needs completing"!important}'; document.head.appendChild(st); })();
window.crMissing = crMissing;
