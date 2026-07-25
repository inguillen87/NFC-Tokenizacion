import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyIotaReservation,
  iotaPayloadHash,
  iotaProcessingTtlSeconds,
  markIotaBroadcast,
  markIotaConfirmed,
  markIotaFailed,
  markIotaSigned,
  markIotaSubmitted,
  reserveIotaPublish,
} from "../src/iota-idempotency.mjs";

const proofId = `0x${"ab".repeat(32)}`;
const txHash = `0x${"cd".repeat(32)}`;
const signerAddress = `0x${"12".repeat(20)}`;
const leaseOne = "11111111-1111-4111-8111-111111111111";
const leaseTwo = "22222222-2222-4222-8222-222222222222";
const requestId = "request-1";
const payload = { proof_id: proofId, event_count: 7, nested: { b: 2, a: 1 } };
const payloadHash = iotaPayloadHash(payload);
const submittedResponse = { ok: true, state: "submitted", tx_hash: txHash, nonce: 9 };

function row(status, overrides = {}) {
  return {
    proof_id: proofId,
    request_id: requestId,
    status,
    payload_hash: payloadHash,
    lease_token: leaseOne,
    protocol_version: 2,
    raw_transaction: "0x1234",
    tx_hash: txHash,
    signer_address: signerAddress,
    chain_id: 1076,
    nonce: 9,
    response_json: null,
    lease_expired: false,
    ...overrides,
  };
}

function fakeDatabase({ inserted = [], current = [], renewed = [], updateRows = [{}] } = {}) {
  const statements = [];
  const client = {
    async query(sql, params) {
      const text = String(sql);
      statements.push({ sql: text, params });
      if (text.includes("INSERT INTO iota_executor_publications")) return { rows: inserted };
      if (text.includes("SELECT proof_id") && text.includes("FOR UPDATE")) return { rows: current };
      if (text.includes("SET lease_token = $2::uuid")) return { rows: renewed };
      return { rows: [] };
    },
    release() {},
  };
  return {
    statements,
    async connect() { return client; },
    async query(sql, params) {
      statements.push({ sql: String(sql), params });
      return { rows: updateRows };
    },
  };
}

test("payload hashing is canonical and changes when the immutable intent changes", () => {
  const reordered = { nested: { a: 1, b: 2 }, event_count: 7, proof_id: proofId };
  assert.equal(iotaPayloadHash(payload), iotaPayloadHash(reordered));
  assert.notEqual(iotaPayloadHash(payload), iotaPayloadHash({ ...payload, event_count: 8 }));
  assert.throws(() => iotaPayloadHash({ invalid: Number.NaN }), /iota_payload_invalid/);
});

