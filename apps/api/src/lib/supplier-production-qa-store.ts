import { sql, type SqlExecutor } from "./db";
import type { SupplierQaCommitInput, SupplierQaCommitReceipt } from "./supplier-qa-commit";

export const SUPPLIER_PRODUCTION_QA_MIGRATION =
  "20260801090000_0075_supplier_production_qa_acceptance.sql";

export type SupplierProductionQaSessionSample = {
  tag_id: string;
  uid_hex: string;
  uid_fingerprint: string;
  ordinal: number;
  stratum_key: string;
  stratum_values: Record<string, unknown>;
  selection_rank: string;
  cryptographic_required: boolean;
};

export type SupplierProductionQaStoredSession = {
  id: string;
  qa_plan_id: string;
  qa_plan_decision_id: string;
  tenant_id: string;
  supplier_order_id: string;
  supplier_sub_batch_id: string;
  batch_id: string;
  bid: string;
  operation_key: string;
  lot_size: number;
  inspection_level: string;
  target_aql: number;
  sample_size: number;
  accept_number: number;
  reject_number: number;
  policy_reference: string;
  policy_document_sha256: string;
  policy_approved_by: string;
  policy_approved_at: string;
  policy_approval_evidence_ref: string;
  policy_approval_evidence_sha256: string;
  policy_digest: string;
  stratification_dimensions: string[];
  manifest_hash: string;
  carrier_profile_code: string;
  key_fingerprint: string;
  packaging_spec_revision: number;
  packaging_spec_hash: string;
  manufacturing_state_at_open: "PRODUCTION_MANIFEST_IMPORTED";
  sun_verification_context_digest: string;
  acceptance_context_digest: string;
  acceptance_context_binding: Record<string, unknown>;
  acceptance_context_canonical: string;
  selection_algorithm: "hmac-sha256-stratified-v1";
  selection_seed_ciphertext: string;
  selection_seed_commitment: string;
  selection_digest: string;
  challenge_ciphertext: string;
  challenge_hash: string;
  expires_at: string;
  created_by: string;
  created_at: string;
  decision_id: string | null;
  decision_status: "passed" | "failed" | null;
  disposition: "ACCEPT" | "REJECT" | null;
  decided_at: string | null;
  samples: SupplierProductionQaSessionSample[];
};

export type CreateSupplierProductionQaSessionInput = {
  sessionId: string;
  qaPlanId: string;
  qaPlanDecisionId: string;
  tenantId: string;
  supplierOrderId: string;
  supplierSubBatchId: string;
  batchId: string;
  bid: string;
  operationKey: string;
  lotSize: number;
  inspectionLevel: string;
  targetAql: number;
  sampleSize: number;
  acceptNumber: number;
  rejectNumber: number;
  policyReference: string;
  policyDocumentSha256: string;
  policyDigest: string;
  stratificationDimensions: string[];
  manifestHash: string;
  carrierProfileCode: string;
  keyFingerprint: string;
  packagingSpecRevision: number;
  packagingSpecHash: string;
  manufacturingStateAtOpen: "PRODUCTION_MANIFEST_IMPORTED";
  sunVerificationContextDigest: string;
  acceptanceContextDigest: string;
  acceptanceContextBinding: Record<string, unknown>;
  acceptanceContextCanonical: string;
  selectionSeedCiphertext: string;
  selectionSeedCommitment: string;
  selectionDigest: string;
  challengeCiphertext: string;
  challengeHash: string;
  expiresAt: string;
  samples: Array<{
    tag_id: string;
    ordinal: number;
    uid_fingerprint: string;
    stratum_key: string;
    stratum_values: Record<string, unknown>;
    selection_rank: string;
    cryptographic_required: boolean;
  }>;
  actorId: string;
  authSessionId: string;
  requestId: string | null;
};

