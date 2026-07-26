import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  EDGE_ORIGIN_AUTH_HEADER,
  EDGE_ORIGIN_VERIFIED_HEADER,
  edgeOriginAllowed,
} from "./lib/edge-origin-guard";

function continueWithSanitizedHeaders(req: NextRequest, verified: boolean) {
  const requestHeaders = new Headers(req.headers);
  // Neither the credential nor a caller-supplied trust marker reaches route
  // handlers. Only this proxy may synthesize the non-secret verified marker.
  requestHeaders.delete(EDGE_ORIGIN_AUTH_HEADER);
  requestHeaders.delete(EDGE_ORIGIN_VERIFIED_HEADER);
  if (verified) requestHeaders.set(EDGE_ORIGIN_VERIFIED_HEADER, "1");
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function proxy(req: NextRequest) {
  const decision = edgeOriginAllowed({
    path: req.nextUrl.pathname,
    method: req.method,
    host: req.headers.get("host") || req.nextUrl.host,
    provided: req.headers.get(EDGE_ORIGIN_AUTH_HEADER),
    expected: process.env.NEXID_EDGE_ORIGIN_SECRET || null,
    previousExpected: process.env.NEXID_EDGE_ORIGIN_SECRET_PREVIOUS || null,
    enforced: process.env.NEXID_EDGE_ORIGIN_ENFORCED,
    vercelEnvironment: process.env.VERCEL_ENV,
    nodeEnvironment: process.env.NODE_ENV,
    protectedHosts: process.env.NEXID_EDGE_ORIGIN_PROTECTED_HOSTS,
  });

  if (decision.allowed) return continueWithSanitizedHeaders(req, decision.verified);

  return NextResponse.json(
    { ok: false, reason: "origin_not_allowed" },
    {
      status: 403,
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
        "x-nexid-origin-guard": "denied",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    },
  );
}

// Run before every API route, including paths with file-like suffixes. Route
// exceptions belong in edgeOriginAllowed and are intentionally limited to the
// exact healthcheck rather than scattered across handlers.
export const config = { matcher: ["/:path*"] };
