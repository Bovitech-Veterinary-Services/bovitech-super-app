/* Bovitech Super App — Scheduling → 📦 Day prep: everything to get ready for the day's jobs, from what each procedure needs
   (Settings → Scheduling → 📦 Day prep list). "Scanner batteries × 3" once a day; "PD certificate × 1 each" for every
   appointment; "Rectal gloves × 1 per head" for every head booked. */
'use strict';
const PREP_DEF = [[/preg|pd\b|pregnan/i, ['Scanner batteries × 3', 'Lube', 'Exam gloves', 'Rectal gloves']]];
const PREP_ALL = '_all'; // things for every working day
const PREP_LISTS = [['_all', 'AM vehicle pre-start checklist', 'am'], ['_oam', 'Office AM checklist', 'am'], ['_pm', 'PM vehicle sign-off checklist', 'pm'], ['_opm', 'Office PM checklist', 'pm']]; // checklists for each working day ('_all' kept as the id so nothing already saved is lost)
const prepWho = (id) => ((prepRec().who || {})[id]); // null = everyone working that day
const prepListOn = (id, sid) => { const w = prepWho(id); return !w || w.includes(sid); };
function prepRec() { return Bk.get('prep') || { id: 'prep', cfg: 'prep', by: prepSeed(), _new: true }; }
function prepSeed() { const by = {}; Bk.cfg('service').forEach((s) => { const d = PREP_DEF.find(([rx]) => rx.test(s.name || '')); if (d) by[s.id] = d[1].map(prepParse); }); return by; }
function prepParse(line) { let t = String(line || '').trim(); if (!t) return null; let per = 'day', q = 1;
  if (/\bper head\b/i.test(t)) { per = 'head'; t = t.replace(/\s*\bper head\b/i, ''); } else if (/\beach\b\s*$|\(each( job| appointment)?\)\s*$|\bper (job|appointment)\b/i.test(t)) { per = 'appt'; t = t.replace(/\s*(\(each( job| appointment)?\)|\beach\b|\bper (job|appointment)\b)\s*$/i, ''); }
  const m = /\s*[×x*]\s*(\d+(?:\.\d+)?)\s*$/i.exec(t); if (m) { q = +m[1]; t = t.slice(0, m.index); } return { t: t.trim(), q, per }; }
const prepLine = (x) => `${x.t}${x.q !== 1 || x.per !== 'day' ? ' × ' + x.q : ''}${x.per === 'appt' ? ' each' : x.per === 'head' ? ' per head' : ''}`;
function prepSave(by) { let r = Bk.get('prep'); if (!r) { r = { id: 'prep', cfg: 'prep' }; Bk.list('bkcfg').push(r); } r.by = by; touch(r); save(); if (window.Sync) Sync.soon(); }
function prepFor(sid, date) { // → { items (the jobs' things), lists: [{ id, name, when, items }], jobs }
  const by = prepRec().by || {}; const L = Bk.bookingsFor(date, sid).filter((b) => b.status !== 'cancelled'); const tot = {}; const day = {};
  const put = (x, n, why, once) => { const k = x.t.toLowerCase(); const o = (tot[k] = tot[k] || { t: x.t, n: 0, why: new Set() }); if (once) { day[k] = Math.max(day[k] || 0, n); } else o.n += n; o.why.add(why); };
  const working = !!(L.length || Bk.hours(Bk.person(sid), date));
  const lists = working ? PREP_LISTS.filter(([id]) => prepListOn(id, sid) && (by[id] || []).length).map(([id, name, when]) => ({ id, name, when, items: (by[id] || []).map((x) => ({ t: x.t, n: x.q, why: [] })) })) : [];
  L.forEach((b) => { const nm = (IDX.biz.get(b.bid) || {}).name || 'appointment'; (b.svcs || []).forEach((v) => { if (!v.svc || (v.staff && v.staff.length && !v.staff.includes(sid))) return; const s = Bk.svc(v.svc); (by[v.svc] || []).forEach((x) => {
    if (x.per === 'appt') put(x, x.q, `${s.name} — ${nm}`); else if (x.per === 'head') put(x, x.q * (+v.head || 0), `${s.name} — ${nm}${v.head ? ' (' + v.head + ' head)' : ''}`); else put(x, x.q, s.name, true); }); }); });
  Object.entries(day).forEach(([k, n]) => (tot[k].n += n));
  return { items: Object.values(tot).filter((x) => x.n > 0).map((x) => ({ ...x, why: [...x.why] })).sort((a, b) => a.t.localeCompare(b.t)), lists, jobs: L }; }
