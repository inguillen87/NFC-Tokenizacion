import assert from "node:assert/strict";
import test from "node:test";
import { Wallet } from "ethers";
import { handler } from "../src/server.mjs";

const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb";
const SECRET = "test-only-long-executor-secret-32-bytes";
const CONTRACT = "0x0000000000000000000000000000000000000001";

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

async function requestReadiness({ secret = SECRET, probe, intentStoreProbe } = {}) {
  return new Promise((resolve) => {
    const headers = secret ? { "x-tokenization-secret": secret } : {};
    const req = new Request("http://executor.test/ready?capability=polygon", { headers });
    const response = { status: null, body: null };
    const res = {
      writeHead(status) { response.status = status; },
      end(body) { response.body = JSON.parse(body); resolve(response); },
    };
    void handler(req, res, {
      polygonReadinessProbe: probe,
      polygonIntentReadinessProbe: intentStoreProbe || (async () => ({
        ok: true,
        reason: null,
        checks: { connectivity: true, table: true, columns: true, privileges: true },
      })),
    });
  });
}

const environment = {
  EXECUTOR_CAPABILITIES: "polygon",
  EXECUTOR_SIGNER_MODE: "private_key",
  POLYGON_RPC_URL: "https://polygon-rpc.example.test",
  POLYGON_CONTRACT_ADDRESS: CONTRACT,
  POLYGON_MINTER_PRIVATE_KEY: PRIVATE_KEY,
  POLYGON_EXPECTED_CHAIN_ID: "80002",
  TOKENIZATION_EXECUTOR_SECRET: SECRET,
};

test("scoped Polygon readiness requires the executor secret", async () => {
  await withProcessEnv(environment, async () => {
    let called = false;
    const response = await requestReadiness({ secret: "", probe: async () => { called = true; } });
    assert.equal(response.status, 401);
    assert.equal(response.body.reason, "unauthorized_executor_readiness");
    assert.equal(called, false);
  });
});

test("Polygon readiness is live only after chain, bytecode, authorization and gas probes", async () => {
  await withProcessEnv(environment, async () => {
    const signer = new Wallet(PRIVATE_KEY).address;
    const response = await requestReadiness({
      probe: async (input) => {
        assert.equal(input.expectedChain, 80002);
        assert.equal(input.contractAddress, CONTRACT);
        assert.equal(input.signerAddress, signer);
        return {
          chainId: 80002,
          contractDeployed: true,
          ownerAddress: "0x0000000000000000000000000000000000000002",
          minterAllowlisted: true,
          balanceWei: 1_000_000_000_000_000n,
        };
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.chains.polygon.live_verified, true);
    assert.equal(response.body.chains.polygon.chain_id, "80002");
    assert.equal(response.body.chains.polygon.contract.deployed, true);
    assert.equal(response.body.chains.polygon.signer.authorized, true);
    assert.ok(response.body.chains.polygon.signer.balance_pol > 0);
  });
});

test("Polygon readiness fails closed for a weak executor secret", async () => {
  await withProcessEnv({ ...environment, TOKENIZATION_EXECUTOR_SECRET: "too-short" }, async () => {
    let called = false;
    const response = await requestReadiness({
      secret: "too-short",
      probe: async () => { called = true; throw new Error("must_not_probe"); },
    });
    assert.equal(response.status, 503);
    assert.equal(response.body.chains.polygon.checks.executor_secret, false);
    assert.equal(called, false);
  });
});

test("Polygon readiness fails closed when durable one-shot intent storage is unavailable", async () => {
  await withProcessEnv(environment, async () => {
    let called = false;
    const response = await requestReadiness({
      probe: async () => { called = true; throw new Error("must_not_probe"); },
      intentStoreProbe: async () => ({
        ok: false,
        reason: "database_unavailable",
        checks: { connectivity: false, table: false, columns: false, privileges: false },
      }),
    });
    assert.equal(response.status, 503);
    assert.equal(response.body.chains.polygon.checks.durable_intent_store, false);
    assert.equal(response.body.chains.polygon.durable_intent_store.reason, "database_unavailable");
    assert.equal(called, false);
  });
});

test("Polygon readiness labels wrapped software custody without claiming HSM", async () => {
  await withProcessEnv({
    ...environment,
    EXECUTOR_SIGNER_MODE: "kms_wrapped",
    POLYGON_MINTER_PRIVATE_KEY: undefined,
    POLYGON_KMS_PUBLISHER_ADDRESS: new Wallet(PRIVATE_KEY).address,
    POLYGON_KMS_WRAP_KEY_RESOURCE: "projects/test/locations/global/keyRings/test/cryptoKeys/test",
    POLYGON_KMS_WRAPPED_PRIVATE_KEY: Buffer.from("test-ciphertext").toString("base64"),
  }, async () => {
    const response = await requestReadiness({
      probe: async () => ({
        chainId: 80002,
        contractDeployed: true,
        ownerAddress: "0x0000000000000000000000000000000000000002",
        minterAllowlisted: true,
        balanceWei: 1n,
      }),
    });
    assert.equal(response.body.chains.polygon.signer_custody.model, "software_envelope_key_decrypted_in_process");
    assert.equal(response.body.chains.polygon.signer_custody.key_exportability, "exportable_in_runtime_memory");
    assert.equal(response.body.chains.polygon.signer_custody.hsm_attested, false);
  });
});

for (const [name, override, failedCheck] of [
  ["wrong chain", { chainId: 1, contractDeployed: true, minterAllowlisted: true, balanceWei: 1n }, "chain_id"],
  ["missing bytecode", { chainId: 80002, contractDeployed: false, minterAllowlisted: true, balanceWei: 1n }, "contract_code"],
  ["unauthorized signer", { chainId: 80002, contractDeployed: true, minterAllowlisted: false, balanceWei: 1n }, "signer_authorized"],
  ["empty gas wallet", { chainId: 80002, contractDeployed: true, minterAllowlisted: true, balanceWei: 0n }, "signer_gas"],
]) {
  test(`Polygon readiness fails closed for ${name}`, async () => {
    await withProcessEnv(environment, async () => {
      const response = await requestReadiness({
        probe: async () => ({ ownerAddress: "0x0000000000000000000000000000000000000002", ...override }),
      });
      assert.equal(response.status, 503);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.chains.polygon.live_verified, false);
      assert.equal(response.body.chains.polygon.checks[failedCheck], false);
    });
  });
}
