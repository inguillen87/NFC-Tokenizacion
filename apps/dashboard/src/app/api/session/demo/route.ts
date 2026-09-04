import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_SNAPSHOT_COOKIE } from "../../../../lib/session";
import { getAccessProfiles } from "../../../../lib/access-profiles";
import { noStoreJson, requireSameOrigin } from "../../../../lib/auth-recovery-proxy";
import { dashboardDemoAccessAllowedForRole } from "../../../../lib/dashboard-access-flags";
import { normalizeDashboardReturnPath } from "../../../../lib/dashboard-return-path";

export const runtime = "nodejs";

type DemoRole = "super-admin" | "tenant-admin";

function normalizeRole(rawRole: string | null): DemoRole {
  const role = String(rawRole || "tenant-admin").trim().toLowerCase();
  if (role === "super-admin" || role === "tenant-admin") return role;
  return "tenant-admin";
}

function demoAccountForRole(role: DemoRole) {
  const profile = getAccessProfiles().find((item) => item.role === role && item.available);
  if (profile) {
    return {
      email: profile.email,
      label: profile.label,
      permissions: profile.permissions,
    };
  }
  return { email: "demobodega@nexid.lat", label: "Demo Bodega Balmec", permissions: ["tenant:*", "batches:*", "tags:*", "events:*", "analytics:*", "crm:*", "marketplace:*", "rewards:*", "employees:*"] };
}

function demoTenantScope(role: DemoRole) {
  return role === "tenant-admin"
    ? { tenantId: "demo-tenant-demobodega", tenantSlug: "demobodega" }
    : { tenantId: null, tenantSlug: null };
}

function encodeDemoToken(email: string, role: DemoRole) {
  const payload = Buffer.from(JSON.stringify({ email, role, demo: true }), "utf8").toString("base64url");
  return `demo.${payload}`;
}

function buildSnapshot(email: string, role: DemoRole, label: string, permissions: string[], scope: { tenantId: string | null; tenantSlug: string | null }) {
  return Buffer.from(
    JSON.stringify({
      id: `${role}-${email}`,
      email,
      role,
      ...scope,
      label,
      permissions,
      mfaVerified: true,
      setupCompleted: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 12 * 1000).toISOString(),
    }),
    "utf8",
  ).toString("base64url");
}

function useSecureCookie(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.toLowerCase() === "https";
  return process.env.NODE_ENV === "production";
}

function methodNotAllowed() {
  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "POST",
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

export async function POST(req: Request) {
  if (!requireSameOrigin(req)) {
    console.info("[dashboard_login_audit]", JSON.stringify({ event: "demo_login_denied", reason: "same_origin_required" }));
    return noStoreJson({ ok: false, code: "same_origin_required", reason: "Same-origin POST required." }, 403);
  }

  const url = new URL(req.url);
  const role = normalizeRole(url.searchParams.get("role"));
  const nextPath = normalizeDashboardReturnPath(url.searchParams.get("next"));
  if (role === "super-admin") {
    console.info("[dashboard_login_audit]", JSON.stringify({ event: "direct_operational_login_denied", reason: "superadmin_requires_clerk", role }));
    return noStoreJson(
      { ok: false, code: "superadmin_requires_clerk", reason: "Super Admin requires Google/Clerk allowlist access." },
      403,
    );
  }
  if (!dashboardDemoAccessAllowedForRole(role)) {
    console.info("[dashboard_login_audit]", JSON.stringify({ event: "direct_operational_login_denied", reason: "role_disabled", role }));
    return noStoreJson({ ok: false, reason: "demo access disabled for this role" }, 403);
  }
  const account = demoAccountForRole(role);
  const scope = demoTenantScope(role);
  const redirectTo = new URL(nextPath, url.origin);
  const response = NextResponse.redirect(redirectTo, 303);

  response.cookies.set(DASHBOARD_SESSION_COOKIE, encodeDemoToken(account.email, role), {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(req),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.cookies.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, buildSnapshot(account.email, role, account.label, account.permissions, scope), {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(req),
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  console.info("[dashboard_login_audit]", JSON.stringify({ event: "direct_operational_login_ok", email: account.email, role }));
  return response;
}

export async function GET() {
  return methodNotAllowed();
}

export async function HEAD() {
  return methodNotAllowed();
}
