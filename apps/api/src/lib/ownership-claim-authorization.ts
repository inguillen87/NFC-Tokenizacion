import { normalizeClaimPolicy, type SunClaimPolicy } from "./sun-tenant-profile";

export type OwnershipClaimAuthorizationReason =
  | "claim_policy_configuration_required"
  | "ownership_manual_approval_required"
  | "pos_activation_pending"
  | "pin_required"
  | "invalid_pin"
  | "retailer_attestation_required"
  | "purchase_receipt_required"
  | "purchase_proof_manual_review_required";

export type OwnershipClaimAuthorizationDecision =
  | {
      disposition: "authorized";
      policy: SunClaimPolicy;
      pinRequired: boolean;
      posRequired: boolean;
    }
  | {
      disposition: "review_required";
      policy: SunClaimPolicy;
      reason: "purchase_proof_manual_review_required";
      pinRequired: boolean;
      posRequired: boolean;
    }
  | {
      disposition: "denied";
      policy: SunClaimPolicy | null;
      reason: Exclude<OwnershipClaimAuthorizationReason, "purchase_proof_manual_review_required">;
      pinRequired: boolean;
      posRequired: boolean;
    };

export function ownershipClaimAuthorizationRequirements(input: {
  claimPolicy: unknown;
  configuredPinRequired?: boolean;
  configuredPosRequired?: boolean;
}) {
  const policy = normalizeClaimPolicy(input.claimPolicy);
  return {
    policy,
    pinRequired: policy === "inside_pack_secret" || input.configuredPinRequired === true,
    posRequired: policy === "retailer_attested" || input.configuredPosRequired === true,
  };
}

/**
 * Resolves the PIN policy and its credential as one object. A tag-level
 * override is authoritative: it must never borrow a batch credential. This
 * prevents one shared batch PIN from authorizing a tag whose unit policy is
 * incomplete or was intended to have a unique inside-pack code.
 */
export function resolveOwnershipClaimPinCredential(input: {
  claimPolicy: unknown;
  tagPinRequired?: unknown;
  tagPinHash?: unknown;
  batchPinRequired?: unknown;
  batchPinHash?: unknown;
  configPinRequired?: unknown;
  configPinHash?: unknown;
}) {
  const policy = normalizeClaimPolicy(input.claimPolicy);
  const policyRequiresPin = policy === "inside_pack_secret";
  const tagHash = typeof input.tagPinHash === "string" ? input.tagPinHash.trim() : "";
  const tagPolicyPresent = input.tagPinRequired !== null && input.tagPinRequired !== undefined
    || Boolean(tagHash);

  if (tagPolicyPresent) {
    const required = policyRequiresPin || input.tagPinRequired === true || String(input.tagPinRequired) === "true";
    return {
      required,
      storedHash: required ? tagHash : "",
      source: "tag" as const,
      misconfigured: required && !tagHash,
    };
  }

  const batchHash = typeof input.batchPinHash === "string" ? input.batchPinHash.trim() : "";
  const configHash = typeof input.configPinHash === "string" ? input.configPinHash.trim() : "";
  const required = policyRequiresPin
    || input.batchPinRequired === true
    || String(input.batchPinRequired) === "true"
    || input.configPinRequired === true
    || String(input.configPinRequired) === "true";
  const storedHash = batchHash || configHash;
  return {
    required,
    storedHash: required ? storedHash : "",
    source: batchHash ? "batch" as const : "config" as const,
    misconfigured: required && !storedHash,
  };
}

/**
 * Canonical authorization decision for every ownership writer. Fresh NFC/SUN
 * proves a recent cryptographic interaction; it does not replace tenant policy,
 * a point-of-sale attestation, an inside-pack secret, or manual review.
 */
export function evaluateOwnershipClaimAuthorization(input: {
  claimPolicy: unknown;
  activeForClaim: boolean;
  configuredPinRequired?: boolean;
  pinPresented?: boolean;
  pinValidated?: boolean;
  configuredPosRequired?: boolean;
  posValidated?: boolean;
  purchaseProofPresented?: boolean;
}): OwnershipClaimAuthorizationDecision {
  const { policy, pinRequired, posRequired } = ownershipClaimAuthorizationRequirements(input);

  if (!policy) {
    return { disposition: "denied", policy: null, reason: "claim_policy_configuration_required", pinRequired, posRequired };
  }
  if (policy === "admin_approved") {
    return { disposition: "denied", policy, reason: "ownership_manual_approval_required", pinRequired, posRequired };
  }
  if (!input.activeForClaim) {
    return { disposition: "denied", policy, reason: "pos_activation_pending", pinRequired, posRequired };
  }
  if (pinRequired && !input.pinValidated) {
    return {
      disposition: "denied",
      policy,
      reason: input.pinPresented ? "invalid_pin" : "pin_required",
      pinRequired,
      posRequired,
    };
  }
  if (posRequired && !input.posValidated) {
    return { disposition: "denied", policy, reason: "retailer_attestation_required", pinRequired, posRequired };
  }
  if (policy === "purchase_proof_required") {
    if (!input.purchaseProofPresented) {
      return { disposition: "denied", policy, reason: "purchase_receipt_required", pinRequired, posRequired };
    }
    return { disposition: "review_required", policy, reason: "purchase_proof_manual_review_required", pinRequired, posRequired };
  }
  return { disposition: "authorized", policy, pinRequired, posRequired };
}
