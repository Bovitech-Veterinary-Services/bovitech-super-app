/* Bovitech Super App — 2.56.0
   1. 🐑 preg / bull testing speeds only at cattle yards (bookings.js, bk-ui.js, bk-form.js, ui8.js, bkinfo.js)
   2. the page tabs always sit at the top — reordering, merging or position numbers can't move them down
   3. ✏️ Edit layout and ✏️ Edit mode together at the top, and the top bar stays visible while scrolling (the per-person Edit mode buttons are gone)
   4. last / next appointment on the 📅 Scheduling card (bk-ui.js)
   5. 🤝 Sharefarms tab (sharefarm.js gives the set-up button its own card)
   6. Account: 🧾 Estimates and Clinical summary apart; the summary can include the old ezyVet / VetlinkPRO history (ui11.js)
   7. every job that applies something gets "✓ Apply and open ➜"; jobs that can't, get "➜ Open …" */
const U19 = { pend: null };

/* ================= 2. the tab bar always at the top ================= */
/* The bar used to go just before the first section on a tab — so a section moved above the "always shown" ones, or a loose row of buttons, pushed it down.
   Now: the page's own top (back / name / buttons), then the always-shown sections, then the tabs, then everything else.
   Loose rows between sections (e.g. the statement buttons) go with the section above them. */
function u19PinBar(root) { const bar = root.querySelector(':scope > .u15-tabs'); if (!bar) return; const kids = [...root.children].filter((el) => el !== bar);
  const isSec = (el) => !!el.dataset.u15t || !!el.querySelector(':scope [data-u15t]');
  let i = 0; while (i < kids.length && !isSec(kids[i]) && kids[i].matches(U15_HEAD)) i++; const lead = kids.slice(0, i);
  let j = kids.length; while (j > i && !isSec(kids[j - 1])) j--; const mid = kids.slice(i, j);
  let last = null; mid.forEach((el) => { if (isSec(el)) { if (el.dataset.u15t) last = el.dataset.u15t; return; } if (last && last !== 'top') el.dataset.u15t = last; });
  const firstT = (mid.find((el) => el.dataset.u15t && el.dataset.u15t !== 'top') || {}).dataset; mid.forEach((el) => { if (!el.dataset.u15t && !isSec(el) && firstT) el.dataset.u15t = firstT.u15t; });
  const cur = (bar.querySelector('.u15-tab.on') || {}).dataset; if (cur) mid.forEach((el) => { if (el.dataset.u15t && !isSec(el) && el.dataset.u15t !== 'top') el.classList.toggle('u15-off', el.dataset.u15t !== cur.t); });
  const tops = mid.filter((el) => el.dataset.u15t === 'top'); const anchor = mid.find((el) => el.dataset.u15t !== 'top') || null;
  tops.forEach((el) => root.insertBefore(el, anchor)); root.insertBefore(bar, anchor || (kids[j] || null)); }
if (typeof u15Apply === 'function') u15Apply = (function (orig) { return function (pg, id, root) { const r = orig.apply(this, arguments); try { if (root && (pg === 'biz' || pg === 'bizo' || pg === 'person' || pg === 'patient')) u19PinBar(root); } catch (e) { console.warn('u19 tabs', e); } return r; }; })(u15Apply);
window.u19PinBar = u19PinBar;

