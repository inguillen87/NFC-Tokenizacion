import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertSunAtomicPostgresQaTarget,
  readSunAtomicPostgresQaConfig,
  sanitizeSunAtomicQaFailure,
  sunAtomicQaConfirmation,
  SUN_ATOMIC_REQUIRED_MIGRATIONS,
} from "../scripts/lib/sun-atomic-postgres-qa-safety.mjs";
import {
  assertSanitizedTtTruthReceipt,
  buildSanitizedSunEnvelope,
  databaseReceiptHandoffEligibility,
  summarizeTtTruthReceipt,
  summarizeSunReceipt,
  SUN_ATOMIC_CALL_SQL,
  SUN_TT_STATUS_MAPPINGS,
} from "../scripts/validate-sun-atomic-postgres-qa.mjs";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedEndpointId = "ep-codex-qa-a1b2c3d4";
const expectedHost = `${expectedEndpointId}.us-east-2.aws.neon.tech`;
const databaseName = "codex_qa_sun_atomic";
const validEnvironment = {
  NODE_ENV: "test",
  VERCEL_ENV: "test",
  NEXID_SUN_ATOMIC_QA_DATABASE_URL:
    `postgresql://codex_sun_qa:disposable-password@${expectedHost}/${databaseName}`,
  NEXID_SUN_ATOMIC_QA_EXPECTED_HOST: expectedHost,
  NEXID_SUN_ATOMIC_QA_EXPECTED_ENDPOINT_ID: expectedEndpointId,
  NEXID_SUN_ATOMIC_QA_CONFIRMATION: sunAtomicQaConfirmation({ expectedEndpointId, databaseName }),
};

test("SUN PostgreSQL QA config never falls back to production DATABASE_URL", () => {
  assert.throws(
    () => readSunAtomicPostgresQaConfig({
      NODE_ENV: "test",
      VERCEL_ENV: "test",
      DATABASE_URL: "postgresql://owner:secret@prod.example.com/nexid",
    }),
    /NEXID_SUN_ATOMIC_QA_DATABASE_URL is required; this validator never falls back to DATABASE_URL/,
  );
});

test("SUN PostgreSQL QA accepts only a target-bound codex_qa Neon database", () => {
  const config = readSunAtomicPostgresQaConfig(validEnvironment);
  assert.equal(config.databaseName, databaseName);
  assert.equal(config.hostname, expectedHost);
  assert.equal(config.expectedEndpointId, expectedEndpointId);
  assert.equal(config.databaseRole, "codex_sun_qa");
  assert.equal(config.safeTarget, `${expectedHost}:5432/${databaseName}`);

  for (const environment of [
    { ...validEnvironment, NODE_ENV: "production" },
    { ...validEnvironment, VERCEL_ENV: "production" },
    {
      ...validEnvironment,
      NEXID_SUN_ATOMIC_QA_DATABASE_URL:
        `postgresql://codex_sun_qa:secret@${expectedHost}/nexid_production`,
    },
    {
      ...validEnvironment,
      NEXID_SUN_ATOMIC_QA_DATABASE_URL:
        `postgresql://codex_sun_qa:secret@other-endpoint.us-east-2.aws.neon.tech/${databaseName}`,
    },
    { ...validEnvironment, NEXID_SUN_ATOMIC_QA_EXPECTED_HOST: "prod.example.com" },
    { ...validEnvironment, NEXID_SUN_ATOMIC_QA_EXPECTED_ENDPOINT_ID: "not-an-endpoint" },
    { ...validEnvironment, NEXID_SUN_ATOMIC_QA_CONFIRMATION: "yes" },
    {
      ...validEnvironment,
      NEXID_SUN_ATOMIC_QA_DATABASE_URL:
        `https://codex_sun_qa:secret@${expectedHost}/${databaseName}`,
    },
    {
      ...validEnvironment,
      NEXID_SUN_ATOMIC_QA_DATABASE_URL:
        `postgresql://codex_sun_qa@${expectedHost}/${databaseName}`,
    },
  ]) {
    assert.throws(() => readSunAtomicPostgresQaConfig(environment));
  }
});

