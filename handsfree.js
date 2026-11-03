/* Bovitech Super App — 🎧 Hands-free records. The app reads out each question on the record (every procedure's questions, how many
   head, which patient, notes) and fills in what you say — so you can keep your gloves on. Say "next" to skip, "back", "repeat",
   "same as last time" (copies the answer from this client's last record of that procedure) or "stop". */
'use strict';
const HF = { on: false, q: [], i: 0, rid: null, rec: null, heard: '' };
const HF_NUM = { one: 1, first: 1, two: 2, second: 2, to: 2, too: 2, three: 3, third: 3, four: 4, for: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, seventh: 7, eight: 8, eighth: 8, nine: 9, ninth: 9, ten: 10, tenth: 10 };
const hfShort = (o) => { const s = String(o || ''); return s.length > 70 ? s.slice(0, 67).replace(/\s+\S*$/, '') + '…' : s; };
function hfNumber(t) { const s = t.toLowerCase().trim(); const m = /\b(\d+(?:\.\d+)?)\b/.exec(s); if (m) return +m[1]; const w = s.replace(/^(number|option)\s+/, '').split(/\s+/)[0]; return HF_NUM[w] || null; }
function hfQueue(r) { const Q = []; const pats = r.patients || [];
  (r.procs || []).forEach((pr) => { const t = crTpl(pr.tpl); if (!t) return;
    if (pats.length > 1) Q.push({ kind: 'pat', pr, t, l: `${t.name}: which patient?`, opts: pats.map((p) => p.pid ? `${p.pid}${p.plabel ? ' ' + p.plabel : ''}` : (p.species === 'sheep' ? 'Sheep flock' : 'Cattle herd')) });
    if (t.charge && (t.charge.head || t.quick === 'pd')) Q.push({ kind: 'head', pr, t, l: `${t.name}: how many head?` });
    (t.sections || []).flatMap((s) => s.inputs).forEach((inp) => Q.push({ kind: inp.text ? 'text' : 'opt', pr, t, inp, l: `${t.name}: ${inp.l}`, opts: inp.text ? null : inp.opts }));
    Q.push({ kind: 'prnotes', pr, t, l: `Any notes for ${t.name}?` }); });
  Q.push({ kind: 'notes', l: 'Anything else for the record?' }); return Q; }
