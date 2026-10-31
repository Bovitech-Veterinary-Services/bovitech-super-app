/* Bovitech Super App — Clinical records and invoicing (part 1: data, price list, the invoice builder).
   One record per appointment: the herd / flock, mobs and individual animals, procedures from templates
   (typed, spoken, or quick entry in the crush), medications and other items, lab tests, follow-ups —
   and the invoice built from it (appointment fee, procedures by the hour or per head, after hours,
   additional labour, travel with the practice's discounts, medications as single doses or whole packs). */
'use strict';
const CR_KINDS = ['crrec', 'crinv', 'crprod', 'crcfg'];
CR_KINDS.forEach((k) => { if (!BOOK_KINDS.includes(k)) BOOK_KINDS.push(k); }); // synced with everything else
const CR = { page: 'recs', q: '', invQ: '', invTab: 'all', prodQ: '' };
const CR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v3h6V3M9 11h6M9 15h6"/></svg>';
const crList = (k) => (D && D[k]) || (D[k] = []);
const crGet = (k, id) => crList(k).find((x) => x.id === id && !x.gone);
const crCfg = (id) => crList('crcfg').find((x) => x.id === id && !x.gone);
const crOn = () => !!(typeof PREF !== 'undefined' && PREF.showRec);
const crMoney = (n) => '$' + (Math.round((+n || 0) * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const crR2 = (n) => Math.round((+n || 0) * 100) / 100; const crR4 = (n) => Math.round((+n || 0) * 10000) / 10000;
const crTime = (t) => (t ? bkTime(t) : '');
const crMins = (t) => (t ? bkMin(t) : null);
const crIsVet = (sid) => { const p = Bk.person(sid) || (SBAuth.list || []).find((x) => x.id === sid); return !!p && p.role === 'vet'; };
const crMe = () => (SBAuth.staff && SBAuth.staff.id) || null;
const crAdmin = () => !!(window.SBAuth && SBAuth.isAdmin());

/* ---------------- the price list: services, medications, consumables, merchandise, certificates, lab tests ---------------- */
const CR_PCATS = [['service', 'Services and fees'], ['med', 'Medications (S4 and OTC)'], ['consumable', 'Consumables'], ['merch', 'Merchandise'], ['cert', 'Certificates'], ['lab', 'Lab tests']];
const CR_ROLES = { appt: 'Appointment fee', proc: 'Procedure', ahEarly: 'After hours — early (6–7pm, 7–8am; weekends and public holidays 7am–7pm)', ahLate: 'After hours — late (7pm–7am)', labour: 'Additional labour (per person, per hour)', travel: 'Travel (per km)', fuel: 'Fuel surcharge (per km)', subsidy: 'Subsidised travel — TSE / SDI (per km)' };
const CR_PROD_DEFAULTS = [
  { id: 'p-appt-farm', cat: 'service', role: 'appt', name: 'On-farm appointment', unit: 'each', price: 0, types: ['type-farm'] },
  { id: 'p-appt-phone', cat: 'service', role: 'appt', name: 'Phone appointment', unit: 'each', price: 0, types: ['type-phone'] },
  { id: 'p-appt-house', cat: 'service', role: 'appt', name: 'In-house appointment', unit: 'each', price: 0, types: ['type-house', 'type-fec'] },
  { id: 'p-pd-head', cat: 'service', role: 'proc', name: 'Pregnancy testing (per head)', unit: 'head', price: 0, by: 'head' },
  { id: 'p-pd-hour', cat: 'service', role: 'proc', name: 'Pregnancy testing (per hour — under 50 head an hour)', unit: 'hour', price: 0, by: 'hour' },
  { id: 'p-bbse', cat: 'service', role: 'proc', name: 'Bull breeding soundness exam (per head)', unit: 'head', price: 0, by: 'head' },
  { id: 'p-vet-hour', cat: 'service', role: 'proc', name: 'Veterinary services (per hour)', unit: 'hour', price: 0, by: 'hour' },
  { id: 'p-ah-early', cat: 'service', role: 'ahEarly', name: 'After hours fee — early', unit: 'each', price: 0 },
  { id: 'p-ah-late', cat: 'service', role: 'ahLate', name: 'After hours fee — late', unit: 'each', price: 0 },
  { id: 'p-labour', cat: 'service', role: 'labour', name: 'Additional labour', unit: 'hour', price: 0 },
  { id: 'p-travel', cat: 'service', role: 'travel', name: 'Travel', unit: 'km', price: 1.32 },
  { id: 'p-fuel', cat: 'service', role: 'fuel', name: 'Temporary fuel surcharge', unit: 'km', price: 0.1785 },
  { id: 'p-subsidy', cat: 'service', role: 'subsidy', name: 'Subsidised travel (TSE / SDI)', unit: 'km', price: 0.85, cap: 200 },
  { id: 'p-cert-sale', cat: 'cert', name: 'Sale certificate', unit: 'each', price: 0 },
  { id: 'p-cert-pd', cat: 'cert', name: 'PD certificate', unit: 'each', price: 0 },
  { id: 'p-cert-ftl', cat: 'cert', name: 'Fit to load certificate', unit: 'each', price: 0 },
  { id: 'p-cert-bbse', cat: 'cert', name: 'BBSE certificate', unit: 'each', price: 0 },
  { id: 'p-cert-ins', cat: 'cert', name: 'Insurance certificate', unit: 'each', price: 0 },
];
const crProds = (cat) => crList('crprod').filter((p) => !p.gone && p.active !== false && (!cat || p.cat === cat)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
const crRole = (role) => crList('crprod').find((p) => !p.gone && p.role === role && p.active !== false);
const crProd = (id) => crGet('crprod', id);
function crProdLabel(p, qty, as) { // "5 mL (single dose)" or "1 bottle (500 mL)" — never confused
  if (!p) return ''; const u = p.unit || 'each';
  if (p.cat === 'med' || p.cat === 'consumable') return as === 'pack' ? `${qty} ${p.packName || 'bottle'}${qty == 1 ? '' : 's'} (${p.pack || '?'} ${u})` : `${qty} ${u} (single dose)`;
  return `${qty} ${u === 'each' ? '' : u}`.trim();
}
function crSeed() { // the starting price list (prices to fill in from the ezyVet export), templates and settings — once per database
  if (!D || !D.sync || !D.sync.last) return; let n = 0;
  if (!crList('crprod').length) CR_PROD_DEFAULTS.forEach((d) => { const r = { ...bkClone(d), placeholder: d.price === 0 }; touch(r); D.crprod.push(r); n++; });
  CR_CFG_DEFAULTS.forEach((d) => { if (!crList('crcfg').some((x) => x.id === d.id)) { const r = bkClone(d); touch(r); D.crcfg.push(r); n++; } });
  const fu = Bk.cfg('futype').map((x) => x.name.toLowerCase()); // the follow-up types Jess asked for
  [['fu-phone', 'Phone call', 2], ['fu-review', 'Treatment review', 7], ['fu-revisit', 'Revisit', 28]].forEach(([id, name, days], i) => { if (!fu.includes(name.toLowerCase()) && !Bk.get(id)) { const r = { id, cfg: 'futype', order: 10 + i, name, days }; touch(r); Bk.list('bkcfg').push(r); n++; } });
  if (n) save();
}

/* ---------------- settings records: fees, patient fields, follow-up types, voice words, templates ---------------- */
const CR_PFIELDS = { animal: [['vtag', 'Visual tag(s)'], ['nlis', 'NLIS tag'], ['brand', 'Brand'], ['age', 'Age'], ['breed', 'Breed'], ['colour', 'Colour'], ['class', 'Class'], ['weight', 'Weight (kg)']], mob: [['name', 'Mob name'], ['size', 'Number of head'], ['class', 'Class']] };
const CR_CFG_DEFAULTS = [
  { id: 'fees', cfg: 'fees', name: 'Fees and travel', nearKm: 10, nearPct: 25, sharedPct: 50, payDays: 7, pdMinHph: 50, gst: 10 },
  { id: 'pfields', cfg: 'pfields', name: 'Patient details', animal: CR_PFIELDS.animal.map(([k, l]) => ({ k, l, inv: k === 'vtag' || k === 'nlis' })), mob: CR_PFIELDS.mob.map(([k, l]) => ({ k, l, inv: k === 'name' })) },
  { id: 'futypes', cfg: 'futypes', name: 'Follow-up types', list: ['Recheck', 'Phone call', 'Lab results due', 'Treatment review', 'Revisit'] },
  { id: 'vocab', cfg: 'vocab', name: 'Voice words', list: [{ heard: 'and dp', to: 'NDP' }, { heard: 'n d p', to: 'NDP' }, { heard: 'bang tale', to: 'bang tail' }, { heard: 'b b s e', to: 'BBSE' }, { heard: 'in calf', to: 'pregnant' }] },
  { id: 'brand', cfg: 'brand', name: 'Letterhead', lines: ['Bovitech Veterinary Services', 'Phone: 0499 489 919', 'office@bovitech.com.au', 'PO Box 7011, Lower King, WA, 6330'], logo: null, use: { records: true, certs: true, invoices: true } },
  { id: 'labs', cfg: 'labs', name: 'Laboratories', list: ['DPIRD Diagnostics and Laboratory Services (DDLS)', 'Regional Laboratory Services', 'QSML', 'Swans BVS lab'] },
];
const crFees = () => ({ ...CR_CFG_DEFAULTS[0], ...(crCfg('fees') || {}) });
const crPfields = () => crCfg('pfields') || CR_CFG_DEFAULTS[1];
const crFuTypes = () => (crCfg('futypes') || CR_CFG_DEFAULTS[2]).list;
const crVocab = () => (crCfg('vocab') || CR_CFG_DEFAULTS[3]).list || [];
const crBrand = () => ({ ...CR_CFG_DEFAULTS[4], ...(crCfg('brand') || {}) });
const crLabs = () => (crCfg('labs') || CR_CFG_DEFAULTS[5]).list;

/* ---------------- procedure templates (the pregnancy testing one first) ---------------- */
const CR_TPL_PD = { id: 'tpl:pd', cfg: 'tpl', name: 'Pregnancy testing', who: 'vet', quick: 'pd', species: ['cattle'], charge: { head: 'p-pd-head', hour: 'p-pd-hour', rule: 'pd' }, cert: 'p-cert-pd',
  sections: [{ title: 'Procedure performed', inputs: [
    { k: 'method', l: 'Method', opts: ['transrectal ultrasound using a curved linear probe on a curved, rigid rectal introducer (any animal that could not be diagnosed by ultrasound was manually palpated and reassessed with the ultrasound if required), prior to placement into the rectum of each animal, the distal end of the introducer or gloved hand was coated in liberal obstetrical lubrication in order to reduce incidences of rectal tears', 'manual rectal palpation, prior to placement into the rectum of each animal a gloved hand was coated in liberal obstetrical lubrication in order to reduce incidences of rectal tears'], other: true },
    { k: 'restraint', l: 'Restraint', opts: ['procedure performed with each animal restrained individually in a crush', 'procedure performed on the rotary platform in the dairy', 'procedure performed over the rail with animals lined up in a race (manual palpation possible, if required)', 'procedure performed over the rail with animals lined up in a race (manual palpation not possible due to lack of facilities)', 'for lactating animals the procedure was performed on the rotary platform in the dairy, for dry animals the procedure was performed with each animal restrained individually in a crush'] },
    { k: 'diagnosis', l: 'Diagnosis', opts: ['pregnant or not detectably pregnant only, no foetal aging', 'foetal aging via measurement of head width and or body measurements (pregnancies varied from 40-90 days, ages given in 5-day increments)', 'foetal aging via measurement of head width and or body measurements (pregnancies varied from undetectably pregnant through to heavily pregnant, ages given in 5-day increments up to 100 days of gestation, then “heavy” if >100 days and unable to age, non-detectably pregnant animals recorded as “rechecks”)', 'foetal aging via measurement of head width and or body measurements — split described below'], other: true },
    { k: 'split', l: 'Describe split', show: { k: 'diagnosis', i: 3 }, opts: ['(AI = X, bull = X)', '(AI = X, early bull = X, late bull = X)', '(early = >X days, late = X< days)'], other: true },
    { k: 'bangtail', l: 'Bang tail NDPs', opts: ['yes', 'yes and spray marked', 'yes, although some animals have previously been bang tailed', 'no', 'not required (no NDPs)', 'not required (already bang tailed)'], other: true },
    { k: 'drafted', l: 'Drafted NDPs separately', opts: ['yes', 'no', 'not required (no NDPs)'], other: true },
    { k: 'bull', l: 'Bull', opts: ['out >6 weeks', 'still in (advised pregnancies <6 weeks may not be detectable)', 'out <6 weeks (advised pregnancies <6 weeks may not be detectable)'], other: true },
    { k: 'vtags', l: 'Visual tags recorded', opts: ['no', 'yes, on all animals (recorded by Bovitech)', 'yes, on NDPs only (recorded by Bovitech)', 'yes, on all animals (recorded by client)', 'yes, on NDPs only (recorded by client)'], other: true },
    { k: 'nlis', l: 'NLIS tags recorded', opts: ['no', 'yes, on all animals (recorded by Bovitech)', 'yes, on all animals (recorded by client)', 'yes, on NDPs only (recorded by Bovitech)', 'yes, on NDPs only (recorded by client)'], other: true },
  ] }] };
CR_CFG_DEFAULTS.push(CR_TPL_PD,
  { id: 'tpl:bbse', cfg: 'tpl', name: 'Bull breeding soundness exam (BBSE)', who: 'vet', species: ['cattle'], charge: { head: 'p-bbse' }, cert: 'p-cert-bbse', sections: [{ title: 'Examination', inputs: [{ k: 'notes', l: 'Findings', text: true }] }], draft: true },
  { id: 'tpl:consult', cfg: 'tpl', name: 'Consult / treatment', who: 'vet', charge: { hour: 'p-vet-hour' }, sections: [{ title: 'Consult', inputs: [{ k: 'history', l: 'History', text: true }, { k: 'exam', l: 'Examination', text: true }, { k: 'dx', l: 'Diagnosis', text: true }, { k: 'plan', l: 'Treatment and plan', text: true }] }] },
  { id: 'tpl:ai', cfg: 'tpl', name: 'Artificial insemination', who: 'tech', charge: { hour: 'p-vet-hour' }, sections: [{ title: 'AI', inputs: [{ k: 'notes', l: 'Notes', text: true }] }], draft: true });
const crTpls = () => crList('crcfg').filter((x) => x.cfg === 'tpl' && !x.gone).sort((a, b) => (a.order || 50) - (b.order || 50) || a.name.localeCompare(b.name));
const crTpl = (id) => crCfg(id) || crTpls().find((x) => x.id === id) || null;

/* ---------------- a record ---------------- */
function crNewRec(o) { // o: { bk (appointment), bid, cid, date }
  const b = o.bk || null; const r = { id: uid('cr'), bkId: b ? b.id : null, bid: b ? b.bid : o.bid || null, cid: b ? b.cid : o.cid || null, date: b ? b.date : o.date || bkToday(), type: b ? b.type : (Bk.cfg('type')[0] || {}).id,
    staff: b ? [...(b.staff || [])] : [crMe()].filter(Boolean), start: b ? b.start : '', end: b && b.start ? bkHHMM(bkMin(b.start) + (b.mins || 60)) : '', breaks: b && b.lunch ? [{ mins: Bk.lunchCfg().mins, lunch: true }] : [],
    stops: b ? bkClone(Bk.stops(b)) : [], routeOk: false, labour: { people: 0, hours: 0 }, ah: null, patients: [], procs: [], items: [], labs: [], certs: [], notes: '', links: [], status: 'draft', at: Date.now(), by: crMe() };
  const pids = (r.bid && IDX.biz.get(r.bid) && IDX.biz.get(r.bid).patientIds) || []; // the herd / flock to start with
  (b && b.pids && b.pids.length ? b.pids : pids.slice(0, 1)).forEach((p) => r.patients.push({ id: uid('pt'), level: 'herd', pid: p.value, plabel: p.label || '', species: /sheep|flock/i.test(p.label || '') ? 'sheep' : 'cattle' }));
  if (!r.patients.length) r.patients.push({ id: uid('pt'), level: 'herd', species: 'cattle' });
  if (b) (b.svcs || []).forEach((x) => { const t = crTplForSvc(x.svc); if (t && !r.procs.some((p) => p.tpl === t.id)) r.procs.push({ id: uid('pr'), tpl: t.id, pat: r.patients[0].id, answers: {}, head: x.head || 0, animals: [] }); });
  return r;
}
function crTplForSvc(svcId) { const sv = svcId && Bk.get(svcId); if (!sv) return null; const n = (sv.name || '').toLowerCase(); return crTpls().find((t) => t.svc === svcId) || (/preg/.test(n) ? crTpl('tpl:pd') : /bull|bbse/.test(n) ? crTpl('tpl:bbse') : /consult|treat/.test(n) ? crTpl('tpl:consult') : /\bai\b|insemin/.test(n) ? crTpl('tpl:ai') : null); }
const crWho = (r) => Bk.who(r);
const crPatName = (r, pid) => { const p = (r.patients || []).find((x) => x.id === pid); if (!p) return ''; if (p.level === 'animal') return '🐄 ' + ([p.vtag, p.nlis, p.brand].filter(Boolean).join(' / ') || 'Animal'); if (p.level === 'mob') return '👥 ' + (p.name || 'Mob') + (p.size ? ` (${p.size} head)` : ''); return p.species === 'sheep' ? '🐑 Sheep flock' + (p.pid ? ' ' + p.pid : '') : '🐄 Cattle herd' + (p.pid ? ' ' + p.pid : ''); };
function crWorkedMins(r) { const s = crMins(r.start), e = crMins(r.end); if (s == null || e == null) return 0; const tot = (e >= s ? e - s : e + 1440 - s); return Math.max(0, tot - (r.breaks || []).reduce((a, x) => a + (+x.mins || 0), 0)); }
function crPdSummary(pr) { // counts from quick entry
  const a = pr.animals || []; const c = { n: a.length, P: 0, NDP: 0, R: 0, H: 0, early: 0, late: 0 }; const cut = +(pr.answers && pr.answers.cut) || 0;
  a.forEach((x) => { c[x.res] = (c[x.res] || 0) + 1; if (x.res === 'P' && cut && x.days) { if (x.days >= cut) c.early++; else c.late++; } });
  if (pr.counts) ['P', 'NDP', 'R', 'H'].forEach((k) => (c[k] += +pr.counts[k] || 0)), (c.n += ['P', 'NDP', 'R', 'H'].reduce((s, k) => s + (+pr.counts[k] || 0), 0));
  return c;
}
function crProcText(r, pr) { // the written record for one procedure, from the template answers
  const t = crTpl(pr.tpl); if (!t) return ''; const L = [];
  (t.sections || []).forEach((sec) => { const ls = []; sec.inputs.forEach((inp, ii) => { if (inp.show && !crShown(pr, inp)) return; const v = (pr.answers || {})[inp.k]; if (v == null || v === '') return; ls.push(`${inp.l}: ${v}`); }); if (ls.length) L.push(`${sec.title}:`, ...ls); });
  if (t.quick === 'pd') { const c = crPdSummary(pr); if (c.n) L.push(`Results: ${c.n} examined — ${c.P + c.H} pregnant${c.H ? ` (${c.H} heavy)` : ''}${c.early || c.late ? ` (early ${c.early}, late ${c.late})` : ''}, ${c.NDP} not detectably pregnant${c.R ? `, ${c.R} recheck` : ''}.`); }
  if (pr.notes) L.push('Notes: ' + pr.notes);
  return L.join('\n');
}
const crShown = (pr, inp) => { if (!inp.show) return true; const t = crTpl(pr.tpl); const src = t && t.sections.flatMap((s) => s.inputs).find((x) => x.k === inp.show.k); return src && (pr.answers || {})[inp.show.k] === src.opts[inp.show.i]; };

/* ---------------- after hours: suggested from the date and times ---------------- */
function crAhSuggest(r) { // null, 'early' or 'late'
  const s = crMins(r.start); if (s == null) return null; const e = crMins(r.end) ?? s; const we = Bk.weekend(r.date); // weekends and public holidays
  const lateAt = (m) => m >= 19 * 60 || m < 7 * 60; const earlyAt = (m) => (m >= 18 * 60 && m < 19 * 60) || (m >= 7 * 60 && m < 8 * 60);
  if (lateAt(s) || lateAt(e > s ? e - 1 : e)) return 'late';
  if (we) return 'early'; return earlyAt(s) || earlyAt(e > s ? e - 1 : e) ? 'early' : null;
}

const crAhEff = (r) => (r.ah == null ? crAhSuggest(r) : r.ah === 'none' ? null : r.ah); // empty = automatic

/* ---------------- travel: the route taken, with the practice's discounts ---------------- */
function crTravel(r) { // → [{ fid, name, km, pct, why }]
  const fz = crFees(); const fids = [...new Set((r.stops || []).map((x) => x.fid).filter(Boolean))]; const out = [];
  if (Bk.type(r.type).where !== 'farm') return out;
  const pt = (fid) => { const f = IDX.farms.get(fid); return f && f.turn && f.turn.lat != null ? { lat: +f.turn.lat, lng: +f.turn.lng } : f && f.lat != null ? { lat: +f.lat, lng: +f.lng } : null; };
  fids.forEach((fid) => { const f = IDX.farms.get(fid); if (!f) return; let pct = 0; const why = [];
    const near = fids.some((o) => o !== fid && pt(o) && pt(fid) && Travel.km(pt(o), pt(fid)) <= fz.nearKm); if (near) { pct = fz.nearPct; why.push(`${fz.nearPct}% off — farms close together`); }
    const shared = crList('crrec').some((o) => !o.gone && o.id !== r.id && o.date === r.date && o.bid && o.bid !== r.bid && (o.stops || []).some((x) => x.fid === fid)); if (shared) { pct = Math.max(pct, fz.sharedPct); why.push(`${fz.sharedPct}% off — another client seen at the same farm`); }
    out.push({ fid, name: f.name || 'Farm', km: f.kmReturn != null ? +f.kmReturn : null, pct, why: why.join('; ') }); });
  return out;
}

/* ---------------- the invoice, built from the record ---------------- */
function crBuildLines(r) { // → [{ prod, desc, qty, price, auto: true }]
  const L = []; const add = (p, qty, desc, price, extra) => { if (!p || !(+qty)) return; L.push({ id: uid('il'), prod: p.id, desc: desc || p.name, qty: crR2(qty), price: price != null ? price : +p.price || 0, auto: true, ...(extra || {}) }); };
  const fz = crFees(); const hrs = crWorkedMins(r) / 60; const tr = crTravel(r); const sharedFarm = tr.some((x) => /same farm/.test(x.why));
  // appointment fee
  const ap = crList('crprod').find((p) => !p.gone && p.role === 'appt' && (p.types || []).includes(r.type)) || crRole('appt');
  if (ap) add(ap, 1, ap.name + (sharedFarm ? ` (${fz.sharedPct}% shared)` : ''), crR2((+ap.price || 0) * (sharedFarm ? 1 - fz.sharedPct / 100 : 1)));
  // procedures
  (r.procs || []).forEach((pr) => { const t = crTpl(pr.tpl); if (!t || !t.charge) return; const c = t.charge;
    if (c.rule === 'pd') { const n = crPdSummary(pr).n || +pr.head || 0; const hph = hrs ? n / hrs : Infinity; if (n && hph >= fz.pdMinHph && c.head) add(crProd(c.head), n, `${t.name} — ${n} head`); else if (c.hour) add(crProd(c.hour), crR2(hrs), `${t.name} — ${crR2(hrs)} hours${n ? ` (${n} head, under ${fz.pdMinHph} an hour)` : ''}`); }
    else if (c.head) add(crProd(c.head), +pr.head || (pr.animals || []).length || 1, `${t.name}`);
    else if (c.hour) add(crProd(c.hour), crR2(hrs), `${t.name} — ${crR2(hrs)} hours`); });
  // after hours, additional labour
  const ah = crAhEff(r); if (ah === 'early') add(crRole('ahEarly'), 1); if (ah === 'late') add(crRole('ahLate'), 1);
  if (r.labour && +r.labour.people && +r.labour.hours) add(crRole('labour'), (+r.labour.people) * (+r.labour.hours), `Additional labour — ${r.labour.people} × ${r.labour.hours} hours`);
  // travel
  tr.forEach((x) => { if (x.km == null) return; const mult = 1 - x.pct / 100;
    if (r.subsidy) { const sp = crRole('subsidy'); const cap = sp && sp.cap ? +sp.cap : 200; const ks = Math.min(x.km, cap); add(sp, ks, `Subsidised travel (${r.subsidy}) — ${x.name}, ${ks} km`, crR4((+sp.price || 0) * mult)); if (x.km > ks) add(crRole('travel'), x.km - ks, `Travel — ${x.name}, ${x.km - ks} km over the subsidy`, crR4((+crRole('travel').price || 0) * mult)); }
    else add(crRole('travel'), x.km, `Travel — ${x.name}, ${x.km} km return${x.pct ? ` (${x.why})` : ''}`, crR4((+(crRole('travel') || {}).price || 0) * mult));
    const fu = crRole('fuel'); if (fu) add(fu, x.km, `Fuel surcharge — ${x.name}, ${x.km} km${x.pct ? ` (${x.pct}% off)` : ''}`, crR4((+fu.price || 0) * mult)); });
  // certificates, items, lab tests
  (r.certs || []).forEach((c) => add(crProd(c.prod), c.qty || 1));
  (r.items || []).forEach((it) => { const p = crProd(it.prod); if (!p) return; const pack = it.as === 'pack'; add(p, it.qty, `${p.name} — ${crProdLabel(p, it.qty, it.as)}${it.mode === 'disp' ? ' dispensed' : it.mode === 'admin' ? ' given' : ''}`, pack ? +p.pricePack || 0 : +p.price || 0, { as: it.as || 'dose' }); });
  (r.labs || []).forEach((l) => { const p = l.prod && crProd(l.prod); if (p) add(p, 1, `${p.name}${l.lab ? ' — ' + l.lab : ''}`); });
  return L;
}
const CR_INV_ST = { notready: 'Not ready for billing', pending: 'Pending approval', approved: 'Approved — not sent', sent: 'Sent', paid: 'Paid' };
function crInvFor(r) { return crList('crinv').find((x) => !x.gone && x.rec === r.id) || null; }
function crInvTotals(inv) { const fz = crFees(); const sub = crR2((inv.lines || []).reduce((s, l) => s + (+l.qty || 0) * (+l.price || 0), 0)); const gst = crR2(sub * (fz.gst / 100)); return { sub, gst, total: crR2(sub + gst) }; }
function crInvSync(r) { // make or refresh the invoice from the record (lines you've added, changed or removed by hand are kept that way)
  let inv = crInvFor(r); if (inv && !['notready', 'pending'].includes(inv.status)) return inv; // approved: the record no longer changes it
  const sig = (l) => l.prod + '|' + l.desc; const auto = crBuildLines(r);
  if (!inv) { inv = { id: uid('inv'), rec: r.id, bid: r.bid, cid: r.cid, date: r.date, status: 'notready', lines: [], log: [], at: Date.now() }; crList('crinv').push(inv); }
  const keep = (inv.lines || []).filter((l) => !l.auto || l.edited); const gone = new Set(inv.removed || []);
  const old = (inv.lines || []).filter((l) => l.auto && !l.edited); const byS = new Map(old.map((l) => [sig(l) + '|' + l.qty + '|' + l.price, l.id]));
  const fresh = auto.filter((a) => !gone.has(sig(a)) && !keep.some((k) => k.auto && sig(k) === sig(a))).map((a) => ({ ...a, id: byS.get(sig(a) + '|' + a.qty + '|' + a.price) || a.id }));
  const lines = [...fresh, ...keep]; const strip = (L) => JSON.stringify(L.map((l) => [l.prod, l.desc, l.qty, l.price]));
  if (strip(lines) !== strip(inv.lines || []) || inv.bid !== r.bid || inv.date !== r.date) { inv.lines = lines; inv.bid = r.bid; inv.cid = r.cid; inv.date = r.date; touch(inv); }
  return inv;
}
function crOverdue(inv) { const fz = crFees(); return inv.status === 'sent' && inv.sentAt && Date.now() - inv.sentAt > fz.payDays * 864e5; }
function crInvLog(inv, what) { inv.log = [...(inv.log || []), { at: Date.now(), by: crMe(), what }]; }

/* ---------------- voice: the phone's speech recognition, with the practice's own word list ---------------- */
const CRV = { rec: null, on: false };
function crVoiceOk() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function crFixWords(t) { let s = ' ' + String(t || '').toLowerCase() + ' '; crVocab().forEach((v) => { if (!v.heard) return; const re = new RegExp('\\b' + v.heard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'); s = s.replace(re, v.to); }); return s.trim(); }
function crListen(onText, o = {}) { // o: { continuous, onEnd } → stop()
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { toast("This browser can't do voice — use Chrome on Android, or Safari on iPhone"); return null; }
  const rec = new SR(); rec.lang = 'en-AU'; rec.interimResults = false; rec.continuous = !!o.continuous; rec.maxAlternatives = 1;
  rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onText(crFixWords(e.results[i][0].transcript), e.results[i][0].transcript); };
  rec.onerror = (e) => { if (e.error === 'no-speech') return; toast(e.error === 'not-allowed' ? 'Allow the microphone for this app to use voice' : e.error === 'network' ? 'Voice needs signal — type it for now' : 'Voice: ' + e.error); };
  let stopped = false; rec.onend = () => { if (o.continuous && !stopped) { try { rec.start(); } catch (x) { } return; } if (o.onEnd) o.onEnd(); };
  try { rec.start(); } catch (x) { toast("Couldn't start voice"); return null; }
  return { stop() { stopped = true; try { rec.stop(); } catch (x) { } if (o.onEnd) o.onEnd(); } };
}
function crParsePd(t) { // what was said at the crush → { res, days, tag } or { undo }
  const s = t.toLowerCase().trim(); if (/^(undo|delete|scratch that|go back)\b/.test(s)) return { undo: true };
  const tag = (s.match(/\b(?:tag|visual|number)\s+([a-z0-9-]+)/) || [])[1]; const out = {}; if (tag) out.tag = tag.toUpperCase();
  if (/\b(heavy|heavies)\b/.test(s)) out.res = 'H'; else if (/\b(re ?check|recheck)\b/.test(s)) out.res = 'R'; else if (/\b(ndp|empty|not pregnant|non pregnant|dry|negative|open)\b/.test(s)) out.res = 'NDP';
  else { const d = (s.match(/\b(\d{2,3})\b/) || [])[1]; if (d) { out.res = 'P'; out.days = +d; } else if (/\b(pregnant|positive|in calf|preg|yes)\b/.test(s)) out.res = 'P'; }
  return out.res || out.tag ? out : null;
}
window.crOn = crOn; window.CR = CR;