test("SUN PostgreSQL QA rejects every URL override surface before node-postgres sees it", () => {
  for (const suffix of [
    "?host=production.example.com",
    "?user=production",
    "?sslmode=disable",
    "?options=-csearch_path%3Dproduction",
    "#host=production.example.com",
  ]) {
    assert.throws(
      () => readSunAtomicPostgresQaConfig({
        ...validEnvironment,
        NEXID_SUN_ATOMIC_QA_DATABASE_URL: `${validEnvironment.NEXID_SUN_ATOMIC_QA_DATABASE_URL}${suffix}`,
      }),
      /must not include query parameters or fragments/,
      suffix,
    );
  }
});

test("connected target preflight binds database, role, endpoint and the complete 0062/0066/0089/0093 contract", async () => {
  const config = readSunAtomicPostgresQaConfig(validEnvironment);
  const identityRow = {
    database_name: databaseName,
    database_role: "codex_sun_qa",
    endpoint_id: expectedEndpointId,
    transaction_read_only: "off",
    server_version_number: 170005,
  };
  const capabilityRow = {
    tenants: true,
    batches: true,
    tags: true,
    events: true,
    tt_truth_receipts: true,
    wrapper: true,
    base_0062: true,
    base_pre_tt_0093: true,
    tt_truth_capability: true,
    base_0062_security_definer: true,
    tt_truth_append_only: true,
    tenant_count: 0,
    batch_count: 0,
    tag_count: 0,
    event_count: 0,
    applied_migrations: [...SUN_ATOMIC_REQUIRED_MIGRATIONS],
  };
  const ttContractRow = {
    capability_version: "sun-tt-durable-truth-binding/v1",
    receipt_count: 0,
    forbidden_column_count: 0,
  };
  const makeClient = ({ identity = identityRow, capability = capabilityRow, ttContract = ttContractRow } = {}) => ({
    calls: 0,
    async query() {
      this.calls += 1;
      if (this.calls === 1) return { rows: [identity] };
      if (this.calls === 2) return { rows: [capability] };
      return { rows: [ttContract] };
    },
  });
  const client = makeClient();
  const result = await assertSunAtomicPostgresQaTarget(client, config);
  assert.equal(result.endpointId, expectedEndpointId);
  assert.deepEqual(result.appliedMigrations, [...SUN_ATOMIC_REQUIRED_MIGRATIONS]);
  assert.equal(result.ttTruthCapability, "sun-tt-durable-truth-binding/v1");

  const wrongEndpoint = makeClient({
    identity: { ...identityRow, endpoint_id: "ep-production-12345678" },
  });
  await assert.rejects(
    () => assertSunAtomicPostgresQaTarget(wrongEndpoint, config),
    /sun_atomic_qa_neon_endpoint_mismatch/,
  );

  const missingMigration = makeClient({
    capability: {
      ...capabilityRow,
      applied_migrations: SUN_ATOMIC_REQUIRED_MIGRATIONS.slice(0, -1),
    },
  });
  await assert.rejects(
    () => assertSunAtomicPostgresQaTarget(missingMigration, config),
    /sun_atomic_qa_required_migration_ledger_incomplete/,
  );

  const nonEmpty = makeClient({
    capability: {
      ...capabilityRow,
      tenant_count: 1,
      batch_count: 1,
      tag_count: 1,
      event_count: 10,
    },
    ttContract: { ...ttContractRow, receipt_count: 10 },
  });
  await assert.rejects(
    () => assertSunAtomicPostgresQaTarget(nonEmpty, config),
    /sun_atomic_qa_business_tables_not_empty:23/,
  );

  await assert.rejects(
    () => assertSunAtomicPostgresQaTarget(makeClient({
      capability: { ...capabilityRow, tt_truth_append_only: false },
    }), config),
    /sun_atomic_qa_0093_durable_tt_contract_missing/,
  );
  await assert.rejects(
    () => assertSunAtomicPostgresQaTarget(makeClient({
      ttContract: { ...ttContractRow, forbidden_column_count: 1 },
    }), config),
    /sun_atomic_qa_0093_receipt_sensitive_columns_present/,
  );
});

