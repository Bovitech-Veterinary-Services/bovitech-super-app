/* ---------------- Texts (SMS) ----------------
   💬 = text from this device's own number (the phone's Messages app, or Phone Link on a computer)
   📲 = text from the office number (0499 489 919) through SMSGate on the office phone — from any signed-in phone or computer;
        logged in the app, and replies come back into the 💬 Communications tab and the contact's / business's page.
   Signatures (Settings → Texts) and hand-written templates (Settings → Texts → SMS templates) sync to every device. */
const SMS_OFFICE_NO = '0499 489 919';
const TX = { page: 'unread', open: null, q: '' }; // the Texts tab: which page, which conversation is open, the search

/* ---- numbers and names ---- */
const smsDigits = (p) => String(p || '').replace(/\D/g, '').replace(/^61(?=4)/, '0'); // 0412345678
const smsNice = (p) => { const d = smsDigits(p); return /^04\d{8}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : String(p || ''); };
function smsDevNo() { try { return (devInfo().phone || '').trim(); } catch (e) { return ''; } }
function smsMe() { const st = window.SBAuth && SBAuth.staff; if (!st) return ''; const n = st.preferred_name || String(st.full_name || '').split(' ')[0] || ''; return typeof niceName === 'function' ? niceName(n) : n; }
function smsIsAdminLogin() { const st = window.SBAuth && SBAuth.staff; return !!(st && st.role === 'admin'); }

/* ---- the two buttons, used everywhere a mobile number has a text button ---- */
function smsDevTitle(who) {
  const me = smsDevNo(); const name = who ? ' ' + who : '';
  return devIsPhone() ? `💬 Text${name} from this phone's own number${me ? ' (' + smsNice(me) + ')' : ''}`
    : `💬 Text${name} from this computer — it goes through Phone Link, from the phone linked to this computer${me ? ' (' + smsNice(me) + ')' : ''}`;
}
function smsBtns(o) { // o: { phone, cid, bid, who, cls }  → 💬 (this device) + 📲 (office number)
  if (!o || !o.phone) return ''; const n = h(String(o.phone).replace(/[^\d+]/g, '')); const cls = o.cls || 'cbtn sms'; const who = o.who || smsNice(o.phone);
  return `<a class="${cls}" href="sms:${n}" title="${h(smsDevTitle(who + ' (' + smsNice(o.phone) + ')'))}" aria-label="Text ${h(who)} from this device">💬</a>`
    + `<button type="button" class="${cls} smsoffice" data-act="sms-office" data-phone="${h(o.phone)}" data-cid="${h(o.cid || '')}" data-bid="${h(o.bid || '')}" title="📲 Text ${h(who)} (${h(smsNice(o.phone))}) from the office number ${SMS_OFFICE_NO} through SMSGate" aria-label="Text ${h(who)} from the office number">📲</button>`;
}

/* ---- starting signatures and hand-written templates (made once; change them in Settings → Texts) ---- */
const SMS_SIG_SEED = [
  { id: 'sig-me', cfg: 'sig', order: 1, name: 'Your name - Bovitech Veterinary Services', text: '{me} - Bovitech Veterinary Services' },
  { id: 'sig-team', cfg: 'sig', order: 2, name: 'Team at Bovitech Veterinary Services', text: 'Team at Bovitech Veterinary Services' }];
const SMS_TPL_SEED = [
  { id: 'sms-h-call', cfg: 'sms', order: 10, use: 'other', name: 'Please give us a call', text: 'Hi {first}, could you please give us a call on 0499 489 919 when you get a chance? Thanks.' },
  { id: 'sms-h-results', cfg: 'sms', order: 11, use: 'other', name: 'Results are back', text: 'Hi {first}, your results are back. Please give us a call on 0499 489 919 to go through them.' },
  { id: 'sms-h-late', cfg: 'sms', order: 12, use: 'other', name: 'Running late', text: 'Hi {first}, sorry, we are running about [time] minutes late for your appointment today.' },
  { id: 'sms-h-onway', cfg: 'sms', order: 13, use: 'other', name: 'On our way', text: 'Hi {first}, we are on our way and should be with you in about [time] minutes.' }];
