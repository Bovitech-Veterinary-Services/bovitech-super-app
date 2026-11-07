/* Bovitech Super App — the ezyVet import (admin only), the ezyVet history (read-only, kept in the practice
   database) and searching clinical records (new ones and the old ezyVet ones).
   The import reads ezyVet's backup zip on this device. Nothing is changed until you tap "Import now". */
'use strict';
const EZ = { plan: null, busy: false, log: [], q: '', from: '', to: '', who: '', scope: 'all', res: null, resQ: '', view: null, hist: {}, histQ: {} };
const EZ_KINDS = [['consult', 'Consults'], ['invoice', 'Invoices'], ['payment', 'Payments'], ['comm', 'Messages'], ['doc', 'Documents and files'], ['memo', 'Memos']];
const ezTabOf = (k) => (k === 'file' ? 'doc' : k); // files show with the documents
const ezKindName = (k) => (EZ_KINDS.find((x) => x[0] === k) || [, k])[1];
const ezOne = { consult: 'Consult', invoice: 'Invoice', payment: 'Payment', comm: 'Message', doc: 'Document', memo: 'Memo', file: 'File' };

/* ---------- reading the zip ---------- */
function ezCsv(text) { // RFC 4180: quoted fields, "" inside quotes, new lines inside quotes
  const rows = []; let row = [], f = '', q = false; const n = text.length;
  for (let i = 0; i < n; i++) { const c = text.charCodeAt(i);
    if (q) { if (c === 34) { if (text.charCodeAt(i + 1) === 34) { f += '"'; i++; } else q = false; } else { let j = text.indexOf('"', i); if (j < 0) j = n; f += text.slice(i, j); i = j - 1; } }
    else if (c === 34) q = true; else if (c === 44) { row.push(f); f = ''; } else if (c === 10) { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== 13) f += text[i]; }
  if (f || row.length) { row.push(f); rows.push(row); }
  const hd = (rows.shift() || []).map((x) => x.replace(/^﻿/, '').trim());
  return rows.filter((r) => r.length > 1 || r[0]).map((r) => { const o = {}; hd.forEach((k, i) => (o[k] = r[i] == null ? '' : r[i])); return o; });
}
const EZ_FILES = { contacts: 'ContactExport', ep: 'EmailPhoneExport', animals: 'AnimalExport', products: 'ProductExport', lines: 'InvoiceExpenseExport', invoices: 'InvoiceExport', payments: 'PaymentExport',
  consults: 'ConsultExport', inclinic: 'InClinicExport', history: 'VisitHistoryExport', meds: 'MedicationExport', plans: 'PlanTherapeuticExport', therap: 'TherapeuticExport', dreq: 'DiagnosticRequestExport', dres: 'DiagnosticResultExport',
  assess: 'ConsultAssessmentExport', cplan: 'ConsultPlanExport', exam: 'VisitExamExport', health: 'HealthStatusExport', docs: 'DocumentExport', comms: 'CommunicationExport', memos: 'MemoExport', files: 'AttachmentExport', appts: 'AppointmentExport', users: 'UserExport', psup: 'ProductSupplierExport', barcodes: 'BarcodeExport' };
async function ezRead(file, say) {
  if (typeof JSZip === 'undefined') throw new Error('The zip reader has not loaded yet — try again in a moment');
  const zip = await JSZip.loadAsync(file); const Z = {}; const names = Object.keys(zip.files);
  for (const [k, base] of Object.entries(EZ_FILES)) { const nm = names.find((x) => x.split('/').pop() === base + '.csv'); say && say('Reading ' + base + '…'); Z[k] = nm ? ezCsv(await zip.files[nm].async('string')) : []; await new Promise((r) => setTimeout(r, 0)); }
  if (!Z.contacts.length || !Z.animals.length) throw new Error("This doesn't look like the ezyVet backup zip (no ContactExport.csv / AnimalExport.csv inside)");
  return Z;
}
const ezD = (s) => { const m = /^(\d\d)-(\d\d)-(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const ezT = (s) => { const m = /(\d{1,2}):(\d\d):\d\d\s*(am|pm)/i.exec(s || ''); if (!m) return ''; const hh = (+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0); return String(hh).padStart(2, '0') + ':' + m[2]; };
const ezYes = (v) => /^(yes|1|true)$/i.test(String(v || '').trim());
const ezNum = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const ezTxt = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
const ezNorm = (s) => (s || '').toLowerCase().replace(/&/g, ' and ').replace(/\b(pty|ltd|limited|the|atf|trust|trustee|trustees|unit|co|company|partnership|p\/ship|t\/as|as trustee for|family|farms?|pastoral)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const ezTok = (s) => new Set(ezNorm(s).split(' ').filter((w) => w.length > 1 && w !== 'and'));
const ezOver = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; a.forEach((x) => b.has(x) && i++); return i / Math.min(a.size, b.size); };
const ezDig = (v) => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('61') && d.length === 11) d = '0' + d.slice(2); return d.slice(-9); };
const ezNoteOk = (t) => (!t || /^[\s.\-–,;:]*$/.test(t) || /^(vet ?link supplier number\s*\d*|company contact record)$/i.test(t.trim()) ? '' : t); // leave out empty notes and ezyVet's own system notes
const ezSkipName = (s) => /^(test|system|template|templates|ezyvet|cash)\b|\btest (client|business)\b/i.test((s || '').trim());