/* ================= 5. 🤝 Sharefarms tab ================= */
if (typeof U15_DEF !== 'undefined' && !U15_DEF.biz.tabs.some((t) => t[0] === 'sf')) { const T = U15_DEF.biz.tabs; const i = T.findIndex((t) => t[0] === 'acc'); T.splice(i >= 0 ? i : T.length, 0, ['sf', '🤝 Sharefarms']); }
if (typeof U15_LK !== 'undefined') Object.assign(U15_LK.biz, { sfshares: 'sf', sfmember: 'sf', sfnew: 'sf', u11est: 'acc', u11sum: 'acc' });
/* the sharefarm cards are known by their own name (not the section they happen to follow) */
if (typeof u15Key === 'function') u15Key = (function (orig) { return function (el) { try { const c = el.matches && el.matches('[data-sec]') ? el : el.querySelector && el.querySelector(':scope > [data-sec]'); if (c && /^(sf(shares|member|new)|u11(est|sum))$/.test(c.dataset.sec)) return c.dataset.sec; } catch (e) { } return orig.apply(this, arguments); }; })(u15Key);
function u19SfMig() { try { if (!D.settings || D.settings.u19sfMig) return; const all = { ...(D.settings.u15tabs || {}) }; const c = all.biz;
  if (c && Array.isArray(c.tabs) && !c.tabs.some((t) => t.id === 'sf')) { const tabs = [...c.tabs]; const i = tabs.findIndex((t) => t.id === 'acc'); tabs.splice(i >= 0 ? i : tabs.length, 0, { id: 'sf', n: '🤝 Sharefarms' }); all.biz = { ...c, tabs }; }
  D.settings.u15tabs = all; D.settings.u19sfMig = 1; touch(D.settings); save(); if (window.SupaSync && SupaSync.soon) SupaSync.soon(); } catch (e) { console.warn('u19 sharefarm tab', e); } }

/* ================= 3. the top bar stays at the top ================= */
(function () { const st = document.createElement('style'); st.textContent = `#detail .d-wrap > .dtop{position:sticky;top:0;z-index:25;background:var(--bg,#fbfaf7);padding:6px 0;margin-top:-6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;box-shadow:0 6px 8px -8px rgba(0,0,0,.25)}
  #detail .d-wrap > .dtop .u16-edtools{margin:0}
  .bk-lastnext .v{font-weight:400}
  .u19-ao{border-style:dashed}
  .u11-oldh{border-top:2px solid #ccc;margin-top:18px;padding-top:8px}`; document.head.appendChild(st); })();

/* ================= 7. ✓ Apply and open ➜ on every job ================= */
const U19_NOT = /^(pcq-start|pcq-add|pcq-full|svc-start|svc-[a-z]+|job-dismiss|job-ai|pop-job-ai|open|job-open|del-contact|del-biz|job-sel|job-selall|job-rename|km-pins|lookup-km|u19-ao|pt-open|bk-open|u13-open|ezy-open|tab)$/;
function u19Target(j) { if (!j) return null; const biz = (id) => (id && IDX.biz.get(id) ? { kind: 'business', id } : null);
  if ((j.kind === 'business' || j.kind === 'contact') && j.id) { if (j.kind === 'contact' ? D.contacts.some((c) => c.id === j.id && !c.gone) : IDX.biz.get(j.id)) return { kind: j.kind, id: j.id, fid: j.fid || null }; }
  const b = biz(j.ginfo) || biz(j.bid) || biz(j.data && j.data.bid) || (j.u13 && biz(j.u13.bid)) || (j.u14prac && (j.u14prac.kind === 'business' ? biz(j.u14prac.id) : { kind: 'contact', id: j.u14prac.id }));
  if (b) return { ...b, fid: j.fid || null };
  if (j.fid && IDX.farms && IDX.farms.get(j.fid)) { const f = IDX.farms.get(j.fid); const ob = (D.businesses || []).find((x) => !x.gone && (x.farms || []).some((y) => y.id === f.id)); if (ob) return { kind: 'business', id: ob.id, fid: f.id }; }
  return null; }
