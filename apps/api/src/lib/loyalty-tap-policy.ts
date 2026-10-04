import { evaluateTapCommercialRights, type TapCommercialRightsEvidence } from "./tap-commercial-rights";

// Keep the existing legacy OPENED denial. Authenticated hardware opening and
// its reported history remain eligible for configured consumption benefits.
export const LOYALTY_TAP_RESULTS = [
  "VALID", "TAP_VALID", "VALID_AUTHENTIC", "VALID_CLOSED",
  "OPENED_PREVIOUSLY", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "VALID_UNKNOWN_TAMPER",
] as const;

type LoyaltyTapEvidence = TapCommercialRightsEvidence & {
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

const allowedResults = new Set<string>(LOYALTY_TAP_RESULTS);
const normalized = (value: unknown) => String(value ?? "").trim();

export function isCurrentLoyaltyTapEligible(event: LoyaltyTapEvidence | null | undefined) {
  if (!event || !evaluateTapCommercialRights(event).allowed) return false;
  if (!allowedResults.has(normalized(event.result).toUpperCase())) return false;
  const tenant = normalized(event.tenant_id).toLowerCase();
  const batch = normalized(event.batch_id).toLowerCase();
  const uid = normalized(event.uid_hex).toUpperCase();
  if (!tenant || !batch || !uid || !normalized(event.current_tag_id)) return false;
  if (Number(event.current_tag_identity_count) !== 1) return false;
  if (tenant !== normalized(event.current_tag_tenant_id).toLowerCase()
    || batch !== normalized(event.current_tag_batch_id).toLowerCase()
    || uid !== normalized(event.current_tag_uid_hex).toUpperCase()) return false;
  return normalized(event.current_tag_status).toLowerCase() === "active"
    && normalized(event.current_tag_lifecycle_state ?? event.current_tag_status).toLowerCase() === "active";
}
