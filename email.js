/* Bovitech Super App — Emails: editable templates (Settings → Email templates), the email composer, and bulk emails.
   • Templates: subject, body with {fill-ins}, CC, compulsory fields (asked before sending), practice footer.
   • Composer: recipients from the business and its contacts (tick), extra addresses (offered to be saved on a contact),
     attachments you can open to check, live preview, sends through the "mail" function (Resend for now).
   • Bulk: pick clients (all active / bulk lists / hand-picked), promotional emails get an unsubscribe line and skip unsubscribed clients.
   • Purchase orders, statements and share-farm invoices use their templates too. */

const EML_USES = { po: 'Purchase orders', statement: 'Statements', sharefarm: 'Share-farm invoices', results: 'Results', general: 'General client emails', bulk: 'Bulk emails' };
const EML_FILLS = {
  all: ['first name', 'client name', 'staff name', 'practice name', 'practice phone', 'today'],
  po: ['supplier name', 'PO number', 'order table', 'order total', 'supplier wording', 'note'],
  statement: ['statement period', 'amount owing', 'statement'],
  sharefarm: ['share farm', 'invoice number', 'invoice total', 'share percent', 'amount due', 'pay days', 'invoice'],
  results: ['appointment date', 'appointment type', 'vet name', 'results for'],
  general: ['appointment date', 'appointment type', 'vet name'],
  bulk: [],
};
const EML_REQ_TYPES = { text: 'Type an answer', appt: 'Choose an appointment', files: 'Attach at least one file' };
const EML_DEFAULTS = [
  { id: 'et-po', use: 'po', name: 'Purchase order', cc: 'office@bovitech.com.au', subject: 'Purchase order {PO number} — Bovitech Veterinary Services',
    body: 'Hi {supplier name},\n\nPlease supply the following:\n\n{order table}\n\n{supplier wording}\n{note}\n\nPlease deliver to 317 Gull Rock Road, Kalgan WA 6330 and quote PO {PO number} on your invoice.\n\nThank you,\n{staff name}\nBovitech Veterinary Services', req: [] },
  { id: 'et-stm', use: 'statement', name: 'Statement', cc: 'office@bovitech.com.au', subject: 'Statement — Bovitech Veterinary Services — {statement period}',
    body: 'Hi {first name},\n\nPlease find your statement of account for {statement period} below. The amount owing is {amount owing}.\n\nIf you have any questions, please call us on {practice phone}.\n\nKind regards,\nBovitech Veterinary Services\n\n{statement}', req: [] },
  { id: 'et-sf', use: 'sharefarm', name: 'Share-farm invoice', cc: 'office@bovitech.com.au', subject: 'Invoice {invoice number} — {share farm} share farm — Bovitech Veterinary Services',
    body: 'Hi {client name},\n\nPlease find invoice {invoice number} for the {share farm} share farm below. The whole invoice is {invoice total} (inc GST); your share is {share percent}, so the amount due from you is {amount due} (inc GST). Payment is due within {pay days} days.\n\nKind regards,\nBovitech Veterinary Services\n\n{invoice}', req: [] },
  { id: 'et-res', use: 'results', name: 'Results', cc: 'office@bovitech.com.au', subject: '{results for} results — {client name}',
    body: 'Hi {first name},\n\nPlease find attached the {results for} results from our visit on {appointment date} ({appointment type}).\n\nPlease give us a call on {practice phone} if you would like to discuss them.\n\nKind regards,\n{staff name}\nBovitech Veterinary Services',
    req: [{ type: 'text', label: 'What are the results for?', name: 'results for' }, { type: 'appt', label: 'Which appointment?', name: 'appointment' }, { type: 'files', label: 'Attach the results', name: '' }] },
  { id: 'et-gen', use: 'general', name: 'General email', cc: '', subject: '',
    body: 'Hi {first name},\n\n\n\nKind regards,\n{staff name}\nBovitech Veterinary Services', req: [] },
  { id: 'et-bulk', use: 'bulk', name: 'Bulk email', cc: '', subject: '',
    body: 'Hi {first name},\n\n\n\nKind regards,\nThe team at Bovitech Veterinary Services', req: [] },
];
const EML_FOOT_DEF = 'Bovitech Veterinary Services · PO Box 7011, Lower King WA 6330 · 0499 489 919 · office@bovitech.com.au · www.bovitech.com.au';

/* ---------------- stored settings ---------------- */
function emlRec() { let r = crCfg('emltpls'); return r || null; }
function emlRecW() { let r = crCfg('emltpls'); if (!r) { r = { id: 'emltpls', cfg: 'emltpls', list: bkClone(EML_DEFAULTS), footer: EML_FOOT_DEF, unsub: [], log: [] }; crList('crcfg').push(r); } return r; }
function emlTpls() { const r = emlRec(); return (r && r.list) || EML_DEFAULTS; }
function emlTpl(id) { return emlTpls().find((t) => t.id === id); }
function emlFor(use) { return emlTpls().filter((t) => t.use === use); }
function emlFooter() { const r = emlRec(); return r && r.footer != null ? r.footer : EML_FOOT_DEF; }
function emlUnsub() { const r = emlRec(); return new Set((r && r.unsub) || []); }
function emlSave(fn) { const r = emlRecW(); fn(r); touch(r); save(); if (typeof Sync !== 'undefined') Sync.soon(); }
function emlLog(x) { emlSave((r) => { r.log = [...(r.log || []).slice(-400), { at: Date.now(), by: crMe(), ...x }]; }); }
const emlCanEdit = () => (typeof crPerm === 'function' ? crPerm('settings') || crPerm('approve') : true);