test("receipt summary exposes fresh/replay handoff preconditions without UID, payload hashes or keys", () => {
  const fresh = {
    event_id: "41",
    final_result: "VALID",
    auth_status: "VALID",
    replay_suspect: false,
    replay_original_event_id: null,
    allowlisted: true,
    event_type: "TAP_VALID",
    verdict: "valid",
    uid_hex: "04999999999999",
    cmac_hash: `sha256:${"a".repeat(64)}`,
    raw_secret_key: "must-not-escape",
  };
  assert.deepEqual(databaseReceiptHandoffEligibility(fresh), {
    eligible: true,
    scope: "database_receipt_preconditions_only",
    eventId: "41",
    reasons: [],
  });
  const summary = summarizeSunReceipt(fresh);
  assert.equal(summary.database_receipt_handoff_eligible, true);
  assert.equal("uid_hex" in summary, false);
  assert.equal("cmac_hash" in summary, false);
  assert.equal("raw_secret_key" in summary, false);

  for (const canonicalState of ["VALID_AUTHENTIC", "VALID_CLOSED", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY"]) {
    assert.equal(databaseReceiptHandoffEligibility({
      ...fresh,
      final_result: canonicalState,
      auth_status: canonicalState,
    }).eligible, true, canonicalState);
  }

  const replay = summarizeSunReceipt({
    ...fresh,
    event_id: "42",
    final_result: "REPLAY_SUSPECT",
    auth_status: "REPLAY_SUSPECT",
    replay_suspect: true,
    replay_original_event_id: "41",
  });
  assert.equal(replay.database_receipt_handoff_eligible, false);
  assert.ok(replay.eligibility_reasons.includes("result_not_authentic"));
  assert.ok(replay.eligibility_reasons.includes("replay_or_unknown_replay_state"));
});

test("sanitized fixture contains hashes and explicit non-physical evidence but no raw cryptographic key", () => {
  const envelope = buildSanitizedSunEnvelope({
    tenantId: "11111111-1111-4111-8111-111111111111",
    tenantSlug: "codex-qa-sun-test",
    batchId: "22222222-2222-4222-8222-222222222222",
    tagId: "33333333-3333-4333-8333-333333333333",
    bid: "QA-SUN-TEST",
    uidHex: "04112233445566",
    counter: 7,
    variant: "fixture",
  });
  for (const field of ["picc_data_hash", "cmac_hash", "raw_url_hash", "enc_hash"]) {
    assert.match(envelope[field], /^sha256:[0-9a-f]{64}$/);
  }
  assert.equal(envelope.meta.physical_nfc_tag_scanned, false);
  assert.equal(envelope.meta.raw_key_material_present, false);
  assert.deepEqual(envelope.tt_truth, {
    schema_version: "sun-tt-durable-truth-input/v1",
    carrier_profile_code: "ntag424_dna_tt",
    claimed_product_state: "VALID_CLOSED",
    status_source: "enc_decrypted",
    status_offset: 0,
    status_length: 2,
    tt_raw: "4343",
  });
  assert.equal("k_meta" in envelope, false);
  assert.equal("k_file" in envelope, false);
  assert.equal("key_hex" in envelope, false);
});

test("validator fixtures encode only the three canonical TTStatus mappings", () => {
  assert.deepEqual(SUN_TT_STATUS_MAPPINGS, [
    { ttRaw: "4343", productState: "VALID_CLOSED" },
    { ttRaw: "4F4F", productState: "VALID_OPENED" },
    { ttRaw: "4F43", productState: "VALID_OPENED_PREVIOUSLY" },
  ]);
});

test("durable TT receipt validator allowlists its schema and rejects UID, PII or key fields", () => {
  const envelope = buildSanitizedSunEnvelope({
    tenantId: "11111111-1111-4111-8111-111111111111",
    tenantSlug: "codex-qa-sun-test",
    batchId: "22222222-2222-4222-8222-222222222222",
    tagId: "33333333-3333-4333-8333-333333333333",
    bid: "QA-SUN-TEST",
    uidHex: "04112233445566",
    counter: 7,
    variant: "receipt",
  });
  const receipt = {
    event_id: "41",
    event_created_at: "2026-08-02T12:00:00.000Z",
    tenant_id: envelope.tenant_id,
    batch_id: envelope.batch_id,
    carrier_profile_code: "ntag424_dna_tt",
    tt_raw: "4343",
    canonical_product_state: "VALID_CLOSED",
    claimed_product_state: "VALID_CLOSED",
    binding_status: "BOUND",
    binding_reason: "tt_raw_exact_match",
    status_source: "enc_decrypted",
    status_offset: 0,
    status_length: 2,
    picc_data_hash: envelope.picc_data_hash,
    cmac_hash: envelope.cmac_hash,
    enforced_base_result: "VALID_CLOSED",
    base_auth_status: "VALID_CLOSED",
    evidence_digest: `sha256:${"a".repeat(64)}`,
    created_at: "2026-08-02T12:00:00.000Z",
  };
  assert.deepEqual(assertSanitizedTtTruthReceipt(receipt, {
    envelope,
    expectedRaw: "4343",
    expectedCanonicalState: "VALID_CLOSED",
    expectedBindingStatus: "BOUND",
    expectedBindingReason: "tt_raw_exact_match",
    expectedResult: "VALID_CLOSED",
    expectedAuthStatus: "VALID_CLOSED",
  }), summarizeTtTruthReceipt(receipt));

  for (const forbidden of ["uid_hex", "user_agent", "email", "key_hex"]) {
    assert.throws(() => assertSanitizedTtTruthReceipt({ ...receipt, [forbidden]: "must-not-exist" }, {
      envelope,
      expectedRaw: "4343",
      expectedCanonicalState: "VALID_CLOSED",
      expectedBindingStatus: "BOUND",
      expectedBindingReason: "tt_raw_exact_match",
      expectedResult: "VALID_CLOSED",
      expectedAuthStatus: "VALID_CLOSED",
    }), /TT truth receipt schema must remain allowlisted/);
  }
});

test("validator syntax and static contract prove concurrency, durable TT truth and bounded claims", async () => {
  const scriptPath = path.join(apiRoot, "scripts", "validate-sun-atomic-postgres-qa.mjs");
  const syntax = spawnSync(process.execPath, ["--check", scriptPath], {
    cwd: apiRoot,
    encoding: "utf8",
  });
  assert.equal(syntax.status, 0, syntax.stderr);

  const source = await readFile(scriptPath, "utf8");
  assert.match(SUN_ATOMIC_CALL_SQL, /nexid_persist_sun_scan_v1\(\$1::jsonb\)/);
  assert.match(source, /new pg\.Client\(clientOptions\(config, `nexid_sun_qa_\$\{label\}_a_/);
  assert.match(source, /new pg\.Client\(clientOptions\(config, `nexid_sun_qa_\$\{label\}_b_/);
  assert.match(source, /waitForAdvisoryWaiters/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /invalid-inet-for-forced-rollback/);
  assert.match(source, /\{ \.\.\.rollbackAfter \}[\s\S]*\{ \.\.\.rollbackBefore \}/);
  assert.match(source, /JOIN public\.events event_row[\s\S]*event_row\.created_at = receipt_row\.event_created_at/);
  assert.doesNotMatch(source, /atomicReceipt\.created_at[\s\S]{0,160}\$2::timestamptz/);
  assert.match(source, /tt_raw_missing_fails_closed/);
  assert.match(source, /tt_raw_contradiction_fails_closed/);
  assert.match(source, /force_result_cannot_promote/);
  assert.match(source, /force_result_can_only_degrade/);
  assert.match(source, /cmac_verification_gate_preserved/);
  assert.match(source, /sdm_payload_gate_preserved/);
  assert.match(source, /sun_tt_truth_receipt_append_only/);
  assert.match(source, /committed_event_receipt_bijection/);
  assert.match(source, /not_performed_disposable_database_or_branch_deletion_required/);
  assert.doesNotMatch(source, /DELETE FROM tenants/);
  assert.match(source, /http_route: "not_covered_direct_function_validation_only"/);
  assert.match(source, /fresh_handoff_token_issued: false/);
  assert.match(source, /managed_kms_validated: false/);
  assert.match(source, /hsm_validated: false/);
  assert.doesNotMatch(source, /DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE/i);
  assert.doesNotMatch(source, /managed_kms_validated: true|hsm_validated: true|physical_nfc_tag_scanned: true/);
});

test("database URL is redacted from validator failures", () => {
  const config = readSunAtomicPostgresQaConfig(validEnvironment);
  const reason = sanitizeSunAtomicQaFailure(
    new Error(`connection failed: ${validEnvironment.NEXID_SUN_ATOMIC_QA_DATABASE_URL}`),
    config,
  );
  assert.equal(reason.includes("disposable-password"), false);
  assert.match(reason, /\[redacted_database_url\]/);
});
