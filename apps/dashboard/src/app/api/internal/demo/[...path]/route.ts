export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  generateDashboardDemoEvents,
  recordDashboardDemoEvent,
  resetDashboardDemoEvents,
  type DashboardDemoEvent,
} from "../../../../../lib/demo-runtime-state";
import { getDashboardSession } from "../../../../../lib/session";
import { dashboardPermissionMatches } from "../../../../../lib/permission-policy";
import {
  demoEndpointAllowed,
  demoPayloadScopeAllowed,
  demoTenantScopeAllowed,
  requiredDemoPermission,
  validDemoResetCommand,
} from "../../../../../lib/demo-access-policy";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
const DEMO_FALLBACK_ENABLED = String(process.env.NEXID_ENABLE_DEMO_FALLBACK || process.env.NEXT_PUBLIC_DEMO_MODE || "").toLowerCase() === "true";
const IS_PRODUCTION = String(process.env.NODE_ENV || "").toLowerCase() === "production";

type DemoEvent = { id: number; result: string; uid_hex: string; city: string; country_code: string; lat: number; lng: number; product_name: string; vertical: string; created_at: string };
type SimulateTapPayload = {
  mode?: string;
  scenario?: string;
  result?: string;
  vertical?: string;
  city?: string;
  country?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  device?: string;
  productName?: string;
  product_name?: string;
  tenant?: string;
  tenant_slug?: string;
  tenantName?: string;
  tenant_name?: string;
  bid?: string;
  tapUrl?: string;
  marketplacePath?: string;
};

const MOCK_PACKS = [
  { key: "wine-secure", label: "Wine secure", icType: "NTAG424DNA_TT", batchId: "DEMO-2026-02", tenant: "demobodega", itemId: "demo-item-001" },
  { key: "events-basic", label: "Events basic", icType: "NTAG215", batchId: "EVENTS-2026-01", tenant: "demoevents", itemId: "demo-item-001" },
  { key: "cosmetics-secure", label: "Cosmetics secure", icType: "NTAG424DNA_TT", batchId: "COS-2026-01", tenant: "democosmetics", itemId: "demo-item-001" },
  { key: "agro-secure", label: "Agro secure", icType: "NTAG424DNA_TT", batchId: "AGRO-2026-01", tenant: "demoagro", itemId: "demo-item-001" },
  { key: "pharma-secure", label: "Pharma secure", icType: "NTAG424DNA_TT", batchId: "PHARMA-2026-01", tenant: "demopharma", itemId: "demo-item-001" },
  { key: "luxury-basic", label: "Luxury basic", icType: "NTAG215", batchId: "LUX-2026-01", tenant: "demoluxury", itemId: "demo-item-001" },
  { key: "docs-presence", label: "Docs & presence", icType: "NTAG424DNA", batchId: "DOCS-2026-01", tenant: "demodocs", itemId: "demo-item-001" },
  { key: "reseller-flow", label: "Reseller flow", icType: "NTAG215", batchId: "RSL-2026-01", tenant: "demoreseller", itemId: "demo-item-001" },
  { key: "government-proof", label: "Government proof", icType: "NTAG424DNA", batchId: "GOV-2026-01", tenant: "demogov", itemId: "demo-item-001" },
  { key: "operator-qa", label: "Operator QA", icType: "NTAG424DNA_TT", batchId: "OPS-2026-01", tenant: "demoops", itemId: "demo-item-001" },
];

const state = {
  tenant: { slug: "demobodega", name: "Bodega Balmec" },
  batch: { bid: "DEMO-2026-02", status: "active" },
  tagCount: 120,
  crm: { leads: 0, tickets: 0, orders: 0 },
  events: [] as DemoEvent[],
};

const DEMO_SUPPLIER_UIDS = [
  "0487856A0B1090",
  "048A876A0B1090",
  "0483846A0B1090",
  "047F846A0B1090",
  "047B846A0B1090",
  "0477846A0B1090",
  "0474856A0B1090",
  "0470856A0B1090",
  "0483826A0B1090",
  "0465846A0B1090",
];

function rand(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)] || arr[0]; }
function productByVertical(vertical: string) {
  if (vertical === "events") return "VIP Wristband";
  if (vertical === "cosmetics") return "Derma Serum";
  if (vertical === "agro") return "Seed Pack";
  if (vertical === "pharma") return "Secure Pharma Box";
  return "Gran Reserva Malbec";
}

