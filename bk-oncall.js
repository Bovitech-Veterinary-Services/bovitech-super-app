/* Bovitech Super App — Scheduling, part 4 of 4: the on-call roster.
   One vet per day, midnight to midnight. A repeating pattern (1–4 weeks long) fills the roster; any single day can be
   changed by hand, and changed back to the pattern. Export as CSV (for the vControl call-flow system) and keep a
   "Bovitech On Call" Google Calendar up to date from one device. */
'use strict';
function bkOncallRec(date) { const o = Bk.list('oncall').find((x) => x.id === date); return o && o.who !== undefined && !o.gone ? o : null; } // a day changed by hand (who: null = nobody)
function bkOncallPat() { const p = Bk.get('ocpat'); return p && !p.gone && p.start ? p : null; }
function bkOncallFromPat(date) { const p = bkOncallPat(); if (!p) return null; const w = ((Math.floor(bkDays(p.start, bkWeekStart(date)) / 7) % p.weeks) + p.weeks) % p.weeks; return (p.grid || {})[w + '-' + bkDow(date)] || null; }
function bkOncallWho(date) { const r = bkOncallRec(date); return r ? r.who : bkOncallFromPat(date); }
function bkOncallSet(date, who) { // who: a person, null (nobody), or undefined (back to the pattern)
  let o = Bk.list('oncall').find((x) => x.id === date); if (!o) { o = { id: date, date }; D.oncall.push(o); }
  delete o.all; delete o.night; delete o.evening; delete o.gone; if (who === undefined) delete o.who; else o.who = who; touch(o);
}
const BK_DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
function bkRosterHtml() {
  const vets = Bk.people().filter((s) => s.role === 'vet'); const a = bkWeekStart(BK.date); const days = [...Array(28)].map((_, i) => bkAdd(a, i)); const ed = Bk.can('roster');
  const p = Bk.get('ocpat') || { weeks: 2, start: bkWeekStart(bkToday()), grid: {} }; const pat = bkOncallPat();
  const sel = (d) => { const rec = bkOncallRec(d), pw = bkOncallFromPat(d); const cur = rec ? (rec.who === null ? '__none' : rec.who) : pw ? '__pat' : '';
    return `<select data-act="bk-oc" data-d="${d}" ${ed ? '' : 'disabled'} aria-label="On call ${bkDate(d)}">${!pw && !rec ? '<option value="">Choose…</option>' : ''}${pw ? `<option value="__pat" ${cur === '__pat' ? 'selected' : ''}>${h(Bk.pname(pw))} (pattern)</option>` : ''}${vets.map((s) => `<option value="${s.id}" ${cur === s.id ? 'selected' : ''}>${h(s.preferred_name || s.full_name)}</option>`).join('')}<option value="__none" ${cur === '__none' ? 'selected' : ''}>Nobody</option></select>`; };
  const cell = (w, dw) => `<select data-act="ocp-cell" data-k="${w}-${dw}" ${ed ? '' : 'disabled'} aria-label="Week ${w + 1} ${DOW_NAMES[dw]}"><option value="">—</option>${vets.map((s) => `<option value="${s.id}" ${(p.grid || {})[w + '-' + dw] === s.id ? 'selected' : ''}>${h(s.initials || s.preferred_name)}</option>`).join('')}</select>`;
  const cycleWeek = (d) => (pat ? (((Math.floor(bkDays(pat.start, bkWeekStart(d)) / 7) % pat.weeks) + pat.weeks) % pat.weeks) + 1 : null);
  return `<div class="d-wrap bk-wrap"><div class="bk-top"><div class="bk-nav"><b class="bk-title">On-call roster</b></div>
    <div class="bk-nav"><button class="btn small" data-act="bk-rgo" data-v="-28">‹ 4 weeks</button><button class="btn small" data-act="bk-rgo" data-v="28">4 weeks ›</button></div></div>
  ${bkAiCard('roster')}
  <div class="hint" style="margin-bottom:8px">One vet on call each day, midnight to midnight. The usual pattern fills the roster; change any day by hand (it says "changed"), or pick the "(pattern)" choice to put it back.${ed ? '' : ' You can see the roster but not change it.'}</div>
  <details class="card" ${BK.ocpOpen || !pat ? 'open' : ''} data-ocp="1"><summary><b>🔁 Usual pattern</b> <span class="hint">${pat ? `${pat.weeks}-week cycle` : 'not set yet'}</span></summary>
    <div class="grid2" style="margin-top:6px"><div class="f"><label for="ocp-weeks">Repeats every</label><select id="ocp-weeks" data-act="ocp-weeks" ${ed ? '' : 'disabled'}>${[1, 2, 3, 4].map((n) => `<option value="${n}" ${(p.weeks || 2) === n ? 'selected' : ''}>${n} week${n === 1 ? '' : 's'}</option>`).join('')}</select></div>
      <div class="f"><label for="ocp-start">Week 1 starts on (a Monday)</label><input id="ocp-start" type="date" data-act="ocp-start" value="${p.start || ''}" ${ed ? '' : 'disabled'}></div></div>
    <div class="bk-dayscroll"><table class="bk-ocpat"><thead><tr><th></th>${BK_DOW_ORDER.map((dw) => `<th>${DOW_NAMES[dw]}</th>`).join('')}</tr></thead><tbody>${[...Array(p.weeks || 2)].map((_, w) => `<tr><th>Week ${w + 1}</th>${BK_DOW_ORDER.map((dw) => `<td>${cell(w, dw)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${ed ? `<div class="actions" style="margin-top:6px"><button class="btn small" data-act="ocp-usual">Fill in our usual pattern (Jess and Milly)</button></div><div class="hint">Jess every Friday, Milly every Monday, every second weekend each, Thursday goes to whoever isn't on that weekend, and Tuesday + Wednesday alternate weekly. Check it, then change any cell.</div>` : ''}</details>
  <details class="card"><summary><b>⬇ Export (CSV)</b> <span class="hint">for vControl</span></summary>
    <div class="grid2" style="margin-top:6px"><div class="f"><label for="oc-from">From</label><input id="oc-from" type="date" value="${bkToday()}"></div><div class="f"><label for="oc-to">To</label><input id="oc-to" type="date" value="${bkAdd(bkToday(), 90)}"></div></div>
    <div class="actions"><button class="btn small primary" data-act="oc-csv">Download CSV</button></div><div class="hint">One row per day: date, day, start 00:00, end 23:59, vet and their mobile (set mobiles in Settings → Scheduling → People).</div></details>
  ${bkOcGoogleLine()}
  <div class="bk-dayscroll"><table class="bk-roster"><thead><tr><th>Day</th><th>On call (midnight to midnight)</th><th></th></tr></thead><tbody>
  ${days.map((d) => { const rec = bkOncallRec(d); return `<tr class="${Bk.weekend(d) ? 'we' : ''} ${d === bkToday() ? 'today' : ''}"><th>${bkDate(d)}${pat ? ` <span class="hint">wk ${cycleWeek(d)}</span>` : ''}</th><td>${sel(d)}</td><td>${rec && bkOncallFromPat(d) !== rec.who ? '<span class="hint">changed</span>' : ''}</td></tr>`; }).join('')}
  </tbody></table></div></div>`;
}
function bkOcPatRec() { let p = Bk.get('ocpat'); if (!p) { p = { id: 'ocpat', cfg: 'ocpat', name: 'On-call pattern', weeks: 2, start: bkWeekStart(bkToday()), grid: {} }; D.bkcfg.push(p); } return p; }
function bkOcCsv(from, to) {
  const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`; const rows = [['Date', 'Day', 'Start', 'End', 'On call', 'Mobile'].map(q).join(',')];
  for (let d = from; d <= to; d = bkAdd(d, 1)) { const w = bkOncallWho(d); const p = w && Bk.person(w); const c = p ? Bk.scfg(p) : {}; rows.push([d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4), DOW_NAMES[bkDow(d)], '00:00', '23:59', w ? (p ? p.full_name : Bk.pname(w)) : '', c.mobile || ''].map(q).join(',')); }
  return rows.join('\r\n') + '\r\n';
}
document.addEventListener('change', (e) => { const el = e.target; const a = el.dataset && el.dataset.act; if (!a || !/^ocp-/.test(a)) return; if (!Bk.need('roster')) { renderAll(); return; }
  const p = bkOcPatRec();
  if (a === 'ocp-cell') { p.grid = { ...(p.grid || {}) }; if (el.value) p.grid[el.dataset.k] = el.value; else delete p.grid[el.dataset.k]; }
  if (a === 'ocp-weeks') p.weeks = +el.value || 2;
  if (a === 'ocp-start' && el.value) p.start = bkWeekStart(el.value);
  touch(p); BK.ocpOpen = true; save(); Sync.soon(); renderAll(); });
document.addEventListener('toggle', (e) => { if (e.target.dataset && e.target.dataset.ocp) BK.ocpOpen = e.target.open; }, true);
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act;
  if (a === 'bk-rgo') { BK.date = bkAdd(BK.date, +el.dataset.v); renderAll(); }
  else if (a === 'ocp-usual') { if (!Bk.need('roster')) return; const ppl = Bk.people(); const J = ppl.find((s) => /^jess/i.test(s.preferred_name || s.full_name)), M = ppl.find((s) => /^(milly|amelia)/i.test(s.preferred_name || s.full_name));
    if (!J || !M) { toast("Couldn't find Jess and Milly on the staff list"); return; } if (Object.keys((Bk.get('ocpat') || {}).grid || {}).length && !(await ask('Replace the pattern you have with the usual Jess and Milly pattern?', 'Yes — replace it'))) return;
    const p = bkOcPatRec(); const j = J.id, m = M.id; p.weeks = 2; p.grid = { '0-1': m, '0-2': j, '0-3': j, '0-4': m, '0-5': j, '0-6': j, '0-0': j, '1-1': m, '1-2': m, '1-3': m, '1-4': j, '1-5': j, '1-6': m, '1-0': m };
    touch(p); BK.ocpOpen = true; bkDone('Usual pattern filled in — week 1 is Jess\'s weekend. Change the start week if it\'s the other way round.'); }
  else if (a === 'oc-csv') { const f = (document.getElementById('oc-from') || {}).value, t = (document.getElementById('oc-to') || {}).value; if (!f || !t || t < f) { toast('Choose the dates'); return; }
    const blob = new Blob([bkOcCsv(f, t)], { type: 'text/csv' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `on-call-${f}-to-${t}.csv`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); toast('On-call list downloaded'); }
  else if (a === 'ocg-connect') { if (!SBAuth.isAdmin()) return; try { await OcG.get(true); await OcG.ensureCal(); try { localStorage.setItem('bvp-ocgcal', '1'); } catch (x) { } const n = await OcG.sync(true); toast(`✓ Google Calendar connected — ${n} change${n === 1 ? '' : 's'} sent`); } catch (x) { toast(x.message); } renderAll(); }
  else if (a === 'ocg-sync') { try { if (!OcG.valid()) await OcG.get(true); const n = await OcG.sync(true); toast(`✓ Synced — ${n} change${n === 1 ? '' : 's'}`); } catch (x) { toast(x.message); } renderAll(); }
  else if (a === 'ocg-stop') { try { localStorage.removeItem('bvp-ocgcal'); localStorage.removeItem('bvp-ocgtok'); } catch (x) { } OcG.tok = null; toast("This device no longer updates the on-call Google Calendar"); renderAll(); }
});

