import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Interface } from "ethers";
import {
  IotaCanaryError,
  assertExactReplay,
  assertSingleDurablePublication,
  buildPublicCanaryResult,
  buildSyntheticEvidence,
  runIotaStagingCanary,
  validateCanaryEnvironment,
} from "../iota-staging-live-canary.mjs";

const proofId = `0x${"ab".repeat(32)}`;
const txHash = `0x${"cd".repeat(32)}`;
const publisher = `0x${"12".repeat(20)}`;

test("live canary accepts credentials only from environment-shaped input and enforces secure endpoints", () => {
  const config = validateCanaryEnvironment({
    SERVICE_URL: "https://executor.example.test",
    IOTA_PROOF_EXECUTOR_SECRET: "test-only-secret-that-is-long-enough",
    DATABASE_URL: "postgresql://canary:password@db.example.test/nexid?sslmode=require",
  });
  assert.equal(config.serviceOrigin, "https://executor.example.test");
  assert.equal(config.expectedChainId, 1076);
  assert.equal(config.rpcUrl, "https://json-rpc.evm.testnet.iota.cafe/");
  assert.throws(
    () => validateCanaryEnvironment({
      SERVICE_URL: "http://executor.example.test",
      IOTA_PROOF_EXECUTOR_SECRET: "test-only-secret-that-is-long-enough",
      DATABASE_URL: "postgresql://canary:password@db.example.test/nexid",
    }),
    (error) => error instanceof IotaCanaryError && error.code === "SERVICE_URL_INVALID",
  );
  assert.throws(
    () => validateCanaryEnvironment({
      SERVICE_URL: "https://executor.example.test/path",
      IOTA_PROOF_EXECUTOR_SECRET: "test-only-secret-that-is-long-enough",
      DATABASE_URL: "postgresql://canary:password@db.example.test/nexid",
    }),
    /SERVICE_URL_MUST_BE_ORIGIN/,
  );
});

test("synthetic evidence is deterministic, canonical, and explicitly non-customer", () => {
  const evidence = buildSyntheticEvidence("11111111-2222-4333-8444-555555555555");
  assert.equal(evidence.requestId, "iota-canary:11111111-2222-4333-8444-555555555555");
  assert.equal(evidence.resourceType, "system_canary");
  assert.match(evidence.publicResourceId, /^nexid-canary-/);
  assert.match(evidence.merkleRoot, /^0x[0-9a-f]{64}$/);
  assert.match(evidence.tenantIdHash, /^0x[0-9a-f]{64}$/);
  assert.match(evidence.memoHash, /^0x[0-9a-f]{64}$/);
  assert.deepEqual(evidence, buildSyntheticEvidence("11111111-2222-4333-8444-555555555555"));
});

test("replay must return the exact same durable transaction response", () => {
  const body = {
    ok: true,
    state: "submitted",
    already_anchored: false,
    proof_id: proofId,
    request_id: "iota-canary:test-run",
    tx_hash: txHash,
    nonce: 7,
  };
  assert.equal(assertExactReplay({ status: 202, body }, { status: 202, body: { ...body } }), true);
  assert.throws(
    () => assertExactReplay(
      { status: 202, body },
      { status: 202, body: { ...body, tx_hash: `0x${"ef".repeat(32)}` } },
    ),
    /IOTA_CANARY_REPLAY_RESPONSE_CHANGED/,
  );
  assert.throws(
    () => assertExactReplay(
      { status: 202, body },
      { status: 202, body: { ...body, nonce: 8 } },
    ),
    /IOTA_CANARY_REPLAY_RESPONSE_CHANGED/,
  );
});

test("durable evidence must resolve to one protocol-v2 row with the same hash and nonce", () => {
  const expected = {
    proofId,
    requestId: "iota-canary:test-run",
    txHash,
    nonce: 7,
    chainId: 1076,
    publisher,
  };
  const row = {
    proof_id: proofId,
    request_id: expected.requestId,
    status: "submitted",
    protocol_version: 2,
    tx_hash: txHash,
    nonce: "7",
    chain_id: "1076",
    signer_address: publisher,
    response_json: { tx_hash: txHash },
    signed_at: new Date(),
    broadcast_at: new Date(),
    submitted_at: new Date(),
  };
  assert.equal(assertSingleDurablePublication([row], expected), row);
  assert.throws(() => assertSingleDurablePublication([row, row], expected), /CARDINALITY_MISMATCH/);
  assert.throws(
    () => assertSingleDurablePublication([{ ...row, tx_hash: `0x${"ef".repeat(32)}` }], expected),
    /TX_HASH_MISMATCH/,
  );
});

