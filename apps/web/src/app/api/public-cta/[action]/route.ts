export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";
import { createDemoShareToken } from "../../../../lib/demo-share";

const ALLOWED = new Set(["claim-ownership", "register-warranty", "tokenize-request", "provenance", "report-problem"]);
const UID_OR_EVENT_RE = /^(?:[0-9A-F]{8,20}|EVENT-\d+)$/;
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;

function clean(value: unknown) {
  return String(value || "").trim();
}

function traceId() {
  return `cta_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeBuildShare(bid: string, uid: string) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const token = createDemoShareToken({ bid, uid, exp: now + 60 * 30 });
    return token ? ({ token } as const) : ({ reason: "share secret missing; using insecure demo fallback" } as const);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed to create share token";
    return { reason } as const;
  }
}

function resolveShareUid(uid: string, eventId: string) {
  const normalizedUid = clean(uid).toUpperCase();
  if (/^[0-9A-F]{8,20}$/.test(normalizedUid)) return normalizedUid;
  const normalizedEventId = clean(eventId);
  return /^\d+$/.test(normalizedEventId) ? `EVENT-${normalizedEventId}` : "";
}

async function forward(action: string, method: "GET" | "POST", bid: string, uid: string, eventId: string, trace: string, payload?: Record<string, unknown>) {
  if (!ALLOWED.has(action)) return NextResponse.json({ ok: false, reason: "unsupported CTA action", trace_id: trace }, { status: 404 });
  const shareUid = resolveShareUid(uid, eventId);
  if (!bid || !shareUid) return NextResponse.json({ ok: false, reason: "bid and uid or event_id required", trace_id: trace }, { status: 400 });
  if (!BID_RE.test(bid)) return NextResponse.json({ ok: false, reason: "invalid bid format", trace_id: trace }, { status: 400 });
  if (!UID_OR_EVENT_RE.test(shareUid)) return NextResponse.json({ ok: false, reason: "invalid uid/event format", trace_id: trace }, { status: 400 });

  const share = safeBuildShare(bid, shareUid);
  const url = new URL(`${productUrls.api}/public/cta/${action}`);
  const shareToken = "token" in share ? share.token : "";
  if (shareToken) {
    url.searchParams.set("share", shareToken);
  }
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
  const response = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json", "x-nexid-trace-id": trace },
    body: method === "POST" ? JSON.stringify(outboundPayload) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  const fallbackReason = "reason" in share ? share.reason : null;
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "x-nexid-trace-id": trace,
      ...(fallbackReason ? { "x-nexid-share-mode": "insecure-demo-fallback" } : {}),
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return forward(action, "POST", clean(body.bid), clean(body.uid || body.uid_hex).toUpperCase(), clean(body.event_id || body.eventId), traceId(), body);
}

export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const url = new URL(req.url);
  const bid = clean(url.searchParams.get("bid"));
  const uid = clean(url.searchParams.get("uid")).toUpperCase();
  const eventId = clean(url.searchParams.get("event_id") || url.searchParams.get("eventId"));
  return forward(action, "GET", bid, uid, eventId, traceId());
}
