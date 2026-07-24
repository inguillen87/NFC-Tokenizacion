import pg from "pg";

const { Pool } = pg;
let pool;

function databaseUrl() {
  return String(process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

function getPool() {
  if (!databaseUrl()) return null;
  if (!pool) pool = new Pool({ connectionString: databaseUrl(), max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 3_000 });
  return pool;
}

export function iotaProcessingTtlSeconds(value = process.env.IOTA_IDEMPOTENCY_PROCESSING_TTL_SECONDS || "300") {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < 30 || seconds > 86_400) {
    throw new Error("iota_idempotency_processing_ttl_invalid");
  }
  return seconds;
}

export function classifyIotaReservation(row, acquired = false) {
  if (!row) throw new Error("iota_idempotency_reservation_missing");
  if (acquired) {
    return { durable: true, replay: false, busy: false, state: row.status, proofId: row.proof_id };
  }
  if ((row.status === "submitted" || row.status === "confirmed") && row.response_json) {
    return { durable: true, replay: true, busy: false, state: row.status, response: row.response_json };
  }
  return { durable: true, replay: false, busy: true, state: row.status, proofId: row.proof_id };
}

export async function reserveIotaPublish(input, options = {}) {
  const db = options.database || getPool();
  if (!db) {
    if (String(process.env.NODE_ENV || "").toLowerCase() === "production") throw new Error("executor_database_required");
    return { durable: false, state: "untracked" };
  }
  const processingTtlSeconds = iotaProcessingTtlSeconds(options.processingTtlSeconds);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const acquired = await client.query(`
      INSERT INTO iota_executor_publications
        (proof_id, request_id, status, payload_json, updated_at)
      VALUES ($1, $2, 'processing', $3::jsonb, now())
      ON CONFLICT (proof_id) DO UPDATE
        SET request_id = EXCLUDED.request_id,
            payload_json = EXCLUDED.payload_json,
            updated_at = now()
        WHERE iota_executor_publications.status = 'processing'
          AND iota_executor_publications.updated_at < now() - ($4::integer * interval '1 second')
      RETURNING proof_id, request_id, status, tx_hash, nonce, block_number, block_hash, response_json`,
    [input.proofId, input.requestId || null, JSON.stringify(input.payload), processingTtlSeconds]);

    let row = acquired.rows[0];
    let didAcquire = Boolean(row);
    if (!row) {
      const current = await client.query(`
        SELECT proof_id, request_id, status, tx_hash, nonce, block_number, block_hash, response_json
        FROM iota_executor_publications
        WHERE proof_id = $1`, [input.proofId]);
      row = current.rows[0];
    }
    await client.query("COMMIT");
    return classifyIotaReservation(row, didAcquire);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function markIotaSubmitted(proofId, response, options = {}) {
  const db = options.database || getPool();
  if (!db) return;
  await db.query(`UPDATE iota_executor_publications
    SET status = 'submitted', tx_hash = $2, nonce = $3, block_number = $4, block_hash = $5,
        response_json = $6::jsonb, updated_at = now()
    WHERE proof_id = $1 AND status = 'processing'`, [proofId, response.tx_hash, response.nonce ?? null, response.block_number ?? null,
    response.block_hash ?? null, JSON.stringify(response)]);
}

export async function closeIotaIdempotency() {
  if (pool) await pool.end();
  pool = undefined;
}
