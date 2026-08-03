export type ProofProviderCode = "none" | "polygon" | "iota";

export const PROOF_EVENT_TYPES = [
  "PRODUCT_CREATED",
  "BATCH_CREATED",
  "SUPPLIER_ORDER_CREATED",
  "SUPPLIER_PACK_EXPORTED",
  "MANIFEST_IMPORTED",
  "MANIFEST_VALIDATED",
  "QA_PASSED",
  "QA_FAILED",
  "BATCH_ACTIVATED",
  "BATCH_PARTIALLY_ACTIVATED",
  "TAG_ACTIVATED",
  "SUN_VALIDATED",
  "REPLAY_DETECTED",
  "TAMPER_CLOSED",
  "TAMPER_OPENED",
  "TAMPER_OPENED_PREVIOUSLY",
  "RISK_ALERT_CREATED",
  "OWNERSHIP_CLAIMED",
  "OWNERSHIP_TRANSFERRED",
  "NFT_MINTED",
  "CERTIFICATE_ISSUED",
  "WARRANTY_REGISTERED",
  "WARRANTY_TOKENIZED",
  "SHIPMENT_DISPATCHED",
  "DISTRIBUTOR_RECEIVED",
  "STEWARDSHIP_CONFIRMED",
  "SENSOR_BATCH_HASHED",
  "DPP_REPORT_GENERATED",
  "POLYGON_ANCHORED",
  "IOTA_ANCHORED",
  // Existing operator-console concepts. They remain explicit instead of being
  // coerced into a semantically different lifecycle event.
  "ORIGIN_ATTESTED",
  "CUSTODY_CHECKPOINT",
  "DELIVERY_CONFIRMED",
  "FIELD_SCAN",
  "CLAIM_POLICY_OPENED",
] as const;

export type ProofEventType = (typeof PROOF_EVENT_TYPES)[number];

export const PROOF_RESOURCE_TYPES = [
  "product",
  "batch",
  "supplier_order",
  "supplier_sub_batch",
  "manifest",
  "qa_record",
  "tag",
  "shipment",
  "custody_case",
  "agronomic_lot",
  "sensor_batch",
  "dpp_report",
  "ownership_record",
  "certificate",
  "warranty",
  "secure_delivery_pack",
  "pharma_batch",
  "agro_input_batch",
] as const;

export type ProofResourceType = (typeof PROOF_RESOURCE_TYPES)[number];

const EVENT_TYPE_SET = new Set<string>(PROOF_EVENT_TYPES);
const RESOURCE_TYPE_SET = new Set<string>(PROOF_RESOURCE_TYPES);

const EVENT_TYPE_ALIASES: Readonly<Record<string, ProofEventType>> = {
  TAP_VALID: "SUN_VALIDATED",
  SUN_VALID: "SUN_VALIDATED",
  SUN_VERIFIED: "SUN_VALIDATED",
  REPLAY_SUSPECT: "REPLAY_DETECTED",
  TAMPERED: "TAMPER_OPENED",
  TAMPER_RISK: "TAMPER_OPENED",
  QA_RELEASE: "QA_PASSED",
  OWNERSHIP_ACTIVATED: "OWNERSHIP_CLAIMED",
  TOKENIZATION_MINTED: "NFT_MINTED",
  TOKENIZATION_ANCHORED: "POLYGON_ANCHORED",
  EXPORT_GENERATED: "DPP_REPORT_GENERATED",
};

const RESOURCE_TYPE_ALIASES: Readonly<Record<string, ProofResourceType>> = {
  lot: "batch",
  sub_batch: "supplier_sub_batch",
  qa_report: "qa_record",
  sensor_report: "sensor_batch",
  digital_product_passport: "dpp_report",
};

// Polygon's ownership domain includes the claim/transfer itself plus issuance
// of the tokenized ownership certificate or warranty. Operational evidence,
// telemetry, logistics, manifests and QA remain excluded.
const POLYGON_EVENT_TYPES = new Set<ProofEventType>([
  "OWNERSHIP_CLAIMED",
  "OWNERSHIP_TRANSFERRED",
  "NFT_MINTED",
  "CERTIFICATE_ISSUED",
  "WARRANTY_TOKENIZED",
]);

const IOTA_EVENT_TYPES = new Set<ProofEventType>([
  "BATCH_CREATED",
  "SUPPLIER_PACK_EXPORTED",
  "MANIFEST_IMPORTED",
  "MANIFEST_VALIDATED",
  "QA_PASSED",
  "BATCH_ACTIVATED",
  "TAG_ACTIVATED",
  "SUN_VALIDATED",
  "REPLAY_DETECTED",
  "TAMPER_OPENED",
  "SHIPMENT_DISPATCHED",
  "DISTRIBUTOR_RECEIVED",
  "STEWARDSHIP_CONFIRMED",
  "SENSOR_BATCH_HASHED",
  "DPP_REPORT_GENERATED",
  "ORIGIN_ATTESTED",
  "CUSTODY_CHECKPOINT",
  "DELIVERY_CONFIRMED",
  "FIELD_SCAN",
]);