function pushEvent(vertical = "wine", result = "VALID") {
  const cities = ["Mendoza", "São Paulo", "Santiago", "CDMX", "Miami", "Rosario"];
  const countries = ["AR", "BR", "CL", "MX", "US", "AR"];
  const idx = Math.floor(Math.random() * cities.length);
  const ev: DemoEvent = {
    id: Date.now() + Math.floor(Math.random() * 999),
    result,
    uid_hex: rand(DEMO_SUPPLIER_UIDS),
    city: cities[idx] || "Mendoza",
    country_code: countries[idx] || "AR",
    lat: idx % 2 ? -23.55 : -32.88,
    lng: idx % 2 ? -46.63 : -68.84,
    product_name: productByVertical(vertical),
    vertical,
    created_at: new Date().toISOString(),
  };
  state.events = [ev, ...state.events].slice(0, 25);
}

function pushStateEventFromRuntime(event: DashboardDemoEvent) {
  const ev: DemoEvent = {
    id: event.sequence,
    result: event.result,
    uid_hex: event.uid_hex,
    city: event.city,
    country_code: event.country_code,
    lat: event.lat,
    lng: event.lng,
    product_name: event.product_name,
    vertical: event.vertical,
    created_at: event.created_at,
  };
  state.events = [ev, ...state.events].slice(0, 25);
}

function toNumberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTapUrl(tapUrl: string | undefined) {
  if (!tapUrl) return null;
  try {
    const parsed = new URL(tapUrl);
    return {
      raw: tapUrl,
      bid: parsed.searchParams.get("bid"),
      picc_data: parsed.searchParams.get("picc_data"),
      enc: parsed.searchParams.get("enc"),
      cmac: parsed.searchParams.get("cmac"),
    };
  } catch {
    return { raw: tapUrl, bid: null, picc_data: null, enc: null, cmac: null };
  }
}

function summary() {
  return {
    ok: true,
    exists: true,
    tenant: state.tenant,
    batch: state.batch,
    tagCount: state.tagCount,
    crm: state.crm,
    events: state.events,
  };
}

