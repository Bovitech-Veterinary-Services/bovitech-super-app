/* Bovitech Super App — v2.39.
   • 🕐 Clock: on a computer every time box gets a 🕐 button that opens a clock face like the phone's — tap the hour, then the minutes
     (1–12 with an AM / PM switch — v2.43). 📅 Booked time (when there is one), Now and Clear are on it too. Phones keep their own clock.
   • Pop-up messages: general ones fade away after 2 seconds; warnings and errors stay with Copy message and ✕. */
(function () { const st = document.createElement('style'); st.textContent = [
  '.toast{transition:opacity .4s}.toast.t-fade{opacity:0}.toast.t-info{padding:10px 16px}.toast.t-info .tmsg{flex:0 1 auto}.toast.t-warn{border-left:6px solid #f08c00}',
  '.tp-wrap{display:flex;align-items:center;gap:4px;max-width:100%}.tp-wrap > input{flex:1 1 auto;min-width:0}.tp-clock{display:none;margin-left:4px;padding:3px 8px!important}@media (hover:hover) and (pointer:fine){.tp-clock{display:inline-flex}}',
  '.cr-bkt{margin:4px 0 0 0;display:block}.cr-vline > b{white-space:nowrap;flex:0 0 auto;align-self:flex-start}.cr-vline > div{min-width:0}',
  '.tp-ov{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:450;display:flex;align-items:center;justify-content:center}',
  '.tp-card{background:var(--card,#fff);color:var(--ink,#222);border-radius:14px;padding:14px;width:300px;max-width:calc(100vw - 24px);box-shadow:0 8px 30px rgba(0,0,0,.3)}',
  '.tp-top{display:flex;align-items:baseline;justify-content:center;gap:2px;font-size:42px;font-weight:700;margin-bottom:8px}.tp-top button{font:inherit;border:0;background:transparent;color:inherit;padding:0 6px;border-radius:8px;cursor:pointer;opacity:.5}.tp-top button.on{opacity:1;background:rgba(0,0,0,.06)}.tp-ap{display:inline-flex;flex-direction:column;gap:2px;margin-left:8px;align-self:center}.tp-top .tp-ap button{font-size:14px;padding:3px 8px;border:1px solid var(--line,#ccc);opacity:.6}.tp-top .tp-ap button.on{opacity:1;background:var(--acc,#1f6f43);color:#fff;border-color:var(--acc,#1f6f43)}',
  '.tp-dial{position:relative;width:240px;height:240px;margin:0 auto;border-radius:50%;background:rgba(0,0,0,.06);touch-action:none;cursor:pointer}',
  '.tp-n{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;pointer-events:none}.tp-n.in{font-size:12.5px;opacity:.75}.tp-n.on{background:var(--acc,#1f6f43);color:#fff;opacity:1}',
  '.tp-hand{position:absolute;left:50%;top:50%;height:2px;background:var(--acc,#1f6f43);transform-origin:0 50%;pointer-events:none}.tp-dot{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px;border-radius:50%;background:var(--acc,#1f6f43)}',
  '.tp-quick{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0 4px}.tp-acts{display:flex;justify-content:flex-end;gap:6px;margin-top:6px}'].join(''); document.head.appendChild(st); })();

const TP = { el: null, inp: null, h: 0, m: 0, mode: 'h' };
const tpPad = (n) => String(n).padStart(2, '0');
function tpPos(i, r) { const a = (i / 12) * 2 * Math.PI - Math.PI / 2; return { x: 120 + r * Math.cos(a), y: 120 + r * Math.sin(a) }; }
function tpDraw() { const c = TP.el; if (!c) return; const pm = TP.h >= 12, h12 = TP.h % 12 === 0 ? 12 : TP.h % 12; c.querySelector('.tp-hh').textContent = String(h12); c.querySelector('.tp-mm').textContent = tpPad(TP.m); c.querySelector('.tp-hh').classList.toggle('on', TP.mode === 'h'); c.querySelector('.tp-mm').classList.toggle('on', TP.mode === 'm');
  c.querySelectorAll('[data-tpap]').forEach((b) => b.classList.toggle('on', (b.dataset.tpap === 'pm') === pm));
  let html = ''; let sel = null;
  if (TP.mode === 'h') { for (let i = 0; i < 12; i++) { const ho = i === 0 ? 12 : i; const po = tpPos(i, 100); const on = h12 === ho; html += `<div class="tp-n ${on ? 'on' : ''}" style="left:${po.x}px;top:${po.y}px">${ho}</div>`; if (on) sel = { i, r: 100 }; } }
  else { for (let i = 0; i < 12; i++) { const p = tpPos(i, 100); const on = TP.m === i * 5; html += `<div class="tp-n ${on ? 'on' : ''}" style="left:${p.x}px;top:${p.y}px">${tpPad(i * 5)}</div>`; } sel = { i: TP.m / 5, r: 100 }; }
  if (sel) { const a = (sel.i / 12) * 360 - 90; html += `<div class="tp-hand" style="width:${sel.r - 17}px;transform:rotate(${a}deg)"></div>`; } html += '<div class="tp-dot"></div>';
  c.querySelector('.tp-dial').innerHTML = html; }
