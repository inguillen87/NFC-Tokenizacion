import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packagingRoutePath = new URL(
  "../src/app/admin/supplier-orders/[orderId]/packaging/route.ts",
  import.meta.url,
);
const exportRoutePath = new URL(
  "../src/app/admin/supplier-orders/[orderId]/export-pack/route.ts",
  import.meta.url,
);
const createRoutePath = new URL("../src/app/admin/supplier-orders/route.ts", import.meta.url);
const atomicCreatePath = new URL(
  "../db/migrations/20260802150000_0079_supplier_order_atomic_create.sql",
  import.meta.url,
);
const auditLoggerPath = new URL("../src/lib/audit-logger.ts", import.meta.url);

test("packaging decisions reject caller-forged scope, actor and revision context", async () => {
  const source = await readFile(packagingRoutePath, "utf8");
  for (const field of ["tenant_id", "tenantId", "decided_by", "decidedBy", "previousRevision", "specRevision"]) {
    assert.match(source, new RegExp(`"${field}"`));
  }
  assert.match(source, /packaging_context_fields_server_derived/);
  assert.match(source, /tenantId: order\.tenant_id/);
  assert.match(source, /previousStatus: order\.packaging_governance_status/);
  assert.match(source, /previousRevision: Number\(order\.packaging_spec_revision/);
  assert.match(source, /decidedBy: principal\.userId/);
  assert.doesNotMatch(source, /decidedBy:\s*body\./);
});

test("tenant administrators are scoped in SQL and approval uses persisted permission grants", async () => {
  const source = await readFile(packagingRoutePath, "utf8");
  assert.match(source, /so\.tenant_id = \$\{principal\.tenantId\}::uuid/);
  assert.match(source, /permissionMatches\(principal\.permissions, "supplier:approve_packaging"\)/);
  assert.match(source, /principal\.scope === "super_admin"/);
  assert.match(source, /supplier_packaging_approval_forbidden/);
  assert.match(source, /Approval and rejection always use the currently submitted immutable snapshot/);
  assert.doesNotMatch(source, /x-admin-(?:tenant|actor|permissions|scope)/i);
});

test("missing governance migration is an explicit 503 contract, never a client 400", async () => {
  const source = await readFile(packagingRoutePath, "utf8");
  assert.match(source, /supplier_packaging_migration_required/);
  assert.match(source, /20260728143000_0063_supplier_packaging_governance\.sql/);
  assert.match(source, /status: 503/);
});

test("canonical decision commit cannot become an ambiguous failure from audit projection", async () => {
  const [route, audit] = await Promise.all([
    readFile(packagingRoutePath, "utf8"),
    readFile(auditLoggerPath, "utf8"),
  ]);
  const persistIndex = route.indexOf("persistSupplierPackagingGovernanceDecision({");
  const auditIndex = route.indexOf("auditProjection = await logAuditEvent({");
  const successIndex = route.indexOf('commit_state: "committed"');
  assert.ok(persistIndex >= 0 && auditIndex > persistIndex && successIndex > auditIndex);
  assert.match(route, /retry_required: false/);
  assert.match(route, /warnings\.push\(auditProjection\.reason\)/);
  assert.match(audit, /Promise<AuditLogResult>/);
  assert.match(audit, /reason: "audit_log_projection_failed"/);
});

test("unknown persistence failures are normalized and never echo raw error messages", async () => {
  const source = await readFile(packagingRoutePath, "utf8");
  assert.match(source, /reason: "packaging_governance_decision_failed", status: 500/);
  assert.doesNotMatch(source, /return \{ reason: error instanceof Error \? error\.message/);
  assert.match(source, /console\.error\("\[supplier_packaging_decision_failed\]", infrastructureCode\)/);
});

test("packaging approval gate executes before ciphertext selection and every decrypt", async () => {
  const source = await readFile(exportRoutePath, "utf8");
  const gateIndex = source.indexOf("const packagingGate = evaluateSupplierPackagingExportGate({");
  const keySelectIndex = source.indexOf("const rows = secureSunProfile");
  const secureKeyJoinIndex = source.indexOf("JOIN batch_keys bk", keySelectIndex);
  const decryptIndex = source.indexOf("const kMetaHex = secureSunProfile");
  const finalApprovalLockIndex = source.indexOf("WITH approved_order AS MATERIALIZED (");
  assert.ok(gateIndex >= 0, "packaging gate missing");
  assert.ok(keySelectIndex > gateIndex, "batch key ciphertext was selected before packaging gate");
  assert.ok(secureKeyJoinIndex > keySelectIndex, "secure carrier key join missing");
  assert.ok(decryptIndex > secureKeyJoinIndex, "key decrypt was not downstream of ciphertext query");
  assert.ok(finalApprovalLockIndex > decryptIndex, "final approval race check must guard export persistence");
  assert.match(source, /supplier_packaging_approval_required/);
  assert.match(source, /packaging_approval_history_receipt_consistent/);
  assert.match(source, /PACKAGING_APPROVAL\.json/);
  assert.match(source, /packaging_spec_hash: packagingGate\.specHash/);
  assert.match(source, /FOR SHARE OF so/);
  assert.match(source, /supplier_packaging_approval_changed/);
});

test("export packs are carrier-key-aware and checksum one manifest template per sub-batch", async () => {
  const source = await readFile(exportRoutePath, "utf8");
  const keylessQueryIndex = source.indexOf(": await sql/*sql*/`");
  const decryptIndex = source.indexOf("const kMetaHex = secureSunProfile");
  const templateIndex = source.indexOf("const manifestTemplate = buildSupplierManifestTemplate({");
  const checksumIndex = source.indexOf("const checksums = archiveEntries");

  assert.match(source, /const secureSunProfile = requiresSecureSunEncoding\(order\.carrier_profile_code\)/);
  assert.match(source, /NULL::text AS meta_key_ct[\s\S]*NULL::text AS file_key_ct/);
  assert.match(source, /NOT EXISTS \([\s\S]*FROM batch_keys unexpected_key/);
  assert.match(source, /NOT EXISTS \([\s\S]*FROM batch_key_material unexpected_material/);
  assert.ok(keylessQueryIndex >= 0 && decryptIndex > keylessQueryIndex);
  assert.ok(templateIndex > decryptIndex && checksumIndex > templateIndex);
  assert.match(source, /`\$\{row\.bid\}\/\$\{manifestTemplate\.filename\}`/);
  assert.match(source, /supplier_manifest_template_csv/);
  assert.match(source, /manifest_template_sha256: manifestTemplate\.contentHash/);
  assert.match(source, /manifest_template_headers: manifestTemplate\.headers/);
  assert.match(source, /key_material_mode: secureSunProfile \? "secure_sun" : "none"/);
  assert.match(source, /WHEN \$\{secureSunProfile\}::boolean THEN \$\{rows\.length\} ELSE 0 END/);
});

test("atomic order creation remains explicitly legacy until dedicated packaging draft", async () => {
  const [source, migration] = await Promise.all([
    readFile(createRoutePath, "utf8"),
    readFile(atomicCreatePath, "utf8"),
  ]);
  assert.match(source, /hasSupplierOrderCreateV2/);
  assert.match(source, /createSupplierOrderV2/);
  assert.match(source, /legacy_unverified/);
  assert.match(source, /next: `\/admin\/supplier-orders\/\$\{order\.id\}\/packaging`/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_create_supplier_order_v2/);
  assert.doesNotMatch(source, /persistSupplierPackagingGovernanceDecision/);
  assert.doesNotMatch(source, /body\.(?:packaging_spec|packagingSpec)/);
});
