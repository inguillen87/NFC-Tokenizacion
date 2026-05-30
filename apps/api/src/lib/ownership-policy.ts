export const BLOCKED_OWNERSHIP_RESULTS = new Set(["REPLAY_SUSPECT", "DUPLICATE", "INVALID", "NOT_REGISTERED", "NOT_ACTIVE", "TAMPER", "TAMPERED", "REVOKED", "BROKEN"]);
export const CLAIMABLE_OWNERSHIP_RESULTS = new Set(["VALID", "TAP_VALID", "VALID_CLOSED", "OPENED", "VALID_OPENED", "VALID_MANUAL_OPENED", "VALID_UNKNOWN_TAMPER"]);

function normalizeTenantRef(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function matchesOwnershipTenant(input: {
  eventTenantId?: string | null;
  eventTenantSlug?: string | null;
  requestedTenantId?: string | null;
  requestedTenantSlug?: string | null;
  requestedTenant?: string | null;
}) {
  const eventRefs = [
    normalizeTenantRef(input.eventTenantId),
    normalizeTenantRef(input.eventTenantSlug),
  ].filter(Boolean);
  const requestedRefs = [
    normalizeTenantRef(input.requestedTenantId),
    normalizeTenantRef(input.requestedTenantSlug),
    normalizeTenantRef(input.requestedTenant),
  ].filter(Boolean);

  if (!requestedRefs.length) return true;
  if (!eventRefs.length) return false;
  return requestedRefs.every((requestedRef) => eventRefs.includes(requestedRef));
}

export function matchesOwnershipBatch(input: { eventBid?: string | null; requestedBid?: string | null }) {
  const requestedBid = String(input.requestedBid || "").trim();
  if (!requestedBid) return true;
  return String(input.eventBid || "").trim() === requestedBid;
}

export function isClaimableOwnershipResult(result: string) {
  return CLAIMABLE_OWNERSHIP_RESULTS.has(String(result || "").toUpperCase());
}

export function evaluateOwnershipEligibility(input: { result: string; tagStatus?: string | null }) {
  const result = String(input.result || "").toUpperCase();
  const tagStatus = String(input.tagStatus || "").toLowerCase();
  const isBlocked = BLOCKED_OWNERSHIP_RESULTS.has(result) || !isClaimableOwnershipResult(result) || tagStatus === "revoked";
  const nextStatus = isBlocked
    ? (result === "REPLAY_SUSPECT" || result === "DUPLICATE" ? "blocked_replay" : "revoked")
    : "claimed";
  return { isBlocked, nextStatus };
}
