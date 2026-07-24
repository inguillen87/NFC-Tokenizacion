import { sql } from "./db";
import {
  IOTA_EVIDENCE_CONTRACT_VERSION,
  IOTA_EVIDENCE_MERKLE_ALGORITHM,
  PreparedIotaEvidence,
  inspectIotaEvidenceTarget,
  inspectIotaEvidenceTransaction,
  iotaEvidenceExplorerUrl,
  prepareIotaEvidence,
  publishIotaEvidence,
  resolveIotaEvidenceRuntimeConfig,
} from "./iota-evidence-writer";

type AnchorRow = Record<string, any> & {
  id: string;
  tenant_id: string;
  provider: string;
  network: string;
  resource_type: string;
  resource_id: string | null;
  public_resource_id: string;
  event_hashes_json: unknown[];
  canonicalization_version: string;
  merkle_root: string;
  memo_hash: string;
  proof_id: string;
  chain_id: number | string;
  contract_address: string;
  publisher_address: string | null;
  tx_hash: string | null;
  status: string;
};

const DEFINITIVE_ERROR_CODES = new Set([
  "event_count_invalid",
  "event_hash_invalid",
  "event_hashes_required",
  "iota_anchor_calldata_invalid",
  "iota_anchor_calldata_mismatch",
  "iota_anchor_memo_hash_mismatch",
  "iota_anchor_merkle_root_mismatch",
  "iota_anchor_publisher_mismatch",
  "iota_anchor_storage_mismatch",
  "iota_chain_id_mismatch",
  "iota_contract_address_invalid",
  "iota_contract_address_mismatch",
  "iota_contract_schema_version_mismatch",
  "iota_evidence_event_missing",
  "iota_executor_chain_mismatch",
  "iota_executor_contract_mismatch",
  "iota_executor_publisher_invalid",
  "iota_executor_proof_id_mismatch",
  "iota_executor_tx_hash_invalid",
  "iota_proof_id_mismatch",
  "iota_receipt_contract_mismatch",
  "iota_receipt_failed",
  "iota_receipt_publisher_mismatch",
  "iota_receipt_reverted",
  "iota_tx_hash_invalid",
  "memo_hash_invalid",
  "merkle_root_invalid",
  "public_resource_control_character_forbidden",
  "public_resource_id_too_long",
  "resource_type_too_long",
  "tenant_id_hash_invalid",
]);

function text(value: unknown) {
  return String(value || "").trim();
}

function safeErrorCode(error: unknown) {
  const raw = error instanceof Error ? error.message : "iota_anchor_processing_failed";
  if (/^[a-z0-9_]{3,100}$/i.test(raw)) return raw.toLowerCase();
  const code = text((error as { code?: unknown } | null)?.code).toLowerCase();
  if (["network_error", "server_error", "timeout"].includes(code)) return "iota_rpc_unavailable";
  return "iota_anchor_processing_failed";
}

function retryAt(attemptCount: number) {
  const seconds = Math.min(15 * 60, 15 * Math.max(1, 2 ** Math.min(attemptCount, 6)));
  return new Date(Date.now() + seconds * 1_000).toISOString();
}

function preparedFromAnchor(anchor: AnchorRow): PreparedIotaEvidence {
  const prepared = prepareIotaEvidence({
    tenantId: anchor.tenant_id,
    resourceType: anchor.resource_type,
    publicResourceId: anchor.public_resource_id,
    eventHashes: Array.isArray(anchor.event_hashes_json) ? anchor.event_hashes_json : [],
    canonicalizationVersion: anchor.canonicalization_version,
    preserveEventOrder: true,
  });
  if (prepared.merkleRoot !== text(anchor.merkle_root).toLowerCase()) throw new Error("iota_anchor_merkle_root_mismatch");
  if (prepared.memoHash !== text(anchor.memo_hash).toLowerCase()) throw new Error("iota_anchor_memo_hash_mismatch");
  return prepared;
}