/* ---------- working out what to do (nothing is changed yet) ---------- */
function ezPlan(Z) {
  const P = { Z, clients: [], herds: { matched: 0, added: 0, other: 0 }, prods: [], bundles: 0, fees: 0, appts: [], blocks: [], skippedAppts: 0, rows: 0, notes: 0, defaults: [] };
  // ezyVet staff initials → app staff
  const ppl = (typeof Bk !== 'undefined' && Bk.people ? Bk.people() : []).concat((window.SBAuth && SBAuth.list) || []); const byInit = {};
  ppl.forEach((s) => { if (s && s.initials) byInit[s.initials.toUpperCase()] = byInit[s.initials.toUpperCase()] || s.id; });
  P.staffOf = (res) => [...new Set(String(res || '').split(/[;,]/).map((x) => byInit[x.trim().toUpperCase()]).filter(Boolean))];
  // phones and emails per contact
  const EP = {}; Z.ep.forEach((e) => { if (!ezYes(e['Email Phone Active']) && e['Email Phone Active'] !== '') return; const id = e['Contact Id']; const v = (e['Email Phone Content'] || '').trim(); if (!v) return; (EP[id] = EP[id] || []).push({ type: e['Email Phone Type'] || '', name: e['Email Phone Name'] || '', v }); });
  const animalsOf = {}; Z.animals.forEach((a) => (animalsOf[a['Contact Id']] = animalsOf[a['Contact Id']] || []).push(a));
  // app side: an index of names, phones, emails and patient IDs
  const bizList = D.businesses.filter((b) => !b.gone); const byCode = {}, byEzy = {}, byPhone = {}, byEmail = {};
  const put = (m, k, b) => { if (!k) return; (m[k] = m[k] || new Set()).add(b); };
  bizList.forEach((b) => { (b.patientIds || []).forEach((p) => put(byCode, String(p.value || '').trim(), b)); (b.ezyIds || []).forEach((x) => put(byEzy, x, b));
    (b.phones || []).forEach((p) => put(byPhone, ezDig(p.value), b)); (b.emails || []).forEach((p) => put(byEmail, (p.value || '').toLowerCase().trim(), b));
    (IDX.bizContacts.get(b.id) || []).forEach((c) => { [...(c.mobiles || []), ...(c.landlines || [])].forEach((p) => put(byPhone, ezDig(p.value), b)); (c.emails || []).forEach((p) => put(byEmail, (p.value || '').toLowerCase().trim(), b)); }); });
  const people = D.contacts.filter((c) => !c.gone);
  Z.contacts.forEach((e) => {
    const id = e['Contact Id']; const bn = (e['Business Name'] || '').trim(); const first = (e['Contact First'] || '').trim(), last = (e['Contact Last'] || '').trim(); const pn = [first, last].filter(Boolean).join(' ');
    const isBiz = ezYes(e['Contact Is Business']) && bn; const name = isBiz ? bn : pn; const cust = ezYes(e['Contact Is Customer']), sup = ezYes(e['Contact Is Supplier']);
    if (!name || ezSkipName(name) || ezSkipName(pn) || ezYes(e['Contact Is User']) || ezYes(e['Contact Is ezyVet User']) || /EMPLOYEE/i.test(e['Contact Code']) || (!cust && !sup)) return;
    if (ezGone().has(String(id))) { P.goneSkipped = (P.goneSkipped || 0) + 1; return; } // deleted in the app on purpose — never brought back by importing again
    const eps = EP[id] || []; const phones = eps.filter((x) => !/@/.test(x.v) && ezDig(x.v).length >= 8); const emails = eps.filter((x) => /@/.test(x.v));
    const animals = animalsOf[id] || []; const active = ezYes(e['Contact Is Active']);
    // score every app business
    const sc = new Map(); const bump = (b, n, why) => { const o = sc.get(b) || { n: 0, why: new Set() }; o.n += n; o.why.add(why); sc.set(b, o); };
    (byEzy[id] || []).forEach((b) => bump(b, 200, 'imported before'));
    animals.forEach((a) => (byCode[String(a['Animal Code'] || '').trim()] || []).forEach((b) => bump(b, 100, 'same ezyVet animal code')));
    const nn = ezNorm(name), tk = ezTok(name), ptk = ezTok(pn);
    bizList.forEach((b) => { const bnn = ezNorm(b.name); if (!bnn) return; if (bnn === nn) bump(b, 60, 'same name'); else { const o = ezOver(tk, ezTok(b.name)); if (o >= 0.75 && Math.min(tk.size, ezTok(b.name).size) >= 1 && (tk.size > 1 || ezTok(b.name).size === 1)) bump(b, 20, 'similar name'); }
      if (pn && (IDX.bizContacts.get(b.id) || []).some((c) => ezNorm(fullName(c)) === ezNorm(pn))) bump(b, 30, pn + ' is a contact there'); });
    const ph = new Set(); phones.forEach((p) => (byPhone[ezDig(p.v)] || []).forEach((b) => { if (!ph.has(b)) { ph.add(b); bump(b, 40, 'same phone number'); } }));
    const em = new Set(); emails.forEach((p) => (byEmail[p.v.toLowerCase()] || []).forEach((b) => { if (!em.has(b)) { em.add(b); bump(b, 40, 'same email'); } }));
    let best = null; sc.forEach((o, b) => { if (!best || o.n > best.o.n) best = { b, o }; });
    // a person on their own (not a business) who is already in the app as a person
    let person = null; if (!isBiz && pn) person = people.find((c) => ezNorm(fullName(c)) === ezNorm(pn) && (phones.some((p) => [...(c.mobiles || []), ...(c.landlines || [])].some((q) => ezDig(q.value) === ezDig(p.v))) || emails.some((p) => (c.emails || []).some((q) => (q.value || '').toLowerCase() === p.v.toLowerCase())))) || null;
    if (person && !best) { const pb = bizOf(person)[0]; if (pb) best = { b: pb, o: { n: 80, why: new Set(['same person, phone or email']) } }; }
    const sure = best && best.o.n >= 60 && !(best.o.n < 100 && [...best.o.why].every((w) => w === 'same name') && !active && false);
    P.clients.push({ e, id, name, pn, first, last, isBiz, active, sup, cust, phones, emails, animals, notes: ezNoteOk(ezTxt(e['Contact Notes'])), important: ezYes(e['Contact Notes Important']),
      match: best ? { b: best.b, n: best.o.n, why: [...best.o.why].join(', '), sure } : null, person });
  });
  // the price list, bundles and dispensing fees
  const live = Z.products.filter((p) => ezYes(p['Product Is Active']) && !/billing trigger|invoice message/i.test(p['Product Name']) && ezNum(p['Product Price']) < 99999);
  const pid = new Set(live.map((p) => p['Product Id'])); const invOk = {}; Z.invoices.forEach((i) => { invOk[i['Invoice Id']] = i['Invoice Status'] === 'approved' && !ezSkipName(i['Contact Name']); });
  const kids = {}; const hdrs = []; Z.lines.forEach((l) => { const hd = l['Header Line Id']; if (hd && hd !== '0') (kids[hd] = kids[hd] || []).push(l); if (l['Is Header'] === '1') hdrs.push(l); });
  const uses = {}; hdrs.forEach((l) => { if (!invOk[l['Invoice Id']] || ezNum(l['Qty']) >= 9999) return; (uses[l['Product Id']] = uses[l['Product Id']] || []).push(l); });
  const bundleOf = {}, feeOf = {};
  Object.entries(uses).forEach(([p, L]) => { L.sort((a, b) => ezNum(b['Invoice Expense Id']) - ezNum(a['Invoice Expense Id'])); const recent = L.slice(0, 40);
    if (recent[0]['Line Type'] === 'header-serviced') { const fees = recent.map((h) => (kids[h['Invoice Expense Id']] || []).find((k) => k['Line Type'] === 'serviced-fee')).filter(Boolean); if (fees.length && pid.has(fees[0]['Product Id'])) { const q = {}; fees.forEach((f) => (q[ezNum(f['Qty'])] = (q[ezNum(f['Qty'])] || 0) + 1)); feeOf[p] = { prod: 'ezp-' + fees[0]['Product Id'], qty: +Object.entries(q).sort((a, b) => b[1] - a[1])[0][0] || 1 }; } return; }
    const seen = {}; recent.forEach((h) => { const hq = ezNum(h['Qty']) || 1; (kids[h['Invoice Expense Id']] || []).forEach((k) => { if (ezNum(k['Qty']) >= 9999) return; const s = (seen[k['Product Id']] = seen[k['Product Id']] || { n: 0, q: [], r: [] }); s.n++; s.q.push(ezNum(k['Qty'])); s.r.push(ezNum(k['Qty']) / hq); }); });
    const mode = (a) => { const c = {}; a.forEach((x) => (c[Math.round(x * 1000) / 1000] = (c[Math.round(x * 1000) / 1000] || 0) + 1)); const t = Object.entries(c).sort((x, y) => y[1] - x[1])[0]; return t ? { v: +t[0], share: t[1] / a.length } : { v: 1, share: 0 }; };
    const items = Object.entries(seen).filter(([k, s]) => pid.has(k) && s.n >= Math.max(1, recent.length * 0.4)).map(([k, s]) => { const fx = mode(s.q), pr = mode(s.r); return fx.share >= 0.8 ? { prod: 'ezp-' + k, qty: fx.v, per: 'fixed' } : pr.share >= 0.8 ? { prod: 'ezp-' + k, qty: crR4(pr.v), per: 'each' } : { prod: 'ezp-' + k, qty: null, per: 'ask' }; });
    if (items.length) bundleOf[p] = items; });
  const CAT = (g, t) => /^medications/i.test(g) ? 'med' : /consumable/i.test(g) ? 'consumable' : /merchandise/i.test(g) ? 'merch' : /lab/i.test(g) || t === 'Diagnostic' ? 'lab' : /certificate/i.test(g) ? 'cert' : 'service';
  const UNIT = (n) => /per head|\(per head\)/i.test(n) ? 'head' : /per minute/i.test(n) ? 'minute' : /per hour|- per hour/i.test(n) ? 'hour' : /^travel/i.test(n) ? 'km' : /single dose/i.test(n) ? 'dose' : 'each';
  const BC = {}; (Z.barcodes || []).forEach((x) => { if (x['Is Active'] === 'NO' || !(x['Barcode Text'] || '').trim()) return; (BC[x['Product Id']] = BC[x['Product Id']] || []).push(x['Barcode Text'].trim()); });
  const SUP = {}; (Z.psup || []).forEach((x) => { const pid0 = x['Product ID']; const cur = SUP[pid0]; const def = ezYes(x['Default Supplier']); if (!cur || (def && !cur.def)) SUP[pid0] = { def, ez: x['Supplier Contact ID - Can edit'], name: x['Supplier Name - Can edit'], code: x['Supplier Code - Can edit'], price: ezNum(x['List Price Per Unit (Exc. Tax) - Can edit']), outer: ezNum(x['Units Per Outer - Can edit']) || 1 }; });
  live.forEach((p) => { const id = p['Product Id']; const nm = p['Product Name'].trim(); const price = crR4(ezNum(p['Product Price'])); const b = bundleOf[id];
    P.prods.push({ id: 'ezp-' + id, ezyId: id, code: p['Product Code'], name: nm, cat: b ? 'bundle' : CAT(p['Primary Product Group'], p['Product Type']), group: p['Primary Product Group'], unit: UNIT(nm), price, cost: crR4(ezNum(p['Product Cost Price'])),
      gst: /^S$/i.test((p['Product GST Code'] || '').trim()), whpMeat: (p['Product RVM Withholding Period for Meat'] || '').trim(), whpMilk: (p['Product RVM Withholding Period for Milk'] || '').trim(), dose: (p['Product RVM Dose To Be Given'] || '').trim(), route: (p['Product RVM Route of Administration'] || '').trim(),
      warn: (p['Product Warning Text'] || '').trim(), min: ezNum(p['Product Minimum Inventory']) || null, reorder: ezNum(p['Product Minimum Reorder']) || null, barcodes: [...new Set([(p['Product Barcode'] || '').trim(), ...(BC[id] || [])].filter(Boolean))], sup: SUP[id] || null, items: b || null, fee: feeOf[id] ? feeOf[id].prod : null, feeQty: feeOf[id] ? feeOf[id].qty : null, placeholder: !b && price === 0, s4: /S4|S8/.test(p['Primary Product Group']) }); });
  P.bundles = P.prods.filter((p) => p.items).length; P.fees = P.prods.filter((p) => p.fee).length;
  // the starting price list items still to be priced, filled from ezyVet where the match is clear
  const pick = (rx) => P.prods.find((p) => rx.test(p.name) && p.price > 0);
  [['p-pd-head', /^(pd|preg testing) - preg\/not preg \(per head\)/i, 1], ['p-labour', /^additional labour .*per hour/i, 1], ['p-vet-hour', /^professional fee \(per minute\)$/i, 60]].forEach(([did, rx, x]) => { const d = crProd(did); const s = pick(rx); if (d && s && (!(+d.price) || d.placeholder)) P.defaults.push({ id: did, name: d.name, price: crR2(s.price * x), from: s.name + (x > 1 ? ` × ${x}` : '') }); });
  // future appointments and leave
  const today = bkToday(); const CLIENT = /^(on-farm|in-house|phone|in-house fec) appointment/i;
  Z.appts.forEach((a) => { if (a['Appointment Active'] !== '1' && !ezYes(a['Appointment Active'])) return; const d = ezD(a['Appointment Start Time']); if (!d || d < today) return; const ty = a['Appointment Type'] || '';
    const st = ezT(a['Appointment Start Time']), en = ezT(a['Appointment End Time']); const mins = st && en ? Math.max(15, bkMin(en) - bkMin(st)) : 60; const staff = P.staffOf(a['Appointment Resource']);
    if (CLIENT.test(ty)) P.appts.push({ id: a['Appointment Id'], date: d, start: st, mins, type: /phone/i.test(ty) ? 'type-phone' : /fec/i.test(ty) ? 'type-fec' : /in-house/i.test(ty) ? 'type-inhouse' : 'type-farm', status: /\(confirmed\)/i.test(ty) ? 'confirmed' : 'unconfirmed', cidEz: a['Appointment Contact Id'], who: a['Appointment Contact Name'], notes: (a['Appointment Description'] || '').trim(), staff, res: a['Appointment Resource'] });
    else if (/annual leave|block out|^block$|admin block/i.test(ty) && /\bRDO\b|rostered day off/i.test(ty + ' ' + (a['Appointment Description'] || ''))) P.skippedAppts++; // RDOs: the person's usual days already show them as not working
    else if (/annual leave|block out|^block$|admin block/i.test(ty)) P.blocks.push({ id: a['Appointment Id'], date: d, start: mins >= 480 ? '08:30' : st, end: mins >= 480 ? '17:00' : en, allDay: false, office: mins >= 480, type: /admin/i.test(ty) ? 'bt-admin' : /\bRDO\b|rostered day off/i.test(ty + ' ' + (a['Appointment Description'] || '')) ? 'bt-rdo' : 'bt-leave', staff, note: ((a['Appointment Description'] || '').trim() || ty) });
    else P.skippedAppts++; });
  P.rows = Z.consults.length + Z.invoices.length + Z.payments.length + Z.comms.length + Z.docs.length + Z.memos.length + Z.files.length;
  P.notes = P.clients.filter((c) => c.notes).length;
  return P;
}

