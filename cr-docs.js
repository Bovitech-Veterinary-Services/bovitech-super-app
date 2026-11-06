/* Bovitech Super App — certificates and reports (PD, BBSE, HBSE, fit to load, insurance, blank letter,
   post-mortem report, biosecurity plan), made from a record and printed or saved as PDF.
   Templates are changed in Settings → Templates. In a template:
     {{trading}}  an automatic detail (see CR_AUTO below) — filled in from the record
     [[Label]]    a box to fill in        [[Label: choice one / choice two]]  a choice (or type something else)
     [[Label::]]  a bigger box for a paragraph
   The header (the vet's name, qualifications and registration, or the practice address) and the footer
   (Regards, signature, name and date) come from Settings → Templates → Signatures, for whoever signs. */
'use strict';
const CR_AUTO = { trading: 'Name for invoices (trading name)', client: 'Business name', pic: 'PIC', property: 'Property (farm name and address)', property_name: 'Farm name', property_address: 'Farm address', date: 'Date of the visit (dd/mm/yyyy)', date_long: 'Date of the visit (12 October 2026)', today: 'Date signed', review_date: 'Date + 12 months',
  vet: 'Vet (Dr name)', vet_quals: 'Qualifications', vet_reg: 'Registration', vet_phone: 'Phone', vet_email: 'Email', signature: 'Signature picture', pd_table: 'Preg testing results table', animals: 'Patients on the record',
  bull_id: 'Bull: identification', bull_stud: 'Bull: stud identification', bull_breed: 'Bull: breed', bull_colour: 'Bull: colour', bull_age: 'Bull: age', bull_bcs: 'Bull: body condition score', bull_sc: 'Bull: scrotal circumference', bull_internal: 'Bull: internal tract', bull_external: 'Bull: external tract', bull_legs: 'Bull: legs, joints, hooves, gait', bull_head: 'Bull: head', bull_body: 'Bull: neck to hindquarters', bull_method: 'Bull: collection method', bull_conc: 'Bull: concentration', bull_motility: 'Bull: motility', bull_morph: 'Bull: morphology % normal', bull_serving: 'Bull: serving ability', bull_capacity: 'Bull: serving capacity', bull_risk: 'Bull: overall evaluation' };
