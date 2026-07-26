export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

const MAX_PAYLOAD_BYTES = 4_096;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX = 5;
const MAX_RATE_BUCKETS = 1_024;
const DEMO_BID_RE = /^DEMO-[A-Z0-9-]{3,40}$/;
const TENANT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

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

function json(body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function secretMatches(candidate: string, expected: string) {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

function isSameOrigin(req: Request) {
  const origin = clean(req.headers.get("origin"));
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

function clientKey(req: Request) {
  const forwarded = clean(req.headers.get("x-forwarded-for")).split(",")[0]?.trim();
  return forwarded || clean(req.headers.get("x-real-ip")) || "unknown";
}

function consumeRateLimit(key: string, now: number) {
  if (!rateBuckets.has(key) && rateBuckets.size >= MAX_RATE_BUCKETS) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    while (rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldestKey = rateBuckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      rateBuckets.delete(oldestKey);
    }
  }

  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return 0;
  }
  if (current.count >= RATE_LIMIT_MAX) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  }
  current.count += 1;
  return 0;
}

function parsePayload(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function validTenantName(value: string) {
  return value.length >= 2 && value.length <= 80 && !/[\u0000-\u001F\u007F]/.test(value);
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
  // This helper holds a privileged backend credential and must never be a
  // production mutation surface. Production intentionally hides the route.
  if (process.env.NODE_ENV === "production") {
    return json({ ok: false, reason: "not_found" }, 404);
  }

  const gateSecret = clean(process.env.DEMO_ONBOARD_SECRET);
  const adminKey = clean(process.env.ADMIN_API_KEY);
  if (!gateSecret || !adminKey) {
    return json({ ok: false, reason: "not_found" }, 404);
  }

  if (!isSameOrigin(req)) {
    return json({ ok: false, reason: "forbidden" }, 403);
  }

  const suppliedSecret = clean(req.headers.get("x-nexid-demo-onboard-secret"));
  if (!suppliedSecret || !secretMatches(suppliedSecret, gateSecret)) {
    return json({ ok: false, reason: "forbidden" }, 403);
  }

  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
    return json({ ok: false, reason: "payload_too_large" }, 413);
  }

  if (!clean(req.headers.get("content-type")).toLowerCase().startsWith("application/json")) {
    return json({ ok: false, reason: "unsupported_media_type" }, 415);
  }

  const retryAfter = consumeRateLimit(clientKey(req), Date.now());
  if (retryAfter > 0) {
    return json({ ok: false, reason: "rate_limited" }, 429, { "retry-after": String(retryAfter) });
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) {
    return json({ ok: false, reason: "payload_too_large" }, 413);
  }

  const body = parsePayload(raw);
  if (!body) return json({ ok: false, reason: "invalid_json" }, 400);

  const bid = clean(body.bid).toUpperCase();
  const tenantSlug = clean(body.tenant_slug || "demobodega").toLowerCase();
  const tenantName = clean(body.tenant_name || "Bodega Balmec");

  if (!DEMO_BID_RE.test(bid)) {
    return json({ ok: false, reason: "invalid_demo_bid" }, 400);
  }
  if (!TENANT_SLUG_RE.test(tenantSlug) || !validTenantName(tenantName)) {
    return json({ ok: false, reason: "invalid_tenant" }, 400);
  }

  try {
    await apiCall("/admin/tenants", { slug: tenantSlug, name: tenantName }).catch(() => null);
    await apiCall("/admin/batches/register", {
      mode: "internal",
      tenant_slug: tenantSlug,
      bid,
      chip_model: "NTAG 424 DNA TagTamper",
      sku: "wine-secure",
      quantity: DEMO_UIDS.length,
      notes: "Auto-onboarded from /sun validation center",
    });
    const imported = await apiCall(`/admin/batches/${encodeURIComponent(bid)}/import-uids`, { uids: DEMO_UIDS, sourceType: "auto" });
    const activated = await apiCall(`/admin/batches/${encodeURIComponent(bid)}/activate-all`, { limit: DEMO_UIDS.length });
    return json({ ok: true, bid, tenant_slug: tenantSlug, imported: imported.imported || 0, activated: activated.activated || 0 }, 200);
  } catch (error) {
    console.error("[demo-onboard] privileged onboarding failed", error instanceof Error ? error.message : "unknown_error");
    return json({ ok: false, reason: "onboarding_failed" }, 502);
  }
}
