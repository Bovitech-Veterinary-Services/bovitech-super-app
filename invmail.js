/* Bovitech Super App — v2.29: invoices and overdue reminders on templates.
   • 📧 Send to the client (an approved invoice) opens the email composer with the "Invoice" template — the invoice is in the email itself,
     to the business's invoicing emails (change them if needed). Sent → the invoice is marked sent.
   • Finance → Overdue → 📧 Send a reminder: the "Overdue reminder" email template, or 📲 a text from the office number
     (the "Overdue invoice reminder" text template). Either one is recorded on the invoice.
   • Both email templates are in Settings → Templates (Email templates) to change the wording. */
if (typeof EML_USES !== 'undefined') { EML_USES.invoice = 'Invoices'; EML_USES.overdue = 'Overdue reminders'; }
if (typeof EML_FILLS !== 'undefined') { EML_FILLS.invoice = ['invoice number', 'invoice total', 'due date', 'pay days', 'invoice']; EML_FILLS.overdue = ['invoice number', 'invoice total', 'amount owing', 'sent date', 'days overdue']; }
const IM_TPLS = [
  { id: 'et-inv', use: 'invoice', name: 'Invoice', cc: 'office@bovitech.com.au', subject: 'Invoice {invoice number} — Bovitech Veterinary Services',
    body: 'Hi {first name},\n\nPlease find invoice {invoice number} below, for {invoice total} (inc GST). Payment is due by {due date} ({pay days} days).\n\nIf you have any questions, please call us on {practice phone}.\n\nKind regards,\nBovitech Veterinary Services\n\n{invoice}', req: [] },
  { id: 'et-over', use: 'overdue', name: 'Overdue reminder', cc: 'office@bovitech.com.au', subject: 'Overdue invoice {invoice number} — Bovitech Veterinary Services',
    body: 'Hi {first name},\n\nThis is a friendly reminder that invoice {invoice number} for {amount owing} (inc GST), sent on {sent date}, is now overdue. If you\'ve already paid, thank you and please ignore this.\n\nIf you have any questions, please call us on {practice phone}.\n\nKind regards,\nBovitech Veterinary Services', req: [] }];
if (typeof EML_DEFAULTS !== 'undefined') IM_TPLS.forEach((t) => { if (!EML_DEFAULTS.some((x) => x.id === t.id)) EML_DEFAULTS.push(t); });
if (typeof SMS_TPL_SEED !== 'undefined' && !SMS_TPL_SEED.some((x) => x.id === 'sms-h-overdue')) SMS_TPL_SEED.push({ id: 'sms-h-overdue', cfg: 'sms', order: 14, use: 'other', name: 'Overdue invoice reminder', text: 'Hi {first}, a friendly reminder that invoice {invoice} for {amount} (sent {sent}) is now overdue. If you have already paid, thank you, please ignore this.' });
function imSeed() { if (!D || !D.sync || !D.sync.last || typeof emlRec !== 'function') return; const r = emlRec(); if (!r || !Array.isArray(r.list)) return; const miss = IM_TPLS.filter((t) => !r.list.some((x) => x.id === t.id) && !(r.imSeeded || []).includes(t.id)); if (!miss.length) return;
  emlSave((x) => { miss.forEach((t) => x.list.push(bkClone(t))); x.imSeeded = [...new Set([...(x.imSeeded || []), ...miss.map((t) => t.id)])]; }); }
setTimeout(imSeed, 4000); setInterval(imSeed, 60000);
/* did a text go (any 📲 queued while the reminder box was open) */
const IM_SMS = { n: 0 };
sbFetch = (function (orig) { return async function (path) { const r = await orig.apply(this, arguments); if (path === '/rest/v1/rpc/sms_queue' && r && r.ok !== false) IM_SMS.n++; return r; }; })(sbFetch);
const imDate = (t) => (t ? new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
function imInvVals(inv, bid) { const tt = crInvTotals(inv); const fz = crFees(); const sp = bid && bid !== inv.bid && typeof sfParts === 'function' && sfParts(inv) ? sfParts(inv).find((p) => p.bid === bid) : null;
  const doc = crInvoiceDoc(inv).replace(/^[\s\S]*<body>|<\/body>[\s\S]*$/g, ''); const due = inv.sentAt ? inv.sentAt + fz.payDays * 864e5 : Date.now() + fz.payDays * 864e5; const amt = sp ? sp.amt : tt.total;
  return { 'client name': crInvName(sp ? bid : inv.bid), 'invoice number': (sp ? sp.num : inv.num) || '', 'invoice total': crMoney(tt.total), 'amount owing': crMoney(amt), 'due date': imDate(due), 'pay days': String(fz.payDays), 'sent date': imDate(inv.sentAt), 'days overdue': String(Math.max(0, Math.floor((Date.now() - due) / 864e5))), invoice: { text: '', html: doc } }; }
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=cr-isend],[data-act=cr-remind]'); if (!el || typeof emlCompose !== 'function') return; e.stopPropagation(); e.preventDefault();
  if (el.dataset.act === 'cr-isend') { const inv = CR.page === 'inv' ? crGet('crinv', CR.id) : null; if (!inv) return;
    await emlCompose({ use: 'invoice', bid: inv.bid, invOnly: true, rec: inv.rec || null, V: imInvVals(inv), title: '📧 Invoice ' + (inv.num || '') + ' — ' + crInvName(inv.bid), onSent: async (inf) => { if (!inf || inf.ok === false) return; crInvLog(inv, 'Emailed to ' + (inf.to || []).join(', ')); if (inv.status === 'approved') await crInvStatus(inv, 'sent'); else { crSave(inv); Sync.soon(); renderAll(); } } }); return; }
  const iv = crGet('crinv', el.dataset.id); if (!iv) return; const rb = el.dataset.bid || iv.bid; const V = imInvVals(iv, rb);
  const how = await askBox('Send a reminder — ' + crInvName(rb), `<p>Invoice ${h(V['invoice number'])} for ${h(V['amount owing'])}, sent ${h(V['sent date'])} (${h(V['days overdue'])} days overdue).</p>`, '📧 Email', false, 'Cancel', '📲 Text from the office');
  const mark = (via) => { iv.reminders = [...(iv.reminders || []), { at: Date.now(), by: crMe(), via }]; crInvLog(iv, 'Reminder sent (' + via + ')'); crSave(iv); Sync.soon(); renderAll(); };
  if (how === 'alt') { const t = (Bk.get('sms-h-overdue') || {}).text || 'Hi {first}, a friendly reminder that invoice {invoice} for {amount} (sent {sent}) is now overdue. If you have already paid, thank you, please ignore this.';
    const body = t.replace(/\{invoice\}/g, V['invoice number']).replace(/\{amount\}/g, V['amount owing']).replace(/\{sent\}/g, V['sent date']); IM_SMS.n = 0; await smsCompose({ bid: rb }, { body }); setTimeout(() => { if (IM_SMS.n) mark('text'); }, 300); return; }
  if (!how) return; await emlCompose({ use: 'overdue', bid: rb, invOnly: true, V, title: '📧 Overdue reminder — ' + crInvName(rb), onSent: (inf) => { if (inf && inf.ok !== false) mark('email'); } }); }, true);
window.imInvVals = imInvVals; window.imSeed = imSeed;
