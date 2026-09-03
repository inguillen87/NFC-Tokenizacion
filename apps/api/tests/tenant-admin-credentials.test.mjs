import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTenantAdminCredential,
  executeTenantAdminCredentialChange,
  hashTenantAdminPassword,
  readTenantAdminCredentialConfig,
  TenantAdminCredentialError,
  verifyTenantAdminPassword,
} from "../scripts/lib/tenant-admin-credentials.mjs";

const TARGET_EMAIL = "admin+demobodega@nexid.local";
const CHANGE_REF = "INC-2026-0903";
const PASSWORD = "R7!vQ2#pL9@zM4$x";
const DATABASE_URL = "postgresql://owner:secret@ep-prod.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const OPERATOR_SESSION = "00000000-0000-4000-8000-000000000001.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";

function env(overrides = {}) {
  return {
    NEXID_TENANT_ADMIN_DATABASE_URL: DATABASE_URL,
    NEXID_TENANT_ADMIN_EXPECTED_HOST: "ep-prod.aws.neon.tech",
    NEXID_TENANT_ADMIN_EXPECTED_DATABASE: "neondb",
    NEXID_TENANT_ADMIN_EXPECTED_DB_ROLE: "owner",
    NEXID_TENANT_ADMIN_EXPECTED_ENDPOINT_ID: "ep-prod",
    NEXID_CREDENTIAL_OPERATOR_EMAIL: "security-operator@example.com",
    NEXID_CREDENTIAL_OPERATOR_SESSION_TOKEN: OPERATOR_SESSION,
    NEXID_TENANT_ADMIN_PASSWORD: PASSWORD,
    ...overrides,
  };
}

function rotateArgs(extra = []) {
  return [
    "--operation=rotate",
    "--tenant=demobodega",
    `--email=${TARGET_EMAIL}`,
    "--expected-current=legacy-sha256",
    `--change-ref=${CHANGE_REF}`,
    ...extra,
  ];
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof TenantAdminCredentialError && error.code === code);
}

