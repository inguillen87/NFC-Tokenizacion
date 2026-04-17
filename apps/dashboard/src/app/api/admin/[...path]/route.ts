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

  if (!response.ok && demoSession) {
    return demoAdminResponse(req.method, path, body || "");
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
