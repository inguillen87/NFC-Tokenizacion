import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Wallet } from "ethers";
import {
  secretMatches,
  sha256Bytes32,
  handler,
} from "../src/server.mjs";
import { kmsConfigured, signWithKms, validateSignedTransaction } from "../src/kms-signer.mjs";

test("executor secrets are compared exactly and safely", () => {
  assert.equal(secretMatches("same-long-secret", "same-long-secret"), true);
  assert.equal(secretMatches("same-long-secret", "different-secret"), false);
  assert.equal(secretMatches("short", "much-longer"), false);
  assert.equal(secretMatches("", ""), false);
});

test("IOTA executor accepts only canonical 32-byte evidence digests", () => {
  assert.equal(sha256Bytes32(`sha256:${"ab".repeat(32)}`, "memo_hash"), `0x${"ab".repeat(32)}`);
  assert.equal(sha256Bytes32(`0x${"CD".repeat(32)}`, "memo_hash"), `0x${"cd".repeat(32)}`);
  assert.throws(() => sha256Bytes32("not-a-digest", "memo_hash"), /memo_hash_invalid/);
});

test("IOTA endpoint returns after broadcast and exposes no legacy anchorRoot writer", async () => {
  const source = await readFile(new URL("../src/server.mjs", import.meta.url), "utf8");
  assert.match(source, /\/anchor-evidence/);
  assert.match(source, /IOTA_PROOF_EXECUTOR_SECRET/);
  assert.match(source, /authorizedPublishers/);
  assert.match(source, /computeProofId/);
  assert.match(source, /anchorEvidence/);
  assert.match(source, /state:\s*"submitted"/);
  assert.doesNotMatch(source, /anchorRoot/);
});

test("KMS mode is explicit and never falls back to an exportable key", () => {
  const previous = {
    mode: process.env.IOTA_EXECUTOR_SIGNER_MODE,
    url: process.env.IOTA_KMS_SIGNER_URL,
    key: process.env.IOTA_KMS_KEY_ID,
    hosts: process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS,
    nodeEnv: process.env.NODE_ENV,
    token: process.env.IOTA_KMS_SIGNER_TOKEN,
  };
  process.env.IOTA_EXECUTOR_SIGNER_MODE = "kms";
  delete process.env.IOTA_KMS_SIGNER_URL;
  delete process.env.IOTA_KMS_KEY_ID;
  assert.equal(kmsConfigured(), false);
  if (previous.mode === undefined) delete process.env.IOTA_EXECUTOR_SIGNER_MODE; else process.env.IOTA_EXECUTOR_SIGNER_MODE = previous.mode;
  if (previous.url === undefined) delete process.env.IOTA_KMS_SIGNER_URL; else process.env.IOTA_KMS_SIGNER_URL = previous.url;
  if (previous.key === undefined) delete process.env.IOTA_KMS_KEY_ID; else process.env.IOTA_KMS_KEY_ID = previous.key;
});

test("KMS signer rejects insecure endpoints and malformed provider responses", async () => {
  const previous = {
    url: process.env.IOTA_KMS_SIGNER_URL,
    key: process.env.IOTA_KMS_KEY_ID,
    fetch: globalThis.fetch,
  };
  process.env.IOTA_KMS_SIGNER_URL = "http://signer.example.test";
  process.env.IOTA_KMS_KEY_ID = "staging-key";
  await assert.rejects(() => signWithKms({ chainId: 1076, transaction: {} }), /kms_signer_tls_required/);
  process.env.IOTA_KMS_SIGNER_URL = "https://signer.example.test";
  globalThis.fetch = async () => new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });
  await assert.rejects(() => signWithKms({ chainId: 1076, transaction: {} }), /kms_response_invalid_json/);
  process.env.NODE_ENV = "production";
  process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS = "signer.example.test";
  delete process.env.IOTA_KMS_SIGNER_TOKEN;
  await assert.rejects(() => signWithKms({ chainId: 1076, transaction: {} }), /kms_signer_token_required/);
  if (previous.url === undefined) delete process.env.IOTA_KMS_SIGNER_URL; else process.env.IOTA_KMS_SIGNER_URL = previous.url;
  if (previous.key === undefined) delete process.env.IOTA_KMS_KEY_ID; else process.env.IOTA_KMS_KEY_ID = previous.key;
  if (previous.hosts === undefined) delete process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS; else process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS = previous.hosts;
  if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
  if (previous.token === undefined) delete process.env.IOTA_KMS_SIGNER_TOKEN; else process.env.IOTA_KMS_SIGNER_TOKEN = previous.token;
  globalThis.fetch = previous.fetch;
});

