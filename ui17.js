/* Bovitech Super App — 2.54.0
   1. ⭐ two kinds of favourite on every person and business: ★ Everyone (all devices) and 📱 Just me (this device)
   2. one search across the contact tabs (All contacts, People, Businesses, Patients)
   3. suggestions drop down under every search box as you type
   4. no A+ / B / C letters beside names in the contact lists (the photo shows it)
   5. "Opens: Remember how I left it" (was "As last left")
   6. ➕ New tab / ✏️ Rename / 🗑️ Delete tab on the tab bar while editing the layout */
const U17 = { tmp: {} };

/* ================= 1. favourites: ★ Everyone and 📱 Just me ================= */
const u17AllSet = () => new Set(Array.isArray((D.settings || {}).favsAll) ? D.settings.favsAll : []);
class U17Fav extends Set { has(id) { return super.has(id) || u17AllSet().has(id); } }
const u17MeHas = (x) => !!FAVS && Set.prototype.has.call(FAVS, x.id);
const u17AllHas = (x) => u17AllSet().has(x.id);
function u17FavInit() { try { localStorage.removeItem('bvp-favmode'); } catch (e) { } FAVS = new U17Fav(Array.isArray(PREF.favs) ? PREF.favs : []); }
/* a device that used "the same favourites on every device" keeps them — they're the ★ Everyone ones now */
if (typeof u15FavSync === 'function') u15FavSync = function () { if (!(FAVS instanceof U17Fav)) u17FavInit(); };
if (typeof u15FavCard === 'function') u15FavCard = function () { return ''; };
setFav = function (c, on) { if (!(FAVS instanceof U17Fav)) u17FavInit(); if (on) Set.prototype.add.call(FAVS, c.id); else Set.prototype.delete.call(FAVS, c.id); savePref('favs', [...Set.prototype.values.call(FAVS)]); };
function setFavAll(x, on) { const L = u17AllSet(); if (on) L.add(x.id); else L.delete(x.id); D.settings.favsAll = [...L]; touch(D.settings); save(); if (window.Sync && Sync.soon) Sync.soon(); else if (window.SupaSync && SupaSync.soon) SupaSync.soon(); }
window.setFavAll = setFavAll; window.u17MeHas = u17MeHas; window.u17AllHas = u17AllHas;
const u17Find = (kind, id) => (kind === 'business' ? IDX.biz.get(id) : D.contacts.find((y) => y.id === id));
const u17Nm = (kind, x) => (kind === 'business' ? x.name : showName(x));
favStarBtn = function (kind, x, row) { if (!(FAVS instanceof U17Fav)) u17FavInit(); const all = u17AllHas(x), me = u17MeHas(x);
  if (row) { const lab = all || me ? `${all ? '★' : ''}${me ? '📱' : ''}` : '☆'; const t = all && me ? 'Favourite for everyone and on this device' : all ? 'Favourite for everyone' : me ? 'Your favourite on this device' : 'Make a favourite';
    return `<button type="button" class="favstar favrow ${all || me ? 'on' : ''}" data-act="u17-favmenu" data-kind="${kind}" data-id="${h(x.id)}" title="${t}" aria-label="${t}">${lab}</button>`; }
  return `<span class="u17-favs"><button type="button" class="favstar u17-fb ${all ? 'on' : ''}" data-act="u17-fav" data-w="all" data-kind="${kind}" data-id="${h(x.id)}" aria-pressed="${all}" title="A favourite on every device">${all ? '★' : '☆'} Everyone</button><button type="button" class="favstar u17-fb ${me ? 'on' : ''}" data-act="u17-fav" data-w="me" data-kind="${kind}" data-id="${h(x.id)}" aria-pressed="${me}" title="A favourite only on this device">📱 ${me ? '★' : '☆'} Just me</button></span>`; };
function u17FavToggle(kind, id, w) { const x = u17Find(kind, id); if (!x) return; const nm = u17Nm(kind, x);
  if (w === 'all') { const on = !u17AllHas(x); setFavAll(x, on); toast(on ? `★ ${nm} is a favourite for everyone` : `${nm} is no longer a favourite for everyone`); }
  else { const on = !u17MeHas(x); setFav(x, on); toast(on ? `📱 ★ ${nm} is your favourite on this device` : `${nm} is no longer your favourite on this device`); } renderAll(); }
