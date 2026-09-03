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

export function isAdminUpstreamAuthorizationOutcome(status: number) {
  return status === 401 || status === 403;
}

const READONLY_DEMO_ALLOWED = [
  "overview",
  "analytics",
  "events",
  "events/stream",
  "sun/physical-taps",
  "notifications",
  "consumer-network",
  "consumer-network/",
  "loyalty/overview",
  "loyalty/rewards",
  "loyalty/trivia/overview",
  "security-alerts",
  "tokenization/requests",
  "polygon/wallet",
  "sdk/api-keys",
  "webhooks",
  "webhook-deliveries",
  "batches",
  "batches/",
  "supplier-orders",
  "supplier-orders/",
  "proof/anchors",
  "proof/events",
  "proof/providers",
  "product-assets",
  "tags",
  "tags/",
];

export function canReadonlyDemoAccess(method: string, normalizedPath: string) {
  if (String(method || "").toUpperCase() !== "GET") return false;
  return READONLY_DEMO_ALLOWED.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(prefix));
}

export function canDemoSandboxAccess(method: string, normalizedPath: string) {
  if (canReadonlyDemoAccess(method, normalizedPath)) return true;
  return String(method || "").toUpperCase() === "POST" && normalizedPath === "tokenization/requests";
}
