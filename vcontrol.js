/* Bovitech Super App — Scheduling → On call → 📟 vControl: export (update vControl) and 📟 vControl import (check vControl) — anyone can use them.
   vControl keeps one schedule per vet ("111097-Jess", "111097-Milly"), so it's one CSV per person, in vControl's own layout:
   "Time","Label" — "Nov-03 00:00 - Nov-04 23:59","On call". Export: from the app's on-call roster. Import: vControl's
   download of a schedule (Time, Label, Edit Schedule Times, Delete) is checked against the app — the app is always right. */
'use strict';
const VCX = { url: 'https://reseller.vcontrol.com.au/app/schedules', login: 'https://reseller.vcontrol.com.au/login', edit: (n) => 'https://reseller.vcontrol.com.au/app/edittimes/schedule:' + encodeURIComponent(n), pre: '111097-', check: null, past: false };
const VCX_DEF = [/^jess/i, /^milly|^amelia/i]; // the schedules set up in vControl so far
function vcxRec() { let r = Bk.get('vcsched'); if (!r) { const old = (Bk.get('vcnames') || {}).map || {}; const list = Bk.people().filter((p) => VCX_DEF.some((rx) => rx.test(p.preferred_name || p.full_name || ''))).map((p) => ({ sid: p.id, name: (p.preferred_name || p.full_name || '').split(' ')[0], file: old[p.id] || null }));
    return { id: 'vcsched', cfg: 'vcsched', list, _new: true }; } return r; }
const vcxList = () => (vcxRec().list || []).filter((x) => Bk.person(x.sid));
const vcxFile = (x) => x.file || VCX.pre + x.name;
function vcxSave(list) { let r = Bk.get('vcsched'); if (!r) { r = { id: 'vcsched', cfg: 'vcsched' }; Bk.list('bkcfg').push(r); } r.list = list; touch(r); save(); if (window.Sync) Sync.soon(); }
const VCX_M = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function vcxDay(md, near) { const m = /^([a-z]{3})-(\d{1,2})$/i.exec((md || '').trim()); if (!m) return null; const mo = VCX_M.indexOf(m[1].toLowerCase()); if (mo < 0) return null; // no year in vControl — use the year that puts it closest to today
  const y0 = +near.slice(0, 4); let best = null; [y0 - 1, y0, y0 + 1].forEach((y) => { const d = `${y}-${String(mo + 1).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`; const dist = Math.abs(new Date(d + 'T12:00:00') - new Date(near + 'T12:00:00')); if (!best || dist < best.dist) best = { d, dist }; }); return best.d; }
function vcxParse(text, fname) { // → { name, ranges: [{ from, to, t1, t2, label, raw }] }
  const rows = ezCsv(text); const today = bkToday(); let name = ''; const ranges = [];
  rows.forEach((r) => { const t = r.Time || r.time || Object.values(r)[0] || ''; const ed = r['Edit Schedule Times'] || ''; if (!name && /,/.test(ed)) name = ed.split(',')[0].trim();
    const m = /^\s*([A-Za-z]{3}-\d{1,2})\s+(\d{1,2}:\d\d)\s*-\s*([A-Za-z]{3}-\d{1,2})\s+(\d{1,2}:\d\d)\s*$/.exec(t); if (!m) return; const from = vcxDay(m[1], today); let to = vcxDay(m[3], from || today); if (from && to && to < from) to = `${+to.slice(0, 4) + 1}${to.slice(4)}`;
    ranges.push({ from, to, t1: m[2].padStart(5, '0'), t2: m[4].padStart(5, '0'), label: r.Label || '', raw: t }); });
  if (!name) { const f = (fname || '').replace(/\.csv$/i, '').replace(/\s*\(\d+\)$/, ''); name = f.replace(/^\d+-/, ''); }
  return { name, ranges }; }