const CR_WNL = 'within normal limits';
const CR_DOC_DEFAULTS = [
  { id: 'doc:pd', cfg: 'doc', order: 1, name: 'PD certificate', head: 'vet', foot: 'sig', prod: 'p-cert-pd', for: 'tpl:pd', body: `<h3 style="text-align:center"><u>CERTIFICATE OF PREGNANCY DIAGNOSIS IN CATTLE</u></h3>
<p><b>VENDOR:</b> {{trading}}<br><b>PIC:</b> {{pic}}<br><b>PROPERTY:</b> {{property}}<br><b>DATE OF PREGNANCY DIAGNOSIS:</b> {{date}}</p>
<p>This is to certify that cattle belonging to the above-mentioned vendor were pregnancy tested at the stated property, on the stated date.</p>
<p>This certificate details the pregnancy status of the below-mentioned cattle on the date of which the diagnosis was made. A diagnosis of “pregnant” or “not detectably pregnant” was made for each animal examined.</p>
<p>Foetal loss occurring after the date of diagnosis is possible and cannot be accounted for by this certificate. Pregnancies less than six weeks of gestation may not be detectable at the time of diagnosis.</p>
{{pd_table}}` },
  { id: 'doc:bbse', cfg: 'doc', order: 2, name: 'BBSE certificate', head: 'vet', foot: 'sig', prod: 'p-cert-bbse', for: 'tpl:bbse', perBull: true, body: `<h3 style="text-align:center"><u>CERTIFICATE OF BULL BREEDING SOUNDNESS EXAMINATION</u></h3>
<p><b>VENDOR:</b> {{trading}}<br><b>PIC:</b> {{pic}}<br><b>PROPERTY:</b> {{property}}<br><b>DATE OF EXAMINATION:</b> {{date}}</p>
<p>This certificate is to certify that a bull belonging to the above-mentioned vendor was physically assessed at the stated property, on the stated date.</p>
<p>This certificate details the physical examination findings of the below-mentioned bull on the date of which the examination was made. Changes occurring after the date of examination are possible and cannot be accounted for by this certificate.</p>
<p><i>Bull information</i></p><ul><li>Bull identification: {{bull_id}}</li><li>Stud identification provided by client: {{bull_stud}}</li><li>Breed: {{bull_breed}}</li><li>Colour: {{bull_colour}}</li><li>Age: {{bull_age}}</li></ul>
<p><i>Physical examination</i></p><ul><li>Body condition score: {{bull_bcs}}/5</li><li>Scrotal circumference: {{bull_sc}}cm</li><li>Palpation of internal reproductive tract (including prostate, seminal vesicles, ampullae, urethra, sigmoid flexure, epididymides, spermatic cord, testes): {{bull_internal}}</li><li>Visualisation and palpation of external reproductive tract (including scrotum, sheath, prepuce, glans penis, penile shaft): {{bull_external}}</li><li>Visualisation of legs, joints, hooves, and gait: {{bull_legs}}</li><li>Visualisation of head (including eyes, ears, nose, jaw alignment): {{bull_head}}</li><li>Visualisation of neck, forequarters, thorax, abdomen, hindquarters: {{bull_body}}</li></ul>
<p><i>Semen examination</i></p><ul><li>Method of collection: {{bull_method}}</li><li>Ejaculate concentration: {{bull_conc}}/5</li><li>Ejaculate motility: {{bull_motility}}% forward progressive</li><li>Ejaculate morphology*: {{bull_morph}}</li></ul>
<p><i>Serving examination</i></p><ul><li>Serving ability: {{bull_serving}}</li><li>Serving capacity: {{bull_capacity}}</li></ul>
<p><i>Overall evaluation</i></p><ul><li>{{bull_risk}}</li></ul>
<p style="font-size:11px">*Morphology is independently assessed by morphologists at Queensland Semen Morphology Laboratory, who are accredited under the Australian Cattle Veterinarian’s listed program.</p>` },
  { id: 'doc:hbse', cfg: 'doc', order: 3, name: 'HBSE certificate', head: 'vet', foot: 'sig', body: `<h3 style="text-align:center"><u>CERTIFICATE OF HEIFER BREEDING SOUNDNESS EXAMINATION</u></h3>
<p><b>VENDOR:</b> {{trading}}<br><b>PIC:</b> {{pic}}<br><b>PROPERTY:</b> {{property}}<br><b>DATE OF EXAMINATION:</b> {{date}}</p>
<p>This certificate is to certify that a heifer belonging to the above-mentioned vendor was physically assessed at the stated property, on the stated date.</p>
<p>This certificate details the physical examination findings of the below-mentioned heifer on the date of which the examination was made. Changes occurring after the date of examination are possible and cannot be accounted for by this certificate. Pregnancies less than six weeks of gestation may not be detectable at the time of diagnosis.</p>
<p><i>Heifer information</i></p><ul><li>Heifer identification: [[Heifer identification]]</li><li>Stud identification provided by client: [[Stud identification]]</li><li>Breed: [[Breed]]</li><li>Colour: [[Colour]]</li><li>Age: [[Age]]</li></ul>
<p><i>Physical examination</i></p><ul><li>Body condition score: [[Body condition score]]/5</li><li>Palpation of internal reproductive tract (including cervix, ovaries, uterine horns): [[Internal reproductive tract: within normal limits / abnormal — ]]</li><li>Pregnancy status: [[Pregnancy status: not detectably pregnant / pregnant]]</li><li>Visualisation of external reproductive tract (including vulva and udder): [[External reproductive tract: within normal limits / abnormal — ]]</li><li>Visualisation of legs, joints, hooves, and gait: [[Legs, joints, hooves and gait: within normal limits / abnormal — ]]</li><li>Visualisation of head (including eyes, ears, nose, jaw alignment): [[Head: within normal limits / abnormal — ]]</li><li>Visualisation of neck, forequarters, thorax, abdomen, hindquarters: [[Neck to hindquarters: within normal limits / abnormal — ]]</li></ul>` },
  { id: 'doc:ftl', cfg: 'doc', order: 4, name: 'Fit to load certificate (ACV)', head: 'vet', foot: 'none', prod: 'p-cert-ftl', body: `<h3 style="text-align:center"><u>CERTIFICATE TO TRANSPORT CATTLE UNDER VETERINARY ADVICE</u></h3>
<p style="text-align:center;font-size:11px">(under the Australian Animal Welfare Standards and Guidelines for the Land Transport of Livestock, Part A, Section 4, SA4.2)</p>
<p style="font-size:12px">A copy of this certificate is to be provided to the driver of the transport vehicle on collection of the animal(s), and to the receival stockmen and the On-Plant Veterinarian on arrival of the animal(s) at the lairage facility.</p>
<p>This is to certify that I examined the following cattle intended for transport:</p>
<table><tbody><tr><th>Date</th><td>{{date}}</td><th>Time</th><td>[[Time examined]]</td></tr>
<tr><th>Location and owner / consignor (name, address, PIC)</th><td colspan="3">{{trading}} — {{property}} — PIC {{pic}}</td></tr>
<tr><th>Identification of cattle</th><td colspan="3">[[Identification of cattle (age, colour, breed, sex, brand, management tag, NLIS)]]</td></tr>
<tr><th>Purpose of transport</th><td colspan="3">[[Purpose of transport: Slaughter / Treatment / Feed or management]]</td></tr>
<tr><th>Proposed destination (receiver name, address, PIC)</th><td colspan="3">[[Proposed destination: Western Meat Packers]]</td></tr>
<tr><th>Proposed start and end of transport</th><td colspan="3">Start: [[Transport start]] &nbsp; End: [[Transport end]]</td></tr></tbody></table>
<p>These livestock were consistent with Standard SA4.2 of the Australian Animal Welfare Standards and Guidelines — Land Transport of Livestock (2012) and were <b>not</b>:</p>
<ul><li>unable to walk on their own by bearing weight on all legs</li><li>severely emaciated</li><li>visibly dehydrated</li><li>showing visible signs of severe injury or distress</li><li>suffering from conditions that are likely to cause increased pain or distress during transport</li></ul>
<p><b>The animal is exhibiting the following clinical signs at the time of examination:</b> [[Clinical signs (describe the lesions or lameness; lameness score out of 5)::]]</p>
<p>Veterinarians may only certify compromised animals as being fit for transport where it is in the best interest of the welfare of the animal. My advice is that the above stock are fit for transport as described above provided the following conditions are met:</p>
<ol type="a"><li>They are transported within [[Transported within: 24 hours / 48 hours / 7 days]] of this examination</li><li>They are transported directly to the destination, and transport is not more than [[Transport no longer than (hours)]] hours duration</li><li>That there is no worsening of the condition prior to transport</li><li>The animal is handled with appropriate care</li><li>The transporter is aware of the animal’s condition</li><li>The animal is penned in the truck at reduced density: [[Penned: separately / at 90% density / at 50% density / with 1–2 others]]</li><li>The receiver is aware of the animal’s condition</li><li>Extreme environmental conditions are not predicted</li><li>Plans for emergency humane destruction are in place if necessary</li>
<li>Other: [[Other conditions: If the vehicle is transporting animals from multiple properties, this animal is the last consignment loaded, so the time between loading and unloading is kept to a minimum. If the vehicle has multiple decks, this animal is loaded onto the bottom deck only. The animal is presented to the On-Plant Veterinarian on arrival and an emergency slaughter disposition applied if deemed appropriate. / If the vehicle is transporting animals from multiple properties, this animal is the last consignment loaded, so the time between loading and unloading is kept to a minimum. The animal is presented to the On-Plant Veterinarian on arrival and an emergency slaughter disposition applied if deemed appropriate. / Nil]]</li></ol>
<p>It is my professional opinion that this animal will not suffer undue harm by being transported directly to slaughter, provided that its condition does not further deteriorate between the time of examination and transport and that the above-mentioned conditions are adhered to.</p>
<table><tbody><tr><th>Veterinarian</th><td>Name: {{vet}} {{vet_quals}}{{vet_reg}}</td><td>Contact: {{vet_phone}} · {{vet_email}}</td></tr><tr><th>Signed</th><td colspan="2">{{signature}}</td></tr><tr><th>Date</th><td colspan="2">{{today}}</td></tr>
<tr><th>Owner / person in charge</th><td>Name: [[Owner or person in charge]]</td><td>Contact: [[Owner's contact details]]</td></tr><tr><th>Signed</th><td colspan="2">&nbsp;<br>&nbsp;</td></tr><tr><th>Date</th><td colspan="2">&nbsp;</td></tr></tbody></table>
<p style="font-size:10px">Based on the Australian Cattle Veterinarians’ Certificate to Transport Cattle Under Veterinary Advice.</p>` },
  { id: 'doc:ins', cfg: 'doc', order: 5, name: 'Insurance certificate', head: 'vet', foot: 'sig', prod: 'p-cert-ins', body: `<p>To the delegate of {{trading}},</p>
<p>On the {{date_long}} I examined a [[Age (years)]]-year-old [[Colour]] [[Breed]] bull ([[Identification (freeze brand on the near side rump, management tag colour and number, left or right ear, NLIS RFID / visual number)]]), belonging to {{trading}}.</p>
<p>The above-mentioned bull presented with [[Describe the lesion::]]. Photos are attached below.</p>
<p>Due to the bull’s condition, I would regard the prognosis for its breeding future as a natural sire to be [[Prognosis: guarded to hopeless / guarded / poor / hopeless]] and recommend culling the animal. [[Fitness to load: The animal is not currently fit to load and should be humanely euthanised on farm. / The animal is fit to load and should be transported directly to slaughter.]]</p>
<p>For further information, please do not hesitate to contact me.</p>` },
  { id: 'doc:blank', cfg: 'doc', order: 6, name: 'Blank letter / certificate', head: 'vet', foot: 'sig', body: `<p>To [[To]],</p>
<p>[[Letter::]]</p>
<p>For further information, please do not hesitate to contact me.</p>` },
  { id: 'doc:pm', cfg: 'doc', order: 7, name: 'Post-mortem report', head: 'practice', foot: 'sig', body: CR_TPL_PM },
  { id: 'doc:bio', cfg: 'doc', order: 8, name: 'Biosecurity plan', head: 'none', foot: 'none', body: CR_TPL_BIO },
];
CR_DOC_DEFAULTS.forEach((d) => { d.orig = d.body; CR_CFG_DEFAULTS.push(d); });
const crDocTpls = () => crList('crcfg').filter((x) => x.cfg === 'doc' && !x.gone).sort((a, b) => (a.order || 50) - (b.order || 50) || a.name.localeCompare(b.name));
const crDocTpl = (id) => crList('crcfg').find((x) => x.id === id && x.cfg === 'doc' && !x.gone);

/* ---------------- the fill-in boxes in a template ---------------- */
const CR_FIELD_RE = /\[\[([^\]]+?)\]\]/g;
function crDocField(raw) { const s = raw.trim(); if (/::$/.test(s)) return { label: s.slice(0, -2).trim(), long: true, raw: s };
  const i = s.indexOf(':'); if (i > 0 && s.slice(i + 1).trim()) { const label = s.slice(0, i).trim(); const opts = s.slice(i + 1).split(' / ').map((x) => x.trim()).filter((x, j, a) => x || a.length === 1); return { label, opts, raw: s }; } return { label: s, raw: s }; }
function crDocFields(body) { const out = [], seen = new Set(); String(body || '').replace(CR_FIELD_RE, (m, raw) => { const f = crDocField(raw); if (!seen.has(f.label)) { seen.add(f.label); out.push(f); } return m; }); return out; }

