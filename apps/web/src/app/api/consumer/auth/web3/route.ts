export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { productUrls } from "@product/config";
import { isClerkConfiguredForRuntime } from "../../../../../lib/clerk-env";

const MAX_PAYLOAD_BYTES = 2_048;
const CHAIN_ID_RE = /^(?:0x[0-9a-f]{1,16}|[0-9]{1,20})$/i;

function clean(value: unknown) {
  return String(value ?? "").trim();
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

function getSetCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const one = response.headers.get("set-cookie");
  return one ? [one] : [];
}

function rewriteApiCookie(setCookieValue: string, req: Request) {
  const host = req.headers.get("host") || "";
  const isLocalHttp = new URL(req.url).protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  let nextCookie = setCookieValue.replace(/;\s*Domain=[^;]+/gi, "");
  if (isLocalHttp) nextCookie = nextCookie.replace(/;\s*Secure/gi, "");
  return nextCookie;
}

export async function POST(req: Request) {
  if (!isClerkConfiguredForRuntime()) {
    return NextResponse.json({ ok: false, error: "clerk_not_configured" }, { status: 503 });
  }

  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }
  if (!clean(req.headers.get("content-type")).toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "unsupported_media_type" }, { status: 415 });
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }
  const body = parsePayload(raw);
  if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const chainId = clean(body.chainId);
  if (chainId && !CHAIN_ID_RE.test(chainId)) {
    return NextResponse.json({ ok: false, error: "invalid_chain_id" }, { status: 400 });
  }

  const clerkAuth = await auth().catch(() => null);
  const clerkSessionToken = await clerkAuth?.getToken().catch(() => null);
  if (!clerkAuth?.userId || !clerkSessionToken) {
    return NextResponse.json({ ok: false, error: "clerk_session_required" }, { status: 401 });
  }

  const response = await fetch(`${productUrls.api}/consumer/auth/web3`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${clerkSessionToken}`,
      "user-agent": req.headers.get("user-agent") || "nexid-web3-bridge",
    },
    body: JSON.stringify({
      chainId,
    }),
  }).catch((error) => {
    console.error("[consumer-web3] upstream bridge unavailable", error instanceof Error ? error.message : "unknown_error");
    return Response.json({ ok: false, error: "api_unavailable" }, { status: 503 });
  });

  const text = await response.text();
  const next = new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
  for (const cookie of getSetCookies(response)) {
    next.headers.append("set-cookie", rewriteApiCookie(cookie, req));
  }
  return next;
}
