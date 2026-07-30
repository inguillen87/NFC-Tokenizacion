import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policy = await import("../src/lib/supplier-pack-purpose-policy.ts");
const permissions = await import("../src/lib/permission-policy.ts");
const source = await readFile(new URL("../src/components/supplier-order-console.tsx", import.meta.url), "utf8");

test("an authoritative legacy-to-trial decision stops resolving as unclassified", () => {
  assert.equal(policy.resolveSupplierPackPurpose({
    declaredPackPurpose: "legacy_unclassified",
    effectivePackPurpose: "trial_integration",
  }), "trial_integration");
  assert.equal(policy.resolveSupplierPackPurpose({
    declaredPackPurpose: "legacy_unclassified",
    effectivePackPurpose: null,
  }), "legacy_unclassified");
});

test("classification inputs require bounded reason and exact irreversible confirmation", () => {
  assert.equal(policy.normalizeLegacyTrialClassificationReason("short").valid, false);
  assert.equal(policy.normalizeLegacyTrialClassificationReason("Historical supplier pilot is permanently non-sellable.").valid, true);
  assert.equal(policy.normalizeLegacyTrialClassificationReason("x".repeat(1001)).valid, false);
  assert.equal(policy.LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION, "CLASSIFY_LEGACY_SUPPLIER_ORDER_AS_TRIAL");

  assert.match(source, /activePackPurpose === "legacy_unclassified"/);
  assert.match(source, /data-testid="legacy-trial-classification-panel"/);
  assert.match(source, /Decision irreversible: trial NON_SELLABLE permanente/);
  assert.match(source, /minLength=\{16\}/);
  assert.match(source, /maxLength=\{1000\}/);
  assert.match(source, /legacyTrialConfirmation !== LEGACY_TRIAL_CLASSIFICATION_CONFIRMATION/);
  assert.match(source, /Clasificar como trial NON_SELLABLE/);
});

test("one client idempotency key is retained only for an exact retry", () => {
  assert.match(source, /legacyTrialClassificationAttempt = useRef<\{ signature: string; idempotencyKey: string \} \| null>\(null\)/);
  assert.match(source, /if \(!attempt \|\| attempt\.signature !== signature\)/);
  assert.match(source, /idempotencyKey: `supplier-purpose:\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(source, /headers: \{ "Idempotency-Key": attempt\.idempotencyKey \}/);
  assert.match(source, /setLegacyTrialReason\(event\.target\.value\);[\s\S]*legacyTrialClassificationAttempt\.current = null/);
  assert.match(source, /setLegacyTrialConfirmation\(event\.target\.value\);[\s\S]*legacyTrialClassificationAttempt\.current = null/);
});

test("dashboard submits no server-derived scope and confirms through an authoritative refresh", () => {
  const functionStart = source.indexOf("async function classifyLegacyOrderAsTrial");
  const functionEnd = source.indexOf("async function loadVaultArtifacts", functionStart);
  const handler = source.slice(functionStart, functionEnd);

  assert.match(handler, /body: JSON\.stringify\(\{\s*reason,\s*confirmation: legacyTrialConfirmation,\s*\}\)/);
  assert.doesNotMatch(handler, /items|qa_check_id|supplier_sub_batch_id|K_META|K_FILE|meta_key_ct|file_key_ct/);
  assert.match(handler, /const authoritative = await run\("\/api\/admin\/supplier-orders"\)/);
  assert.match(handler, /effectiveSupplierPackPurpose\(authoritativeOrder\) !== "trial_integration"/);
  assert.match(source, /data-testid="supplier-pack-purpose-resolution"/);
  assert.match(source, /Proposito declarado:/);
  assert.match(source, /Proposito efectivo:/);
});

test("BFF requires the dedicated permission before forwarding classification", () => {
  const path = "supplier-orders/22222222-2222-4222-8222-222222222222/purpose/classify-trial";
  assert.equal(permissions.requiredPermissionForAdminResource("POST", path), "supplier:pack_purpose_classify_trial");
  assert.equal(permissions.dashboardPermissionMatches(["supplier:pack_purpose_classify_trial"], "supplier:pack_purpose_classify_trial"), true);
  assert.equal(permissions.dashboardPermissionMatches(["supplier:*"], "supplier:pack_purpose_classify_trial"), true);
  assert.equal(permissions.dashboardPermissionMatches(["supplier:write"], "supplier:pack_purpose_classify_trial"), false);
  assert.equal(permissions.requiredPermissionForAdminResource("POST", "supplier-orders/other/purpose/classify-production"), null);
});
