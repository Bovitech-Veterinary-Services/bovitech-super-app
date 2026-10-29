// Bovitech Super App — "users" function: the admin creates a staff member's login, or sets a new password, from
// Settings → Users. Only the admin, on a trusted device, can use it (checked by public.login_check in the database).
// Uses the project's own service key, which Supabase gives every Edge Function automatically — nothing to paste in.
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_KEY") ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = (path: string, init: RequestInit = {}) => fetch(SB_URL + "/auth/v1/admin" + path, { ...init, headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", ...(init.headers ?? {}) } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { k, action, email, password } = await req.json();
    const em = String(email ?? "").trim().toLowerCase(), pw = String(password ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return json({ error: "Enter their email" }, 400);
    if (pw.length < 8) return json({ error: "The password must be at least 8 characters" }, 400);
    // who is asking: the database checks their sign-in, their device and that they're the admin
    const chk = await fetch(SB_URL + "/rest/v1/rpc/login_check", { method: "POST", headers: { apikey: req.headers.get("apikey") ?? "", Authorization: req.headers.get("authorization") ?? "", "Content-Type": "application/json" }, body: JSON.stringify({ k, email_: em, action_: action }) });
    if (!chk.ok) { const t = await chk.text(); let m = t; try { m = JSON.parse(t).message ?? t; } catch (_) { /* plain text */ } return json({ error: m }, 403); }
    if (action === "create") {
      const r = await admin("/users", { method: "POST", body: JSON.stringify({ email: em, password: pw, email_confirm: true }) });
      if (!r.ok) { const t = await r.text(); return json({ error: /already|exists|registered/i.test(t) ? "That email already has a login — use Set a new password instead" : "Supabase: " + t.slice(0, 200) }, 400); }
      return json({ ok: true });
    }
    // set a new password: find their login by email
    let id = ""; for (let page = 1; page <= 20 && !id; page++) { const r = await admin(`/users?page=${page}&per_page=200`); if (!r.ok) return json({ error: "Supabase: " + (await r.text()).slice(0, 200) }, 500); const js = await r.json(); const list = js.users ?? []; const u = list.find((x: { email?: string }) => (x.email ?? "").toLowerCase() === em); if (u) id = u.id; if (list.length < 200) break; }
    if (!id) return json({ error: "That email has no login yet — use Create login instead" }, 404);
    const r = await admin("/users/" + id, { method: "PUT", body: JSON.stringify({ password: pw }) });
    if (!r.ok) return json({ error: "Supabase: " + (await r.text()).slice(0, 200) }, 400);
    return json({ ok: true });
  } catch (e) { return json({ error: String((e as Error).message ?? e) }, 500); }
});
