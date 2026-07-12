import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { resolveTokenizationRuntimeMode } = await import("../src/lib/tokenization-engine.ts");

const engineUrl = new URL("../src/lib/tokenization-engine.ts", import.meta.url);
const publicRouteUrl = new URL("../src/app/public/cta/tokenize-request/route.ts", import.meta.url);
const certificateRouteUrl = new URL("../src/app/public/certificates/[eventId]/route.ts", import.meta.url);
const consumerProductsUrl = new URL("../src/app/consumer/products/route.ts", import.meta.url);
const p2pListUrl = new URL("../src/app/marketplace/p2p/list/route.ts", import.meta.url);
const p2pBuyUrl = new URL("../src/app/marketplace/p2p/buy/route.ts", import.meta.url);
const claimUrl = new URL("../src/app/public/cta/claim-ownership/route.ts", import.meta.url);

test("tokenization defaults fail closed and simulation is explicit", () => {
  assert.equal(resolveTokenizationRuntimeMode(""), "disabled");
  assert.equal(resolveTokenizationRuntimeMode("off"), "disabled");
  assert.equal(resolveTokenizationRuntimeMode("unexpected"), "disabled");
  assert.equal(resolveTokenizationRuntimeMode("simulated"), "simulated");
  assert.equal(resolveTokenizationRuntimeMode("polygon"), "polygon");
});

test("simulation never persists a blockchain transaction or anchored status", async () => {
  const source = await readFile(engineUrl, "utf8");
  const simulationBranch = source.slice(source.indexOf('if (tokenizationMode === "simulated")'), source.indexOf('if (!String(network).toLowerCase().startsWith("polygon"))'));

  assert.match(simulationBranch, /status = 'simulated'/);
  assert.match(simulationBranch, /tx_hash = NULL/);
  assert.match(simulationBranch, /token_id = NULL/);
  assert.match(simulationBranch, /anchor_hash = NULL/);
  assert.match(simulationBranch, /'ledger_simulated'/);
  assert.doesNotMatch(simulationBranch, /status = 'anchored'/);
  assert.doesNotMatch(simulationBranch, /0x\$\{/);
});

test("minting and transfer records are tenant scoped", async () => {
  const engine = await readFile(engineUrl, "utf8");
  const publicRoute = await readFile(publicRouteUrl, "utf8");
  const certificate = await readFile(certificateRouteUrl, "utf8");
  const consumerProducts = await readFile(consumerProductsUrl, "utf8");
  const p2pList = await readFile(p2pListUrl, "utf8");
  const p2pBuy = await readFile(p2pBuyUrl, "utf8");

  assert.match(engine, /WHERE id = \$\{input\.requestId\}::uuid\s+AND tenant_id = \$\{tenantId\}::uuid/);
  assert.match(engine, /WHERE tenant_id = \$\{tenantId\}::uuid\s+AND UPPER\(uid_hex\)/);
  assert.match(publicRoute, /WHERE tenant_id = \$\{tenantId\}::uuid\s+AND batch_id = \$\{batchId\}::uuid/);
  assert.match(certificate, /AND tr\.tenant_id = e\.tenant_id/);
  assert.match(consumerProducts, /WHERE tr\.tenant_id = cp\.tenant_id\s+AND tr\.batch_id = b\.id/);
  assert.match(p2pList, /AND b\.tenant_id = \$\{ownership\.tenant_id\}::uuid/);
  assert.match(p2pBuy, /tenantId: String\(offer\.tenant_id\)/);
});

test("public ownership PIN has a durable lockout boundary", async () => {
  const source = await readFile(claimUrl, "utf8");

  assert.match(source, /readSunRateLimit\("claim_pin_device"/);
  assert.match(source, /hitSunRateLimit\("claim_pin_product"/);
  assert.match(source, /reason: "claim_pin_locked"/);
  assert.match(source, /retry-after/);
  assert.match(source, /claim_pin_security_unavailable/);
});

