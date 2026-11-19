/* Bovitech Super App — 2.51.1: the practice's own phone numbers and emails stay on the practice.
   An ezyVet contact (an old trial record) had Jess's mobile and the office email, so after the import it went to Google Contacts
   as its own contact and WhatsApp showed Jess's number under that name. Now:
   • importing from ezyVet leaves out the practice's numbers and emails on anyone who isn't Bovitech staff
   • sending to Google Contacts leaves them out too (except on the staff themselves)
   • a job lists any client business or person that has one, with 🗑️ Remove it from here */
const U14 = {};
function u14PracBiz() { return (D.businesses || []).find((b) => !b.gone && /^bovitech veterinary/i.test(b.name || '')) || null; }
const u14Dig = (s) => String(s || '').replace(/\D/g, '').replace(/^61(?=\d{9}$)/, '0');
function u14Prac() { /* → { nums: Map(digits → whose), mails: Map(email → whose), staff: Set(contact ids), bid } */
  const pb = u14PracBiz(); const nums = new Map(), mails = new Map(), staff = new Set();
  nums.set('0499489919', 'the practice office mobile');
  if (pb) { (pb.phones || []).forEach((p) => { const d = u14Dig(p.value); if (d.length >= 8) nums.set(d, 'the practice'); }); (pb.emails || []).forEach((e) => { const v = String(e.value || '').toLowerCase().trim(); if (v) mails.set(v, 'the practice'); });
    (IDX.bizContacts.get(pb.id) || []).forEach((c) => { staff.add(c.id); [...(c.mobiles || []), ...(c.landlines || [])].forEach((p) => { const d = u14Dig(p.value); if (d.length >= 8) nums.set(d, fullName(c)); }); (c.emails || []).forEach((e) => { const v = String(e.value || '').toLowerCase().trim(); if (v) mails.set(v, fullName(c)); }); }); }
  return { nums, mails, staff, bid: pb ? pb.id : null }; }
const u14IsPracMail = (v, P) => { const s = String(v || '').toLowerCase().trim(); return !!s && (P.mails.has(s) || /@bovitech\.com\.au$/.test(s)); };
const u14IsPracNum = (v, P) => P.nums.has(u14Dig(v));
window.u14Prac = u14Prac;

/* ---------- ezyVet import: leave the practice's numbers and emails off clients ---------- */
if (typeof ezApplyClients === 'function') ezApplyClients = (function (orig) { return function (P) {
  try { const PR = u14Prac(); (P.clients || []).forEach((c) => { const ph = (c.phones || []).filter((p) => u14IsPracNum(p.v, PR)), em = (c.emails || []).filter((p) => u14IsPracMail(p.v, PR));
    if (!ph.length && !em.length) return; c.phones = (c.phones || []).filter((p) => !ph.includes(p)); c.emails = (c.emails || []).filter((p) => !em.includes(p));
    (P.skip = P.skip || []).push({ what: 'Phone / email', name: `${c.name}: ${[...ph.map((p) => p.v), ...em.map((p) => p.v)].join(', ')}`, id: c.id, why: "the practice's own number or email — left off this client", code: '' }); }); } catch (e) { console.warn('u14 import guard', e); }
  return orig.apply(this, arguments); }; })(ezApplyClients);

/* ---------- Google Contacts: never send the practice's numbers on someone else ---------- */
(function () { const G = typeof GContacts !== 'undefined' ? GContacts : null; if (!G || typeof G.person !== 'function') return;
  G.person = (function (orig) { return function (c) { const p = orig.apply(this, arguments); try { const PR = u14Prac(); const isStaff = c && (PR.staff.has(c.id) || (c._biz && c._biz.id === PR.bid) || (c.links || []).some((l) => l.bid === PR.bid)); if (isStaff) return p;
    p.phoneNumbers = (p.phoneNumbers || []).filter((x) => !u14IsPracNum(x.value, PR)); p.emailAddresses = (p.emailAddresses || []).filter((x) => !u14IsPracMail(x.value, PR)); } catch (e) { console.warn('u14 google guard', e); } return p; }; })(G.person); })();

/* ---------- the job ---------- */
if (typeof JOB_TYPES !== 'undefined') JOB_TYPES.u14prac = { t: "Practice phone number or email on a client", manual: true };
function u14Hits() { const PR = u14Prac(); const out = [];
  (D.businesses || []).forEach((b) => { if (b.gone || b.id === PR.bid) return; const ph = (b.phones || []).filter((p) => u14IsPracNum(p.value, PR)), em = (b.emails || []).filter((p) => u14IsPracMail(p.value, PR)); if (ph.length || em.length) out.push({ kind: 'business', rec: b, ph, em }); });
  (D.contacts || []).forEach((c) => { if (c.gone || PR.staff.has(c.id)) return; const ph = [...(c.mobiles || []), ...(c.landlines || [])].filter((p) => u14IsPracNum(p.value, PR)), em = (c.emails || []).filter((p) => u14IsPracMail(p.value, PR)); if (ph.length || em.length) out.push({ kind: 'contact', rec: c, ph, em }); });
  return out.map((x) => ({ ...x, whose: [...x.ph.map((p) => PR.nums.get(u14Dig(p.value)) || 'the practice'), ...x.em.map((p) => PR.mails.get(String(p.value).toLowerCase().trim()) || 'the practice')] })); }