const prepCount = (f) => f.items.length + f.lists.reduce((s, l) => s + l.items.length, 0);
const prepKey = (sec, t) => (sec ? sec + ':' : '') + t.toLowerCase();
const prepTickKey = (sid, date) => 'bvp-prep-' + sid + '-' + date;
const prepTicks = (sid, date) => { try { return JSON.parse(localStorage.getItem(prepTickKey(sid, date)) || '{}'); } catch (e) { return {}; } };
function prepSecs(f) { // the order on the page and in Google Calendar: morning checklists, the jobs' things, afternoon checklists
  return [...f.lists.filter((l) => l.when === 'am').map((l) => ({ k: l.id, title: l.name, items: l.items })), ...(f.items.length ? [{ k: '', title: 'For the jobs', items: f.items }] : []), ...f.lists.filter((l) => l.when === 'pm').map((l) => ({ k: l.id, title: l.name, items: l.items }))]; }
const prepQty = (x) => (x.n !== 1 ? ` × ${+(+x.n).toFixed(2)}` : '');
function prepHtml() { const sid = bkSheetSid(); const date = BK.date || bkToday(); const p = Bk.person(sid);
  const pick = `<div class="bk-top bk-noprint"><div class="bk-nav"><button class="btn small" data-act="bks-go" data-v="-1" aria-label="Back a day">‹</button><button class="btn small" data-act="bk-today">Today</button><button class="btn small" data-act="bks-go" data-v="1" aria-label="Forward a day">›</button><input type="date" id="prep-date" value="${date}" aria-label="Day"></div>
    <select id="bks-who" aria-label="Whose day">${Bk.people().map((s) => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${h(s.preferred_name || s.full_name)}</option>`).join('')}</select>
    <div class="bk-nav"><button class="btn small" data-act="prep-print">🖨 Print</button><button class="btn small" data-act="prep-copy">📋 Copy as text</button></div></div>`;
  if (!p) return `<div class="d-wrap bk-wrap">${pick}<div class="card"><div class="hint">The staff list loads the first time you sign in with internet.</div></div></div>`;
  const f = prepFor(sid, date); const secs = prepSecs(f); const tk = prepTicks(sid, date); const all = secs.flatMap((s) => s.items.map((x) => prepKey(s.k, x.t))); const done = all.filter((k) => tk[k]).length;
  return `<div class="d-wrap bk-wrap">${pick}<h2 class="sec-h" style="font-size:24px">📦 Day prep — ${h(p.preferred_name || p.full_name)}, ${bkDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
    <div class="hint" style="margin-bottom:6px">${f.jobs.length} appointment${f.jobs.length === 1 ? '' : 's'}. Change the lists in Settings → Scheduling → 📦 Day prep list. It's also on Google Calendar each day.${all.length ? ` <b>${done} of ${all.length} done.</b>` : ''}</div>
    ${remBlock(date, sid)}
    ${secs.map((s) => `<div class="card"><h3>${h(s.title)}</h3>${s.items.map((x) => { const k = prepKey(s.k, x.t); return `<label class="kv prep-row ${tk[k] ? 'done' : ''}" style="align-items:center;cursor:pointer"><input type="checkbox" data-act="prep-tick" data-k="${h(k)}" ${tk[k] ? 'checked' : ''} style="width:22px;height:22px;margin-right:10px"><div class="v"><b>${h(x.t)}</b>${prepQty(x)}${x.why.length ? `<br><span class="hint">${h(x.why.join(' · '))}</span>` : ''}</div></label>`; }).join('')}</div>`).join('')
      || `<div class="card"><div class="hint">${f.jobs.length ? 'Nothing listed for these procedures yet — add what each one needs in Settings → Scheduling → 📦 Day prep list.' : 'Not working this day.'}</div></div>`}
    ${f.jobs.length ? `<div class="card"><h3>The day's appointments</h3>${f.jobs.map((b) => `<div class="kv"><div class="k">${b.start ? bkTime(b.start) : ''}</div><div class="v">${h((IDX.biz.get(b.bid) || {}).name || '')} <span class="hint">${h((b.svcs || []).map((v) => Bk.svc(v.svc).name + (v.head ? ' ' + v.head + ' head' : '')).join(', '))}</span></div></div>`).join('')}</div>` : ''}</div>`; }
function prepBuild(sid, date) { // { text, html } — for Copy and for the Google Calendar event (empty when there's nothing)
  const f = prepFor(sid, date); const secs = prepSecs(f); const rr = typeof remFor === 'function' ? remFor(date, sid) : []; if (rr.length) secs.unshift({ k: 'rem', title: '🔔 Reminders', items: rr.map((r) => ({ t: remText(r), n: 1, why: [] })) });
  if (!secs.length) return { text: '', html: '', n: 0 }; const p = Bk.person(sid);
  const text = `Day prep — ${p ? p.preferred_name || p.full_name : ''}, ${bkDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}\n` + secs.map((s) => `\n${s.title}\n` + s.items.map((x) => `☐ ${x.t}${prepQty(x)}`).join('\n')).join('\n');
  const html = secs.map((s) => `<b>${h(s.title)}</b><br>` + s.items.map((x) => `☐ ${h(x.t)}${prepQty(x)}${x.why.length && s.k === '' ? ` <i>(${h(x.why.join('; '))})</i>` : ''}`).join('<br>')).join('<br><br>');
  return { text, html, n: secs.reduce((a, s) => a + s.items.length, 0) }; }
const prepText = (sid, date) => prepBuild(sid, date).text || 'Nothing to get ready.';

/* ---------- Settings → Scheduling → 📦 Day prep list ---------- */
function prepCard(ed) { const rec = prepRec(); const by = rec.by || {}; const sv = Bk.cfg('service'); const who = rec.who || {}; const ppl = Bk.people();
  const row = (id, name, isList) => { const L = by[id] || []; const w = who[id]; return `<div class="kv" style="align-items:flex-start"><div class="v" style="flex:1"><b>${h(name)}</b>${isList ? ` <span class="hint">— ${w ? 'for ' + h(w.map((x) => Bk.pname(x)).join(', ')) : 'everyone working that day'}</span>` : ''}${L.length ? `<div class="hint">${L.map((x) => h(prepLine(x))).join('<br>')}</div>` : '<div class="hint">Nothing yet.</div>'}</div>${ed ? `<button class="btn small" data-act="prep-edit" data-id="${id}" data-list="${isList ? 1 : ''}" aria-label="Change ${h(name)}">✏️</button>` : ''}</div>`; };
  return `<div class="card"><h3>📦 Day prep list</h3><div class="hint" style="margin-bottom:6px">Makes the <b>Day prep</b> list for each person's day (Scheduling → Day prep, and on Google Calendar each day). One item per line. Add <b>× 3</b> for how many. Add <b>each</b> to count it for every appointment ("PD certificate × 1 each"), or <b>per head</b> for every head booked ("Rectal gloves × 1 per head"). Otherwise it's needed once that day, whatever the number of jobs.</div>
    <div class="lbl">Checklists (every working day)</div>${PREP_LISTS.map(([id, name]) => row(id, name, true)).join('')}
    <div class="lbl" style="margin-top:8px">What each procedure needs</div>${sv.map((s) => row(s.id, s.name, false)).join('')}</div>`; }
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^prep-/.test(a)) return; const d = el.dataset;
  if (a === 'prep-edit') { if (!Bk.need('settings')) return; const rec = prepRec(); const by = { ...(rec.by || {}) }; const who = { ...(rec.who || {}) }; const lst = PREP_LISTS.find((x) => x[0] === d.id); const name = lst ? lst[1] : Bk.svc(d.id).name;
    const w = who[d.id]; const ppl = Bk.people(); EZ_WHO_LAST = w ? [...w] : ppl.map((p) => p.id);
    const ok = await askBox('📦 ' + name, `<div class="f"><label>${lst ? 'The checklist' : 'Things to get ready'} (one per line)</label><textarea data-ask="t" rows="8" style="width:100%;font-size:16px;padding:9px;border:1px solid var(--line);border-radius:9px">${h((by[d.id] || []).map(prepLine).join('\n'))}</textarea></div><div class="hint">× 3 = how many${lst ? '' : ' · "each" = for every appointment · "per head" = for every head booked'}.</div>
      ${lst ? `<div class="f"><label>Who it's for</label>${ppl.map((p) => `<label class="bk-radio" style="display:flex"><input type="checkbox" class="prep-who" value="${p.id}" ${!w || w.includes(p.id) ? 'checked' : ''}> ${h(p.preferred_name || p.full_name)}</label>`).join('')}</div>` : ''}`, 'Save', false, 'Cancel');
    if (!ok) return; by[d.id] = String(ASK_FORM.t || '').split('\n').map(prepParse).filter(Boolean);
    if (lst) { const sel = (EZ_WHO_LAST || []); const all = ppl.map((p) => p.id); const pick = sel.length ? sel : all; if (pick.length >= all.length) delete who[d.id]; else who[d.id] = pick; }
    let r = Bk.get('prep'); if (!r) { r = { id: 'prep', cfg: 'prep' }; Bk.list('bkcfg').push(r); } r.by = by; r.who = who; touch(r); save(); if (window.Sync) Sync.soon(); if (typeof bkSheetSoon === 'function') bkSheetSoon(); renderAll(); toast('Saved'); }
  if (a === 'prep-copy') { const t = prepText(bkSheetSid(), BK.date || bkToday()); try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (x) { toast("Couldn't copy"); } }
  if (a === 'prep-print') window.print(); });
var EZ_WHO_LAST = null; document.addEventListener('change', (e) => { if (e.target.classList && e.target.classList.contains('prep-who')) EZ_WHO_LAST = [...document.querySelectorAll('#askbox .prep-who:checked')].map((x) => x.value); }, true);
document.addEventListener('change', (e) => { const el = e.target;
  if (el.dataset && el.dataset.act === 'prep-tick') { const sid = bkSheetSid(), date = BK.date || bkToday(); const t = prepTicks(sid, date); if (el.checked) t[el.dataset.k] = 1; else delete t[el.dataset.k]; try { localStorage.setItem(prepTickKey(sid, date), JSON.stringify(t)); } catch (x) { } renderAll(); }
  if (el.id === 'prep-date' && el.value) { BK.date = el.value; renderAll(); } });
window.prepHtml = prepHtml; window.prepCard = prepCard; window.prepBuild = prepBuild;
if (typeof module !== 'undefined') module.exports = { prepParse, prepLine };

/* ---------- 🔔 Reminders for a day — shown on the calendar, the day sheet, Day prep and Google Calendar ("drop the order at Wallacup on the way past") ---------- */
if (typeof BOOK_KINDS !== 'undefined' && !BOOK_KINDS.includes('bkrem')) BOOK_KINDS.push('bkrem'); // synced with everything else
const remList = () => (D && (D.bkrem || (D.bkrem = []))) || [];
const remFor = (date, sid) => remList().filter((r) => !r.gone && r.date === date && (!sid || !(r.staff || []).length || (r.staff || []).includes(sid))).sort((a, b) => (a.at || 0) - (b.at || 0));
const remWho = (r) => ((r.staff || []).length ? r.staff.map((x) => Bk.pname(x)).join(', ') : 'Everyone');
const remText = (r) => r.text + (r.bid && IDX.biz.get(r.bid) ? ' — ' + IDX.biz.get(r.bid).name : '');
const remDone = (r, sid) => !!(r.done && r.done[sid]);
function remBlock(date, sid, opts) { opts = opts || {}; const L = remFor(date, sid);
  return `<div class="card rem-card"><h3><span class="sp">🔔 Reminders</span><button class="btn small" data-act="rem-add" data-d="${date}" data-sid="${sid || ''}">➕ Add a reminder</button></h3>${L.length ? L.map((r) => `<div class="kv" style="align-items:center"><label class="prep-row ${sid && remDone(r, sid) ? 'done' : ''}" style="flex:1;display:flex;align-items:center;cursor:pointer">${sid ? `<input type="checkbox" data-act="rem-tick" data-id="${r.id}" data-sid="${sid}" ${remDone(r, sid) ? 'checked' : ''} style="width:22px;height:22px;margin-right:10px">` : ''}<div class="v"><b>${h(r.text)}</b>${r.bid && IDX.biz.get(r.bid) ? ` <span class="lnk" data-act="open" data-kind="business" data-id="${r.bid}">${h(IDX.biz.get(r.bid).name)}</span>` : ''}<br><span class="hint">${h(remWho(r))}</span></div></label><button class="btn small" data-act="rem-edit" data-id="${r.id}" aria-label="Change this reminder">✏️</button><button class="btn small" data-act="rem-del" data-id="${r.id}" aria-label="Delete this reminder">🗑</button></div>`).join('') : `<div class="hint">${opts.empty || 'None for this day.'}</div>`}</div>`; }
function remStrip(date) { const L = remFor(date); if (!L.length) return `<div class="rem-strip"><button class="btn small" data-act="rem-add" data-d="${date}">🔔 Add a reminder</button></div>`;
  return `<div class="rem-strip">🔔 ${L.map((r) => `<span class="rem-chip" data-act="rem-edit" data-id="${r.id}" title="Tap to change">${(r.staff || []).length ? `<b>${h(remWho(r))}</b>: ` : ''}${h(remText(r))}</span>`).join(' ')} <button class="btn small" data-act="rem-add" data-d="${date}" aria-label="Add a reminder">➕</button></div>`; }
async function remForm(r, preset) { const isNew = !r; r = r || { id: uid('rem'), date: (preset && preset.date) || BK.date || bkToday(), staff: preset && preset.sid ? [preset.sid] : (SBAuth.staff && Bk.person(SBAuth.staff.id) ? [SBAuth.staff.id] : []), text: '', bid: null };
  const ppl = Bk.people(); const bz = r.bid && IDX.biz.get(r.bid);
  const ok = await askBox(isNew ? '🔔 New reminder' : '🔔 Reminder', `<div class="f"><label>Reminder</label><textarea data-ask="t" rows="3" style="width:100%;font-size:16px;padding:9px;border:1px solid var(--line);border-radius:9px">${h(r.text)}</textarea></div>
    <div class="f"><label>Day</label><input type="date" data-ask="d" value="${r.date}" style="width:100%;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px"></div>
    <div class="f"><label>Client (optional)</label><input data-ask="b" list="rem-bl" value="${h(bz ? bz.name : '')}" autocomplete="off" style="width:100%;padding:9px;font-size:16px;border:1px solid var(--line);border-radius:9px"><datalist id="rem-bl">${D.businesses.filter((b) => !b.gone && !INACT.includes(bizCat(b))).map((b) => `<option value="${h(b.name)}">`).join('')}</datalist></div>
    <div class="f"><label>For</label>${ppl.map((p) => `<label class="bk-radio" style="display:flex"><input type="checkbox" class="rem-who" value="${p.id}" ${(r.staff || []).includes(p.id) ? 'checked' : ''}> ${h(p.preferred_name || p.full_name)}</label>`).join('')}<div class="hint">Tick no one for everyone working that day.</div></div>
    <div class="hint">Shows on the calendar, that person's day sheet and Day prep, and their Google Calendar.</div>`, isNew ? 'Add the reminder' : 'Save', false, 'Cancel');
  if (!ok) return; const t = (ASK_FORM.t || '').trim(); if (!t) { toast('Write the reminder'); return; } const bn = (ASK_FORM.b || '').trim(); const b = bn ? D.businesses.find((x) => !x.gone && x.name.toLowerCase() === bn.toLowerCase()) : null;
  Object.assign(r, { text: t, date: ASK_FORM.d || r.date, bid: b ? b.id : null, staff: REM_WHO.slice(), at: r.at || Date.now(), by: r.by || (SBAuth.staff && SBAuth.staff.id) }); if (bn && !b) r.text = t + ' — ' + bn;
  if (isNew) remList().push(r); touch(r); save(); if (window.Sync) Sync.soon(); if (typeof bkSheetSoon === 'function') bkSheetSoon(); renderAll(); toast(isNew ? 'Reminder added' : 'Saved'); }
