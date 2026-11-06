/* Bovitech Super App — v2.29: AI programs and the AI call list (Scheduling → Bulk lists → 🐄 AI programs).
   Each program: client, heifers or cows (fresh <100 DIM / non-fresh >100 DIM), number of head, AI day (Day 10) and time,
   what we're booked for (not booked yet / devices only / full protocol + AI / AI only) and FTAI or heat detection,
   and the drug order (not ordered / to order / ordered / arrived / client supplies).
   The protocol works out every step's date and time and the drugs needed (from the AI protocol spreadsheet).
   ⬇ Spreadsheet (opens in Excel) and 🖨 PDF for the season. The AI bulk lists show each client's programs. */
const AI_PROTOS = {
  fresh: { name: 'Dairy cows — fresh (<100 DIM)', group: 'cows', steps: [
    { day: 0, h: 0, t: 'Insert intra-vaginal device + GnRH', drugs: { device: 1, gnrh: 1 } },
    { day: 7, h: 0, t: 'Remove device + PG 2mL + eCG 2mL', drugs: { pg: 2, ecg: 2 } },
    { day: 9, h: 0, t: 'GnRH', drugs: { gnrh: 1 } },
    { day: 10, h: 16, t: 'FTAI (14–18 hr after GnRH)', ai: true }] },
  nonfresh: { name: 'Dairy cows — non-fresh (>100 DIM)', group: 'cows', steps: [
    { day: 0, h: 0, t: 'Insert intra-vaginal device + GnRH', drugs: { device: 1, gnrh: 1 } },
    { day: 7, h: 0, t: 'Remove device + PG 2mL', drugs: { pg: 2 } },
    { day: 9, h: 0, t: 'GnRH', drugs: { gnrh: 1 } },
    { day: 10, h: 16, t: 'FTAI (14–18 hr after GnRH)', ai: true }] },
  heifer: { name: 'Heifers', group: 'heifers', steps: [
    { day: 0, h: 0, t: 'Insert intra-vaginal device + ODB 2mL', drugs: { device: 1, odb: 2 } },
    { day: 8, h: 0, t: 'Remove device + PG 2mL', drugs: { pg: 2 } },
    { day: 9, h: 0, t: 'ODB 1mL', drugs: { odb: 1 } },
    { day: 10, h: 54, t: 'FTAI (52–56 hr after device removal)', ai: true, fromStep: 1 }] } };
const AI_DRUGS = [['device', 'Intra-vaginal devices', ''], ['gnrh', 'GnRH', 'mL'], ['pg', 'PG (cloprostenol)', 'mL'], ['ecg', 'eCG', 'mL'], ['odb', 'ODB', 'mL']];
const AI_MODES = { none: 'Not booked yet', devices: 'Devices and injections only', full: 'Full protocol + AI', ai: 'AI only' };
const AI_DETECT = { ftai: 'Fixed-time AI', heat: 'Heat detection' };
const AI_ORDER = { none: 'Not ordered', toorder: 'To order', ordered: 'Ordered', arrived: 'Arrived', client: 'Client supplies' };
const AI_ORDCOL = { none: ['#ececec', '#555'], toorder: ['#ffe8d1', '#7a3300'], ordered: ['#e3edfb', '#14315f'], arrived: ['#e3f5e6', '#1d5b2c'], client: ['#f1e8fb', '#4b2a7a'] };
const AI = { year: null };
const aiSeason = (d) => +String(d || bkToday()).slice(0, 4);
const aiList = (year) => Bk.cfg('aiprog').filter((x) => !year || aiSeason(x.aiDate) === year).sort((a, b) => (a.aiDate || '').localeCompare(b.aiDate || '') || (a.name || '').localeCompare(b.name || ''));
const aiGnrhMl = () => (((D.settings || {}).aiGnrh || '100') === '50' ? 2 : 1); // 2mL of the 50mg/mL product, 1mL of the 100mg/mL product
function aiSteps(p) { const P = AI_PROTOS[p.proto]; if (!P || p.detect === 'heat') return []; const ai = new Date(`${p.aiDate}T${p.aiTime || '08:00'}:00`); if (isNaN(ai)) return [];
  const last = P.steps[P.steps.length - 1]; const anchor = last.fromStep != null ? P.steps[last.fromStep] : P.steps[P.steps.length - 2];
  const base = new Date(ai.getTime() - last.h * 36e5); // when the step the AI time is counted from happens (GnRH Day 9 for cows, device removal Day 8 for heifers)
  return P.steps.map((s) => { const when = s.ai ? ai : new Date(base.getTime() - (anchor.day - s.day) * 864e5); return { ...s, when }; }); }
