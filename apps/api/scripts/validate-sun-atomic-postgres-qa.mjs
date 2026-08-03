import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import {
  assertSunAtomicPostgresQaTarget,
  readSunAtomicPostgresQaConfig,
  sanitizeSunAtomicQaFailure,
} from "./lib/sun-atomic-postgres-qa-safety.mjs";

export const SUN_ATOMIC_CALL_SQL = `
  SELECT *
  FROM public.nexid_persist_sun_scan_v1($1::jsonb)
`;

const AUTHENTIC_RESULTS = new Set([
  "VALID",
  "TAP_VALID",
  "VALID_AUTHENTIC",
  "VALID_CLOSED",
  "VALID_UNKNOWN_TAMPER",
  "OPENED",
  "OPENED_PREVIOUSLY",
  "MANUAL_OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_MANUAL_OPENED",
]);

export const SUN_TT_STATUS_MAPPINGS = Object.freeze([
  Object.freeze({ ttRaw: "4343", productState: "VALID_CLOSED" }),
  Object.freeze({ ttRaw: "4F4F", productState: "VALID_OPENED" }),
  Object.freeze({ ttRaw: "4F43", productState: "VALID_OPENED_PREVIOUSLY" }),
]);

const TT_TRUTH_RECEIPT_FIELDS = Object.freeze([
  "base_auth_status",
  "batch_id",
  "binding_reason",
  "binding_status",
  "canonical_product_state",
  "carrier_profile_code",
  "claimed_product_state",
  "cmac_hash",
  "created_at",
  "enforced_base_result",
  "event_created_at",
  "event_id",
  "evidence_digest",
  "picc_data_hash",
  "status_length",
  "status_offset",
  "status_source",
  "tenant_id",
  "tt_raw",
].sort());

function sha256(label) {
  return `sha256:${createHash("sha256").update(label).digest("hex")}`;
}

function positiveEventId(value) {
  const normalized = String(value ?? "");
  return /^[1-9][0-9]*$/.test(normalized) ? normalized : null;
}

export function databaseReceiptHandoffEligibility(receipt) {
  const reasons = [];
  const result = String(receipt?.final_result || "").toUpperCase();
  const authStatus = String(receipt?.auth_status || "").toUpperCase();
  const eventId = positiveEventId(receipt?.event_id);
  if (!eventId) reasons.push("canonical_event_receipt_missing");
  if (!AUTHENTIC_RESULTS.has(result)) reasons.push("result_not_authentic");
  if (!AUTHENTIC_RESULTS.has(authStatus)) reasons.push("auth_status_not_authentic");
  if (receipt?.replay_suspect !== false) reasons.push("replay_or_unknown_replay_state");
  if (receipt?.allowlisted !== true) reasons.push("tag_not_allowlisted");
  return Object.freeze({
    eligible: reasons.length === 0,
    scope: "database_receipt_preconditions_only",
    eventId,
    reasons: Object.freeze(reasons),
  });
}

export function summarizeSunReceipt(receipt) {
  const eligibility = databaseReceiptHandoffEligibility(receipt);
  return Object.freeze({
    event_id: eligibility.eventId,
    final_result: String(receipt?.final_result || ""),
    auth_status: String(receipt?.auth_status || ""),
    replay_suspect: receipt?.replay_suspect === true,
    replay_original_event_id: positiveEventId(receipt?.replay_original_event_id),
    allowlisted: receipt?.allowlisted === true,
    event_type: String(receipt?.event_type || ""),
    verdict: String(receipt?.verdict || ""),
    database_receipt_handoff_eligible: eligibility.eligible,
    eligibility_reasons: [...eligibility.reasons],
  });
}

