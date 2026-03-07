export const runtime = "nodejs";

import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

type DemoEvent = { id: number; result: string; uid_hex: string; city: string; country_code: string; lat: number; lng: number; product_name: string; vertical: string; created_at: string };

const MOCK_PACKS = [
  { key: "wine-secure", icType: "NTAG424DNA_TT", batchId: "DEMO-2026-02" },
  { key: "events-basic", icType: "NTAG215", batchId: "EVENTS-2026-01" },
  { key: "cosmetics-secure", icType: "NTAG424DNA_TT", batchId: "COS-2026-01" },
  { key: "agro-secure", icType: "NTAG424DNA_TT", batchId: "AGRO-2026-01" },
  { key: "pharma-secure", icType: "NTAG424DNA_TT", batchId: "PHARMA-2026-01" },
  { key: "luxury-basic", icType: "NTAG215", batchId: "LUX-2026-01" },
];

const state = {
  tenant: { slug: "demobodega", name: "Demo Bodega" },
  batch: { bid: "DEMO-2026-02", status: "active" },
  tagCount: 120,
  crm: { leads: 0, tickets: 0, orders: 0 },
  events: [] as DemoEvent[],
};

function rand(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)] || arr[0]; }
function pushEvent(vertical = "wine", result = "VALID") {
  const cities = ["Mendoza", "São Paulo", "Santiago", "CDMX", "Miami", "Rosario"];
  const countries = ["AR", "BR", "CL", "MX", "US", "AR"];
  const idx = Math.floor(Math.random() * cities.length);
  const ev: DemoEvent = {
    id: Date.now() + Math.floor(Math.random() * 999),
    result,
    uid_hex: `04B7723410E2${Math.floor(Math.random() * 90 + 10)}`,
    city: cities[idx] || "Mendoza",
    country_code: countries[idx] || "AR",
    lat: idx % 2 ? -23.55 : -32.88,
    lng: idx % 2 ? -46.63 : -68.84,
    product_name: vertical === "events" ? "VIP Wristband" : vertical === "cosmetics" ? "Derma Serum" : vertical === "agro" ? "Seed Pack" : vertical === "pharma" ? "Secure Pharma Box" : "Gran Reserva Malbec",
    vertical,
    created_at: new Date().toISOString(),
  };
  state.events = [ev, ...state.events].slice(0, 25);
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
    for (let i = 0; i < count; i++) pushEvent(rand(["wine", "events", "cosmetics", "agro", "pharma"]), rand(["VALID", "VALID", "VALID", "TAMPER", "REPLAY_SUSPECT"]));
    return { ok: true, source: "fallback", count };
  }
  if (endpoint === "simulate-tap") {
    const mode = String(body.mode || "valid");
    pushEvent("wine", mode === "tamper" ? "TAMPER" : mode === "replay" ? "REPLAY_SUSPECT" : "VALID");
    return { ok: true, source: "fallback", mode };
  }
  if (endpoint === "upload-manifest") {
    const rows = String(body.csv || "").split("\n").filter(Boolean).length;
    state.tagCount = Math.max(state.tagCount, rows);
    return { ok: true, source: "fallback", importedRows: rows };
  }
  if (endpoint === "upload-products") {
    const products = Array.isArray(body.products) ? body.products.length : 0;
    return { ok: true, source: "fallback", productsImported: products };
  }
  if (endpoint === "reset") {
    state.events = [];
    state.batch = { bid: "DEMO-2026-02", status: "active" };
    return { ok: true, source: "fallback", message: "Demo state reset" };
  }

  return { ok: true, source: "fallback", endpoint, note: "No-op fallback response" };
}

async function forward(req: Request, path: string[]) {
  const target = `${API_BASE}/internal/demo/${path.join("/")}${new URL(req.url).search}`;
  const body = req.method === "GET" ? undefined : await req.text();

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
      const data = fallback(path, req, body);
      return NextResponse.json(data, { status: 200 });
    }

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    const data = fallback(path, req, body);
    return NextResponse.json(data, { status: 200 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  return forward(req, p.path || []);
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  return forward(req, p.path || []);
}
