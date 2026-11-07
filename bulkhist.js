/* Bovitech Super App — v2.23: past call sheets (preg testing, bull testing and AI, 2023–2026) and ezyVet invoices → the bulk lists.
   Load the history file once (Scheduling → Bulk lists → 📥). It works out who's an early, late or both-times tester, who's regular
   (did it this year or last), head counts (cows + heifers, bulls), preferred months and AI programs — and matches each line to a client.
   Lines it can't match are listed to match by hand. The file holds client details, so it isn't part of the app's code. */
const BH = { res: null };
const bhNorm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\(.*?\)/g, ' ').replace(/\b(pty|ltd|the|trust|family|co|company|and|trading as|t\/as)\b/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
function bhMatch(row) { /* → a business, or null */ const biz = D.businesses.filter((b) => !b.gone);
  if (row.ezy && row.ezy.length) { const b = biz.find((x) => (x.ezyIds || []).some((id) => row.ezy.includes(String(id)))); if (b) return b; }
  if (row.trade) { const t = bhNorm(row.trade); const b = biz.find((x) => bhNorm(x.name) === t); if (b) return b; }
  const sur = bhNorm(row.sur), firsts = String(row.first || '').split(/\s*(?:&|\+|and|\/)\s*/).map((x) => bhNorm(x).split(' ')[0]).filter(Boolean);
  if (sur) { const cs = D.contacts.filter((c) => !c.gone && bhNorm(c.last) === sur && (!firsts.length || firsts.includes(bhNorm(c.first).split(' ')[0]) || firsts.includes(bhNorm(c.pref || '').split(' ')[0]))); const bs = [...new Set(cs.flatMap((c) => bizOf(c)))].filter((b) => !b.gone); if (bs.length === 1) return bs[0]; if (bs.length > 1) { const cl = bs.filter((b) => typeof isClientBiz !== 'function' || isClientBiz(b)); if (cl.length === 1) return cl[0]; } }
  return null; }
const BH_SEASON = { pd: (m) => (m >= 6 || m === 1 ? 'early' : 'late'), bbse: (m) => ([12, 1, 2].includes(m) ? 'early' : m >= 3 && m <= 6 ? 'late' : 'spring'), ai: (m) => (m >= 4 && m <= 8 ? 'early' : m >= 9 ? 'late' : 'other') };
function bhApply(data) { const per = {}; const unm = []; const add = (b, k) => { per[b.id] = per[b.id] || { b, k: {} }; per[b.id].k[k] = per[b.id].k[k] || { years: {}, ezy: null }; return per[b.id].k[k]; };
  D.businesses.filter((b) => !b.gone && (b.ezyIds || []).length).forEach((b) => b.ezyIds.forEach((id) => { const e = (data.ezy || {})[String(id)]; if (!e) return; ['pd', 'bbse', 'ai'].forEach((k) => { if (e[k]) add(b, k).ezy = e[k]; }); }));
  (data.rows || []).forEach((r) => { const b = bhMatch(r); if (!b) { unm.push(r); return; } const x = add(b, r.k); x.years[r.yr] = { status: r.status || '', code: r.code || '', cows: +r.cows || 0, heifers: +r.heifers || 0, bulls: +r.bulls || 0, months: [r.mh, r.mc, r.month].filter(Boolean).map(Number), type: r.type || '', sub: r.sub || '', notes: r.notes || '', progs: r.progs || null, name: r.name }; });
  let set = 0, both = 0, ask = 0;
  Object.values(per).forEach(({ b, k }) => { const id = 'bsched:' + b.id; let bs = Bk.get(id); if (!bs) { bs = { id, cfg: 'bsched', bid: b.id, name: b.name }; D.bkcfg.push(bs); }
    const hist = { ...(bs.hist || {}) }; const bulk = { ...(bs.bulk || {}) };
    Object.entries(k).forEach(([kk, x]) => { const yrs = Object.keys(x.years).map(Number); const done = yrs.filter((y) => /^1|^2|^3|complet|schedul/i.test((x.years[y].code || '') + ' ' + (x.years[y].status || '')));
      const months = [...new Set([...(x.ezy ? x.ezy.months || [] : []), ...yrs.flatMap((y) => x.years[y].months)])];
      const seas = new Set(months.map(BH_SEASON[kk]));
      let cls = x.ezy ? (kk === 'bbse' && x.ezy.cls === 'other' ? 'spring' : x.ezy.cls) : seas.has('early') && seas.has('late') ? 'both' : seas.has('early') ? 'early' : seas.has('late') ? 'late' : seas.has('other') ? 'other' : '';
      if (kk === 'ai' && !x.ezy) { const st = yrs.flatMap((y) => (x.years[y].progs || []).map((p) => p.start)).filter(Boolean).map((d) => +d.slice(5, 7)); const ss = new Set(st.map(BH_SEASON.ai)); cls = ss.has('early') && ss.has('late') ? 'both' : ss.has('early') ? 'early' : ss.has('late') ? 'late' : ss.has('other') ? 'other' : cls; }
      const lastY = Math.max(0, ...done, x.ezy ? +x.ezy.last.slice(0, 4) : 0);
      hist[kk] = { cls, last: x.ezy ? x.ezy.last : lastY ? lastY + '-12-31' : null, years: x.years, cows: Math.max(0, ...yrs.map((y) => (x.years[y].cows || 0) + (x.years[y].heifers || 0))) || null, bulls: Math.max(0, ...yrs.map((y) => x.years[y].bulls || 0)) || null, months };
      if (!bulk[kk] && ['early', 'late', 'both', 'spring'].includes(cls)) { bulk[kk] = cls; set++; if (cls === 'both') both++; } else if (!bulk[kk] && kk === 'ai' && cls === 'other') { bulk[kk] = 'other'; set++; } else if (!bulk[kk]) ask++; });
    bs.hist = hist; bs.bulk = bulk; touch(bs); });
  let u = Bk.get('bulkhist'); if (!u) { u = { id: 'bulkhist', cfg: 'bulkhist' }; D.bkcfg.push(u); } u.at = Date.now(); u.unm = unm.map((r) => ({ k: r.k, yr: r.yr, name: r.name, sur: r.sur, first: r.first, trade: r.trade, status: r.status || '', cows: r.cows || 0, heifers: r.heifers || 0, bulls: r.bulls || 0, mh: r.mh, mc: r.mc, month: r.month, type: r.type || '', notes: r.notes || '', progs: r.progs || null })); touch(u);
  return { clients: Object.keys(per).length, set, both, ask, unm: unm.length }; }
function bhMatchOne(i, bid) { const u = Bk.get('bulkhist'); const r = u && (u.unm || [])[i]; const b = IDX.biz.get(bid); if (!r || !b) return; bhApply({ ezy: {}, rows: [{ ...r, trade: b.name, sur: '', first: '', ezy: [] }] }); const u2 = Bk.get('bulkhist'); u2.unm = (u.unm || []).filter((_, j) => j !== i); touch(u2); }
/* one line on each list row: what the history says */
function bkHistLine(r, l) { const hi = r.hi || {}; const bits = []; if (hi.cows && l.key === 'pd') bits.push(`~${hi.cows} cows + heifers`); if (hi.bulls && l.key === 'bbse') bits.push(`~${hi.bulls} bulls`);
  const yrs = Object.keys(hi.years || {}).sort().slice(-1)[0]; const y = yrs && hi.years[yrs]; if (y && y.months && y.months.length) bits.push('usually ' + [...new Set(y.months)].map((m) => ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]).join('/'));
  if (y && y.progs) bits.push(y.progs.map((p) => `${p.what} ${p.head}hd${p.start ? ' from ' + bkDate(p.start, { day: 'numeric', month: 'short' }) : ''}`).join(', '));
  if (y && y.type && l.key === 'pd') bits.push(String(y.type)); return bits.length ? '<br>' + h(bits.join(' · ')) : ''; }
