import { createHash } from "node:crypto";
import { DEFAULT_REQUIRED_SCHEMA_MIGRATIONS } from "../../src/lib/db.ts";
import { hashPassword, verifyPassword } from "../../src/lib/password.ts";

export const TENANT_ADMIN_CREDENTIAL_SCHEMA_MIGRATION =
  "20260802310000_0096_enterprise_rbac_risk_truth.sql";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TENANT_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const CHANGE_REF_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,79}$/;
const SCRYPT_HASH_RE = /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/i;
const LEGACY_SHA256_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_URL_PARAMETERS = new Map([
  ["sslmode", new Set(["require", "verify-full"])],
  ["channel_binding", new Set(["require"])],
]);

export class TenantAdminCredentialError extends Error {
  constructor(code) {
    super(code);
    this.name = "TenantAdminCredentialError";
    this.code = code;
  }
}

function fail(code) {
  throw new TenantAdminCredentialError(code);
}

function requiredEnvironment(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) fail(`${name.toLowerCase()}_required`);
  return value;
}

function requiredRawSecretEnvironment(env, name) {
  const value = String(env[name] || "");
  if (!value) fail(`${name.toLowerCase()}_required`);
  return value;
}

function normalizeEmail(value, code = "tenant_admin_email_invalid") {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) fail(code);
  return email;
}

function parseArguments(argv) {
  const values = new Map();
  let apply = false;
  const allowed = new Set([
    "operation",
    "tenant",
    "email",
    "full-name",
    "expected-current",
    "change-ref",
  ]);

  for (const raw of argv) {
    if (raw === "--apply") {
      if (apply) fail("duplicate_apply_argument");
      apply = true;
      continue;
    }
    if (!raw.startsWith("--") || !raw.includes("=")) fail("unsupported_argument");
    const separator = raw.indexOf("=");
    const name = raw.slice(2, separator);
    const value = raw.slice(separator + 1);
    if (!allowed.has(name) || values.has(name)) fail("unsupported_argument");
    values.set(name, value);
  }

  return { apply, values };
}

function requiredArgument(values, name) {
  const value = String(values.get(name) || "").trim();
  if (!value) fail(`${name.replaceAll("-", "_")}_required`);
  return value;
}

function parseDedicatedDatabaseTarget(env) {
  const raw = requiredEnvironment(env, "NEXID_TENANT_ADMIN_DATABASE_URL");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail("tenant_admin_database_url_invalid");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    fail("tenant_admin_database_url_protocol_invalid");
  }
  if (parsed.hash) fail("tenant_admin_database_url_fragment_forbidden");
  const seenParameters = new Set();
  for (const [name, value] of parsed.searchParams) {
    if (seenParameters.has(name)) fail("tenant_admin_database_url_parameter_duplicate");
    seenParameters.add(name);
    const allowedValues = ALLOWED_URL_PARAMETERS.get(name);
    if (!allowedValues?.has(value)) fail("tenant_admin_database_url_parameter_forbidden");
  }
  if (!seenParameters.has("sslmode")) fail("tenant_admin_database_sslmode_required");
  if (!seenParameters.has("channel_binding")) fail("tenant_admin_database_channel_binding_required");
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname.includes("-pooler.")) fail("tenant_admin_unpooled_database_url_required");
  const expectedHost = requiredEnvironment(env, "NEXID_TENANT_ADMIN_EXPECTED_HOST").toLowerCase();
  if (hostname !== expectedHost) fail("tenant_admin_database_host_mismatch");
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const expectedDatabase = requiredEnvironment(env, "NEXID_TENANT_ADMIN_EXPECTED_DATABASE");
  if (!databaseName || databaseName !== expectedDatabase) fail("tenant_admin_database_name_mismatch");
  const databaseRole = decodeURIComponent(parsed.username || "");
  const expectedDatabaseRole = requiredEnvironment(env, "NEXID_TENANT_ADMIN_EXPECTED_DB_ROLE");
  if (!databaseRole || databaseRole !== expectedDatabaseRole) fail("tenant_admin_database_role_mismatch");
  if (!parsed.password) fail("tenant_admin_database_password_required");

  const expectedEndpointId = String(env.NEXID_TENANT_ADMIN_EXPECTED_ENDPOINT_ID || "").trim();
  if (hostname.endsWith(".neon.tech") && !/^ep-[a-z0-9-]+$/.test(expectedEndpointId)) {
    fail("tenant_admin_expected_endpoint_id_required");
  }

  return {
    databaseUrl: raw,
    hostname,
    databaseName,
    databaseRole,
    expectedEndpointId: expectedEndpointId || null,
    safeTarget: `${hostname}:${parsed.port || "5432"}/${databaseName}`,
  };
}