async function readAnchor(anchorId: string, tenantId?: string | null) {
  const rows = tenantId
    ? await sql/*sql*/`
        SELECT * FROM evidence_anchors
        WHERE id = ${anchorId}::uuid
          AND tenant_id = ${tenantId}::uuid
          AND provider = 'iota'
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT * FROM evidence_anchors
        WHERE id = ${anchorId}::uuid
          AND provider = 'iota'
        LIMIT 1
      `;
  return rows[0] as AnchorRow | undefined;
}

async function ensureAttempt(anchor: AnchorRow) {
  const rows = await sql/*sql*/`
    WITH locked_anchor AS MATERIALIZED (
      SELECT id
      FROM evidence_anchors
      WHERE id = ${anchor.id}::uuid
        AND provider = 'iota'
      FOR UPDATE
    ),
    active_attempt AS MATERIALIZED (
      SELECT attempt.id, attempt.attempt_no
      FROM evidence_anchor_attempts attempt
      JOIN locked_anchor ON locked_anchor.id = attempt.anchor_id
      WHERE attempt.tx_hash IS NULL
        AND attempt.status = 'reconciling'
        AND COALESCE(attempt.checked_at, attempt.updated_at, attempt.created_at) > now() - interval '2 minutes'
      ORDER BY attempt.attempt_no DESC
      LIMIT 1
    ),
    claimable_attempt AS MATERIALIZED (
      SELECT attempt.id, attempt.attempt_no
      FROM evidence_anchor_attempts attempt
      JOIN locked_anchor ON locked_anchor.id = attempt.anchor_id
      WHERE attempt.tx_hash IS NULL
        AND (
          attempt.status = 'pending'
          OR (
            attempt.status = 'reconciling'
            AND COALESCE(attempt.checked_at, attempt.updated_at, attempt.created_at) <= now() - interval '2 minutes'
          )
        )
        AND NOT EXISTS (SELECT 1 FROM active_attempt)
      ORDER BY attempt.attempt_no DESC
      LIMIT 1
      FOR UPDATE
    ),
    claimed_attempt AS (
      UPDATE evidence_anchor_attempts attempt
      SET status = 'reconciling',
          checked_at = now(),
          updated_at = now()
      FROM claimable_attempt claimable
      WHERE attempt.id = claimable.id
      RETURNING attempt.id, attempt.attempt_no
    ),
    inserted_attempt AS (
      INSERT INTO evidence_anchor_attempts (
        anchor_id, attempt_no, chain_id, contract_address, status, checked_at
      )
      SELECT
        locked_anchor.id,
        COALESCE((
          SELECT MAX(existing.attempt_no)
          FROM evidence_anchor_attempts existing
          WHERE existing.anchor_id = locked_anchor.id
        ), 0) + 1,
        ${Number(anchor.chain_id)},
        ${anchor.contract_address},
        'reconciling',
        now()
      FROM locked_anchor
      WHERE NOT EXISTS (SELECT 1 FROM active_attempt)
        AND NOT EXISTS (SELECT 1 FROM claimed_attempt)
      RETURNING id, attempt_no
    ),
    chosen_attempt AS MATERIALIZED (
      SELECT id, attempt_no FROM claimed_attempt
      UNION ALL
      SELECT id, attempt_no FROM inserted_attempt
      LIMIT 1
    ),
    anchor_update AS (
      UPDATE evidence_anchors anchor_row
      SET attempt_count = GREATEST(anchor_row.attempt_count, chosen_attempt.attempt_no),
          updated_at = now()
      FROM chosen_attempt
      WHERE anchor_row.id = ${anchor.id}::uuid
      RETURNING anchor_row.id
    )
    SELECT id, attempt_no, false AS busy FROM chosen_attempt
    UNION ALL
    SELECT id, attempt_no, true AS busy FROM active_attempt
    LIMIT 1
  `;
  const attempt = rows[0] as { id: string; attempt_no: number; busy?: boolean } | undefined;
  if (!attempt) throw new Error("iota_attempt_reservation_failed");
  if (attempt.busy) throw new Error("iota_anchor_busy");
  return attempt;
}

