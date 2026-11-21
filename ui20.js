/* Bovitech Super App — v2.56.1
   1. "Not tested here yet — speed unknown": a tick per set of cattle yards (the farm's ✏️ Scheduling form and the Booking info job).
      The Scheduling card says "Speed unknown — to be confirmed"; bookings use the usual rate and say to confirm it; a job lists them to fill in later.
   2. Businesses that aren't clients (suppliers, depots…) get their own shorter set of tabs, and Edit layout only shows what applies to them.
   3. ✓ Apply and open ➜ on the Check pins job: "✓ Save and open ➜" beside Save on the pin map (opening the map is not "apply").
   4. "What can be booked here" is for cattle yards only — not shown for sheep yards or shearing sheds.
   5. The Booking info job tidies capitals in the comments it moves (shown tidied; you can still change them). */
const U20 = {};

/* ================= 2. tabs for businesses that aren't clients ================= */
if (typeof U15_LK !== 'undefined') { const base = { ...(U15_LK.biz || {}) }; const map = {}; Object.keys(base).forEach((k) => { const t = base[k]; map[k] = t === 'top' || t === 'warn' || t === 'com' || t === 'acc' ? t : 'det'; });
  U15_LK.bizo = Object.assign(map, U15_LK.bizo || {}, { warn: 'warn', biosec: 'warn', u18fw: 'warn', texts: 'com' }); }
/* the sections that only mean something for clients — not offered on a supplier / depot page */
const U20_CLIENT_ONLY = new Set(['pic', 'pid', 'ezyhist', 'recs', 'sched', 'keep', 'routes', 'sfshares', 'sfmember', 'sfnew', 'sfrecs', 'sfinvs', 'u11est', 'u11sum', 'farmsused', 'farmspast']);
function u20NotHere(el) { const k = typeof u15Key === 'function' ? u15Key(el) : ''; return !!k && k.startsWith('lk:') && U20_CLIENT_ONLY.has(k.slice(3)); }
if (typeof u15Apply === 'function') u15Apply = (function (orig) { return function (pg, id, root, secs) { if (pg === 'bizo' && Array.isArray(secs)) { secs.forEach((el) => { const na = u20NotHere(el); el.classList.toggle('u20-na', na); }); secs = secs.filter((el) => !el.classList.contains('u20-na')); arguments[3] = secs; } return orig.apply(this, arguments); }; })(u15Apply);
function u20BizoMig() { try { if (!D.settings || D.settings.u20bizo) return; const all = D.settings.u15tabs || {}; /* someone had already re-arranged the business tabs: other businesses start from the standard short set */ D.settings.u20bizo = 1; if (all.bizo) return; touch(D.settings); save(); } catch (e) { console.warn('u20 tabs', e); } }

/* ================= 3. Check pins: "✓ Save and open ➜" ================= */
if (typeof pcqDraw === 'function') pcqDraw = (function (orig) { return async function (f) { const r = await orig.apply(this, arguments); try { const hint = document.getElementById('pmh-' + f.id); const save1 = hint && hint.querySelector(`[data-act=pcq-save][data-fid="${CSS.escape(f.id)}"]:not([data-next])`);
  const b = IDX.farmBiz && IDX.farmBiz.get(f.id); if (save1 && b && !hint.querySelector('[data-act=u20-pcqao]')) save1.insertAdjacentHTML('afterend', `<button class="btn small u19-ao" data-act="u20-pcqao" data-fid="${h(f.id)}" data-bid="${h(b.id)}" title="Save the pins, then open ${h(b.name)}">✓ Save and open ➜</button>`); } catch (e) { console.warn('u20 pins', e); } return r; }; })(pcqDraw);
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=u20-pcqao]'); if (!el) return; e.preventDefault(); e.stopImmediatePropagation(); const hint = el.parentElement; const sv = hint && hint.querySelector(`[data-act=pcq-save][data-fid="${CSS.escape(el.dataset.fid)}"]:not([data-next])`); if (!sv) return;
  if (typeof U19 !== 'undefined') U19.pend = { at: Date.now(), key: '', tk: 'business', tid: el.dataset.bid, fid: el.dataset.fid }; sv.click(); }, true);

