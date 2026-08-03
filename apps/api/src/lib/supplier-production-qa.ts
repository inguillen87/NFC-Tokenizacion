import { createHash, createHmac } from "node:crypto";

export const SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA = "supplier-production-acceptance/v2" as const;
export const SUPPLIER_PRODUCTION_QA_POLICY_SCHEMA = "supplier-production-acceptance-policy/v1" as const;
export const SUPPLIER_PRODUCTION_QA_PLAN_SCHEMA = "supplier-production-qa-plan/v1" as const;
export const SUPPLIER_PRODUCTION_QA_DOMAIN = "nexid:supplier-production-qa" as const;
export const SUPPLIER_PRODUCTION_QA_STRATUM_FIELDS = [
  "roll_id",
  "case_id",
  "pallet_id",
] as const;

export type SupplierProductionQaStratumField = typeof SUPPLIER_PRODUCTION_QA_STRATUM_FIELDS[number];

export type SupplierProductionQaPolicyInput = {
  schema: unknown;
  policyId: unknown;
  policyRevision: unknown;
  tenantId: unknown;
  approvalStatus: unknown;
  approvedBy: unknown;
  approvedAt: unknown;
  approvalEvidenceRef: unknown;
  lotSize: unknown;
  inspectionLevel: unknown;
  targetAql: unknown;
  sampleSize: unknown;
  acceptNumber: unknown;
  rejectNumber: unknown;
  stratumField: unknown;
};

export type SupplierProductionQaPolicy = {
  schema: typeof SUPPLIER_PRODUCTION_QA_POLICY_SCHEMA;
  policyId: string;
  policyRevision: number;
  tenantId: string;
  approvalStatus: "approved";
  approvedBy: string;
  approvedAt: string;
  approvalEvidenceRef: string;
  lotSize: number;
  inspectionLevel: string;
  targetAql: number;
  sampleSize: number;
  acceptNumber: number;
  rejectNumber: number;
  stratumField: SupplierProductionQaStratumField;
};

export type SupplierProductionQaManifestRowInput = {
  uidHex?: unknown;
  uid_hex?: unknown;
  batchId?: unknown;
  batch_id?: unknown;
  bid?: unknown;
  roll_id?: unknown;
  case_id?: unknown;
  pallet_id?: unknown;
  unitMetadata?: unknown;
  unit_metadata?: unknown;
};

export type BuildSupplierProductionQaSelectionInput = {
  tenantId: unknown;
  batchId: unknown;
  bid: unknown;
  manifestHash: unknown;
  qaSessionId: unknown;
  policy: SupplierProductionQaPolicyInput;
  authoritativePolicyDigest?: unknown;
  manifestRows: SupplierProductionQaManifestRowInput[];
  serverSeed: Uint8Array;
};

export type SupplierProductionQaAllocation = {
  stratumId: string;
  populationSize: number;
  sampleSize: number;
};

export type SupplierProductionQaSelectedUnit = {
  uidHex: string;
  stratumId: string;
  rank: number;
  selectionRankDigest: string;
};

type UnknownRecord = Record<string, unknown>;

