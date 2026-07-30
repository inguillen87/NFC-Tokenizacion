export const ENTERPRISE_EPHEMERAL_E2E_CONFIRMATION =
  "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const EPHEMERAL_DATABASE_RE = /^nexid_e2e(?:_[a-z0-9][a-z0-9_-]{0,48})?$/;
const SUPPORTED_POSTGRES_VERSION_NUMBERS = new Map([
  ["16.4", 160004],
  ["18.4", 180004],
]);

function required(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required; the enterprise E2E harness never falls back to DATABASE_URL.`);
  }
  return value;
}

function parseDatabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("NEXID_E2E_DATABASE_URL must be an absolute PostgreSQL URL.");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("NEXID_E2E_DATABASE_URL must use postgres:// or postgresql://.");
  }
  // node-postgres treats libpq-style query parameters as authoritative. For
  // example, `?host=remote.example` overrides an apparently loopback URL. The
  // safety decision must therefore reject the entire override surface before
  // the same string reaches pg.Client or the migration runner.
  if (parsed.search || parsed.hash) {
    throw new Error("NEXID_E2E_DATABASE_URL must not include query parameters or fragments.");
  }
  return parsed;
}

export function readEnterpriseEphemeralE2eConfig(env = process.env) {
  const nodeEnvironment = String(env.NODE_ENV || "").trim().toLowerCase();
  const vercelEnvironment = String(env.VERCEL_ENV || "").trim().toLowerCase();
  if (nodeEnvironment !== "test" || vercelEnvironment !== "test") {
    throw new Error("Enterprise E2E requires NODE_ENV=test and VERCEL_ENV=test; every other runtime is refused.");
  }
  if (required(env, "NEXID_E2E_CONFIRMATION") !== ENTERPRISE_EPHEMERAL_E2E_CONFIRMATION) {
    throw new Error(`NEXID_E2E_CONFIRMATION must equal ${ENTERPRISE_EPHEMERAL_E2E_CONFIRMATION}.`);
  }
  const expectedPostgresVersion = required(env, "NEXID_E2E_EXPECTED_POSTGRES_VERSION");
  const expectedServerVersionNumber = SUPPORTED_POSTGRES_VERSION_NUMBERS.get(expectedPostgresVersion);
  if (!expectedServerVersionNumber) {
    throw new Error(
      `NEXID_E2E_EXPECTED_POSTGRES_VERSION must be one of ${[
        ...SUPPORTED_POSTGRES_VERSION_NUMBERS.keys(),
      ].join(", ")}.`,
    );
  }

  const databaseUrl = parseDatabaseUrl(required(env, "NEXID_E2E_DATABASE_URL"));
  const hostname = databaseUrl.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(hostname)) {
    throw new Error("NEXID_E2E_DATABASE_URL must target localhost or another loopback address.");
  }
  if (databaseUrl.username !== "nexid_e2e") {
    throw new Error("The disposable database role must be named nexid_e2e.");
  }
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
  if (!EPHEMERAL_DATABASE_RE.test(databaseName)) {
    throw new Error("The disposable database name must be nexid_e2e or start with nexid_e2e_.");
  }
  if (!databaseUrl.password) {
    throw new Error("The disposable database URL must include its dedicated test-role password.");
  }

  return Object.freeze({
    databaseUrl: databaseUrl.toString(),
    databaseName,
    databaseRole: databaseUrl.username,
    expectedPostgresVersion,
    expectedServerVersionNumber,
    safeTarget: `${hostname}:${databaseUrl.port || "5432"}/${databaseName}`,
  });
}

export async function assertEmptyEnterpriseE2eDatabase(client, config) {
  const target = (await client.query(`SELECT
    current_database() AS database_name,
    current_user AS database_role,
    current_setting('neon.endpoint_id', true) AS neon_endpoint_id,
    current_setting('transaction_read_only') AS transaction_read_only,
    current_setting('server_version_num')::integer AS server_version_number`)).rows[0];

  if (String(target?.database_name || "") !== config.databaseName) {
    throw new Error("ephemeral_e2e_database_identity_mismatch");
  }
  if (String(target?.database_role || "") !== config.databaseRole) {
    throw new Error("ephemeral_e2e_database_role_mismatch");
  }
  if (String(target?.neon_endpoint_id || "").trim()) {
    throw new Error("ephemeral_e2e_remote_neon_target_rejected");
  }
  if (String(target?.transaction_read_only || "").toLowerCase() !== "off") {
    throw new Error("ephemeral_e2e_database_is_read_only");
  }
  if (Number(target?.server_version_number || 0) !== config.expectedServerVersionNumber) {
    throw new Error("ephemeral_e2e_postgres_version_mismatch");
  }

  const relationCount = Number((await client.query(`SELECT count(*)::integer AS count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')`)).rows[0]?.count || 0);
  if (relationCount !== 0) {
    throw new Error(`ephemeral_e2e_database_not_empty:${relationCount}`);
  }
  return {
    databaseName: config.databaseName,
    databaseRole: config.databaseRole,
    postgresVersion: config.expectedPostgresVersion,
    relationCount,
  };
}
