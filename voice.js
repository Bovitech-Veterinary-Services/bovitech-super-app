/* Bovitech Super App — 🎤 voice commands. Tap 🎤 (or turn on hands-free in Settings → 🎤 Voice commands) and say
   "call Cody Shilling", "text Cody running 20 minutes late", "navigate to Wallacup", "open Many Peaks", "new record for Wallacup",
   "book Wallacup next Tuesday", "who's on call Saturday", "what's on tomorrow", "search records for foetal ageing".
   Works while the app is open on screen (phones don't let any app but their own assistant listen all the time). */
'use strict';
const VC = { rec: null, on: false, keep: false, last: '' };
// her name: "Shazza" (change it in Settings → 🎤 Voice commands). Speech-to-text spells it a few ways, so those count too.
const vcName = () => ((typeof D !== 'undefined' && D && D.settings && D.settings.voiceName) || 'Shazza').trim();
const VC_SOUNDS = { shazza: ['shazza', 'shaza', 'shazzer', 'shazzah', 'sharza', 'shazar', 'chazza', 'shasa', 'shasta', 'shazam', 'sha za', 'shah za'] };
Object.defineProperty(VC, 'wake', { get() { const n = vcName().toLowerCase(); const alts = [...new Set([n, ...(VC_SOUNDS[n] || []), 'super app', 'superapp'])].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')); return new RegExp('^(?:(?:hey|hi|ok|okay|oi)[,\\s]+)?(?:' + alts.join('|') + ')[,.!\\s]*(?:please[,\\s]+)?', 'i'); } });
const VC_SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const VC_BUILT = [
  ['call', 'Call Cody Shilling', 'Rings their mobile (or the business phone). Asks which number if there are several, and warns first if they have a warning or are Do not answer.'],
  ['text', 'Text Cody Shilling running 20 minutes late', 'Opens a text to them with the words after their name already written.'],
  ['nav', 'Navigate to Wallacup Farms', 'Opens Google Maps directions to their farm (to the turn-off pin when there is one). Asks which farm if there are several.'],
  ['open', 'Open Wallacup Farms', 'Opens the business or person. "Open the Wallacup herd" opens the patient.'],
  ['rec', 'New record for Wallacup Farms', 'Starts a clinical record for them, to check and fill in.'],
  ['book', 'Book Wallacup Farms next Tuesday', 'Opens a new appointment for them on that day (today, tomorrow, Tuesday, next Tuesday, the 12th, 12 November).'],
  ['oncall', 'Who\'s on call Saturday', 'Says who is on call that day (today if no day is said).'],
  ['day', 'What\'s on tomorrow', 'Says how many appointments there are that day and the first few.'],
  ['search', 'Search records for foetal ageing', 'Opens Records → Search with those words.'],
  ['go', 'Go to the calendar', 'Opens a tab: calendar, day sheet, jobs, records, invoices, patients, settings.'],
  ['hf', 'Hands free', 'On an open record: reads out each question and fills in what you say (or tap 🎧 Hands-free at the top of the record).'],
  ['help', 'What can I say', 'Shows this list.'],
];
const vcPref = (k) => !!(typeof PREF !== 'undefined' && PREF[k]);
/* v2.39: her voice (this device) — the phone or computer's own voices; Australian ones listed first. Saved per device because each
   device has different voices. */
const VC_VKEY = 'bvp-voice';
const vcVoicePref = () => { try { return JSON.parse(localStorage.getItem(VC_VKEY) || '{}') || {}; } catch (e) { return {}; } };
const vcVoices = () => { try { const L = (window.speechSynthesis && speechSynthesis.getVoices()) || []; const rk = (v) => (/en[-_]AU/i.test(v.lang) ? 0 : /^en/i.test(v.lang) ? 1 : 2); return L.filter((v) => rk(v) < 2).sort((a, b) => rk(a) - rk(b) || a.name.localeCompare(b.name)); } catch (e) { return []; } };
function vcUtt(t) { const u = new SpeechSynthesisUtterance(t); const p = vcVoicePref(); const V = vcVoices(); const v = (p.name && V.find((x) => x.name === p.name)) || V.find((x) => /en[-_]AU/i.test(x.lang)) || null;
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-AU'; u.rate = +p.rate || 1.05; u.pitch = +p.pitch || 1; return u; }
try { if (window.speechSynthesis) speechSynthesis.addEventListener('voiceschanged', () => { if (document.getElementById('vc-voice') && typeof renderAll === 'function') renderAll(); }); } catch (e) { }
const vcSay = (t) => { try { if (!window.speechSynthesis) return; speechSynthesis.cancel(); speechSynthesis.speak(vcUtt(t)); } catch (e) { } };
const vcN = (s) => (s || '').toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- the little listening panel ---------- */
function vcBox(html, keepOpen) { let el = document.getElementById('vcbox'); if (!el) { el = document.createElement('div'); el.id = 'vcbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  el.innerHTML = `<div class="vc-in">${html}<div class="actions" style="margin-top:8px"><button class="btn small" data-act="vc-close">Close</button>${VC_SR ? '<button class="btn small primary" data-act="vc-again">🎤 Again</button>' : ''}</div></div>`; el.hidden = false;
  clearTimeout(VC._hide); if (!keepOpen) VC._hide = setTimeout(() => { if (!VC.on) el.hidden = true; }, 12000); }
const vcClose = () => { const el = document.getElementById('vcbox'); if (el) el.hidden = true; };

/* ---------- listening ---------- */
function vcListen(opts) { opts = opts || {}; if (!VC_SR) { vcBox('<b>Voice commands need Chrome</b><p class="hint">This browser can\'t turn speech into words. Use the app in Chrome (Android or computer).</p>', true); return; }
  try { if (VC.rec) VC.rec.abort(); } catch (e) { }
  const r = new VC_SR(); VC.rec = r; r.lang = 'en-AU'; r.interimResults = true; r.maxAlternatives = 3; r.continuous = !!opts.keep;
  VC.on = true; VC.keep = !!opts.keep; if (!opts.quiet) vcBox(`<div class="vc-mic">🎤</div><b>${opts.keep ? `Listening — say "${h(vcName())}" then the command` : 'Listening…'}</b><div class="vc-heard hint" id="vc-heard">${opts.keep ? '' : 'Say a command, like "call Cody Shilling"'}</div>`, true);
  r.onresult = (ev) => { let fin = '', tmp = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) { const x = ev.results[i]; if (x.isFinal) fin += x[0].transcript; else tmp += x[0].transcript; }
    const hd = document.getElementById('vc-heard'); if (hd && (tmp || fin) && (!VC.keep || VC.wake.test((tmp || fin).trim()))) hd.textContent = '“' + (fin || tmp) + '”';
    if (fin) { let t = fin.trim(); if (VC.keep) { if (!VC.wake.test(t)) return; t = t.replace(VC.wake, ''); if (!t) { vcBox('<div class="vc-mic">🎤</div><b>Yes?</b>', true); return; } } VC.last = t; vcDo(t, [...ev.results[ev.results.length - 1]].map((a) => a.transcript)); } };
  r.onerror = (ev) => { if (ev.error === 'no-speech' || ev.error === 'aborted') return; VC.on = false; vcBox(ev.error === 'not-allowed' ? '<b>The microphone is blocked</b><p class="hint">Allow the microphone for the app (tap the 🔒 or ⓘ next to the web address → Permissions → Microphone), then try again.</p>' : `<b>Didn't catch that</b><p class="hint">${h(ev.error)}</p>`, true); };
  r.onend = () => { if (VC.keep && document.visibilityState === 'visible' && vcPref('voiceKeep')) { setTimeout(() => { if (VC.keep) vcListen({ keep: true, quiet: true }); }, 400); return; } VC.on = false; const hd = document.getElementById('vc-heard'); if (hd && /^Say a command/.test(hd.textContent)) { const n = (opts.tries || 0) + 1; if (n < 3) { setTimeout(() => vcListen({ ...opts, tries: n }), 250); return; } vcBox('<b>Nothing heard</b><p class="hint">Tap 🎤 Again and say a command.</p>'); } };
  try { r.start(); } catch (e) { VC.on = false; } }
function vcStop() { VC.keep = false; VC.on = false; try { VC.rec && VC.rec.abort(); } catch (e) { } }

/* ---------- finding who or what was said ---------- */
function vcFind(said, want) { // → [{ kind: 'contact'|'business'|'patient', rec, b, score, name }]
  const q = vcN(said).replace(/^(the|a|an)\s+/, ''); if (!q) return []; const qw = q.split(' ');
  const score = (name) => { const n = vcN(name); if (!n) return 0; if (n === q) return 100; const nw = n.split(' '); const hit = qw.filter((w) => nw.some((x) => x === w || (w.length > 3 && x.startsWith(w)))).length; if (!hit) return 0; const all = hit === qw.length; return (all ? 60 : 25 * hit / qw.length) + (n.startsWith(q) ? 15 : 0) - Math.abs(nw.length - qw.length) * 2; };
  const out = [];
  if (want !== 'patient') { D.contacts.forEach((c) => { if (c.gone) return; const s = Math.max(score(fullName(c)), score(showName(c)), c.first && c.last ? score((prefName(c) || c.first) + ' ' + c.last) : 0); if (s >= 40) out.push({ kind: 'contact', rec: c, score: s + (INACT.includes(catOf(c)) ? -15 : 0), name: showName(c) }); });
    D.businesses.forEach((b) => { if (b.gone) return; const s = Math.max(score(b.name), b.abbr ? score(b.abbr) : 0); if (s >= 40) out.push({ kind: 'business', rec: b, score: s + (INACT.includes(bizCat(b)) ? -15 : 0), name: b.name }); }); }
  if (want === 'patient' || /\b(herd|flock|patient)\b/.test(q)) { const qq = q.replace(/\b(herd|flock|patient|cattle|sheep)\b/g, '').trim(); if (typeof ptAll === 'function') ptAll().forEach((p) => { const s = Math.max(score(p.b.name), score(p.value), qq ? (vcN(p.b.name).includes(vcN(qq)) ? 70 : 0) : 0); if (s >= 40) out.push({ kind: 'patient', rec: p, score: s + 5, name: p.b.name + ' — ' + p.value + (p.label ? ' ' + p.label : '') }); }); }
  return out.sort((a, b) => b.score - a.score).slice(0, 6); }
function vcFindBest(said, want) { const w = vcN(said).split(' '); for (let n = w.length; n >= 1; n--) { const L = vcFind(w.slice(0, n).join(' '), want); if (L.length && L[0].score >= (n === w.length ? 40 : 60)) return L; } return []; } // "Wallacup preg testing" → Wallacup
async function vcPick(list, what) { if (!list.length) return null; if (list.length === 1 || list[0].score - list[1].score >= 25) return list[0];
  vcSay('Which one?'); return new Promise((res) => { VC._pick = res; vcBox(`<b>Which ${h(what || 'one')}?</b>${list.map((x, i) => `<button class="btn" style="display:block;width:100%;margin-top:6px;text-align:left" data-act="vc-pick" data-i="${i}">${x.kind === 'business' ? '🏢' : x.kind === 'patient' ? '🐄' : '👤'} ${h(x.name)}</button>`).join('')}`, true); VC._list = list; }); }
function vcPhones(x) { const out = []; const add = (v, l) => { if (v && !out.some((o) => o.v.replace(/\D/g, '') === v.replace(/\D/g, ''))) out.push({ v, l }); };
  if (x.kind === 'contact') { const c = x.rec; (c.mobiles || []).forEach((p) => add(p.value, (p.label || 'mobile'))); (c.landlines || []).forEach((p) => add(p.value, (p.label || 'landline'))); bizOf(c).forEach((b) => (b.phones || []).forEach((p) => add(p.value, b.name))); }
  else { const b = x.kind === 'patient' ? x.rec.b : x.rec; (b.phones || []).forEach((p) => add(p.value, p.label || 'business')); (IDX.bizContacts.get(b.id) || []).filter((c) => !INACT.includes(catOf(c))).forEach((c) => (c.mobiles || []).forEach((p) => add(p.value, fullName(c)))); }
  return out; }
const vcBizOf = (x) => (x.kind === 'business' ? x.rec : x.kind === 'patient' ? x.rec.b : bizOf(x.rec)[0] || null);
function vcWarn(x) { const r = x.rec; const b = vcBizOf(x); const cat = x.kind === 'contact' ? catOf(r) : b ? bizCat(b) : ''; const w = [(r.warnings || '').trim(), b && b !== r ? (b.warnings || '').trim() : ''].filter(Boolean).join(' — ');
  return cat === 'dna' ? '☠️ Do not answer' + (w ? ' — ' + w : '') : w; }

/* ---------- days: today, tomorrow, Tuesday, next Tuesday, the 12th, 12 November ---------- */
function vcDate(t) { const today = bkToday(); const s = vcN(t); if (/\btoday\b/.test(s) || !s) return today; if (/\btomorrow\b/.test(s)) return bkAdd(today, 1); if (/\byesterday\b/.test(s)) return bkAdd(today, -1);
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']; const di = DAYS.findIndex((d) => new RegExp('\\b' + d.slice(0, 3) + '(' + d.slice(3) + ')?\\b').test(s));
  if (di >= 0) { let d = bkAdd(today, 1); while (new Date(d + 'T12:00:00').getDay() !== di) d = bkAdd(d, 1); if (/\bweek\b/.test(s)) d = bkAdd(d, 7); return d; } // "Tuesday" / "next Tuesday" = the coming Tuesday; "Tuesday week" = the one after
  const M = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']; const m = /\b(\d{1,2})(st|nd|rd|th)?\b(?:\s+(?:of\s+)?([a-z]{3})[a-z]*)?/.exec(s);
  if (m) { const day = +m[1]; let mon = m[3] ? M.indexOf(m[3]) : -1; const t0 = new Date(today + 'T12:00:00'); let y = t0.getFullYear(); if (mon < 0) { mon = t0.getMonth(); if (day < t0.getDate()) mon++; } if (mon > 11) { mon = 0; y++; } let d = `${y}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; if (d < today) d = `${y + 1}${d.slice(4)}`; return d; }
  return null; }
const vcSplitWhen = (t) => { const m = /\b(today|tomorrow|yesterday|(?:next\s+)?(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday)?(?:\s+week)?|(?:on\s+)?the\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+of\s+[a-z]+)?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b.*$/i.exec(t); return m ? { who: t.slice(0, m.index).replace(/\b(on|for)\s*$/i, '').trim(), when: m[0] } : { who: t.trim(), when: '' }; };

/* ---------- doing it ---------- */
function vcAlias(t) { const L = ((D && D.settings && D.settings.voiceAlias) || []); const n = vcN(t); const a = L.find((x) => x.say && vcN(x.say) === n) || L.find((x) => x.say && n.startsWith(vcN(x.say) + ' ')); if (!a) return t; return a.cmd + t.slice(a.say.length).replace(/^\s*/, ' ').replace(/\s+$/, ''); }
async function vcDo(said, alts) { let t = vcAlias(said.trim().replace(VC.wake, '').replace(/^please[,\s]+/i, '').trim() || said.trim()); const s = vcN(t); const say = (m) => { vcSay(m); };
  const shown = (msg) => vcBox(`<div class="hint">“${h(said)}”</div><b>${msg}</b>`);
  let m;
  if (/^(what can i say|help|commands)/.test(s)) { vcHelp(); return; }
  if (/^(hands ?free|fill in (the |this )?record|start (the )?record questions|ask (me )?the questions)/.test(s)) { const r = typeof CR !== 'undefined' && S.tab === 'rec' && CR.page === 'edit' ? crGet('crrec', CR.id) : null; if (!r) { vcSay('Open the record first'); return vcBox('<b>Open the record first</b><p class="hint">Then say "hands free", or tap 🎧 Hands-free at the top of the record.</p>'); } vcClose(); hfStart(r); return; }
  if ((m = /^(?:call|ring|phone|dial)\s+(.+)$/i.exec(t))) { const x = await vcPick(vcFindBest(m[1]), 'person'); if (!x) return vcNope(said, m[1]); const ph = vcPhones(x); if (!ph.length) { say('No phone number for ' + x.name); return shown(`No phone number for ${h(x.name)}`); }
    const w = vcWarn(x); let p = ph[0]; if (ph.length > 1) { const i = await vcChoose(`Call ${x.name} on which number?`, ph.map((o) => `${o.v} (${o.l})`)); if (i == null) return; p = ph[i]; }
    if (w && !(await ask(`⚠ ${x.name}: ${w}\n\nCall anyway?`, '📞 Call'))) return; vcClose(); location.href = 'tel:' + p.v.replace(/[^\d+]/g, ''); return; }
  if ((m = /^(?:text|message|sms)\s+(.+)$/i.exec(t))) { const words = m[1]; let best = null; const parts = words.split(' ');
    for (let n = Math.min(4, parts.length); n >= 1; n--) { const L = vcFind(parts.slice(0, n).join(' ')); if (L.length && L[0].score >= 60) { best = { L, rest: parts.slice(n).join(' ').replace(/^(saying|that|to say)\s+/i, '') }; break; } }
    if (!best) return vcNope(said, words); const x = await vcPick(best.L, 'person'); if (!x) return; const ph = vcPhones(x).filter((o) => /^(\+?61|0)4/.test(o.v.replace(/[^\d+]/g, '')) || /mobile/i.test(o.l)); if (!ph.length) { say('No mobile for ' + x.name); return shown(`No mobile for ${h(x.name)}`); }
    let p = ph[0]; if (ph.length > 1) { const i = await vcChoose(`Text ${x.name} on which number?`, ph.map((o) => `${o.v} (${o.l})`)); if (i == null) return; p = ph[i]; }
    const msg = best.rest ? best.rest.charAt(0).toUpperCase() + best.rest.slice(1) : ''; vcClose(); location.href = 'sms:' + p.v.replace(/[^\d+]/g, '') + (msg ? '?body=' + encodeURIComponent(msg) : ''); return; }
  if ((m = /^(?:navigate|directions|drive|take me|get me|go)\s+(?:to\s+)?(?:the\s+)?(.+)$/i.exec(t)) && !/^(?:go\s+to\s+)?(?:the\s+)?(calendar|day sheet|jobs|records|invoices|patients|settings|contacts|people|businesses|price list|search|scheduling)\b/i.test(s)) {
    const x = await vcPick(vcFindBest(m[1].replace(/\s+(farm|yards|place)$/i, '')), 'farm'); if (!x) return vcNope(said, m[1]); const b = vcBizOf(x); const farms = b ? (b.farms || []).filter((f) => f.lat != null) : [];
    if (!farms.length) { say('No farm pin for ' + x.name); return shown(`No farm pin for ${h(x.name)}`); } let f = farms[0]; if (farms.length > 1) { const i = await vcChoose('Which farm?', farms.map((ff) => ff.name || 'Farm')); if (i == null) return; f = farms[i]; }
    const p = farmRoutePt(f); vcClose(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`, '_blank'); return; }
  if ((m = /^(?:new|start|add)\s+(?:a\s+)?(?:clinical\s+)?record\s+(?:for\s+)?(.+)$/i.exec(t))) { if (typeof crNewRec !== 'function') return shown('Turn on the Records tab first (Settings → Clinical records)'); const x = await vcPick(vcFindBest(m[1]), 'client'); if (!x) return vcNope(said, m[1]); const b = vcBizOf(x); if (!b) return shown('They have no business to put the record on');
    savePref('showRec', true); const r = crNewRec({ bid: b.id }); touch(r); D.crrec.push(r); crInvSync(r); save(); vcClose(); crOpen(r.id); say('New record for ' + b.name); return; }
  if ((m = /^(?:book|make an appointment for|new appointment for|schedule)\s+(.+)$/i.exec(t))) { if (typeof bkOpen !== 'function') return shown('Turn on Scheduling first'); const sp = vcSplitWhen(m[1]); const x = await vcPick(vcFindBest(sp.who), 'client'); if (!x) return vcNope(said, sp.who); const b = vcBizOf(x); const d = sp.when ? vcDate(sp.when) : null;
    vcClose(); S.tab = 'book'; if (d) BK.date = d; renderAll(); bkOpen(null, { bid: b ? b.id : null, cid: x.kind === 'contact' ? x.rec.id : null, date: d || BK.date || bkToday() }); say('Booking ' + (b ? b.name : x.name) + (d ? ' on ' + bkDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) : '')); return; }
  if (/^(?:whos|who is|who s)\s+on\s*call/.test(s)) { const d = vcDate(s.replace(/^.*on\s*call\s*/, '')) || bkToday(); const w = typeof bkOncallWho === 'function' ? bkOncallWho(d) : null; const txt = w ? `${Bk.pname(w)} is on call ${d === bkToday() ? 'today' : bkDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}` : `No one is on call ${bkDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}`; say(txt); return shown(h(txt)); }
  if (/^(?:whats|what is|what s)\s+on|^my day|^whats my day/.test(s)) { const d = vcDate(s.replace(/^(?:whats|what is|what s)\s+on\s*/, '')) || bkToday(); const L = Bk.list('bookings').filter((x) => Bk.live(x) && x.date === d).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const me = SBAuth.staff && SBAuth.staff.id; const mine = me ? L.filter((x) => (x.staff || []).includes(me)) : []; const use = mine.length ? mine : L; const nm = (x) => (IDX.biz.get(x.bid) || {}).name || 'appointment';
    const txt = use.length ? `${use.length} ${mine.length ? 'for you' : ''} ${d === bkToday() ? 'today' : bkDate(d, { weekday: 'long' })}: ` + use.slice(0, 4).map((x) => `${x.start ? bkTime(x.start) : ''} ${nm(x)}`).join(', ') : `Nothing booked ${d === bkToday() ? 'today' : bkDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}`; say(txt.replace(/\s+/g, ' ')); return shown(h(txt)); }
  if ((m = /^(?:search|find|look up)\s+(?:the\s+)?(?:clinical\s+)?(?:records?|notes|history)\s+(?:for\s+)?(.+)$/i.exec(t))) { if (typeof ezySearchHtml !== 'function') return; savePref('showRec', true); vcClose(); S.tab = 'rec'; CR.page = 'search'; EZ.q = m[1]; renderAll(); ezSearch({ q: m[1], scope: 'all' }); return; }
  if ((m = /^(?:go to|open|show)\s+(?:the\s+)?(calendar|day sheet|jobs|records|invoices|patients|settings|contacts|people|businesses|price list|search|scheduling)\b/i.exec(t))) { const k = m[1].toLowerCase(); vcClose();
    if (/calendar|scheduling/.test(k)) { S.tab = 'book'; BK.page = 'cal'; } else if (k === 'day sheet') { S.tab = 'book'; BK.page = 'sheet'; } else if (k === 'jobs') S.tab = 'jobs'; else if (k === 'records') { S.tab = 'rec'; CR.page = 'recs'; } else if (k === 'invoices') { S.tab = 'rec'; CR.page = 'invs'; } else if (k === 'price list') { S.tab = 'rec'; CR.page = 'prods'; } else if (k === 'search') { S.tab = 'rec'; CR.page = 'search'; } else if (k === 'patients') S.tab = 'pat'; else if (k === 'settings') S.tab = 'settings'; else if (k === 'businesses') S.tab = 'biz'; else S.tab = 'contacts';
    S.sel = null; renderAll(); return; }
  if ((m = /^(?:open|show|find|look up|go to)\s+(.+)$/i.exec(t))) { const x = await vcPick(vcFindBest(m[1]), 'one'); if (!x) return vcNope(said, m[1]); vcClose();
    if (x.kind === 'patient') { PT.sel = x.rec.key; S.tab = 'pat'; S.sel = null; renderAll(); return; } S.tab = x.kind === 'business' ? 'biz' : 'contacts'; S.sel = { kind: x.kind, id: x.rec.id }; renderAll(); return; }
  // just a name: open it
  const L = vcFind(t); if (L.length && L[0].score >= 60) { const x = await vcPick(L); if (x) { vcClose(); S.tab = x.kind === 'business' ? 'biz' : x.kind === 'patient' ? 'pat' : 'contacts'; if (x.kind === 'patient') PT.sel = x.rec.key; else S.sel = { kind: x.kind, id: x.rec.id }; renderAll(); } return; }
  vcSay("Sorry, I didn't understand"); vcBox(`<div class="hint">“${h(said)}”</div><b>Sorry — I didn't understand that.</b><p class="hint">Try "call …", "text …", "navigate to …", "open …", "new record for …", "book … on Tuesday", "who's on call", "what's on tomorrow". <span class="lnk" data-act="vc-help">All commands</span></p>`, true); }
function vcNope(said, who) { vcSay("I couldn't find " + who); vcBox(`<div class="hint">“${h(said)}”</div><b>Couldn't find “${h(who)}”.</b><p class="hint">Say the name the way it's saved in the app (or add a shortcut in Settings → 🎤 Voice commands).</p>`, true); }
function vcChoose(title, opts) { return new Promise((res) => { VC._pick = (x) => res(x == null ? null : x); VC._list = opts.map((o, i) => i); vcBox(`<b>${h(title)}</b>${opts.map((o, i) => `<button class="btn" style="display:block;width:100%;margin-top:6px;text-align:left" data-act="vc-pick" data-i="${i}">${h(o)}</button>`).join('')}`, true); }); }
function vcHelp() { vcBox(`<b>🎤 Things you can say</b>${VC_BUILT.map(([, ex, what]) => `<div style="margin-top:6px"><b>“${h(ex)}”</b><br><span class="hint">${h(what)}</span></div>`).join('')}${((D.settings || {}).voiceAlias || []).length ? `<div class="lbl" style="margin-top:8px">Your shortcuts</div>${D.settings.voiceAlias.map((a) => `<div>“${h(a.say)}” → ${h(a.cmd)}</div>`).join('')}` : ''}`, true); }

/* ---------- Settings → 🎤 Voice commands ---------- */
function vcVoiceHtml() { const p = vcVoicePref(); const V = vcVoices();
  return `<div class="lbl" style="margin-top:10px">🗣️ Her voice <span class="hint">(this device)</span></div><div class="hint">The voices are the ones this phone or computer has — Australian ones are listed first. Each device can choose its own.</div>
    <div class="f"><label for="vc-voice">Voice</label><select id="vc-voice"><option value="">${V.length ? 'Standard Australian voice' : 'Standard voice'}</option>${V.map((v) => `<option value="${h(v.name)}" ${v.name === p.name ? 'selected' : ''}>${h(v.name)} (${h(v.lang)})</option>`).join('')}</select></div>
    <div class="grid2"><div class="f"><label for="vc-rate">Speed</label><input id="vc-rate" type="range" min="0.6" max="1.6" step="0.05" value="${+p.rate || 1.05}"></div><div class="f"><label for="vc-pitch">Pitch (lower or higher)</label><input id="vc-pitch" type="range" min="0.5" max="1.6" step="0.05" value="${+p.pitch || 1}"></div></div>
    <div class="actions"><button class="btn small" data-act="vc-vtest">▶ Hear it</button><button class="btn small primary" data-act="vc-vsave">Save</button><button class="btn small" data-act="vc-vreset">↺ Standard</button></div>`; }
function voiceCard() { const st = D.settings || {}; const al = st.voiceAlias || []; const ideas = vcIdeas();
  return `<div class="card"><h3>🎤 Voice commands</h3><div class="hint" style="margin-bottom:6px">Tap <b>🎤</b> at the top of the app and say a command. Phones only let their own assistant listen all the time, so "Hey Google, open Bovitech Super App" opens the app — with <b>Hands-free</b> on, it then starts listening straight away.</div>
    <div class="f"><label for="vc-name">Her name (say it first: "${h(vcName())}, call Cody Shilling")</label><div class="cr-row"><input id="vc-name" value="${h(vcName())}" style="flex:1"><button class="btn small" data-act="vc-name">Save</button></div></div>
    <label class="bk-radio" style="display:flex"><input type="checkbox" data-act="vc-auto" ${vcPref('voiceAuto') ? 'checked' : ''}> <span><b>Hands-free</b> (this device): start listening when the app opens or comes back on screen</span></label>
    <label class="bk-radio" style="display:flex"><input type="checkbox" data-act="vc-keep" ${vcPref('voiceKeep') ? 'checked' : ''}> <span><b>Keep listening</b> (this device) while the app is on screen — say <b>"${h(vcName())}"</b> first, then the command (uses more battery; some phones beep each time it starts listening again)</span></label>
    ${vcVoiceHtml()}
    <div class="lbl" style="margin-top:10px">What you can say</div>${VC_BUILT.map(([, ex, what]) => `<div class="kv"><div class="k">“${h(ex)}”</div><div class="v hint">${h(what)}</div></div>`).join('')}
    <div class="lbl" style="margin-top:10px">Your shortcuts <span class="hint">(for everyone)</span></div><div class="hint">Words you say → the command they mean. For example "ring the office" → "call Bovitech office", or "Cody" → "call Cody Shilling".</div>
    ${al.map((a, i) => `<div class="kv" style="align-items:center"><div class="v">“${h(a.say)}” → <b>${h(a.cmd)}</b></div><button class="btn small" data-act="vc-aldel" data-i="${i}" aria-label="Delete this shortcut">🗑️</button></div>`).join('') || '<div class="hint">None yet.</div>'}
    <div class="actions"><button class="btn small" data-act="vc-aladd">➕ Add a shortcut</button></div>
    <div class="lbl" style="margin-top:10px">Commands we'd like added later</div><div class="hint">Write down anything you find yourselves wanting to say on farm — send this list to Claude to build them.</div>
    ${ideas.map((x, i) => `<div class="kv" style="align-items:center"><div class="v">“${h(x.t)}”${x.by ? ` <span class="hint">— ${h(x.by)}</span>` : ''}</div><button class="btn small" data-act="vc-ideadel" data-i="${i}" aria-label="Delete">🗑️</button></div>`).join('') || '<div class="hint">None yet.</div>'}
    <div class="actions"><button class="btn small" data-act="vc-ideaadd">➕ Add a command idea</button>${ideas.length ? '<button class="btn small" data-act="vc-ideacopy">📋 Copy the list for Claude</button>' : ''}</div></div>`; }
const vcIdeas = () => (D.settings.voiceIdeas || VC_IDEAS_START.map((t) => ({ t }))); // starts with the common ones, to add later
const VC_IDEAS_START = ['Read me the warnings for Wallacup', 'Add a note to Wallacup: gate code changed', 'Start PD for Wallacup — 40 head', 'Record 5 mL Excede for cow 123', 'Add 50 head preg tested, 3 empty', 'Mark this appointment done', 'Running late for my next appointment — text them 20 minutes', 'Who is my next appointment', "What's the withholding period for Excede", "How far is it to my next farm"];

/* ---------- events ---------- */
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^vc-/.test(a)) return; const d = el.dataset; const st = D.settings;
  if (a === 'vc-mic' || a === 'vc-again') { vcStop(); vcListen(); }
  if (a === 'vc-vtest' || a === 'vc-vsave') { const g = (id) => (document.getElementById(id) || {}).value; const pv = { name: g('vc-voice') || '', rate: +g('vc-rate') || 1.05, pitch: +g('vc-pitch') || 1 };
    if (a === 'vc-vtest') { const old = localStorage.getItem(VC_VKEY); try { localStorage.setItem(VC_VKEY, JSON.stringify(pv)); vcSay(`G'day, ${vcName()} here. Ready when you are.`); } finally { try { if (old == null) localStorage.removeItem(VC_VKEY); else localStorage.setItem(VC_VKEY, old); } catch (x) { } } }
    else { if (!(await askBox('Change her voice?', `<p>Use <b>${h(pv.name || 'the standard Australian voice')}</b> on this device, speed ${pv.rate}, pitch ${pv.pitch}?</p>`, 'Save'))) return; try { localStorage.setItem(VC_VKEY, JSON.stringify(pv)); } catch (x) { } toast('Voice saved for this device'); } }
  if (a === 'vc-vreset') { if (!(await askBox('Standard voice?', '<p>Go back to the standard Australian voice on this device?</p>', 'Yes'))) return; try { localStorage.removeItem(VC_VKEY); } catch (x) { } toast('Standard voice'); renderAll(); }
  if (a === 'vc-close') { vcStop(); vcClose(); if (vcPref('voiceKeep')) setTimeout(() => vcListen({ keep: true, quiet: true }), 600); }
  if (a === 'vc-help') vcHelp();
  if (a === 'vc-name') { const v = ((document.getElementById('vc-name') || {}).value || '').trim(); if (!v) return; st.voiceName = v; touch(st); save(); if (window.Sync) Sync.soon(); renderAll(); toast(`Her name is ${v} now — say "${v}, call …"`); vcSay(`Hi, I'm ${v}`); }
  if (a === 'vc-pick') { const f = VC._pick; VC._pick = null; const L = VC._list || []; if (f) f(typeof L[+d.i] === 'number' ? L[+d.i] : L[+d.i]); }
  if (a === 'vc-aladd') { const ok = await askBox('🎤 Add a shortcut', '<div class="f"><label>When I say</label><input data-ask="say" style="width:100%;padding:9px;font-size:16px"></div><div class="f"><label>Do this command</label><input data-ask="cmd" style="width:100%;padding:9px;font-size:16px"></div><div class="hint">The command is said the usual way — "call Bovitech office", "navigate to Wallacup Farms", "go to the day sheet".</div>', 'Save');
    if (!ok || !(ASK_FORM.say || '').trim() || !(ASK_FORM.cmd || '').trim()) return; st.voiceAlias = [...(st.voiceAlias || []), { say: ASK_FORM.say.trim(), cmd: ASK_FORM.cmd.trim() }]; touch(st); save(); renderAll(); }
  if (a === 'vc-aldel') { st.voiceAlias = (st.voiceAlias || []).filter((_, i) => i !== +d.i); touch(st); save(); renderAll(); }
  if (a === 'vc-ideaadd') { const ok = await askBox('🎤 A command idea', '<div class="f"><label>What would you like to say?</label><input data-ask="t" style="width:100%;padding:9px;font-size:16px"></div>', 'Save'); if (!ok || !(ASK_FORM.t || '').trim()) return; st.voiceIdeas = [...vcIdeas(), { t: ASK_FORM.t.trim(), by: (SBAuth.staff && SBAuth.staff.initials) || '' }]; touch(st); save(); renderAll(); }
  if (a === 'vc-ideadel') { st.voiceIdeas = vcIdeas().filter((_, i) => i !== +d.i); touch(st); save(); renderAll(); }
  if (a === 'vc-ideacopy') { const txt = 'Voice commands we would like in the Super App:\n' + vcIdeas().map((x) => '- ' + x.t).join('\n'); try { await navigator.clipboard.writeText(txt); toast('Copied — paste it to Claude'); } catch (x) { toast("Couldn't copy"); } } });