/* ---------- the archive rows (old history, read-only) ---------- */
function ezArchive(P) {
  const Z = P.Z, out = []; const A = {}; Z.animals.forEach((a) => (A[a['Animal Id']] = a)); const C = {}; Z.contacts.forEach((c) => (C[c['Contact Id']] = c));
  const cname = (id) => { const c = C[id]; return c ? ((ezYes(c['Contact Is Business']) && c['Business Name']) || [c['Contact First'], c['Contact Last']].filter(Boolean).join(' ')).trim() : ''; };
  const byCons = (L, f) => { const m = {}; L.forEach((x) => { if (x['Is Active'] === 'NO') return; const k = x[f || 'Consult Id']; (m[k] = m[k] || []).push(x); }); return m; };
  const inc = byCons(Z.inclinic), his = byCons(Z.history), med = byCons(Z.meds), pln = byCons(Z.plans, 'Plan Therapeutic Consult Id'), drq = byCons(Z.dreq), drs = byCons(Z.dres), asm = byCons(Z.assess), cpl = byCons(Z.cplan), exm = byCons(Z.exam), hs = byCons(Z.health);
  const TH = {}; Z.therap.forEach((t) => (TH[t['Therapeutic Id']] = t['Therapeutic Name']));
  const files = {}; Z.files.forEach((f) => { const k = (f['Record Type'] || '').toLowerCase() + ':' + f['Attachment Record Id']; (files[k] = files[k] || []).push({ name: f['File Name'], size: +f['File Size'] || 0, loc: f['File Location'], d: ezD(f['File Date']) }); });
  const used = new Set();
  const row = (kind, id, cid, aid, d, data, body) => { data.client = data.client || cname(cid); out.push({ kind, id: String(id), contact_id: cid || '', animal_id: aid || '', d: d || '', data, body: [data.title, data.client, data.animal, data.who, body].filter(Boolean).join('\n') }); };
  Z.consults.forEach((c) => { if (c['Is Active'] === 'NO') return; const id = c['Consult Id']; const a = A[c['Animal Id']] || {}; const S = [];
    const sec = (h, L, f) => { const t = (L || []).sort((x, y) => (ezD(x.DateTime) + ezT(x.DateTime)).localeCompare(ezD(y.DateTime) + ezT(y.DateTime))).map((x) => ezTxt(x[f])).filter(Boolean).join('\n\n'); if (t) S.push({ h, t }); };
    sec('History', his[id], 'Visit History Notes'); sec('Examination', exm[id], 'Visit Exam Comments'); sec('Clinical notes', inc[id], 'In Clinic Notes'); sec('Assessment', asm[id], 'ConsultAssessment Notes'); sec('Plan', cpl[id], 'ConsultPlan Notes');
    const vit = (hs[id] || []).map((x) => [x.Temperature && 'Temp ' + x.Temperature, x.HeartRate && 'HR ' + x.HeartRate, x.RespiratoryRate && 'RR ' + x.RespiratoryRate, x.Weight && +x.Weight ? 'Weight ' + x.Weight : '', x.Bcs && +x.Bcs ? 'BCS ' + x.Bcs : '', x.Demeanor].filter(Boolean).join(', ')).filter(Boolean).join('\n'); if (vit) S.push({ h: 'Vital signs', t: vit });
    const pr = (pln[id] || []).map((x) => [TH[x['Plan Therapeutic Therapeutic Id']] || 'Procedure', ezTxt(x['Plan Therapeutic Specifics']), ezTxt(x['Plan Therapeutic Outcome'])].filter(Boolean).join(' — ')).join('\n'); if (pr) S.push({ h: 'Procedures and treatments', t: pr });
    const dq = (drq[id] || []).map((x) => [ezTxt(x.Diagnostics), x.Status, ezTxt(x.Specifics), x.Reference && 'ref ' + x.Reference].filter(Boolean).join(' — ')).join('\n'); if (dq) S.push({ h: 'Diagnostics requested', t: dq });
    const dr = (drs[id] || []).map((x) => [ezTxt(x['Diagnostic Request']), x.Status, ezTxt(x.Specifics), ezTxt(x.Outcome), ezTxt(x['Interpretation Outcome'])].filter(Boolean).join(' — ')).join('\n'); if (dr) S.push({ h: 'Diagnostic results', t: dr });
    const meds = (med[id] || []).map((x) => ({ n: x['Medication Name'], q: x.Quantity, t: ezTxt(x['Medication Notes']) }));
    const fl = [...(files['consult:' + id] || [])]; (drs[id] || []).forEach((x) => fl.push(...(files['diagnosticresult:' + x['Diagnostic Result Id']] || []))); used.add('consult:' + id);
    const sp = a['Animal Species'] || '';
    row('consult', id, a['Contact Id'], c['Animal Id'], ezD(c.DateTime), { title: (c['Presenting Description'] || '').trim() || 'Consult', who: (c['Case Owner'] || '').trim(), animal: [a['Animal Name'], sp && '(' + sp + ')', a['Animal Code']].filter(Boolean).join(' '), num: c['Consult Number'], sections: S, meds, files: fl },
      S.map((s) => s.h + '\n' + s.t).join('\n') + '\n' + meds.map((m) => m.n + ' ' + (m.q || '') + ' ' + m.t).join('\n') + '\n' + fl.map((f) => f.name).join('\n'));
  });
  const LI = {}; P.Z.lines.forEach((l) => { if (l['Is Active'] === 'NO' || ezNum(l['Qty']) >= 9999 || l['Line Type'] === 'serviced-product' || l['Line Type'] === 'serviced-fee' && false) return; (LI[l['Invoice Id']] = LI[l['Invoice Id']] || []).push(l); });
  Z.invoices.forEach((i) => { if (i['Is Active'] === 'NO' || ezSkipName(i['Contact Name'])) return; const L = (LI[i['Invoice Id']] || []).filter((l) => l['Header Line Id'] === '' || l['Header Line Id'] === '0' || true);
    const lines = L.filter((l) => !(l['Is Header'] === '1' && ezNum(l['Total']) === 0 && (L.some((k) => k['Header Line Id'] === l['Invoice Expense Id'])))).map((l) => ({ d: l['Invoice Expense Description'], q: ezNum(l['Qty']), p: ezNum(l['Price']), t: ezNum(l['Total']), g: ezNum(l['Total GST']), sub: l['Header Line Id'] && l['Header Line Id'] !== '0' }));
    const tot = crR2(lines.reduce((s, l) => s + l.t + l.g, 0)), gst = crR2(lines.reduce((s, l) => s + l.g, 0)); const a = A[i['Animal Id']] || {};
    row('invoice', i['Invoice Id'], i['Contact Id'], i['Animal Id'], ezD(i['Invoice Date']), { title: 'Invoice ' + i['Invoice Number'] + (i['Invoice Status'] === 'declined' ? ' (declined)' : ''), num: i['Invoice Number'], status: i['Invoice Status'], total: tot, gst, lines, consult: i['Consult Id'] || '', comments: ezTxt(i.Comments), who: i['Invoice Created By'], animal: a['Animal Name'] || '', due: ezD(i['Invoice Due Date']) },
      lines.map((l) => l.d).join('\n') + '\n' + ezTxt(i.Comments)); });
  Z.payments.forEach((p) => { if (p['Is Active'] === 'NO') return; row('payment', p['Payment Id'], p['Contact Id'], '', ezD(p.Date), { title: 'Payment ' + (p['Payment Number'] || '') + ' — ' + crMoney(ezNum(p.Amount)) + (p.Method ? ' (' + p.Method + ')' : ''), amount: ezNum(p.Amount), method: p.Method, status: p.Status, who: p.User, outstanding: ezNum(p.Outstanding), comments: ezTxt(p.Comments || p.Details) }, ezTxt(p.Comments) + ' ' + ezTxt(p.Details)); });
  Z.comms.forEach((m) => { if (m['Is Active'] === 'NO') return; const k = 'communication:' + m['Communication Id']; used.add(k); const fl = files[k] || []; const msg = ezTxt(m['Communication Message']);
    row('comm', m['Communication Id'], m['To/From Contact Id'] || (m['For Class'] === 'Contact' ? m['For Id'] : ''), m['For Class'] === 'Animal' ? m['For Id'] : '', ezD(m.DateTime), { title: [m.Direction, m['Contact Method'], m['To/From']].filter(Boolean).join(' · ') || 'Message', who: m.From, text: msg, files: fl }, msg + '\n' + fl.map((f) => f.name).join('\n')); });
  Z.docs.forEach((d) => { if (d['Document Is Active'] === 'NO') return; const cls = (d['Document For Class'] || '').toLowerCase(); const id = d['Document For Id']; let cid = '', aid = '';
    if (cls === 'contact') cid = id; else if (cls === 'animal') { aid = id; cid = (A[id] || {})['Contact Id'] || ''; } else if (cls === 'consult') { const c = Z.consults.find((x) => x['Consult Id'] === id); if (c) { aid = c['Animal Id']; cid = (A[aid] || {})['Contact Id'] || ''; } }
    const t = ezTxt(d['Document Content']); row('doc', d['Document Id'], cid, aid, ezD(d['Document Created Time']), { title: d['Document Name'] || d['Document Template Name'] || 'Document', who: d['Document Creating User'], text: t }, t); });
  Z.memos.forEach((m) => { if (m['Memo Active'] === 'NO') return; const cls = (m['Memo Context Class'] || '').toLowerCase(); const id = m['Memo Context Id']; const cid = cls === 'contact' ? id : cls === 'animal' ? (A[id] || {})['Contact Id'] || '' : ''; const t = ezTxt(m['Memo Text']);
    row('memo', m['Memo Id'], cid, cls === 'animal' ? id : '', ezD(m['Memo Time Sent']), { title: (m['Memo Subject'] || 'Memo').trim(), who: m['Memo From User'], to: m['Memo Recipient Names'], text: t, urgent: ezYes(m['Memo Urgent']) }, t); });
  Object.entries(files).forEach(([k, L]) => { if (used.has(k)) return; const [cls, id] = k.split(':'); if (cls === 'diagnosticresult') return; const cid = cls === 'contact' ? id : cls === 'animal' ? (A[id] || {})['Contact Id'] || '' : ''; const aid = cls === 'animal' ? id : '';
    L.forEach((f, i) => row('file', k + ':' + i, cid, aid, f.d, { title: f.name, size: f.size, loc: f.loc, on: cls }, f.name)); });
  return out;
}

/* ---------- making the changes ---------- */
/* importing again (e.g. the final export before closing ezyVet) never undoes work done in the app:
   each business remembers what the import already gave it (ezyGot), so anything since removed, moved or changed isn't put back */
