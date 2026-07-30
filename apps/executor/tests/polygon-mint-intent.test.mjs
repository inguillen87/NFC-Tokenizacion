import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  POLYGON_MINT_INTENT_VERSION,
  buildPolygonMintIntentDigest,
  checkPolygonMintIntentStore,
  reservePolygonMintIntent,
} from "../src/polygon-mint-intent.mjs";

const body = {
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
};

body.intent_digest = createHash("sha256").update(JSON.stringify([
  POLYGON_MINT_INTENT_VERSION,
  body.request_id,
  body.tenant_id,
  body.lease_id,
  body.network,
  body.execution_class,
  body.commercial_disposition,
  body.issuer_wallet,
  body.chip_uid_hash,
  body.token_uri,
  body.asset_ref,
]), "utf8").digest("hex");

function matchingRow(overrides = {}) {
  return {
    id: body.request_id,
    tenant_id: body.tenant_id,
    lease_id: body.lease_id,
    lease_valid: true,
    status: "processing",
    network: body.network,
    execution_class: body.execution_class,
    issuer_wallet: body.issuer_wallet,
    asset_ref: body.asset_ref,
    commercial_disposition: body.commercial_disposition,
    dispatch_intent_version: POLYGON_MINT_INTENT_VERSION,
    dispatch_intent_digest: body.intent_digest,
    dispatch_intent_lease_id: body.lease_id,
    dispatch_started_at: null,
    ...overrides,
  };
}

function transactionDatabase(row, { reserve = true } = {}) {
  const calls = [];
  const client = {
    async query(query) {
      calls.push(query);
      const text = typeof query === "string" ? query : query.text;
      if (/^BEGIN|^COMMIT|^ROLLBACK/.test(text)) return { rows: [] };
      if (/SELECT[\s\S]+FROM tokenization_requests/.test(text)) return { rows: [row] };
      if (/UPDATE tokenization_requests/.test(text)) return { rows: reserve ? [{ id: body.request_id }] : [] };
      throw new Error("unexpected_query");
    },
    release() { calls.push("release"); },
  };
  return {
    calls,
    database: { async connect() { return client; } },
  };
}

test("Polygon mint intent digest exactly matches the API canonical contract", () => {
  assert.equal(buildPolygonMintIntentDigest({
    requestId: body.request_id.toUpperCase(),
    tenantId: body.tenant_id.toUpperCase(),
    leaseId: body.lease_id.toUpperCase(),
    network: "POLYGON-AMOY",
    executionClass: "TESTNET_TRIAL",
    commercialDisposition: "non_sellable",
    issuerWallet: body.issuer_wallet.toUpperCase(),
    chipUidHash: body.chip_uid_hash.toUpperCase(),
    tokenUri: body.token_uri,
    assetRef: body.asset_ref,
  }), body.intent_digest);
});

test("first exact unexpired processing intent is atomically reserved for one dispatch", async () => {
  const harness = transactionDatabase(matchingRow());
  const reservation = await reservePolygonMintIntent(body, { database: harness.database });
  assert.equal(reservation.mode, "dispatch");
  assert.equal(reservation.input.intentDigest, body.intent_digest);
  const update = harness.calls.find((call) => typeof call === "object" && /UPDATE tokenization_requests/.test(call.text));
  assert.ok(update);
  assert.deepEqual(update.values.slice(0, 5), [
    body.request_id,
    body.tenant_id,
    body.lease_id,
    POLYGON_MINT_INTENT_VERSION,
    body.intent_digest,
  ]);
  assert.ok(harness.calls.includes("COMMIT"));
});

test("same lease and digest after dispatch is reconciliation-only and cannot update or resubmit", async () => {
  const harness = transactionDatabase(matchingRow({ dispatch_started_at: "2026-07-30T12:00:00.000Z", lease_valid: false }));
  const reservation = await reservePolygonMintIntent(body, { database: harness.database });
  assert.equal(reservation.mode, "reconcile");
  assert.equal(harness.calls.some((call) => typeof call === "object" && /UPDATE tokenization_requests/.test(call.text)), false);
  assert.ok(harness.calls.includes("COMMIT"));
});

test("expired first dispatch and conflicting canonical body both fail closed", async () => {
  const expired = transactionDatabase(matchingRow({ lease_valid: false }));
  await assert.rejects(
    reservePolygonMintIntent(body, { database: expired.database }),
    /polygon_mint_intent_not_dispatchable/,
  );

  const conflicting = transactionDatabase(matchingRow());
  await assert.rejects(
    reservePolygonMintIntent({ ...body, asset_ref: "attacker:asset" }, { database: conflicting.database }),
    /polygon_mint_intent_digest_mismatch/,
  );
});

test("durable store failures never degrade to bearer-only authorization", async () => {
  await assert.rejects(
    reservePolygonMintIntent(body, { database: { async connect() { throw new Error("offline"); } } }),
    /polygon_mint_intent_store_unavailable/,
  );
});

test("readiness proves the durable intent table columns and least required privileges", async () => {
  const result = await checkPolygonMintIntentStore({
    database: {
      async query(query) {
        assert.equal(query.values[1], 10);
        assert.deepEqual(query.values[2], [
          "public.batches",
          "public.tags",
          "public.events",
          "public.supplier_sub_batches",
          "public.supplier_orders",
          "public.supplier_pack_purpose_decisions",
        ]);
        return {
          rows: [{
            connected: true,
            table_present: true,
            columns_present: true,
            privileges_present: true,
            trigger_dependencies_present: true,
            trigger_functions_present: true,
          }],
        };
      },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.checks, {
    connectivity: true,
    table: true,
    columns: true,
    privileges: true,
    trigger_dependencies: true,
    trigger_functions: true,
  });
});
