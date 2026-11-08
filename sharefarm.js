/* Bovitech Super App — 🤝 Share farms (ezyVet calls them syndicates): a client business of its own, with its own
   herds, flocks and records, whose invoices are split between partner businesses by a percentage (e.g. 50 / 50).
   Each partner gets their own copy of the invoice showing the full value and what they owe; it goes on their statement. */
'use strict';
const sfIs = (b) => !!(b && b.shareFarm);
function sfPartners(b) { return ((b && b.partners) || []).filter((p) => p && IDX.biz.get(p.bid) && !IDX.biz.get(p.bid).gone); }
function sfOfPartner(bid) { return (D.businesses || []).filter((b) => !b.gone && sfIs(b) && (b.partners || []).some((p) => p.bid === bid)); }
const sfPctOk = (L) => L.length >= 2 && Math.abs(L.reduce((s, p) => s + (+p.pct || 0), 0) - 100) < 0.01;
/* the split for one invoice: its own (changed on that invoice, or fixed when it was approved), else the share farm's */
function sfSplit(inv) { if (!inv) return null; if (inv.split && inv.split.length) return inv.split; const b = IDX.biz.get(inv.bid); if (!sfIs(b)) return null; const L = sfPartners(b); return L.length ? L.map((p) => ({ bid: p.bid, pct: +p.pct || 0 })) : null; }
function sfParts(inv) { const L = sfSplit(inv); if (!L) return null; const tt = crInvTotals(inv); let rs = 0, rg = 0, rt = 0;
  return L.map((p, i) => { const last = i === L.length - 1; const f = (+p.pct || 0) / 100; const sub = last ? crR2(tt.sub - rs) : crR2(tt.sub * f), gst = last ? crR2(tt.gst - rg) : crR2(tt.gst * f), amt = last ? crR2(tt.total - rt) : crR2(sub + gst); rs += sub; rg += gst; rt += amt;
    const pAt = (inv.paidBy || {})[p.bid] || (inv.status === 'paid' ? inv.paidAt || inv.at : null);
    return { bid: p.bid, pct: +p.pct || 0, sub, gst, amt, paidAt: pAt || null, num: inv.num ? inv.num + '-' + (i + 1) : '', i }; }); }
window.sfIs = sfIs; window.sfParts = sfParts; window.sfOfPartner = sfOfPartner;
const sfName = (bid) => (IDX.biz.get(bid) || {}).name || '?';
const sfPctTxt = (L) => L.map((p) => (+p.pct || 0) + '%').join(' / ');

/* ---------- money: what each business owes, including their share of share-farm invoices (statements, the business page) ---------- */
function sfBillLines(bid) { // → [{ inv, amt, d, paidD, num, share }] for one business's statement
  const day = (ms) => (ms ? stmDay(ms) : ''); const out = [];
  crList('crinv').forEach((inv) => { if (!stmBilled(inv)) return; const d = inv.date || day(inv.at); const parts = sfParts(inv);
    if (parts) { const p = parts.find((x) => x.bid === bid); if (p) out.push({ inv, amt: p.amt, d, paidD: p.paidAt ? day(p.paidAt) || d : '', num: p.num || inv.num || '', share: p, sf: inv.bid }); return; }
    if (inv.bid === bid) out.push({ inv, amt: crInvTotals(inv).total, d, paidD: inv.status === 'paid' ? day(inv.paidAt) || d : '', num: inv.num || '' }); });
  return out; }
function sfBilledBids() { const s = new Set(); crList('crinv').forEach((inv) => { if (!stmBilled(inv)) return; const parts = sfParts(inv); if (parts) parts.forEach((p) => s.add(p.bid)); else if (inv.bid) s.add(inv.bid); }); return [...s]; }