type NormalizedManifestRow = {
  uidHex: string;
  stratumId: string;
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function compareUtf8(left: string, right: string) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function canonicalSupplierProductionQaJson(input: unknown): string {
  if (input === null) return "null";
  if (Array.isArray(input)) {
    return `[${input.map((item) => item === undefined ? "null" : canonicalSupplierProductionQaJson(item)).join(",")}]`;
  }
  if (typeof input === "object") {
    const entries = Object.entries(input as UnknownRecord)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => compareUtf8(left, right));
    return `{${entries
      .map(([key, value]) => `${JSON.stringify(key)}:${canonicalSupplierProductionQaJson(value)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(input);
  return encoded === undefined ? "null" : encoded;
}

export function sha256SupplierProductionQaCanonical(input: unknown) {
  return `sha256:${createHash("sha256")
    .update(canonicalSupplierProductionQaJson(input), "utf8")
    .digest("hex")}`;
}

export type SupplierProductionQaPlanDraftInput = {
  tenantId: unknown;
  supplierOrderId: unknown;
  supplierSubBatchId: unknown;
  batchId: unknown;
  bid: unknown;
  revision: unknown;
  lotSize: unknown;
  inspectionLevel: unknown;
  targetAql: unknown;
  sampleSize: unknown;
  acceptNumber: unknown;
  rejectNumber: unknown;
  policyReference: unknown;
  policyDocumentSha256: unknown;
  stratificationDimension: unknown;
};

/**
 * Builds the immutable tenant-supplied inspection plan snapshot. NexID only
 * checks internal consistency and adds its fixed cryptographic sample floor;
 * it never invents an AQL, inspection level, sample size, Ac or Re value.
 */
export function buildSupplierProductionQaPlanDraft(input: SupplierProductionQaPlanDraftInput) {
  const tenantId = requiredText(input.tenantId, "supplier_production_qa_plan_tenant_id", 160).toLowerCase();
  const supplierOrderId = requiredText(input.supplierOrderId, "supplier_production_qa_plan_order_id", 160).toLowerCase();
  const supplierSubBatchId = requiredText(input.supplierSubBatchId, "supplier_production_qa_plan_sub_batch_id", 160).toLowerCase();
  const batchId = requiredText(input.batchId, "supplier_production_qa_plan_batch_id", 160).toLowerCase();
  const bid = requiredText(input.bid, "supplier_production_qa_plan_bid", 160).toUpperCase();
  const revision = positiveInteger(input.revision, "supplier_production_qa_plan_revision");
  const lotSize = positiveInteger(input.lotSize, "supplier_production_qa_lot_size");
  const sampleSize = positiveInteger(input.sampleSize, "supplier_production_qa_sample_size");
  const acceptNumber = nonNegativeInteger(input.acceptNumber, "supplier_production_qa_accept_number");
  const rejectNumber = nonNegativeInteger(input.rejectNumber, "supplier_production_qa_reject_number");
  if (lotSize > 10_000_000) throw new Error("supplier_production_qa_lot_size_too_large");
  if (sampleSize > lotSize || sampleSize > 5_000) throw new Error("supplier_production_qa_sample_exceeds_lot");
  if (sampleSize < Math.min(10, lotSize)) {
    throw new Error("supplier_production_qa_sample_below_crypto_floor");
  }
  if (acceptNumber >= sampleSize) throw new Error("supplier_production_qa_accept_exceeds_sample");
  if (rejectNumber !== acceptNumber + 1 || rejectNumber > sampleSize) {
    throw new Error("supplier_production_qa_accept_reject_gap_not_supported");
  }
  const stratificationDimension = normalizedStratumField(input.stratificationDimension);
  const binding = {
    schema_version: SUPPLIER_PRODUCTION_QA_PLAN_SCHEMA,
    tenant_id: tenantId,
    supplier_order_id: supplierOrderId,
    supplier_sub_batch_id: supplierSubBatchId,
    batch_id: batchId,
    bid,
    revision,
    lot_size: lotSize,
    inspection_level: requiredText(input.inspectionLevel, "supplier_production_qa_inspection_level", 80),
    target_aql: boundedAql(input.targetAql),
    sample_size: sampleSize,
    accept_number: acceptNumber,
    reject_number: rejectNumber,
    policy_reference: requiredText(input.policyReference, "supplier_production_qa_policy_reference", 240),
    policy_document_sha256: normalizedSha256(input.policyDocumentSha256, "supplier_production_qa_policy_document_sha256"),
    stratification_dimension: stratificationDimension,
    cryptographic_sample_size: Math.min(10, lotSize, sampleSize),
  };
  const canonical = canonicalSupplierProductionQaJson(binding);
  return {
    schema: SUPPLIER_PRODUCTION_QA_PLAN_SCHEMA,
    binding,
    canonical,
    digest: sha256SupplierProductionQaCanonical(binding),
  };
}

function requiredText(value: unknown, field: string, maxLength = 512) {
  const normalized = typeof value === "string" || typeof value === "number"
    ? String(value).trim().replace(/\s+/g, " ")
    : "";
  if (!normalized) throw new Error(`${field}_required`);
  if (normalized.length > maxLength) throw new Error(`${field}_too_long`);
  return normalized;
}

function positiveInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${field}_invalid`);
  return parsed;
}

function nonNegativeInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${field}_invalid`);
  return parsed;
}

function boundedAql(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("supplier_production_qa_target_aql_invalid");
  }
  return value;
}

function normalizedInstant(value: unknown, field: string) {
  const raw = requiredText(value, field, 64);
  const epoch = Date.parse(raw);
  if (!Number.isFinite(epoch) || !/[tT]/.test(raw) || !/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw)) {
    throw new Error(`${field}_invalid`);
  }
  return new Date(epoch).toISOString();
}

function normalizedSha256(value: unknown, field: string) {
  const normalized = requiredText(value, field, 71).toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/.test(normalized)) throw new Error(`${field}_invalid`);
  return normalized;
}