const ezGot = (b) => { b.ezyGot = b.ezyGot || []; return { has: (k) => b.ezyGot.includes(k), add: (k) => { if (!b.ezyGot.includes(k)) b.ezyGot.push(k); } }; };
const ezHash = (t) => { let x = 0; const s = String(t || ''); for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36) + s.length; };
function ezGone() { const s = new Set((D.settings && D.settings.ezyGone) || []); (D.trash || []).forEach((t) => { if (t.kind === 'business' && t.rec) (t.rec.ezyIds || []).forEach((x) => s.add(String(x))); }); return s; }
function ezApplyClients(P) {
  const S = { merged: 0, added: 0, inactive: 0, unsure: 0, people: 0, herds: 0, herdsNew: 0, notes: 0 }; const q = ezQueue(); const map = {}; // ezyVet contact id → app business id
  const addPh = (arr, v, label) => { if (!arr.some((x) => ezDig(x.value) === ezDig(v))) arr.push({ value: v, label: label || '' }); };
  const addEm = (arr, v, label) => { if (!arr.some((x) => (x.value || '').toLowerCase() === v.toLowerCase())) arr.push({ value: v, label: label || '' }); };
  P.clients.forEach((c) => {
    let b = c.match && c.match.sure ? c.match.b : null; const isNew = !b;
    if (!b) { b = { id: uid('b'), name: c.name, type: c.sup && !c.cust ? 'nonclient' : 'client', farmLinks: [], pics: [], patientIds: [], phones: [], emails: [], postal: [], info: '', warnings: '', flags: [], rating: null, cats: [], createdAt: Date.now() };
      if (b.type === 'nonclient') { b.primaryRequired = false; b.cats = ['industry']; } else if (!c.active) setBizCat(b, 'inactive');
      D.businesses.push(b); S.added++; if (!c.active) S.inactive++;
      if (c.match) { q.match.push({ a: c.match.b.id, b: b.id, why: c.match.why }); S.unsure++; } }
    else S.merged++;
    /* brought in by an import before the app kept a record of what each import gave (its ezyGot list): anything it's missing now may have been removed on purpose,
       so nothing is added to it — whatever ezyVet has that the app doesn't goes on a job to add or leave out */
    const legacy = !isNew && !(b.ezyGot || []).length && !!D.settings.ezyImport && (b.ezyIds || []).length > 0; const rv = []; const RV = (k, t, v) => { if (!(b.ezyGot || []).includes('rv:' + k)) { rv.push({ k, t, v }); ezGot(b).add('rv:' + k); } };
    b.ezyIds = [...new Set([...(b.ezyIds || []), c.id])]; b.phones = b.phones || []; b.emails = b.emails || []; b.postal = b.postal || [];
    const cs = IDX.bizContacts.get(b.id) || []; const known = (v) => cs.some((x) => [...(x.mobiles || []), ...(x.landlines || [])].some((p) => ezDig(p.value) === ezDig(v)));
    const knownE = (v) => cs.some((x) => (x.emails || []).some((p) => (p.value || '').toLowerCase() === v.toLowerCase()));
    // the person on the ezyVet record
    let person = c.person || (c.pn ? cs.find((x) => ezNorm(fullName(x)) === ezNorm(c.pn)) : null);
    if (legacy && !person && c.first && c.last && !cs.some((x) => ezNorm(fullName(x)) === ezNorm(c.pn))) RV('person', `Person: ${c.first} ${c.last}`, { first: c.first, last: c.last });
    if (!legacy && !person && c.first && c.last && (isNew || !cs.length) && !(b.ezyGot || []).includes('person')) { ezGot(b).add('person'); person = { id: uid('c'), first: c.first, middle: '', last: c.last, role: '', links: [{ bid: b.id }], tags: [], emails: [], mobiles: [], landlines: [], postal: [], info: '', warnings: '', starred: false, photoChoice: 'auto', flags: [], createdAt: Date.now() };
      if (!c.active) { person.inactFollow = true; person.inactBy = b.id; } D.contacts.push(person); S.people++; }
    if (person && !(person.links || []).some((l) => l.bid === b.id)) { person.links = [...(person.links || []), { bid: b.id }]; }
    const G = ezGot(b); const first = !isNew && !(b.ezyGot || []).length && !D.settings.ezyImport; if (first) { /* a business here before the first import: what it has now counts as already given */ (b.phones || []).forEach((x) => G.add('ph:' + ezDig(x.value))); (b.emails || []).forEach((x) => G.add('em:' + (x.value || '').toLowerCase())); }
    c.phones.forEach((p) => { const k = 'ph:' + ezDig(p.v); if (G.has(k) && !first) return; G.add(k); if (known(p.v) || (b.phones || []).some((x) => ezDig(x.value) === ezDig(p.v))) return; if (legacy) { RV(k, `Phone: ${p.v}`, { v: p.v, mob: /mobile/i.test(p.type) }); return; } if (person && /mobile/i.test(p.type) && (isNew || person.createdAt > Date.now() - 60000)) addPh(person.mobiles, p.v, ''); else addPh(b.phones, p.v, /mobile/i.test(p.type) ? 'mobile' : ''); });
    c.emails.forEach((p) => { const k = 'em:' + p.v.toLowerCase(); if (G.has(k) && !first) return; G.add(k); if (knownE(p.v) || (b.emails || []).some((x) => (x.value || '').toLowerCase() === p.v.toLowerCase())) return; if (legacy) { RV(k, `Email: ${p.v}`, { v: p.v }); return; } addEm(b.emails, p.v, /account/i.test(p.name) ? 'accounts' : ''); });
    const e = c.e; const addr = (pre) => [e[pre + ' Street 1'], e[pre + ' Street 2'], e[pre + ' Suburb'] || e[pre + ' City'], [e[pre + ' State'], e[pre + ' Post Code']].filter(Boolean).join(' ')].map((x) => (x || '').trim()).filter(Boolean).join(', ');
    const pa = addr('Contact Postal') || addr('Contact Physical'); if (pa && !G.has('postal')) { G.add('postal'); if (!b.postal.length) { if (legacy) RV('postal', `Postal address: ${pa}`, { v: pa }); else b.postal.push(pa); } }
    // herds and flocks: matched on the ezyVet animal code
    c.animals.forEach((a) => { const code = String(a['Animal Code'] || '').trim(); if (!code || ezSkipName(a['Animal Name'])) return; const spx = a['Animal Species'] || ''; const sp = /bovine/i.test(spx) ? 'cattle' : /ovine/i.test(spx) ? 'sheep' : 'other';
      const off = !ezYes(a['Is Active']) || ezYes(a.Dead) || sp === 'other'; let p = (b.patientIds || []).find((x) => String(x.value || '').trim() === code);
      const pk = 'pt:' + code; const seen = (b.ezyGot || []).includes(pk); ezGot(b).add(pk);
      if (!p && (seen || D.businesses.some((x) => (x.patientIds || []).some((q) => String(q.value) === code || (q.aka || []).some((y) => String(y.v) === code))) || ((D.settings && D.settings.ptGone) || []).includes(code))) { S.herds++; return; } // merged, moved or deleted in the app — leave it
      if (!p && legacy) { RV(pk, `${sp === 'sheep' ? 'Sheep flock' : sp === 'cattle' ? 'Cattle herd' : 'Animal'}: ${code}${a['Animal Name'] ? ' (' + a['Animal Name'].trim() + ')' : ''}${off ? ' — inactive in ezyVet' : ''}`, { value: code, label: (a['Animal Name'] || 'Patient').trim(), ezyId: a['Animal Id'], species: sp, inactive: off || undefined }); return; }
      if (p && seen) { p.ezyId = p.ezyId || a['Animal Id']; S.herds++; }
      else if (p) { p.ezyId = a['Animal Id']; p.species = p.species || sp; if (!p.label) p.label = a['Animal Name']; if (off && sp === 'other') p.inactive = true; S.herds++; }
      else { b.patientIds.push({ label: (typeof pidLabelTidy === 'function' ? pidLabelTidy(a['Animal Name'] || 'Patient') : (a['Animal Name'] || 'Patient').trim()) + (sp === 'other' && spx ? ` (${spx}${a['Animal Breed'] ? ', ' + a['Animal Breed'] : ''})` : ''), value: code, ezyId: a['Animal Id'], species: sp, inactive: off || undefined, breed: a['Animal Breed'] || undefined }); S.herdsNew++; } });
    // notes: kept in Info and a job asks whether each is really a warning and where it goes
    ((c.notes || '').toUpperCase().match(/\bW[A-Z]{3}\d{4}\b/g) || []).forEach((pic) => { if ((b.ezyGot || []).includes('pic:' + pic)) return; ezGot(b).add('pic:' + pic); if (legacy) { if (!(b.pics || []).some((x) => (x.value || '').toUpperCase() === pic)) RV('pic:' + pic, `PIC: ${pic}`, { v: pic }); return; } if (!(b.pics || []).some((x) => (x.value || '').toUpperCase() === pic)) { b.pics = [...(b.pics || []), { value: pic, label: '' }]; S.pics = (S.pics || 0) + 1; } }); // PICs written in the ezyVet notes
    const nk = 'note:' + ezHash(c.notes || ''); const noteSeen = (b.ezyGot || []).includes(nk); if (c.notes) ezGot(b).add(nk);
    if (legacy && c.notes && !noteSeen && !(b.info || '').includes(c.notes)) RV(nk, `Note: ${c.notes.length > 140 ? c.notes.slice(0, 140) + '…' : c.notes}`, { v: c.notes, imp: c.important });
    else if (c.notes && !noteSeen && !(b.info || '').includes(c.notes)) { b.info = [b.info, '*From ezyVet:* ' + c.notes].filter((x) => (x || '').trim()).join('\n\n'); delete b.infoHtml; q.notes.push({ bid: b.id, txt: c.notes, imp: c.important }); S.notes++; }
    if (rv.length) { const ex = q.review.find((x) => x.bid === b.id); if (ex) ex.items = [...ex.items, ...rv]; else q.review.push({ bid: b.id, items: rv, at: Date.now() }); S.review = (S.review || 0) + rv.length; }
    touch(b); if (person) touch(person); map[c.id] = b.id;
  });
  reindex(); ezQueueSave(q); return { S, map };
}
function ezApplyProds(P) { let add = 0, upd = 0; const supBiz = (ez) => { const b = ez && D.businesses.find((x) => !x.gone && (x.ezyIds || []).includes(String(ez))); return b ? b.id : null; };
  P.prods.forEach((x) => { const ex = crList('crprod').find((p) => !p.gone && (p.ezyId === x.ezyId || p.id === x.id || (x.code && p.code === x.code))) || crList('crprod').find((p) => !p.gone && !p.role && (p.name || '').toLowerCase() === x.name.toLowerCase());
    const rec = { cat: x.cat, name: x.name, unit: x.unit, price: x.price, gst: x.gst, code: x.code, ezyId: x.ezyId, group: x.group, cost: x.cost, items: x.items || undefined, fee: x.fee || undefined, feeQty: x.feeQty || undefined, whpMeat: x.whpMeat || undefined, whpMilk: x.whpMilk || undefined, dose: x.dose || undefined, route: x.route || undefined, warn: x.warn || undefined, placeholder: x.placeholder || undefined, active: true, min: x.min || undefined, reorder: x.reorder || undefined, barcodes: (x.barcodes || []).length ? x.barcodes : undefined,
      supplier: x.sup ? (supBiz(x.sup.ez) || undefined) : undefined, supName: x.sup ? x.sup.name : undefined, supCode: x.sup && x.sup.code ? x.sup.code : undefined, supPrice: x.sup && x.sup.price ? x.sup.price : undefined, supOuter: x.sup && x.sup.outer > 1 ? x.sup.outer : undefined };
    Object.keys(rec).forEach((k) => rec[k] === undefined && delete rec[k]);
    if (ex) { const lastAt = (D.settings.ezyImport || {}).at || 0; const edited = ex.ezyAt ? (ex._u || 0) > ex.ezyAt : ex.ezyId ? !!lastAt && (ex._u || 0) > lastAt + 120000 : !ex.role; // imported before this was kept track of: changed since the last import = edited // changed in the app since the last import (or made in the app)
      if (ex.role) { if (!(+ex.price) || ex.placeholder) { ex.price = x.price; delete ex.placeholder; } if (!edited) ex.gst = x.gst; ex.ezyId = x.ezyId; ex.code = ex.code || x.code; }
      else if (edited) { Object.keys(rec).forEach((k) => { if (ex[k] == null || ex[k] === '') ex[k] = rec[k]; }); ex.ezyId = ex.ezyId || x.ezyId; } // keep what was changed here; only fill in what's missing
      else Object.assign(ex, rec);
      if (!x.placeholder && ex.placeholder && !edited) delete ex.placeholder; touch(ex); ex.ezyAt = ex._u; upd++; }
    else { const r = { id: x.id, ...rec }; touch(r); r.ezyAt = r._u; D.crprod.push(r); add++; } });
  P.defaults.forEach((d) => { const p = crProd(d.id); if (p && (p.placeholder || !(+p.price))) { p.price = d.price; delete p.placeholder; touch(p); } });
  return { add, upd }; }
function ezApplyAppts(P, map) { let n = 0, nb = 0; const L = Bk.list('bookings'), B = Bk.list('blocks');
  P.appts.forEach((a) => { if (L.some((x) => x.ezyId === a.id)) return; const bid = map[a.cidEz] || null; const b = bid ? IDX.biz.get(bid) : null; const fid = b && b.farmLinks && b.farmLinks[0] ? b.farmLinks[0].fid : (b && b.farms && b.farms[0] ? b.farms[0].id : null);
    const r = { id: uid('bk'), ezyId: a.id, type: a.type, status: a.status, staff: a.staff, svcs: [], mins: a.mins, date: a.date, start: a.start, bid, cid: null, stops: fid && a.type === 'type-farm' ? [{ fid, yid: null }] : [], sms: { send: false }, notes: [a.notes, `(from ezyVet${!bid ? ' — client: ' + a.who : ''}${!a.staff.length && a.res ? ' — ' + a.res : ''})`].filter(Boolean).join('\n'), createdAt: Date.now(), by: SBAuth.staff && SBAuth.staff.id };
    r.fids = r.stops.map((s) => s.fid); r.fid = r.fids[0] || null; touch(r); L.push(r); n++; });
  P.blocks.forEach((x) => { if (B.some((y) => y.ezyId === x.id)) return; const r = { id: uid('blk'), ezyId: x.id, type: x.type, staff: x.staff, date: x.date, start: x.start, end: x.end, allDay: false, office: !!x.office, ezyOff: 1, repeat: { every: 'none', days: [] }, on: true, note: x.note }; touch(r); B.push(r); nb++; });
  return { n, nb }; }
