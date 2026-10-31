// Bovitech Practice — "jobs" function: nightly backup and security alert emails.
// Called only by the database (nightly at 2 am Perth, and when something is added to the security log).
//   • Backup: the whole database, compressed, saved in this Supabase project's private "backups" storage (last 30 kept)
//     and emailed to the office as an attachment (an off-site copy you can restore from anywhere).
//   • Alerts: an email to the office for new-device sign-ins, wipes, staff changes and failed backups.
// Settings (Edge Functions → Secrets):  RESEND_API_KEY  (from resend.com — sign up with the office email address)
// Optional: ALERT_TO (default office@bovitech.com.au), MAIL_FROM (default Bovitech Practice <onboarding@resend.dev>),
//           BACKUP_EMAIL = daily | weekly | off (default daily), KEEP_DAYS (default 30)
//   • SMS: booking made / reminder 5 days before at 8:30am / new time suggested / hand-written texts, sent from the
//     office phone through the "SMS Gateway for Android" app (cloud mode); replies and delivery reports come back here.
//     Secrets: SMSGATE_USER, SMSGATE_PASS (shown in the phone app under Cloud server).
// "Verify JWT" must be OFF for this function — it checks its own secret instead.

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_KEY") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_TO = Deno.env.get("ALERT_TO") ?? "office@bovitech.com.au";
const FROM = Deno.env.get("MAIL_FROM") ?? "Bovitech Practice <onboarding@resend.dev>";
const BACKUP_EMAIL = (Deno.env.get("BACKUP_EMAIL") ?? "daily").toLowerCase();
const KEEP = Number(Deno.env.get("KEEP_DAYS") ?? "30");
const BUCKET = "backups";
const PREFIX = "bovitech-practice-backup-";
const SMS_USER = Deno.env.get("SMSGATE_USER") ?? "";
const SMS_PASS = Deno.env.get("SMSGATE_PASS") ?? "";
const SMS_API = Deno.env.get("SMSGATE_URL") ?? "https://api.sms-gate.app/3rdparty/v1";

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

