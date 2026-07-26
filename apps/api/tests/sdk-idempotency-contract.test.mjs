import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  canonicalSdkRequestJson,
  decryptSdkIdempotencyResponseBody,
  encryptSdkIdempotencyResponseBody,
  hashCanonicalSdkRequest,
  matchesStoredRequestHash,
} from "../src/app/api/v1/sdk/_idempotency.ts";

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("canonical SDK request hashes ignore object key order but bind tenant, route and payload", () => {
  const masterKey = Buffer.alloc(32, 0x42);
  const first = { eventType: "shipment.received", data: { count: 2, flags: ["a", "b"] }, bid: "LOT-1" };
  const reordered = { bid: "LOT-1", data: { flags: ["a", "b"], count: 2 }, eventType: "shipment.received" };
  assert.equal(canonicalSdkRequestJson(first), canonicalSdkRequestJson(reordered));

  const common = { tenantId: "tenant-a", route: "/api/v1/sdk/events", masterKey };
  const digest = hashCanonicalSdkRequest({ ...common, body: first });
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, hashCanonicalSdkRequest({ ...common, body: reordered }));
  assert.notEqual(digest, hashCanonicalSdkRequest({ ...common, body: { ...first, bid: "LOT-2" } }));
  assert.notEqual(digest, hashCanonicalSdkRequest({ ...common, tenantId: "tenant-b", body: first }));
  assert.notEqual(digest, hashCanonicalSdkRequest({ ...common, route: "/api/v1/sdk/claim", body: first }));
});