function aiDrugs(p) { const out = {}; if (!['full', 'devices'].includes(p.mode) || p.detect === 'heat' || p.order === 'client') return out; const P = AI_PROTOS[p.proto]; if (!P) return out;
  P.steps.forEach((s) => Object.entries(s.drugs || {}).forEach(([k, v]) => { out[k] = (out[k] || 0) + (k === 'gnrh' ? aiGnrhMl() : v) * (+p.head || 0); })); return out; }
const aiWhen = (d) => d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const aiPill = (o) => `<span class="bk-pill" style="background:${(AI_ORDCOL[o] || AI_ORDCOL.none)[0]};color:${(AI_ORDCOL[o] || AI_ORDCOL.none)[1]}">💊 ${h(AI_ORDER[o] || AI_ORDER.none)}</span>`;
function aiRow(p) { const b = IDX.biz.get(p.bid); const P = AI_PROTOS[p.proto] || {}; const st = aiSteps(p); const dr = aiDrugs(p);
  return `<div class="bk-bulkrow aiprow"><div class="v"><b>${h(b ? b.name : p.name || '?')}</b> — ${h(P.name || '')} · <b>${+p.head || '?'} hd</b> ${aiPill(p.order)}<br><span class="hint">${h(AI_MODES[p.mode] || '')} · ${h(AI_DETECT[p.detect] || '')} · AI ${p.aiDate ? bkDate(p.aiDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'date not set'}${p.notes ? ' · ' + h(p.notes) : ''}</span>
    ${st.length ? `<div class="hint">${st.map((s) => `Day ${s.day} (${aiWhen(s.when)}): ${h(s.t)}`).join('<br>')}</div>` : ''}${Object.keys(dr).length ? `<div class="hint">💊 ${AI_DRUGS.filter(([k]) => dr[k]).map(([k, l, u]) => `${l}: ${dr[k]}${u}`).join(' · ')}</div>` : ''}</div>
    <div class="actions"><button class="btn small" data-act="ai-edit" data-id="${p.id}">✏️</button>${Object.keys(AI_ORDER).filter((k) => k !== p.order && ['toorder', 'ordered', 'arrived'].includes(k)).map((k) => `<button class="btn small" data-act="ai-order" data-id="${p.id}" data-v="${k}">${AI_ORDER[k]}</button>`).join('')}</div></div>`; }
function aiTotals(L) { const t = {}; L.forEach((p) => Object.entries(aiDrugs(p)).forEach(([k, v]) => { t[k] = (t[k] || 0) + v; })); return t; }
function aipCardHtml() { const y = AI.year || aiSeason(); const L = aiList(y); const tot = aiTotals(L); const hd = L.reduce((a, p) => a + (+p.head || 0), 0); const ys = [...new Set([aiSeason() - 1, aiSeason(), aiSeason() + 1, ...Bk.cfg('aiprog').map((p) => aiSeason(p.aiDate))])].sort();
  return `<div class="card aicard"><h3><span class="sp">🐄 AI programs ${y}</span><select data-act="ai-year" aria-label="Year">${ys.map((x) => `<option ${x === y ? 'selected' : ''}>${x}</option>`).join('')}</select></h3>
    <div class="hint" style="margin-bottom:6px">${L.length} program${L.length === 1 ? '' : 's'} · ${hd} head. Early programs (autumn calving) Apr–Aug, late programs (spring calving) Sep–Dec, off-season Jan–Mar. Each program's dates and drugs come from the AI protocols. GnRH: <select data-act="ai-gnrh" aria-label="GnRH product"><option value="100" ${aiGnrhMl() === 1 ? 'selected' : ''}>100mg/mL (1mL)</option><option value="50" ${aiGnrhMl() === 2 ? 'selected' : ''}>50mg/mL (2mL)</option></select></div>
    <div class="actions"><button class="btn small primary" data-act="ai-edit" data-id="">➕ Add a program</button><button class="btn small" data-act="ai-csv">⬇ Spreadsheet (opens in Excel)</button><button class="btn small" data-act="ai-pdf">🖨 PDF</button></div>
    ${Object.keys(tot).length ? `<div class="aitot"><b>💊 Drugs needed for ${y}</b> <span class="hint">(full protocol and devices-only programs we supply)</span><br>${AI_DRUGS.filter(([k]) => tot[k]).map(([k, l, u]) => `${l}: <b>${tot[k]}${u}</b>`).join(' · ')}</div>` : ''}
    ${L.map(aiRow).join('') || '<div class="hint">No programs yet — tap ➕ Add a program, or 🐄 on a client in the AI lists below.</div>'}</div>`; }
