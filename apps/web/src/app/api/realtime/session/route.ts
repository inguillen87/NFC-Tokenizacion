export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";
import {
  consumePublicApiRateLimit,
  isSameOriginRequest,
  readBoundedText,
} from "../../../../lib/public-api-guard";

const API_BASE = productUrls.api;
const MAX_SDP_BYTES = 65_536;
const MAX_RESPONSE_BYTES = 131_072;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX = 8;
const ALLOWED_LOCALES = new Set(["es-AR", "pt-BR", "en"]);

function json(body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.NEXID_REALTIME_PUBLIC_ENABLED !== "true") {
    return json({ error: "realtime_not_enabled" }, 503);
  }
  if (!isSameOriginRequest(req)) return json({ error: "forbidden" }, 403);
  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/sdp")) {
    return json({ error: "unsupported_media_type" }, 415);
  }

  const retryAfter = consumePublicApiRateLimit("realtime-session", req, {
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (retryAfter > 0) return json({ error: "rate_limited" }, 429, { "retry-after": String(retryAfter) });

  const bounded = await readBoundedText(req, MAX_SDP_BYTES);
  if (!bounded.ok) return json({ error: bounded.reason }, bounded.status);
  const body = bounded.text;
  if (!body.trim()) return json({ error: "missing_sdp" }, 400);

  const requestedLocale = (req.headers.get("x-nexid-locale") || "es-AR").trim();
  const locale = ALLOWED_LOCALES.has(requestedLocale) ? requestedLocale : "es-AR";

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

    const declaredBytes = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_RESPONSE_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      return json({ error: "realtime_response_too_large" }, 502);
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      return json({ error: "realtime_response_too_large" }, 502);
    }
    if (!response.ok) {
      return json({ error: "realtime_session_failed" }, response.status === 429 ? 429 : 502);
    }
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "cache-control": "no-store",
        "Content-Type": response.headers.get("content-type") || "application/sdp",
      },
    });
  } catch {
    return json({ error: "realtime_backend_unavailable" }, 503);
  }
}
