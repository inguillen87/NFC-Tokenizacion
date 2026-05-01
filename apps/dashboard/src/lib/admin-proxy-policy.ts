type DemoPolicyInput = {
  isProduction: boolean;
  demoMode: boolean;
  demoFallbackAllowed: boolean;
  requireScopedAdminAuth: boolean;
};

export type DemoPolicy = DemoPolicyInput & {
  allowDemoFallback: boolean;
};

export function resolveAdminProxyPolicy(input: DemoPolicyInput): DemoPolicy {
  const allowDemoFallback = input.demoMode && input.demoFallbackAllowed && (!input.isProduction || input.demoMode);
  return { ...input, allowDemoFallback };
}

export function shouldAllowDemoFallback(input: { allowDemoFallback: boolean; isProduction: boolean; demoModeExplicit: boolean }) {
  if (input.allowDemoFallback) return true;
  return resolveAdminProxyPolicy({
    isProduction: input.isProduction,
    demoMode: input.demoModeExplicit,
    demoFallbackAllowed: input.allowDemoFallback,
    requireScopedAdminAuth: false,
  }).allowDemoFallback;
}

const READONLY_DEMO_ALLOWED = [
  "overview",
  "analytics",
  "events",
  "events/stream",
  "consumer-network",
  "consumer-network/",
  "security-alerts",
  "tokenization/requests",
  "tags",
  "tags/",
];

export function canReadonlyDemoAccess(method: string, normalizedPath: string) {
  if (String(method || "").toUpperCase() !== "GET") return false;
  return READONLY_DEMO_ALLOWED.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(prefix));
}
