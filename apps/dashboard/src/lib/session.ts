import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "./dashboard-content";
import { dashboardDemoAccessAllowedForRole, dashboardFallbackSessionAllowed } from "./dashboard-access-flags";

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
  mfaVerified: boolean;
  rotatedCookieValue?: string | null;
  expiresAt?: string;
  setupCompleted?: boolean;
  isDemo?: boolean;
};

function demoFallbackSession(): DashboardSession {
  return {
    id: "demo-tenant-admin-demobodega",
    email: "demobodega@nexid.lat",
    role: "tenant-admin",
    tenantId: "demo-tenant-demobodega",
    tenantSlug: "demobodega",
    label: "Bodega Balmec Admin",
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
    let role: UserRole | "" = "";
    try {
      const data = JSON.parse(raw) as { email?: string; role?: UserRole };
      email = String(data.email || "");
      role = (data.role || "") as UserRole;
    } catch {
      email = raw.includes("@") ? raw : "";
      role = email.includes("superadmin") ? "super-admin" : "tenant-admin";
    }
    if (!email || !role) return null;
    return {
      id: `demo-${role}-${email}`,
      email,
      role,
      tenantId: role === "tenant-admin" ? "demo-tenant-demobodega" : null,
      tenantSlug: role === "tenant-admin" ? "demobodega" : null,
      label: role === "tenant-admin" ? "Bodega Balmec Admin" : `${role} sandbox`,
      permissions: ["*"],
      mfaVerified: true,
      setupCompleted: true,
      isDemo: true,
    };
  } catch {
    return null;
  }
}

function permissionMatches(granted: string[], requested?: string | null) {
  const current = String(requested || "").trim();
  if (!current) return true;

  for (const rawGrant of Array.isArray(granted) ? granted : []) {
    const grant = String(rawGrant || "").trim();
    if (!grant) continue;
    if (grant === "*" || grant === current) return true;
    if (grant.endsWith(":*")) {
      const scope = grant.slice(0, -2);
      if (current === scope || current.startsWith(`${scope}:`)) return true;
    }
  }

  return false;
}

export async function getDashboardSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;

  if (token) {
    const isDemoToken = token.startsWith("demo.");
    if (isDemoToken) {
      const demoSession = parseDemoToken(token);
      if (!demoSession || !dashboardDemoAccessAllowedForRole(demoSession.role)) return null;
      return demoSession;
    }

    const res = await fetch(`${API_BASE}/auth/session`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null) as { ok?: boolean; session?: DashboardSession } | null;
      if (data?.ok && data.session) {
        return data.session;
      }
    }
  }

  if (dashboardFallbackSessionAllowed()) return demoFallbackSession();
  return null;
}

export async function requireDashboardSession(permission?: string) {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  if (permission && session.role !== "super-admin" && !permissionMatches(session.permissions, permission)) redirect("/");
  return session;
}
