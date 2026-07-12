import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const files = {
  schema: "apps/api/src/lib/commercial-runtime-schema.ts",
  auth: "apps/api/src/lib/sdk-auth.ts",
  verify: "apps/api/src/app/api/v1/sdk/verify/route.ts",
  claim: "apps/api/src/app/api/v1/sdk/claim/route.ts",
  posActivate: "apps/api/src/app/api/v1/sdk/pos/activate/route.ts",
  logisticsShared: "apps/api/src/app/api/v1/logistics/_shared.ts",
  logisticsSealApply: "apps/api/src/app/api/v1/logistics/seal-apply/route.ts",
  logisticsHandoff: "apps/api/src/app/api/v1/logistics/handoff/route.ts",
  logisticsRecipientVerify: "apps/api/src/app/api/v1/logistics/recipient-verify/route.ts",
  products: "apps/api/src/app/api/v1/sdk/products/[bid]/route.ts",
  events: "apps/api/src/app/api/v1/sdk/events/route.ts",
  webhooks: "apps/api/src/lib/sdk-webhooks.ts",
  apiKeysAdmin: "apps/api/src/app/admin/sdk/api-keys/route.ts",
  claimPolicyAdmin: "apps/api/src/app/admin/sdk/claim-policy/route.ts",
  sdk: "packages/sdk/src/index.ts",
  sdkPackage: "packages/sdk/package.json",
  publicSdkPage: "apps/web/src/app/sdk/page.tsx",
  publicSdkContract: "apps/web/src/lib/sdk-public-contract.ts",
  dashboardSdkPage: "apps/dashboard/src/app/(app)/sdk-vision/page.tsx",
  dashboardSdkGuide: "apps/dashboard/src/app/(app)/sdk-vision/interactive-guide.tsx",
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
  assert.match(schema, /CREATE TABLE IF NOT EXISTS sdk_usage_logs/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS sdk_pos_activations/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS sdk_claim_requests/);
  assert.match(schema, /pos_activation_id/);
  assert.match(schema, /pos_validated/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS sdk_external_events/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS webhook_endpoints/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS webhook_deliveries/);
});

test("sdk auth requires x-nexid-api-key, hashes secrets, scopes access, usage logs, and never compares raw keys in SQL", () => {
  const auth = read(files.auth);
  assert.match(auth, /x-nexid-api-key/);
  assert.match(auth, /createHash\("sha256"\)/);
  assert.match(auth, /key_hash = \$\{keyHash\}/);
  assert.match(auth, /sdk_scope_denied/);
  assert.match(auth, /"sdk:pos"/);
  assert.match(auth, /"sdk:logistics"/);
  assert.match(auth, /logSdkUsage/);
  assert.match(auth, /sdk_usage_logs/);
  assert.doesNotMatch(auth, /WHERE\s+k\.(?:api_key|secret|token)\s*=\s*\$\{rawKey\}/i);
});

test("sdk protected routes expose verify, POS activation, claim, products and external events", () => {
  const verify = read(files.verify);
  const claim = read(files.claim);
  const posActivate = read(files.posActivate);
  const products = read(files.products);
  const events = read(files.events);
  assert.match(verify, /authenticateSdkRequest\(req, "sdk:verify"\)/);
  assert.match(verify, /processSunScan/);
  assert.match(verify, /batch_not_found_for_tenant/);
  assert.match(verify, /dispatchTenantWebhooks/);
  assert.match(claim, /authenticateSdkRequest\(req, "sdk:claim"\)/);
  assert.match(claim, /pin_required/);
  assert.match(claim, /pos_token_required_or_invalid/);
  assert.match(claim, /hasPhysicalTagIdentity/);
  assert.match(claim, /pending_verification/);
  assert.match(claim, /sdk\.claim\.claimed/);
  assert.match(posActivate, /authenticateSdkRequest\(req, "sdk:pos"\)/);
  assert.match(posActivate, /sdk_pos_activations/);
  assert.match(posActivate, /nxpos_/);
  assert.match(posActivate, /sdk\.pos\.activated/);
  assert.match(products, /authenticateSdkRequest\(req, "sdk:products"\)/);
  assert.match(events, /authenticateSdkRequest\(req, "sdk:events"\)/);
  assert.match(events, /sdk_external_events/);
  assert.match(events, /sdk\.external_event/);
  for (const route of [verify, claim, posActivate, products, events]) {
    assert.match(route, /logSdkUsage/);
  }
});