function tpPick(e, end) { const d = TP.el.querySelector('.tp-dial').getBoundingClientRect(); const x = e.clientX - d.left - 120, y = e.clientY - d.top - 120; let ang = Math.atan2(y, x) + Math.PI / 2; if (ang < 0) ang += 2 * Math.PI;
  if (TP.mode === 'h') { const i = Math.round(ang / (2 * Math.PI) * 12) % 12; const pm = TP.h >= 12; TP.h = (i % 12) + (pm ? 12 : 0); tpDraw(); if (end) { TP.mode = 'm'; setTimeout(tpDraw, 150); } }
  else { TP.m = (Math.round(ang / (2 * Math.PI) * 12) % 12) * 5; tpDraw(); } }
function tpOpen(inp) { tpClose(); TP.inp = inp; const v = /^(\d\d):(\d\d)/.exec(inp.value || ''); const now = new Date(); TP.h = v ? +v[1] : now.getHours(); TP.m = v ? Math.round(+v[2] / 5) * 5 % 60 : Math.round(now.getMinutes() / 5) * 5 % 60; TP.mode = 'h';
  const bk = inp.dataset.booked; const lab = (inp.labels && inp.labels[0] && inp.labels[0].textContent) || inp.getAttribute('aria-label') || 'Time';
  const ov = document.createElement('div'); ov.className = 'tp-ov'; ov.innerHTML = `<div class="tp-card" role="dialog" aria-label="${h(lab)}"><div class="hint" style="text-align:center">${h(lab)}</div><div class="tp-top"><button type="button" class="tp-hh"></button>:<button type="button" class="tp-mm"></button><span class="tp-ap"><button type="button" data-tpap="am">AM</button><button type="button" data-tpap="pm">PM</button></span></div><div class="tp-dial"></div>
    <div class="tp-quick">${bk ? `<button type="button" class="btn small" data-tpq="${h(bk)}">📅 Booked time (${h(bkTime(bkMin(bk)))})</button>` : ''}<button type="button" class="btn small" data-tpq="now">Now</button><button type="button" class="btn small" data-tpq="clear">Clear</button></div>
    <div class="tp-acts"><button type="button" class="btn small" data-tpx="cancel">Cancel</button><button type="button" class="btn small primary" data-tpx="ok">OK</button></div></div>`;
  document.body.appendChild(ov); TP.el = ov; tpDraw();
  let down = false; const dial = ov.querySelector('.tp-dial');
  dial.addEventListener('pointerdown', (e) => { down = true; try { dial.setPointerCapture(e.pointerId); } catch (x) { } tpPick(e, false); });
  dial.addEventListener('pointermove', (e) => { if (down) tpPick(e, false); });
  dial.addEventListener('pointerup', (e) => { if (!down) return; down = false; tpPick(e, true); });
  ov.addEventListener('click', (e) => { if (e.target === ov) return tpClose(); const q = e.target.closest('[data-tpq]'); if (q) { const v2 = q.dataset.tpq; if (v2 === 'clear') return tpSet(''); if (v2 === 'now') { const n = new Date(); return tpSet(`${tpPad(n.getHours())}:${tpPad(Math.round(n.getMinutes() / 5) * 5 % 60)}`.replace(/^(\d\d):60$/, '$1:55')); } return tpSet(v2); }
    const ap = e.target.closest('[data-tpap]'); if (ap) { const pm = ap.dataset.tpap === 'pm'; TP.h = (TP.h % 12) + (pm ? 12 : 0); tpDraw(); return; }
    if (e.target.closest('.tp-hh')) { TP.mode = 'h'; tpDraw(); } if (e.target.closest('.tp-mm')) { TP.mode = 'm'; tpDraw(); }
    const x = e.target.closest('[data-tpx]'); if (x) { if (x.dataset.tpx === 'ok') tpSet(`${tpPad(TP.h % 24)}:${tpPad(TP.m)}`); else tpClose(); } });
  ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') tpClose(); if (e.key === 'Enter') { e.preventDefault(); tpSet(`${tpPad(TP.h % 24)}:${tpPad(TP.m)}`); } });
  setTimeout(() => { const b = ov.querySelector('[data-tpx=ok]'); if (b) b.focus(); }, 30); }
function tpSet(v) { const inp = TP.inp; tpClose(); if (!inp || !inp.isConnected) return; inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
function tpClose() { if (TP.el) TP.el.remove(); TP.el = null; }
/* a 🕐 button beside every time box (shown on computers only) */
function tpAdd(root) { (root || document).querySelectorAll('input[type=time]:not([data-tp])').forEach((inp) => { inp.dataset.tp = '1'; const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small tp-clock'; b.textContent = '🕐'; b.title = 'Pick the time on a clock'; b.setAttribute('aria-label', 'Pick the time on a clock'); const w = document.createElement('span'); w.className = 'tp-wrap'; inp.parentNode.insertBefore(w, inp); w.appendChild(inp); w.appendChild(b); }); }
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.tp-clock'); if (!b) return; e.preventDefault(); e.stopPropagation(); const inp = b.previousElementSibling; if (inp && inp.type === 'time' && !inp.disabled && !inp.closest('fieldset[disabled]')) tpOpen(inp); }, true);
new MutationObserver((ms) => { if (ms.some((m) => m.addedNodes.length)) tpAdd(); }).observe(document.documentElement, { childList: true, subtree: true });
tpAdd();
window.tpOpen = tpOpen;
