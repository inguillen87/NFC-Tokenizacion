import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ENTERPRISE_EPHEMERAL_E2E_CONFIRMATION,
  assertEmptyEnterpriseE2eDatabase,
  readEnterpriseEphemeralE2eConfig,
} from "../scripts/lib/enterprise-ephemeral-e2e-safety.mjs";
import {
  CANONICAL_BASELINE_GUIDE,
  DbApplySafetyError,
  assertSafeDbApplyStart,
} from "../scripts/lib/db-apply-safety.mjs";
import { installEphemeralE2eSqlExecutor, sql } from "../src/lib/db.ts";

const validEnvironment = {
  NODE_ENV: "test",
  VERCEL_ENV: "test",
  NEXID_E2E_CONFIRMATION: ENTERPRISE_EPHEMERAL_E2E_CONFIRMATION,
  NEXID_E2E_EXPECTED_POSTGRES_VERSION: "18.4",
  NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:ephemeral-password@127.0.0.1:5432/nexid_e2e",
};

test("db-apply refuses an unauthorized empty bootstrap before any schema mutation", async () => {
  assert.throws(
    () => assertSafeDbApplyStart({
      hasMigrationLedger: false,
      initialized: false,
      appliedCount: 0,
    }),
    (error) => error instanceof DbApplySafetyError
      && error.code === "canonical_baseline_required"
      && error.details.database_mutated === false
      && error.details.guide === CANONICAL_BASELINE_GUIDE,
  );

  const runner = await readFile(new URL("../scripts/db-apply.mjs", import.meta.url), "utf8");
  assert.ok(
    runner.indexOf("  assertSafeDbApplyStart({") < runner.indexOf("CREATE TABLE IF NOT EXISTS schema_migrations"),
    "bootstrap safety decision must run before the first runner DDL",
  );
  assert.match(runner, /canonical_baseline_required|DbApplySafetyError/);
});

test("db-apply permits clean bootstrap only after the explicit E2E target gate", async () => {
  assert.doesNotThrow(() => assertSafeDbApplyStart({
    hasMigrationLedger: false,
    initialized: false,
    appliedCount: 0,
    allowCleanBootstrap: true,
  }));
  assert.throws(
    () => assertSafeDbApplyStart({
      hasMigrationLedger: false,
      initialized: false,
      appliedCount: 0,
      only: "0001_initial.sql",
      allowCleanBootstrap: true,
    }),
    (error) => error instanceof DbApplySafetyError
      && error.code === "canonical_baseline_required",
  );

  const runner = await readFile(new URL("../scripts/db-apply.mjs", import.meta.url), "utf8");
  assert.match(runner, /--allow-empty-ephemeral-e2e-bootstrap/);
  assert.match(runner, /readEnterpriseEphemeralE2eConfig/);
  assert.match(runner, /assertEmptyEnterpriseE2eDatabase/);
  assert.ok(
    runner.indexOf("await assertEmptyEnterpriseE2eDatabase")
      < runner.indexOf("CREATE TABLE IF NOT EXISTS schema_migrations"),
    "the explicit E2E bootstrap must prove the database is empty before DDL",
  );
  assert.match(runner, /clean_bootstrap_database_url_must_match_validated_e2e_target/);
});

test("enterprise E2E configuration never falls back to ordinary DATABASE_URL", () => {
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({
      NODE_ENV: "test",
      VERCEL_ENV: "test",
      DATABASE_URL: "postgresql://production:secret@prod.example.com/nexid",
    }),
    /NEXID_E2E_CONFIRMATION is required/,
  );
});

