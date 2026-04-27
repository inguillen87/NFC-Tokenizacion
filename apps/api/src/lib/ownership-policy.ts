export const BLOCKED_OWNERSHIP_RESULTS = new Set(["REPLAY_SUSPECT", "DUPLICATE", "INVALID", "NOT_REGISTERED", "NOT_ACTIVE", "TAMPER", "TAMPERED", "REVOKED", "BROKEN"]);

export function matchesOwnershipTenant(input: { eventTenantId?: string | null; requestedTenantId?: string | null }) {
  const eventTenantId = String(input.eventTenantId || "").trim();
  const requestedTenantId = String(input.requestedTenantId || "").trim();
  if (!requestedTenantId) return true;
  return eventTenantId === requestedTenantId;
}

export function evaluateOwnershipEligibility(input: { result: string; tagStatus?: string | null }) {
  const result = String(input.result || "").toUpperCase();
  const tagStatus = String(input.tagStatus || "").toLowerCase();
  const isBlocked = BLOCKED_OWNERSHIP_RESULTS.has(result) || tagStatus === "revoked";
  const nextStatus = isBlocked
    ? (result === "REPLAY_SUSPECT" || result === "DUPLICATE" ? "blocked_replay" : "revoked")
    : "claimed";
  return { isBlocked, nextStatus };
}
