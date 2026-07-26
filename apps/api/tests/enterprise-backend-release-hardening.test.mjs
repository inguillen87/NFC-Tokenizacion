import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = async (relative) => readFile(new URL(relative, import.meta.url), "utf8");
const analytics = await source("../src/app/admin/analytics/route.ts");
const trivia = await source("../src/lib/trivia-service.ts");
const p2pList = await source("../src/app/marketplace/p2p/list/route.ts");
const p2pBuy = await source("../src/app/marketplace/p2p/buy/route.ts");
const requestToBuy = await source("../src/app/marketplace/products/[id]/request-to-buy/route.ts");
const experiences = await source("../src/app/consumer/experiences/route.ts");
const adminExperiences = await source("../src/app/admin/consumer-experiences/route.ts");
const twilio = await source("../src/app/twilio/whatsapp/inbound/route.ts");
const web3 = await source("../src/app/consumer/auth/web3/route.ts");
const ownershipService = await source("../src/lib/consumer-portal-service.ts");
const publicOwnershipClaim = await source("../src/app/public/cta/claim-ownership/route.ts");
const mobileOwnershipClaim = await source("../src/app/mobile/passport/[eventId]/consumer/claim/route.ts");
const publicCertificate = await source("../src/app/public/certificates/[eventId]/route.ts");
const publicProvenance = await source("../src/app/public/cta/provenance/route.ts");
const consumerProducts = await source("../src/app/consumer/products/route.ts");
const commercialRuntimeSchema = await source("../src/lib/commercial-runtime-schema.ts");
const dbRuntime = await source("../src/lib/db.ts");
const dbPreflight = await source("../scripts/db-enterprise-release-preflight.mjs");
const migration = await source("../db/migrations/20260726135000_0059_marketplace_claim_truth_cleanup.sql");
const migrationPostcheck = await source("../db/ops/marketplace-claim-truth-postcheck.sql");
const { DEFAULT_REQUIRED_SCHEMA_MIGRATIONS, isRuntimeDdlStatement } = await import("../src/lib/db.ts");

test("analytics uses explicit taxonomy, real active filters and source-labelled geography", () => {
  assert.doesNotMatch(analytics, /verdict IN \('tampered', 'not_registered', 'not_active'\)/);
  assert.match(analytics, /TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED/);
  assert.match(analytics, /AS unregistered/);
  assert.match(analytics, /AS inactive/);
  assert.match(analytics, /COUNT\(DISTINCT b\.id\) FILTER \(WHERE b\.status = 'active'\)::int AS active_batches/);
  assert.match(analytics, /COUNT\(DISTINCT tn\.id\) FILTER \(WHERE b\.status = 'active'\)::int AS active_tenants/);
  assert.match(analytics, /resellerPerformance: null/);
  assert.match(analytics, /resellerPerformanceSource: "billing_unavailable"/);
  assert.match(analytics, /coordinateSource/);
  assert.match(analytics, /city_centroid/);
  assert.match(analytics, /browserGpsCount === coordinateCount/);
  assert.match(analytics, /mixed_or_unknown_approx/);
  assert.match(analytics, /coordinateIsApproximate/);
  const riskExpressions = [...analytics.matchAll(/COUNT\(\*\) FILTER \(WHERE e\.result IN \(([^)]*)\)\)::int AS risk/g)];
  assert.ok(riskExpressions.length >= 8);
  for (const expression of riskExpressions) {
    assert.doesNotMatch(expression[1], /NOT_REGISTERED|NOT_ACTIVE/);
  }
  assert.match(analytics, /lifecycleClassesExcludedFromRisk: \["unregistered", "inactive"\]/);
  assert.match(analytics, /originSource: hasProductOriginCoords \? "product_passport_declared" : "first_observed_event"/);
  assert.match(analytics, /WITH scoped_events AS \([\s\S]*?WHERE e\.uid_hex IS NOT NULL[\s\S]*?e\.created_at >= now\(\) - \$\{rangeSql\}::interval[\s\S]*?e\.source = \$\{source\}::text/);
});

test("trivia completion reserves attempt, points and projections in one data-modifying CTE", () => {
  const atomicStart = trivia.indexOf("WITH locked_member AS MATERIALIZED");
  const atomicEnd = trivia.indexOf("SELECT * FROM finalized_attempt", atomicStart);
  const atomic = trivia.slice(atomicStart, atomicEnd);
  assert.ok(atomicStart > 0 && atomicEnd > atomicStart);
  for (const name of ["reserved_attempt", "reserved_ledger", "updated_member", "projected_membership", "finalized_attempt"]) {
    assert.match(atomic, new RegExp(name));
  }
  assert.doesNotMatch(trivia, /points_balance = points_balance \+/);
  assert.doesNotMatch(trivia, /await awardPoints/);
});

test("marketplace mutations are bounded, idempotent and do not reward unfulfilled demand", () => {
  assert.match(p2pList, /readBoundedJsonBody/);
  assert.match(p2pList, /consumeSunFreshHandoff/);
  assert.match(p2pList, /marketplace_p2p_list/);
  assert.match(p2pList, /ON CONFLICT DO NOTHING/);
  assert.match(migration, /uq_marketplace_p2p_active_owner_uid/);
  assert.match(migration, /uq_marketplace_active_request_consumer_product/);

  assert.match(requestToBuy, /readBoundedJsonBody/);
  assert.match(requestToBuy, /ON CONFLICT DO NOTHING/);
  assert.match(requestToBuy, /not_awarded_for_unfulfilled_request/);
  assert.doesNotMatch(requestToBuy, /awardPoints|getOrCreateMember|points_balance \+/);

  assert.match(p2pBuy, /p2p_settlement_unavailable/);
  assert.match(p2pBuy, /feature_disabled/);
  assert.doesNotMatch(p2pBuy, /transferBlockchainToken/);
});

