// Bovitech Practice — "jobs" function: nightly backup to the office OneDrive, and security alert emails.
// Called only by the database (nightly at 2 am Perth, and when something is added to the security log).
// Settings (Edge Functions → Secrets): MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET  (from the Microsoft 365 app registration)
// Optional: MS_MAILBOX (default office@bovitech.com.au), ALERT_TO (default the same), BACKUP_FOLDER, KEEP_DAYS
// "Verify JWT" must be OFF for this function — it checks its own secret instead.

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_KEY") ?? "";
const TENANT = Deno.env.get("MS_TENANT_ID") ?? "";
const CLIENT = Deno.env.get("MS_CLIENT_ID") ?? "";
const SECRET = Deno.env.get("MS_CLIENT_SECRET") ?? "";
const MAILBOX = Deno.env.get("MS_MAILBOX") ?? "office@bovitech.com.au";
const ALERT_TO = Deno.env.get("ALERT_TO") ?? MAILBOX;
const FOLDER = Deno.env.get("BACKUP_FOLDER") ?? "Bovitech Practice/Backups";
const KEEP = Number(Deno.env.get("KEEP_DAYS") ?? "30");
const PREFIX = "bovitech-practice-backup-";

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(SB_URL + path, { ...init, headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`Database ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  return r;
}
const logEvent = (kind: string, detail: Record<string, unknown>) =>
  sb("/rest/v1/security_events", { method: "POST", body: JSON.stringify({ kind, detail }), headers: { Prefer: "return=minimal" } });

let graphToken: { t: string; exp: number } | null = null;
async function graph(path: string, init: RequestInit = {}, raw = false) {
  if (!TENANT || !CLIENT || !SECRET) throw new Error("Microsoft 365 settings (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET) are missing");
  if (!graphToken || graphToken.exp < Date.now() + 60000) {
    const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT, client_secret: SECRET, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    });
    const js = await r.json();
    if (!r.ok) throw new Error("Microsoft sign-in failed: " + (js.error_description ?? r.status));
    graphToken = { t: js.access_token, exp: Date.now() + js.expires_in * 1000 };
  }
  const url = path.startsWith("https://") ? path : "https://graph.microsoft.com/v1.0" + path;
  const r = await fetch(url, { ...init, headers: { Authorization: "Bearer " + graphToken.t, ...(raw ? {} : { "Content-Type": "application/json" }), ...(init.headers ?? {}) } });
  if (!r.ok && r.status !== 404) throw new Error(`Microsoft ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  return r;
}
const drivePath = (p: string) => `/users/${encodeURIComponent(MAILBOX)}/drive/root:/${p.split("/").map(encodeURIComponent).join("/")}`;

async function sendMail(subject: string, text: string) {
  await graph(`/users/${encodeURIComponent(MAILBOX)}/sendMail`, {
    method: "POST",
    body: JSON.stringify({ message: { subject, body: { contentType: "Text", content: text }, toRecipients: [{ emailAddress: { address: ALERT_TO } }] }, saveToSentItems: false }),
  });
}
const perth = (t: string | number | Date) => new Date(t).toLocaleString("en-AU", { timeZone: "Australia/Perth", dateStyle: "medium", timeStyle: "short" });

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
  const body = new TextEncoder().encode(JSON.stringify(out));
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Perth" });
  const name = `${PREFIX}${day}.json`;
  const target = drivePath(`${FOLDER}/${name}`);
  if (body.length < 4 * 1024 * 1024) {
    await graph(`${target}:/content`, { method: "PUT", body, headers: { "Content-Type": "application/json" } }, true);
  } else { // big file: upload in pieces
    const ses = await (await graph(`${target}:/createUploadSession`, { method: "POST", body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }) })).json();
    const CH = 320 * 1024 * 16; // 5 MB, a multiple of 320 KB as Microsoft requires
    for (let i = 0; i < body.length; i += CH) {
      const part = body.slice(i, i + CH);
      const r = await fetch(ses.uploadUrl, { method: "PUT", body: part, headers: { "Content-Length": String(part.length), "Content-Range": `bytes ${i}-${i + part.length - 1}/${body.length}` } });
      if (!r.ok) throw new Error("Upload failed: " + r.status + " " + await r.text());
    }
  }
  // keep the newest KEEP backups
  const list = await graph(`${drivePath(FOLDER)}:/children?$select=id,name&$top=999`);
  if (list.ok) {
    const files = ((await list.json()).value ?? []).filter((f: any) => f.name.startsWith(PREFIX)).sort((a: any, b: any) => b.name.localeCompare(a.name));
    for (const f of files.slice(KEEP)) await graph(`/users/${encodeURIComponent(MAILBOX)}/drive/items/${f.id}`, { method: "DELETE" });
  }
  const counts = { contacts: out.contacts.length, businesses: out.businesses.length, farms: out.farms.length };
  await logEvent("backup_ok", { file: name, size: body.length, ...counts });
  return { ok: true, file: name, size: body.length, ...counts };
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
    e.kind === "backup_failed" ? "Last night's backup to OneDrive didn't work." : `${who} ${WHAT[e.kind] ?? e.kind}.`,
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
