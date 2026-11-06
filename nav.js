/* Bovitech Super App — v2.27: "go there" links. Anywhere the app says where something is ("Settings → Scheduling → Who to book under",
   "Scheduling → Vehicles", "Records → Stock"…), the words become a link that takes you there and opens that section.
   It works on every page, now and for anything added later (no need to add buttons one by one). */
const NAV_MAIN = { settings: 'settings', scheduling: 'book', records: 'rec', jobs: 'jobs', contacts: 'contacts', texts: 'texts', patients: 'pat', 'clinical records': 'rec' };
function navGo(path) { const seg = String(path).split(/\s*→\s*/).map((x) => x.replace(/^[^\p{L}]+/u, '').trim()).filter(Boolean); if (!seg.length) return false;
  const main = NAV_MAIN[seg[0].toLowerCase()]; if (!main) return false; let rest = seg.slice(1); const low = (t) => t.toLowerCase();
  if (typeof SHEET !== 'undefined' && SHEET) closeSheet(); S.sel = null; S.tab = main;
  if (main === 'book' && rest.length) { const sub = (typeof BK_SUBS !== 'undefined' ? BK_SUBS : []).find((x) => low(x[1]) === low(rest[0]) || low(x[1]).startsWith(low(rest[0])) || low(rest[0]).startsWith(low(x[1]))); if (sub) { BK.page = sub[0]; rest = rest.slice(1); } else BK.page = 'cal'; }
  if (main === 'rec' && rest.length) { const sub = (typeof CR_SUBS !== 'undefined' ? CR_SUBS : []).find((x) => low(x[1]) === low(rest[0]) || low(rest[0]).startsWith(low(x[1]))); if (sub) { CR.page = sub[0]; rest = rest.slice(1); } }
  if (main === 'settings') { const sub = (typeof SET_SUBS !== 'undefined' ? SET_SUBS : []).find(([k]) => { const n = low(typeof setSubName === 'function' ? setSubName(k) : k); return n === low(rest[0] || '') || (rest[0] && (n.startsWith(low(rest[0])) || low(rest[0]).startsWith(n))); }); S.setSub = sub ? sub[0] : 'allset'; if (sub) rest = rest.slice(1); S.setQ = ''; }
  renderAll(); const want = rest.length ? low(rest[0]).replace(/[^\p{L}\p{N} ]/gu, '').trim() : '';
  setTimeout(() => { if (!want) { const l = document.getElementById('list'); if (l) l.scrollTop = 0; return; }
    const cands = [...document.querySelectorAll('#list h2, #list h3, #list summary, #list .lbl, #list b')]; const el = cands.find((x) => low(x.textContent).replace(/[^\p{L}\p{N} ]/gu, '').trim().includes(want));
    if (!el) { toast('Opened ' + seg.slice(0, 2).join(' → ') + ' — look for "' + rest[0] + '"'); return; }
    for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true; if (el.tagName === 'SUMMARY' && el.parentElement) el.parentElement.open = true;
    const box = el.closest('.card, details') || el; box.scrollIntoView({ behavior: 'smooth', block: 'start' }); box.classList.add('nav-flash'); setTimeout(() => box.classList.remove('nav-flash'), 2200); }, 120);
  return true; }
/* a button for a place (used where code wants one) */
const NAV_DEST = { veh: 'Scheduling → Vehicles', vsp: 'Settings → Scheduling → Vehicle service providers', roster: 'Scheduling → On-call', bulk: 'Scheduling → Bulk lists', stock: 'Records → Stock', golive: 'Settings → Scheduling → Texts and emails before go-live' };
function goBtn(dest, label) { const p = NAV_DEST[dest] || dest; return `<button type="button" class="btn small gobtn" data-act="go" data-path="${h(p)}">${h(label || p)} ↗</button>`; }
/* turn written directions into links */
const NAV_RX = /((?:Settings|Scheduling|Records|Jobs|Contacts|Patients|Texts)(?:\s*→\s*[^→.,;:()<>\n]{1,48}?)+)(?=\s*(?:[.,;:()]|$|→\s*$|\s+(?:and|or|to|for|—|-|then|shows|is|are|has|in|on|below|above)\b))/g;
function navLinkify(root) { if (!root) return; const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.nodeValue.includes('→') && t.parentElement && !t.parentElement.closest('a,button,select,option,textarea,input,.golink,script,style,[contenteditable],.richedit,pre,code') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const L = []; let t; while ((t = tw.nextNode())) L.push(t);
  L.forEach((node) => { const v = node.nodeValue; NAV_RX.lastIndex = 0; if (!NAV_RX.test(v)) return; NAV_RX.lastIndex = 0; const frag = document.createDocumentFragment(); let last = 0; let m;
    while ((m = NAV_RX.exec(v))) { const path = m[1].trim(); const first = path.split(/\s*→\s*/)[1] || ''; if (!first) continue; frag.appendChild(document.createTextNode(v.slice(last, m.index))); const a = document.createElement('a'); a.className = 'golink'; a.href = '#'; a.dataset.act = 'go'; a.dataset.path = path; a.title = 'Go there'; a.textContent = m[1]; frag.appendChild(a); last = m.index + m[1].length; }
    if (!last) return; frag.appendChild(document.createTextNode(v.slice(last))); node.parentNode.replaceChild(frag, node); }); }
/* bold parts like "Settings → <b>Scheduling</b>" are joined first by looking at the whole parent: links only plain text */
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=go]'); if (!el) return; e.preventDefault(); e.stopPropagation(); if (!navGo(el.dataset.path)) toast("Can't open that from here"); }, true);
(function () { let tm = null; const run = () => { tm = null; ['list', 'detail'].forEach((id) => navLinkify(document.getElementById(id))); const sh = document.getElementById('sheet'); if (sh) navLinkify(sh); const ab = document.getElementById('askbox'); if (ab) navLinkify(ab); };
  const go = () => { new MutationObserver(() => { if (!tm) tm = setTimeout(run, 150); }).observe(document.body, { childList: true, subtree: true }); run(); };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  const st = document.createElement('style'); st.textContent = 'a.golink{color:inherit;text-decoration:underline dotted;text-underline-offset:2px;cursor:pointer}a.golink:hover{text-decoration-style:solid}a.golink::after{content:" ↗";font-size:.8em}.gobtn{white-space:nowrap}.nav-flash{animation:navflash 2s ease}@keyframes navflash{0%,40%{box-shadow:0 0 0 4px #f5b800}100%{box-shadow:none}}'; document.head.appendChild(st); })();
window.goBtn = goBtn; window.navGo = navGo;