test("experience evidence never treats INVALID as VALID and uncomputed trust remains null", () => {
  assert.match(experiences, /validatedNfcVerdicts\.has\(normalizedVerdict\)/);
  assert.doesNotMatch(experiences, /includes\(value\)/);
  assert.match(experiences, /trust_score = NULL/);
  assert.match(adminExperiences, /trust_score_status/);
  assert.match(adminExperiences, /trustScoreStatus === "computed" \? row\.trust_score : null/);
  assert.match(migration, /ALTER COLUMN trust_score DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN trust_score DROP DEFAULT/);
  assert.match(migration, /trust_score must be nullable with no default/);
  assert.match(commercialRuntimeSchema, /trust_score integer CHECK \(trust_score BETWEEN 0 AND 100\)/);
  assert.doesNotMatch(commercialRuntimeSchema, /trust_score integer NOT NULL DEFAULT 0/);
  assert.match(migrationPostcheck, /trust_score_is_nullable/);
  assert.match(migrationPostcheck, /not_computed_rows_with_numeric_score/);
});

test("voucher duplicate winner owns the code and produces no duplicate notification or email", () => {
  const duplicateReturn = twilio.indexOf("if (duplicate) {", twilio.indexOf("const effectiveCode"));
  const notification = twilio.indexOf("INSERT INTO consumer_notifications", duplicateReturn);
  const email = twilio.indexOf("const emailDelivery = await sendVoucherEmail", duplicateReturn);
  assert.ok(duplicateReturn > 0 && notification > duplicateReturn && email > notification);
  assert.match(twilio.slice(duplicateReturn, notification), /code: effectiveCode/);
  assert.match(twilio.slice(duplicateReturn, notification), /emailDelivery: String\(claimMetadata\.voucher_email_delivery/);
});

test("Web3 auth is wallet-bound, atomic and never merges a consumer by contact", () => {
  assert.match(web3, /verified_clerk_wallet_required/);
  assert.match(web3, /wallet_account_link_required/);
  assert.match(web3, /created_session AS MATERIALIZED/);
  assert.match(web3, /authenticationModel: "clerk_session_plus_verified_wallet"/);
  assert.doesNotMatch(web3, /body\.email|body\.phone|ON CONFLICT \(email\)|ON CONFLICT \(phone\)/);
  assert.doesNotMatch(web3, /status = 'verified'/);
});

test("ownership claims are explicit off-chain title records and never imply an NFT transfer", () => {
  for (const candidate of [
    ownershipService,
    publicOwnershipClaim,
    mobileOwnershipClaim,
    publicProvenance,
    consumerProducts,
  ]) {
    assert.match(candidate, /chain_transfer_status/);
    assert.match(candidate, /not_executed/);
    assert.match(candidate, /nft_transfer_executed/);
    assert.match(candidate, /on_chain_owner_verified/);
  }
  assert.match(ownershipService, /nexid_off_chain_digital_title/);
  assert.match(publicCertificate, /chainTransferStatus: "not_executed"/);
  assert.match(publicCertificate, /nftTransferExecuted: false/);
  assert.match(publicCertificate, /onChainOwnerVerified: false/);
  assert.doesNotMatch(publicOwnershipClaim, /transferBlockchainToken/);
  assert.doesNotMatch(mobileOwnershipClaim, /transferBlockchainToken/);
});

test("production request paths skip runtime DDL and require the latest migration watermark", () => {
  assert.match(dbRuntime, /isRuntimeDdlStatement/);
  assert.match(dbRuntime, /isProductionRuntime\(\) && isRuntimeDdlStatement/);
  assert.match(dbRuntime, /required_schema_migration_not_applied/);
  assert.match(dbRuntime, /20260726190000_0061_supplier_export_artifact_delivery\.sql/);
  assert.equal(DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.length, 5);
  assert.deepEqual([...DEFAULT_REQUIRED_SCHEMA_MIGRATIONS], [...DEFAULT_REQUIRED_SCHEMA_MIGRATIONS].sort());
  assert.equal(isRuntimeDdlStatement("DO $$ BEGIN CREATE TYPE unsafe AS ENUM ('a'); END $$"), true);
  assert.equal(isRuntimeDdlStatement("SELECT 1; /* request path */ ALTER TABLE tags ADD COLUMN unsafe text"), true);
  assert.equal(isRuntimeDdlStatement("SELECT 'ALTER TABLE is data, not SQL';"), false);
  assert.equal(isRuntimeDdlStatement("WITH changed AS (UPDATE tags SET status = 'active' RETURNING id) SELECT * FROM changed"), false);
  assert.match(dbPreflight, /20260726173000_0060_sdk_idempotency_operations\.sql/);
  assert.match(dbPreflight, /20260726190000_0061_supplier_export_artifact_delivery\.sql/);
  assert.match(dbPreflight, /Required enterprise migrations are missing/);
});

async function routeFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const next = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await routeFiles(next));
    else if (entry.name === "route.ts" || entry.name === "route.tsx") files.push(next);
  }
  return files;
}

test("public, mobile, consumer and auth routes have no unbounded request.json parser", async () => {
  const appRoot = fileURLToPath(new URL("../src/app", import.meta.url));
  const roots = ["public", "mobile", "consumer", "auth"].map((name) => path.join(appRoot, name));
  const offenders = [];
  for (const root of roots) {
    for (const file of await routeFiles(root)) {
      const text = await readFile(file, "utf8");
      if (/(?:req|request)\.json\(\)/.test(text)) offenders.push(path.relative(appRoot, file));
    }
  }
  assert.deepEqual(offenders, []);
});