/* the "➜ Open <name>" on jobs opens the page here (not a new browser tab), at the farm when the job is about one */
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=u19-open]'); if (!el) return; e.preventDefault(); e.stopImmediatePropagation(); if (typeof u19Go === 'function') u19Go({ tk: el.dataset.kind, tid: el.dataset.id, fid: el.dataset.fid || null }); }, true);

/* ================= 4. "what can be booked" is for cattle yards ================= */
if (typeof bkYardUse === 'function') bkYardUse = (function (orig) { return function (fid, yid) { const x = orig.apply(this, arguments) || {}; try { if (!x.autoWhy && (x.use || '') !== 'none' && typeof bkSheepOnly === 'function' && bkSheepOnly(fid, yid)) return { ...x, use: '', can: ['preg', 'bull', 'ind'], sheep: true }; } catch (e) { } return x; }; })(bkYardUse);
if (typeof bkFschedOpen === 'function') bkFschedOpen = (function (orig) { return function (fid) { const r = orig.apply(this, arguments); try { const f = IDX.farms.get(fid); const form = document.querySelector('#sheet .form'); if (!f || !form || typeof bkSheepOnly !== 'function') return r;
  const note = '<div class="hint u20-sheepcan">🐑 Sheep yards — "what can be booked here" is only for cattle yards (preg and bull testing).</div>';
  if (bkSheepOnly(fid, null)) { const box = form.querySelector('.u15-can[data-for="fz-use"]'); if (box) { box.hidden = true; box.insertAdjacentHTML('afterend', note); } }
  (bkYardsOf(f) || []).forEach((y) => { if (!y.sheep) return; const box = form.querySelector(`.u15-can[data-for="fz-use-${CSS.escape(y.yid)}"]`); if (box) { box.hidden = true; box.insertAdjacentHTML('afterend', note); } });
  /* the "not tested here yet" tick also ticks Speed TBC */ form.querySelectorAll('[data-fzunk]').forEach((u) => { const inp = document.getElementById(u.dataset.for); if (u.checked && inp) { inp.disabled = true; inp.value = ''; const t = form.querySelector(`[data-fztbc="${u.dataset.for}"]`); if (t) t.checked = true; } });
  } catch (e) { console.warn('u20 sheep', e); } return r; }; })(bkFschedOpen);
document.addEventListener('change', (e) => { const u = e.target; if (!u || !u.dataset) return;
  if (u.dataset.fzunk && u.checked) { const t = document.querySelector(`[data-fztbc="${u.dataset.for}"]`); if (t && !t.checked) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); } }
  if (u.dataset.fztbc && !u.checked) { const x = document.querySelector(`[data-fzunk][data-for="${u.dataset.fztbc}"]`); if (x) x.checked = false; } });

/* ================= 1. speeds unknown — to be confirmed ================= */
function u20UnkList() { const out = []; (D.bkcfg || []).forEach((r) => { if (r.gone || !r.unk || r.hph || (r.cfg !== 'yard' && r.cfg !== 'yrate')) return; const f = IDX.farms && IDX.farms.get(r.fid); if (!f) return; const fs = Bk.fsched(r.fid);
  if (r.cfg === 'yrate' && !fs.ratesPerYard) return; if (r.cfg === 'yard' && fs.ratesPerYard && bkYardsOf(f).length > 1) return; const b = IDX.farmBiz && IDX.farmBiz.get(f.id); if (!b || b.gone) return;
  const y = r.yid ? bkYardsOf(f).find((x) => x.yid === r.yid) : null; if (r.yid && !y) return; const sv = Bk.svc(r.svc) || { name: r.svc }; out.push({ r, f, b, y, sv }); }); return out; }
