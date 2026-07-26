export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

const API_BASE = productUrls.api;
const MAX_PAYLOAD_BYTES = 16_384;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX = 10;
const MAX_RATE_BUCKETS = 4_096;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function clean(value: unknown) {
  return String(value ?? "").trim();
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

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ ok: false, reason: "forbidden" }, 403);

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
  const payload = parsePayload(raw);
  if (!payload) return json({ ok: false, reason: "invalid_json" }, 400);
  const body = JSON.stringify(payload);

  try {
    const response = await fetch(`${API_BASE}/public/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });

    const text = await response.text();
    if (response.status >= 500) {
      return json({ ok: false, reason: "lead_backend_failed" }, 502);
    }
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "cache-control": "no-store",
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch {
    return json({ ok: false, reason: "lead_backend_unavailable" }, 503);
  }
}