function parseOperatorSessionToken(value) {
  const [sessionId, secret, extra] = String(value || "").trim().split(".");
  if (extra !== undefined || !UUID_RE.test(sessionId || "") || !/^[A-Za-z0-9_-]{32,128}$/.test(secret || "")) {
    fail("credential_operator_session_token_invalid");
  }
  return {
    operatorSessionId: sessionId,
    operatorSessionTokenHash: createHash("sha256").update(secret).digest("hex"),
  };
}

export function expectedTenantAdminConfirmation({ operation, tenantSlug, email, expectedCurrent, changeRef }) {
  return `APPLY TENANT_ADMIN ${operation.toUpperCase()} ${tenantSlug} ${email} EXPECT ${expectedCurrent} ${changeRef}`;
}

export function assertStrongTenantAdminPassword(password, email) {
  const value = String(password || "");
  if (value.length < 16 || value.length > 256) fail("tenant_admin_password_length_invalid");
  if (value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    fail("tenant_admin_password_control_character_forbidden");
  }
  const classes = [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)]
    .filter(Boolean).length;
  if (classes < 3) fail("tenant_admin_password_complexity_invalid");
  const localPart = String(email || "").split("@")[0].toLowerCase();
  const lowered = value.toLowerCase();
  if ((localPart.length >= 4 && lowered.includes(localPart))
    || /password|contrase(?:n|ñ)a|123456|qwerty|nexid/.test(lowered)) {
    fail("tenant_admin_password_context_invalid");
  }
  return value;
}

export function hashTenantAdminPassword(password) {
  return hashPassword(password);
}

export function verifyTenantAdminPassword(password, storedHash) {
  return SCRYPT_HASH_RE.test(String(storedHash || ""))
    && verifyPassword(password, storedHash);
}

export function classifyTenantAdminCredential(storedHash) {
  if (storedHash === null || storedHash === undefined || storedHash === "") return "missing";
  const value = String(storedHash);
  if (SCRYPT_HASH_RE.test(value)) return "scrypt";
  if (LEGACY_SHA256_RE.test(value)) return "legacy-sha256";
  if (value === "clerk_oauth_external_login") return "external-auth";
  return "unsupported";
}

