// Synthetic, read-only loopback API. No identity, provider, database or device.
import { createServer } from "node:http";

export async function createConsumerPortalLoadingFixture() {
  const requests = [];
  const allowed = new Set(["ready", "session-headers-stall", "session-body-stall", "session-500", "session-malformed", "session-401", "products-body-stall"]);
  const server = createServer((req, res) => {
    const path = new URL(req.url, "http://127.0.0.1").pathname;
    const requested = /(?:^|;\s*)consumer_loading_qa=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    const scenario = allowed.has(requested) ? requested : "session-401";
    const record = { path, scenario, method: req.method, closedBeforeEnd: false };
    requests.push(record);
    res.on("close", () => { record.closedBeforeEnd = !res.writableEnded; });
    res.setHeader("cache-control", "no-store");
    res.setHeader("content-type", "application/json");
    const reply = (body, status = 200) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    if (req.method !== "GET") return reply({ ok: false, error: "fixture_writes_forbidden" }, 405);
    if (path === "/consumer/session") {
      if (scenario === "session-headers-stall") return;
      if (scenario === "session-body-stall") {
        res.writeHead(200); res.flushHeaders(); res.write('{"ok":true,"authenticated":'); return;
      }
      if (scenario === "session-500") return reply({ ok: true, authenticated: true }, 500);
      if (scenario === "session-malformed") { res.writeHead(200); res.end("{malformed"); return; }
      if (scenario === "session-401") return reply({ ok: false, authenticated: false }, 401);
      return reply({ ok: true, authenticated: true, consumer: { id: "synthetic-only" } });
    }
    if (scenario === "session-401" || scenario.startsWith("session-")) return reply({ ok: false, error: "unauthorized_fixture_data" }, 401);
    if (path === "/consumer/me") return reply({ ok: true, consumer: { id: "synthetic-only", display_name: "Cuenta local QA", status: "active" }, stats: { products: 1, taps: 1 } });
    if (path === "/consumer/products") {
      if (scenario === "products-body-stall") { res.writeHead(200); res.flushHeaders(); res.write('{"ok":true,"items":['); return; }
      return reply({ ok: true, items: [{ product_name: "Producto local QA", brand_name: "Marca local QA", tenant_slug: "loading-qa", bid: "LOT-QA", latest_tap_event_id: "900001", ownership_status: "viewed" }] });
    }
    if (["/consumer/taps", "/consumer/brands", "/consumer/experiences"].includes(path)) return reply({ ok: true, items: [] });
    return reply({ ok: false, error: "fixture_route_unknown" }, 404);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