/* ---------------- the "Bovitech On Call" Google Calendar (all-day events, kept up to date from one device) ---------------- */
const OcG = {
  scope: 'https://www.googleapis.com/auth/calendar', account: 'bovitechvetservices@gmail.com', name: 'Bovitech On Call', tok: null, busy: false,
  dev() { try { return localStorage.getItem('bvp-ocgcal') === '1'; } catch (e) { return false; } },
  valid() { if (!this.tok) { try { this.tok = JSON.parse(localStorage.getItem('bvp-ocgtok') || 'null'); } catch (e) { } } return !!(this.tok && Date.now() < this.tok.exp - 60000); },
  async get(interactive) {
    if (this.valid()) return this.tok.t; if (!interactive) throw Object.assign(new Error('Tap "Sync now" to sign in to Google again'), { signin: true });
    if (typeof CONFIG === 'undefined' || !CONFIG.googleClientId) throw new Error('Google sign-in is not set up yet.');
    await loadScript('https://accounts.google.com/gsi/client');
    const r = await new Promise((res, rej) => { const c = google.accounts.oauth2.initTokenClient({ client_id: CONFIG.googleClientId, scope: this.scope, hint: ((D.settings || {}).ocCal || {}).account || this.account, callback: (x) => (x.error ? rej(new Error(x.error)) : res(x)), error_callback: (e) => rej(new Error(e.type === 'popup_closed' ? 'Google sign-in was closed' : 'Google sign-in did not open — allow pop-ups for this app')) }); c.requestAccessToken({ prompt: '' }); });
    if (!google.accounts.oauth2.hasGrantedAllScopes(r, this.scope)) throw new Error('Please tick the Google Calendar box so the app can keep the on-call calendar up to date.');
    this.tok = { t: r.access_token, exp: Date.now() + r.expires_in * 1000 }; try { localStorage.setItem('bvp-ocgtok', JSON.stringify(this.tok)); } catch (e) { } return this.tok.t;
  },
  async api(path, opt = {}) { const t = await this.get(false); const r = await fetch('https://www.googleapis.com/calendar/v3' + path, { ...opt, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
    if (r.status === 401) { this.tok = null; try { localStorage.removeItem('bvp-ocgtok'); } catch (e) { } throw Object.assign(new Error('Google sign-in expired — tap "Sync now"'), { signin: true }); }
    if (r.status === 403) { const js = await r.json().catch(() => ({})); throw new Error(/has not been used|disabled/i.test(JSON.stringify(js)) ? 'The Google Calendar API isn\'t switched on for the practice\'s Google Cloud project yet (see the manual).' : 'Google refused: ' + ((js.error || {}).message || r.status)); }
    if (!r.ok && r.status !== 204 && r.status !== 410) throw new Error('Google Calendar: ' + r.status + ' ' + (await r.text()).slice(0, 160)); return r.status === 204 || r.status === 410 ? null : r.json(); },
  async ensureCal() { const cur = (D.settings || {}).ocCal || {}; if (cur.id) { try { await this.api('/calendars/' + encodeURIComponent(cur.id)); return cur.id; } catch (e) { if (e.signin) throw e; } }
    const list = await this.api('/users/me/calendarList?maxResults=250'); const found = (list.items || []).find((c) => c.summary === this.name);
    const cal = found || await this.api('/calendars', { method: 'POST', body: JSON.stringify({ summary: this.name, timeZone: 'Australia/Perth', description: 'Kept up to date by the Bovitech Super App (Scheduling → On call). Changes made here are overwritten.' }) });
    let who = ''; try { const u = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + this.tok.t } })).json(); who = u.email || ''; } catch (e) { }
    D.settings.ocCal = { id: cal.id, account: who || this.account, at: Date.now() }; touch(D.settings); save(); Sync.soon(); return cal.id; },
  want(from, to) { const m = {}; for (let d = from; d <= to; d = bkAdd(d, 1)) { const w = bkOncallWho(d); if (w) m[d] = 'On call: ' + Bk.pname(w); } return m; },
  async sync(force) { if (this.busy) return 0; this.busy = true; let n = 0;
    try { const cal = await this.ensureCal(); const from = bkAdd(bkToday(), -14), to = bkAdd(bkToday(), 180); const want = this.want(from, to);
      const key = stable(want); if (!force && key === localStorage.getItem('bvp-ocghash')) return 0;
      const have = {}; let pageToken = ''; do { const r = await this.api(`/calendars/${encodeURIComponent(cal)}/events?privateExtendedProperty=${encodeURIComponent('bvp=oncall')}&timeMin=${from}T00:00:00Z&timeMax=${bkAdd(to, 2)}T00:00:00Z&singleEvents=true&maxResults=2500${pageToken ? '&pageToken=' + pageToken : ''}`); (r.items || []).forEach((ev) => { const d = ((ev.extendedProperties || {}).private || {}).date; if (d) { if (have[d]) { this.api(`/calendars/${encodeURIComponent(cal)}/events/${ev.id}`, { method: 'DELETE' }).catch(() => {}); } else have[d] = ev; } }); pageToken = r.nextPageToken || ''; } while (pageToken);
      for (let d = from; d <= to; d = bkAdd(d, 1)) { const ev = have[d], w = want[d];
        if (w && !ev) { await this.api(`/calendars/${encodeURIComponent(cal)}/events`, { method: 'POST', body: JSON.stringify({ summary: w, start: { date: d }, end: { date: bkAdd(d, 1) }, transparency: 'transparent', description: 'From the Bovitech Super App on-call roster (midnight to midnight).', extendedProperties: { private: { bvp: 'oncall', date: d } } }) }); n++; }
        else if (w && ev && ev.summary !== w) { await this.api(`/calendars/${encodeURIComponent(cal)}/events/${ev.id}`, { method: 'PATCH', body: JSON.stringify({ summary: w }) }); n++; }
        else if (!w && ev) { await this.api(`/calendars/${encodeURIComponent(cal)}/events/${ev.id}`, { method: 'DELETE' }); n++; } }
      try { localStorage.setItem('bvp-ocghash', key); localStorage.setItem('bvp-ocgat', String(Date.now())); } catch (e) { }
      if (n || force) { D.settings.ocCal = { ...(D.settings.ocCal || {}), at: Date.now() }; touch(D.settings); save(); Sync.soon(); }
      return n;
    } finally { this.busy = false; } },
  auto() { if (!this.dev() || !navigator.onLine || !window.SBAuth || !SBAuth.staff || !this.valid() || !Bk.on()) return; this.sync(false).catch(() => {}); },
};
window.OcG = OcG;
setInterval(() => OcG.auto(), 2 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => OcG.auto(), 3000); });
document.addEventListener('pointerdown', (e) => { // Google sign-in lasts an hour: on the sync device, renew it on the next tap
  if (!OcG.dev() || OcG.renewing || !navigator.onLine || e.target.closest('#askbox, .sheet-bg')) return; if (OcG.valid() && OcG.tok.exp - Date.now() > 10 * 60000) return;
  OcG.renewing = true; OcG.tok = null; OcG.get(true).then(() => OcG.auto()).catch(() => {}).finally(() => { OcG.renewing = false; }); }, true);