function bkHistCard() { const u = Bk.get('bulkhist'); const unm = (u && u.unm) || [];
  if (u && u.at && !unm.length) return `<div class="hint" style="margin:0 0 8px">📥 Call sheet history loaded ${new Date(u.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} — early / late / regular and head counts come from it.</div>`;
  const dl = `<datalist id="bh-biz">${D.businesses.filter((b) => !b.gone && (typeof isClientBiz !== 'function' || isClientBiz(b))).map((b) => `<option value="${h(b.name)}">`).join('')}</datalist>`;
  return `<div class="card"><h3>📥 Past call sheets (2023–2026)</h3>${u && u.at ? `<div class="hint">Loaded ${new Date(u.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}. ${unm.length} line${unm.length === 1 ? '' : 's'} couldn't be matched to a client — choose the client for each (or leave it).</div>` : `<div class="hint">Choose the call history file Claude made from your PD, BBSE and AI call sheets and the ezyVet invoices. It sorts clients into early, late and both-times testers, marks the regular ones and adds head counts. Clients you've already sorted keep your choice.</div><div class="actions"><label class="btn small primary" style="cursor:pointer">📥 Choose the call history file<input type="file" accept=".json,application/json" data-act="bh-file" hidden></label></div>`}
    ${unm.slice(0, 60).map((r, i) => `<div class="kv bh-row" style="align-items:center;flex-wrap:wrap"><div class="v" style="flex:1;min-width:200px"><b>${h(r.name)}</b> <span class="hint">${({ pd: 'Preg testing', bbse: 'Bull testing', ai: 'AI' })[r.k]} ${r.yr}${r.status ? ' · ' + h(r.status) : ''}</span></div><input list="bh-biz" data-bhi="${i}" aria-label="Client" style="min-width:180px"><button class="btn small" data-act="bh-match" data-i="${i}">Match</button><button class="btn small" data-act="bh-skip" data-i="${i}">✕</button></div>`).join('')}${unm.length > 60 ? `<div class="hint">…and ${unm.length - 60} more</div>` : ''}${dl}</div>`; }
document.addEventListener('change', async (e) => { const el = e.target; if (!el.dataset || el.dataset.act !== 'bh-file' || !el.files || !el.files[0]) return; let data; try { data = JSON.parse(await el.files[0].text()); } catch (er) { toast("That isn't the call history file"); return; } if (!data || !data.rows) { toast("That isn't the call history file"); return; }
  const r = bhApply(data); NEXT_LOG_LABEL = `Call sheet history loaded: ${r.clients} clients`; S.skipConfirm = true; await changed(); toast(`📥 ${r.clients} clients: ${r.set} sorted (${r.both} both times), ${r.ask} to sort, ${r.unm} lines to match`); });
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el || !/^bh-/.test(el.dataset.act)) return; const a = el.dataset.act; const i = +el.dataset.i;
  if (a === 'bh-match') { const inp = document.querySelector(`[data-bhi="${i}"]`); const nm = (inp && inp.value || '').trim().toLowerCase(); const b = D.businesses.find((x) => !x.gone && (x.name || '').toLowerCase() === nm); if (!b) { toast('Choose the client from the list'); return; } bhMatchOne(i, b.id); NEXT_LOG_LABEL = `Call sheet line matched to ${b.name}`; S.skipConfirm = true; await changed(); }
  if (a === 'bh-skip') { const u = Bk.get('bulkhist'); if (!u) return; u.unm = (u.unm || []).filter((_, j) => j !== i); touch(u); S.skipConfirm = true; await changed(); } });
