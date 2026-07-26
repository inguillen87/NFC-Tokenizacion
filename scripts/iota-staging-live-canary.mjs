#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  Contract,
  Interface,
  JsonRpcProvider,
  getAddress,
  isAddress,
} from "ethers";
import pg from "pg";

const { Client } = pg;
const DEFAULT_RPC_URL = "https://json-rpc.evm.testnet.iota.cafe";
const DEFAULT_CHAIN_ID = 1076;
const DEFAULT_HTTP_TIMEOUT_MS = 20_000;
const DEFAULT_RECEIPT_TIMEOUT_MS = 180_000;
const TX_HASH_PATTERN = /^0x[0-9a-f]{64}$/;
const PROOF_ID_PATTERN = /^0x[0-9a-f]{64}$/;

const IOTA_EVIDENCE_ABI = [
  "function SCHEMA_VERSION() view returns (uint16)",
  "function authorizedPublishers(address publisher) view returns (bool)",
  "function computeProofId(bytes32 merkleRoot, bytes32 tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash) view returns (bytes32)",
  "function isAnchored(bytes32 proofId) view returns (bool)",
  "function evidenceRecord(bytes32 proofId) view returns (bytes32 merkleRoot, bytes32 tenantIdHash, bytes32 memoHash, address publisher, uint64 eventCount, uint64 anchoredAt)",
  "event EvidenceAnchored(bytes32 indexed proofId, bytes32 indexed merkleRoot, bytes32 indexed tenantIdHash, string resourceType, string resourceId, uint64 eventCount, bytes32 memoHash, address publisher, uint64 anchoredAt, uint16 schemaVersion)",
];

export class IotaCanaryError extends Error {
  constructor(code) {
    super(code);
    this.name = "IotaCanaryError";
    this.code = code;
  }
}

function fail(code) {
  throw new IotaCanaryError(code);
}

function requiredEnvironment(source, name) {
  const value = String(source[name] || "").trim();
  if (!value) fail(`${name}_REQUIRED`);
  return value;
}

function boundedInteger(value, fallback, minimum, maximum, code) {
  const parsed = Number(value || fallback);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) fail(code);
  return parsed;
}

function secureHttpUrl(value, code) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(code);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) fail(code);
  return url;
}

function databaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("DATABASE_URL_INVALID");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol) || !url.hostname || !url.pathname) {
    fail("DATABASE_URL_INVALID");
  }
  return value;
}

export function validateCanaryEnvironment(source = process.env) {
  const serviceUrl = secureHttpUrl(requiredEnvironment(source, "SERVICE_URL"), "SERVICE_URL_INVALID");
  if (serviceUrl.pathname !== "/" || serviceUrl.search) fail("SERVICE_URL_MUST_BE_ORIGIN");

  const executorSecret = requiredEnvironment(source, "IOTA_PROOF_EXECUTOR_SECRET");
  if (Buffer.byteLength(executorSecret, "utf8") < 24) fail("IOTA_PROOF_EXECUTOR_SECRET_TOO_SHORT");

  const rpcUrl = secureHttpUrl(
    String(source.IOTA_EVM_RPC_URL || DEFAULT_RPC_URL).trim(),
    "IOTA_EVM_RPC_URL_INVALID",
  );
  const expectedChainId = boundedInteger(
    source.IOTA_EVM_EXPECTED_CHAIN_ID,
    DEFAULT_CHAIN_ID,
    1,
    Number.MAX_SAFE_INTEGER,
    "IOTA_EVM_EXPECTED_CHAIN_ID_INVALID",
  );
  const configuredContract = String(source.IOTA_EVM_ANCHOR_CONTRACT_V2 || "").trim();
  if (configuredContract && !isAddress(configuredContract)) fail("IOTA_EVM_ANCHOR_CONTRACT_V2_INVALID");

  return {
    serviceOrigin: serviceUrl.origin,
    executorSecret,
    databaseUrl: databaseUrl(requiredEnvironment(source, "DATABASE_URL")),
    rpcUrl: rpcUrl.href,
    expectedChainId,
    configuredContract: configuredContract ? getAddress(configuredContract) : null,
    httpTimeoutMs: boundedInteger(
      source.IOTA_CANARY_HTTP_TIMEOUT_MS,
      DEFAULT_HTTP_TIMEOUT_MS,
      1_000,
      120_000,
      "IOTA_CANARY_HTTP_TIMEOUT_MS_INVALID",
    ),
    receiptTimeoutMs: boundedInteger(
      source.IOTA_CANARY_RECEIPT_TIMEOUT_MS,
      DEFAULT_RECEIPT_TIMEOUT_MS,
      10_000,
      600_000,
      "IOTA_CANARY_RECEIPT_TIMEOUT_MS_INVALID",
    ),
  };
}

