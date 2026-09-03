import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfiguredForRuntime } from "../../../../lib/clerk-env";
import { DASHBOARD_CLERK_AUTOSYNC_BLOCK_COOKIE, DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_SNAPSHOT_COOKIE, type DashboardSession } from "../../../../lib/session";
import { normalizeDashboardReturnPath } from "../../../../lib/dashboard-return-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

function useSecureCookie(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.toLowerCase() === "https";
  return process.env.NODE_ENV === "production";
}

function redirectToLogin(req: Request, authError: string, nextPath: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("auth_error", authError);
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url, 303);
}

function encodeSnapshot(session: DashboardSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

type ClerkEmailLike = {
  id?: string | null;
  emailAddress?: string | null;
  verification?: { status?: string | null } | null;
};

function resolveVerifiedEmail(user: Awaited<ReturnType<typeof currentUser>>) {
  const emailAddresses = ((user?.emailAddresses || []) as ClerkEmailLike[]).filter((item) => item.emailAddress);
  if (!emailAddresses.length) return "";

  const primaryId = String(user?.primaryEmailAddressId || "");
  const primary = emailAddresses.find((item) => item.id === primaryId) || emailAddresses[0];
  const verifiedPrimary = primary.verification?.status === "verified" ? primary : null;
  const verifiedFallback = emailAddresses.find((item) => item.verification?.status === "verified");
  return String((verifiedPrimary || verifiedFallback)?.emailAddress || "").trim().toLowerCase();
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const nextPath = normalizeDashboardReturnPath(requestUrl.searchParams.get("next"));
  if (!isClerkConfiguredForRuntime()) {
    return redirectToLogin(req, "clerk_not_configured", nextPath);
  }

  const clerkAuth = await auth().catch(() => null);
  if (!clerkAuth?.userId) {
    const signInUrl = new URL("/sign-in", req.url);
    const completePath = `/auth/clerk/super-admin?next=${encodeURIComponent(nextPath)}`;
    signInUrl.searchParams.set("next", nextPath);
    signInUrl.searchParams.set("fallback_redirect_url", completePath);
    signInUrl.searchParams.set("force_redirect_url", completePath);
    return NextResponse.redirect(signInUrl, 303);
  }

  const clerkUser = await currentUser().catch(() => null);
  const email = resolveVerifiedEmail(clerkUser);
  if (!email) return redirectToLogin(req, "clerk_email_unverified", nextPath);

  const clerkSessionToken = await clerkAuth.getToken().catch(() => null);
  if (!clerkSessionToken) return redirectToLogin(req, "clerk_session_token_missing", nextPath);

  const syncRes = await fetch(`${API_BASE}/auth/clerk-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${clerkSessionToken}`,
      "user-agent": req.headers.get("user-agent") || "dashboard-clerk-super-admin",
    },
    body: JSON.stringify({
      email,
      fullName: clerkUser?.fullName || `${clerkUser?.firstName || ""} ${clerkUser?.lastName || ""}`.trim(),
      externalUserId: clerkUser?.id,
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!syncRes) return redirectToLogin(req, "auth_upstream_unavailable", nextPath);

  const data = await syncRes.json().catch(() => null) as {
    ok?: boolean;
    email?: string;
    role?: string;
    label?: string;
    permissions?: string[];
    sessionToken?: string;
    expiresAt?: string;
    tenantId?: string | null;
    tenantSlug?: string | null;
    reason?: string;
  } | null;

  if (!syncRes.ok || !data?.ok || !data.sessionToken) {
    const error = data?.reason === "clerk_verification_not_configured" || data?.reason === "clerk_authorized_parties_not_configured"
      ? data.reason
      : syncRes.status === 403
      ? "clerk_super_admin_not_allowed"
      : syncRes.status === 401
      ? "clerk_session_invalid"
      : "clerk_sync_failed";
    return redirectToLogin(req, error, nextPath);
  }

  if (data.role !== "super-admin") return redirectToLogin(req, "clerk_sync_failed", nextPath);

  const sessionPayload: DashboardSession = {
    id: data.sessionToken.split(".")[0] || `clerk-super-admin-${email}`,
    email: data.email || email,
    role: "super-admin",
    tenantId: data.tenantId || null,
    tenantSlug: data.tenantSlug || null,
    label: data.label || clerkUser?.fullName || "Super Admin",
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    mfaVerified: false,
    setupCompleted: true,
    expiresAt: data.expiresAt,
  };

  const response = NextResponse.redirect(new URL(nextPath, req.url), 303);
  response.cookies.set(DASHBOARD_SESSION_COOKIE, data.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(req),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, encodeSnapshot(sessionPayload), {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(req),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.cookies.delete(DASHBOARD_CLERK_AUTOSYNC_BLOCK_COOKIE);
  return response;
}