export function readTenantAdminCredentialConfig(argv = process.argv.slice(2), env = process.env) {
  const { apply, values } = parseArguments(argv);
  const operation = requiredArgument(values, "operation").toLowerCase();
  if (operation !== "provision" && operation !== "rotate") fail("tenant_admin_operation_invalid");
  const tenantSlug = requiredArgument(values, "tenant").toLowerCase();
  if (!TENANT_RE.test(tenantSlug)) fail("tenant_admin_tenant_slug_invalid");
  const email = normalizeEmail(requiredArgument(values, "email"));
  const operatorEmail = normalizeEmail(
    requiredEnvironment(env, "NEXID_CREDENTIAL_OPERATOR_EMAIL"),
    "credential_operator_email_invalid",
  );
  const operatorSession = parseOperatorSessionToken(
    requiredEnvironment(env, "NEXID_CREDENTIAL_OPERATOR_SESSION_TOKEN"),
  );
  if (email === operatorEmail) fail("credential_operator_must_differ_from_target");
  const expectedCurrent = requiredArgument(values, "expected-current").toLowerCase();
  if (!new Set(["missing", "legacy-sha256", "scrypt"]).has(expectedCurrent)) {
    fail("tenant_admin_expected_current_invalid");
  }
  if ((operation === "provision") !== (expectedCurrent === "missing")) {
    fail("tenant_admin_operation_expected_state_mismatch");
  }
  const changeRef = requiredArgument(values, "change-ref");
  if (!CHANGE_REF_RE.test(changeRef)) fail("tenant_admin_change_ref_invalid");
  const fullName = String(values.get("full-name") || "").trim();
  if (operation === "provision" && (fullName.length < 2 || fullName.length > 120)) {
    fail("tenant_admin_full_name_required");
  }
  if (/[\u0000-\u001f\u007f]/.test(fullName)) fail("tenant_admin_full_name_invalid");
  const password = assertStrongTenantAdminPassword(
    requiredRawSecretEnvironment(env, "NEXID_TENANT_ADMIN_PASSWORD"),
    email,
  );
  const databaseTarget = parseDedicatedDatabaseTarget(env);
  const expectedConfirmation = expectedTenantAdminConfirmation({
    operation,
    tenantSlug,
    email,
    expectedCurrent,
    changeRef,
  });
  if (apply && String(env.NEXID_TENANT_ADMIN_CONFIRMATION || "") !== expectedConfirmation) {
    fail("tenant_admin_confirmation_mismatch");
  }

  return Object.freeze({
    ...databaseTarget,
    apply,
    operation,
    tenantSlug,
    email,
    operatorEmail,
    ...operatorSession,
    expectedCurrent,
    changeRef,
    fullName: fullName || null,
    password,
    expectedConfirmation,
  });
}

function auditStateFingerprint(payload) {
  return createHash("sha256")
    .update(JSON.stringify({ contract: "tenant-admin-credential-state/v1", ...payload }))
    .digest("hex");
}

function credentialFingerprint(storedHash) {
  if (!storedHash) return null;
  return createHash("sha256")
    .update(String(storedHash))
    .digest("hex");
}

async function assertDatabaseIdentity(client, config) {
  const result = await client.query(`SELECT
    current_database() AS database_name,
    current_user AS database_role,
    session_user AS session_role,
    current_setting('neon.endpoint_id', true) AS endpoint_id,
    current_setting('transaction_read_only') AS transaction_read_only`);
  const row = result.rows[0];
  if (result.rows.length !== 1 || String(row?.database_name || "") !== config.databaseName) {
    fail("tenant_admin_database_identity_mismatch");
  }
  if (String(row?.database_role || "") !== config.databaseRole
    || String(row?.session_role || "") !== config.databaseRole) {
    fail("tenant_admin_database_role_identity_mismatch");
  }
  const endpointId = String(row?.endpoint_id || "").trim();
  if (config.expectedEndpointId ? endpointId !== config.expectedEndpointId : Boolean(endpointId)) {
    fail("tenant_admin_database_endpoint_mismatch");
  }
  if (String(row?.transaction_read_only || "").toLowerCase() !== "off") {
    fail("tenant_admin_database_read_only");
  }
  return { endpointId: endpointId || null };
}