async function markSubmitted(input: {
  anchorId: string;
  attemptId: string;
  txHash: string;
  publisherAddress: string;
  nonce: number | null;
  explorerUrl: string | null;
}) {
  const rows = await sql/*sql*/`
    WITH submitted_attempt AS (
      UPDATE evidence_anchor_attempts attempt
      SET status = 'submitted',
          signer_address = ${input.publisherAddress},
          nonce = ${input.nonce},
          tx_hash = ${input.txHash},
          submitted_at = COALESCE(attempt.submitted_at, now()),
          checked_at = now(),
          updated_at = now()
      WHERE attempt.id = ${input.attemptId}::uuid
        AND attempt.anchor_id = ${input.anchorId}::uuid
        AND attempt.tx_hash IS NULL
      RETURNING attempt.anchor_id
    )
    UPDATE evidence_anchors anchor_row
    SET status = 'submitted',
        publisher_address = ${input.publisherAddress},
        tx_hash = ${input.txHash},
        explorer_url = ${input.explorerUrl},
        submitted_at = COALESCE(anchor_row.submitted_at, now()),
        last_checked_at = now(),
        next_attempt_at = now() + interval '30 seconds',
        error_code = NULL,
        error_message = NULL,
        updated_at = now()
    FROM submitted_attempt
    WHERE anchor_row.id = submitted_attempt.anchor_id
    RETURNING anchor_row.id
  `;
  if (!rows[0]) throw new Error("iota_attempt_not_owned");
}

async function markConfirmed(input: {
  anchorId: string;
  attemptId?: string | null;
  publisherAddress: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  confirmations: number;
  anchoredAt: number | null;
}) {
  if (input.attemptId) {
    await sql/*sql*/`
      UPDATE evidence_anchor_attempts
      SET status = 'confirmed',
          receipt_status = 'success',
          signer_address = COALESCE(${input.publisherAddress}, signer_address),
          block_number = ${input.blockNumber},
          block_hash = ${input.blockHash},
          checked_at = now(),
          error_code = NULL,
          error_detail_sanitized = NULL,
          updated_at = now()
      WHERE id = ${input.attemptId}::uuid
        AND anchor_id = ${input.anchorId}::uuid
    `;
  }
  await sql/*sql*/`
    UPDATE evidence_anchors
    SET status = 'confirmed',
        publisher_address = COALESCE(${input.publisherAddress}, publisher_address),
        block_number = COALESCE(${input.blockNumber}, block_number),
        block_hash = COALESCE(${input.blockHash}, block_hash),
        confirmations = GREATEST(confirmations, ${input.confirmations}),
        anchored_at = COALESCE(to_timestamp(${input.anchoredAt}::double precision), anchored_at, now()),
        confirmed_at = COALESCE(confirmed_at, now()),
        last_checked_at = now(),
        next_attempt_at = NULL,
        error_code = NULL,
        error_message = NULL,
        updated_at = now()
    WHERE id = ${input.anchorId}::uuid
  `;
}

async function markWaiting(input: {
  anchorId: string;
  attemptId?: string | null;
  status: "pending" | "submitted" | "reconciling";
  confirmations?: number;
  errorCode?: string | null;
  attemptCount: number;
}) {
  const nextAttemptAt = retryAt(input.attemptCount);
  if (input.attemptId) {
    await sql/*sql*/`
      UPDATE evidence_anchor_attempts
      SET status = CASE WHEN tx_hash IS NULL THEN 'failed' ELSE 'submitted' END,
          checked_at = now(),
          error_code = ${input.errorCode || null},
          error_detail_sanitized = ${input.errorCode || null},
          updated_at = now()
      WHERE id = ${input.attemptId}::uuid
        AND anchor_id = ${input.anchorId}::uuid
    `;
  }
  await sql/*sql*/`
    UPDATE evidence_anchors
    SET status = ${input.status},
        confirmations = GREATEST(confirmations, ${input.confirmations || 0}),
        last_checked_at = now(),
        next_attempt_at = ${nextAttemptAt}::timestamptz,
        error_code = ${input.errorCode || null},
        error_message = ${input.errorCode || null},
        updated_at = now()
    WHERE id = ${input.anchorId}::uuid
  `;
}