function createRotateClient({ targetMemberships, failAudit = false, mfaEnabled = false, provision = false, tenantStatus = "active", credentialHash = "a".repeat(64) } = {}) {
  const calls = [];
  const memberships = targetMemberships || [{ tenant_id: "tenant-1", role: "tenant_admin" }];
  const client = {
    calls,
    async query(text, params = []) {
      calls.push({ text, params });
      if (/^(BEGIN|SET LOCAL|COMMIT|ROLLBACK)/.test(text)) return { rows: [], rowCount: null };
      if (text.includes("current_database()")) {
        return { rows: [{
          database_name: "neondb",
          database_role: "owner",
          session_role: "owner",
          endpoint_id: "ep-prod",
          transaction_read_only: "off",
        }], rowCount: 1 };
      }
      if (text.includes("relations_ready")) {
        return { rows: [{
          relations_ready: true,
          authority_migration_ready: true,
          runtime_watermark_ready: true,
          audit_columns_ready: true,
        }], rowCount: 1 };
      }
      if (text.includes("pg_advisory_xact_lock")) return { rows: [{}], rowCount: 1 };
      if (text.includes("FROM public.tenants")) {
        return { rows: [{ id: "tenant-1", slug: "demobodega", status: tenantStatus }], rowCount: 1 };
      }
      if (text.includes("FROM public.enterprise_role_profiles") && !text.includes("JOIN")) {
        return { rows: [{ code: "tenant_admin", active: true, tenant_bound: true, human_session_allowed: true }], rowCount: 1 };
      }
      if (text.includes("JOIN public.memberships")) {
        return { rows: [{ id: "operator-1", email: "security-operator@example.com" }], rowCount: 1 };
      }
      if (text.includes("FROM public.users") && params[0] === TARGET_EMAIL) {
        if (provision) return { rows: [], rowCount: 0 };
        return { rows: [{ id: "target-1", email: TARGET_EMAIL, full_name: "Bodega Balmec", admin_status: "active" }], rowCount: 1 };
      }
      if (text.includes("INSERT INTO public.users")) {
        return { rows: [{ id: "target-1", email: TARGET_EMAIL, full_name: "Bodega Balmec", admin_status: "active" }], rowCount: 1 };
      }
      if (text.includes("FROM public.memberships") && params[0] === "operator-1") {
        return { rows: [{ tenant_id: null, role: "super_admin" }], rowCount: 1 };
      }
      if (text.includes("FROM public.memberships") && params[0] === "target-1") {
        return { rows: memberships, rowCount: memberships.length };
      }
      if (text.includes("FROM public.user_mfa_factors")) {
        return { rows: [{ mfa_enabled: mfaEnabled }], rowCount: 1 };
      }
      if (text.includes("FROM public.password_credentials")) {
        return { rows: [{ password_hash: credentialHash }], rowCount: 1 };
      }
      if (text.includes("INSERT INTO public.password_credentials")) return { rows: [], rowCount: 1 };
      if (text.includes("INSERT INTO public.memberships")) return { rows: [], rowCount: 1 };
      if (text.includes("UPDATE public.password_credentials")) return { rows: [], rowCount: 1 };
      if (text.includes("UPDATE public.auth_sessions")) return { rows: [], rowCount: 2 };
      if (text.includes("UPDATE public.password_reset_tokens")) return { rows: [], rowCount: 1 };
      if (text.includes("INSERT INTO public.user_auth_events")) return { rows: [], rowCount: failAudit ? 0 : 1 };
      if (text.includes("INSERT INTO public.audit_logs")) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected query in test: ${text}`);
    },
  };
  return client;
}

test("configuration requires the dedicated, pinned, unpooled database target", () => {
  const config = readTenantAdminCredentialConfig(rotateArgs(), env());
  assert.equal(config.apply, false);
  assert.equal(config.safeTarget, "ep-prod.aws.neon.tech:5432/neondb");
  assert.equal(config.expectedCurrent, "legacy-sha256");

  expectCode(
    () => readTenantAdminCredentialConfig(rotateArgs(), env({
      NEXID_TENANT_ADMIN_DATABASE_URL: "",
      DATABASE_URL,
    })),
    "nexid_tenant_admin_database_url_required",
  );
  expectCode(
    () => readTenantAdminCredentialConfig(rotateArgs(), env({
      NEXID_TENANT_ADMIN_DATABASE_URL: DATABASE_URL.replace("ep-prod.", "ep-prod-pooler."),
      NEXID_TENANT_ADMIN_EXPECTED_HOST: "ep-prod-pooler.aws.neon.tech",
    })),
    "tenant_admin_unpooled_database_url_required",
  );
  expectCode(
    () => readTenantAdminCredentialConfig(rotateArgs(), env({
      NEXID_TENANT_ADMIN_DATABASE_URL: `${DATABASE_URL}&options=unsafe`,
    })),
    "tenant_admin_database_url_parameter_forbidden",
  );
  expectCode(
    () => readTenantAdminCredentialConfig(rotateArgs(), env({
      NEXID_TENANT_ADMIN_DATABASE_URL: "postgresql://owner:secret@ep-prod.aws.neon.tech/neondb?channel_binding=require",
    })),
    "tenant_admin_database_sslmode_required",
  );
  expectCode(
    () => readTenantAdminCredentialConfig(rotateArgs(), env({
      NEXID_TENANT_ADMIN_DATABASE_URL: `${DATABASE_URL}&sslmode=require`,
    })),
    "tenant_admin_database_url_parameter_duplicate",
  );
});

test("apply mode needs the exact tenant, account, operation and change reference confirmation", () => {
  expectCode(
    () => readTenantAdminCredentialConfig(rotateArgs(["--apply"]), env()),
    "tenant_admin_confirmation_mismatch",
  );
  const confirmation = `APPLY TENANT_ADMIN ROTATE demobodega ${TARGET_EMAIL} EXPECT legacy-sha256 ${CHANGE_REF}`;
  const config = readTenantAdminCredentialConfig(
    rotateArgs(["--apply"]),
    env({ NEXID_TENANT_ADMIN_CONFIRMATION: confirmation }),
  );
  assert.equal(config.apply, true);
  assert.equal(config.expectedConfirmation, confirmation);
});

test("provision and rotate require explicit, coherent prior credential state", () => {
  expectCode(
    () => readTenantAdminCredentialConfig(
      rotateArgs().map((value) => value === "--expected-current=legacy-sha256" ? "--expected-current=missing" : value),
      env(),
    ),
    "tenant_admin_operation_expected_state_mismatch",
  );
  expectCode(
    () => readTenantAdminCredentialConfig([
      "--operation=provision",
      "--tenant=demobodega",
      `--email=${TARGET_EMAIL}`,
      "--expected-current=missing",
      `--change-ref=${CHANGE_REF}`,
    ], env()),
    "tenant_admin_full_name_required",
  );
});

test("new credentials use the login-compatible scrypt format", () => {
  const hash = hashTenantAdminPassword(PASSWORD);
  assert.equal(classifyTenantAdminCredential(hash), "scrypt");
  assert.equal(verifyTenantAdminPassword(PASSWORD, hash), true);
  assert.equal(verifyTenantAdminPassword(`${PASSWORD}x`, hash), false);
  assert.equal(classifyTenantAdminCredential("a".repeat(64)), "legacy-sha256");
  assert.equal(classifyTenantAdminCredential("clerk_oauth_external_login"), "external-auth");
  assert.equal(classifyTenantAdminCredential("unknown-credential-marker"), "unsupported");
  expectCode(
    () => readTenantAdminCredentialConfig(rotateArgs(), env({
      NEXID_TENANT_ADMIN_PASSWORD: ` ${PASSWORD}`,
    })),
    "tenant_admin_password_control_character_forbidden",
  );
});

test("legacy rotation is tenant-scoped, revokes sessions, audits and rolls back in dry-run", async () => {
  const config = readTenantAdminCredentialConfig(rotateArgs(), env());
  const client = createRotateClient();
  const result = await executeTenantAdminCredentialChange(client, config);

  assert.equal(result.mode, "dry_run");
  assert.equal(result.committed, false);
  assert.equal(result.tenant, "demobodega");
  assert.equal(result.email, TARGET_EMAIL);
  assert.equal(result.previousCredentialState, "legacy-sha256");
  assert.equal(result.newCredentialState, "scrypt");
  assert.equal(result.sessionsRevoked, 2);
  assert.equal(result.resetTokensConsumed, 1);
  assert.equal(client.calls.at(-1).text, "ROLLBACK");
  assert(client.calls.some((call) => call.text.includes("UPDATE public.password_credentials")));
  assert(client.calls.some((call) => call.text.includes("INSERT INTO public.user_auth_events")));
  assert(client.calls.some((call) => call.text.includes("INSERT INTO public.audit_logs")));
  assert.equal(JSON.stringify(result).includes(PASSWORD), false);
});

test("apply mode commits only after the same scoped writes and audits", async () => {
  const confirmation = `APPLY TENANT_ADMIN ROTATE demobodega ${TARGET_EMAIL} EXPECT legacy-sha256 ${CHANGE_REF}`;
  const config = readTenantAdminCredentialConfig(
    rotateArgs(["--apply"]),
    env({ NEXID_TENANT_ADMIN_CONFIRMATION: confirmation }),
  );
  const client = createRotateClient();
  const result = await executeTenantAdminCredentialChange(client, config);

  assert.equal(result.mode, "apply");
  assert.equal(result.committed, true);
  assert.equal(client.calls.at(-1).text, "COMMIT");
});

test("provision creates only a missing tenant admin and remains a dry-run by default", async () => {
  const config = readTenantAdminCredentialConfig([
    "--operation=provision",
    "--tenant=demobodega",
    `--email=${TARGET_EMAIL}`,
    "--full-name=Bodega Balmec Admin",
    "--expected-current=missing",
    `--change-ref=${CHANGE_REF}`,
  ], env());
  const client = createRotateClient({ provision: true });
  const result = await executeTenantAdminCredentialChange(client, config);

  assert.equal(result.operation, "provision");
  assert.equal(result.previousCredentialState, "missing");
  assert.equal(result.committed, false);
  assert.equal(client.calls.at(-1).text, "ROLLBACK");
  assert(client.calls.some((call) => call.text.includes("INSERT INTO public.users")));
  assert(client.calls.some((call) => call.text.includes("INSERT INTO public.memberships")));
});

test("rotation fails closed for ambiguous or cross-tenant target authority", async () => {
  const config = readTenantAdminCredentialConfig(rotateArgs(), env());
  const client = createRotateClient({ targetMemberships: [
    { tenant_id: "tenant-1", role: "tenant_admin" },
    { tenant_id: "tenant-2", role: "viewer" },
  ] });

  await assert.rejects(
    executeTenantAdminCredentialChange(client, config),
    (error) => error instanceof TenantAdminCredentialError && error.code === "tenant_admin_target_scope_mismatch",
  );
  assert.equal(client.calls.at(-1).text, "ROLLBACK");
  assert.equal(client.calls.some((call) => call.text.includes("UPDATE public.password_credentials")), false);
});

test("credential changes fail closed when the tenant is not active", async () => {
  const config = readTenantAdminCredentialConfig(rotateArgs(), env());
  const client = createRotateClient({ tenantStatus: "suspended" });

  await assert.rejects(
    executeTenantAdminCredentialChange(client, config),
    (error) => error instanceof TenantAdminCredentialError && error.code === "tenant_admin_tenant_not_active",
  );
  assert.equal(client.calls.at(-1).text, "ROLLBACK");
  assert.equal(client.calls.some((call) => call.text.includes("UPDATE public.password_credentials")), false);
});

test("scrypt rotation fingerprints the credential change in audit state", async () => {
  const args = rotateArgs().map((value) => value === "--expected-current=legacy-sha256" ? "--expected-current=scrypt" : value);
  const config = readTenantAdminCredentialConfig(args, env());
  const client = createRotateClient({ credentialHash: hashTenantAdminPassword("V8!mR3#qT7@xL5%z") });

  await executeTenantAdminCredentialChange(client, config);
  const audit = client.calls.find((call) => call.text.includes("INSERT INTO public.audit_logs"));
  assert.ok(audit);
  assert.notEqual(audit.params[4], audit.params[5]);
});

test("an audit failure aborts the credential change transaction", async () => {
  const config = readTenantAdminCredentialConfig(rotateArgs(), env());
  const client = createRotateClient({ failAudit: true });

  await assert.rejects(
    executeTenantAdminCredentialChange(client, config),
    (error) => error instanceof TenantAdminCredentialError && error.code === "tenant_admin_auth_audit_write_failed",
  );
  assert.equal(client.calls.at(-1).text, "ROLLBACK");
});

test("rotation reports an existing MFA factor before changing the password", async () => {
  const config = readTenantAdminCredentialConfig(rotateArgs(), env());
  const client = createRotateClient({ mfaEnabled: true });

  await assert.rejects(
    executeTenantAdminCredentialChange(client, config),
    (error) => error instanceof TenantAdminCredentialError && error.code === "tenant_admin_mfa_recovery_required",
  );
  assert.equal(client.calls.at(-1).text, "ROLLBACK");
  assert.equal(client.calls.some((call) => call.text.includes("UPDATE public.password_credentials")), false);
});

test("the demo corpus never provisions deterministic human credentials in production", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../scripts/demo-demobodega.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /password_credentials/);
  assert.doesNotMatch(source, /admin\+demobodega@nexid\.local/);
  assert.doesNotMatch(source, /Deterministic demo logins/);
  assert.doesNotMatch(source, /createHash\("sha256"\)/);
});

test("the CLI activates node-postgres channel binding instead of trusting an unused URL key", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../scripts/tenant-admin-credentials.mjs", import.meta.url), "utf8");
  assert.match(source, /enableChannelBinding:\s*true/);
});