function u17MenuClose() { const m = document.getElementById('u17-favpop'); if (m) m.remove(); }
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=u17-fav],[data-act=u17-favmenu],[data-act=u17-favpick]'); if (!el) { if (!(e.target.closest && e.target.closest('#u17-favpop'))) u17MenuClose(); return; }
  e.preventDefault(); e.stopPropagation(); const a = el.dataset.act;
  if (a === 'u17-fav') { u17FavToggle(el.dataset.kind, el.dataset.id, el.dataset.w); return; }
  if (a === 'u17-favpick') { u17MenuClose(); u17FavToggle(el.dataset.kind, el.dataset.id, el.dataset.w); return; }
  u17MenuClose(); const x = u17Find(el.dataset.kind, el.dataset.id); if (!x) return; const all = u17AllHas(x), me = u17MeHas(x); const r = el.getBoundingClientRect();
  const pop = document.createElement('div'); pop.id = 'u17-favpop'; pop.setAttribute('role', 'menu');
  pop.innerHTML = `<div class="u17-poph">${h(u17Nm(el.dataset.kind, x))}</div><button type="button" role="menuitemcheckbox" aria-checked="${all}" data-act="u17-favpick" data-w="all" data-kind="${el.dataset.kind}" data-id="${h(x.id)}">${all ? '★' : '☆'} Favourite for everyone<span>all devices</span></button><button type="button" role="menuitemcheckbox" aria-checked="${me}" data-act="u17-favpick" data-w="me" data-kind="${el.dataset.kind}" data-id="${h(x.id)}">📱 ${me ? '★' : '☆'} Just me<span>only this device</span></button>`;
  document.body.appendChild(pop); const w = Math.min(260, window.innerWidth - 16); pop.style.width = w + 'px'; pop.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
  const top = r.bottom + 4; pop.style.top = (top + pop.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - pop.offsetHeight - 4) : top) + 'px'; }, true);
document.addEventListener('scroll', u17MenuClose, true);

/* ================= 2. one search across the contact tabs ================= */
const U17_CQ = ['q', 'aq', 'bq', 'pt-q'];
function u17SetQ(v) { S.q = v; S.aq = v; S.bq = v; if (typeof PT !== 'undefined') PT.q = v; }
document.addEventListener('input', (e) => { const t = e.target; if (t && U17_CQ.includes(t.id)) u17SetQ(t.value); }, true);
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=clear],[data-act=bclear],[data-act=aq-clear]'); if (el) u17SetQ(''); }, true);
/* switching tabs while typing: the box on the new tab has the same words, and the cursor is still in it */
document.addEventListener('pointerdown', (e) => { const el = e.target.closest && e.target.closest('[data-act=tab],[data-act=u2-sub],.subtabs [data-act]'); const a = document.activeElement; if (el && a && U17_CQ.includes(a.id)) U17.keepQ = Date.now(); }, true);
function u17Refocus() { if (!U17.keepQ || Date.now() - U17.keepQ > 3000) return; const box = U17_CQ.map((id) => document.getElementById(id)).find((x) => x && x.offsetParent !== null); if (!box || document.activeElement === box) return; U17.keepQ = 0; try { box.focus({ preventScroll: true }); const n = box.value.length; box.setSelectionRange(n, n); } catch (e) { } }