var REM_WHO = []; document.addEventListener('change', (e) => { if (e.target.classList && e.target.classList.contains('rem-who')) REM_WHO = [...document.querySelectorAll('#askbox .rem-who:checked')].map((x) => x.value); }, true);
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^rem-/.test(a)) return; const d = el.dataset;
  if (a === 'rem-add') { const pre = { date: d.d, sid: d.sid }; REM_WHO = pre.sid ? [pre.sid] : (SBAuth.staff && Bk.person(SBAuth.staff.id) ? [SBAuth.staff.id] : []); await remForm(null, pre); }
  if (a === 'rem-edit') { const r = remList().find((x) => x.id === d.id); if (r) { REM_WHO = [...(r.staff || [])]; await remForm(r); } }
  if (a === 'rem-del') { const r = remList().find((x) => x.id === d.id); if (!r || !(await ask('Delete this reminder?\n\n' + r.text, 'Yes — delete it', true))) return; r.gone = true; touch(r); save(); if (window.Sync) Sync.soon(); if (typeof bkSheetSoon === 'function') bkSheetSoon(); renderAll(); } });
document.addEventListener('change', (e) => { const el = e.target; if (!(el.dataset && el.dataset.act === 'rem-tick')) return; const r = remList().find((x) => x.id === el.dataset.id); if (!r) return; r.done = { ...(r.done || {}) }; if (el.checked) r.done[el.dataset.sid] = Date.now(); else delete r.done[el.dataset.sid]; touch(r); save(); if (window.Sync) Sync.soon(); renderAll(); });
window.remBlock = remBlock; window.remStrip = remStrip; window.remFor = remFor;
