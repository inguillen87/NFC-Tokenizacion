import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  assertSunAtomicPostgresQaTarget,
  readSunAtomicPostgresQaConfig,
  sanitizeSunAtomicQaFailure,
} from "./lib/sun-atomic-postgres-qa-safety.mjs";

export const ENTERPRISE_RUNTIME_ROLE_REQUIRED_MIGRATIONS = Object.freeze([
  "20260802200000_0085_supplier_non_sun_qa_evidence.sql",
  "20260802260000_0091_supplier_keyless_qa_activation.sql",
  "20260802270000_0092_supplier_carrier_scope_integrity.sql",
  "20260802280000_0093_sun_tt_durable_truth_binding.sql",
  "20260802290000_0094_sun_runtime_acl_boundary.sql",
  "20260802300000_0095_sun_tt_conflict_target.sql",
  "20260802310000_0096_enterprise_rbac_risk_truth.sql",
  "20260802320000_0097_sun_demo_replay_isolation.sql",
]);

export const ENTERPRISE_RUNTIME_ROLE_FUNCTIONS = Object.freeze([
  "public.nexid_supplier_carrier_qa_v1_capability()",
  "public.nexid_commit_supplier_carrier_qa_v1(jsonb)",
  "public.nexid_supplier_keyless_qa_activation_v1_capability()",
  "public.nexid_supplier_keyless_production_activation_receipt_v1(uuid)",
  "public.nexid_supplier_carrier_scope_integrity_v1_capability()",
  "public.nexid_import_tag_manifest_v2(jsonb)",
  "public.nexid_sun_tt_durable_truth_v1_capability()",
  "public.nexid_persist_sun_scan_v1(jsonb)",
  "public.nexid_enterprise_rbac_risk_truth_v1_capability()",
]);

export const ENTERPRISE_RUNTIME_ROLE_RECEIPT_TABLES = Object.freeze([
  "public.supplier_qa_carrier_evidence_receipts",
  "public.supplier_keyless_production_qa_acceptance_receipts",
  "public.sun_tt_truth_receipts",
]);

export const ENTERPRISE_RUNTIME_ROLE_INTERNAL_DENY_FUNCTIONS = Object.freeze([
  "public.nexid_import_tag_manifest_v2_core_0081(jsonb)",
  "public.nexid_persist_sun_scan_v1_base_0062(jsonb)",
  "public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)",
  "public.nexid_sun_demo_replay_isolation_v1_capability()",
  "public.nexid_sun_replay_watermark_repair_immutable_v1()",
  "public.nexid_enforce_supplier_batch_key_carrier_scope_v1()",
  "public.nexid_backfill_event_risk_v1(integer)",
]);

const CAPABILITY_EXPECTATIONS = Object.freeze({
  supplier_carrier_qa: "supplier-carrier-qa/v1",
  supplier_keyless_qa_activation: "supplier-keyless-qa-activation/v1",
  supplier_carrier_scope_integrity: "supplier-carrier-scope-integrity/v1",
  sun_tt_durable_truth: "sun-tt-durable-truth-binding/v1",
  enterprise_rbac_risk_truth: "enterprise-rbac-risk-truth/v1",
});

export function enterpriseRuntimeRoleName(randomHex) {
  const normalized = String(randomHex || "").toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(normalized)) {
    throw new Error("enterprise_runtime_role_random_suffix_invalid");
  }
  return `codex_qa_runtime_${normalized}`;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function clientOptions(config) {
  return {
    connectionString: config.databaseUrl,
    application_name: `nexid_runtime_role_qa_${randomBytes(4).toString("hex")}`,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
    ssl: { rejectUnauthorized: true },
  };
}

function bool(value) {
  return value === true || value === "t";
}

