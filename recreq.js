/* Bovitech Super App — v2.33: completing records.
   • ✓ Finalise: every question in every procedure has to be answered first. Anything missing is outlined in orange, listed, and the
     page goes to the first one.
   • "Other — type it": after typing your own answer, the app asks whether to keep it as an answer for next time — in this template only,
     or in every template that asks the same question. */
function crMissing(r) { const out = []; (r.procs || []).forEach((pr) => { const t = crTpl(pr.tpl); if (!t) return; const a = pr.answers || {};
  (t.sections || []).forEach((sec) => (sec.inputs || []).forEach((inp) => { if (inp.fixed || inp.optional || (typeof crShown === 'function' && !crShown(pr, inp))) return; const v = a[inp.k]; if (v == null || String(v).trim() === '' || v === '__other') out.push({ pr, t, sec, inp }); })); });
  if (!(r.patients || []).length) out.push({ pat: true }); return out; }
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=cr-final]'); if (!el) return; const r = typeof CR !== 'undefined' && crGet && crGet('crrec', CR.id); if (!r) return;
  const M = crMissing(r); if (!M.length) return; e.preventDefault(); e.stopImmediatePropagation();
  document.querySelectorAll('.need-fill').forEach((x) => x.classList.remove('need-fill')); let first = null;
  M.forEach((m) => { const n = m.lab ? document.querySelector('.b2-lab input') : m.pat ? document.querySelector('[data-act=cr-ptherd], [data-act=cr-ptadd]') : document.querySelector(`[data-crpr="${m.pr.id}"][data-k="answers.${m.inp.k}"]`); const box = n && (n.closest('.b2-lab') || n.closest('.f') || n.closest('.actions') || n.parentElement); if (box) { box.classList.add('need-fill', 'need-req'); first = first || box; } });
  const by = {}; M.forEach((m) => { const k = m.lab ? 'Additional labour' : m.pat ? 'Patients' : m.t.name; (by[k] = by[k] || []).push(m.lab ? 'What it was used for — the whole appointment, or which procedures' : m.pat ? 'Choose the herd / flock, mob or animal' : (m.inp.l || m.sec.title || 'An answer')); });
  await askBox(`⚠ ${M.length} thing${M.length === 1 ? '' : 's'} still to complete`, `<p>Every section needs completing before the record can be finalised. They're outlined in orange:</p>${Object.entries(by).map(([k, L]) => `<p><b>${h(k)}</b><br>${L.map((x) => '• ' + h(x)).join('<br>')}</p>`).join('')}`, 'Show me', false, '');
  if (first) { if (typeof navPoint === 'function') navPoint(first); else first.scrollIntoView({ block: 'center' }); } }, true);
/* clear the orange as each one is answered */
document.addEventListener('change', (e) => { const f = e.target.closest && e.target.closest('.need-req'); if (f && String(e.target.value || '').trim() && e.target.value !== '__other') f.classList.remove('need-fill', 'need-req'); }, true);
/* "Other — type it": keep it as an answer for next time? */
document.addEventListener('change', async (e) => { const el = e.target; if (!el || el.tagName !== 'INPUT' || !el.dataset || !el.dataset.crpr || !/^answers\./.test(el.dataset.k || '')) return; const v = el.value.trim(); if (!v) return;
  const r = typeof CR !== 'undefined' && crGet && crGet('crrec', CR.id); const pr = r && (r.procs || []).find((p) => p.id === el.dataset.crpr); const t = pr && crTpl(pr.tpl); if (!t) return; const k = el.dataset.k.slice(8);
  const inp = (t.sections || []).flatMap((s) => s.inputs).find((i) => i.k === k); if (!inp || !inp.opts || inp.opts.includes(v)) return;
  const same = crTpls().filter((x) => x.id !== t.id && (x.sections || []).some((s) => (s.inputs || []).some((i) => i.opts && String(i.l || '').toLowerCase() === String(inp.l || '').toLowerCase())));
  const res = await askBox('Keep this answer for next time?', `<p>“${h(v)}” for <b>${h(inp.l || 'this question')}</b>.</p><div class="hint">It's added to the choices. "Every template" adds it wherever the same question is asked${same.length ? ` (${same.length} other template${same.length === 1 ? '' : 's'})` : ' (no other templates ask it)'}.</div>`, 'This template only', false, 'No, just this once', same.length ? 'Every template' : '');
  if (!res) return; const add = (tp) => { const rec = crCfg(tp.id) || tp; (rec.sections || []).forEach((s) => (s.inputs || []).forEach((i) => { if (i.opts && (i === inp || (tp.id !== t.id && String(i.l || '').toLowerCase() === String(inp.l || '').toLowerCase())) && !i.opts.includes(v)) i.opts.push(v); })); if (rec.from === 'ezyvet') rec.edited = true; touch(rec); };
  add(t); if (res === 'alt') same.forEach(add); save(); if (window.Sync) Sync.soon(); toast(res === 'alt' ? `Added to ${same.length + 1} templates` : 'Added to this template'); }, false);
(function () { const st = document.createElement('style'); st.textContent = '.need-req>label::after{content:" — needs completing"!important}'; document.head.appendChild(st); })();
window.crMissing = crMissing;
