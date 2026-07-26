import { NextResponse } from "next/server";

type RateBucket = { count: number; resetAt: number };
type JsonReadResult = { ok: true; value: Record<string, unknown> } | { ok: false; response: NextResponse };

const rateBuckets = new Map<string, RateBucket>();
const MAX_BODY_BYTES = 4_096;

export function noStoreJson(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      pragma: "no-cache",
    },
  });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function consumeAuthRecoveryRateLimit(request: Request, action: string, maximum: number, windowMs = 15 * 60_000) {
  const now = Date.now();
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-real-ip") || "anonymous";
  const clientKey = forwarded.split(",")[0]?.trim().slice(0, 96) || "anonymous";
  const key = `${action}:${clientKey}`;
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  if (current.count >= maximum) return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  current.count += 1;

  if (rateBuckets.size > 5_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }
  return 0;
}

export async function readBoundedJson(request: Request): Promise<JsonReadResult> {
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return { ok: false, response: noStoreJson({ ok: false, reason: "application_json_required" }, 415) };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false, response: noStoreJson({ ok: false, reason: "request_too_large" }, 413) };
  }

  const raw = await request.text().catch(() => "");
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: noStoreJson({ ok: false, reason: raw ? "request_too_large" : "invalid_json" }, raw ? 413 : 400) };
  }

  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_json_object");
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, response: noStoreJson({ ok: false, reason: "invalid_json" }, 400) };
  }
}

export async function fetchAuthUpstream(url: string, payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
