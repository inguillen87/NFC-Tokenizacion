export function dashboardPermissionMatches(granted: unknown, requested?: string | null) {
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

export function requiredPermissionForAdminResource(method: string, normalizedPath: string) {
  if (normalizedPath === "proof" || normalizedPath.startsWith("proof/")) {
    return String(method || "").toUpperCase() === "GET" ? "proof:read" : "proof:write";
  }
  return null;
}
