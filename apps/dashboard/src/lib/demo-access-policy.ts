export const DEMO_TENANT_SLUG = "demobodega";
export const DEMO_BATCH_ID = "DEMO-2026-02";
export const DEMO_RESET_CONFIRMATION = `RESET ${DEMO_TENANT_SLUG}/${DEMO_BATCH_ID}`;

const READ_ENDPOINTS = new Set(["summary", "packs", "pack-file"]);
const RUN_ENDPOINTS = new Set(["simulate-tap", "generate-live-scans"]);
const RESET_ENDPOINTS = new Set(["reset"]);

export function normalizedDemoEndpoint(path: string[]) {
  return String(path[0] || "summary").trim().toLowerCase();
}

export function demoEndpointAllowed(method: string, path: string[]) {
  const verb = String(method || "GET").toUpperCase();
  const endpoint = normalizedDemoEndpoint(path);
  if (path.length > 1) return false;
  if (verb === "GET") return READ_ENDPOINTS.has(endpoint);
  if (verb === "POST") return RUN_ENDPOINTS.has(endpoint) || RESET_ENDPOINTS.has(endpoint);
  return false;
}

export function requiredDemoPermission(method: string, path: string[]) {
  const verb = String(method || "GET").toUpperCase();
  const endpoint = normalizedDemoEndpoint(path);
  if (verb === "GET") return "demo:read";
  if (endpoint === "reset") return "demo:reset";
  return "demo:run";
}

export function demoTenantScopeAllowed(role: string, tenantSlug?: string | null) {
  if (role === "super-admin") return true;
  return String(tenantSlug || "").trim().toLowerCase() === DEMO_TENANT_SLUG;
}

export function demoPayloadScopeAllowed(payload: Record<string, unknown>) {
  const requestedTenant = String(payload.tenant_slug || payload.tenant || DEMO_TENANT_SLUG).trim().toLowerCase();
  const requestedBid = String(payload.bid || payload.batch_id || payload.forceBid || DEMO_BATCH_ID).trim().toUpperCase();
  return requestedTenant === DEMO_TENANT_SLUG && requestedBid === DEMO_BATCH_ID;
}

export function validDemoResetCommand(payload: Record<string, unknown>) {
  return demoPayloadScopeAllowed(payload)
    && String(payload.confirm || "").trim() === DEMO_RESET_CONFIRMATION;
}
