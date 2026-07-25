import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const PROOF_ID_PATTERN = /^0x[0-9a-f]{64}$/;
const PAYLOAD_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const RAW_TRANSACTION_PATTERN = /^0x(?:[0-9a-f]{2})+$/i;
const TX_HASH_PATTERN = /^0x[0-9a-f]{64}$/i;
const RECOVERABLE_STATES = new Set(["signed", "broadcast", "submitted"]);
let pool;

function databaseUrl() {
  return String(process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

function getPool() {
  if (!databaseUrl()) return null;
  if (!pool) pool = new Pool({ connectionString: databaseUrl(), max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 3_000 });
  return pool;
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("iota_payload_invalid");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  throw new Error("iota_payload_invalid");
}

function normalizeProofId(value) {
  const proofId = String(value || "").trim().toLowerCase();
  if (!PROOF_ID_PATTERN.test(proofId)) throw new Error("proof_id_invalid");
  return proofId;
}

function normalizeRequestId(value) {
  const requestId = String(value || "").trim();
  if (!requestId || requestId.length > 200 || /[\u0000-\u001f\u007f]/.test(requestId)) {
    throw new Error("iota_request_id_invalid");
  }
  return requestId;
}

function normalizeLeaseToken(value) {
  const leaseToken = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(leaseToken)) {
    throw new Error("iota_lease_token_invalid");
  }
  return leaseToken;
}

function normalizeSignedPublication(input) {
  const rawTransaction = String(input?.rawTransaction || input?.raw_transaction || "").trim();
  const txHash = String(input?.txHash || input?.tx_hash || "").trim().toLowerCase();
  const signerAddress = String(input?.signerAddress || input?.signer_address || "").trim();
  const chainId = Number(input?.chainId ?? input?.chain_id);
  const nonce = Number(input?.nonce);
  if (!RAW_TRANSACTION_PATTERN.test(rawTransaction)) throw new Error("iota_raw_transaction_invalid");
  if (!TX_HASH_PATTERN.test(txHash)) throw new Error("iota_tx_hash_invalid");
  if (!/^0x[0-9a-f]{40}$/i.test(signerAddress)) throw new Error("iota_signer_address_invalid");
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error("iota_chain_id_invalid");
  if (!Number.isSafeInteger(nonce) || nonce < 0) throw new Error("iota_nonce_invalid");
  return { rawTransaction, txHash, signerAddress, chainId, nonce };
}

function rowResponse(row) {
  return row?.response_json && typeof row.response_json === "object" ? row.response_json : null;
}

function recoverableReservation(row, context) {
  const signed = normalizeSignedPublication({
    rawTransaction: row.raw_transaction,
    txHash: row.tx_hash,
    signerAddress: row.signer_address,
    chainId: row.chain_id,
    nonce: row.nonce,
  });
  return {
    durable: true,
    replay: false,
    busy: false,
    recover: true,
    state: row.status,
    proofId: row.proof_id,
    leaseToken: context.leaseToken,
    payloadHash: row.payload_hash,
    ...signed,
  };
}

export function iotaPayloadHash(payload) {
  return `sha256:${createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex")}`;
}

export function iotaProcessingTtlSeconds(value = process.env.IOTA_IDEMPOTENCY_PROCESSING_TTL_SECONDS || "300") {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < 30 || seconds > 86_400) {
    throw new Error("iota_idempotency_processing_ttl_invalid");
  }
  return seconds;
}

export function classifyIotaReservation(row, context = {}) {
  if (!row) throw new Error("iota_idempotency_reservation_missing");
  if (Number(row.protocol_version) !== 2) throw new Error("iota_idempotency_protocol_mismatch");
  const requestId = normalizeRequestId(context.requestId ?? row.request_id);
  const payloadHash = String((context.payloadHash ?? row.payload_hash) || "").trim().toLowerCase();
  const leaseToken = normalizeLeaseToken(context.leaseToken ?? row.lease_token);
  if (!PAYLOAD_HASH_PATTERN.test(payloadHash)) throw new Error("iota_payload_hash_invalid");
  if (String(row.request_id || "") !== requestId) throw new Error("iota_request_id_conflict");
  if (String(row.payload_hash || "").toLowerCase() !== payloadHash) throw new Error("iota_payload_hash_conflict");

  const response = rowResponse(row);
  if ((row.status === "submitted" || row.status === "confirmed") && response) {
    return { durable: true, replay: true, busy: false, recover: false, state: row.status, response };
  }
  if (row.status === "confirmed") throw new Error("iota_idempotency_response_missing");
  if (row.status === "failed") {
    return {
      durable: true,
      replay: false,
      busy: false,
      recover: false,
      failed: true,
      state: "failed",
      errorCode: String(response?.reason || "iota_publish_failed"),
    };
  }
  if (context.acquired !== true) {
    return { durable: true, replay: false, busy: true, recover: false, state: row.status, proofId: row.proof_id };
  }
  if (row.status === "reserved") {
    return {
      durable: true,
      replay: false,
      busy: false,
      recover: false,
      state: "reserved",
      proofId: row.proof_id,
      leaseToken,
      payloadHash,
    };
  }
  if (RECOVERABLE_STATES.has(row.status)) return recoverableReservation(row, { leaseToken });
  throw new Error("iota_idempotency_state_invalid");
}

