import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "./dashboard-content";
import { dashboardDemoAccessAllowedForRole, dashboardFallbackSessionAllowed } from "./dashboard-access-flags";
import { isClerkConfiguredForRuntime } from "./clerk-env";

export const DASHBOARD_SESSION_COOKIE = "nexid_dashboard_session";
export const DASHBOARD_SESSION_SNAPSHOT_COOKIE = "nexid_dashboard_session_snapshot";
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
    };
  } catch {
    return null;
  }
}

function parseSnapshot(raw?: string): DashboardSession | null {
  if (!raw) return null;
  try {
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as DashboardSession & { expiresAt?: string };
    if (!payload?.email || !payload?.role || !payload?.id) return null;
    if (payload.expiresAt) {
      const expMs = Date.parse(payload.expiresAt);
      if (!Number.isNaN(expMs) && expMs < Date.now()) return null;
    }
    return payload;
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
  const snapshot = parseSnapshot(cookieStore.get(DASHBOARD_SESSION_SNAPSHOT_COOKIE)?.value);

  if (token) {
    const isDemoToken = token.startsWith("demo.");
    if (isDemoToken) {
      const demoSession = parseDemoToken(token);
      if (!demoSession || !dashboardDemoAccessAllowedForRole(demoSession.role)) return null;
      if (demoSession) return demoSession;
      return snapshot || demoFallbackSession();
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
    if (snapshot) return snapshot;
  }

  // Clerk auto-sync check on session miss
  if (isClerkConfiguredForRuntime()) {
    try {
      const { auth, currentUser } = await import("@clerk/nextjs/server");
      const clerkAuth = await auth();
      if (clerkAuth.userId) {
        const clerkUser = await currentUser();
        if (clerkUser) {
          const email = clerkUser.emailAddresses[0]?.emailAddress;
          const fullName = clerkUser.fullName || `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();
          const externalUserId = clerkUser.id;

          const syncRes = await fetch(`${API_BASE}/auth/clerk-sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.ADMIN_API_KEY || ""}`,
            },
            body: JSON.stringify({ email, fullName, externalUserId }),
          }).catch(() => null);

          if (syncRes && syncRes.ok) {
            const syncData = await syncRes.json().catch(() => null) as { ok?: boolean; email?: string; role?: string; label?: string; permissions?: string[]; sessionToken?: string; expiresAt?: string; tenantId?: string; tenantSlug?: string; profile?: { metadata?: { setup_completed?: boolean } } } | null;
            if (syncData?.ok && syncData.sessionToken) {
              const setupCompleted = syncData.profile?.metadata?.setup_completed !== false;
              const sessionPayload: DashboardSession = {
                id: syncData.sessionToken.split(".")[0],
                email: syncData.email || email,
                role: (syncData.role || "tenant-admin") as any,
                tenantId: syncData.tenantId || null,
                tenantSlug: syncData.tenantSlug || null,
                label: syncData.label || fullName,
                permissions: syncData.permissions || [],
                mfaVerified: false,
                setupCompleted,
                expiresAt: syncData.expiresAt,
              };

              cookieStore.set(DASHBOARD_SESSION_COOKIE, syncData.sessionToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: 60 * 60 * 12,
              });

              cookieStore.set(DASHBOARD_SESSION_SNAPSHOT_COOKIE, Buffer.from(JSON.stringify(sessionPayload)).toString("base64url"), {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: 60 * 60 * 12,
              });

              return sessionPayload;
            }
          }
        }
      }
    } catch (err) {
      console.error("Clerk session resolution failed:", err);
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
