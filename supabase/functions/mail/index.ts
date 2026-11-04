// Bovitech Super App — "mail" function: sends an email from the practice (purchase orders to suppliers; more later).
// Anyone signed in on a trusted device can use it (the database checks their sign-in and device).
// Secrets (Edge Functions → Secrets): RESEND_API_KEY (already there for backups) and
//   MAIL_FROM = Bovitech Veterinary Services <office@bovitech.com.au>  — once bovitech.com.au is verified in Resend.
// "Verify JWT" stays ON for this function.
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "";
const REPLY = Deno.env.get("MAIL_REPLY_TO") ?? "office@bovitech.com.au";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const okAddr = (a: unknown) => typeof a === "string" && /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(a.trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { k, to, cc, subject, html, text } = await req.json();
    // who is asking: a signed-in staff member on a trusted device (the database refuses anyone else)
    const chk = await fetch(SB_URL + "/rest/v1/rpc/pull_records", { method: "POST", headers: { apikey: req.headers.get("apikey") ?? "", Authorization: req.headers.get("authorization") ?? "", "Content-Type": "application/json" }, body: JSON.stringify({ k, since: "2100-01-01T00:00:00Z", after_seq: 0, lim: 1 }) });
    if (!chk.ok) return json({ error: "Not signed in on a trusted device" }, 403);
    if (!RESEND) return json({ error: "RESEND_API_KEY is missing (Edge Functions → Secrets)" }, 500);
    if (!FROM) return json({ error: "MAIL_FROM is not set yet (Admin jobs → Email from the app)" }, 500);
    const toL = (Array.isArray(to) ? to : [to]).filter(okAddr).slice(0, 5); const ccL = (Array.isArray(cc) ? cc : cc ? [cc] : []).filter(okAddr).slice(0, 5);
    if (!toL.length) return json({ error: "No valid email address to send to" }, 400);
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: toL, cc: ccL.length ? ccL : undefined, reply_to: REPLY, subject: String(subject ?? "").slice(0, 200), html: html ? String(html).slice(0, 200000) : undefined, text: text ? String(text).slice(0, 100000) : undefined }) });
    if (!r.ok) return json({ error: "Email failed: " + r.status + " " + (await r.text()).slice(0, 300) }, 502);
    return json({ ok: true });
  } catch (e) { return json({ error: String((e as Error).message ?? e) }, 500); }
});
