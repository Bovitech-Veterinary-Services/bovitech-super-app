/* Bovitech Super App — Scheduling → 📦 Day prep: everything to get ready for the day's jobs, from what each procedure needs
   (Settings → Scheduling → 📦 Day prep list). "Scanner batteries × 3" once a day; "PD certificate × 1 each" for every
   appointment; "Rectal gloves × 1 per head" for every head booked. */
'use strict';
const PREP_DEF = [[/preg|pd\b|pregnan/i, ['Scanner batteries × 3', 'Lube', 'Exam gloves', 'Rectal gloves']]];
const PREP_ALL = '_all'; // things for every working day
function prepRec() { return Bk.get('prep') || { id: 'prep', cfg: 'prep', by: prepSeed(), _new: true }; }
function prepSeed() { const by = {}; Bk.cfg('service').forEach((s) => { const d = PREP_DEF.find(([rx]) => rx.test(s.name || '')); if (d) by[s.id] = d[1].map(prepParse); }); return by; }
function prepParse(line) { let t = String(line || '').trim(); if (!t) return null; let per = 'day', q = 1;
  if (/\bper head\b/i.test(t)) { per = 'head'; t = t.replace(/\s*\bper head\b/i, ''); } else if (/\beach\b\s*$|\(each( job| appointment)?\)\s*$|\bper (job|appointment)\b/i.test(t)) { per = 'appt'; t = t.replace(/\s*(\(each( job| appointment)?\)|\beach\b|\bper (job|appointment)\b)\s*$/i, ''); }
  const m = /\s*[×x*]\s*(\d+(?:\.\d+)?)\s*$/i.exec(t); if (m) { q = +m[1]; t = t.slice(0, m.index); } return { t: t.trim(), q, per }; }
const prepLine = (x) => `${x.t}${x.q !== 1 || x.per !== 'day' ? ' × ' + x.q : ''}${x.per === 'appt' ? ' each' : x.per === 'head' ? ' per head' : ''}`;
function prepSave(by) { let r = Bk.get('prep'); if (!r) { r = { id: 'prep', cfg: 'prep' }; Bk.list('bkcfg').push(r); } r.by = by; touch(r); save(); if (window.Sync) Sync.soon(); }
function prepFor(sid, date) { // → { items: [{ t, n, why: [...] }], jobs }
  const by = prepRec().by || {}; const L = Bk.bookingsFor(date, sid).filter((b) => b.status !== 'cancelled'); const tot = {}; const day = {};
  const put = (x, n, why, once) => { const k = x.t.toLowerCase(); const o = (tot[k] = tot[k] || { t: x.t, n: 0, why: new Set() }); if (once) { day[k] = Math.max(day[k] || 0, n); } else o.n += n; o.why.add(why); };
  if (L.length || Bk.hours(Bk.person(sid), date)) (by[PREP_ALL] || []).forEach((x) => put(x, x.q, 'every day', true));
  L.forEach((b) => { const nm = (IDX.biz.get(b.bid) || {}).name || 'appointment'; (b.svcs || []).forEach((v) => { if (!v.svc || (v.staff && v.staff.length && !v.staff.includes(sid))) return; const s = Bk.svc(v.svc); (by[v.svc] || []).forEach((x) => {
    if (x.per === 'appt') put(x, x.q, `${s.name} — ${nm}`); else if (x.per === 'head') put(x, x.q * (+v.head || 0), `${s.name} — ${nm}${v.head ? ' (' + v.head + ' head)' : ''}`); else put(x, x.q, s.name, true); }); }); });
  Object.entries(day).forEach(([k, n]) => (tot[k].n += n));
  return { items: Object.values(tot).filter((x) => x.n > 0).map((x) => ({ ...x, why: [...x.why] })).sort((a, b) => a.t.localeCompare(b.t)), jobs: L }; }