function smsSeed() {
  if (!D || !D.sync || !D.sync.last || typeof Bk === 'undefined') return; // only once this device has the latest data (so nothing is doubled up)
  let n = 0; [...SMS_SIG_SEED, ...SMS_TPL_SEED].forEach((d) => { if (!Bk.get(d.id)) { const r = { ...d }; touch(r); Bk.list('bkcfg').push(r); n++; } });
  if (n) { save(); if (window.Sync) Sync.soon(); }
}

/* ---- signatures ---- */
const smsSigs = () => (typeof Bk === 'undefined' ? [] : Bk.cfg('sig'));
const smsSigText = (s) => String((s && s.text) || '').replace(/\{me\}/g, smsMe() || 'Bovitech').trim();
function smsSigDefId(sid) { // this login's default signature
  sid = sid || (window.SBAuth && SBAuth.staff && SBAuth.staff.id); const r = typeof Bk !== 'undefined' && Bk.get('sigdef'); const mine = r && r.staff && sid && r.staff[sid];
  const live = smsSigs(); if (mine && live.some((s) => s.id === mine)) return mine;
  const pick = smsIsAdminLogin() ? 'sig-team' : 'sig-me'; return live.some((s) => s.id === pick) ? pick : (live[0] || {}).id || '';
}
function smsSetSigDef(sigId, sid) {
  sid = sid || (window.SBAuth && SBAuth.staff && SBAuth.staff.id); if (!sid) return; let r = Bk.get('sigdef');
  if (!r) { r = { id: 'sigdef', cfg: 'sigdef', name: 'Default signatures', staff: {} }; Bk.list('bkcfg').push(r); }
  r.staff = { ...(r.staff || {}), [sid]: sigId }; touch(r); save(); if (window.Sync) Sync.soon();
}

/* ---- fill-ins, length and the finished message ---- */
const SMS_GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€';
function smsCount(t) { // → { chars, parts, plain } (one text is 160 plain characters, or 70 with emoji / curly quotes / dashes)
  const plain = [...t].every((ch) => SMS_GSM.includes(ch)); const n = plain ? [...t].reduce((a, ch) => a + ('^{}\\[~]|€'.includes(ch) ? 2 : 1), 0) : [...t].length;
  const one = plain ? 160 : 70, many = plain ? 153 : 67; return { chars: n, parts: n <= one ? 1 : Math.ceil(n / many), plain };
}
function smsFill(text, ctx) { // the same fill-ins as the booking texts, plus {me}; booking ones only when the text is about an appointment
  let t = ctx && ctx.booking && typeof bkFill === 'function' ? bkFill(text, ctx.booking) : text;
  const c = ctx && ctx.cid && D.contacts.find((x) => x.id === ctx.cid), bz = ctx && ctx.bid && IDX.biz && IDX.biz.get(ctx.bid);
  const v = { first: c ? c.first || '' : '', name: c ? fullName(c) : '', business: bz ? bz.name : '', me: smsMe() };
  return t.replace(/\{(first|name|business|me)\}/g, (m, k) => v[k] || '').replace(/Hi\s+,/g, 'Hi,').replace(/\s+([.,])/g, '$1');
}

