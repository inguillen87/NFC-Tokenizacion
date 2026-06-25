import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE, DASHBOARD_SESSION_SNAPSHOT_COOKIE } from "../../../../lib/session";

export const runtime = "nodejs";

type DemoRole = "super-admin" | "tenant-admin" | "reseller" | "viewer";

function normalizeRole(rawRole: string | null): DemoRole {
  const role = String(rawRole || "tenant-admin").trim().toLowerCase();
  if (role === "super-admin" || role === "tenant-admin" || role === "reseller" || role === "viewer") return role;
  return "tenant-admin";
}

function demoAccountForRole(role: DemoRole) {
  if (role === "super-admin") return { email: "superadmin@nexid.lat", label: "Super Admin Demo", permissions: ["*"] };
  if (role === "tenant-admin") return { email: "demobodega@nexid.lat", label: "Bodega Balmec Admin", permissions: ["*"] };
  if (role === "reseller") return { email: "reseller@nexid.lat", label: "Reseller Partner Demo", permissions: ["*"] };
  return { email: "auditor@nexid.lat", label: "Readonly sandbox session", permissions: ["read:*"] };
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = normalizeRole(url.searchParams.get("role"));
  const account = demoAccountForRole(role);
  const scope = demoTenantScope(role);
  const redirectTo = new URL("/", url.origin);
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

  console.info("[dashboard_login_audit]", JSON.stringify({ event: "direct_demo_login_ok", email: account.email, role }));
  return response;
}
