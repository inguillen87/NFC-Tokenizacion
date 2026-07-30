import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyLegacySupplierOrderTrial,
  LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION,
  legacyTrialClassificationError,
  parseLegacyTrialClassificationBody,
  validLegacyTrialClassificationIdempotencyKey,
} from "../src/lib/supplier-pack-purpose-classification.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

function readWorkspaceFile(path) {
  return readFileSync(`${repositoryRoot}/${path}`, "utf8");
}

function classificationInput(overrides = {}) {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    supplierOrderId: "22222222-2222-4222-8222-222222222222",
    actorId: "33333333-3333-4333-8333-333333333333",
    operationKey: "legacy-trial-syngenta-2026",
    reason: "Historical ten-tag integration sample; permanently non-sellable.",
    confirmation: LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION,
    requestId: "request-purpose-2026",
    items: [{
      supplier_sub_batch_id: "44444444-4444-4444-8444-444444444444",
      qa_check_id: "55555555-5555-4555-8555-555555555555",
    }],
    ...overrides,
  };
}

test("legacy trial classification accepts only the exact bounded operator contract", () => {
  assert.deepEqual(
    parseLegacyTrialClassificationBody({
      reason: "Historical supplier sample is explicitly non-sellable.",
      confirmation: LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION,
    }),
    {
      ok: true,
      reason: "Historical supplier sample is explicitly non-sellable.",
      confirmation: LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION,
    },
  );
  assert.deepEqual(
    parseLegacyTrialClassificationBody({
      reason: "Historical supplier sample is explicitly non-sellable.",
      confirmation: LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION,
      items: [],
    }),
    { ok: false, reason: "supplier_pack_purpose_body_fields_invalid" },
  );
  assert.deepEqual(
    parseLegacyTrialClassificationBody({
      reason: "too short",
      confirmation: LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION,
    }),
    { ok: false, reason: "supplier_pack_purpose_reason_invalid" },
  );
  assert.deepEqual(
    parseLegacyTrialClassificationBody({
      reason: "Historical supplier sample is explicitly non-sellable.",
      confirmation: ` ${LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION}`,
    }),
    { ok: false, reason: "supplier_pack_purpose_confirmation_required" },
  );
  assert.equal(validLegacyTrialClassificationIdempotencyKey("legacy-trial-2026"), true);
  assert.equal(validLegacyTrialClassificationIdempotencyKey("short"), false);
  assert.equal(validLegacyTrialClassificationIdempotencyKey("legacy trial 2026"), false);
  assert.equal(validLegacyTrialClassificationIdempotencyKey(`l${"x".repeat(128)}`), false);
});

test("classification helper makes one parameterized function call with trusted identity and scope", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{
      decision_id: "66666666-6666-4666-8666-666666666666",
      supplier_order_id: "22222222-2222-4222-8222-222222222222",
      effective_pack_purpose: "trial_integration",
      scope_digest: `sha256:${"a".repeat(64)}`,
      idempotent_replay: false,
    }];
  };

  const receipt = await classifyLegacySupplierOrderTrial(classificationInput(), query);
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /FROM public\.nexid_classify_legacy_supplier_order_trial_v1\(\?::jsonb\)/);
  const payload = JSON.parse(calls[0].values[0]);
  assert.equal(payload.tenant_id, classificationInput().tenantId);
  assert.equal(payload.supplier_order_id, classificationInput().supplierOrderId);
  assert.equal(payload.actor_id, classificationInput().actorId);
  assert.equal(payload.request_id, classificationInput().requestId);
  assert.deepEqual(payload.items, classificationInput().items);
  assert.equal(receipt.effectivePackPurpose, "trial_integration");
  assert.equal(receipt.idempotentReplay, false);
});

test("classification route derives tenant, sub-batches and latest QA receipts server-side", () => {
  const route = readWorkspaceFile(
    "apps/api/src/app/admin/supplier-orders/[orderId]/purpose/classify-trial/route.ts",
  );

  assert.match(route, /checkAdmin\(req, \["super_admin", "tenant_admin"\]\)/);
  assert.match(route, /checkAdminPermission\(req, "supplier:pack_purpose_classify_trial"\)/);
  assert.match(route, /enforceCriticalRateLimit\(req, \{[\s\S]*rateClass: "proof_write"[\s\S]*adminCriticalRateLimitIdentity\(req\)/);
  assert.match(route, /MAX_CLASSIFICATION_BODY_BYTES = 4 \* 1024/);
  assert.match(route, /readBoundedJsonBody<unknown>\(req, MAX_CLASSIFICATION_BODY_BYTES\)/);
  assert.match(route, /tenant\.slug = \$\{forcedTenantSlug\}/);
  assert.match(route, /FROM supplier_sub_batches sub_batch[\s\S]*LEFT JOIN LATERAL[\s\S]*qa_check\.status = 'passed'/);
  assert.match(route, /ORDER BY qa_check\.created_at DESC, qa_check\.id DESC/);
  assert.match(route, /items: scopeRows\.map/);
  assert.match(route, /actorId: actor\.id/);
  assert.match(route, /requestId: classificationRequestId\(req\)/);
  assert.match(route, /commercial_disposition: "NON_SELLABLE"/);
  assert.match(route, /production_acceptance: false/);
  assert.match(route, /activation_allowed: false/);
  assert.doesNotMatch(route, /body\.(?:items|tenant|tenant_id|actor|actor_id|supplier_order_id|qa_check_id)/);
  assert.doesNotMatch(route, /\b(?:INSERT INTO|UPDATE|DELETE FROM)\b/);
  assert.doesNotMatch(route, /K_META|K_FILE|meta_key_ct|file_key_ct|UPDATE batches|UPDATE tags|UPDATE supplier_sub_batches/);
});

test("supplier order reads preserve declared purpose and overlay one tenant-bound authoritative decision", () => {
  const listRoute = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/route.ts");
  const migration = readWorkspaceFile("apps/api/db/migrations/20260729143000_0071_supplier_pack_purpose_governance.sql");

  assert.ok((listRoute.match(/so\.pack_purpose AS declared_pack_purpose/g) || []).length >= 2);
  assert.ok((listRoute.match(/COALESCE\(purpose_decision\.to_purpose, so\.pack_purpose\) AS effective_pack_purpose/g) || []).length >= 2);
  assert.ok((listRoute.match(/purpose_decision\.id AS classification_decision_id/g) || []).length >= 2);
  assert.ok((listRoute.match(/purpose_decision\.supplier_order_id = so\.id[\s\S]*?purpose_decision\.tenant_id = so\.tenant_id/g) || []).length >= 2);
  assert.match(migration, /UNIQUE \(supplier_order_id\)/);
});

test("classification failures are normalized without leaking SQL or credentials", () => {
  assert.deepEqual(
    legacyTrialClassificationError(Object.assign(
      new Error("function public.nexid_classify_legacy_supplier_order_trial_v1(jsonb) does not exist"),
      { code: "42883" },
    )),
    {
      status: 503,
      reason: "supplier_pack_purpose_governance_migration_required",
      requiredMigration: "20260729143000_0071_supplier_pack_purpose_governance.sql",
    },
  );
  assert.deepEqual(
    legacyTrialClassificationError(Object.assign(
      new Error("supplier_pack_purpose_idempotency_conflict"),
      { code: "23505" },
    )),
    { status: 409, reason: "supplier_pack_purpose_idempotency_conflict" },
  );
  assert.deepEqual(
    legacyTrialClassificationError(new Error("password=must-not-leak host=postgres.internal")),
    { status: 503, reason: "supplier_pack_purpose_classification_unavailable" },
  );
});
