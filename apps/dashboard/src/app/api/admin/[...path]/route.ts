export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

const API_BASE = productUrls.api;
const DEMO_BATCH = {
  bid: "DEMO-2026-02",
  tenant_id: "demobodega",
  sku: "DEMO-SKU",
  qty: 10,
  type: "NTAG 424 DNA TT",
  status: "active",
};

function isDemoSession(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  return cookie.includes("nexid_dashboard_session=demo.");
}

function safeParseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function demoAdminResponse(method: string, path: string[], body: string, reqUrl?: string) {
  const normalized = path.join("/");
  const url = new URL(reqUrl || `http://localhost/admin/${normalized}`);
  const payload = safeParseJson(body);
  const tenantFilter = (url.searchParams.get("tenant") || "").trim().toLowerCase();
  const parseUidRows = (raw: unknown) => {
    const text = String(raw || "").replace(/^\uFEFF/, "").trim();
    if (!text) return [] as string[];
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [] as string[];
    const header = lines[0].toLowerCase();
    if (header.includes(",")) {
      const columns = lines[0].split(",").map((item) => item.trim().toLowerCase());
      const uidIndex = columns.findIndex((item) => ["uid_hex", "uid", "uidhex"].includes(item));
      if (uidIndex < 0) return [];
      return lines
        .slice(1)
        .map((line) => line.split(",")[uidIndex] || "")
        .map((uid) => uid.trim().toUpperCase())
        .filter((uid) => /^[0-9A-F]{8,20}$/.test(uid));
    }
    return lines
      .map((line) => line.replace(/[,;\s]+/g, "").toUpperCase())
      .filter((line) => line !== "UID_HEX")
      .filter((uid) => /^[0-9A-F]{8,20}$/.test(uid));
  };

  if (method === "GET" && normalized === "batches") {
    return NextResponse.json([DEMO_BATCH]);
  }
  if (method === "GET" && normalized === "tenants") {
    const rows = [
      { id: "demo-tenant-001", slug: "demobodega", name: "Demo Bodega", created_at: new Date().toISOString(), scans: 240, duplicates: 5, tamper: 1 },
      { id: "demo-tenant-002", slug: "demoevents", name: "Demo Events", created_at: new Date().toISOString(), scans: 92, duplicates: 2, tamper: 0 },
    ];
    return NextResponse.json(rows);
  }
  if (method === "GET" && normalized === "events") {
    const rows = [
      { id: "evt-demo-001", result: "VALID", reason: "sun_ok", uid_hex: "04A1B2C3D4", created_at: new Date().toISOString(), city: "Mendoza", country_code: "AR", lat: -32.8895, lng: -68.8458, bid: "DEMO-2026-02", tenant_slug: "demobodega" },
      { id: "evt-demo-002", result: "VALID", reason: "sun_ok", uid_hex: "04B1C2D3E4", created_at: new Date().toISOString(), city: "Buenos Aires", country_code: "AR", lat: -34.6037, lng: -58.3816, bid: "DEMO-2026-02", tenant_slug: "demobodega" },
      { id: "evt-demo-003", result: "INVALID", reason: "replay_detected", uid_hex: "04F1E2D3C4", created_at: new Date().toISOString(), city: "São Paulo", country_code: "BR", lat: -23.5505, lng: -46.6333, bid: "EVENT-2026-01", tenant_slug: "demoevents" },
    ];
    const filtered = tenantFilter ? rows.filter((row) => row.tenant_slug === tenantFilter) : rows;
    return NextResponse.json(filtered);
  }
  if (method === "GET" && normalized === "analytics") {
    const now = Date.now();
    const trend = Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(now - (6 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const scans = 40 + index * 6;
      return { day, scans, duplicates: Math.max(1, Math.floor(scans * 0.08)), tamper: Math.max(0, Math.floor(scans * 0.03)) };
    });
    return NextResponse.json({
      scope: { tenant: tenantFilter || "demobodega", source: "real", range: "30d", country: "all" },
      kpis: {
        scans: 512,
        validRate: 92.4,
        invalidRate: 7.6,
        duplicates: 31,
        tamper: 9,
        activeBatches: 4,
        activeTenants: 1,
        geoRegions: 6,
        resellerPerformance: 88,
      },
      geography: {
        countries: [
          { country: "AR", scans: 401, risk: 6.1 },
          { country: "BR", scans: 62, risk: 11.8 },
          { country: "UY", scans: 49, risk: 4.9 },
        ],
        cities: [
          { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458, scans: 218, risk: 3.5, lastSeen: new Date(now - 12 * 60 * 1000).toISOString() },
          { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816, scans: 133, risk: 5.6, lastSeen: new Date(now - 42 * 60 * 1000).toISOString() },
          { city: "Córdoba", country: "AR", lat: -31.4167, lng: -64.1833, scans: 50, risk: 4.1, lastSeen: new Date(now - 5 * 60 * 60 * 1000).toISOString() },
          { city: "São Paulo", country: "BR", lat: -23.5505, lng: -46.6333, scans: 38, risk: 13.8, lastSeen: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
          { city: "Montevideo", country: "UY", lat: -34.9011, lng: -56.1645, scans: 31, risk: 3.1, lastSeen: new Date(now - 7 * 60 * 60 * 1000).toISOString() },
        ],
      },
      devices: {
        os: [{ label: "iOS", count: 262 }, { label: "Android", count: 218 }, { label: "Desktop", count: 32 }],
        browser: [{ label: "Safari", count: 238 }, { label: "Chrome", count: 201 }, { label: "Samsung Internet", count: 48 }, { label: "Edge", count: 25 }],
        deviceType: [{ label: "mobile", count: 465 }, { label: "desktop", count: 32 }, { label: "tablet", count: 15 }],
        timezones: [{ label: "America/Argentina/Mendoza", count: 290 }, { label: "America/Argentina/Buenos_Aires", count: 121 }, { label: "America/Sao_Paulo", count: 68 }],
        mobileShare: 90.8,
      },
      feed: [
        { id: 9012, uidHex: "04A1B2C3D4", bid: "DEMO-2026-02", result: "ok", city: "Mendoza", country: "AR", device: "iPhone 15 Pro", createdAt: new Date(now - 8 * 60 * 1000).toISOString() },
        { id: 9011, uidHex: "04F1E2D3C4", bid: "DEMO-2026-02", result: "replay", city: "São Paulo", country: "BR", device: "Android Pixel 9", createdAt: new Date(now - 25 * 60 * 1000).toISOString() },
      ],
      trend,
      batchStatus: [{ name: "active", value: 4 }, { name: "paused", value: 1 }, { name: "revoked", value: 0 }],
      geoPoints: [
        { city: "Mendoza", country: "AR", scans: 218, risk: 3.5, lat: -32.8895, lng: -68.8458 },
        { city: "Buenos Aires", country: "AR", scans: 133, risk: 5.6, lat: -34.6037, lng: -58.3816 },
        { city: "São Paulo", country: "BR", scans: 38, risk: 13.8, lat: -23.5505, lng: -46.6333 },
      ],
      deviceSignals: [
        { device: "iPhone 15 Pro", scans: 114, countries: 2, validRate: 95.6, risk: 2.9 },
        { device: "Samsung Galaxy S24", scans: 90, countries: 3, validRate: 88.1, risk: 8.7 },
      ],
      tagJourney: [
        {
          uid: "04A1B2C3D4",
          taps: 41,
          firstSeenAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
          lastSeenAt: new Date(now - 9 * 60 * 1000).toISOString(),
          origin: { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458 },
          current: { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
          lastDevice: "iPhone 15 Pro",
        },
      ],
      products: [
        {
          uidHex: "04A1B2C3D4",
          bid: "DEMO-2026-02",
          productName: "Gran Reserva Malbec",
          winery: "Demo Bodega",
          region: "Valle de Uco",
          vintage: "2022",
          scanCount: 41,
          firstSeenAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
          lastSeenAt: new Date(now - 9 * 60 * 1000).toISOString(),
          lastVerifiedCity: "Buenos Aires",
          lastVerifiedCountry: "AR",
          tokenization: { status: "minted", network: "Polygon", txHash: "0xabc123demo", tokenId: "8841" },
        },
      ],
    });
  }
  if (method === "GET" && normalized === "tags") {
    return NextResponse.json({
      scope: { tenant: tenantFilter || "demobodega", source: "real", range: "30d", country: "all", query: "", offset: 0, limit: 100 },
      totals: { total: 3, active_tags: 3, non_active_tags: 0, minted_tags: 1, pending_tokenization: 2 },
      rows: [
        {
          uidHex: "04A1B2C3D4",
          bid: "DEMO-2026-02",
          tenantSlug: "demobodega",
          product: { name: "Gran Reserva Malbec", winery: "Demo Bodega", region: "Valle de Uco", vintage: "2022" },
          status: { tag: "active", lastResult: "ok" },
          scans: { count: 41, firstSeenAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), lastSeenAt: new Date(Date.now() - 9 * 60 * 1000).toISOString() },
          lastVerifiedLocation: { city: "Buenos Aires", country: "AR" },
          tokenization: { status: "minted", network: "Polygon", txHash: "0xabc123demo", tokenId: "8841" },
        },
      ],
    });
  }
  if (method === "GET" && normalized === "tokenization/requests") {
    return NextResponse.json({
      ok: true,
      rows: [
        {
          id: "tok-demo-001",
          tenant_slug: "demobodega",
          bid: "DEMO-2026-02",
          uid_hex: "04A1B2C3D4",
          status: "anchored",
          network: "polygon-amoy",
          tx_hash: "0xabc123demo",
          token_id: "8841",
          requested_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        },
        {
          id: "tok-demo-002",
          tenant_slug: "demobodega",
          bid: "DEMO-2026-02",
          uid_hex: "04FFEEDDCC",
          status: "pending",
          network: "polygon-amoy",
          tx_hash: null,
          token_id: null,
          requested_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        },
      ],
    });
  }
  if (method === "POST" && normalized === "tokenization/requests") {
    return NextResponse.json({
      ok: true,
      status: "anchored",
      request_id: "tok-demo-002",
      tx_hash: "0xanchoredemo",
      token_id: "9901",
      network: "polygon-amoy",
    });
  }
  if (method === "GET" && normalized === "security-alerts") {
    return NextResponse.json({
      ok: true,
      scope: { tenant: tenantFilter || "demobodega", hours: 24 },
      summary: { repeatedInvalidUid: 1, geoVelocityAlerts: 1 },
      repeatedInvalidUid: [
        { uidHex: "04F1E2D3C4", count: 3, lastSeen: new Date(Date.now() - 15 * 60 * 1000).toISOString(), severity: "high" },
      ],
      geoVelocityAlerts: [
        {
          uidHex: "04A1B2C3D4",
          fromCountry: "AR",
          toCountry: "BR",
          fromAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
          toAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          severity: "critical",
        },
      ],
    });
  }
  if (method === "GET" && normalized === "polygon/wallet") {
    return NextResponse.json({
      ok: true,
      network: "polygon-amoy",
      wallet: "0xDemoWallet",
      balancePol: 4.321,
      mode: "simulated",
    });
  }
  if (method === "GET" && normalized.startsWith("tags/") && normalized.endsWith("/passport")) {
    const uid = normalized.split("/")[1] || "04A1B2C3D4";
    return NextResponse.json({
      ok: true,
      scope: { tenant: tenantFilter || "demobodega", source: "real", range: "30d", country: "all" },
      passport: {
        identity: { uidHex: uid, bid: "DEMO-2026-02", tenantSlug: "demobodega", tagStatus: "active", readCounter: 58, scanCount: 41 },
        product: { productName: "Gran Reserva Malbec", winery: "Demo Bodega", region: "Valle de Uco", vintage: "2022", varietal: "Malbec" },
        provenance: {
          origin: { harvestYear: "2022", barrelMonths: 12, temperatureStorage: 16 },
          firstVerified: { at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), city: "Mendoza", country: "AR" },
          lastVerified: { at: new Date(Date.now() - 9 * 60 * 1000).toISOString(), result: "ok", city: "Buenos Aires", country: "AR", deviceLabel: "iPhone 15 Pro" },
        },
        tokenization: { status: "minted", network: "Polygon", txHash: "0xabc123demo", tokenId: "8841" },
      },
      timeline: [
        {
          id: 9012,
          createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
          result: "ok",
          reason: "sun_ok",
          source: "real",
          location: { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
          device: { label: "iPhone 15 Pro", os: "iOS", browser: "Safari", deviceType: "mobile", timezone: "America/Argentina/Buenos_Aires" },
        },
      ],
    });
  }
  if (method === "POST" && normalized === "tenants") {
    return NextResponse.json({
      id: "demo-tenant-001",
      slug: String(payload?.slug || "demobodega"),
      name: String(payload?.name || "Demo Bodega"),
      created_at: new Date().toISOString(),
    }, { status: 201 });
  }
  if (method === "POST" && normalized === "batches") {
    return NextResponse.json({
      ok: true,
      batch: DEMO_BATCH,
      requested_quantity: Number(payload?.qty || DEMO_BATCH.qty),
      ndef_url_template: "https://api.nexid.lat/sun?v=1&bid=DEMO-2026-02&picc_data=...&enc=...&cmac=...",
      keys: {
        k_meta_hex: String(payload?.k_meta_hex || "0123456789ABCDEF0123456789ABCDEF"),
        k_file_hex: String(payload?.k_file_hex || "ABCDEF0123456789ABCDEF0123456789"),
      },
    });
  }
  if (method === "POST" && normalized === "batches/register") {
    return NextResponse.json({
      ok: true,
      batch: { ...DEMO_BATCH, bid: String(payload?.bid || DEMO_BATCH.bid), tenant_id: String(payload?.tenant_slug || DEMO_BATCH.tenant_id) },
      ndef_url_template: `https://api.nexid.lat/sun?v=1&bid=${encodeURIComponent(String(payload?.bid || DEMO_BATCH.bid))}&picc_data=...&enc=...&cmac=...`,
      keys: {
        k_meta_hex: String(payload?.k_meta_hex || "0123456789ABCDEF0123456789ABCDEF"),
        k_file_hex: String(payload?.k_file_hex || "ABCDEF0123456789ABCDEF0123456789"),
      },
    });
  }
  if (method === "POST" && normalized.endsWith("/import-uids")) {
    const uids = Array.isArray(payload?.uids) ? payload?.uids : [];
    return NextResponse.json({
      ok: true,
      batch: normalized.split("/")[1] || DEMO_BATCH.bid,
      imported: uids.length,
      ignored: 0,
    });
  }
  if (method === "POST" && normalized.endsWith("/activate-all")) {
    return NextResponse.json({
      ok: true,
      batch: normalized.split("/")[1] || DEMO_BATCH.bid,
      activated: Number(payload?.limit || 10),
    });
  }
  if (method === "POST" && normalized.endsWith("/import-manifest")) {
    const importedRows = parseUidRows(payload?.csv).length;
    return NextResponse.json({
      ok: true,
      batch: DEMO_BATCH.bid,
      importedRows,
      activated: payload?.activateImported ? importedRows : 0,
      ignored: 0,
      manifestBatchIds: [DEMO_BATCH.bid],
    });
  }
  if (method === "POST" && normalized === "tags/activate") {
    return NextResponse.json({
      ok: true,
      batch: String(payload?.bid || DEMO_BATCH.bid),
      activated: Number(payload?.count || 1),
      requested: Number(payload?.count || 1),
    });
  }
  if (method === "POST" && normalized.endsWith("/revoke")) {
    return NextResponse.json({
      ok: true,
      batch: normalized.split("/")[1] || DEMO_BATCH.bid,
      reason: String(payload?.reason || "manual revoke"),
      status: "revoked",
    });
  }
  if (method === "POST" && normalized === "sun/validate") {
    const reason = String(payload?.url || payload?.sampleUrl || "").trim() ? "Demo validator executed" : "missing sun params";
    const valid = reason !== "missing sun params";
    return NextResponse.json(
      {
        ok: valid,
        result: valid ? "VALID" : "INVALID",
        human_status: valid ? "VALID" : "INVALID",
        reason,
        status_hint: valid ? "VALID" : "INVALID",
        parsed: {
          bid: "DEMO-2026-02",
          uid_hex: "0487856A0B1090",
          picc_data: "DEMO",
        },
        next_step: valid ? "Batch and tag are ready to scan." : "Paste a full /sun URL with bid, picc_data, enc and cmac.",
      },
      { status: valid ? 200 : 400 },
    );
  }
  if (method === "POST" && normalized === "leads") {
    return NextResponse.json(
      {
        ok: true,
        lead: {
          id: "demo-lead-001",
          source: String(payload?.source || "dashboard_demo"),
          interest: String(payload?.interest || "request_demo"),
          email: String(payload?.email || "demo@nexid.lat"),
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  }
  if (method === "POST" && normalized === "users") {
    return NextResponse.json({ ok: true, userId: "demo-user-001" });
  }
  return NextResponse.json({ ok: true, demo: true, path: normalized });
}

async function forward(req: Request, path: string[]) {
  const target = `${API_BASE}/admin/${path.join("/")}${new URL(req.url).search}`;
  const body = req.method === "GET" ? undefined : await req.text();
  const hasAdminKey = Boolean((process.env.ADMIN_API_KEY || "").trim());
  const demoSession = isDemoSession(req);

  if (demoSession || !hasAdminKey) {
    return demoAdminResponse(req.method, path, body || "", req.url);
  }

  const response = await fetch(target, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}`,
    },
    body,
    cache: "no-store",
  });

  if (response.status === 401) {
    return demoAdminResponse(req.method, path, body || "", req.url);
  }

  if (!response.ok && demoSession) {
    return demoAdminResponse(req.method, path, body || "", req.url);
  }

  const text = await response.text();
  return new NextResponse(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") || "application/json" } });
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  return forward(req, p.path || []);
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  return forward(req, p.path || []);
}