export function buildSanitizedSunEnvelope({
  tenantId,
  tenantSlug,
  batchId,
  tagId,
  bid,
  uidHex,
  counter,
  variant,
  ttRaw = "4343",
  claimedProductState = "VALID_CLOSED",
  includeTtRaw = true,
  includeTtTruth = true,
  forceResult = null,
  cryptographicVerification = true,
  payloadVerified = true,
  supplierPayloadOnly = false,
}) {
  const namespace = `${tenantId}:${batchId}:${uidHex}:${counter}:${variant}`;
  const ttTruth = {
    schema_version: "sun-tt-durable-truth-input/v1",
    carrier_profile_code: "ntag424_dna_tt",
    claimed_product_state: claimedProductState,
    status_source: "enc_decrypted",
    status_offset: 0,
    status_length: 2,
  };
  if (includeTtRaw) ttTruth.tt_raw = ttRaw;
  const envelope = {
    tenant_id: tenantId,
    tenant_slug: tenantSlug,
    batch_id: batchId,
    registered_tag_id: tagId,
    registered_tag_status: "active",
    bid,
    resolved_uid_hex: uidHex,
    resolved_ctr: counter,
    cryptographic_verification: cryptographicVerification,
    payload_verified: payloadVerified,
    supplier_payload_match: false,
    supplier_payload_only: supplierPayloadOnly,
    picc_data_hash: sha256(`${namespace}:picc`),
    cmac_hash: sha256(`${namespace}:cmac`),
    raw_url_hash: sha256(`${namespace}:url`),
    enc_hash: sha256(`${namespace}:enc`),
    source: "demo",
    pre_registry_result: claimedProductState,
    reason_if_not_replay: null,
    meta: {
      qa_fixture: "sun_atomic_postgres_v1",
      input_class: "sanitized_preverified_envelope",
      physical_nfc_tag_scanned: false,
      raw_key_material_present: false,
    },
    user_agent: "qa-synthetic-user-agent-do-not-copy",
    geo_city: "qa-synthetic-city-do-not-copy",
    geo_country: "ZZ",
    device_label: "qa-synthetic-device-do-not-copy",
    raw_query: {
      qa_fixture: "sanitized",
      qa_sensitive_marker: "qa-pii-marker-do-not-copy",
    },
  };
  if (includeTtTruth) envelope.tt_truth = Object.freeze(ttTruth);
  if (forceResult) envelope.force_result = forceResult;
  return Object.freeze(envelope);
}

export function summarizeTtTruthReceipt(receipt) {
  return Object.freeze({
    event_id: positiveEventId(receipt?.event_id),
    tt_raw: receipt?.tt_raw == null ? null : String(receipt.tt_raw),
    canonical_product_state: receipt?.canonical_product_state == null
      ? null
      : String(receipt.canonical_product_state),
    binding_status: String(receipt?.binding_status || ""),
    binding_reason: String(receipt?.binding_reason || ""),
    enforced_base_result: String(receipt?.enforced_base_result || ""),
    base_auth_status: String(receipt?.base_auth_status || ""),
    evidence_digest: String(receipt?.evidence_digest || ""),
  });
}

export function assertSanitizedTtTruthReceipt(receipt, {
  envelope,
  expectedRaw,
  expectedCanonicalState,
  expectedBindingStatus,
  expectedBindingReason,
  expectedResult,
  expectedAuthStatus,
}) {
  assert.ok(receipt && typeof receipt === "object" && !Array.isArray(receipt), "TT truth receipt object required");
  assert.deepEqual(Object.keys(receipt).sort(), TT_TRUTH_RECEIPT_FIELDS, "TT truth receipt schema must remain allowlisted");
  assert.equal(receipt.carrier_profile_code, "ntag424_dna_tt");
  assert.equal(receipt.tt_raw ?? null, expectedRaw ?? null);
  assert.equal(receipt.canonical_product_state ?? null, expectedCanonicalState ?? null);
  assert.equal(receipt.binding_status, expectedBindingStatus);
  assert.equal(receipt.binding_reason, expectedBindingReason);
  assert.equal(receipt.enforced_base_result, expectedResult);
  assert.equal(receipt.base_auth_status, expectedAuthStatus);
  assert.equal(receipt.picc_data_hash, envelope.picc_data_hash);
  assert.equal(receipt.cmac_hash, envelope.cmac_hash);
  assert.match(String(receipt.evidence_digest || ""), /^sha256:[0-9a-f]{64}$/);
  assert.equal(Number(receipt.status_offset), 0);
  assert.equal(Number(receipt.status_length), 2);
  assert.equal(receipt.status_source, "enc_decrypted");

  const serialized = JSON.stringify(receipt).toLowerCase();
  for (const marker of [
    envelope.resolved_uid_hex,
    envelope.tenant_slug,
    envelope.user_agent,
    envelope.geo_city,
    envelope.geo_country,
    envelope.device_label,
    envelope.raw_query?.qa_sensitive_marker,
    "not-a-key:synthetic-validation-fixture",
  ]) {
    assert.equal(serialized.includes(String(marker).toLowerCase()), false, `TT truth receipt leaked marker: ${marker}`);
  }
  return summarizeTtTruthReceipt(receipt);
}

