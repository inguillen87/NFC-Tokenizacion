// Explicit local-only QA server. Never imported by application code or deployed as a route.
import { createServer } from "node:http";
if (process.argv[2] !== "--local-qa") throw new Error("Run only with --local-qa for synthetic browser QA.");
let scenario = "populated";
const consumer = { display_name: "Prueba local · no productiva", email: "qa@example.invalid", status: "verified" };
const items = {
  products: [{ product_name: "Producto de prueba local", brand_name: "Marca de prueba", tenant_slug: "qa-local", latest_tap_event_id: "fixture-only-1", ownership_status: "viewed" }],
  taps: [{ tap_event_id: "fixture-only-1", created_at: "2026-09-08T14:00:00Z", verdict: "VALID_CLOSED", tenant_slug: "qa-local", city: "Zona de prueba", country: "AR" }],
  brands: [{ name: "Marca de prueba", slug: "qa-local", status: "active", points_balance: 120 }],
  rewards: [],
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
  if (url.pathname === "/consumer/me") { res.end(JSON.stringify({ ok: true, consumer, stats: scenario === "empty" ? {products:0,taps:0,memberships:0} : {products:1,taps:1,memberships:1} })); return; }
  const key = url.pathname.replace("/consumer/", "");
  res.end(JSON.stringify({ ok: true, items: scenario === "empty" ? [] : items[key] || [] }));
}).listen(3323, "127.0.0.1", () => console.log("Local synthetic portal API http://127.0.0.1:3323/qa"));
