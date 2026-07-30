import assert from "node:assert/strict";
import test from "node:test";
import { clearIotaReadinessCache } from "../src/iota-idempotency.mjs";
import { handler } from "../src/server.mjs";

const validIotaEnvironment = {
  NODE_ENV: "test",
  EXECUTOR_ENVIRONMENT: "test",
  NEXID_ENVIRONMENT: "test",
  NEXID_KMS_ENVIRONMENT: "staging",
  EXECUTOR_CAPABILITIES: "iota",
  IOTA_EXECUTOR_SIGNER_MODE: "private_key",
  IOTA_EVM_PRIVATE_KEY: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb",
  IOTA_EVM_RPC_URL: "https://iota-rpc.example.test",
  IOTA_EVM_ANCHOR_CONTRACT_V2: "0x0000000000000000000000000000000000000001",
  IOTA_EVM_EXPECTED_CHAIN_ID: "1076",
  IOTA_PROOF_EXECUTOR_SECRET: "test-only-long-iota-secret-32-bytes",
  DATABASE_URL: "postgresql://readiness.invalid/nexid",
};

const readyChain = {
  chainId: 1076,
  contractDeployed: true,
  schemaVersion: 2,
  publisherAuthorized: true,
  balanceWei: 1_000_000_000_000_000n,
};

const readyRow = {
  connected: true,
  table_present: true,
  columns_present: true,
  constraints_present: true,
  indexes_present: true,
  privileges_present: true,
};

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
    clearIotaReadinessCache();
  }
}

function fakeReadinessDatabase(result) {
  const calls = [];
  return {
    calls,
    async query(config) {
      calls.push(config);
      if (result instanceof Error) throw result;
      return { rows: [result] };
    },
  };
}

async function requestJson(pathname, dependencies = {}) {
  return new Promise((resolve) => {
    const req = new Request(`http://executor.test${pathname}`);
    const response = { status: null, body: null };
    const res = {
      writeHead(status) { response.status = status; },
      end(body) {
        response.body = JSON.parse(body);
        resolve(response);
      },
    };
    void handler(req, res, {
      iotaReadinessProbe: async () => readyChain,
      ...dependencies,
    });
  });
}

test("/ready fails closed when the durable IOTA schema is incomplete", async () => {
  const database = fakeReadinessDatabase({ ...readyRow, columns_present: false });
  await withProcessEnv(validIotaEnvironment, async () => {
    const response = await requestJson("/ready", { iotaReadinessDatabase: database });
    assert.equal(response.status, 503);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.checks.durable_store, false);
    assert.equal(response.body.chains.iota.durable_store.reason, "database_schema_invalid");
    assert.deepEqual(response.body.chains.iota.durable_store.checks, {
      connectivity: true,
      table: true,
      columns: false,
      constraints: true,
      indexes: true,
      privileges: true,
    });
  });
});

test("/ready fails closed without leaking database errors", async () => {
  const sensitiveError = new Error("password=super-secret host=private-db.example.internal");
  const database = fakeReadinessDatabase(sensitiveError);
  await withProcessEnv(validIotaEnvironment, async () => {
    const response = await requestJson("/ready", { iotaReadinessDatabase: database });
    assert.equal(response.status, 503);
    assert.equal(response.body.chains.iota.durable_store.reason, "database_unavailable");
    assert.doesNotMatch(JSON.stringify(response.body), /super-secret|private-db\.example\.internal/i);
  });
});

test("/ready accepts the complete durable schema and briefly caches the probe", async () => {
  const database = fakeReadinessDatabase(readyRow);
  await withProcessEnv(validIotaEnvironment, async () => {
    const dependencies = { iotaReadinessDatabase: database };
    const first = await requestJson("/ready", dependencies);
    const second = await requestJson("/ready", dependencies);
    assert.equal(first.status, 200);
    assert.equal(first.body.ok, true);
    assert.equal(first.body.chains.iota.live_verified, true);
    assert.equal(first.body.chains.iota.chain_id, "1076");
    assert.equal(first.body.chains.iota.contract.deployed, true);
    assert.equal(first.body.chains.iota.contract.schema_version, 2);
    assert.equal(first.body.chains.iota.publisher.authorized, true);
    assert.ok(first.body.chains.iota.publisher.balance_iota > 0);
    assert.equal(first.body.checks.durable_store, true);
    assert.equal(second.status, 200);
    assert.equal(database.calls.length, 1);

    const [probe] = database.calls;
    assert.equal(typeof probe.text, "string");
    assert.equal(probe.query_timeout, 2_500);
    assert.ok(probe.values[0].includes("protocol_version"));
    assert.ok(probe.values[0].includes("raw_transaction"));
    assert.ok(probe.values[2].includes("iota_executor_publications_protocol_v2_required_check"));
    assert.ok(probe.values[4].includes("uq_iota_executor_publications_signer_nonce"));
  });
});

for (const [name, override, failedCheck] of [
  ["wrong chain", { chainId: 1 }, "chain_id"],
  ["missing bytecode", { contractDeployed: false }, "contract_code"],
  ["wrong contract schema", { schemaVersion: 1 }, "contract_schema_v2"],
  ["unauthorized publisher", { publisherAuthorized: false }, "publisher_authorized"],
  ["empty publisher gas wallet", { balanceWei: 0n }, "publisher_gas"],
]) {
  test(`IOTA readiness fails closed for ${name}`, async () => {
    const database = fakeReadinessDatabase(readyRow);
    await withProcessEnv(validIotaEnvironment, async () => {
      const response = await requestJson("/ready", {
        iotaReadinessDatabase: database,
        iotaReadinessProbe: async () => ({ ...readyChain, ...override }),
      });
      assert.equal(response.status, 503);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.chains.iota.live_verified, false);
      assert.equal(response.body.chains.iota.checks[failedCheck], false);
    });
  });
}

test("IOTA readiness is testnet-only and rejects weak secrets or production plaintext signers before RPC", async () => {
  const database = fakeReadinessDatabase(readyRow);
  for (const overrides of [
    { IOTA_EVM_EXPECTED_CHAIN_ID: "1" },
    { IOTA_PROOF_EXECUTOR_SECRET: "too-short" },
    { NODE_ENV: "production" },
  ]) {
    await withProcessEnv({ ...validIotaEnvironment, ...overrides }, async () => {
      let probed = false;
      const response = await requestJson("/ready", {
        iotaReadinessDatabase: database,
        iotaReadinessProbe: async () => { probed = true; return readyChain; },
      });
      assert.equal(response.status, 503);
      assert.equal(response.body.ok, false);
      assert.equal(probed, false);
    });
  }
});

test("/health remains independent from durable-store readiness", async () => {
  const database = fakeReadinessDatabase(new Error("database offline"));
  await withProcessEnv(validIotaEnvironment, async () => {
    const response = await requestJson("/health", { iotaReadinessDatabase: database });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(database.calls.length, 0);
  });
});