function clientOptions(config, applicationName) {
  return {
    connectionString: config.databaseUrl,
    application_name: applicationName,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
    ssl: { rejectUnauthorized: true },
  };
}

async function waitForAdvisoryWaiters(observer, backendPids, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = (await observer.query(`SELECT pid, wait_event_type, wait_event
      FROM pg_stat_activity
      WHERE pid = ANY($1::integer[])`, [backendPids])).rows;
    const waiting = new Set(rows
      .filter((row) => row.wait_event_type === "Lock" && String(row.wait_event).toLowerCase() === "advisory")
      .map((row) => Number(row.pid)));
    if (backendPids.every((pid) => waiting.has(pid))) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("sun_atomic_qa_concurrent_advisory_wait_not_observed");
}

async function invokeAtomicPersistence(client, envelope) {
  const rows = (await client.query(SUN_ATOMIC_CALL_SQL, [JSON.stringify(envelope)])).rows;
  if (rows.length !== 1) throw new Error("sun_atomic_qa_receipt_missing");
  return rows[0];
}

async function readTtTruthReceipt(client, atomicReceipt) {
  const rows = (await client.query(`SELECT to_jsonb(receipt_row) AS receipt
    FROM public.sun_tt_truth_receipts receipt_row
    JOIN public.events event_row
      ON event_row.id = receipt_row.event_id
     AND event_row.created_at = receipt_row.event_created_at
    WHERE receipt_row.event_id = $1::bigint`, [atomicReceipt.event_id])).rows;
  if (rows.length !== 1 || !rows[0]?.receipt) {
    throw new Error("sun_atomic_qa_tt_truth_receipt_missing");
  }
  return rows[0].receipt;
}

function assertAtomicReceipt(receipt, {
  expectedResult,
  expectedAuthStatus,
  expectedReplay = false,
  expectedEventType,
  expectedVerdict,
}) {
  assert.equal(receipt.final_result, expectedResult);
  assert.equal(receipt.auth_status, expectedAuthStatus);
  assert.equal(receipt.replay_suspect, expectedReplay);
  assert.equal(receipt.allowlisted, true);
  if (expectedEventType) assert.equal(receipt.event_type, expectedEventType);
  if (expectedVerdict) assert.equal(receipt.verdict, expectedVerdict);
  return summarizeSunReceipt(receipt);
}

async function validateCommittedTtScenario(client, {
  envelope,
  expectedRaw,
  expectedCanonicalState,
  expectedBindingStatus,
  expectedBindingReason,
  expectedResult,
  expectedAuthStatus,
  expectedEventType,
  expectedVerdict,
}) {
  const atomicReceipt = await invokeAtomicPersistence(client, envelope);
  const atomicSummary = assertAtomicReceipt(atomicReceipt, {
    expectedResult,
    expectedAuthStatus,
    expectedEventType,
    expectedVerdict,
  });
  const durableReceipt = await readTtTruthReceipt(client, atomicReceipt);
  const durableSummary = assertSanitizedTtTruthReceipt(durableReceipt, {
    envelope,
    expectedRaw,
    expectedCanonicalState,
    expectedBindingStatus,
    expectedBindingReason,
    expectedResult,
    expectedAuthStatus,
  });
  return Object.freeze({ atomicReceipt, atomicSummary, durableReceipt, durableSummary });
}

async function assertTtTruthReceiptAppendOnly(client, atomicReceipt) {
  const parameters = [atomicReceipt.event_id];
  let updateSqlState = null;
  await assert.rejects(
    () => client.query(`UPDATE public.sun_tt_truth_receipts
      SET binding_reason = binding_reason
      WHERE event_id = $1::bigint`, parameters),
    (error) => {
      updateSqlState = String(error?.code || "");
      return updateSqlState === "55000" && String(error?.message || "").includes("sun_tt_truth_receipt_append_only");
    },
    "TT truth receipt update must fail closed",
  );
  let deleteSqlState = null;
  await assert.rejects(
    () => client.query(`DELETE FROM public.sun_tt_truth_receipts
      WHERE event_id = $1::bigint`, parameters),
    (error) => {
      deleteSqlState = String(error?.code || "");
      return deleteSqlState === "55000" && String(error?.message || "").includes("sun_tt_truth_receipt_append_only");
    },
    "TT truth receipt delete must fail closed",
  );
  const remaining = Number((await client.query(`SELECT count(*)::integer AS count
    FROM public.sun_tt_truth_receipts
    WHERE event_id = $1::bigint`, parameters)).rows[0]?.count || 0);
  assert.equal(remaining, 1, "append-only probes must preserve the durable receipt");
  return Object.freeze({ update_sqlstate: updateSqlState, delete_sqlstate: deleteSqlState, row_preserved: true });
}

