export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_SNAPSHOT_COOKIE } from "../../../../lib/session";
import { getDashboardSession } from "../../../../lib/session";
import { proxyToApi } from "../../../../lib/api-proxy";
import { cookies } from "next/headers";

export async function GET() {
  const localSession = await getDashboardSession();
  const cookieStore = await cookies();
  const localToken = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value || "";
  if (localSession && (localSession.id.startsWith("demo-") || localToken.startsWith("demo."))) {
    return NextResponse.json({ ok: true, session: localSession });
  }
  const upstream = await proxyToApi("/auth/session");
  const data = await upstream.json().catch(() => null);
  if (upstream.status === 401) {
    return NextResponse.json({
      ok: true,
      session: {
        id: "demo-public-session",
        email: "public@nexid.demo",
        role: "viewer",
        locale: "es-AR",
        mode: "public-demo",
      },
      guest: true,
    });
  }
  const response = NextResponse.json(data || { ok: false }, { status: upstream.status });
  if (data?.session?.email && data?.session?.role) {
    const snapshot = Buffer.from(
      JSON.stringify({
        id: data.session.id || `${data.session.role}-${data.session.email}`,
        email: data.session.email,
        role: data.session.role,
        tenantId: data.session.tenantId || null,
        tenantSlug: data.session.tenantSlug || null,
        label: data.session.label || `${data.session.role} session`,
        permissions: Array.isArray(data.session.permissions) ? data.session.permissions : ["*"],
        mfaVerified: Boolean(data.session.mfaVerified),
        expiresAt: new Date(Date.now() + 60 * 60 * 12 * 1000).toISOString(),
      }),
      "utf8",
    ).toString("base64url");
    response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, snapshot, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  }
  if (data?.rotatedSessionToken) {
    response.cookies.set(DASHBOARD_SESSION_COOKIE, data.rotatedSessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  }
  if (upstream.status === 401 || upstream.status === 403) {
    response.cookies.delete(DASHBOARD_SESSION_COOKIE);
    response.cookies.delete(DASHBOARD_SESSION_SNAPSHOT_COOKIE);
  }
  return response;
}
