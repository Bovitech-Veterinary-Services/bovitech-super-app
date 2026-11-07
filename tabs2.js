/* Bovitech Super App — v2.29: the main tabs, regrouped.
   • 💬 Communications (was Texts): Unread texts · All texts · Emails · Search (texts and emails together, general and record-related).
   • 📦 Inventory (was Records → Stock): Stock · Price lists.
   • 💲 Finance (was in Records): Invoices · Statements · Overdue.
   • Records keeps Records · Search · Follow-ups.
   The pages themselves are the same — only where they live has changed. Tab order (Settings → Display) still works. */
if (typeof TAB_DEFAULTS !== 'undefined') { TAB_DEFAULTS.texts = 'Comms'; TAB_DEFAULTS.inv = 'Inventory'; TAB_DEFAULTS.fin = 'Finance'; }
if (typeof TAB_GRP_NAMES !== 'undefined') { TAB_GRP_NAMES.t = 'Communications sub-tabs'; TAB_GRP_NAMES.i = 'Inventory sub-tabs'; TAB_GRP_NAMES.f = 'Finance sub-tabs'; }
const T2 = { comm: [['texts', 'Texts'], ['mail', 'Emails'], ['calls', 'Phone calls'], ['fus', 'Follow-ups'], ['csearch', 'Search']], inv: [['stock', 'Stock'], ['prods', 'Price lists']], fin: [['invs', 'Invoices'], ['stmts', 'Statements'], ['overdue', 'Overdue']], rec: ['recs', 'search', 'fus'] };
const T2_ICON = { inv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>', fin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M7 12h.01M17 12h.01"/></svg>' };
function t2Grp() { if (CONTACT_TABS.includes(S.tab)) return 'c'; if (S.tab === 'book') return 'b'; if (S.tab === 'texts') return 't';
  if (S.tab === 'rec') { const p = (typeof CR !== 'undefined' && CR.page) || 'recs'; if (p === 'mail') return 't'; if (p === 'stock' || p === 'prods') return 'i'; if (p === 'invs' || p === 'inv' || p === 'stmts' || p === 'overdue') return 'f'; return 'r'; } return 's'; }