async function runBlockedConcurrentPair({ config, observer, lock, firstEnvelope, secondEnvelope, label }) {
  const suffix = randomBytes(4).toString("hex");
  const blocker = new pg.Client(clientOptions(config, `nexid_sun_qa_${label}_blocker_${suffix}`));
  const first = new pg.Client(clientOptions(config, `nexid_sun_qa_${label}_a_${suffix}`));
  const second = new pg.Client(clientOptions(config, `nexid_sun_qa_${label}_b_${suffix}`));
  const calls = [];
  let blockerTransactionOpen = false;
  try {
    await Promise.all([blocker.connect(), first.connect(), second.connect()]);
    const [firstPid, secondPid] = await Promise.all([
      first.query("SELECT pg_backend_pid()::integer AS pid").then((result) => Number(result.rows[0].pid)),
      second.query("SELECT pg_backend_pid()::integer AS pid").then((result) => Number(result.rows[0].pid)),
    ]);
    await blocker.query("BEGIN");
    blockerTransactionOpen = true;
    await blocker.query(
      "SELECT pg_advisory_xact_lock(hashtext($1::text), hashtext($2::text))",
      [lock.batchId, lock.identity],
    );

    calls.push(invokeAtomicPersistence(first, firstEnvelope));
    calls.push(invokeAtomicPersistence(second, secondEnvelope));
    await waitForAdvisoryWaiters(observer, [firstPid, secondPid]);
    await blocker.query("COMMIT");
    blockerTransactionOpen = false;
    const receipts = await Promise.all(calls);
    return { overlapObserved: true, receipts };
  } finally {
    if (blockerTransactionOpen) await blocker.query("ROLLBACK").catch(() => null);
    await Promise.allSettled(calls);
    await Promise.allSettled([blocker.end(), first.end(), second.end()]);
  }
}

function assertFreshReplayPair(receipts, label) {
  assert.equal(receipts.length, 2, `${label}: two receipts required`);
  const summaries = receipts.map(summarizeSunReceipt);
  const fresh = summaries.filter((receipt) => receipt.database_receipt_handoff_eligible);
  const replay = summaries.filter((receipt) => receipt.replay_suspect);
  assert.equal(fresh.length, 1, `${label}: exactly one receipt must remain fresh`);
  assert.equal(replay.length, 1, `${label}: exactly one receipt must be a replay`);
  assert.equal(replay[0].final_result, "REPLAY_SUSPECT", `${label}: replay result must fail closed`);
  assert.equal(replay[0].auth_status, "REPLAY_SUSPECT", `${label}: replay auth status must fail closed`);
  assert.equal(replay[0].database_receipt_handoff_eligible, false, `${label}: replay cannot satisfy handoff preconditions`);
  assert.notEqual(fresh[0].event_id, replay[0].event_id, `${label}: each committed attempt needs a distinct event receipt`);
  return summaries;
}