/* ---------- the share farm on a business page ---------- */
function sfBizCard(b) { if (!b || b.gone) return ''; const ins = sfOfPartner(b.id);
  let html = '';
  if (sfIs(b)) { const L = sfPartners(b); const ok = sfPctOk(L);
    html += `<div class="card sfcard"><h3><span class="sp">🤝 Share farm</span><button class="btn small" data-act="sf-edit" data-bid="${b.id}">Partners…</button></h3>
      <div class="hint" style="margin-bottom:4px">Its own herds, flocks and records. Every invoice is split between the partners below — each gets their own copy showing the whole invoice and their share, and it goes on their statement.</div>
      ${L.map((p) => `<div class="kv"><div class="k"><b>${+p.pct || 0}%</b></div><div class="v"><span class="lnk" data-act="open" data-kind="business" data-id="${p.bid}">${h(sfName(p.bid))}</span></div></div>`).join('') || '<div class="hint">No partners yet — tap Partners… to add them.</div>'}
      ${L.length && !ok ? `<div class="sf-warn">⚠ The shares add up to ${L.reduce((s, p) => s + (+p.pct || 0), 0)}% — they must add up to 100%.</div>` : ''}</div>`; }
  if (ins.length) html += `<div class="card"><h3>🤝 Share farms ${h(b.name)} is in</h3>${ins.map((s) => { const me = s.partners.find((p) => p.bid === b.id); return `<div class="kv"><div class="k"><b>${+me.pct || 0}%</b></div><div class="v"><span class="lnk" data-act="open" data-kind="business" data-id="${s.id}">${h(s.name)}</span><br><span class="hint">with ${h(sfPartners(s).filter((p) => p.bid !== b.id).map((p) => sfName(p.bid) + ' ' + p.pct + '%').join(', '))}</span></div></div>`; }).join('')}</div>`;
  if (!sfIs(b) && isClientBiz(b) && !ins.length) html += `<div class="actions" style="margin:4px 0 10px"><button class="btn small" data-act="sf-edit" data-bid="${b.id}">🤝 This is a share farm…</button></div>`;
  return html; }
window.sfBizCard = sfBizCard;
function sfRow(p) { return `<div class="sf-row" data-bid="${h(p.bid || '')}" style="display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap"><div style="flex:1 1 180px;min-width:0"><input class="sf-q" value="${h(p.bid ? sfName(p.bid) : '')}" autocomplete="off" aria-label="Partner business" style="width:100%;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px"><div class="sf-res"></div></div><input class="sf-pct" type="number" inputmode="decimal" min="0" max="100" step="0.01" value="${p.pct != null ? h(String(p.pct)) : ''}" aria-label="Percent" style="width:84px;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px"> %<button type="button" class="x" data-act="sf-rowdel" title="Remove">🗑️</button></div>`; }
async function sfEdit(bid, again) { const b = IDX.biz.get(bid); if (!b) return; const L = again || (sfPartners(b).length ? sfPartners(b) : [{ bid: '', pct: 50 }, { bid: '', pct: 50 }]); SF_LAST.rows = null; setTimeout(sfCapture, 60);
  const ok = await askBox('🤝 Share farm — ' + b.name, `<label class="bk-radio" style="display:flex;margin-bottom:6px"><input type="checkbox" data-askchk="on" ${sfIs(b) || !b.partners ? 'checked' : ''}> <b>${h(b.name)}</b> is a share farm (its invoices are split between partners)</label>
    <div class="f"><label>Partner businesses and their share of every invoice</label><div id="sf-rows">${L.map(sfRow).join('')}</div><button type="button" class="btn small" data-act="sf-rowadd">➕ Another partner</button><div class="hint">Search for each partner's own business (e.g. Avago Grazing, KM Farming). The shares must add up to 100%. A share can be changed on any one invoice.</div></div>`, 'Save');
  if (!ok) return; const on = !!ASK_FORM.on; // the ask box has closed: use the rows as they were last typed
  const got = SF_LAST.rows || []; const parts = got.filter((p) => p.bid && p.bid !== b.id);
  if (on) { const back = got.length ? got : L; if (parts.length < 2) { toast('Add at least two partner businesses (search and tap each one)'); return sfEdit(bid, back); } if (!sfPctOk(parts)) { toast(`The shares add up to ${parts.reduce((s, p) => s + p.pct, 0)}% — they must add up to 100%`); return sfEdit(bid, back); } if (new Set(parts.map((p) => p.bid)).size !== parts.length) { toast('A partner is in the list twice'); return sfEdit(bid, back); } }
  b.shareFarm = on || undefined; if (on) b.partners = parts; else delete b.partners; touch(b); NEXT_LOG_LABEL = on ? `${b.name} is a share farm: ${parts.map((p) => sfName(p.bid) + ' ' + p.pct + '%').join(', ')}` : `${b.name} is no longer a share farm`; S.skipConfirm = true; await changed(); toast(on ? 'Share farm saved' : 'No longer a share farm'); }
