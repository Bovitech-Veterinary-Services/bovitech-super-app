/* Bovitech Super App — v2.41.
   • Records (and every page): choosing from a drop-down keeps the page where it was (it used to jump to the top).
   • ⟳ Update: gets every app file fresh (not just a few), so the new version actually loads; if the old one still comes up it
     tries once more by itself.
   • 📴 Poor reception: if the internet is very slow when the app opens, it asks whether to work offline. While offline, a bar at the
     top says so, with Go online; it offers Go online when reception is good again. Settings → General → 📴 Poor reception. */
/* ---------- keep the page where it was ---------- */
(function () { const keyNow = () => [S.tab, S.sel ? S.sel.kind + ':' + S.sel.id : '', typeof CR !== 'undefined' ? CR.page + ':' + CR.id : '', typeof BK !== 'undefined' ? BK.page : '', S.setSub || ''].join('|');
  const els = () => ['#list', '#detail', '#main', '.sheet'].map((q) => document.querySelector(q)).filter(Boolean);
  if (typeof renderAll === 'function') renderAll = (function (orig) { return function () { const k = keyNow(); const win = window.scrollY; const pos = els().map((el) => [el, el.scrollTop]);
    const r = orig.apply(this, arguments);
    if (keyNow() === k) { const put = () => { pos.forEach(([el, t]) => { const cur = el.isConnected ? el : null; if (cur && Math.abs(cur.scrollTop - t) > 2) cur.scrollTop = t; }); if (Math.abs(window.scrollY - win) > 2) window.scrollTo(0, win); }; put(); requestAnimationFrame(put); setTimeout(put, 80); }
    return r; }; })(renderAll); })();
/* ---------- ⟳ Update that really updates ---------- */
async function refreshApp() {
  if (!OFFMODE.real()) { toast("You're offline — can't check for a newer version right now"); return; }
  toast('Getting the latest version…', 'info');
  const tmo = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  try { clearTimeout(saveTimer); await tmo(Store.set('data', D), 4000); } catch (e) { }
  try {
    if (OFFMODE.on) { OFFMODE.on = false; try { localStorage.removeItem('bvp-offmode'); } catch (e) { } }
    let files = ['./', 'index.html', 'sw.js', 'version.json', 'manifest.webmanifest'];
    try { const t = await (await tmo(fetch('sw.js?r=' + Date.now(), { cache: 'no-store' }), 6000)).text(); const m = t.match(/SHELL = \[([^\]]*)\]/); if (m) files = [...new Set([...files, ...m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean)])]; } catch (e) { }
    if (navigator.serviceWorker) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister().catch(() => {}))); }
    if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); }
    let n = 0; await tmo(Promise.all(files.map((u) => fetch(u, { cache: 'reload' }).then(() => { n++; if (n % 10 === 0) toast(`Getting the latest version… ${n} of ${files.length}`, 'info'); }).catch(() => {}))), 25000);
    try { sessionStorage.setItem('bvp-upd', JSON.stringify({ want: S.latest || '', at: Date.now(), tries: (JSON.parse(sessionStorage.getItem('bvp-upd') || '{}').tries || 0) + 1 })); } catch (e) { }
  } catch (e) { }
  location.replace(location.pathname + '?v=' + Date.now());
}
window.refreshApp = refreshApp;
/* after an update: if the old version still came up, try once more */
setTimeout(async () => { let u = null; try { u = JSON.parse(sessionStorage.getItem('bvp-upd') || 'null'); } catch (e) { } if (!u) return; const mine = APP_VERSION.split(' ')[0];
  if (!u.want || u.want === mine) { sessionStorage.removeItem('bvp-upd'); if (u.want) toast(`✓ Updated to ${mine}`, 'info'); return; }
  if (u.tries < 2 && Date.now() - u.at < 120000) { refreshApp(); return; } sessionStorage.removeItem('bvp-upd'); toast(`Still on ${mine} — close the app completely and open it again to finish updating to ${u.want}`, 'warn'); }, 2500);
/* ---------- 📴 work offline when reception is poor ---------- */
const OFF = { asked: false };
const offSet = () => Object.assign({ ask: true, secs: 4 }, (D.settings && D.settings.offline) || {});
function offBar() { let b = document.getElementById('offbar'); if (!OFFMODE.on) { if (b) b.remove(); document.body.classList.remove('offmode'); return; }
  if (!b) { b = document.createElement('div'); b.id = 'offbar'; b.setAttribute('role', 'status'); document.body.prepend(b); } document.body.classList.add('offmode');
  const n = typeof pendingCount === 'function' ? pendingCount() : 0; b.innerHTML = `<span>📴 <b>Working offline</b> — changes stay on this device${n ? ` (${n} waiting to sync)` : ''}.</span><button class="btn small" data-act="off-go">Go online</button>`; }