/* ---- 📲 the office-number text box ---- */
async function smsCompose(d, keep) {
  d = d || {}; keep = keep || {}; smsSeed();
  const b = d.booking ? (BK._textBooking || (typeof bkRec === 'function' && bkRec(d.booking))) : null;
  const cons = d.bid ? bkContactsOf(d.bid) : d.cid ? D.contacts.filter((c) => c.id === d.cid) : [];
  const opts = cons.filter(bkMobile).map((c) => ({ v: bkMobile(c), l: `${fullName(c)} · ${smsNice(bkMobile(c))}`, cid: c.id }));
  if (d.phone && !opts.some((o) => smsDigits(o.v) === smsDigits(d.phone))) { const c = D.contacts.find((x) => (x.mobiles || []).some((m) => smsDigits(m.value) === smsDigits(d.phone))); opts.unshift({ v: d.phone, l: c ? `${fullName(c)} · ${smsNice(d.phone)}` : smsNice(d.phone), cid: c ? c.id : d.cid || '' }); }
  const pickTo = keep.to || (d.phone ? opts.find((o) => smsDigits(o.v) === smsDigits(d.phone)) || {} : opts.find((o) => o.cid === (b && b.cid)) || opts[0] || {}).v || '';
  const tpls = Bk.cfg('sms'); const hand = tpls.filter((t) => t.use === 'other'), auto = tpls.filter((t) => t.use !== 'other');
  const sigs = smsSigs(); const defSig = keep.sig || smsSigDefId();
  BK._sms = { b, cid: d.cid || '', bid: d.bid || '', opts };
  const html = `<div class="smsgate">📲 <b>This text goes through SMSGate on the office phone.</b> The client sees it from the office number <b>${SMS_OFFICE_NO}</b>, not your own. Replies come back into the app (💬 Communications tab, and their contact / business page).</div>
    <div class="f"><label for="sm-to">To</label><select id="sm-to" data-ask="to">${opts.map((o) => `<option value="${h(o.v)}" data-cid="${h(o.cid)}" ${smsDigits(o.v) === smsDigits(pickTo) ? 'selected' : ''}>${h(o.l)}</option>`).join('')}<option value="__other" ${keep.to === '__other' ? 'selected' : ''}>Another mobile number…</option></select>
      <input id="sm-other" data-ask="other" inputmode="tel" value="${h(keep.other || '')}" ${keep.to === '__other' || !opts.length ? '' : 'hidden'} aria-label="Mobile number" style="margin-top:6px">${opts.length ? '' : '<div class="hint">No mobile number saved here — type one in.</div>'}</div>
    <div class="f"><label for="sm-tpl">Start from</label><select id="sm-tpl"><option value="">A blank message</option>${hand.length ? `<optgroup label="Templates">${hand.map((t) => `<option value="${t.id}">${h(t.name)}</option>`).join('')}</optgroup>` : ''}${auto.length ? `<optgroup label="Booking texts">${auto.map((t) => `<option value="${t.id}">${h(t.name)}</option>`).join('')}</optgroup>` : ''}</select></div>
    <div class="f"><label for="sm-body">Message</label><textarea id="sm-body" data-ask="body" rows="5">${h(keep.body || '')}</textarea></div>
    <div class="f"><label class="bk-radio" style="display:flex"><input type="checkbox" id="sm-sigon" data-askchk="sigon" ${keep.sigon === false ? '' : 'checked'}> End with a signature</label>
      <div id="sm-sigwrap" ${keep.sigon === false ? 'hidden' : ''}><select id="sm-sig" data-ask="sig" aria-label="Signature">${sigs.map((s) => `<option value="${s.id}" ${s.id === defSig ? 'selected' : ''}>${h(smsSigText(s))}${s.id === smsSigDefId() ? ' (your default)' : ''}</option>`).join('')}<option value="__custom" ${defSig === '__custom' ? 'selected' : ''}>Type a different signature for this text…</option></select>
      <input id="sm-sigtxt" data-ask="sigtxt" value="${h(keep.sigtxt || '')}" ${defSig === '__custom' ? '' : 'hidden'} aria-label="Signature for this text" style="margin-top:6px"></div></div>
    <div class="lbl" style="margin-top:6px">What the client gets</div><div class="smsprev" id="sm-prev"></div><div class="hint" id="sm-n"></div>
    <input type="hidden" id="sm-final" data-ask="final">`;
  setTimeout(smsPreview, 0);
  const ok = await askBox('📲 Text from the office number', html, 'Send from ' + SMS_OFFICE_NO, false, 'Cancel');
  if (!ok) return;
  const f = { ...ASK_FORM }; const to = f.to === '__other' || !opts.length ? (f.other || '').trim() : f.to; const body = (f.final || '').trim();
  const again = (msg) => { toast(msg); smsCompose(d, { to: f.to || (opts.length ? '' : '__other'), other: f.other, body: f.body, sig: f.sig, sigon: f.sigon, sigtxt: f.sigtxt }); };
  if (!/^04\d{8}$/.test(smsDigits(to))) return again('Choose who to text, or type an Australian mobile number (04…)');
  if (!(f.body || '').trim()) return again('Write the message');
  if (/\{\w+\}|\[[^\]]*\]/.test(body) && !(await ask('The message still has a part to fill in — ' + (body.match(/\{\w+\}|\[[^\]]*\]/) || [''])[0] + '. Send it anyway?', 'Yes — send it as it is'))) return again('Fix the part to fill in, then send');
  const o = opts.find((x) => smsDigits(x.v) === smsDigits(to)); const cid = o ? o.cid || null : (D.contacts.find((x) => (x.mobiles || []).some((m) => smsDigits(m.value) === smsDigits(to))) || {}).id || null;
  try { await rpc('sms_queue', { k: Dev.k(), phone: smsDigits(to), body, contact_id: cid || d.cid || null, business_id: d.bid || null, booking_id: b ? b.id : null }); toast(`📲 Text queued — it goes from ${SMS_OFFICE_NO} in a moment`); SupaSync.smsAt = 0; SupaSync.soon(); }
  catch (e) { toast(e.offline ? 'No internet — the text wasn\'t sent. Try again when you have signal.' : e.message); return; }
  // a signature typed just for this text: keep it for next time? and make it this login's default?
  const typed = f.sigon === true && f.sig === '__custom' ? (f.sigtxt || '').trim() : '';
  if (typed && !smsSigs().some((s) => smsSigText(s) === typed || s.text === typed)) {
    if (await ask(`Add “${typed}” to the signature list, so it can be picked next time?`, 'Yes — add it to the list')) {
      const r = { id: uid('sig'), cfg: 'sig', order: 50, name: typed, text: typed }; touch(r); Bk.list('bkcfg').push(r); save(); if (window.Sync) Sync.soon();
      if (await ask(`Make “${typed}” the default signature for ${smsMe() ? smsMe() + '\'s' : 'this'} login?`, 'Yes — make it my default')) smsSetSigDef(r.id);
      toast('Signature saved — change the list in Settings → Texts');
    }
  }
}
function smsPreview() {
  const box = document.getElementById('sm-body'); if (!box) return;
  const on = document.getElementById('sm-sigon').checked, sel = document.getElementById('sm-sig'); const custom = sel && sel.value === '__custom';
  const sig = !on ? '' : custom ? (document.getElementById('sm-sigtxt').value || '').trim() : smsSigText(Bk.get(sel && sel.value));
  const msg = box.value.trim(); const full = msg + (msg && sig ? '\n' + sig : '');
  document.getElementById('sm-final').value = full; const pv = document.getElementById('sm-prev'); if (pv) pv.textContent = full || ' ';
  const c = smsCount(full); const nEl = document.getElementById('sm-n');
  if (nEl) nEl.innerHTML = `${c.chars} characters · ${c.parts} text${c.parts > 1 ? 's' : ''}${c.plain ? '' : ' · <b>contains emoji or special characters (like ’ or –), so each text only holds 70 characters</b>'}`;
}
document.addEventListener('input', (e) => { if (['sm-body', 'sm-sigtxt'].includes(e.target.id)) smsPreview(); });
document.addEventListener('change', (e) => {
  const id = e.target.id;
  if (id === 'sm-tpl') { const t = Bk.get(e.target.value); const box = document.getElementById('sm-body'); const s = BK._sms || {}; const sel = document.getElementById('sm-to'); const opt = sel && sel.selectedOptions[0];
    if (box) { box.value = t ? smsFill(t.text, { booking: s.b, cid: (opt && opt.dataset.cid) || s.cid, bid: s.bid }) : ''; } smsPreview(); }
  if (id === 'sm-to') { const o = document.getElementById('sm-other'); if (o) o.hidden = e.target.value !== '__other'; }
  if (id === 'sm-sigon') { const w = document.getElementById('sm-sigwrap'); if (w) w.hidden = !e.target.checked; smsPreview(); }
  if (id === 'sm-sig') { const t = document.getElementById('sm-sigtxt'); if (t) { t.hidden = e.target.value !== '__custom'; if (!t.hidden) t.focus(); } smsPreview(); }
});

