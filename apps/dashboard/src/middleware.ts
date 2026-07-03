import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkConfiguredForRuntime } from "./lib/clerk-env";

// Clerk provides OAuth/session context; nexID IAM still enforces route access
// through getDashboardSession() and the admin API proxy.
const clerkGuard = isClerkConfiguredForRuntime() ? clerkMiddleware() : null;

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  return clerkGuard ? clerkGuard(req, event) : NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
