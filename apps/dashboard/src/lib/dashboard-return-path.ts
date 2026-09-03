import { normalizeSafeReturnPath } from "@product/config/safe-return-path";

export const DASHBOARD_RETURN_PATH_HEADER = "x-nexid-return-path";

const AUTH_SURFACE_PATHS = [
  "/login",
  "/logout",
  "/session-recovery",
  "/sign-in",
  "/sign-up",
  "/sso-callback",
  "/auth/",
  "/api/",
];

export function normalizeDashboardReturnPath(value: unknown, fallback = "/") {
  const safePath = normalizeSafeReturnPath(value, fallback);
  const pathname = safePath.split(/[?#]/, 1)[0] || "/";
  if (AUTH_SURFACE_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return "/";
  return safePath;
}

export function dashboardAuthPath(destination: "/login" | "/session-recovery", returnPath: unknown, params?: Record<string, string>) {
  const query = new URLSearchParams(params);
  query.set("next", normalizeDashboardReturnPath(returnPath));
  return `${destination}?${query.toString()}`;
}
