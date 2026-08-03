import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../db/migrations/20260802220000_0087_packaging_lab_foundation.sql", import.meta.url);
const migration = await readFile(migrationUrl, "utf8");
const route = await readFile(new URL("../src/app/admin/supplier-orders/[orderId]/packaging-lab/route.ts", import.meta.url), "utf8");
const reportRoute = await readFile(new URL("../src/app/admin/supplier-orders/[orderId]/packaging-lab/report/route.ts", import.meta.url), "utf8");
const library = await readFile(new URL("../src/lib/packaging-lab.ts", import.meta.url), "utf8");
const aclDoc = await readFile(new URL("../../../docs/enterprise-hardening/2026-08-02/packaging-lab-database-acl.md", import.meta.url), "utf8");
const migrations = await readdir(new URL("../db/migrations/", import.meta.url));

test("0087 owns the complete tenant-scoped Packaging Lab model", () => {
  assert.match(library, /export type PackagingCarrierSpec =/);
  assert.match(library, /export type PackagingPlacement =/);
  for (const table of [
    "packaging_carrier_specs", "packaging_placements", "packaging_lab_projects",
    "packaging_lab_test_cases", "packaging_lab_approvals", "packaging_lab_operations",
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(migration, /FOREIGN KEY \(supplier_order_id, tenant_id\)/);
  assert.match(migration, /FOREIGN KEY \(carrier_spec_id, tenant_id\)/);
  assert.match(migration, /FOREIGN KEY \(placement_id, tenant_id\)/);
  assert.match(migration, /VALIDATE CONSTRAINT supplier_orders_packaging_carrier_spec_fk/);
  assert.match(migration, /packaging_lab_history_is_append_only/);
  assert.match(migration, /packaging_lab_idempotency_conflict/);
  assert.match(migration, /packaging_lab_approval_separation_required/);
});

test("activation and commercial release are closed by an immutable Lab receipt", () => {
  assert.match(migration, /nexid_packaging_lab_activation_receipt_v1/);
  assert.match(migration, /nexid_assert_packaging_lab_activation_v1/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_assert_supplier_production_activation_v2/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_assert_supplier_order_commercial_release_v1/);
  assert.match(migration, /REFERENCING OLD TABLE AS old_packaging_lab_tags NEW TABLE AS new_packaging_lab_tags/);
  assert.match(migration, /packaging_lab_approval_id/);
  assert.match(migration, /packaging_lab_approval_required/);
});

test("carrier truth is enforced at the database boundary", () => {
  assert.match(migration, /ntag424_dna'.*tamper_evidence_mode = 'none'/s);
  assert.match(migration, /ntag424_dna_tt'.*ttstatus_2byte_or_explicit_manual_evidence/s);
  assert.match(migration, /gs1_digital_link'.*declared_identity/s);
  assert.match(migration, /uhf_rfid'.*declared_logistics/s);
  assert.match(migration, /key_material_policy = 'none'/);
  assert.doesNotMatch(migration, /VALID_UNKNOWN_TAMPER/);
});

test("API derives tenant/order/actor context and uses enterprise permissions", () => {
  assert.match(route, /checkAdmin\(req, \["super_admin", "tenant_admin", "tenant_operator"\]\)/);
  assert.match(route, /packaging_lab\.manage/);
  assert.match(route, /qa\.approve/);
  assert.match(route, /principal\.mfaVerified/);
  assert.match(route, /packaging_lab_context_server_derived/);
  assert.match(route, /supplier_order\.tenant_id = \$\{principal\.tenantId\}::uuid/);
  assert.match(route, /permissionDenied\(principal\.deniedPermissions, permission\)/);
  assert.match(route, /permissionMatches\(principal\.permissions, permission, principal\.deniedPermissions\)/);
  const getBlock = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(getBlock, /can\(principal, "packaging_lab\.manage"\)/);
  assert.match(getBlock, /packaging_lab_read_forbidden/);
  assert.match(reportRoute, /checkAdminWithPermission\(req, "reports\.export"\)/);
  assert.match(reportRoute, /project\.tenant_id = \$\{principal\.tenantId\}::uuid/);
  assert.match(reportRoute, /application\/pdf/);
  assert.match(reportRoute, /text\/csv/);
});

test("AGRO preset is resolved server-side from the immutable order carrier", () => {
  assert.match(route, /presets: packagingLabPresetsForCarrier\(order\.carrier_profile_code\)/);
  assert.match(route, /packagingLabPresetFor\(presetCode, order\.carrier_profile_code\)/);
  assert.match(route, /preset\?\.target_substrates/);
  assert.match(route, /preset\?\.forbidden_conditions/);
  assert.match(route, /preset: preset \? \{ code: preset\.code, version: preset\.version \} : null/);
  assert.match(library, /AGRO_SECURE_PACKAGING_PILOT/);
  assert.match(library, /physical_validation_required: true/);
  assert.match(library, /raw_key_material_allowed: false/);
});

test("database authorization gives explicit denies precedence and validates the project owner", () => {
  const authorizationStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_packaging_lab_actor_authorized_v1");
  const authorizationEnd = migration.indexOf("$authorized$;", authorizationStart);
  const authorization = migration.slice(authorizationStart, authorizationEnd);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_packaging_lab_permission_denied_v1/);
  assert.match(migration, /permission\.effect = 'deny'/);
  assert.ok(authorization.indexOf("nexid_packaging_lab_permission_denied_v1") < authorization.indexOf("v_role = 'super_admin'"));
  assert.match(migration, /nexid_packaging_lab_override_authorized_v1[\s\S]*nexid_packaging_lab_permission_denied_v1/);
  assert.match(migration, /JOIN memberships owner_membership[\s\S]*owner_membership\.tenant_id = v_tenant_id/);
  assert.match(migration, /owner_user\.admin_status::text = 'active'/);
  assert.match(migration, /packaging_lab_owner_active_tenant_membership_required/);
});

test("archive and activation use one deterministic order lock with read/write modes", () => {
  const decisionStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_decide_packaging_lab_project_v1");
  const decisionEnd = migration.indexOf("$decide_project$;", decisionStart);
  const decision = migration.slice(decisionStart, decisionEnd);
  const receiptStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_packaging_lab_activation_receipt_v1");
  const receiptEnd = migration.indexOf("$activation_receipt$;", receiptStart);
  const receipt = migration.slice(receiptStart, receiptEnd);
  assert.match(decision, /pg_advisory_xact_lock\(hashtextextended\([\s\S]*'packaging-lab-order'/);
  assert.match(receipt, /pg_advisory_xact_lock_shared\(hashtextextended\([\s\S]*'packaging-lab-order'/);
  assert.match(receipt, /FOR SHARE OF project/);
  assert.match(migration, /ORDER BY batch\.supplier_order_id, new_tag\.batch_id/);
});

test("Packaging Lab defaults to owner-only database ACL until deployment grants a runtime role", () => {
  for (const routine of [
    "nexid_packaging_lab_history_append_only_v1\\(\\)",
    "nexid_packaging_lab_permission_denied_v1\\(uuid, text\\)",
    "nexid_packaging_lab_tests_digest_v1\\(uuid\\)",
    "nexid_guard_packaging_lab_tag_activation_v1\\(\\)",
    "nexid_bind_packaging_lab_activation_receipt_v1\\(\\)",
  ]) assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${routine} FROM PUBLIC`));
  assert.match(aclDoc, /does\s+not invent or assume a production database role/);
  assert.match(aclDoc, /deployment-specific and remain a required production rollout step/);
  assert.doesNotMatch(migration, /GRANT\s+.*\s+TO\s+nexid_runtime/i);
});

test("the assigned migration number is unique", () => {
  assert.deepEqual(migrations.filter((name) => name.startsWith("20260802220000_0087")), [
    "20260802220000_0087_packaging_lab_foundation.sql",
  ]);
});