if (typeof JOB_TYPES !== 'undefined') JOB_TYPES.u20unk = { t: 'Yard speeds to confirm (not tested there yet)', manual: true };
function u20UnkJobs() { const dis = D.dismissed || {}; return u20UnkList().map((x) => { const key = 'u20unk:' + x.r.id; if (dis[key]) return null; return { type: 'u20unk', key, kind: 'business', id: x.b.id, fid: x.f.id, who: `${x.b.name} — ${x.f.name || x.f.address || 'farm'}${x.y ? ' · ' + x.y.name : ''}`, note: `${x.sv.name}: speed unknown — not tested here yet. Put the speed in once it's known.`, herdpull: 'u20', u20unk: x.r.id }; }).filter(Boolean); }
if (typeof herdJobs === 'function') herdJobs = (function (orig) { return function () { let L = []; try { L = orig.apply(this, arguments) || []; } catch (e) { console.warn(e); } try { L = L.concat(u20UnkJobs()); } catch (e) { console.warn(e); } return L; }; })(herdJobs);
if (typeof herdJobHtml === 'function') herdJobHtml = (function (orig) { return function (j) { if (!j || !j.u20unk) return orig.apply(this, arguments); const x = u20UnkList().find((y) => y.r.id === j.u20unk); if (!x) return '';
  return `</div><div style="width:100%"><div class="kv"><div class="k">Business</div><div class="v">${typeof u13BizA === 'function' ? u13BizA(x.b) : h(x.b.name)}</div></div><div class="kv"><div class="k">Yards</div><div class="v">${h(x.f.name || x.f.address || 'Farm')}${x.y ? ' · ' + h(x.y.name) : ''}</div></div>
    <div class="kv"><div class="k">${h(x.sv.name)}</div><div class="v"><span class="bk-unk">Speed unknown — to be confirmed</span>${x.sv.hph ? ` <span class="hint">(${x.sv.hph}/hour used until then)</span>` : ''}</div></div>
    <div class="f"><label for="u20u-${h(x.r.id)}">${/bull/i.test(x.sv.name || x.r.svc) ? 'Mature bulls per hour' : 'Head per hour'}</label><input id="u20u-${h(x.r.id)}" class="u20-unkin" data-id="${h(x.r.id)}" type="number" min="1" inputmode="numeric" style="width:110px"></div>
    <div class="actions"><button class="btn small greenbtn" data-act="u20-unksave" data-id="${h(x.r.id)}">✓ Save the speed</button><button class="btn small" data-act="job-dismiss" data-key="${h(j.key)}">Hide this job</button></div></div><div>`; }; })(herdJobHtml);
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=u20-unksave]'); if (!el) return; e.preventDefault(); e.stopPropagation(); const r = Bk.get(el.dataset.id); const inp = document.getElementById('u20u-' + el.dataset.id); const v = inp ? Math.round(+inp.value) : 0;
  if (!r || !(v > 0)) { toast('Type the speed first'); if (inp) inp.focus(); return; } const f = IDX.farms.get(r.fid); const sv = Bk.svc(r.svc) || { name: r.svc };
  if (!(await ask(`${h(f ? f.name || f.address || 'Farm' : 'Farm')}: ${h(sv.name)} — <b>${v}/hour</b>?`, '✓ Save'))) { if (typeof U19 !== 'undefined') U19.pend = null; return; }
  r.hph = v; delete r.unk; delete r.gone; touch(r); if (typeof JOBS_CACHE !== 'undefined') JOBS_CACHE = null; NEXT_LOG_LABEL = `${f ? f.name || 'Farm' : 'Farm'}: ${sv.name} speed ${v}/hour (was unknown)`; S.skipConfirm = true; if (await changed()) toast(`✓ ${v}/hour saved`); }, true);