function vcxCompare(files, opt) { // files: [{ name, ranges }] → { rows: [{ d, app, vc: [names], why }], from, to }
  const sched = vcxList(); const bySid = {}; sched.forEach((x) => (bySid[x.sid] = x)); const nameOf = (sid) => (bySid[sid] ? bySid[sid].name : Bk.pname(sid));
  const cover = {}; const odd = []; let from = null, to = null;
  files.forEach((f) => f.ranges.forEach((r) => { if (!r.from || !r.to) return; if (r.t1 !== '00:00' || r.t2 !== '23:59') odd.push({ f: f.name, r }); for (let d = r.from; d <= r.to; d = bkAdd(d, 1)) { (cover[d] = cover[d] || []).push(f.name); } if (!from || r.from < from) from = r.from; if (!to || r.to > to) to = r.to; }));
  if (!from) return { rows: [], odd, from, to, empty: true };
  if (!opt.past && from < bkToday()) from = bkToday(); const names = new Set(files.map((f) => f.name.toLowerCase())); const rows = [];
  for (let d = from; d <= to; d = bkAdd(d, 1)) { const w = bkOncallWho(d); const app = w ? nameOf(w) : ''; const vc = [...new Set(cover[d] || [])]; const appIn = app && names.has(app.toLowerCase());
    let why = ''; if (vc.length > 1) why = 'On two schedules in vControl'; else if (app && appIn && !vc.some((n) => n.toLowerCase() === app.toLowerCase())) why = vc.length ? `vControl has ${vc[0]}` : `Missing from ${app}'s vControl schedule`; else if (vc.length && (!app || vc[0].toLowerCase() !== app.toLowerCase())) why = app ? `vControl has ${vc[0]}` : 'No one is on call in the app';
    else if (app && !appIn && !vc.length) why = `${app}'s schedule wasn't uploaded — can't check`;
    rows.push({ d, app, vc, why }); }
  return { rows, odd, from, to }; }

/* vControl's bulk upload: one file for every schedule — Schedule Name, Description, Start Date/Time, End Date/Time, Timezone.
   DD/MM HH:mm with no year; an end at midnight leaves that day out, so a run of days ends at 00:00 the day after. */
const VCX_TZ = 'Australia/Perth';
const vcxSchedName = (x) => String(x.name || '').replace(/[^A-Za-z0-9]/g, '');
function vcxBulkCsv(from, to) { const dm = (d) => d.slice(8, 10) + '/' + d.slice(5, 7); const rows = ['Schedule Name,Description,Start Date/Time,End Date/Time,Timezone']; const L = vcxList(); if (from < bkToday()) from = bkToday();
  L.forEach((x) => { let s = null, e = null; const flush = () => { if (s) rows.push([vcxSchedName(x), 'On call', dm(s) + ' 00:00', dm(bkAdd(e, 1)) + ' 00:00', VCX_TZ].join(',')); s = e = null; };
    for (let d = from; d <= to; d = bkAdd(d, 1)) { if (bkOncallWho(d) === x.sid) { if (!s) s = d; e = d; } else flush(); } flush(); });
  return { csv: rows.join('\r\n') + '\r\n', n: rows.length - 1 }; }
