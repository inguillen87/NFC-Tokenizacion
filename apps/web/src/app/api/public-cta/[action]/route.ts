export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";
import { createDemoShareToken } from "../../../../lib/demo-share";
import {
  consumePublicApiRateLimit,
  isJsonRequest,
  isSameOriginRequest,
  parseJsonRecord,
  readBoundedText,
} from "../../../../lib/public-api-guard";

const ALLOWED = new Set(["claim-ownership", "register-warranty", "tokenize-request", "provenance", "report-problem", "receipt-ocr", "experience-event"]);
const UID_OR_EVENT_RE = /^(?:[0-9A-F]{8,20}|EVENT-\d+)$/;
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const MAX_PAYLOAD_BYTES = 32 * 1024;

function clean(value: unknown) {
  return String(value || "").trim();
}

function traceId() {
  return `cta_${crypto.randomUUID()}`;
}

function buildForwardHeaders(req: Request, trace: string) {
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") || "application/json",
    "x-nexid-trace-id": trace,
  };

  const cookie = req.headers.get("cookie");
  const userAgent = req.headers.get("user-agent");
  const authorization = req.headers.get("authorization");
  if (cookie) headers.cookie = cookie;
  if (userAgent) headers["user-agent"] = userAgent;
  if (authorization) headers.authorization = authorization;
  return headers;
}

function errorResponse(reason: string, status: number, trace: string, retryAfter = 0) {
  const headers: Record<string, string> = { "Cache-Control": "no-store", "x-nexid-trace-id": trace };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json({ ok: false, reason, trace_id: trace }, { status, headers });
}

function getSetCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const one = response.headers.get("set-cookie");
  return one ? [one] : [];
}

function rewriteApiCookie(cookie: string, req: Request) {
  const host = req.headers.get("host") || "";
  const isLocalHttp = new URL(req.url).protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  let nextCookie = cookie.replace(/;\s*Domain=[^;]+/gi, "");
  if (isLocalHttp) nextCookie = nextCookie.replace(/;\s*Secure/gi, "");
  return nextCookie;
}

function safeBuildShare(bid: string, uid: string) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const token = createDemoShareToken({ bid, uid, exp: now + 60 * 30 });
    return token ? ({ token } as const) : ({ reason: "share secret missing" } as const);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed to create share token";
    return { reason } as const;
  }
}

function resolveShareUid(uid: string, eventId: string) {
  const normalizedEventId = clean(eventId);
  if (normalizedEventId) {
    return /^[1-9]\d*$/.test(normalizedEventId) ? `EVENT-${normalizedEventId}` : "";
  }
  const normalizedUid = clean(uid).toUpperCase();
  return /^[0-9A-F]{8,20}$/.test(normalizedUid) ? normalizedUid : "";
}

async function forward(req: Request, action: string, method: "GET" | "POST", bid: string, uid: string, eventId: string, trace: string, payload?: Record<string, unknown>) {
  if (!ALLOWED.has(action)) return NextResponse.json({ ok: false, reason: "unsupported CTA action", trace_id: trace }, { status: 404 });
  const shareUid = resolveShareUid(uid, eventId);
  if (!bid || !shareUid) return NextResponse.json({ ok: false, reason: "bid and uid or event_id required", trace_id: trace }, { status: 400 });
  if (!BID_RE.test(bid)) return NextResponse.json({ ok: false, reason: "invalid bid format", trace_id: trace }, { status: 400 });
  if (!UID_OR_EVENT_RE.test(shareUid)) return NextResponse.json({ ok: false, reason: "invalid uid/event format", trace_id: trace }, { status: 400 });

  const share = safeBuildShare(bid, shareUid);
  const shareToken = "token" in share && typeof share.token === "string" ? share.token : "";
  if (!shareToken) {
    return NextResponse.json({ ok: false, reason: "share_token_unavailable", trace_id: trace }, { status: 503 });
  }
  const url = new URL(`${productUrls.api}/public/cta/${action}`);
  url.searchParams.set("share", shareToken);
  if (method === "GET") {
    url.searchParams.set("bid", bid);
    url.searchParams.set("uid", uid);
    if (eventId) url.searchParams.set("event_id", eventId);
  }

  const payloadEventId = payload && typeof payload.event_id === "string" ? payload.event_id : "";
  const outboundPayload = {
    ...(payload || {}),
    bid,
    uid,
    event_id: eventId || payloadEventId,
  };
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: buildForwardHeaders(req, trace),
      body: method === "POST" ? JSON.stringify(outboundPayload) : undefined,
      cache: "no-store",
    });
  } catch {
    return errorResponse("cta_backend_unavailable", 503, trace);
  }

  const text = await response.text();
  const next = new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "x-nexid-trace-id": trace,
    },
  });
  for (const cookie of getSetCookies(response)) {
    next.headers.append("set-cookie", rewriteApiCookie(cookie, req));
  }
  return next;
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const trace = traceId();
  if (!isSameOriginRequest(req)) return errorResponse("forbidden_origin", 403, trace);
  if (!isJsonRequest(req)) return errorResponse("unsupported_media_type", 415, trace);
  const retryAfter = consumePublicApiRateLimit("public-cta:post", req, { max: 30, windowMs: 10 * 60_000 });
  if (retryAfter) return errorResponse("rate_limited", 429, trace, retryAfter);
  const input = await readBoundedText(req, MAX_PAYLOAD_BYTES);
  if (!input.ok) return errorResponse(input.reason, input.status, trace);
  const body = parseJsonRecord(input.text);
  if (!body) return errorResponse("invalid_json", 400, trace);
  if (action === "experience-event" && !clean(body.fresh_token || body.freshToken)) {
    return errorResponse("fresh_tap_capability_required", 403, trace);
  }
  return forward(req, action, "POST", clean(body.bid), clean(body.uid || body.uid_hex).toUpperCase(), clean(body.event_id || body.eventId), trace, body);
}

export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const trace = traceId();
  const retryAfter = consumePublicApiRateLimit("public-cta:get", req, { max: 120, windowMs: 10 * 60_000 });
  if (retryAfter) return errorResponse("rate_limited", 429, trace, retryAfter);
  const url = new URL(req.url);
  const bid = clean(url.searchParams.get("bid"));
  const uid = clean(url.searchParams.get("uid")).toUpperCase();
  const eventId = clean(url.searchParams.get("event_id") || url.searchParams.get("eventId"));
  return forward(req, action, "GET", bid, uid, eventId, trace);
}