const SF_LAST = {};
// keep a copy of the rows as they are typed (the ask box is gone by the time it resolves)
document.addEventListener('input', (e) => { const t = e.target; if (!t.closest || !t.closest('#sf-rows')) return; sfCapture();
  if (t.classList.contains('sf-q')) { const row = t.closest('.sf-row'); row.dataset.bid = ''; sfCapture(); const box = row.querySelector('.sf-res'); const pq = parseQuery(t.value); if (!pq.inc.length) { box.innerHTML = ''; return; }
    const res = D.businesses.filter((x) => !x.gone && !sfIs(x) && matchQ(bizHay(x), pq)).slice(0, 8); box.innerHTML = `<div class="results">${res.map((x) => `<div data-act="sf-pick" data-bid="${x.id}"><b>${h(x.name)}</b></div>`).join('') || '<div class="hint">No matching businesses.</div>'}</div>`; } });
function sfCapture() { SF_LAST.rows = [...document.querySelectorAll('#sf-rows .sf-row')].map((r) => ({ bid: r.dataset.bid, pct: +r.querySelector('.sf-pct').value || 0 })); }

/* ---------- invoices ---------- */
// fix the split when an invoice is approved, so changing the share farm later doesn't change invoices already sent
{ const orig = crInvStatus; window.crInvStatus = async function (inv, to) { if (['approved', 'sent', 'paid'].includes(to) && inv && !inv.split && sfSplit(inv)) { inv.split = sfSplit(inv).map((p) => ({ ...p })); }
  if (to === 'paid' && inv && sfSplit(inv)) { inv.paidBy = inv.paidBy || {}; sfSplit(inv).forEach((p) => { if (!inv.paidBy[p.bid]) inv.paidBy[p.bid] = Date.now(); }); }
  if (to === 'sent' && inv && inv.status === 'paid' && inv.paidBy) delete inv.paidBy; return orig(inv, to); }; }
