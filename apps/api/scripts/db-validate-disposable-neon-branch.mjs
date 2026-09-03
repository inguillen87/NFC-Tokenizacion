import fs from "node:fs/promises";
import path from "node:path";

import pg from "pg";

const CONFIRMATION = "I_UNDERSTAND_THIS_IS_A_DISPOSABLE_NEON_DATABASE";
const DATABASE_NAME_PATTERN = /^codex_qa_[a-z0-9_]{1,40}$/;
const ENDPOINT_PATTERN = /^ep-[a-z0-9-]{3,80}$/;

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name}_required`);
  return value;
}

function containsExplicitTransactionControl(sql) {
  return /^\s*(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+(?:WORK|TRANSACTION))?|ROLLBACK(?:\s+(?:WORK|TRANSACTION))?)\s*;\s*$/im.test(sql);
}

const databaseUrl = required("NEXID_DISPOSABLE_DATABASE_URL");
const expectedEndpointId = required("NEXID_DISPOSABLE_NEON_ENDPOINT_ID");
if (required("NEXID_DISPOSABLE_MIGRATION_CONFIRMATION") !== CONFIRMATION) {
  throw new Error("disposable_migration_confirmation_invalid");
}
if (!ENDPOINT_PATTERN.test(expectedEndpointId)) {
  throw new Error("disposable_neon_endpoint_id_invalid");
}

const parsedUrl = new URL(databaseUrl);
const expectedDatabaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
if (!DATABASE_NAME_PATTERN.test(expectedDatabaseName)) {
  throw new Error("disposable_database_name_invalid");
}

const migrationsDir = path.resolve(process.cwd(), "db", "migrations");
const migrationIds = (await fs.readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();
if (migrationIds.length === 0) throw new Error("migration_inventory_empty");

const client = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10_000,
  query_timeout: 120_000,
});
await client.connect();

try {
  const identity = (await client.query(`SELECT
    current_database() AS database_name,
    current_user AS database_role,
    current_setting('neon.endpoint_id', true) AS endpoint_id,
    current_setting('transaction_read_only') AS transaction_read_only`)).rows[0] || {};
  if (identity.database_name !== expectedDatabaseName
    || identity.endpoint_id !== expectedEndpointId
    || String(identity.transaction_read_only).toLowerCase() !== "off") {
    throw new Error("disposable_database_identity_mismatch");
  }

  const existingRelations = Number((await client.query(`SELECT count(*)::integer AS count
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')`)).rows[0]?.count || 0);
  if (existingRelations !== 0) {
    throw new Error(`disposable_database_not_empty:${existingRelations}`);
  }

  await client.query(`CREATE TABLE schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  for (const migrationId of migrationIds) {
    const body = await fs.readFile(path.join(migrationsDir, migrationId), "utf8");
    if (containsExplicitTransactionControl(body)) {
      throw new Error(`migration_contains_transaction_control:${migrationId}`);
    }
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '120s'");
      await client.query(body);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migrationId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      const reason = error instanceof Error ? error.message : "migration_failed";
      throw new Error(`migration_failed:${migrationId}:${reason}`, { cause: error });
    }
  }

  const postcheck = (await client.query(`SELECT
    (SELECT count(*)::integer FROM schema_migrations) AS migration_count,
    to_regclass('public.supplier_production_qa_plans') IS NOT NULL AS production_qa_plans,
    to_regclass('public.supplier_production_qa_plan_decisions') IS NOT NULL AS production_qa_plan_decisions,
    to_regclass('public.supplier_production_qa_sessions') IS NOT NULL AS production_qa_sessions,
    to_regclass('public.supplier_production_qa_decisions') IS NOT NULL AS production_qa_decisions,
    to_regprocedure('public.nexid_submit_supplier_production_qa_plan_v1(jsonb)') IS NOT NULL AS plan_writer,
    to_regprocedure('public.nexid_decide_supplier_production_qa_plan_v1(jsonb)') IS NOT NULL AS plan_decision_writer,
    to_regprocedure('public.nexid_create_supplier_production_qa_session_v1(jsonb)') IS NOT NULL AS session_writer,
    to_regprocedure('public.nexid_commit_supplier_production_qa_v1(jsonb)') IS NOT NULL AS decision_writer,
    to_regprocedure('public.nexid_supplier_keyless_qa_activation_v1_capability()') IS NOT NULL AS keyless_qa_activation,
    to_regprocedure('public.nexid_supplier_carrier_scope_integrity_v1_capability()') IS NOT NULL AS carrier_scope_integrity,
    to_regprocedure('public.nexid_sun_tt_durable_truth_v1_capability()') IS NOT NULL AS sun_tt_durable_truth,
    to_regprocedure('public.nexid_sun_runtime_acl_v1_capability()') IS NOT NULL
      AND COALESCE((SELECT routine.prosecdef FROM pg_proc routine
        WHERE routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)')), false)
      AND COALESCE((SELECT routine.prosecdef FROM pg_proc routine
        WHERE routine.oid = to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')), false)
      AND NOT has_schema_privilege('public', 'public', 'CREATE')
      AND NOT COALESCE(EXISTS (
        SELECT 1
        FROM pg_proc routine
        CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
        WHERE routine.oid IN (
          to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)'),
          to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)')
        )
          AND acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
      ), false) AS sun_runtime_acl_boundary,
    to_regprocedure('public.nexid_sun_tt_conflict_target_v1_capability()') IS NOT NULL
      AND COALESCE(position(
        'ON CONFLICT ON CONSTRAINT sun_tt_truth_receipts_pkey DO NOTHING'
        IN pg_get_functiondef(to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'))
      ) > 0, false)
      AND COALESCE(position(
        'ON CONFLICT (event_id, event_created_at) DO NOTHING'
        IN pg_get_functiondef(to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)'))
      ) = 0, false)
      AND EXISTS (
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
      ) AS sun_tt_conflict_target,
    to_regprocedure('public.nexid_enterprise_rbac_risk_truth_v1_capability()') IS NOT NULL
      AND to_regprocedure('public.nexid_backfill_event_risk_v1(integer)') IS NOT NULL
      AND COALESCE(position(
        'NEW.risk_profile_version := ''nexid-risk-v1'''
        IN pg_get_functiondef(to_regprocedure('public.nexid_explain_event_risk_v1()'))
      ) > 0, false)
      AND COALESCE(position(
        'FOR UPDATE OF event_row SKIP LOCKED'
        IN pg_get_functiondef(to_regprocedure('public.nexid_backfill_event_risk_v1(integer)'))
      ) > 0, false)
      AND NOT COALESCE((
        SELECT routine.prosecdef
        FROM pg_proc routine
        WHERE routine.oid = to_regprocedure('public.nexid_backfill_event_risk_v1(integer)')
      ), true)
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'events'
          AND column_name = 'risk_profile_version' AND is_nullable = 'YES'
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint constraint_row
        WHERE constraint_row.conrelid = to_regclass('public.events')
          AND constraint_row.conname = 'events_risk_profile_version_check'
          AND constraint_row.convalidated
      )
      AND EXISTS (
        SELECT 1 FROM pg_trigger trigger_row
        WHERE trigger_row.tgrelid = to_regclass('public.events')
          AND trigger_row.tgname = 'trg_events_explainable_risk_v1'
          AND NOT trigger_row.tgisinternal
          AND trigger_row.tgenabled <> 'D'
      )
      AND EXISTS (
        SELECT 1 FROM public.enterprise_role_profiles profile
        WHERE profile.code = 'reseller'
          AND profile.active IS TRUE
          AND profile.human_session_allowed IS TRUE
          AND profile.default_permissions = '[]'::jsonb
      )
      AND EXISTS (
        SELECT 1 FROM public.enterprise_role_profiles profile
        WHERE profile.code = 'tenant_owner'
          AND profile.active IS TRUE
          AND profile.human_session_allowed IS TRUE
          AND profile.default_permissions =
            '["users:manage","supplier_order.create","batch.keys.generate","supplier_pack.export","manifest.import","packaging_lab.manage","qa.approve","qa.plan.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","risk_rules.write","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","proofs.anchor","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export","crm:read","campaigns:read","campaigns:write","rewards:read","rewards:write","rewards:validate","marketplace:read","marketplace:write"]'::jsonb
      )
      AND EXISTS (
        SELECT 1 FROM public.enterprise_role_profiles profile
        WHERE profile.code = 'tenant_admin'
          AND profile.active IS TRUE
          AND profile.human_session_allowed IS TRUE
          AND profile.default_permissions =
            '["users:manage","supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","qa.plan.approve","batch.activate","batch.lifecycle","batch.revoke","batch.tamper.configure","tag.tamper.override","batch.product.configure","ownership.claim_policy.manage","alerts.ack","webhooks.manage","api_keys.read","api_keys.manage","proofs.read","audit.read","events.read_sensitive","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export","crm:read","campaigns:read","campaigns:write","rewards:read","rewards:write","rewards:validate","marketplace:read","marketplace:write"]'::jsonb
      )
      AND EXISTS (
        SELECT 1 FROM public.enterprise_role_profiles profile
        WHERE profile.code = 'operations_manager'
          AND profile.active IS TRUE
          AND profile.human_session_allowed IS TRUE
          AND profile.default_permissions =
            '["supplier_order.create","manifest.import","packaging_lab.manage","qa.approve","batch.activate","batch.lifecycle","alerts.ack","events.read_sensitive","reports.export","rewards:validate"]'::jsonb
      )
      AND EXISTS (
        SELECT 1 FROM public.enterprise_role_profiles profile
        WHERE profile.code = 'marketing_manager'
          AND profile.active IS TRUE
          AND profile.human_session_allowed IS TRUE
          AND profile.default_permissions =
            '["batch.product.configure","consumer_experiences.read_pii","consumer_experiences.moderate","consumers.read_pii","leads.manage","reports.export","crm:read","campaigns:read","campaigns:write","rewards:read","marketplace:read"]'::jsonb
      )
      AND EXISTS (
        SELECT 1 FROM public.enterprise_role_profiles profile
        WHERE profile.code = 'reseller_admin'
          AND profile.active IS TRUE
          AND profile.human_session_allowed IS TRUE
          AND profile.default_permissions = '["supplier_order.create","manifest.import","leads.manage","reports.export"]'::jsonb
      )
      AND NOT COALESCE(EXISTS (
        SELECT 1
        FROM pg_proc routine
        CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) acl
        WHERE routine.oid = to_regprocedure('public.nexid_backfill_event_risk_v1(integer)')
          AND acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
      ), false) AS enterprise_rbac_risk_truth,
    to_regclass('public.supplier_keyless_production_qa_acceptance_receipts') IS NOT NULL AS keyless_qa_receipts,
    to_regclass('public.sun_tt_truth_receipts') IS NOT NULL AS sun_tt_truth_receipts,
    EXISTS (
      SELECT 1 FROM pg_trigger trigger_row
      WHERE NOT trigger_row.tgisinternal
        AND trigger_row.tgenabled <> 'D'
        AND trigger_row.tgname = 'trg_sun_tt_truth_receipts_append_only'
        AND trigger_row.tgrelid = to_regclass('public.sun_tt_truth_receipts')
    ) AS sun_tt_truth_append_only,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'supplier_sub_batches'
        AND column_name = 'manufacturing_state'
    ) AS manufacturing_state`)).rows[0] || {};
  if (Number(postcheck.migration_count) !== migrationIds.length
    || !postcheck.production_qa_plans
    || !postcheck.production_qa_plan_decisions
    || !postcheck.production_qa_sessions
    || !postcheck.production_qa_decisions
    || !postcheck.plan_writer
    || !postcheck.plan_decision_writer
    || !postcheck.session_writer
    || !postcheck.decision_writer
    || !postcheck.keyless_qa_activation
    || !postcheck.carrier_scope_integrity
    || !postcheck.sun_tt_durable_truth
    || !postcheck.sun_runtime_acl_boundary
    || !postcheck.sun_tt_conflict_target
    || !postcheck.enterprise_rbac_risk_truth
    || !postcheck.keyless_qa_receipts
    || !postcheck.sun_tt_truth_receipts
    || !postcheck.sun_tt_truth_append_only
    || !postcheck.manufacturing_state) {
    throw new Error("disposable_migration_postcheck_failed");
  }

  console.log(JSON.stringify({
    ok: true,
    gate: "disposable_neon_full_migration_validation",
    endpoint_id: identity.endpoint_id,
    database: identity.database_name,
    database_role: identity.database_role,
    migration_count: migrationIds.length,
    latest_migration: migrationIds.at(-1),
    postcheck,
  }));
} finally {
  await client.end();
}
