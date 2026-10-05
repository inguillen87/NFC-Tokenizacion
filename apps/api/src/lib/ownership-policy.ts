import { evaluateTapCommercialRights, type TapCommercialRightsEvidence } from "./tap-commercial-rights";

export const BLOCKED_OWNERSHIP_RESULTS = new Set(["REPLAY_SUSPECT", "DUPLICATE", "INVALID", "NOT_REGISTERED", "NOT_ACTIVE", "TAMPER", "TAMPERED", "REVOKED", "BROKEN", "MANUAL_OPENED", "VALID_MANUAL_OPENED"]);
export const CLAIMABLE_OWNERSHIP_RESULTS = new Set(["VALID", "TAP_VALID", "VALID_AUTHENTIC", "VALID_CLOSED", "OPENED", "OPENED_PREVIOUSLY", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "VALID_UNKNOWN_TAMPER"]);

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

export type OwnershipTapEvidence = TapCommercialRightsEvidence & {
  tenant_id?: unknown;
  batch_id?: unknown;
  uid_hex?: unknown;
  current_tag_id?: unknown;
  current_tag_tenant_id?: unknown;
  current_tag_batch_id?: unknown;
  current_tag_uid_hex?: unknown;
  current_tag_status?: unknown;
  current_tag_lifecycle_state?: unknown;
  current_tag_identity_count?: unknown;
};

// A historical chip verdict cannot establish the current administrative state
// or select another tag carrying the same UID in a different batch.
export function isCurrentOwnershipTagEligible(input: OwnershipTapEvidence) {
  const normalized = (value: unknown) => String(value ?? "").trim();
  const tenant = normalized(input.tenant_id).toLowerCase();
  const batch = normalized(input.batch_id).toLowerCase();
  const uid = normalized(input.uid_hex).toUpperCase();
  if (!tenant || !batch || !uid || !normalized(input.current_tag_id)) return false;
  if (Number(input.current_tag_identity_count) !== 1) return false;
  if (tenant !== normalized(input.current_tag_tenant_id).toLowerCase()
    || batch !== normalized(input.current_tag_batch_id).toLowerCase()
    || uid !== normalized(input.current_tag_uid_hex).toUpperCase()) return false;
  return normalized(input.current_tag_status).toLowerCase() === "active"
    && normalized(input.current_tag_lifecycle_state ?? input.current_tag_status).toLowerCase() === "active";
}

export function evaluateOwnershipEligibility(input: { result: string } & OwnershipTapEvidence) {
  const result = String(input.result || "").toUpperCase();
  const isBlocked = !evaluateTapCommercialRights(input).allowed
    || BLOCKED_OWNERSHIP_RESULTS.has(result)
    || !isClaimableOwnershipResult(result)
    || !isCurrentOwnershipTagEligible(input);
  const nextStatus = isBlocked
    ? (result === "REPLAY_SUSPECT" || result === "DUPLICATE" ? "blocked_replay" : "revoked")
    : "claimed";
  return { isBlocked, nextStatus };
}