function ezStampLast(rows) { /* each herd / flock remembers the date of its newest ezyVet record (for "not seen in 12 months") */
  const last = new Map(); rows.forEach((r) => { if (r.animal_id && r.d && (!last.has(r.animal_id) || r.d > last.get(r.animal_id))) last.set(r.animal_id, r.d); });
  D.businesses.forEach((b) => { let ch = false; (b.patientIds || []).forEach((p) => { const d = [p.ezyId, ...(p.ezyIds || [])].filter(Boolean).map((id) => last.get(String(id))).filter(Boolean).sort().pop(); if (d && p.ezyLast !== d) { p.ezyLast = d; ch = true; } }); if (ch) touch(b); }); }
async function ezUpload(rows, say) { // to the practice database, a batch at a time (safe to repeat — rows are replaced, not doubled)
  const k = 'bvp-ezyup'; let start = 0; try { const s = JSON.parse(localStorage.getItem(k) || '{}'); if (s.n === rows.length) start = s.i || 0; } catch (e) { }
  let i = start; while (i < rows.length) { let j = i, size = 0; while (j < rows.length && (size < 700000 || j === i) && j - i < 400) { size += JSON.stringify(rows[j]).length; j++; }
    let tries = 0; for (;;) { try { await rpc('ezy_put', { k: Dev.k(), items: rows.slice(i, j) }); break; } catch (e) { if (++tries > 3) throw e; await new Promise((r) => setTimeout(r, 1500 * tries)); } }
    i = j; try { localStorage.setItem(k, JSON.stringify({ n: rows.length, i })); } catch (e) { } say && say(`Saving the ezyVet history… ${Math.round((i / rows.length) * 100)}% (${i.toLocaleString()} of ${rows.length.toLocaleString()})`); }
  try { localStorage.removeItem(k); } catch (e) { } }

/* ---------- the jobs the import leaves: possible same client, notes that may be warnings ---------- */
const ezQueue = () => { const r = crCfg('ezyq'); return r ? { match: [...(r.match || [])], notes: [...(r.notes || [])], review: JSON.parse(JSON.stringify(r.review || [])) } : { match: [], notes: [], review: [] }; };
function ezQueueSave(q) { let r = crCfg('ezyq'); if (!r) { r = { id: 'ezyq', cfg: 'ezyq' }; crList('crcfg').push(r); } r.match = q.match; r.notes = q.notes; r.review = q.review || r.review || []; touch(r); }
if (typeof JOB_TYPES !== 'undefined') { JOB_TYPES.ezymatch = { t: 'ezyVet import: the same client?', manual: false }; JOB_TYPES.ezynote = { t: 'ezyVet notes: a warning, or just info?', manual: true, btn: '✓ Not a warning — leave it in Info' }; }
function ezyJobs() { const r = typeof crCfg === 'function' && crCfg('ezyq'); if (!r) return []; const out = [];
  (r.match || []).forEach((m) => { const A = IDX.biz.get(m.a), B = IDX.biz.get(m.b); if (!A || !B || A.gone || B.gone) return; out.push({ type: 'ezymatch', key: 'ezymatch:' + m.a + ':' + m.b, kind: 'business', id: B.id, who: B.name + '  ↔  ' + A.name, note: `Added from ezyVet — it may be the same client as ${A.name} (${m.why}). Merge them if they are; tap Not duplicates if they're not.`, dupe: { kind: 'business', a: A.id, b: B.id } }); });
  (r.notes || []).forEach((n) => { const b = IDX.biz.get(n.bid); if (!b || b.gone) return; out.push({ type: 'ezynote', key: 'ezynote:' + n.bid + ':' + n.txt.length + ':' + n.txt.slice(0, 20), kind: 'business', id: b.id, who: b.name, note: (n.imp ? 'ezyVet marked this note Important. ' : '') + 'This note came from ezyVet and is in the business Info. Is it a warning? Apply it where it belongs, or leave it in Info:', warnTxt: n.txt, warnSrc: { kind: 'business', id: b.id, bid: b.id, fid: null, sec: null } }); });
  (r.review || []).forEach((x) => { const b = IDX.biz.get(x.bid); if (!b || b.gone || !(x.items || []).length) return; out.push({ type: 'ezyreview', key: 'ezyreview:' + x.bid, kind: 'business', id: b.id, who: b.name, note: `ezyVet has ${x.items.length === 1 ? 'this' : 'these'}, but ${b.name} doesn't any more in the app — you may have removed ${x.items.length === 1 ? 'it' : 'them'} on purpose, or ${x.items.length === 1 ? 'it was' : 'they were'} added in ezyVet since the last import. Add what's still right; leave out the rest.`, ezyrev: x }); });
  return out; }
function ezyRevHtml(j) { const x = j.ezyrev; return `</div><div style="width:100%;margin:4px 0">${x.items.map((it, i) => `<div class="kv" style="align-items:center;gap:6px"><div class="v" style="flex:1;white-space:pre-wrap">${h(it.t)}</div><button class="btn small greenbtn" data-act="ezyrev" data-bid="${x.bid}" data-i="${i}" data-v="add">＋ Add</button><button class="btn small" data-act="ezyrev" data-bid="${x.bid}" data-i="${i}" data-v="skip">Leave out</button></div>`).join('')}</div><div class="acts">${x.items.length > 1 ? `<button class="btn small" data-act="ezyrev" data-bid="${x.bid}" data-v="addall">＋ Add them all</button><button class="btn small" data-act="ezyrev" data-bid="${x.bid}" data-v="skipall">Leave them all out</button>` : ''}`; }
window.ezyRevHtml = ezyRevHtml;
function ezyRevApply(b, it) { const v = it.v || {}; const k = it.k.split(':')[0];
  if (k === 'ph') b.phones = [...(b.phones || []), { value: v.v, label: v.mob ? 'mobile' : '' }];
  else if (k === 'em') b.emails = [...(b.emails || []), { value: v.v, label: '' }];
  else if (k === 'postal') b.postal = [...(b.postal || []), v.v];
  else if (k === 'pic') b.pics = [...(b.pics || []), { value: v.v, label: '' }];
  else if (k === 'pt') { if (!(b.patientIds || []).some((p) => String(p.value) === String(v.value))) b.patientIds = [...(b.patientIds || []), { value: v.value, label: v.label, ezyId: v.ezyId, species: v.species, inactive: v.inactive }]; }
  else if (k === 'note') { b.info = [b.info, '*From ezyVet:* ' + v.v].filter((y) => (y || '').trim()).join('\n\n'); delete b.infoHtml; }
  else if (k === 'person') { const c = { id: uid('c'), first: v.first, middle: '', last: v.last, role: '', links: [{ bid: b.id }], tags: [], emails: [], mobiles: [], landlines: [], postal: [], info: '', warnings: '', starred: false, photoChoice: 'auto', flags: [], createdAt: Date.now() }; D.contacts.push(c); touch(c); }
  touch(b); }

/* ---------- the import screen ---------- */
function ezBox(html) { let el = document.getElementById('ezybox'); if (!el) { el = document.createElement('div'); el.id = 'ezybox'; document.body.appendChild(el); } el.innerHTML = `<div class="ezy-in">${html}</div>`; el.hidden = false; return el; }
const ezClose = () => { const el = document.getElementById('ezybox'); if (el) el.hidden = true; };
const ezSay = (t) => { const s = document.getElementById('ezy-say'); if (s) s.textContent = t; };
function ezStart() { if (!(window.SBAuth && SBAuth.isAdmin && SBAuth.isAdmin())) { toast('Only an admin can import the ezyVet export'); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.zip,application/zip'; inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return;
    ezBox(`<h2>📥 ezyVet import</h2><p id="ezy-say">Reading the zip…</p>`);
    try { const Z = await ezRead(f, ezSay); ezSay('Matching clients, herds and products…'); await new Promise((r) => setTimeout(r, 30)); EZ.plan = ezPlan(Z); ezReview(); } catch (e) { ezBox(`<h2>📥 ezyVet import</h2><p style="color:var(--red)">${h(e.message || String(e))}</p><div class="actions"><button class="btn" data-act="ezy-close">Close</button></div>`); } };
  inp.click(); }
