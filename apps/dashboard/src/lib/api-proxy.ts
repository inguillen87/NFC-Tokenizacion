import { cookies } from "next/headers";
import { DASHBOARD_SESSION_COOKIE } from "./session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

export async function proxyToApi(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value || "";
  const headers = new Headers(init.headers || {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  return fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
}