test("enterprise E2E rejects production, remote hosts and non-E2E identities", () => {
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({ ...validEnvironment, NODE_ENV: "production" }),
    /requires NODE_ENV=test and VERCEL_ENV=test/,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({
      ...validEnvironment,
      NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:secret@ep-prod.aws.neon.tech/nexid_e2e",
    }),
    /localhost or another loopback/,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({
      ...validEnvironment,
      NEXID_E2E_DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:5432/production",
    }),
    /role must be named nexid_e2e/,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({ ...validEnvironment, VERCEL_ENV: "production" }),
    /requires NODE_ENV=test and VERCEL_ENV=test/,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({ ...validEnvironment, NODE_ENV: "development" }),
    /requires NODE_ENV=test and VERCEL_ENV=test/,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({ ...validEnvironment, VERCEL_ENV: "preview" }),
    /requires NODE_ENV=test and VERCEL_ENV=test/,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({
      ...validEnvironment,
      NEXID_E2E_EXPECTED_POSTGRES_VERSION: "17.6",
    }),
    /must be one of 16\.4, 18\.4/,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({
      ...validEnvironment,
      NEXID_E2E_CONFIRMATION: "yes",
    }),
    /must equal I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE/,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({
      ...validEnvironment,
      NEXID_E2E_DATABASE_URL: "https://nexid_e2e:secret@127.0.0.1:5432/nexid_e2e",
    }),
    /must use postgres:\/\/ or postgresql:\/\//,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({
      ...validEnvironment,
      NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:secret@127.0.0.1:5432/production",
    }),
    /database name must be nexid_e2e/,
  );
  assert.throws(
    () => readEnterpriseEphemeralE2eConfig({
      ...validEnvironment,
      NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e@127.0.0.1:5432/nexid_e2e",
    }),
    /must include its dedicated test-role password/,
  );
  const ipv6 = readEnterpriseEphemeralE2eConfig({
    ...validEnvironment,
    NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:secret@[::1]:5432/nexid_e2e_ipv6",
  });
  assert.equal(ipv6.databaseName, "nexid_e2e_ipv6");
  assert.equal(ipv6.safeTarget, "[::1]:5432/nexid_e2e_ipv6");
});

test("enterprise E2E rejects every node-postgres URL override surface", () => {
  for (const suffix of [
    "?host=prod.example.com",
    "?user=production",
    "?port=6432",
    "?options=-csearch_path%3Dproduction",
    "#host=prod.example.com",
  ]) {
    const environment = {
      ...validEnvironment,
      NEXID_E2E_DATABASE_URL: `${validEnvironment.NEXID_E2E_DATABASE_URL}${suffix}`,
    };
    assert.throws(
      () => readEnterpriseEphemeralE2eConfig(environment),
      /must not include query parameters or fragments/,
      suffix,
    );
    assert.throws(
      () => installEphemeralE2eSqlExecutor(async () => [], environment),
      /database_url_overrides_rejected/,
      suffix,
    );
  }
});

test("database preflight accepts only an empty, writable, non-Neon E2E database", async () => {
  const config = readEnterpriseEphemeralE2eConfig(validEnvironment);
  const client = {
    calls: 0,
    async query() {
      this.calls += 1;
      if (this.calls === 1) {
        return { rows: [{
          database_name: "nexid_e2e",
          database_role: "nexid_e2e",
          neon_endpoint_id: null,
          transaction_read_only: "off",
          server_version_number: 180004,
        }] };
      }
      return { rows: [{ count: 0 }] };
    },
  };
  assert.deepEqual(await assertEmptyEnterpriseE2eDatabase(client, config), {
    databaseName: "nexid_e2e",
    databaseRole: "nexid_e2e",
    postgresVersion: "18.4",
    relationCount: 0,
  });

  const wrongVersion = {
    async query() {
      return { rows: [{
        database_name: "nexid_e2e",
        database_role: "nexid_e2e",
        neon_endpoint_id: null,
        transaction_read_only: "off",
        server_version_number: 160004,
      }] };
    },
  };
  await assert.rejects(
    () => assertEmptyEnterpriseE2eDatabase(wrongVersion, config),
    /ephemeral_e2e_postgres_version_mismatch/,
  );

  const nonEmpty = {
    calls: 0,
    async query() {
      this.calls += 1;
      return this.calls === 1
        ? client.query.call({ calls: 0 })
        : { rows: [{ count: 3 }] };
    },
  };
  await assert.rejects(
    () => assertEmptyEnterpriseE2eDatabase(nonEmpty, config),
    /ephemeral_e2e_database_not_empty:3/,
  );
});

