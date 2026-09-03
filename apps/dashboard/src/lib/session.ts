import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "./dashboard-content";
import { dashboardDemoAccessAllowedForRole, dashboardFallbackSessionAllowed } from "./dashboard-access-flags";
import { normalizeDashboardHumanSessionRole } from "./enterprise-runtime-rbac";
import { dashboardPermissionMatches } from "./permission-policy";

export const DASHBOARD_SESSION_COOKIE = "nexid_dashboard_session";
export const DASHBOARD_SESSION_SNAPSHOT_COOKIE = "nexid_dashboard_session_snapshot";
export const DASHBOARD_CLERK_AUTOSYNC_BLOCK_COOKIE = "nexid_dashboard_clerk_autosync_block";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

export type DashboardSession = {
  id: string;
  userId?: string;
  email: string;
  role: UserRole;
  tenantId?: string | null;
  tenantSlug?: string | null;
  label: string;
  permissions: string[];
  deniedPermissions?: string[];
  mfaVerified: boolean;
  rotatedCookieValue?: string | null;
  expiresAt?: string;
  setupCompleted?: boolean;
  isDemo?: boolean;
};

export type DashboardSessionCredential = {
  session: DashboardSession;
  bearerToken: string | null;
  rotatedSessionToken: string | null;
};

function demoFallbackSession(): DashboardSession {
  return {
    id: "demo-tenant-admin-demobodega",
    email: "demobodega@nexid.lat",
    role: "tenant-admin",
    tenantId: "demo-tenant-demobodega",
    tenantSlug: "demobodega",
    label: "Demo Bodega Balmec",
    permissions: ["*"],
    mfaVerified: true,
    setupCompleted: true,
    isDemo: true,
  };
}

function parseDemoToken(token: string): DashboardSession | null {
  if (!token.startsWith("demo.")) return null;
  const encoded = token.slice("demo.".length);
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    let email = "";
    let rawRole: unknown = "";
    try {
      const data = JSON.parse(raw) as { email?: string; role?: unknown };
      email = String(data.email || "");
      rawRole = data.role;
    } catch {
      email = raw.includes("@") ? raw : "";
      rawRole = email.includes("superadmin") ? "super-admin" : "tenant-admin";
    }
    const role = normalizeDashboardHumanSessionRole(rawRole);
    if (!email || !role) return null;
    return {
      id: `demo-${role}-${email}`,
      email,
      role,
      tenantId: role === "tenant-admin" ? "demo-tenant-demobodega" : null,
      tenantSlug: role === "tenant-admin" ? "demobodega" : null,
      label: role === "tenant-admin" ? "Demo Bodega Balmec" : `${role} sandbox`,
      permissions: ["*"],
      mfaVerified: true,
      setupCompleted: true,
      isDemo: true,
    };
  } catch {
    return null;
  }
}

export async function getDashboardSessionCredential(
  options: { persistRotation?: boolean } = {},
): Promise<DashboardSessionCredential | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;

  if (token) {
    const isDemoToken = token.startsWith("demo.");
    if (isDemoToken) {
      const demoSession = parseDemoToken(token);
      if (!demoSession || !dashboardDemoAccessAllowedForRole(demoSession.role)) return null;
      return { session: demoSession, bearerToken: null, rotatedSessionToken: null };
    }

    const res = await fetch(`${API_BASE}/auth/session`, {
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.persistRotation ? { "x-nexid-session-rotation": "rotate" } : {}),
      },
      cache: "no-store",
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null) as {
        ok?: boolean;
        session?: DashboardSession;
        rotatedSessionToken?: string | null;
      } | null;
      if (data?.ok && data.session) {
        const role = normalizeDashboardHumanSessionRole(data.session.role);
        if (!role) return null;
        const rotatedSessionToken = String(data.rotatedSessionToken || data.session.rotatedCookieValue || "").trim() || null;
        if (rotatedSessionToken && options.persistRotation) {
          try {
            cookieStore.set(DASHBOARD_SESSION_COOKIE, rotatedSessionToken, {
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
              maxAge: 60 * 60 * 12,
            });
          } catch {}
        }
        return {
          session: {
            ...data.session,
            role,
            permissions: Array.isArray(data.session.permissions)
              ? data.session.permissions.map((permission) => String(permission))
              : [],
            deniedPermissions: Array.isArray(data.session.deniedPermissions)
              ? data.session.deniedPermissions.map((permission) => String(permission))
              : [],
            rotatedCookieValue: rotatedSessionToken,
          },
          bearerToken: rotatedSessionToken || token,
          rotatedSessionToken,
        };
      }
    }
  }

  if (dashboardFallbackSessionAllowed()) {
    return { session: demoFallbackSession(), bearerToken: null, rotatedSessionToken: null };
  }
  return null;
}

export async function getDashboardSession() {
  return (await getDashboardSessionCredential())?.session || null;
}

export async function requireDashboardSession(permission?: string) {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  if (permission && session.role !== "super-admin" && !dashboardPermissionMatches(
    session.permissions,
    permission,
    session.deniedPermissions,
  )) redirect("/");
  return session;
}
