import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const files = {
  schema: "apps/api/src/lib/commercial-runtime-schema.ts",
  auth: "apps/api/src/lib/sdk-auth.ts",
  verify: "apps/api/src/app/api/v1/sdk/verify/route.ts",
  claim: "apps/api/src/app/api/v1/sdk/claim/route.ts",
  products: "apps/api/src/app/api/v1/sdk/products/[bid]/route.ts",
  events: "apps/api/src/app/api/v1/sdk/events/route.ts",
  sdk: "packages/sdk/src/index.ts",
};

function read(path) {
  return readFileSync(path, "utf8");
}

test("sdk runtime schema stores API keys by hash and includes activation policy", () => {
  const schema = read(files.schema);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS tenant_api_keys/);
  assert.match(schema, /key_hash text NOT NULL UNIQUE|uq_tenant_api_keys_hash/);
  assert.match(schema, /active_for_claim/);
  assert.match(schema, /claim_pin_required/);
  assert.match(schema, /hash_pin/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS sdk_claim_requests/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS sdk_external_events/);
});

test("sdk auth requires x-nexid-api-key, hashes secrets, scopes access, and never compares raw keys in SQL", () => {
  const auth = read(files.auth);
  assert.match(auth, /x-nexid-api-key/);
  assert.match(auth, /createHash\("sha256"\)/);
  assert.match(auth, /key_hash = \$\{keyHash\}/);
  assert.match(auth, /sdk_scope_denied/);
  assert.doesNotMatch(auth, /WHERE\s+k\.(?:api_key|secret|token)\s*=\s*\$\{rawKey\}/i);
});

test("sdk protected routes expose verify, claim, products and external events", () => {
  const verify = read(files.verify);
  const claim = read(files.claim);
  const products = read(files.products);
  const events = read(files.events);
  assert.match(verify, /authenticateSdkRequest\(req, "sdk:verify"\)/);
  assert.match(verify, /processSunScan/);
  assert.match(verify, /batch_not_found_for_tenant/);
  assert.match(claim, /authenticateSdkRequest\(req, "sdk:claim"\)/);
  assert.match(claim, /pin_required/);
  assert.match(claim, /pending_verification/);
  assert.match(products, /authenticateSdkRequest\(req, "sdk:products"\)/);
  assert.match(events, /authenticateSdkRequest\(req, "sdk:events"\)/);
  assert.match(events, /sdk_external_events/);
});

test("@nexid/sdk client is typed and maps to the protected gateway", () => {
  const sdk = read(files.sdk);
  assert.match(sdk, /export class NexIdClient/);
  assert.match(sdk, /verifyTap\(params: VerifyTapRequest\)/);
  assert.match(sdk, /claimOwnership\(params: ClaimOwnershipRequest\)/);
  assert.match(sdk, /getProduct\(bid: string\)/);
  assert.match(sdk, /reportEvent\(params: ExternalEventRequest\)/);
  assert.match(sdk, /\/api\/v1\/sdk\/verify/);
  assert.match(sdk, /\/api\/v1\/sdk\/claim/);
  assert.match(sdk, /\/api\/v1\/sdk\/products\/\$\{encodeURIComponent\(bid\)\}/);
  assert.match(sdk, /\/api\/v1\/sdk\/events/);
});

