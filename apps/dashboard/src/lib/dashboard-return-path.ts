import { normalizeSafeReturnPath } from "@product/config/safe-return-path";

export const DASHBOARD_RETURN_PATH_HEADER = "x-nexid-return-path";

const AUTH_SURFACE_ROOTS = [
  "/login",
  "/logout",
  "/session-recovery",
  "/sign-in",
  "/sign-up",
  "/sso-callback",
  "/auth",
  "/api",
];

const MAX_AUTH_SURFACE_DECODE_PASSES = 4;

function isAuthSurfacePathname(pathname: string) {
  return AUTH_SURFACE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function resolvesToAuthSurface(pathname: string) {
  let probe = pathname;

  for (let pass = 0; pass <= MAX_AUTH_SURFACE_DECODE_PASSES; pass += 1) {
    const policyPathname = probe.split(/[?#]/, 1)[0] || "/";
    if (isAuthSurfacePathname(policyPathname)) return true;

    let decoded: string;
    try {
      decoded = decodeURIComponent(probe);
    } catch {
      return true;
    }

    if (decoded === probe) return false;
    probe = decoded;
  }

  // Nested encoding beyond the supported normalization depth is ambiguous,
  // so fail closed instead of returning it to an auth redirect.
  return true;
}

export function normalizeDashboardReturnPath(value: unknown, fallback = "/") {
  const safePath = normalizeSafeReturnPath(value, fallback);
  const pathname = safePath.split(/[?#]/, 1)[0] || "/";
  if (resolvesToAuthSurface(pathname)) return "/";
  return safePath;
}

export function dashboardAuthPath(destination: "/login" | "/session-recovery", returnPath: unknown, params?: Record<string, string>) {
  const query = new URLSearchParams(params);
  query.set("next", normalizeDashboardReturnPath(returnPath));
  return `${destination}?${query.toString()}`;
}
