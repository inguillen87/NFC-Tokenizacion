export function shouldAllowDemoFallback(input: { allowDemoFallback: boolean; isProduction: boolean; demoModeExplicit: boolean }) {
  return input.allowDemoFallback && (!input.isProduction || input.demoModeExplicit);
}

const READONLY_DEMO_ALLOWED = [
  "overview",
  "analytics",
  "events",
  "events/stream",
  "security-alerts",
  "tokenization/requests",
  "tags",
  "tags/",
];

export function canReadonlyDemoAccess(method: string, normalizedPath: string) {
  if (String(method || "").toUpperCase() !== "GET") return false;
  return READONLY_DEMO_ALLOWED.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(prefix));
}