function normalizedStratumField(value: unknown): SupplierProductionQaStratumField {
  const normalized = requiredText(value, "supplier_production_qa_stratum_field", 32).toLowerCase();
  if (!SUPPLIER_PRODUCTION_QA_STRATUM_FIELDS.includes(normalized as SupplierProductionQaStratumField)) {
    throw new Error("supplier_production_qa_stratum_field_invalid");
  }
  return normalized as SupplierProductionQaStratumField;
}

/**
 * Structurally validates an explicit tenant policy. Authorization of the
 * approver and resolution of approvalEvidenceRef remain caller responsibilities.
 * This function never supplies an AQL, inspection-level, sample, Ac, or Re default.
 */
export function validateSupplierProductionQaPolicy(
  input: SupplierProductionQaPolicyInput,
  expectedTenantId: unknown,
): SupplierProductionQaPolicy {
  const expectedTenant = requiredText(
    expectedTenantId,
    "supplier_production_qa_expected_tenant_id",
    160,
  ).toLowerCase();
  const schema = requiredText(input?.schema, "supplier_production_qa_policy_schema", 80);
  if (schema !== SUPPLIER_PRODUCTION_QA_POLICY_SCHEMA) {
    throw new Error("supplier_production_qa_policy_schema_invalid");
  }

  const tenantId = requiredText(input.tenantId, "supplier_production_qa_policy_tenant_id", 160).toLowerCase();
  if (tenantId !== expectedTenant) throw new Error("supplier_production_qa_policy_tenant_mismatch");

  const approvalStatus = requiredText(
    input.approvalStatus,
    "supplier_production_qa_policy_approval_status",
    32,
  ).toLowerCase();
  if (approvalStatus !== "approved") throw new Error("supplier_production_qa_policy_not_approved");

  const lotSize = positiveInteger(input.lotSize, "supplier_production_qa_lot_size");
  const sampleSize = positiveInteger(input.sampleSize, "supplier_production_qa_sample_size");
  const acceptNumber = nonNegativeInteger(input.acceptNumber, "supplier_production_qa_accept_number");
  const rejectNumber = nonNegativeInteger(input.rejectNumber, "supplier_production_qa_reject_number");
  if (sampleSize > lotSize) throw new Error("supplier_production_qa_sample_exceeds_lot");
  if (acceptNumber > sampleSize) throw new Error("supplier_production_qa_accept_exceeds_sample");
  if (rejectNumber > sampleSize) throw new Error("supplier_production_qa_reject_exceeds_sample");
  if (rejectNumber <= acceptNumber) throw new Error("supplier_production_qa_reject_must_exceed_accept");
  if (rejectNumber !== acceptNumber + 1) {
    throw new Error("supplier_production_qa_accept_reject_gap_not_supported");
  }

  return {
    schema: SUPPLIER_PRODUCTION_QA_POLICY_SCHEMA,
    policyId: requiredText(input.policyId, "supplier_production_qa_policy_id", 160),
    policyRevision: positiveInteger(input.policyRevision, "supplier_production_qa_policy_revision"),
    tenantId,
    approvalStatus: "approved",
    approvedBy: requiredText(input.approvedBy, "supplier_production_qa_policy_approved_by", 320),
    approvedAt: normalizedInstant(input.approvedAt, "supplier_production_qa_policy_approved_at"),
    approvalEvidenceRef: requiredText(
      input.approvalEvidenceRef,
      "supplier_production_qa_policy_approval_evidence_ref",
      2_048,
    ),
    lotSize,
    inspectionLevel: requiredText(
      input.inspectionLevel,
      "supplier_production_qa_inspection_level",
      120,
    ),
    targetAql: boundedAql(input.targetAql),
    sampleSize,
    acceptNumber,
    rejectNumber,
    stratumField: normalizedStratumField(input.stratumField),
  };
}

