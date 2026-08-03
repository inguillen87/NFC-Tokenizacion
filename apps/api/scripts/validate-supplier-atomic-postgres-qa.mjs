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

const REQUIRED_MIGRATIONS = Object.freeze([
  "20260728143000_0063_supplier_packaging_governance.sql",
  "20260801090000_0075_supplier_production_qa_acceptance.sql",
  "20260802090000_0076_supplier_production_activation_v2.sql",
  "20260802150000_0079_supplier_order_atomic_create.sql",
  "20260802160000_0081_supplier_manifest_atomic_import.sql",
  "20260802220000_0087_packaging_lab_foundation.sql",
  "20260802250000_0090_supplier_carrier_key_scope.sql",
  "20260802260000_0091_supplier_keyless_qa_activation.sql",
  "20260802270000_0092_supplier_carrier_scope_integrity.sql",
]);

const CLAIM_LIMITATIONS = Object.freeze([
  "static_identifiers_can_be_copied",
  "no_cryptographic_tag_authentication",
  "no_anti_replay_guarantee",
  "no_tamper_state_attestation",
  "operator_capture_is_not_physical_presence_attestation",
]);

function sha256(label) {
  return `sha256:${createHash("sha256").update(label).digest("hex")}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalDigest(value) {
  return sha256(canonicalJson(value));
}

function uidFingerprint(bid, uid) {
  const hash = createHash("sha256");
  hash.update(bid, "utf8");
  hash.update(Buffer.from([0]));
  hash.update(uid, "utf8");
  return `sha256:${hash.digest("hex")}`;
}

function clientOptions(config, label) {
  return {
    connectionString: config.databaseUrl,
    application_name: `nexid_supplier_atomic_qa_${label}`,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
    ssl: { rejectUnauthorized: true },
  };
}

function syntheticEnvelope(label) {
  return `nexid-app-envelope-v2.qa-only-not-a-key.${sha256(label).slice(7)}`;
}

function buildSubBatch({
  orderId,
  bid,
  sequenceIndex,
  quantity,
  salt,
  carrierProfileCode = "ntag424_dna",
  invalidBinding = false,
}) {
  const secureSun = carrierProfileCode === "ntag424_dna" || carrierProfileCode === "ntag424_dna_tt";
  const urlTemplate = secureSun
    ? `https://nexid.lat/sun?v=1&bid=${encodeURIComponent(bid)}&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>`
    : `https://nexid.lat/sun?qr=1&carrier=${encodeURIComponent(carrierProfileCode)}&bid=${encodeURIComponent(bid)}&uid=<UID_HEX>`;
  const keyContract = secureSun ? {
    meta_key_ct: syntheticEnvelope(`${salt}:meta`),
    file_key_ct: syntheticEnvelope(`${salt}:file`),
    pair_fingerprint: createHash("sha256").update(`${salt}:pair`).digest("hex").slice(0, 16).toUpperCase(),
    meta_key_fingerprint: createHash("sha256").update(`${salt}:meta-fp`).digest("hex").slice(0, 16).toUpperCase(),
    file_key_fingerprint: createHash("sha256").update(`${salt}:file-fp`).digest("hex").slice(0, 16).toUpperCase(),
  } : {};
  return {
    bid,
    sequence_index: sequenceIndex,
    expected_quantity: quantity,
    ...keyContract,
    key_material_mode: secureSun ? "secure_sun" : "none",
    url_template: urlTemplate,
    sdm_config: {
      supplier_order_id: orderId,
      supplier_sequence_index: invalidBinding ? sequenceIndex + 100 : sequenceIndex,
      carrier_profile_code: carrierProfileCode,
      requested_quantity: quantity,
      url_template: urlTemplate,
      ...(secureSun ? { key_version: 1 } : {}),
      key_material_mode: secureSun ? "secure_sun" : "none",
      raw_key_material_present: false,
    },
  };
}

