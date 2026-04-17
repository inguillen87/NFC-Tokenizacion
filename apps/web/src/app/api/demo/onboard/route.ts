export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

const DEMO_UIDS = [
  "04B7723401E2A0",
  "04B7723401E2A1",
  "04B7723401E2A2",
  "04B7723401E2A3",
  "04B7723401E2A4",
  "04B7723401E2A5",
  "04B7723401E2A6",
  "04B7723401E2A7",
  "04B7723401E2A8",
  "04B7723401E2A9",
];

function clean(value: unknown) {
  return String(value || "").trim();
}

async function apiCall(path: string, payload: Record<string, unknown>) {
  const adminKey = clean(process.env.ADMIN_API_KEY);
  if (!adminKey) throw new Error("ADMIN_API_KEY missing in web runtime");
  const response = await fetch(`${productUrls.api}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminKey}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
  if (!response.ok || data?.ok === false) {
    throw new Error(String(data?.reason || `Failed ${path}`));
  }
  return data;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const bid = clean(body.bid).toUpperCase();
  const tenantSlug = clean(body.tenant_slug || "demobodega").toLowerCase();
  const tenantName = clean(body.tenant_name || "Demo Bodega");

  if (!/^DEMO-[A-Z0-9-]{3,40}$/.test(bid)) {
    return NextResponse.json({ ok: false, reason: "Auto-onboarding only enabled for DEMO-* bids" }, { status: 400 });
  }

  try {
    await apiCall("/admin/tenants", { slug: tenantSlug, name: tenantName }).catch(() => null);
    await apiCall("/admin/batches/register", {
      mode: "supplier",
      tenant_slug: tenantSlug,
      bid,
      chip_model: "NTAG 424 DNA TagTamper",
      sku: "wine-secure",
      quantity: DEMO_UIDS.length,
      notes: "Auto-onboarded from /sun validation center",
      k_meta_hex: "C2A462E6AB434828153D73CE440704AC",
      k_file_hex: "BFCE6C576540C04C840F1CFD457BF213",
    });
    const imported = await apiCall(`/admin/batches/${encodeURIComponent(bid)}/import-uids`, { uids: DEMO_UIDS, sourceType: "auto" });
    const activated = await apiCall(`/admin/batches/${encodeURIComponent(bid)}/activate-all`, { limit: DEMO_UIDS.length });
    return NextResponse.json({ ok: true, bid, tenant_slug: tenantSlug, imported: imported.imported || 0, activated: activated.activated || 0 });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: error instanceof Error ? error.message : "onboarding failed" }, { status: 500 });
  }
}