const prepTickKey = (sid, date) => 'bvp-prep-' + sid + '-' + date;
const prepTicks = (sid, date) => { try { return JSON.parse(localStorage.getItem(prepTickKey(sid, date)) || '{}'); } catch (e) { return {}; } };
function prepHtml() { const sid = bkSheetSid(); const date = BK.date || bkToday(); const p = Bk.person(sid);
  const pick = `<div class="bk-top bk-noprint"><div class="bk-nav"><button class="btn small" data-act="bks-go" data-v="-1" aria-label="Back a day">‹</button><button class="btn small" data-act="bk-today">Today</button><button class="btn small" data-act="bks-go" data-v="1" aria-label="Forward a day">›</button><input type="date" id="prep-date" value="${date}" aria-label="Day"></div>
    <select id="bks-who" aria-label="Whose day">${Bk.people().map((s) => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${h(s.preferred_name || s.full_name)}</option>`).join('')}</select>
    <div class="bk-nav"><button class="btn small" data-act="prep-print">🖨 Print</button><button class="btn small" data-act="prep-copy">📋 Copy as text</button></div></div>`;
  if (!p) return `<div class="d-wrap bk-wrap">${pick}<div class="card"><div class="hint">The staff list loads the first time you sign in with internet.</div></div></div>`;
  const { items, jobs } = prepFor(sid, date); const tk = prepTicks(sid, date); const done = items.filter((x) => tk[x.t.toLowerCase()]).length;
  return `<div class="d-wrap bk-wrap">${pick}<h2 class="sec-h" style="font-size:24px">📦 Day prep — ${h(p.preferred_name || p.full_name)}, ${bkDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
    <div class="hint" style="margin-bottom:6px">Everything to get ready for ${jobs.length} appointment${jobs.length === 1 ? '' : 's'}. Change what each procedure needs in Settings → Scheduling → 📦 Day prep list.${items.length ? ` <b>${done} of ${items.length} ready.</b>` : ''}</div>
    <div class="card">${items.length ? items.map((x) => `<label class="kv prep-row ${tk[x.t.toLowerCase()] ? 'done' : ''}" style="align-items:center;cursor:pointer"><input type="checkbox" data-act="prep-tick" data-k="${h(x.t.toLowerCase())}" ${tk[x.t.toLowerCase()] ? 'checked' : ''} style="width:22px;height:22px;margin-right:10px"><div class="v"><b>${h(x.t)}</b>${x.n !== 1 ? ` × ${+x.n.toFixed(2)}` : ''}<br><span class="hint">${h(x.why.join(' · '))}</span></div></label>`).join('')
      : `<div class="hint">${jobs.length ? 'Nothing listed for these procedures yet — add what each one needs in Settings → Scheduling → 📦 Day prep list.' : 'No appointments this day.'}</div>`}</div>
    ${jobs.length ? `<div class="card"><h3>The day's appointments</h3>${jobs.map((b) => `<div class="kv"><div class="k">${b.start ? bkTime(b.start) : ''}</div><div class="v">${h((IDX.biz.get(b.bid) || {}).name || '')} <span class="hint">${h((b.svcs || []).map((v) => Bk.svc(v.svc).name + (v.head ? ' ' + v.head + ' head' : '')).join(', '))}</span></div></div>`).join('')}</div>` : ''}</div>`; }
function prepText(sid, date) { const p = Bk.person(sid); const { items } = prepFor(sid, date); return `Day prep — ${p ? p.preferred_name || p.full_name : ''}, ${bkDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}\n` + (items.map((x) => `☐ ${x.t}${x.n !== 1 ? ' × ' + +x.n.toFixed(2) : ''}`).join('\n') || 'Nothing to get ready.'); }

/* ---------- Settings → Scheduling → 📦 Day prep list ---------- */
function prepCard(ed) { const by = prepRec().by || {}; const sv = Bk.cfg('service');
  return `<div class="card"><h3>📦 Day prep list</h3><div class="hint" style="margin-bottom:6px">What to get ready for each procedure — it makes the <b>Day prep</b> list (Scheduling → Day prep) for each person's day. One item per line. Add <b>× 3</b> for how many. Add <b>each</b> to count it for every appointment ("PD certificate × 1 each"), or <b>per head</b> for every head booked ("Rectal gloves × 1 per head"). Otherwise it's needed once that day, whatever the number of jobs.</div>
    ${[{ id: PREP_ALL, name: 'Every working day' }, ...sv].map((s) => { const L = by[s.id] || []; return `<div class="kv" style="align-items:flex-start"><div class="v" style="flex:1"><b>${h(s.name)}</b>${L.length ? `<div class="hint">${L.map((x) => h(prepLine(x))).join('<br>')}</div>` : '<div class="hint">Nothing yet.</div>'}</div>${ed ? `<button class="btn small" data-act="prep-edit" data-id="${s.id}" aria-label="Change what ${h(s.name)} needs">✏️</button>` : ''}</div>`; }).join('')}</div>`; }
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^prep-/.test(a)) return; const d = el.dataset;
  if (a === 'prep-edit') { if (!Bk.need('settings')) return; const rec = prepRec(); const by = { ...(rec.by || {}) }; const s = d.id === PREP_ALL ? { name: 'Every working day' } : Bk.svc(d.id);
    const ok = await askBox('📦 ' + s.name, `<div class="f"><label>Things to get ready (one per line)</label><textarea data-ask="t" rows="8" style="width:100%;font-size:16px;padding:9px;border:1px solid var(--line);border-radius:9px">${h((by[d.id] || []).map(prepLine).join('\n'))}</textarea></div><div class="hint">× 3 = how many · "each" = for every appointment · "per head" = for every head booked.</div>`, 'Save'); if (!ok) return;
    by[d.id] = String(ASK_FORM.t || '').split('\n').map(prepParse).filter(Boolean); prepSave(by); renderAll(); toast('Saved'); }
  if (a === 'prep-copy') { const t = prepText(bkSheetSid(), BK.date || bkToday()); try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (x) { toast("Couldn't copy"); } }
  if (a === 'prep-print') window.print(); });
document.addEventListener('change', (e) => { const el = e.target;
  if (el.dataset && el.dataset.act === 'prep-tick') { const sid = bkSheetSid(), date = BK.date || bkToday(); const t = prepTicks(sid, date); if (el.checked) t[el.dataset.k] = 1; else delete t[el.dataset.k]; try { localStorage.setItem(prepTickKey(sid, date), JSON.stringify(t)); } catch (x) { } renderAll(); }
  if (el.id === 'prep-date' && el.value) { BK.date = el.value; renderAll(); } });
window.prepHtml = prepHtml; window.prepCard = prepCard;
if (typeof module !== 'undefined') module.exports = { prepParse, prepLine };
