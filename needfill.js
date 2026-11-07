/* Bovitech Super App — v2.30: forms show what still needs filling in.
   New / changed bookings and new clients: each box or choice that has to be filled in is outlined in orange with "needed"
   until it's filled in or ticked. Works on the booking form, the new contact and new business forms. */
const NF_RULES = [
  ['#bkf-q', (el) => !(typeof BKF !== 'undefined' && BKF && BKF.bid)],
  ['#bkf-date', (el) => !el.value], ['#bkf-start', (el) => !el.value],
  ['[data-bksvc]', (el) => !el.value], ['[data-bkfarm]', (el) => !el.value], ['[data-bkyard]', (el) => el.tagName === 'SELECT' && !el.value && el.options.length > 1],
  ['[data-bkwho]', (el) => { const box = el.closest('.f, .bk-svc, .cr-item') || el.parentElement; return box && !box.querySelector('[data-bkwho]:checked') && el.type === 'checkbox'; }, true],
  ['[data-bkhead]', (el) => !el.value],
  ['#e-first', (el) => !el.value.trim() && !((document.getElementById('e-last') || {}).value || '').trim()], ['#e-bname', (el) => !el.value.trim()]];
function nfRun() { const root = document.getElementById('sheet') || document.getElementById('detail'); if (!root) return; const seen = new Set();
  root.querySelectorAll('.need-fill').forEach((x) => x.classList.remove('need-fill'));
  NF_RULES.forEach(([sel, empty, group]) => root.querySelectorAll(sel).forEach((el) => { if (el.disabled || el.closest('[hidden]')) return; const box = (group ? el.closest('.f, .bk-svc, .cr-item') || el.parentElement : el.closest('.f') || el.parentElement); if (!box || seen.has(box)) return; let e = false; try { e = empty(el); } catch (x) { e = false; } if (e) { box.classList.add('need-fill'); seen.add(box); } })); }
(function () { let tm = null; const soon = () => { if (!tm) tm = setTimeout(() => { tm = null; nfRun(); }, 120); };
  document.addEventListener('input', soon, true); document.addEventListener('change', soon, true); document.addEventListener('click', soon, true);
  const go = () => { new MutationObserver(soon).observe(document.body, { childList: true, subtree: true }); soon(); }; if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  const st = document.createElement('style'); st.textContent = '.need-fill{outline:2px solid #f08c00;outline-offset:2px;border-radius:8px;position:relative}.need-fill>label:first-child::after,.need-fill>.lbl:first-child::after{content:" — needed";color:#c25e00;font-weight:600;font-size:.85em}'; document.head.appendChild(st); })();
window.nfRun = nfRun;
/* every reorder list: ⤒ send to the top and ⤓ send to the bottom, next to ↑ ↓ (added to any list that can be dragged, now and in future) */
function nfTopBottom(root) { (root || document).querySelectorAll('[data-dnd] > .dragrow').forEach((row) => { if (row.querySelector(':scope .tb-top')) return; const up = row.querySelector('button[data-d="-1"]'); const dn = row.querySelector('button[data-d="1"]');
  const mk = (cls, txt, title) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small ' + cls; b.textContent = txt; b.title = title; return b; };
  const t = mk('tb-top', '⤒', 'Send to the top'), bt = mk('tb-bot', '⤓', 'Send to the bottom');
  if (up && dn) { up.parentNode.insertBefore(t, up); dn.parentNode.insertBefore(bt, dn.nextSibling); } else { const hd = row.querySelector('.draghandle'); if (!hd) return; hd.parentNode.insertBefore(bt, hd.nextSibling); hd.parentNode.insertBefore(t, hd.nextSibling); }
  const rows = [...row.parentElement.querySelectorAll(':scope > .dragrow')]; if (rows[0] === row) t.disabled = true; if (rows[rows.length - 1] === row) bt.disabled = true; }); }
document.addEventListener('click', async (e) => { const b = e.target.closest && e.target.closest('.tb-top, .tb-bot'); if (!b) return; e.preventDefault(); e.stopPropagation(); const row = b.closest('.dragrow'); const box = row && row.parentElement; if (!box || !box.dataset.dnd) return;
  if (b.classList.contains('tb-top')) box.insertBefore(row, box.querySelector(':scope > .dragrow')); else box.appendChild(row);
  if (typeof dndEnd === 'function') { DND = { row, box, y0: 0, moved: true, pid: 0 }; await dndEnd(); } }, true);
(function () { let tm = null; const go = () => new MutationObserver(() => { if (!tm) tm = setTimeout(() => { tm = null; nfTopBottom(); }, 150); }).observe(document.body, { childList: true, subtree: true }); if (document.body) go(); else document.addEventListener('DOMContentLoaded', go); })();
/* only ask "leave without saving?" when you've actually changed something on the screen */
if (typeof sheetDirty === 'function') sheetDirty = (function (orig) { return function () { return !!(typeof SHEET !== 'undefined' && SHEET && SHEET._userEdit) && orig.apply(this, arguments); }; })(sheetDirty);
['input', 'change'].forEach((ev) => document.addEventListener(ev, (e) => { if (!e.isTrusted || typeof SHEET === 'undefined' || !SHEET) return; const sh = document.getElementById('sheet'); if (sh && sh.contains(e.target)) SHEET._userEdit = true; }, true));
