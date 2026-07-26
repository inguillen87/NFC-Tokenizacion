export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDashboardSession } from "../../../../lib/session";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.nexid.lat";
const MAX_SDP_BYTES = 64_000;
const RATE_WINDOW_MS = 5 * 60_000;
const RATE_MAX = 5;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

function consumeRateLimit(key: string, now = Date.now()) {
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return 0;
  }
  if (current.count >= RATE_MAX) return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  current.count += 1;
  return 0;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "same_origin_required" }, { status: 403 });
  const session = await getDashboardSession();
  if (!session) return NextResponse.json({ error: "dashboard_session_required" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "demo_session_live_ai_disabled" }, { status: 403 });
  const retryAfter = consumeRateLimit(session.id);
  if (retryAfter > 0) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(retryAfter) } });
  const declared = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_SDP_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const body = await req.text();
  if (new TextEncoder().encode(body).byteLength > MAX_SDP_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  if (!body.trim()) return NextResponse.json({ error: "sdp_required" }, { status: 400 });
  const requestedLocale = String(req.headers.get("x-nexid-locale") || "es-AR");
  const locale = ["es-AR", "pt-BR", "en"].includes(requestedLocale) ? requestedLocale : "es-AR";

  try {
    const response = await fetch(`${API_BASE}/realtime/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        "X-Nexid-Locale": locale,
      },
      body,
      cache: "no-store",
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/sdp" },
    });
  } catch {
    return NextResponse.json({ error: "Realtime backend unavailable" }, { status: 503 });
  }
}