/* the Booking info job: a "not tested here yet" tick beside each yards' speed; tidied capitals */
const u20Dec = (t) => String(t).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const u20Tidy = (t) => (typeof u13Tidy === 'function' && t ? u13Tidy(String(t)).text : t);
if (typeof ginfoHtml === 'function') ginfoHtml = (function (orig) { return function (j) { let html = orig.apply(this, arguments); try { const b = IDX.biz.get(j.ginfo); if (!b || !html) return html; const ys = typeof giYards === 'function' ? giYards(b) : [];
  html = html.replace(/(<input type="number"[^>]*data-gi="(preg|bull)sp" data-i="(\d+)"[^>]*>)/g, (m, inp, k, i) => { const y = ys[+i]; const on = y && typeof bkRateUnk === 'function' && bkRateUnk(y.fid, y.yid, k === 'bull' ? 'svc-bull' : 'svc-preg');
    return `${inp}<label class="bk-radio u20-gunk"><input type="checkbox" data-gi="${k}unk" data-i="${i}" ${on ? 'checked' : ''}> Not tested here yet — speed unknown</label>`; });
  html = html.replace(/(<textarea data-gi="(?:pcom|bcom)"[^>]*>)([\s\S]*?)(<\/textarea>)/g, (m, a, txt, c) => a + h(u20Tidy(u20Dec(txt))) + c);
  html = html.replace(/(<textarea id="u15st-\d+" class="u15-sugtxt"[^>]*data-orig=")([^"]*)("[^>]*>)([\s\S]*?)(<\/textarea>)/g, (m, a, o, b2, txt, c) => a + h(u20Tidy(u20Dec(o))) + b2 + h(u20Tidy(u20Dec(txt))) + c);
  html = html.replace(/(<input data-gi="booknote" value=")([^"]*)(")/, (m, a, v, c) => a + h(u20Tidy(u20Dec(v))) + c);
  } catch (e) { console.warn('u20 ginfo', e); } return html; }; })(ginfoHtml);
document.addEventListener('change', (e) => { const u = e.target; if (!u || !u.dataset || !/^(preg|bull)unk$/.test(u.dataset.gi || '')) return; const k = u.dataset.gi.slice(0, -3); const inp = u.closest('td') && u.closest('td').querySelector(`[data-gi="${k}sp"]`); if (inp) { inp.disabled = u.checked; if (u.checked) { inp.dataset.u20was = inp.value; inp.value = ''; } else if (inp.dataset.u20was) inp.value = inp.dataset.u20was; } });
if (typeof giRead === 'function') giRead = (function (orig) { return function (box) { const A = orig.apply(this, arguments); try { ['preg', 'bull'].forEach((k) => { A[k + 'Unk'] = [...box.querySelectorAll(`[data-gi="${k}unk"]:checked`)].map((x) => +x.dataset.i); }); } catch (e) { } return A; }; })(giRead);
if (typeof giApply === 'function') giApply = (function (orig) { return function (b, A, r) { try { if (A) { ['pcom', 'bcom', 'bookNote'].forEach((f) => { if (A[f]) A[f] = u20Tidy(A[f]); }); (A.u15 || []).forEach((x) => { if (x.text) x.text = u20Tidy(x.text); });
      ['preg', 'bull'].forEach((k) => { const U = new Set(A[k + 'Unk'] || []); if (U.size) A[k + 'Sp'] = (A[k + 'Sp'] || []).map((s) => (U.has(s.i) ? { ...s, hph: 0 } : s)); }); } } catch (e) { console.warn(e); }
    const r0 = r || giParse(b); const n = orig.apply(this, arguments) || 0; let m = 0;
    try { r = r0; const ys = r.yards || []; ['preg', 'bull'].forEach((k) => { if (!A || !A[k] || !r[k]) return; const svc = k === 'bull' ? 'svc-bull' : 'svc-preg'; const U = new Set(A[k + 'Unk'] || []); const byF = {};
        ys.forEach((y, i) => { (byF[y.fid] = byF[y.fid] || []).push({ y, unk: U.has(i) }); });
        Object.entries(byF).forEach(([fid, arr]) => { const f = IDX.farms.get(fid); const all = f ? bkYardsOf(f) : []; const unk = arr.filter((a) => a.unk); if (!unk.length) return;
          const whole = unk.length >= all.length || all.length <= 1; if (!whole) { let fs = Bk.get('fsched:' + fid); if (!fs) { fs = { id: 'fsched:' + fid, cfg: 'fsched', fid, ...Bk.fsched(fid) }; D.bkcfg.push(fs); } if (!fs.ratesPerYard) { fs.ratesPerYard = true; touch(fs); } }
          unk.forEach((a) => { if (bkSetUnk(fid, whole ? null : a.y.yid, svc, true)) m++; }); }); }); } catch (e) { console.warn('u20 unknown speeds', e); }
    return n || (m ? 1 : 0); }; })(giApply);

/* ================= look, box colours, check jobs ================= */
(function () { const st = document.createElement('style'); st.textContent = `.u20-na{display:none!important}.bk-unk{color:#8a4b00;background:#fff3e0;border:1px solid #f0c58a;border-radius:6px;padding:0 6px;font-style:italic}div.bk-unk{display:block;margin-top:4px;padding:4px 8px}.u20-gunk{font-size:13px;margin-top:4px;display:flex}.u20-sheepcan{margin-top:4px}`; document.head.appendChild(st); })();
if (typeof BOXES !== 'undefined') [
  { k: 'u20unk', l: 'Speed unknown — to be confirmed', sel: '.bk-unk', txt: '.bk-unk', sample: '<span class="bk-unk">Speed unknown — to be confirmed</span>', d: { bg: '#fff3e0', fg: '#8a4b00', bd: '#f0c58a', bold: false } }
].forEach((b) => { if (!BOXES.some((x) => x.k === b.k)) BOXES.push(b); });
setTimeout(() => { try { u20BizoMig(); } catch (e) { } }, 1600);
if (typeof SETUP !== 'undefined' && typeof U8_TRY !== 'undefined') [
  ['chk2561-unk', 'Check: speed unknown — not tested here yet', 'A client\'s 📅 Scheduling → tap a farm → under a speed tick "Not tested here yet — speed unknown, needs confirming" → Save. The card says "Speed unknown — to be confirmed", booking preg testing there warns to confirm the speed, and Jobs → "Yard speeds to confirm" lists it with a box to type the speed in. The 📋 Booking info job has the same tick beside each yards\' speed.', 'u13:biz'],
  ['chk2561-bizo', 'Check: tabs on suppliers and other businesses', 'Open a business that isn\'t a client (a supplier or a sample depot): it has its own shorter tabs (Details, Warnings, Comms & attachments, Account). ✏️ Edit layout there only shows those tabs and no client-only sections (patients, scheduling, sharefarms…). Settings → Contacts → 🗂 Page tabs has "Business page (other)" to change them.', 'u13:biz'],
  ['chk2561-pins', 'Check: Save and open on Check pins', 'Jobs → Check pins: the pin map opens. Tap ✓ Save and open ➜ (beside ✓ Save): the pins are saved and that business opens, at the farm.', 'u13:jobs'],
  ['chk2561-sheep', 'Check: "what can be booked" only on cattle yards', 'A client with sheep yards (or a shearing shed): 📅 Scheduling has no "What can be booked here" line for them, and the farm\'s ✏️ form says it\'s only for cattle yards. Cattle yards still have it.', 'u13:biz'],
  ['chk2561-caps', 'Check: capitals in the Booking info job', 'Jobs → 📋 Booking info to move: the comments start each sentence with a capital (you can still change them), and that\'s what goes into Scheduling.', 'u13:jobs'],
  ['chk2561-lists', 'Check: editing a drop-down list', 'A client\'s 📅 Scheduling ✏️ → Preg testing frequency → ✏️ Edit this list…: everything in the drop-down is in the edit box — answers that aren\'t on the list yet show "not on the list yet" (keep it to add it, 🗑️ to leave it off). Renaming or deleting one used by clients asks whether to change them too.', 'u13:biz'],
].forEach(([id, t, tryIt, go]) => { U8_TRY[id] = tryIt; U8_TO[id] = go; if (SETUP.some((x) => x.id === id)) return; SETUP.push({ id, t, steps: [tryIt, `<button type="button" class="btn small" data-act="u8-go" data-go="${go}">➡️ Take me there</button>`, 'If it does what you want, tick <b>✓ Done</b>. If not, tell Claude what\'s wrong.'] }); });
window.u20UnkList = u20UnkList; window.u20UnkJobs = u20UnkJobs;
