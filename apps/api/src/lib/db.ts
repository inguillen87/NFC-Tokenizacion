import { neon } from "@neondatabase/serverless";

export type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Array<Record<string, unknown>>>;

const EPHEMERAL_E2E_SQL_EXECUTOR = Symbol.for("nexid.ephemeral-e2e.sql-executor");
const EPHEMERAL_E2E_CONFIRMATION = "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE";
const LOOPBACK_DATABASE_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);

type EphemeralSqlStore = typeof globalThis & {
  [EPHEMERAL_E2E_SQL_EXECUTOR]?: SqlExecutor;
};

function ephemeralSqlExecutor() {
  return (globalThis as EphemeralSqlStore)[EPHEMERAL_E2E_SQL_EXECUTOR] || null;
}

/**
 * Installs a process-local SQL executor only for the disposable enterprise E2E
 * harness. The production runtime can never opt into this adapter: callers
 * must provide an explicit loopback URL whose database and role are both
 * named for the isolated nexid_e2e fixture.
 */
export function installEphemeralE2eSqlExecutor(executor: SqlExecutor, env = process.env) {
  const nodeEnvironment = String(env.NODE_ENV || "").trim().toLowerCase();
  const vercelEnvironment = String(env.VERCEL_ENV || "").trim().toLowerCase();
  if (nodeEnvironment !== "test" || vercelEnvironment !== "test") {
    throw new Error("ephemeral_e2e_sql_executor_test_runtime_required");
  }
  if (String(env.NEXID_E2E_CONFIRMATION || "") !== EPHEMERAL_E2E_CONFIRMATION) {
    throw new Error("ephemeral_e2e_sql_executor_confirmation_required");
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(String(env.NEXID_E2E_DATABASE_URL || ""));
  } catch {
    throw new Error("ephemeral_e2e_sql_executor_database_url_invalid");
  }
  if (databaseUrl.search || databaseUrl.hash) {
    throw new Error("ephemeral_e2e_sql_executor_database_url_overrides_rejected");
  }
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol)
    || !LOOPBACK_DATABASE_HOSTS.has(databaseUrl.hostname.toLowerCase())
    || databaseUrl.username !== "nexid_e2e"
    || !databaseUrl.password
    || !/^nexid_e2e(?:_[a-z0-9][a-z0-9_-]{0,48})?$/.test(databaseName)
  ) {
    throw new Error("ephemeral_e2e_sql_executor_local_target_required");
  }
  if (typeof executor !== "function") throw new Error("ephemeral_e2e_sql_executor_invalid");

  const store = globalThis as EphemeralSqlStore;
  if (store[EPHEMERAL_E2E_SQL_EXECUTOR]) {
    throw new Error("ephemeral_e2e_sql_executor_already_installed");
  }
  store[EPHEMERAL_E2E_SQL_EXECUTOR] = executor;
  return () => {
    if (store[EPHEMERAL_E2E_SQL_EXECUTOR] === executor) {
      delete store[EPHEMERAL_E2E_SQL_EXECUTOR];
    }
  };
}

export const DEFAULT_REQUIRED_SCHEMA_MIGRATIONS = [
  "20260725230000_0057_sun_rate_limit_atomic_buckets.sql",
  "20260726103000_0058_webhook_signature_v2.sql",
  "20260726120000_0058_marketplace_runtime_baseline.sql",
  "20260726135000_0059_marketplace_claim_truth_cleanup.sql",
  "20260726173000_0060_sdk_idempotency_operations.sql",
  "20260726190000_0061_supplier_export_artifact_delivery.sql",
  "20260728120000_0062_sun_atomic_persistence.sql",
  "20260728143000_0063_supplier_packaging_governance.sql",
  "20260728160000_0064_webhook_lifecycle_governance.sql",
  "20260728173000_0065_event_incident_workflow.sql",
  "20260728180000_0066_tag_lifecycle_governance.sql",
  "20260728183000_0067_canonical_event_outbox.sql",
  "20260729110000_0068_epcis_event_type.sql",
  "20260729110500_0069_gs1_epcis_foundation.sql",
  "20260729130000_0070_supplier_qa_atomic_receipts.sql",
  "20260729143000_0071_supplier_pack_purpose_governance.sql",
  "20260729160000_0072_tokenization_marketplace_execution_governance.sql",
  "20260730110000_0073_supplier_qa_verification_context_v2.sql",
  "20260730150000_0074_supplier_key_rotation_atomic.sql",
  "20260801090000_0075_supplier_production_qa_acceptance.sql",
  "20260802090000_0076_supplier_production_activation_v2.sql",
  "20260802113000_0077_tenant_api_key_lifecycle.sql",
  "20260802130000_0078_webhook_destination_cutover.sql",
  "20260802150000_0079_supplier_order_atomic_create.sql",
  "20260802153000_0080_offline_scan_history_index.sql",
  "20260802160000_0081_supplier_manifest_atomic_import.sql",
  "20260802170000_0082_consumer_session_revocation.sql",
  "20260802180000_0083_sdk_event_webhook_atomic_outbox.sql",
  "20260802190000_0084_tenant_vault_audited_download.sql",
  "20260802200000_0085_supplier_non_sun_qa_evidence.sql",
  "20260802210000_0086_supplier_order_lifecycle.sql",
  "20260802220000_0087_packaging_lab_foundation.sql",
  "20260802230000_0088_enterprise_event_profile.sql",
  "20260802240000_0089_sun_carrier_trust_state.sql",
  "20260802250000_0090_supplier_carrier_key_scope.sql",
  "20260802260000_0091_supplier_keyless_qa_activation.sql",
  "20260802270000_0092_supplier_carrier_scope_integrity.sql",
  "20260802280000_0093_sun_tt_durable_truth_binding.sql",
  "20260802290000_0094_sun_runtime_acl_boundary.sql",
  "20260802300000_0095_sun_tt_conflict_target.sql",
  "20260802310000_0096_enterprise_rbac_risk_truth.sql",
] as const;
export const DEFAULT_REQUIRED_SCHEMA_MIGRATION = DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.at(-1)!;