async function markFailed(input: {
  anchorId: string;
  attemptId?: string | null;
  errorCode: string;
}) {
  if (input.attemptId) {
    await sql/*sql*/`
      UPDATE evidence_anchor_attempts
      SET status = 'failed',
          receipt_status = CASE WHEN ${input.errorCode} = 'iota_receipt_reverted' THEN 'reverted' ELSE receipt_status END,
          checked_at = now(),
          error_code = ${input.errorCode},
          error_detail_sanitized = ${input.errorCode},
          updated_at = now()
      WHERE id = ${input.attemptId}::uuid
        AND anchor_id = ${input.anchorId}::uuid
    `;
  }
  await sql/*sql*/`
    UPDATE evidence_anchors
    SET status = 'failed',
        last_checked_at = now(),
        next_attempt_at = NULL,
        error_code = ${input.errorCode},
        error_message = ${input.errorCode},
        updated_at = now()
    WHERE id = ${input.anchorId}::uuid
  `;
}

async function latestAttempt(anchorId: string, txHash?: string | null) {
  const rows = txHash
    ? await sql/*sql*/`
        SELECT id, attempt_no
        FROM evidence_anchor_attempts
        WHERE anchor_id = ${anchorId}::uuid
          AND lower(tx_hash) = lower(${txHash})
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT id, attempt_no
        FROM evidence_anchor_attempts
        WHERE anchor_id = ${anchorId}::uuid
        ORDER BY attempt_no DESC
        LIMIT 1
      `;
  return rows[0] as { id: string; attempt_no: number } | undefined;
}

async function verifyKnownTransaction(anchor: AnchorRow, prepared: PreparedIotaEvidence, target: Awaited<ReturnType<typeof inspectIotaEvidenceTarget>>) {
  if (!anchor.tx_hash) return null;
  const config = resolveIotaEvidenceRuntimeConfig();
  const check = await inspectIotaEvidenceTransaction(prepared, target, config, {
    txHash: anchor.tx_hash,
    expectedPublisher: anchor.publisher_address,
  });
  const attempt = await latestAttempt(anchor.id, anchor.tx_hash);
  if (check.state === "confirmed") {
    await markConfirmed({ anchorId: anchor.id, attemptId: attempt?.id, ...check });
  } else if (check.state === "failed") {
    await markFailed({ anchorId: anchor.id, attemptId: attempt?.id, errorCode: check.errorCode || "iota_receipt_reverted" });
  } else {
    await markWaiting({
      anchorId: anchor.id,
      attemptId: attempt?.id,
      status: "submitted",
      confirmations: check.confirmations,
      attemptCount: Number(anchor.attempt_count || 1),
    });
  }
  return check;
}

