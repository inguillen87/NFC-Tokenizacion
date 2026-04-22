export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";
import { createDemoShareToken } from "../../../../lib/demo-share";

const ALLOWED = new Set(["claim-ownership", "register-warranty", "tokenize-request", "provenance"]);
const UID_HEX_RE = /^[0-9A-F]{8,20}$/;
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

async function forward(action: string, method: "GET" | "POST", bid: string, uid: string, trace: string, payload?: Record<string, unknown>) {
  if (!ALLOWED.has(action)) return NextResponse.json({ ok: false, reason: "unsupported CTA action", trace_id: trace }, { status: 404 });
  if (!bid || !uid) return NextResponse.json({ ok: false, reason: "bid and uid required", trace_id: trace }, { status: 400 });
  if (!BID_RE.test(bid)) return NextResponse.json({ ok: false, reason: "invalid bid format", trace_id: trace }, { status: 400 });
  if (!UID_HEX_RE.test(uid)) return NextResponse.json({ ok: false, reason: "invalid uid format", trace_id: trace }, { status: 400 });

  const share = safeBuildShare(bid, uid);
  const url = new URL(`${productUrls.api}/public/cta/${action}`);
  const shareToken = "token" in share ? share.token : "";
  if (shareToken) {
    url.searchParams.set("share", shareToken);
  }
  if (method === "GET") {
    url.searchParams.set("bid", bid);
    url.searchParams.set("uid", uid);
  }

  const response = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json", "x-nexid-trace-id": trace },
    body: method === "POST" ? JSON.stringify({ ...(payload || {}), bid, uid }) : undefined,
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
  return forward(action, "POST", clean(body.bid), clean(body.uid || body.uid_hex).toUpperCase(), traceId(), body);
}

export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const url = new URL(req.url);
  const bid = clean(url.searchParams.get("bid"));
  const uid = clean(url.searchParams.get("uid")).toUpperCase();
  return forward(action, "GET", bid, uid, traceId());
}
