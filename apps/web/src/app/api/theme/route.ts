import { NextRequest, NextResponse } from "next/server";
import {
  THEME_PREFERENCE_VERSION,
  THEME_PREFERENCE_VERSION_COOKIE,
  themeCookieDomainForHostname,
} from "@product/ui/theme-preference";

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
  const domain = themeCookieDomainForHostname(url.hostname);
  const cookieOptions = {
    maxAge: MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: url.protocol === "https:",
  };

  if (domain) {
    response.cookies.set("theme", theme, { ...cookieOptions, domain });
    response.cookies.set(THEME_PREFERENCE_VERSION_COOKIE, THEME_PREFERENCE_VERSION, { ...cookieOptions, domain });
    const secureAttribute = cookieOptions.secure ? "; Secure" : "";
    // ResponseCookies collapses same-name values even when Domain differs, so append
    // explicit host-only expirations after writing the shared apex/www cookies.
    response.headers.append("Set-Cookie", `theme=; Path=/; Max-Age=0; SameSite=Lax${secureAttribute}`);
    response.headers.append(
      "Set-Cookie",
      `${THEME_PREFERENCE_VERSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secureAttribute}`,
    );
  } else {
    response.cookies.set("theme", theme, cookieOptions);
    response.cookies.set(THEME_PREFERENCE_VERSION_COOKIE, THEME_PREFERENCE_VERSION, cookieOptions);
  }

  return response;
}
