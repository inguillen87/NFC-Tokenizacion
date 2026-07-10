import { NextResponse } from "next/server";
import { DASHBOARD_CLERK_AUTOSYNC_BLOCK_COOKIE, DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_SNAPSHOT_COOKIE } from "../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

function useSecureCookie(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.toLowerCase() === "https";
  return process.env.NODE_ENV === "production";
}

function appendExpiredCookieVariants(response: NextResponse, name: string, req: Request) {
  const secure = useSecureCookie(req) ? "; Secure" : "";
  const base = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
  response.headers.append("Set-Cookie", base);
  response.headers.append("Set-Cookie", `${base}; Domain=.nexid.lat`);
  response.headers.append("Set-Cookie", `${base}; Domain=app.nexid.lat`);
}

async function endDashboardSession(req: Request, revokeUpstream: boolean) {
  const cookie = req.headers.get("cookie") || "";
  const token = cookie.split(/;\s*/).find((item) => item.startsWith(`${DASHBOARD_SESSION_COOKIE}=`))?.split("=")[1] || "";
  if (revokeUpstream && token && !token.startsWith("demo.")) {
    await fetch(`${API_BASE}/auth/session`, { method: "DELETE", headers: { authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
  }
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("logged_out", "1");
  const response = NextResponse.redirect(loginUrl, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Clear-Site-Data", "\"cookies\", \"storage\"");
  response.cookies.delete(DASHBOARD_SESSION_COOKIE);
  response.cookies.delete(DASHBOARD_SESSION_SNAPSHOT_COOKIE);
  response.cookies.set(DASHBOARD_CLERK_AUTOSYNC_BLOCK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(req),
    path: "/",
    maxAge: 60 * 5,
  });
  appendExpiredCookieVariants(response, DASHBOARD_SESSION_COOKIE, req);
  appendExpiredCookieVariants(response, DASHBOARD_SESSION_SNAPSHOT_COOKIE, req);
  return response;
}

export async function GET(req: Request) {
  return endDashboardSession(req, false);
}

export async function POST(req: Request) {
  return endDashboardSession(req, true);
}
