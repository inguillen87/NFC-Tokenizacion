import { readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { readOwnershipClaimPinInput } from "../../../../lib/ownership-claim-pin";

export const CLAIM_POLICY_ADMIN_BODY_MAX_BYTES = 4 * 1024;

const CLAIM_POLICY_FIELDS = new Set([
  "bid",
  "tenant",
  "tenantSlug",
  "uidHex",
  "uid_hex",
  "pin",
  "activeForClaim",
  "active_for_claim",
  "claimPinRequired",
  "claim_pin_required",
  "claimRequiresPos",
  "claim_requires_pos",
  "autoClaimEnabled",
  "auto_claim_enabled",
]);

const BID_PATTERN = /^[^\u0000-\u001f\u007f]{1,256}$/;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const UID_HEX_PATTERN = /^[0-9A-F]{8,64}$/;

type BooleanAliasResult =
  | { ok: true; provided: boolean; value: boolean | undefined }
  | { ok: false; reason: "claim_policy_boolean_invalid" | "claim_policy_alias_conflict"; field: string };

export type ClaimPolicyAdminMutation = {
  bid: string;
  tenant: string;
  uidHex: string;
  pin: string;
  activeForClaim: boolean | undefined;
  claimPinRequired: boolean | undefined;
  claimRequiresPos: boolean | undefined;
  autoClaimEnabled: boolean | undefined;
};

export type ClaimPolicyAdminBodyResult =
  | { ok: true; mutation: ClaimPolicyAdminMutation }
  | {
      ok: false;
      reason: string;
      field?: string;
      invalidFields?: string[];
    };

function hasOwn(input: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function normalizedStringAlias(
  input: Record<string, unknown>,
  first: string,
  second: string,
  transform: (value: string) => string,
) {
  const provided = [first, second].filter((field) => hasOwn(input, field));
  for (const field of provided) {
    if (typeof input[field] !== "string") {
      return { ok: false as const, reason: "claim_policy_string_invalid", field };
    }
  }
  const values = provided.map((field) => transform(String(input[field]).trim()));
  if (new Set(values).size > 1) {
    return { ok: false as const, reason: "claim_policy_alias_conflict", field: first };
  }
  return { ok: true as const, value: values[0] || "" };
}

function booleanAlias(
  input: Record<string, unknown>,
  first: string,
  second: string,
): BooleanAliasResult {
  const provided = [first, second].filter((field) => hasOwn(input, field));
  for (const field of provided) {
    if (typeof input[field] !== "boolean") {
      return { ok: false, reason: "claim_policy_boolean_invalid", field };
    }
  }
  const values = provided.map((field) => input[field] as boolean);
  if (new Set(values).size > 1) {
    return { ok: false, reason: "claim_policy_alias_conflict", field: first };
  }
  return { ok: true, provided: provided.length > 0, value: values[0] };
}

export async function readClaimPolicyAdminBody(req: Request) {
  const parsed = await readBoundedJsonBody<unknown>(req, CLAIM_POLICY_ADMIN_BODY_MAX_BYTES);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("invalid_json_body");
  }
  return parsed as Record<string, unknown>;
}

export function normalizeClaimPolicyAdminBody(body: Record<string, unknown>): ClaimPolicyAdminBodyResult {
  const invalidFields = Object.keys(body).filter((field) => !CLAIM_POLICY_FIELDS.has(field)).sort();
  if (invalidFields.length) {
    return { ok: false, reason: "claim_policy_fields_invalid", invalidFields };
  }

  if (typeof body.bid !== "string") return { ok: false, reason: "bid_required" };
  const bid = body.bid.trim();
  if (!bid) return { ok: false, reason: "bid_required" };
  if (!BID_PATTERN.test(bid)) return { ok: false, reason: "bid_invalid" };

  const tenantResult = normalizedStringAlias(body, "tenant", "tenantSlug", (value) => value.toLowerCase());
  if (!tenantResult.ok) return tenantResult;
  if (tenantResult.value && !TENANT_SLUG_PATTERN.test(tenantResult.value)) {
    return { ok: false, reason: "tenant_slug_invalid", field: "tenant" };
  }

  const uidResult = normalizedStringAlias(body, "uidHex", "uid_hex", (value) => value.toUpperCase());
  if (!uidResult.ok) return uidResult;
  if (uidResult.value && !UID_HEX_PATTERN.test(uidResult.value)) {
    return { ok: false, reason: "uid_hex_invalid", field: "uidHex" };
  }

  const pinResult = readOwnershipClaimPinInput(body.pin);
  if (!pinResult.ok) return { ok: false, reason: pinResult.reason, field: "pin" };

  const activeForClaim = booleanAlias(body, "activeForClaim", "active_for_claim");
  if (!activeForClaim.ok) return activeForClaim;
  const claimPinRequired = booleanAlias(body, "claimPinRequired", "claim_pin_required");
  if (!claimPinRequired.ok) return claimPinRequired;
  const claimRequiresPos = booleanAlias(body, "claimRequiresPos", "claim_requires_pos");
  if (!claimRequiresPos.ok) return claimRequiresPos;
  const autoClaimEnabled = booleanAlias(body, "autoClaimEnabled", "auto_claim_enabled");
  if (!autoClaimEnabled.ok) return autoClaimEnabled;

  if (
    !pinResult.pin
    && !activeForClaim.provided
    && !claimPinRequired.provided
    && !claimRequiresPos.provided
    && !autoClaimEnabled.provided
  ) {
    return { ok: false, reason: "claim_policy_mutation_required" };
  }
  if (uidResult.value && (claimRequiresPos.provided || autoClaimEnabled.provided)) {
    return {
      ok: false,
      reason: "claim_policy_tag_scope_fields_invalid",
      invalidFields: [
        ...(claimRequiresPos.provided ? ["claimRequiresPos"] : []),
        ...(autoClaimEnabled.provided ? ["autoClaimEnabled"] : []),
      ],
    };
  }

  return {
    ok: true,
    mutation: {
      bid,
      tenant: tenantResult.value,
      uidHex: uidResult.value,
      pin: pinResult.pin,
      activeForClaim: activeForClaim.value,
      claimPinRequired: pinResult.pin ? true : claimPinRequired.value,
      claimRequiresPos: claimRequiresPos.value,
      autoClaimEnabled: autoClaimEnabled.value,
    },
  };
}
