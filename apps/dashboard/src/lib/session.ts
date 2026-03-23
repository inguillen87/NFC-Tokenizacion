import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "./dashboard-content";

export const DASHBOARD_SESSION_COOKIE = "nexid_dashboard_session";

export type DashboardSession = {
  email: string;
  role: UserRole;
  label: string;
};

export function encodeSession(session: DashboardSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export function decodeSession(value: string | undefined | null): DashboardSession | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8");
    const data = JSON.parse(raw) as DashboardSession;
    if (!data?.email || !data?.role || !data?.label) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getDashboardSession() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value);
}

export async function requireDashboardSession() {
  const session = await getDashboardSession();
  if (!session) redirect("/login");
  return session;
}