/* head counts for herd details when there are no bookings yet */
/* herd numbers fall back to the call sheet history — that's in herd.js now */
(function () { const st = document.createElement('style'); st.textContent = '.bk-bulkgrp{margin:10px 0 2px;font-weight:800}'; document.head.appendChild(st); })();
window.bkHistLine = bkHistLine; window.bkHistCard = bkHistCard; window.bhApply = bhApply;
/* v2.30: admin job — explain the old call sheets, so the app can use them properly */
if (typeof SETUP !== 'undefined' && !SETUP.some((x) => x.id === 'callsheets')) SETUP.push({ id: 'callsheets', t: 'Explain the old call sheets (2023–2026) to Claude', steps: [
  'The call sheets are loaded (Scheduling → Bulk lists → 📥). Some of what\'s in them isn\'t clear yet. In a Claude chat, explain each of these, then tap ✓ Done:',
  '<b>Codes</b> in the code column: <b>1</b>, <b>2</b>, <b>2.1</b>, <b>4.3</b>, <b>5.1</b>, <b>5.2</b>, <b>5.5</b>, <b>6</b>, <b>8</b>, <b>8.1</b>, <b>8.2</b>, <b>10</b> — what does each one mean?',
  '<b>Status</b> words: completed - all, scheduled, scheduled - half, no, no - call again next year, no - remove from next year\'s list, left sms, ring later in season, need to ring, yes waiting on info, new client - call next season, cancelled — are any of these special (for example, should "remove from next year\'s list" take them off the bulk list)?',
  '<b>Preg testing</b>: the two month columns next to heifers and cows (e.g. 8 and 9) — are they the months the heifers and cows were tested, or something else? And the date column (e.g. 28/05/2024) — is it the date the bulls went in (joining)?',
  '<b>Type</b>: DP/NDP, PNP, Full, FA - all, FA - some, FA - heifers, TBC — is "Full" the same as FA (foetal ageing) for everything?',
  '<b>Bull testing</b>: the month column, and Pre-mating / Pre-sale — anything else they mean?',
  '<b>AI programs</b>: the PG, ODB, ECP and GnRH numbers on each program — are they mL ordered or used, or number of doses?'],
  auto: () => false });
