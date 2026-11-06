/* Bovitech Super App — v2.29: booking rules read from the comments.
   The app reads each client's preg testing and bull testing comments (📅 Scheduling) and the booking notes, and turns what it
   understands into rules — speed, timing, morning/afternoon, people needed, yearlings, heifers/cows only, never tested before,
   no power, crush or yards problems, dogs, call first, who to book under, frequency and type.
   They show on the business page (📋 Booking rules) — not when booking. Jobs → "Check the booking rules read from the comments":
   ✓ Correct or ✗ Wrong for each one (or ✓ All correct). Change the comments with ✏️ and the rules are read again. */
const RL_STAFF = { jess: 'Jess', milly: 'Milly', ally: 'Ally', rory: 'Rory' };
const RL_RX = [
  ['speed', /(\d{2,4})\s*(?:hd|head)?\s*(?:\/|per|an?)\s*(?:hr|hour)\b/i, (m) => `⏱ Speed: about ${m[1]} head an hour`],
  ['timing', /(\d+)\s*(?:-|to|–)?\s*(\d+)?\s*weeks?\s*(?:after|post|from)\s*(?:the\s*)?(bulls?\s*(?:out|removal|removed|pulled)|joining|calving)/i, (m) => `📆 Timing: ${m[1]}${m[2] ? '–' + m[2] : ''} weeks after ${m[3].toLowerCase()}`],
  ['month', /\b(?:in|around|during|early|mid|late)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i, (m) => `📆 Usually ${m[0].trim()}`],
  ['ampm', /\b(early start|start early|first thing|mornings?|afternoons?|after lunch|before \d{1,2}(?:[:.]\d\d)?\s*(?:am|pm)?|after \d{1,2}(?:[:.]\d\d)?\s*(?:am|pm)?|not before \d{1,2}(?:[:.]\d\d)?\s*(?:am|pm)?)\b/i, (m) => `🕘 Time of day: ${m[1].toLowerCase()}`],
  ['people', /\b(\d|two|three|four)\s*(people|vets?|staff|helpers?|of us)\b/i, (m) => `👥 Needs ${m[1]} ${m[2].toLowerCase()}`],
  ['yearling', /\byearlings?\b/i, () => '🐂 Yearling bulls (book double time)'],
  ['heifers', /\bheifers?\s+only\b|\bonly\s+(?:the\s+)?heifers?\b/i, () => '🐄 Heifers only'],
  ['cows', /\bcows?\s+only\b|\bonly\s+(?:the\s+)?cows?\b/i, () => '🐄 Cows only'],
  ['never', /\b(never (?:been )?(?:preg|bull)?\s*tested|first time|haven'?t (?:preg |bull )?tested|not (?:done|tested) before)\b/i, () => '🆕 Has not tested before'],
  ['power', /\bno power\b|\bgenerator\b|\bno electricity\b/i, () => '🔌 No power at the yards — bring the generator / battery'],
  ['crush', /\b(crush|yards?|race)\b[^.;,]{0,25}\b(bad|poor|unsafe|old|broken|dodgy|tight|narrow|rough|dangerous)\b|\b(bad|poor|unsafe|old|broken|dodgy|dangerous)\b[^.;,]{0,15}\b(crush|yards?|race)\b/i, (m) => `⚠️ Yards / crush: ${m[0].trim()}`],
  ['dogs', /\bdogs?\b/i, (m, t) => `🐕 Dogs: ${rlSnip(t, m.index)}`],
  ['call', /\b(call|ring|phone|text)\s+(?:them\s+|him\s+|her\s+)?(before|ahead|first|when (?:leaving|on the way)|on the way)\b/i, (m) => `📞 ${m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()} ${m[2].toLowerCase()}`],
  ['who', /\b(jess|milly|ally|rory)\b/i, (m, t) => `👩‍⚕️ Mentions ${RL_STAFF[m[1].toLowerCase()]}: ${rlSnip(t, m.index)}`],
  ['freq', /\b(twice a year|2x (?:a|per) year|every (?:second|2nd|other) year|yearly|annually|every year|each year)\b/i, (m) => `🔁 Frequency: ${m[1].toLowerCase()}`],
  ['type', /\b(PNP|NDP|DP|FA|foetal ag(?:e|ing)|fetal ag(?:e|ing))\b/, (m) => `🔎 Type: ${m[1]}`]];
function rlSnip(t, i) { const a = Math.max(0, t.lastIndexOf('.', i) + 1), b = t.indexOf('.', i); return t.slice(a, b < 0 ? undefined : b).trim().slice(0, 90); }
const rlHash = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); };
function rlSources(bid) { const bs = Bk.bsched(bid); const out = []; if (bs.preg && bs.preg.comment) out.push(['Preg testing', bs.preg.comment]); if (bs.bull && bs.bull.comment) out.push(['Bull testing', bs.bull.comment]); if (bs.note) out.push(['Booking notes', bs.note]); return out; }
function rlRules(bid) { const out = []; rlSources(bid).forEach(([from, text]) => { const t = String(text); RL_RX.forEach(([k, rx, fn]) => { const m = t.match(rx); if (!m) return; m.index = m.index || t.indexOf(m[0]); const txt = fn(m, t); const id = rlHash(from + '|' + k + '|' + txt); if (!out.some((x) => x.txt === txt)) out.push({ id, k, from, txt, src: t }); }); });
  const chk = Bk.bsched(bid).ruleChk || {}; return out.map((r) => ({ ...r, st: chk[r.id] || '' })); }