const IOTA_AGGREGATED_ONLY_EVENT_TYPES = new Set<ProofEventType>([
  "SUN_VALIDATED",
  "REPLAY_DETECTED",
  "TAMPER_OPENED",
  "FIELD_SCAN",
]);

const SHA256_REFERENCE_PATTERN = /^sha256:[0-9a-f]{64}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_PATTERN = /^(?:https?:\/\/|www\.)|[/?#]/i;
const PHONE_PATTERN = /^\+?[0-9][0-9().\s-]{5,}[0-9]$/;

export class ProofEventPolicyError extends Error {
  readonly code: string;
  readonly field?: string;

  constructor(code: string, field?: string) {
    super(code);
    this.name = "ProofEventPolicyError";
    this.code = code;
    this.field = field;
  }
}

function normalizedEventToken(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function normalizedResourceToken(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function positiveAggregateCount(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 1 ? parsed : 0;
}

export function canonicalizeProofEventType(value: unknown): ProofEventType {
  const normalized = normalizedEventToken(value);
  const canonical = EVENT_TYPE_ALIASES[normalized] || normalized;
  if (!EVENT_TYPE_SET.has(canonical)) {
    throw new ProofEventPolicyError("proof_event_type_unsupported", "event_type");
  }
  return canonical as ProofEventType;
}

export function canonicalizeProofResourceType(value: unknown): ProofResourceType {
  const normalized = normalizedResourceToken(value);
  const canonical = RESOURCE_TYPE_ALIASES[normalized] || normalized;
  if (!RESOURCE_TYPE_SET.has(canonical)) {
    throw new ProofEventPolicyError("proof_resource_type_unsupported", "resource_type");
  }
  return canonical as ProofResourceType;
}

export function canonicalizeProofProvider(value: unknown): ProofProviderCode {
  const provider = String(value || "").trim().toLowerCase();
  if (provider !== "none" && provider !== "polygon" && provider !== "iota") {
    throw new ProofEventPolicyError("proof_provider_unsupported", "provider");
  }
  return provider;
}

export function assertProofProviderEventPolicy(input: {
  provider: unknown;
  eventType: unknown;
  resourceType: unknown;
  aggregateCount?: unknown;
}) {
  const provider = canonicalizeProofProvider(input.provider);
  const eventType = canonicalizeProofEventType(input.eventType);
  const resourceType = canonicalizeProofResourceType(input.resourceType);

  if (provider === "polygon" && !POLYGON_EVENT_TYPES.has(eventType)) {
    throw new ProofEventPolicyError("polygon_ownership_event_required", "event_type");
  }
  if (provider === "iota" && !IOTA_EVENT_TYPES.has(eventType)) {
    throw new ProofEventPolicyError("iota_proof_event_not_allowed", "event_type");
  }
  if (provider === "iota" && IOTA_AGGREGATED_ONLY_EVENT_TYPES.has(eventType)) {
    // This count must come from distinct proof members selected by the trusted
    // server route. A caller-declared payload counter is not proof of an
    // aggregate and must never satisfy this gate.
    const aggregateCount = positiveAggregateCount(input.aggregateCount);
    if (aggregateCount < 2) {
      throw new ProofEventPolicyError("iota_aggregated_event_required", "event_type");
    }
  }

  return { provider, eventType, resourceType } as const;
}

/**
 * Public resource references are committed hashes, not pseudonyms or internal
 * IDs. Requiring the sha256: prefix avoids accidentally accepting a raw
 * 32-byte key as if it were a deliberate public commitment.
 */
export function normalizePublicLedgerResourceId(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) throw new ProofEventPolicyError("public_resource_id_required", "public_resource_id");
  if (EMAIL_PATTERN.test(raw)) {
    throw new ProofEventPolicyError("public_resource_id_email_forbidden", "public_resource_id");
  }
  if (URL_PATTERN.test(raw)) {
    throw new ProofEventPolicyError("public_resource_id_url_forbidden", "public_resource_id");
  }
  if (UUID_PATTERN.test(raw)) {
    throw new ProofEventPolicyError("public_resource_id_uuid_forbidden", "public_resource_id");
  }
  const digits = raw.replace(/\D/g, "");
  if (PHONE_PATTERN.test(raw) && digits.length >= 7 && digits.length <= 15) {
    throw new ProofEventPolicyError("public_resource_id_phone_forbidden", "public_resource_id");
  }
  if (!SHA256_REFERENCE_PATTERN.test(raw)) {
    throw new ProofEventPolicyError("public_resource_id_hash_required", "public_resource_id");
  }
  return raw.toLowerCase();
}