export function assertEnterpriseRuntimeRoleAclState({
  functionRows,
  tableRows,
  internalRows,
}) {
  const functions = Array.isArray(functionRows) ? functionRows : [];
  const tables = Array.isArray(tableRows) ? tableRows : [];
  const internals = Array.isArray(internalRows) ? internalRows : [];

  assert.equal(functions.length, ENTERPRISE_RUNTIME_ROLE_FUNCTIONS.length,
    "runtime role function ACL receipt count mismatch");
  assert.equal(tables.length, ENTERPRISE_RUNTIME_ROLE_RECEIPT_TABLES.length,
    "runtime role table ACL receipt count mismatch");
  assert.equal(internals.length, ENTERPRISE_RUNTIME_ROLE_INTERNAL_DENY_FUNCTIONS.length,
    "runtime role internal deny receipt count mismatch");

  for (const row of functions) {
    assert.equal(bool(row.exists), true, `required runtime function missing: ${row.signature}`);
    assert.equal(bool(row.can_execute), true, `runtime role lacks EXECUTE: ${row.signature}`);
    assert.equal(bool(row.public_execute), false, `PUBLIC may execute private runtime function: ${row.signature}`);
  }
  for (const row of tables) {
    assert.equal(bool(row.exists), true, `required runtime receipt table missing: ${row.relation}`);
    assert.equal(bool(row.can_select), true, `runtime role lacks SELECT: ${row.relation}`);
    assert.equal(bool(row.can_insert), true, `runtime role lacks INSERT: ${row.relation}`);
    assert.equal(bool(row.can_update), false, `runtime role may UPDATE append-only receipt: ${row.relation}`);
    assert.equal(bool(row.can_delete), false, `runtime role may DELETE append-only receipt: ${row.relation}`);
    assert.equal(bool(row.public_select), false, `PUBLIC may SELECT private receipt table: ${row.relation}`);
    assert.equal(bool(row.public_insert), false, `PUBLIC may INSERT private receipt table: ${row.relation}`);
  }
  for (const row of internals) {
    assert.equal(bool(row.exists), true, `internal runtime function missing: ${row.signature}`);
    assert.equal(bool(row.can_execute), false, `runtime role may execute internal helper: ${row.signature}`);
    assert.equal(bool(row.public_execute), false, `PUBLIC may execute internal helper: ${row.signature}`);
  }
  return true;
}