/* ---------------- filling in ---------------- */
const emlEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function emlMe() { const s = (typeof SBAuth !== 'undefined' && SBAuth.staff) || {}; return { name: (typeof niceName === 'function' ? niceName(s.preferred_name || s.full_name || '') : s.preferred_name || s.full_name || ''), full: s.full_name || '' }; }
function emlBase(o) { const me = emlMe(); return { 'staff name': me.name, 'staff full name': me.full, 'practice name': 'Bovitech Veterinary Services', 'practice phone': '0499 489 919', today: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }), ...(o || {}) }; }
/* text with {fill-ins} → { text, html }. Values ending in "html" are given as { text, html } (tables, documents). */
function emlFill(s, V) {
  const miss = [];
  const one = (k, asHtml) => { const v = V[k] != null ? V[k] : V[Object.keys(V).find((x) => x.toLowerCase() === k.toLowerCase())]; if (v == null || v === '') { if (!(k.toLowerCase() in EML_OPTIONAL)) miss.push(k); return ''; } if (typeof v === 'object') return asHtml ? v.html : v.text; return asHtml ? emlEsc(v) : String(v); };
  const text = String(s || '').replace(/\{([^{}]{1,40})\}/g, (m, k) => one(k.trim(), false)).replace(/\n{3,}/g, '\n\n');
  const html = emlEsc(String(s || '')).replace(/\{([^{}]{1,40})\}/g, (m, k) => `\u0000${k.trim()}\u0000`).split('\n').join('<br>').replace(/\u0000([^\u0000]+)\u0000/g, (m, k) => one(k.replace(/&amp;/g, '&'), true)).replace(/(<br>){3,}/g, '<br><br>');
  return { text, html, miss: [...new Set(miss)] };
}
const EML_OPTIONAL = { 'supplier wording': 1, note: 1, 'first name': 1 };
function emlWrapHtml(bodyHtml, foot, extra) { return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#141414">${bodyHtml}${extra || ''}${foot ? `<hr style="border:none;border-top:1px solid #ddd;margin:18px 0 8px"><div style="font-size:12px;color:#666">${emlEsc(foot)}</div>` : ''}</div>`; }

/* ---------------- recipients ---------------- */
function emlPeople(bid, use) { // [{ v, who, own: 'biz'|cid, inv }]
  const b = bid && IDX.biz.get(bid); if (!b) return []; const out = []; const seen = new Set();
  const add = (v, who, own, inv, gen) => { const k = (v || '').trim().toLowerCase(); if (!k || seen.has(k)) return; seen.add(k); out.push({ v: v.trim(), who, own, inv, gen }); };
  (b.emails || []).forEach((e) => add(e.value, b.name, 'biz', emailUse(e).includes('invoice'), emailUse(e).includes('general')));
  (IDX.bizContacts.get(b.id) || []).forEach((c) => (c.emails || []).forEach((e) => add(e.value, fullName(c), c.id, false, true)));
  return out;
}
function emlFirstName(bid, toList) { const b = IDX.biz.get(bid); const cs = b ? IDX.bizContacts.get(b.id) || [] : []; for (const t of toList) { const c = cs.find((x) => (x.emails || []).some((e) => (e.value || '').trim().toLowerCase() === t.toLowerCase())); if (c && c.first) return c.first; } const pc = b && b.primary && cs.find((x) => x.id === b.primary); return (pc && pc.first) || (cs.length === 1 ? cs[0].first : '') || 'there'; }
function emlAppts(bid) { if (typeof Bk === 'undefined') return []; return Bk.list('bookings').filter((x) => x.bid === bid && Bk.live(x) && !x.proposal).sort((a, c) => c.date.localeCompare(a.date)).slice(0, 40); }
const emlApptLabel = (x) => `${bkDate(x.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${Bk.type(x.type).name}${(x.staff || []).length ? ' · ' + x.staff.map(Bk.pname).join(', ') : ''}`;

/* ---------------- attachments ---------------- */
const EML_MAXMB = 15;
function emlFileToAtt(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ name: f.name, type: f.type || 'application/octet-stream', size: f.size, b64: String(r.result).split(',')[1], url: URL.createObjectURL(f) }); r.onerror = () => rej(r.error); r.readAsDataURL(f); }); }
const emlKb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

/* ---------------- sending ---------------- */
async function emlPost(m) { // m: { to[], cc[], subject, html, text, atts[], unsub }
  try { const r = await sbFetch('/functions/v1/mail', { method: 'POST', body: JSON.stringify({ k: Dev.k(), to: m.to, cc: m.cc, subject: m.subject, html: m.html, text: m.text, attachments: (m.atts || []).map((a) => ({ filename: a.name, content: a.b64 })), unsub: !!m.unsub }) }); if (r.ok) return { ok: true }; let j = {}; try { j = await r.json(); } catch (e) { } return { ok: false, err: j.error || 'error ' + r.status }; }
  catch (e) { return { ok: false, err: e.message || String(e) }; }
}
/* build an email from a template without asking anything (bulk sends: statements, share farms) */
function emlBuild(tplId, use, V, o = {}) {
  const t = emlTpl(tplId) || emlFor(use)[0] || EML_DEFAULTS.find((x) => x.use === use); const vals = emlBase(V);
  const sub = emlFill(t.subject, vals), body = emlFill(t.body, vals); const foot = emlFooter();
  return { t, subject: sub.text.trim(), html: emlWrapHtml(body.html, foot, o.extraHtml), text: body.text + (foot ? '\n\n— ' + foot : ''), cc: (t.cc || '').split(/[,;\s]+/).filter((x) => /@/.test(x)) };
}