/* ================= 3. suggestions under every search box ================= */
const U17_OWN = new Set(['cr-pbq', 'u6-fq', 'cr-ppq', 'ebk-q', 'h3-q', 'cr-lq', 'fip-q', 'lg-q']); /* these already show their matches straight underneath */
const u17Words = (q) => String(q || '').toLowerCase().trim().split(/\s+/).filter((w) => w && !w.startsWith('-'));
const u17Hit = (hay, W) => { const s = String(hay || '').toLowerCase(); return W.every((w) => s.includes(w)); };
function u17Contacts(W, kinds) { const out = []; const nameOnly = (c) => [showName(c), fullName(c)].join(' ');
  if (kinds.includes('c')) D.contacts.forEach((c) => { if (!c.gone && u17Hit(nameOnly(c), W)) out.push({ kind: 'contact', id: c.id, label: showName(c), sub: (bizOf(c).map((b) => b.name).join(', ') || c.role || 'Person'), val: fullName(c), ic: '👤' }); });
  if (kinds.includes('b')) D.businesses.forEach((b) => { if (!b.gone && u17Hit([b.name, b.abbr].join(' '), W)) out.push({ kind: 'business', id: b.id, label: bizShow(b), sub: (typeof sfIs === 'function' && sfIs(b) ? 'Sharefarm' : isClientBiz(b) ? 'Business' : 'Industry business'), val: b.name, ic: typeof sfIs === 'function' && sfIs(b) ? '🤝' : '🏡' }); });
  if (kinds.includes('p') && typeof ptAll === 'function') ptAll().forEach((p) => { if (u17Hit([p.value, p.label, p.b && p.b.name].join(' '), W)) out.push({ kind: 'patient', id: p.key, label: `${p.value}${p.label ? ' — ' + p.label : ''}`, sub: p.b ? p.b.name : '', val: p.value, ic: p.sp === 'sheep' ? '🐑' : '🐄' }); });
  const st = (x) => (x.label.toLowerCase().startsWith(W[0] || '') ? 0 : 1); return out.sort((a, b) => st(a) - st(b) || a.label.localeCompare(b.label)); }
function u17Products(W) { const L = (typeof crList === 'function' ? crList('crprod') : []).filter((p) => !p.gone && !p.inactive && u17Hit([p.name, p.code, p.barcode].join(' '), W)); return L.map((p) => ({ label: p.name, sub: p.code || '', val: p.name, ic: '📦' })); }
function u17Farms(W) { const out = []; D.businesses.forEach((b) => { if (b.gone) return; (b.farms || []).forEach((f) => { if (u17Hit([f.name, f.address, b.name].join(' '), W)) out.push({ label: f.name || f.address || 'Farm', sub: b.name, val: f.name || f.address || '', ic: '📍' }); }); }); return out; }
function u17DomWords(el, W) { const root = el.closest('.sheet, #sheet, .askbox, .d-wrap, #detail, #list, main') || document.body; const seen = new Set(); const out = [];
  root.querySelectorAll('h2, h3, summary, .lbl, label, .k, .item .n, td:first-child, .guidestep b, b').forEach((n) => { if (n.closest('#u17-sug') || n.contains(el)) return; const t = (n.textContent || '').replace(/\s+/g, ' ').trim(); if (!t || t.length > 70 || seen.has(t.toLowerCase())) return; if (u17Hit(t, W)) { seen.add(t.toLowerCase()); out.push({ label: t, val: t, ic: '🔎' }); } }); return out; }
/* which matches each box offers, and what picking one does */
function u17Spec(el) { const id = el.id || '';
  if (el.classList.contains('sf-q')) return { src: (W) => u17Contacts(W, ['b']).filter((x) => { const b = IDX.biz.get(x.id); return b && !b.sfEntry; }), pick: (it) => { const row = el.closest('.sf-row'); if (row) { row.dataset.bid = it.id; el.value = IDX.biz.get(it.id).name; const r = row.querySelector('.sf-res'); if (r) r.innerHTML = ''; if (typeof sfCapture === 'function') sfCapture(); } } };
  if (id === 'aq' || id === 'q' || id === 'bq') return { src: (W) => u17Contacts(W, id === 'q' ? ['c'] : id === 'bq' ? ['b'] : ['c', 'b']), open: true };
  if (id === 'pt-q') return { src: (W) => u17Contacts(W, ['p', 'b']) };
  if (['cr-q', 'cr-iq', 'stm-q', 'lab-q', 'tx-q', 'cm-q', 'ezy-q'].includes(id) || /client|business|texts|emails/i.test(el.getAttribute('aria-label') || el.placeholder || '')) return { src: (W) => u17Contacts(W, ['b', 'c']) };
  if (['cr-pq', 'stk-q', 'u10-tq'].includes(id)) return { src: u17Products };
  if (id === 'lq') return { src: (W) => u17Farms(W).concat(u17Contacts(W, ['b'])) };
  return { src: (W) => u17DomWords(el, W) }; }
