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
/* v2.53: a sharefarm is its own entry (sfEntry) linking member businesses; the members each show its records and invoices (their share) */
const sfEntryIs = (b) => !!(b && b.shareFarm && b.sfEntry);
const sfLegacy = (b) => !!(b && b.shareFarm && !b.sfEntry); /* the old "This is a share farm" tick on a business that also farms in its own right — the "Set up sharefarms" job converts it */
const sfLink = (bid) => `<span class="lnk" data-act="open" data-kind="business" data-id="${h(bid)}">${h(sfName(bid))}</span>`;
const sfPats = (sf) => (sf.patientIds || []).filter((p) => !p.inactive);
function sfMemberRecs(bid) { const ids = new Set(sfOfPartner(bid).map((x) => x.id)); return typeof crList === 'function' ? crList('crrec').filter((r) => !r.gone && ids.has(r.bid)).sort((a, c) => String(c.date || '').localeCompare(String(a.date || ''))) : []; }
function sfMemberInvs(bid) { if (typeof crList !== 'function') return []; return crList('crinv').filter((inv) => !inv.gone && inv.bid !== bid && (sfParts(inv) || []).some((p) => p.bid === bid)).sort((a, c) => String(c.date || '').localeCompare(String(a.date || ''))); }
function sfBizCard(b) { if (!b || b.gone) return ''; const ins = sfOfPartner(b.id);
  let html = '';
  if (sfIs(b)) { const L = sfPartners(b); const ok = sfPctOk(L);
    html += `<div class="card sfcard" data-sec="sfshares"><h3><span class="sp">🤝 Sharefarm — members and shares</span><button class="btn small" data-act="sf-edit" data-bid="${b.id}">${sfLegacy(b) ? 'Set it up…' : 'Members and shares…'}</button></h3>
      ${sfLegacy(b) ? `<div class="sf-warn">This business has the old "This is a share farm" tick. If ${h(b.name)} also farms in its own right, make the sharefarm its own entry — tap <b>Set it up…</b> (or the job "Set up sharefarms").</div>` : ''}
      <div class="hint" style="margin-bottom:4px">The sharefarm's own herds and flocks are under Patients. Every invoice is split between the members below — each gets their own copy showing every line and their share, and it goes on their statement. Its records and invoices also show on each member's page.</div>
      ${L.map((p) => `<div class="kv"><div class="k"><b>${+p.pct || 0}%</b></div><div class="v">${sfLink(p.bid)}</div></div>`).join('') || '<div class="hint">No members yet — tap Members and shares… to add them.</div>'}
      ${L.length && !ok ? `<div class="sf-warn">⚠ The shares add up to ${L.reduce((s, p) => s + (+p.pct || 0), 0)}% — they must add up to 100%.</div>` : ''}</div>`; }
  if (ins.length) html += `<div class="card sfcard" data-sec="sfmember"><h3><span class="sp">🤝 Sharefarms ${h(b.name)} is in (${ins.length})</span></h3>${ins.map((s) => { const me = s.partners.find((p) => p.bid === b.id); const pats = sfPats(s);
    return `<div class="sf-in"><div class="kv"><div class="k"><b>${+me.pct || 0}%</b></div><div class="v">${sfLink(s.id)}<br><span class="hint">with ${sfPartners(s).filter((p) => p.bid !== b.id).map((p) => sfLink(p.bid) + ' ' + h(String(p.pct)) + '%').join(', ')}</span></div></div>
      ${pats.length ? `<div class="hint" style="margin:2px 0 2px 8px">Shared herds and flocks:</div>${pats.map((p) => `<div class="kv bk-tap" data-act="pt-open" data-k="${h(s.id + '|' + p.value)}" data-go="1" style="align-items:center;margin-left:8px"><div class="k">${typeof pidEmo === 'function' ? pidEmo(p) : ''}${h(p.label || 'ID')}</div><div class="v" style="flex:1">${h(p.value)}</div></div>`).join('')}` : '<div class="hint" style="margin-left:8px">No shared herds or flocks yet.</div>'}</div>`; }).join('')}</div>`;
  if (ins.length) { const R = sfMemberRecs(b.id); html += `<div class="card sfcard" data-sec="sfrecs"><h3><span class="sp">📋 🤝 Sharefarm clinical records (${R.length})</span></h3><div class="hint" style="margin-bottom:4px">Records for the shared herds and flocks — the same records as on the sharefarm's page.</div>${R.slice(0, 20).map((r) => `<div class="sf-mirror">🤝 Sharefarm with ${h(sfPartners(IDX.biz.get(r.bid) || {}).filter((p) => p.bid !== b.id).map((p) => sfName(p.bid)).join(', '))}</div>${typeof crRecRow === 'function' ? crRecRow(r) : ''}`).join('') || '<div class="hint">No sharefarm records yet.</div>'}${R.length > 20 ? `<div class="hint">…and ${R.length - 20} older — see the sharefarm's page.</div>` : ''}</div>`;
    const I = sfMemberInvs(b.id); if (I.length) html += `<div class="card sfcard" data-sec="sfinvs"><h3><span class="sp">🧾 🤝 Sharefarm invoices — ${h(b.name)}'s share (${I.length})</span></h3>${I.slice(0, 20).map((inv) => { const p = sfParts(inv).find((x) => x.bid === b.id); return `<div class="sf-mirror">🤝 ${h(sfName(inv.bid))} — ${h(b.name)}'s share: <b>${p.pct}% = ${crMoney(p.amt)}</b>${p.num ? ' · ' + h(p.num) : ''}${p.paidAt ? ' · ✓ paid' : ''}</div>${typeof crInvRow === 'function' ? crInvRow(inv) : ''}`; }).join('')}</div>`; }
  if (!sfIs(b) && isClientBiz(b)) html += `<div class="actions" style="margin:4px 0 10px"><button class="btn small" data-act="sf-new" data-bid="${b.id}">🤝 Set up a sharefarm with other businesses…</button></div>`;
  return html; }
window.sfBizCard = sfBizCard;
function sfRow(p) { return `<div class="sf-row" data-bid="${h(p.bid || '')}" style="display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap"><div style="flex:1 1 180px;min-width:0"><input class="sf-q" value="${h(p.bid ? sfName(p.bid) : '')}" autocomplete="off" aria-label="Partner business" style="width:100%;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px"><div class="sf-res"></div></div><input class="sf-pct" type="number" inputmode="decimal" min="0" max="100" step="0.01" value="${p.pct != null ? h(String(p.pct)) : ''}" aria-label="Percent" style="width:84px;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px"> %<button type="button" class="x" data-act="sf-rowdel" title="Remove">🗑️</button></div>`; }
async function sfEdit(bid, again) { const b = IDX.biz.get(bid); if (!b) return; if (!b.sfEntry) return sfSetup(bid); /* v2.53: the old tick → its own sharefarm entry */ const L = again || (sfPartners(b).length ? sfPartners(b) : [{ bid: '', pct: 50 }, { bid: '', pct: 50 }]); SF_LAST.rows = null; setTimeout(sfCapture, 60);
  const ok = await askBox('🤝 Sharefarm — members and shares', `${sfNameField(b.name)}
    <div class="f"><label>Member businesses and their share of every invoice</label><div id="sf-rows">${L.map(sfRow).join('')}</div><button type="button" class="btn small" data-act="sf-rowadd">➕ Another member</button><div class="hint">Search for each member's own business. The shares must add up to 100%. A share can be changed on any one invoice.</div></div>`, 'Save');
  if (!ok) return; const on = true; const nm = (ASK_FORM.sfname || '').trim(); if (nm && nm !== b.name) { b.name = nm; } // the ask box has closed: use the rows as they were last typed
  const got = SF_LAST.rows || []; const parts = got.filter((p) => p.bid && p.bid !== b.id);
  if (on) { const back = got.length ? got : L; if (parts.length < 2) { toast('Add at least two partner businesses (search and tap each one)'); return sfEdit(bid, back); } if (!sfPctOk(parts)) { toast(`The shares add up to ${parts.reduce((s, p) => s + p.pct, 0)}% — they must add up to 100%`); return sfEdit(bid, back); } if (new Set(parts.map((p) => p.bid)).size !== parts.length) { toast('A partner is in the list twice'); return sfEdit(bid, back); } }
  if (!(await ask(`Save ${h(b.name)}: ${h(parts.map((p) => sfName(p.bid) + ' ' + p.pct + '%').join(', '))}?`, 'Save'))) return;
  b.shareFarm = true; b.sfEntry = true; b.partners = parts; touch(b); NEXT_LOG_LABEL = `${b.name} (sharefarm): ${parts.map((p) => sfName(p.bid) + ' ' + p.pct + '%').join(', ')}`; S.skipConfirm = true; await changed(); toast('Sharefarm saved'); }
const SF_LAST = {};
// keep a copy of the rows as they are typed (the ask box is gone by the time it resolves)
document.addEventListener('input', (e) => { const t = e.target; if (!t.closest || !t.closest('#sf-rows')) return; sfCapture();
  if (t.classList.contains('sf-q')) { const row = t.closest('.sf-row'); row.dataset.bid = ''; sfCapture(); const box = row.querySelector('.sf-res'); const pq = parseQuery(t.value); if (!pq.inc.length) { box.innerHTML = ''; return; }
    const res = D.businesses.filter((x) => !x.gone && !x.sfEntry && matchQ(bizHay(x), pq)).slice(0, 8); box.innerHTML = `<div class="results">${res.map((x) => `<div data-act="sf-pick" data-bid="${x.id}"><b>${h(x.name)}</b></div>`).join('') || '<div class="hint">No matching businesses.</div>'}</div>`; } });
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
  <h2>Details — every line, and your ${part.pct}% share of it</h2><table><tr><th>Item</th><th class="num">Qty</th><th class="num">Price ex GST</th><th class="num">Whole amount ex GST</th><th class="num">Your share ex GST</th></tr>${(inv.lines || []).map((l, i) => `<tr><td>${h(l.desc)}${crLineGst(l) ? '' : ' <i>(GST-free)</i>'}<br><i>${part.pct}% share of ${crMoney(l.qty * l.price)}</i></td><td class="num">${l.qty}</td><td class="num">${crMoney(l.price)}</td><td class="num">${crMoney(l.qty * l.price)}</td><td class="num">${crMoney(sfLineShares(inv, part)[i])}</td></tr>`).join('')}
  <tr class="tot"><td colspan="3" class="num">Subtotal (ex GST)</td><td class="num">${crMoney(tt.sub)}</td><td class="num">${crMoney(part.sub)}</td></tr><tr class="tot"><td colspan="3" class="num">GST (10%)</td><td class="num">${crMoney(tt.gst)}</td><td class="num">${crMoney(part.gst)}</td></tr><tr class="tot"><td colspan="3" class="num">Total (inc GST)</td><td class="num">${crMoney(tt.total)}</td><td class="num"><b>${crMoney(part.amt)}</b></td></tr></table>
  <h2>Your share</h2><table><tr><td>${part.pct}% of ${crMoney(tt.sub)} (ex GST)</td><td class="num">${crMoney(part.sub)}</td></tr><tr><td>GST (10%)</td><td class="num">${crMoney(part.gst)}</td></tr><tr class="tot"><td><b>Amount due from ${h(crInvName(part.bid))} (inc GST)</b></td><td class="num"><b>${crMoney(part.amt)}</b></td></tr></table>
  ${crBrand().payText ? `<h2>Payment</h2><pre>${h(crBrand().payText)}${part.num ? '\nReference: ' + h(part.num) : ''}</pre>` : ''}`; }
/* v2.53: each line's share for one member — rounded to the cent, with the cents left over put on the biggest line so the lines add up to their share */
function sfLineShares(inv, part) { const L = inv.lines || []; const f = (+part.pct || 0) / 100; const out = L.map((l) => crR2((+l.qty || 0) * (+l.price || 0) * f)); const diff = crR2(part.sub - out.reduce((a, b) => a + b, 0));
  if (diff && out.length) { let bi = 0; L.forEach((l, i) => { if (Math.abs((+l.qty || 0) * (+l.price || 0)) > Math.abs((+L[bi].qty || 0) * (+L[bi].price || 0))) bi = i; }); out[bi] = crR2(out[bi] + diff); } return out; }
window.sfLineShares = sfLineShares;
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

/* ================= v2.53: a sharefarm as its own entry ================= */
const sfNameField = (v) => `<div class="f"><label for="sf-name">Sharefarm name</label><input id="sf-name" data-ask="sfname" value="${h(v || '')}" style="width:100%;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px"><div class="hint">Leave it empty to use the members' names, e.g. "Business A / Business B sharefarm".</div></div>`;
const sfAutoName = (parts) => parts.map((p) => sfName(p.bid)).join(' / ') + ' sharefarm';
/* the members and shares box (also used to convert the old tick) → { name, parts } or null */
async function sfMembersBox(title, rows, name, intro) { SF_LAST.rows = null; setTimeout(sfCapture, 60);
  const ok = await askBox(title, `${intro || ''}${sfNameField(name)}<div class="f"><label>Member businesses and their share of every invoice</label><div id="sf-rows">${rows.map(sfRow).join('')}</div><button type="button" class="btn small" data-act="sf-rowadd">➕ Another member</button><div class="hint">Search for each member's own business. The shares must add up to 100%. A share can be changed on any one invoice.</div></div>`, 'Next');
  if (!ok) return null; const nm = (ASK_FORM.sfname || '').trim(); const got = SF_LAST.rows || []; const parts = got.filter((p) => p.bid);
  const back = got.length ? got : rows;
  if (parts.length < 2) { toast('Add at least two member businesses (search and tap each one)'); return sfMembersBox(title, back, nm, intro); }
  if (new Set(parts.map((p) => p.bid)).size !== parts.length) { toast('A member is in the list twice'); return sfMembersBox(title, back, nm, intro); }
  if (!sfPctOk(parts)) { toast(`The shares add up to ${parts.reduce((s, p) => s + p.pct, 0)}% — they must add up to 100%`); return sfMembersBox(title, back, nm, intro); }
  return { name: nm || sfAutoName(parts), parts }; }
/* make a new sharefarm entry (from a member's page, or converting the old tick on a business) */
async function sfSetup(legacyBid, fromBid) { const lg = legacyBid ? IDX.biz.get(legacyBid) : null; const from = fromBid ? IDX.biz.get(fromBid) : null;
  if (lg && lg.sfEntry) return sfEdit(lg.id);
  let rows;
  if (lg) { const P = sfPartners(lg); const ch = await askBox('🤝 Set up the sharefarm — ' + lg.name, `<p>${h(lg.name)} has the old "This is a share farm" tick${P.length ? ` (with ${h(P.map((p) => sfName(p.bid) + ' ' + p.pct + '%').join(', '))})` : ''}.</p>
      <div class="f"><label for="sf-how">What is ${h(lg.name)}?</label><select id="sf-how" data-ask="how" style="width:100%"><option value="sep">It farms in its own right too — make the sharefarm its own entry</option><option value="only">It is only the sharefarm — keep it as the sharefarm entry</option></select></div>
      <div class="hint">Its own herds, records and invoices stay with ${h(lg.name)}. Next you choose the members and their shares, then which herds and farms belong to the sharefarm.</div>`, 'Next');
    if (!ch) return; if (ASK_FORM.how === 'only') { if (!(await ask(`Keep ${h(lg.name)} as the sharefarm entry, split between ${h(P.map((p) => sfName(p.bid)).join(' and ') || 'its members')}?`, 'Yes'))) return; lg.sfEntry = true; touch(lg); if (typeof JOBS_CACHE !== 'undefined') JOBS_CACHE = null; NEXT_LOG_LABEL = `${lg.name} kept as a sharefarm entry`; S.skipConfirm = true; await changed(); toast('✓ Sharefarm entry'); return; }
    rows = [...(P.some((p) => p.bid === lg.id) ? [] : [{ bid: lg.id, pct: '' }]), ...P.map((p) => ({ bid: p.bid, pct: p.pct }))]; }
  else rows = [{ bid: from ? from.id : '', pct: 50 }, { bid: '', pct: 50 }];
  const M = await sfMembersBox('🤝 New sharefarm — members and shares', rows, '', lg ? `<p class="hint">The members are the businesses that share the farming — e.g. ${h(lg.name)} and its partners.</p>` : ''); if (!M) return;
  /* which herds / flocks and farms are the sharefarm's (nothing is guessed) */
  const pats = [], farms = []; M.parts.forEach((p) => { const b = IDX.biz.get(p.bid); if (!b) return; (b.patientIds || []).filter((x) => !x.inactive).forEach((x) => pats.push({ b, p: x })); (b.farms || []).forEach((f) => { if (!farms.some((y) => y.f.id === f.id)) farms.push({ b, f }); }); });
  const ok2 = await askBox('🤝 ' + M.name + ' — herds and farms', `<div class="lbl">Herds and flocks that belong to the sharefarm</div><div class="hint">Ticked ones move to the sharefarm. Their records so far stay where they are.</div>${pats.map((x, i) => `<label class="bk-radio" style="display:flex"><input type="checkbox" data-askchk="p${i}"> ${typeof pidEmo === 'function' ? pidEmo(x.p) : ''}${h(x.p.label || 'ID')} ${h(x.p.value)} <span class="hint">— ${h(x.b.name)}</span></label>`).join('') || '<div class="hint">None of the members have herds or flocks yet — add them to the sharefarm later.</div>'}
    <div class="lbl" style="margin-top:8px">Farms the sharefarm uses</div><div class="hint">The farm stays owned by its business; the sharefarm uses it.</div>${farms.map((x, i) => `<label class="bk-radio" style="display:flex"><input type="checkbox" data-askchk="f${i}"> ${h(x.f.name || x.f.address || 'Farm')} <span class="hint">— ${h(x.b.name)}</span></label>`).join('') || '<div class="hint">No farms yet.</div>'}`, 'Next');
  if (!ok2) return; const P2 = pats.filter((x, i) => ASK_FORM['p' + i]); const F2 = farms.filter((x, i) => ASK_FORM['f' + i]);
  if (!(await ask(`Make <b>${h(M.name)}</b>?<br>Members: ${h(M.parts.map((p) => sfName(p.bid) + ' ' + p.pct + '%').join(', '))}<br>Herds and flocks moving to it: ${P2.length ? h(P2.map((x) => (x.p.label || '') + ' ' + x.p.value).join(', ')) : 'none'}<br>Farms it uses: ${F2.length ? h(F2.map((x) => x.f.name || x.f.address || 'Farm').join(', ')) : 'none'}${lg ? `<br>The old "share farm" tick comes off ${h(lg.name)}.` : ''}`, 'Make the sharefarm'))) return;
  const sf = { id: uid('b'), name: M.name, type: 'client', shareFarm: true, sfEntry: true, partners: M.parts.map((p) => ({ bid: p.bid, pct: +p.pct || 0 })), farmLinks: [], pics: [], patientIds: [], phones: [], emails: [], postal: [], info: '', warnings: '', flags: [], rating: null, cats: [], createdAt: Date.now() };
  P2.forEach((x) => { x.b.patientIds = (x.b.patientIds || []).filter((y) => y !== x.p); sf.patientIds.push({ ...x.p }); touch(x.b); });
  D.businesses.push(sf); F2.forEach((x) => linkFarm(sf, x.f)); touch(sf);
  if (lg) { delete lg.shareFarm; delete lg.partners; touch(lg); }
  if (typeof reindex === 'function') reindex(); if (typeof JOBS_CACHE !== 'undefined') JOBS_CACHE = null;
  NEXT_LOG_LABEL = `Sharefarm made: ${M.name} (${M.parts.map((p) => sfName(p.bid) + ' ' + p.pct + '%').join(', ')})`; S.skipConfirm = true; await changed(); toast('✓ ' + M.name + ' made');
  const go = document.createElement('button'); go.dataset.act = 'open'; go.dataset.kind = 'business'; go.dataset.id = sf.id; go.hidden = true; document.body.appendChild(go); go.click(); go.remove(); return sf; }
window.sfSetup = sfSetup; window.sfEntryIs = sfEntryIs; window.sfLegacy = sfLegacy; window.sfMemberRecs = sfMemberRecs; window.sfMemberInvs = sfMemberInvs;
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=sf-new],[data-act=sf-mig]'); if (!el) return; e.preventDefault(); e.stopImmediatePropagation(); if (el.dataset.act === 'sf-new') sfSetup(null, el.dataset.bid); else sfSetup(el.dataset.bid); }, true);
