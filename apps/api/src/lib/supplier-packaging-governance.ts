import { sql } from "./db";
import { canonicalSha256Hash, hashEvidencePayload } from "./proof-layer";
import {
  type PackagingSpecIssue,
  type SupplierPackagingSpec,
  validateSupplierPackagingSpec,
} from "./supplier-packaging-spec";

export const SUPPLIER_PACKAGING_GOVERNANCE_VERSION = 1 as const;

export const SUPPLIER_PACKAGING_GOVERNANCE_STATUSES = [
  "legacy_unverified",
  "draft",
  "submitted",
  "approved",
  "rejected",
] as const;

export const SUPPLIER_PACKAGING_DECISION_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
] as const;

export const SUPPLIER_PACKAGING_EVIDENCE_KINDS = [
  "rf_sample",
  "line_trial",
  "adhesive",
  "artwork_dieline",
  "encoding_readback",
  "tagtamper_placement",
] as const;

export const BASE_APPROVAL_EVIDENCE_KINDS = [
  "rf_sample",
  "line_trial",
  "adhesive",
  "artwork_dieline",
  "encoding_readback",
] as const;

export type SupplierPackagingGovernanceStatus = typeof SUPPLIER_PACKAGING_GOVERNANCE_STATUSES[number];
export type SupplierPackagingDecisionStatus = typeof SUPPLIER_PACKAGING_DECISION_STATUSES[number];
export type SupplierPackagingEvidenceKind = typeof SUPPLIER_PACKAGING_EVIDENCE_KINDS[number];
export type SupplierPackagingEvidenceRefs = Record<SupplierPackagingEvidenceKind, string[]>;

export type SupplierPackagingValidationSnapshot = {
  validator: "validateSupplierPackagingSpec";
  validatorVersion: typeof SUPPLIER_PACKAGING_GOVERNANCE_VERSION;
  ok: boolean;
  productionReady: boolean;
  errors: PackagingSpecIssue[];
  readinessGaps: PackagingSpecIssue[];
  warnings: PackagingSpecIssue[];
};

export type SupplierPackagingGovernanceDecision = {
  schema: "nexid-supplier-packaging-governance-v1";
  tenantId: string;
  supplierOrderId: string;
  previousStatus: SupplierPackagingGovernanceStatus;
  status: SupplierPackagingDecisionStatus;
  previousRevision: number;
  specRevision: number;
  carrierProfileCode: string;
  specSnapshot: SupplierPackagingSpec;
  specHash: string;
  evidenceRefs: SupplierPackagingEvidenceRefs;
  validation: SupplierPackagingValidationSnapshot;
  decidedBy: string;
  decisionReason: string | null;
  singleOperatorOverride: boolean;
  overrideReason: string | null;
};

export type BuildSupplierPackagingGovernanceDecisionInput = {
  tenantId: unknown;
  supplierOrderId: unknown;
  previousStatus: unknown;
  status: unknown;
  previousRevision: unknown;
  specRevision: unknown;
  carrierProfileCode: unknown;
  spec: unknown;
  evidenceRefs?: unknown;
  decidedBy: unknown;
  decisionReason?: unknown;
  overrideReason?: unknown;
};

export type PersistedSupplierPackagingGovernanceDecision = {
  decisionId: string;
  supplierOrderId: string;
  tenantId: string;
  specRevision: number;
  status: SupplierPackagingDecisionStatus;
  specHash: string;
  decidedAt: string;
};

export type SupplierPackagingExportGap = {
  code: string;
  field: string;
  message: string;
};

export type SupplierPackagingExportGateInput = {
  status: unknown;
  specRevision: unknown;
  carrierProfileCode: unknown;
  specSnapshot: unknown;
  specHash: unknown;
  evidenceRefs: unknown;
  validationSnapshot: unknown;
  approvalHistoryReceiptConsistent: unknown;
};

