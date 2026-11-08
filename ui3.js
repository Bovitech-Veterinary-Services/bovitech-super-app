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
/* contact / business pages on a phone: a number or email with its "General · Reminders…" tag keeps the full width; the 📞 💬 buttons go
   on the line under it instead of squeezing it (the tag wraps rather than running off the card) */
(function () { const st = document.createElement('style'); st.textContent = '.kv .v .pill{white-space:normal;max-width:100%;display:inline-block;overflow:visible;text-overflow:clip;line-height:1.35;margin-top:3px}'
  + '@media (max-width:640px){.kv:has(> .cbtn){flex-wrap:wrap;row-gap:4px}.kv:has(> .cbtn) > .v{flex:1 1 calc(100% - 110px)}.kv:has(> .cbtn) > .cbtn:first-of-type{margin-left:auto}.kv .k{min-width:0!important}}'; document.head.appendChild(st); })();
/* 🔍 Find on page also finds words inside boxes (Edit mode, forms): what's typed in text boxes, notes and chosen options.
   A box that matches is outlined in orange and scrolled to. */
if (typeof fipRun === 'function') fipRun = (function (orig) { return function (first) { orig.apply(this, arguments); const q = (FIP.q || '').trim().toLowerCase(); if (!q) return; const root = document.querySelector('#sheet') || document.getElementById('main') || document.body;
  const F = [...root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not(#fip-q), textarea, select')].filter((el) => !el.closest('[hidden],#fipbar') && el.offsetParent !== null || (el.closest('details:not([open])') && !el.closest('[hidden]')));
  const add = []; F.forEach((el) => { const v = (el.tagName === 'SELECT' ? ((el.options[el.selectedIndex] || {}).text || '') : el.value || '').toLowerCase(); const k = v.indexOf(q); if (k >= 0) add.push({ field: el, k }); });
  if (!add.length) { return; } const node = (x) => (x.field ? x.field : x.startContainer); FIP.hits = [...FIP.hits, ...add].sort((a, b) => (node(a) === node(b) ? 0 : node(a).compareDocumentPosition(node(b)) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)); if (first) FIP.i = 0; fipShow(); }; })(fipRun);
if (typeof fipShow === 'function') fipShow = (function (orig) { return function () { document.querySelectorAll('.fip-field').forEach((x) => x.classList.remove('fip-field')); const r = FIP.hits[FIP.i]; if (!r || !r.field) return orig.apply(this, arguments);
  const n = document.getElementById('fip-n'); if (n) n.textContent = `${FIP.i + 1} of ${FIP.hits.length}`; const el = r.field; for (let d = el.closest('details:not([open])'); d; d = d.parentElement && d.parentElement.closest('details:not([open])')) d.open = true; if (window.CSS && CSS.highlights) CSS.highlights.delete('fipcur');
  el.classList.add('fip-field'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { if (typeof fipPlace === 'function') fipPlace(); }, 380); }; })(fipShow);
(function () { const st = document.createElement('style'); st.textContent = '.fip-field{outline:3px solid #f08c00!important;outline-offset:2px;background:#fff4e0!important}'; document.head.appendChild(st); })();
/* narrow phones (under 400 px wide): the top bar keeps every button on screen — "‹" instead of "‹ Back", smaller version button */
(function () { const st = document.createElement('style'); st.textContent = '@media (max-width:400px){header.top{gap:5px!important}header.top #hdr-back{font-size:0!important;padding:4px 10px!important}header.top #hdr-back::before{content:"‹";font-size:22px;line-height:1}header.top [data-act=app-refresh]{font-size:11.5px!important;padding:3px 6px!important}header.top #hdr-me{padding:5px 7px!important;font-size:12px!important}header.top #hdr-mic,header.top #fipbtn{padding:3px 5px!important;gap:3px}header.top .hlab{font-size:9px!important}}'; document.head.appendChild(st); })();
/* phones: a row with several buttons or choices (Settings lists, categories, location types…) wraps the buttons onto the next line
   instead of squeezing the words into a thin column; long buttons and web addresses wrap instead of running off the screen */
(function () { const st = document.createElement('style'); st.textContent = '@media (max-width:640px){.kv{flex-wrap:wrap;row-gap:6px}.kv > .v{flex:1 1 150px}.kv > input:not([type=checkbox]):not([type=radio]){flex:1 1 140px;min-width:0}.card .btn{max-width:100%;white-space:normal}.card{overflow-wrap:anywhere}.kv select,.dragrow select{max-width:100%;min-width:0}.dragrow{flex-wrap:wrap}}'; document.head.appendChild(st); })();