/* ---- the texts for one contact / business, and conversations ---- */
const smsLog = () => (D && D.smsLog) || [];
const smsOffice = (x) => x.kind !== 'daysheet' && x.kind !== 'notice'; // texts to clients (not staff day sheets / office notices)
const smsUnread = (x) => x.kind === 'reply' && !x.handled;
function smsKey(x) { return x.contact_id ? 'c:' + x.contact_id : x.business_id ? 'b:' + x.business_id : 'p:' + smsDigits(x.phone); }
function smsKeyName(k) {
  const [t, id] = [k.slice(0, 1), k.slice(2)];
  if (t === 'c') { const c = D.contacts.find((x) => x.id === id); if (!c) return 'Unknown contact'; const bz = bizOf(c).filter((b) => !b.gone)[0]; return fullName(c) + (bz ? ' (' + bz.name + ')' : ''); }
  if (t === 'b') { const b = IDX.biz && IDX.biz.get(id); return b ? b.name : 'Unknown business'; }
  const c = D.contacts.find((x) => (x.mobiles || []).some((m) => smsDigits(m.value) === id)); return c ? fullName(c) : smsNice(id) + ' (not in contacts)';
}
function smsThreads() { // → [{ key, rows (oldest first), last, unread }] newest first
  const m = new Map(); smsLog().filter(smsOffice).forEach((x) => { const k = smsKey(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return [...m].map(([key, rows]) => { rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)); return { key, rows, last: rows[rows.length - 1], unread: rows.filter(smsUnread).length }; }).sort((a, b) => Date.parse(b.last.at) - Date.parse(a.last.at));
}
function smsFor(kind, id) { // every office text for a contact (and their numbers) or a business
  if (kind === 'contact') { const c = D.contacts.find((x) => x.id === id); const nums = new Set(((c && c.mobiles) || []).map((m) => smsDigits(m.value))); return smsLog().filter((x) => smsOffice(x) && (x.contact_id === id || (!x.contact_id && nums.has(smsDigits(x.phone))))); }
  return smsLog().filter((x) => smsOffice(x) && x.business_id === id);
}
const smsWhen = (at) => new Date(at).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const SMS_KINDS = { booked: 'Booking made', reminder: 'Reminder', proposal: 'New time', manual: 'Text', reply: 'Reply' };
function smsBubble(x, showWho) {
  const st = typeof bkSmsState === 'function' ? bkSmsState(x) : x.status; const inn = x.kind === 'reply';
  return `<div class="smsbub ${inn ? 'smsin' : 'smsout'} ${smsUnread(x) ? 'unread' : ''}"><div class="smsmeta">${smsWhen(x.at)} · ${inn ? '📥 Reply' + (showWho ? ' from ' + h(smsKeyName(smsKey(x))) : '') : '📲 ' + h(SMS_KINDS[x.kind] || 'Text') + (x.by ? ' from ' + h(x.by) : '')}${inn ? '' : ' · ' + h(st)}${x.note ? ' · ' + h(x.note) : ''}</div><div class="smsbody">${h(x.body || '')}</div>
    ${inn && !x.handled ? `<div class="actions"><button class="btn small" data-act="tx-read" data-sms="${x.id}">✓ Mark as read</button></div>` : ''}${!inn && x.status === 'failed' && x.kind === 'manual' ? `<div class="actions"><button class="btn small primary" data-act="bkj-smsretry" data-id="${x.id}">Try again</button></div>` : ''}</div>`;
}
function smsCard(kind, id) { // "📲 Communications from office phone" on a contact / business page (only when there are some)
  const rows = smsFor(kind, id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); if (!rows.length) return '';
  const un = rows.filter(smsUnread).length; const key = kind === 'contact' ? 'c:' + id : 'b:' + id;
  return `<div class="card smscard"><h3><span class="sp">${h(bt('smscard', '📲 Communications from office phone'))} <span class="hint">(${SMS_OFFICE_NO})</span>${un ? ` <span class="smscount">${un} unread</span>` : ''}</span><button class="btn small" data-act="tx-goto" data-key="${key}">Open conversation</button></h3>
    ${rows.slice(0, 3).reverse().map((x) => smsBubble(x)).join('')}${rows.length > 3 ? `<div class="hint">${rows.length - 3} earlier — tap Open conversation to see them all.</div>` : ''}</div>`;
}

/* ---- the 💬 Communications tab ---- */
function smsTabHtml() {
  smsSeed(); const th = smsThreads(); const unread = smsLog().filter(smsUnread).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const top = `<div class="bk-top"><div class="bk-nav"><b class="bk-title">💬 ${h(lab('texts'))}</b></div><div class="actions"><button class="btn small" data-act="tx-refresh">↻ Check for new texts</button><button class="btn small primary" data-act="sms-office">📲 New text from the office</button></div></div>
    <div class="hint" style="margin:0 0 8px">Texts sent from the office number (${SMS_OFFICE_NO}) through SMSGate, and the replies. Each one is also on that contact's or business's page. ${D.smsLog ? '' : '<b>Nothing has loaded yet — texts show once the office phone is set up (Settings → Admin jobs) and you are online.</b>'}</div>`;
  if (TX.open) { const t = th.find((x) => x.key === TX.open); const [k, id] = [TX.open.slice(0, 1), TX.open.slice(2)];
    const ph = t ? (t.rows.slice().reverse().find((x) => x.phone) || {}).phone : k === 'p' ? id : '';
    return `<div class="d-wrap bk-wrap">${top}<div class="actions" style="margin-bottom:8px"><button class="btn small" data-act="tx-back">‹ All conversations</button>${k !== 'p' ? `<button class="btn small" data-act="open" data-kind="${k === 'c' ? 'contact' : 'business'}" data-id="${h(id)}">Open their page</button>` : ''}<button class="btn small primary" data-act="sms-office" data-phone="${h(ph || '')}" data-cid="${k === 'c' ? h(id) : ''}" data-bid="${k === 'b' ? h(id) : ''}">📲 Reply from the office</button>${t && t.unread ? `<button class="btn small" data-act="tx-readall" data-key="${h(TX.open)}">✓ Mark all as read</button>` : ''}</div>
      <div class="card"><h3>${h(smsKeyName(TX.open))}</h3>${t ? t.rows.map((x) => smsBubble(x)).join('') : '<div class="hint">No texts yet.</div>'}</div></div>`; }
  const q = (TX.q || '').trim().toLowerCase();
  if (TX.page === 'unread') return `<div class="d-wrap bk-wrap">${top}<div class="search" style="margin-bottom:8px"><input id="tx-q" type="search" placeholder="Search texts" value="${h(TX.q)}"></div>
    ${unread.filter((x) => !q || (smsKeyName(smsKey(x)) + ' ' + x.body + ' ' + x.phone).toLowerCase().includes(q)).map((x) => `<div class="card smsunread"><h3><span class="sp">📥 ${h(smsKeyName(smsKey(x)))}</span></h3>${smsBubble(x)}<div class="actions"><button class="btn small" data-act="tx-goto" data-key="${h(smsKey(x))}">Open conversation</button><button class="btn small primary" data-act="sms-office" data-phone="${h(x.phone || '')}" data-cid="${h(x.contact_id || '')}" data-bid="${h(x.business_id || '')}">📲 Reply from the office</button></div></div>`).join('') || '<div class="card"><div class="hint">✓ No unread replies.</div></div>'}</div>`;
  return `<div class="d-wrap bk-wrap">${top}<div class="search" style="margin-bottom:8px"><input id="tx-q" type="search" placeholder="Search texts" value="${h(TX.q)}"></div>
    ${th.filter((t) => !q || (smsKeyName(t.key) + ' ' + t.rows.map((x) => x.body + ' ' + x.phone).join(' ')).toLowerCase().includes(q)).map((t) => `<div class="card smsthread ${t.unread ? 'hasunread' : ''}" data-act="tx-goto" data-key="${h(t.key)}" role="button" tabindex="0"><div class="kv" style="align-items:center"><div class="v"><b>${h(smsKeyName(t.key))}</b>${t.unread ? ` <span class="smscount">${t.unread} unread</span>` : ''}<br><span class="hint">${smsWhen(t.last.at)} · ${t.last.kind === 'reply' ? '📥 ' : '📲 '}${h((t.last.body || '').slice(0, 90))}${(t.last.body || '').length > 90 ? '…' : ''}</span></div><span class="hint">›</span></div></div>`).join('') || '<div class="card"><div class="hint">No office texts yet.</div></div>'}</div>`;
}
function smsMarkRead(ids) { return Promise.all(ids.map((id) => rpc('sms_handled', { k: Dev.k(), sms_id: +id }).then(() => { const x = smsLog().find((y) => y.id === +id); if (x) x.handled = true; }))).then(() => { save(); renderAll(); }).catch((e) => toast(e.offline ? 'No internet — try again when you have signal' : e.message)); }
function smsRefresh() { if (window.SupaSync) { SupaSync.smsAt = 0; SupaSync.soon(); } }
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const d = el.dataset;
  switch (d.act) {
    case 'sms-office': e.preventDefault(); BK._textBooking = null; smsCompose({ phone: d.phone || '', cid: d.cid || '', bid: d.bid || '' }); break;
    case 'tx-goto': S.tab = 'texts'; TX.open = d.key; S.sel = null; document.body.classList.remove('show-detail'); smsRefresh(); renderAll(); $('#list').scrollTop = 0; break;
    case 'tx-back': TX.open = null; TX.page = 'all'; renderAll(); break;
    case 'tx-read': smsMarkRead([d.sms]); break;
    case 'tx-readall': { const t = smsThreads().find((x) => x.key === d.key); if (t) smsMarkRead(t.rows.filter(smsUnread).map((x) => x.id)); break; }
    case 'tx-refresh': smsRefresh(); toast('Checking for new texts…'); break;
    case 'sms-sigdef': smsSetSigDef(d.id); toast('Default signature changed for this login'); renderAll(); break;
    case 'sms-signew': case 'sms-sigedit': smsSigEdit(d.act === 'sms-sigedit' ? Bk.get(d.id) : null); break;
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('smsthread')) e.target.click(); });
document.addEventListener('input', (e) => { if (e.target.id !== 'tx-q') return; TX.q = e.target.value; const pos = e.target.selectionStart; renderAll(); const q = document.getElementById('tx-q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) { } } });

/* ---- Settings → Texts ---- */
let SMS_SIG_EDITING = null;
function smsSigEdit(x) {
  const isNew = !x; SMS_SIG_EDITING = x ? x.id : null; x = x ? { ...x } : { id: uid('sig'), cfg: 'sig', order: 50, name: '', text: '' };
  const users = ((window.SBAuth && SBAuth.list) || []).filter((s) => s.active);
  openSheet(isNew ? 'New signature' : 'Edit signature', `<div class="f"><label for="sg-text">Signature</label><input id="sg-text" value="${h(x.text || '')}"><div class="hint">Put <b>{me}</b> where the name of whoever is signed in goes — e.g. "{me} - Bovitech Veterinary Services" becomes "${h(smsMe() || 'Jess')} - Bovitech Veterinary Services". Use a plain hyphen (-), not a long dash: long dashes, curly quotes and emoji make each text hold only 70 characters instead of 160.</div></div>
    ${users.length ? `<div class="f"><label>The default signature for these logins</label><div class="checks">${users.map((s) => `<label><input type="checkbox" data-sgdef="${s.id}" ${smsSigDefId(s.id) === x.id && !isNew ? 'checked' : ''}> ${h(s.preferred_name || s.full_name)}</label>`).join('')}</div><div class="hint">Anyone not ticked on any signature uses "{me} - Bovitech Veterinary Services" (the office login uses the team one).</div></div>` : ''}
    ${isNew ? '' : '<div class="actions"><button type="button" class="btn" data-act="sms-sigdel" style="color:var(--red)">Remove this signature</button></div>'}`, async () => {
    const t = (document.getElementById('sg-text').value || '').trim(); if (!t) { toast('Type the signature'); return false; }
    x.text = t; x.name = t; const ex = Bk.get(x.id); if (ex) { Object.assign(ex, x); touch(ex); } else { touch(x); Bk.list('bkcfg').push(x); }
    const r = Bk.get('sigdef') || (() => { const n = { id: 'sigdef', cfg: 'sigdef', name: 'Default signatures', staff: {} }; Bk.list('bkcfg').push(n); return n; })(); const st = { ...(r.staff || {}) };
    document.querySelectorAll('[data-sgdef]').forEach((el) => { if (el.checked) st[el.dataset.sgdef] = x.id; else if (st[el.dataset.sgdef] === x.id) delete st[el.dataset.sgdef]; });
    r.staff = st; touch(r); save(); if (window.Sync) Sync.soon(); setTimeout(renderAll, 0); return true; });
}
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=sms-sigdel]'); if (!el) return; const sel = Bk.get(SMS_SIG_EDITING); if (!sel) { closeSheet(); return; }
  if (!(await ask(`Remove the signature “${smsSigText(sel)}”?`, 'Yes — remove', true))) return; sel.gone = true; touch(sel); save(); if (window.Sync) Sync.soon(); closeSheet(); renderAll(); });