/* ---------------- the composer ---------------- */
let EML = null;
/* o: { use | uses[], tpl, bid, rec, V (fill-in values), to[] (preset), invOnly, atts[], onSent(info), title } */
async function emlCompose(o) {
  const uses = o.uses || [o.use]; const list = emlTpls().filter((t) => uses.includes(t.use)); if (!list.length) { toast('No email template for this yet — add one in Settings → Email templates'); return; }
  const t0 = (o.tpl && emlTpl(o.tpl)) || list[0]; const ppl = emlPeople(o.bid, t0.use);
  const gen = ppl.filter((p) => p.gen && p.own === 'biz'); const def = o.invOnly ? ppl.filter((p) => p.inv) : gen.length ? gen : ppl.filter((p) => p.gen).slice(0, 1);
  const pre = new Set((o.to || def.map((p) => p.v)).map((x) => String(x).toLowerCase()));
  EML = { o, tpl: t0.id, atts: [...(o.atts || [])], extra: [] };
  const b = o.bid && IDX.biz.get(o.bid);
  const body = `<div class="f"><label for="em-tpl">Template</label><select id="em-tpl">${list.map((t) => `<option value="${t.id}" ${t.id === t0.id ? 'selected' : ''}>${h(t.name)}${uses.length > 1 ? ' (' + h(EML_USES[t.use]) + ')' : ''}</option>`).join('')}</select></div>
    <div class="f"><label>To</label><div class="checks" id="em-tolist" style="flex-direction:column;align-items:flex-start">${ppl.map((p, i) => `<label><input type="checkbox" data-emto="${h(p.v)}" ${pre.has(p.v.toLowerCase()) ? 'checked' : ''}> ${h(p.v)} <span class="hint">— ${h(p.who)}${p.inv ? ' · 🧾 invoices' : ''}</span></label>`).join('') || `<span class="hint">${b ? h(b.name) + ' has no email addresses saved yet.' : ''}</span>`}
      ${(o.to || []).filter((x) => !ppl.some((p) => p.v.toLowerCase() === String(x).toLowerCase())).map((x) => `<label><input type="checkbox" data-emto="${h(x)}" checked> ${h(x)}</label>`).join('')}</div>
      <div class="bk-hrow" style="margin-top:6px"><input id="em-add" type="email" autocomplete="off" aria-label="Add another email address" style="flex:1;padding:8px;border:1px solid var(--line);border-radius:8px"><button type="button" class="btn small" data-act="em-addto">➕ Add</button></div><div class="hint">Add another address — you'll be asked whether to save it on a contact.</div></div>
    <div class="f"><label for="em-cc">CC (copy to)</label><input id="em-cc" type="text" value="${h(t0.cc || '')}"></div>
    <div id="em-req"></div>
    <div class="f"><label for="em-sub">Subject</label><input id="em-sub" type="text" value="${h(t0.subject || '')}"></div>
    <div class="f"><label for="em-body">Message</label>${emlFillBtns(t0.use, 'em-body')}<textarea id="em-body" rows="10">${h(t0.body || '')}</textarea><div class="hint">Words in {curly brackets} are filled in automatically — see the preview below.</div></div>
    <div class="f"><label>Attachments</label><div id="em-atts"></div><label class="btn small" style="margin-top:4px">📎 Attach files<input type="file" id="em-file" multiple style="display:none"></label></div>
    <div class="f"><label>Preview</label><div id="em-prev" class="card" style="margin:0;max-height:340px;overflow:auto;background:#fff"></div></div>`;
  openSheet(o.title || (b ? 'Email ' + b.name : 'New email'), body, emlSendFromSheet);
  const sv = document.getElementById('sheet-save'); if (sv) sv.textContent = '📧 Send';
  emlDrawReq(); emlDrawAtts(); emlPreview();
}
function emlFillBtns(use, target) { const f = [...EML_FILLS.all, ...(EML_FILLS[use] || [])]; return `<div class="em-fills" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">${f.map((k) => `<button type="button" class="btn small" data-act="em-fill" data-k="${h(k)}" data-t="${target}" style="padding:2px 8px;font-size:12px">{${h(k)}}</button>`).join('')}</div>`; }
function emlCurTpl() { return emlTpl(EML.tpl) || EML_DEFAULTS[0]; }
function emlDrawReq() {
  const box = document.getElementById('em-req'); if (!box) return; const t = emlCurTpl(); const prev = EML.reqVals || {};
  box.innerHTML = (t.req || []).map((q, i) => {
    if (q.type === 'text') return `<div class="f"><label for="em-q${i}">${h(q.label)} <span style="color:var(--red)">*</span></label><input id="em-q${i}" data-emq="${i}" type="text" value="${h(prev[i] || '')}"></div>`;
    if (q.type === 'appt') { const A = emlAppts(EML.o.bid); return `<div class="f"><label for="em-q${i}">${h(q.label)} <span style="color:var(--red)">*</span></label><select id="em-q${i}" data-emq="${i}"><option value="">Choose…</option>${A.map((x) => `<option value="${x.id}" ${prev[i] === x.id || (!prev[i] && EML.o.appt === x.id) ? 'selected' : ''}>${h(emlApptLabel(x))}</option>`).join('')}</select>${A.length ? '' : '<div class="hint">No appointments for this client yet.</div>'}</div>`; }
    if (q.type === 'files') return `<div class="hint" style="margin:-2px 0 8px">📎 <b>${h(q.label || 'Attach a file')}</b> <span style="color:var(--red)">*</span> — required before sending.</div>`;
    return ''; }).join('');
}
function emlReqVals() { const t = emlCurTpl(); const V = {}; const R = {}; (t.req || []).forEach((q, i) => { const el = document.getElementById('em-q' + i); const v = el ? el.value : ''; R[i] = v;
  if (q.type === 'appt') { const x = v && Bk.list('bookings').find((y) => y.id === v); if (x) { V['appointment date'] = bkDate(x.date, { day: 'numeric', month: 'long', year: 'numeric' }); V['appointment type'] = Bk.type(x.type).name; V['vet name'] = (x.staff || []).map(Bk.pname).join(' and '); } }
  else if (q.type === 'text' && q.name) V[q.name] = v.trim(); }); EML.reqVals = R; return V; }
function emlToList() { return [...document.querySelectorAll('[data-emto]:checked')].map((el) => el.dataset.emto); }
function emlValues() { const o = EML.o; const to = emlToList(); const V = emlBase({ 'client name': o.bid ? (IDX.biz.get(o.bid) || {}).name || '' : '', 'first name': o.bid ? emlFirstName(o.bid, to) : 'there', ...(o.V || {}), ...emlReqVals() });
  if (o.rec && !V['appointment date']) { const r = crGet('crrec', o.rec); if (r) { V['appointment date'] = bkDate(r.date, { day: 'numeric', month: 'long', year: 'numeric' }); V['appointment type'] = Bk.type(r.type).name; V['vet name'] = (r.staff || []).map(Bk.pname).join(' and '); } }
  return V; }
function emlPreview() { const el = document.getElementById('em-prev'); if (!el || !EML) return; const V = emlValues(); const s = emlFill(document.getElementById('em-sub').value, V), b = emlFill(document.getElementById('em-body').value, V);
  el.innerHTML = `<div class="hint">To: ${h(emlToList().join(', ') || '—')}</div><div style="font-weight:700;margin:4px 0 8px">${h(s.text || '(no subject)')}</div>${emlWrapHtml(b.html, emlFooter(), EML.o.extraHtml)}${EML.atts.length ? `<div class="hint" style="margin-top:6px">📎 ${EML.atts.map((a) => h(a.name)).join(', ')}</div>` : ''}${[...s.miss, ...b.miss].length ? `<div class="hint" style="color:var(--red);margin-top:6px">Still to fill in: ${[...new Set([...s.miss, ...b.miss])].map((k) => '{' + h(k) + '}').join(', ')}</div>` : ''}`; }
function emlDrawAtts() { const el = document.getElementById('em-atts'); if (!el) return; const tot = EML.atts.reduce((s, a) => s + (a.size || 0), 0);
  el.innerHTML = EML.atts.map((a, i) => `<div class="kv" style="align-items:center"><div class="v">📄 ${h(a.name)} <span class="hint">${emlKb(a.size || 0)}</span></div><button type="button" class="btn small" data-act="em-view" data-i="${i}">👁 View</button><button type="button" class="btn small" data-act="em-rm" data-i="${i}" aria-label="Remove ${h(a.name)}">✕</button></div>`).join('') + (EML.atts.length ? `<div class="hint">${emlKb(tot)} of ${EML_MAXMB} MB</div>` : ''); }