renderTabs = function () {
  const n = jobs().filter((j) => !jobInactive(j)).length; const bon = typeof Bk !== 'undefined' && Bk.on(); const nb = bon ? bkJobs().length : 0;
  if (CONTACT_TABS.includes(S.tab)) S.lastCTab = S.tab; const grp = t2Grp();
  const nt = typeof smsLog === 'function' ? smsLog().filter(smsUnread).length : 0; const ron = typeof crOn === 'function' && crOn();
  const badge = (x) => (x ? `<span class="badge">${x}</span>` : ''); const nSetup = typeof setupJobs === 'function' ? setupJobs().length : 0;
  const nOver = ron ? crList('crinv').filter((x) => !x.gone && crOverdue(x)).length : 0; const nPend = ron && crPerm('approve') ? crList('crinv').filter((x) => !x.gone && x.status === 'pending').length : 0;
  const nRec = 0;
  const mains = [['c', S.lastCTab || 'contacts', lab('cmain'), ICONS.contacts, n, ''], ...(bon ? [['b', 'book', lab('book'), BK_ICON, nb, '']] : []), ['t', 'texts', lab('texts'), ICONS.texts, nt, ''],
    ...(ron ? [['r', 'rec', lab('rec'), CR_ICON, nRec, 'recs'], ['i', 'rec', lab('inv'), T2_ICON.inv, 0, 'stock'], ['f', 'rec', lab('fin'), T2_ICON.fin, nOver + nPend, 'invs']] : []), ['s', 'settings', lab('settings'), ICONS.settings, nSetup, '']];
  mains.splice(0, mains.length, ...tabSort('main', mains, (m) => m[0]));
  const crBtn = ([k, l]) => `<button data-act="tab" data-v="rec" data-crpage="${k}" class="${S.tab === 'rec' && ((CR.page || 'recs') === k || (k === 'recs' && CR.page === 'edit') || (k === 'invs' && CR.page === 'inv')) ? 'on' : ''}"><span>${h(l)}</span>${k === 'overdue' ? badge(nOver) : k === 'invs' ? badge(nPend) : ''}</button>`;
  const subs = (g) => g === 'c' ? tabSort('c', CONTACT_TABS, (k) => k).map((k) => `<button data-act="tab" data-v="${k}" class="${S.tab === k ? 'on' : ''}">${ICONS[k] || ''}<span>${h(lab(k))}</span>${k === 'jobs' ? badge(n) : ''}</button>`).join('')
    : g === 'b' ? tabSort('b', BK_SUBS, (x) => x[0]).map(([k, l]) => `<button data-act="tab" data-v="book" data-bkpage="${k}" class="${S.tab === 'book' && (BK.page || 'cal') === k ? 'on' : ''}"><span>${l}</span>${k === 'jobs' ? badge(nb) : ''}</button>`).join('')
    : g === 't' ? tabSort('t', T2.comm.filter(([k]) => k !== 'mail' || ron), (x) => x[0]).map(([k, l]) => k === 'mail' ? crBtn([k, l]) : `<button data-act="tab" data-v="texts" data-txpage="${k}" class="${S.tab === 'texts' && TX.page === k && !TX.open ? 'on' : ''}"><span>${h(l)}</span>${k === 'unread' ? badge(nt) : ''}</button>`).join('')
    : g === 'r' ? tabSort('r', (typeof CR_SUBS !== 'undefined' ? CR_SUBS : []).filter(([k]) => T2.rec.includes(k)), (x) => x[0]).map(crBtn).join('')
    : g === 'i' ? tabSort('i', T2.inv, (x) => x[0]).map(crBtn).join('')
    : g === 'f' ? tabSort('f', T2.fin, (x) => x[0]).map(crBtn).join('')
    : tabSort('s', SET_SUBS, (x) => x[0]).filter(([k]) => k !== 'adminjobs' || (window.SBAuth && SBAuth.isAdmin && SBAuth.isAdmin()) || S.admin).map(([k, l]) => `<button data-act="tab" data-v="settings" data-setsub="${k}" class="${S.tab === 'settings' && (S.setSub || 'general') === k ? 'on' : ''}"><span>${h(setSubName(k))}</span>${k === 'adminjobs' ? badge(nSetup) : ''}</button>`).join('');
  const main = (m) => `<button data-act="tab" data-v="${m[1]}" ${m[0] === 's' ? `data-setsub="${S.setSub || 'general'}"` : ''}${m[5] ? ` data-crpage="${m[5]}"` : ''} class="${grp === m[0] ? 'on' : ''}">${m[3]}<span>${h(m[2])}</span>${grp === m[0] ? '' : badge(m[4])}</button>`;
  $('#tabs').innerHTML = `<div class="navm"><div class="mt">${mains.map(main).join('')}</div><div class="st">${subs(grp)}</div></div>
    <div class="navd">${mains.map((m) => main(m) + (grp === m[0] ? `<div class="sub">${subs(m[0])}</div>` : '')).join('')}</div>`; };
if (typeof tabLists === 'function') tabLists = (function (orig) { return function (all) { const L = orig.apply(this, arguments); const ron = typeof crOn === 'function' && crOn();
  L.main = [['c', lab('cmain')], ...(all || (typeof Bk !== 'undefined' && Bk.on()) ? [['b', lab('book')]] : []), ['t', lab('texts')], ...(all || ron ? [['r', lab('rec')], ['i', lab('inv')], ['f', lab('fin')]] : []), ['s', lab('settings')]];
  L.t = T2.comm; if (L.r) L.r = L.r.filter(([k]) => T2.rec.includes(k)); if (all || ron) { L.i = T2.inv; L.f = T2.fin; } return L; }; })(tabLists);