test("public result is allowlisted and cannot serialize service or database credentials", () => {
  const result = buildPublicCanaryResult({
    chainId: 1076,
    contractAddress: `0x${"34".repeat(20)}`,
    publisher,
    requestId: "iota-canary:test-run",
    proofId,
    txHash,
    nonce: 7,
    blockNumber: 99,
    durableStatus: "submitted",
  });
  const serialized = JSON.stringify(result);
  assert.equal(result.synthetic_non_customer_evidence, true);
  assert.equal(Object.values(result.checks).every(Boolean), true);
  assert.doesNotMatch(serialized, /test-only-secret|postgresql:\/\//);
  assert.deepEqual(Object.keys(result).sort(), [
    "block_number",
    "chain_id",
    "checks",
    "contract_address",
    "durable_status",
    "gate",
    "nonce",
    "ok",
    "proof_id",
    "publisher_address",
    "request_id",
    "synthetic_non_customer_evidence",
    "tx_hash",
  ]);
});

test("orchestration submits and replays identical bytes, then proves receipt, storage, row, and one nonce", async () => {
  const runId = "11111111-2222-4333-8444-555555555555";
  const evidence = buildSyntheticEvidence(runId);
  const contractAddress = `0x${"34".repeat(20)}`;
  const eventInterface = new Interface([
    "event EvidenceAnchored(bytes32 indexed proofId, bytes32 indexed merkleRoot, bytes32 indexed tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash, address publisher, uint64 anchoredAt, uint16 schemaVersion)",
  ]);
  const encodedEvent = eventInterface.encodeEventLog(eventInterface.getEvent("EvidenceAnchored"), [
    proofId,
    evidence.merkleRoot,
    evidence.tenantIdHash,
    evidence.resourceType,
    evidence.publicResourceId,
    evidence.eventCount,
    evidence.memoHash,
    publisher,
    123,
    2,
  ]);
  let confirmed = false;
  const provider = {
    async getNetwork() { return { chainId: 1076n }; },
    async getCode() { return "0x6001"; },
    async getTransactionCount() { return confirmed ? 6 : 5; },
    async waitForTransaction() {
      confirmed = true;
      return {
        status: 1,
        hash: txHash,
        blockNumber: 99,
        logs: [{ address: contractAddress, ...encodedEvent }],
      };
    },
    async getTransaction() {
      return { hash: txHash, nonce: 5, from: publisher, to: contractAddress };
    },
  };
  let anchoredReads = 0;
  const contract = {
    async SCHEMA_VERSION() { return 2n; },
    async authorizedPublishers() { return true; },
    async computeProofId() { return proofId; },
    async isAnchored() { anchoredReads += 1; return anchoredReads > 1; },
    async evidenceRecord() {
      return {
        merkleRoot: evidence.merkleRoot,
        tenantIdHash: evidence.tenantIdHash,
        memoHash: evidence.memoHash,
        publisher,
        eventCount: 1n,
        anchoredAt: 123n,
      };
    },
  };
  let databaseReads = 0;
  const database = {
    async query() {
      databaseReads += 1;
      if (databaseReads === 1) return { rows: [] };
      return { rows: [{
        proof_id: proofId,
        request_id: evidence.requestId,
        status: "submitted",
        protocol_version: 2,
        tx_hash: txHash,
        nonce: "5",
        chain_id: "1076",
        signer_address: publisher,
        response_json: { tx_hash: txHash },
        signed_at: new Date(),
        broadcast_at: new Date(),
        submitted_at: new Date(),
      }] };
    },
  };
  const submittedBody = {
    ok: true,
    state: "submitted",
    already_anchored: false,
    proof_id: proofId,
    request_id: evidence.requestId,
    tx_hash: txHash,
    nonce: 5,
  };
  const postBodies = [];
  const fetchImpl = async (url, options) => {
    if (url.endsWith("/health")) {
      return new Response(JSON.stringify({
        ok: true,
        iotaEvidenceV2: { contractAddress, publisherAddress: publisher },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/ready")) {
      return new Response(JSON.stringify({ ok: true, chains: { iota: { ok: true } } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    postBodies.push(options.body);
    return new Response(JSON.stringify(submittedBody), {
      status: 202,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await runIotaStagingCanary({
    environment: {
      SERVICE_URL: "https://executor.example.test",
      IOTA_PROOF_EXECUTOR_SECRET: "test-only-secret-that-is-long-enough",
      DATABASE_URL: "postgresql://canary:password@db.example.test/nexid",
    },
    fetchImpl,
    provider,
    contract,
    database,
    runId,
  });

  assert.equal(postBodies.length, 2);
  assert.equal(postBodies[0], postBodies[1]);
  assert.equal(result.ok, true);
  assert.equal(result.tx_hash, txHash);
  assert.equal(result.nonce, 5);
  assert.equal(result.block_number, 99);
  assert.equal(databaseReads, 2);
  assert.equal(anchoredReads, 2);
});

test("direct execution rejects CLI arguments and emits only allowlisted error codes", async () => {
  const source = await readFile(new URL("../iota-staging-live-canary.mjs", import.meta.url), "utf8");
  assert.match(source, /process\.argv\.length !== 2/);
  assert.match(source, /CLI_ARGUMENTS_FORBIDDEN/);
  assert.match(source, /error instanceof IotaCanaryError \? error\.code : "IOTA_CANARY_UNEXPECTED_FAILURE"/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:executorSecret|databaseUrl|config)/);
});