function sfInvCard(inv) { const parts = sfParts(inv); if (!parts) return ''; const st = inv.status; const canEdit = st !== 'paid';
  return `<div class="card sfcard"><h3><span class="sp">🤝 Split between the share farm partners</span>${canEdit ? `<button class="btn small" data-act="sf-invsplit" data-id="${inv.id}">Change the split…</button>` : ''}</h3>
    <div class="hint" style="margin-bottom:4px">Each partner gets their own copy (invoice ${h(inv.num || '…')}-1, -2…) showing the whole invoice and what they owe.${inv.splitOwn ? ' <b>This invoice has its own split.</b>' : ''}</div>
    ${parts.map((p) => { const em = crInvEmails(p.bid); return `<div class="kv" style="align-items:center;flex-wrap:wrap"><div class="k"><b>${p.pct}%</b></div><div class="v" style="flex:1"><span class="lnk" data-act="open" data-kind="business" data-id="${p.bid}">${h(sfName(p.bid))}</span> — <b>${crMoney(p.amt)}</b> <span class="hint">(${crMoney(p.sub)} + GST ${crMoney(p.gst)})</span><br><span class="hint">${em.length ? '📧 ' + h(em.join(', ')) : '<b style="color:var(--red)">No invoicing email</b>'}${p.paidAt ? ' · ✓ paid ' + new Date(p.paidAt).toLocaleDateString('en-AU') : ''}</span></div>
      <button class="btn small" data-act="sf-invpdf" data-id="${inv.id}" data-bid="${p.bid}">🖨 Their copy</button>${st === 'sent' ? (p.paidAt ? `<button class="btn small" data-act="sf-unpaid" data-id="${inv.id}" data-bid="${p.bid}">Not paid after all</button>` : `<button class="btn small greenbtn" data-act="sf-paid" data-id="${inv.id}" data-bid="${p.bid}">✓ ${h(sfName(p.bid))} paid</button>`) : ''}</div>`; }).join('')}</div>`; }
{ const orig = crInvHtml; window.crInvHtml = function (inv) { let html = orig(inv); if (!sfParts(inv)) return html; const card = sfInvCard(inv);
  html = html.replace(/<div class="kv"><div class="k">Invoices go to<\/div><div class="v">[\s\S]*?<\/div><\/div><\/div>/, `<div class="kv"><div class="k">Invoices go to</div><div class="v">🤝 Each partner — see below</div></div></div>`);
  const i = html.indexOf('<div class="card"><h3>Status</h3>'); return i < 0 ? html + card : html.slice(0, i) + card + html.slice(i); }; }
{ const orig = crInvRow; window.crInvRow = function (inv) { const html = orig(inv); const p = sfParts(inv); return p ? html.replace(' inc GST</span>', ` inc GST · 🤝 split ${h(sfPctTxt(p))}</span>`) : html; }; }
/* each partner's copy: the whole invoice, then their share and what they owe */
function sfInvBody(inv, part) { const b = IDX.biz.get(part.bid); const sf = IDX.biz.get(inv.bid); const tt = crInvTotals(inv); const fz = crFees(); const due = inv.sentAt ? new Date(inv.sentAt + fz.payDays * 864e5) : null; const r = crGet('crrec', inv.rec);
  const pf = crPfields(); const pats = r ? (r.patients || []).filter((p) => p.level !== 'herd').map((p) => (p.level === 'animal' ? pf.animal : pf.mob).filter((x) => x.inv && p[x.k]).map((x) => `${x.l}: ${p[x.k]}`).join(', ')).filter(Boolean) : [];
  const post = b && (b.postal || [])[0]; const others = sfParts(inv).filter((p) => p.bid !== part.bid);
  return `${crLetterhead('invoices')}<h1>Tax invoice${part.num ? ' ' + h(part.num) : ''}</h1><table><tr><th>Bill to</th><td>${h(crInvName(part.bid))}${post ? '<br>' + h(typeof post === 'string' ? post : post.value || post.address || '') : ''}</td><th>Date</th><td>${inv.date ? bkDate(inv.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}${due ? `<br>Due ${due.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}` : `<br>Due ${fz.payDays} days from the date sent`}</td></tr>
    <tr><th>Share farm</th><td colspan="3">${h(sf ? sf.name : '')} — your share is <b>${part.pct}%</b>${others.length ? ` (${h(others.map((p) => sfName(p.bid) + ' ' + p.pct + '%').join(', '))})` : ''}</td></tr>${pats.length ? `<tr><th>Animals</th><td colspan="3">${h(pats.join('; '))}</td></tr>` : ''}</table>
  <h2>Details — the whole invoice</h2><table><tr><th>Item</th><th class="num">Qty</th><th class="num">Price ex GST</th><th class="num">Amount ex GST</th></tr>${(inv.lines || []).map((l) => `<tr><td>${h(l.desc)}${crLineGst(l) ? '' : ' <i>(GST-free)</i>'}</td><td class="num">${l.qty}</td><td class="num">${crMoney(l.price)}</td><td class="num">${crMoney(l.qty * l.price)}</td></tr>`).join('')}
  <tr class="tot"><td colspan="3" class="num">Subtotal (ex GST)</td><td class="num">${crMoney(tt.sub)}</td></tr><tr class="tot"><td colspan="3" class="num">GST (10%)</td><td class="num">${crMoney(tt.gst)}</td></tr><tr class="tot"><td colspan="3" class="num">Whole invoice (inc GST)</td><td class="num">${crMoney(tt.total)}</td></tr></table>
  <h2>Your share</h2><table><tr><td>${part.pct}% of ${crMoney(tt.sub)} (ex GST)</td><td class="num">${crMoney(part.sub)}</td></tr><tr><td>GST (10%)</td><td class="num">${crMoney(part.gst)}</td></tr><tr class="tot"><td><b>Amount due from ${h(crInvName(part.bid))} (inc GST)</b></td><td class="num"><b>${crMoney(part.amt)}</b></td></tr></table>
  ${crBrand().payText ? `<h2>Payment</h2><pre>${h(crBrand().payText)}${part.num ? '\nReference: ' + h(part.num) : ''}</pre>` : ''}`; }