function sha256Bytes32(value) {
  return `0x${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function buildSyntheticEvidence(runId = randomUUID()) {
  const normalizedRunId = String(runId || "").trim().toLowerCase();
  if (!/^[a-z0-9-]{8,80}$/.test(normalizedRunId)) fail("IOTA_CANARY_RUN_ID_INVALID");
  const domain = `nexid.staging.iota.canary.v2:${normalizedRunId}`;
  return {
    requestId: `iota-canary:${normalizedRunId}`,
    merkleRoot: sha256Bytes32(`${domain}:synthetic-merkle-root`),
    tenantIdHash: sha256Bytes32("nexid.staging.synthetic-canary-tenant"),
    resourceType: "system_canary",
    publicResourceId: `nexid-canary-${normalizedRunId}`,
    eventCount: 1,
    memoHash: sha256Bytes32(`${domain}:non-customer-evidence`),
  };
}

function sameAddress(left, right) {
  try {
    return getAddress(String(left || "")) === getAddress(String(right || ""));
  } catch {
    return false;
  }
}

function sameBytes32(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

async function fetchJson(fetchImpl, url, options, timeoutMs, errorPrefix) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    fail(`${errorPrefix}_UNAVAILABLE`);
  }
  let body;
  try {
    body = await response.json();
  } catch {
    fail(`${errorPrefix}_INVALID_JSON`);
  }
  return { status: response.status, body };
}

function assertSubmittedResponse(response, expected) {
  if (response.status !== 202 || response.body?.ok !== true || response.body?.state !== "submitted") {
    fail("IOTA_CANARY_EXECUTOR_SUBMIT_FAILED");
  }
  if (response.body.already_anchored !== false) fail("IOTA_CANARY_NOT_A_FRESH_ANCHOR");
  if (!sameBytes32(response.body.proof_id, expected.proofId)) fail("IOTA_CANARY_RESPONSE_PROOF_ID_MISMATCH");
  if (response.body.request_id !== expected.requestId) fail("IOTA_CANARY_RESPONSE_REQUEST_ID_MISMATCH");
  const txHash = String(response.body.tx_hash || "").toLowerCase();
  if (!TX_HASH_PATTERN.test(txHash)) fail("IOTA_CANARY_RESPONSE_TX_HASH_INVALID");
  const nonce = Number(response.body.nonce);
  if (!Number.isSafeInteger(nonce) || nonce < 0) fail("IOTA_CANARY_RESPONSE_NONCE_INVALID");
  return { txHash, nonce };
}

export function assertExactReplay(first, replay) {
  if (replay.status !== 202 || replay.body?.ok !== true || replay.body?.state !== "submitted") {
    fail("IOTA_CANARY_REPLAY_FAILED");
  }
  if (canonicalJson(first.body) !== canonicalJson(replay.body)) fail("IOTA_CANARY_REPLAY_RESPONSE_CHANGED");
  if (String(first.body?.tx_hash || "").toLowerCase() !== String(replay.body?.tx_hash || "").toLowerCase()) {
    fail("IOTA_CANARY_REPLAY_TX_HASH_CHANGED");
  }
  if (Number(first.body?.nonce) !== Number(replay.body?.nonce)) fail("IOTA_CANARY_REPLAY_NONCE_CHANGED");
  return true;
}

async function publicationRows(database, expected, txHash = null, nonce = null, publisher = null, chainId = null) {
  if (!txHash) {
    const result = await database.query(`
      SELECT proof_id, request_id, status, protocol_version, tx_hash, nonce, chain_id,
             signer_address, response_json, signed_at, broadcast_at, submitted_at
      FROM iota_executor_publications
      WHERE lower(proof_id) = lower($1) OR request_id = $2`,
    [expected.proofId, expected.requestId]);
    return result.rows;
  }
  const result = await database.query(`
    SELECT proof_id, request_id, status, protocol_version, tx_hash, nonce, chain_id,
           signer_address, response_json, signed_at, broadcast_at, submitted_at
    FROM iota_executor_publications
    WHERE lower(proof_id) = lower($1)
       OR request_id = $2
       OR lower(tx_hash) = lower($3)
       OR (chain_id = $4 AND lower(signer_address) = lower($5) AND nonce = $6)`,
  [expected.proofId, expected.requestId, txHash, chainId, publisher, nonce]);
  return result.rows;
}

export function assertSingleDurablePublication(rows, expected) {
  if (!Array.isArray(rows) || rows.length !== 1) fail("IOTA_CANARY_DURABLE_ROW_CARDINALITY_MISMATCH");
  const row = rows[0];
  if (!sameBytes32(row.proof_id, expected.proofId) || row.request_id !== expected.requestId) {
    fail("IOTA_CANARY_DURABLE_IDENTITY_MISMATCH");
  }
  if (Number(row.protocol_version) !== 2 || !new Set(["submitted", "confirmed"]).has(row.status)) {
    fail("IOTA_CANARY_DURABLE_STATE_INVALID");
  }
  if (String(row.tx_hash || "").toLowerCase() !== expected.txHash) fail("IOTA_CANARY_DURABLE_TX_HASH_MISMATCH");
  if (Number(row.nonce) !== expected.nonce) fail("IOTA_CANARY_DURABLE_NONCE_MISMATCH");
  if (Number(row.chain_id) !== expected.chainId) fail("IOTA_CANARY_DURABLE_CHAIN_ID_MISMATCH");
  if (!sameAddress(row.signer_address, expected.publisher)) fail("IOTA_CANARY_DURABLE_SIGNER_MISMATCH");
  if (String(row.response_json?.tx_hash || "").toLowerCase() !== expected.txHash) {
    fail("IOTA_CANARY_DURABLE_RESPONSE_MISMATCH");
  }
  if (!row.signed_at || !row.broadcast_at || !row.submitted_at) fail("IOTA_CANARY_DURABLE_TIMESTAMPS_MISSING");
  return row;
}

function assertEvidenceRecord(record, expected) {
  if (!sameBytes32(record.merkleRoot ?? record[0], expected.merkleRoot)
      || !sameBytes32(record.tenantIdHash ?? record[1], expected.tenantIdHash)
      || !sameBytes32(record.memoHash ?? record[2], expected.memoHash)
      || !sameAddress(record.publisher ?? record[3], expected.publisher)
      || Number(record.eventCount ?? record[4]) !== expected.eventCount
      || Number(record.anchoredAt ?? record[5]) <= 0) {
    fail("IOTA_CANARY_ON_CHAIN_STORAGE_MISMATCH");
  }
}

function assertEvidenceEvent(receipt, contractAddress, expected) {
  const contractInterface = new Interface(IOTA_EVIDENCE_ABI);
  const matches = [];
  for (const log of receipt.logs || []) {
    if (!sameAddress(log.address, contractAddress)) continue;
    try {
      const parsed = contractInterface.parseLog(log);
      if (parsed?.name === "EvidenceAnchored" && sameBytes32(parsed.args.proofId, expected.proofId)) {
        matches.push(parsed.args);
      }
    } catch {}
  }
  if (matches.length !== 1) fail("IOTA_CANARY_EVIDENCE_EVENT_CARDINALITY_MISMATCH");
  const event = matches[0];
  if (!sameBytes32(event.merkleRoot, expected.merkleRoot)
      || !sameBytes32(event.tenantIdHash, expected.tenantIdHash)
      || event.resourceType !== expected.resourceType
      || event.resourceId !== expected.publicResourceId
      || Number(event.eventCount) !== expected.eventCount
      || !sameBytes32(event.memoHash, expected.memoHash)
      || !sameAddress(event.publisher, expected.publisher)
      || Number(event.anchoredAt) <= 0
      || Number(event.schemaVersion) !== 2) {
    fail("IOTA_CANARY_EVIDENCE_EVENT_MISMATCH");
  }
}

async function waitForExactNonceAdvance(provider, publisher, initialNonce, timeoutMs) {
  const expected = initialNonce + 1;
  const deadline = Date.now() + Math.min(timeoutMs, 30_000);
  do {
    const [latest, pending] = await Promise.all([
      provider.getTransactionCount(publisher, "latest"),
      provider.getTransactionCount(publisher, "pending"),
    ]);
    if (latest > expected || pending > expected) fail("IOTA_CANARY_PUBLISHER_NONCE_ADVANCED_MORE_THAN_ONCE");
    if (latest === expected && pending === expected) return expected;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  } while (Date.now() < deadline);
  fail("IOTA_CANARY_PUBLISHER_NONCE_NOT_SETTLED");
}

export function buildPublicCanaryResult(input) {
  return {
    ok: true,
    gate: "iota_staging_live_canary",
    synthetic_non_customer_evidence: true,
    chain_id: input.chainId,
    contract_address: input.contractAddress,
    publisher_address: input.publisher,
    request_id: input.requestId,
    proof_id: input.proofId,
    tx_hash: input.txHash,
    nonce: input.nonce,
    block_number: input.blockNumber,
    durable_status: input.durableStatus,
    checks: {
      executor_ready: true,
      contract_proof_id_read: true,
      fresh_anchor_submitted: true,
      exact_request_replayed: true,
      replay_returned_same_transaction: true,
      receipt_succeeded: true,
      evidence_event_exactly_once: true,
      on_chain_storage_matches: true,
      durable_publication_exactly_once: true,
      publisher_nonce_advanced_exactly_once: true,
    },
  };
}

export async function runIotaStagingCanary(options = {}) {
  const config = validateCanaryEnvironment(options.environment || process.env);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") fail("IOTA_CANARY_FETCH_UNAVAILABLE");

  const provider = options.provider || new JsonRpcProvider(
    config.rpcUrl,
    config.expectedChainId,
    { batchMaxCount: 1 },
  );
  const database = options.database || new Client({
    connectionString: config.databaseUrl,
    application_name: "nexid-iota-staging-live-canary",
    statement_timeout: 10_000,
    query_timeout: 12_000,
  });
  const ownsProvider = !options.provider;
  const ownsDatabase = !options.database;

  try {
    if (ownsDatabase) {
      try {
        await database.connect();
      } catch {
        fail("IOTA_CANARY_DATABASE_UNAVAILABLE");
      }
    }

    const health = await fetchJson(
      fetchImpl,
      `${config.serviceOrigin}/health`,
      { method: "GET", headers: { accept: "application/json" } },
      config.httpTimeoutMs,
      "IOTA_CANARY_HEALTH",
    );
    if (health.status !== 200 || health.body?.ok !== true) fail("IOTA_CANARY_HEALTH_NOT_OK");

    const ready = await fetchJson(
      fetchImpl,
      `${config.serviceOrigin}/ready`,
      { method: "GET", headers: { accept: "application/json" } },
      config.httpTimeoutMs,
      "IOTA_CANARY_READINESS",
    );
    if (ready.status !== 200 || ready.body?.ok !== true || ready.body?.chains?.iota?.ok !== true) {
      fail("IOTA_CANARY_EXECUTOR_NOT_READY");
    }

    const healthContract = String(health.body?.iotaEvidenceV2?.contractAddress || "").trim();
    const publisher = String(health.body?.iotaEvidenceV2?.publisherAddress || "").trim();
    if (!isAddress(healthContract)) fail("IOTA_CANARY_HEALTH_CONTRACT_INVALID");
    if (!isAddress(publisher)) fail("IOTA_CANARY_HEALTH_PUBLISHER_INVALID");
    const contractAddress = getAddress(healthContract);
    const publisherAddress = getAddress(publisher);
    if (config.configuredContract && !sameAddress(config.configuredContract, contractAddress)) {
      fail("IOTA_CANARY_CONTRACT_CONFIGURATION_MISMATCH");
    }

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    if (chainId !== config.expectedChainId) fail("IOTA_CANARY_CHAIN_ID_MISMATCH");
    const code = await provider.getCode(contractAddress);
    if (!code || code === "0x") fail("IOTA_CANARY_CONTRACT_NOT_DEPLOYED");

    const contract = options.contract || new Contract(contractAddress, IOTA_EVIDENCE_ABI, provider);
    if (Number(await contract.SCHEMA_VERSION()) !== 2) fail("IOTA_CANARY_CONTRACT_SCHEMA_MISMATCH");
    if (!await contract.authorizedPublishers(publisherAddress)) fail("IOTA_CANARY_PUBLISHER_NOT_AUTHORIZED");

    const evidence = buildSyntheticEvidence(options.runId);
    const contractArguments = [
      evidence.merkleRoot,
      evidence.tenantIdHash,
      evidence.resourceType,
      evidence.publicResourceId,
      evidence.eventCount,
      evidence.memoHash,
    ];
    const proofId = String(await contract.computeProofId(...contractArguments)).toLowerCase();
    if (!PROOF_ID_PATTERN.test(proofId)) fail("IOTA_CANARY_CONTRACT_PROOF_ID_INVALID");
    if (await contract.isAnchored(proofId)) fail("IOTA_CANARY_PROOF_COLLISION");

    const expected = { ...evidence, proofId };
    let rows;
    try {
      rows = await publicationRows(database, expected);
    } catch {
      fail("IOTA_CANARY_DATABASE_QUERY_FAILED");
    }
    if (rows.length !== 0) fail("IOTA_CANARY_DURABLE_IDENTITY_COLLISION");

    const [initialLatestNonce, initialPendingNonce] = await Promise.all([
      provider.getTransactionCount(publisherAddress, "latest"),
      provider.getTransactionCount(publisherAddress, "pending"),
    ]);
    if (initialLatestNonce !== initialPendingNonce) fail("IOTA_CANARY_PUBLISHER_HAS_PENDING_TRANSACTION");

    const request = {
      request_id: evidence.requestId,
      proof_id: proofId,
      chain_id: chainId,
      contract_address: contractAddress,
      merkle_root: evidence.merkleRoot,
      tenant_id_hash: evidence.tenantIdHash,
      resource_type: evidence.resourceType,
      public_resource_id: evidence.publicResourceId,
      event_count: evidence.eventCount,
      memo_hash: evidence.memoHash,
    };
    const exactRequestBody = JSON.stringify(request);
    const postOptions = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-iota-proof-secret": config.executorSecret,
      },
      body: exactRequestBody,
    };

    const first = await fetchJson(
      fetchImpl,
      `${config.serviceOrigin}/iota/evidence-v2`,
      postOptions,
      config.httpTimeoutMs,
      "IOTA_CANARY_SUBMIT",
    );
    const submitted = assertSubmittedResponse(first, expected);
    if (submitted.nonce !== initialPendingNonce) fail("IOTA_CANARY_TRANSACTION_NONCE_UNEXPECTED");

    const replay = await fetchJson(
      fetchImpl,
      `${config.serviceOrigin}/iota/evidence-v2`,
      postOptions,
      config.httpTimeoutMs,
      "IOTA_CANARY_REPLAY",
    );
    assertExactReplay(first, replay);

    const receipt = await provider.waitForTransaction(submitted.txHash, 1, config.receiptTimeoutMs);
    if (!receipt || Number(receipt.status) !== 1 || String(receipt.hash || "").toLowerCase() !== submitted.txHash) {
      fail("IOTA_CANARY_RECEIPT_FAILED");
    }
    const transaction = await provider.getTransaction(submitted.txHash);
    if (!transaction
        || transaction.nonce !== submitted.nonce
        || !sameAddress(transaction.from, publisherAddress)
        || !sameAddress(transaction.to, contractAddress)) {
      fail("IOTA_CANARY_TRANSACTION_MISMATCH");
    }

    assertEvidenceEvent(receipt, contractAddress, {
      ...expected,
      publisher: publisherAddress,
    });
    if (!await contract.isAnchored(proofId)) fail("IOTA_CANARY_ON_CHAIN_STORAGE_MISSING");
    assertEvidenceRecord(await contract.evidenceRecord(proofId), {
      ...expected,
      publisher: publisherAddress,
    });

    let durableRows;
    try {
      durableRows = await publicationRows(
        database,
        expected,
        submitted.txHash,
        submitted.nonce,
        publisherAddress,
        chainId,
      );
    } catch {
      fail("IOTA_CANARY_DATABASE_QUERY_FAILED");
    }
    const durable = assertSingleDurablePublication(durableRows, {
      ...expected,
      txHash: submitted.txHash,
      nonce: submitted.nonce,
      publisher: publisherAddress,
      chainId,
    });

    await waitForExactNonceAdvance(provider, publisherAddress, initialPendingNonce, config.receiptTimeoutMs);

    return buildPublicCanaryResult({
      chainId,
      contractAddress,
      publisher: publisherAddress,
      requestId: evidence.requestId,
      proofId,
      txHash: submitted.txHash,
      nonce: submitted.nonce,
      blockNumber: Number(receipt.blockNumber),
      durableStatus: durable.status,
    });
  } finally {
    if (ownsDatabase) await database.end().catch(() => {});
    if (ownsProvider) provider.destroy();
  }
}

const executedDirectly = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (executedDirectly) {
  if (process.argv.length !== 2) {
    console.error(JSON.stringify({ ok: false, gate: "iota_staging_live_canary", reason: "CLI_ARGUMENTS_FORBIDDEN" }));
    process.exitCode = 1;
  } else {
    runIotaStagingCanary()
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error) => {
        const reason = error instanceof IotaCanaryError ? error.code : "IOTA_CANARY_UNEXPECTED_FAILURE";
        console.error(JSON.stringify({ ok: false, gate: "iota_staging_live_canary", reason }));
        process.exitCode = 1;
      });
  }
}