async function emlSendFromSheet() {
  const t = emlCurTpl(); const to = emlToList(); if (!to.length) { toast('Tick or add who it\'s going to'); return false; }
  const V = emlValues(); for (const [i, q] of (t.req || []).entries()) { const el = document.getElementById('em-q' + i); if ((q.type === 'text' || q.type === 'appt') && !(el && el.value.trim())) { toast('Fill in: ' + q.label); el && el.focus(); return false; } if (q.type === 'files' && !EML.atts.length) { toast(q.label || 'Attach a file first'); return false; } }
  const s = emlFill(document.getElementById('em-sub').value, V), b = emlFill(document.getElementById('em-body').value, V); if (!s.text.trim()) { toast('Add a subject'); return false; }
  const miss = [...new Set([...s.miss, ...b.miss])]; if (miss.length && !(await ask(`These haven't got anything to fill them in, so they'll be left blank: ${miss.map((k) => '{' + k + '}').join(', ')}. Send anyway?`, 'Send anyway'))) return false;
  if (EML.atts.reduce((x, a) => x + (a.size || 0), 0) > EML_MAXMB * 1048576) { toast(`Attachments are over ${EML_MAXMB} MB — remove some`); return false; }
  const cc = document.getElementById('em-cc').value.split(/[,;\s]+/).filter((x) => /@/.test(x)); const foot = emlFooter();
  const sv = document.getElementById('sheet-save'); if (sv) { sv.disabled = true; sv.textContent = 'Sending…'; }
  const r = await emlPost({ to, cc, subject: s.text.trim(), html: emlWrapHtml(b.html, foot, EML.o.extraHtml), text: b.text + (EML.o.extraText ? '\n\n' + EML.o.extraText : '') + (foot ? '\n\n— ' + foot : ''), atts: EML.atts });
  if (sv) { sv.disabled = false; sv.textContent = '📧 Send'; }
  if (!r.ok) { const mt = `mailto:${to.map(encodeURIComponent).join(',')}?${cc.length ? 'cc=' + encodeURIComponent(cc.join(',')) + '&' : ''}subject=${encodeURIComponent(s.text.trim())}&body=${encodeURIComponent(b.text + (EML.o.extraText ? '\n\n' + EML.o.extraText : ''))}`;
    if (await ask(`The app couldn't send it (${r.err}). Open it in your own email instead?${EML.atts.length ? ' (You\'ll need to attach the files yourself.)' : ''}`, 'Open in my email')) { location.href = mt; } else return false; }
  emlLog({ use: t.use, tpl: t.id, to, subject: s.text.trim(), bid: EML.o.bid || null, files: EML.atts.map((a) => a.name), via: r.ok ? 'app' : 'own email' });
  const o = EML.o; const extra = to.filter((x) => !emlPeople(o.bid).some((p) => p.v.toLowerCase() === x.toLowerCase()));
  setTimeout(async () => { if (r.ok) toast('📧 Sent to ' + to.join(', ')); if (o.onSent) await o.onSent({ to, ok: r.ok }); for (const x of extra) await emlOfferSave(o.bid, x); renderAll(); }, 50);
  return true;
}
async function emlOfferSave(bid, addr) { const b = bid && IDX.biz.get(bid); if (!b) return; const cs = IDX.bizContacts.get(b.id) || [];
  const ok = await askBox(`Save ${addr}?`, `<p>Add this email address to someone's page so it's there next time?</p><div class="checks" style="flex-direction:column;align-items:flex-start"><label><input type="radio" name="em-sv" data-ask="who" value="" checked> Don't save it</label><label><input type="radio" name="em-sv" data-ask="who" value="biz"> ${h(b.name)} (business)</label>${cs.map((c) => `<label><input type="radio" name="em-sv" data-ask="who" value="${c.id}"> ${h(fullName(c))}</label>`).join('')}</div>`, 'OK', false, 'Cancel');
  if (!ok || !ASK_FORM.who) return; if (ASK_FORM.who === 'biz') { b.emails = [...(b.emails || []), { value: addr, use: ['general'] }]; touch(b); } else { const c = D.contacts.find((x) => x.id === ASK_FORM.who); if (!c) return; c.emails = [...(c.emails || []), { value: addr, label: '' }]; touch(c); }
  if (typeof reindex === 'function') reindex(); save(); if (typeof Sync !== 'undefined') Sync.soon(); toast('✓ Saved ' + addr); }

