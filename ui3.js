/* Bovitech Super App — v2.36: phone layout fixes.
   • "Ask Shaz" and "Find on page" show beside 🎤 and 🔍 (an old phone rule hid words in the top bar buttons).
   • The General / Reminders / Financials / Promotional ticks keep each word whole (they were breaking one letter per line).
   • Phone numbers stay on one line on contact and business pages.
   • 🔍 Find on page: the search bar stays at the top of what you can see while the page moves (also with the keyboard open), and the
     match it jumps to sits below the bar, never under it. */
(function () { const st = document.createElement('style'); st.textContent = [
  'header.top .hbtn .hlab{display:inline-block!important}',
  '.repchk{flex-wrap:wrap!important;gap:6px 14px!important}.repchk label{white-space:nowrap;flex:0 0 auto}',
  '.kv .v a[href^="tel:"]{white-space:nowrap}',
  '.dzhint{white-space:normal;max-width:100%}#sheet .actions{flex-wrap:wrap}#sheet .actions .btn{max-width:100%;white-space:normal}',
  '#fipbar{transition:top .08s linear}body.fip-on .fipmark,body.fip-on [data-fipcur]{scroll-margin-top:90px}'].join(''); document.head.appendChild(st); })();
/* keep the find bar at the top of the visible screen (phones move the visible area when zooming or when the keyboard opens) */
function fipPlace() { const b = document.getElementById('fipbar'); if (!b || b.hidden) return; const vv = window.visualViewport; b.style.top = ((vv ? vv.offsetTop : 0) + 8) + 'px'; if (vv) { b.style.left = (vv.offsetLeft + 8) + 'px'; b.style.right = 'auto'; b.style.width = Math.max(200, vv.width - 16) + 'px'; } }
if (window.visualViewport) { window.visualViewport.addEventListener('scroll', fipPlace); window.visualViewport.addEventListener('resize', fipPlace); } window.addEventListener('scroll', fipPlace, true);
if (typeof fipOpen === 'function') fipOpen = (function (orig) { return function () { const r = orig.apply(this, arguments); document.body.classList.add('fip-on'); fipPlace(); return r; }; })(fipOpen);
if (typeof fipClose === 'function') fipClose = (function (orig) { return function () { document.body.classList.remove('fip-on'); return orig.apply(this, arguments); }; })(fipClose);
/* the match: scrolled to just below the bar instead of the middle (so the bar never covers it) */
if (typeof fipShow === 'function') fipShow = (function (orig) { return function () { const r = orig.apply(this, arguments); setTimeout(() => { const h = FIP.hits && FIP.hits[FIP.i]; const el = h && (h.el || (h.range && h.range.startContainer && h.range.startContainer.parentElement) || (h.startContainer && h.startContainer.parentElement)); const bar = document.getElementById('fipbar'); if (!el || !bar) return; const top = el.getBoundingClientRect().top; const vv = window.visualViewport; const vh = vv ? vv.height : window.innerHeight; const bb = bar.getBoundingClientRect().bottom - (vv ? vv.offsetTop : 0); if (top < bb + 12 || top > vh - 60) { const sc = el.closest('#list, #detail, .sheet, #sheet .form') || document.scrollingElement; const want = top - (bb + Math.min(160, (vh - bb) / 3)); if (sc && sc !== document.scrollingElement && sc.scrollHeight > sc.clientHeight) sc.scrollBy({ top: want }); else window.scrollBy({ top: want }); } fipPlace(); }, 380); return r; }; })(fipShow);
window.fipPlace = fipPlace;
