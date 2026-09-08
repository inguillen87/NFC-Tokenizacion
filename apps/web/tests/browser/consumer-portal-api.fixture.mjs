// Explicit local-only QA server. Never imported by application code or deployed as a route.
import { createServer } from "node:http";
if (process.argv[2] !== "--local-qa") throw new Error("Run only with --local-qa for synthetic browser QA.");
let scenario = "populated";
const consumer = { display_name: "Prueba local · no productiva", email: "qa@example.invalid", status: "verified" };
const items = {
  products: [{ product_name: "Producto de prueba local", brand_name: "Marca de prueba", tenant_slug: "qa-local", latest_tap_event_id: 900001, ownership_status: "viewed" }],
  taps: [
    { tap_event_id: 900001, created_at: "2026-09-08T14:00:00Z", verdict: "VALID_CLOSED", risk_level: "low", tenant_slug: "qa-local", city: "Zona de prueba", country: "AR" },
    { tap_event_id: 900002, created_at: "2026-09-08T13:30:00Z", verdict: "REPLAY", risk_level: "high", tenant_slug: "qa-local", city: null, country: null },
    { tap_event_id: 900003, created_at: null, verdict: "UNKNOWN", risk_level: null, tenant_slug: "qa-local", city: null, country: null },
  ],
  brands: [{ name: "Marca de prueba", slug: "qa-local", status: "active", points_balance: 120 }],
  rewards: [
    { id: "qa-reward-1", title: "Cata de selección · prueba local", tenant_slug: "qa-local", tenant_name: "Marca de prueba", program_name: "Club de prueba", points_cost: 120, points_spent: 100, claim_id: "qa-claim-1", claim_status: "claimed", state: "claimed", claim_expires_at: "2026-09-10T18:00:00Z", redemption_code: "QA-NO-CANJE-001", can_claim: false },
    { id: "qa-reward-2", title: "Visita al viñedo · prueba local", tenant_slug: "qa-local", tenant_name: "Marca de prueba", points_cost: 60, state: "reported", can_claim: false },
    { id: "qa-reward-3", title: "Cupón vencido · prueba local", tenant_slug: "qa-local", tenant_name: "Marca de prueba", points_cost: 50, claim_id: "qa-claim-3", claim_status: "expired", state: "expired", claim_expires_at: "2026-09-07T18:00:00Z", redemption_code: null },
    { id: "qa-reward-4", title: "Experiencia cancelada · prueba local", tenant_slug: "qa-other", tenant_name: "Otra marca de prueba", points_cost: null, claim_id: "qa-claim-4", claim_status: "cancelled", state: "cancelled", claim_expires_at: "2026-09-10T18:00:00Z", redemption_code: null },
  ],
};
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3323");
  res.setHeader("cache-control", "no-store");
  if (url.pathname === "/qa") {
    const requested = url.searchParams.get("scenario");
    if (["populated", "empty", "unavailable", "login"].includes(requested)) scenario = requested;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<h1>Prueba local aislada · sin datos productivos</h1><p>Escenario: ${scenario}</p><a href="/qa?scenario=populated">Con datos</a> · <a href="/qa?scenario=empty">Vacío</a> · <a href="/qa?scenario=unavailable">Sin respuesta</a> · <a href="/qa?scenario=login">Login simulado</a><p><a href="http://127.0.0.1:3322/me">Abrir portal local</a></p>`);
    return;
  }
  res.setHeader("content-type", "application/json");
  if (req.method !== "GET") { res.writeHead(503); res.end(JSON.stringify({ ok: false, error: "otp_provider_unavailable" })); return; }
  if (url.pathname === "/consumer/session") { res.end(JSON.stringify({ ok: scenario !== "login", authenticated: scenario !== "login" })); return; }
  if (scenario === "unavailable") { res.writeHead(503); res.end(JSON.stringify({ ok: false })); return; }
  if (url.pathname === "/consumer/me") { res.end(JSON.stringify({ ok: true, consumer, stats: scenario === "empty" ? {products:0,taps:0,memberships:0} : {products:1,taps:3,memberships:1} })); return; }
  if (url.pathname === "/consumer/wallet") {
    res.end(JSON.stringify({
      ok: true,
      tenantWallets: scenario === "empty" ? [] : [{ slug: "qa-local", name: "Marca de prueba", points_balance: 120, lifetime_points: 180 }],
      networkWallet: { enabled: false, points_balance: 0, lifetime_points: 0 },
    }));
    return;
  }
  if (url.pathname.startsWith("/consumer/taps/")) {
    const item = scenario === "empty" ? null : items.taps.find(tap => String(tap.tap_event_id) === url.pathname.split("/").at(-1));
    if (!item) { res.writeHead(404); res.end(JSON.stringify({ok:false,error:"not_found"})); return; }
    res.end(JSON.stringify({ok:true,item:{...item,tenant_name:"Marca de prueba",product_name:"Producto de prueba local",brand_name:"Marca de prueba",bid:"QA-LOCAL"}})); return;
  }
  const key = url.pathname.replace("/consumer/", "");
  res.end(JSON.stringify({ ok: true, items: scenario === "empty" ? [] : items[key] || [] }));
}).listen(3323, "127.0.0.1", () => console.log("Local synthetic portal API http://127.0.0.1:3323/qa"));
