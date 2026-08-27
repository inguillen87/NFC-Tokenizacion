import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = async (relative) => readFile(new URL(relative, import.meta.url), "utf8");
const analytics = await source("../src/app/admin/analytics/route.ts");
const alerts = await source("../src/app/admin/alerts/route.ts");
const securityAlerts = await source("../src/app/admin/security-alerts/route.ts");
const overview = await source("../src/app/admin/overview/route.ts");
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
const healthRoute = await source("../src/app/health/route.ts");
const migration = await source("../db/migrations/20260726135000_0059_marketplace_claim_truth_cleanup.sql");
const migrationPostcheck = await source("../db/ops/marketplace-claim-truth-postcheck.sql");
const {
  DEFAULT_REQUIRED_SCHEMA_MIGRATION,
  DEFAULT_REQUIRED_SCHEMA_MIGRATIONS,
  isRuntimeDdlStatement,
  isValidSchemaMigrationId,
} = await import("../src/lib/db.ts");

test("health reports process liveness without fabricating dependency or documentation health", () => {
  assert.match(healthRoute, /check:\s*"process_liveness"/);
  assert.match(healthRoute, /"Cache-Control":\s*"no-store, max-age=0"/);
  assert.match(healthRoute, /"X-Content-Type-Options":\s*"nosniff"/);
  assert.doesNotMatch(healthRoute, /modules:\s*\[/);
  assert.doesNotMatch(healthRoute, /docs:\s*\{/);
});

test("analytics uses explicit taxonomy, real active filters and source-labelled geography", () => {
  assert.match(analytics, /checkAdminWithPermission\(req, "analytics:read"\)/);
  assert.match(analytics, /checkAdminPermission\(req, "events\.read_sensitive"\)/);
  assert.doesNotMatch(analytics, /verdict IN \('tampered', 'not_registered', 'not_active'\)/);
  assert.match(analytics, /TAMPER','TAMPER_RISK','TAMPER_UNVERIFIED','TAMPERED/);
  assert.match(analytics, /AS unregistered/);
  assert.match(analytics, /AS inactive/);
  assert.match(analytics, /COUNT\(DISTINCT b\.id\) FILTER \(WHERE b\.status = 'active'\)::int AS active_batches/);
  assert.match(analytics, /COUNT\(DISTINCT tn\.id\) FILTER \(WHERE b\.status = 'active'\)::int AS active_tenants/);
  assert.match(analytics, /resellerPerformance: null/);
  assert.match(analytics, /resellerPerformanceSource: "billing_unavailable"/);
  assert.match(analytics, /coordinateSource/);
  assert.doesNotMatch(analytics, /city_centroid|KNOWN_CITY_COORDS|cityCoords/);
  assert.match(analytics, /coordinateEvidence: coordinateCount > 0 \? "persisted_event" : "none"/);
  assert.match(analytics, /Number\(row\.coordinate_count \|\| 0\) <= 0 \|\| !coordinate/);
  assert.match(analytics, /browserGpsCount === coordinateCount/);
  assert.match(analytics, /browser_gps_approximate_consent/);
  assert.match(analytics, /mixed_or_unknown_approx/);
  assert.match(analytics, /coordinateIsApproximate/);
  const riskExpressions = [...analytics.matchAll(/COUNT\(\*\) FILTER \(WHERE e\.result IN \(([^)]*)\)\)::int AS risk/g)];
  assert.ok(riskExpressions.length >= 8);
  for (const expression of riskExpressions) {
    assert.doesNotMatch(expression[1], /NOT_REGISTERED|NOT_ACTIVE/);
  }
  assert.match(analytics, /lifecycleClassesExcludedFromRisk: \["unregistered", "inactive"\]/);
  assert.match(analytics, /originSource: hasProductOriginCoords \? "product_passport_declared" : "first_observed_event"/);
  assert.match(analytics, /AVG\(CASE[\s\S]*?e\.lat BETWEEN -90 AND 90 AND e\.lng BETWEEN -180 AND 180/);
  assert.match(analytics, /validCoordinatePair\(row\.lat, row\.lng\)/);
  assert.doesNotMatch(analytics, /AVG\(COALESCE\(e\.lat, e\.geo_lat\)\)/);
  assert.match(analytics, /WITH scoped_events AS \([\s\S]*?WHERE e\.uid_hex IS NOT NULL[\s\S]*?e\.created_at >= now\(\) - \$\{rangeSql\}::interval[\s\S]*?e\.source::text = \$\{source\}/);
});

test("alert reads require audit and sensitive-event capabilities", () => {
  for (const alertSource of [alerts, securityAlerts]) {
    assert.match(alertSource, /checkAdminWithPermission\(req, "audit\.read"\)/);
    assert.match(alertSource, /checkAdminPermission\(req, "events\.read_sensitive"\)/);
  }
});

test("overview uses the canonical risk taxonomy and excludes lifecycle outcomes", () => {
  assert.match(overview, /classified_events AS MATERIALIZED/);
  assert.match(overview, /COUNT\(\*\) FILTER \(WHERE event_class = 'invalid'\)::int AS invalid/);
  assert.match(overview, /COUNT\(\*\) FILTER \(WHERE event_class = 'tampered'\)::int AS tamper/);
  assert.match(overview, /invalid: stats\.invalid/);
  assert.match(overview, /lifecycleClassesExcludedFromRisk: \["unregistered", "inactive", "unknown_batch", "lifecycle"\]/);
  assert.doesNotMatch(overview, /Math\.max\(Number\(stats\.scans[\s\S]*Number\(stats\.valid/);
  const tamperCounts = [...overview.matchAll(/FILTER \(WHERE event_class = 'tampered'\)/g)];
  assert.equal(tamperCounts.length, 2);
});

test("trivia completion reserves attempt, points and projections in one data-modifying CTE", () => {
  const atomicStart = trivia.indexOf("WITH tap_rights AS MATERIALIZED");
  const atomicEnd = trivia.indexOf("SELECT * FROM finalized_attempt", atomicStart);
  const atomic = trivia.slice(atomicStart, atomicEnd);
  assert.ok(atomicStart > 0 && atomicEnd > atomicStart);
  for (const name of ["tap_rights", "locked_member", "reserved_attempt", "reserved_ledger", "updated_member", "projected_membership", "finalized_attempt"]) {
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
  assert.match(dbRuntime, /20260729130000_0070_supplier_qa_atomic_receipts\.sql/);
  assert.match(dbRuntime, /20260729143000_0071_supplier_pack_purpose_governance\.sql/);
  assert.match(dbRuntime, /20260729160000_0072_tokenization_marketplace_execution_governance\.sql/);
  assert.match(dbRuntime, /20260730110000_0073_supplier_qa_verification_context_v2\.sql/);
  assert.match(dbRuntime, /20260730150000_0074_supplier_key_rotation_atomic\.sql/);
  assert.match(dbRuntime, /20260801090000_0075_supplier_production_qa_acceptance\.sql/);
  assert.match(dbRuntime, /20260802090000_0076_supplier_production_activation_v2\.sql/);
  assert.match(dbRuntime, /20260802113000_0077_tenant_api_key_lifecycle\.sql/);
  assert.match(dbRuntime, /20260802130000_0078_webhook_destination_cutover\.sql/);
  assert.match(dbRuntime, /20260802150000_0079_supplier_order_atomic_create\.sql/);
  assert.match(dbRuntime, /20260802153000_0080_offline_scan_history_index\.sql/);
  assert.match(dbRuntime, /20260802160000_0081_supplier_manifest_atomic_import\.sql/);
  assert.match(dbRuntime, /20260802170000_0082_consumer_session_revocation\.sql/);
  assert.match(dbRuntime, /20260802180000_0083_sdk_event_webhook_atomic_outbox\.sql/);
  assert.match(dbRuntime, /20260802185000_0083b_vault_artifact_status_bridge\.sql/);
  assert.match(dbRuntime, /20260802190000_0084_tenant_vault_audited_download\.sql/);
  assert.match(dbRuntime, /20260802200000_0085_supplier_non_sun_qa_evidence\.sql/);
  assert.match(dbRuntime, /20260802210000_0086_supplier_order_lifecycle\.sql/);
  assert.match(dbRuntime, /20260802220000_0087_packaging_lab_foundation\.sql/);
  assert.match(dbRuntime, /20260802225000_0087b_webhook_delivery_identity_bridge\.sql/);
  assert.match(dbRuntime, /20260802230000_0088_enterprise_event_profile\.sql/);
  assert.match(dbRuntime, /20260802240000_0089_sun_carrier_trust_state\.sql/);
  assert.match(dbRuntime, /20260802250000_0090_supplier_carrier_key_scope\.sql/);
  assert.match(dbRuntime, /20260802255000_0090b_vault_artifact_canonical_bridge\.sql/);
  assert.match(dbRuntime, /20260802260000_0091_supplier_keyless_qa_activation\.sql/);
  assert.match(dbRuntime, /20260802270000_0092_supplier_carrier_scope_integrity\.sql/);
  assert.match(dbRuntime, /20260802280000_0093_sun_tt_durable_truth_binding\.sql/);
  assert.match(dbRuntime, /20260802290000_0094_sun_runtime_acl_boundary\.sql/);
  assert.match(dbRuntime, /20260802300000_0095_sun_tt_conflict_target\.sql/);
  assert.match(dbRuntime, /20260802310000_0096_enterprise_rbac_risk_truth\.sql/);
  assert.match(dbRuntime, /20260802320000_0097_sun_demo_replay_isolation\.sql/);
  assert.match(dbRuntime, /20260827010000_0098_sun_ticket_tenant_routing\.sql/);
  assert.equal(DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.length, 46);
  assert.equal(DEFAULT_REQUIRED_SCHEMA_MIGRATION, "20260827010000_0098_sun_ticket_tenant_routing.sql");
  assert.deepEqual([...DEFAULT_REQUIRED_SCHEMA_MIGRATIONS], [...DEFAULT_REQUIRED_SCHEMA_MIGRATIONS].sort());
  assert.equal(DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.every(isValidSchemaMigrationId), true);
  assert.equal(isValidSchemaMigrationId("20260802185000_0083b_vault_artifact_status_bridge.sql"), true);
  assert.equal(isValidSchemaMigrationId("20260802310000_0096_enterprise_rbac_risk_truth.sql"), true);
  assert.equal(isValidSchemaMigrationId("20260802320000_0097_sun_demo_replay_isolation.sql"), true);
  assert.equal(isValidSchemaMigrationId("20260827010000_0098_sun_ticket_tenant_routing.sql"), true);
  assert.equal(isValidSchemaMigrationId("20260802310000_0096b.sql"), false);
  assert.equal(isValidSchemaMigrationId("../20260802310000_0096_enterprise_rbac_risk_truth.sql"), false);
  const productionLedgerWithout0098 = DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.slice(0, -1);
  const requiredPositions = DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.map((id) => productionLedgerWithout0098.indexOf(id));
  assert.equal(requiredPositions.at(-1), -1);
  assert.equal(
    requiredPositions.every((position, index) => position >= 0 && (index === 0 || position > requiredPositions[index - 1])),
    false,
  );
  assert.match(dbRuntime, /const required = \[\.\.\.new Set\(\[\.\.\.DEFAULT_REQUIRED_SCHEMA_MIGRATIONS, \.\.\.configured\]\)\]\.sort\(\)/);
  assert.match(dbRuntime, /if \(!ordered\) \{[\s\S]*throw new Error\("required_schema_migration_not_applied"\)/);
  assert.equal(isRuntimeDdlStatement("DO $$ BEGIN CREATE TYPE unsafe AS ENUM ('a'); END $$"), true);
  assert.equal(isRuntimeDdlStatement("SELECT 1; /* request path */ ALTER TABLE tags ADD COLUMN unsafe text"), true);
  assert.equal(isRuntimeDdlStatement("SELECT 'ALTER TABLE is data, not SQL';"), false);
  assert.equal(isRuntimeDdlStatement("WITH changed AS (UPDATE tags SET status = 'active' RETURNING id) SELECT * FROM changed"), false);
  assert.match(dbPreflight, /20260726173000_0060_sdk_idempotency_operations\.sql/);
  assert.match(dbPreflight, /20260726190000_0061_supplier_export_artifact_delivery\.sql/);
  assert.match(dbPreflight, /20260726120000_0058_marketplace_runtime_baseline\.sql/);
  assert.match(dbPreflight, /20260728120000_0062_sun_atomic_persistence\.sql/);
  assert.match(dbPreflight, /20260728143000_0063_supplier_packaging_governance\.sql/);
  assert.match(dbPreflight, /20260728160000_0064_webhook_lifecycle_governance\.sql/);
  assert.match(dbPreflight, /20260728173000_0065_event_incident_workflow\.sql/);
  assert.match(dbPreflight, /20260728180000_0066_tag_lifecycle_governance\.sql/);
  assert.match(dbPreflight, /20260728183000_0067_canonical_event_outbox\.sql/);
  assert.match(dbPreflight, /20260729110000_0068_epcis_event_type\.sql/);
  assert.match(dbPreflight, /20260729110500_0069_gs1_epcis_foundation\.sql/);
  assert.match(dbPreflight, /20260729130000_0070_supplier_qa_atomic_receipts\.sql/);
  assert.match(dbPreflight, /20260729143000_0071_supplier_pack_purpose_governance\.sql/);
  assert.match(dbPreflight, /20260729160000_0072_tokenization_marketplace_execution_governance\.sql/);
  assert.match(dbPreflight, /20260730110000_0073_supplier_qa_verification_context_v2\.sql/);
  assert.match(dbPreflight, /20260730150000_0074_supplier_key_rotation_atomic\.sql/);
  assert.match(dbPreflight, /20260801090000_0075_supplier_production_qa_acceptance\.sql/);
  assert.match(dbPreflight, /20260802090000_0076_supplier_production_activation_v2\.sql/);
  assert.match(dbPreflight, /20260802113000_0077_tenant_api_key_lifecycle\.sql/);
  assert.match(dbPreflight, /20260802130000_0078_webhook_destination_cutover\.sql/);
  assert.match(dbPreflight, /20260802150000_0079_supplier_order_atomic_create\.sql/);
  assert.match(dbPreflight, /20260802153000_0080_offline_scan_history_index\.sql/);
  assert.match(dbPreflight, /20260802160000_0081_supplier_manifest_atomic_import\.sql/);
  assert.match(dbPreflight, /20260802170000_0082_consumer_session_revocation\.sql/);
  assert.match(dbPreflight, /20260802180000_0083_sdk_event_webhook_atomic_outbox\.sql/);
  assert.match(dbPreflight, /20260802190000_0084_tenant_vault_audited_download\.sql/);
  assert.match(dbPreflight, /20260802200000_0085_supplier_non_sun_qa_evidence\.sql/);
  assert.match(dbPreflight, /20260802210000_0086_supplier_order_lifecycle\.sql/);
  assert.match(dbPreflight, /20260802220000_0087_packaging_lab_foundation\.sql/);
  assert.match(dbPreflight, /20260802230000_0088_enterprise_event_profile\.sql/);
  assert.match(dbPreflight, /20260802240000_0089_sun_carrier_trust_state\.sql/);
  assert.match(dbPreflight, /20260802250000_0090_supplier_carrier_key_scope\.sql/);
  assert.match(dbPreflight, /20260802260000_0091_supplier_keyless_qa_activation\.sql/);
  assert.match(dbPreflight, /20260802270000_0092_supplier_carrier_scope_integrity\.sql/);
  assert.match(dbPreflight, /20260802280000_0093_sun_tt_durable_truth_binding\.sql/);
  assert.match(dbPreflight, /20260802290000_0094_sun_runtime_acl_boundary\.sql/);
  assert.match(dbPreflight, /20260802300000_0095_sun_tt_conflict_target\.sql/);
  assert.match(dbPreflight, /20260802310000_0096_enterprise_rbac_risk_truth\.sql/);
  assert.match(dbPreflight, /20260802320000_0097_sun_demo_replay_isolation\.sql/);
  assert.match(dbPreflight, /20260827010000_0098_sun_ticket_tenant_routing\.sql/);
  assert.match(dbPreflight, /has_supplier_carrier_key_scope/);
  assert.match(dbPreflight, /can_probe_supplier_order_keyless_v1/);
  assert.match(dbPreflight, /has_supplier_keyless_qa_activation/);
  assert.match(dbPreflight, /has_supplier_carrier_scope_integrity/);
  assert.match(dbPreflight, /has_sun_tt_durable_truth/);
  assert.match(dbPreflight, /has_sun_runtime_acl_boundary/);
  assert.match(dbPreflight, /has_sun_tt_conflict_target/);
  assert.match(dbPreflight, /has_enterprise_rbac_risk_truth/);
  assert.match(dbPreflight, /has_sdk_event_atomic_outbox_functions/);
  assert.match(dbPreflight, /can_use_sdk_event_atomic_outbox/);
  assert.match(dbPreflight, /has_tenant_vault_audited_download/);
  assert.match(dbPreflight, /can_record_tenant_vault_download/);
  assert.match(dbPreflight, /has_supplier_carrier_qa/);
  assert.match(dbPreflight, /can_use_supplier_carrier_qa/);
  assert.match(dbPreflight, /has_supplier_order_lifecycle/);
  assert.match(dbPreflight, /can_use_supplier_order_lifecycle/);
  assert.match(dbPreflight, /has_consumer_session_revocation/);
  assert.match(dbPreflight, /has_tenant_api_key_lifecycle_receipts/);
  assert.match(dbPreflight, /has_webhook_destination_versions/);
  assert.match(dbPreflight, /has_supplier_order_atomic_create_functions/);
  assert.match(dbPreflight, /has_offline_scan_history_index/);
  assert.match(dbPreflight, /has_supplier_manifest_atomic_import/);
  assert.match(dbPreflight, /can_scan_supplier_manifest_secrets/);
  assert.match(dbPreflight, /has_supplier_production_qa_manufacturing_state/);
  assert.match(dbPreflight, /has_supplier_production_qa_acceptance_tables/);
  assert.match(dbPreflight, /has_supplier_production_qa_acceptance_functions/);
  assert.match(dbPreflight, /can_use_supplier_production_qa_acceptance/);
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