async function assertRequiredSchema(client) {
  const migrationRows = (await client.query(`SELECT id
    FROM public.schema_migrations
    WHERE id = ANY($1::text[])
    ORDER BY id`, [ENTERPRISE_RUNTIME_ROLE_REQUIRED_MIGRATIONS])).rows.map((row) => String(row.id));
  if (migrationRows.length !== ENTERPRISE_RUNTIME_ROLE_REQUIRED_MIGRATIONS.length
    || ENTERPRISE_RUNTIME_ROLE_REQUIRED_MIGRATIONS.some((migration) => !migrationRows.includes(migration))) {
    throw new Error("enterprise_runtime_role_required_migrations_missing");
  }

  const sunBoundary = (await client.query(`SELECT
    to_regprocedure('public.nexid_sun_runtime_acl_v1_capability()') IS NOT NULL AS capability_exists,
    to_regprocedure('public.nexid_sun_tt_conflict_target_v1_capability()') IS NOT NULL
      AS conflict_capability_exists,
    to_regprocedure('public.nexid_sun_demo_replay_isolation_v1_capability()') IS NOT NULL
      AS demo_replay_isolation_capability_exists,
    to_regclass('public.sun_replay_watermark_repairs') IS NOT NULL
      AS replay_watermark_repair_table_exists,
    EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      WHERE NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND trigger_row.tgname = 'trg_sun_replay_watermark_repairs_append_only'
        AND trigger_row.tgrelid = to_regclass('public.sun_replay_watermark_repairs')
    ) AS replay_watermark_repair_append_only,
    COALESCE((
      SELECT NOT historical_routine.prosecdef
        AND historical_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        AND position(
          'v_execution_class := CASE WHEN v_source = ''demo'' THEN ''demo'' ELSE ''operational'' END'
          IN pg_get_functiondef(historical_routine.oid)
        ) > 0
        AND position(
          'IF v_tag_id IS NOT NULL AND v_execution_class = ''operational'''
          IN pg_get_functiondef(historical_routine.oid)
        ) > 0
        AND position(
          '''replay_execution_class'', v_execution_class'
          IN pg_get_functiondef(historical_routine.oid)
        ) > 0
      FROM pg_proc historical_routine
      WHERE historical_routine.oid = to_regprocedure(
        'public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)'
      )
    ), false) AS demo_replay_execution_boundary_exact,
    COALESCE(position(
      'ON CONFLICT ON CONSTRAINT sun_tt_truth_receipts_pkey DO NOTHING'
      IN pg_get_functiondef(to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'))
    ) > 0, false) AS deterministic_conflict_target,
    COALESCE(position(
      'ON CONFLICT (event_id, event_created_at) DO NOTHING'
      IN pg_get_functiondef(to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'))
    ) = 0, false) AS ambiguous_conflict_target_absent,
    EXISTS (
      SELECT 1
      FROM pg_constraint constraint_row
      WHERE constraint_row.conrelid = to_regclass('public.sun_tt_truth_receipts')
        AND constraint_row.conname = 'sun_tt_truth_receipts_pkey'
        AND constraint_row.contype = 'p'
        AND (
          SELECT array_agg(attribute_row.attname::text ORDER BY key_column.ordinality)
          FROM unnest(constraint_row.conkey) WITH ORDINALITY key_column(attnum, ordinality)
          JOIN pg_attribute attribute_row
            ON attribute_row.attrelid = constraint_row.conrelid
           AND attribute_row.attnum = key_column.attnum
        ) = ARRAY['event_id', 'event_created_at']::text[]
    ) AS receipt_primary_key_exact,
    COALESCE((SELECT routine.prosecdef
      FROM pg_proc routine
      WHERE routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)')), false)
      AS wrapper_security_definer,
    COALESCE((SELECT routine.prosecdef
      FROM pg_proc routine
      WHERE routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')), false)
      AS base_security_definer,
    COALESCE((SELECT NOT historical_routine.prosecdef
        AND wrapper_routine.proowner = base_routine.proowner
        AND wrapper_routine.proowner = historical_routine.proowner
        AND wrapper_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        AND base_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        AND historical_routine.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM pg_proc wrapper_routine
      JOIN pg_proc base_routine
        ON base_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')
      JOIN pg_proc historical_routine
        ON historical_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)')
      WHERE wrapper_routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)')), false)
      AS sun_definer_owner_and_search_path_exact,
    COALESCE((SELECT routine.prosecdef
        AND routine.proowner = core_routine.proowner
        AND routine.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM pg_proc routine
      JOIN pg_proc core_routine
        ON core_routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')
      WHERE routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)')), false)
      AS manifest_wrapper_security_definer,
    COALESCE((SELECT routine.prosecdef
      FROM pg_proc routine
      WHERE routine.oid = to_regprocedure('public.nexid_import_tag_manifest_v2_core_0081(jsonb)')), true)
      AS manifest_core_security_definer,
    to_regprocedure('public.nexid_enterprise_rbac_risk_truth_v1_capability()') IS NOT NULL
      AS enterprise_rbac_risk_capability_exists,
    to_regprocedure('public.nexid_backfill_event_risk_v1(integer)') IS NOT NULL
      AS event_risk_backfill_exists,
    COALESCE(EXISTS (
      SELECT 1
      FROM pg_proc routine
      CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
      WHERE routine.oid = to_regprocedure('public.nexid_backfill_event_risk_v1(integer)')
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ), false) AS public_can_execute_event_risk_backfill,
    has_schema_privilege('public', 'public', 'CREATE') AS public_can_create_in_schema,
    COALESCE(EXISTS (
      SELECT 1
      FROM pg_proc routine
      CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
      WHERE routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ), false) AS public_can_execute_base`)).rows[0] || {};
  if (!bool(sunBoundary.capability_exists)
    || !bool(sunBoundary.conflict_capability_exists)
    || !bool(sunBoundary.demo_replay_isolation_capability_exists)
    || !bool(sunBoundary.replay_watermark_repair_table_exists)
    || !bool(sunBoundary.replay_watermark_repair_append_only)
    || !bool(sunBoundary.demo_replay_execution_boundary_exact)
    || !bool(sunBoundary.deterministic_conflict_target)
    || !bool(sunBoundary.ambiguous_conflict_target_absent)
    || !bool(sunBoundary.receipt_primary_key_exact)
    || !bool(sunBoundary.wrapper_security_definer)
    || !bool(sunBoundary.base_security_definer)
    || !bool(sunBoundary.sun_definer_owner_and_search_path_exact)
    || !bool(sunBoundary.manifest_wrapper_security_definer)
    || bool(sunBoundary.manifest_core_security_definer)
    || !bool(sunBoundary.enterprise_rbac_risk_capability_exists)
    || !bool(sunBoundary.event_risk_backfill_exists)
    || bool(sunBoundary.public_can_execute_event_risk_backfill)
    || bool(sunBoundary.public_can_create_in_schema)
    || bool(sunBoundary.public_can_execute_base)) {
    throw new Error("enterprise_runtime_role_sun_acl_boundary_missing");
  }

  const functionRows = (await client.query(`WITH required(signature) AS (
      SELECT unnest($1::text[])
    )
    SELECT
      required.signature,
      routine.oid IS NOT NULL AS exists,
      COALESCE(has_function_privilege(current_user, routine.oid, 'EXECUTE'), false) AS can_execute,
      COALESCE(EXISTS (
        SELECT 1
        FROM aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
        WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
      ), false) AS public_execute
    FROM required
    LEFT JOIN pg_proc routine ON routine.oid = to_regprocedure(required.signature)
    ORDER BY required.signature`, [ENTERPRISE_RUNTIME_ROLE_FUNCTIONS])).rows;
  for (const row of functionRows) {
    if (!bool(row.exists) || !bool(row.can_execute) || bool(row.public_execute)) {
      throw new Error(`enterprise_runtime_role_function_preflight_failed:${row.signature}`);
    }
  }

  const tableRows = (await client.query(`WITH required(relation) AS (
      SELECT unnest($1::text[])
    )
    SELECT
      required.relation,
      relation.oid IS NOT NULL AS exists,
      COALESCE(has_table_privilege(current_user, relation.oid, 'SELECT,INSERT'), false) AS owner_can_use,
      EXISTS (
        SELECT 1 FROM information_schema.table_privileges privilege
        WHERE privilege.grantee = 'PUBLIC'
          AND privilege.table_schema = split_part(required.relation, '.', 1)
          AND privilege.table_name = split_part(required.relation, '.', 2)
          AND privilege.privilege_type = 'SELECT'
      ) AS public_select,
      EXISTS (
        SELECT 1 FROM information_schema.table_privileges privilege
        WHERE privilege.grantee = 'PUBLIC'
          AND privilege.table_schema = split_part(required.relation, '.', 1)
          AND privilege.table_name = split_part(required.relation, '.', 2)
          AND privilege.privilege_type = 'INSERT'
      ) AS public_insert
    FROM required
    LEFT JOIN pg_class relation ON relation.oid = to_regclass(required.relation)
    ORDER BY required.relation`, [ENTERPRISE_RUNTIME_ROLE_RECEIPT_TABLES])).rows;
  for (const row of tableRows) {
    if (!bool(row.exists) || !bool(row.owner_can_use) || bool(row.public_select) || bool(row.public_insert)) {
      throw new Error(`enterprise_runtime_role_table_preflight_failed:${row.relation}`);
    }
  }
  return Object.freeze({ migrations: Object.freeze(migrationRows) });
}