let productionWatermarkCheck: Promise<void> | null = null;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
}

function stripSqlLiteralsAndComments(statement: string) {
  let output = "";
  let index = 0;
  while (index < statement.length) {
    const char = statement[index];
    const next = statement[index + 1];
    if (char === "-" && next === "-") {
      index += 2;
      while (index < statement.length && statement[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      let depth = 1;
      while (index < statement.length && depth > 0) {
        if (statement[index] === "/" && statement[index + 1] === "*") {
          depth += 1;
          index += 2;
        } else if (statement[index] === "*" && statement[index + 1] === "/") {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      output += " ";
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      index += 1;
      while (index < statement.length) {
        if (statement[index] === quote && statement[index + 1] === quote) {
          index += 2;
        } else if (statement[index] === quote) {
          index += 1;
          break;
        } else {
          index += 1;
        }
      }
      output += " ";
      continue;
    }
    if (char === "$") {
      const tag = statement.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (tag) {
        const end = statement.indexOf(tag, index + tag.length);
        index = end < 0 ? statement.length : end + tag.length;
        output += " ";
        continue;
      }
    }
    output += char;
    index += 1;
  }
  return output;
}

export function isRuntimeDdlStatement(statement: string) {
  const structuralSql = stripSqlLiteralsAndComments(statement);
  return structuralSql
    .split(";")
    .some((part) => /^\s*(?:CREATE|ALTER|DROP|TRUNCATE|COMMENT|GRANT|REVOKE|DO|CALL|VACUUM|REINDEX|CLUSTER|ANALYZE|REFRESH\s+MATERIALIZED\s+VIEW)\b/i.test(part));
}

function isProductionRuntime() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

async function requireProductionSchemaWatermark() {
  if (!isProductionRuntime()) return;
  if (!productionWatermarkCheck) {
    productionWatermarkCheck = (async () => {
      const configured = [
        String(process.env.NEXID_REQUIRED_SCHEMA_MIGRATIONS || ""),
        String(process.env.NEXID_REQUIRED_SCHEMA_MIGRATION || ""),
      ]
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);
      const required = [...new Set([...DEFAULT_REQUIRED_SCHEMA_MIGRATIONS, ...configured])].sort();
      if (required.some((id) => !/^\d{14}_\d{4}_[a-z0-9_]+\.sql$/.test(id))) {
        throw new Error("required_schema_migration_id_invalid");
      }
      const query = getSql();
      const rows = await query/*sql*/`
        SELECT id
        FROM schema_migrations
        ORDER BY id ASC
      `;
      const applied = rows.map((row) => String(row.id || ""));
      const positions = required.map((id) => applied.indexOf(id));
      const ordered = positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1]));
      if (!ordered) {
        throw new Error("required_schema_migration_not_applied");
      }
    })().catch((error) => {
      productionWatermarkCheck = null;
      throw error;
    });
  }
  return productionWatermarkCheck;
}

export async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  const staticStatement = strings.join("?");
  if (isProductionRuntime() && isRuntimeDdlStatement(staticStatement)) {
    // Production schema ownership belongs exclusively to the migration runner.
    // Existing ensure*Schema calls become no-op compatibility guards rather
    // than request-path DDL. The first business query verifies the watermark.
    return [];
  }
  const testExecutor = ephemeralSqlExecutor();
  if (testExecutor) return testExecutor(strings, ...values);
  await requireProductionSchemaWatermark();
  return getSql()(strings, ...values);
}

/**
 * Runs one business statement at SERIALIZABLE isolation. This is reserved for
 * predicate-based invariants, such as a tenant quota, that cannot be protected
 * against concurrent inserts by a row lock alone.
 */
export async function sqlSerializable(strings: TemplateStringsArray, ...values: unknown[]) {
  const staticStatement = strings.join("?");
  if (isProductionRuntime() && isRuntimeDdlStatement(staticStatement)) return [];
  const testExecutor = ephemeralSqlExecutor();
  if (testExecutor) return testExecutor(strings, ...values);
  await requireProductionSchemaWatermark();
  const query = getSql();
  const results = await query.transaction(
    (transaction) => [transaction(strings, ...values)],
    { isolationLevel: "Serializable" },
  );
  return (results[0] || []) as Array<Record<string, unknown>>;
}
