import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolveSupplierOpsErrorReport } from "../src/lib/supplier-ops-error-report.ts";

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const supplierConsole = source("../src/components/supplier-order-console.tsx");
const lifecyclePanel = source("../src/components/supplier-order-lifecycle-panel.tsx");
const orderDetailPage = source("../src/app/(app)/supplier-orders/[orderId]/page.tsx");
const permissionPolicy = source("../src/lib/permission-policy.ts");

test("supplier console exposes bounded quantity exceptions without weakening QA", () => {
  assert.match(supplierConsole, /supplier:activate_override/);
  assert.match(supplierConsole, /supplier-manifest-quantity-override/);
  assert.match(supplierConsole, /supplier-activation-quantity-override/);
  assert.match(supplierConsole, /overrideReason: manifestQuantityOverrideReady/);
  assert.match(supplierConsole, /override_reason: activationOverrideReady/);
  assert.match(supplierConsole, /Descargar CSV de errores/);
  assert.match(supplierConsole, /No permite omitir manifiesto, QA ni la aceptación de producción de dos actores/);
  assert.doesNotMatch(supplierConsole, /no hay endpoint\/payload en el cliente actual/i);

  const activationGate = supplierConsole.slice(
    supplierConsole.indexOf("const activationBlockReason"),
    supplierConsole.indexOf("const qaPassBlockReason"),
  );
  assert.ok(activationGate.indexOf('manifest_status) !== "imported"') < activationGate.indexOf("importedManifestQuantityMismatch"));
  assert.ok(activationGate.indexOf('qa_status) !== "passed"') < activationGate.indexOf("importedManifestQuantityMismatch"));
  assert.doesNotMatch(activationGate, /activePackPurpose === "production"\s*\?\s*"Producción bloqueada/);
});

test("manifest and QA failures resolve to spreadsheet-safe local downloads", () => {
  const embedded = resolveSupplierOpsErrorReport({
    error_report: {
      schema_version: "nexid-supplier-ops-error-report/v1",
      encoding: "utf-8",
      filename: "manifest errors.csv",
      row_count: 2,
      csv: "stage,bid,code\r\nmanifest,BID-1,invalid_uid",
    },
  }, { stage: "manifest", bid: "BID-1" });
  assert.equal(embedded.stage, "manifest");
  assert.equal(embedded.filename, "manifest-errors.csv");
  assert.equal(embedded.rowCount, 2);

  const fallback = resolveSupplierOpsErrorReport({
    reason: "qa_failed",
    message: "@unsafe",
  }, { stage: "qa", bid: "BID/2" });
  assert.equal(fallback.stage, "qa");
  assert.equal(fallback.filename, "nexid-qa-errors-BID-2.csv");
  assert.match(fallback.csv, /'@unsafe/);
});

test("order detail provides superadmin custody transitions without CLI or acceptance overclaim", () => {
  assert.match(orderDetailPage, /SupplierOrderLifecyclePanel/);
  assert.match(orderDetailPage, /const canManageLifecycle = session\.role === "super-admin"/);
  assert.match(orderDetailPage, /canManage=\{canManageLifecycle\}/);
  assert.match(orderDetailPage, /mfaVerified=\{session\.mfaVerified\}/);
  assert.match(lifecyclePanel, /mfaVerified:\s*boolean/);
  assert.match(lifecyclePanel, /superadmin con MFA verificado/);
  assert.match(lifecyclePanel, /\/api\/admin\/supplier-orders\/\$\{encodeURIComponent\(orderId\)\}\/lifecycle/);
  assert.match(lifecyclePanel, /supplier-lifecycle:\$\{crypto\.randomUUID\(\)\}/);
  assert.match(lifecyclePanel, /Idempotency-Key/);
  assert.match(lifecyclePanel, /no prueba recepción física ni aceptación contractual/i);
  assert.match(lifecyclePanel, /nunca reemplaza QA/i);
  assert.match(lifecyclePanel, /Producción requiere aceptación QA de dos actores y activación completa/);
  assert.match(lifecyclePanel, /trial es NON_SELLABLE y debe permanecer inactivo/);
  assert.ok(permissionPolicy.includes('/^supplier-orders\\/[^/]+\\/lifecycle$/.test(normalizedPath)'));
});