function ezReview() { const P = EZ.plan; const C = P.clients; const sure = C.filter((c) => c.match && c.match.sure), un = C.filter((c) => c.match && !c.match.sure), nw = C.filter((c) => !c.match);
  const li = (L, f) => L.slice(0, 400).map(f).join('');
  ezBox(`<h2>📥 ezyVet import — check before saving</h2><div class="ezy-bar"><button class="btn primary" data-act="ezy-go">📥 Import now</button><button class="btn" data-act="ezy-close">Cancel</button><span id="ezy-say" class="hint"></span></div><p class="hint">Nothing has changed yet. Have a look, then tap <b>📥 Import now</b> (it stays at the top as you scroll). It's safe to import again later — nothing is doubled.</p>${D.settings.ezyImport ? `<p class="hint">Imported before: ${h((D.settings.ezyImports || [D.settings.ezyImport]).map((x) => new Date(x.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + (x.by && typeof Bk !== 'undefined' && Bk.pname ? ' (' + Bk.pname(x.by) + ')' : '')).join(', '))}</p><div class="vcx-ok">✓ <b>Importing again keeps every change made in the app.</b> Anything already brought in from ezyVet and since changed, moved, merged or deleted here (businesses, people, phone numbers, emails, notes, PICs, patients, appointments, prices) is left as it is — only things that are new in ezyVet are added. For clients from the earlier imports, anything ezyVet has that the app doesn't any more (a phone number, email, note, PIC, herd or person you may have removed) isn't added — it goes on a job so you can add it or leave it out.${P.goneSkipped ? ` ${P.goneSkipped} client${P.goneSkipped === 1 ? '' : 's'} deleted in the app ${P.goneSkipped === 1 ? 'is' : 'are'} skipped.` : ''}</div>` : ''}
  <details class="card" open><summary><b>Clients</b> — ${C.length} from ezyVet</summary>
    <p>✓ <b>${sure.length}</b> match a business already in the app — their missing phone numbers, emails, postal address, herds and flocks are added to it.<br>❓ <b>${un.length}</b> might be a client already in the app — they're added as their own business and a <b>Jobs</b> item asks you to merge them or keep them apart.<br>➕ <b>${nw.length}</b> are new (${nw.filter((c) => !c.active).length} inactive — added as Inactive, ${nw.filter((c) => c.sup && !c.cust).length} suppliers — added as Industry). New active clients need a category: they show in Jobs → No category.<br>📝 <b>${P.notes}</b> have ezyVet notes — they go into Info, and a Jobs item asks whether each is a warning and where it belongs.</p>
    <details><summary>Matched (${sure.length})</summary><div class="ezy-list">${li(sure, (c) => `<div>${h(c.name)} → <b>${h(c.match.b.name)}</b> <span class="hint">${h(c.match.why)}</span></div>`)}</div></details>
    <details><summary>Might be the same (${un.length})</summary><div class="ezy-list">${li(un, (c) => `<div>${h(c.name)} ↔ <b>${h(c.match.b.name)}</b> <span class="hint">${h(c.match.why)}</span></div>`)}</div></details>
    <details><summary>New (${nw.length})</summary><div class="ezy-list">${li(nw, (c) => `<div>${h(c.name)}${c.active ? '' : ' <span class="hint">inactive</span>'}${c.sup && !c.cust ? ' <span class="hint">supplier</span>' : ''}</div>`)}</div></details></details>
  <details class="card"><summary><b>Herds, flocks and animals</b> — ${P.Z.animals.length}</summary><p>Matched to the businesses' patient IDs by the ezyVet animal code; new ones are added. Dogs, horses and other species are added as <b>inactive</b> patients (so their records are kept) — new patients are still only cattle or sheep.</p></details>
  <details class="card"><summary><b>Price list</b> — ${P.prods.length} active items</summary><p>${P.bundles} <b>bundles</b> (like Pregnancy Diagnosis, BBSE consumables, Travel) rebuilt from how they were used on your invoices — adding one adds everything in it; items with an amount that changes each time ask for it. ${P.fees} medications carry their <b>dispensing fee</b>. GST or GST-free comes from each ezyVet item. Items priced $0 in ezyVet show "price to be set".</p>
    ${P.defaults.length ? `<p>Starting items priced from ezyVet:</p><div class="ezy-list">${P.defaults.map((d) => `<div>${h(d.name)} → <b>${crMoney(d.price)}</b> <span class="hint">from ${h(d.from)}</span></div>`).join('')}</div>` : ''}
    <details><summary>Bundles (${P.bundles})</summary><div class="ezy-list">${li(P.prods.filter((p) => p.items), (p) => `<div><b>${h(p.name)}</b>: ${p.items.map((it) => { const c = P.prods.find((x) => x.id === it.prod); return h(c ? c.name : '?') + (it.per === 'ask' ? ' (amount asked)' : it.per === 'each' ? ` (${it.qty} each)` : ` (${it.qty})`); }).join(' · ')}</div>`)}</div></details></details>
  <details class="card"><summary><b>Future appointments</b> — ${P.appts.length}, plus ${P.blocks.length} leave / block-outs</summary><p>They go on the Scheduling calendar with their notes. <b>No texts are sent</b> for them. ${P.skippedAppts} tasks and reminders aren't brought across (the app has its own yearly reminders and bulk lists).</p>
    <div class="ezy-list">${li(P.appts, (a) => `<div>${bkDate(a.date, { weekday: 'short', day: 'numeric', month: 'short' })} ${h(a.start)} — ${h(a.who || '')}: ${h(a.notes.split('\n')[0] || '')} <span class="hint">${h(a.res)}</span></div>`)}</div></details>
  <details class="card"><summary><b>Clinical history</b> — ${P.rows.toLocaleString()} old records</summary><p>Consults (history, notes, exam, procedures, medications, diagnostics and results), invoices, payments, messages, documents, memos and the list of attached files are saved <b>read-only</b> in the practice database, with a search index. They show on each business and patient as <b>📚 ezyVet history</b>, and in <b>Records → Search</b>. (The files themselves stay in the attachments zip for now.)</p></details>
  `); }
async function ezGo() { if (EZ.busy) return; EZ.busy = true; const P = EZ.plan; const go = document.querySelector('[data-act=ezy-go]'); if (go) { go.disabled = true; go.textContent = '⏳ Importing…'; }
  try { ezSay('Adding clients, herds and notes…'); await new Promise((r) => setTimeout(r, 20));
    const { S, map } = ezApplyClients(P); const pr = ezApplyProds(P); const ap = ezApplyAppts(P, map);
    try { reindex(); if (typeof logChanges === 'function') logChanges('ezyVet import'); if (typeof baseline === 'function') baseline(); } catch (x) { console.warn(x); } // the import is the new starting point (its inactive clients already have ezyVet's status)
    D.settings.ezyImports = [...(D.settings.ezyImports || (D.settings.ezyImport ? [D.settings.ezyImport] : [])), { at: Date.now(), by: SBAuth.staff && SBAuth.staff.id, clients: P.clients.length }].slice(-20); D.settings.ezyImport = { at: Date.now(), by: SBAuth.staff && SBAuth.staff.id, clients: P.clients.length }; touch(D.settings); JOBS_CACHE = null; save(); if (window.SupaSync) SupaSync.soon(); if (window.Sync) Sync.soon();
    ezSay('Building the history…'); await new Promise((r) => setTimeout(r, 20)); const rows = ezArchive(P); ezStampLast(rows); await ezUpload(rows, ezSay);
    EZ.plan = null; EZ.busy = false;
    ezBox(`<h2>✓ ezyVet import finished</h2><p>Clients: ${S.merged} merged, ${S.added} added (${S.inactive} inactive), ${S.unsure} to check in Jobs, ${S.people} people added.<br>Herds and flocks: ${S.herds} matched, ${S.herdsNew} added.<br>Notes to check in Jobs: ${S.notes}.${S.review ? ` <b>${S.review} thing${S.review === 1 ? '' : 's'} in ezyVet that the app no longer has</b> — not added; check them in Jobs (add or leave out).` : ''}${S.pics ? ` PICs found in the notes and added: ${S.pics}.` : ''}<br>Price list: ${pr.add} added, ${pr.upd} updated.<br>Appointments: ${ap.n} added, ${ap.nb} leave / block-outs.<br>History: ${rows.length.toLocaleString()} old records saved and searchable.</p><div class="actions"><button class="btn primary" data-act="ezy-close">Done</button><button class="btn" data-act="ezy-jobs">Open Jobs</button></div>`);
    renderAll(); }
  catch (e) { EZ.busy = false; if (go) go.disabled = false; ezSay('Stopped: ' + (e.message || e) + ' — tap Import now again to carry on (nothing is doubled).'); console.warn(e); } }

/* ---------- the ezyVet history: on a business or patient, and one record ---------- */
async function ezList(key, contacts, animals) { if (EZ.hist[key] && EZ.hist[key].at > Date.now() - 300000) return EZ.hist[key].rows;
  const rows = await rpc('ezy_list', { k: Dev.k(), contacts: contacts && contacts.length ? contacts : null, animals: animals && animals.length ? animals : null, kinds: null, lim: 3000 }); EZ.hist[key] = { at: Date.now(), rows: rows || [] }; return EZ.hist[key].rows; }
function ezyBizCard(b) { if (!(b.ezyIds || []).length) return ''; return ezHistCard('b:' + b.id, b.ezyIds, null); }
function ezyPatCard(p) { const pp = (p.b.patientIds || []).find((x) => String(x.value) === String(p.value)); if (!pp) return ''; const ids = [...new Set([pp.ezyId, ...(pp.ezyIds || [])].filter(Boolean))]; if (!ids.length) return ''; return ezHistCard('a:' + ids.join(','), null, ids); }
function ezHistCard(key, contacts, animals) { const st = EZ.hist[key]; const tab = (EZ.histQ[key] || {}).tab || 'consult'; const q = (EZ.histQ[key] || {}).q || '';
  if (!st) { setTimeout(() => ezList(key, contacts, animals).then(() => renderAll()).catch((e) => { EZ.hist[key] = { at: Date.now(), rows: [], err: e.message || String(e) }; renderAll(); }), 0); }
  const rows = st ? st.rows : null; const n = (k) => (rows || []).filter((r) => ezTabOf(r.kind) === k).length; const ql = q.toLowerCase();
  const ids = (EZ.histQ[key] || {}).ids; const shown = (rows || []).filter((r) => ezTabOf(r.kind) === tab && (!ql || (ids && ql.length > 2 && ids.has(r.kind + ':' + r.id)) || [r.data.title, r.data.who, r.data.animal, r.d].join(' ').toLowerCase().includes(ql)));
  return `<div class="card ezyhist" data-ezk="${h(key)}" data-ezc="${h((contacts || []).join(','))}" data-eza="${h((animals || []).join(','))}"><h3><span class="sp">📚 ezyVet history</span></h3>
    ${!st ? '<div class="hint">Loading…</div>' : st.err ? `<div class="hint">Couldn't load the ezyVet history${navigator.onLine ? '' : ' — it needs the internet'}. ${h(st.err)}</div>` : !rows.length ? '<div class="hint">Nothing from ezyVet.</div>' : `
    <div class="search" style="margin:4px 0 6px"><input type="search" class="ezy-hq" placeholder="Search these records' words…" value="${h(q)}" aria-label="Search this history"></div>
    <div class="chips">${EZ_KINDS.filter(([k]) => n(k)).map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-act="ezy-htab" data-k="${k}">${l} <span class="cn">${n(k)}</span></button>`).join('')}</div>
    ${ezPagesHtml(shown)}`}</div>`; }
function ezPagesHtml(shown) { /* the 5 most recent, then scroll across for older ones, 5 at a time */
  if (!shown.length) return '<div class="hint">None.</div>'; const L = shown.slice().sort((a, b) => String(b.d || '').localeCompare(String(a.d || ''))).slice(0, 200); const pages = []; for (let i = 0; i < L.length; i += 5) pages.push(L.slice(i, i + 5));
  return `<div class="ezpages">${pages.map((pg, i) => `<div class="ezpage"><div class="hint" style="margin-bottom:2px">${i ? `Older · ${i * 5 + 1}–${i * 5 + pg.length}` : 'Most recent'}</div>${pg.map(ezRowHtml).join('')}</div>`).join('')}</div>${pages.length > 1 ? `<div class="hint">Scroll across ➜ for ${L.length - 5} older${shown.length > 200 ? ` (showing 200 of ${shown.length} — search to narrow it down)` : ''}</div>` : ''}`; }
function ezRowHtml(r) { const d = r.data || {}; return `<div class="kv bk-tap" data-act="ezy-open" data-kind="${h(r.kind)}" data-id="${h(r.id)}"><div class="k">${r.d ? bkDate(r.d, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div><div class="v"><b>${h(d.title || ezOne[r.kind])}</b>${r.kind === 'invoice' && d.total != null ? ' · ' + crMoney(d.total) : ''}<br><span class="hint">${h([d.who, d.animal].filter(Boolean).join(' · '))}</span></div></div>`; }
const ezHtml = (t) => h(t || '').replace(/###\s*([\s\S]+?)\s*###/g, '<b>$1</b>').replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); // ezyVet's ###bold### shows as bold
async function ezOpen(kind, id) { ezBox(`<h2>${h(ezOne[kind] || 'Record')}</h2><p class="hint">Loading…</p>`);
  let r; try { r = await rpc('ezy_get', { k: Dev.k(), kind_: kind, id_: id }); } catch (e) { ezBox(`<h2>${h(ezOne[kind])}</h2><p>Couldn't load it${navigator.onLine ? '' : ' — the ezyVet history needs the internet'}. ${h(e.message || '')}</p><div class="actions"><button class="btn" data-act="ezy-close">Close</button></div>`); return; }
  if (!r) { ezBox(`<h2>Not found</h2><div class="actions"><button class="btn" data-act="ezy-close">Close</button></div>`); return; }
  const d = r.data || {}; const biz = D.businesses.find((b) => (b.ezyIds || []).includes(r.contact_id)); let body = '';
  if (kind === 'consult') body = ezSecs(d.sections).map((s) => `<h4>${h(s.h)}</h4><div class="ezy-txt">${ezHtml(s.t)}</div>`).join('') + ((d.meds || []).length ? `<h4>Medications and products</h4><table class="ezy-t">${d.meds.map((m) => `<tr><td>${h(m.n)}</td><td>${h(m.q || '')}</td><td>${ezHtml(m.t)}</td></tr>`).join('')}</table>` : '');
  else if (kind === 'invoice') body = `<table class="ezy-t"><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>${(d.lines || []).map((l) => `<tr${l.sub ? ' class="sub"' : ''}><td>${h(l.d)}</td><td>${l.q}</td><td>${crMoney(l.p)}</td><td>${crMoney(l.t)}</td></tr>`).join('')}<tr><td colspan="3"><b>GST</b></td><td>${crMoney(d.gst)}</td></tr><tr><td colspan="3"><b>Total (inc GST)</b></td><td><b>${crMoney(d.total)}</b></td></tr></table>${d.comments ? `<h4>Comments</h4><div class="ezy-txt">${ezHtml(d.comments)}</div>` : ''}<p class="hint">Status: ${h(d.status || '')}${d.due ? ' · due ' + bkDate(d.due, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>`;
  else if (kind === 'payment') body = `<p>${crMoney(d.amount)} ${h(d.method || '')} · ${h(d.status || '')}</p>${d.comments ? `<div class="ezy-txt">${ezHtml(d.comments)}</div>` : ''}`;
  else if (kind === 'file') body = ezFileBox({ name: d.title, size: d.size, loc: d.loc }, true);
  else body = `${d.to ? `<p class="hint">To: ${h(d.to)}</p>` : ''}<div class="ezy-txt">${ezHtml(d.text)}</div>`;
  if ((d.files || []).length) body += `<h4>Attached files</h4><div class="ezf-grid">${d.files.map((f) => ezFileBox(f)).join('')}</div>`;
  EZ.view = r;
  ezBox(`<div class="ezy-top"><button class="btn small" data-act="ezy-close">‹ Back</button>${ezyFindBar('ezy-rec')}</div>
    <div id="ezy-rec"><h2>${h(d.title || ezOne[kind])}</h2><p class="hint">📚 From ezyVet (read-only) · ${r.d ? bkDate(r.d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}${d.who ? ' · ' + h(d.who) : ''}${d.animal ? ' · ' + h(d.animal) : ''}<br>${biz ? `<span class="lnk" data-act="open" data-kind="business" data-id="${biz.id}">${h(biz.name)}</span>` : h(d.client || '')}${d.num ? ' · #' + h(d.num) : ''}</p>${body}</div>`);
  if (EZ.findQ) { const i = document.querySelector('#ezybox .ezy-fq'); if (i) { i.value = EZ.findQ; ezFind(i, 0); } } }

/* ---------- old files: a small preview, tap it for a bigger one, and ↗ Open ----------
   The files live in the practice's OneDrive / SharePoint folder (Settings → Clinical records → ezyVet files folder), in the same folders as the ezyVet attachments zip. */
const ezFileUrl = (f) => { const base = String((D.settings || {}).ezyFilesBase || '').trim().replace(/\/+$/, ''); if (!base || !f || !(f.loc || f.name)) return ''; return base + '/' + String(f.loc || f.name).split('/').map(encodeURIComponent).join('/'); };
const ezFileKind = (n) => (/\.(jpe?g|png|gif|webp|bmp)$/i.test(n || '') ? 'img' : /\.pdf$/i.test(n || '') ? 'pdf' : /\.(mp4|mov|m4v|webm)$/i.test(n || '') ? 'vid' : 'other');
function ezFileBox(f, big) { const u = ezFileUrl(f); const k = ezFileKind(f.name); const sz = f.size ? ` · ${f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.round(f.size / 1024) + ' KB'}` : '';
  const ico = { img: '🖼', pdf: '📄', vid: '🎞', other: '📎' }[k];
  if (!u) return `<div class="ezf"><div class="ezf-th ezf-none">${ico}</div><div class="ezf-n">${h(f.name)}<span class="hint">${sz}</span><br><span class="hint">Not linked yet — an admin sets the ezyVet files folder in Settings → Clinical records → ezyVet files folder.</span></div></div>`;
  const th = k === 'img' ? `<img src="${h(u)}" alt="" loading="lazy">` : k === 'pdf' ? `<iframe src="${h(u)}#toolbar=0&view=FitH" loading="lazy" tabindex="-1"></iframe>` : k === 'vid' ? `<video src="${h(u)}" preload="metadata" muted></video>` : `<span>${ico}</span>`;
  return `<div class="ezf ${big ? 'big' : ''}"><div class="ezf-th" data-act="ezf-view" data-u="${h(u)}" data-k="${k}" data-n="${h(f.name)}" title="Tap to see it bigger">${th}</div><div class="ezf-n">${h(f.name)}<span class="hint">${sz}</span><br><a class="btn small" href="${h(u)}" target="_blank" rel="noopener">↗ Open</a></div></div>`; }
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=ezf-view]'); if (!el) return; e.preventDefault(); e.stopPropagation(); const u = el.dataset.u, k = el.dataset.k;
  const inner = k === 'img' ? `<img src="${h(u)}" alt="" style="max-width:100%;max-height:75vh">` : k === 'pdf' ? `<iframe src="${h(u)}" style="width:100%;height:75vh;border:0"></iframe>` : k === 'vid' ? `<video src="${h(u)}" controls style="max-width:100%;max-height:75vh"></video>` : '<p>No preview for this kind of file.</p>';
  const o = document.createElement('div'); o.className = 'ezf-over'; o.innerHTML = `<div class="ezf-pop"><div class="actions" style="justify-content:space-between"><b>${h(el.dataset.n)}</b><span><a class="btn small primary" href="${h(u)}" target="_blank" rel="noopener">↗ Open</a> <button class="btn small" data-x="1">✕ Close</button></span></div>${inner}</div>`; o.addEventListener('click', (ev) => { if (ev.target === o || ev.target.dataset.x) o.remove(); }); document.body.appendChild(o); }, true);