async function offGoOnline(quiet) { OFFMODE.on = false; try { localStorage.removeItem('bvp-offmode'); } catch (e) { } try { if (window.caches) caches.delete('offline-mode-flag'); } catch (e) { } offBar(); if (!quiet) toast('Back online — syncing', 'info'); try { if (window.Sync && Sync.run) Sync.run(true); else if (window.SupaSync) SupaSync.run(true); } catch (e) { } window.dispatchEvent(new Event('online')); renderAll(); }
function offStart() { OFFMODE.on = true; try { localStorage.setItem('bvp-offmode', '1'); } catch (e) { } try { if (window.caches) caches.open('offline-mode-flag'); } catch (e) { } offBar(); window.dispatchEvent(new Event('offline')); toast('📴 Working offline — tap Go online at the top when reception is better', 'info'); renderAll(); }
async function offPing(ms) { if (!OFFMODE.real()) return Infinity; const t0 = performance.now(); const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms); try { await fetch('version.json?ping=' + Date.now(), { cache: 'no-store', signal: ctl.signal }); clearTimeout(tm); return performance.now() - t0; } catch (e) { clearTimeout(tm); return Infinity; } }
async function offCheck() { const st = offSet(); if (OFFMODE.on || OFF.asked || !st.ask || !OFFMODE.real() || window.SEED || (navigator.webdriver && !window.OFF_TEST)) return; const ms = await offPing(st.secs * 1000); if (ms < st.secs * 1000) return; OFF.asked = true;
  const r = await askBox('📴 Poor reception', `<p>The internet is very slow here, so the app is slow too.</p><p><b>Work offline?</b> The app stops trying to reach the internet so it's quick again. Everything you do stays on this device and syncs when you tap <b>Go online</b> (at the top) once reception is better.</p>`, 'Work offline', false, 'Keep trying online'); if (r) offStart(); }
setTimeout(offCheck, 1500);
/* while offline: every 2 minutes, see whether reception is good again */
setInterval(async () => { if (!OFFMODE.on || !OFFMODE.real() || document.hidden) return; const ms = await offPing(2500); if (ms < 1500 && !document.getElementById('askbox')) { const b = document.getElementById('offbar'); if (b && !b.querySelector('.off-good')) b.insertAdjacentHTML('afterbegin', '<span class="off-good">📶 Reception looks good again. </span>'); } }, 120000);
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act="off-go"],[data-act="off-start"],[data-act="off-save"]'); if (!el) return; e.preventDefault(); e.stopPropagation();
  if (el.dataset.act === 'off-go') offGoOnline(); else if (el.dataset.act === 'off-start') offStart();
  else { (async () => { const ask = !!(document.getElementById('off-ask') || {}).checked; const secs = Math.max(2, Math.min(20, Math.round(+((document.getElementById('off-secs') || {}).value) || 4))); if (!(await askBox('Save?', `<p>${ask ? `Ask to work offline when the internet takes more than <b>${secs} seconds</b> to answer` : "Don't ask to work offline"}?</p>`, 'Save'))) return; D.settings.offline = { ask, secs }; touch(D.settings); save(); if (window.Sync) Sync.soon(); toast('Saved', 'info'); renderAll(); })(); } }, true);
(function () { const st = document.createElement('style'); st.textContent = '#offbar{position:sticky;top:0;z-index:300;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;justify-content:center;padding:6px 10px;background:#fff1c2;color:#141414;border-bottom:1px solid #e0b84a;font-size:14px}#offbar .off-good{color:#1d6b35;font-weight:600}'; document.head.appendChild(st); })();
setTimeout(offBar, 0);
/* Settings → General: 📴 Poor reception */
function offCard() { const st = offSet(); return `<div class="card"><h3><span class="sp">📴 Poor reception</span></h3><div class="hint" style="margin-bottom:6px">When the app opens and the internet is very slow, it asks whether to work offline (everything stays on this device and syncs when you tap Go online).</div>
  <label class="bk-radio" style="display:flex"><input type="checkbox" id="off-ask" ${st.ask ? 'checked' : ''}> Ask to work offline when reception is poor</label>
  <div class="kv" style="align-items:center"><div class="v"><label for="off-secs">"Poor" means the internet takes more than (seconds)</label></div><input id="off-secs" type="number" min="2" max="20" step="1" value="${st.secs}" style="width:80px"></div>
  <div class="actions"><button class="btn small primary" data-act="off-save">Save</button>${OFFMODE.on ? '<button class="btn small" data-act="off-go">Go online</button>' : '<button class="btn small" data-act="off-start">📴 Work offline now</button>'}</div></div>`; }
if (typeof renderSettings === 'function') renderSettings = (function (orig) { return function () { const html = orig.apply(this, arguments); const i = html.lastIndexOf('</div>'); return i < 0 ? html : html.slice(0, i) + offCard() + html.slice(i); }; })(renderSettings);
window.offStart = offStart; window.offGoOnline = offGoOnline; window.offCheck = offCheck;