async function assertCredentialSchema(client) {
  const result = await client.query(`SELECT
    to_regclass('public.tenants') IS NOT NULL
      AND to_regclass('public.users') IS NOT NULL
      AND to_regclass('public.password_credentials') IS NOT NULL
      AND to_regclass('public.memberships') IS NOT NULL
      AND to_regclass('public.auth_sessions') IS NOT NULL
      AND to_regclass('public.password_reset_tokens') IS NOT NULL
      AND to_regclass('public.user_mfa_factors') IS NOT NULL
      AND to_regclass('public.enterprise_role_profiles') IS NOT NULL
      AND to_regclass('public.user_auth_events') IS NOT NULL
      AND to_regclass('public.audit_logs') IS NOT NULL AS relations_ready,
    EXISTS (
      SELECT 1 FROM public.schema_migrations migration
      WHERE migration.id = $1
    ) AS authority_migration_ready,
    (
      SELECT count(DISTINCT migration.id)::integer
      FROM public.schema_migrations migration
      WHERE migration.id = ANY($2::text[])
    ) = $3::integer AS runtime_watermark_ready,
    NOT EXISTS (
      SELECT required.column_name
      FROM (VALUES
        ('actor_id'), ('tenant_id'), ('action'), ('resource_type'),
        ('resource_id'), ('before_hash'), ('after_hash'), ('request_id')
      ) AS required(column_name)
      EXCEPT
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'audit_logs'
    ) AS audit_columns_ready`, [
    TENANT_ADMIN_CREDENTIAL_SCHEMA_MIGRATION,
    [...DEFAULT_REQUIRED_SCHEMA_MIGRATIONS],
    DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.length,
  ]);
  const row = result.rows[0];
  if (result.rows.length !== 1 || row?.relations_ready !== true
    || row?.authority_migration_ready !== true
    || row?.runtime_watermark_ready !== true
    || row?.audit_columns_ready !== true) {
    fail("tenant_admin_credential_schema_not_ready");
  }
}

function exactSingleRow(result, missingCode, ambiguousCode) {
  if (result.rows.length === 0) fail(missingCode);
  if (result.rows.length !== 1) fail(ambiguousCode);
  return result.rows[0];
}

