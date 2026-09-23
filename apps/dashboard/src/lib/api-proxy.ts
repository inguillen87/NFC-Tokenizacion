import { cookies } from "next/headers";
import { DASHBOARD_SESSION_COOKIE, getDashboardSessionCredential } from "./session";
import { dashboardFetch } from "./dashboard-fetch";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

export async function proxyToApi(path: string, init: RequestInit = {}) {
  if (path.startsWith("/admin/") || path.startsWith("/superadmin/")) {
    try {
      const session = (await getDashboardSessionCredential())?.session;
      if (session?.role === "supplier-operator") return Response.json({ ok: false, reason: "supplier_operator_route_forbidden" }, { status: 403, headers: { "cache-control": "private, no-store", "referrer-policy": "no-referrer", Vary: "Cookie" } });
    } catch { return Response.json({ ok: false, reason: "session_unavailable" }, { status: 503, headers: { "cache-control": "private, no-store" } }); }
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value || "";
  const headers = new Headers(init.headers || {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  return dashboardFetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
}
