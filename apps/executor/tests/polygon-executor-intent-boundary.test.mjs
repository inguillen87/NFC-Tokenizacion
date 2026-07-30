import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { buildPolygonMintIntentDigest } from "../src/polygon-mint-intent.mjs";
import { handler, mintUnlocked } from "../src/server.mjs";

const SECRET = "executor-test-secret-that-is-over-32-bytes";
const CONTRACT = "0x00000000000000000000000000000000000000a1";
const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841cb6b37e8db1e1cb";

function mintBody(overrides = {}) {
  const payload = {
    request_id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    lease_id: "33333333-3333-4333-8333-333333333333",
    network: "polygon-amoy",
    execution_class: "testnet_trial",
    commercial_disposition: "NON_SELLABLE",
    issuer_wallet: "0x00000000000000000000000000000000000000b2",
    chip_uid_hash: `sha256:${"ab".repeat(32)}`,
    token_uri: "https://api.nexid.lat/public/polygon/assets/nx-test",
    asset_ref: "batch-2026:nx-test",
    ...overrides,
  };
  payload.intent_digest = buildPolygonMintIntentDigest({
    requestId: payload.request_id,
    tenantId: payload.tenant_id,
    leaseId: payload.lease_id,
    network: payload.network,
    executionClass: payload.execution_class,
    commercialDisposition: payload.commercial_disposition,
    issuerWallet: payload.issuer_wallet,
    chipUidHash: payload.chip_uid_hash,
    tokenUri: payload.token_uri,
    assetRef: payload.asset_ref,
  });
  return payload;
}

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

async function postMint(payload, dependencies = {}) {
  return await new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = "POST";
    req.url = "/mint";
    req.headers = { "x-tokenization-secret": SECRET };
    const response = { status: null, body: null };
    const res = {
      writeHead(status) { response.status = status; },
      end(raw) { response.body = JSON.parse(raw); resolve(response); },
    };
    void handler(req, res, dependencies);
    queueMicrotask(() => {
      req.emit("data", Buffer.from(JSON.stringify(payload)));
      req.emit("end");
    });
  });
}

const executorEnvironment = {
  EXECUTOR_CAPABILITIES: "polygon",
  EXECUTOR_SIGNER_MODE: "kms_wrapped",
  POLYGON_RPC_URL: "https://polygon-rpc.example.test",
  POLYGON_CONTRACT_ADDRESS: CONTRACT,
  POLYGON_EXPECTED_CHAIN_ID: "80002",
  TOKENIZATION_EXECUTOR_SECRET: SECRET,
  NODE_ENV: "test",
};

test("bearer plus an attacker-computed body digest cannot mint without the durable DB intent", async () => {
  await withProcessEnv(executorEnvironment, async () => {
    let signerReached = false;
    const response = await postMint(mintBody({ asset_ref: "attacker-controlled:asset" }), {
      provider: { async getNetwork() { return { chainId: 80002n }; } },
      polygonIntentDatabase: { async connect() { throw new Error("database_offline"); } },
      readContract: { async tokenByChipHash() { throw new Error("must_not_inspect_chain"); } },
      async signWithWrappedKms() { signerReached = true; throw new Error("must_not_sign"); },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.reason, "polygon_mint_intent_store_unavailable");
    assert.equal(signerReached, false);
  });
});

test("an identical durable replay is inspect-only and never gets a second submit path", async () => {
  await withProcessEnv(executorEnvironment, async () => {
    let signerReached = false;
    await assert.rejects(
      mintUnlocked(mintBody(), {
        provider: { async getNetwork() { return { chainId: 80002n }; } },
        readContract: { async tokenByChipHash() { return 0n; } },
        async polygonMintIntentAuthorizer() { return { mode: "reconcile" }; },
        async signWithWrappedKms() { signerReached = true; throw new Error("must_not_sign"); },
      }),
      /polygon_mint_reconciliation_pending/,
    );
    assert.equal(signerReached, false);
  });
});

test("production rejects an exportable private_key signer before DB authorization or chain access", async () => {
  await withProcessEnv({
    ...executorEnvironment,
    NODE_ENV: "production",
    EXECUTOR_SIGNER_MODE: "private_key",
    POLYGON_MINTER_PRIVATE_KEY: PRIVATE_KEY,
  }, async () => {
    let authorizerReached = false;
    let providerReached = false;
    await assert.rejects(
      mintUnlocked(mintBody(), {
        provider: { async getNetwork() { providerReached = true; return { chainId: 80002n }; } },
        async polygonMintIntentAuthorizer() { authorizerReached = true; return { mode: "dispatch" }; },
      }),
      /polygon_exportable_private_key_forbidden/,
    );
    assert.equal(authorizerReached, false);
    assert.equal(providerReached, false);
  });
});
