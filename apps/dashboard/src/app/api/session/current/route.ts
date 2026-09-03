export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_SNAPSHOT_COOKIE } from "../../../../lib/session";
import { getDashboardSession } from "../../../../lib/session";
import { proxyToApi } from "../../../../lib/api-proxy";
import { cookies } from "next/headers";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function expiredSessionResponse(status: 401 | 403 = 401) {
  const response = NextResponse.json(
    { ok: false, reason: "session_expired" },
    { status },
  );
  response.cookies.delete(DASHBOARD_SESSION_COOKIE);
  response.cookies.delete(DASHBOARD_SESSION_SNAPSHOT_COOKIE);
  return noStore(response);
}

export async function GET() {
  const cookieStore = await cookies();
  const localToken = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value || "";
  if (!localToken || localToken.startsWith("demo.")) {
    const localSession = await getDashboardSession();
    if (localSession?.isDemo) {
      return noStore(NextResponse.json({ ok: true, session: localSession }));
    }
    if (localToken.startsWith("demo.")) return expiredSessionResponse();
  }
  const upstream = await proxyToApi("/auth/session");
  const data = await upstream.json().catch(() => null);
  if (upstream.status === 401 || upstream.status === 403) {
    return expiredSessionResponse(upstream.status);
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
  return noStore(response);
}