function bkOcGoogleLine() { const c = (D.settings || {}).ocCal; return c && c.id ? `<div class="hint" style="margin:0 0 8px">📅 The "${OcG.name}" Google Calendar (${h(c.account || '')}) is kept up to date${c.at ? ` — last updated ${new Date(c.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}.</div>` : ''; }
function bkOcGoogleCard() {
  const c = (D.settings || {}).ocCal || {}; const adm = (window.SBAuth && SBAuth.isAdmin()) || Bk.can('settings'); const me = OcG.dev();
  return `<div class="card"><h3>📅 Connect Google Calendar (on-call roster)</h3><div class="hint" style="margin-bottom:6px">Keeps a "${OcG.name}" calendar in ${h(c.account || OcG.account)} up to date with the roster (one all-day event per day, 2 weeks back to 6 months ahead). One device does it — normally the office computer. Share the calendar with each vet's Google account (in Google Calendar) so it shows on their phones.${adm ? ' The first time, the Google Calendar API has to be switched on for the practice\'s Google Cloud project (see the manual).' : ''}</div>
    <div class="kv"><div class="k">Status</div><div class="v">${c.id ? `Connected${c.at ? ` · last updated ${new Date(c.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}` : 'Not connected yet'}${me ? ' · <b>this device keeps it up to date</b>' + (OcG.valid() ? '' : ' (tap anywhere to sign in to Google again)') : ''}</div></div>
    ${adm ? `<div class="actions">${me ? '<button class="btn small primary" data-act="ocg-sync">Sync now</button><button class="btn small" data-act="ocg-stop">Stop doing it from this device</button>' : `<button class="btn small primary" data-act="ocg-connect">${c.id ? 'Do it from this device' : 'Connect Google Calendar'}</button>`}</div>` : ''}</div>`;
}