export async function processIotaEvidenceAnchor(anchorId: string, tenantId?: string | null) {
  let anchor = await readAnchor(anchorId, tenantId);
  if (!anchor) return { ok: false, reason: "anchor_not_found" } as const;
  if (anchor.status === "confirmed") return { ok: true, anchor, idempotent_replay: true } as const;

  const config = resolveIotaEvidenceRuntimeConfig();
  if (config.mode !== "iota_evm_contract_v2") {
    await markWaiting({
      anchorId: anchor.id,
      status: "pending",
      errorCode: "iota_v2_runtime_disabled",
      attemptCount: Number(anchor.attempt_count || 0),
    });
    return { ok: false, reason: "iota_v2_runtime_disabled", anchor: await readAnchor(anchor.id, tenantId) } as const;
  }

  let attempt: { id: string; attempt_no: number } | undefined;
  try {
    const prepared = preparedFromAnchor(anchor);
    const target = await inspectIotaEvidenceTarget(prepared, config);
    if (target.proofId.toLowerCase() !== text(anchor.proof_id).toLowerCase()) {
      throw new Error("iota_proof_id_mismatch");
    }
    if (target.chainId !== Number(anchor.chain_id)) throw new Error("iota_chain_id_mismatch");
    if (target.contractAddress.toLowerCase() !== text(anchor.contract_address).toLowerCase()) {
      throw new Error("iota_contract_address_mismatch");
    }

    if (anchor.tx_hash) {
      await verifyKnownTransaction(anchor, prepared, target);
      return { ok: true, anchor: await readAnchor(anchor.id, tenantId), reconciled: true } as const;
    }
    if (target.alreadyAnchored) {
      attempt = await ensureAttempt(anchor);
      await markConfirmed({
        anchorId: anchor.id,
        attemptId: attempt.id,
        publisherAddress: target.publisherAddress,
        blockNumber: null,
        blockHash: null,
        confirmations: config.minConfirmations,
        anchoredAt: target.anchoredAt,
      });
      return { ok: true, anchor: await readAnchor(anchor.id, tenantId), reconciled: true } as const;
    }

    attempt = await ensureAttempt(anchor);
    const submission = await publishIotaEvidence(prepared, target, config, anchor.id, {
      onSubmitted: async ({ txHash, publisherAddress, nonce }) => {
        await markSubmitted({
          anchorId: anchor!.id,
          attemptId: attempt!.id,
          txHash,
          publisherAddress,
          nonce,
          explorerUrl: iotaEvidenceExplorerUrl(config, txHash),
        });
      },
    });

    if (submission.txHash) {
      anchor = (await readAnchor(anchor.id, tenantId)) || anchor;
      await verifyKnownTransaction(anchor, prepared, target);
    } else {
      const refreshedTarget = await inspectIotaEvidenceTarget(prepared, config);
      if (!refreshedTarget.alreadyAnchored) throw new Error("iota_anchor_not_observed");
      await markConfirmed({
        anchorId: anchor.id,
        attemptId: attempt.id,
        publisherAddress: refreshedTarget.publisherAddress || submission.publisherAddress,
        blockNumber: submission.blockNumber,
        blockHash: submission.blockHash,
        confirmations: Math.max(submission.confirmations, config.minConfirmations),
        anchoredAt: refreshedTarget.anchoredAt || submission.anchoredAt,
      });
    }
    return { ok: true, anchor: await readAnchor(anchor.id, tenantId), published: true } as const;
  } catch (error) {
    const errorCode = safeErrorCode(error);
    if (DEFINITIVE_ERROR_CODES.has(errorCode)) {
      await markFailed({ anchorId: anchor.id, attemptId: attempt?.id, errorCode });
    } else {
      await markWaiting({
        anchorId: anchor.id,
        attemptId: attempt?.id,
        status: anchor.tx_hash ? "submitted" : "pending",
        errorCode,
        attemptCount: Math.max(Number(anchor.attempt_count || 0), Number(attempt?.attempt_no || 0)),
      });
    }
    return { ok: false, reason: errorCode, anchor: await readAnchor(anchor.id, tenantId) } as const;
  }
}

export async function claimIotaEvidenceAnchors(limit = 10) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  return await sql/*sql*/`
    WITH candidates AS (
      SELECT id
      FROM evidence_anchors
      WHERE provider = 'iota'
        AND status IN ('pending', 'submitted', 'reconciling')
        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      ORDER BY COALESCE(next_attempt_at, created_at) ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${safeLimit}
    )
    UPDATE evidence_anchors AS anchor
    SET status = 'reconciling',
        last_checked_at = now(),
        updated_at = now()
    FROM candidates
    WHERE anchor.id = candidates.id
    RETURNING anchor.id, anchor.tenant_id
  `;
}

export function iotaWriterContractMetadata() {
  return {
    contract_version: IOTA_EVIDENCE_CONTRACT_VERSION,
    merkle_algorithm: IOTA_EVIDENCE_MERKLE_ALGORITHM,
  };
}