(function () { const st = document.createElement('style'); st.textContent = '.ezf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.ezf{border:1px solid var(--line);border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:4px}.ezf.big .ezf-th{height:300px}.ezf-th{height:110px;border-radius:6px;overflow:hidden;background:#f3f3f3;display:flex;align-items:center;justify-content:center;font-size:34px;cursor:zoom-in;position:relative}.ezf-th img,.ezf-th video{width:100%;height:100%;object-fit:cover}.ezf-th iframe{width:100%;height:100%;border:0;pointer-events:none}.ezf-none{cursor:default}.ezf-n{font-size:12px;word-break:break-word}.ezf-over{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;display:flex;align-items:center;justify-content:center;padding:12px}.ezf-pop{background:var(--bg,#fff);border-radius:12px;padding:10px;max-width:960px;width:100%;max-height:95vh;overflow:auto}'; document.head.appendChild(st); })();
/* Vetlink's converted history (in "Clinical notes") and ezyVet's own (in "Procedures and treatments") show together as one section */
function ezSecs(S) { const L = S || []; const a = L.find((x) => x.h === 'Clinical notes'), b = L.find((x) => x.h === 'Procedures and treatments'); if (!a && !b) return L; const m = { h: 'Clinical notes and procedures', t: [a && a.t, b && b.t].filter(Boolean).join('\n\n') }; const out = []; let put = false; L.forEach((x) => { if (x === a || x === b) { if (!put) { out.push(m); put = true; } } else out.push(x); }); return out; }
/* ---------- 🔍 Find inside one record (new records: words in the boxes too) ---------- */
function ezyFindBar(target) { return `<div class="ezy-find" data-target="${target || ''}"><input type="search" class="ezy-fq" placeholder="🔍 Find in this record" aria-label="Find in this record" autocomplete="off"><span class="ezy-fn hint"></span><button type="button" class="btn small" data-act="ezy-fprev" aria-label="Previous match">▴</button><button type="button" class="btn small" data-act="ezy-fnext" aria-label="Next match">▾</button></div>`; }
function ezFindRoot(bar) { const t = bar.dataset.target; return (t && document.getElementById(t)) || bar.closest('.ezy-in') || document.getElementById('list'); }
function ezFind(inp, step) { const bar = inp.closest('.ezy-find'); const root = ezFindRoot(bar); const q = inp.value.trim().toLowerCase(); EZ.findQ = inp.value.trim();
  root.querySelectorAll('mark.ezy-m').forEach((m) => { const p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
  const n = bar.querySelector('.ezy-fn'); if (!q) { n.textContent = ''; bar._hits = []; return; }
  const hits = []; const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (x) => (x.parentElement.closest('.ezy-find,script,style,select,option,button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const texts = []; while (walk.nextNode()) texts.push(walk.currentNode);
  texts.forEach((tn) => { const s = tn.nodeValue; const low = s.toLowerCase(); let i = low.indexOf(q); if (i < 0) return; const frag = document.createDocumentFragment(); let last = 0;
    while (i >= 0) { frag.appendChild(document.createTextNode(s.slice(last, i))); const m = document.createElement('mark'); m.className = 'ezy-m'; m.textContent = s.slice(i, i + q.length); frag.appendChild(m); hits.push(m); last = i + q.length; i = low.indexOf(q, last); }
    frag.appendChild(document.createTextNode(s.slice(last))); tn.parentNode.replaceChild(frag, tn); });
  root.querySelectorAll('textarea, input[type=text], input:not([type])').forEach((el) => { if (el.closest('.ezy-find')) return; const low = (el.value || '').toLowerCase(); let i = low.indexOf(q); while (i >= 0) { hits.push({ el, i, len: q.length }); i = low.indexOf(q, i + q.length); } });
  hits.sort((a, b) => { const ea = a.el || a, eb = b.el || b; return ea === eb ? (a.i || 0) - (b.i || 0) : ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });
  bar._hits = hits; bar._i = -1; n.textContent = hits.length ? `${hits.length} found` : 'not found'; if (hits.length && step !== null) ezFindGo(bar, 1); }
function ezFindGo(bar, d) { const H = bar._hits || []; if (!H.length) return; bar._i = ((bar._i == null ? -1 : bar._i) + d + H.length) % H.length; const x = H[bar._i];
  document.querySelectorAll('mark.ezy-m.on').forEach((m) => m.classList.remove('on'));
  if (x.el) { x.el.scrollIntoView({ block: 'center' }); try { x.el.focus({ preventScroll: true }); x.el.setSelectionRange(x.i, x.i + x.len); } catch (e) { } } else { x.classList.add('on'); x.scrollIntoView({ block: 'center' }); }
  bar.querySelector('.ezy-fn').textContent = `${bar._i + 1} of ${H.length}`; }

/* ---------- Records → Search: every record, new and old ---------- */
function ezLocalText(r) { const out = []; const walk = (v, k) => { if (v == null || /^(id|_|pat|tpl|prod|bid|cid|fid|staff|by|rec)$/.test(k || '') || /^_/.test(k || '')) return; if (typeof v === 'string') { if (v.length > 1 && !/^(p|it|il|pt|c|b|f|bk)-?[a-z0-9]{6,}$/i.test(v)) out.push(v); } else if (Array.isArray(v)) v.forEach((x) => walk(x)); else if (typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, kk)); };
  walk(r); const b = IDX.biz.get(r.bid); if (b) out.push(b.name); (r.procs || []).forEach((p) => { const t = crTpl(p.tpl); if (t) out.push(t.name); }); (r.items || []).forEach((it) => { const p = crProd(it.prod); if (p) out.push(p.name); }); return out.join('\n'); }
function ezLocalSearch(q, o) { const words = q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return [];
  return crList('crrec').filter((r) => !r.gone && (!o.bid || r.bid === o.bid) && (!o.from || (r.date || '') >= o.from) && (!o.to || (r.date || '') <= o.to) && (!o.who || (r.staff || []).some((s) => (Bk.pname(s) || '').toLowerCase().includes(o.who.toLowerCase()))))
    .map((r) => { const t = ezLocalText(r); const low = t.toLowerCase(); if (!words.every((w) => low.includes(w))) return null; const i = low.indexOf(words[0]); const s = Math.max(0, i - 60); let snip = (s ? '…' : '') + t.slice(s, i + 120).replace(/\n/g, ' ') + '…';
      return { r, hit: snip }; }).filter(Boolean).sort((a, b) => (b.r.date || '').localeCompare(a.r.date || '')); }
const ezMark = (s, q) => { let t = h(s || ''); if (/«/.test(s || '')) return t.replace(/«/g, '<mark>').replace(/»/g, '</mark>'); q.toLowerCase().split(/\s+/).filter((w) => w.length > 1).forEach((w) => { t = t.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); }); return t; };
function ezySearchHtml() { const R = EZ.res; const q = EZ.q;
  const vets = [...new Set(((window.SBAuth && SBAuth.list) || []).filter((s) => s.active !== false).map((s) => (s.preferred_name || s.full_name || '').split(' ')[0]).filter(Boolean))];
  return `<div class="d-wrap"><h2 class="sec-h" style="font-size:26px">Search records</h2><div class="hint" style="margin-bottom:8px">Finds words in every clinical record — the new ones and the old ezyVet ones (history, notes, exam, procedures, medications, diagnostics, results, invoices, messages and documents). Use quotes for an exact phrase ("foetal ageing"), and - to leave a word out. The ezyVet history needs the internet.</div>
  <form id="ezy-sf" class="card"><div class="search"><input id="ezy-q" type="search" placeholder="Search all records" value="${h(q)}" autocomplete="off" aria-label="Search all records"><button class="btn primary" type="submit">Search</button></div>
    <div class="grid2" style="margin-top:6px"><div class="f"><label for="ezy-from">From</label><input id="ezy-from" type="date" value="${h(EZ.from)}"></div><div class="f"><label for="ezy-to">To</label><input id="ezy-to" type="date" value="${h(EZ.to)}"></div>
    <div class="f"><label for="ezy-who">Vet / staff</label><select id="ezy-who"><option value="">Anyone</option>${vets.map((v) => `<option ${EZ.who === v ? 'selected' : ''}>${h(v)}</option>`).join('')}</select></div>
    <div class="f"><label for="ezy-scope">Look in</label><select id="ezy-scope">${[['all', 'All records'], ['new', 'New records (this app)'], ['consult', 'ezyVet consults'], ['invoice', 'ezyVet invoices'], ['comm', 'ezyVet messages'], ['doc', 'ezyVet documents and memos'], ['file', 'ezyVet file names']].map(([v, l]) => `<option value="${v}" ${EZ.scope === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div></form>
  ${R ? `<div class="card"><h3>${R.local.length + R.old.length} found${R.more ? ' (showing the best 100 from ezyVet)' : ''}</h3>${R.err ? `<div class="hint">ezyVet history: ${h(R.err)}</div>` : ''}
    ${R.local.map((x) => `<div class="kv bk-tap" data-act="ezy-lopen" data-id="${x.r.id}"><div class="k">${x.r.date ? bkDate(x.r.date, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div><div class="v"><b>${h((IDX.biz.get(x.r.bid) || {}).name || 'Record')}</b> <span class="pill" style="font-size:11px">new</span><br><span class="ezy-hit">${ezMark(x.hit, R.q)}</span></div></div>`).join('')}
    ${R.old.map((x) => { const b = D.businesses.find((bb) => (bb.ezyIds || []).includes(x.contact_id)); return `<div class="kv bk-tap" data-act="ezy-open" data-kind="${h(x.kind)}" data-id="${h(x.id)}" data-q="${h(R.q)}"><div class="k">${x.d ? bkDate(x.d, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</div><div class="v"><b>${h(b ? b.name : x.client || '')}</b> · ${h(x.title || ezOne[x.kind])} <span class="pill" style="font-size:11px">ezyVet ${h((ezOne[x.kind] || '').toLowerCase())}</span><br><span class="hint">${h([x.who, x.animal].filter(Boolean).join(' · '))}</span><br><span class="ezy-hit">${ezMark(x.hit, R.q)}</span></div></div>`; }).join('')}
    ${!R.local.length && !R.old.length ? '<div class="hint">Nothing found.</div>' : ''}</div>` : ''}</div>`; }
async function ezSearch(o) { const q = (o.q || '').trim(); if (!q) { EZ.res = null; renderAll(); return; } EZ.res = { q, local: [], old: [], busy: true };
  const sc = o.scope || 'all'; const local = sc === 'all' || sc === 'new' ? ezLocalSearch(q.replace(/"/g, ''), o) : []; let old = [], err = '';
  if (sc !== 'new') { try { old = (await rpc('ezy_search', { k: Dev.k(), q, contacts: o.contacts || null, animals: o.animals || null, kinds: sc === 'all' ? null : sc === 'doc' ? ['doc', 'memo'] : [sc], from_: o.from || null, to_: o.to || null, who: o.who || null, lim: 100 })) || []; } catch (e) { err = navigator.onLine ? (e.message || String(e)) : 'needs the internet'; } }
  EZ.res = { q, local, old, err, more: old.length >= 100 }; renderAll(); }

/* ---------- events ---------- */
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^ezy-|^ezynote-del$/.test(a)) return; const d = el.dataset;
  if (a === 'ezynote-del') { const j = jobs().find((x) => x.key === d.k); if (!j) return; const b = IDX.biz.get(j.id); if (!b) return; if (!(await ask('Delete this ezyVet note?\n\n' + j.warnTxt, 'Yes — delete it', true))) return;
    b.info = (b.info || '').replace('*From ezyVet:* ' + j.warnTxt, '').replace(j.warnTxt, '').replace(/\n{3,}/g, '\n\n').trim(); delete b.infoHtml; touch(b);
    const r = crCfg('ezyq'); if (r) { r.notes = (r.notes || []).filter((n) => !(n.bid === b.id && n.txt === j.warnTxt)); touch(r); } JOBS_CACHE = null; save(); if (window.Sync) Sync.soon(); renderAll(); toast('Note deleted'); return; }
  if (a === 'ezy-start') ezStart(); if (a === 'ezy-close') ezClose(); if (a === 'ezy-go') ezGo(); if (a === 'ezy-jobs') { ezClose(); S.tab = 'jobs'; renderAll(); }
  if (a === 'ezy-open') { if (d.q) EZ.findQ = d.q.replace(/"/g, '').split(/\s+/)[0]; else EZ.findQ = ''; ezOpen(d.kind, d.id); }
  if (a === 'ezy-lopen') { crOpen(d.id); setTimeout(() => { const i = document.querySelector('#list .ezy-fq'); if (i && EZ.res) { i.value = EZ.res.q.replace(/"/g, '').split(/\s+/)[0]; ezFind(i, 0); } }, 50); }
  if (a === 'ezy-htab') { const c = el.closest('.ezyhist'); const k = c.dataset.ezk; EZ.histQ[k] = { ...(EZ.histQ[k] || {}), tab: d.k }; renderAll(); }
  if (a === 'ezy-fnext' || a === 'ezy-fprev') { const bar = el.closest('.ezy-find'); if (!bar._hits) ezFind(bar.querySelector('.ezy-fq'), null); ezFindGo(bar, a === 'ezy-fnext' ? 1 : -1); } });
document.addEventListener('submit', (e) => { if (e.target.id !== 'ezy-sf') return; e.preventDefault(); const g = (id) => (document.getElementById(id) || {}).value || '';
  EZ.q = g('ezy-q'); EZ.from = g('ezy-from'); EZ.to = g('ezy-to'); EZ.who = g('ezy-who'); EZ.scope = g('ezy-scope') || 'all'; ezSearch({ q: EZ.q, from: EZ.from, to: EZ.to, who: EZ.who, scope: EZ.scope }); });
document.addEventListener('input', (e) => { const t = e.target; if (!t.classList) return;
  if (t.classList.contains('ezy-fq')) { clearTimeout(t._tm); t._tm = setTimeout(() => ezFind(t, 0), 200); }
  if (t.classList.contains('ezy-hq')) { const c = t.closest('.ezyhist'); const k = c.dataset.ezk; EZ.histQ[k] = { ...(EZ.histQ[k] || {}), q: t.value }; clearTimeout(t._tm); t._tm = setTimeout(async () => {
    const qq = t.value.trim(); if (qq.length > 2) { try { const res = await rpc('ezy_search', { k: Dev.k(), q: qq, contacts: c.dataset.ezc ? c.dataset.ezc.split(',') : null, animals: c.dataset.eza ? c.dataset.eza.split(',') : null, kinds: null, from_: null, to_: null, who: null, lim: 300 }); const ids = new Set((res || []).map((r) => r.kind + ':' + r.id));
      const st = EZ.hist[k]; if (st) st.rows.forEach((r) => (r._hit = ids.has(r.kind + ':' + r.id))); EZ.histQ[k].ids = ids; } catch (x) { } }
    const pos = t.selectionStart; renderAll(); const n = document.querySelector(`.ezyhist[data-ezk="${CSS.escape(k)}"] .ezy-hq`); refocus(n, pos); }, 400); } });
// is database update 9 in? (Admin jobs ticks itself off) — and how much history is loaded
async function ezProbe() { if (EZ._probed || !(window.SBAuth && SBAuth.s && typeof Dev !== 'undefined')) return; EZ._probed = true; try { EZ.counts = await rpc('ezy_status', { k: Dev.k() }); EZ.sql09 = true; } catch (e) { EZ.sql09 = false; } }
setInterval(() => { if (!EZ._probed && navigator.onLine) ezProbe(); }, 5000);
window.EZ = EZ; window.ezyJobs = ezyJobs; window.ezyBizCard = ezyBizCard; window.ezyPatCard = ezyPatCard; window.ezySearchHtml = ezySearchHtml; window.ezyFindBar = ezyFindBar;
if (typeof module !== 'undefined') module.exports = { ezCsv, ezPlan, ezArchive, ezD, ezT, ezNorm };
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=ezyrev]'); if (!el) return; const d = el.dataset; const r = crCfg('ezyq'); if (!r) return; const x = (r.review || []).find((y) => y.bid === d.bid); const b = IDX.biz.get(d.bid); if (!x || !b) return;
  const pick = d.v === 'addall' || d.v === 'skipall' ? x.items.slice() : [x.items[+d.i]].filter(Boolean); const add = d.v === 'add' || d.v === 'addall'; if (!pick.length) return;
  if (add) pick.forEach((it) => ezyRevApply(b, it)); x.items = x.items.filter((it) => !pick.includes(it)); r.review = (r.review || []).filter((y) => y.items.length); touch(r);
  NEXT_LOG_LABEL = `${add ? 'Added' : 'Left out'} from ezyVet for ${b.name}: ${pick.map((it) => it.t.split(':')[0]).join(', ')}`; JOBS_CACHE = null; reindex(); S.skipConfirm = true; if (await changed()) toast(add ? 'Added' : 'Left out'); });
