import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { classifyTokenizationExecutionClass } = await import("../src/lib/tokenization-schema.ts");

const source = async (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("execution class is derived from server-approved network semantics", () => {
  assert.equal(classifyTokenizationExecutionClass("simulation"), "simulation");
  assert.equal(classifyTokenizationExecutionClass("polygon-amoy"), "testnet_trial");
  assert.equal(classifyTokenizationExecutionClass("ethereum-sepolia"), "testnet_trial");
  assert.equal(classifyTokenizationExecutionClass("base-sepolia"), "testnet_trial");
  assert.equal(classifyTokenizationExecutionClass("polygon"), "live_chain");
  assert.equal(classifyTokenizationExecutionClass("ethereum-mainnet"), "live_chain");
  assert.equal(classifyTokenizationExecutionClass("base-mainnet"), "live_chain");
  assert.equal(classifyTokenizationExecutionClass("polygon-amoy", { simulated: true }), "simulation");
  assert.equal(classifyTokenizationExecutionClass("caller-invented-chain"), null);
});

test("tokenization compatibility schema exposes composite event identity without a partition-invalid simple event FK", async () => {
  const schema = await source("../src/lib/tokenization-schema.ts");

  assert.match(schema, /tag_id uuid REFERENCES tags\(id\) ON DELETE RESTRICT/);
  assert.match(schema, /source_event_id bigint/);
  assert.match(schema, /source_event_created_at timestamptz/);
  assert.match(schema, /execution_class text NOT NULL DEFAULT 'legacy_unclassified'/);
  const gate = schema.slice(schema.indexOf("export async function ensureTokenizationCommercialScopeSchema"));
  assert.match(gate, /FROM schema_migrations/);
  assert.match(gate, /nexid_prepare_tokenization_execution_v1\(uuid,uuid,uuid,text,integer\)/);
  assert.match(gate, /lease_id/);
  assert.doesNotMatch(gate, /ensureTokenizationRequestsSchema\(\)/);
  assert.doesNotMatch(schema, /source_event_id bigint REFERENCES events\(id\)/);
});

test("public physical CTA derives immutable tag, event and trial class server-side", async () => {
  const route = await source("../src/app/public/cta/tokenize-request/route.ts");

  assert.match(route, /requestedNetworkHint && requestedNetworkHint !== "polygon-amoy"/);
  assert.match(route, /ledgerNetwork = runtimeMode === "simulated" \? "simulation" : "polygon-amoy"/);
  assert.match(route, /JOIN tags tag[\s\S]*?tag\.batch_id = event\.batch_id[\s\S]*?UPPER\(tag\.uid_hex\) = UPPER\(event\.uid_hex\)/);
  assert.match(route, /event\.created_at AS source_event_created_at/);
  assert.match(route, /tenant_id, batch_id, tag_id, source_event_id, source_event_created_at, bid, uid_hex, execution_class/);
  assert.match(route, /TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED/);
  assert.ok(route.indexOf("ensureTokenizationCommercialScopeSchema()") < route.indexOf("hasClaimedOwnership({"));
  assert.match(route, /status IN \('pending', 'processing', 'reconciling'/);
  assert.match(route, /ON CONFLICT DO NOTHING[\s\S]*tokenization_request_creation_conflict/);
  assert.doesNotMatch(route, /body\.(asset_ref|anchor_hash|ledger_ref|last_anchor_at)/);
  assert.doesNotMatch(route, /body\.execution_class|body\.executionClass/);
  assert.doesNotMatch(route, /LEDGER_NETWORK_ALLOWED/);
});

test("valid SUN auto-tokenization preserves the verifier and writes normalized server identity", async () => {
  const route = await source("../src/app/sun/route.ts");
  const queueStart = route.indexOf("async function queueAutoTokenizationForValidTap");
  const queueEnd = route.indexOf("export async function GET", queueStart);
  const queue = route.slice(queueStart, queueEnd);

  assert.match(route, /processSunScan/);
  assert.match(queue, /ensureTokenizationCommercialScopeSchema/);
  assert.match(queue, /e\.created_at AS source_event_created_at, tag\.id AS tag_id/);
  assert.match(queue, /JOIN tags tag ON tag\.batch_id = e\.batch_id AND UPPER\(tag\.uid_hex\) = UPPER\(e\.uid_hex\)/);
  assert.match(queue, /tag_id, source_event_id, source_event_created_at, bid, uid_hex, execution_class/);
  assert.match(queue, /targetNetwork = runtimeMode === "simulated" \? "simulation" : "polygon-amoy"/);
  assert.match(queue, /status IN \('pending', 'processing', 'reconciling'/);
  assert.match(queue, /ON CONFLICT DO NOTHING[\s\S]*tokenization_request_creation_conflict/);
  assert.doesNotMatch(queue, /params\.(tagId|executionClass|sourceEventCreatedAt)/);
});

test("SUN simulator persists only simulation evidence and never dispatches a chain anchor", async () => {
  const route = await source("../src/app/sun/simulate/route.ts");

  assert.match(route, /source_event_id, source_event_created_at/);
  assert.match(route, /'simulation',\s*'simulated',\s*'simulation'/);
  assert.match(route, /state: "simulated"/);
  assert.match(route, /runtimeMode: "simulated"/);
  assert.match(route, /TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED/);
  assert.doesNotMatch(route, /anchorTokenizationRequest/);
  assert.doesNotMatch(route, /'live_chain'/);
});

test("P2P listing binds the exact ownership and requires commercial release", async () => {
  const route = await source("../src/app/marketplace/p2p/list/route.ts");
  const publicCatalog = await source("../src/app/marketplace/offers/route.ts");

  assert.match(route, /requireCommercialAssetScopeSchema\(\)/);
  assert.doesNotMatch(route, /ensureConsumerPortalSchema\(\)/);
  assert.match(route, /batch\.id AS batch_id/);
  assert.match(route, /nexid_assert_supplier_commercial_release_v1/);
  assert.match(route, /tenant_id,\s*ownership_id,\s*marketplace_product_id/);
  assert.match(route, /ownership\.tenant_id,\s*ownership\.id,\s*NULL/);
  assert.match(route, /AND ownership_id = \$\{evidence\.ownership_id\}/);
  assert.match(route, /custody_unchanged: true/);
  assert.doesNotMatch(route, /body\.ownership_id|body\.ownershipId/);
  assert.match(publicCatalog, /o\.type <> 'p2p_resale'[\s\S]*consumer_product_ownerships ownership/);
  assert.match(publicCatalog, /ownership\.status = 'claimed'/);
  assert.match(publicCatalog, /tag\.status::text = 'active'/);
  assert.match(publicCatalog, /batch\.status::text IN \('active', 'active_in_market'\)/);
  assert.match(publicCatalog, /event\.cmac_ok IS TRUE[\s\S]*event\.allowlisted IS TRUE[\s\S]*COALESCE\(event\.result/);
  assert.match(publicCatalog, /supplier_sub_batches supplier_sub_batch/);
});

test("request-to-buy records full physical attribution or a valid generic lead, never partial custody", async () => {
  const route = await source("../src/app/marketplace/products/[id]/request-to-buy/route.ts");

  assert.ok(route.indexOf("requireCommercialAssetScopeSchema()") < route.indexOf("getConsumerFromRequest(req)"));
  assert.doesNotMatch(route, /ensureConsumerPortalSchema|ensureOrderRequestsSchema/);
  assert.match(route, /e\.created_at AS event_created_at/);
  assert.match(route, /tag\.id AS tag_id/);
  assert.match(route, /JOIN batches b ON b\.id = e\.batch_id AND b\.tenant_id = e\.tenant_id/);
  assert.match(route, /AND e\.tenant_id = \$\{record\.tenant_id\}::uuid/);
  assert.match(route, /source_tap_event_id,\s*source_tap_event_created_at,\s*source_tag_id/);
  assert.match(route, /attribution_mode: "attribution_only"/);
  assert.match(route, /attribution_mode: "generic"/);
  assert.match(route, /marketplace_source_attribution_mismatch/);
  assert.match(route, /hasAttributionTuple && isCommercialAssetScopeSchemaError/);
  assert.match(route, /INSERT INTO order_requests \(tenant_id, locale/);
  assert.match(route, /WITH created_request AS \([\s\S]*created_crm_request AS \([\s\S]*FROM created_request/);
  assert.doesNotMatch(route, /if \(created\) await sql/);
  assert.doesNotMatch(route, /nexid_assert_supplier_commercial_release_v1/);
  assert.doesNotMatch(route, /body\.(source_tag_id|sourceTagId|ownership_id|ownershipId)/);
});
