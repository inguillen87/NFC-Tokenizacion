import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyIotaReservation,
  iotaProcessingTtlSeconds,
  markIotaSubmitted,
  reserveIotaPublish,
} from "../src/iota-idempotency.mjs";

function fakeDatabase({ acquired = [], current = [] } = {}) {
  const statements = [];
  const client = {
    async query(sql, params) {
      statements.push({ sql: String(sql), params });
      if (String(sql).includes("INSERT INTO iota_executor_publications")) return { rows: acquired };
      if (String(sql).includes("FROM iota_executor_publications")) return { rows: current };
      return { rows: [] };
    },
    release() {},
  };
  return {
    statements,
    async connect() { return client; },
    async query(sql, params) {
      statements.push({ sql: String(sql), params });
      return { rows: [] };
    },
  };
}

const proofId = `0x${"ab".repeat(32)}`;
const response = { ok: true, state: "submitted", tx_hash: `0x${"cd".repeat(32)}` };

test("submitted and confirmed reservations replay without being acquired again", async () => {
  for (const status of ["submitted", "confirmed"]) {
    const database = fakeDatabase({ current: [{ proof_id: proofId, status, response_json: response }] });
    const result = await reserveIotaPublish(
      { proofId, requestId: "request-1", payload: { proof_id: proofId } },
      { database, processingTtlSeconds: 300 },
    );
    assert.equal(result.replay, true);
    assert.equal(result.busy, false);
    assert.deepEqual(result.response, response);
    const upsert = database.statements.find(({ sql }) => sql.includes("INSERT INTO iota_executor_publications"));
    assert.match(upsert.sql, /WHERE iota_executor_publications\.status = 'processing'/);
    assert.doesNotMatch(upsert.sql, /SET\s+status\s*=/);
  }
});

test("a concurrent processing reservation is busy, while an atomically reclaimed stale lease is acquired", async () => {
  const concurrent = fakeDatabase({ current: [{ proof_id: proofId, status: "processing", response_json: null }] });
  const busy = await reserveIotaPublish(
    { proofId, requestId: "request-2", payload: {} },
    { database: concurrent, processingTtlSeconds: 300 },
  );
  assert.equal(busy.busy, true);
  assert.equal(busy.replay, false);
  assert.equal(busy.state, "processing");

  const stale = fakeDatabase({ acquired: [{ proof_id: proofId, status: "processing", response_json: null }] });
  const reclaimed = await reserveIotaPublish(
    { proofId, requestId: "request-3", payload: {} },
    { database: stale, processingTtlSeconds: 600 },
  );
  assert.equal(reclaimed.busy, false);
  assert.equal(reclaimed.replay, false);
  const upsert = stale.statements.find(({ sql }) => sql.includes("INSERT INTO iota_executor_publications"));
  assert.equal(upsert.params[3], 600);
  assert.match(upsert.sql, /updated_at < now\(\) - \(\$4::integer \* interval '1 second'\)/);
});

test("terminal rows without a durable response fail closed and cannot be reclaimed", () => {
  for (const status of ["submitted", "confirmed", "failed"]) {
    const result = classifyIotaReservation({ proof_id: proofId, status, response_json: null }, false);
    assert.equal(result.busy, true);
    assert.equal(result.replay, false);
  }
});

test("processing lease TTL is bounded", () => {
  assert.equal(iotaProcessingTtlSeconds("300"), 300);
  assert.throws(() => iotaProcessingTtlSeconds("29"), /iota_idempotency_processing_ttl_invalid/);
  assert.throws(() => iotaProcessingTtlSeconds("86401"), /iota_idempotency_processing_ttl_invalid/);
  assert.throws(() => iotaProcessingTtlSeconds("5.5"), /iota_idempotency_processing_ttl_invalid/);
});

test("submitted marker is monotonic and only advances processing rows", async () => {
  const database = fakeDatabase();
  await markIotaSubmitted(proofId, { ...response, nonce: 4 }, { database });
  const update = database.statements.find(({ sql }) => sql.includes("UPDATE iota_executor_publications"));
  assert.match(update.sql, /WHERE proof_id = \$1 AND status = 'processing'/);
  assert.doesNotMatch(update.sql, /status = 'confirmed'/);
});