function u14Jobs() { const dis = D.dismissed || {}; return u14Hits().map((x) => { const id = x.rec.id; const vals = [...x.ph, ...x.em].map((p) => p.value); const key = `u14prac:${id}:${vals.map(u14Dig).join('.')}${x.em.length ? ':' + x.em.length : ''}`; if (dis[key]) return null;
  return { type: 'u14prac', key, kind: x.kind, id, who: x.kind === 'business' ? x.rec.name : fullName(x.rec), note: `Has the practice's own ${x.ph.length ? (x.em.length ? 'number and email' : 'number') : 'email'}.`, herdpull: 'u14', u14prac: { kind: x.kind, id } }; }).filter(Boolean); }
if (typeof herdJobs === 'function') herdJobs = (function (orig) { return function () { let L = []; try { L = orig.apply(this, arguments) || []; } catch (e) { console.warn(e); } try { L = L.concat(u14Jobs()); } catch (e) { console.warn(e); } return L; }; })(herdJobs);
if (typeof herdJobHtml === 'function') herdJobHtml = (function (orig) { return function (j) { if (!j || !j.u14prac) return orig.apply(this, arguments);
  const x = u14Hits().find((y) => y.rec.id === j.u14prac.id); if (!x) return ''; const link = x.kind === 'business' ? (typeof u13BizA === 'function' ? u13BizA(x.rec) : h(x.rec.name)) : (typeof u13PersonA === 'function' ? u13PersonA(x.rec) : h(fullName(x.rec)));
  const rows = [...x.ph, ...x.em].map((p, i) => `<div>${h(p.value)} <span class="hint">— ${h(x.whose[i])}</span></div>`).join('');
  return `</div><div style="width:100%"><div>On ${link}:</div>${rows}<div class="hint">Phones and Google Contacts match callers by number, so a practice number on a client makes calls and WhatsApp show the wrong name.</div>
    <div class="actions"><button class="btn small primary" data-act="u14-remove" data-kind="${x.kind}" data-id="${h(x.rec.id)}">🗑️ Remove it from here</button><button class="btn small greenbtn" data-act="job-dismiss" data-key="${h(j.key)}">✓ It's right — leave it</button></div></div><div>`; }; })(herdJobHtml);
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=u14-remove]'); if (!el) return; e.preventDefault(); e.stopPropagation();
  const x = u14Hits().find((y) => y.rec.id === el.dataset.id); if (!x) return; const r = x.rec; const nm = x.kind === 'business' ? r.name : fullName(r); const vals = [...x.ph, ...x.em].map((p) => p.value);
  if (!(await ask(`Take ${vals.join(' and ')} off ${nm}?<br>It's the practice's own. Their Google contact is updated at the next send.`, '🗑️ Remove'))) return;
  const PR = u14Prac(); if (x.kind === 'business') { r.phones = (r.phones || []).filter((p) => !u14IsPracNum(p.value, PR)); r.emails = (r.emails || []).filter((p) => !u14IsPracMail(p.value, PR)); }
  else { r.mobiles = (r.mobiles || []).filter((p) => !u14IsPracNum(p.value, PR)); r.landlines = (r.landlines || []).filter((p) => !u14IsPracNum(p.value, PR)); r.emails = (r.emails || []).filter((p) => !u14IsPracMail(p.value, PR)); }
  touch(r); if (typeof JOBS_CACHE !== 'undefined') JOBS_CACHE = null; NEXT_LOG_LABEL = `${nm}: removed the practice's own ${vals.join(', ')}`; S.skipConfirm = true; if (await changed()) toast(`✓ Removed from ${nm}`); }, true);
window.u14Jobs = u14Jobs; window.u14Hits = u14Hits;

/* ---------- admin check job ---------- */
if (typeof SETUP !== 'undefined' && typeof U8_TRY !== 'undefined') [['chk2512-gphoto', 'Check: 📷 Google Contacts caller photos', 'Settings → Sync & sign-in → Caller photos (on the device that keeps Google Contacts up to date): tap Update now. It sends names and numbers 100 at a time, then the caller photos. When it says Up to date, check a Bovitech staff contact on a phone shows the staff photo. Anything Google wouldn\'t take is listed under ⚠️ Couldn\'t be sent with the reason.', 'settings'], ['chk2511-pracnum', "Check: 📵 practice numbers stay on the practice", "Jobs → \"Practice phone number or email on a client\": lists any client business or person with a staff mobile, the office mobile or a bovitech.com.au email, with 🗑️ Remove it from here. Sending to Google Contacts and importing from ezyVet now leave these off clients.", 'u13:jobs']].forEach(([id, t, tryIt, go]) => { U8_TRY[id] = tryIt; U8_TO[id] = go; if (SETUP.some((x) => x.id === id)) return; SETUP.push({ id, t, steps: [tryIt, `<button type="button" class="btn small" data-act="u8-go" data-go="${go}">➡️ Take me there</button>`, 'If it does what you want, tick <b>✓ Done</b>. If not, tell Claude what\'s wrong.'] }); });
