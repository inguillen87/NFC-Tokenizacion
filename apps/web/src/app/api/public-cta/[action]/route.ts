export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";
import { createDemoShareToken } from "../../../../lib/demo-share";

const ALLOWED = new Set(["claim-ownership", "register-warranty", "tokenize-request", "provenance"]);

function clean(value: unknown) {
  return String(value || "").trim();
}

function buildShare(bid: string, uid: string) {
  const now = Math.floor(Date.now() / 1000);
  return createDemoShareToken({ bid, uid, exp: now + 60 * 30 });
}

async function forward(action: string, method: "GET" | "POST", bid: string, uid: string, payload?: Record<string, unknown>) {
  if (!ALLOWED.has(action)) return NextResponse.json({ ok: false, reason: "unsupported CTA action" }, { status: 404 });
  if (!bid || !uid) return NextResponse.json({ ok: false, reason: "bid and uid required" }, { status: 400 });

  const share = buildShare(bid, uid);
  if (!share) return NextResponse.json({ ok: false, reason: "PUBLIC_DEMO_SHARE_SECRET is not configured" }, { status: 500 });

  const url = new URL(`${productUrls.api}/public/cta/${action}`);
  url.searchParams.set("share", share);
  if (method === "GET") {
    url.searchParams.set("bid", bid);
    url.searchParams.set("uid", uid);
  }

  const response = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify({ ...(payload || {}), bid, uid }) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return forward(action, "POST", clean(body.bid), clean(body.uid || body.uid_hex).toUpperCase(), body);
}

export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const url = new URL(req.url);
  const bid = clean(url.searchParams.get("bid"));
  const uid = clean(url.searchParams.get("uid")).toUpperCase();
  return forward(action, "GET", bid, uid);
}
