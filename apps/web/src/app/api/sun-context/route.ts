export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";
import {
  consumePublicApiRateLimit,
  isJsonRequest,
  isSameOriginRequest,
  parseJsonRecord,
  readBoundedText,
} from "../../../lib/public-api-guard";

const MAX_PAYLOAD_BYTES = 16_384;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function json(body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) return json({ ok: false, reason: "forbidden" }, 403);
  if (!isJsonRequest(req)) return json({ ok: false, reason: "unsupported_media_type" }, 415);

  const retryAfter = consumePublicApiRateLimit("sun-context", req, {
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (retryAfter > 0) return json({ ok: false, reason: "rate_limited" }, 429, { "retry-after": String(retryAfter) });

  const bounded = await readBoundedText(req, MAX_PAYLOAD_BYTES);
  if (!bounded.ok) return json({ ok: false, reason: bounded.reason }, bounded.status);
  const body = parseJsonRecord(bounded.text);
  if (!body) return json({ ok: false, reason: "invalid_json" }, 400);

  const response = await fetch(`${productUrls.api}/sun/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    return json({ ok: false, reason: "sun_context_upstream_unavailable" }, 503);
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "cache-control": "no-store",
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}
