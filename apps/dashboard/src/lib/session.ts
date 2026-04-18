import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "./dashboard-content";

export const DASHBOARD_SESSION_COOKIE = "nexid_dashboard_session";
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
    email: "admin@demobodega.demo",
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

export async function getDashboardSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;
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
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null) as { ok?: boolean; session?: DashboardSession } | null;
  if (!data?.ok || !data.session) return null;
  return data.session;
}

export async function requireDashboardSession(permission?: string) {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  if (permission && !session.permissions.includes(permission) && !session.permissions.includes("*") && session.role !== "super-admin") redirect("/");
  return session;
}