test("a fresh protocol-v2 reservation starts at reserved with a lease and payload hash", async () => {
  const database = fakeDatabase({ inserted: [row("reserved")] });
  const result = await reserveIotaPublish(
    { proofId, requestId, payload },
    { database, leaseToken: leaseOne, processingTtlSeconds: 300 },
  );
  assert.deepEqual({ state: result.state, leaseToken: result.leaseToken, payloadHash: result.payloadHash }, {
    state: "reserved",
    leaseToken: leaseOne,
    payloadHash,
  });
  const insert = database.statements.find(({ sql }) => sql.includes("INSERT INTO iota_executor_publications"));
  assert.match(insert.sql, /VALUES \(\$1, \$2, 'reserved'/);
  assert.match(insert.sql, /protocol_version, payload_hash, lease_token/);
  assert.equal(insert.params[3], payloadHash);
  assert.equal(insert.params[4], leaseOne);
});

test("submitted and confirmed rows replay only the exact request and payload", async () => {
  for (const status of ["submitted", "confirmed"]) {
    const database = fakeDatabase({ current: [row(status, { response_json: submittedResponse })] });
    const result = await reserveIotaPublish(
      { proofId, requestId, payload },
      { database, leaseToken: leaseTwo, processingTtlSeconds: 300 },
    );
    assert.equal(result.replay, true);
    assert.equal(result.busy, false);
    assert.deepEqual(result.response, submittedResponse);
  }
});

test("request-id and payload-hash aliasing fail closed before replay or lease recovery", async () => {
  const requestConflict = fakeDatabase({
    current: [row("submitted", { request_id: "another-request", response_json: submittedResponse })],
  });
  await assert.rejects(() => reserveIotaPublish(
    { proofId, requestId, payload },
    { database: requestConflict, leaseToken: leaseTwo },
  ), /iota_request_id_conflict/);

  const payloadConflict = fakeDatabase({
    current: [row("submitted", { payload_hash: iotaPayloadHash({ different: true }), response_json: submittedResponse })],
  });
  await assert.rejects(() => reserveIotaPublish(
    { proofId, requestId, payload },
    { database: payloadConflict, leaseToken: leaseTwo },
  ), /iota_payload_hash_conflict/);
});

test("an active lease is busy; an expired signed lease returns the exact persisted transaction", async () => {
  const active = fakeDatabase({ current: [row("signed")] });
  const busy = await reserveIotaPublish(
    { proofId, requestId, payload },
    { database: active, leaseToken: leaseTwo },
  );
  assert.equal(busy.busy, true);
  assert.equal(busy.recover, false);

  const expired = fakeDatabase({
    current: [row("signed", { lease_expired: true })],
    renewed: [row("signed", { lease_token: leaseTwo })],
  });
  const recovered = await reserveIotaPublish(
    { proofId, requestId, payload },
    { database: expired, leaseToken: leaseTwo },
  );
  assert.equal(recovered.recover, true);
  assert.equal(recovered.state, "signed");
  assert.equal(recovered.rawTransaction, "0x1234");
  assert.equal(recovered.txHash, txHash);
  assert.equal(recovered.nonce, 9);
  assert.equal(recovered.leaseToken, leaseTwo);
  const leaseUpdate = expired.statements.find(({ sql }) => sql.includes("SET lease_token = $2::uuid"));
  assert.deepEqual(leaseUpdate.params, [proofId, leaseTwo]);
});

test("failed rows remain terminal and protocol-v1 rows are never silently upgraded", () => {
  const failed = classifyIotaReservation(row("failed", {
    response_json: { ok: false, state: "failed", reason: "iota_executor_proof_id_mismatch" },
  }), { acquired: false });
  assert.equal(failed.failed, true);
  assert.equal(failed.errorCode, "iota_executor_proof_id_mismatch");
  assert.throws(() => classifyIotaReservation({ ...row("reserved"), protocol_version: 1 }), /iota_idempotency_protocol_mismatch/);
});

test("processing lease TTL is bounded", () => {
  assert.equal(iotaProcessingTtlSeconds("300"), 300);
  assert.throws(() => iotaProcessingTtlSeconds("29"), /iota_idempotency_processing_ttl_invalid/);
  assert.throws(() => iotaProcessingTtlSeconds("86401"), /iota_idempotency_processing_ttl_invalid/);
  assert.throws(() => iotaProcessingTtlSeconds("5.5"), /iota_idempotency_processing_ttl_invalid/);
});

test("state markers use lease CAS and only allow monotonic protocol-v2 transitions", async () => {
  const database = fakeDatabase();
  await markIotaSigned(proofId, leaseOne, {
    rawTransaction: "0x1234",
    txHash,
    signerAddress,
    chainId: 1076,
    nonce: 9,
  }, { database });
  await markIotaBroadcast(proofId, leaseOne, txHash, { database });
  await markIotaSubmitted(proofId, leaseOne, submittedResponse, { database });
  await markIotaConfirmed(proofId, leaseOne, { ...submittedResponse, state: "confirmed" }, { database });
  await markIotaFailed(proofId, leaseOne, "iota_executor_proof_id_mismatch", { database });

  const updates = database.statements.filter(({ sql }) => sql.includes("UPDATE iota_executor_publications"));
  assert.equal(updates.length, 5);
  for (const update of updates) {
    assert.match(update.sql, /lease_token = \$2::uuid/);
    assert.match(update.sql, /protocol_version = 2/);
  }
  assert.match(updates[0].sql, /status = 'reserved'/);
  assert.match(updates[0].sql, /raw_transaction = \$3/);
  assert.match(updates[1].sql, /status IN \('signed', 'broadcast'\)/);
  assert.match(updates[2].sql, /status IN \('signed', 'broadcast', 'submitted'\)/);
  assert.match(updates[3].sql, /status IN \('reserved', 'signed', 'broadcast', 'submitted', 'confirmed'\)/);
  assert.match(updates[4].sql, /status = 'reserved'/);
});

test("a lost lease rejects every state transition", async () => {
  const database = fakeDatabase({ updateRows: [] });
  await assert.rejects(() => markIotaBroadcast(proofId, leaseOne, txHash, { database }), /iota_idempotency_lease_lost/);
});