test("logistics v1 routes use SDK auth and derive tenant from the API key", () => {
  const shared = read(files.logisticsShared);
  const sealApply = read(files.logisticsSealApply);
  const handoff = read(files.logisticsHandoff);
  const recipientVerify = read(files.logisticsRecipientVerify);

  assert.match(shared, /authenticateSdkRequest\(req,\s*"sdk:logistics"\)/);
  assert.match(shared, /tenant_body_mismatch/);
  for (const route of [sealApply, handoff, recipientVerify]) {
    assert.match(route, /authenticateLogisticsRequest\(req,/);
    assert.match(route, /rejectBodyTenantMismatch\(body,\s*auth\.context\)/);
    assert.match(route, /tenantId:\s*auth\.context\.tenantId/);
    assert.match(route, /logLogisticsUsage/);
    assert.doesNotMatch(route, /const\s*{\s*[^}]*tenantId[^}]*}\s*=\s*body/);
  }
});

test("admin SDK console can issue keys, set claim policy and dispatch signed webhooks without leaking secrets", () => {
  const webhooks = read(files.webhooks);
  const apiKeysAdmin = read(files.apiKeysAdmin);
  const claimPolicyAdmin = read(files.claimPolicyAdmin);
  assert.match(webhooks, /createHmac\("sha256"/);
  assert.match(webhooks, /x-nexid-signature/);
  assert.match(webhooks, /webhook_deliveries/);
  assert.match(apiKeysAdmin, /generateSdkKey/);
  assert.match(apiKeysAdmin, /hashSdkApiKey/);
  assert.match(apiKeysAdmin, /parseSdkApiKeyScopes\(body\.scopes\)/);
  assert.doesNotMatch(apiKeysAdmin, /DEFAULT_SCOPES/);
  assert.match(claimPolicyAdmin, /claimRequiresPos/);
  assert.match(claimPolicyAdmin, /claim_pin_hash/);
});

test("internal server SDK is typed, private and maps to the protected gateway", () => {
  const sdk = read(files.sdk);
  const packageConfig = JSON.parse(read(files.sdkPackage));
  assert.equal(packageConfig.name, "@product/nexid-server-sdk");
  assert.equal(packageConfig.private, true);
  assert.match(sdk, /cannot run in a browser/);
  assert.match(sdk, /https:\/\/api\.nexid\.lat/);
  assert.doesNotMatch(sdk, /sandbox\.api\.nexid\.lat/);
  assert.match(sdk, /export class NexIdClient/);
  assert.match(sdk, /verifyTap\(params: VerifyTapRequest\)/);
  assert.match(sdk, /claimOwnership\(params: ClaimOwnershipRequest\)/);
  assert.match(sdk, /posToken\?: string/);
  assert.match(sdk, /getProduct\(bid: string\)/);
  assert.match(sdk, /reportEvent\(params: ExternalEventRequest\)/);
  assert.match(sdk, /activatePosPurchase\(params: PosActivationRequest\)/);
  assert.match(sdk, /applyDeliverySeal\(params: LogisticsSealApplyRequest\)/);
  assert.match(sdk, /handoffDeliverySeal\(params: LogisticsHandoffRequest\)/);
  assert.match(sdk, /verifyDeliverySeal\(params: LogisticsRecipientVerifyRequest\)/);
  assert.match(sdk, /\/api\/v1\/sdk\/verify/);
  assert.match(sdk, /\/api\/v1\/sdk\/claim/);
  assert.match(sdk, /\/api\/v1\/sdk\/products\/\$\{encodeURIComponent\(bid\)\}/);
  assert.match(sdk, /\/api\/v1\/sdk\/events/);
  assert.match(sdk, /\/api\/v1\/sdk\/pos\/activate/);
  assert.match(sdk, /\/api\/v1\/logistics\/seal-apply/);
  assert.match(sdk, /\/api\/v1\/logistics\/handoff/);
  assert.match(sdk, /\/api\/v1\/logistics\/recipient-verify/);
});

test("SDK product surfaces publish an honest server-side REST contract", () => {
  const publicPage = read(files.publicSdkPage);
  const publicContract = read(files.publicSdkContract);
  const dashboardPage = read(files.dashboardSdkPage);
  const dashboardGuide = read(files.dashboardSdkGuide);
  for (const surface of [publicPage, dashboardPage, dashboardGuide]) {
    assert.doesNotMatch(surface, /npm (?:i|install) @nexid\/sdk/);
    assert.doesNotMatch(surface, /Live Demo/);
    assert.doesNotMatch(surface, /más de un 15%/);
  }
  assert.match(publicPage, /NEXID_SDK_VERIFY_URL/);
  assert.match(publicContract, /NEXID_SDK_VERIFY_ROUTE = "\/api\/v1\/sdk\/verify"/);
  assert.match(publicContract, /NEXID_SDK_VERIFY_REQUIRED_FIELDS = \["bid", "picc_data", "enc", "cmac"\]/);
  assert.match(publicPage, /La API key nunca viaja al navegador/);
  assert.doesNotMatch(publicPage, /API Status/);
  assert.match(dashboardPage, /paquete público todavía no fue publicado por nexID/);
  assert.match(dashboardGuide, /SIMULACIÓN DE CONTRATO/);
  assert.match(dashboardGuide, /La API key no aparece en la app del consumidor/);
});