function u19TName(t) { if (!t) return ''; if (t.kind === 'business') { const b = IDX.biz.get(t.id); return b ? b.name : ''; } const c = D.contacts.find((x) => x.id === t.id); return c ? fullName(c) : ''; }
if (typeof jobItemHtml === 'function') jobItemHtml = (function (orig) { return function (j, inline) { let html = orig.apply(this, arguments); try { if (inline || !j) return html; const t = u19Target(j); if (!t) return html; let n = 0;
    html = html.replace(/<button([^>]*class="[^"]*\b(primary|greenbtn)\b[^"]*"[^>]*)>([\s\S]*?)<\/button>/g, (m0, attrs, cls, label) => { const act = (/data-act="([^"]+)"/.exec(attrs) || [])[1] || ''; if (!act || U19_NOT.test(act) || /data-u19i=/.test(attrs) || /disabled/.test(attrs)) return m0;
      const i = n++; return `<button${attrs} data-u19i="${i}">${label}</button><button type="button" class="btn small u19-ao" data-act="u19-ao" data-i="${i}" data-key="${h(j.key || '')}" data-tk="${t.kind}" data-tid="${h(t.id)}" ${t.fid ? `data-fid="${h(t.fid)}"` : ''} title="Do the same as the button before, then open ${h(u19TName(t))}">✓ Apply and open ➜</button>`; });
    if (!n && !new RegExp(`data-act="open"[^>]*data-id="${t.id.replace(/[^\w-]/g, '')}"`).test(html)) { const nm = u19TName(t); html = html.replace(/<div class="acts">/, `<div class="acts"><button type="button" class="btn small" data-act="u19-open" data-kind="${t.kind}" data-id="${h(t.id)}" ${t.fid ? `data-fid="${h(t.fid)}"` : ''}>➜ Open ${h(nm.length > 30 ? nm.slice(0, 28) + '…' : nm)}</button>`); }
  } catch (e) { console.warn('u19 apply and open', e); } return html; }; })(jobItemHtml);
function u19Go(p) { U19.pend = null; if (typeof SHEET !== 'undefined' && SHEET && !SHEET.inline) closeSheet(); /* the same page, not a new browser tab */ if (!['all', 'contacts', 'biz', 'loc'].includes(S.tab)) { S.backTo = S.tab; S.tab = p.tk === 'business' ? 'biz' : 'contacts'; } S.sel = { kind: p.tk, id: p.tid }; renderAll(); const dt = document.getElementById('detail'); if (dt) dt.scrollTop = 0; document.body.classList.add('show-detail');
  setTimeout(() => { try { let el = p.fid ? document.querySelector(`#detail [data-fid="${CSS.escape(p.fid)}"]`) : null; if (el) { el = el.closest('.card, .farmcard, .kv, details') || el; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (typeof u18Point === 'function') u18Point(el); } } catch (e) { } }, 500); }
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=u19-ao]'); if (!el) { if (U19.pend && !(e.target.closest && e.target.closest('#askbox, #sheet, .sheet-bg, .askbox, [role=dialog]')) && Date.now() - U19.pend.at > 400) U19.pend = null; return; }
  e.preventDefault(); e.stopImmediatePropagation(); const job = el.closest('.job') || el.parentElement; const btn = job && job.querySelector(`[data-u19i="${el.dataset.i}"]`); if (!btn) return;
  U19.pend = { at: Date.now(), key: el.dataset.key, tk: el.dataset.tk, tid: el.dataset.tid, fid: el.dataset.fid || null }; btn.click(); }, true);
/* the job's own button saved the change → open the page */
if (typeof changed === 'function') changed = (function (orig) { return async function () { const r = await orig.apply(this, arguments); try { if (r !== false && U19.pend && Date.now() - U19.pend.at < 180000) { const p = U19.pend; setTimeout(() => u19Go(p), 250); } } catch (e) { } return r; }; })(changed);
/* some jobs save without changed(): when the job has gone from the list, open the page */
if (typeof renderAll === 'function') renderAll = (function (orig) { return function () { const r = orig.apply(this, arguments); try { const p = U19.pend; if (p && Date.now() - p.at < 180000 && S.tab === 'jobs' && p.key && !(typeof jobs === 'function' && jobs().some((x) => x.key === p.key)) && !document.querySelector('#askbox:not([hidden]), #sheet')) setTimeout(() => { if (U19.pend === p) u19Go(p); }, 250); } catch (e) { } return r; }; })(renderAll);