function fallback(path: string[], req: Request, bodyText: string | undefined) {
  const endpoint = path[0] || "summary";
  const body = bodyText ? JSON.parse(bodyText || "{}") : {};
  const url = new URL(req.url);

  if (endpoint === "pack-file") {
    const pack = String(url.searchParams.get("pack") || "wine-secure");
    const selectedPack = MOCK_PACKS.find((item) => item.key === pack) || MOCK_PACKS[0];
    const type = url.searchParams.get("type") === "seed" ? "seed" : "manifest";
    if (type === "manifest") {
      return {
        ok: true,
        source: "fallback",
        content: `batch_id,uid_hex,roll_id,ic_type\n${selectedPack?.batchId || "DEMO-2026-02"},04B7723401E2A0,001,${selectedPack?.icType || "NTAG424DNA_TT"}`,
        filename: `${pack}.csv`,
        contentType: "text/csv; charset=utf-8",
      };
    }
    return {
      ok: true,
      source: "fallback",
      content: JSON.stringify({ products: [{ uidHex: "04B7723401E2A0", sku: "DEMO-001", productName: "Demo item" }] }, null, 2),
      filename: `${pack}.json`,
      contentType: "application/json; charset=utf-8",
    };
  }

  if (endpoint === "packs") return { ok: true, packs: MOCK_PACKS };
  if (endpoint === "summary") return summary();
  if (endpoint === "use-pack") {
    const pack = String(body.pack || "wine-secure");
    const found = MOCK_PACKS.find((p) => p.key === pack) || MOCK_PACKS[0];
    if (found) state.batch = { bid: found.batchId, status: "active" };
    pushEvent(pack.includes("events") ? "events" : pack.includes("cosmetics") ? "cosmetics" : pack.includes("agro") ? "agro" : pack.includes("pharma") ? "pharma" : "wine", "VALID");
    return { ok: true, source: "fallback", message: `Pack loaded: ${pack}` };
  }
  if (endpoint === "generate-live-scans") {
    const count = Math.min(Math.max(Number(body.count || 10), 1), 30);
    const events = generateDashboardDemoEvents(count);
    for (const event of events) pushStateEventFromRuntime(event);
    return { ok: true, source: "fallback", count, events: events.slice(0, 8) };
  }
  if (endpoint === "simulate-tap") {
    const payload = body as SimulateTapPayload;
    const explicitResult = String(payload.result || "").trim().toUpperCase();
    const mode = String(payload.mode || "valid").trim().toLowerCase();
    const scenario = String(payload.scenario || "valid").trim().toLowerCase();
    const vertical = String(payload.vertical || "wine");
    const allowedResults = ["VALID", "CLAIMED", "REDEEMED", "CHECK_IN", "TAMPER", "REPLAY_SUSPECT"];
    const result = allowedResults.includes(explicitResult)
      ? explicitResult
      : scenario === "claim"
        ? "CLAIMED"
        : scenario === "redeem"
          ? "REDEEMED"
          : scenario === "checkin"
            ? "CHECK_IN"
            : scenario === "tamper" || mode === "tamper"
              ? "TAMPER"
              : scenario === "replay" || mode === "replay"
                ? "REPLAY_SUSPECT"
                : "VALID";
    const riskScore = result === "REPLAY_SUSPECT" ? 76 : result === "TAMPER" ? 42 : 3;
    const qualityScore = result === "REPLAY_SUSPECT" ? 21 : result === "TAMPER" ? 58 : 94;
    const city = String(payload.city || "New York");
    const country = String(payload.country_code || payload.country || "US");
    const lat = toNumberOrNull(payload.lat) ?? 40.7831;
    const lng = toNumberOrNull(payload.lng) ?? -73.9712;
    const tenant = String(payload.tenant_slug || payload.tenant || "demobodega");
    const tenantName = String(payload.tenant_name || payload.tenantName || "Bodega Balmec");
    const bid = String(payload.bid || "DEMO-2026-02");
    const productName = String(payload.product_name || payload.productName || "Gran Reserva Malbec");
    const device = String(payload.device || "iPhone 15 Pro");
    const tapUrl = parseTapUrl(payload.tapUrl);
    const marketplacePath = String(payload.marketplacePath || `/me/marketplace?tenant=${encodeURIComponent(tenant)}`);
    const demoEvent = recordDashboardDemoEvent({
      result,
      mode,
      scenario,
      vertical,
      city,
      country_code: country,
      lat,
      lng,
      tenant_slug: tenant,
      bid,
      product_name: productName,
      device,
      risk: riskScore,
    });
    pushStateEventFromRuntime(demoEvent);
    return {
      ok: true,
      source: "fallback",
      mode,
      scenario,
      result,
      tap: {
        status: result,
        product_state: result === "TAMPER" ? "VALID_OPENED" : result === "REPLAY_SUSPECT" ? "REPLAY_SUSPECT" : "VALID_CLOSED",
        tamper_status: result === "TAMPER" ? "OPENED" : "CLOSED",
        risk_score: riskScore,
        quality_score: qualityScore,
        tenant,
        tenant_name: tenantName,
        bid,
        country,
        city,
        lat,
        lng,
        device,
        product_name: productName,
        tag_type: "NTAG 424 DNA TagTamper",
      },
      nfc: tapUrl,
      consumer_flow: {
        passport_path: `/sun?v=1&bid=${encodeURIComponent(bid)}`,
        marketplace_path: marketplacePath,
        cta: ["view_marketplace", "activate_benefits", "create_account", "tokenize_ownership"],
      },
      dashboard_realtime: {
        event_id: demoEvent.id,
        taps_delta: 1,
        region_delta: `${country} +1`,
        risk_density_recomputed: true,
      },
    };
  }
  if (endpoint === "upload-manifest") {
    const rows = String(body.csv || "").split("\n").filter(Boolean).length;
    state.tagCount = Math.max(state.tagCount, rows);
    return { ok: true, source: "fallback", importedRows: rows };
  }
  if (endpoint === "upload-products") {
    const products =
      (Array.isArray(body.products) ? body.products.length : 0) +
      (Array.isArray(body.bottles) ? body.bottles.length : 0) +
      (Array.isArray(body.items) ? body.items.length : 0) +
      (Array.isArray(body.catalog?.items) ? body.catalog.items.length : 0);
    return { ok: true, source: "fallback", productsImported: products };
  }
  if (endpoint === "reset") {
    state.events = [];
    resetDashboardDemoEvents();
    state.batch = { bid: "DEMO-2026-02", status: "active" };
    return { ok: true, source: "fallback", message: "Demo state reset" };
  }

  return { ok: true, source: "fallback", endpoint, note: "No-op fallback response" };
}