function aiEdit(id, bid) { const p0 = id ? Bk.get(id) : null; const p = p0 ? { ...p0 } : { bid: bid || '', proto: 'heifer', head: '', aiDate: '', aiTime: '08:00', mode: 'full', detect: 'ftai', order: 'none', notes: '' };
  const bz = (D.businesses || []).filter((b) => !b.gone && (typeof bkCattleClient !== 'function' || bkCattleClient(b) || b.id === p.bid)).sort((a, c) => (a.name || '').localeCompare(c.name || ''));
  const sel = (id2, M, v) => `<select id="${id2}">${Object.entries(M).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${h(typeof l === 'string' ? l : l.name)}</option>`).join('')}</select>`;
  openSheet((p0 ? '✏️ ' : '➕ ') + 'AI program', `<div class="f"><label for="ai-biz">Client</label><select id="ai-biz"><option value=""></option>${bz.map((b) => `<option value="${b.id}" ${b.id === p.bid ? 'selected' : ''}>${h(b.name)}</option>`).join('')}</select></div>
    <div class="grid2"><div class="f"><label for="ai-proto">Program</label>${sel('ai-proto', AI_PROTOS, p.proto)}</div><div class="f"><label for="ai-head">Number of head</label><input id="ai-head" type="number" min="0" inputmode="numeric" value="${h(p.head || '')}"></div></div>
    <div class="grid2"><div class="f"><label for="ai-date">AI day (Day 10)</label><input id="ai-date" type="date" value="${h(p.aiDate || '')}"></div><div class="f"><label for="ai-time">AI time</label><input id="ai-time" type="time" value="${h(p.aiTime || '08:00')}"></div></div>
    <div class="grid2"><div class="f"><label for="ai-mode">What we're booked for</label>${sel('ai-mode', AI_MODES, p.mode)}</div><div class="f"><label for="ai-detect">AI</label>${sel('ai-detect', AI_DETECT, p.detect)}</div></div>
    <div class="f"><label for="ai-order">Drug order</label>${sel('ai-order', AI_ORDER, p.order)}</div><div class="f"><label for="ai-notes">Notes</label><textarea id="ai-notes" rows="2">${h(p.notes || '')}</textarea></div>
    ${p0 ? '<button type="button" class="btn small" data-act="ai-del" data-id="' + p0.id + '" style="color:var(--red)">🗑 Delete this program</button>' : ''}`, async () => {
    const g = (x) => document.getElementById(x).value; if (!g('ai-biz')) { toast('Choose the client'); return false; }
    const r = p0 || { id: 'aiprog:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), cfg: 'aiprog' }; Object.assign(r, { bid: g('ai-biz'), name: (IDX.biz.get(g('ai-biz')) || {}).name || '', proto: g('ai-proto'), head: +g('ai-head') || 0, aiDate: g('ai-date'), aiTime: g('ai-time') || '08:00', mode: g('ai-mode'), detect: g('ai-detect'), order: g('ai-order'), notes: g('ai-notes').trim() });
    if (!p0) D.bkcfg.push(r); touch(r); NEXT_LOG_LABEL = `AI program: ${r.name}`; return true; }); }
function aiRowsFor(y) { return aiList(y).map((p) => { const b = IDX.biz.get(p.bid); const st = aiSteps(p); const dr = aiDrugs(p); const P = AI_PROTOS[p.proto] || {};
  return { client: b ? b.name : p.name || '', program: P.name || '', head: +p.head || 0, mode: AI_MODES[p.mode] || '', ai: AI_DETECT[p.detect] || '', aiDay: p.aiDate || '', order: AI_ORDER[p.order] || '', steps: st.map((s) => `Day ${s.day} ${aiWhen(s.when)}: ${s.t}`), drugs: dr, notes: p.notes || '' }; }); }
function aiCsv() { const y = AI.year || aiSeason(); const R = aiRowsFor(y); const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = ['Client', 'Program', 'Head', 'Booked for', 'AI', 'AI day', 'Drug order', 'Steps', ...AI_DRUGS.map(([, l, u]) => l + (u ? ` (${u})` : '')), 'Notes'];
  const lines = [head, ...R.map((r) => [r.client, r.program, r.head, r.mode, r.ai, r.aiDay, r.order, r.steps.join(' | '), ...AI_DRUGS.map(([k]) => r.drugs[k] || ''), r.notes])]; const tot = aiTotals(aiList(y)); lines.push(['Total', '', R.reduce((a, r) => a + r.head, 0), '', '', '', '', '', ...AI_DRUGS.map(([k]) => tot[k] || ''), '']);
  downloadFile(`bovitech-ai-programs-${y}.csv`, '﻿' + lines.map((l) => l.map(q).join(',')).join('\r\n'), 'text/csv'); }
function aiPdf() { const y = AI.year || aiSeason(); const R = aiRowsFor(y); const tot = aiTotals(aiList(y));
  crPrint(`<!doctype html><html><head><meta charset="utf-8"><title>AI programs ${y}</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px}h1{font-size:18px;margin:0 0 4px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px;vertical-align:top;text-align:left}th{background:#eee}</style></head><body><h1>Bovitech Veterinary Services — AI programs ${y}</h1><div>office@bovitech.com.au · 0499 489 919</div><br>
    <table><tr><th>Client</th><th>Program</th><th>Head</th><th>Booked for</th><th>AI day</th><th>Steps</th><th>Drugs</th><th>Order</th></tr>${R.map((r) => `<tr><td>${h(r.client)}</td><td>${h(r.program)}<br>${h(r.ai)}</td><td>${r.head}</td><td>${h(r.mode)}</td><td>${h(r.aiDay)}</td><td>${r.steps.map(h).join('<br>')}</td><td>${AI_DRUGS.filter(([k]) => r.drugs[k]).map(([k, l, u]) => `${l}: ${r.drugs[k]}${u}`).join('<br>')}</td><td>${h(r.order)}</td></tr>`).join('')}</table>
    <p><b>Total:</b> ${R.reduce((a, r) => a + r.head, 0)} head${AI_DRUGS.filter(([k]) => tot[k]).map(([k, l, u]) => ` · ${l}: ${tot[k]}${u}`).join('')}</p><p>GnRH: ${aiGnrhMl() === 2 ? '2mL of the 50mg/mL product' : '1mL of the 100mg/mL product'} per dose.</p></body></html>`); }
/* the Bulk lists page: the AI programs card first, and 🐄 on each client in the AI lists */
bkBulkHtml = (function (orig) { return function () { let html = orig.apply(this, arguments); const B = Bk.cfg('aiprog');
  html = html.replace(/(<div class="card"><h3><span class="sp">AI — [\s\S]*?)(?=<div class="card"><h3>)/g, (card) => card.replace(/<div class="bk-bulkrow"><div class="v"><b>([^<]*)<\/b>/g, (m, nm) => { const b = (D.businesses || []).find((x) => h(x.name) === nm); if (!b) return m; const n = B.filter((p) => p.bid === b.id && aiSeason(p.aiDate) >= aiSeason() - 1); return `<div class="bk-bulkrow"><div class="v"><b>${nm}</b> ${n.length ? n.map((p) => `<span class="bk-pill">🐄 ${h((AI_PROTOS[p.proto] || {}).name || '')} ${+p.head || ''}hd ${p.aiDate ? bkDate(p.aiDate, { day: 'numeric', month: 'short' }) : ''}</span>`).join(' ') : ''} <button class="btn small" data-act="ai-edit" data-id="" data-bid="${b.id}" title="Add an AI program">🐄 ➕</button>`; }));
  const at = html.indexOf('<div class="card"><h3><span class="sp">'); return at >= 0 ? html.slice(0, at) + aipCardHtml() + html.slice(at) : html + aipCardHtml(); }; })(bkBulkHtml);
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act^=ai-]'); if (!el || !['ai-edit', 'ai-order', 'ai-csv', 'ai-pdf', 'ai-del'].includes(el.dataset.act)) return; e.stopPropagation(); e.preventDefault(); const a = el.dataset.act;
  if (a === 'ai-edit') aiEdit(el.dataset.id, el.dataset.bid); if (a === 'ai-csv') aiCsv(); if (a === 'ai-pdf') aiPdf();
  if (a === 'ai-order') { const p = Bk.get(el.dataset.id); if (!p) return; p.order = el.dataset.v; touch(p); NEXT_LOG_LABEL = `AI drugs ${AI_ORDER[p.order].toLowerCase()}: ${p.name}`; S.skipConfirm = true; await changed(); }
  if (a === 'ai-del') { const p = Bk.get(el.dataset.id); if (!p || !(await ask(`Delete this AI program for ${p.name}?`, '🗑 Delete', true))) return; p.gone = true; touch(p); closeSheet(); NEXT_LOG_LABEL = `AI program deleted: ${p.name}`; S.skipConfirm = true; await changed(); } }, true);
document.addEventListener('change', (e) => { const el = e.target; if (!el.dataset) return; if (el.dataset.act === 'ai-year') { AI.year = +el.value; renderAll(); } if (el.dataset.act === 'ai-gnrh') { D.settings.aiGnrh = el.value; touch(D.settings); save(); if (window.Sync) Sync.soon(); renderAll(); } });
/* Jobs: drugs to order for programs in the next 6 weeks */
if (typeof JOB_TYPES !== 'undefined') JOB_TYPES.aiorder = { t: 'AI drugs to order', manual: true };
function aiJobs() { if (typeof Bk === 'undefined' || !Bk.on || !Bk.on()) return []; const t = bkToday(), lim = bkAdd(t, 42); return Bk.cfg('aiprog').filter((p) => p.aiDate && p.aiDate >= t && p.aiDate <= lim && ['none', 'toorder'].includes(p.order || 'none') && ['full', 'devices'].includes(p.mode) && p.detect !== 'heat')
  .map((p) => ({ type: 'aiorder', key: 'aiorder:' + p.id + ':' + p.aiDate, kind: 'business', id: p.bid, who: `${p.name} — AI drugs to order`, note: `${(AI_PROTOS[p.proto] || {}).name || ''}, ${p.head} head, AI ${bkDate(p.aiDate, { weekday: 'short', day: 'numeric', month: 'short' })}. ${AI_DRUGS.filter(([k]) => aiDrugs(p)[k]).map(([k, l, u]) => `${l}: ${aiDrugs(p)[k]}${u}`).join(' · ')}`, aiorder: p.id })); }
function aiJobHtml(j) { return `</div><div class="actions" style="width:100%"><button class="btn small greenbtn" data-act="ai-order" data-id="${j.aiorder}" data-v="ordered">✓ Ordered</button><button class="btn small" data-act="ai-order" data-id="${j.aiorder}" data-v="client">Client supplies</button><button class="btn small" data-act="ai-edit" data-id="${j.aiorder}">✏️ Open the program</button></div><div>`; }
(function () { const st = document.createElement('style'); st.textContent = '.aicard h3 select{font-size:14px;padding:2px 6px}.aitot{margin:8px 0;padding:8px;border:1px solid var(--line);border-radius:10px}'; document.head.appendChild(st); })();
window.aiSteps = aiSteps; window.aiDrugs = aiDrugs; window.aiJobs = aiJobs; window.aiJobHtml = aiJobHtml; window.aipCardHtml = aipCardHtml; window.aiEdit = aiEdit;