test("KMS signer accepts only a locally verified signed transaction", async () => {
  const previous = {
    url: process.env.IOTA_KMS_SIGNER_URL,
    key: process.env.IOTA_KMS_KEY_ID,
    hosts: process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS,
    fetch: globalThis.fetch,
  };
  process.env.IOTA_KMS_SIGNER_URL = "https://signer.example.test/sign";
  process.env.IOTA_KMS_KEY_ID = "staging-key";
  process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS = "signer.example.test";
  const wallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb");
  const transaction = {
    type: 2,
    to: "0x0000000000000000000000000000000000000001",
    data: "0x1234",
    nonce: 3,
    value: "0",
    gas_limit: "50000",
    chain_id: 1076,
    max_fee_per_gas: "10",
    max_priority_fee_per_gas: "1",
  };
  const signedTransaction = await wallet.signTransaction({
    type: transaction.type,
    chainId: transaction.chain_id,
    to: transaction.to,
    data: transaction.data,
    nonce: transaction.nonce,
    value: transaction.value,
    gasLimit: transaction.gas_limit,
    maxFeePerGas: transaction.max_fee_per_gas,
    maxPriorityFeePerGas: transaction.max_priority_fee_per_gas,
  });
  let providerResponse = { signed_transaction: "0x1234", signer_address: wallet.address };
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.key_id, "staging-key");
    assert.equal(body.chain_id, 1076);
    return new Response(JSON.stringify(providerResponse), { status: 200, headers: { "content-type": "application/json" } });
  };
  const intent = { chainId: 1076, expectedSignerAddress: wallet.address, transaction };
  await assert.rejects(() => signWithKms(intent), /kms_signed_transaction_invalid/);
  providerResponse = {
    signed_transaction: signedTransaction,
    signer_address: "0x0000000000000000000000000000000000000002",
  };
  const result = await signWithKms(intent);
  assert.equal(result.signedTransaction, signedTransaction);
  assert.equal(result.signerAddress, wallet.address);
  assert.match(result.transactionHash, /^0x[0-9a-f]{64}$/);
  if (previous.url === undefined) delete process.env.IOTA_KMS_SIGNER_URL; else process.env.IOTA_KMS_SIGNER_URL = previous.url;
  if (previous.key === undefined) delete process.env.IOTA_KMS_KEY_ID; else process.env.IOTA_KMS_KEY_ID = previous.key;
  if (previous.hosts === undefined) delete process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS; else process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS = previous.hosts;
  globalThis.fetch = previous.fetch;
});

test("KMS transaction verification rejects changes to signer, chain, calldata, nonce, gas, value, and fees", async () => {
  const wallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb");
  const transaction = {
    type: 2,
    to: "0x0000000000000000000000000000000000000001",
    data: "0x1234",
    nonce: 3,
    value: "0",
    gas_limit: "50000",
    chain_id: 1076,
    max_fee_per_gas: "10",
    max_priority_fee_per_gas: "1",
  };
  const signed = await wallet.signTransaction({
    type: 2,
    chainId: 1076,
    to: transaction.to,
    data: transaction.data,
    nonce: transaction.nonce,
    value: transaction.value,
    gasLimit: transaction.gas_limit,
    maxFeePerGas: transaction.max_fee_per_gas,
    maxPriorityFeePerGas: transaction.max_priority_fee_per_gas,
  });
  const intent = { chainId: 1076, expectedSignerAddress: wallet.address, transaction };
  assert.doesNotThrow(() => validateSignedTransaction(signed, intent));
  assert.throws(() => validateSignedTransaction(signed, { ...intent, expectedSignerAddress: "0x0000000000000000000000000000000000000002" }), /kms_signer_address_mismatch/);
  assert.throws(() => validateSignedTransaction(signed, { ...intent, chainId: 1077, transaction: { ...transaction, chain_id: 1077 } }), /chain_id_mismatch/);
  assert.throws(() => validateSignedTransaction(signed, { ...intent, transaction: { ...transaction, data: "0xabcd" } }), /data_mismatch/);
  assert.throws(() => validateSignedTransaction(signed, { ...intent, transaction: { ...transaction, nonce: 4 } }), /nonce_mismatch/);
  assert.throws(() => validateSignedTransaction(signed, { ...intent, transaction: { ...transaction, gas_limit: "50001" } }), /gas_limit_mismatch/);
  assert.throws(() => validateSignedTransaction(signed, { ...intent, transaction: { ...transaction, value: "1" } }), /value_mismatch/);
  assert.throws(() => validateSignedTransaction(signed, { ...intent, transaction: { ...transaction, max_fee_per_gas: "11" } }), /max_fee_per_gas_mismatch/);
});

test("health reports the IOTA signer mode independently from the Polygon signer", async () => {
  const keys = [
    "EXECUTOR_SIGNER_MODE",
    "IOTA_EXECUTOR_SIGNER_MODE",
    "IOTA_KMS_SIGNER_URL",
    "IOTA_KMS_KEY_ID",
    "IOTA_KMS_PUBLISHER_ADDRESS",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.EXECUTOR_SIGNER_MODE = "private_key";
  process.env.IOTA_EXECUTOR_SIGNER_MODE = "kms";
  process.env.IOTA_KMS_SIGNER_URL = "https://signer.example.test";
  process.env.IOTA_KMS_KEY_ID = "iota-key";
  process.env.IOTA_KMS_PUBLISHER_ADDRESS = "0x0000000000000000000000000000000000000001";
  try {
    const response = await new Promise((resolve) => {
      const req = new Request("http://executor.test/health");
      const res = { writeHead: () => {}, end: (body) => resolve(JSON.parse(body)) };
      void handler(req, res);
    });
    assert.equal(response.signerMode, "private_key");
    assert.equal(response.iotaEvidenceV2.signerMode, "kms");
    assert.equal(response.iotaEvidenceV2.signerConfigured, true);
    assert.equal(response.kmsReady, true);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test("executor readiness fails closed when durable publishing prerequisites are absent", async () => {
  const response = await new Promise((resolve) => {
    const req = new Request("http://executor.test/ready");
    const res = { writeHead: () => {}, end: (body) => resolve({ body: JSON.parse(body) }) };
    void handler(req, res);
  });
  assert.equal(response.body.ok, false);
  assert.equal(response.body.checks.durable_store, false);
});