export type SupplierPackagingExportGate =
  | {
      ok: false;
      status: SupplierPackagingGovernanceStatus | "invalid";
      gaps: SupplierPackagingExportGap[];
    }
  | {
      ok: true;
      status: "approved";
      specRevision: number;
      specHash: string;
      specSnapshot: SupplierPackagingSpec;
      evidenceRefs: SupplierPackagingEvidenceRefs;
      validation: SupplierPackagingValidationSnapshot;
    };

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function requiredText(value: unknown, field: string, max: number) {
  const normalized = typeof value === "string" || typeof value === "number"
    ? String(value).trim().replace(/\s+/g, " ")
    : "";
  if (!normalized) throw new Error(`${field}_required`);
  if (normalized.length > max) throw new Error(`${field}_too_long`);
  return normalized;
}

function optionalText(value: unknown, field: string, max: number) {
  if (value === undefined || value === null || value === "") return null;
  return requiredText(value, field, max);
}

function exactInteger(value: unknown, field: string, min: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) throw new Error(`${field}_invalid`);
  return parsed;
}

function governanceStatus(value: unknown): SupplierPackagingGovernanceStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (!SUPPLIER_PACKAGING_GOVERNANCE_STATUSES.includes(normalized as SupplierPackagingGovernanceStatus)) {
    throw new Error("packaging_previous_status_invalid");
  }
  return normalized as SupplierPackagingGovernanceStatus;
}

function decisionStatus(value: unknown): SupplierPackagingDecisionStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (!SUPPLIER_PACKAGING_DECISION_STATUSES.includes(normalized as SupplierPackagingDecisionStatus)) {
    throw new Error("packaging_decision_status_invalid");
  }
  return normalized as SupplierPackagingDecisionStatus;
}

function evidenceList(value: unknown, kind: SupplierPackagingEvidenceKind) {
  const raw = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const refs = raw.map((entry) => requiredText(entry, `packaging_evidence_${kind}`, 2_048));
  return [...new Set(refs)].sort((left, right) => left.localeCompare(right)).slice(0, 100);
}

export function normalizeSupplierPackagingEvidenceRefs(input: unknown): SupplierPackagingEvidenceRefs {
  const raw = record(input);
  return Object.fromEntries(
    SUPPLIER_PACKAGING_EVIDENCE_KINDS.map((kind) => [kind, evidenceList(raw[kind], kind)]),
  ) as SupplierPackagingEvidenceRefs;
}

function requiredApprovalEvidence(
  carrierProfileCode: string,
  evidenceRefs: SupplierPackagingEvidenceRefs,
) {
  const required: SupplierPackagingEvidenceKind[] = [...BASE_APPROVAL_EVIDENCE_KINDS];
  if (carrierProfileCode === "ntag424_dna_tt") required.push("tagtamper_placement");
  return required.filter((kind) => evidenceRefs[kind].length === 0);
}

function exportGap(code: string, field: string, message: string): SupplierPackagingExportGap {
  return { code, field, message };
}