/* ================= admin check jobs ================= */
setTimeout(() => { try { u19SfMig(); } catch (e) { } }, 1500);
if (typeof SETUP !== 'undefined' && typeof U8_TRY !== 'undefined') [
  ['chk256-sheep', 'Check: 🐑 no preg / bull speeds at sheep yards', 'A client with a farm whose yards pin is "Sheep yards" (or a shearing shed) → 📅 Scheduling: that farm / yard shows no preg or bull testing speed, its ✏️ form has no speed boxes, the 🧮 Yard speed calculator doesn\'t offer it, and the "Booking info to move" job doesn\'t ask for a rate there. Cattle yards (and mixed farms) still have them.', 'u13:biz'],
  ['chk256-tabs', 'Check: the tabs stay at the top', 'Open a business (e.g. one you reordered before) → the tabs are straight under the name and buttons. ✏️ Edit layout → move a section to No. 1, ⤒ another, drag one, merge two → ✓ Finish → the tabs are still at the top.', 'u13:biz'],
  ['chk256-edbar', 'Check: ✏️ Edit layout and ✏️ Edit mode at the top', 'Open a business or person and scroll down: the top bar (‹ Back, ✏️ Edit layout, ✏️ Edit mode, 📤 Share) stays in view. The ✏️ Edit mode buttons beside each person on a business page are gone — open the person to edit them.', 'u13:biz'],
  ['chk256-lastappt', 'Check: last appointment on the Scheduling tab', 'Open a client business: the "last appointment" line is no longer under the name — it\'s at the top of 📅 Scheduling (with the next appointment, if one is booked).', 'u13:biz'],
  ['chk256-sftab', 'Check: 🤝 Sharefarms tab', 'Open a client business → the 🤝 Sharefarms tab has "Set up a sharefarm with other businesses…" (and any sharefarms they\'re in). The button is no longer at the top of the page.', 'u13:biz'],
  ['chk256-summary', 'Check: estimates and clinical summary apart; old history in the summary', 'A client business → Account tab: 🧾 Estimates and Clinical summary are separate. Clinical summary → tick "Include the old ezyVet / VetlinkPRO history", choose dates (or leave blank for all) → 🖨 Print / PDF: the old consults come after the app\'s records.', 'u13:biz'],
  ['chk256-ginfo', 'Check: 📋 Booking info fills itself in', 'Jobs → 📋 Booking info to move → a client whose General info says something like "Speed: 70hd/hr all yards": every yard is filled in with 70 and has a red "Filled in from: …" under it. Book under, frequency, type and comments show where they came from too. Only when the text has no speed is the default used (with the red "This is the default rate").', 'u13:jobs'],
  ['chk256-applyopen', 'Check: ✓ Apply and open ➜ on jobs', 'Jobs → open any list with a ✓ / Make this change / Apply button (e.g. 📋 Booking info to move, herd numbers) → tap ✓ Apply and open ➜ next to it: it asks the same as the normal button, saves, then opens that business (scrolling to the farm when the job is about one). Jobs with nothing to apply have ➜ Open <name>.', 'u13:jobs'],
].forEach(([id, t, tryIt, go]) => { U8_TRY[id] = tryIt; U8_TO[id] = go; if (SETUP.some((x) => x.id === id)) return; SETUP.push({ id, t, steps: [tryIt, `<button type="button" class="btn small" data-act="u8-go" data-go="${go}">➡️ Take me there</button>`, 'If it does what you want, tick <b>✓ Done</b>. If not, tell Claude what\'s wrong.'] }); });

/* ================= 9. 🚀 Go-live jobs on their own tab of the Jobs page ================= */
function u19GoLive(j) { if (!j || j.type !== 'setup' || typeof SETUP === 'undefined') return false; const x = SETUP.find((y) => y.id === j.id); if (!x) return false; const t = [x.t, ...(x.steps || [])].join(' ').replace(/<[^>]+>/g, ' ');
  return /go.?live|🚀/i.test(x.t) || /\bbefore go.?live\b|\buntil go.?live\b|\bat go.?live\b|\bgo.?live day\b/i.test(t); }