function u17Wants(el) { if (!el || el.tagName !== 'INPUT' || U17_OWN.has(el.id)) return false; if (el.classList.contains('sf-q')) return true; return el.type === 'search'; }
function u17Box() { let b = document.getElementById('u17-sug'); if (!b) { b = document.createElement('div'); b.id = 'u17-sug'; b.setAttribute('role', 'listbox'); document.body.appendChild(b); } return b; }
function u17Hide() { const b = document.getElementById('u17-sug'); if (b) { b.hidden = true; b.innerHTML = ''; } U17.cur = null; }
function u17Place(el) { const b = document.getElementById('u17-sug'); if (!b || b.hidden) return; const r = el.getBoundingClientRect(); if (!r.width) { u17Hide(); return; } const w = Math.min(Math.max(r.width, 240), window.innerWidth - 16);
  b.style.width = w + 'px'; b.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px'; const below = window.innerHeight - r.bottom - 8; b.style.maxHeight = Math.max(160, Math.min(340, below > 180 ? below : r.top - 8)) + 'px';
  if (below > 180 || below > r.top) { b.style.top = (r.bottom + 3) + 'px'; b.style.bottom = ''; } else { b.style.top = ''; b.style.bottom = (window.innerHeight - r.top + 3) + 'px'; } }
function u17Show(el) { const W = u17Words(el.value); if (!W.length || (W.join('').length < 2 && el.id !== 'pt-q')) { u17Hide(); return; } const sp = u17Spec(el); let L = []; try { L = sp.src(W, el) || []; } catch (e) { console.warn('u17 suggestions', e); }
  L = L.slice(0, 8); const b = u17Box(); U17.cur = { el, sp, L, i: -1 }; if (!L.length) { b.hidden = false; b.innerHTML = '<div class="u17-none">No matches</div>'; u17Place(el); return; }
  b.innerHTML = L.map((it, i) => `<div class="u17-it" role="option" data-i="${i}">${it.ic ? `<span class="u17-ic">${it.ic}</span>` : ''}<span class="u17-tx"><span class="u17-l">${h(it.label)}</span>${it.sub ? `<span class="u17-s">${h(it.sub)}</span>` : ''}</span></div>`).join(''); b.hidden = false; u17Place(el); }
