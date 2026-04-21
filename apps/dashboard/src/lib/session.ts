import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "./dashboard-content";

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
};

function demoFallbackSession(): DashboardSession {
  return {
    id: "demo-tenant-admin-demobodega",
    email: "demobodega@nexid.lat",
    role: "tenant-admin",
    tenantId: "demo-tenant-demobodega",
    tenantSlug: "demobodega",
    label: "tenant-admin demo",
    permissions: ["*"],
    mfaVerified: true,
  };
}

function parseDemoToken(token: string): DashboardSession | null {
  if (!token.startsWith("demo.")) return null;
  const encoded = token.slice("demo.".length);
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    const data = JSON.parse(raw) as { email?: string; role?: UserRole };
    if (!data.email || !data.role) return null;
    return {
      id: `demo-${data.role}-${data.email}`,
      email: data.email,
      role: data.role,
      tenantId: data.role === "tenant-admin" ? "demo-tenant-demobodega" : null,
      tenantSlug: data.role === "tenant-admin" ? "demobodega" : null,
      label: `${data.role} demo`,
      permissions: ["*"],
      mfaVerified: true,
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

export async function getDashboardSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;
  const snapshot = parseSnapshot(cookieStore.get(DASHBOARD_SESSION_SNAPSHOT_COOKIE)?.value);
  if (!token) {
    if (process.env.ENABLE_PUBLIC_DEMO_SESSION === "1") return demoFallbackSession();
    return null;
  }
  const demoSession = parseDemoToken(token);
  if (demoSession) return demoSession;
  const res = await fetch(`${API_BASE}/auth/session`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return snapshot;
  if (res.status === 401 || res.status === 403) return snapshot || null;
  if (!res.ok) return snapshot;
  const data = await res.json().catch(() => null) as { ok?: boolean; session?: DashboardSession } | null;
  if (!data?.ok || !data.session) return snapshot;
  return data.session;
}

export async function requireDashboardSession(permission?: string) {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  if (permission && !session.permissions.includes(permission) && !session.permissions.includes("*") && session.role !== "super-admin") redirect("/");
  return session;
}