const u19GlOn = () => !(D.settings || {}).u19glGone;
const u19GlLive = () => { try { return !!(D.settings && +D.settings.liveAt && +D.settings.liveAt <= Date.now() && (typeof u8Live !== 'function' || u8Live())); } catch (e) { return false; } };
/* the admin job list (Settings → Admin jobs) leaves the go-live ones out; they're on Jobs → 🚀 Go-live */
const u19SetupAll = typeof setupJobs === 'function' ? setupJobs : () => [];
const u19GlJobs = () => u19SetupAll().filter(u19GoLive);
if (typeof setupJobs === 'function') { setupJobs = function () { const L = u19SetupAll.apply(this, arguments); return u19GlOn() ? L.filter((j) => !u19GoLive(j)) : L; }; window.setupJobs = setupJobs; }
if (typeof jobsShown === 'function') jobsShown = (function (orig) { return function () { if (u19GlOn() && S.jobAct === 'golive') return u19GlJobs(); return orig.apply(this, arguments); }; })(jobsShown);
if (typeof JOB_TYPES !== 'undefined' && !JOB_TYPES.setup) JOB_TYPES.setup = { t: 'Admin jobs', manual: true };
if (typeof renderJobs === 'function') renderJobs = (function (orig) { return function () { let html = orig.apply(this, arguments); try { if (!u19GlOn() || !(window.SBAuth && ((SBAuth.isAdmin && SBAuth.isAdmin()) || S.admin))) return html; const n = u19GlJobs().length; if (!n && S.jobAct === 'golive') { S.jobAct = 'active'; return orig.apply(this, arguments); } if (!n) return html; /* all done → the tab hides itself */
    const chip = `<button class="chip ${S.jobAct === 'golive' ? 'on' : ''}" data-act="jobact" data-v="golive"><span class="ci">🚀</span>Go-live<span class="cn">${n}</span></button>`;
    html = html.replace(/(<div class="chips" style="margin:10px 0">[\s\S]*?)(<\/div>)/, `$1${chip}$2`);
    if (S.jobAct === 'golive') html = html.replace(/(<div class="chips" style="margin:10px 0">[\s\S]*?<\/div>)/, `$1<div class="hint" style="margin:-4px 0 8px">🚀 The jobs to do before (or on) go-live — kept out of the admin job list.${u19GlLive() && S.admin ? ` <button class="btn small" data-act="u19-glgone">🗑️ Remove the Go-live tab</button>` : ''}</div>`);
  } catch (e) { console.warn('u19 go-live tab', e); } return html; }; })(renderJobs);
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=u19-glgone]'); if (!el) return; e.preventDefault(); e.stopPropagation(); if (!S.admin) return;
  if (!(await ask("Remove the 🚀 Go-live tab from Jobs?<br><span class=\"hint\">Any go-live jobs not ticked off go back to the admin job list.</span>", '🗑️ Remove it'))) return;
  D.settings.u19glGone = Date.now(); touch(D.settings); S.jobAct = 'active'; NEXT_LOG_LABEL = 'Jobs: 🚀 Go-live tab removed'; S.skipConfirm = true; await changed(); }, true);
window.u19GoLive = u19GoLive;
if (typeof SETUP !== 'undefined' && typeof U8_TRY !== 'undefined' && !SETUP.some((x) => x.id === 'chk256-golivetab')) { const id = 'chk256-golivetab', tryIt = 'Jobs → the new 🚀 Go-live chip next to Active / Inactive / All: the go-live jobs (texts and emails off until go-live, go-live day checks, the 🚀 go-live date…) are there and no longer in the admin list. After go-live an admin sees 🗑️ Remove the Go-live tab; the tab also hides itself once its jobs are all done.'; U8_TRY[id] = tryIt; U8_TO[id] = 'u13:jobs'; SETUP.push({ id, t: 'Check: 🚀 Go-live tab on Jobs', steps: [tryIt, `<button type="button" class="btn small" data-act="u8-go" data-go="u13:jobs">➡️ Take me there</button>`, 'If it does what you want, tick <b>✓ Done</b>. If not, tell Claude what\'s wrong.'] }); }
