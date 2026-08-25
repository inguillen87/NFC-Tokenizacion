import { NextRequest, NextResponse } from "next/server";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function safeReturnTo(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const response = NextResponse.redirect(new URL(returnTo, url.origin));

  response.cookies.set("theme", theme, {
    maxAge: MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });
  response.cookies.set("nexid-theme-preference-version", "light-default-v1", {
    maxAge: MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
