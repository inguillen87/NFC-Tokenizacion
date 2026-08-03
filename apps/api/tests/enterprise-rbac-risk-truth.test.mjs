import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, priorRiskMigration, preflight, dryRun] = await Promise.all([
  readFile(new URL("../db/migrations/20260802310000_0096_enterprise_rbac_risk_truth.sql", import.meta.url), "utf8"),
  readFile(new URL("../db/migrations/20260802230000_0088_enterprise_event_profile.sql", import.meta.url), "utf8"),
  readFile(new URL("../scripts/db-enterprise-release-preflight.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/db-enterprise-release-dry-run.mjs", import.meta.url), "utf8"),
]);

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing section start: ${start}`);
  assert.ok(endIndex > startIndex, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function roleProfilePermissions(roleSection, role) {
  const match = new RegExp(
    `\\(\\s*'${role}',\\s*'[^']+',\\s*(?:true|false),\\s*(?:true|false),\\s*'(\\[[^']*\\])'::jsonb`,
  ).exec(roleSection);
  assert.ok(match, `missing role profile tuple: ${role}`);
  return JSON.parse(match[1]);
}

test("0096 reasserts all authoritative role profiles without materializing user grants", () => {
  const roleSection = section(
    migration,
    "ALTER TABLE public.enterprise_role_profiles",
    "-- New or modified authority rows",
  );
  for (const role of [
    "tenant_owner", "tenant_admin", "security_analyst", "operations_manager",
    "packaging_operator", "marketing_manager", "viewer", "reseller_admin",
    "api_integration", "super_admin", "security_operator", "reseller",
  ]) assert.match(roleSection, new RegExp(`'${role}'`));

  assert.match(roleSection, /'api_integration', 'API integration service account', true, false/);
  assert.match(roleSection, /'super_admin', 'Super admin', false, true/);
  assert.deepEqual(roleProfilePermissions(roleSection, "reseller"), []);
  assert.deepEqual(roleProfilePermissions(roleSection, "api_integration"), []);
  const ownerPermissions = new Set(roleProfilePermissions(roleSection, "tenant_owner"));
  for (const capability of [
    "users:manage", "supplier_order.create", "batch.keys.generate",
    "supplier_pack.export", "manifest.import", "packaging_lab.manage", "qa.approve",
    "qa.plan.approve", "batch.activate", "batch.lifecycle", "batch.revoke",
    "risk_rules.write", "webhooks.manage", "api_keys.read", "api_keys.manage",
    "proofs.read", "proofs.anchor", "audit.read", "reports.export",
  ]) assert.equal(ownerPermissions.has(capability), true, `tenant_owner missing ${capability}`);
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+(?:public\.)?resource_permissions\b/i);
  assert.doesNotMatch(migration, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?memberships\b/i);
});

test("0096 scopes historical explicit permissions to one tenant and blocks ambiguous backfill", () => {
  const scopeSection = section(
    migration,
    "ALTER TABLE public.resource_permissions",
    "ALTER TABLE public.events",
  );
  assert.match(scopeSection, /ADD COLUMN IF NOT EXISTS tenant_id uuid/);
  assert.match(scopeSection, /resource_permissions_tenant_backfill_ambiguous/);
  assert.match(scopeSection, /v_global_memberships > 0 AND v_tenant_count = 0/);
  assert.match(scopeSection, /v_global_memberships = 0 AND v_tenant_count = 1/);
  assert.match(scopeSection, /UPDATE public\.resource_permissions permission[\s\S]*SET tenant_id = v_tenant_id/);
  assert.match(scopeSection, /ux_resource_permissions_tenant_scope/);
  assert.match(scopeSection, /ux_resource_permissions_global_scope/);
  assert.match(scopeSection, /CREATE CONSTRAINT TRIGGER trg_resource_permissions_tenant_scope[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(scopeSection, /CREATE CONSTRAINT TRIGGER trg_memberships_permission_scope[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(scopeSection, /nexid_actor_has_enterprise_capability_v1/);
  assert.match(scopeSection, /permission\.tenant_id IS NOT DISTINCT FROM p_tenant_id[\s\S]*permission\.effect = 'deny'/);
  for (const [capability, legacy] of [
    ["supplier_order.create", "supplier_orders:write"],
    ["batch.keys.generate", "supplier:batch_keys_generate"],
    ["supplier_pack.export", "supplier:pack_export"],
    ["packaging_lab.override", "supplier:packaging_lab_override"],
    ["qa.approve", "supplier:qa"],
    ["batch.lifecycle", "batch:lifecycle"],
    ["batch.activation.override", "supplier:activate_override"],
    ["batch.internal.register", "batch:register_internal"],
    ["batch.keys.rotate", "supplier:key_rotate"],
  ]) {
    assert.match(scopeSection, new RegExp(`${capability.replaceAll(".", "\\.")}[\\s\\S]*${legacy.replaceAll(":", "\\:")}`));
  }
  assert.match(scopeSection, /resource_permissions_effect_check[\s\S]*effect IN \('allow', 'deny'\)[\s\S]*VALIDATE CONSTRAINT resource_permissions_effect_check/);
  assert.match(migration, /ux_resource_permissions_tenant_scope[\s\S]*indisready[\s\S]*indislive[\s\S]*ARRAY\['user_id', 'tenant_id', 'resource', 'action', 'effect'\]/);
  assert.match(migration, /ux_resource_permissions_global_scope[\s\S]*ARRAY\['user_id', 'resource', 'action', 'effect'\]/);
  assert.match(migration, /idx_resource_permissions_tenant_user[\s\S]*ARRAY\['tenant_id', 'user_id', 'resource', 'action', 'effect'\]/);
  assert.match(scopeSection, /REVOKE ALL ON TABLE public\.resource_permissions FROM PUBLIC/);
  assert.match(scopeSection, /nexid_import_tag_manifest_v2_core_0081\(jsonb\)/);
  assert.match(scopeSection, /supplier_production_qa_plan_dual_control_required/);
});

test("0096 enforces new tenant bindings and blocks certification on unreconciled legacy authority", () => {
  assert.match(migration, /memberships_enterprise_tenant_binding_check[\s\S]*role::text = 'super_admin' AND tenant_id IS NULL[\s\S]*role::text <> 'super_admin' AND tenant_id IS NOT NULL/);
  assert.match(migration, /auth_sessions_enterprise_tenant_binding_check[\s\S]*revoked_at IS NOT NULL[\s\S]*role::text = 'super_admin' AND tenant_id IS NULL/);
  assert.ok((migration.match(/\) NOT VALID;/g) || []).length >= 3);
  assert.match(migration, /enterprise_tenant_binding_validate_when_clean/);
  assert.match(migration, /VALIDATE CONSTRAINT memberships_enterprise_tenant_binding_check/);
  assert.match(migration, /VALIDATE CONSTRAINT auth_sessions_enterprise_tenant_binding_check/);
  assert.doesNotMatch(migration, /UPDATE\s+public\.(?:memberships|auth_sessions)/i);
});

test("0096 serializes permission and membership mutations on one durable authority scope", () => {
  const lockSection = section(
    migration,
    "CREATE TABLE IF NOT EXISTS public.enterprise_authority_scope_locks",
    "CREATE OR REPLACE FUNCTION public.nexid_validate_resource_permission_scope_v1()",
  );
  assert.match(lockSection, /user_id uuid NOT NULL[\s\S]*scope_key text NOT NULL[\s\S]*lock_version bigint NOT NULL DEFAULT 0/);
  assert.match(lockSection, /PRIMARY KEY \(user_id, scope_key\)/);
  assert.match(lockSection, /\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/);
  assert.doesNotMatch(lockSection, /\[1-5\]\[0-9a-f\]\{3\}|\[89ab\]\[0-9a-f\]\{3\}/);
  assert.match(lockSection, /nexid_touch_authority_scope_lock_v1\([\s\S]*SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public, pg_temp/);
  assert.match(lockSection, /pg_advisory_xact_lock[\s\S]*INSERT INTO public\.enterprise_authority_scope_locks[\s\S]*ON CONFLICT \(user_id, scope_key\) DO UPDATE[\s\S]*lock_version \+ 1/);
  assert.match(lockSection, /nexid_serialize_authority_scope_v1\(\)[\s\S]*v_old_identity < v_new_identity[\s\S]*OLD\.user_id, OLD\.tenant_id[\s\S]*NEW\.user_id, NEW\.tenant_id[\s\S]*ELSE[\s\S]*NEW\.user_id, NEW\.tenant_id[\s\S]*OLD\.user_id, OLD\.tenant_id/);
  assert.match(lockSection, /CREATE TRIGGER trg_resource_permissions_scope_serialize[\s\S]*BEFORE INSERT OR UPDATE[\s\S]*ON public\.resource_permissions/);
  assert.match(lockSection, /CREATE TRIGGER trg_memberships_permission_scope_serialize[\s\S]*BEFORE DELETE OR UPDATE[\s\S]*ON public\.memberships/);
  assert.match(lockSection, /REVOKE ALL ON TABLE public\.enterprise_authority_scope_locks FROM PUBLIC/);
  assert.match(lockSection, /REVOKE ALL ON FUNCTION public\.nexid_touch_authority_scope_lock_v1\(uuid, uuid\) FROM PUBLIC/);
  assert.match(lockSection, /REVOKE ALL ON FUNCTION public\.nexid_serialize_authority_scope_v1\(\) FROM PUBLIC/);

  for (const verifier of [migration, preflight, dryRun]) {
    assert.match(verifier, /enterprise_authority_scope_locks_pkey/);
    assert.match(verifier, /enterprise_authority_scope_locks_scope_check/);
    assert.match(verifier, /touch_routine\.prosecdef[\s\S]*serializer_routine\.prosecdef[\s\S]*lock_relation\.relowner/);
    assert.match(verifier, /trg_resource_permissions_scope_serialize[\s\S]*tgtype = 23/);
    assert.match(verifier, /trg_memberships_permission_scope_serialize[\s\S]*tgtype = 27/);
    assert.match(verifier, /enterprise_authority_scope_locks[\s\S]*acl\.grantee = 0/);
  }
});

test("0096 makes supplier QA dual control durable across concurrent and direct writers", () => {
  assert.match(migration, /LOCK TABLE public\.supplier_production_qa_plan_decisions[\s\S]*IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(migration, /supplier_qa_dual_control_history_preflight[\s\S]*decision_row\.decided_by = plan\.submitted_by[\s\S]*decision_row\.decided_session_id = plan\.submitted_session_id/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_validate_supplier_qa_plan_dual_control_v1\(\)/);
  assert.match(migration, /NEW\.decided_by IS DISTINCT FROM plan\.submitted_by/);
  assert.match(migration, /NEW\.decided_session_id IS DISTINCT FROM plan\.submitted_session_id/);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER trg_supplier_qa_plan_dual_control[\s\S]*DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_validate_supplier_qa_plan_dual_control_v1\(\) FROM PUBLIC/);
  assert.match(migration, /permission\.action IN \('qa_approve', 'qa', '\*'\)/);
  assert.match(migration, /effective-capability-policy:enterprise-rbac-risk-truth\/v1:[\s\S]*v_approver_role[\s\S]*qa\.plan\.approve/);
});

test("0096 function rewrites cannot retain their exact source fragment", () => {
  const patches = [...migration.matchAll(
    /SELECT public\.nexid_replace_function_fragment_v1\(\s*'([^']+)',\s*\$old\$([\s\S]*?)\$old\$,\s*\$new\$([\s\S]*?)\$new\$\s*\);/g,
  )];
  assert.ok(patches.length >= 20, `expected the reviewed function patch set, got ${patches.length}`);
  for (const [, signature, oldFragment, newFragment] of patches) {
    assert.equal(
      newFragment.includes(oldFragment),
      false,
      `${signature} replacement still contains its exact source fragment`,
    );
  }
  assert.match(migration, /\$old\$\s+IF v_plan\.plan_digest IS DISTINCT FROM lower\(p_input->>'plan_digest'\) THEN[\s\S]*\$new\$[\s\S]*IF \(v_plan\.plan_digest IS DISTINCT FROM lower\(p_input->>'plan_digest'\)\) THEN/);
});

test("0096 migrates historic renamed-function grants to safe wrappers", () => {
  assert.match(migration, /DO \$manifest_core_acl_reconcile\$/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.nexid_import_tag_manifest_v2\(jsonb\) TO %I%s/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON FUNCTION public\.nexid_import_tag_manifest_v2_core_0081\(jsonb\) FROM %I CASCADE/);
  assert.match(migration, /DO \$sun_internal_acl_reconcile\$/);
  assert.match(migration, /nexid_persist_sun_scan_v1_base_0062\(jsonb\)[\s\S]*nexid_persist_sun_scan_v1_base_pre_tt_0093\(jsonb\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.nexid_persist_sun_scan_v1\(jsonb\) TO %I%s/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %I CASCADE/);
  assert.match(migration, /bool_or\(acl\.is_grantable\)[\s\S]*WITH GRANT OPTION/);

  for (const verifier of [migration, preflight, dryRun]) {
    assert.match(verifier, /nexid_import_tag_manifest_v2_core_0081\(jsonb\)[\s\S]*nexid_persist_sun_scan_v1_base_0062\(jsonb\)[\s\S]*nexid_persist_sun_scan_v1_base_pre_tt_0093\(jsonb\)[\s\S]*acl\.grantee <> (?:internal_routine|core_routine)\.proowner/);
  }
});

test("0096 binds the complete SUN persistence chain to one hardened owner without widening the historical primitive", () => {
  assert.match(migration, /DO \$sun_persistence_owner_preflight\$/);
  assert.match(migration, /sun_persistence_common_owner_required/);
  assert.doesNotMatch(migration, /nexid_persist_sun_scan_v1(?:_base(?:_0062|_pre_tt_0093))?\(jsonb\) OWNER TO/);
  for (const signature of [
    "nexid_persist_sun_scan_v1\\(jsonb\\)",
    "nexid_persist_sun_scan_v1_base_0062\\(jsonb\\)",
    "nexid_persist_sun_scan_v1_base_pre_tt_0093\\(jsonb\\)",
  ]) {
    assert.match(migration, new RegExp(`ALTER FUNCTION public\\.${signature}[\\s\\S]*?SET search_path TO pg_catalog, public, pg_temp`));
  }
  assert.match(migration, /ALTER FUNCTION public\.nexid_persist_sun_scan_v1\(jsonb\) SECURITY DEFINER/);
  assert.match(migration, /ALTER FUNCTION public\.nexid_persist_sun_scan_v1_base_0062\(jsonb\) SECURITY DEFINER/);
  assert.match(migration, /ALTER FUNCTION public\.nexid_persist_sun_scan_v1_base_pre_tt_0093\(jsonb\) SECURITY INVOKER/);

  for (const verifier of [migration, preflight, dryRun]) {
    assert.match(verifier, /NOT historical_routine\.prosecdef/);
    assert.match(verifier, /wrapper_routine\.proowner = base_routine\.proowner/);
    assert.match(verifier, /wrapper_routine\.proowner = historical_routine\.proowner/);
    assert.match(verifier, /historical_routine\.proconfig = ARRAY\['search_path=pg_catalog, public, pg_temp'\]::text\[\]/);
  }
  assert.match(migration, /Function bodies are untouched[\s\S]*physical NFC cryptographic path/);
});

test("0096 versions deterministic software risk and separates historical projection from NFC evidence", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS risk_profile_version text;/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.event_risk_projections/);
  assert.match(migration, /CONSTRAINT event_risk_projections_pkey PRIMARY KEY \([\s\S]*event_id, event_created_at, risk_profile_version[\s\S]*\)/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_event_risk_projections_tenant_created/);
  for (const constraint of [
    "event_risk_projections_version_check",
    "event_risk_projections_score_check",
    "event_risk_projections_rules_check",
  ]) assert.match(migration, new RegExp(`${constraint}[\\s\\S]*constraint_row\\.convalidated`));
  for (const constraint of [
    "event_risk_projections_version_check",
    "event_risk_projections_score_check",
    "event_risk_projections_rules_check",
  ]) {
    assert.match(migration, new RegExp(`DROP CONSTRAINT IF EXISTS ${constraint}[\\s\\S]*ADD CONSTRAINT ${constraint}[\\s\\S]*NOT VALID[\\s\\S]*VALIDATE CONSTRAINT ${constraint}`));
  }
  assert.match(migration, /pg_catalog\.pg_attribute[\s\S]*attribute_row\.attnum > 0[\s\S]*\) <> 9/);
  for (const column of [
    "event_id", "event_created_at", "tenant_id", "risk_profile_version",
    "risk_score", "risk_level", "triggered_rules", "recommended_action", "projected_at",
  ]) assert.match(migration, new RegExp(`'${column}'`));
  assert.match(migration, /pg_catalog\.pg_get_expr\(default_row\.adbin, default_row\.adrelid\)[\s\S]*expected\.default_expression/);
  assert.match(migration, /risk_profile_version=''nexid-risk-v1''::text/);
  assert.match(migration, /risk_score>=0andrisk_score<=100/);
  assert.match(migration, /jsonb_typeoftriggered_rules=''array''::text/);
  assert.match(migration, /idx_event_risk_projections_tenant_created[\s\S]*indisready[\s\S]*indislive[\s\S]*ARRAY\['tenant_id', 'risk_profile_version', 'event_created_at DESC', 'event_id DESC'\]/);
  assert.match(migration, /pg_catalog\.aclexplode\([\s\S]*public\.resource_permissions[\s\S]*public\.event_risk_projections[\s\S]*acl\.grantee = 0/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_compute_event_risk_v1\(/);

  const scorer = section(
    migration,
    "CREATE OR REPLACE FUNCTION public.nexid_compute_event_risk_v1(",
    "-- New or legitimately mutable events",
  );
  for (const rule of [
    "INVALID_SUN_OR_CMAC",
    "REPLAY_SUSPECT",
    "UID_NOT_REGISTERED",
    "TAG_INACTIVE_OR_REVOKED",
    "EXCESSIVE_SCAN_FREQUENCY",
    "IMPOSSIBLE_TRAVEL_OR_GEO_ANOMALY",
    "DISTRIBUTOR_OR_REGION_MISMATCH",
    "TAMPER_BEFORE_EXPECTED_SALE_STAGE",
    "REPEATED_OWNERSHIP_ATTEMPTS",
    "UNEXPECTED_DEVICE_OR_NETWORK",
    "BATCH_QUARANTINED",
  ]) {
    assert.match(priorRiskMigration, new RegExp(rule));
    assert.match(scorer, new RegExp(rule));
  }
  assert.match(scorer, /ELSE 'none'::public\.risk_level/);
  assert.match(scorer, /'nexid-risk-v1'::text/);
  assert.match(scorer, /IMMUTABLE[\s\S]*PARALLEL SAFE/);
  assert.match(scorer, /v_meta->>'batch_quarantined'/);
  assert.doesNotMatch(scorer, /FROM public\.batches|batch\.status/);
  assert.doesNotMatch(scorer, /NEW\.(?:risk_score|triggered_rules)|p_risk/);

  const trigger = section(
    migration,
    "CREATE OR REPLACE FUNCTION public.nexid_explain_event_risk_v1()",
    "-- Operators invoke this repeatedly",
  );
  assert.match(trigger, /nexid_compute_event_risk_v1\(/);
  assert.match(trigger, /FROM public\.batches batch[\s\S]*batch\.tenant_id = NEW\.tenant_id/);
  assert.match(trigger, /jsonb_set\([\s\S]*batch_quarantined[\s\S]*OLD\.triggered_rules[\s\S]*BATCH_QUARANTINED/);
  assert.match(trigger, /NEW\.risk_profile_version := v_projection\.risk_profile_version/);
  assert.match(trigger, /BEFORE INSERT OR UPDATE OF[\s\S]*tenant_id, event_type[\s\S]*risk_score, risk_level, triggered_rules, recommended_action,[\s\S]*risk_profile_version/);
});

test("0096 backfill is bounded, concurrent-safe and never updates canonical events", () => {
  const backfill = section(
    migration,
    "CREATE OR REPLACE FUNCTION public.nexid_backfill_event_risk_v1(p_limit integer)",
    "CREATE OR REPLACE FUNCTION public.nexid_enterprise_rbac_risk_truth_v1_capability()",
  );
  assert.match(backfill, /p_limit IS NULL OR p_limit < 1 OR p_limit > 5000/);
  assert.match(backfill, /WITH candidates AS MATERIALIZED/);
  assert.match(backfill, /WHERE event_row\.risk_profile_version IS NULL/);
  assert.match(backfill, /NOT EXISTS[\s\S]*event_risk_projections existing_projection/);
  assert.match(backfill, /ORDER BY event_row\.id, event_row\.created_at/);
  assert.match(backfill, /FOR UPDATE OF event_row SKIP LOCKED/);
  assert.match(backfill, /INSERT INTO public\.event_risk_projections/);
  assert.match(backfill, /event_row\.triggered_rules[\s\S]*BATCH_QUARANTINED/);
  assert.match(backfill, /ON CONFLICT \(event_id, event_created_at, risk_profile_version\) DO NOTHING/);
  assert.doesNotMatch(backfill, /UPDATE\s+public\.events|UPDATE\s+public\.tags|SET\s+risk_score/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.nexid_backfill_event_risk_v1\(integer\) FROM PUBLIC/);
  assert.doesNotMatch(migration, /(?:SELECT|PERFORM)\s+public\.nexid_backfill_event_risk_v1\(/i);
});

test("0096 preserves physical NFC and custody truth", () => {
  assert.match(migration, /SELECT 'enterprise-rbac-risk-truth\/v1'::text/);
  assert.match(migration, /canonical events \(including consumed SUN evidence\) are never updated/);
  assert.doesNotMatch(migration, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER TABLE)\s+(?:public\.)?(?:tags|batch_keys|batch_key_material|sun_counter_state)\b/i);
  assert.doesNotMatch(migration, /UPDATE\s+public\.events/i);
  assert.doesNotMatch(migration, /hsm[_ -]?backed\s*[:=]\s*true|managed[_ -]?kms\s*[:=]\s*true/i);
});