test("migration scopes keys by tenant and route, encrypts replay bodies and links business records", async () => {
  const migration = await read("../db/migrations/20260726173000_0060_sdk_idempotency_operations.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sdk_idempotency_operations/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS uq_sdk_idempotency_tenant_route_key[\s\S]*tenant_id, route, idempotency_key/);
  assert.match(migration, /response_body_ciphertext text/);
  assert.doesNotMatch(migration, /response_body\s+jsonb/);
  assert.match(migration, /state IN \('processing', 'completed', 'failed', 'uncertain'\)/);
  assert.match(migration, /sdk_idempotency_operation_id/);
  assert.match(migration, /sdk_claim_requests[\s\S]*idempotency_operation_id/);
  assert.match(migration, /sdk_external_events[\s\S]*idempotency_operation_id/);
  assert.match(migration, /sdk_pos_activations[\s\S]*idempotency_operation_id/);
  const operationTable = migration.indexOf("CREATE TABLE IF NOT EXISTS sdk_idempotency_operations");
  for (const prerequisite of ["tenant_api_keys", "sdk_pos_activations", "sdk_claim_requests", "sdk_external_events"]) {
    const prerequisiteTable = migration.indexOf(`CREATE TABLE IF NOT EXISTS ${prerequisite}`);
    assert.ok(prerequisiteTable >= 0, `missing clean-schema prerequisite ${prerequisite}`);
    assert.ok(prerequisiteTable < operationTable, `${prerequisite} must exist before the idempotency table/ALTERs`);
  }
});

test("the full ordered migration set never requires tenant_api_keys before it is materialized", async () => {
  const migrationDirectory = new URL("../db/migrations/", import.meta.url);
  const files = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
  let tableMaterialized = false;
  let sawCanonicalCreate = false;

  for (const file of files) {
    const source = await readFile(new URL(file, migrationDirectory), "utf8");
    const statements = [...source.matchAll(/CREATE TABLE IF NOT EXISTS tenant_api_keys|ALTER TABLE(?: IF EXISTS)? tenant_api_keys/g)];
    for (const statement of statements) {
      if (statement[0].startsWith("CREATE TABLE")) {
        tableMaterialized = true;
        sawCanonicalCreate = true;
        continue;
      }
      if (!tableMaterialized) {
        assert.match(statement[0], /ALTER TABLE IF EXISTS/, `${file} must tolerate a clean database`);
      }
    }
  }

  assert.ok(sawCanonicalCreate, "ordered migrations must eventually materialize tenant_api_keys");
});

test("versioned replay envelopes survive active-key rotation and reject unknown key IDs", () => {
  const names = [
    "SDK_IDEMPOTENCY_MASTER_KEY_HEX",
    "SDK_IDEMPOTENCY_MASTER_KEY_ID",
    "SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON",
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const oldKey = "11".repeat(32);
  const newKey = "22".repeat(32);
  const operation = {
    tenant_id: "00000000-0000-4000-8000-000000000001",
    route: "/api/v1/sdk/pos/activate",
    idempotency_key: "pos-order-42",
    request_hash: "ab".repeat(32),
  };

  try {
    process.env.SDK_IDEMPOTENCY_MASTER_KEY_HEX = oldKey;
    process.env.SDK_IDEMPOTENCY_MASTER_KEY_ID = "sdk_2026_07";
    delete process.env.SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON;
    const oldRequestHash = hashCanonicalSdkRequest({
      tenantId: operation.tenant_id,
      route: operation.route,
      body: { externalOrderId: "order-42", bid: "LOT-42" },
    });
    const envelope = encryptSdkIdempotencyResponseBody('{"posToken":"one-time-secret"}', operation);
    assert.match(envelope, /^v2\.sdk_2026_07\./);

    process.env.SDK_IDEMPOTENCY_MASTER_KEY_HEX = newKey;
    process.env.SDK_IDEMPOTENCY_MASTER_KEY_ID = "sdk_2026_08";
    process.env.SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON = JSON.stringify({ sdk_2026_07: oldKey });
    assert.equal(
      decryptSdkIdempotencyResponseBody(envelope, operation),
      '{"posToken":"one-time-secret"}',
    );
    const rotatedRequestHash = hashCanonicalSdkRequest({
      tenantId: operation.tenant_id,
      route: operation.route,
      body: { bid: "LOT-42", externalOrderId: "order-42" },
    });
    assert.notEqual(rotatedRequestHash, oldRequestHash);
    assert.equal(matchesStoredRequestHash({
      tenantId: operation.tenant_id,
      route: operation.route,
      body: { bid: "LOT-42", externalOrderId: "order-42" },
      activeRequestHash: rotatedRequestHash,
      storedRequestHash: oldRequestHash,
    }), true);

    const unknownKidEnvelope = envelope.replace(".sdk_2026_07.", ".sdk_retired.");
    assert.throws(
      () => decryptSdkIdempotencyResponseBody(unknownKidEnvelope, operation),
      /sdk_idempotency_response_key_unknown/,
    );
    delete process.env.SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON;
    assert.throws(
      () => decryptSdkIdempotencyResponseBody(envelope, operation),
      /sdk_idempotency_response_key_unknown/,
    );
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

test("runtime contract is fail-closed, exact-replay capable and never stores one-time responses in plaintext", async () => {
  const helper = await read("../src/app/api/v1/sdk/_idempotency.ts");
  assert.match(helper, /SDK_IDEMPOTENCY_MASTER_KEY_HEX/);
  assert.match(helper, /createHmac\("sha256"/);
  assert.match(helper, /createCipheriv\("aes-256-gcm"/);
  assert.match(helper, /cipher\.setAAD\(responseAad\(operation, keyring\.activeKeyId\)\)/);
  assert.match(helper, /SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON/);
  assert.match(helper, /sdk_idempotency_response_key_unknown/);
  assert.match(helper, /matchesStoredRequestHash/);
  assert.match(helper, /idempotency_key_payload_mismatch/);
  assert.match(helper, /idempotency_operation_in_progress/);
  assert.match(helper, /idempotency_operation_outcome_uncertain/);
  assert.match(helper, /decryptSdkIdempotencyResponseBody\(operation\.response_body_ciphertext/);
  assert.match(helper, /x-nexid-idempotent-replay/);
  assert.match(helper, /readRequestTextBounded\(req, MAX_MUTATION_BODY_BYTES\)/);
  assert.match(helper, /repairSdkWebhookOutbox/);
  assert.match(helper, /enqueueSdkWebhookGuaranteed/);
  assert.match(helper, /reconciliation_status = \$\{reconciliation\.status\}/);
  assert.doesNotMatch(helper, /response_body\s*=/);
});

test("all guaranteed SDK mutations enter the durable guard before their business write", async () => {
  const routes = [
    ["../src/app/api/v1/sdk/verify/route.ts", "verifyTap", /UPDATE events event[\s\S]*sdk_idempotency_operation_id/],
    ["../src/app/api/v1/sdk/claim/route.ts", "claimOwnership", /sdk_claim_requests[\s\S]*idempotency_operation_id/],
    ["../src/app/api/v1/sdk/events/route.ts", "reportEvent", /sdk_external_events[\s\S]*idempotency_operation_id/],
    ["../src/app/api/v1/sdk/pos/activate/route.ts", "activatePosPurchase", /sdk_pos_activations[\s\S]*idempotency_operation_id/],
  ];
  for (const [path, operation, linkage] of routes) {
    const source = await read(path);
    assert.match(source, /readSdkMutationBody\(req, auth\.context\.traceId\)/, path);
    assert.match(source, /runSdkIdempotentMutation\(/, path);
    assert.match(source, new RegExp(`SDK_IDEMPOTENCY_OPERATIONS\\.${operation}\\.route`), path);
    assert.match(source, linkage, path);
    assert.doesNotMatch(source, /await req\.json\(/, path);
  }
  const verify = await read("../src/app/api/v1/sdk/verify/route.ts");
  const helper = await read("../src/app/api/v1/sdk/_idempotency.ts");
  assert.match(verify, /sdk_idempotency_operation_id: idempotencyOperationId/);
  assert.match(helper, /event\.meta->>'sdk_idempotency_operation_id' = \$\{operationId\}/);
});

test("status and reconciliation require original-route scope and never re-execute a mutation", async () => {
  const route = await read("../src/app/api/v1/sdk/idempotency/status/route.ts");
  const helper = await read("../src/app/api/v1/sdk/_idempotency.ts");
  assert.match(route, /authenticateSdkRequest\(req, definition\.scope\)/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /readSdkIdempotencyStatus/);
  assert.match(route, /req\.headers\.get\("idempotency-key"\)/);
  assert.match(route, /never re-executes the original mutation/);
  assert.match(helper, /discoverLinkedResource/);
  assert.match(helper, /do_not_use_a_new_key/);
  assert.doesNotMatch(route, /runSdkIdempotentMutation/);
});