async function authorizeDemoRequest(req: Request, path: string[], bodyText?: string) {
  const session = await getDashboardSession();
  if (!session) {
    return { response: NextResponse.json({ ok: false, reason: "authentication_required" }, { status: 401 }) };
  }
  if (!demoEndpointAllowed(req.method, path)) {
    return { response: NextResponse.json({ ok: false, reason: "demo_endpoint_not_allowed" }, { status: 404 }) };
  }
  const permission = requiredDemoPermission(req.method, path);
  if (session.role !== "super-admin" && !dashboardPermissionMatches(session.permissions, permission)) {
    return { response: NextResponse.json({ ok: false, reason: "permission_denied", permission }, { status: 403 }) };
  }
  if (!demoTenantScopeAllowed(session.role, session.tenantSlug)) {
    return { response: NextResponse.json({ ok: false, reason: "tenant_scope_denied" }, { status: 403 }) };
  }

  let payload: Record<string, unknown> = {};
  if (bodyText) {
    try {
      payload = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      return { response: NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 }) };
    }
    if (!demoPayloadScopeAllowed(payload)) {
      return { response: NextResponse.json({ ok: false, reason: "demo_scope_denied" }, { status: 403 }) };
    }
  }
  if (path[0] === "reset" && !validDemoResetCommand(payload)) {
    return { response: NextResponse.json({ ok: false, reason: "reset_confirmation_required" }, { status: 400 }) };
  }
  return { session, payload };
}

async function forward(req: Request, path: string[], bodyText?: string) {
  const target = `${API_BASE}/internal/demo/${path.join("/")}${new URL(req.url).search}`;
  const body = req.method === "GET" ? undefined : bodyText;
  const url = new URL(req.url);
  const requestWantsDemoFallback =
    DEMO_FALLBACK_ENABLED ||
    url.searchParams.get("demo") === "1" ||
    req.headers.get("x-nexid-demo-fallback") === "1";
  const fallbackAllowed = requestWantsDemoFallback && (!IS_PRODUCTION || DEMO_FALLBACK_ENABLED);

  const failWithoutFallback = (status: number, detail: string) =>
    NextResponse.json(
      {
        ok: false,
        source: "upstream",
        reason: "demo_fallback_disabled",
        detail,
      },
      { status },
    );

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}`,
      },
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      if (!fallbackAllowed) {
        return failWithoutFallback(response.status || 502, "Demo fallback is disabled. Set NEXID_ENABLE_DEMO_FALLBACK=true (or use ?demo=1) only for sandbox sessions.");
      }
      const data = fallback(path, req, body);
      const res = NextResponse.json(data, { status: 200 });
      res.headers.set("x-nexid-demo-data", "DEMO DATA");
      return res;
    }

    const text = await response.text();
    const proxied = new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
    proxied.headers.set("x-nexid-demo-run", randomUUID());
    proxied.headers.set("Cache-Control", "no-store");
    return proxied;
  } catch {
    if (!fallbackAllowed) {
      return failWithoutFallback(502, "Upstream unavailable and demo fallback disabled.");
    }
    const data = fallback(path, req, body);
    const res = NextResponse.json(data, { status: 200 });
    res.headers.set("x-nexid-demo-data", "DEMO DATA");
    return res;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  const path = p.path || [];
  const bodyText = await req.text();
  const authorization = await authorizeDemoRequest(req, path, bodyText);
  if (authorization.response) return authorization.response;
  return forward(req, path, bodyText);
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  const path = p.path || [];
  const authorization = await authorizeDemoRequest(req, path);
  if (authorization.response) return authorization.response;
  const response = await forward(req, path);
  if (path[0] === "pack-file" && response.headers.get("content-type")?.includes("application/json")) {
    const data = await response.json().catch(() => null) as { content?: string; filename?: string; contentType?: string } | null;
    if (data?.content) {
      return new NextResponse(data.content, {
        status: 200,
        headers: {
          "Content-Type": data.contentType || "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"${data.filename || "demo-pack.txt"}\"`,
          "Cache-Control": "no-store",
        },
      });
    }
  }
  return response;
}
