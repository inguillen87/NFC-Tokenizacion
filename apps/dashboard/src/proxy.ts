import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { getClerkAuthorizedParties, getClerkProxyUrl, isClerkConfiguredForRuntime } from "./lib/clerk-env";
import { DASHBOARD_RETURN_PATH_HEADER, normalizeDashboardReturnPath } from "./lib/dashboard-return-path";

// Clerk provides OAuth/session context; nexID IAM still enforces route access
// through getDashboardSession() and the admin API proxy.
const clerkProxyUrl = getClerkProxyUrl();
const clerkOptions = {
  authorizedParties: getClerkAuthorizedParties(),
  ...(clerkProxyUrl
    ? {
        frontendApiProxy: { enabled: true },
        proxyUrl: clerkProxyUrl,
      }
    : {}),
};

function continueWithReturnPath(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(
    DASHBOARD_RETURN_PATH_HEADER,
    normalizeDashboardReturnPath(`${req.nextUrl.pathname}${req.nextUrl.search}`),
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}

const clerkGuard = isClerkConfiguredForRuntime()
  ? clerkMiddleware((_auth, req) => continueWithReturnPath(req), clerkOptions)
  : null;

export function proxy(req: NextRequest, event: NextFetchEvent) {
  return clerkGuard ? clerkGuard(req, event) : continueWithReturnPath(req);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