function normalizeManifestRows(
  rows: SupplierProductionQaManifestRowInput[],
  expectedBid: string,
  stratumField: SupplierProductionQaStratumField,
) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("supplier_production_qa_manifest_rows_required");
  }

  const seen = new Set<string>();
  const normalized: NormalizedManifestRow[] = rows.map((row, index) => {
    const raw = record(row);
    const uidHex = requiredText(
      raw.uidHex ?? raw.uid_hex,
      `supplier_production_qa_manifest_uid_row_${index + 1}`,
      32,
    ).toUpperCase();
    if (!/^[0-9A-F]{8,32}$/.test(uidHex)) {
      throw new Error(`supplier_production_qa_manifest_uid_invalid:row_${index + 1}`);
    }
    if (seen.has(uidHex)) throw new Error("supplier_production_qa_manifest_duplicate_uid");
    seen.add(uidHex);

    const rowBid = requiredText(
      raw.bid ?? raw.batchId ?? raw.batch_id,
      `supplier_production_qa_manifest_bid_row_${index + 1}`,
      160,
    ).toUpperCase();
    if (rowBid !== expectedBid) {
      throw new Error(`supplier_production_qa_manifest_bid_mismatch:row_${index + 1}`);
    }

    const unitMetadata = {
      ...record(raw.unit_metadata),
      ...record(raw.unitMetadata),
    };
    const stratumId = requiredText(
      raw[stratumField] ?? unitMetadata[stratumField],
      `supplier_production_qa_manifest_${stratumField}_row_${index + 1}`,
      256,
    );
    return { uidHex, stratumId };
  });

  return normalized.sort((left, right) => compareUtf8(left.uidHex, right.uidHex));
}

function allocateProportionalSample(
  strata: Array<{ stratumId: string; rows: NormalizedManifestRow[] }>,
  sampleSize: number,
): SupplierProductionQaAllocation[] {
  if (sampleSize < strata.length) {
    throw new Error("supplier_production_qa_sample_smaller_than_strata");
  }

  const remainingSample = sampleSize - strata.length;
  const residualPopulation = strata.reduce((sum, stratum) => sum + stratum.rows.length - 1, 0);
  const working = strata.map((stratum) => {
    const capacity = stratum.rows.length - 1;
    const numerator = remainingSample * capacity;
    const extra = residualPopulation === 0 ? 0 : Math.floor(numerator / residualPopulation);
    const remainder = residualPopulation === 0 ? 0 : numerator % residualPopulation;
    return {
      stratumId: stratum.stratumId,
      populationSize: stratum.rows.length,
      sampleSize: 1 + extra,
      capacity,
      remainder,
    };
  });

  let left = sampleSize - working.reduce((sum, item) => sum + item.sampleSize, 0);
  const remainderOrder = [...working].sort((first, second) => (
    second.remainder - first.remainder
    || compareUtf8(first.stratumId, second.stratumId)
  ));
  for (const item of remainderOrder) {
    if (left === 0) break;
    if (item.sampleSize >= item.populationSize) continue;
    item.sampleSize += 1;
    left -= 1;
  }
  if (left !== 0) throw new Error("supplier_production_qa_allocation_incomplete");

  return working
    .map(({ stratumId, populationSize, sampleSize: allocated }) => ({
      stratumId,
      populationSize,
      sampleSize: allocated,
    }))
    .sort((leftItem, rightItem) => compareUtf8(leftItem.stratumId, rightItem.stratumId));
}

function normalizeSeed(value: unknown) {
  if (!(value instanceof Uint8Array) || value.byteLength < 32) {
    throw new Error("supplier_production_qa_server_seed_invalid");
  }
  return Buffer.from(value);
}

function selectionScore(seed: Buffer, payload: unknown) {
  return createHmac("sha256", seed)
    .update(canonicalSupplierProductionQaJson(payload), "utf8")
    .digest("hex");
}