async function readRoleAclState(client) {
  const functionRows = (await client.query(`WITH required(signature) AS (
      SELECT unnest($1::text[])
    )
    SELECT
      required.signature,
      routine.oid IS NOT NULL AS exists,
      COALESCE(has_function_privilege(current_user, routine.oid, 'EXECUTE'), false) AS can_execute,
      COALESCE(EXISTS (
        SELECT 1
        FROM aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
        WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
      ), false) AS public_execute
    FROM required
    LEFT JOIN pg_proc routine ON routine.oid = to_regprocedure(required.signature)
    ORDER BY required.signature`, [ENTERPRISE_RUNTIME_ROLE_FUNCTIONS])).rows;

  const tableRows = (await client.query(`WITH required(relation) AS (
      SELECT unnest($1::text[])
    )
    SELECT
      required.relation,
      relation.oid IS NOT NULL AS exists,
      COALESCE(has_table_privilege(current_user, relation.oid, 'SELECT'), false) AS can_select,
      COALESCE(has_table_privilege(current_user, relation.oid, 'INSERT'), false) AS can_insert,
      COALESCE(has_table_privilege(current_user, relation.oid, 'UPDATE'), false) AS can_update,
      COALESCE(has_table_privilege(current_user, relation.oid, 'DELETE'), false) AS can_delete,
      EXISTS (
        SELECT 1 FROM information_schema.table_privileges privilege
        WHERE privilege.grantee = 'PUBLIC'
          AND privilege.table_schema = split_part(required.relation, '.', 1)
          AND privilege.table_name = split_part(required.relation, '.', 2)
          AND privilege.privilege_type = 'SELECT'
      ) AS public_select,
      EXISTS (
        SELECT 1 FROM information_schema.table_privileges privilege
        WHERE privilege.grantee = 'PUBLIC'
          AND privilege.table_schema = split_part(required.relation, '.', 1)
          AND privilege.table_name = split_part(required.relation, '.', 2)
          AND privilege.privilege_type = 'INSERT'
      ) AS public_insert
    FROM required
    LEFT JOIN pg_class relation ON relation.oid = to_regclass(required.relation)
    ORDER BY required.relation`, [ENTERPRISE_RUNTIME_ROLE_RECEIPT_TABLES])).rows;

  const internalRows = (await client.query(`WITH required(signature) AS (
      SELECT unnest($1::text[])
    )
    SELECT
      required.signature,
      routine.oid IS NOT NULL AS exists,
      COALESCE(has_function_privilege(current_user, routine.oid, 'EXECUTE'), false) AS can_execute,
      COALESCE(EXISTS (
        SELECT 1
        FROM aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
        WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
      ), false) AS public_execute
    FROM required
    LEFT JOIN pg_proc routine ON routine.oid = to_regprocedure(required.signature)
    ORDER BY required.signature`, [ENTERPRISE_RUNTIME_ROLE_INTERNAL_DENY_FUNCTIONS])).rows;

  assertEnterpriseRuntimeRoleAclState({ functionRows, tableRows, internalRows });
  return Object.freeze({ functionRows, tableRows, internalRows });
}