test("process-local SQL injection is test-only, loopback-only and explicitly removable", { concurrency: false }, async () => {
  const executor = async (strings, ...values) => [{ statement: strings.join("?"), values }];
  assert.throws(
    () => installEphemeralE2eSqlExecutor(executor, { ...validEnvironment, NODE_ENV: "production" }),
    /test_runtime_required/,
  );
  assert.throws(
    () => installEphemeralE2eSqlExecutor(executor, {
      ...validEnvironment,
      NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:secret@remote.test/nexid_e2e",
    }),
    /local_target_required/,
  );
  for (const rejected of [
    { ...validEnvironment, NODE_ENV: "development" },
    { ...validEnvironment, VERCEL_ENV: "production" },
    { ...validEnvironment, VERCEL_ENV: "preview" },
    { ...validEnvironment, NEXID_E2E_CONFIRMATION: "wrong" },
    { ...validEnvironment, NEXID_E2E_DATABASE_URL: "https://nexid_e2e:secret@127.0.0.1/nexid_e2e" },
    { ...validEnvironment, NEXID_E2E_DATABASE_URL: "postgresql://postgres:secret@127.0.0.1/nexid_e2e" },
    { ...validEnvironment, NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:secret@127.0.0.1/production" },
    { ...validEnvironment, NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e@127.0.0.1/nexid_e2e" },
  ]) {
    assert.throws(() => installEphemeralE2eSqlExecutor(executor, rejected));
  }

  const uninstall = installEphemeralE2eSqlExecutor(executor, validEnvironment);
  try {
    const rows = await sql`SELECT ${"ephemeral"}::text AS mode`;
    assert.equal(rows[0].statement, "SELECT ?::text AS mode");
    assert.deepEqual(rows[0].values, ["ephemeral"]);
  } finally {
    uninstall();
  }
});

test("harness exercises production CMAC/SDM code with synthetic inputs and makes no physical or HSM claim", async () => {
  const source = await readFile(new URL("../scripts/enterprise-ephemeral-e2e.mjs", import.meta.url), "utf8");
  const runtimeSchema = await readFile(new URL("../src/lib/commercial-runtime-schema.ts", import.meta.url), "utf8");
  const webhookWorker = await readFile(new URL("../src/lib/sdk-webhooks.ts", import.meta.url), "utf8");
  assert.match(source, /generateSunParams/);
  assert.match(source, /processSunScan/);
  assert.match(source, /admin\/events\/stream\/route\.ts/);
  assert.match(source, /admin\/events\/route\.ts/);
  assert.match(source, /admin\/incidents\/route\.ts/);
  assert.match(source, /cryptographic_verification/);
  assert.match(source, /cross_tenant_mutation/);
  assert.match(source, /--allow-empty-ephemeral-e2e-bootstrap/);
  assert.match(source, /new Pool\(/);
  assert.match(source, /await appPool\.end\(\)/);
  assert.match(source, /buildServiceLevelSnapshot/);
  assert.match(source, /interval '31 days'/);
  assert.match(source, /aged_open_incident_signal/);
  assert.match(source, /authenticateSdkRequest/);
  assert.match(source, /revokeSdkApiKey/);
  assert.match(source, /reserveSunRateLimit/);
  assert.match(source, /enforceSdkEpcisCaptureRateLimit/);
  assert.match(source, /createWebhook/);
  assert.match(source, /rotateWebhook/);
  assert.match(source, /dispatchTenantWebhooks/);
  assert.match(source, /claimWebhookDeliveries/);
  assert.match(source, /processClaimedWebhookDelivery/);
  assert.match(source, /verifyNexIdWebhookSignature/);
  assert.match(source, /deliver:\s*async \(delivery\)/);
  assert.match(source, /in_process_signature_verified_no_network/);
  assert.match(source, /software_envelope_encrypted_tenant_bound/);
  assert.match(source, /sun_crypto: "production_cmac_sdm_code_with_synthetic_inputs"/);
  assert.match(source, /evidence_class: "synthetic_ephemeral_software_fixture"/);
  assert.match(source, /nfc_batch_key_envelope: "application_aes_256_gcm_with_process_secret"/);
  assert.match(source, /managed_kms: false/);
  assert.match(source, /hsm_backed: false/);
  assert.match(source, /physical_nfc_tag_scanned: false/);
  assert.match(source, /physical_tag_certification: false/);
  assert.match(source, /tagtamper_physical_certification: false/);
  assert.doesNotMatch(source, /managed_kms: true|hsm_backed: true|physical_nfc_tag_scanned: true|physical_tag_certification: true|tagtamper_physical_certification: true/);
  assert.doesNotMatch(source, /DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE/i);
  assert.doesNotMatch(source, /\bfetch\s*\(|https\.request\s*\(/i);
  assert.doesNotMatch(source, /api\.nexid\.lat|app\.nexid\.lat|neon\.tech/i);
  assert.match(
    runtimeSchema,
    /uq_events_sdk_idempotency_operation ON events\(sdk_idempotency_operation_id, created_at\)/,
  );
  assert.doesNotMatch(
    runtimeSchema,
    /uq_events_sdk_idempotency_operation ON events\(sdk_idempotency_operation_id\) WHERE/,
  );
  assert.match(webhookWorker, /webhook_delivery_test_transport_forbidden/);
  assert.match(webhookWorker, /process\.env\.NODE_ENV !== "test" \|\| process\.env\.VERCEL_ENV !== "test"/);
  assert.match(webhookWorker, /webhookDeliveryTransport\(dependencies\)/);
});

test("enterprise E2E and supplier governance docs preserve the physical NFC and software-custody boundary", async () => {
  const [e2eGuide, supplierPurpose] = await Promise.all([
    readFile(new URL("../../../docs/enterprise-hardening/2026-07-28/ephemeral-tap-to-ticket-e2e.md", import.meta.url), "utf8"),
    readFile(new URL("../../../docs/enterprise-hardening/2026-07-29/supplier-pack-purpose-governance.md", import.meta.url), "utf8"),
  ]);

  assert.match(e2eGuide, /input sintetico/);
  assert.match(e2eGuide, /`KMS_MASTER_KEY_HEX`[\s\S]*secreto aleatorio de proceso[\s\S]*no es una clave de KMS administrado,[\s\S]*no es HSM/);
  assert.match(e2eGuide, /`physical_nfc_tag_scanned=false`/);
  assert.match(e2eGuide, /`tagtamper_physical_certification=false`/);
  assert.match(e2eGuide, /`managed_kms=false`/);
  assert.match(e2eGuide, /`hsm_backed=false`/);
  assert.match(supplierPurpose, /Evidencia criptográfica NFC de lectura/);
  assert.match(supplierPurpose, /No certifican por sí solos origen, contenido, adhesión, instalación del loop, apertura real, custodia ni autenticidad del producto físico/);
  assert.doesNotMatch(supplierPurpose, /\*\*Autenticidad física NFC:\*\*/);
});

test("ephemeral E2E CI pins every external action and service image", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/enterprise-ephemeral-e2e.yml", import.meta.url),
    "utf8",
  );
  assert.match(
    workflow,
    /uses: actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4\.2\.2/,
  );
  assert.match(
    workflow,
    /uses: actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4\.4\.0/,
  );
  const pinnedPostgresImages = [...workflow.matchAll(
    /^\s+image:\s+"(postgres:\d+\.\d+-alpine@sha256:[a-f0-9]{64})"\s*$/gm,
  )].map((match) => match[1]);
  assert.deepEqual(pinnedPostgresImages, [
    "postgres:16.4-alpine@sha256:5660c2cbfea50c7a9127d17dc4e48543eedd3d7a41a595a2dfa572471e37e64c",
    "postgres:18.4-alpine@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15",
  ]);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /image: "\$\{\{ matrix\.postgres\.image \}\}"/);
  assert.match(
    workflow,
    /NEXID_E2E_EXPECTED_POSTGRES_VERSION: \$\{\{ matrix\.postgres\.version \}\}/,
  );
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d+/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /postgres:latest|ubuntu-latest/);
  assert.match(workflow, /\n\s{2}pull_request:\s*\n/);
  assert.match(workflow, /\n\s{2}push:\s*\n\s{4}branches:\s*\n\s{6}- main/);
  assert.match(workflow, /\n\s{2}merge_group:\s*\n/);
  assert.doesNotMatch(workflow, /\n\s+paths:/);
});
