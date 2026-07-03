import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_SNAPSHOT_COOKIE } from "../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function endDashboardSession(req: Request, revokeUpstream: boolean) {
  const cookie = req.headers.get("cookie") || "";
  const token = cookie.split(/;\s*/).find((item) => item.startsWith(`${DASHBOARD_SESSION_COOKIE}=`))?.split("=")[1] || "";
  if (revokeUpstream && token && !token.startsWith("demo.")) {
    await fetch(`${API_BASE}/auth/session`, { method: "DELETE", headers: { authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
  }
  const response = NextResponse.redirect(new URL("/login", req.url));
  response.cookies.delete(DASHBOARD_SESSION_COOKIE);
  response.cookies.delete(DASHBOARD_SESSION_SNAPSHOT_COOKIE);
  return response;
}

export async function GET(req: Request) {
  return endDashboardSession(req, false);
}

export async function POST(req: Request) {
  return endDashboardSession(req, true);
}
