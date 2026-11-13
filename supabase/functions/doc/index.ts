// Bovitech Super App — "doc" function (v2.46): secure links for invoices and statements, and "email opened" notices.
//  • The app (a signed-in staff member on a trusted device) saves an invoice / statement page and gets back a long random code.
//    The client's link is the app's view.html?t=<code> — that page asks this function for the document (GET ?t=<code>),
//    and each opening is written down so the app can show "👁 Viewed".
//  • Resend can tell us when an email was opened (POST ?resend=1, a webhook). Opened is a hint, not proof.
// Needs database update 10. "Verify JWT" must be OFF for this function (the client opening a link isn't signed in) —
// staff requests are checked here instead, the same way the "mail" function checks them.
// Secrets: none needed for links (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are always there).
//   For "opened" notices only: RESEND_WEBHOOK_SECRET = the signing secret Resend shows for the webhook (Admin jobs).
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WH = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, svix-id, svix-timestamp, svix-signature", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const db = (path: string, init: RequestInit = {}) => fetch(SB_URL + "/rest/v1/" + path, { ...init, headers: { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json", ...(init.headers ?? {}) } });
const okTok = (t: unknown) => typeof t === "string" && /^[A-Za-z0-9_-]{20,80}$/.test(t);
const okId = (t: unknown) => typeof t === "string" && /^[A-Za-z0-9_-]{6,80}$/.test(t);
function newToken() { const b = new Uint8Array(24); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64(bytes: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function unb64(s: string) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

// Resend webhooks are signed the Svix way: HMAC-SHA256 of "<id>.<timestamp>.<body>" with the secret (after "whsec_")
async function svixOk(req: Request, body: string) {
  if (!WH) return false; const id = req.headers.get("svix-id") ?? "", ts = req.headers.get("svix-timestamp") ?? "", sig = req.headers.get("svix-signature") ?? "";
  if (!id || !ts || !sig) return false; if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", unb64(WH.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mine = b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  return sig.split(" ").some((p) => p.split(",")[1] === mine);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  try {
    if (!SR) return json({ error: "The service key is missing" }, 500);
    // ---- the client opens a link ----
    if (req.method === "GET") {
      const t = url.searchParams.get("t"); if (!okTok(t)) return json({ error: "This link isn't right — please check it, or ask us to send it again." }, 400);
      const r = await db(`shared_docs?token=eq.${t}&select=kind,title,html,expires_at`); const L = r.ok ? await r.json() : [];
      const d = L[0]; if (!d) return json({ error: "This link isn't right — please check it, or ask us to send it again." }, 404);
      if (new Date(d.expires_at).getTime() < Date.now()) return json({ error: "This link has expired — please ask us to send it again." }, 410);
      await db("doc_views", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ token: t, ua: (req.headers.get("user-agent") ?? "").slice(0, 200) }) });
      return json({ kind: d.kind, title: d.title, html: d.html });
    }
    if (req.method !== "POST") return json({ error: "GET or POST only" }, 405);
    const raw = await req.text();
    // ---- Resend: an email was opened (a hint only) ----
    if (url.searchParams.get("resend") === "1") {
      if (!(await svixOk(req, raw))) return json({ error: "Not signed by Resend" }, 401);
      const ev = JSON.parse(raw); const eid = ev && ev.data && ev.data.email_id;
      if (okId(eid) && typeof ev.type === "string") await db("email_events?on_conflict=email_id,type,at", { method: "POST", headers: { Prefer: "return=minimal,resolution=ignore-duplicates" }, body: JSON.stringify({ email_id: eid, type: ev.type.slice(0, 40), at: ev.created_at ?? new Date().toISOString() }) });
      return json({ ok: true });
    }
    // ---- the app: a signed-in staff member on a trusted device ----
    const b = JSON.parse(raw || "{}");
    const chk = await fetch(SB_URL + "/rest/v1/rpc/pull_records", { method: "POST", headers: { apikey: req.headers.get("apikey") ?? "", Authorization: req.headers.get("authorization") ?? "", "Content-Type": "application/json" }, body: JSON.stringify({ k: b.k, since: "2100-01-01T00:00:00Z", after_seq: 0, lim: 1 }) });
    if (!chk.ok) return json({ error: "Not signed in on a trusted device" }, 403);
    if (b.task === "make") {
      const html = String(b.html ?? ""); if (!html || html.length > 3_000_000) return json({ error: "The document is empty or too big" }, 400);
      if (!["inv", "stm"].includes(b.kind)) return json({ error: "Unknown kind" }, 400);
      const token = newToken();
      const r = await db("shared_docs", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ token, kind: b.kind, ref: String(b.ref ?? "").slice(0, 120), bid: String(b.bid ?? "").slice(0, 120), title: String(b.title ?? "").slice(0, 200), html, created_by: String(b.by ?? "").slice(0, 60) }) });
      if (!r.ok) return json({ error: "Couldn't save the link (has database update 10 been run?) " + r.status + " " + (await r.text()).slice(0, 200) }, 500);
      return json({ ok: true, t: token });
    }
    if (b.task === "views") {
      const toks = (Array.isArray(b.tokens) ? b.tokens : []).filter(okTok).slice(0, 300); if (!toks.length) return json({ ok: true, views: [] });
      const r = await db(`doc_views?token=in.(${toks.join(",")})&select=token,at&order=at.asc&limit=5000`); if (!r.ok) return json({ error: "Couldn't read the views " + r.status }, 500);
      return json({ ok: true, views: await r.json() });
    }
    if (b.task === "opens") {
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter(okId).slice(0, 300); if (!ids.length) return json({ ok: true, events: [] });
      const r = await db(`email_events?email_id=in.(${ids.join(",")})&select=email_id,type,at&order=at.asc&limit=5000`); if (!r.ok) return json({ error: "Couldn't read the email notices " + r.status }, 500);
      return json({ ok: true, events: await r.json() });
    }
    return json({ error: "Unknown task" }, 400);
  } catch (e) { return json({ error: String((e as Error).message ?? e) }, 500); }
});
