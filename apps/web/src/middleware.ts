import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware((_auth, req: NextRequest) => {
  const host = req.headers.get("host") || "";

  // Canonicalize www -> apex to avoid redirect loops across domain aliases.
  if (host.toLowerCase() === "www.nexid.lat") {
    const url = req.nextUrl.clone();
    url.host = "nexid.lat";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
