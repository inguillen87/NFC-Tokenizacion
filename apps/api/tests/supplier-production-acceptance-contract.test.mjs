import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { isProductionQaMutationMethod } from "../src/app/admin/supplier-orders/[orderId]/sub-batches/[bid]/production-acceptance/_shared.ts";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

const [
  migration,
  sharedRoute,
  stateRoute,
  sessionRoute,
  finalizeRoute,
  planDecisionRoute,
  planStore,
  exportRoute,
  disposableValidator,
] = await Promise.all([
  source("../db/migrations/20260801090000_0075_supplier_production_qa_acceptance.sql"),
  source("../src/app/admin/supplier-orders/[orderId]/sub-batches/[bid]/production-acceptance/_shared.ts"),
  source("../src/app/admin/supplier-orders/[orderId]/sub-batches/[bid]/production-acceptance/route.ts"),
  source("../src/app/admin/supplier-orders/[orderId]/sub-batches/[bid]/production-acceptance/sessions/route.ts"),
  source("../src/app/admin/supplier-orders/[orderId]/sub-batches/[bid]/production-acceptance/sessions/[sessionId]/finalize/route.ts"),
  source("../src/app/admin/supplier-orders/[orderId]/sub-batches/[bid]/production-acceptance/plan/[planId]/decision/route.ts"),
  source("../src/lib/supplier-production-qa-plan-store.ts"),
  source("../src/app/admin/supplier-orders/[orderId]/export-pack/route.ts"),
  source("../scripts/db-validate-disposable-neon-branch.mjs"),
]);

const migrationIds = (await readdir(new URL("../db/migrations/", import.meta.url)))
  .filter((name) => name.endsWith(".sql"))
  .sort();

test("pins production acceptance v2 while preserving NFC crypto and truthful software custody", () => {
  assert.match(migration, /Supplier Production Acceptance v2/);
  assert.match(migration, /physical[\s\S]*NTAG 424 SUN\/SDM\/CMAC and TagTamper path unchanged/);
  assert.match(sessionRoute, /software_application_envelope_not_kms_or_hsm/);
  assert.match(stateRoute, /activation_allowed: false/);
  assert.match(finalizeRoute, /activation_gate: "atomic-production-activation\/v2-pending"/);
  assert.doesNotMatch(migration, /managed_kms\s*[:=]\s*true/i);
  assert.doesNotMatch(migration, /hsm_backed\s*[:=]\s*true/i);
});

test("tenant Quality approval requires exact tenant, MFA, membership and hierarchical permission", () => {
  assert.match(sharedRoute, /checkAdminWithPermission\(req, SUPPLIER_PRODUCTION_QA_PLAN_APPROVAL_PERMISSION\)/);
  assert.match(sharedRoute, /principal\.role !== "tenant-owner" && principal\.role !== "tenant-admin"/);
  assert.match(sharedRoute, /principal\.tenantId/);
  assert.match(sharedRoute, /principal\.mfaVerified/);
  assert.match(sharedRoute, /SUPPLIER_PRODUCTION_QA_PLAN_APPROVAL_PERMISSION/);
  assert.match(planStore, /"qa\.plan\.approve" as const/);

  const decisionWriter = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_decide_supplier_production_qa_plan_v1"),
    migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_supplier_production_qa_v1_capability"),
  );
  assert.match(decisionWriter, /auth_session\.role = 'tenant_admin'::membership_role/);
  assert.match(decisionWriter, /auth_session\.tenant_id = v_tenant_id/);
  assert.match(decisionWriter, /auth_session\.mfa_verified IS TRUE/);
  assert.match(decisionWriter, /membership\.tenant_id = v_tenant_id/);
  assert.match(decisionWriter, /exact_permission\.resource = 'supplier'/);
  assert.match(decisionWriter, /exact_permission\.action = 'production_qa_plan:approve'/);
  assert.doesNotMatch(decisionWriter, /auth_session\.role::text = 'super_admin'/);
});