/* ---------- the Settings card ---------- */
function vcxCard() { if (typeof Bk === 'undefined' || !Bk.on || !Bk.on()) return ''; const L = vcxList(); const f = VCX.from || bkToday(), t = VCX.to || bkAdd(bkToday(), 90); const C = VCX.check;
  const bad = C ? C.rows.filter((r) => r.why && !/can't check/.test(r.why)) : []; const nochk = C ? C.rows.filter((r) => /can't check/.test(r.why)) : [];
  return `<div class="card"><h3>📟 vControl export (for updates)</h3><div class="vcx-warn">⚠ <b>This changes vControl.</b> The files below are the app's on-call roster. Once you upload one into a person's schedule in vControl, the after-hours calls forward to match it.</div><div class="hint" style="margin:6px 0">One file holds everyone's on-call days — each line names the person's schedule. Upload it in vControl with <b>Bulk upload schedules</b>. The app's roster is always right.</div>
    <div class="actions"><a class="btn small primary" href="${VCX.url}" target="_blank" rel="noopener">🔗 vControl schedules</a>${L.map((x) => `<a class="btn small" href="${VCX.edit(x.name)}" target="_blank" rel="noopener">🔗 ${h(x.name)}'s schedule</a>`).join('')}<a class="btn small" href="${VCX.login}" target="_blank" rel="noopener">vControl log in</a></div>
    <div class="lbl" style="margin-top:10px">⬇ Download the bulk upload file</div>
    <div class="vcx-dates"><div class="f"><label for="vcx-from">From</label><input id="vcx-from" type="date" value="${f}"></div><div class="f"><label for="vcx-to">To</label><input id="vcx-to" type="date" value="${t}"></div></div>
    <div class="actions">${L.length ? `<button class="btn small primary" data-act="vcx-bulk">⬇ vControl bulk upload file (everyone)</button>` : '<span class="hint">No vControl schedules set up — add them below.</span>'}<button class="btn small" data-act="oc-csv2">⬇ Full list (one row per day, with mobiles)</button></div>
    <div class="hint">Days in a row are joined into one line, from midnight to midnight the day after (${VCX_TZ} time). It starts from today — vControl removes rules that have already ended. In vControl: <b>Bulk upload schedules</b> → choose the file. vControl <b>adds</b> these to what's there (it skips any it already has).</div>
    <div class="vcx-warn" style="margin-top:6px">⚠ If you change who's on call for a day that's <b>already been uploaded</b>, the upload adds the new person but doesn't take the old one off — delete that day from the old person's schedule in vControl (🔗 buttons above). The vControl import below finds any day that's on two schedules.</div>
    <details style="margin-top:6px"><summary class="hint">One person's schedule only (the older single-schedule format)</summary><div class="actions">${L.map((x) => `<button class="btn small" data-act="vcx-dl" data-sid="${x.sid}">⬇ ${h(vcxFile(x))}.csv</button>`).join('')}</div></details>
    <div class="lbl" style="margin-top:12px">Who has a vControl schedule</div>
    ${vcxWhoHtml(L)}</div>
  <div class="card"><h3>📟 vControl import (for checking errors)</h3><div class="vcx-ok">✓ <b>This doesn't change anything</b> — not vControl, not the app. It only reads vControl's file and shows any day that's different from the app's roster.</div>
    <div class="actions" style="margin-top:6px"><a class="btn small" href="${VCX.url}" target="_blank" rel="noopener">🔗 vControl schedules</a>${L.map((x) => `<a class="btn small" href="${VCX.edit(x.name)}" target="_blank" rel="noopener">🔗 ${h(x.name)}'s schedule</a>`).join('')}</div>
    <div class="hint">In vControl open each schedule and download its table (the CSV button), then upload them here — several at once is fine.</div>
    <div class="actions"><label class="btn small primary" style="cursor:pointer">⬆ Upload vControl CSVs<input type="file" accept=".csv,text/csv" multiple data-act="vcx-up" hidden></label><label class="bk-radio"><input type="checkbox" data-act="vcx-past" ${VCX.past ? 'checked' : ''}> include past days</label></div>
    ${C ? `<div class="card" style="margin-top:8px;border:2px solid ${bad.length ? 'var(--red)' : 'var(--green)'}"><b>${bad.length ? `⚠ ${bad.length} day${bad.length === 1 ? '' : 's'} wrong in vControl` : '✓ vControl matches the app'}</b> <span class="hint">${h(C.files.map((x) => x.name + ' (' + x.ranges.length + ' lines)').join(', '))} · ${C.from ? bkDate(C.from) + ' to ' + bkDate(C.to) : 'no dates'}</span>
      ${bad.length ? `<table class="ezy-t" style="margin-top:6px"><tr><th>Day</th><th>On call (app)</th><th>vControl</th><th>What's wrong</th></tr>${bad.map((r) => `<tr><td>${bkDate(r.d, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td><b>${h(r.app || '—')}</b></td><td>${h(r.vc.join(' + ') || '—')}</td><td>${h(r.why)}</td></tr>`).join('')}</table>
        <div class="hint" style="margin-top:6px"><b>To fix it:</b> in vControl, delete the wrong days from the wrong person's schedule (🔗 Fix buttons), then upload the bulk file from Export above (that's the step that changes vControl). Then download vControl's tables again and check them here.</div>
        <div class="actions">${[...new Set(bad.flatMap((r) => [r.app, ...r.vc]).filter(Boolean))].map((n) => { const x = L.find((y) => y.name === n); return x ? `<a class="btn small" href="${VCX.edit(x.name)}" target="_blank" rel="noopener">🔗 Fix ${h(n)}'s schedule</a><button class="btn small primary" data-act="vcx-dl" data-sid="${x.sid}" data-from="${C.from}" data-to="${C.to}">⬇ Corrected file for ${h(n)} (${h(vcxFile(x))}.csv)</button>` : ''; }).join('')}</div>` : ''}
      <div class="hint" style="margin-top:6px">Checked up to ${C.to ? bkDate(C.to) : '—'} — the last day in the uploaded files. Days after that aren't in vControl yet: download from Export above and upload it to vControl when you're ready.</div>
      ${C.odd.length ? `<div class="hint" style="margin-top:6px">⚠ Not midnight to midnight: ${C.odd.map((o) => h(o.f + ': ' + o.r.raw)).join('; ')}</div>` : ''}
      ${nochk.length ? `<div class="hint" style="margin-top:6px">Not checked (that person's schedule wasn't uploaded): ${nochk.length} day${nochk.length === 1 ? '' : 's'}.</div>` : ''}</div>` : ''}
</div></div>`; }

function vcxWhoHtml(L) { return `${Bk.people().filter((p) => p.active !== false).map((p) => { const x = L.find((y) => y.sid === p.id); return `<div class="kv" style="align-items:center"><label class="bk-radio" style="flex:1"><input type="checkbox" data-act="vcx-on" data-sid="${p.id}" ${x ? 'checked' : ''}> ${h(p.preferred_name || p.full_name)}</label>${x ? `<span class="hint">schedule <b>${h(x.name)}</b> · file ${h(vcxFile(x))}.csv</span><button class="btn small" data-act="vcx-ren" data-sid="${p.id}" aria-label="Change the vControl schedule name">✏️</button>` : '<span class="hint">no vControl schedule</span>'}</div>`; }).join('')}
    <div class="hint">Tick someone (Rory, a locum) once their schedule is set up in vControl. ✏️ sets the schedule's name in vControl (the end of its web address, like schedule:Jess) and the file name.`; }
