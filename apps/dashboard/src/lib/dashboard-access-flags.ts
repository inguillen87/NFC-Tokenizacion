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
    "ENABLE_PUBLIC_DEMO_SESSION",
  );
  if (explicit !== null) return explicit;

  return String(process.env.NODE_ENV || "").toLowerCase() !== "production";
}

export function dashboardFallbackSessionAllowed() {
  const explicitAutoSession = readFlag("DASHBOARD_AUTO_SESSION", "ENABLE_PUBLIC_DEMO_SESSION");
  return explicitAutoSession === true;
}