/* ---------- Communications → Search: texts and emails together ---------- */
const T2Q = { q: '', kind: 'all', rel: 'all' };
const T2_RECUSE = new Set(['results', 'statement', 'sharefarm', 'po', 'invoice', 'overdue']);
const T2_SMSREC = new Set(['booked', 'reminder', 'proposal']);
function t2Comms() { const out = [];
  (typeof smsLog === 'function' ? smsLog() : []).filter((x) => typeof smsOffice !== 'function' || smsOffice(x)).forEach((x) => { const key = smsKey(x); out.push({ at: x.at, kind: 'text', rel: T2_SMSREC.has(x.kind), who: smsKeyName(key), title: (SMS_KINDS[x.kind] || 'Text') + (x.kind === 'reply' ? ' (from them)' : ''), body: x.body || '', extra: x.phone || '', key, cid: x.contact_id, bid: x.business_id }); });
  const r = typeof emlRec === 'function' ? emlRec() : null; ((r && r.log) || []).forEach((x) => { const b = x.bid && IDX.biz.get(x.bid); out.push({ at: x.at, kind: 'email', rel: T2_RECUSE.has(x.use), who: b ? b.name : (x.to || []).slice(0, 3).join(', ') + (x.n ? ` (${x.n} clients)` : ''), title: (typeof EML_USES !== 'undefined' && EML_USES[x.use]) || 'Email', body: x.subject || '', extra: [(x.to || []).join(', '), (x.files || []).join(', ')].join(' '), bid: x.bid }); });
  return out.sort((a, b) => (b.at || 0) - (a.at || 0)); }
function t2SearchHtml() { const q = T2Q.q.trim().toLowerCase(); const L = t2Comms().filter((x) => (T2Q.kind === 'all' || x.kind === T2Q.kind) && (T2Q.rel === 'all' || (T2Q.rel === 'rec') === x.rel) && (!q || [x.who, x.title, x.body, x.extra].join(' ').toLowerCase().includes(q)));
  const chip = (k, v, l) => `<button class="btn small ${T2Q[k] === v ? 'primary' : ''}" data-act="t2-f" data-k="${k}" data-v="${v}">${l}</button>`;
  return `<div class="d-wrap bk-wrap"><h2 class="sec-h" style="font-size:26px">🔍 Search texts and emails</h2><div class="search" style="margin-bottom:8px"><input id="t2-q" type="search" placeholder="Search texts and emails" value="${h(T2Q.q)}"></div>
    <div class="actions" style="margin-bottom:4px">${chip('kind', 'all', 'Texts and emails')}${chip('kind', 'text', '📲 Texts')}${chip('kind', 'email', '📧 Emails')}${chip('kind', 'call', '📞 Calls')}</div><div class="actions" style="margin-bottom:8px">${chip('rel', 'all', 'Everything')}${chip('rel', 'gen', 'General')}${chip('rel', 'rec', 'About an appointment or record')}</div>
    <div class="hint" style="margin-bottom:6px">${L.length} found${L.length > 150 ? ' — showing the newest 150' : ''}. <b>About an appointment or record</b>: booking texts and reminders, results, statements, invoices, share-farm and purchase-order emails. <b>General</b>: everything else (texts you write, general and bulk emails, replies).</div>
    ${L.slice(0, 150).map((x) => `<div class="card t2row"><div class="kv" style="align-items:center"><div class="v"><b>${x.kind === 'email' ? '📧' : x.kind === 'call' ? '📞' : '📲'} ${h(x.who || '')}</b> <span class="hint">· ${h(x.title)} · ${typeof smsWhen === 'function' ? smsWhen(x.at) : new Date(x.at).toLocaleString('en-AU')}${x.rel ? ' · 🗂 record' : ''}</span><br>${h((x.body || '').slice(0, 220))}${(x.body || '').length > 220 ? '…' : ''}</div>${x.key ? `<button class="btn small" data-act="tx-goto" data-key="${h(x.key)}">Conversation</button>` : ''}${x.cid ? `<button class="btn small" data-act="open" data-kind="contact" data-id="${h(x.cid)}">Contact</button>` : ''}${x.bid ? `<button class="btn small" data-act="open" data-kind="business" data-id="${h(x.bid)}">Business</button>` : ''}</div></div>`).join('') || '<div class="card"><div class="hint">Nothing found.</div></div>'}</div>`; }
