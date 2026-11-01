// Bovitech Super App — "gcal" function: keeps Google Calendar up to date from the server, so no phone or computer has to.
//   • "Bovitech On Call": one all-day event per day (2 weeks back to 6 months ahead), in each vet's Google Calendar colour
//   • "Bovitech — <name>": each person's appointments (if switched on in Settings → Scheduling)
// Runs every 5 minutes (only writes to Google when something has changed), and straight away from "Sync now".
// Secrets (Edge Functions → Secrets): GOOGLE_CLIENT_SECRET — from Google Cloud → APIs & Services → Credentials →
//   the app's OAuth client (the same one used for Google sign-in). Optional: GOOGLE_CLIENT_ID, APP_URL.
// In Google Cloud, add this function's address as an "Authorized redirect URI" on that OAuth client:
//   https://<project>.supabase.co/functions/v1/gcal
// "Verify JWT" must be OFF for this function — it checks its own secret, and Google's sign-in comes back to it.

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_KEY") ?? "";
const CID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "481199720325-9vnbj8lf5bggfo31um3adklq37cfo49i.apps.googleusercontent.com";
const CSEC = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const APP = Deno.env.get("APP_URL") ?? "https://bovitech-veterinary-services.github.io/bovitech-super-app/";
const REDIRECT = SB_URL + "/functions/v1/gcal";
const GAPI = "https://www.googleapis.com/calendar/v3";
const ONCALL_NAME = "Bovitech On Call";

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(SB_URL + path, { ...init, headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`Supabase ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  return r;
}
const rpc = async (fn: string, body: unknown = {}) => { const t = await (await sb("/rest/v1/rpc/" + fn, { method: "POST", body: JSON.stringify(body) })).text(); return t ? JSON.parse(t) : null; };
async function recs(kind: string) {
  const out: any[] = []; let from = 0;
  for (;;) { const rows = await (await sb(`/rest/v1/records?select=id,data,deleted&kind=eq.${kind}&order=seq.asc&offset=${from}&limit=1000`)).json(); out.push(...rows.filter((r: any) => !r.deleted && r.data).map((r: any) => ({ ...r.data, id: r.id }))); if (rows.length < 1000) break; from += 1000; }
  return out;
}
const page = (title: string, msg: string, ok: boolean) => Response.redirect(APP + (APP.includes("?") ? "&" : "?") + "gcal=" + (ok ? "ok" : "err") + "&gmsg=" + encodeURIComponent(title + " — " + msg), 302); // straight back to the app, which shows the message (Supabase won't show web pages)

/* ---------- dates (Perth) ---------- */
const perthToday = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Perth" }));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const add = (s: string, n: number) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (s: string) => new Date(s + "T12:00:00Z").getUTCDay();
const days = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
const weekStart = (s: string) => add(s, -((dow(s) + 6) % 7));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const mins = (t: string) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const stable = (v: any): string => (v === null || typeof v !== "object" ? JSON.stringify(v) : Array.isArray(v) ? "[" + v.map(stable).join(",") + "]" : "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}");
const hash = (s: string) => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) >>> 0; return x.toString(36); };

/* ---------- Google ---------- */
async function accessToken(refresh: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: CID, client_secret: CSEC, refresh_token: refresh, grant_type: "refresh_token" }) });
  const js = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(js.error === "invalid_grant" ? "Google's sign-in has expired or was removed — tap Connect again in Settings → Scheduling" : "Google sign-in: " + (js.error_description || js.error || r.status)), { expired: js.error === "invalid_grant" });
  return js.access_token as string;
}
function gapi(tok: string) {
  return async (path: string, opt: RequestInit = {}) => {
    const r = await fetch(GAPI + path, { ...opt, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json", ...(opt.headers ?? {}) } });
    if (r.status === 204 || r.status === 410 || (r.status === 404 && opt.method === "DELETE")) return null;
    if (!r.ok) { const t = await r.text(); throw new Error(`Google Calendar ${r.status}: ${/has not been used|disabled/i.test(t) ? "the Google Calendar API isn't switched on for the project" : t.slice(0, 200)}`); }
    return r.json();
  };
}
async function ensureCal(api: any, id: string | null, name: string, colour?: string) { // finds (or makes) our calendar, and removes any copies of it made by mistake
  const all: any[] = []; let pageToken = ""; do { const l = await api(`/users/me/calendarList?maxResults=250${pageToken ? "&pageToken=" + pageToken : ""}`); all.push(...(l.items || [])); pageToken = l.nextPageToken || ""; } while (pageToken);
  const same = all.filter((c: any) => c.summary === name); let keep = (id && same.find((c: any) => c.id === id)) || (id && all.find((c: any) => c.id === id)) || same[0] || null;
  for (const c of same) { if (keep && c.id === keep.id) continue; try { const full = await api("/calendars/" + encodeURIComponent(c.id)); if (/Bovitech Super App/.test(full.description || "")) await api("/calendars/" + encodeURIComponent(c.id), { method: "DELETE" }); } catch (_) { /* not ours, or already gone */ } }
  if (keep) return keep.id;
  const c = await api("/calendars", { method: "POST", body: JSON.stringify({ summary: name, timeZone: "Australia/Perth", description: "Kept up to date by the Bovitech Super App. Changes made here are overwritten." }) });
  if (colour) await api("/users/me/calendarList/" + encodeURIComponent(c.id) + "?colorRgbFormat=true", { method: "PATCH", body: JSON.stringify({ backgroundColor: colour, foregroundColor: "#ffffff" }) }).catch(() => {});
  return c.id;
}
async function listOurs(api: any, cal: string, tag: string, from: string, to: string) {
  const have: Record<string, any> = {}; const dupes: string[] = []; let pageToken = "";
  do { const r = await api(`/calendars/${encodeURIComponent(cal)}/events?privateExtendedProperty=${encodeURIComponent("bvp=" + tag)}&timeMin=${from}T00:00:00Z&timeMax=${add(to, 2)}T00:00:00Z&singleEvents=true&maxResults=2500${pageToken ? "&pageToken=" + pageToken : ""}`);
    (r.items || []).forEach((ev: any) => { const k = ((ev.extendedProperties || {}).private || {}).key; if (!k) { dupes.push(ev.id); return; } /* made by the old phone/computer sync — the server's copy replaces it */ if (have[k]) dupes.push(ev.id); else have[k] = ev; }); pageToken = r.nextPageToken || ""; } while (pageToken);
  for (const id of dupes) await api(`/calendars/${encodeURIComponent(cal)}/events/${id}`, { method: "DELETE" });
  return have;
}
async function apply(api: any, cal: string, tag: string, want: Record<string, any>, have: Record<string, any>) { // create / change / remove so Google matches what we want
  let n = 0;
  for (const [k, w] of Object.entries(want)) { const ev = have[k]; const body = { ...w.body, extendedProperties: { private: { bvp: tag, key: k, h: w.h } } };
    if (!ev) { await api(`/calendars/${encodeURIComponent(cal)}/events`, { method: "POST", body: JSON.stringify(body) }); n++; }
    else if (((ev.extendedProperties || {}).private || {}).h !== w.h) { await api(`/calendars/${encodeURIComponent(cal)}/events/${ev.id}`, { method: "PATCH", body: JSON.stringify(body) }); n++; } }
  for (const [k, ev] of Object.entries(have)) if (!want[k]) { await api(`/calendars/${encodeURIComponent(cal)}/events/${(ev as any).id}`, { method: "DELETE" }); n++; }
  return n;
}

/* ---------- what the calendars should show ---------- */
const GHEX: Record<string, string> = { "1": "#7986cb", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73", "5": "#f6bf26", "6": "#f4511e", "7": "#039be5", "8": "#616161", "9": "#3f51b5", "10": "#0b8043", "11": "#d50000" };
async function wanted() {
  const today = ymd(perthToday()), from = add(today, -14), to = add(today, 180);
  const [staff, cfg, oncall, bookings] = await Promise.all([(await sb("/rest/v1/staff?select=id,full_name,preferred_name,role,active")).json(), recs("bkcfg"), recs("oncall"), recs("bookings")]);
  const get = (id: string) => cfg.find((c) => c.id === id && !c.gone);
  const pname = (id: string) => { const s = staff.find((x: any) => x.id === id); return s ? s.preferred_name || String(s.full_name || "").split(" ")[0] : "?"; };
  const gcol = (id: string) => { const c = get("staff:" + id) || {}; if (c.gcol !== undefined) return c.gcol || ""; const n = pname(id).toLowerCase(); return /^(milly|amelia)/.test(n) ? "2" : /^jess/.test(n) ? "1" : /^rory/.test(n) ? "6" : ""; };
  const pat = get("ocpat"); const recFor = (d: string) => oncall.find((o) => o.id === d && !o.gone && o.who !== undefined);
  const who = (d: string) => { const r = recFor(d); if (r) return r.who; if (!pat || !pat.start) return null; const w = (((Math.floor(days(pat.start, weekStart(d)) / 7) % pat.weeks) + pat.weeks) % pat.weeks); return (pat.grid || {})[w + "-" + dow(d)] || null; };
  const oc: Record<string, any> = {};
  for (let d = from; d <= to; d = add(d, 1)) { const w = who(d); if (!w) continue; const body = { summary: "On call: " + pname(w), start: { date: d }, end: { date: add(d, 1) }, transparency: "transparent", description: "From the Bovitech Super App on-call roster (midnight to midnight).", ...(gcol(w) ? { colorId: gcol(w) } : {}) }; oc[d] = { body, h: hash(stable(body)) }; }
  // staff birthdays (Settings → Scheduling → People) — all-day, on the shared on-call calendar so everyone sees them
  for (const st of staff.filter((x: any) => x.active !== false)) { const bd = (get("staff:" + st.id) || {}).bday; if (!/^\d{2}-\d{2}$/.test(bd || "")) continue;
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) { const d = `${y}-${bd}`; if (d < from || d > to || ymd(new Date(d + "T12:00:00Z")) !== d) continue;
      oc["bday:" + st.id + ":" + d] = (() => { const body = { summary: "🎂 " + pname(st.id) + "'s birthday", start: { date: d }, end: { date: add(d, 1) }, transparency: "transparent", description: "From the Bovitech Super App." }; return { body, h: hash(stable(body)) }; })(); } }
  // yearly events and reminders, and the days the bulk scheduling lists open (dates worked out by the app, which knows the WA public holidays)
  for (const x of cfg.filter((c: any) => !c.gone && (c.cfg === "yearly" || c.cfg === "bulk") && Array.isArray(c.dates))) {
    for (const d of x.dates) { if (typeof d !== "string" || d < from || d > to) continue;
      const body = { summary: x.cfg === "bulk" ? "📋 Bulk scheduling list opens: " + x.name : (x.kind === "reminder" ? "🔔 " : "📌 ") + x.name, start: { date: d }, end: { date: add(d, 1) }, transparency: "transparent", description: "From the Bovitech Super App." };
      oc["yr:" + x.id + ":" + d] = { body, h: hash(stable(body)) }; } }
  // each person's day sheet
  const opts = get("gcalopts") || {}; const per: Record<string, Record<string, any>> = {};
  if (opts.appts !== false) { // each person's day sheet, as one event on their own calendar (not each appointment)
    const sheets = await recs("bksheet");
    const live = bookings.filter((b) => b.status !== "cancelled" && !b.gone && b.date >= from && b.date <= to && b.start);
    for (const sh of sheets) {
      if (sh.gone || !sh.text || !sh.sid || sh.date < from || sh.date > to) continue;
      const mine = live.filter((b) => b.date === sh.date && (b.staff || []).includes(sh.sid));
      const s0 = mine.length ? Math.min(...mine.map((b) => mins(b.start))) : 8 * 60; const e0 = mine.length ? Math.max(...mine.map((b) => mins(b.start) + (b.mins || 60))) : 17 * 60;
      const body = { summary: `📋 Day sheet — ${mine.length} appointment${mine.length === 1 ? "" : "s"}`, description: (sh.html ? String(sh.html) + "<br><br><i>From the Bovitech Super App — change appointments there, not here.</i>" : String(sh.text) + "\n\nFrom the Bovitech Super App — change appointments there, not here."),
        start: { dateTime: `${sh.date}T${hhmm(s0)}:00`, timeZone: "Australia/Perth" }, end: { dateTime: `${sh.date}T${hhmm(Math.min(e0, 1439))}:00`, timeZone: "Australia/Perth" } };
      (per[sh.sid] ??= {})["ds:" + sh.date] = { body, h: hash(stable(body)) };
    }
  }
  const people = staff.filter((s: any) => s.active !== false && s.role !== "admin");
  return { from, to, oc, per, people, pname, gcol };
}

async function sync(force: boolean) {
  const g = await rpc("gcal_get"); if (!g || !g.refresh_token) return { ok: false, msg: "Not connected" };
  const lock = await rpc("gcal_lock").catch(() => null); if (lock === false) return { ok: true, busy: true }; // another sync is running (update 7) — it'll pick up any changes
  try { return await syncNow(g, force); } finally { if (lock === true) await rpc("gcal_unlock").catch(() => null); }
}
async function syncNow(g: any, force: boolean) {
  if (!CSEC) { await rpc("gcal_set", { patch: { last: { at: new Date().toISOString(), msg: "GOOGLE_CLIENT_SECRET is missing (Edge Functions → Secrets)", error: true } } }); return { ok: false }; }
  try {
    const w = await wanted(); const h0 = hash(stable({ oc: w.oc, per: w.per }));
    if (!force && h0 === g.hash) return { ok: true, n: 0, skipped: true };
    const api = gapi(await accessToken(g.refresh_token)); let n = 0;
    const ocal = await ensureCal(api, g.oncall_cal, ONCALL_NAME);
    n += await apply(api, ocal, "oncall", w.oc, await listOurs(api, ocal, "oncall", w.from, w.to));
    const cals = { ...(g.staff_cals || {}) };
    for (const p of w.people) { const want = w.per[p.id] || {}; if (!Object.keys(want).length && !cals[p.id]) continue;
      cals[p.id] = await ensureCal(api, cals[p.id] || null, "Bovitech — " + w.pname(p.id), GHEX[w.gcol(p.id)]);
      n += await apply(api, cals[p.id], "appt", want, await listOurs(api, cals[p.id], "appt", w.from, w.to)); }
    await rpc("gcal_set", { patch: { oncall_cal: ocal, staff_cals: cals, hash: h0, last: { at: new Date().toISOString(), n, msg: n ? `${n} change${n === 1 ? "" : "s"} sent` : "Up to date" } } });
    return { ok: true, n };
  } catch (e) {
    const msg = String((e as Error).message || e); await rpc("gcal_set", { patch: { last: { at: new Date().toISOString(), msg, error: true } } }); return { ok: false, msg };
  }
}

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    if (req.method === "GET") { // Google's sign-in comes back here
      const err = u.searchParams.get("error"); if (err) return page("Google Calendar wasn't connected", "Google said: " + err + ". Go back to the app and try again.", false);
      const code = u.searchParams.get("code"), state = u.searchParams.get("state"); if (!code || !state) return page("Nothing to do", "Open Settings → Scheduling in the app to connect Google Calendar.", false);
      const g = await rpc("gcal_get"); if (!g || !g.nonce || g.nonce !== state || !g.nonce_at || Date.now() - Date.parse(g.nonce_at) > 20 * 60000) return page("That link has expired", "Go back to the app and tap Connect again.", false);
      if (!CSEC) return page("One more setup step", "GOOGLE_CLIENT_SECRET hasn't been added to Supabase yet (Edge Functions → Secrets).", false);
      const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: CID, client_secret: CSEC, redirect_uri: REDIRECT, grant_type: "authorization_code" }) });
      const js = await r.json().catch(() => ({}));
      if (!r.ok) return page("Google Calendar wasn't connected", "Google said: " + (js.error_description || js.error || r.status) + (js.error === "redirect_uri_mismatch" ? `. Add ${REDIRECT} as an Authorized redirect URI on the OAuth client in Google Cloud.` : ""), false);
      if (!js.refresh_token) return page("Almost — please try once more", "Google didn't give a lasting sign-in. Go to myaccount.google.com/permissions (signed in as the practice account), remove the Bovitech app's access, then tap Connect again in the app.", false);
      let account = ""; try { account = (await (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + js.access_token } })).json()).email || ""; } catch (_) { /* fine */ }
      await rpc("gcal_set", { patch: { refresh_token: js.refresh_token, account, nonce: null, connected_at: 1 } });
      const s = await sync(true);
      return page("Google Calendar connected", `Connected to ${account || "Google"}. ${s.ok ? `The calendars are up to date (${(s as any).n || 0} changes).` : "The first sync didn't finish: " + ((s as any).msg || "") + " — it tries again every 5 minutes."} From now on the server keeps them up to date — no phone or computer needed.`, true);
    }
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    const ok = await rpc("check_job_secret", { s: req.headers.get("x-job-secret") ?? "" }); if (ok !== true) return json({ error: "Not allowed" }, 403);
    const { task, force } = await req.json().catch(() => ({}));
    if (task === "sync") return json(await sync(!!force));
    return json({ error: "Unknown task" }, 400);
  } catch (e) { console.error(e); return json({ error: String((e as Error).message) }, 500); }
});
