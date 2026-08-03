export const PUBLIC_PROOF_RESOURCE_COMMITMENT_DOMAIN = "nexid.public-ledger.resource.v1";

export type PublicProofResourceIdentity = {
  tenantScope: string;
  resourceType: string;
  resourceId: string;
};

function normalizedRequiredText(value: unknown, field: string) {
  const normalized = String(value || "").trim().normalize("NFC");
  if (!normalized) throw new Error(`${field}_required`);
  return normalized;
}

/**
 * This exact JSON array is the public-resource commitment contract. Tenant and
 * resource type domain-separate equal internal IDs without exposing any input.
 */
export function canonicalPublicProofResourceIdentity(input: PublicProofResourceIdentity) {
  const tenantScope = normalizedRequiredText(input.tenantScope, "tenant_scope").toLowerCase();
  const resourceType = normalizedRequiredText(input.resourceType, "resource_type").toLowerCase();
  const resourceId = normalizedRequiredText(input.resourceId, "resource_id");
  return JSON.stringify([
    PUBLIC_PROOF_RESOURCE_COMMITMENT_DOMAIN,
    tenantScope,
    resourceType,
    resourceId,
  ]);
}

export async function createPublicProofResourceCommitment(input: PublicProofResourceIdentity) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("public_resource_sha256_unavailable");
  const canonicalIdentity = canonicalPublicProofResourceIdentity(input);
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(canonicalIdentity));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}