/* ---------------- events ---------------- */
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^em-|^eml/.test(a)) return; const d = el.dataset;
  if (a === 'em-fill') { const ta = document.getElementById(d.t); if (!ta) return; const s = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? s; const ins = '{' + d.k + '}'; ta.value = ta.value.slice(0, s) + ins + ta.value.slice(en); ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length; ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
  if (a === 'em-addto') { const inp = document.getElementById('em-add'); const v = (inp.value || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast('Type a full email address'); return; } if (![...document.querySelectorAll('[data-emto]')].some((x) => x.dataset.emto.toLowerCase() === v.toLowerCase())) { const lb = document.createElement('label'); lb.innerHTML = `<input type="checkbox" data-emto="${h(v)}" checked> ${h(v)} <span class="hint">— added</span>`; document.getElementById('em-tolist').appendChild(lb); } inp.value = ''; emlPreview(); return; }
  if (a === 'em-view') { const x = EML.atts[+d.i]; if (x) window.open(x.url || ('data:' + x.type + ';base64,' + x.b64), '_blank'); return; }
  if (a === 'em-rm') { EML.atts.splice(+d.i, 1); emlDrawAtts(); emlPreview(); return; }
  if (a === 'eml-compose') { emlCompose({ uses: ['results', 'general'], bid: d.bid || null, rec: d.rec || null, tpl: d.tpl || null }); return; }
  if (a === 'eml-tpl-new' || a === 'eml-tpl-edit') { if (!emlCanEdit()) return; emlTplEdit(a === 'eml-tpl-edit' ? emlTpl(d.id) : null, d.use); return; }
  if (a === 'eml-foot') { if (!emlCanEdit()) return; openSheet('Email footer', `<div class="f"><label for="eml-foot">Shown at the bottom of every email</label><textarea id="eml-foot" rows="3">${h(emlFooter())}</textarea><div class="hint">Leave it empty for no footer.</div></div>`, () => { emlSave((r) => { r.footer = document.getElementById('eml-foot').value.trim(); }); setTimeout(renderAll, 0); return true; }); return; }
  if (a === 'eml-reqadd') { const box = document.getElementById('etq-list'); box.insertAdjacentHTML('beforeend', emlReqRow({ type: 'text', label: '', name: '' }, box.children.length)); return; }
  if (a === 'eml-reqrm') { el.closest('.etq-row').remove(); return; }
  if (a === 'eml-past') { emlPastIdeas(); return; }
  if (a === 'eml-pastuse') { const ta = document.getElementById('et-body'); const x = (EML_PAST || [])[+d.i]; if (ta && x) { ta.value = x; ta.dispatchEvent(new Event('input', { bubbles: true })); toast('Copied into the message — change the details into {fill-ins}'); } return; }
  if (a === 'eml-sup') { emlSupWording(d.bid); return; }
  if (a === 'eml-bulk') { emlBulk(); return; }
  if (a === 'eml-unsub-rm') { emlSave((r) => { r.unsub = (r.unsub || []).filter((x) => x !== d.bid); }); renderAll(); return; }
  if (a === 'eml-unsub-add') { const nm = (document.getElementById('eml-unsub-q').value || '').trim().toLowerCase(); const b = D.businesses.find((x) => !x.gone && (x.name || '').toLowerCase() === nm); if (!b) { toast('Choose the client from the list'); return; } emlSave((r) => { r.unsub = [...new Set([...(r.unsub || []), b.id])]; }); renderAll(); return; }
  if (a === 'eml-bk-all' || a === 'eml-bk-none') { document.querySelectorAll('[data-ebk]').forEach((x) => { if (x.closest('label').style.display !== 'none') x.checked = a === 'eml-bk-all'; }); emlBulkCount(); return; }
});
document.addEventListener('input', (e) => { const t = e.target; if (!t) return; if (EML && t.closest && t.closest('#sheet') && (t.id === 'em-sub' || t.id === 'em-body' || t.dataset.emq != null)) emlPreview(); if (t.id === 'ebk-q') emlBulkFilter(); if (t.id === 'et-body' || t.id === 'et-sub') emlTplPreview(); });
document.addEventListener('change', async (e) => { const t = e.target; if (!t) return;
  if (t.id === 'em-tpl' && EML) { const n = emlTpl(t.value); if (!n) return; const sub = document.getElementById('em-sub'), bd = document.getElementById('em-body'); const old = emlCurTpl();
    if ((sub.value !== (old.subject || '') || bd.value !== (old.body || '')) && !(await ask('Switch template? Your changes to the subject and message will be replaced.', 'Switch'))) { t.value = EML.tpl; return; }
    EML.tpl = n.id; sub.value = n.subject || ''; bd.value = n.body || ''; document.getElementById('em-cc').value = n.cc || ''; const fb = document.querySelector('#sheet .em-fills'); if (fb) fb.outerHTML = emlFillBtns(n.use, 'em-body'); emlDrawReq(); emlPreview(); return; }
  if (t.id === 'em-file' && EML) { for (const f of t.files) { try { EML.atts.push(await emlFileToAtt(f)); } catch (x) { toast('Couldn\'t read ' + f.name); } } t.value = ''; emlDrawAtts(); emlPreview(); return; }
  if (t.dataset && (t.dataset.emto != null || t.dataset.emq != null) && EML) { emlPreview(); return; }
  if (t.dataset && t.dataset.ebk != null) { emlBulkCount(); return; }
  if (t.id === 'ebk-pick') { emlBulkPick(t.value); return; }
  if (t.id === 'et-use') { const fb = document.querySelector('#sheet .em-fills'); if (fb) fb.outerHTML = emlFillBtns(t.value, 'et-body'); }
});
/* drag files onto the composer */
document.addEventListener('dragover', (e) => { if (EML && e.target.closest && e.target.closest('#sheet') && document.getElementById('em-atts')) e.preventDefault(); });
document.addEventListener('drop', async (e) => { if (!EML || !(e.target.closest && e.target.closest('#sheet')) || !document.getElementById('em-atts')) return; const f = e.dataTransfer && e.dataTransfer.files; if (!f || !f.length) return; e.preventDefault(); for (const x of f) EML.atts.push(await emlFileToAtt(x)); emlDrawAtts(); emlPreview(); });

/* ---------------- Settings → Email templates ---------------- */
function emlSettingsCard() {
  const ed = emlCanEdit(); const T = emlTpls(); const sups = D.businesses.filter((b) => !b.gone && b.poText);
  return `<div class="card"><h3><span class="sp">Email templates</span>${ed ? '<button class="btn small" data-act="eml-tpl-new">➕ New</button>' : ''}</h3><div class="hint" style="margin-bottom:6px">The wording of every email the app sends. Words in {curly brackets} are filled in automatically. Compulsory questions are asked before the email can be sent.</div>
    ${Object.entries(EML_USES).map(([u, l]) => { const xs = T.filter((t) => t.use === u); return `<div class="lbl" style="margin-top:8px">${h(l)}</div>${xs.map((t) => `<div class="kv ${ed ? 'bk-tap' : ''}" ${ed ? `data-act="eml-tpl-edit" data-id="${t.id}"` : ''}><div class="v"><b>${h(t.name)}</b><br><span class="hint">${h(t.subject || '(subject typed each time)')}${(t.req || []).length ? ' · asks: ' + h(t.req.map((q) => q.label).join(', ')) : ''}${t.cc ? ' · CC ' + h(t.cc) : ''}</span></div></div>`).join('') || '<div class="hint">None.</div>'}`; }).join('')}
    <div class="lbl" style="margin-top:10px">Footer</div><div class="kv ${ed ? 'bk-tap' : ''}" ${ed ? 'data-act="eml-foot"' : ''}><div class="v">${h(emlFooter() || '(no footer)')}</div></div>
    <div class="lbl" style="margin-top:10px">Supplier wording on purchase orders</div><div class="hint">Extra wording for one supplier (account number, delivery instructions) — fills in {supplier wording}. Set it when sending an order, or here.</div>
    ${sups.map((b) => `<div class="kv ${ed ? 'bk-tap' : ''}" ${ed ? `data-act="eml-sup" data-bid="${b.id}"` : ''}><div class="v"><b>${h(b.name)}</b><br><span class="hint">${h(b.poText)}</span></div></div>`).join('') || '<div class="hint">None yet.</div>'}
    ${ed ? `<div class="bk-hrow" style="margin-top:6px"><input id="eml-sup-q" list="eml-suplist" autocomplete="off" aria-label="Supplier" style="flex:1;padding:8px;border:1px solid var(--line);border-radius:8px"><datalist id="eml-suplist">${D.businesses.filter((b) => !b.gone && !isClientBiz(b)).map((b) => `<option value="${h(b.name)}">`).join('')}</datalist><button class="btn small" data-act="eml-sup">➕ Add wording</button></div>` : ''}</div>`;
}
function emlSupWording(bid) { let b = bid && IDX.biz.get(bid); if (!b) { const nm = ((document.getElementById('eml-sup-q') || {}).value || '').trim().toLowerCase(); b = D.businesses.find((x) => !x.gone && (x.name || '').toLowerCase() === nm); if (!b) { toast('Choose the supplier from the list'); return; } }
  openSheet('Purchase order wording — ' + b.name, `<div class="f"><label for="eml-supt">Extra wording on orders to ${h(b.name)}</label><textarea id="eml-supt" rows="4">${h(b.poText || '')}</textarea><div class="hint">Fills in {supplier wording} in the purchase order template. Leave empty to remove.</div></div>`, () => { const v = document.getElementById('eml-supt').value.trim(); if (v) b.poText = v; else delete b.poText; touch(b); save(); Sync.soon(); setTimeout(renderAll, 0); return true; }); }