function u17Mark(i) { const c = U17.cur; if (!c) return; c.i = i; document.querySelectorAll('#u17-sug .u17-it').forEach((n) => n.classList.toggle('on', +n.dataset.i === i)); const on = document.querySelector('#u17-sug .u17-it.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
function u17Pick(i) { const c = U17.cur; if (!c || !c.L[i]) return; const it = c.L[i], el = c.el; u17Hide(); U17.skip = Date.now();
  if (c.sp.pick) { c.sp.pick(it); return; }
  if (c.sp.open && it.kind && it.id) { const t = document.createElement('button'); t.type = 'button'; t.hidden = true; t.dataset.act = 'open'; t.dataset.kind = it.kind; t.dataset.id = it.id; (document.getElementById('list') || document.body).appendChild(t); t.click(); t.remove(); return; }
  el.value = it.val; el.dispatchEvent(new Event('input', { bubbles: true })); try { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } catch (e) { } }
document.addEventListener('input', (e) => { const el = e.target; if (!u17Wants(el)) return; clearTimeout(U17.tm); U17.tm = setTimeout(() => { if (document.activeElement === el || el.isConnected) u17Show(el); }, 90); });
document.addEventListener('focusin', (e) => { const el = e.target; if (u17Wants(el) && el.value.trim() && Date.now() - (U17.skip || 0) > 400) u17Show(el); });
document.addEventListener('focusout', (e) => { if (U17.cur && e.target === U17.cur.el) setTimeout(() => { if (!document.activeElement || document.activeElement !== (U17.cur || {}).el) u17Hide(); }, 180); });
document.addEventListener('keydown', (e) => { const c = U17.cur; if (!c || e.target !== c.el) return; const n = c.L.length;
  if (e.key === 'ArrowDown' && n) { e.preventDefault(); u17Mark((c.i + 1) % n); } else if (e.key === 'ArrowUp' && n) { e.preventDefault(); u17Mark((c.i - 1 + n) % n); }
  else if (e.key === 'Enter' && c.i >= 0) { e.preventDefault(); e.stopPropagation(); u17Pick(c.i); } else if (e.key === 'Escape') { u17Hide(); } }, true);
document.addEventListener('pointerdown', (e) => { const it = e.target.closest && e.target.closest('#u17-sug .u17-it'); if (!it) return; e.preventDefault(); e.stopPropagation(); u17Pick(+it.dataset.i); }, true);
window.addEventListener('resize', () => { if (U17.cur) u17Place(U17.cur.el); }); document.addEventListener('scroll', (e) => { if (U17.cur && !(e.target.closest && e.target.closest('#u17-sug'))) u17Place(U17.cur.el); }, true);
window.u17Show = u17Show;

/* ================= 6. ➕ New tab / ✏️ Rename / 🗑️ Delete on the tab bar while editing the layout ================= */
function u17EdPg() { if (!S.admin) return null; if (S.editPage && S.sel && (S.sel.kind === 'business' || S.sel.kind === 'contact')) return S.sel.kind === 'business' ? u15BizPg(S.sel.id) : 'person'; const lo = typeof LAY !== 'undefined' && LAY.on; return lo === 'rec' ? 'rec' : lo === 'patient' ? 'patient' : null; }
function u17TabTools() { try { const pg = u17EdPg(); if (!pg || typeof u15Cfg !== 'function') return; const C = u15Cfg(pg); let bar = document.querySelector(`.u15-tabs[data-pg="${pg}"]`);
  if (!bar) { /* only one tab in use: still show the tabs so a new one can be added */ const root = pg === 'biz' || pg === 'bizo' || pg === 'person' ? document.querySelector('#detail .d-wrap') : pg === 'rec' ? document.querySelector('#list .cr-edit') : document.querySelector('#list .d-wrap'); if (!root) return;
    const first = root.querySelector('[data-dnd^="eplayout:"]') || root.querySelector('.cr-sec, .edsec, .card'); if (!first) return; bar = document.createElement('div'); bar.className = 'u15-tabs'; bar.dataset.pg = pg; bar.setAttribute('role', 'tablist');
    const cur = (U15.cur[pg] && U15.cur[pg].t) || C.tabs[0].id; bar.innerHTML = C.tabs.map((t) => `<button type="button" role="tab" class="u15-tab ${t.id === cur ? 'on' : ''}" data-act="u15-tab" data-pg="${pg}" data-t="${h(t.id)}">${h(t.n)}</button>`).join(''); first.parentElement.insertBefore(bar, first); }
  if (bar.querySelector('.u17-ttools')) return; const have = new Set([...bar.querySelectorAll('.u15-tab')].map((b) => b.dataset.t));
  C.tabs.filter((t) => !have.has(t.id)).forEach((t) => bar.insertAdjacentHTML('beforeend', `<button type="button" role="tab" class="u15-tab u17-empty" data-act="u15-tab" data-pg="${pg}" data-t="${h(t.id)}" title="Nothing on this tab yet — use a section's Tab chooser to move sections here">${h(t.n)} <span class="u15-n">0</span></button>`));
  bar.insertAdjacentHTML('beforeend', `<span class="u17-ttools"><button type="button" class="btn small" data-act="u17-tadd" data-pg="${pg}">➕ New tab</button><button type="button" class="btn small" data-act="u17-tren" data-pg="${pg}">✏️ Rename this tab</button><button type="button" class="btn small" data-act="u17-tdel" data-pg="${pg}" ${C.tabs.length > 1 ? '' : 'disabled'}>🗑️ Delete this tab</button></span><div class="hint u17-thint">To put a section on a tab, choose it in that section's <b>Tab</b> box below. Applies on every device.</div>`); } catch (e) { console.warn('u17 tab tools', e); } }
async function u17TabSave(pg, label, fn, then) { if (!needAdmin()) return; const c = JSON.parse(JSON.stringify(u15Cfg(pg))); fn(c); u15SetCfg(pg, c); if (then) then(c); NEXT_LOG_LABEL = `${U15_PAGES[pg]} tabs: ${label}`; S.skipConfirm = true; await changed(); if (typeof layApply === 'function') layApply(); }
const u17CurTab = (pg) => { const C = u15Cfg(pg); const on = document.querySelector(`.u15-tabs[data-pg="${pg}"] .u15-tab.on`); return C.tabs.find((t) => t.id === (on ? on.dataset.t : (U15.cur[pg] || {}).t)) || C.tabs[0]; };
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=u17-tadd],[data-act=u17-tren],[data-act=u17-tdel]'); if (!el) return; e.preventDefault(); e.stopPropagation(); const pg = el.dataset.pg; const a = el.dataset.act; const fld = (v) => `<div class="f"><label for="u17-tn">Tab name</label><input id="u17-tn" data-ask="tn" value="${h(v || '')}" autocomplete="off" style="width:100%;font-size:16px;padding:9px;border:1px solid var(--line);border-radius:9px"></div>`;
  if (a === 'u17-tadd') { const ok = await askBox(`➕ New tab — ${h(U15_PAGES[pg])}`, fld('') + '<div class="hint">Then move sections onto it with each section\'s <b>Tab</b> box. Applies on every device.</div>', '➕ Add the tab', false, 'Cancel'); if (!ok) return; const n = (ASK_FORM.tn || '').trim(); if (!n) { toast('Give the tab a name'); return; }
    const id = 't' + Date.now().toString(36); await u17TabSave(pg, `added a "${n}" tab`, (c) => { c.tabs.push({ id, n }); }, () => { U15.cur[pg] = { ...(U15.cur[pg] || {}), t: id }; }); toast(`✓ "${n}" tab added — choose it in a section's Tab box to move that section there`); return; }
  const t = u17CurTab(pg); if (!t) return;
  if (a === 'u17-tren') { const ok = await askBox('✏️ Rename this tab', fld(t.n), 'Save', false, 'Cancel'); if (!ok) return; const n = (ASK_FORM.tn || '').trim(); if (!n || n === t.n) return; await u17TabSave(pg, `"${t.n}" renamed "${n}"`, (c) => { const x = c.tabs.find((y) => y.id === t.id); if (x) x.n = n; }); return; }
  if (a === 'u17-tdel') { const C = u15Cfg(pg); if (C.tabs.length < 2) return; const to = C.tabs.find((x) => x.id !== t.id); if (!(await ask(`Delete the "${h(t.n)}" tab?<br>Its sections move to "${h(to.n)}".<br><span class="hint">Applies on every device.</span>`, '🗑️ Delete the tab'))) return;
    await u17TabSave(pg, `deleted the "${t.n}" tab`, (c) => { c.tabs = c.tabs.filter((x) => x.id !== t.id); Object.keys(c.map || {}).forEach((k) => { if (c.map[k] === t.id) delete c.map[k]; }); }, () => { U15.cur[pg] = { ...(U15.cur[pg] || {}), t: to.id }; }); } }, true);

