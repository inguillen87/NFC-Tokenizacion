export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE } from "../../../../lib/session";
import { getDashboardSession } from "../../../../lib/session";
import { proxyToApi } from "../../../../lib/api-proxy";

export async function GET() {
  const localSession = await getDashboardSession();
  if (localSession && localSession.id.startsWith("demo-")) {
    return NextResponse.json({ ok: true, session: localSession });
  }
  const upstream = await proxyToApi("/auth/session");
  const data = await upstream.json().catch(() => null);
  const response = NextResponse.json(data || { ok: false }, { status: upstream.status });
  if (data?.rotatedSessionToken) {
    response.cookies.set(DASHBOARD_SESSION_COOKIE, data.rotatedSessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  }
  if (!upstream.ok) response.cookies.delete(DASHBOARD_SESSION_COOKIE);
  return response;
}