function smsSettingsHtml() { // the Settings → Texts sub-tab
  smsSeed(); const me = window.SBAuth && SBAuth.staff; const ed = typeof Bk !== 'undefined' && Bk.can('settings'); const defId = smsSigDefId();
  const sigRow = (s) => `<div class="kv" style="align-items:center"><div class="v"><b>${h(smsSigText(s))}</b>${s.text.includes('{me}') ? '<br><span class="hint">Shows the name of whoever is signed in</span>' : ''}${s.id === defId ? ' <span class="bk-pill">Your default</span>' : ''}</div>${me && s.id !== defId ? `<button class="btn small" data-act="sms-sigdef" data-id="${s.id}">Make my default</button>` : ''}<button class="btn small" data-act="sms-sigedit" data-id="${s.id}" aria-label="Edit signature">✏️</button></div>`;
  const tplRow = (x) => `<div class="kv" style="align-items:center"><div class="v"><b>${h(x.name)}</b><br><span class="hint">${({ booked: 'Sent when an appointment is made', reminder: 'Reminder, 5 days before at 8:30am', proposal: 'When a new time is suggested', other: 'Template for texts you write (📲)' })[x.use] || ''} · “${h((x.text || '').slice(0, 90))}${(x.text || '').length > 90 ? '…' : ''}”</span></div>${ed ? `<button class="btn small" data-act="bks-edit" data-id="${x.id}" aria-label="Edit ${h(x.name)}">✏️</button>` : ''}</div>`;
  const tp = Bk.cfg('sms');
  return `<div class="cr-setwrap" data-tab="texts">
  <div class="card"><h3><span class="sp">📲 Office texts — how they work</span></h3><div class="hint">On contact and business pages, <b>💬</b> texts from <b>this device's own number</b> (the phone's Messages app, or Phone Link on a computer — this device's number is set in Settings → This device). <b>📲</b> texts from the <b>office number ${SMS_OFFICE_NO}</b> through SMSGate on the office phone, from any signed-in phone or computer — the text and any reply are kept in the 💬 ${h(lab('texts'))} tab and on that contact's page. The office phone must be on, charged, with signal and internet, and the SMSGate app running (Settings → Admin jobs → "Texts from the office phone").</div></div>
  <div class="card"><h3><span class="sp">📲 Signatures</span><button class="btn small" data-act="sms-signew">➕ New</button></h3><div class="hint" style="margin-bottom:6px">The choices for how an office text ends. Each login has its own default (ticked when the 📲 box opens), and a different signature can be typed for one text — the app then asks whether to add it to this list.</div>${smsSigs().map(sigRow).join('') || '<div class="hint">None yet.</div>'}</div>
  <div class="card"><h3><span class="sp">📲 SMS templates</span>${ed ? '<button class="btn small" data-act="bks-new" data-cfg="sms">➕ New</button>' : ''}</h3><div class="hint" style="margin-bottom:6px">"Start from" choices in the 📲 box (set "When it's used" to <b>Sent by hand</b>), and the automatic booking texts. Fill-ins: {first} {name} {business} {me}, and for appointments {type} {day} {date} {time} {farm} {at_farm} {vet} {old_date}. Put anything to change each time in [square brackets] — the app asks before sending a text that still has one. Don't put a signature in a template — it's added separately.${ed ? '' : ' Ask the office to change these.'}</div>
    <div class="lbl">Templates for texts you write</div>${tp.filter((x) => x.use === 'other').map(tplRow).join('') || '<div class="hint">None yet.</div>'}
    <div class="lbl" style="margin-top:8px">Automatic booking texts</div>${tp.filter((x) => x.use !== 'other').map(tplRow).join('') || '<div class="hint">None yet.</div>'}</div>
  </div>`;
}