export function buildSupplierProductionQaSelection(input: BuildSupplierProductionQaSelectionInput) {
  const tenantId = requiredText(input.tenantId, "supplier_production_qa_tenant_id", 160).toLowerCase();
  const batchId = requiredText(input.batchId, "supplier_production_qa_batch_id", 160).toLowerCase();
  const bid = requiredText(input.bid, "supplier_production_qa_bid", 160).toUpperCase();
  const manifestHash = normalizedSha256(input.manifestHash, "supplier_production_qa_manifest_hash");
  const qaSessionId = requiredText(input.qaSessionId, "supplier_production_qa_session_id", 160).toLowerCase();
  const policy = validateSupplierProductionQaPolicy(input.policy, tenantId);
  const manifestRows = normalizeManifestRows(input.manifestRows, bid, policy.stratumField);
  if (manifestRows.length !== policy.lotSize) {
    throw new Error("supplier_production_qa_manifest_lot_size_mismatch");
  }

  const byStratum = new Map<string, NormalizedManifestRow[]>();
  for (const row of manifestRows) {
    const current = byStratum.get(row.stratumId) || [];
    current.push(row);
    byStratum.set(row.stratumId, current);
  }
  const strata = [...byStratum.entries()]
    .map(([stratumId, rows]) => ({ stratumId, rows }))
    .sort((left, right) => compareUtf8(left.stratumId, right.stratumId));
  const allocation = allocateProportionalSample(strata, policy.sampleSize);

  const normalizedPolicyPayload = {
    schema: policy.schema,
    policy_id: policy.policyId,
    policy_revision: policy.policyRevision,
    tenant_id: policy.tenantId,
    approval_status: policy.approvalStatus,
    approved_by: policy.approvedBy,
    approved_at: policy.approvedAt,
    approval_evidence_ref: policy.approvalEvidenceRef,
    lot_size: policy.lotSize,
    inspection_level: policy.inspectionLevel,
    target_aql: policy.targetAql,
    sample_size: policy.sampleSize,
    accept_number: policy.acceptNumber,
    reject_number: policy.rejectNumber,
    stratum_field: policy.stratumField,
  };
  const policyDigest = input.authoritativePolicyDigest === undefined
    ? sha256SupplierProductionQaCanonical(normalizedPolicyPayload)
    : normalizedSha256(input.authoritativePolicyDigest, "supplier_production_qa_authoritative_policy_digest");
  const populationPayload = manifestRows.map((row) => ({
    uid_hex: row.uidHex,
    stratum_id: row.stratumId,
  }));
  const populationDigest = sha256SupplierProductionQaCanonical({
    manifest_hash: manifestHash,
    rows: populationPayload,
  });
  const allocationPayload = allocation.map((item) => ({
    stratum_id: item.stratumId,
    population_size: item.populationSize,
    sample_size: item.sampleSize,
  }));
  const allocationDigest = sha256SupplierProductionQaCanonical(allocationPayload);
  const selectionContext = {
    domain: SUPPLIER_PRODUCTION_QA_DOMAIN,
    schema: SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
    tenant_id: tenantId,
    batch_id: batchId,
    bid,
    qa_session_id: qaSessionId,
    manifest_hash: manifestHash,
    policy_digest: policyDigest,
    population_digest: populationDigest,
    allocation_digest: allocationDigest,
  };

  const seed = normalizeSeed(input.serverSeed);
  try {
    const seedCommitment = `sha256:${createHash("sha256")
      .update("supplier-production-qa-selection-seed/v1", "utf8")
      .update("\0", "utf8")
      .update(seed.toString("base64url"), "utf8")
      .digest("hex")}`;

    const selectedSample: SupplierProductionQaSelectedUnit[] = [];
    for (const allocationItem of allocation) {
      const stratum = byStratum.get(allocationItem.stratumId);
      if (!stratum) throw new Error("supplier_production_qa_stratum_missing_after_allocation");
      const ranked = stratum
        .map((row) => ({
          row,
          score: selectionScore(seed, {
            ...selectionContext,
            seed_commitment: seedCommitment,
            stratum_id: allocationItem.stratumId,
            uid_hex: row.uidHex,
          }),
        }))
        .sort((left, right) => compareUtf8(left.score, right.score) || compareUtf8(left.row.uidHex, right.row.uidHex));
      ranked.slice(0, allocationItem.sampleSize).forEach((item, index) => {
        selectedSample.push({
          uidHex: item.row.uidHex,
          stratumId: allocationItem.stratumId,
          rank: index + 1,
          selectionRankDigest: `sha256:${item.score}`,
        });
      });
    }

    const selectionPayload = selectedSample.map((item) => ({
      uid_hex: item.uidHex,
      stratum_id: item.stratumId,
      rank: item.rank,
      selection_rank_digest: item.selectionRankDigest,
    }));
    const selectionDigest = sha256SupplierProductionQaCanonical(selectionPayload);
    const commitmentPayload = {
      ...selectionContext,
      seed_commitment: seedCommitment,
      selection_digest: selectionDigest,
    };
    const selectionCommitment = sha256SupplierProductionQaCanonical(commitmentPayload);

    return {
      schema: SUPPLIER_PRODUCTION_ACCEPTANCE_SCHEMA,
      status: "selection_committed" as const,
      tenantId,
      batchId,
      bid,
      qaSessionId,
      manifestHash,
      stratumField: policy.stratumField,
      policy,
      allocation,
      selectedSample,
      policyDigest,
      populationDigest,
      allocationDigest,
      selectionDigest,
      seedCommitment,
      selectionCommitment,
      algorithm: {
        allocation: "minimum-one-residual-proportional-largest-remainder-v1" as const,
        ranking: "hmac-sha256-v1" as const,
      },
      commitmentCanonicalPayload: canonicalSupplierProductionQaJson(commitmentPayload),
    };
  } finally {
    seed.fill(0);
  }
}
