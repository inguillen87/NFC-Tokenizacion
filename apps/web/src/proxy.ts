import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkConfiguredForRuntime } from "./lib/clerk-env";

function landingMiddleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const isPublicReviewHost = host.toLowerCase().split(":")[0] === "revision.nexid.lat";
  const pathname = req.nextUrl.pathname;
  const shouldCanonicalizeWww = host.toLowerCase() === "www.nexid.lat";
  const shouldCanonicalizeLanding = pathname === "/landing" || pathname === "/landing/";

  // Canonicalize www -> apex and legacy /landing -> / before rendering.
  if (shouldCanonicalizeWww || shouldCanonicalizeLanding) {
    const url = req.nextUrl.clone();
    if (shouldCanonicalizeWww) {
      url.host = "nexid.lat";
      url.protocol = "https:";
    }
    if (shouldCanonicalizeLanding) {
      url.pathname = "/";
    }
    const response = NextResponse.redirect(url, 308);
    if (isPublicReviewHost) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return response;
  }

  const response = NextResponse.next();
  if (isPublicReviewHost) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

const clerkGuard = isClerkConfiguredForRuntime()
  ? clerkMiddleware((_auth, req: NextRequest) => landingMiddleware(req))
  : null;

export function proxy(req: NextRequest, event: Parameters<NonNullable<typeof clerkGuard>>[1]) {
  const host = req.headers.get("host") || "";
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  if (isLocalHost && req.method === "GET" && req.nextUrl.pathname === "/") {
    return landingMiddleware(req);
  }

  return clerkGuard ? clerkGuard(req, event) : landingMiddleware(req);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