async function sb(path: string, init: RequestInit = {}, raw = false) {
  const r = await fetch(SB_URL + path, { ...init, headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, ...(raw ? {} : { "Content-Type": "application/json" }), ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`Supabase ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  return r;
}
const logEvent = (kind: string, detail: Record<string, unknown>) =>
  sb("/rest/v1/security_events", { method: "POST", body: JSON.stringify({ kind, detail }), headers: { Prefer: "return=minimal" } });

function b64(bytes: Uint8Array) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
async function sendMail(subject: string, text: string, attachment?: { filename: string; bytes: Uint8Array }) {
  if (!RESEND) throw new Error("RESEND_API_KEY is missing (Edge Functions → Secrets)");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [ALERT_TO], subject, text, ...(attachment ? { attachments: [{ filename: attachment.filename, content: b64(attachment.bytes) }] } : {}) }),
  });
  if (!r.ok) throw new Error("Email failed: " + r.status + " " + await r.text());
}
const perth = (t: string | number | Date) => new Date(t).toLocaleString("en-AU", { timeZone: "Australia/Perth", dateStyle: "medium", timeStyle: "short" });
async function gzip(bytes: Uint8Array) { return new Uint8Array(await new Response(new Blob([bytes as unknown as ArrayBuffer]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()); }

/* ---------- nightly backup: same format as Settings → Backup → Download backup, so it can be restored in the app ---------- */
async function backup() {
  const out: Record<string, any> = { backupOf: "Bovitech Practice", savedAt: new Date().toISOString(), contacts: [], businesses: [], tags: [], routes: [], farms: [], settings: {}, deleted: [], dismissed: {}, trash: [], changelog: [], devices: {}, importedAt: null };
  let from = 0;
  for (;;) {
    const rows = await (await sb(`/rest/v1/records?select=kind,id,data,rev,deleted,updated_at&order=seq.asc&offset=${from}&limit=1000`)).json();
    for (const r of rows) {
      if (!["settings", "meta", "device"].includes(r.kind)) { if (r.deleted) out.deleted.push({ id: r.id, kind: r.kind, at: Date.parse(r.updated_at), synced: true }); else (out[r.kind] ??= []).push({ ...r.data, _rev: r.rev }); }
      else if (r.kind === "settings" && r.data) out.settings = r.data;
      else if (r.kind === "meta" && r.data) { if (r.id === "info") out.importedAt = r.data.importedAt ?? null; else out[r.id] = r.data; }
      else if (r.kind === "device" && r.data) out.devices[r.id] = r.data;
    }
    if (rows.length < 1000) break; from += 1000;
  }
  out.staff = await (await sb("/rest/v1/staff?select=email,full_name,preferred_name,initials,role,can_reports,can_invoices,can_manage_staff,active")).json();
  const raw = new TextEncoder().encode(JSON.stringify(out));
  const gz = await gzip(raw);
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Perth" });
  const name = `${PREFIX}${day}.json.gz`;
  // 1) keep it in this project's private storage
  const up = () => fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${name}`, { method: "POST", body: gz, headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/gzip", "x-upsert": "true" } });
  let r = await up();
  if (!r.ok && (r.status === 404 || r.status === 400)) { // first time: make the private bucket, then try again
    await fetch(`${SB_URL}/storage/v1/bucket`, { method: "POST", body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }), headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" } });
    r = await up();
  }
  if (!r.ok) throw new Error("Saving the backup failed: " + r.status + " " + await r.text());
  // keep the newest KEEP backups
  const list = await (await sb(`/storage/v1/object/list/${BUCKET}`, { method: "POST", body: JSON.stringify({ prefix: "", limit: 1000, sortBy: { column: "name", order: "desc" } }) })).json();
  const old = (list ?? []).map((f: any) => f.name).filter((n: string) => n.startsWith(PREFIX)).sort().reverse().slice(KEEP);
  if (old.length) await sb(`/storage/v1/object/${BUCKET}`, { method: "DELETE", body: JSON.stringify({ prefixes: old }) });
  // 2) email a copy (off-site)
  const counts = { contacts: out.contacts.length, businesses: out.businesses.length, farms: out.farms.length, bookings: (out.bookings ?? []).length };
  const weekly = BACKUP_EMAIL === "weekly", send = BACKUP_EMAIL === "daily" || (weekly && new Date().toLocaleDateString("en-AU", { timeZone: "Australia/Perth", weekday: "long" }) === "Sunday");
  if (send) await sendMail(`Bovitech Practice backup ${day}`, [
    `Last night's backup of the Bovitech Practice app is attached (${Math.round(gz.length / 1024)} KB): ${counts.contacts} contacts, ${counts.businesses} businesses, ${counts.farms} farms, ${counts.bookings} bookings.`,
    "", "To restore it: open the app as the admin → Settings → Backup → Restore backup, and choose this file (no need to unzip it).",
    "The last " + KEEP + " backups are also kept in Supabase → Storage → backups.",
  ].join("\n"), { filename: name, bytes: gz });
  await logEvent("backup_ok", { file: name, size: gz.length, emailed: send, ...counts });
  return { ok: true, file: name, size: gz.length, emailed: send, ...counts };
}

/* ---------- alert email for something in the security log ---------- */
const WHAT: Record<string, string> = {
  new_device: "signed in on a new device", device_wiped: "had a device removed and wiped", devices_wiped: "had all their devices wiped",
  two_step_reset: "had their two-step sign-in reset", staff_changed: "had their staff details or permissions changed", staff_added: "was added as staff", login_created: "had a login created by the admin", password_set: "had their password set by the admin", backup_failed: "Nightly backup FAILED",
};
async function alert(id: number) {
  const [e] = await (await sb(`/rest/v1/security_events?id=eq.${id}&select=*,about:staff_id(full_name,preferred_name,email),by:actor_id(full_name,preferred_name)`)).json();
  if (!e || e.emailed) return { ok: true, skipped: true };
  const who = e.about ? (e.about.preferred_name || e.about.full_name) : "";
  const by = e.by ? (e.by.preferred_name || e.by.full_name) : "";
  const subject = e.kind === "backup_failed" ? "⚠️ Bovitech Practice: nightly backup failed" : `Bovitech Practice security: ${who} ${WHAT[e.kind] ?? e.kind}`;
  const lines = [
    e.kind === "backup_failed" ? "Last night's backup didn't work." : `${who} ${WHAT[e.kind] ?? e.kind}.`,
    "", `When: ${perth(e.at)} (Perth time)`,
    by && by !== who ? `Done by: ${by}` : "",
    e.detail && Object.keys(e.detail).length ? "Details: " + Object.entries(e.detail).map(([k, v]) => `${k}: ${v}`).join(", ") : "",
    "", e.kind === "new_device" ? "If this wasn't them, open the app as admin → Settings → Staff & permissions → their name → Devices, tap Remove & wipe, and reset their password in Supabase." : "",
    "Full list: open the app as admin → Settings → Security log.",
  ].filter((x, i, a) => x !== "" || a[i - 1] !== "");
  await sendMail(subject, lines.join("\n"));
  await sb(`/rest/v1/security_events?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ emailed: true }), headers: { Prefer: "return=minimal" } });
  return { ok: true };
}

/* ---------- SMS from the office phone ---------- */
const auMobile = (p: string) => { const d = String(p || "").replace(/\D/g, ""); if (/^04\d{8}$/.test(d)) return "+61" + d.slice(1); if (/^614\d{8}$/.test(d)) return "+" + d; return null; };
const perthNow = () => { const n = new Date(); const p = new Date(n.toLocaleString("en-US", { timeZone: "Australia/Perth" })); return p; };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s: string, n: number) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nice = (s: string, o: Intl.DateTimeFormatOptions) => new Date(s + "T12:00:00Z").toLocaleDateString("en-AU", { timeZone: "UTC", ...o });
const niceTime = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`; };
async function gateway(phone: string, text: string) {
  if (!SMS_USER || !SMS_PASS) throw new Error("SMS isn't set up yet (SMSGATE_USER / SMSGATE_PASS)");
  const r = await fetch(SMS_API + "/messages", { method: "POST", headers: { Authorization: "Basic " + btoa(SMS_USER + ":" + SMS_PASS), "Content-Type": "application/json" }, body: JSON.stringify({ textMessage: { text }, phoneNumbers: [phone] }) });
  const js = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Phone gateway " + r.status + " " + JSON.stringify(js).slice(0, 200));
  return js.id as string;
}
async function recs(kind: string, ids?: string[]) {
  if (ids && !ids.length) return [];
  const q = ids ? `&id=in.(${ids.map((x) => '"' + x.replace(/"/g, "") + '"').join(",")})` : "";
  const out: any[] = []; let from = 0;
  for (;;) { const rows = await (await sb(`/rest/v1/records?select=id,data,deleted&kind=eq.${kind}${q}&order=seq.asc&offset=${from}&limit=1000`)).json(); out.push(...rows.filter((r: any) => !r.deleted && r.data).map((r: any) => ({ ...r.data, id: r.id }))); if (rows.length < 1000) break; from += 1000; }
  return out;
}
async function claim(row: Record<string, unknown>) { // insert first so the same text never goes twice
  const r = await sb("/rest/v1/sms_log", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "resolution=ignore-duplicates,return=representation" } });
  const js = await r.json(); return js[0] || null;
}
const setLog = (id: number, patch: Record<string, unknown>) => sb(`/rest/v1/sms_log?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=minimal" } });
async function daySheets(today: string, keys: Set<string>, send: (row: any) => Promise<void>, errors: string[]) {
  const sheets = ((await (await sb(`/rest/v1/records?select=id,data,deleted,updated_at&kind=eq.bksheet&id=like.*${today}`)).json()) as any[]).filter((r) => !r.deleted && r.data && r.data.sid && r.data.date === today).map((r) => ({ ...r.data, at: Date.parse(r.updated_at) }));
  if (!sheets.length) return; const cfg = await recs("bkcfg");
  for (const sh of sheets) {
    const sc = cfg.find((c) => c.id === "staff:" + sh.sid) || {}; if (sc.sheetSms === false) continue; const ph = auMobile(sc.sheetMobile || sc.mobile || ""); if (!ph) continue; // its own number for day sheets, or their usual mobile
    const pre = `daysheet:${sh.sid}:${today}:`; const sentAny = [...keys].some((k) => k.startsWith(pre)); if (keys.has(pre + sh.hash)) continue;
    if (!sentAny && !sh.text) continue; // nothing on, and nothing sent yet
    if (sentAny && sh.at && Date.now() - sh.at < 5 * 60e3) continue; // still being changed — wait a few minutes so several changes go in one text
    const body = (sentAny ? "UPDATED day sheet — " : "") + (sh.text || "Nothing booked for you today.").slice(0, 1500);
    const row = await claim({ kind: "daysheet", key: pre + sh.hash, phone: ph, body, staff_id: sh.sid, status: "queued" }); if (row) { keys.add(pre + sh.hash); await send(row); }
  }
}
async function smsRun() {
  const now = perthNow(), today = ymd(now), hm = now.getHours() * 60 + now.getMinutes();
  const sent: any[] = []; const errors: string[] = []; let budget = 30;
  const send = async (row: any) => { if (budget-- <= 0) return; try { const gid = await gateway(row.phone, row.body); await setLog(row.id, { status: "sending", gateway_id: gid }); sent.push(row.id); } catch (e) { await setLog(row.id, { status: "failed", error: String((e as Error).message).slice(0, 300) }); errors.push((e as Error).message); } };
  // 1) hand-written texts
  for (const row of await (await sb("/rest/v1/sms_log?status=eq.queued&kind=eq.manual&order=at.asc&limit=30")).json()) { const ph = auMobile(row.phone); if (!ph) { await setLog(row.id, { status: "failed", error: "Not a mobile number" }); continue; } row.phone = ph; await send(row); }
  // 2) booking texts that are due
  const bookings = (await recs("bookings")).filter((b) => b.status !== "cancelled" && !b.gone && b.date >= today);
  if (!bookings.length) return { sent: sent.length, errors };
  const cfg = await recs("bkcfg"); const tpl = (use: string) => cfg.filter((c) => c.cfg === "sms" && c.use === use && !c.gone).sort((a, b) => (a.order || 99) - (b.order || 99))[0];
  const type = (id: string) => cfg.find((c) => c.id === id) || { name: "appointment" };
  const cids = [...new Set(bookings.map((b) => b.cid).filter(Boolean))], bids = [...new Set(bookings.map((b) => b.bid).filter(Boolean))], fids = [...new Set(bookings.map((b) => b.fid).filter(Boolean))];
  const [contacts, businesses, farms] = await Promise.all([recs("contacts", cids), recs("businesses", bids), recs("farms", fids)]);
  const staff = await (await sb("/rest/v1/staff?select=id,full_name,preferred_name")).json();
  const fill = (t: string, b: any, c: any, extra: Record<string, string> = {}) => {
    const f = farms.find((x) => x.id === b.fid), bz = businesses.find((x) => x.id === b.bid);
    const vals: Record<string, string> = { first: c.first || "", name: [c.first, c.last].filter(Boolean).join(" "), business: bz ? bz.name : "", type: String(type(b.type).name || "").toLowerCase(),
      day: nice(extra.date || b.date, { weekday: "long" }), date: nice(extra.date || b.date, { day: "numeric", month: "long" }), time: niceTime(extra.start || b.start),
      farm: f ? f.name || "" : "", at_farm: f && f.name ? " at " + f.name : "", vet: (extra.staff ? extra.staff.split(",") : b.staff || []).map((id: string) => { const s = staff.find((x: any) => x.id === id); return s ? s.preferred_name || s.full_name.split(" ")[0] : ""; }).filter(Boolean).join(" and "),
      old_date: nice(b.date, { weekday: "long", day: "numeric", month: "long" }) };
    return t.replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m)).replace(/\s+([.,])/g, "$1");
  };
  const keys = new Set(((await (await sb(`/rest/v1/sms_log?select=key&at=gte.${addDays(today, -120)}&key=not.is.null`)).json()) as any[]).map((x) => x.key));
  const bsched = (id: string) => cfg.find((x) => x.id === "bsched:" + id && !x.gone) || {};
  const extraIds = [...new Set(bookings.flatMap((b) => { const bz = businesses.find((x) => x.id === b.bid); return b.bid ? [...(bsched(b.bid).smsTo || []), ...(bz && bz.primaryContact ? [bz.primaryContact] : [])] : []; }).filter((id: string) => !contacts.some((c) => c.id === id)))];
  if (extraIds.length) contacts.push(...(await recs("contacts", extraIds as string[])));
  for (const b0 of bookings) { const bz0 = businesses.find((x) => x.id === b0.bid); const to: string[] = b0.bid && (bsched(b0.bid).smsTo || []).length ? bsched(b0.bid).smsTo : bz0 && bz0.primaryContact ? [bz0.primaryContact] : [b0.cid]; // the business's "texts go to", else its primary contact, else the person on the appointment // "texts go to" on the business, or the person chosen on the appointment
   for (let ti = 0; ti < to.length; ti++) { const b = b0; const sfx = ti ? ":" + to[ti] : "";
    const c = contacts.find((x) => x.id === to[ti]); const ph = c && auMobile(((c.mobiles || [])[0] || {}).value); if (!ph) continue;
    const base = { booking_id: b.id, contact_id: c.id, business_id: b.bid || null, phone: ph };
    const madeRecently = b.createdAt && Date.now() - b.createdAt < 3 * 864e5;
    if (b.sms && b.sms.send && !b.sms.booked && !b.sms.skip && madeRecently && !keys.has("booked:" + b.id + sfx) && tpl("booked")) {
      const row = await claim({ ...base, kind: "booked", key: "booked:" + b.id + sfx, body: fill(tpl("booked").text, b, c), status: "queued" }); if (row) await send(row); }
    if (b.date === addDays(today, 5) && hm >= 8 * 60 + 30 && !(b.sms && b.sms.noReminder) && !keys.has(`reminder:${b.id}:${b.date}${sfx}`) && tpl("reminder")) {
      const row = await claim({ ...base, kind: "reminder", key: `reminder:${b.id}:${b.date}${sfx}`, body: fill(tpl("reminder").text, b, c), status: "queued" }); if (row) await send(row); }
    const p = b.proposal;
    if (p && !p.smsSent && !p.smsSkip && !keys.has(`proposal:${b.id}:${p.at}${sfx}`) && tpl("proposal")) {
      const row = await claim({ ...base, kind: "proposal", key: `proposal:${b.id}:${p.at}${sfx}`, body: fill(tpl("proposal").text, b, c, { date: p.date, start: p.start, staff: (p.staff || b.staff || []).join(",") }), status: "queued" }); if (row) await send(row); }
  } }
  // still not confirmed 48 hours before: tell the office so they can ring
  for (const b of bookings) {
    if (b.status && b.status !== "unconfirmed") continue; if (b.proposal) continue; const at = Date.parse(`${b.date}T${b.start || "08:00"}:00+08:00`); const left = at - Date.now();
    if (left <= 0 || left > 48 * 3600e3 || keys.has("ring:" + b.id + ":" + b.date)) continue;
    const c = contacts.find((x) => x.id === b.cid); const bz = businesses.find((x) => x.id === b.bid); const who = bz ? bz.name : c ? [c.first, c.last].filter(Boolean).join(" ") : "a client";
    const row = await claim({ kind: "notice", key: "ring:" + b.id + ":" + b.date, booking_id: b.id, contact_id: c ? c.id : null, business_id: b.bid || null, phone: c ? ((c.mobiles || [])[0] || {}).value || null : null, body: `Not confirmed yet: ${who} — ${nice(b.date, { weekday: "long", day: "numeric", month: "short" })} ${niceTime(b.start)}. Please ring them.`, status: "sent" });
    if (row && RESEND) await sendMail(`Not confirmed yet: ${who} — ${nice(b.date, { weekday: "short", day: "numeric", month: "short" })} ${niceTime(b.start)}`, row.body + (c && (c.mobiles || [])[0] ? `\nMobile: ${c.mobiles[0].value}` : "") + "\n\nIt's also in the app: Scheduling → Jobs → Not confirmed — ring them.").catch((e) => errors.push(String(e)));
  }
  // each person's day sheet at 8am, and again if their day changes
  { const sc = (await recs("bkcfg")).find((c) => c.id === "sheets" && !c.gone) || {}; const [th, tm] = String(sc.time || "08:00").split(":").map(Number); if (sc.on && hm >= th * 60 + (tm || 0)) await daySheets(today, keys, send, errors); }
  return { sent: sent.length, errors };
}
// replies and delivery reports from the phone app
async function smsHook(body: any) {
  const ev = body.event || "", pl = body.payload || {};
  if (["sms:sent", "sms:delivered", "sms:failed"].includes(ev)) {
    const st = ev === "sms:failed" ? "failed" : ev === "sms:delivered" ? "delivered" : "sent";
    const id = pl.messageId || pl.id; if (id) await sb(`/rest/v1/sms_log?gateway_id=eq.${encodeURIComponent(id)}${st === "sent" ? "&status=neq.delivered" : ""}`, { method: "PATCH", body: JSON.stringify({ status: st, ...(st === "failed" ? { error: String(pl.reason || "Not delivered").slice(0, 300) } : {}) }), headers: { Prefer: "return=minimal" } });
    return { ok: true };
  }
  if (ev === "sms:received") {
    const ph = auMobile(pl.sender || pl.phoneNumber || ""); const digits = ph ? "0" + ph.slice(3) : String(pl.sender || "");
    const contacts = await recs("contacts");
    const c = contacts.find((x) => (x.mobiles || []).some((m: any) => String(m.value || "").replace(/\D/g, "").replace(/^61/, "0") === digits));
    const bid = c && (c.links || []).find((l: any) => !l.past)?.bid;
    const msg = String(pl.message || "").slice(0, 2000);
    const ins = await sb("/rest/v1/sms_log", { method: "POST", body: JSON.stringify({ kind: "reply", phone: ph || pl.sender, body: msg, contact_id: c ? c.id : null, business_id: bid || null, status: "received", gateway_id: pl.messageId || null, at: pl.receivedAt || new Date().toISOString() }), headers: { Prefer: "return=representation" } });
    try { // "Y" / "Yes": confirm their next unconfirmed appointment (the reply still goes to the office)
      const row = (await ins.json().catch(() => []))[0];
      if (row && c && /^\W*(y|ye|yes|yep|yeah|yes please|yes thanks|confirm|confirmed)\W*$/i.test(msg.trim())) {
        const today = ymd(perthNow()); const bk = (await recs("bookings")).filter((b) => b.status !== "cancelled" && !b.gone && b.date >= today && (!b.status || b.status === "unconfirmed") && (b.cid === c.id || (bid && b.bid === bid))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
        if (bk) await sb("/rest/v1/rpc/sms_autoconfirm", { method: "POST", body: JSON.stringify({ booking: bk.id, sms_id: row.id, note_: `✓ Confirmed automatically: ${nice(bk.date, { weekday: "short", day: "numeric", month: "short" })} ${niceTime(bk.start)}` }) });
      }
    } catch (e) { console.error("autoconfirm", e); }
    return { ok: true };
  }
  return { ok: true, ignored: ev };
}
async function smsSetup() { // register where the phone app sends replies and delivery reports
  const url = await (await sb("/rest/v1/rpc/sms_hook_url", { method: "POST", body: "{}" })).json();
  const auth = { Authorization: "Basic " + btoa(SMS_USER + ":" + SMS_PASS), "Content-Type": "application/json" };
  const have = await (await fetch(SMS_API + "/webhooks", { headers: auth })).json().catch(() => []);
  const done: string[] = [];
  for (const event of ["sms:received", "sms:sent", "sms:delivered", "sms:failed"]) {
    if (Array.isArray(have) && have.some((w: any) => w.event === event && w.url === url)) { done.push(event + " (already)"); continue; }
    const r = await fetch(SMS_API + "/webhooks", { method: "POST", headers: auth, body: JSON.stringify({ url, event }) });
    if (!r.ok) throw new Error(`Couldn't register ${event}: ${r.status} ${await r.text()}`); done.push(event);
  }
  return { ok: true, webhooks: done };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    const hook = new URL(req.url).searchParams.get("hook");
    const ok = await (await sb("/rest/v1/rpc/check_job_secret", { method: "POST", body: JSON.stringify({ s: hook ?? req.headers.get("x-job-secret") ?? "" }) })).json();
    if (ok !== true) return json({ error: "Not allowed" }, 403);
    if (hook) return json(await smsHook(await req.json().catch(() => ({}))));
    const { task, id } = await req.json().catch(() => ({}));
    if (task === "sms") return json(await smsRun());
    if (task === "sms_setup") return json(await smsSetup());
    if (task === "sms_test") { const ph = auMobile(String(id || "")); if (!ph) return json({ error: "Give a mobile number as id" }, 400); return json({ ok: true, id: await gateway(ph, "Test from the Bovitech Practice app — SMS from the office phone is working.") }); }
    if (task === "backup") {
      try { return json(await backup()); }
      catch (e) { await logEvent("backup_failed", { error: String((e as Error).message).slice(0, 300) }).catch(() => {}); throw e; }
    }
    if (task === "alert") return json(await alert(Number(id)));
    if (task === "test") { await sendMail("Bovitech Practice: test email", "Email alerts from the Bovitech Practice app are working."); return json({ ok: true }); }
    return json({ error: "Unknown task" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
