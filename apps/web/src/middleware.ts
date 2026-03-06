import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";

  // Canonicalize www -> apex to avoid redirect loops across domain aliases.
  if (host.toLowerCase() === "www.nexid.lat") {
    const url = req.nextUrl.clone();
    url.host = "nexid.lat";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|icon|apple-icon).*)"],
};