export async function executeTenantAdminCredentialChange(client, config) {
  let transactionOpen = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const identity = await assertDatabaseIdentity(client, config);
    await assertCredentialSchema(client);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `tenant-admin-credentials\u001f${config.tenantSlug}\u001f${config.email}`,
    ]);

    const tenant = exactSingleRow(
      await client.query(`SELECT id::text AS id, slug, status::text AS status
        FROM public.tenants
        WHERE lower(slug) = lower($1)
        ORDER BY id
        FOR SHARE`, [config.tenantSlug]),
      "tenant_admin_tenant_not_found",
      "tenant_admin_tenant_ambiguous",
    );
    if (String(tenant.slug) !== config.tenantSlug) fail("tenant_admin_tenant_canonical_slug_mismatch");
    if (String(tenant.status) !== "active") fail("tenant_admin_tenant_not_active");

    const roleProfile = exactSingleRow(
      await client.query(`SELECT code, active, tenant_bound, human_session_allowed
        FROM public.enterprise_role_profiles
        WHERE code = 'tenant_admin'
        FOR SHARE`),
      "tenant_admin_role_profile_missing",
      "tenant_admin_role_profile_ambiguous",
    );
    if (roleProfile.active !== true || roleProfile.tenant_bound !== true
      || roleProfile.human_session_allowed !== true) {
      fail("tenant_admin_role_profile_inactive");
    }

    const operator = exactSingleRow(
      await client.query(`SELECT user_row.id::text AS id, user_row.email
        FROM public.users user_row
        JOIN public.memberships membership
          ON membership.user_id = user_row.id
         AND membership.role::text = 'super_admin'
         AND membership.tenant_id IS NULL
        JOIN public.enterprise_role_profiles profile
          ON profile.code = membership.role::text
         AND profile.active IS TRUE
         AND profile.tenant_bound IS FALSE
         AND profile.human_session_allowed IS TRUE
        JOIN public.auth_sessions operator_session
          ON operator_session.user_id = user_row.id
         AND operator_session.id = $2::uuid
         AND operator_session.session_token_hash = $3
         AND operator_session.role::text = 'super_admin'
         AND operator_session.tenant_id IS NULL
         AND operator_session.revoked_at IS NULL
         AND operator_session.expires_at > now()
        WHERE lower(user_row.email) = lower($1)
          AND user_row.admin_status::text = 'active'
        ORDER BY user_row.id
        FOR SHARE OF user_row, membership, profile, operator_session`, [
        config.operatorEmail,
        config.operatorSessionId,
        config.operatorSessionTokenHash,
      ]),
      "credential_operator_not_authorized",
      "credential_operator_ambiguous",
    );
    const operatorMemberships = await client.query(`SELECT tenant_id::text AS tenant_id, role::text AS role
      FROM public.memberships
      WHERE user_id = $1::uuid
      ORDER BY id
      FOR SHARE`, [operator.id]);
    if (operatorMemberships.rows.length !== 1
      || operatorMemberships.rows[0].role !== "super_admin"
      || operatorMemberships.rows[0].tenant_id !== null) {
      fail("credential_operator_authority_ambiguous");
    }

    const targetUsers = await client.query(`SELECT id::text AS id, email, full_name, admin_status::text AS admin_status
      FROM public.users
      WHERE lower(email) = lower($1)
      ORDER BY id
      FOR UPDATE`, [config.email]);

    let targetUser;
    let previousCredentialState;
    let passwordWrite;
    if (config.operation === "provision") {
      if (targetUsers.rows.length !== 0) fail("tenant_admin_target_already_exists");
      targetUser = exactSingleRow(
        await client.query(`INSERT INTO public.users (email, full_name, admin_status)
          VALUES ($1, $2, 'active'::admin_user_status)
          RETURNING id::text AS id, email, full_name, admin_status::text AS admin_status`, [
          config.email,
          config.fullName,
        ]),
        "tenant_admin_user_create_failed",
        "tenant_admin_user_create_ambiguous",
      );
      previousCredentialState = "missing";
    } else {
      targetUser = exactSingleRow(
        targetUsers,
        "tenant_admin_target_not_found",
        "tenant_admin_target_ambiguous",
      );
      if (targetUser.admin_status !== "active") fail("tenant_admin_target_not_active");
      const targetMemberships = await client.query(`SELECT tenant_id::text AS tenant_id, role::text AS role
        FROM public.memberships
        WHERE user_id = $1::uuid
        ORDER BY id
        FOR SHARE`, [targetUser.id]);
      if (targetMemberships.rows.length !== 1
        || targetMemberships.rows[0].tenant_id !== tenant.id
        || targetMemberships.rows[0].role !== "tenant_admin") {
        fail("tenant_admin_target_scope_mismatch");
      }
      const mfaFactors = await client.query(`SELECT EXISTS (
          SELECT 1
          FROM public.user_mfa_factors
          WHERE user_id = $1::uuid
        ) AS mfa_enabled`, [targetUser.id]);
      if (mfaFactors.rows.length !== 1 || mfaFactors.rows[0].mfa_enabled !== false) {
        fail("tenant_admin_mfa_recovery_required");
      }
      const credentials = await client.query(`SELECT password_hash
        FROM public.password_credentials
        WHERE user_id = $1::uuid
        FOR UPDATE`, [targetUser.id]);
      if (credentials.rows.length > 1) fail("tenant_admin_credential_ambiguous");
      previousCredentialState = classifyTenantAdminCredential(credentials.rows[0]?.password_hash);
      if (previousCredentialState !== config.expectedCurrent) {
        fail("tenant_admin_current_credential_state_mismatch");
      }
      targetUser.currentPasswordHash = credentials.rows[0]?.password_hash;
    }

    const passwordHash = hashTenantAdminPassword(config.password);
    if (!verifyTenantAdminPassword(config.password, passwordHash)) {
      fail("tenant_admin_scrypt_self_check_failed");
    }
    if (config.operation === "provision") {
      passwordWrite = await client.query(`INSERT INTO public.password_credentials (user_id, password_hash)
        VALUES ($1::uuid, $2)`, [targetUser.id, passwordHash]);
      if (passwordWrite.rowCount !== 1) fail("tenant_admin_credential_write_failed");
      const membershipWrite = await client.query(`INSERT INTO public.memberships (user_id, tenant_id, role)
        VALUES ($1::uuid, $2::uuid, 'tenant_admin'::membership_role)`, [targetUser.id, tenant.id]);
      if (membershipWrite.rowCount !== 1) fail("tenant_admin_membership_write_failed");
    } else {
      passwordWrite = await client.query(`UPDATE public.password_credentials
        SET password_hash = $1, updated_at = now()
        WHERE user_id = $2::uuid
          AND password_hash = $3`, [passwordHash, targetUser.id, targetUser.currentPasswordHash]);
      if (passwordWrite.rowCount !== 1) fail("tenant_admin_credential_concurrent_change");
    }

    const revokedSessions = await client.query(`UPDATE public.auth_sessions
      SET revoked_at = now(), last_seen_at = now()
      WHERE user_id = $1::uuid
        AND revoked_at IS NULL`, [targetUser.id]);
    const consumedResetTokens = await client.query(`UPDATE public.password_reset_tokens
      SET consumed_at = now()
      WHERE user_id = $1::uuid
        AND consumed_at IS NULL`, [targetUser.id]);
    const action = config.operation === "provision"
      ? "tenant_admin.credential_provisioned"
      : "tenant_admin.credential_rotated";
    const auditMeta = {
      contract: "tenant-admin-credential-ops/v1",
      source: "tenant_admin_credentials_cli",
      tenant_id: tenant.id,
      tenant_slug: config.tenantSlug,
      operator_id: operator.id,
      operator_email: config.operatorEmail,
      operator_session_id: config.operatorSessionId,
      database_role: config.databaseRole,
      endpoint_id: identity.endpointId,
      change_ref: config.changeRef,
      previous_credential_state: previousCredentialState,
      new_credential_state: "scrypt",
      sessions_revoked: Number(revokedSessions.rowCount || 0),
      reset_tokens_consumed: Number(consumedResetTokens.rowCount || 0),
    };
    const beforeHash = auditStateFingerprint({
      tenantId: tenant.id,
      userId: targetUser.id,
      credentialState: previousCredentialState,
      credentialFingerprint: credentialFingerprint(targetUser.currentPasswordHash),
    });
    const afterHash = auditStateFingerprint({
      tenantId: tenant.id,
      userId: targetUser.id,
      credentialState: "scrypt",
      credentialFingerprint: credentialFingerprint(passwordHash),
    });
    const authAudit = await client.query(`INSERT INTO public.user_auth_events
      (email, event_name, ok, role, meta)
      VALUES ($1, $2, true, 'tenant_admin', $3::jsonb)`, [
      config.email,
      action,
      JSON.stringify(auditMeta),
    ]);
    if (authAudit.rowCount !== 1) fail("tenant_admin_auth_audit_write_failed");
    const operationsAudit = await client.query(`INSERT INTO public.audit_logs
      (actor_id, tenant_id, action, resource_type, resource_id, before_hash, after_hash, request_id)
      VALUES ($1::uuid, $2::uuid, $3, 'user', $4, $5, $6, $7)`, [
      operator.id,
      tenant.id,
      action,
      targetUser.id,
      beforeHash,
      afterHash,
      config.changeRef,
    ]);
    if (operationsAudit.rowCount !== 1) fail("tenant_admin_operations_audit_write_failed");

    if (config.apply) await client.query("COMMIT");
    else await client.query("ROLLBACK");
    transactionOpen = false;
    return Object.freeze({
      ok: true,
      mode: config.apply ? "apply" : "dry_run",
      committed: config.apply,
      operation: config.operation,
      tenant: config.tenantSlug,
      email: config.email,
      changeRef: config.changeRef,
      previousCredentialState,
      newCredentialState: "scrypt",
      sessionsRevoked: Number(revokedSessions.rowCount || 0),
      resetTokensConsumed: Number(consumedResetTokens.rowCount || 0),
      database: config.databaseName,
      databaseRole: config.databaseRole,
      endpointId: identity.endpointId,
    });
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof TenantAdminCredentialError) throw error;
    throw new TenantAdminCredentialError("tenant_admin_credential_operation_failed");
  }
}
