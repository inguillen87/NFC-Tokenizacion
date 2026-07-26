import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Wallet } from "ethers";
import {
  createExecutorServer,
  secretMatches,
  sha256Bytes32,
  handler,
} from "../src/server.mjs";
import { kmsConfigured, signWithKms, validateSignedTransaction } from "../src/kms-signer.mjs";

async function withProcessEnv(overrides, operation) {
  const previous = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try {
    return await operation();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

async function getExecutorJson(pathname, method = "GET", dependencies = {}, headers = {}) {
  return new Promise((resolve) => {
    const req = new Request(`http://executor.test${pathname}`, { method, headers });
    const response = { status: null, body: null };
    const res = {
      writeHead: (status) => { response.status = status; },
      end: (body) => { response.body = JSON.parse(body); resolve(response); },
    };
    void handler(req, res, dependencies);
  });
}

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

test("KMS mode is explicit and never falls back to an exportable key", async () => {
  await withProcessEnv({
    IOTA_EXECUTOR_SIGNER_MODE: "kms",
    IOTA_KMS_SIGNER_URL: undefined,
    IOTA_KMS_KEY_ID: undefined,
  }, async () => {
    assert.equal(kmsConfigured(), false);
  });
});

test("KMS signer rejects insecure endpoints and malformed provider responses", async () => {
  const previousFetch = globalThis.fetch;
  try {
    await withProcessEnv({
      IOTA_KMS_SIGNER_URL: "http://signer.example.test",
      IOTA_KMS_KEY_ID: "staging-key",
      IOTA_KMS_SIGNER_ALLOWED_HOSTS: undefined,
      IOTA_KMS_SIGNER_TOKEN: undefined,
      NODE_ENV: undefined,
    }, async () => {
      await assert.rejects(() => signWithKms({ chainId: 1076, transaction: {} }), /kms_signer_tls_required/);
      process.env.IOTA_KMS_SIGNER_URL = "https://signer.example.test";
      globalThis.fetch = async () => new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });
      await assert.rejects(() => signWithKms({ chainId: 1076, transaction: {} }), /kms_response_invalid_json/);
      process.env.NODE_ENV = "production";
      process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS = "signer.example.test";
      await assert.rejects(() => signWithKms({ chainId: 1076, transaction: {} }), /kms_signer_token_required/);
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("KMS signer accepts only a locally verified signed transaction", async () => {
  const previousFetch = globalThis.fetch;
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
  try {
    await withProcessEnv({
      IOTA_KMS_SIGNER_URL: "https://signer.example.test/sign",
      IOTA_KMS_KEY_ID: "staging-key",
      IOTA_KMS_SIGNER_ALLOWED_HOSTS: "signer.example.test",
    }, async () => {
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
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
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
    assert.match(response.note, /Configuration alone does not attest KMS protection level/);
    assert.match(response.note, /HSM backing, or key non-exportability/);
    assert.doesNotMatch(response.note, /^Remote non-exportable KMS\/HSM signer configured\.$/);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test("IOTA-only health never reports Polygon as the active network", async () => {
  await withProcessEnv({
    EXECUTOR_CAPABILITIES: "iota",
    EXECUTOR_SIGNER_MODE: "private_key",
    IOTA_EXECUTOR_SIGNER_MODE: "kms_wrapped",
    IOTA_EVM_RPC_URL: "https://json-rpc.evm.testnet.iota.cafe",
    IOTA_EVM_EXPECTED_CHAIN_ID: "1076",
    IOTA_EVM_ANCHOR_CONTRACT_V2: "0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0",
    NEXID_KMS_ENVIRONMENT: "test",
    IOTA_KMS_WRAP_KEY_RESOURCE: "projects/nexid1/locations/global/keyRings/test/cryptoKeys/iota",
    IOTA_KMS_WRAPPED_PRIVATE_KEY: Buffer.alloc(32, 9).toString("base64"),
    IOTA_KMS_PUBLISHER_ADDRESS: "0x0000000000000000000000000000000000000001",
  }, async () => {
    const response = await new Promise((resolve) => {
      const req = new Request("http://executor.test/health");
      const res = { writeHead: () => {}, end: (body) => resolve(JSON.parse(body)) };
      void handler(req, res);
    });

    assert.deepEqual(response.capabilities, ["iota"]);
    assert.equal(response.network, "iota-evm-testnet");
    assert.equal(response.signerMode, "kms_wrapped");
    assert.equal(response.rpcConfigured, true);
    assert.equal(response.contract.address, "0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0");
    assert.equal(response.minter, null);
    assert.equal(response.networks.iota.expectedChainId, "1076");
    assert.equal(response.networks.polygon, undefined);
  });
});

test("health labels SOFTWARE-wrapped custody without implying HSM or direct non-exportable signing", async () => {
  await withProcessEnv({
    EXECUTOR_SIGNER_MODE: "private_key",
    IOTA_EXECUTOR_SIGNER_MODE: "kms_wrapped",
    NEXID_KMS_ENVIRONMENT: "test",
    IOTA_KMS_WRAP_KEY_RESOURCE: "projects/nexid1/locations/global/keyRings/test/cryptoKeys/iota",
    IOTA_KMS_WRAPPED_PRIVATE_KEY: Buffer.alloc(32, 7).toString("base64"),
    IOTA_KMS_PUBLISHER_ADDRESS: "0x0000000000000000000000000000000000000001",
  }, async () => {
    const response = await new Promise((resolve) => {
      const req = new Request("http://executor.test/health");
      const res = { writeHead: () => {}, end: (body) => resolve(JSON.parse(body)) };
      void handler(req, res);
    });

    assert.equal(response.iotaEvidenceV2.signerMode, "kms_wrapped");
    assert.equal(response.iotaEvidenceV2.signerConfigured, true);
    assert.equal(response.kmsReady, true);
    assert.match(response.note, /KMS SOFTWARE-wrapped pilot signer/);
    assert.match(response.note, /wallet plaintext exists ephemerally in executor memory/);
    assert.match(response.note, /not HSM or direct non-exportable signing/);
  });
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

test("executor readiness is scoped to explicitly enabled chain capabilities", async () => {
  await withProcessEnv({
    EXECUTOR_CAPABILITIES: "polygon",
    EXECUTOR_SIGNER_MODE: "private_key",
    POLYGON_RPC_URL: "https://polygon-rpc.example.test",
    POLYGON_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000001",
    POLYGON_MINTER_PRIVATE_KEY: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb",
    POLYGON_EXPECTED_CHAIN_ID: "80002",
    TOKENIZATION_EXECUTOR_SECRET: "test-only-long-executor-secret",
  }, async () => {
    const signerAddress = new Wallet(process.env.POLYGON_MINTER_PRIVATE_KEY).address;
    const response = await getExecutorJson("/ready", "GET", {
      polygonReadinessProbe: async () => ({
        chainId: 80002,
        contractDeployed: true,
        ownerAddress: "0x0000000000000000000000000000000000000002",
        minterAllowlisted: true,
        balanceWei: 1_000_000_000_000_000n,
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.capabilities, ["polygon"]);
    assert.equal(response.body.chains.polygon.ok, true);
    assert.equal(response.body.chains.polygon.live_verified, true);
    assert.equal(response.body.chains.polygon.signer.address, signerAddress);
    assert.equal(response.body.chains.iota, undefined);

    const disabled = await getExecutorJson("/anchor-evidence", "POST");
    assert.equal(disabled.status, 404);
    assert.equal(disabled.body.reason, "not_found");
  });
});

test("executor capabilities preserve both legacy routes by default and reject invalid declarations", async () => {
  await withProcessEnv({ EXECUTOR_CAPABILITIES: undefined }, async () => {
    const response = await getExecutorJson("/ready");
    assert.deepEqual(response.body.capabilities, ["polygon", "iota"]);
  });
  await withProcessEnv({ EXECUTOR_CAPABILITIES: "polygon,unknown" }, async () => {
    const response = await getExecutorJson("/ready");
    assert.equal(response.status, 503);
    assert.equal(response.body.reason, "executor_capabilities_invalid");
  });
});

test("executor drain stops accepting application requests without abrupt process exit", async () => {
  const runtime = createExecutorServer();
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  const drain = runtime.beginDrain();
  const response = await new Promise((resolve) => {
    const req = new Request("http://executor.test/health");
    const res = {
      writeHead: (status) => { res.status = status; },
      end: (body) => resolve({ status: res.status, body: JSON.parse(body) }),
    };
    runtime.server.emit("request", req, res);
  });
  assert.equal(response.status, 503);
  assert.equal(response.body.reason, "executor_draining");
  await drain;
  assert.equal(runtime.draining, true);
});
