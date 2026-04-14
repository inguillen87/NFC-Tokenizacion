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

function demoAdminResponse(method: string, path: string[], body: string) {
  const normalized = path.join("/");
  const payload = safeParseJson(body);

  if (method === "GET" && normalized === "batches") {
    return NextResponse.json([DEMO_BATCH]);
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
    return NextResponse.json({
      ok: true,
      batch: DEMO_BATCH.bid,
      importedRows: 1,
      activated: payload?.activateImported ? 1 : 0,
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
  return NextResponse.json({ ok: true, demo: true, path: normalized });
}

async function forward(req: Request, path: string[]) {
  if (req.method === "POST" && path.join("/") === "sun/validate") {
    const payload = safeParseJson(await req.text());
    const rawUrl = String(payload?.url || payload?.sampleUrl || "");
    if (!rawUrl) return NextResponse.json({ ok: false, reason: "Missing SUN URL" }, { status: 400 });
    const startedAt = Date.now();
    try {
      const response = await fetch(rawUrl, { cache: "no-store" });
      const latency_ms = Date.now() - startedAt;
      const text = await response.text();
      const parsed = safeParseJson(text);
      const reason = String((parsed?.reason as string) || (parsed?.error as string) || "");
      return NextResponse.json({
        ok: response.ok && !reason,
        reason: reason || (response.ok ? "ok" : response.statusText),
        latency_ms,
        tag_status: parsed?.tag_status || parsed?.status || null,
        batch_status: parsed?.batch_status || null,
        status_code: response.status,
        response: parsed || text,
      }, { status: response.ok ? 200 : response.status });
    } catch (error) {
      return NextResponse.json({ ok: false, reason: error instanceof Error ? error.message : "SUN validation failed", latency_ms: Date.now() - startedAt }, { status: 502 });
    }
  }

  const target = `${API_BASE}/admin/${path.join("/")}${new URL(req.url).search}`;
  const body = req.method === "GET" ? undefined : await req.text();
  const hasAdminKey = Boolean((process.env.ADMIN_API_KEY || "").trim());

  if (!hasAdminKey) {
    return demoAdminResponse(req.method, path, body || "");
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