/* ---------------- automatic details ---------------- */
const crDMY = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const crLongDate = (d) => (d ? bkDate(d, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
function crVetInfo(sid) { const s = ((crCfg('sigs') || {}).list || {})[sid] || {}; const p = Bk.person(sid) || {}; const full = s.name || p.full_name || '';
  return { name: full ? (/^dr\b/i.test(full) ? full : (p.role === 'vet' ? 'Dr ' : '') + full) : '', quals: s.title || '', reg: s.reg || '', phone: s.phone || ((crBrand().lines || []).find((l) => /\d{4}\s?\d{3}\s?\d{3}/.test(l)) || '0499 489 919').replace(/^phone:\s*/i, ''), email: (s.emails && s.emails.length ? s.emails.join(' · ') : s.email) || 'office@bovitech.com.au', img: s.img || '' }; }
function crDocCtx(r, doc, bull) {
  const b = r && IDX.biz.get(r.bid); const f = r && (r.stops || []).map((s) => IDX.farms.get(s.fid)).find(Boolean); const v = crVetInfo(doc.vet);
  const pdPr = r && (r.procs || []).find((p) => (crTpl(p.tpl) || {}).quick === 'pd');
  const c = { trading: b ? b.tradingName || b.name : '', client: b ? b.name : '', pic: b ? (b.pics || []).map((p) => p.value).filter(Boolean).join(', ') : '',
    property_name: f ? f.name || '' : '', property_address: f ? f.address || '' : '', date: crDMY(doc.date || (r && r.date)), date_long: crLongDate(doc.date || (r && r.date)), today: crDMY(doc.signed || bkToday()),
    review_date: crDMY(bkAddMonths ? bkAddMonths(doc.date || (r && r.date) || bkToday(), 12) : ''), vet: v.name, vet_quals: v.quals, vet_reg: v.reg ? ` (registration ${v.reg})` : '', vet_phone: v.phone, vet_email: v.email,
    signature: v.img ? `<img src="${v.img}" alt="Signature" style="max-height:60px">` : '', animals: r ? (r.patients || []).map((p) => crPatName(r, p.id).replace(/^\S+\s/, '')).join('; ') : '', pd_table: pdPr ? crPdTable(r, pdPr) : '' };
  c.property = f ? `${f.name ? '“' + f.name + '”' : ''}${f.name && f.address ? ' – ' : ''}${f.address || ''}` : '';
  if (bull) { const x = bull; Object.assign(c, { bull_id: [x.vtag && 'tag ' + x.vtag, x.brand && 'brand ' + x.brand, x.nlis && 'NLIS ' + x.nlis].filter(Boolean).join(', '), bull_stud: x.stud || 'not applicable', bull_breed: x.breed || '', bull_colour: x.colour || '', bull_age: x.age || '', bull_bcs: x.bcs ?? '', bull_sc: x.sc ?? '',
    bull_internal: x.internal || CR_WNL, bull_external: x.external || CR_WNL, bull_legs: x.legs || CR_WNL, bull_head: x.head || CR_WNL, bull_body: x.body || CR_WNL, bull_method: x.method || 'electroejaculation', bull_conc: x.conc ?? '', bull_motility: x.motility ?? '', bull_morph: x.morph === '' || x.morph == null ? 'results pending' : x.morph + '% normal',
    bull_serving: x.serving || 'not assessed', bull_capacity: x.capacity || 'not assessed', bull_risk: x.risk || 'Low risk of reduced fertility based on the findings of this examination' }); }
  return c;
}
function crPdTable(r, pr) { // description · status · NLIS, from the results
  const rows = []; const an = pr.animals || []; const pat = (r.patients || []).find((p) => p.id === pr.pat) || {}; const desc = pat.level === 'mob' ? [pat.class, pat.name].filter(Boolean).join(' ') : pat.level === 'animal' ? [pat.breed, pat.class].filter(Boolean).join(' ') : '';
  const st = (x) => (x.res === 'P' || x.res === 'H' ? 'Pregnant' : x.res === 'R' ? 'Recheck' : 'Not detectably pregnant');
  const tagged = an.filter((x) => x.tag); const untagged = an.filter((x) => !x.tag);
  tagged.forEach((x) => rows.push([`1 ${desc || 'head'} (tag ${x.tag})`, st(x), '']));
  const grp = { Pregnant: 0, 'Not detectably pregnant': 0, Recheck: 0 }; untagged.forEach((x) => grp[st(x)]++); const cn = pr.counts || {}; grp.Pregnant += (+cn.P || 0) + (+cn.H || 0); grp['Not detectably pregnant'] += +cn.NDP || 0; grp.Recheck += +cn.R || 0;
  Object.entries(grp).forEach(([k, n]) => { if (n) rows.push([`${n} ${desc || 'head'}`, k, '']); });
  if (!rows.length) rows.push(['', '', '']);
  return `<table class="pdt"><thead><tr><th>DESCRIPTION OF CATTLE</th><th>PREGNANCY STATUS</th><th>NLIS RFID</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${h(x[0])}</td><td>${h(x[1])}</td><td>${h(x[2])}</td></tr>`).join('')}</tbody></table>`;
}
function crDocDefault(label, c) { const l = label.toLowerCase();
  if (/^property name|^farm name/.test(l)) return c.property_name; if (/^property address|^farm address/.test(l)) return c.property_address; if (/^vendor|^owner$|trading/.test(l)) return c.trading; if (/^pic$/.test(l)) return c.pic; if (/^client$/.test(l)) return c.client; return ''; }

/* ---------------- the finished document ---------------- */
function crDocBodyHtml(tpl, doc, r, bull) {
  if (doc.html && !bull) return doc.html; const c = crDocCtx(r, doc, bull); const vals = doc.vals || {};
  return String(tpl.body || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (k in c ? (['pd_table', 'signature'].includes(k) ? c[k] : h(c[k])) : m))
    .replace(CR_FIELD_RE, (m, raw) => { const f = crDocField(raw); const v = vals[f.label]; return v != null && v !== '' ? h(v).replace(/\n/g, '<br>') : '<span class="blank">________</span>'; });
}
function crDocHead(tpl, doc) { const br = crBrand(); const v = crVetInfo(doc.vet); const logo = br.logo ? `<img src="${br.logo}" alt="" class="logo">` : '';
  if (tpl.head === 'none') return ''; if (tpl.head === 'practice' || !doc.vet) return `<div class="lh">${logo}<div>${(br.lines || []).map((l, i) => (i ? h(l) : `<b style="font-size:17px">${h(l)}</b>`)).join('<br>')}</div></div>`;
  return `<div class="lh">${logo}<div><b style="font-size:16px">${h((br.lines || [])[0] || 'Bovitech Veterinary Services')}</b><br>${h(v.name)}${v.quals ? ' ' + h(v.quals) : ''}${v.reg ? `<br><span style="font-size:11px">Veterinary Surgeons’ Board of Western Australia Registration ${h(v.reg)}</span>` : ''}<br>${h(v.phone)}<br>${h(v.email)}</div></div>`; }
/* every certificate gets its own code (e.g. BVS-PD-261106-K7Q2) and a version number that goes up whenever it's changed */
const CR_DOC_ABBR = (tpl) => { const n = String(tpl.name || 'Doc'); const m = { bbse: 'BBSE', 'fit to load': 'FTL', insurance: 'INS', 'post mortem': 'PM', 'post-mortem': 'PM', pregnan: 'PD', preg: 'PD' }; for (const [k, v] of Object.entries(m)) if (n.toLowerCase().includes(k)) return v; return n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'DOC'; };
function crDocCode(tpl, doc) { const d = String(doc.signed || bkToday()).replace(/-/g, '').slice(2); const al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const used = new Set(crList('crrec').flatMap((r) => (r.docs || []).map((x) => x.code)).filter(Boolean)); let c;
  do { c = `BVS-${CR_DOC_ABBR(tpl)}-${d}-${[...Array(4)].map(() => al[Math.floor(Math.random() * al.length)]).join('')}`; } while (used.has(c)); return c; }
const crDocSig = (doc) => JSON.stringify([doc.vet, doc.date, doc.signed, doc.vals || {}, doc.bulls || null, doc.html || null]);
function crDocStamp(tpl, doc, before, why) { if (!doc.code) doc.code = crDocCode(tpl, doc); if (!doc.ver) { doc.ver = 1; doc.vers = [{ v: 1, at: Date.now(), by: crMe(), why: 'Made' }]; return; }
  if (before != null && before !== crDocSig(doc)) { doc.ver += 1; doc.vers = [...(doc.vers || []), { v: doc.ver, at: Date.now(), by: crMe(), why: why || 'Changed' }]; } }
const crDocIdLine = (doc) => (doc.code ? `<div class="docid">Certificate no. <b>${h(doc.code)}</b> · Version ${doc.ver || 1}${(doc.vers || []).length ? ' · ' + crDMY(new Date((doc.vers[doc.vers.length - 1] || {}).at || Date.now()).toISOString().slice(0, 10)) : ''}</div>` : '');
function crDocFoot(tpl, doc) { if (tpl.foot === 'none') return ''; const v = crVetInfo(doc.vet); return `<div class="sig"><p>Regards,</p>${v.img ? `<img src="${v.img}" alt="Signature">` : '<div style="height:40px"></div>'}<div>${h(v.name)}${v.quals ? ' ' + h(v.quals) : ''}</div><div>${crDMY(doc.signed || bkToday())}</div></div>`; }
const CR_DCSS = `.lh{display:flex;gap:16px;align-items:center;justify-content:space-between;border-bottom:2px solid #222;padding-bottom:8px;margin-bottom:14px}.lh>div{text-align:right}.logo{max-height:90px;max-width:200px}h3{font-size:16px;margin:18px 0 12px}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #444;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f1f1f1;font-weight:600}.pdt th{text-align:center}.blank{color:#999}.sig{margin-top:22px}.sig img{max-height:60px;display:block;margin:4px 0}.pb{page-break-after:always;break-after:page}.docid{margin-top:16px;padding-top:6px;border-top:1px solid #bbb;font-size:11px;color:#444}ul,ol{margin:4px 0 8px 20px;padding:0}li{margin:2px 0}`;
function crDocPage(tpl, doc, r, bull) { return `${crDocHead(tpl, doc)}${crDocBodyHtml(tpl, doc, r, bull)}${crDocFoot(tpl, doc)}${crDocIdLine(doc)}`; }
function crDocFull(tpl, doc, r) { // the whole printable file (one page per bull for BBSE certificates)
  const bulls = tpl.perBull ? crBullsFor(r, doc) : null; const pages = bulls && bulls.length ? bulls.map((b, i) => `<div class="${i < bulls.length - 1 ? 'pb' : ''}">${crDocPage(tpl, doc, r, b)}</div>`).join('') : crDocPage(tpl, doc, r, null);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${h(tpl.name)} — ${h(crBizName(r.bid))} — ${h(doc.date || r.date)}</title><style>${CR_PCSS}${CR_DCSS}</style></head><body>${pages}</body></html>`;
}
function crBullsFor(r, doc) { const pr = (r.procs || []).find((p) => p.id === doc.proc) || (r.procs || []).find((p) => p.tpl === 'tpl:bbse'); const L = (pr && pr.bulls) || []; return doc.bulls && doc.bulls.length ? L.filter((b) => doc.bulls.includes(b.id)) : L; }

/* ---------------- making one from a record ---------------- */
function crDocVets(r) { const all = (SBAuth.list || []).filter((s) => s.active && s.role === 'vet'); return all.length ? all : Bk.people(); }
function crDocOpen(r, tplId, docId) {
  const tpl = crDocTpl(tplId); if (!tpl || !r) return; const ex = docId && (r.docs || []).find((d) => d.id === docId);
  const doc = ex ? bkClone(ex) : { id: uid('dc'), tpl: tplId, vet: (r.staff || []).find(crIsVet) || (crIsVet(crMe()) ? crMe() : (crDocVets(r)[0] || {}).id), date: r.date, signed: bkToday(), vals: {}, at: Date.now(), by: crMe() };
  const c = crDocCtx(r, doc, null); const fields = crDocFields(tpl.body);
  const bbsePr = tpl.perBull ? (r.procs || []).find((p) => p.tpl === 'tpl:bbse') : null; if (bbsePr) doc.proc = bbsePr.id;
  const fld = (f, i) => { const v = doc.vals[f.label] ?? crDocDefault(f.label, c); if (f.long) return `<div class="f"><label for="cdf-${i}">${h(f.label)}</label><textarea id="cdf-${i}" data-cdf="${h(f.label)}" rows="4">${h(v)}</textarea></div>`;
    if (f.opts) { const other = v && !f.opts.includes(v); return `<div class="f"><label for="cdf-${i}">${h(f.label)}</label><select id="cdf-${i}" data-cdfsel="${i}"><option value="">Choose…</option>${f.opts.map((o) => `<option ${o === v ? 'selected' : ''}>${h(o)}</option>`).join('')}<option value="__other" ${other ? 'selected' : ''}>Other — type it</option></select><input data-cdf="${h(f.label)}" data-cdfo="${i}" value="${h(v)}" ${other ? '' : 'hidden'} style="margin-top:4px" aria-label="${h(f.label)} — type it"></div>`; }
    return `<div class="f"><label for="cdf-${i}">${h(f.label)}</label><input id="cdf-${i}" data-cdf="${h(f.label)}" value="${h(v)}"></div>`; };
  openSheet(tpl.name, `<div class="grid2"><div class="f"><label for="cd-vet">Signed by</label><select id="cd-vet">${crDocVets(r).map((s) => `<option value="${s.id}" ${s.id === doc.vet ? 'selected' : ''}>${h(s.preferred_name || s.full_name)}</option>`).join('')}</select><div class="hint">The header and footer are theirs (Settings → Templates → Signatures).</div></div>
    <div class="f"><label for="cd-date">Date of the visit / examination</label><input id="cd-date" type="date" value="${h(doc.date || '')}"></div></div>
    <div class="f"><label for="cd-signed">Date signed</label><input id="cd-signed" type="date" value="${h(doc.signed || bkToday())}"></div>
    ${bbsePr ? `<div class="f"><label>Bulls (one certificate each)</label><div class="cr-chks">${(bbsePr.bulls || []).map((b) => `<label class="bk-radio"><input type="checkbox" class="cd-bull" value="${b.id}" ${!doc.bulls || doc.bulls.includes(b.id) ? 'checked' : ''}> ${h(crBullName(b))}</label>`).join('') || '<span class="hint">No bulls recorded on the BBSE procedure yet — add them first.</span>'}</div></div>` : ''}
    ${fields.map(fld).join('') || '<div class="hint">Everything in this one fills in from the record.</div>'}
    ${doc.html ? '<div class="cr-warn">The finished text has been changed by hand — those changes are kept. <button type="button" class="btn small" data-act="cr-docunedit">Go back to the template</button></div>' : ''}
    <div class="hint">After saving you can print it or save it as a PDF, and change any of the finished wording (✏️ on the record).</div>`, () => {
    const g = (id) => document.getElementById(id).value; doc.vet = g('cd-vet'); doc.date = g('cd-date') || r.date; doc.signed = g('cd-signed') || bkToday();
    document.querySelectorAll('[data-cdf]').forEach((el) => { doc.vals[el.dataset.cdf] = el.value.trim(); });
    if (bbsePr) doc.bulls = [...document.querySelectorAll('.cd-bull:checked')].map((x) => x.value);
    crDocStamp(tpl, doc, ex ? crDocSig(ex) : null, 'Details changed'); r.docs = (r.docs || []).filter((d) => d.id !== doc.id); r.docs.push(doc);
    if (!ex && tpl.prod && crProd(tpl.prod) && !(r.certs || []).some((x) => x.prod === tpl.prod)) r.certs = [...(r.certs || []), { prod: tpl.prod, qty: tpl.perBull ? Math.max(1, (doc.bulls || []).length) : 1 }]; /* the certificate fee */
    touch(r); crInvSync(r); save(); Sync.soon(); setTimeout(() => { renderAll(); crPrint(crDocFull(tpl, doc, r)); }, 0); return true;
  }, '<button class="btn" data-act="cr-docprev" type="button">👁 Preview</button>');
  const sh = document.getElementById('sheet');
  sh.addEventListener('change', (e) => { const i = e.target.dataset.cdfsel; if (i == null) return; const o = sh.querySelector(`[data-cdfo="${i}"]`); if (e.target.value === '__other') { o.hidden = false; o.value = ''; o.focus(); } else { o.hidden = true; o.value = e.target.value; } });
  sh.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (!el) return;
    if (el.dataset.act === 'cr-docprev') { const d2 = bkClone(doc); d2.vet = document.getElementById('cd-vet').value; d2.date = document.getElementById('cd-date').value; d2.signed = document.getElementById('cd-signed').value; d2.vals = {}; document.querySelectorAll('[data-cdf]').forEach((x) => { d2.vals[x.dataset.cdf] = x.value.trim(); }); if (bbsePr) d2.bulls = [...document.querySelectorAll('.cd-bull:checked')].map((x) => x.value); crDocPreview(crDocFull(tpl, d2, r)); }
    if (el.dataset.act === 'cr-docunedit') { doc.html = null; el.closest('.cr-warn').remove(); toast('Back to the template wording — Save to keep that'); } });
}
function crDocPreview(full) { const ov = document.createElement('div'); ov.className = 'cr-prev'; ov.innerHTML = `<div class="cr-prev-h"><button class="btn" data-act="cr-prevclose">‹ Close preview</button></div><iframe title="Preview"></iframe>`; document.body.appendChild(ov);
  const fr = ov.querySelector('iframe'); fr.contentWindow.document.open(); fr.contentWindow.document.write(full); fr.contentWindow.document.close(); ov.addEventListener('click', (e) => { if (e.target.closest('[data-act=cr-prevclose]')) ov.remove(); }); }
function crDocEditText(r, docId) { // change the finished wording directly
  const doc = (r.docs || []).find((d) => d.id === docId); const tpl = doc && crDocTpl(doc.tpl); if (!tpl) return;
  if (tpl.perBull) { toast('BBSE certificates are made from the bull details — change those, or the template'); return; }
  openSheet('Change the wording — ' + tpl.name, `<div class="hint" style="margin-bottom:6px">Type straight into the certificate. The header and footer stay as they are.</div>${crEditorBar('cde-ed')}<div id="cde-ed" class="cr-rich" contenteditable="true">${crDocBodyHtml(tpl, doc, r, null)}</div>`, () => {
    const before = crDocSig(doc); doc.html = crClean(document.getElementById('cde-ed').innerHTML); crDocStamp(tpl, doc, before, 'Wording changed'); touch(r); save(); Sync.soon(); setTimeout(renderAll, 0); toast('Saved — 🖨 to print it'); return true; });
}

/* ---------------- a small editor (bold, italic, lists, headings, fill-in boxes) ---------------- */
function crEditorBar(target, withFields) { return `<div class="cr-edbar" data-ed="${target}"><button type="button" data-cmd="bold" aria-label="Bold"><b>B</b></button><button type="button" data-cmd="italic" aria-label="Italic"><i>I</i></button><button type="button" data-cmd="underline" aria-label="Underline"><u>U</u></button><button type="button" data-cmd="insertUnorderedList" aria-label="Dot points">• List</button><button type="button" data-cmd="insertOrderedList" aria-label="Numbered list">1. List</button><button type="button" data-cmd="h3" aria-label="Heading">Heading</button><button type="button" data-cmd="p" aria-label="Normal text">Normal</button>${withFields ? '<button type="button" data-cmd="field">➕ Fill-in box</button><select data-cmd="auto" aria-label="Insert an automatic detail"><option value="">➕ Automatic detail…</option>' + Object.entries(CR_AUTO).map(([k, l]) => `<option value="${k}">${h(l)}</option>`).join('') + '</select>' : ''}</div>`; }
document.addEventListener('mousedown', (e) => { if (e.target.closest && e.target.closest('.cr-edbar button')) e.preventDefault(); }); // keep the cursor in the text
document.addEventListener('click', async (e) => { const b = e.target.closest && e.target.closest('.cr-edbar button'); if (!b) return; const ed = document.getElementById(b.parentElement.dataset.ed); if (!ed) return; ed.focus(); const c = b.dataset.cmd;
  if (c === 'h3' || c === 'p') document.execCommand('formatBlock', false, c); else if (c === 'field') { const ok = await askBox('Add a fill-in box', `<div class="f"><label for="cfb-l">What goes in it (shown when filling in)</label><input id="cfb-l" data-ask="l"></div><div class="f"><label for="cfb-o">Choices, one per line (leave empty for a box to type in)</label><textarea id="cfb-o" data-ask="o" rows="4"></textarea></div><label class="bk-radio"><input type="checkbox" data-ask="long"> A big box (for a paragraph)</label>`, 'Add it', false, 'Cancel');
    if (!ok || !(ASK_FORM.l || '').trim()) return; ed.focus(); const opts = String(ASK_FORM.o || '').split('\n').map((x) => x.trim()).filter(Boolean); document.execCommand('insertText', false, `[[${ASK_FORM.l.trim()}${opts.length ? ': ' + opts.join(' / ') : ASK_FORM.long ? '::' : ''}]]`); }
  else document.execCommand(c, false, null); });
document.addEventListener('change', (e) => { const s = e.target; if (!s.matches || !s.matches('.cr-edbar select[data-cmd=auto]') || !s.value) return; const ed = document.getElementById(s.parentElement.dataset.ed); ed.focus(); document.execCommand('insertText', false, `{{${s.value}}}`); s.value = ''; });
function crClean(html) { // keep simple formatting only (no scripts, no pasted styling)
  const t = document.createElement('template'); t.innerHTML = String(html || ''); const OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'SPAN', 'DIV', 'IMG']);
  const walk = (n) => { [...n.childNodes].forEach((c) => { if (c.nodeType === 8) { c.remove(); return; } if (c.nodeType !== 1) return; if (!OK.has(c.tagName)) { if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(c.tagName)) { c.remove(); return; } walk(c); c.replaceWith(...c.childNodes); return; }
    [...c.attributes].forEach((a) => { const keep = ['colspan', 'rowspan', 'type'].includes(a.name) || (a.name === 'style' && /^(\s*(text-align|font-size|font-weight)\s*:[^;]+;?)+$/i.test(a.value)) || (c.tagName === 'IMG' && a.name === 'src' && /^data:image\//.test(a.value)) || (c.tagName === 'SPAN' && a.name === 'class' && a.value === 'blank'); if (!keep) c.removeAttribute(a.name); }); walk(c); }); };
  walk(t.content); return t.innerHTML;
}

/* ---------------- the record: certificates and reports ---------------- */
function crDocsHtml(r) {
  const fin = r.status === 'final'; const docs = r.docs || [];
  return `${docs.map((d) => { const t = crDocTpl(d.tpl); return `<div class="cr-row"><b>📄 ${h(t ? t.name : 'Document')}</b><span class="hint">${d.vet ? h(Bk.pname(d.vet)) + ' · ' : ''}${crDMY(d.signed || d.date)}${t && t.perBull ? ` · ${crBullsFor(r, d).length} bull${crBullsFor(r, d).length === 1 ? '' : 's'}` : ''}${d.html ? ' · wording changed' : ''}${d.code ? ` · <b>${h(d.code)}</b> v${d.ver || 1}` : ''}</span><span style="flex:1"></span><button class="btn small" data-act="cr-docprint" data-id="${d.id}">🖨</button>${fin ? '' : `<button class="btn small" data-act="cr-docfill" data-id="${d.id}" aria-label="Change the details">✏️</button>${t && !t.perBull ? `<button class="btn small" data-act="cr-docwords" data-id="${d.id}">Wording</button>` : ''}<button class="btn small" data-act="cr-docdel" data-id="${d.id}" aria-label="Remove">✕</button>`}</div>`; }).join('')}
  ${fin ? '' : `<div class="cr-row"><select id="cr-adddoc" aria-label="Make a certificate or report"><option value="">➕ Make a certificate or report…</option>${crDocTpls().map((t) => `<option value="${t.id}">${h(t.name)}</option>`).join('')}</select></div>`}`;
}
window.crDocsHtml = crDocsHtml;

/* ---------------- BBSE: the bulls, the QSML sheet and Bull Reporter ---------------- */
const CR_BULL_FIND = [['internal', 'Internal reproductive tract'], ['external', 'External reproductive tract'], ['legs', 'Legs, joints, hooves and gait'], ['head', 'Head'], ['body', 'Neck to hindquarters']];
const CR_RISKS = ['Low risk of reduced fertility based on the findings of this examination', 'Moderate risk of reduced fertility based on the findings of this examination', 'High risk of reduced fertility based on the findings of this examination', 'Unable to assess'];
const crBullName = (b) => [b.vtag && 'Tag ' + b.vtag, b.brand && 'Brand ' + b.brand, b.nlis && 'NLIS ' + b.nlis].filter(Boolean).join(' · ') || 'Bull ' + (b.n || '');
function crBullsHtml(r, pr) {
  const L = pr.bulls || [];
  return `<div class="cr-pdres"><b>Bulls: ${L.length}</b>${L.map((b, i) => `<div class="cr-row bk-tap" data-act="cr-bulled" data-pr="${pr.id}" data-id="${b.id}"><span>${i + 1}. <b>${h(crBullName(b))}</b></span><span class="hint">${[b.breed, b.age && b.age + ' yo', b.sc && 'SC ' + b.sc, b.motility != null && b.motility !== '' && 'mot ' + b.motility + '%', b.morph != null && b.morph !== '' ? 'morph ' + b.morph + '%' : 'morph pending'].filter(Boolean).map(h).join(' · ')}</span></div>`).join('')}
    <div class="actions"><button class="btn primary" data-act="cr-bulladd" data-pr="${pr.id}">➕ Bull</button>${L.length ? `<button class="btn small" data-act="cr-qsml" data-pr="${pr.id}">📤 QSML recording sheet</button><button class="btn small" data-act="cr-qsmlin" data-pr="${pr.id}">📥 Results from QSML</button><button class="btn small" data-act="cr-bullrep" data-pr="${pr.id}">📤 Bull Reporter file</button>` : ''}</div>
    <input type="file" accept=".xlsx" data-crqsml="${pr.id}" hidden></div>`;
}
window.crBullsHtml = crBullsHtml;
function crBullOpen(r, pr, bid) {
  const ex = bid && (pr.bulls || []).find((b) => b.id === bid); const prev = (pr.bulls || []).slice(-1)[0] || {};
  const b = ex ? bkClone(ex) : { id: uid('bl'), n: (pr.bulls || []).length + 1, breed: prev.breed || '', method: 'electroejaculation', serving: 'not assessed', capacity: 'not assessed', risk: CR_RISKS[0] };
  const inp = (k, l, t) => `<div class="f"><label for="cb-${k}">${l}</label><input id="cb-${k}" data-cb="${k}" value="${h(b[k] ?? '')}" ${t === 'n' ? 'type="number" step="any" inputmode="decimal"' : ''}></div>`;
  const find = ([k, l]) => { const v = b[k] || CR_WNL; const ab = v !== CR_WNL; return `<div class="f"><label>${l}</label><div class="bk-hrow"><label class="bk-radio"><input type="radio" name="cbf-${k}" value="wnl" ${ab ? '' : 'checked'}> Within normal limits</label><label class="bk-radio"><input type="radio" name="cbf-${k}" value="ab" ${ab ? 'checked' : ''}> Abnormal</label></div><input data-cbab="${k}" value="${h(ab ? v.replace(/^abnormal\s*[—-]?\s*/i, '') : '')}" ${ab ? '' : 'hidden'} aria-label="${l} — describe"></div>`; };
  openSheet(ex ? crBullName(b) : 'Bull ' + b.n, `<div class="grid2">${inp('vtag', 'Visual / management tag')}${inp('nlis', 'NLIS')}</div><div class="grid2">${inp('brand', 'Brand')}${inp('stud', 'Stud identification (from the client)')}</div>
    <div class="grid2">${inp('breed', 'Breed')}${inp('colour', 'Colour')}</div><div class="grid2">${inp('age', 'Age (years)', 'n')}${inp('vial', 'QSML vial number')}</div>
    <div class="grid2">${inp('bcs', 'Body condition score (/5)', 'n')}${inp('sc', 'Scrotal circumference (cm)', 'n')}</div>
    ${CR_BULL_FIND.map(find).join('')}
    <div class="grid2">${inp('conc', 'Concentration (/5)', 'n')}${inp('motility', 'Motility (% forward progressive)', 'n')}</div>
    <div class="grid2">${inp('morph', 'Morphology (% normal — from QSML)', 'n')}${inp('method', 'Collection method')}</div>
    <div class="grid2">${inp('serving', 'Serving ability')}${inp('capacity', 'Serving capacity')}</div>
    <div class="f"><label for="cb-risk">Overall evaluation</label><select id="cb-risk" data-cb="risk">${CR_RISKS.map((x) => `<option ${x === b.risk ? 'selected' : ''}>${h(x)}</option>`).join('')}</select></div>
    <div class="f"><label for="cb-comments">Comments</label><textarea id="cb-comments" data-cb="comments" rows="2">${h(b.comments || '')}</textarea></div>
    ${b.qsml ? `<div class="hint">From QSML: PD ${b.qsml.pd ?? '–'}% · MP ${b.qsml.mp ?? '–'}% · T&H ${b.qsml.th ?? '–'}% · Py ${b.qsml.py ?? '–'}% · KA ${b.qsml.ka ?? '–'}% · V&T ${b.qsml.vt ?? '–'}% · SA ${b.qsml.sa ?? '–'}%${b.qsml.assess ? ' · ' + h(b.qsml.assess) : ''}</div>` : ''}`, () => {
    document.querySelectorAll('[data-cb]').forEach((el) => { const v = el.value.trim(); b[el.dataset.cb] = el.type === 'number' ? (v === '' ? '' : +v) : v; });
    CR_BULL_FIND.forEach(([k]) => { const ab = (document.querySelector(`input[name=cbf-${k}]:checked`) || {}).value === 'ab'; const t = (document.querySelector(`[data-cbab=${k}]`) || {}).value || ''; b[k] = ab ? 'abnormal' + (t.trim() ? ' — ' + t.trim() : '') : CR_WNL; });
    pr.bulls = (pr.bulls || []).filter((x) => x.id !== b.id); const i = ex ? (r.procs.find((p) => p.id === pr.id).bulls || []).length : 0; pr.bulls.push(b); pr.bulls.sort((x, y) => (x.n || 0) - (y.n || 0)); pr.head = pr.bulls.length;
    touch(r); crInvSync(r); save(); Sync.soon(); setTimeout(renderAll, 0); return true;
  }, ex ? `<button class="btn" data-act="cr-bulldel" data-pr="${pr.id}" data-id="${b.id}" style="color:var(--red)">Remove</button>` : '');
  document.getElementById('sheet').addEventListener('change', (e) => { const m = (e.target.name || '').match(/^cbf-(\w+)$/); if (m) { const el = document.querySelector(`[data-cbab=${m[1]}]`); el.hidden = e.target.value !== 'ab'; if (!el.hidden) el.focus(); } });
}
/* the QSML recording sheet: their own spreadsheet, filled in (up to 200 bulls over 4 pages) */
const CR_QSML_ROWS = [[16, 65], [15, 64], [15, 64], [15, 64]];
const crXmlEsc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
function crXSet(xml, ref, val) { if (val == null || val === '') return xml; const num = typeof val === 'number' && isFinite(val);
  const cell = (s) => `<c r="${ref}"${s}${num ? '' : ' t="inlineStr"'}>${num ? `<v>${val}</v>` : `<is><t xml:space="preserve">${crXmlEsc(val)}</t></is>`}</c>`;
  const re1 = new RegExp(`<c r="${ref}"((?: s="\\d+")?)(?: t="\\w+")?\\s*/>`); if (re1.test(xml)) return xml.replace(re1, (m, s) => cell(s));
  const re2 = new RegExp(`<c r="${ref}"((?: s="\\d+")?)(?: t="\\w+")?>[\\s\\S]*?</c>`); if (re2.test(xml)) return xml.replace(re2, (m, s) => cell(s));
  const row = ref.match(/\d+$/)[0]; const rre = new RegExp(`(<row r="${row}"[^>]*>)([\\s\\S]*?)(</row>)`); if (rre.test(xml)) return xml.replace(rre, (m, a, b, c) => a + b + cell('') + c); return xml; }
async function crQsmlFile(r, pr) {
  if (!window.JSZip) { toast('The spreadsheet tool is still loading — try again'); return null; }
  const buf = await (await fetch('templates/qsml-bbse.xlsx')).arrayBuffer(); const zip = await JSZip.loadAsync(buf);
  const b = IDX.biz.get(r.bid); const f = (r.stops || []).map((s) => IDX.farms.get(s.fid)).find(Boolean); const vet = crVetInfo((r.staff || []).find(crIsVet) || crMe());
  const L = pr.bulls || []; if (L.length > 200) toast('Only the first 200 bulls fit on the QSML sheet');
  for (let p = 0; p < 4; p++) { const path = `xl/worksheets/sheet${p + 1}.xml`; let x = await zip.file(path).async('string');
    if (p === 0) { x = crXSet(x, 'F6', vet.name); x = crXSet(x, 'F7', crDMY(r.date)); x = crXSet(x, 'R9', b ? b.tradingName || b.name : ''); x = crXSet(x, 'R10', f ? [f.name, f.address].filter(Boolean).join(', ') : ''); }
    const [r0, r1] = CR_QSML_ROWS[p]; L.slice(p * 50, p * 50 + 50).forEach((bl, i) => { const row = r0 + i; if (row > r1) return; const tick = (k) => ((bl[k] || CR_WNL) === CR_WNL ? '✓' : 'C');
      [['A', bl.breed], ['B', bl.vtag || bl.brand || bl.nlis || 'Bull ' + (bl.n || i + 1)], ['C', bl.vial], ['D', bl.age === '' ? '' : bl.age], ['F', bl.bcs === '' ? '' : bl.bcs], ['G', bl.sc === '' ? '' : bl.sc], ['H', bl.conc === '' ? '' : bl.conc], ['I', bl.motility === '' ? '' : bl.motility],
        ['AM', tick('head')], ['AN', tick('legs')], ['AO', tick('legs')], ['AP', tick('body')], ['AQ', tick('external')], ['AR', tick('internal')], ['AS', tick('internal')], ['AW', [bl.comments, ...CR_BULL_FIND.filter(([k]) => (bl[k] || CR_WNL) !== CR_WNL).map(([k, l]) => l + ': ' + bl[k])].filter(Boolean).join('; ')], ['AY', bl.nlis]]
        .forEach(([col, v]) => { x = crXSet(x, col + row, typeof v === 'number' ? v : v == null ? '' : String(v)); }); });
    zip.file(path, x); }
  const wb = await zip.file('xl/workbook.xml').async('string'); zip.file('xl/workbook.xml', wb.replace(/<calcPr([^>]*?)\/>/, (m, a) => (/fullCalcOnLoad/.test(a) ? m : `<calcPr${a} fullCalcOnLoad="1"/>`)));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function crSaveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
async function crQsmlRead(file) { // QSML's results, back on the same sheet → { bullId: {...} }
  const zip = await JSZip.loadAsync(await file.arrayBuffer()); const ss = []; const sx = zip.file('xl/sharedStrings.xml'); if (sx) { const d = new DOMParser().parseFromString(await sx.async('string'), 'application/xml'); d.querySelectorAll('si').forEach((si) => ss.push([...si.querySelectorAll('t')].map((t) => t.textContent).join(''))); }
  const out = {};
  for (let p = 0; p < 4; p++) { const fz = zip.file(`xl/worksheets/sheet${p + 1}.xml`); if (!fz) continue; const d = new DOMParser().parseFromString(await fz.async('string'), 'application/xml'); const [r0, r1] = CR_QSML_ROWS[p];
    const val = (c) => { if (!c) return ''; const t = c.getAttribute('t'); if (t === 'inlineStr') return (c.querySelector('is') || {}).textContent || ''; const v = (c.querySelector('v') || {}).textContent; if (v == null) return ''; return t === 's' ? ss[+v] || '' : v; };
    d.querySelectorAll('row').forEach((row) => { const rn = +row.getAttribute('r'); if (rn < r0 || rn > r1) return; const cells = {}; row.querySelectorAll('c').forEach((c) => (cells[(c.getAttribute('r') || '').replace(/\d+$/, '')] = val(c))); const id = String(cells.B || '').trim(); if (!id) return;
      const n = (k) => (cells[k] === '' || cells[k] == null || isNaN(+cells[k]) ? null : Math.round(+cells[k] * 10) / 10);
      out[id.toLowerCase()] = { norm: n('J'), pd: n('K'), mp: n('L'), th: n('M'), py: n('N'), ka: n('O'), vt: n('P'), sa: n('Q'), assess: String(cells.AX || '').trim(), comments: String(cells.AW || '').trim(), vial: String(cells.C || '').trim() }; }); }
  return out;
}
function crBullReporterCsv(r, pr) { // one row per bull, the standard BULLCHECK fields (the columns will be matched to Bull Reporter's import once we have a sample)
  const b = IDX.biz.get(r.bid); const f = (r.stops || []).map((s) => IDX.farms.get(s.fid)).find(Boolean); const vet = crVetInfo((r.staff || []).find(crIsVet) || crMe());
  const cols = ['Date of examination', 'Veterinarian', 'Practice', 'Owner', 'PIC', 'Property', 'Bull ID (tag)', 'Brand', 'NLIS', 'Stud ID', 'Breed', 'Colour', 'Age (years)', 'Body condition score', 'Scrotal circumference (cm)', 'Internal reproductive tract', 'External reproductive tract', 'Legs, joints, hooves and gait', 'Head', 'Neck to hindquarters', 'Collection method', 'Concentration (/5)', 'Motility (%)', 'Morphology (% normal)', 'Proximal droplets (%)', 'Midpiece (%)', 'Tails and heads (%)', 'Pyriform (%)', 'Knobbed acrosomes (%)', 'Vacuoles and teratoids (%)', 'Swollen acrosomes (%)', 'Serving ability', 'Serving capacity', 'Overall evaluation', 'Comments'];
  const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = (pr.bulls || []).map((x) => { const qs = x.qsml || {}; return [crDMY(r.date), vet.name, (crBrand().lines || [])[0] || 'Bovitech Veterinary Services', b ? b.tradingName || b.name : '', b ? (b.pics || []).map((p) => p.value).join(' ') : '', f ? [f.name, f.address].filter(Boolean).join(', ') : '', x.vtag, x.brand, x.nlis, x.stud, x.breed, x.colour, x.age, x.bcs, x.sc, x.internal || CR_WNL, x.external || CR_WNL, x.legs || CR_WNL, x.head || CR_WNL, x.body || CR_WNL, x.method, x.conc, x.motility, x.morph, qs.pd, qs.mp, qs.th, qs.py, qs.ka, qs.vt, qs.sa, x.serving, x.capacity, x.risk, x.comments]; });
  return '﻿' + [cols, ...rows].map((r0) => r0.map(q).join(',')).join('\r\n');
}

/* ---------------- Settings → Templates: the certificate and report templates ---------------- */
function crDocTplCard() {
  return `<div class="card"><h3><span class="sp">Certificate and report templates</span><button class="btn small" data-act="cr-dtnew">➕ New</button></h3><div class="hint" style="margin-bottom:6px">Tap one to change its wording. The header (practice or vet details) and footer (Regards, signature, name, date) are added for whoever signs it.</div>
    ${crDocTpls().map((t) => `<div class="kv bk-tap" data-act="cr-dtedit" data-id="${t.id}"><div class="v"><b>📄 ${h(t.name)}</b>${t.orig && t.body !== t.orig ? ' <span class="hint">· changed</span>' : ''}<br><span class="hint">${t.head === 'vet' ? "Vet's header" : t.head === 'practice' ? 'Practice header' : 'No header'} · ${t.foot === 'sig' ? 'signature footer' : 'no footer'} · ${crDocFields(t.body).length} box${crDocFields(t.body).length === 1 ? '' : 'es'} to fill in${t.perBull ? ' · one per bull' : ''}</span></div></div>`).join('')}</div>`;
}
window.crDocTplCard = crDocTplCard;
function crDocTplOpen(t) {
  const isNew = !t; const x = t ? bkClone(t) : { id: 'doc:' + Date.now().toString(36), cfg: 'doc', order: 60, name: '', head: 'vet', foot: 'sig', body: '<p>[[Text::]]</p>' };
  openSheet(isNew ? 'New template' : x.name, `<div class="grid2"><div class="f"><label for="dt-name">Name</label><input id="dt-name" value="${h(x.name)}"></div><div class="f"><label for="dt-prod">Charge (price list)</label><select id="dt-prod"><option value="">No charge</option>${crProds('cert').map((p) => `<option value="${p.id}" ${p.id === x.prod ? 'selected' : ''}>${h(p.name)}</option>`).join('')}</select></div></div>
    <div class="grid2"><div class="f"><label for="dt-head">Header</label><select id="dt-head"><option value="vet" ${x.head === 'vet' ? 'selected' : ''}>The signing vet's details and logo</option><option value="practice" ${x.head === 'practice' ? 'selected' : ''}>The practice letterhead</option><option value="none" ${x.head === 'none' ? 'selected' : ''}>None</option></select></div><div class="f"><label for="dt-foot">Footer</label><select id="dt-foot"><option value="sig" ${x.foot === 'sig' ? 'selected' : ''}>Regards, signature, name and date</option><option value="none" ${x.foot === 'none' ? 'selected' : ''}>None</option></select></div></div>
    <div class="f"><label>Wording</label>${crEditorBar('dt-body', true)}<div id="dt-body" class="cr-rich" contenteditable="true">${x.body}</div>
    <div class="hint">[[Label]] is a box to fill in, [[Label: one / two]] a choice, [[Label::]] a big box, and {{…}} is filled in automatically from the record.</div></div>`, () => {
    const g = (id) => document.getElementById(id).value; x.name = g('dt-name').trim(); if (!x.name) { toast('Give it a name'); return false; } x.head = g('dt-head'); x.foot = g('dt-foot'); x.prod = g('dt-prod') || null; x.body = crClean(document.getElementById('dt-body').innerHTML);
    const ex = crDocTpl(x.id); if (ex) { Object.assign(ex, x); touch(ex); } else { touch(x); D.crcfg.push(x); } save(); Sync.soon(); setTimeout(renderAll, 0); return true;
  }, `${!isNew && x.orig && x.body !== x.orig ? `<button class="btn" data-act="cr-dtreset" data-id="${x.id}">Back to the original</button>` : ''}${!isNew ? `<button class="btn" data-act="cr-dtdup" data-id="${x.id}">Copy</button>` : ''}${!isNew && !x.orig ? `<button class="btn" data-act="cr-dtdel" data-id="${x.id}" style="color:var(--red)">Delete</button>` : ''}`);
}

/* ---------------- taps ---------------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^cr-(doc|dt|bull|qsml|prev)/.test(a)) return; const d = el.dataset;
  const r = CR.page === 'edit' ? crGet('crrec', CR.id) : null; const pr = r && d.pr ? (r.procs || []).find((p) => p.id === d.pr) : null;
  switch (a) {
    case 'cr-docprint': { const doc = r && (r.docs || []).find((x) => x.id === d.id); const t = doc && crDocTpl(doc.tpl); if (t) { if (!doc.code) { crDocStamp(t, doc, null); touch(r); save(); Sync.soon(); } crPrint(crDocFull(t, doc, r)); } break; } /* made before codes existed: it gets one now */
    case 'cr-docfill': { const doc = r && (r.docs || []).find((x) => x.id === d.id); if (doc) crDocOpen(r, doc.tpl, doc.id); break; }
    case 'cr-docwords': if (r) crDocEditText(r, d.id); break;
    case 'cr-docdel': { if (!r || !(await ask('Remove this document from the record?', 'Remove'))) return; r.docs = (r.docs || []).filter((x) => x.id !== d.id); touch(r); save(); Sync.soon(); renderAll(); break; }
    case 'cr-bulladd': if (r && pr) crBullOpen(r, pr, null); break;
    case 'cr-bulled': if (r && pr) crBullOpen(r, pr, d.id); break;
    case 'cr-bulldel': { if (!r || !pr || !(await ask('Remove this bull?', 'Remove', true))) return; pr.bulls = (pr.bulls || []).filter((x) => x.id !== d.id); pr.head = pr.bulls.length; touch(r); crInvSync(r); save(); closeSheet(); renderAll(); break; }
    case 'cr-qsml': { if (!r || !pr) return; try { const blob = await crQsmlFile(r, pr); if (blob) { crSaveBlob(blob, `QSML BBSE ${crBizName(r.bid).replace(/[\\/:*?"<>|]/g, '')} ${r.date}.xlsx`); toast('QSML sheet saved — email it to QSML with the samples'); } } catch (x) { console.warn(x); toast("Couldn't make the QSML sheet"); } break; }
    case 'cr-qsmlin': { const f = document.querySelector(`[data-crqsml="${d.pr}"]`); if (f) f.click(); break; }
    case 'cr-bullrep': { if (!r || !pr) return; crSaveBlob(new Blob([crBullReporterCsv(r, pr)], { type: 'text/csv' }), `Bull Reporter ${crBizName(r.bid).replace(/[\\/:*?"<>|]/g, '')} ${r.date}.csv`); toast('Bull Reporter file saved'); break; }
    case 'cr-dtnew': crDocTplOpen(null); break;
    case 'cr-dtedit': crDocTplOpen(crDocTpl(d.id)); break;
    case 'cr-dtreset': { const t = crDocTpl(d.id); if (!t || !(await ask(`Put "${t.name}" back to the original wording?`, 'Yes — original'))) return; t.body = t.orig; touch(t); save(); Sync.soon(); closeSheet(); renderAll(); break; }
    case 'cr-dtdup': { const t = crDocTpl(d.id); if (!t) return; const c = { ...bkClone(t), id: 'doc:' + Date.now().toString(36), name: t.name + ' (copy)', order: (t.order || 50) + 0.5 }; delete c.orig; touch(c); D.crcfg.push(c); save(); Sync.soon(); closeSheet(); renderAll(); crDocTplOpen(c); break; }
    case 'cr-dtdel': { const t = crDocTpl(d.id); if (!t || !(await ask(`Delete "${t.name}"? Documents already made from it keep their wording.`, 'Delete', true))) return; t.gone = true; touch(t); save(); Sync.soon(); closeSheet(); renderAll(); break; }
  }
});
document.addEventListener('change', async (e) => {
  const t = e.target; if (!t || !t.dataset) return;
  if (t.id === 'cr-adddoc' && t.value) { const r = crGet('crrec', CR.id); const v = t.value; t.value = ''; if (r) crDocOpen(r, v, null); return; }
  if (t.dataset.crqsml) { const r = crGet('crrec', CR.id); const pr = r && (r.procs || []).find((p) => p.id === t.dataset.crqsml); const f = t.files && t.files[0]; t.value = ''; if (!pr || !f) return;
    try { const res = await crQsmlRead(f); let n = 0; (pr.bulls || []).forEach((b) => { const k = [b.vtag, b.brand, b.nlis, 'bull ' + b.n].filter(Boolean).map((x) => String(x).toLowerCase()).find((x) => res[x]); if (!k) return; const q = res[k]; b.qsml = q; if (q.norm != null) b.morph = q.norm; if (q.vial && !b.vial) b.vial = q.vial; n++; });
      touch(r); save(); Sync.soon(); renderAll(); toast(n ? `Morphology results added for ${n} bull${n === 1 ? '' : 's'}` : "No bulls matched — check the bull IDs on QSML's sheet"); } catch (x) { console.warn(x); toast("Couldn't read that file — is it QSML's sheet (.xlsx)?"); } }
});