const hfShownNow = (q) => !q.inp || crShown(q.pr, q.inp);
function hfCur(q) { if (q.kind === 'pat') { const p = (HF.rec.patients || []).find((x) => x.id === q.pr.pat); return p ? q.opts[(HF.rec.patients || []).indexOf(p)] : ''; } if (q.kind === 'head') return q.pr.head ? String(q.pr.head) : ''; if (q.kind === 'prnotes') return q.pr.notes || ''; if (q.kind === 'notes') return HF.rec.notes || ''; return ((q.pr.answers || {})[q.inp.k]) || ''; }
function hfBox() { let el = document.getElementById('hfbox'); if (!el) { el = document.createElement('div'); el.id = 'hfbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); } return el; }
function hfShow(listening) { const q = HF.q[HF.i]; const el = hfBox(); el.hidden = false; if (!q) { el.hidden = true; return; } const cur = hfCur(q);
  el.innerHTML = `<div class="vc-in"><div class="hint">🎧 Hands-free · ${HF.i + 1} of ${HF.q.length}</div><b style="font-size:18px">${h(q.l)}</b>
    ${q.opts ? `<ol class="hf-opts">${q.opts.map((o, i) => `<li class="${o === cur ? 'on' : ''}" data-act="hf-pick" data-i="${i}">${h(hfShort(o))}</li>`).join('')}</ol>` : ''}
    ${cur ? `<div class="hint">Now: ${h(hfShort(cur))}</div>` : ''}<div class="vc-heard" id="hf-heard">${listening ? '🎤 Listening…' : HF.heard ? '“' + h(HF.heard) + '”' : ''}</div>
    <div class="hint">Say ${q.opts ? 'the number or the words' : q.kind === 'head' ? 'the number' : 'it'} · "next" · "back" · "repeat" · "same as last time" · "stop"</div>
    <div class="actions"><button class="btn small" data-act="hf-back">‹ Back</button><button class="btn small" data-act="hf-next">Skip ›</button><button class="btn small" data-act="hf-again">🔁 Repeat</button><button class="btn small" data-act="hf-stop">■ Stop</button></div></div>`; }
function hfSpeak(t) { return new Promise((res) => { try { if (!window.speechSynthesis) return res(); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'en-AU'; u.rate = 1.05; u.onend = () => res(); u.onerror = () => res(); speechSynthesis.speak(u); setTimeout(res, Math.min(15000, 1500 + t.length * 70)); } catch (e) { res(); } }); }
async function hfAsk() { if (!HF.on) return; while (HF.i < HF.q.length && !hfShownNow(HF.q[HF.i])) HF.i++; const q = HF.q[HF.i]; if (!q) return hfEnd(true);
  HF.heard = ''; hfShow(false); const cur = hfCur(q); let say = q.l; if (q.opts) say += '. ' + q.opts.slice(0, 6).map((o, i) => `${i + 1}: ${o.split(/[,(]/)[0].split(' ').slice(0, 6).join(' ')}`).join('. ');
  if (cur) say += '. At the moment it says ' + hfShort(cur).slice(0, 60); await hfSpeak(say); if (!HF.on || HF.q[HF.i] !== q) return; hfShow(true);
  let got = false; HF.listener = crListen((t) => { got = true; HF.heard = t; try { HF.listener && HF.listener.stop(); } catch (e) { } hfHeard(q, t); }, { onEnd: () => { if (!got && HF.on && HF.q[HF.i] === q) { HF.heard = ''; hfShow(false); const hd = document.getElementById('hf-heard'); if (hd) hd.textContent = 'Nothing heard — tap 🔁 Repeat, or say it after the question.'; } } }); }
function hfLast(q) { const r = HF.rec; const L = crList('crrec').filter((x) => !x.gone && x.id !== r.id && x.bid === r.bid && (x.date || '') <= (r.date || '9')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  for (const x of L) { const p = (x.procs || []).find((y) => y.tpl === q.pr.tpl); if (!p) continue; if (q.kind === 'opt' || q.kind === 'text') { const v = (p.answers || {})[q.inp.k]; if (v) return v; } if (q.kind === 'head' && p.head) return p.head; if (q.kind === 'prnotes' && p.notes) return p.notes; } return null; }
async function hfHeard(q, t) { const s = t.toLowerCase().trim();
  if (/^(stop|finish|finished|that'?s all|done|end)\b/.test(s)) return hfEnd(false);
  if (/^(next|skip|pass|no|nothing|none)\b/.test(s) && q.kind !== 'opt' || /^(next|skip|pass)\b/.test(s)) { HF.i++; return hfAsk(); }
  if (/^(back|previous|go back)\b/.test(s)) { HF.i = Math.max(0, HF.i - 1); while (HF.i > 0 && !hfShownNow(HF.q[HF.i])) HF.i--; return hfAsk(); }
  if (/^(repeat|again|say that again|what)\b/.test(s)) return hfAsk();
  let v = null; if (/same as (last time|before|last)/.test(s)) { v = hfLast(q); if (v == null) { await hfSpeak('There is no earlier answer for this client'); return hfAsk(); } }
  if (q.kind === 'opt' || q.kind === 'pat') { let idx = -1; if (v != null && q.opts) idx = q.opts.indexOf(v);
    if (idx < 0) { const n = hfNumber(s); if (n && n >= 1 && n <= q.opts.length && s.split(/\s+/).length <= 3) idx = n - 1; }
    if (idx < 0 && q.inp && typeof CR_SAY !== 'undefined' && CR_SAY[q.inp.k]) idx = CR_SAY[q.inp.k].findIndex((re) => re && re.test(s));
    if (idx < 0) { const words = s.split(/\s+/).filter((w) => w.length > 3); const sc = q.opts.map((o) => words.filter((w) => o.toLowerCase().includes(w)).length); const best = Math.max(...sc); if (best > 0 && sc.filter((x) => x === best).length === 1) idx = sc.indexOf(best); }
    if (idx < 0) { if (q.inp && q.inp.other && s.split(/\s+/).length > 2) { hfSet(q, t); await hfSpeak('Got it'); HF.i++; return hfAsk(); } await hfSpeak("I didn't match that. Say the number."); return hfAsk(); }
    hfSet(q, q.kind === 'pat' ? idx : q.opts[idx]); await hfSpeak('Got it, ' + (q.kind === 'pat' ? q.opts[idx] : 'number ' + (idx + 1))); HF.i++; return hfAsk(); }
  if (q.kind === 'head') { const n = v != null ? +v : hfNumber(s); if (!n) { await hfSpeak('Say the number of head'); return hfAsk(); } hfSet(q, n); await hfSpeak(n + ' head'); HF.i++; return hfAsk(); }
  hfSet(q, v != null ? v : t, v == null); await hfSpeak('Got it'); HF.i++; return hfAsk(); }
function hfSet(q, v, add) { const r = HF.rec; if (r.status === 'final') { toast('This record is finalised — reopen it to change it'); return; }
  if (q.kind === 'pat') { const p = (r.patients || [])[v]; if (p) q.pr.pat = p.id; }
  else if (q.kind === 'head') q.pr.head = +v || 0;
  else if (q.kind === 'prnotes') q.pr.notes = add && q.pr.notes ? q.pr.notes + ' ' + v : v;
  else if (q.kind === 'notes') r.notes = add && r.notes ? r.notes + ' ' + v : v;
  else { q.pr.answers = q.pr.answers || {}; if (q.kind === 'opt' && q.opts && !q.opts.includes(v)) q.pr.answers['_o_' + q.inp.k] = 1; q.pr.answers[q.inp.k] = q.kind === 'text' && add && q.pr.answers[q.inp.k] ? q.pr.answers[q.inp.k] + ' ' + v : v; }
  touch(r); save(); try { crInvSync(r); } catch (e) { } if (window.Sync) Sync.soon(); renderAll(); }
function hfStart(r) { if (!crVoiceOk()) { toast("Hands-free needs voice — use Chrome on Android"); return; } if (!r) return; if (r.status === 'final') { toast('This record is finalised — reopen it first'); return; }
  if (typeof vcStop === 'function') vcStop(); HF.rec = r; HF.rid = r.id; HF.q = hfQueue(r); HF.i = 0; HF.on = true;
  if (HF.q.length <= 1 && !(r.procs || []).length) { hfSpeak('Add a procedure first, then I can ask its questions.'); }
  HF.i = Math.max(0, HF.q.findIndex((q) => hfShownNow(q) && !hfCur(q))); if (HF.i < 0) HF.i = 0; // start at the first one not answered yet
  hfAsk(); }
function hfEnd(done) { HF.on = false; try { HF.listener && HF.listener.stop(); } catch (e) { } try { speechSynthesis.cancel(); } catch (e) { } const el = document.getElementById('hfbox'); if (el) el.hidden = true; if (done) { hfSpeak('All done. Check the record before finalising.'); toast('🎧 Hands-free finished — check the record'); } }
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act; if (!/^hf-/.test(a)) return;
  if (a === 'hf-start') { const r = typeof CR !== 'undefined' && CR.page === 'edit' ? crGet('crrec', CR.id) : null; hfStart(r); return; }
  try { HF.listener && HF.listener.stop(); } catch (x) { } try { speechSynthesis.cancel(); } catch (x) { }
  if (a === 'hf-stop') hfEnd(false); if (a === 'hf-next') { HF.i++; hfAsk(); } if (a === 'hf-back') { HF.i = Math.max(0, HF.i - 1); while (HF.i > 0 && !hfShownNow(HF.q[HF.i])) HF.i--; hfAsk(); } if (a === 'hf-again') hfAsk();
  if (a === 'hf-pick') { const q = HF.q[HF.i]; const i = +el.dataset.i; hfSet(q, q.kind === 'pat' ? i : q.opts[i]); HF.i++; hfAsk(); } });
window.hfStart = hfStart; window.HF = HF;