function sfInvDoc(inv, bid) { const parts = sfParts(inv).filter((p) => !bid || p.bid === bid);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Tax invoice ${h(inv.num || '')} — ${h(crInvName(inv.bid))}</title><style>${CR_PCSS}.sfbreak{page-break-after:always;break-after:page;height:0}</style></head><body>${parts.map((p) => sfInvBody(inv, p)).join('<div class="sfbreak"></div>')}</body></html>`; }
{ const orig = crInvoiceDoc; window.crInvoiceDoc = function (inv, bid) { return inv && sfParts(inv) ? sfInvDoc(inv, bid) : orig(inv); }; }
window.sfInvDoc = sfInvDoc;
function sfInvText(inv, p) { return `Hi ${crInvName(p.bid)},\n\nPlease find attached invoice ${p.num || inv.num || ''} for the ${sfName(inv.bid)} share farm. The whole invoice is ${crMoney(crInvTotals(inv).total)} (inc GST); your share is ${p.pct}%, so the amount due from you is ${crMoney(p.amt)} (inc GST). Payment is due within ${crFees().payDays} days.\n\nKind regards,\n${(crBrand().lines || [])[0] || 'Bovitech Veterinary Services'}`; }
async function sfSend(inv) { const parts = sfParts(inv); const miss = parts.filter((p) => !crInvEmails(p.bid).length); if (miss.length) { toast(`Add an invoicing email to ${miss.map((p) => sfName(p.bid)).join(' and ')} first`); return; }
  if (!await askBox('Send to each partner', `<p>Each partner is emailed their own copy:</p>${parts.map((p) => `<div class="kv"><div class="k">${p.pct}%</div><div class="v"><b>${h(sfName(p.bid))}</b> — ${crMoney(p.amt)}<br><span class="hint">${h(crInvEmails(p.bid).join(', '))}</span></div></div>`).join('')}`, '📧 Send them', false, 'Cancel')) return;
  let sent = 0; for (const p of parts) { let ok = false; if (typeof emlBuild === 'function') { const em = crInvEmails(p.bid); const m = emlBuild(null, 'sharefarm', { 'client name': crInvName(p.bid), 'first name': emlFirstName(p.bid, em), 'share farm': sfName(inv.bid), 'invoice number': p.num || inv.num || '', 'invoice total': crMoney(crInvTotals(inv).total), 'share percent': p.pct + '%', 'amount due': crMoney(p.amt), 'pay days': String(crFees().payDays), invoice: { text: sfInvText(inv, p), html: sfInvDoc(inv, p.bid).replace(/^[\s\S]*<body>|<\/body>[\s\S]*$/g, '') } });
      const r = await emlPost({ to: em, cc: m.cc, subject: m.subject, html: m.html, text: m.text }); ok = r.ok; if (ok) emlLog({ use: 'sharefarm', tpl: m.t.id, to: em, subject: m.subject, bid: p.bid }); }
    else { try { const r = await sbFetch('/functions/v1/mail', { method: 'POST', body: JSON.stringify({ k: Dev.k(), to: crInvEmails(p.bid), cc: ['office@bovitech.com.au'], subject: `Invoice ${p.num || inv.num || ''} — ${sfName(inv.bid)} share farm — Bovitech Veterinary Services`, html: sfInvDoc(inv, p.bid).replace(/^[\s\S]*<body>|<\/body>[\s\S]*$/g, ''), text: sfInvText(inv, p) }) }); ok = r.ok; } catch (x) { ok = false; } } if (ok) { sent++; crInvLog(inv, `Sent to ${sfName(p.bid)} (${p.pct}%)`); } }
  if (sent < parts.length) { crPrint(sfInvDoc(inv)); const p0 = parts[0]; const all = parts.flatMap((p) => crInvEmails(p.bid));
    location.href = `mailto:${all.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(`Invoice ${inv.num || ''} — ${sfName(inv.bid)} share farm`)}&body=${encodeURIComponent(parts.map((p) => sfInvText(inv, p)).join('\n\n— — —\n\n'))}`;
    toast("The app can't send email yet (Admin jobs → Email from the app) — save the PDF (one page per partner) and attach it"); if (p0 && !(await ask('Mark the invoice as sent?', 'Yes — sent'))) return; }
  else toast(`Sent to ${sent} partners`);
  if (inv.status === 'approved') await crInvStatus(inv, 'sent'); else { crSave(inv); Sync.soon(); renderAll(); } }
async function sfInvSplit(inv) { const L = sfParts(inv).map((p) => ({ bid: p.bid, pct: p.pct }));
  const ok = await askBox('Change the split for this invoice', `<p class="hint">Only this invoice changes — the share farm's usual split stays the same. E.g. put one partner at 100% if they're paying for this job on their own.</p>${L.map((p, i) => `<div class="kv" style="align-items:center"><div class="v" style="flex:1"><b>${h(sfName(p.bid))}</b></div><input data-ask="p${i}" type="number" inputmode="decimal" min="0" max="100" step="0.01" value="${p.pct}" style="width:90px;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px" aria-label="Percent for ${h(sfName(p.bid))}"> %</div>`).join('')}`, 'Save', false, 'Cancel', inv.splitOwn ? '↺ Back to the share farm\'s split' : '');
  if (!ok) return; if (ok === 'alt') { delete inv.split; delete inv.splitOwn; if (['approved', 'sent'].includes(inv.status)) inv.split = sfSplit(inv).map((p) => ({ ...p })); crInvLog(inv, 'Split back to the share farm\'s usual split'); crSave(inv); Sync.soon(); renderAll(); return; }
  const nw = L.map((p, i) => ({ bid: p.bid, pct: +ASK_FORM['p' + i] || 0 })); if (Math.abs(nw.reduce((s, p) => s + p.pct, 0) - 100) > 0.01) { toast('The shares must add up to 100%'); return; }
  inv.split = nw; inv.splitOwn = true; crInvLog(inv, 'Split changed: ' + nw.map((p) => sfName(p.bid) + ' ' + p.pct + '%').join(', ')); crSave(inv); Sync.soon(); renderAll(); }
/* who gets a share farm's texts: the people ticked on it, else each partner's own (their primary contact) */
{ const orig = bkSmsTo; window.bkSmsTo = function (bid) { const b = IDX.biz && IDX.biz.get(bid); if (sfIs(b)) { const x = Bk.bsched(bid); const cur = (IDX.bizContacts && IDX.bizContacts.get(bid)) || []; const t = (x.smsTo || []).filter((cid) => cur.some((c) => c.id === cid)); if (t.length) return t; const all = [...new Set(sfPartners(b).flatMap((p) => orig(p.bid)))]; if (all.length) return all; } return orig(bid); }; }

document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act, d = el.dataset;
  if (a === 'cr-isend' && typeof CR !== 'undefined' && CR.page === 'inv') { const inv = crGet('crinv', CR.id); if (inv && sfParts(inv)) { e.stopImmediatePropagation(); sfSend(inv); } return; }
  if (!/^sf-/.test(a)) return;
  if (a === 'sf-edit') sfEdit(d.bid);
  if (a === 'sf-rowadd') { document.getElementById('sf-rows').insertAdjacentHTML('beforeend', sfRow({ bid: '', pct: '' })); sfCapture(); }
  if (a === 'sf-rowdel') { el.closest('.sf-row').remove(); sfCapture(); }
  if (a === 'sf-pick') { const row = el.closest('.sf-row'); row.dataset.bid = d.bid; row.querySelector('.sf-q').value = sfName(d.bid); row.querySelector('.sf-res').innerHTML = ''; sfCapture(); }
  if (a === 'sf-invpdf') crPrint(sfInvDoc(crGet('crinv', d.id), d.bid));
  if (a === 'sf-invsplit') { const inv = crGet('crinv', d.id); if (inv) sfInvSplit(inv); }
  if (a === 'sf-paid' || a === 'sf-unpaid') { const inv = crGet('crinv', d.id); if (!inv) return; inv.paidBy = { ...(inv.paidBy || {}) }; if (a === 'sf-paid') { inv.paidBy[d.bid] = Date.now(); crInvLog(inv, `${sfName(d.bid)} paid their share`); } else { delete inv.paidBy[d.bid]; crInvLog(inv, `${sfName(d.bid)} not paid after all`); }
    const parts = sfParts(inv); if (inv.status === 'sent' && parts.every((p) => inv.paidBy[p.bid])) { await crInvStatus(inv, 'paid'); toast('All partners have paid — invoice paid'); } else if (inv.status === 'paid' && a === 'sf-unpaid') { const keep = { ...inv.paidBy }; await crInvStatus(inv, 'sent'); inv.paidBy = keep; crSave(inv); } else { crSave(inv); Sync.soon(); renderAll(); } }
}, true);
