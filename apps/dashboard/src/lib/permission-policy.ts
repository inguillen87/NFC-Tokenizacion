export function dashboardPermissionMatches(granted: unknown, requested?: string | null) {
  const current = String(requested || "").trim();
  if (!current) return true;

  const requestedPermissions = current === "sdk:keys:read"
    ? [current, "tenant:read"]
    : current === "sdk:keys:write"
      ? [current, "tenant:write"]
      : [current];

  for (const rawGrant of Array.isArray(granted) ? granted : []) {
    const grant = String(rawGrant || "").trim();
    if (!grant) continue;
    for (const requestedPermission of requestedPermissions) {
      if (grant === "*" || grant === requestedPermission) return true;
      if (grant.endsWith(":*")) {
        const scope = grant.slice(0, -2);
        if (requestedPermission === scope || requestedPermission.startsWith(`${scope}:`)) return true;
      }
    }
  }
  return false;
}

export function requiredPermissionForAdminResource(method: string, normalizedPath: string) {
  if (normalizedPath === "sdk/api-keys" || normalizedPath.startsWith("sdk/api-keys/")) {
    return String(method || "").toUpperCase() === "GET" ? "sdk:keys:read" : "sdk:keys:write";
  }
  if (normalizedPath === "proof" || normalizedPath.startsWith("proof/")) {
    return String(method || "").toUpperCase() === "GET" ? "proof:read" : "proof:write";
  }
  return null;
}