function buildOrderInput({
  tenantId,
  actorId,
  authSessionId,
  orderId,
  bids,
  salt,
  carrierProfileCode = "ntag424_dna",
  packPurpose = "trial_integration",
  invalidSecondBinding = false,
}) {
  const subBatches = bids.map((bid, index) => buildSubBatch({
    orderId,
    bid,
    sequenceIndex: index + 1,
    quantity: 1,
    salt: `${salt}:${index + 1}`,
    carrierProfileCode,
    invalidBinding: invalidSecondBinding && index === 1,
  }));
  return {
    supplier_order_id: orderId,
    tenant_id: tenantId,
    actor_id: actorId,
    auth_session_id: authSessionId,
    customer_slug: `qa-${salt}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 63),
    order_name: `Supplier atomic QA ${salt}`,
    base_batch_id: `QA-${salt}`.toUpperCase().replace(/[^A-Z0-9._:-]/g, "-"),
    total_quantity: subBatches.length,
    sub_batch_size: 1,
    chip_model: carrierProfileCode === "qr_basic" ? "Static QR" : "NTAG 424 DNA",
    carrier_profile_code: carrierProfileCode,
    pack_purpose: packPurpose,
    material_type: "synthetic PostgreSQL QA fixture",
    notes: "Disposable validation only; no physical tags or raw keys.",
    request_id: `qa:${salt}`,
    user_agent: "nexid-supplier-atomic-postgres-qa/1",
    sub_batches: subBatches,
  };
}

async function createOrder(client, input) {
  const rows = (await client.query(
    "SELECT * FROM public.nexid_create_supplier_order_v2($1::jsonb)",
    [JSON.stringify(input)],
  )).rows;
  assert.equal(rows.length, 1, "supplier order writer must return one receipt");
  assert.equal(String(rows[0].supplier_order?.id), input.supplier_order_id);
  assert.equal(rows[0].sub_batches?.length, input.sub_batches.length);
  return rows[0];
}

function buildManifestInput({
  tenantId,
  actorId,
  authSessionId,
  receipt,
  uid,
  salt,
  carrierProfileCode = "ntag424_dna",
  rowCarrierProfileCode = carrierProfileCode,
  includeSunPayload = carrierProfileCode === "ntag424_dna" || carrierProfileCode === "ntag424_dna_tt",
}) {
  const subBatch = receipt.sub_batches[0];
  const order = receipt.supplier_order;
  const sunPayload = includeSunPayload ? {
    sun_payload: {
      raw_url_hash: sha256(`${salt}:url`),
      picc_data_hash: sha256(`${salt}:picc`),
      enc_hash: sha256(`${salt}:enc`),
      cmac_hash: sha256(`${salt}:cmac`),
    },
  } : {};
  return {
    tenant_id: tenantId,
    batch_id: subBatch.batch_id,
    bid: subBatch.bid,
    carrier_profile_code: carrierProfileCode,
    manifest_type: "csv",
    content_hash: sha256(`${salt}:manifest`),
    activate_imported: false,
    supplier_order_id: order.id,
    supplier_sub_batch_id: subBatch.id,
    expected_quantity: 1,
    quantity_override: null,
    actor_id: actorId,
    auth_session_id: authSessionId,
    request_id: `qa:${salt}:manifest`,
    user_agent: "nexid-supplier-atomic-postgres-qa/1",
    rows: [{
      uid_hex: uid,
      carrier_profile_code: rowCarrierProfileCode,
      profile: null,
      ...sunPayload,
    }],
  };
}

async function importManifest(client, input, expectedSunPayloadCount = 1) {
  const rows = (await client.query(
    "SELECT * FROM public.nexid_import_tag_manifest_v2($1::jsonb)",
    [JSON.stringify(input)],
  )).rows;
  assert.equal(rows.length, 1, "manifest writer must return one receipt");
  assert.equal(Number(rows[0].inserted_count), 1);
  assert.equal(Number(rows[0].registered_sun_payload_count), expectedSunPayloadCount);
  return rows[0];
}

function settle(promise) {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );
}

async function assertSupplierCapabilities(client) {
  const row = (await client.query(`SELECT
    to_regprocedure('public.nexid_create_supplier_order_v2(jsonb)') IS NOT NULL AS order_writer,
    to_regprocedure('public.nexid_import_tag_manifest_v2(jsonb)') IS NOT NULL AS manifest_writer,
    to_regprocedure('public.nexid_commit_supplier_carrier_qa_v1(jsonb)') IS NOT NULL AS keyless_qa_writer,
    to_regprocedure('public.nexid_supplier_keyless_production_activation_receipt_v1(uuid)') IS NOT NULL AS keyless_activation_receipt,
    to_regprocedure('public.nexid_activate_supplier_tags_v2(jsonb)') IS NOT NULL AS production_activation_writer,
    to_regprocedure('public.nexid_supplier_keyless_qa_activation_v1_capability()') IS NOT NULL AS keyless_capability,
    to_regprocedure('public.nexid_supplier_carrier_scope_integrity_v1_capability()') IS NOT NULL AS carrier_scope_capability,
    to_regprocedure('public.nexid_create_packaging_lab_project_v1(jsonb)') IS NOT NULL AS packaging_lab_writer,
    to_regprocedure('public.nexid_decide_packaging_lab_project_v1(jsonb)') IS NOT NULL AS packaging_lab_decision_writer,
    to_regclass('public.supplier_keyless_production_qa_acceptance_receipts') IS NOT NULL AS keyless_acceptance_table,
    to_regclass('public.uq_tags_uid_hex_global') IS NOT NULL AS global_uid_index,
    COALESCE((SELECT array_agg(id ORDER BY id) FROM schema_migrations WHERE id = ANY($1::text[])), ARRAY[]::text[]) AS migrations,
    (SELECT count(*)::integer FROM users) AS users,
    (SELECT count(*)::integer FROM supplier_orders) AS orders,
    (SELECT count(*)::integer FROM supplier_sub_batches) AS sub_batches,
    (SELECT count(*)::integer FROM tenant_manifests) AS manifests`, [REQUIRED_MIGRATIONS])).rows[0] || {};
  assert.equal(row.order_writer, true);
  assert.equal(row.manifest_writer, true);
  assert.equal(row.keyless_qa_writer, true);
  assert.equal(row.keyless_activation_receipt, true);
  assert.equal(row.production_activation_writer, true);
  assert.equal(row.keyless_capability, true);
  assert.equal(row.carrier_scope_capability, true);
  assert.equal(row.packaging_lab_writer, true);
  assert.equal(row.packaging_lab_decision_writer, true);
  assert.equal(row.keyless_acceptance_table, true);
  assert.equal(row.global_uid_index, true);
  const appliedMigrations = Array.from(row.migrations || [], String);
  assert.equal(appliedMigrations.length, REQUIRED_MIGRATIONS.length);
  for (let index = 0; index < REQUIRED_MIGRATIONS.length; index += 1) {
    assert.equal(appliedMigrations[index], REQUIRED_MIGRATIONS[index]);
  }
  assert.equal(Number(row.users) + Number(row.orders) + Number(row.sub_batches) + Number(row.manifests), 0);
}

async function insertIdentityFixtures(client, fixture) {
  await client.query("BEGIN");
  try {
    await client.query(`INSERT INTO users (id, email, full_name, admin_status)
      VALUES ($1::uuid, $2, 'Supplier atomic PostgreSQL QA', 'active')`, [fixture.actorId, fixture.actorEmail]);
    for (const tenant of fixture.tenants) {
      await client.query(`INSERT INTO tenants (id, slug, name, root_key_ct)
        VALUES ($1::uuid, $2, $3, 'not-a-key:synthetic-validation-fixture')`, [tenant.id, tenant.slug, tenant.name]);
    }
    await client.query(`INSERT INTO carrier_profiles (
        code, label, family, security_level, cost_band, capabilities
      ) VALUES (
        'qr_basic', 'QR basic disposable QA fixture', 'qr', 1, 'entry',
        '{
          "technology":"QR",
          "cryptographic_authentication":false,
          "supports_dynamic_uid":false,
          "supports_read_counter":false,
          "supports_cmac":false,
          "supports_replay_detection":false,
          "supports_tamper":false,
          "supports_bulk_read":false,
          "requires_reader":false,
          "requires_batch_keys":false,
          "tamper_evidence_mode":"none",
          "identity_assurance":"declared_identity"
        }'::jsonb
      )`);
    await client.query(`INSERT INTO memberships (id, user_id, tenant_id, role)
      VALUES ($1::uuid, $2::uuid, NULL, 'super_admin')`, [randomUUID(), fixture.actorId]);
    await client.query(`INSERT INTO memberships (id, user_id, tenant_id, role)
      VALUES ($1::uuid, $2::uuid, $3::uuid, 'tenant_admin')`, [
      randomUUID(), fixture.actorId, fixture.tenants[0].id,
    ]);
    await client.query(`INSERT INTO auth_sessions (
        id, user_id, session_token_hash, role, tenant_id, permissions,
        mfa_verified, expires_at, meta
      ) VALUES (
        $1::uuid, $2::uuid, $3, 'super_admin', NULL, '["*"]'::jsonb,
        true, now() + interval '30 minutes', '{"qa_fixture":"supplier_atomic_postgres_v1"}'::jsonb
      )`, [fixture.authSessionId, fixture.actorId, sha256(`${fixture.runId}:session`)]);
    for (const tenantActor of fixture.tenantActors) {
      await client.query(`INSERT INTO users (id, email, full_name, admin_status)
        VALUES ($1::uuid, $2, $3, 'active')`, [
        tenantActor.id, tenantActor.email, tenantActor.name,
      ]);
      await client.query(`INSERT INTO memberships (id, user_id, tenant_id, role)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'tenant_admin')`, [
        randomUUID(), tenantActor.id, tenantActor.tenantId,
      ]);
      await client.query(`INSERT INTO auth_sessions (
          id, user_id, session_token_hash, role, tenant_id, permissions,
          mfa_verified, expires_at, meta
        ) VALUES (
          $1::uuid, $2::uuid, $3, 'tenant_admin', $4::uuid,
          '["qa.approve","packaging_lab.manage"]'::jsonb,
          true, now() + interval '30 minutes',
          '{"qa_fixture":"supplier_atomic_postgres_v2"}'::jsonb
        )`, [
        tenantActor.authSessionId,
        tenantActor.id,
        sha256(`${fixture.runId}:${tenantActor.id}:session`),
        tenantActor.tenantId,
      ]);
      await client.query(`INSERT INTO resource_permissions (
          id, user_id, tenant_id, resource, action, effect
        ) VALUES
          ($1::uuid, $2::uuid, $4::uuid, 'supplier', 'qa_approve', 'allow'),
          ($3::uuid, $2::uuid, $4::uuid, 'supplier', 'production_qa_plan:approve', 'allow')`, [
        randomUUID(), tenantActor.id, randomUUID(), tenantActor.tenantId,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  }
}

async function verifyMidFunctionRollback(client, fixture) {
  const orderId = randomUUID();
  const bids = [`QA-${fixture.runId}-RB-A`, `QA-${fixture.runId}-RB-B`];
  const input = buildOrderInput({
    tenantId: fixture.tenants[0].id,
    actorId: fixture.actorId,
    authSessionId: fixture.authSessionId,
    orderId,
    bids,
    salt: `${fixture.runId}-rollback`,
    invalidSecondBinding: true,
  });
  await assert.rejects(
    () => createOrder(client, input),
    /supplier_order_sdm_binding_invalid/,
  );
  const counts = (await client.query(`SELECT
    (SELECT count(*)::integer FROM supplier_orders WHERE id = $1::uuid) AS orders,
    (SELECT count(*)::integer FROM batches WHERE upper(bid) = ANY($2::text[])) AS batches,
    (SELECT count(*)::integer FROM supplier_sub_batches WHERE upper(bid) = ANY($2::text[])) AS sub_batches,
    (SELECT count(*)::integer FROM batch_key_material WHERE upper(bid) = ANY($2::text[])) AS key_material,
    (SELECT count(*)::integer FROM audit_logs WHERE resource_id = $1::text) AS audits`, [orderId, bids])).rows[0];
  assert.deepEqual(Object.values(counts).map(Number), [0, 0, 0, 0, 0]);
  return Object.freeze({ first_sub_batch_rolled_back: true, order_graph_rows_after_failure: 0 });
}

async function verifyConcurrentBidOwnership(config, observer, fixture) {
  const bid = `QA-${fixture.runId}-RACE`;
  const inputs = fixture.tenants.map((tenant, index) => buildOrderInput({
    tenantId: tenant.id,
    actorId: fixture.actorId,
    authSessionId: fixture.authSessionId,
    orderId: randomUUID(),
    bids: [bid],
    salt: `${fixture.runId}-race-${index + 1}`,
  }));
  const clients = [
    new pg.Client(clientOptions(config, `${fixture.runId}_bid_a`)),
    new pg.Client(clientOptions(config, `${fixture.runId}_bid_b`)),
  ];
  await Promise.all(clients.map((client) => client.connect()));
  try {
    const outcomes = await Promise.all(inputs.map((input, index) => settle(createOrder(clients[index], input))));
    const successes = outcomes.filter((entry) => entry.ok);
    const conflicts = outcomes.filter((entry) => !entry.ok && /supplier_order_bid_already_exists/.test(String(entry.error?.message || "")));
    assert.equal(successes.length, 1);
    assert.equal(conflicts.length, 1);
    const counts = (await observer.query(`SELECT
      (SELECT count(*)::integer FROM batches WHERE upper(bid) = $1) AS batches,
      (SELECT count(*)::integer FROM supplier_sub_batches WHERE upper(bid) = $1) AS sub_batches,
      (SELECT count(*)::integer FROM batch_keys WHERE upper(bid) = $1) AS key_pairs,
      (SELECT count(*)::integer FROM batch_key_material WHERE upper(bid) = $1) AS lifecycle_keys`, [bid])).rows[0];
    assert.deepEqual(Object.values(counts).map(Number), [1, 1, 1, 2]);
    return Object.freeze({
      concurrent_attempts: 2,
      committed_order_graphs: 1,
      conflicting_order_graphs: 1,
      winning_bid: bid,
    });
  } finally {
    await Promise.allSettled(clients.map((client) => client.end()));
  }
}

async function verifyConcurrentGlobalUid(config, observer, fixture) {
  const receipts = [];
  for (let index = 0; index < fixture.tenants.length; index += 1) {
    const tenant = fixture.tenants[index];
    receipts.push(await createOrder(observer, buildOrderInput({
      tenantId: tenant.id,
      actorId: fixture.actorId,
      authSessionId: fixture.authSessionId,
      orderId: randomUUID(),
      bids: [`QA-${fixture.runId}-MF-${index + 1}`],
      salt: `${fixture.runId}-manifest-order-${index + 1}`,
    })));
  }
  const uid = "04AABBCCDDEE11";
  const inputs = fixture.tenants.map((tenant, index) => buildManifestInput({
    tenantId: tenant.id,
    actorId: fixture.actorId,
    authSessionId: fixture.authSessionId,
    receipt: receipts[index],
    uid,
    salt: `${fixture.runId}-manifest-${index + 1}`,
  }));
  const clients = [
    new pg.Client(clientOptions(config, `${fixture.runId}_manifest_a`)),
    new pg.Client(clientOptions(config, `${fixture.runId}_manifest_b`)),
  ];
  await Promise.all(clients.map((client) => client.connect()));
  try {
    const outcomes = await Promise.all(inputs.map((input, index) => settle(importManifest(clients[index], input))));
    const successes = outcomes.filter((entry) => entry.ok);
    const conflicts = outcomes.filter((entry) => !entry.ok && /supplier_manifest_global_uid_duplicate/.test(String(entry.error?.message || "")));
    assert.equal(successes.length, 1);
    assert.equal(conflicts.length, 1);
    const counts = (await observer.query(`SELECT
      (SELECT count(*)::integer FROM tags WHERE upper(trim(uid_hex)) = $1) AS tags,
      (SELECT count(*)::integer FROM tenant_manifests WHERE content_hash = ANY($2::text[])) AS manifests,
      (SELECT count(*)::integer FROM tag_sun_payloads WHERE upper(trim(uid_hex)) = $1) AS sun_payloads,
      (SELECT count(*)::integer FROM batches WHERE id = ANY($3::uuid[]) AND manifest_status = 'imported') AS imported_batches,
      (SELECT count(*)::integer FROM supplier_sub_batches WHERE id = ANY($4::uuid[]) AND manifest_status = 'imported') AS imported_sub_batches`, [
      uid,
      inputs.map((input) => input.content_hash),
      inputs.map((input) => input.batch_id),
      inputs.map((input) => input.supplier_sub_batch_id),
    ])).rows[0];
    assert.deepEqual(Object.values(counts).map(Number), [1, 1, 1, 1, 1]);
    return Object.freeze({ concurrent_attempts: 2, globally_owned_uids: 1, committed_manifests: 1, conflicting_manifests: 1 });
  } finally {
    await Promise.allSettled(clients.map((client) => client.end()));
  }
}

async function verifyKeylessManifestRules(client, fixture, receipt) {
  const tenant = fixture.tenants[0];
  const actor = fixture.tenantActors[0];
  const base = {
    tenantId: tenant.id,
    actorId: actor.id,
    authSessionId: actor.authSessionId,
    receipt,
    uid: "04DDEEFF001122",
  };
  const wrongTopLevelCarrier = buildManifestInput({
    ...base,
    salt: `${fixture.runId}-keyless-manifest-top-level-carrier`,
    carrierProfileCode: "ntag213",
    rowCarrierProfileCode: "ntag213",
    includeSunPayload: false,
  });
  await assert.rejects(
    () => importManifest(client, wrongTopLevelCarrier, 0),
    /supplier_manifest_carrier_mismatch/,
  );
  const wrongRowCarrier = buildManifestInput({
    ...base,
    salt: `${fixture.runId}-keyless-manifest-row-carrier`,
    carrierProfileCode: "qr_basic",
    rowCarrierProfileCode: "ntag213",
    includeSunPayload: false,
  });
  await assert.rejects(
    () => importManifest(client, wrongRowCarrier, 0),
    /supplier_manifest_carrier_mismatch/,
  );
  const forbiddenSunPayload = buildManifestInput({
    ...base,
    salt: `${fixture.runId}-keyless-manifest-sun`,
    carrierProfileCode: "qr_basic",
    includeSunPayload: true,
  });
  await assert.rejects(
    () => importManifest(client, forbiddenSunPayload, 0),
    /supplier_manifest_row_invalid/,
  );

  const subBatch = receipt.sub_batches[0];
  const before = (await client.query(`SELECT
    (SELECT count(*)::integer FROM tags WHERE batch_id = $1::uuid) AS tags,
    (SELECT count(*)::integer FROM tenant_manifests WHERE batch_id = $1::uuid) AS manifests,
    (SELECT count(*)::integer FROM tag_sun_payloads payload
      JOIN tags tag ON tag.id = payload.tag_id WHERE tag.batch_id = $1::uuid) AS sun_payloads`, [
    subBatch.batch_id,
  ])).rows[0];
  assert.deepEqual(Object.values(before).map(Number), [0, 0, 0]);

  const valid = buildManifestInput({
    ...base,
    salt: `${fixture.runId}-keyless-manifest-valid`,
    carrierProfileCode: "qr_basic",
    includeSunPayload: false,
  });
  const manifestReceipt = await importManifest(client, valid, 0);
  const after = (await client.query(`SELECT
    (SELECT count(*)::integer FROM tags WHERE batch_id = $1::uuid) AS tags,
    (SELECT count(*)::integer FROM tenant_manifests WHERE batch_id = $1::uuid) AS manifests,
    (SELECT count(*)::integer FROM tag_sun_payloads payload
      JOIN tags tag ON tag.id = payload.tag_id WHERE tag.batch_id = $1::uuid) AS sun_payloads,
    (SELECT lower(carrier_profile_code) FROM tags WHERE batch_id = $1::uuid LIMIT 1) AS tag_carrier`, [
    subBatch.batch_id,
  ])).rows[0];
  assert.deepEqual([Number(after.tags), Number(after.manifests), Number(after.sun_payloads)], [1, 1, 0]);
  assert.equal(after.tag_carrier, "qr_basic");
  return Object.freeze({
    authoritative_carrier_mismatches_rejected: 2,
    keyless_sun_payloads_rejected: 1,
    committed_tags: 1,
    registered_sun_payloads: 0,
    manifest_hash: valid.content_hash,
    manifest_id: String(manifestReceipt.manifest_id),
  });
}

async function verifyCarrierKeyScope(client, fixture, secureBid, keylessReceipt) {
  const keyless = keylessReceipt.sub_batches[0];
  const keylessOrder = keylessReceipt.supplier_order;
  const syntheticPair = createHash("sha256")
    .update(`${fixture.runId}:forbidden-keyless-pair`)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  await assert.rejects(
    () => client.query(`INSERT INTO batch_keys (
      tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
      meta_key_ct, file_key_ct, key_fingerprint, key_version, created_by
    ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, 1, $9)`, [
      fixture.tenants[0].id,
      keylessOrder.id,
      keyless.id,
      keyless.batch_id,
      keyless.bid,
      syntheticEnvelope(`${fixture.runId}:forbidden-keyless-meta`),
      syntheticEnvelope(`${fixture.runId}:forbidden-keyless-file`),
      syntheticPair,
      fixture.actorEmail,
    ]),
    /supplier_batch_key_carrier_scope_forbidden/,
  );
  await assert.rejects(
    () => client.query(`INSERT INTO batch_key_material (
      tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
      key_role, key_version, encrypted_key_ct, key_fingerprint, status,
      created_by, metadata_json
    ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
      'K_META_BATCH', 1, $6, $7, 'active', $8,
      '{"qa_fixture":"forbidden_keyless_material"}'::jsonb)`, [
      fixture.tenants[0].id,
      keylessOrder.id,
      keyless.id,
      keyless.batch_id,
      keyless.bid,
      syntheticEnvelope(`${fixture.runId}:forbidden-keyless-material`),
      syntheticPair,
      fixture.actorEmail,
    ]),
    /supplier_batch_key_carrier_scope_forbidden/,
  );

  const secure = (await client.query(`SELECT
      key_row.id AS key_id,
      material.id AS material_id,
      key_row.supplier_order_id,
      key_row.supplier_sub_batch_id,
      key_row.batch_id,
      upper(key_row.bid) AS bid
    FROM batch_keys key_row
    JOIN batch_key_material material
      ON material.tenant_id = key_row.tenant_id
     AND material.supplier_order_id = key_row.supplier_order_id
     AND material.supplier_sub_batch_id = key_row.supplier_sub_batch_id
     AND material.batch_id = key_row.batch_id
     AND upper(material.bid) = upper(key_row.bid)
    WHERE upper(key_row.bid) = $1
    ORDER BY material.key_role
    LIMIT 1`, [secureBid])).rows[0];
  assert.ok(secure?.key_id && secure?.material_id, "secure SUN fixture must retain its exact key scope");
  await assert.rejects(
    () => client.query("UPDATE batch_keys SET supplier_order_id = NULL WHERE id = $1::uuid", [secure.key_id]),
    /supplier_batch_key_scope_incomplete/,
  );
  await assert.rejects(
    () => client.query("UPDATE batch_keys SET bid = $2 WHERE id = $1::uuid", [secure.key_id, keyless.bid]),
    /supplier_batch_key_scope_invalid/,
  );
  await assert.rejects(
    () => client.query("UPDATE batch_key_material SET supplier_order_id = $2::uuid WHERE id = $1::uuid", [
      secure.material_id,
      keylessOrder.id,
    ]),
    /supplier_batch_key_scope_invalid/,
  );
  const post = (await client.query(`SELECT
    (SELECT count(*)::integer FROM batch_keys WHERE batch_id = $1::uuid) AS keyless_keys,
    (SELECT count(*)::integer FROM batch_key_material WHERE batch_id = $1::uuid) AS keyless_material,
    (SELECT count(*)::integer FROM batch_keys WHERE id = $2::uuid
      AND supplier_order_id = $3::uuid AND supplier_sub_batch_id = $4::uuid
      AND batch_id = $5::uuid AND upper(bid) = $6) AS secure_key_unchanged,
    (SELECT count(*)::integer FROM batch_key_material WHERE id = $7::uuid
      AND supplier_order_id = $3::uuid AND supplier_sub_batch_id = $4::uuid
      AND batch_id = $5::uuid AND upper(bid) = $6) AS secure_material_unchanged`, [
    keyless.batch_id,
    secure.key_id,
    secure.supplier_order_id,
    secure.supplier_sub_batch_id,
    secure.batch_id,
    secure.bid,
    secure.material_id,
  ])).rows[0];
  assert.deepEqual(Object.values(post).map(Number), [0, 0, 1, 1]);
  return Object.freeze({
    keyless_key_rows_rejected: 2,
    null_identity_bypasses_rejected: 1,
    cross_scope_mutations_rejected: 2,
    secure_sun_key_scope_unchanged: true,
  });
}

async function stageKeylessSupplierPack(client, fixture, receipt, manifestHash) {
  const subBatch = receipt.sub_batches[0];
  const order = receipt.supplier_order;
  const manifestTemplateHash = sha256(`${fixture.runId}:keyless-manifest-template`);
  await client.query("BEGIN");
  try {
    const updated = await client.query(`UPDATE supplier_sub_batches
      SET key_export_count = 1,
          key_exported_at = now(),
          metadata_json = metadata_json || jsonb_build_object(
            'supplier_pack_export_count', 1,
            'key_material_mode', 'none',
            'software_envelope', false,
            'managed_kms', false,
            'hsm_backed', false
          ),
          updated_at = now()
      WHERE id = $1::uuid AND tenant_id = $2::uuid AND supplier_order_id = $3::uuid
      RETURNING id`, [subBatch.id, fixture.tenants[0].id, order.id]);
    assert.equal(updated.rowCount, 1);
    await client.query(`INSERT INTO vault_artifacts (
        tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type,
        resource_id, artifact_type, content_hash, mime_type, metadata_json
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'supplier_sub_batch', $3::text,
        'supplier_manifest_template_csv', $4, 'text/csv',
        jsonb_build_object(
          'key_material_mode', 'none',
          'software_envelope', false,
          'managed_kms', false,
          'hsm_backed', false,
          'qa_fixture', true
        )
      )`, [fixture.tenants[0].id, order.id, subBatch.id, manifestTemplateHash]);
    await client.query(`INSERT INTO evidence_events (
        tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash
      ) VALUES (
        $1::uuid, 'supplier_sub_batch', $2::text, 'supplier_pack_exported',
        jsonb_build_object(
          'schema_version', 'supplier-pack-export/qa-v1',
          'manifest_template_sha256', $3::text,
          'imported_manifest_sha256', $4::text,
          'key_material_mode', 'none',
          'software_envelope', false,
          'managed_kms', false,
          'hsm_backed', false,
          'activation_allowed', false
        ), $5
      )`, [
      fixture.tenants[0].id,
      subBatch.id,
      manifestTemplateHash,
      manifestHash,
      sha256(`${fixture.runId}:keyless-pack-event`),
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  }
  return Object.freeze({ manifest_template_hash: manifestTemplateHash });
}

async function recordPackagingGovernanceDecision(client, input) {
  const rows = (await client.query(
    "SELECT * FROM public.nexid_record_supplier_packaging_decision_v1($1::jsonb)",
    [JSON.stringify(input)],
  )).rows;
  assert.equal(rows.length, 1);
  return rows[0];
}

async function approvePackagingGovernance(client, fixture, receipt) {
  const order = receipt.supplier_order;
  const specSnapshot = {
    schema_version: "supplier-packaging-spec/qa-v1",
    carrier_profile_code: "qr_basic",
    packaging_type: "other",
    assurance_model: "declared_identity",
  };
  const specHash = canonicalDigest(specSnapshot);
  const evidenceRefs = {
    rf_sample: [`evidence:qa-synthetic-${fixture.runId.toLowerCase()}-rf`],
    line_trial: [`evidence:qa-synthetic-${fixture.runId.toLowerCase()}-line`],
    adhesive: [`evidence:qa-synthetic-${fixture.runId.toLowerCase()}-adhesive`],
    artwork_dieline: [`evidence:qa-synthetic-${fixture.runId.toLowerCase()}-artwork`],
    encoding_readback: [`evidence:qa-synthetic-${fixture.runId.toLowerCase()}-readback`],
  };
  const validationSnapshot = {
    validator: "validateSupplierPackagingSpec",
    validatorVersion: "1",
    ok: true,
    productionReady: true,
    fixture_only: true,
  };
  const common = {
    supplier_order_id: order.id,
    tenant_id: fixture.tenants[0].id,
    carrier_profile_code: "qr_basic",
    spec_snapshot: specSnapshot,
    spec_hash: specHash,
    evidence_refs: evidenceRefs,
    validation_snapshot: validationSnapshot,
    decision_reason: null,
    single_operator_override: false,
    override_reason: null,
  };
  await recordPackagingGovernanceDecision(client, {
    ...common,
    spec_revision: 1,
    previous_revision: 0,
    previous_status: "legacy_unverified",
    decision_status: "draft",
    decided_by: fixture.actorEmail,
  });
  await recordPackagingGovernanceDecision(client, {
    ...common,
    spec_revision: 2,
    previous_revision: 1,
    previous_status: "draft",
    decision_status: "submitted",
    decided_by: fixture.actorEmail,
  });
  const approved = await recordPackagingGovernanceDecision(client, {
    ...common,
    spec_revision: 3,
    previous_revision: 2,
    previous_status: "submitted",
    decision_status: "approved",
    decided_by: fixture.tenantActors[0].email,
  });
  assert.equal(approved.decision_status, "approved");
  return Object.freeze({ specHash, specRevision: 3 });
}

async function createApprovedPackagingLab(client, fixture, receipt, governance) {
  const order = receipt.supplier_order;
  const tests = [
    ["substrate_identification", "MATERIAL", "Synthetic substrate identity"],
    ["custom_rf_validation", "RF", "Synthetic QR readability"],
    ["mobile_device_matrix", "UX", "Synthetic device compatibility"],
  ].map(([code, category, name], index) => ({
    sequence: index + 1,
    code,
    category,
    name,
    method: "Disposable PostgreSQL fixture; validates relational gates only.",
    target: "PASS is required for the synthetic contract fixture.",
    required: true,
    waiverAllowed: false,
  }));
  const createInput = {
    tenant_id: fixture.tenants[0].id,
    supplier_order_id: order.id,
    actor_id: fixture.actorId,
    auth_session_id: fixture.authSessionId,
    operation_key: `qa:${fixture.runId}:lab-create`,
    carrier_profile_code: "qr_basic",
    approved_packaging_revision: governance.specRevision,
    approved_packaging_hash: governance.specHash,
    carrier_spec_id: null,
    placement_id: null,
    carrier_spec: {
      name: `QA QR carrier ${fixture.runId}`,
      delivery_format: "white_label",
      target_substrates: ["synthetic-disposable-fixture"],
      forbidden_conditions: [],
      operating_temperature: {},
      humidity_test_required: false,
      chemical_test_required: false,
      abrasion_test_required: false,
      notes: "Database contract fixture only; no physical qualification claim.",
    },
    product_id: `qa-product-${fixture.runId.toLowerCase()}`,
    sku: null,
    packaging_type: "other",
    placement_zone: "Synthetic flat test surface",
    placement_image_url: null,
    crosses_opening: false,
    requires_tail_break: false,
    objective: "Validate fail-closed Packaging Lab activation bindings in disposable PostgreSQL.",
    owner_user_id: fixture.actorId,
    template_code: "custom",
    template_tests: tests,
  };
  const project = (await client.query(
    "SELECT * FROM public.nexid_create_packaging_lab_project_v1($1::jsonb)",
    [JSON.stringify(createInput)],
  )).rows[0];
  assert.equal(project.status, "DRAFT");
  assert.equal(Number(project.test_count), tests.length);
  const cases = (await client.query(`SELECT id, code, version
    FROM packaging_lab_test_cases
    WHERE project_id = $1::uuid ORDER BY sequence`, [project.project_id])).rows;
  assert.equal(cases.length, tests.length);
  for (const testCase of cases) {
    const result = (await client.query(
      "SELECT * FROM public.nexid_record_packaging_lab_test_v1($1::jsonb)",
      [JSON.stringify({
        tenant_id: fixture.tenants[0].id,
        project_id: project.project_id,
        test_case_id: testCase.id,
        actor_id: fixture.actorId,
        auth_session_id: fixture.authSessionId,
        expected_version: Number(testCase.version),
        status: "PASS",
        result: "Synthetic database contract fixture passed; not physical evidence.",
        evidence_urls: [`evidence:qa-synthetic-${fixture.runId.toLowerCase()}-${testCase.code}`],
        request_id: `qa:${fixture.runId}:lab-test:${testCase.code}`,
      })],
    )).rows[0];
    assert.equal(result.status, "PASS");
  }
  const approver = fixture.tenantActors[0];
  const approval = (await client.query(
    "SELECT * FROM public.nexid_decide_packaging_lab_project_v1($1::jsonb)",
    [JSON.stringify({
      tenant_id: fixture.tenants[0].id,
      project_id: project.project_id,
      actor_id: approver.id,
      auth_session_id: approver.authSessionId,
      operation_key: `qa:${fixture.runId}:lab-approve`,
      decision: "APPROVE",
      reason: null,
      recommendation: "Synthetic PostgreSQL gate fixture only.",
      override: false,
      override_reason: null,
      request_id: `qa:${fixture.runId}:lab-approve`,
    })],
  )).rows[0];
  assert.equal(approval.decision, "APPROVE");
  assert.match(String(approval.receipt_digest), /^sha256:[0-9a-f]{64}$/);
  return Object.freeze({
    projectId: String(project.project_id),
    approvalId: String(approval.approval_id),
    receiptDigest: String(approval.receipt_digest),
    syntheticTestCount: tests.length,
  });
}

async function createApprovedProductionPlan(client, fixture, receipt) {
  const order = receipt.supplier_order;
  const subBatch = receipt.sub_batches[0];
  const planId = randomUUID();
  const planBinding = {
    schema_version: "supplier-production-qa-plan/v1",
    tenant_id: fixture.tenants[0].id.toLowerCase(),
    supplier_order_id: String(order.id).toLowerCase(),
    supplier_sub_batch_id: String(subBatch.id).toLowerCase(),
    batch_id: String(subBatch.batch_id).toLowerCase(),
    bid: String(subBatch.bid).toUpperCase(),
    revision: 1,
    lot_size: 1,
    inspection_level: "QA_DISPOSABLE_FIXTURE",
    target_aql: 1,
    sample_size: 1,
    accept_number: 0,
    reject_number: 1,
    policy_reference: "qa:disposable:supplier-keyless-v1",
    policy_document_sha256: sha256(`${fixture.runId}:qa-policy`),
    stratification_dimension: "roll_id",
    cryptographic_sample_size: 1,
  };
  const planCanonical = canonicalJson(planBinding);
  const planDigest = sha256(planCanonical);
  const plan = (await client.query(
    "SELECT * FROM public.nexid_submit_supplier_production_qa_plan_v1($1::jsonb)",
    [JSON.stringify({
      plan_id: planId,
      tenant_id: fixture.tenants[0].id,
      supplier_order_id: order.id,
      supplier_sub_batch_id: subBatch.id,
      batch_id: subBatch.batch_id,
      actor_id: fixture.actorId,
      auth_session_id: fixture.authSessionId,
      operation_key: `qa:${fixture.runId}:production-plan`,
      bid: subBatch.bid,
      revision: 1,
      lot_size: 1,
      inspection_level: planBinding.inspection_level,
      target_aql: planBinding.target_aql,
      sample_size: 1,
      accept_number: 0,
      reject_number: 1,
      policy_reference: planBinding.policy_reference,
      policy_document_sha256: planBinding.policy_document_sha256,
      stratification_dimension: "roll_id",
      cryptographic_sample_size: 1,
      schema_version: "supplier-production-qa-plan/v1",
      plan_binding: planBinding,
      plan_canonical: planCanonical,
      plan_digest: planDigest,
      request_id: `qa:${fixture.runId}:production-plan`,
    })],
  )).rows[0];
  assert.equal(String(plan.plan_id), planId);
  const approver = fixture.tenantActors[0];
  const decisionId = randomUUID();
  const decision = (await client.query(
    "SELECT * FROM public.nexid_decide_supplier_production_qa_plan_v1($1::jsonb)",
    [JSON.stringify({
      decision_id: decisionId,
      plan_id: planId,
      tenant_id: fixture.tenants[0].id,
      actor_id: approver.id,
      auth_session_id: approver.authSessionId,
      operation_key: `qa:${fixture.runId}:production-plan-approve`,
      decision_status: "approved",
      reason: "Synthetic disposable PostgreSQL gate fixture approval.",
      approval_evidence_ref: `evidence:qa-synthetic-${fixture.runId.toLowerCase()}-plan`,
      approval_evidence_sha256: sha256(`${fixture.runId}:plan-approval`),
      plan_digest: planDigest,
      request_id: `qa:${fixture.runId}:production-plan-approve`,
    })],
  )).rows[0];
  assert.equal(decision.decision_status, "approved");
  return Object.freeze({ planId, decisionId, planDigest });
}

async function buildKeylessQaInput(client, fixture, receipt, manifest, lab, plan) {
  const order = receipt.supplier_order;
  const subBatch = receipt.sub_batches[0];
  const scope = (await client.query(`SELECT
      lower(tenant.slug) AS tenant_slug,
      lower(sub_batch.status::text) AS supplier_sub_batch_status,
      lower(batch.status::text) AS batch_status,
      lower(sub_batch.manifest_hash) AS manifest_hash,
      batch.sdm_config,
      sub_batch.key_export_count,
      to_char(sub_batch.key_exported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS key_exported_at,
      lower(supplier_order.packaging_governance_status) AS packaging_governance_status,
      supplier_order.packaging_spec_revision,
      lower(supplier_order.packaging_spec_hash) AS packaging_spec_hash,
      tag.id AS tag_id,
      upper(tag.uid_hex) AS uid_hex
    FROM supplier_sub_batches sub_batch
    JOIN supplier_orders supplier_order
      ON supplier_order.id = sub_batch.supplier_order_id
     AND supplier_order.tenant_id = sub_batch.tenant_id
    JOIN tenants tenant ON tenant.id = sub_batch.tenant_id
    JOIN batches batch
      ON batch.id = sub_batch.batch_id
     AND batch.tenant_id = sub_batch.tenant_id
     AND batch.supplier_order_id = sub_batch.supplier_order_id
     AND batch.supplier_sub_batch_id = sub_batch.id
     AND upper(batch.bid) = upper(sub_batch.bid)
    JOIN tags tag ON tag.batch_id = batch.id
    WHERE sub_batch.id = $1::uuid
      AND sub_batch.supplier_order_id = $2::uuid
      AND sub_batch.tenant_id = $3::uuid`, [
    subBatch.id,
    order.id,
    fixture.tenants[0].id,
  ])).rows[0];
  assert.ok(scope?.tag_id, "keyless manifest tag must be bound before QA");
  assert.equal(scope.manifest_hash, manifest.manifest_hash);
  assert.equal(Number(scope.key_export_count), 1);
  assert.match(String(scope.key_exported_at), /^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*Z$/);

  const bid = String(subBatch.bid).toUpperCase();
  const carrierProfileCode = "qr_basic";
  const carrierBinding = {
    carrier_profile_code: carrierProfileCode,
    sdm_config: scope.sdm_config,
  };
  const carrierConfigDigest = canonicalDigest(carrierBinding);
  const contextBinding = {
    domain: "nexid:supplier-qa:verification-context",
    schema_version: "v2",
    tenant_id: fixture.tenants[0].id.toLowerCase(),
    batch_id: String(subBatch.batch_id).toLowerCase(),
    bid,
    manifest_hash: scope.manifest_hash,
    carrier_profile_code: carrierProfileCode,
    key_fingerprint: null,
    key_material_mode: "none",
    software_envelope: false,
    managed_kms: false,
    hsm_backed: false,
    carrier_config_digest: carrierConfigDigest,
    supplier_order_id: String(order.id).toLowerCase(),
    supplier_sub_batch_id: String(subBatch.id).toLowerCase(),
    supplier_sub_batch_status: scope.supplier_sub_batch_status,
    batch_status: scope.batch_status,
    key_export_count: Number(scope.key_export_count),
    key_exported_at: scope.key_exported_at,
    batch_key_export_count: 0,
    batch_key_exported_at: null,
    packaging_governance_status: scope.packaging_governance_status,
    packaging_spec_revision: Number(scope.packaging_spec_revision),
    packaging_spec_hash: scope.packaging_spec_hash,
    pack_purpose: "production",
    acceptance_scope: "production_lot",
  };
  const contextCanonical = canonicalJson(contextBinding);
  const contextDigest = sha256(contextCanonical);
  const capturedAt = new Date().toISOString();
  const fingerprint = uidFingerprint(bid, scope.uid_hex);
  const publicOrigin = "https://nexid.lat";
  const targetBinding = {
    kind: "nexid_static_qr",
    public_origin: publicOrigin,
    tenant_slug: scope.tenant_slug,
    bid,
    carrier_profile_code: carrierProfileCode,
    uid_fingerprint: fingerprint,
  };
  const targetBindingDigest = canonicalDigest(targetBinding);
  const encodedUrlHash = sha256(`${fixture.runId}:keyless-encoded-url`);
  const observationBinding = {
    schema_version: "supplier-qa-carrier-observation/v1",
    tenant_id: fixture.tenants[0].id.toLowerCase(),
    batch_id: String(subBatch.batch_id).toLowerCase(),
    bid,
    tag_id: String(scope.tag_id).toLowerCase(),
    carrier_profile_code: carrierProfileCode,
    capture_method: "qr_camera",
    captured_at: capturedAt,
    uid_fingerprint: fingerprint,
    encoded_url_hash: encodedUrlHash,
    target_binding_digest: targetBindingDigest,
    gs1_identity_id: null,
  };
  const observationDigest = canonicalDigest(observationBinding);
  const observationReceipt = {
    uid_fingerprint: fingerprint,
    encoded_url_hash: encodedUrlHash,
    target_binding_digest: targetBindingDigest,
    observation_digest: observationDigest,
    capture_method: "qr_camera",
    captured_at: capturedAt,
    gs1_identity_id: null,
  };
  const operationKey = `qa:${fixture.runId}:keyless-production`;
  const actor = fixture.tenantActors[0];
  const evidenceWithoutDigest = {
    schema_version: "supplier-qa-carrier/v1",
    evidence_source: "server_validated_operator_capture",
    assurance_scope: "manifest_and_carrier_encoding_binding",
    carrier_profile_code: carrierProfileCode,
    sample_count: 1,
    manifest_hash: scope.manifest_hash,
    carrier_config_digest: carrierConfigDigest,
    verification_context_digest: contextDigest,
    public_origin: publicOrigin,
    manifest_uid_binding_verified: true,
    carrier_encoding_binding_verified: true,
    gs1_registry_binding_verified: false,
    server_verified_sun_evidence: false,
    cryptographic_authentication_verified: false,
    anti_replay_verified: false,
    ttstatus_verified: false,
    physical_ceremony_verified: false,
    requires_secure_sun: false,
    key_material_mode: "none",
    software_envelope: false,
    managed_kms: false,
    hsm_backed: false,
    packaging_lab_approval_verified: true,
    pack_purpose: "production",
    acceptance_scope: "production_lot",
    commercial_disposition: "BLOCKED_PENDING_ACTIVATION",
    activation_allowed: false,
    production_qa_plan_id: plan.planId.toLowerCase(),
    production_qa_plan_digest: plan.planDigest,
    production_qa_plan_decision_id: plan.decisionId.toLowerCase(),
    packaging_lab_approval_id: lab.approvalId.toLowerCase(),
    packaging_lab_receipt_digest: lab.receiptDigest,
    operation_key: operationKey,
    notes_digest: null,
    notes: null,
    checked_by: actor.email,
    claim_limitations: [...CLAIM_LIMITATIONS],
    batch_scoped_uid_fingerprints: [fingerprint],
    observation_receipts: [observationReceipt],
  };
  const evidenceDigest = canonicalDigest(evidenceWithoutDigest);
  const evidence = { ...evidenceWithoutDigest, evidence_digest: evidenceDigest };
  return {
    tenant_id: fixture.tenants[0].id,
    supplier_order_id: order.id,
    supplier_sub_batch_id: subBatch.id,
    batch_id: subBatch.batch_id,
    bid,
    sample_count: 1,
    notes: null,
    evidence_json: evidence,
    evidence_digest: evidenceDigest,
    carrier_evidence_rows: [{
      tag_id: String(scope.tag_id).toLowerCase(),
      carrier_profile_code: carrierProfileCode,
      capture_method: "qr_camera",
      captured_at: capturedAt,
      uid_fingerprint: fingerprint,
      encoded_url_hash: encodedUrlHash,
      target_binding: targetBinding,
      target_binding_digest: targetBindingDigest,
      observation_digest: observationDigest,
      gs1_identity_id: null,
    }],
    operation_key: operationKey,
    actor_id: actor.id,
    auth_session_id: actor.authSessionId,
    actor_email: actor.email,
    expected_manifest_hash: scope.manifest_hash,
    expected_carrier_profile_code: carrierProfileCode,
    expected_key_fingerprint: "",
    expected_sdm_config: scope.sdm_config,
    expected_verification_context_digest: contextDigest,
    expected_verification_context_binding: contextBinding,
    expected_verification_context_canonical: contextCanonical,
    status: "passed",
    replay_checked: false,
    ttstatus_checked: false,
    user_agent: "nexid-supplier-atomic-postgres-qa/2",
    request_id: `qa:${fixture.runId}:keyless-production`,
  };
}

function rebindQaInputForTenantIsolation(input, tenantActor, tenantId, operationKey) {
  const contextBinding = {
    ...input.expected_verification_context_binding,
    tenant_id: tenantId.toLowerCase(),
  };
  const contextCanonical = canonicalJson(contextBinding);
  const contextDigest = sha256(contextCanonical);
  const evidenceWithoutDigest = {
    ...input.evidence_json,
    verification_context_digest: contextDigest,
    operation_key: operationKey,
    checked_by: tenantActor.email,
  };
  delete evidenceWithoutDigest.evidence_digest;
  const evidenceDigest = canonicalDigest(evidenceWithoutDigest);
  return {
    ...input,
    tenant_id: tenantId,
    actor_id: tenantActor.id,
    auth_session_id: tenantActor.authSessionId,
    actor_email: tenantActor.email,
    operation_key: operationKey,
    evidence_json: { ...evidenceWithoutDigest, evidence_digest: evidenceDigest },
    evidence_digest: evidenceDigest,
    expected_verification_context_binding: contextBinding,
    expected_verification_context_canonical: contextCanonical,
    expected_verification_context_digest: contextDigest,
    request_id: operationKey,
  };
}

async function verifyTenantIsolation(client, fixture, qaInput) {
  const foreignActor = fixture.tenantActors[1];
  const principals = (await client.query(`SELECT
      count(DISTINCT actor.id)::integer AS users,
      count(DISTINCT membership.id)::integer AS memberships,
      count(DISTINCT auth_session.id)::integer AS sessions,
      count(DISTINCT auth_session.tenant_id)::integer AS tenant_scopes
    FROM users actor
    JOIN memberships membership
      ON membership.user_id = actor.id
     AND membership.role = 'tenant_admin'
    JOIN auth_sessions auth_session
      ON auth_session.user_id = actor.id
     AND auth_session.role = membership.role
     AND auth_session.tenant_id = membership.tenant_id
    WHERE actor.id = ANY($1::uuid[])
      AND auth_session.revoked_at IS NULL
      AND auth_session.expires_at > now()`, [
    fixture.tenantActors.map((actor) => actor.id),
  ])).rows[0];
  assert.deepEqual([
    Number(principals.users),
    Number(principals.memberships),
    Number(principals.sessions),
    Number(principals.tenant_scopes),
  ], [2, 2, 2, 2]);
  const operationKey = `qa:${fixture.runId}:cross-tenant-denied`;
  const crossTenantInput = rebindQaInputForTenantIsolation(
    qaInput,
    foreignActor,
    fixture.tenants[1].id,
    operationKey,
  );
  await assert.rejects(
    () => client.query(
      "SELECT * FROM public.nexid_commit_supplier_carrier_qa_v1($1::jsonb)",
      [JSON.stringify(crossTenantInput)],
    ),
    /supplier_carrier_qa_scope_not_found/,
  );
  const counts = (await client.query(`SELECT
    (SELECT count(*)::integer FROM supplier_qa_checks WHERE operation_key = $1) AS qa_checks,
    (SELECT count(*)::integer FROM supplier_qa_verification_context_receipts receipt
      JOIN supplier_qa_checks qa ON qa.id = receipt.qa_check_id WHERE qa.operation_key = $1) AS contexts,
    (SELECT count(*)::integer FROM supplier_qa_carrier_evidence_receipts receipt
      JOIN supplier_qa_checks qa ON qa.id = receipt.qa_check_id WHERE qa.operation_key = $1) AS observations,
    (SELECT count(*)::integer FROM supplier_keyless_production_qa_acceptance_receipts receipt
      JOIN supplier_qa_checks qa ON qa.id = receipt.qa_check_id WHERE qa.operation_key = $1) AS acceptances`, [
    operationKey,
  ])).rows[0];
  assert.deepEqual(Object.values(counts).map(Number), [0, 0, 0, 0]);
  return Object.freeze({
    function: "nexid_commit_supplier_carrier_qa_v1",
    prohibition: "exact tenant/order/sub-batch/batch scope",
    authenticated_tenant_principals: 2,
    cross_tenant_mutations: 0,
    rls_claimed: false,
  });
}

async function commitKeylessQa(client, fixture, input) {
  const rows = (await client.query(
    "SELECT * FROM public.nexid_commit_supplier_carrier_qa_v1($1::jsonb)",
    [JSON.stringify(input)],
  )).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].qa_status, "passed");
  assert.equal(rows[0].idempotent_replay, false);
  const receipt = (await client.query(`SELECT
      acceptance.schema_version,
      acceptance.carrier_profile_code,
      acceptance.key_material_mode,
      acceptance.software_envelope,
      acceptance.managed_kms,
      acceptance.hsm_backed,
      activation.production_session_id,
      activation.production_receipt_id,
      (SELECT count(*)::integer FROM batch_keys WHERE batch_id = acceptance.batch_id) AS key_rows,
      (SELECT count(*)::integer FROM batch_key_material WHERE batch_id = acceptance.batch_id) AS key_material_rows
    FROM supplier_keyless_production_qa_acceptance_receipts acceptance
    JOIN LATERAL public.nexid_supplier_production_activation_receipt_v2(acceptance.batch_id) activation
      ON activation.qa_check_id = acceptance.qa_check_id
    WHERE acceptance.qa_check_id = $1::uuid`, [rows[0].qa_check_id])).rows[0];
  assert.equal(receipt.schema_version, "supplier-keyless-production-acceptance/v1");
  assert.equal(receipt.carrier_profile_code, "qr_basic");
  assert.equal(receipt.key_material_mode, "none");
  assert.equal(receipt.software_envelope, false);
  assert.equal(receipt.managed_kms, false);
  assert.equal(receipt.hsm_backed, false);
  assert.equal(receipt.production_session_id, null);
  assert.equal(receipt.production_receipt_id, null);
  assert.equal(Number(receipt.key_rows), 0);
  assert.equal(Number(receipt.key_material_rows), 0);
  return Object.freeze({
    qaCheckId: String(rows[0].qa_check_id),
    acceptance_path: "keyless_carrier_v1",
    key_material_mode: receipt.key_material_mode,
    software_envelope: false,
    managed_kms: false,
    hsm_backed: false,
  });
}

async function verifyConcurrentActivationArchive(config, observer, fixture, receipt, lab) {
  const order = receipt.supplier_order;
  const subBatch = receipt.sub_batches[0];
  const actor = fixture.tenantActors[0];
  const activationInput = {
    tenant_id: fixture.tenants[0].id,
    supplier_order_id: order.id,
    supplier_sub_batch_id: subBatch.id,
    batch_id: subBatch.batch_id,
    actor_id: actor.id,
    auth_session_id: actor.authSessionId,
    bid: subBatch.bid,
    operation_key: `qa:${fixture.runId}:activation-race`,
    selection_mode: "all",
    lot_size: 1,
    limit: 0,
    uids: [],
    request_id: `qa:${fixture.runId}:activation-race`,
  };
  const archiveInput = {
    tenant_id: fixture.tenants[0].id,
    project_id: lab.projectId,
    actor_id: actor.id,
    auth_session_id: actor.authSessionId,
    operation_key: `qa:${fixture.runId}:lab-archive-race`,
    decision: "ARCHIVE",
    reason: "Synthetic concurrent archive validates PostgreSQL serialization.",
    recommendation: null,
    override: false,
    override_reason: null,
    request_id: `qa:${fixture.runId}:lab-archive-race`,
  };
  const activationClient = new pg.Client(clientOptions(config, `${fixture.runId}_activation`));
  const archiveClient = new pg.Client(clientOptions(config, `${fixture.runId}_archive`));
  await Promise.all([activationClient.connect(), archiveClient.connect()]);
  try {
    const [activation, archive] = await Promise.all([
      settle(activationClient.query(
        "SELECT * FROM public.nexid_activate_supplier_tags_v2($1::jsonb)",
        [JSON.stringify(activationInput)],
      )),
      settle(archiveClient.query(
        "SELECT * FROM public.nexid_decide_packaging_lab_project_v1($1::jsonb)",
        [JSON.stringify(archiveInput)],
      )),
    ]);
    assert.equal(archive.ok, true, archive.error?.message);
    if (!activation.ok) {
      assert.match(String(activation.error?.message || ""), /supplier_production_acceptance_v2_required/);
    } else {
      assert.equal(activation.value.rows.length, 1);
      assert.equal(activation.value.rows[0].activation_complete, true);
    }
    const state = (await observer.query(`SELECT
        project.status AS project_status,
        sub_batch.status::text AS sub_batch_status,
        batch.status::text AS batch_status,
        (SELECT count(*)::integer FROM tags WHERE batch_id = batch.id AND status::text = 'active') AS active_tags,
        (SELECT count(*)::integer FROM tags WHERE batch_id = batch.id AND status::text = 'inactive') AS inactive_tags,
        (SELECT count(*)::integer FROM supplier_production_activation_receipts activation
          WHERE activation.batch_id = batch.id) AS activation_receipts,
        (SELECT count(*)::integer FROM supplier_production_activation_receipts activation
          WHERE activation.batch_id = batch.id
            AND activation.acceptance_path = 'keyless_carrier_v1'
            AND activation.production_session_id IS NULL
            AND activation.production_receipt_id IS NULL) AS truthful_keyless_receipts
      FROM packaging_lab_projects project
      JOIN supplier_orders supplier_order ON supplier_order.id = project.supplier_order_id
      JOIN supplier_sub_batches sub_batch ON sub_batch.supplier_order_id = supplier_order.id
      JOIN batches batch ON batch.id = sub_batch.batch_id
      WHERE project.id = $1::uuid AND batch.id = $2::uuid`, [
      lab.projectId,
      subBatch.batch_id,
    ])).rows[0];
    assert.equal(state.project_status, "ARCHIVED");
    const activationReceipts = Number(state.activation_receipts);
    assert.equal(activationReceipts, activation.ok ? 1 : 0);
    assert.equal(Number(state.truthful_keyless_receipts), activationReceipts);
    if (activation.ok) {
      assert.deepEqual([
        state.sub_batch_status,
        state.batch_status,
        Number(state.active_tags),
        Number(state.inactive_tags),
      ], ["activated", "active_in_market", 1, 0]);
    } else {
      assert.deepEqual([
        state.sub_batch_status,
        state.batch_status,
        Number(state.active_tags),
        Number(state.inactive_tags),
      ], ["pack_ready", "production_registered", 0, 1]);
    }
    return Object.freeze({
      concurrent_attempts: 2,
      packaging_lab_archive_committed: true,
      activation_linearized_before_archive: activation.ok,
      activation_receipts: activationReceipts,
      partial_or_unreceipted_activation: false,
    });
  } finally {
    await Promise.allSettled([activationClient.end(), archiveClient.end()]);
  }
}

export async function runSupplierAtomicPostgresQa(env = process.env) {
  const config = readSunAtomicPostgresQaConfig(env);
  const observer = new pg.Client(clientOptions(config, randomBytes(4).toString("hex")));
  const runId = randomBytes(5).toString("hex").toUpperCase();
  const tenants = Object.freeze([1, 2].map((index) => Object.freeze({
    id: randomUUID(),
    slug: `qa-supplier-${runId.toLowerCase()}-${index}`,
    name: `Supplier atomic QA tenant ${index}`,
  })));
  const fixture = Object.freeze({
    runId,
    actorId: randomUUID(),
    actorEmail: `qa-supplier-${runId.toLowerCase()}@example.invalid`,
    authSessionId: randomUUID(),
    tenants,
    tenantActors: Object.freeze(tenants.map((tenant, index) => Object.freeze({
      id: randomUUID(),
      email: `qa-supplier-tenant-${runId.toLowerCase()}-${index + 1}@example.invalid`,
      name: `Supplier atomic QA tenant actor ${index + 1}`,
      authSessionId: randomUUID(),
      tenantId: tenant.id,
    }))),
  });
  await observer.connect();
  try {
    const base = await assertSunAtomicPostgresQaTarget(observer, config);
    await assertSupplierCapabilities(observer);
    await insertIdentityFixtures(observer, fixture);
    const rollback = await verifyMidFunctionRollback(observer, fixture);
    const bidRace = await verifyConcurrentBidOwnership(config, observer, fixture);
    const uidRace = await verifyConcurrentGlobalUid(config, observer, fixture);
    const keylessOrder = await createOrder(observer, buildOrderInput({
      tenantId: fixture.tenants[0].id,
      actorId: fixture.actorId,
      authSessionId: fixture.authSessionId,
      orderId: randomUUID(),
      bids: [`QA-${fixture.runId}-KEYLESS`],
      salt: `${fixture.runId}-keyless-production`,
      carrierProfileCode: "qr_basic",
      packPurpose: "production",
    }));
    const keylessSubBatch = keylessOrder.sub_batches[0];
    const keylessCreation = (await observer.query(`SELECT
      lower(supplier_order.carrier_profile_code) AS order_carrier,
      lower(batch.carrier_profile_code) AS batch_carrier,
      batch.meta_key_ct IS NULL AS batch_meta_key_absent,
      batch.file_key_ct IS NULL AS batch_file_key_absent,
      sub_batch.metadata_json->>'key_material_mode' AS key_material_mode,
      sub_batch.metadata_json->>'software_envelope' AS software_envelope,
      sub_batch.metadata_json->>'managed_kms' AS managed_kms,
      sub_batch.metadata_json->>'hsm_backed' AS hsm_backed,
      (SELECT count(*)::integer FROM batch_keys WHERE batch_id = batch.id) AS key_rows,
      (SELECT count(*)::integer FROM batch_key_material WHERE batch_id = batch.id) AS key_material_rows
    FROM supplier_orders supplier_order
    JOIN supplier_sub_batches sub_batch ON sub_batch.supplier_order_id = supplier_order.id
    JOIN batches batch ON batch.id = sub_batch.batch_id
    WHERE supplier_order.id = $1::uuid AND sub_batch.id = $2::uuid`, [
      keylessOrder.supplier_order.id,
      keylessSubBatch.id,
    ])).rows[0];
    assert.deepEqual({ ...keylessCreation }, {
      order_carrier: "qr_basic",
      batch_carrier: "qr_basic",
      batch_meta_key_absent: true,
      batch_file_key_absent: true,
      key_material_mode: "none",
      software_envelope: "false",
      managed_kms: "false",
      hsm_backed: "false",
      key_rows: 0,
      key_material_rows: 0,
    });
    const keylessManifest = await verifyKeylessManifestRules(observer, fixture, keylessOrder);
    const carrierScope = await verifyCarrierKeyScope(
      observer,
      fixture,
      bidRace.winning_bid,
      keylessOrder,
    );
    const supplierPack = await stageKeylessSupplierPack(
      observer,
      fixture,
      keylessOrder,
      keylessManifest.manifest_hash,
    );
    const governance = await approvePackagingGovernance(observer, fixture, keylessOrder);
    const lab = await createApprovedPackagingLab(observer, fixture, keylessOrder, governance);
    const plan = await createApprovedProductionPlan(observer, fixture, keylessOrder);
    const qaInput = await buildKeylessQaInput(
      observer,
      fixture,
      keylessOrder,
      keylessManifest,
      lab,
      plan,
    );
    const tenantIsolation = await verifyTenantIsolation(observer, fixture, qaInput);
    const keylessQa = await commitKeylessQa(observer, fixture, qaInput);
    const activationArchiveRace = await verifyConcurrentActivationArchive(
      config,
      observer,
      fixture,
      keylessOrder,
      lab,
    );
    return Object.freeze({
      ok: true,
      validator: "supplier_atomic_postgres_concurrency_v2",
      target: Object.freeze({
        endpoint_id: base.endpointId,
        database: base.databaseName,
        database_role: base.databaseRole,
        safe_target: config.safeTarget,
        postgres_version_number: base.postgresVersionNumber,
      }),
      migrations: Object.freeze([...REQUIRED_MIGRATIONS]),
      evidence: Object.freeze({
        canonical_carrier_catalog_fixture: Object.freeze({
          codes: Object.freeze(["qr_basic"]),
          source: "disposable_qa_only",
          cryptographic_authentication: false,
          requires_batch_keys: false,
        }),
        supplier_order_mid_function_rollback: rollback,
        supplier_bid_global_serialization: bidRace,
        manifest_global_uid_serialization: uidRace,
        keyless_order_truth: Object.freeze({
          carrier_profile_code: "qr_basic",
          key_material_mode: "none",
          software_envelope: false,
          managed_kms: false,
          hsm_backed: false,
          key_rows: 0,
          key_material_rows: 0,
        }),
        manifest_carrier_and_sun_contract: keylessManifest,
        supplier_carrier_key_scope_integrity: carrierScope,
        keyless_supplier_pack_contract: supplierPack,
        packaging_lab_synthetic_gate_fixture: Object.freeze({
          project_id: lab.projectId,
          synthetic_test_count: lab.syntheticTestCount,
          physical_evidence_validated: false,
        }),
        tenant_isolation: tenantIsolation,
        keyless_production_qa_acceptance: keylessQa,
        activation_archive_serialization: activationArchiveRace,
      }),
      boundaries: Object.freeze({
        production_touched: false,
        disposable_neon_postgresql_only: true,
        physical_nfc_cryptographic_path_touched: false,
        physical_packaging_evidence_validated: false,
        raw_nfc_keys_used: false,
        managed_kms_validated: false,
        hsm_validated: false,
        rls_validated: false,
      }),
      cleanup: "delete_disposable_neon_branch_after_validation",
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
    console.log(JSON.stringify(await runSupplierAtomicPostgresQa(process.env)));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      validator: "supplier_atomic_postgres_concurrency_v2",
      reason: sanitizeSunAtomicQaFailure(error, config),
      cleanup: "delete_disposable_neon_branch_if_fixture_insertion_started",
    }));
    process.exitCode = 1;
  }
}
