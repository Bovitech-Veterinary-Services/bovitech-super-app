// Bovitech Practice — "jobs" function: nightly backup and security alert emails.
// Called only by the database (nightly at 2 am Perth, and when something is added to the security log).
//   • Backup: the whole database, compressed, saved in this Supabase project's private "backups" storage (last 30 kept)
//     and emailed to the office as an attachment (an off-site copy you can restore from anywhere).
//   • Alerts: an email to the office for new-device sign-ins, wipes, staff changes and failed backups.
// Settings (Edge Functions → Secrets):  RESEND_API_KEY  (from resend.com — sign up with the office email address)
// Optional: ALERT_TO (default office@bovitech.com.au), MAIL_FROM (default Bovitech Practice <onboarding@resend.dev>),
//           BACKUP_EMAIL = daily | weekly | off (default daily), KEEP_DAYS (default 30)
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
  two_step_reset: "had their two-step sign-in reset", staff_changed: "had their staff details or permissions changed", staff_added: "was added as staff", backup_failed: "Nightly backup FAILED",
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

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    const ok = await (await sb("/rest/v1/rpc/check_job_secret", { method: "POST", body: JSON.stringify({ s: req.headers.get("x-job-secret") ?? "" }) })).json();
    if (ok !== true) return json({ error: "Not allowed" }, 403);
    const { task, id } = await req.json().catch(() => ({}));
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