/* ================= after every redraw ================= */
function u17After() { try { u17TabTools(); u17Refocus(); } catch (e) { console.warn('u17', e); } }
if (typeof renderAll === 'function') renderAll = (function (orig) { return function () { const r = orig.apply(this, arguments); u17After(); return r; }; })(renderAll);
if (typeof renderDetail === 'function') renderDetail = (function (orig) { return function () { const r = orig.apply(this, arguments); u17After(); return r; }; })(renderDetail);
if (typeof layApply === 'function') layApply = (function (orig) { return function () { const r = orig.apply(this, arguments); u17After(); return r; }; })(layApply);
/* the contact lists redraw themselves without renderAll while typing */
['renderContactList', 'renderBizList', 'renderAllList'].forEach((fn) => { if (typeof window[fn] === 'function') { const o = window[fn]; window[fn] = function () { const r = o.apply(this, arguments); u17Refocus(); return r; }; } });

/* ================= look ================= */
(function () { const st = document.createElement('style'); st.textContent = `
#list li.item .rb,.results .rb{display:none!important}
.u17-favs{display:inline-flex;gap:6px;flex-wrap:wrap;vertical-align:middle;margin-left:8px}.u17-favs .u17-fb{font-size:13px;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--card,#fff);color:var(--ink);cursor:pointer;line-height:1.2;width:auto;height:auto}.u17-favs .u17-fb.on{background:#fff4c2;border-color:#d9b200;color:#5a4500;font-weight:700}
#u17-favpop{position:fixed;z-index:100001;background:var(--card,#fff);color:var(--ink);border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:6px}#u17-favpop .u17-poph{font-weight:700;font-size:13px;padding:4px 8px 6px;color:var(--ink3)}#u17-favpop button{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:8px;font:inherit;font-size:15px;color:inherit;cursor:pointer}#u17-favpop button:hover,#u17-favpop button:focus{background:var(--bg2,#f2f0ec)}#u17-favpop button span{font-size:12px;color:var(--ink3)}#u17-favpop button[aria-checked=true]{font-weight:700}
#u17-sug{position:fixed;z-index:100000;background:var(--card,#fff);color:var(--ink);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.16);overflow:auto;padding:4px}#u17-sug[hidden]{display:none}.u17-it{display:flex;gap:8px;align-items:center;padding:9px 10px;border-radius:8px;cursor:pointer;min-height:40px}.u17-it.on,.u17-it:hover{background:var(--bg2,#f2f0ec)}.u17-ic{flex:0 0 auto}.u17-tx{display:flex;flex-direction:column;min-width:0}.u17-l{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.u17-s{font-size:12px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.u17-none{padding:10px;color:var(--ink3);font-size:14px}
.sf-res{display:none!important}
.u17-ttools{display:inline-flex;gap:6px;flex-wrap:wrap;margin-left:4px}.u17-thint{flex-basis:100%;margin-top:2px}.u15-tab.u17-empty{border-style:dashed;opacity:.8}`; document.head.appendChild(st); })();
if (typeof BOXES !== 'undefined' && !BOXES.some((x) => x.k === 'u17fav')) BOXES.push({ k: 'u17fav', l: 'Favourite buttons — on', sel: '.u17-favs .u17-fb.on', txt: '.u17-favs .u17-fb.on', sample: '<span class="u17-favs"><button class="favstar u17-fb on">★ Everyone</button></span>', d: { bg: '#fff4c2', fg: '#5a4500', bd: '#d9b200', bold: true } });
if (typeof BOXES !== 'undefined' && !BOXES.some((x) => x.k === 'u17sug')) BOXES.push({ k: 'u17sug', l: 'Search suggestions drop-down', sel: '#u17-sug', txt: '#u17-sug .u17-l', sample: '<div style="border:1px solid #ddd;border-radius:10px;padding:6px"><b>Suggested match</b></div>', d: { bg: '#ffffff', fg: '#141414', bd: '#dddddd', bold: false } });

