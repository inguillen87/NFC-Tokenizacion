import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkConfiguredForRuntime } from "./lib/clerk-env";
import { INDUSTRY_SLUGS, SOLUTION_SLUGS } from "./lib/marketing-route-slugs";

const solutionSlugSet = new Set<string>(SOLUTION_SLUGS);
const industrySlugSet = new Set<string>(INDUSTRY_SLUGS);

function marketingCatalogNotFound(req: NextRequest) {
  const match = req.nextUrl.pathname.match(/^\/(solutions|industries)\/([^/]+)\/?$/);
  if (!match) return null;

  const [, kind, slug] = match;
  const isKnown = kind === "solutions" ? solutionSlugSet.has(slug) : industrySlugSet.has(slug);
  if (isKnown) return null;

  const url = req.nextUrl.clone();
  url.pathname = "/_not-found";
  return NextResponse.rewrite(url, { status: 404 });
}

function landingMiddleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
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
    return NextResponse.redirect(url, 308);
  }

  const catalogNotFound = marketingCatalogNotFound(req);
  if (catalogNotFound) return catalogNotFound;

  return NextResponse.next();
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