async function expectPermissionDenied(client, savepoint, statement) {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(statement);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    if (String(error?.code || "") !== "42501") throw error;
    return true;
  }
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  throw new Error(`enterprise_runtime_role_unexpected_access:${savepoint}`);
}

async function expectDatabaseRejection(client, savepoint, statement, parameters, expectedCode, expectedMessage) {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(statement, parameters);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    assert.equal(String(error?.code || ""), expectedCode,
      `unexpected database rejection code for ${savepoint}`);
    assert.equal(String(error?.message || ""), expectedMessage,
      `unexpected database rejection message for ${savepoint}`);
    return true;
  }
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  throw new Error(`enterprise_runtime_role_expected_rejection_missing:${savepoint}`);
}

async function validateEphemeralRole(client, roleName) {
  const role = quoteIdentifier(roleName);
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query(`CREATE ROLE ${role}
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    await client.query(`GRANT ${role} TO CURRENT_USER`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    for (const signature of ENTERPRISE_RUNTIME_ROLE_FUNCTIONS) {
      await client.query(`GRANT EXECUTE ON FUNCTION ${signature} TO ${role}`);
    }
    for (const relation of ENTERPRISE_RUNTIME_ROLE_RECEIPT_TABLES) {
      await client.query(`GRANT SELECT, INSERT ON TABLE ${relation} TO ${role}`);
    }
    const manifestFixture = {
      tenantId: randomUUID(),
      tenantSlug: `runtime-wrapper-${randomBytes(6).toString("hex")}`,
      batchId: randomUUID(),
      bid: `QA-RUNTIME-${randomBytes(6).toString("hex").toUpperCase()}`,
      carrierProfileCode: "qr_basic",
    };
    await client.query(`INSERT INTO tenants (id, slug, name, root_key_ct)
      VALUES ($1::uuid, $2, 'Enterprise runtime wrapper QA', 'not-a-key:synthetic-validation-fixture')`, [
      manifestFixture.tenantId,
      manifestFixture.tenantSlug,
    ]);
    await client.query(`INSERT INTO batches (
        id, tenant_id, bid, status, sdm_config, carrier_profile_code
      ) VALUES (
        $1::uuid, $2::uuid, $3, 'active',
        '{"qa_fixture":"enterprise_runtime_wrapper_v1","raw_key_material_present":false}'::jsonb,
        $4
      )`, [
      manifestFixture.batchId,
      manifestFixture.tenantId,
      manifestFixture.bid,
      manifestFixture.carrierProfileCode,
    ]);
    await client.query(`SET LOCAL ROLE ${role}`);

    const identity = (await client.query(`SELECT
      current_user AS runtime_role,
      session_user AS migration_role,
      COALESCE((SELECT rolcanlogin FROM pg_roles WHERE rolname = current_user), true) AS can_login,
      COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), true) AS is_superuser,
      COALESCE((SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user), true) AS can_create_role,
      COALESCE((SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user), true) AS can_create_database,
      COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), true) AS can_bypass_rls`)).rows[0] || {};
    assert.equal(String(identity.runtime_role), roleName);
    assert.equal(bool(identity.can_login), false);
    assert.equal(bool(identity.is_superuser), false);
    assert.equal(bool(identity.can_create_role), false);
    assert.equal(bool(identity.can_create_database), false);
    assert.equal(bool(identity.can_bypass_rls), false);
    assert.equal(
      bool((await client.query("SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create")).rows[0]?.can_create),
      false,
      "runtime role must not CREATE objects in the SECURITY DEFINER search path",
    );

    const acl = await readRoleAclState(client);
    const capabilities = (await client.query(`SELECT
      public.nexid_supplier_carrier_qa_v1_capability() AS supplier_carrier_qa,
      public.nexid_supplier_keyless_qa_activation_v1_capability() AS supplier_keyless_qa_activation,
      public.nexid_supplier_carrier_scope_integrity_v1_capability() AS supplier_carrier_scope_integrity,
      public.nexid_sun_tt_durable_truth_v1_capability() AS sun_tt_durable_truth,
      public.nexid_enterprise_rbac_risk_truth_v1_capability() AS enterprise_rbac_risk_truth`)).rows[0] || {};
    const capabilityReceipt = Object.freeze({ ...capabilities });
    assert.deepEqual(capabilityReceipt, CAPABILITY_EXPECTATIONS);

    const manifestWrapperReachedPrivateCore = await expectDatabaseRejection(
      client,
      "manifest_wrapper_reaches_core",
      "SELECT * FROM public.nexid_import_tag_manifest_v2($1::jsonb)",
      [JSON.stringify({
        tenant_id: manifestFixture.tenantId,
        batch_id: manifestFixture.batchId,
        carrier_profile_code: manifestFixture.carrierProfileCode,
        rows: [],
      })],
      "22023",
      "supplier_manifest_contract_invalid",
    );

    const denied = Object.freeze({
      internal_manifest_core_execute: await expectPermissionDenied(
        client,
        "deny_internal_manifest",
        "SELECT public.nexid_import_tag_manifest_v2_core_0081('{}'::jsonb)",
      ),
      private_batch_key_read: await expectPermissionDenied(
        client,
        "deny_batch_key_read",
        "SELECT 1 FROM public.batch_keys WHERE false",
      ),
      private_sun_replay_watermark_repair_read: await expectPermissionDenied(
        client,
        "deny_sun_replay_watermark_repair_read",
        "SELECT 1 FROM public.sun_replay_watermark_repairs WHERE false",
      ),
      tt_receipt_update: await expectPermissionDenied(
        client,
        "deny_tt_update",
        "UPDATE public.sun_tt_truth_receipts SET canonical_product_state = canonical_product_state WHERE false",
      ),
      carrier_receipt_delete: await expectPermissionDenied(
        client,
        "deny_carrier_delete",
        "DELETE FROM public.supplier_qa_carrier_evidence_receipts WHERE false",
      ),
    });

    await client.query("ROLLBACK");
    transactionOpen = false;
    const persisted = Number((await client.query(
      "SELECT count(*)::integer AS count FROM pg_roles WHERE rolname = $1",
      [roleName],
    )).rows[0]?.count || 0);
    assert.equal(persisted, 0, "ephemeral runtime role must disappear on rollback");

    return Object.freeze({
      role_profile: Object.freeze({
        no_login: true,
        no_superuser: true,
        no_create_role: true,
        no_create_database: true,
        no_bypass_rls: true,
        no_create_in_public_schema: true,
      }),
      granted_function_count: acl.functionRows.length,
      granted_receipt_table_count: acl.tableRows.length,
      denied_internal_function_count: acl.internalRows.length,
      capability_calls: capabilityReceipt,
      manifest_wrapper_reached_private_core: manifestWrapperReachedPrivateCore,
      actual_permission_denials: denied,
      role_removed_after_transaction_rollback: true,
    });
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => null);
  }
}

export async function runEnterpriseRuntimeRolePostgresQa(env = process.env) {
  const config = readSunAtomicPostgresQaConfig(env);
  const client = new pg.Client(clientOptions(config));
  const roleName = enterpriseRuntimeRoleName(randomBytes(8).toString("hex"));
  await client.connect();
  try {
    const base = await assertSunAtomicPostgresQaTarget(client, config);
    const schema = await assertRequiredSchema(client);
    const evidence = await validateEphemeralRole(client, roleName);
    return Object.freeze({
      ok: true,
      validator: "enterprise_runtime_role_postgres_acl_v1",
      target: Object.freeze({
        endpoint_id: base.endpointId,
        database: base.databaseName,
        migration_role: base.databaseRole,
        safe_target: config.safeTarget,
        postgres_version_number: base.postgresVersionNumber,
      }),
      migrations: Object.freeze([...base.appliedMigrations, ...schema.migrations]),
      evidence,
      boundaries: Object.freeze({
        production_touched: false,
        disposable_neon_postgresql_only: true,
        production_runtime_role_created_or_changed: false,
        business_mutation_functions_executed: false,
        physical_nfc_cryptographic_path_touched: false,
        software_envelope_claimed_as_kms_or_hsm: false,
        managed_kms_validated: false,
        hsm_validated: false,
      }),
      cleanup: "automatic_transaction_rollback_no_role_or_business_rows_persisted",
    });
  } finally {
    await client.end().catch(() => null);
  }
}

const invokedPath = typeof process !== "undefined" && process.argv?.[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  let config = null;
  try {
    config = readSunAtomicPostgresQaConfig(process.env);
    console.log(JSON.stringify(await runEnterpriseRuntimeRolePostgresQa(process.env)));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      validator: "enterprise_runtime_role_postgres_acl_v1",
      reason: sanitizeSunAtomicQaFailure(error, config),
      cleanup: "transaction_rollback_attempted_no_production_role_changes_authorized",
    }));
    process.exitCode = 1;
  }
}