/* ================= admin check jobs ================= */
if (typeof u8Go === 'function') u8Go = (function (orig) { return function (k) { if (k !== 'u17:all') return orig.apply(this, arguments); if (typeof SHEET !== 'undefined' && SHEET) closeSheet(); S.tab = 'all'; S.sel = null; renderAll(); }; })(u8Go);
if (typeof SETUP !== 'undefined' && typeof U8_TRY !== 'undefined') [
  ['chk254-favs', 'Check: ⭐ two kinds of favourite', 'Open a person or a business: next to the name are ☆ Everyone and 📱 ☆ Just me. Tap Everyone — it\'s a favourite on every device. Tap Just me — only on this device. In the contact lists, tap the ☆ on a row for the same two choices. Favourites show at the top of All contacts (★ = everyone, 📱 = just you).', 'u17:all'],
  ['chk254-search', 'Check: 🔍 one search across the contact tabs', 'Contacts → People: type a name. Tap Businesses, then All contacts, then Patients — the same words stay in the search box (cursor still in it) and each tab is filtered by them.', 'u17:all'],
  ['chk254-sugg', 'Check: 🔍 suggestions under search boxes', 'Type in any search box (contacts, records, invoices, stock, settings, the sharefarm set-up member box…): matches drop down underneath. ↑ ↓ and Enter, or tap, picks one. In the contact lists, picking a name opens it.', 'u17:all'],
  ['chk254-letters', 'Check: no A+ / B / C letters in the lists', 'Contacts lists: names no longer have the A+ / A / B / C letters beside them — the photo shows the category.', 'u17:all'],
  ['chk254-tabs', 'Check: ➕ New tab from ✏️ Edit layout', 'Open a business → ✏️ Edit layout: the tab bar has ➕ New tab, ✏️ Rename this tab and 🗑️ Delete this tab. Add a tab, then choose it in a section\'s Tab box — the section moves there. "Opens" now says "Remember how I left it".', 'u13:biz']
].forEach(([id, t, tryIt, go]) => { U8_TRY[id] = tryIt; U8_TO[id] = go; if (SETUP.some((x) => x.id === id)) return; SETUP.push({ id, t, steps: [tryIt, `<button type="button" class="btn small" data-act="u8-go" data-go="${go}">➡️ Take me there</button>`, 'If it does what you want, tick <b>✓ Done</b>. If not, tell Claude what\'s wrong.'] }); });