function emlReqRow(q, i) { return `<div class="etq-row bk-hrow" style="flex-wrap:wrap;gap:6px;margin:4px 0;padding:6px;border:1px solid var(--line);border-radius:8px"><select data-etq="type" aria-label="Kind of question">${Object.entries(EML_REQ_TYPES).map(([k, l]) => `<option value="${k}" ${q.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select><input data-etq="label" value="${h(q.label || '')}" aria-label="Question" style="flex:1;min-width:160px;padding:6px;border:1px solid var(--line);border-radius:6px"><input data-etq="name" value="${h(q.name || '')}" aria-label="Fill-in name (for typed answers)" style="width:140px;padding:6px;border:1px solid var(--line);border-radius:6px"><button type="button" class="btn small" data-act="eml-reqrm" aria-label="Remove question">✕</button></div>`; }
function emlTplEdit(t, use) {
  const isNew = !t; t = t ? bkClone(t) : { id: uid('et'), use: use || 'general', name: '', cc: '', subject: '', body: 'Hi {first name},\n\n\n\nKind regards,\n{staff name}\nBovitech Veterinary Services', req: [] };
  const dflt = EML_DEFAULTS.find((x) => x.id === t.id);
  openSheet(isNew ? 'New email template' : 'Email template — ' + t.name, `<div class="grid2"><div class="f"><label for="et-name">Name</label><input id="et-name" value="${h(t.name)}"></div><div class="f"><label for="et-use">Used for</label><select id="et-use" ${['po', 'statement', 'sharefarm'].includes(t.use) && !isNew ? 'disabled' : ''}>${Object.entries(EML_USES).map(([k, l]) => `<option value="${k}" ${t.use === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="f"><label for="et-cc">CC (copy to) — separate several with commas</label><input id="et-cc" value="${h(t.cc || '')}"></div>
    <div class="f"><label for="et-sub">Subject</label><input id="et-sub" value="${h(t.subject || '')}"><div class="hint">Leave empty to type it each time.</div></div>
    <div class="f"><label for="et-body">Message</label>${emlFillBtns(t.use, 'et-body')}<textarea id="et-body" rows="12">${h(t.body || '')}</textarea><div class="actions"><button type="button" class="btn small" data-act="eml-past">💡 Ideas from emails sent from ezyVet</button></div><div id="eml-past"></div></div>
    <div class="f"><label>Compulsory questions (asked before sending)</label><div class="hint">Typed answers fill in {the fill-in name} — e.g. a question "What are the results for?" with the name <i>results for</i> fills in {results for}. Choosing an appointment fills in {appointment date}, {appointment type} and {vet name}.</div><div id="etq-list">${(t.req || []).map(emlReqRow).join('')}</div><button type="button" class="btn small" data-act="eml-reqadd">➕ Add a question</button></div>
    <div class="f"><label>Preview (with example details)</label><div id="et-prev" class="card" style="margin:0;background:#fff"></div></div>
    ${!isNew ? `<div class="actions">${dflt ? `<button type="button" class="btn" data-act="eml-tpl-reset" data-id="${t.id}">↺ Back to the original wording</button>` : ''}${['po', 'statement', 'sharefarm'].includes(t.use) && emlFor(t.use).length < 2 ? '' : `<button type="button" class="btn" data-act="eml-tpl-del" data-id="${t.id}" style="color:var(--red)">Delete template</button>`}</div>` : ''}`, () => {
    const g = (id) => document.getElementById(id); const name = g('et-name').value.trim(); if (!name) { toast('Give it a name'); return false; }
    const req = [...document.querySelectorAll('#etq-list .etq-row')].map((r) => ({ type: r.querySelector('[data-etq=type]').value, label: r.querySelector('[data-etq=label]').value.trim(), name: r.querySelector('[data-etq=name]').value.trim() })).filter((q) => q.label || q.type === 'files');
    if (req.some((q) => q.type === 'text' && !q.name)) { toast('Give each typed question a fill-in name'); return false; }
    const nt = { ...t, name, use: g('et-use').disabled ? t.use : g('et-use').value, cc: g('et-cc').value.trim(), subject: g('et-sub').value.trim(), body: g('et-body').value, req };
    emlSave((r) => { const i = r.list.findIndex((x) => x.id === nt.id); if (i >= 0) r.list[i] = nt; else r.list.push(nt); }); setTimeout(renderAll, 0); return true; });
  emlTplPreview();
}
function emlTplPreview() { const el = document.getElementById('et-prev'); if (!el) return; const ex = { 'first name': 'Sam', 'client name': 'Example Pastoral', 'supplier name': 'Example Supplies', 'PO number': 'PO0042', 'order table': { text: '2 × Example product', html: '<table border="1" cellpadding="4" style="border-collapse:collapse"><tr><td>2 × Example product</td></tr></table>' }, 'order total': '$123.00', 'supplier wording': 'Account 12345', note: '', 'statement period': '1 Oct 2026 to 31 Oct 2026', 'amount owing': '$456.00', statement: { text: '[statement]', html: '<i>[statement]</i>' }, invoice: { text: '[invoice]', html: '<i>[invoice]</i>' }, 'share farm': 'Example share farm', 'invoice number': 'INV1001', 'invoice total': '$1,000.00', 'share percent': '50%', 'amount due': '$500.00', 'pay days': '14', 'appointment date': '3 November 2026', 'appointment type': 'Bull testing', 'vet name': 'Jess', 'results for': 'Semen morphology' };
  document.querySelectorAll('#etq-list .etq-row').forEach((r) => { const n = r.querySelector('[data-etq=name]').value.trim(); if (n && !(n in ex)) ex[n] = '[' + n + ']'; });
  const V = emlBase(ex); const s = emlFill(document.getElementById('et-sub').value, V), b = emlFill(document.getElementById('et-body').value, V);
  el.innerHTML = `<div style="font-weight:700;margin-bottom:6px">${h(s.text || '(subject typed each time)')}</div>${emlWrapHtml(b.html, emlFooter())}${b.miss.length + s.miss.length ? `<div class="hint" style="color:var(--red)">Not a known fill-in: ${[...new Set([...s.miss, ...b.miss])].map((k) => '{' + h(k) + '}').join(', ')} — add a compulsory question with that name, or fix the spelling.</div>` : ''}`; }
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=eml-tpl-del],[data-act=eml-tpl-reset]'); if (!el) return; const id = el.dataset.id;
  if (el.dataset.act === 'eml-tpl-del') { if (!(await ask('Delete this email template?', 'Yes — delete', true))) return; emlSave((r) => { r.list = r.list.filter((x) => x.id !== id); }); closeSheet(); renderAll(); }
  else { const d = EML_DEFAULTS.find((x) => x.id === id); if (!d || !(await ask('Put this template back to the original wording?', 'Yes — reset'))) return; emlSave((r) => { const i = r.list.findIndex((x) => x.id === id); if (i >= 0) r.list[i] = bkClone(d); }); closeSheet(); renderAll(); } });