export async function reserveIotaPublish(input, options = {}) {
  const proofId = normalizeProofId(input?.proofId);
  const requestId = normalizeRequestId(input?.requestId);
  const payload = input?.payload;
  const payloadHash = iotaPayloadHash(payload);
  const leaseToken = normalizeLeaseToken(options.leaseToken || randomUUID());
  const processingTtlSeconds = iotaProcessingTtlSeconds(options.processingTtlSeconds);
  const db = options.database || getPool();
  if (!db) {
    if (String(process.env.NODE_ENV || "").toLowerCase() === "production") throw new Error("executor_database_required");
    return { durable: false, replay: false, busy: false, recover: false, state: "reserved", proofId, requestId, payloadHash, leaseToken };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(`
      INSERT INTO iota_executor_publications
        (proof_id, request_id, status, payload_json, protocol_version, payload_hash, lease_token, updated_at)
      VALUES ($1, $2, 'reserved', $3::jsonb, 2, $4, $5::uuid, now())
      ON CONFLICT (proof_id) DO NOTHING
      RETURNING proof_id, request_id, status, payload_hash, lease_token, protocol_version,
                raw_transaction, tx_hash, signer_address, chain_id, nonce, response_json`,
    [proofId, requestId, canonicalJson(payload), payloadHash, leaseToken]);

    if (inserted.rows[0]) {
      await client.query("COMMIT");
      return classifyIotaReservation(inserted.rows[0], { requestId, payloadHash, leaseToken, acquired: true });
    }

    const current = await client.query(`
      SELECT proof_id, request_id, status, payload_hash, lease_token, protocol_version,
             raw_transaction, tx_hash, signer_address, chain_id, nonce, response_json,
             updated_at <= now() - ($2::integer * interval '1 second') AS lease_expired
      FROM iota_executor_publications
      WHERE proof_id = $1
      FOR UPDATE`, [proofId, processingTtlSeconds]);
    const row = current.rows[0];
    if (!row) throw new Error("iota_idempotency_reservation_missing");

    // Validate immutable request identity before deciding whether any state can
    // be replayed or reclaimed. A proof ID never aliases another payload.
    classifyIotaReservation(row, {
      requestId,
      payloadHash,
      leaseToken: row.lease_token,
      acquired: false,
    });

    const response = rowResponse(row);
    if ((row.status === "submitted" || row.status === "confirmed") && response) {
      await client.query("COMMIT");
      return { durable: true, replay: true, busy: false, recover: false, state: row.status, response };
    }
    if (row.status === "confirmed") throw new Error("iota_idempotency_response_missing");
    if (row.status === "failed") {
      await client.query("COMMIT");
      return {
        durable: true,
        replay: false,
        busy: false,
        recover: false,
        failed: true,
        state: "failed",
        errorCode: String(response?.reason || "iota_publish_failed"),
      };
    }
    if (!new Set(["reserved", ...RECOVERABLE_STATES]).has(row.status)) throw new Error("iota_idempotency_state_invalid");
    if (row.lease_expired !== true) {
      await client.query("COMMIT");
      return { durable: true, replay: false, busy: true, recover: false, state: row.status, proofId };
    }

    const renewed = await client.query(`
      UPDATE iota_executor_publications
      SET lease_token = $2::uuid, updated_at = now()
      WHERE proof_id = $1
      RETURNING proof_id, request_id, status, payload_hash, lease_token, protocol_version,
                raw_transaction, tx_hash, signer_address, chain_id, nonce, response_json`,
    [proofId, leaseToken]);
    await client.query("COMMIT");
    return classifyIotaReservation(renewed.rows[0], { requestId, payloadHash, leaseToken, acquired: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function updatePublication(sql, params, options, errorCode = "iota_idempotency_lease_lost") {
  const db = options.database || getPool();
  if (!db) return null;
  const result = await db.query(sql, params);
  if (!result.rows?.[0]) throw new Error(errorCode);
  return result.rows[0];
}

export async function markIotaSigned(proofIdValue, leaseTokenValue, signedInput, options = {}) {
  const proofId = normalizeProofId(proofIdValue);
  const leaseToken = normalizeLeaseToken(leaseTokenValue);
  const signed = normalizeSignedPublication(signedInput);
  return updatePublication(`UPDATE iota_executor_publications
    SET status = 'signed', raw_transaction = $3, tx_hash = $4, signer_address = $5,
        chain_id = $6, nonce = $7, signed_at = COALESCE(signed_at, now()), updated_at = now()
    WHERE proof_id = $1 AND lease_token = $2::uuid AND protocol_version = 2 AND status = 'reserved'
    RETURNING proof_id, status, raw_transaction, tx_hash, signer_address, chain_id, nonce`,
  [proofId, leaseToken, signed.rawTransaction, signed.txHash, signed.signerAddress, signed.chainId, signed.nonce], options);
}

export async function markIotaBroadcast(proofIdValue, leaseTokenValue, txHashValue, options = {}) {
  const proofId = normalizeProofId(proofIdValue);
  const leaseToken = normalizeLeaseToken(leaseTokenValue);
  const txHash = String(txHashValue || "").trim().toLowerCase();
  if (!TX_HASH_PATTERN.test(txHash)) throw new Error("iota_tx_hash_invalid");
  return updatePublication(`UPDATE iota_executor_publications
    SET status = 'broadcast', broadcast_at = COALESCE(broadcast_at, now()), updated_at = now()
    WHERE proof_id = $1 AND lease_token = $2::uuid AND protocol_version = 2
      AND status IN ('signed', 'broadcast') AND lower(tx_hash) = lower($3)
    RETURNING proof_id, status, tx_hash`, [proofId, leaseToken, txHash], options);
}

export async function markIotaSubmitted(proofIdValue, leaseTokenValue, response, options = {}) {
  const proofId = normalizeProofId(proofIdValue);
  const leaseToken = normalizeLeaseToken(leaseTokenValue);
  const txHash = String(response?.tx_hash || "").trim().toLowerCase();
  if (!TX_HASH_PATTERN.test(txHash)) throw new Error("iota_tx_hash_invalid");
  return updatePublication(`UPDATE iota_executor_publications
    SET status = 'submitted', response_json = $4::jsonb,
        submitted_at = COALESCE(submitted_at, now()), updated_at = now()
    WHERE proof_id = $1 AND lease_token = $2::uuid AND protocol_version = 2
      AND status IN ('signed', 'broadcast', 'submitted') AND lower(tx_hash) = lower($3)
    RETURNING proof_id, status, response_json`,
  [proofId, leaseToken, txHash, canonicalJson(response)], options);
}

export async function markIotaConfirmed(proofIdValue, leaseTokenValue, response, options = {}) {
  const proofId = normalizeProofId(proofIdValue);
  const leaseToken = normalizeLeaseToken(leaseTokenValue);
  return updatePublication(`UPDATE iota_executor_publications
    SET status = 'confirmed', response_json = $3::jsonb, updated_at = now()
    WHERE proof_id = $1 AND lease_token = $2::uuid AND protocol_version = 2
      AND status IN ('reserved', 'signed', 'broadcast', 'submitted', 'confirmed')
    RETURNING proof_id, status, response_json`, [proofId, leaseToken, canonicalJson(response)], options);
}

export async function markIotaFailed(proofIdValue, leaseTokenValue, reasonValue, options = {}) {
  const proofId = normalizeProofId(proofIdValue);
  const leaseToken = normalizeLeaseToken(leaseTokenValue);
  const reason = String(reasonValue || "iota_publish_failed").trim();
  if (!/^[a-z0-9_]{3,120}$/i.test(reason)) throw new Error("iota_failure_reason_invalid");
  const response = { ok: false, state: "failed", reason };
  return updatePublication(`UPDATE iota_executor_publications
    SET status = 'failed', response_json = $3::jsonb, updated_at = now()
    WHERE proof_id = $1 AND lease_token = $2::uuid AND protocol_version = 2 AND status = 'reserved'
    RETURNING proof_id, status, response_json`, [proofId, leaseToken, canonicalJson(response)], options);
}

export async function closeIotaIdempotency() {
  if (pool) await pool.end();
  pool = undefined;
}