function rlSet(bid, ids, st) { const id = 'bsched:' + bid; let r = Bk.get(id); const b = IDX.biz.get(bid); if (!r) { r = { id, cfg: 'bsched', bid, name: b ? b.name : '' }; D.bkcfg.push(r); } r.ruleChk = { ...(r.ruleChk || {}) }; ids.forEach((x) => { r.ruleChk[x] = st; }); touch(r); }
function rlCard(b) { if (typeof Bk === 'undefined' || !Bk.on || !Bk.on()) return ''; const R = rlRules(b.id).filter((r) => r.st !== 'no'); if (!R.length) return '';
  return `<div class="card rlcard"><h3><span class="sp">📋 Booking rules</span><button class="btn small" data-act="rl-editc" data-bid="${b.id}" title="Change the comments">✏️</button></h3><div class="hint" style="margin-bottom:4px">Read from their preg testing / bull testing comments and booking notes.</div>${R.map((r) => `<div class="kv" style="align-items:center"><div class="v">${h(r.txt)}${r.st === 'ok' ? ' <span class="hint">✓</span>' : ' <span class="bk-pill" style="background:#fff3cd;color:#7a5a00">to check</span>'}<br><span class="hint">${h(r.from)}: “${h(r.src.slice(0, 140))}${r.src.length > 140 ? '…' : ''}”</span></div>${r.st === 'ok' ? '' : `<button class="btn small greenbtn" data-act="rl-set" data-bid="${b.id}" data-ids="${r.id}" data-v="ok">✓</button><button class="btn small" data-act="rl-set" data-bid="${b.id}" data-ids="${r.id}" data-v="no">✗</button>`}</div>`).join('')}</div>`; }
if (typeof bizDetail === 'function') bizDetail = (function (orig) { return function (b) { const html = orig.apply(this, arguments); const c = rlCard(b); if (!c) return html; const at = html.indexOf('<div class="card"><h3><span class="sp">General info'); return at > 0 ? html.slice(0, at) + c + html.slice(at) : html + c; }; })(bizDetail);
/* Jobs → Contacts: check them */
if (typeof JOB_TYPES !== 'undefined') JOB_TYPES.rlcheck = { t: 'Check the booking rules read from the comments', manual: true };
function rlJobs() { if (typeof Bk === 'undefined' || !Bk.on || !Bk.on()) return []; const out = []; Bk.cfg('bsched').forEach((bs) => { const b = IDX.biz.get(bs.bid); if (!b || b.gone) return; const R = rlRules(b.id).filter((r) => !r.st); if (!R.length) return;
  out.push({ type: 'rlcheck', key: 'rlcheck:' + b.id + ':' + R.map((r) => r.id).join('.'), kind: 'business', id: b.id, who: `${b.name} — booking rules to check`, note: `${R.length} rule${R.length === 1 ? '' : 's'} read from their comments — are they right?`, rlcheck: b.id }); }); return out; }
function rlJobHtml(j) { const R = rlRules(j.rlcheck).filter((r) => !r.st); return `</div><div style="width:100%">${R.map((r) => `<div class="kv" style="align-items:center"><div class="v">${h(r.txt)}<br><span class="hint">${h(r.from)}: “${h(r.src.slice(0, 160))}${r.src.length > 160 ? '…' : ''}”</span></div><button class="btn small greenbtn" data-act="rl-set" data-bid="${j.rlcheck}" data-ids="${r.id}" data-v="ok">✓ Correct</button><button class="btn small" data-act="rl-set" data-bid="${j.rlcheck}" data-ids="${r.id}" data-v="no">✗ Wrong</button></div>`).join('')}
  <div class="actions"><button class="btn small greenbtn" data-act="rl-set" data-bid="${j.rlcheck}" data-ids="${R.map((r) => r.id).join(',')}" data-v="ok">✓ All correct</button><button class="btn small" data-act="rl-editc" data-bid="${j.rlcheck}">✏️ Change the comments</button></div></div><div>`; }
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=rl-set],[data-act=rl-editc]'); if (!el) return; e.stopPropagation(); e.preventDefault();
  if (el.dataset.act === 'rl-editc') { if (typeof bkBschedOpen === 'function') bkBschedOpen(el.dataset.bid); return; }
  rlSet(el.dataset.bid, el.dataset.ids.split(','), el.dataset.v); JOBS_CACHE = null; NEXT_LOG_LABEL = `Booking rules checked: ${(IDX.biz.get(el.dataset.bid) || {}).name || ''}`; S.skipConfirm = true; await changed(); }, true);
window.rlRules = rlRules; window.rlJobs = rlJobs; window.rlJobHtml = rlJobHtml; window.rlCard = rlCard;