/* ---------- events ---------- */
const vcxDl = (name, text) => { const blob = new Blob([text], { type: 'text/csv' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); };
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^vcx-|^oc-csv2$/.test(a)) return; const d = el.dataset;
  const g = (id) => (document.getElementById(id) || {}).value || '';
  if (a === 'vcx-bulk') { const f = g('vcx-from'), t = g('vcx-to'); if (!f || !t || t < f) { toast('Choose the dates'); return; } VCX.from = f; VCX.to = t; const r = vcxBulkCsv(f, t); if (!r.n) { toast('Nobody with a vControl schedule is on call in those dates'); return; } vcxDl(`vControl-on-call-${bkToday()}.csv`, r.csv); toast(`Downloaded — ${r.n} line${r.n === 1 ? '' : 's'}`); }
  if (a === 'vcx-dl') { const x = vcxList().find((y) => y.sid === d.sid); if (!x) return; const f = d.from || g('vcx-from'), t = d.to || g('vcx-to'); if (!f || !t || t < f) { toast('Choose the dates'); return; } VCX.from = g('vcx-from') || VCX.from; VCX.to = g('vcx-to') || VCX.to; vcxDl(vcxFile(x) + '.csv', bkVcCsv(x.sid, f, t)); toast(vcxFile(x) + '.csv downloaded'); }
  if (a === 'oc-csv2') { const f = g('vcx-from'), t = g('vcx-to'); if (!f || !t || t < f) { toast('Choose the dates'); return; } vcxDl(`on-call-${f}-to-${t}.csv`, bkOcCsv(f, t)); toast('On-call list downloaded'); }
  if (a === 'vcx-ren') { if (!Bk.need('roster')) return; const L = vcxRec().list || []; const x = L.find((y) => y.sid === d.sid); if (!x) return; const p = Bk.person(x.sid);
    const ok = await askBox('vControl schedule', `<div class="f"><label>${h(p.preferred_name || p.full_name)}'s schedule name in vControl (the end of its web address — schedule:<b>Jess</b>)</label><input data-ask="n" value="${h(x.name)}" style="width:100%;padding:9px;font-size:16px"></div><div class="f"><label>File name (without .csv)</label><input data-ask="f" value="${h(vcxFile(x))}" style="width:100%;padding:9px;font-size:16px"></div>`, 'Save'); if (!ok) return;
    x.name = (ASK_FORM.n || '').trim() || x.name; x.file = (ASK_FORM.f || '').trim() || null; vcxSave(L); renderAll(); } });
document.addEventListener('change', async (e) => { const el = e.target; const a = el.dataset && el.dataset.act; if (!/^vcx-/.test(a || '')) return;
  if (a === 'vcx-past') { VCX.past = el.checked; if (VCX.check) { VCX.check = { ...vcxCompare(VCX.check.files, { past: VCX.past }), files: VCX.check.files }; } renderAll(); }
  if (a === 'vcx-on') { if (!Bk.need('roster')) { el.checked = !el.checked; return; } const L = [...(vcxRec().list || [])]; const p = Bk.person(el.dataset.sid); if (!p) return;
    if (el.checked) { if (!L.some((x) => x.sid === p.id)) L.push({ sid: p.id, name: (p.preferred_name || p.full_name || '').split(' ')[0], file: null }); } else { const i = L.findIndex((x) => x.sid === p.id); if (i >= 0) L.splice(i, 1); } vcxSave(L); renderAll(); }
  if (a === 'vcx-up') { const files = []; for (const f of el.files || []) { try { files.push(vcxParse(await f.text(), f.name)); } catch (x) { toast("Couldn't read " + f.name); } } el.value = '';
    if (!files.length) return; if (files.every((f) => !f.ranges.length)) { toast("No schedule times found — upload the table downloaded from a vControl schedule's times page"); return; }
    VCX.check = { ...vcxCompare(files, { past: VCX.past }), files }; renderAll(); } });
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-vcx]'); if (!el) return; setTimeout(() => { if (S.setOpen && S.setOpen.add) S.setOpen.add('📟 vControl export (for updates)'); S.setOpen.add('📟 vControl import (for checking errors)'); renderAll(); const d = [...document.querySelectorAll('details.setsec')].find((x) => x.dataset.sec === '📟 vControl export (for updates)'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }, 30); });
window.vcxCard = vcxCard;
if (typeof module !== 'undefined') module.exports = { vcxParse, vcxDay };