document.addEventListener('change', (e) => { const el = e.target; const a = el.dataset && el.dataset.act; if (a !== 'vc-auto' && a !== 'vc-keep') return; savePref(a === 'vc-auto' ? 'voiceAuto' : 'voiceKeep', el.checked); if (a === 'vc-keep') { if (el.checked) vcListen({ keep: true }); else vcStop(); } toast(el.checked ? 'On for this device' : 'Off for this device'); });
// hands-free: listen as soon as the app is opened (or brought back), and from the "🎤 Voice command" icon shortcut (?voice=1)
function vcAutoStart() { if (!VC_SR || VC.on || !window.APP_READY || document.getElementById('loginbox') && !document.getElementById('loginbox').hidden || document.getElementById('lockbox') && !document.getElementById('lockbox').hidden) return;
  if (/[?&]voice=1/.test(location.search)) { history.replaceState(null, '', location.pathname); vcListen(); return; } if (vcPref('voiceKeep')) vcListen({ keep: true }); else if (vcPref('voiceAuto')) vcListen(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(vcAutoStart, 700); else vcStop(); });
(function vcBoot() { let n = 0; const t = setInterval(() => { if (window.APP_READY || ++n > 60) { clearInterval(t); setTimeout(vcAutoStart, 900); } }, 500); })();
// the 🎤 button at the top of the app
(function vcBtn() { const hdr = document.querySelector('header.top'); if (!hdr || document.getElementById('hdr-mic')) return; const b = document.createElement('button'); b.className = 'hbtn'; b.id = 'hdr-mic'; b.dataset.act = 'vc-mic'; b.title = 'Voice command'; b.setAttribute('aria-label', 'Voice command'); b.innerHTML = `🎤<span class="hlab">Ask<br>${h(vcName() === 'Shazza' ? 'Shaz' : vcName())}</span>`; const me = document.getElementById('hdr-me'); hdr.insertBefore(b, document.getElementById('fipbtn') || me || null); })();
window.voiceCard = voiceCard; window.VC_IDEAS_START = VC_IDEAS_START;
if (typeof module !== 'undefined') module.exports = { vcDate, vcSplitWhen, vcN };
