const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function readFlag(...names: string[]): boolean | null {
  for (const name of names) {
    const raw = String(process.env[name] || "").trim().toLowerCase();
    if (!raw) continue;
    if (TRUE_VALUES.has(raw)) return true;
    if (FALSE_VALUES.has(raw)) return false;
  }
  return null;
}

export function dashboardOneClickAccessAllowed() {
  const explicit = readFlag(
    "DASHBOARD_ONE_CLICK_ACCESS",
    "DASHBOARD_ALLOW_DEMO_LOGIN",
  );
  if (explicit !== null) return explicit;

  return false;
}

export function dashboardSuperAdminDemoAccessAllowed() {
  const explicit = readFlag(
    "DASHBOARD_SUPERADMIN_DEMO_ACCESS",
    "DASHBOARD_ALLOW_SUPERADMIN_DEMO",
  );
  return explicit === true;
}

export function dashboardBodegaDemoAccessAllowed() {
  const explicit = readFlag(
    "DASHBOARD_BODEGA_DEMO_ACCESS",
    "DASHBOARD_ALLOW_BODEGA_DEMO",
    "ENABLE_BODEGA_BALMEC_DEMO",
  );
  if (explicit !== null) return explicit;

  return true;
}

export function dashboardDemoAccessAllowedForRole(role: string) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "tenant-admin") {
    return dashboardBodegaDemoAccessAllowed() || dashboardOneClickAccessAllowed();
  }
  if (normalizedRole === "super-admin") {
    return dashboardSuperAdminDemoAccessAllowed();
  }
  return false;
}

export function dashboardFallbackSessionAllowed() {
  const explicitAutoSession = readFlag("DASHBOARD_AUTO_SESSION");
  return explicitAutoSession === true;
}
