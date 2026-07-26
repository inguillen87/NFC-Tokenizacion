import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const ROLE = "nexid_iota_executor_stg";
const DATABASE = "neondb";
const SECRET = "nexid-iota-db-url-stg";
const GCP_PROJECT = "nexid-security-staging";
const EXPECTED_ENDPOINT = "ep-solitary-surf-aiixcsmk";
const LOCK_ID = 487421338;

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name}_required`);
  return value;
}

function assertTarget(ownerUrl) {
  const parsed = new URL(ownerUrl);
  if (!parsed.hostname.endsWith(".neon.tech") || parsed.hostname.includes("-pooler.")) {
    throw new Error("staging_owner_url_must_be_unpooled_neon");
  }
  if (parsed.hostname.split(".")[0] !== EXPECTED_ENDPOINT) {
    throw new Error("staging_endpoint_not_allowlisted");
  }
  parsed.searchParams.set("sslmode", "verify-full");
  parsed.searchParams.set("application_name", "nexid-iota-role-provisioner");
  return parsed;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runLocal(command, args, stdin = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", () => reject(new Error("local_command_failed")));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.includes("PERMISSION_DENIED")
        ? "provider_permission_denied"
        : "provider_command_failed"));
    });
    child.stdin.end(stdin ?? undefined);
  });
}

async function configureRole(ownerUrl, password) {
  const owner = new Client({ connectionString: ownerUrl.toString() });
  const identifier = quoteIdentifier(ROLE);
  const passwordLiteral = quoteLiteral(password);
  await owner.connect();
  try {
    await owner.query("BEGIN");
    await owner.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID]);
    const exists = (await owner.query(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS present",
      [ROLE],
    )).rows[0]?.present === true;
    await owner.query(exists
      ? `ALTER ROLE ${identifier} LOGIN PASSWORD ${passwordLiteral}`
      : `CREATE ROLE ${identifier} WITH LOGIN PASSWORD ${passwordLiteral} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    const flags = (await owner.query(`SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
      rolreplication, rolbypassrls,
      EXISTS (SELECT 1 FROM pg_auth_members WHERE member = oid) AS has_memberships
      FROM pg_roles WHERE rolname = $1`, [ROLE])).rows[0];
    if (!flags?.rolcanlogin || flags.rolsuper || flags.rolcreatedb || flags.rolcreaterole
      || flags.rolreplication || flags.rolbypassrls || flags.has_memberships) {
      const error = new Error("neon_role_flags_invalid");
      error.safeMetadata = { role_flags: flags };
      throw error;
    }
    await owner.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${identifier}`);
    await owner.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${identifier}`);
    await owner.query(`REVOKE CREATE ON SCHEMA public FROM ${identifier}`);
    await owner.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(DATABASE)} TO ${identifier}`);
    await owner.query(`GRANT USAGE ON SCHEMA public TO ${identifier}`);
    await owner.query(
      `GRANT SELECT, INSERT, UPDATE ON TABLE public.iota_executor_publications TO ${identifier}`,
    );
    await owner.query("COMMIT");
    return { created: !exists, rotated: exists };
  } catch (error) {
    await owner.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await owner.end();
  }
}

async function expectDenied(client, sql) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("ROLLBACK");
    return false;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return error?.code === "42501";
  }
}

async function verifyRole(executorUrl) {
  const client = new Client({ connectionString: executorUrl.toString() });
  await client.connect();
  try {
    const privileges = (await client.query(`SELECT
      current_user = $1 AS correct_role,
      has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
      has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
      has_table_privilege(current_user, 'public.iota_executor_publications', 'SELECT') AS can_select,
      has_table_privilege(current_user, 'public.iota_executor_publications', 'INSERT') AS can_insert,
      has_table_privilege(current_user, 'public.iota_executor_publications', 'UPDATE') AS can_update,
      has_table_privilege(current_user, 'public.iota_executor_publications', 'DELETE') AS can_delete,
      has_table_privilege(current_user, 'public.tenants', 'SELECT') AS can_read_tenants`, [ROLE])).rows[0];
    if (!privileges?.correct_role
      || !privileges.schema_usage
      || privileges.schema_create
      || !privileges.can_select
      || !privileges.can_insert
      || !privileges.can_update
      || privileges.can_delete
      || privileges.can_read_tenants) {
      throw new Error("least_privilege_assertion_failed");
    }

    const proofId = `0x${randomBytes(32).toString("hex")}`;
    await client.query("BEGIN");
    try {
      await client.query(`INSERT INTO public.iota_executor_publications
        (proof_id, request_id, status, payload_json, protocol_version, payload_hash, lease_token)
        VALUES ($1, $2, 'reserved', '{}'::jsonb, 2, $3, $4::uuid)`, [
        proofId,
        `least-privilege-${randomUUID()}`,
        `sha256:${randomBytes(32).toString("hex")}`,
        randomUUID(),
      ]);
      await client.query(
        "UPDATE public.iota_executor_publications SET updated_at = now() WHERE proof_id = $1",
        [proofId],
      );
      const observed = await client.query(
        "SELECT proof_id FROM public.iota_executor_publications WHERE proof_id = $1",
        [proofId],
      );
      if (observed.rowCount !== 1) throw new Error("least_privilege_crud_probe_failed");
    } finally {
      await client.query("ROLLBACK").catch(() => {});
    }

    const ddlDenied = await expectDenied(
      client,
      "CREATE TABLE public.nexid_iota_executor_forbidden_probe(id integer)",
    );
    const tenantReadDenied = await expectDenied(client, "SELECT 1 FROM public.tenants LIMIT 0");
    if (!ddlDenied) throw new Error("least_privilege_ddl_not_denied");
    if (!tenantReadDenied) throw new Error("least_privilege_cross_table_read_not_denied");

    return {
      schema_usage: true,
      schema_create: false,
      select: true,
      insert: true,
      update: true,
      delete: false,
      cross_table_read: false,
      transactional_crud_probe_rolled_back: true,
      ddl_denied: true,
    };
  } finally {
    await client.end();
  }
}

function addSecretVersion(secretValue) {
  if (process.platform !== "win32") return runLocal("gcloud", [
    "secrets",
    "versions",
    "add",
    SECRET,
    `--project=${GCP_PROJECT}`,
    "--data-file=-",
    "--quiet",
  ], secretValue);
  const powershell = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32", "WindowsPowerShell", "v1.0", "powershell.exe",
  );
  const gcloudScript = path.join(
    required("LOCALAPPDATA"),
    "Google", "Cloud SDK", "google-cloud-sdk", "bin", "gcloud.ps1",
  );
  if (!existsSync(powershell) || !existsSync(gcloudScript)) {
    throw new Error("gcloud_cli_unavailable");
  }
  return runLocal(powershell, [
    "-NoProfile",
    "-NonInteractive",
    "-File",
    gcloudScript,
    "secrets",
    "versions",
    "add",
    SECRET,
    `--project=${GCP_PROJECT}`,
    "--data-file=-",
    "--quiet",
  ], secretValue);
}

let password = null;
let stage = "initialization";
try {
  const ownerUrl = assertTarget(required("STAGING_OWNER_DATABASE_URL"));
  password = randomBytes(32).toString("hex");
  const executorUrl = new URL(ownerUrl);
  executorUrl.username = ROLE;
  executorUrl.password = password;
  executorUrl.searchParams.set("application_name", "nexid-iota-executor-stg");

  stage = "database_role_and_grants";
  const roleResult = await configureRole(ownerUrl, password);
  stage = "database_verification";
  const privileges = await verifyRole(executorUrl);
  stage = "secret_manager";
  await addSecretVersion(executorUrl.toString());
  stage = "complete";

  console.log(JSON.stringify({
    ok: true,
    gate: "iota_executor_db_least_privilege",
    endpoint_id: EXPECTED_ENDPOINT,
    role: ROLE,
    role_result: { created: roleResult.created, rotated: roleResult.rotated },
    privileges,
    secret: SECRET,
    secret_version_created: true,
  }));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    gate: "iota_executor_db_least_privilege",
    stage,
    reason: /^[a-z0-9_]+$/.test(String(error?.message || ""))
      ? error.message
      : "iota_executor_db_role_provision_failed",
    ...(typeof error?.code === "string" && /^[A-Z0-9]{3,8}$/.test(error.code)
      ? { code: error.code }
      : {}),
    ...(error?.safeMetadata && typeof error.safeMetadata === "object"
      ? error.safeMetadata
      : {}),
  }));
  process.exitCode = 1;
} finally {
  password = null;
}
