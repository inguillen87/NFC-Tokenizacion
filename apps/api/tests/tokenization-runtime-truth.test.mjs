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
const claimIssuerUrl = new URL("../src/lib/consumer-vertical-writer-policy.ts", import.meta.url);
const claimPinRateUrl = new URL("../src/lib/ownership-claim-pin-rate-limit.ts", import.meta.url);
const schemaUrl = new URL("../src/lib/tokenization-schema.ts", import.meta.url);

test("tokenization defaults fail closed and simulation is explicit", () => {
  assert.equal(resolveTokenizationRuntimeMode(""), "disabled");
  assert.equal(resolveTokenizationRuntimeMode("off"), "disabled");
  assert.equal(resolveTokenizationRuntimeMode("unexpected"), "disabled");
  assert.equal(resolveTokenizationRuntimeMode("simulated"), "simulated");
  assert.equal(resolveTokenizationRuntimeMode("polygon"), "polygon");
});

test("simulation never persists a blockchain transaction or anchored status", async () => {
  const source = await readFile(engineUrl, "utf8");
  const anchor = source.slice(source.indexOf("export async function anchorTokenizationRequest"), source.indexOf("export async function transferBlockchainToken"));
  const simulationBranch = anchor.slice(anchor.indexOf('if (tokenizationMode === "simulated")'), anchor.indexOf('if (network !== "polygon-amoy" && network !== "polygon")'));

  assert.match(simulationBranch, /status = 'simulated'/);
  assert.match(simulationBranch, /tx_hash = NULL/);
  assert.match(simulationBranch, /token_id = NULL/);
  assert.match(simulationBranch, /anchor_hash = NULL/);
  assert.match(simulationBranch, /state: "simulated"/);
  assert.match(simulationBranch, /recordTokenizationCanonicalEvent/);
  assert.match(simulationBranch, /canonical_event_confirmed: true/);
  assert.doesNotMatch(simulationBranch, /INSERT INTO demo_cta_actions/);
  assert.doesNotMatch(simulationBranch, /status = 'anchored'/);
  assert.doesNotMatch(simulationBranch, /0x\$\{/);
});

test("legacy simulated anchors are normalized before they can be exposed", async () => {
  const source = await readFile(schemaUrl, "utf8");

  assert.match(source, /WHERE status = 'anchored'/);
  assert.match(source, /meta->>'simulated'/);
  assert.match(source, /SET status = 'simulated'/);
  assert.match(source, /tx_hash = NULL/);
  assert.match(source, /token_id = NULL/);
});

test("minting records remain tenant scoped while P2P listing and settlement are disabled", async () => {
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
  assert.match(p2pList, /p2p_listing_unavailable/);
  assert.match(p2pList, /custody_unchanged: true/);
  assert.doesNotMatch(p2pList, /INSERT INTO|UPDATE|consumeSunFreshHandoff|transferBlockchainToken/);
  assert.match(p2pBuy, /p2p_settlement_unavailable/);
  assert.match(p2pBuy, /chain_transfer_status: "not_executed"/);
  assert.doesNotMatch(p2pBuy, /transferBlockchainToken/);
});

test("public ownership PIN delegates to the real issuer with durable ordered lockout and original retry contract", async () => {
  const source = await readFile(claimUrl, "utf8");
  const policy = await readFile(claimIssuerUrl, "utf8"), durable = await readFile(claimPinRateUrl, "utf8");
  const issuer = policy.slice(policy.indexOf("export async function consumeAndAuthorizeConsumerOwnershipClaim"), policy.indexOf("export async function commitConsumerOwnershipClaim"));
  assert.match(source, /consumeAndAuthorizeConsumerOwnershipClaim\(req, body, precheck\.context, "public_claim_ownership"\)/);
  assert.match(source, /authorization: authorized\.authorization/);
  assert.match(issuer, /reserveOwnershipClaimPinAttempt/); assert.match(issuer, /releaseSuccessfulOwnershipClaimPinAttempt/);
  assert.ok(issuer.indexOf("consumeSunFreshHandoff(") < issuer.indexOf("reserveOwnershipClaimPinAttempt("));
  assert.ok(issuer.indexOf("reserveOwnershipClaimPinAttempt(") < issuer.indexOf("verifyOwnershipClaimPin({"));
  assert.match(issuer, /spent\(429, "claim_pin_locked"\)/);
  assert.match(issuer, /retryAfterSeconds: OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS/);
  assert.match(durable, /OWNERSHIP_CLAIM_PIN_WINDOW_SECONDS = 15 \* 60/); assert.match(durable, /reserveSunRateLimitLease/);
  assert.match(durable, /claim_pin_device/); assert.match(durable, /claim_pin_product/);
  assert.match(source, /retry_after_seconds: authorized\.retryAfterSeconds/);
  assert.match(source, /retry-after/);
  assert.match(source, /Demasiados intentos\. Espera 15 minutos o solicita asistencia al emisor\./);
  assert.match(issuer, /claim_pin_security_unavailable/);
});

test("anchored public responses separate historical proof from current commercial eligibility", async () => {
  const engine = await readFile(engineUrl, "utf8");
  const publicRoute = await readFile(publicRouteUrl, "utf8");

  assert.match(engine, /commercial_disposition: prepared\.commercialDisposition/);
  assert.match(engine, /commercially_eligible: String\(prepared\.commercialDisposition \|\| ""\)\.toUpperCase\(\) === "COMMERCIAL_RELEASE"/);
  assert.match(publicRoute, /commercial_disposition: commercialDisposition/);
  assert.match(publicRoute, /commercially_eligible: commerciallyEligible/);
  assert.match(publicRoute, /commercialDisposition\.toUpperCase\(\) === "COMMERCIAL_RELEASE"/);
});