let EML_PAST = [];
async function emlPastIdeas() { const box = document.getElementById('eml-past'); if (!box) return; box.innerHTML = '<div class="hint">Looking through emails sent from ezyVet…</div>';
  const q = (document.getElementById('et-name').value || '').trim() || 'results';
  let rows = []; try { rows = (await rpc('ezy_search', { k: Dev.k(), q, contacts: null, animals: null, kinds: ['comm'], from_: null, to_: null, who: null, lim: 40 })) || []; } catch (x) { box.innerHTML = `<div class="hint">Couldn't search the ezyVet records (${h(x.message || 'needs the internet')}).</div>`; return; }
  rows = rows.filter((r) => /email/i.test(r.title || (r.data && r.data.title) || '') && /out/i.test(r.title || (r.data && r.data.title) || 'out'));
  const txt = (r) => String((r.data && r.data.text) || r.text || r.body || '').trim(); const seen = new Set(); EML_PAST = rows.map(txt).filter((t) => t && t.length > 40 && !seen.has(t.slice(0, 80)) && seen.add(t.slice(0, 80))).slice(0, 12);
  box.innerHTML = EML_PAST.length ? `<div class="hint">Emails sent from ezyVet matching "${h(q)}" (the template name). Change the name and tap again to search for something else.</div>` + EML_PAST.map((t, i) => `<details class="card" style="margin:6px 0;padding:6px 10px"><summary>${h(t.split('\n').find((l) => l.trim().length > 10) || t).slice(0, 90)}…</summary><div style="white-space:pre-wrap;font-size:13px;margin:6px 0">${h(t.slice(0, 2000))}</div><button type="button" class="btn small" data-act="eml-pastuse" data-i="${i}">Use this text</button></details>`).join('') : `<div class="hint">No sent emails matching "${h(q)}" (the template name). Change the name and try again.</div>`; }