async function insertFixtures(client, fixture) {
  await client.query("BEGIN");
  try {
    await client.query(`INSERT INTO tenants (id, slug, name, root_key_ct)
      VALUES ($1::uuid, $2, 'SUN atomic PostgreSQL QA', 'not-a-key:synthetic-validation-fixture')`, [
      fixture.tenantId,
      fixture.tenantSlug,
    ]);
    for (const scenario of fixture.scenarios) {
      await client.query(`INSERT INTO batches (
        id, tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config, carrier_profile_code
      ) VALUES (
        $1::uuid, $2::uuid, $3, 'active',
        'not-a-key:synthetic-validation-fixture',
        'not-a-key:synthetic-validation-fixture',
        '{
          "qa_fixture":"sun_atomic_postgres_v2",
          "raw_key_material_present":false,
          "carrier_profile_code":"ntag424_dna_tt",
          "chip_model":"NTAG424_DNA_TT",
          "ttstatus_source":"enc_decrypted",
          "ttstatus_offset":0,
          "ttstatus_length":2
        }'::jsonb,
        'ntag424_dna_tt'
      )`, [scenario.batchId, fixture.tenantId, scenario.bid]);
      await client.query(`INSERT INTO tags (
        id, batch_id, uid_hex, status, lifecycle_state, lifecycle_revision, active_for_claim,
        carrier_profile_code
      ) VALUES ($1::uuid, $2::uuid, $3, 'active', 'active', 0, false, 'ntag424_dna_tt')`, [
        scenario.tagId,
        scenario.batchId,
        scenario.uidHex,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  }
}

async function scenarioState(client, scenario) {
  return (await client.query(`SELECT
    tag.scan_count::integer AS scan_count,
    tag.last_seen_ctr::integer AS last_seen_ctr,
    (SELECT count(*)::integer FROM events event WHERE event.batch_id = $1::uuid) AS event_count
  FROM tags tag
  WHERE tag.id = $2::uuid AND tag.batch_id = $1::uuid`, [scenario.batchId, scenario.tagId])).rows[0] || null;
}

function buildFixture() {
  const runId = randomBytes(8).toString("hex");
  const makeScenario = (name) => ({
    name,
    batchId: randomUUID(),
    tagId: randomUUID(),
    bid: `QA-SUN-${runId}-${name.toUpperCase()}`,
    uidHex: randomBytes(7).toString("hex").toUpperCase(),
  });
  return {
    runId,
    tenantId: randomUUID(),
    tenantSlug: `codex-qa-sun-${runId}`,
    scenarios: [
      makeScenario("same_payload"),
      makeScenario("uid_counter"),
      makeScenario("rollback"),
      ...SUN_TT_STATUS_MAPPINGS.map(({ ttRaw }) => makeScenario(`tt_${ttRaw.toLowerCase()}`)),
      makeScenario("tt_missing_raw"),
      makeScenario("tt_contradictory_raw"),
      makeScenario("tt_force_promotion"),
      makeScenario("tt_force_degradation"),
      makeScenario("tt_cmac_gate"),
      makeScenario("tt_sdm_gate"),
    ],
  };
}

export async function runSunAtomicPostgresQa(env = process.env) {
  const config = readSunAtomicPostgresQaConfig(env);
  const observer = new pg.Client(clientOptions(config, `nexid_sun_qa_observer_${randomBytes(4).toString("hex")}`));
  const fixture = buildFixture();
  await observer.connect();
  try {
    const preflight = await assertSunAtomicPostgresQaTarget(observer, config);
    await insertFixtures(observer, fixture);

    const samePayloadScenario = fixture.scenarios.find((scenario) => scenario.name === "same_payload");
    const samePayload = buildSanitizedSunEnvelope({
      tenantId: fixture.tenantId,
      tenantSlug: fixture.tenantSlug,
      ...samePayloadScenario,
      counter: 101,
      variant: "same",
    });
    const samePayloadRace = await runBlockedConcurrentPair({
      config,
      observer,
      label: "same_payload",
      lock: {
        batchId: samePayloadScenario.batchId,
        identity: `payload:${samePayload.picc_data_hash}:${samePayload.cmac_hash}`,
      },
      firstEnvelope: samePayload,
      secondEnvelope: samePayload,
    });
    const samePayloadReceipts = assertFreshReplayPair(samePayloadRace.receipts, "same_payload");
    const samePayloadState = await scenarioState(observer, samePayloadScenario);
    assert.equal(Number(samePayloadState?.scan_count), 2, "same_payload: both serialized attempts increment the audit counter");
    assert.equal(Number(samePayloadState?.last_seen_ctr), 101, "same_payload: canonical counter must remain 101");
    assert.equal(Number(samePayloadState?.event_count), 2, "same_payload: both attempts must remain auditable");

    const uidCounterScenario = fixture.scenarios.find((scenario) => scenario.name === "uid_counter");
    const uidCounterBase = {
      tenantId: fixture.tenantId,
      tenantSlug: fixture.tenantSlug,
      ...uidCounterScenario,
      counter: 202,
    };
    const uidCounterFirst = buildSanitizedSunEnvelope({ ...uidCounterBase, variant: "payload-a" });
    const uidCounterSecond = buildSanitizedSunEnvelope({ ...uidCounterBase, variant: "payload-b" });
    assert.notEqual(uidCounterFirst.picc_data_hash, uidCounterSecond.picc_data_hash);
    assert.notEqual(uidCounterFirst.cmac_hash, uidCounterSecond.cmac_hash);
    const uidCounterRace = await runBlockedConcurrentPair({
      config,
      observer,
      label: "uid_counter",
      lock: { batchId: uidCounterScenario.batchId, identity: `uid:${uidCounterScenario.uidHex}` },
      firstEnvelope: uidCounterFirst,
      secondEnvelope: uidCounterSecond,
    });
    const uidCounterReceipts = assertFreshReplayPair(uidCounterRace.receipts, "uid_counter");
    const uidCounterState = await scenarioState(observer, uidCounterScenario);
    assert.equal(Number(uidCounterState?.scan_count), 2, "uid_counter: both serialized attempts increment the audit counter");
    assert.equal(Number(uidCounterState?.last_seen_ctr), 202, "uid_counter: canonical counter must remain 202");
    assert.equal(Number(uidCounterState?.event_count), 2, "uid_counter: both attempts must remain auditable");

    const rollbackScenario = fixture.scenarios.find((scenario) => scenario.name === "rollback");
    const rollbackBefore = await scenarioState(observer, rollbackScenario);
    const rollbackEnvelope = {
      ...buildSanitizedSunEnvelope({
        tenantId: fixture.tenantId,
        tenantSlug: fixture.tenantSlug,
        ...rollbackScenario,
        counter: 303,
        variant: "forced-rollback",
      }),
      // The base 0062 function casts IP during event insertion, after the tag
      // update. The invalid inet forces PostgreSQL to roll back the statement.
      ip: "invalid-inet-for-forced-rollback",
    };
    let rollbackSqlState = null;
    await assert.rejects(
      () => invokeAtomicPersistence(observer, rollbackEnvelope),
      (error) => {
        rollbackSqlState = String(error?.code || "");
        return rollbackSqlState === "22P02";
      },
      "rollback fixture must fail at the canonical event insert",
    );
    const rollbackAfter = await scenarioState(observer, rollbackScenario);
    assert.deepEqual(
      { ...rollbackAfter },
      { ...rollbackBefore },
      "failed event insertion must roll back tag counter and event state",
    );

    const exactMappings = [];
    let appendOnlyProbeReceipt = null;
    for (const [index, mapping] of SUN_TT_STATUS_MAPPINGS.entries()) {
      const scenario = fixture.scenarios.find((candidate) => candidate.name === `tt_${mapping.ttRaw.toLowerCase()}`);
      const envelope = buildSanitizedSunEnvelope({
        tenantId: fixture.tenantId,
        tenantSlug: fixture.tenantSlug,
        ...scenario,
        counter: 400 + index,
        variant: `exact-${mapping.ttRaw}`,
        ttRaw: mapping.ttRaw,
        claimedProductState: mapping.productState,
      });
      const validation = await validateCommittedTtScenario(observer, {
        envelope,
        expectedRaw: mapping.ttRaw,
        expectedCanonicalState: mapping.productState,
        expectedBindingStatus: "BOUND",
        expectedBindingReason: "tt_raw_exact_match",
        expectedResult: mapping.productState,
        expectedAuthStatus: mapping.productState,
        expectedEventType: "TAP_VALID",
        expectedVerdict: "valid",
      });
      assert.equal(validation.atomicSummary.database_receipt_handoff_eligible, true);
      exactMappings.push(validation.durableSummary);
      appendOnlyProbeReceipt ||= validation.atomicReceipt;
    }

    const missingRawScenario = fixture.scenarios.find((scenario) => scenario.name === "tt_missing_raw");
    const missingRawEnvelope = buildSanitizedSunEnvelope({
      tenantId: fixture.tenantId,
      tenantSlug: fixture.tenantSlug,
      ...missingRawScenario,
      counter: 501,
      variant: "missing-raw",
      includeTtRaw: false,
      claimedProductState: "VALID_CLOSED",
    });
    const missingRaw = await validateCommittedTtScenario(observer, {
      envelope: missingRawEnvelope,
      expectedRaw: null,
      expectedCanonicalState: null,
      expectedBindingStatus: "REJECTED",
      expectedBindingReason: "tt_raw_missing_or_noncanonical",
      expectedResult: "SUN_PROFILE_MISMATCH",
      expectedAuthStatus: "SUN_PROFILE_MISMATCH",
      expectedEventType: "TAP_INVALID",
      expectedVerdict: "invalid",
    });
    assert.equal(missingRaw.atomicSummary.database_receipt_handoff_eligible, false);

    const contradictionScenario = fixture.scenarios.find((scenario) => scenario.name === "tt_contradictory_raw");
    const contradictionEnvelope = buildSanitizedSunEnvelope({
      tenantId: fixture.tenantId,
      tenantSlug: fixture.tenantSlug,
      ...contradictionScenario,
      counter: 502,
      variant: "contradiction",
      ttRaw: "4343",
      claimedProductState: "VALID_OPENED",
    });
    const contradiction = await validateCommittedTtScenario(observer, {
      envelope: contradictionEnvelope,
      expectedRaw: "4343",
      expectedCanonicalState: "VALID_CLOSED",
      expectedBindingStatus: "REJECTED",
      expectedBindingReason: "tt_product_state_contradiction",
      expectedResult: "SUN_PROFILE_MISMATCH",
      expectedAuthStatus: "SUN_PROFILE_MISMATCH",
      expectedEventType: "TAP_INVALID",
      expectedVerdict: "invalid",
    });
    assert.equal(contradiction.atomicSummary.database_receipt_handoff_eligible, false);

    const forcePromotionScenario = fixture.scenarios.find((scenario) => scenario.name === "tt_force_promotion");
    const forcePromotionEnvelope = buildSanitizedSunEnvelope({
      tenantId: fixture.tenantId,
      tenantSlug: fixture.tenantSlug,
      ...forcePromotionScenario,
      counter: 503,
      variant: "force-promotion",
      ttRaw: "4343",
      claimedProductState: "VALID_CLOSED",
      forceResult: "VALID_OPENED",
    });
    const forcePromotion = await validateCommittedTtScenario(observer, {
      envelope: forcePromotionEnvelope,
      expectedRaw: "4343",
      expectedCanonicalState: "VALID_CLOSED",
      expectedBindingStatus: "REJECTED",
      expectedBindingReason: "tt_force_result_contradiction",
      expectedResult: "SUN_PROFILE_MISMATCH",
      expectedAuthStatus: "SUN_PROFILE_MISMATCH",
      expectedEventType: "TAP_INVALID",
      expectedVerdict: "invalid",
    });
    assert.equal(forcePromotion.atomicSummary.database_receipt_handoff_eligible, false);

    const forceDegradationScenario = fixture.scenarios.find((scenario) => scenario.name === "tt_force_degradation");
    const forceDegradationEnvelope = buildSanitizedSunEnvelope({
      tenantId: fixture.tenantId,
      tenantSlug: fixture.tenantSlug,
      ...forceDegradationScenario,
      counter: 504,
      variant: "force-degradation",
      ttRaw: "4343",
      claimedProductState: "VALID_CLOSED",
      forceResult: "TAMPER_RISK",
    });
    const forceDegradation = await validateCommittedTtScenario(observer, {
      envelope: forceDegradationEnvelope,
      expectedRaw: "4343",
      expectedCanonicalState: "VALID_CLOSED",
      expectedBindingStatus: "BOUND",
      expectedBindingReason: "tt_raw_exact_match",
      expectedResult: "TAMPER_RISK",
      expectedAuthStatus: "VALID_CLOSED",
      expectedEventType: "TAP_INVALID",
      expectedVerdict: "tampered",
    });
    assert.equal(forceDegradation.atomicSummary.database_receipt_handoff_eligible, false);

    const cmacGateScenario = fixture.scenarios.find((scenario) => scenario.name === "tt_cmac_gate");
    const cmacGateEnvelope = buildSanitizedSunEnvelope({
      tenantId: fixture.tenantId,
      tenantSlug: fixture.tenantSlug,
      ...cmacGateScenario,
      counter: 505,
      variant: "cmac-gate",
      cryptographicVerification: false,
    });
    const cmacGate = await validateCommittedTtScenario(observer, {
      envelope: cmacGateEnvelope,
      expectedRaw: "4343",
      expectedCanonicalState: "VALID_CLOSED",
      expectedBindingStatus: "REJECTED",
      expectedBindingReason: "tt_physical_verification_missing",
      expectedResult: "SUN_PROFILE_MISMATCH",
      expectedAuthStatus: "SUN_PROFILE_MISMATCH",
      expectedEventType: "TAP_INVALID",
      expectedVerdict: "invalid",
    });
    assert.equal(cmacGate.atomicSummary.database_receipt_handoff_eligible, false);

    const sdmGateScenario = fixture.scenarios.find((scenario) => scenario.name === "tt_sdm_gate");
    const sdmGateEnvelope = buildSanitizedSunEnvelope({
      tenantId: fixture.tenantId,
      tenantSlug: fixture.tenantSlug,
      ...sdmGateScenario,
      counter: 506,
      variant: "sdm-gate",
      payloadVerified: false,
    });
    const sdmGate = await validateCommittedTtScenario(observer, {
      envelope: sdmGateEnvelope,
      expectedRaw: "4343",
      expectedCanonicalState: "VALID_CLOSED",
      expectedBindingStatus: "REJECTED",
      expectedBindingReason: "tt_physical_verification_missing",
      expectedResult: "SUN_PROFILE_MISMATCH",
      expectedAuthStatus: "SUN_PROFILE_MISMATCH",
      expectedEventType: "TAP_INVALID",
      expectedVerdict: "invalid",
    });
    assert.equal(sdmGate.atomicSummary.database_receipt_handoff_eligible, false);

    const appendOnly = await assertTtTruthReceiptAppendOnly(observer, appendOnlyProbeReceipt);
    const committedCounts = (await observer.query(`SELECT
      (SELECT count(*)::integer FROM public.events WHERE tenant_id = $1::uuid) AS event_count,
      (SELECT count(*)::integer FROM public.sun_tt_truth_receipts WHERE tenant_id = $1::uuid) AS receipt_count`, [
      fixture.tenantId,
    ])).rows[0] || {};
    assert.equal(
      Number(committedCounts.receipt_count),
      Number(committedCounts.event_count),
      "every committed SUN attempt must have exactly one durable TT truth receipt",
    );

    return Object.freeze({
      ok: true,
      validator: "sun_atomic_postgres_tt_truth_v2",
      target: {
        endpoint_id: preflight.endpointId,
        database: preflight.databaseName,
        database_role: preflight.databaseRole,
        safe_target: config.safeTarget,
        postgres_version_number: preflight.postgresVersionNumber,
      },
      migrations: preflight.appliedMigrations,
      evidence: {
        same_payload_two_connections: {
          overlap_observed: samePayloadRace.overlapObserved,
          receipts: samePayloadReceipts,
          committed_event_count: Number(samePayloadState.event_count),
        },
        same_uid_counter_distinct_payloads: {
          overlap_observed: uidCounterRace.overlapObserved,
          receipts: uidCounterReceipts,
          committed_event_count: Number(uidCounterState.event_count),
        },
        forced_rollback_after_tag_update: {
          sqlstate: rollbackSqlState,
          state_unchanged: true,
          event_count: Number(rollbackAfter.event_count),
        },
        tt_status_exact_mappings: exactMappings,
        tt_raw_missing_fails_closed: missingRaw.durableSummary,
        tt_raw_contradiction_fails_closed: contradiction.durableSummary,
        force_result_cannot_promote: forcePromotion.durableSummary,
        force_result_can_only_degrade: forceDegradation.durableSummary,
        cmac_verification_gate_preserved: cmacGate.durableSummary,
        sdm_payload_gate_preserved: sdmGate.durableSummary,
        tt_truth_receipt_append_only: appendOnly,
        committed_event_receipt_bijection: {
          event_count: Number(committedCounts.event_count),
          receipt_count: Number(committedCounts.receipt_count),
        },
      },
      boundaries: {
        database_atomicity: "covered_on_disposable_real_postgresql",
        http_route: "not_covered_direct_function_validation_only",
        fresh_handoff_token_issued: false,
        handoff_observation: "database_receipt_preconditions_only",
        nfc_cmac_sdm_cryptography: "not_revalidated_sanitized_preverified_envelopes",
        physical_nfc_tag_scanned: false,
        raw_key_material_used: false,
        managed_kms_validated: false,
        hsm_validated: false,
        validator_reuse: "forbidden_one_shot_append_only_evidence",
      },
      cleanup: "not_performed_disposable_database_or_branch_deletion_required",
    });
  } finally {
    await observer.end();
  }
}

const invokedPath = typeof process !== "undefined" && process.argv?.[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  let config = null;
  try {
    config = readSunAtomicPostgresQaConfig(process.env);
    const result = await runSunAtomicPostgresQa(process.env);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      validator: "sun_atomic_postgres_tt_truth_v2",
      reason: sanitizeSunAtomicQaFailure(error, config),
    }));
    process.exitCode = 1;
  }
}