test("every production acceptance mutation is tenant-wide rate limited after authentication", () => {
  assert.match(sharedRoute, /enforceCriticalRateLimit\(req,/);
  assert.match(sharedRoute, /rateClass: "proof_write"/);
  assert.match(sharedRoute, /adminCriticalRateLimitIdentity\(req\)/);
  assert.match(sharedRoute, /tenantWide: true/);
  assert.match(sharedRoute, /String\(method \|\| ""\)\.trim\(\)\.toUpperCase\(\)/);
  assert.match(sharedRoute, /normalizedMethod !== "GET" && normalizedMethod !== "HEAD"/);
  assert.match(sharedRoute, /if \(!isProductionQaMutationMethod\(req\.method\)\) return null/);

  const operatorGuard = sharedRoute.slice(
    sharedRoute.indexOf("export async function requireProductionQaOperator"),
    sharedRoute.indexOf("export async function requireTenantQualityApprover"),
  );
  const approverGuard = sharedRoute.slice(
    sharedRoute.indexOf("export async function requireTenantQualityApprover"),
    sharedRoute.indexOf("export async function parseProductionQaBody"),
  );
  for (const guard of [operatorGuard, approverGuard]) {
    const authenticationIndex = guard.indexOf("checkAdminWithPermission(req");
    assert.ok(
      authenticationIndex >= 0
        && authenticationIndex < guard.indexOf("requireProductionQaMutationRateLimit(req)"),
      "authenticated principal resolution must precede the mutation limiter",
    );
  }

  for (const [route, guardName] of [
    [stateRoute, "requireProductionQaOperator(req)"],
    [sessionRoute, "requireProductionQaOperator(req)"],
    [finalizeRoute, "requireProductionQaOperator(req)"],
    [planDecisionRoute, "requireTenantQualityApprover(req)"],
  ]) {
    const guardIndex = route.indexOf(guardName);
    assert.ok(guardIndex >= 0, `${guardName} must protect the route`);
    assert.ok(
      guardIndex < route.indexOf("requireProductionQaCapability()"),
      "the authenticated limiter must run before capability/database access",
    );
    assert.ok(
      guardIndex < route.indexOf("parseProductionQaBody(req)"),
      "the authenticated limiter must run before body parsing",
    );
  }
});

test("production acceptance read methods never consume the mutation budget and unknown methods fail closed", () => {
  for (const method of ["GET", "get", "GeT", " HEAD ", "head"]) {
    assert.equal(isProductionQaMutationMethod(method), false, method);
  }
  for (const method of ["POST", "post", "PATCH", "DELETE", "OPTIONS", "", null, undefined]) {
    assert.equal(isProductionQaMutationMethod(method), true, String(method));
  }
});

test("plan submission is append-only and exact retries retain the committed revision", () => {
  assert.match(stateRoute, /const priorOperation = priorPlans\.find/);
  assert.match(stateRoute, /plan\.operation_key === idempotency\.operationKey/);
  assert.match(stateRoute, /priorOperation\?\.revision \?\?/);
  assert.match(migration, /UNIQUE \(supplier_sub_batch_id, revision\)/);
  assert.match(migration, /supplier_production_qa_plan_idempotency_conflict/);
  assert.match(migration, /trg_supplier_production_qa_plans_append_only/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON supplier_production_qa_plans/);
});

test("the server owns session entropy, TTL, challenge and deterministic sample selection", () => {
  assert.match(sessionRoute, /const allowedBodyKeys = new Set\(\["plan_id", "planId"\]\)/);
  assert.match(sessionRoute, /server owns TTL, seed, challenge and sample selection/i);
  assert.match(sessionRoute, /createSupplierProductionQaSecrets/);
  assert.match(sessionRoute, /buildSupplierProductionQaSelection/);
  assert.match(sessionRoute, /manifest_count !== scope\.expected_quantity/);
  assert.match(sessionRoute, /packaging_spec_revision < 1/);
  assert.match(sessionRoute, /\^sha256:\[0-9a-f\]\{64\}\$/);
  assert.match(migration, /supplier_production_qa_approved_plan_snapshot_mismatch/);
  assert.match(migration, /FOR UPDATE OF sub_batch, supplier_order, batch, batch_key/);
  assert.match(migration, /cryptographic_sample_size = LEAST\(10, lot_size, sample_size\)/);
});

test("finalization rejects caller verdicts and derives the exact observation decision in both layers", () => {
  assert.match(finalizeRoute, /"status", "passed", "qa_passed", "sample_count", "nonconforming_count"/);
  assert.match(finalizeRoute, /nonconformingCount <= session\.accept_number \? "passed"/);
  assert.match(finalizeRoute, /requiredUidFingerprints: cryptoFingerprints/);
  assert.match(finalizeRoute, /productionObservationsDigest: observationsDigest/);
  assert.match(migration, /nexid_supplier_qa_canonical_json_v2\(v_normalized_observations\)/);
  assert.match(migration, /supplier_production_qa_observations_digest_mismatch/);
  assert.match(migration, /v_nonconforming_count <= v_session\.accept_number/);
  assert.match(migration, /outcome' = 'conforming'[\s\S]*jsonb_array_length[\s\S]*<> 0/);
  assert.match(migration, /count\(DISTINCT defect\.value\)/);
});

test("production QA relational scope is tenant-bound and receipts are immutable", () => {
  assert.match(migration, /UNIQUE \(id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id\)/);
  assert.match(migration, /FOREIGN KEY \(session_id, tenant_id\)[\s\S]*REFERENCES supplier_production_qa_sessions\(id, tenant_id\)/);
  assert.match(migration, /FOREIGN KEY \(decision_id, session_id, tenant_id\)/);
  assert.match(migration, /FOREIGN KEY \(session_id, tag_id, tenant_id\)/);
  for (const table of [
    "supplier_production_qa_sessions",
    "supplier_production_qa_plan_decisions",
    "supplier_production_qa_session_samples",
    "supplier_production_qa_decisions",
    "supplier_production_qa_observations",
  ]) {
    assert.match(migration, new RegExp(`BEFORE UPDATE OR DELETE ON ${table}`));
  }
});

test("legacy classification refreshes the durable manufacturing projection", () => {
  assert.match(migration, /nexid_effective_supplier_pack_purpose_v1\(sub_batch\.supplier_order_id\)/);
  assert.match(migration, /nexid_supplier_manufacturing_state_refresh_on_purpose_v1/);
  assert.match(migration, /AFTER INSERT ON supplier_pack_purpose_decisions/);
  assert.match(migration, /SET manufacturing_state = sub_batch\.manufacturing_state/);
});

test("production export gates every BID before ciphertext selection and rechecks approval atomically", () => {
  const approvalGate = exportRoute.indexOf("const approvedProductionPlans");
  const ciphertextSelection = exportRoute.indexOf("const rows = secureSunProfile");
  const decryption = exportRoute.indexOf("const kMetaHex = secureSunProfile");
  assert.ok(approvalGate >= 0 && approvalGate < ciphertextSelection);
  assert.ok(ciphertextSelection > approvalGate && ciphertextSelection < decryption);
  assert.match(exportRoute, /plan\.lot_size = ssb\.expected_quantity/);
  assert.match(exportRoute, /approved_production_plans AS MATERIALIZED/);
  assert.match(exportRoute, /FOR KEY SHARE OF plan, plan_decision/);
  assert.match(exportRoute, /production_qa_ready/);
  assert.match(exportRoute, /PRODUCTION_QA_PLAN_APPROVAL\.json/);
  assert.match(exportRoute, /commercialDisposition = isProduction[\s\S]*PENDING_RECEIVING_QA/);
  assert.match(exportRoute, /const activationAllowed = false as const/);
});

test("0075 leaves commercial activation fail-closed behind candidate-only checks", () => {
  assert.match(migration, /nexid_candidate_assert_supplier_order_production_acceptance_v2/);
  assert.match(migration, /nexid_candidate_assert_supplier_batch_production_acceptance_v2/);
  assert.match(migration, /intentionally not wired into the v1[\s\S]*commercial release guards/);
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.nexid_assert_supplier_commercial_release_v1/);
});

test("remote SQL validation is pinned to an empty disposable Neon database", () => {
  assert.match(disposableValidator, /I_UNDERSTAND_THIS_IS_A_DISPOSABLE_NEON_DATABASE/);
  assert.match(disposableValidator, /\^codex_qa_/);
  assert.match(disposableValidator, /NEXID_DISPOSABLE_NEON_ENDPOINT_ID/);
  assert.match(disposableValidator, /disposable_database_not_empty/);
  assert.match(disposableValidator, /transaction_read_only/);
  assert.match(disposableValidator, /latest_migration/);
  assert.match(disposableValidator, /sun_runtime_acl_boundary/);
  assert.match(disposableValidator, /sun_tt_conflict_target/);
  assert.match(disposableValidator, /enterprise_rbac_risk_truth/);
  assert.equal(migrationIds.length, 119);
  assert.equal(migrationIds.at(-1), "20260918224500_0108_recall_notice_reviews.sql");
});