/* ---------------- Records → Emails: send, bulk, unsubscribed, sent ---------------- */
function emlPageHtml() {
  const r = emlRec(); const log = ((r && r.log) || []).slice().reverse().slice(0, 60); const un = [...emlUnsub()].map((id) => IDX.biz.get(id)).filter(Boolean);
  return `<div class="d-wrap"><h2 class="sec-h" style="font-size:26px">📧 Emails</h2>
    <div class="card"><div class="actions"><button class="btn primary" data-act="eml-compose">📧 New email to a client</button><button class="btn" data-act="eml-bulk">📣 Bulk email</button></div><div class="hint">Results and general emails can also be sent from a client's page or a clinical record. Templates: Settings → Email templates.</div></div>
    <div class="card"><h3>Unsubscribed from promotional emails</h3><div class="hint" style="margin-bottom:6px">Skipped when a bulk email is marked promotional. Add anyone who replies "unsubscribe".</div>
      ${un.map((b) => `<div class="kv" style="align-items:center"><div class="v">${h(b.name)}</div><button class="btn small" data-act="eml-unsub-rm" data-bid="${b.id}">Remove</button></div>`).join('') || '<div class="hint">Nobody yet.</div>'}
      <div class="bk-hrow" style="margin-top:6px"><input id="eml-unsub-q" list="eml-bizlist" autocomplete="off" aria-label="Client" style="flex:1;padding:8px;border:1px solid var(--line);border-radius:8px"><datalist id="eml-bizlist">${D.businesses.filter((b) => !b.gone && isClientBiz(b)).map((b) => `<option value="${h(b.name)}">`).join('')}</datalist><button class="btn small" data-act="eml-unsub-add">➕ Add</button></div></div>
    <div class="card"><h3>Sent</h3>${log.map((x) => `<div class="kv"><div class="k">${new Date(x.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div><div class="v"><b>${h(x.subject || '')}</b>${x.n ? ` <span class="hint">· ${x.n} clients</span>` : ''}<br><span class="hint">${h(EML_USES[x.use] || '')} · ${h((x.to || []).slice(0, 4).join(', '))}${(x.to || []).length > 4 ? '…' : ''}${x.by ? ' · ' + h(Bk.pname(x.by)) : ''}${(x.files || []).length ? ' · 📎 ' + h(x.files.join(', ')) : ''}${x.via === 'own email' ? ' · opened in own email' : ''}</span></div></div>`).join('') || '<div class="hint">Nothing sent from the app yet.</div>'}</div></div>`;
}
window.emlPageHtml = emlPageHtml;

/* bulk email */
function emlBulkPool() { return D.businesses.filter((b) => !b.gone && isClientBiz(b) && (typeof bizCat !== 'function' || bizCat(b) !== 'inactive') && !(b.cats || []).includes('dna')).sort((a, c) => (a.name || '').localeCompare(c.name || '')); }
function emlBulkEmails(b) { return (b.emails || []).filter((e) => emailUse(e).includes('general')).map((e) => e.value).filter(Boolean); }
function emlBulk() {
  const P = emlBulkPool(); const lists = typeof BK_BULK_KEYS !== 'undefined' ? Object.entries(BK_BULK_KEYS) : [];
  const tpls = emlFor('bulk'); if (!tpls.length) { toast('Add a bulk email template first (Settings → Email templates)'); return; }
  EML = { o: { bulk: true, V: {} }, tpl: tpls[0].id, atts: [] };
  openSheet('📣 Bulk email', `<div class="f"><label for="ebk-pick">Who to send to</label><select id="ebk-pick"><option value="none">Choose below</option><option value="all">All active clients with an email</option>${lists.flatMap(([k, l]) => ['early', 'late'].map((w) => `<option value="${k}:${w}">${h(typeof l === 'string' ? l : l.name || k)} — ${w}</option>`)).join('')}</select></div>
    <div class="f"><div class="bk-hrow"><input id="ebk-q" type="search" placeholder="Search clients" autocomplete="off" aria-label="Search clients" style="flex:1;padding:8px;border:1px solid var(--line);border-radius:8px"><button type="button" class="btn small" data-act="eml-bk-all">Tick all shown</button><button type="button" class="btn small" data-act="eml-bk-none">Untick all shown</button></div>
      <div id="ebk-list" style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px;margin-top:6px">${P.map((b) => { const em = emlBulkEmails(b); return `<label style="display:block;padding:2px 0${em.length ? '' : ';color:var(--ink3)'}"><input type="checkbox" data-ebk="${b.id}" ${em.length ? '' : 'disabled'}> ${h(b.name)} <span class="hint">${em.length ? h(em.join(', ')) : 'no general email'}</span></label>`; }).join('')}</div><div class="hint" id="ebk-n"></div></div>
    <div class="f"><label class="bk-radio"><input type="checkbox" id="ebk-promo"> Promotional (advertising a service, a special, a newsletter) — adds an unsubscribe line and skips unsubscribed clients</label><div class="hint">Leave unticked for factual notices (office closed, a disease alert, a change of phone number).</div></div>
    <div class="f"><label for="em-tpl">Template</label><select id="em-tpl">${tpls.map((t) => `<option value="${t.id}">${h(t.name)}</option>`).join('')}</select></div>
    <input type="hidden" id="em-cc" value=""><div id="em-req"></div>
    <div class="f"><label for="em-sub">Subject</label><input id="em-sub" type="text" value="${h(tpls[0].subject || '')}"></div>
    <div class="f"><label for="em-body">Message</label>${emlFillBtns('bulk', 'em-body')}<textarea id="em-body" rows="10">${h(tpls[0].body || '')}</textarea><div class="hint">{first name} and {client name} are filled in for each client.</div></div>
    <div class="f"><label>Attachments</label><div id="em-atts"></div><label class="btn small" style="margin-top:4px">📎 Attach files<input type="file" id="em-file" multiple style="display:none"></label></div>
    <div class="f"><label>Preview</label><div id="em-prev" class="card" style="margin:0;background:#fff"></div></div>`, emlBulkSend);
  const sv = document.getElementById('sheet-save'); if (sv) sv.textContent = '📣 Send'; emlBulkCount(); emlDrawAtts(); emlPreview();
}
function emlBulkPick(v) { const P = emlBulkPool(); document.querySelectorAll('[data-ebk]').forEach((x) => { if (x.disabled) return; const b = IDX.biz.get(x.dataset.ebk); let on = false;
  if (v === 'all') on = true; else if (v && v.includes(':')) { const [k, w] = v.split(':'); on = !!(typeof Bk !== 'undefined' && b && (Bk.bsched(b.id).bulk || {})[k] === w); } x.checked = on; }); emlBulkCount(); }
function emlBulkFilter() { const q = (document.getElementById('ebk-q').value || '').toLowerCase(); document.querySelectorAll('#ebk-list label').forEach((l) => { l.style.display = !q || l.textContent.toLowerCase().includes(q) ? '' : 'none'; }); }
function emlBulkSel() { const promo = (document.getElementById('ebk-promo') || {}).checked; const un = emlUnsub(); return [...document.querySelectorAll('[data-ebk]:checked')].map((x) => IDX.biz.get(x.dataset.ebk)).filter((b) => b && !(promo && un.has(b.id))); }
function emlBulkCount() { const el = document.getElementById('ebk-n'); if (!el) return; const sel = emlBulkSel(); const all = document.querySelectorAll('[data-ebk]:checked').length; el.textContent = `${sel.length} client${sel.length === 1 ? '' : 's'} ticked${all > sel.length ? ` (${all - sel.length} unsubscribed — skipped)` : ''}.`; }
const EML_UNSUB_TXT = 'You are receiving this because you are a client of Bovitech Veterinary Services. To stop receiving these emails, reply with the word UNSUBSCRIBE.';
async function emlBulkSend() {
  const sel = emlBulkSel(); if (!sel.length) { toast('Tick who to send it to'); return false; } const promo = document.getElementById('ebk-promo').checked;
  const sub0 = document.getElementById('em-sub').value, body0 = document.getElementById('em-body').value; if (!sub0.trim()) { toast('Add a subject'); return false; }
  if (EML.atts.reduce((x, a) => x + (a.size || 0), 0) > EML_MAXMB * 1048576) { toast(`Attachments are over ${EML_MAXMB} MB — remove some`); return false; }
  if (!(await ask(`Send this email to ${sel.length} client${sel.length === 1 ? '' : 's'}${promo ? ' (promotional, with an unsubscribe line)' : ''}? Each client gets their own email.${sel.length > 90 ? '\n\nNote: Resend\'s free plan allows 100 emails a day — some may not send today.' : ''}`, '📣 Send them'))) return false;
  const foot = emlFooter(); const atts = EML.atts; let n = 0; const fail = [];
  const sv = document.getElementById('sheet-save');
  for (const b of sel) { const to = emlBulkEmails(b); if (!to.length) continue; if (sv) sv.textContent = `Sending ${n + fail.length + 1} of ${sel.length}…`;
    const V = emlBase({ 'client name': b.name, 'first name': emlFirstName(b.id, to) }); const s = emlFill(sub0, V), bd = emlFill(body0, V);
    const extraH = promo ? `<p style="font-size:12px;color:#666;margin-top:14px">${emlEsc(EML_UNSUB_TXT)}</p>` : '';
    const r = await emlPost({ to, cc: [], subject: s.text.trim(), html: emlWrapHtml(bd.html, foot, extraH), text: bd.text + (promo ? '\n\n' + EML_UNSUB_TXT : '') + (foot ? '\n\n— ' + foot : ''), atts, unsub: promo });
    if (r.ok) n++; else { fail.push(b.name); if (n === 0 && fail.length === 1 && /MAIL_FROM|not set/i.test(r.err || '')) { toast("The app can't send email yet (Admin jobs → Email from the app)"); return false; } }
    await new Promise((res) => setTimeout(res, 600)); }
  emlLog({ use: 'bulk', tpl: EML.tpl, to: sel.map((b) => b.name), n, subject: sub0.trim(), files: atts.map((a) => a.name), promo });
  setTimeout(() => { if (fail.length) askBox('Bulk email', `<p>📣 ${n} sent.</p><p><b>Didn't send (${fail.length}):</b><br>${fail.map(h).join('<br>')}</p>`, 'OK', true); else toast(`📣 Sent to ${n} client${n === 1 ? '' : 's'}`); renderAll(); }, 50);
  return true;
}
window.emlCompose = emlCompose; window.emlBuild = emlBuild; window.emlSettingsCard = emlSettingsCard; window.emlPost = emlPost; window.emlLog = emlLog; window.emlFill = emlFill; window.emlBase = emlBase;