export type SupplierProductionQaSessionReceipt = {
  sessionId: string;
  expiresAt: string;
  sampleSize: number;
  selectionDigest: string;
  acceptanceContextDigest: string;
  idempotentReplay: boolean;
};

export type CommitSupplierProductionQaInput = SupplierQaCommitInput & {
  productionSessionId: string;
  productionChallenge: string;
  selectionSeedReveal: string;
  productionObservations: Array<{
    tag_id: string;
    outcome: "conforming" | "nonconforming";
    defect_codes: string[];
  }>;
  productionObservationsDigest: string;
  authSessionId: string;
};

export type SupplierProductionQaDecisionReceipt = SupplierQaCommitReceipt & {
  decisionId: string;
  disposition: "ACCEPT" | "REJECT";
  observedSampleCount: number;
  nonconformingCount: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

export async function hasSupplierProductionQaV1(query: SqlExecutor = sql) {
  const rows = await query/*sql*/`
    SELECT
      to_regprocedure('public.nexid_create_supplier_production_qa_session_v1(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_commit_supplier_production_qa_v1(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_submit_supplier_production_qa_plan_v1(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)') IS NOT NULL
      AND to_regprocedure('public.nexid_supplier_production_qa_v1_capability()') IS NOT NULL
      AND to_regclass('public.supplier_production_qa_sessions') IS NOT NULL
      AND to_regclass('public.supplier_production_qa_plans') IS NOT NULL
      AND to_regclass('public.supplier_production_qa_plan_decisions') IS NOT NULL
      AND to_regclass('public.supplier_production_qa_session_samples') IS NOT NULL
      AND to_regclass('public.supplier_production_qa_decisions') IS NOT NULL
      AND to_regclass('public.supplier_production_qa_observations') IS NOT NULL
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_create_supplier_production_qa_session_v1(jsonb)'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_commit_supplier_production_qa_v1(jsonb)'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_submit_supplier_production_qa_plan_v1(jsonb)'),
        'EXECUTE'
      ), false)
      AND COALESCE(has_function_privilege(
        current_user,
        to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)'),
        'EXECUTE'
      ), false)
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'supplier_sub_batches'
          AND column_name = 'manufacturing_state'
      ) AS available
  `;
  return rows[0]?.available === true;
}

function normalizeSessionRow(row: Record<string, unknown>): SupplierProductionQaStoredSession {
  const samples = Array.isArray(row.samples) ? row.samples : [];
  return {
    ...(row as unknown as SupplierProductionQaStoredSession),
    id: String(row.id || ""),
    qa_plan_id: String(row.qa_plan_id || ""),
    qa_plan_decision_id: String(row.qa_plan_decision_id || ""),
    tenant_id: String(row.tenant_id || ""),
    supplier_order_id: String(row.supplier_order_id || ""),
    supplier_sub_batch_id: String(row.supplier_sub_batch_id || ""),
    batch_id: String(row.batch_id || ""),
    bid: String(row.bid || ""),
    lot_size: Number(row.lot_size || 0),
    target_aql: Number(row.target_aql),
    sample_size: Number(row.sample_size || 0),
    accept_number: Number(row.accept_number || 0),
    reject_number: Number(row.reject_number || 0),
    packaging_spec_revision: Number(row.packaging_spec_revision || 0),
    samples: samples as SupplierProductionQaSessionSample[],
    decision_id: row.decision_id ? String(row.decision_id) : null,
    decision_status: row.decision_status === "passed" || row.decision_status === "failed"
      ? row.decision_status
      : null,
    disposition: row.disposition === "ACCEPT" || row.disposition === "REJECT"
      ? row.disposition
      : null,
    decided_at: row.decided_at ? String(row.decided_at) : null,
  };
}

export async function findSupplierProductionQaSessionByOperationKey(input: {
  tenantId: string;
  supplierOrderId: string;
  operationKey: string;
}, query: SqlExecutor = sql) {
  const rows = await query/*sql*/`
    SELECT
      session_row.*,
      decision_row.id AS decision_id,
      decision_row.status AS decision_status,
      decision_row.disposition,
      decision_row.decided_at::text AS decided_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'tag_id', sample.tag_id,
          'uid_hex', manifest_tag.uid_hex,
          'uid_fingerprint', sample.uid_fingerprint,
          'ordinal', sample.ordinal,
          'stratum_key', sample.stratum_key,
          'stratum_values', sample.stratum_values,
          'selection_rank', sample.selection_rank,
          'cryptographic_required', sample.cryptographic_required
        ) ORDER BY sample.ordinal)
        FROM supplier_production_qa_session_samples sample
        JOIN tags manifest_tag ON manifest_tag.id = sample.tag_id
        WHERE sample.session_id = session_row.id
      ), '[]'::jsonb) AS samples
    FROM supplier_production_qa_sessions session_row
    LEFT JOIN supplier_production_qa_decisions decision_row ON decision_row.session_id = session_row.id
    WHERE session_row.tenant_id = ${input.tenantId}::uuid
      AND session_row.supplier_order_id = ${input.supplierOrderId}::uuid
      AND session_row.operation_key = ${input.operationKey}
    LIMIT 1
  `;
  return rows[0] ? normalizeSessionRow(rows[0]) : null;
}

export async function getSupplierProductionQaSession(input: {
  tenantId: string;
  supplierOrderId: string;
  sessionId: string;
}, query: SqlExecutor = sql) {
  const rows = await query/*sql*/`
    SELECT
      session_row.*,
      decision_row.id AS decision_id,
      decision_row.status AS decision_status,
      decision_row.disposition,
      decision_row.decided_at::text AS decided_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'tag_id', sample.tag_id,
          'uid_hex', manifest_tag.uid_hex,
          'uid_fingerprint', sample.uid_fingerprint,
          'ordinal', sample.ordinal,
          'stratum_key', sample.stratum_key,
          'stratum_values', sample.stratum_values,
          'selection_rank', sample.selection_rank,
          'cryptographic_required', sample.cryptographic_required
        ) ORDER BY sample.ordinal)
        FROM supplier_production_qa_session_samples sample
        JOIN tags manifest_tag ON manifest_tag.id = sample.tag_id
        WHERE sample.session_id = session_row.id
      ), '[]'::jsonb) AS samples
    FROM supplier_production_qa_sessions session_row
    LEFT JOIN supplier_production_qa_decisions decision_row ON decision_row.session_id = session_row.id
    WHERE session_row.tenant_id = ${input.tenantId}::uuid
      AND session_row.supplier_order_id = ${input.supplierOrderId}::uuid
      AND session_row.id = ${input.sessionId}::uuid
    LIMIT 1
  `;
  return rows[0] ? normalizeSessionRow(rows[0]) : null;
}

export async function listSupplierProductionQaSessions(input: {
  tenantId: string;
  supplierOrderId: string;
  bid?: string | null;
}, query: SqlExecutor = sql) {
  const rows = await query/*sql*/`
    SELECT
      session_row.*,
      decision_row.id AS decision_id,
      decision_row.status AS decision_status,
      decision_row.disposition,
      decision_row.decided_at::text AS decided_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'tag_id', sample.tag_id,
          'uid_hex', manifest_tag.uid_hex,
          'uid_fingerprint', sample.uid_fingerprint,
          'ordinal', sample.ordinal,
          'stratum_key', sample.stratum_key,
          'stratum_values', sample.stratum_values,
          'selection_rank', sample.selection_rank,
          'cryptographic_required', sample.cryptographic_required
        ) ORDER BY sample.ordinal)
        FROM supplier_production_qa_session_samples sample
        JOIN tags manifest_tag ON manifest_tag.id = sample.tag_id
        WHERE sample.session_id = session_row.id
      ), '[]'::jsonb) AS samples
    FROM supplier_production_qa_sessions session_row
    LEFT JOIN supplier_production_qa_decisions decision_row ON decision_row.session_id = session_row.id
    WHERE session_row.tenant_id = ${input.tenantId}::uuid
      AND session_row.supplier_order_id = ${input.supplierOrderId}::uuid
      AND (${input.bid || null}::text IS NULL OR upper(session_row.bid) = upper(${input.bid || null}))
    ORDER BY session_row.created_at DESC, session_row.id DESC
    LIMIT 25
  `;
  return rows.map(normalizeSessionRow);
}

export async function createSupplierProductionQaSession(
  input: CreateSupplierProductionQaSessionInput,
  query: SqlExecutor = sql,
): Promise<SupplierProductionQaSessionReceipt> {
  const payload = {
    session_id: input.sessionId,
    qa_plan_id: input.qaPlanId,
    qa_plan_decision_id: input.qaPlanDecisionId,
    tenant_id: input.tenantId,
    supplier_order_id: input.supplierOrderId,
    supplier_sub_batch_id: input.supplierSubBatchId,
    batch_id: input.batchId,
    bid: input.bid,
    schema_version: "supplier-production-qa-session/v1",
    operation_key: input.operationKey,
    lot_size: input.lotSize,
    inspection_level: input.inspectionLevel,
    target_aql: input.targetAql,
    sample_size: input.sampleSize,
    accept_number: input.acceptNumber,
    reject_number: input.rejectNumber,
    policy_reference: input.policyReference,
    policy_document_sha256: input.policyDocumentSha256,
    policy_digest: input.policyDigest,
    stratification_dimensions: input.stratificationDimensions,
    manifest_hash: input.manifestHash,
    carrier_profile_code: input.carrierProfileCode,
    key_fingerprint: input.keyFingerprint,
    packaging_spec_revision: input.packagingSpecRevision,
    packaging_spec_hash: input.packagingSpecHash,
    manufacturing_state_at_open: input.manufacturingStateAtOpen,
    sun_verification_context_digest: input.sunVerificationContextDigest,
    acceptance_context_digest: input.acceptanceContextDigest,
    acceptance_context_binding: input.acceptanceContextBinding,
    acceptance_context_canonical: input.acceptanceContextCanonical,
    selection_algorithm: "hmac-sha256-stratified-v1",
    selection_seed_ciphertext: input.selectionSeedCiphertext,
    selection_seed_commitment: input.selectionSeedCommitment,
    selection_digest: input.selectionDigest,
    challenge_ciphertext: input.challengeCiphertext,
    challenge_hash: input.challengeHash,
    expires_at: input.expiresAt,
    samples: input.samples,
    actor_id: input.actorId,
    auth_session_id: input.authSessionId,
    request_id: input.requestId,
  };
  const rows = await query/*sql*/`
    SELECT *
    FROM public.nexid_create_supplier_production_qa_session_v1(${JSON.stringify(payload)}::jsonb)
  `;
  const row = rows[0];
  if (!row) throw new Error("supplier_production_qa_session_readback_failed");
  const receipt = {
    sessionId: String(row.session_id || ""),
    expiresAt: String(row.expires_at || ""),
    sampleSize: Number(row.sample_size || 0),
    selectionDigest: String(row.selection_digest || ""),
    acceptanceContextDigest: String(row.acceptance_context_digest || ""),
    idempotentReplay: row.idempotent_replay === true,
  };
  if (
    !UUID_PATTERN.test(receipt.sessionId)
    || !Number.isSafeInteger(receipt.sampleSize)
    || receipt.sampleSize <= 0
    || !SHA256_PATTERN.test(receipt.selectionDigest)
    || !SHA256_PATTERN.test(receipt.acceptanceContextDigest)
    || !Number.isFinite(Date.parse(receipt.expiresAt))
  ) {
    throw new Error("supplier_production_qa_session_readback_invalid");
  }
  return receipt;
}

export async function commitSupplierProductionQa(
  input: CommitSupplierProductionQaInput,
  query: SqlExecutor = sql,
): Promise<SupplierProductionQaDecisionReceipt> {
  const payload = {
    tenant_id: input.tenantId,
    supplier_order_id: input.supplierOrderId,
    supplier_sub_batch_id: input.supplierSubBatchId,
    batch_id: input.batchId,
    bid: input.bid,
    status: input.status,
    sample_count: input.sampleCount,
    replay_checked: input.replayChecked,
    ttstatus_checked: input.ttstatusChecked,
    notes: input.notes,
    evidence_json: input.evidence,
    evidence_digest: input.evidenceDigest,
    diagnostic_refs: input.diagnosticRefs,
    operation_key: input.operationKey,
    actor_id: input.actorId,
    auth_session_id: input.authSessionId,
    actor_email: input.actorEmail,
    expected_manifest_hash: input.expectedManifestHash,
    expected_carrier_profile_code: input.expectedCarrierProfileCode,
    expected_key_fingerprint: input.expectedKeyFingerprint,
    expected_sdm_config: input.expectedSdmConfig,
    expected_verification_context_digest: input.expectedVerificationContextDigest,
    expected_verification_context_binding: input.expectedVerificationContextBinding,
    expected_verification_context_canonical: input.expectedVerificationContextCanonical,
    user_agent: input.userAgent,
    request_id: input.requestId,
    production_session_id: input.productionSessionId,
    production_challenge: input.productionChallenge,
    selection_seed_reveal: input.selectionSeedReveal,
    production_observations: input.productionObservations,
    production_observations_digest: input.productionObservationsDigest,
  };
  const rows = await query/*sql*/`
    SELECT *
    FROM public.nexid_commit_supplier_production_qa_v1(${JSON.stringify(payload)}::jsonb)
  `;
  const row = rows[0];
  if (!row) throw new Error("supplier_production_qa_decision_readback_failed");
  const status = String(row.qa_status || "").toLowerCase();
  const disposition = String(row.disposition || "").toUpperCase();
  const receipt: SupplierProductionQaDecisionReceipt = {
    decisionId: String(row.decision_id || ""),
    qaCheckId: String(row.qa_check_id || ""),
    status: status === "passed" ? "passed" : "failed",
    disposition: disposition === "ACCEPT" ? "ACCEPT" : "REJECT",
    observedSampleCount: Number(row.observed_sample_count || 0),
    nonconformingCount: Number(row.nonconforming_count || 0),
    evidenceDigest: String(row.evidence_digest || ""),
    evidenceEventHash: String(row.evidence_event_hash || ""),
    idempotentReplay: row.idempotent_replay === true,
  };
  if (
    !UUID_PATTERN.test(receipt.decisionId)
    || !UUID_PATTERN.test(receipt.qaCheckId)
    || !SHA256_PATTERN.test(receipt.evidenceDigest)
    || !SHA256_PATTERN.test(receipt.evidenceEventHash)
    || !Number.isSafeInteger(receipt.observedSampleCount)
    || receipt.observedSampleCount <= 0
    || !Number.isSafeInteger(receipt.nonconformingCount)
    || receipt.nonconformingCount < 0
    || receipt.nonconformingCount > receipt.observedSampleCount
  ) {
    throw new Error("supplier_production_qa_decision_readback_invalid");
  }
  return receipt;
}

const CONFLICT_REASONS = new Set([
  "supplier_production_qa_approved_plan_required",
  "supplier_production_qa_approved_plan_snapshot_mismatch",
  "supplier_production_qa_context_changed",
  "supplier_production_qa_idempotency_key_conflict",
  "supplier_production_qa_observation_scope_mismatch",
  "supplier_production_qa_observations_digest_mismatch",
  "supplier_production_qa_plan_already_approved",
  "supplier_production_qa_plan_already_decided",
  "supplier_production_qa_plan_decision_idempotency_conflict",
  "supplier_production_qa_plan_digest_mismatch",
  "supplier_production_qa_plan_idempotency_conflict",
  "supplier_production_qa_plan_revision_conflict",
  "supplier_production_qa_plan_scope_invalid",
  "supplier_production_qa_preconditions_not_met",
  "supplier_production_qa_sample_manifest_mismatch",
  "supplier_production_qa_session_already_open",
  "supplier_production_qa_session_consumed",
  "supplier_production_qa_session_expired",
  "supplier_production_qa_state_changed",
  "supplier_qa_production_sample_mismatch",
  "supplier_qa_production_session_invalid",
]);

const BAD_INPUT_REASONS = new Set([
  "supplier_production_qa_decision_identity_invalid",
  "supplier_production_qa_decision_input_invalid",
  "supplier_production_qa_decision_mismatch",
  "supplier_production_qa_observations_invalid",
  "supplier_production_qa_plan_binding_mismatch",
  "supplier_production_qa_plan_contract_invalid",
  "supplier_production_qa_plan_decision_contract_invalid",
  "supplier_production_qa_plan_decision_identity_invalid",
  "supplier_production_qa_plan_decision_input_invalid",
  "supplier_production_qa_plan_identity_invalid",
  "supplier_production_qa_plan_input_invalid",
  "supplier_production_qa_sample_set_invalid",
  "supplier_production_qa_samples_invalid",
  "supplier_production_qa_seed_reveal_invalid",
  "supplier_production_qa_session_contract_invalid",
  "supplier_production_qa_session_identity_invalid",
  "supplier_production_qa_session_input_invalid",
  "supplier_production_qa_server_owned_approval_fields_forbidden",
  "supplier_production_qa_stratification_invalid",
]);

export function supplierProductionQaError(error: unknown): {
  status: number;
  reason: string;
  requiredMigration?: string;
} {
  const code = String((error as { code?: unknown })?.code || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("supplier_production_qa_challenge_invalid")) {
    return { status: 403, reason: "supplier_production_qa_challenge_invalid" };
  }
  if (message.includes("supplier_production_qa_scope_not_found")
    || message.includes("supplier_production_qa_session_not_found")
    || message.includes("supplier_production_qa_plan_not_found")) {
    const reason = message.includes("session_not_found")
      ? "supplier_production_qa_session_not_found"
      : message.includes("plan_not_found")
        ? "supplier_production_qa_plan_not_found"
        : "supplier_production_qa_scope_not_found";
    return { status: 404, reason };
  }
  const forbiddenReason = [
    "supplier_production_qa_plan_submitter_scope_invalid",
    "supplier_production_qa_plan_approver_scope_invalid",
    "supplier_production_qa_session_actor_scope_invalid",
    "supplier_production_qa_decider_scope_invalid",
  ].find((reason) => message.includes(reason));
  if (forbiddenReason || code === "42501") {
    return { status: 403, reason: forbiddenReason || "supplier_production_qa_forbidden" };
  }
  const conflict = [...CONFLICT_REASONS].find((reason) => message.includes(reason));
  if (conflict) return { status: 409, reason: conflict };
  const badInput = [...BAD_INPUT_REASONS].find((reason) => message.includes(reason));
  if (badInput) return { status: 400, reason: badInput };
  if (
    code === "42P01"
    || code === "42703"
    || code === "42883"
    || message.includes("nexid_create_supplier_production_qa_session_v1")
    || message.includes("nexid_commit_supplier_production_qa_v1")
    || message.includes("nexid_submit_supplier_production_qa_plan_v1")
    || message.includes("nexid_decide_supplier_production_qa_plan_v1")
    || message.includes("supplier_production_qa_sessions")
  ) {
    return {
      status: 503,
      reason: "supplier_production_qa_migration_required",
      requiredMigration: SUPPLIER_PRODUCTION_QA_MIGRATION,
    };
  }
  return { status: 503, reason: "supplier_production_qa_unavailable" };
}