if (typeof smsTabHtml === 'function') smsTabHtml = (function (orig) { return function () { if (TX.page === 'csearch' && !TX.open) return t2SearchHtml(); return orig.apply(this, arguments); }; })(smsTabHtml);
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=t2-f]'); if (!el) return; e.stopPropagation(); T2Q[el.dataset.k] = el.dataset.v; renderAll(); }, true);
document.addEventListener('input', (e) => { if (e.target.id !== 't2-q') return; T2Q.q = e.target.value; clearTimeout(T2Q._t); T2Q._t = setTimeout(() => { const pos = e.target.selectionStart; renderAll(); const n = document.getElementById('t2-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } }, 250); });
/* business / contact pages: their emails too (the texts card is already there) */
function t2EmailCard(bid) { const r = typeof emlRec === 'function' ? emlRec() : null; const L = ((r && r.log) || []).filter((x) => x.bid === bid).slice(-30).reverse(); if (!L.length) return '';
  return `<div class="card t2emails"><h3><span class="sp">📧 Emails sent</span></h3>${L.map((x) => `<div class="kv"><div class="k">${typeof smsWhen === 'function' ? smsWhen(x.at) : ''}</div><div class="v"><b>${h(x.subject || '')}</b><br><span class="hint">${h((typeof EML_USES !== 'undefined' && EML_USES[x.use]) || 'Email')}${T2_RECUSE.has(x.use) ? ' · 🗂 record' : ''} · ${h((x.to || []).join(', '))}${(x.files || []).length ? ' · 📎 ' + h(x.files.join(', ')) : ''}</span></div></div>`).join('')}</div>`; }
if (typeof bizDetail === 'function') bizDetail = (function (orig) { return function (b) { const html = orig.apply(this, arguments); const c = t2EmailCard(b.id); if (!c) return html; const at = html.indexOf('<div class="card"><h3><span class="sp">General info'); return at > 0 ? html.slice(0, at) + c + html.slice(at) : html + c; }; })(bizDetail);
/* "go there" links know the new tabs */
if (typeof NAV_MAIN !== 'undefined') { NAV_MAIN.communications = 'texts'; NAV_MAIN.inventory = 'rec'; NAV_MAIN.finance = 'rec'; }
if (typeof navGo === 'function') navGo = (function (orig) { return function (path) { const seg = String(path).split(/\s*→\s*/).map((x) => x.replace(/^[^\p{L}]+/u, '').trim().toLowerCase());
  const pg = { inventory: { stock: 'stock', 'price lists': 'prods', 'price list': 'prods', '': 'stock' }, finance: { invoices: 'invs', statements: 'stmts', overdue: 'overdue', '': 'invs' } }[seg[0]];
  if (pg) { const k = pg[seg[1] || ''] || pg['']; return orig.call(this, 'Records → ' + ((CR_SUBS.find((x) => x[0] === k) || [])[1] || 'Stock') + (seg.length > 2 ? ' → ' + String(path).split(/\s*→\s*/).slice(2).join(' → ') : '')); }
  if (seg[0] === 'communications') { if (seg[1] === 'emails') return orig.call(this, 'Records → Emails'); if (/follow/.test(seg[1] || '')) return orig.call(this, 'Records → Follow-ups'); S.tab = 'texts'; TX.open = null; TX.page = seg[1] === 'search' ? 'csearch' : /call/.test(seg[1] || '') ? 'calls' : 'texts'; if (typeof SHEET !== 'undefined' && SHEET) closeSheet(); renderAll(); return true; }
  return orig.apply(this, arguments); }; })(navGo);
(function () { const st = document.createElement('style'); st.textContent = '.t2row .v{word-break:break-word}'; document.head.appendChild(st); })();
window.t2Comms = t2Comms; window.t2Grp = t2Grp;
