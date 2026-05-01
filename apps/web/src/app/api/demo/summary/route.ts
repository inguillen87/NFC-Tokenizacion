export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

function clean(value: unknown) {
  return String(value || "").trim();
}

function maskUid(uidHex: unknown) {
  const value = clean(uidHex).toUpperCase().replace(/[^A-F0-9]/g, "");
  if (!value) return "UID-NA";
  if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function safeEvent(row: unknown) {
  if (!row || typeof row !== "object") return null;
  const event = row as Record<string, unknown>;
  const lat = typeof event.lat === "number" ? event.lat : Number(event.lat);
  const lng = typeof event.lng === "number" ? event.lng : Number(event.lng);
  return {
    id: clean(event.id) || `${clean(event.created_at)}-${maskUid(event.uid_hex)}`,
    result: clean(event.result) || "UNKNOWN",
    uidMasked: maskUid(event.uid_hex),
    created_at: clean(event.created_at),
    city: clean(event.city) || "Unknown",
    country_code: clean(event.country_code) || "UNK",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    product_name: clean(event.product_name),
    sku: clean(event.sku),
    vertical: clean(event.vertical) || "wine",
  };
}

function safePublicEvent(row: unknown) {
  if (!row || typeof row !== "object") return null;
  const event = row as Record<string, unknown>;
  return {
    id: `${clean(event.occurredAt)}-${clean(event.uidMasked)}`,
    result: clean(event.verdict) || "UNKNOWN",
    uidMasked: clean(event.uidMasked) || "UID-NA",
    created_at: clean(event.occurredAt),
    city: clean(event.city) || "Unknown",
    country_code: clean(event.country) || "UNK",
    lat: null,
    lng: null,
    product_name: "",
    sku: "",
    vertical: "wine",
  };
}

async function publicProofFallback() {
  const response = await fetch(`${productUrls.api}/public/proof/summary`, { cache: "no-store" });
  const data = await response.json().catch(() => ({ ok: false, reason: "invalid public proof json" }));
  if (!response.ok || data?.ok === false) {
    return NextResponse.json({ ok: false, reason: clean(data?.reason) || "public proof unavailable", events: [] }, { status: 503 });
  }
  const events = Array.isArray(data.latestPublicEvents) ? data.latestPublicEvents.map(safePublicEvent).filter(Boolean) : [];
  return NextResponse.json({
    ok: true,
    exists: true,
    source: "public-proof",
    tagCount: undefined,
    crm: { leads: 0, tickets: 0, orders: 0 },
    events,
    generatedAt: new Date().toISOString(),
  });
}

export async function GET() {
  const adminKey = clean(process.env.ADMIN_API_KEY);
  if (!adminKey) {
    return publicProofFallback();
  }

  const response = await fetch(`${productUrls.api}/internal/demo/summary`, {
    headers: { Authorization: `Bearer ${adminKey}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
  if (!response.ok || data?.ok === false) {
    return NextResponse.json({ ok: false, reason: clean(data?.reason) || "demo summary unavailable", events: [] }, { status: response.status });
  }

  const events = Array.isArray(data.events) ? data.events.map(safeEvent).filter(Boolean) : [];
  return NextResponse.json({
    ...data,
    events,
    generatedAt: new Date().toISOString(),
  });
}