function uniqueExportGaps(gaps: SupplierPackagingExportGap[]) {
  const seen = new Set<string>();
  return gaps.filter((gap) => {
    const key = `${gap.code}:${gap.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validationSnapshot(validation: ReturnType<typeof validateSupplierPackagingSpec>): SupplierPackagingValidationSnapshot {
  return {
    validator: "validateSupplierPackagingSpec",
    validatorVersion: SUPPLIER_PACKAGING_GOVERNANCE_VERSION,
    ok: validation.ok,
    productionReady: validation.productionReady,
    errors: validation.errors,
    readinessGaps: validation.readinessGaps,
    warnings: validation.warnings,
  };
}

/**
 * Builds the only payload accepted by the packaging-governance persistence
 * function. Approval is fail-closed: QA booleans are inputs to the industrial
 * validator, while independent evidence references remain mandatory.
 */
export function buildSupplierPackagingGovernanceDecision(
  input: BuildSupplierPackagingGovernanceDecisionInput,
): SupplierPackagingGovernanceDecision {
  const tenantId = requiredText(input.tenantId, "tenant_id", 80);
  const supplierOrderId = requiredText(input.supplierOrderId, "supplier_order_id", 80);
  const previousStatus = governanceStatus(input.previousStatus);
  const status = decisionStatus(input.status);
  const previousRevision = exactInteger(input.previousRevision, "packaging_previous_revision", 0);
  const specRevision = exactInteger(input.specRevision, "packaging_spec_revision", 1);
  if (specRevision !== previousRevision + 1) throw new Error("packaging_spec_revision_not_monotonic");

  const carrierProfileCode = requiredText(input.carrierProfileCode, "carrier_profile_code", 120).toLowerCase();
  const decidedBy = requiredText(input.decidedBy, "packaging_decided_by", 320);
  const decisionReason = optionalText(input.decisionReason, "packaging_decision_reason", 2_000);
  const overrideReason = optionalText(input.overrideReason, "packaging_override_reason", 2_000);
  if (status === "rejected" && !decisionReason) throw new Error("packaging_rejection_reason_required");

  const validation = validateSupplierPackagingSpec(input.spec, {
    carrierProfileCode,
    requireProductionApproval: status === "approved",
  });
  const evidenceRefs = normalizeSupplierPackagingEvidenceRefs(input.evidenceRefs);

  if (status === "approved") {
    const missingEvidence = requiredApprovalEvidence(carrierProfileCode, evidenceRefs);
    if (missingEvidence.length) {
      throw new Error(`packaging_approval_evidence_required:${missingEvidence.join(",")}`);
    }
    if (!validation.ok || !validation.productionReady) {
      throw new Error("packaging_spec_not_production_ready");
    }
  }

  const specHash = hashEvidencePayload({
    schema: "nexid-supplier-packaging-spec-snapshot-v1",
    carrier_profile_code: carrierProfileCode,
    spec: validation.normalized,
  });

  return {
    schema: "nexid-supplier-packaging-governance-v1",
    tenantId,
    supplierOrderId,
    previousStatus,
    status,
    previousRevision,
    specRevision,
    carrierProfileCode,
    specSnapshot: validation.normalized,
    specHash,
    evidenceRefs,
    validation: validationSnapshot(validation),
    decidedBy,
    decisionReason,
    singleOperatorOverride: Boolean(overrideReason),
    overrideReason,
  };
}

/**
 * Revalidates the complete approved snapshot at the key-custody boundary.
 * Callers must execute this before selecting ciphertext or invoking a decryptor.
 */
export function evaluateSupplierPackagingExportGate(
  input: SupplierPackagingExportGateInput,
): SupplierPackagingExportGate {
  const rawStatus = String(input.status || "").trim().toLowerCase();
  const status = SUPPLIER_PACKAGING_GOVERNANCE_STATUSES.includes(rawStatus as SupplierPackagingGovernanceStatus)
    ? rawStatus as SupplierPackagingGovernanceStatus
    : "invalid";
  if (status === "legacy_unverified") {
    return {
      ok: false,
      status,
      gaps: [exportGap(
        "packaging_governance_legacy_unverified",
        "packaging_governance_status",
        "Create, submit and approve an industrial packaging specification before exporting factory keys.",
      )],
    };
  }
  if (status !== "approved") {
    return {
      ok: false,
      status,
      gaps: [exportGap(
        "packaging_approval_required",
        "packaging_governance_status",
        "The current packaging specification must reach approved status before factory export.",
      )],
    };
  }

  const gaps: SupplierPackagingExportGap[] = [];
  const specRevision = Number(input.specRevision);
  if (!Number.isSafeInteger(specRevision) || specRevision < 1) {
    gaps.push(exportGap("packaging_spec_revision_invalid", "packaging_spec_revision", "Approved packaging revision is missing or invalid."));
  }

  const carrierProfileCode = String(input.carrierProfileCode || "").trim().toLowerCase();
  if (!carrierProfileCode) {
    gaps.push(exportGap("packaging_carrier_profile_missing", "carrier_profile_code", "Carrier profile is required to revalidate packaging approval."));
  }

  const snapshot = record(input.specSnapshot);
  if (Object.keys(snapshot).length === 0) {
    gaps.push(exportGap("packaging_spec_snapshot_missing", "packaging_spec_snapshot", "Approved packaging snapshot is missing."));
  }
  const validation = validateSupplierPackagingSpec(snapshot, {
    carrierProfileCode,
    requireProductionApproval: true,
  });
  gaps.push(...validation.errors, ...validation.readinessGaps);

  const specHash = canonicalSha256Hash(input.specHash);
  if (!specHash) {
    gaps.push(exportGap("packaging_spec_hash_invalid", "packaging_spec_hash", "Approved packaging hash is missing or malformed."));
  } else {
    const calculatedHash = hashEvidencePayload({
      schema: "nexid-supplier-packaging-spec-snapshot-v1",
      carrier_profile_code: carrierProfileCode,
      spec: validation.normalized,
    });
    if (calculatedHash !== specHash) {
      gaps.push(exportGap("packaging_spec_hash_mismatch", "packaging_spec_hash", "Approved packaging snapshot no longer matches its canonical hash."));
    }
  }

  let evidenceRefs: SupplierPackagingEvidenceRefs;
  try {
    evidenceRefs = normalizeSupplierPackagingEvidenceRefs(input.evidenceRefs);
    for (const kind of requiredApprovalEvidence(carrierProfileCode, evidenceRefs)) {
      gaps.push(exportGap(
        "packaging_approval_evidence_missing",
        `packaging_evidence_refs.${kind}`,
        `Approved packaging evidence is missing for ${kind}.`,
      ));
    }
  } catch {
    evidenceRefs = normalizeSupplierPackagingEvidenceRefs({});
    gaps.push(exportGap("packaging_approval_evidence_invalid", "packaging_evidence_refs", "Approved packaging evidence references are malformed."));
  }

  const receipt = record(input.validationSnapshot);
  const receiptConsistent = receipt.validator === "validateSupplierPackagingSpec"
    && Number(receipt.validatorVersion) === SUPPLIER_PACKAGING_GOVERNANCE_VERSION
    && receipt.ok === true
    && receipt.productionReady === true
    && Array.isArray(receipt.errors)
    && receipt.errors.length === 0
    && Array.isArray(receipt.readinessGaps)
    && receipt.readinessGaps.length === 0;
  if (!receiptConsistent || !validation.ok || !validation.productionReady) {
    gaps.push(exportGap(
      "packaging_validation_receipt_inconsistent",
      "packaging_validation_snapshot",
      "Persisted approval receipt is not consistent with a fresh production-ready validation.",
    ));
  }
  if (input.approvalHistoryReceiptConsistent !== true) {
    gaps.push(exportGap(
      "packaging_approval_history_receipt_missing",
      "supplier_packaging_governance_decisions",
      "Current approval is not backed by the matching immutable decision receipt.",
    ));
  }

  const normalizedGaps = uniqueExportGaps(gaps);
  if (normalizedGaps.length || !specHash) return { ok: false, status, gaps: normalizedGaps };
  return {
    ok: true,
    status: "approved",
    specRevision,
    specHash,
    specSnapshot: validation.normalized,
    evidenceRefs,
    validation: validationSnapshot(validation),
  };
}

/**
 * Persists one immutable revision through the database-owned transition and
 * tenant/concurrency guard. The database supplies the authoritative timestamp.
 */
export async function persistSupplierPackagingGovernanceDecision(
  input: BuildSupplierPackagingGovernanceDecisionInput,
): Promise<PersistedSupplierPackagingGovernanceDecision> {
  const decision = buildSupplierPackagingGovernanceDecision(input);
  const rows = await sql/*sql*/`
    SELECT *
    FROM public.nexid_record_supplier_packaging_decision_v1(${JSON.stringify({
      tenant_id: decision.tenantId,
      supplier_order_id: decision.supplierOrderId,
      previous_status: decision.previousStatus,
      decision_status: decision.status,
      previous_revision: decision.previousRevision,
      spec_revision: decision.specRevision,
      carrier_profile_code: decision.carrierProfileCode,
      spec_snapshot: decision.specSnapshot,
      spec_hash: decision.specHash,
      evidence_refs: decision.evidenceRefs,
      validation_snapshot: decision.validation,
      decided_by: decision.decidedBy,
      decision_reason: decision.decisionReason,
      single_operator_override: decision.singleOperatorOverride,
      override_reason: decision.overrideReason,
    })}::jsonb)
  `;
  const row = rows[0];
  if (!row) throw new Error("packaging_governance_persistence_failed");
  return {
    decisionId: String(row.decision_id),
    supplierOrderId: String(row.supplier_order_id),
    tenantId: String(row.tenant_id),
    specRevision: Number(row.spec_revision),
    status: decisionStatus(row.decision_status),
    specHash: String(row.spec_hash),
    decidedAt: new Date(String(row.decided_at)).toISOString(),
  };
}
