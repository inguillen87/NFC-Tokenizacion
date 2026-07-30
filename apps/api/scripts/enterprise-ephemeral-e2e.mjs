import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import pg from "pg";

import {
  assertEmptyEnterpriseE2eDatabase,
  readEnterpriseEphemeralE2eConfig,
} from "./lib/enterprise-ephemeral-e2e-safety.mjs";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { Client, Pool } = pg;
let config = null;

function taggedExecutor(client) {
  return async (strings, ...values) => {
    let statement = strings[0] || "";
    for (let index = 0; index < values.length; index += 1) {
      statement += `$${index + 1}${strings[index + 1] || ""}`;
    }
    return (await client.query(statement, values)).rows;
  };
}

async function assertDatabaseStartsEmpty() {
  const client = new Client({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    return await assertEmptyEnterpriseE2eDatabase(client, config);
  } finally {
    await client.end();
  }
}

function applyMigrations() {
  const result = spawnSync(process.execPath, ["scripts/db-apply.mjs", "--allow-empty-ephemeral-e2e-bootstrap"], {
    cwd: apiRoot,
    env: {
      ...process.env,
      DATABASE_URL: config.databaseUrl,
      NODE_ENV: "test",
      VERCEL_ENV: "test",
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    // The child output can contain driver diagnostics. Keep it out of CI logs
    // because this harness never needs a connection string to diagnose which
    // fail-closed boundary stopped the run.
    throw new Error("ephemeral_e2e_migrations_failed");
  }
}

class SseProbe {
  constructor(response) {
    assert.equal(response.status, 200, "SSE route must accept the scoped tenant session");
    assert.ok(response.body, "SSE route must return a readable body");
    this.reader = response.body.getReader();
    this.decoder = new TextDecoder();
    this.buffer = "";
    this.queue = [];
  }

  parseAvailable() {
    while (true) {
      const boundary = this.buffer.indexOf("\n\n");
      if (boundary < 0) return;
      const frame = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const fields = {};
      for (const line of frame.split("\n")) {
        if (!line || line.startsWith(":")) continue;
        const separator = line.indexOf(":");
        if (separator < 0) continue;
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).replace(/^ /, "");
        fields[key] = value;
      }
      if (!fields.event || !fields.data) continue;
      let data;
      try {
        data = JSON.parse(fields.data);
      } catch {
        continue;
      }
      this.queue.push({ event: fields.event, data });
    }
  }

  async next(predicate, timeoutMs = 8_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      this.parseAvailable();
      const index = this.queue.findIndex(predicate);
      if (index >= 0) return this.queue.splice(index, 1)[0];
      const warningIndex = this.queue.findIndex((entry) => entry.event === "warning");
      if (warningIndex >= 0) {
        const warning = this.queue.splice(warningIndex, 1)[0];
        throw new Error(`sse_warning:${String(warning?.data?.reason || "unknown")}`);
      }
      const remaining = Math.max(1, deadline - Date.now());
      const read = await Promise.race([
        this.reader.read(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("sse_probe_timeout")), remaining)),
      ]);
      if (read.done) throw new Error("sse_stream_closed_before_expected_event");
      this.buffer += this.decoder.decode(read.value, { stream: true }).replaceAll("\r\n", "\n");
    }
    throw new Error("sse_probe_timeout");
  }

  async close() {
    await this.reader.cancel().catch(() => null);
  }
}

async function run() {
  config = readEnterpriseEphemeralE2eConfig(process.env);
  const emptyTarget = await assertDatabaseStartsEmpty();
  applyMigrations();

  process.env.NODE_ENV = "test";
  process.env.VERCEL_ENV = "test";
  process.env.DATABASE_URL = config.databaseUrl;
  process.env.REALTIME_MODE = "memory";
  process.env.SUN_AUTO_TOKENIZE_ON_VALID_TAP = "false";
  process.env.NEXID_SUN_DEMO_AUTO_SEED = "false";
  process.env.KMS_MASTER_KEY_HEX = randomBytes(32).toString("hex");
  process.env.NFC_ENVELOPE_KEK_VERSION = "ephemeral-e2e-v1";
  process.env.WEBHOOK_SIGNING_MASTER_KEY_HEX = randomBytes(32).toString("hex");
  process.env.WEBHOOK_SIGNING_ALLOW_LEGACY_PLAINTEXT = "false";
  process.env.RATE_LIMIT_KEY_PEPPER = randomBytes(32).toString("hex");

  const client = new Client({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5_000 });
  await client.connect();
  const appPool = new Pool({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 4,
  });
  const query = taggedExecutor(appPool);
  const { installEphemeralE2eSqlExecutor } = await import("../src/lib/db.ts");
  const uninstallSqlExecutor = installEphemeralE2eSqlExecutor(query, process.env);
  const abortStream = new AbortController();
  let sseProbe = null;

  try {
    const ledger = await client.query("SELECT count(*)::integer AS count FROM schema_migrations");
    const migrationFiles = await import("node:fs/promises").then(({ readdir }) => readdir(path.join(apiRoot, "db", "migrations")));
    const expectedMigrationCount = migrationFiles.filter((name) => name.endsWith(".sql")).length;
    assert.equal(Number(ledger.rows[0]?.count || 0), expectedMigrationCount, "every migration must be ledgered");

    const tenantId = "11111111-1111-4111-8111-111111111111";
    const otherTenantId = "22222222-2222-4222-8222-222222222222";
    const batchId = "33333333-3333-4333-8333-333333333333";
    const tagId = "44444444-4444-4444-8444-444444444444";
    const userId = "55555555-5555-4555-8555-555555555555";
    const tenantSlug = "enterprise-e2e";
    const bid = "E2E-ENTERPRISE-001";
    const uidHex = "0487856A0B1090";
    const kMetaHex = randomBytes(16).toString("hex").toUpperCase();
    const kFileHex = randomBytes(16).toString("hex").toUpperCase();

    const { encryptKey16 } = await import("../src/lib/keys.ts");
    const envelopeContext = { tenantId, bid, keyVersion: 1 };
    const metaKeyCiphertext = encryptKey16(Buffer.from(kMetaHex, "hex"), { ...envelopeContext, role: "K_META_BATCH" });
    const fileKeyCiphertext = encryptKey16(Buffer.from(kFileHex, "hex"), { ...envelopeContext, role: "K_FILE_BATCH" });

    await client.query(`INSERT INTO tenants (id, slug, name, root_key_ct) VALUES
      ($1, $2, 'Enterprise E2E', 'ephemeral-test-envelope'),
      ($3, 'enterprise-e2e-other', 'Other E2E tenant', 'ephemeral-test-envelope')`,
    [tenantId, tenantSlug, otherTenantId]);
    await client.query(`INSERT INTO batches (
      id, tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config
    ) VALUES ($1, $2, $3, 'active', $4, $5, $6::jsonb)`, [
      batchId,
      tenantId,
      bid,
      metaKeyCiphertext,
      fileKeyCiphertext,
      JSON.stringify({
        chip_model: "NTAG 424 DNA",
        key_version: 1,
        mac_input: "enc_plus_cmac_literal",
        tagtamper_enabled: false,
        product_name: "Enterprise ephemeral fixture",
      }),
    ]);
    await client.query(`INSERT INTO tags (
      id, batch_id, uid_hex, status, lifecycle_state, lifecycle_revision
    ) VALUES ($1, $2, $3, 'active', 'active', 0)`, [tagId, batchId, uidHex]);
    await client.query(`INSERT INTO users (id, email, full_name, admin_status)
      VALUES ($1, 'enterprise-e2e@nexid.invalid', 'Enterprise E2E Operator', 'active')`, [userId]);
    await client.query(`INSERT INTO memberships (user_id, tenant_id, role)
      VALUES ($1, $2, 'tenant_admin')`, [userId, tenantId]);
    await client.query(`INSERT INTO resource_permissions (user_id, resource, action, effect) VALUES
      ($1, 'incidents', 'read', 'allow'),
      ($1, 'incidents', 'write', 'allow'),
      ($1, 'sdk:keys', 'read', 'allow'),
      ($1, 'sdk:keys', 'write', 'allow'),
      ($1, 'webhooks', 'read', 'allow'),
      ($1, 'webhooks', 'write', 'allow')`, [userId]);

    // Supplier QA verification-context v2: prove the marker and canonicalizer
    // on real PostgreSQL, then hold a concurrent state mutation open while the
    // v2 writer waits on the shared purpose/row locks. Once the mutation
    // commits, the stale scan-time binding must fail closed before v1 can
    // consume evidence or write a QA receipt.
    const qaSupplierOrderId = "66666666-6666-4666-8666-666666666666";
    const qaSupplierSubBatchId = "77777777-7777-4777-8777-777777777777";
    const qaBatchId = "88888888-8888-4888-8888-888888888888";
    const qaBid = "E2E-QA-V2-001";
    const qaManifestHash = `sha256:${"c".repeat(64)}`;
    const qaPackagingTimestamp = "2026-07-30T00:00:00.000000Z";
    const qaSdmConfig = { key_version: 1, ratio: 1, nested: { z: 2, a: 1 } };
    await client.query(`INSERT INTO supplier_orders (
      id, tenant_id, customer_slug, order_name, base_batch_id, total_quantity,
      sub_batch_size, chip_model, carrier_profile_code, status, created_by,
      pack_purpose, purpose_locked_at, purpose_locked_by
    ) VALUES (
      $1::uuid, $2::uuid, 'enterprise-e2e', 'QA v2 race fixture', $3, 10,
      10, 'NTAG 424 DNA', 'ntag424_dna', 'pack_ready', 'enterprise-e2e@nexid.invalid',
      'trial_integration', now(), $4::uuid
    )`, [qaSupplierOrderId, tenantId, qaBid, userId]);
    await client.query(`INSERT INTO batches (
      id, tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config,
      carrier_profile_code, supplier_order_id, expected_quantity
    ) VALUES (
      $1::uuid, $2::uuid, $3, 'production_registered', 'qa-meta-envelope',
      'qa-file-envelope', $4::jsonb, 'ntag424_dna', $5::uuid, 10
    )`, [qaBatchId, tenantId, qaBid, JSON.stringify(qaSdmConfig), qaSupplierOrderId]);
    await client.query(`INSERT INTO supplier_sub_batches (
      id, supplier_order_id, tenant_id, batch_id, bid, sequence_index,
      expected_quantity, manifest_count, manifest_hash, manifest_status,
      status, key_export_count, key_exported_at, manifest_imported_at, pack_purpose
    ) VALUES (
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 1,
      10, 10, $6, 'imported', 'pack_ready', 1, $7::timestamptz,
      $7::timestamptz, 'trial_integration'
    )`, [
      qaSupplierSubBatchId,
      qaSupplierOrderId,
      tenantId,
      qaBatchId,
      qaBid,
      qaManifestHash,
      qaPackagingTimestamp,
    ]);
    await client.query(`UPDATE batches
      SET supplier_sub_batch_id = $1::uuid
      WHERE id = $2::uuid AND tenant_id = $3::uuid`, [qaSupplierSubBatchId, qaBatchId, tenantId]);
    await client.query(`INSERT INTO batch_keys (
      tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
      meta_key_ct, file_key_ct, key_fingerprint, status, export_count, exported_at
    ) VALUES (
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
      'qa-meta-envelope', 'qa-file-envelope', 'A1B2C3D4E5F60708', 'active', 1, $6::timestamptz
    )`, [tenantId, qaSupplierOrderId, qaSupplierSubBatchId, qaBatchId, qaBid, qaPackagingTimestamp]);

    const qaCapability = (await client.query(`SELECT
      public.nexid_supplier_qa_verification_context_v2_capability() AS marker,
      public.nexid_supplier_qa_canonical_json_v2('{"z":1,"a":{"z":2,"a":1}}'::jsonb) AS canonical`)).rows[0];
    assert.equal(qaCapability.marker, "supplier-qa-verification-context/v2");
    assert.equal(qaCapability.canonical, '{"a":{"a":1,"z":2},"z":1}');

    const { buildSupplierQaVerificationContext } = await import("../src/lib/supplier-qa-verification-context.ts");
    const qaVerificationContext = buildSupplierQaVerificationContext({
      tenantId,
      batchId: qaBatchId,
      bid: qaBid,
      manifestHash: qaManifestHash,
      carrierProfileCode: "ntag424_dna",
      keyFingerprint: "A1B2C3D4E5F60708",
      sdmConfig: qaSdmConfig,
      supplierOrderId: qaSupplierOrderId,
      supplierSubBatchId: qaSupplierSubBatchId,
      supplierSubBatchStatus: "pack_ready",
      batchStatus: "production_registered",
      keyExportCount: 1,
      keyExportedAt: qaPackagingTimestamp,
      batchKeyExportCount: 1,
      batchKeyExportedAt: qaPackagingTimestamp,
      packagingGovernanceStatus: "legacy_unverified",
      packagingSpecRevision: 0,
      packagingSpecHash: null,
      packPurpose: "trial_integration",
    });
    assert.ok(qaVerificationContext);
    const qaOperationKey = "enterprise-e2e-qa-v2-race";
    const qaEvidenceDigest = `sha256:${"d".repeat(64)}`;
    const qaCommitPayload = {
      tenant_id: tenantId,
      supplier_order_id: qaSupplierOrderId,
      supplier_sub_batch_id: qaSupplierSubBatchId,
      batch_id: qaBatchId,
      bid: qaBid,
      status: "failed",
      sample_count: 0,
      replay_checked: false,
      ttstatus_checked: false,
      notes: null,
      evidence_json: {
        schema_version: "supplier-qa-sun/v1",
        evidence_source: "operator_rejection",
        server_verified_sun_evidence: false,
        physical_ceremony_verified: false,
        evidence_digest: qaEvidenceDigest,
        operation_key: qaOperationKey,
      },
      evidence_digest: qaEvidenceDigest,
      diagnostic_refs: [],
      operation_key: qaOperationKey,
      actor_id: userId,
      actor_email: "enterprise-e2e@nexid.invalid",
      expected_manifest_hash: qaManifestHash,
      expected_carrier_profile_code: "ntag424_dna",
      expected_key_fingerprint: "A1B2C3D4E5F60708",
      expected_sdm_config: qaSdmConfig,
      expected_verification_context_digest: qaVerificationContext.verificationContextDigest,
      expected_verification_context_binding: qaVerificationContext.binding,
      expected_verification_context_canonical: qaVerificationContext.canonicalPayload,
      request_id: "enterprise-e2e-qa-v2-race",
    };

    let qaRaceTransactionOpen = false;
    try {
      await client.query("BEGIN");
      qaRaceTransactionOpen = true;
      await client.query(`UPDATE supplier_sub_batches
        SET status = 'qa_pending'
        WHERE id = $1::uuid AND tenant_id = $2::uuid`, [qaSupplierSubBatchId, tenantId]);
      let qaCommitSettled = false;
      const staleQaCommit = appPool.query(
        "SELECT * FROM public.nexid_commit_supplier_qa_v2($1::jsonb)",
        [JSON.stringify(qaCommitPayload)],
      ).finally(() => { qaCommitSettled = true; });
      await new Promise((resolve) => setTimeout(resolve, 75));
      assert.equal(qaCommitSettled, false, "v2 writer must wait behind the concurrent purpose/state transaction");
      await client.query("COMMIT");
      qaRaceTransactionOpen = false;
      await assert.rejects(staleQaCommit, /supplier_qa_verification_context_changed/);
    } finally {
      if (qaRaceTransactionOpen) await client.query("ROLLBACK");
    }
    const qaSideEffects = (await client.query(`SELECT
      (SELECT count(*)::integer FROM supplier_qa_checks WHERE supplier_sub_batch_id = $1::uuid) AS qa_checks,
      (SELECT count(*)::integer FROM supplier_qa_verification_context_receipts WHERE supplier_sub_batch_id = $1::uuid) AS context_receipts,
      (SELECT count(*)::integer FROM supplier_qa_diagnostic_consumptions WHERE supplier_sub_batch_id = $1::uuid) AS diagnostic_consumptions`,
    [qaSupplierSubBatchId])).rows[0];
    assert.deepEqual(qaSideEffects, { qa_checks: 0, context_receipts: 0, diagnostic_consumptions: 0 });

    const legacyQaCheckId = "99999999-9999-4999-8999-999999999999";
    const legacyQaOperationKey = "enterprise-e2e-qa-v1-unbound";
    await client.query(`INSERT INTO supplier_qa_checks (
      id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
      status, sample_count, replay_checked, ttstatus_checked, evidence_json,
      checked_by, operation_key, request_fingerprint, actor_id, event_hash,
      database_binding_digest
    ) VALUES (
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6,
      'failed', 0, false, false, $7::jsonb,
      'enterprise-e2e@nexid.invalid', $8, $9, $10::uuid, $11, $12
    )`, [
      legacyQaCheckId,
      tenantId,
      qaSupplierOrderId,
      qaSupplierSubBatchId,
      qaBatchId,
      qaBid,
      JSON.stringify({
        schema_version: "supplier-qa-sun/v1",
        physical_ceremony_verified: false,
        evidence_digest: qaEvidenceDigest,
        operation_key: legacyQaOperationKey,
      }),
      legacyQaOperationKey,
      "f".repeat(64),
      userId,
      `sha256:${"e".repeat(64)}`,
      `sha256:${"f".repeat(64)}`,
    ]);
    const legacyQaPayload = {
      ...qaCommitPayload,
      operation_key: legacyQaOperationKey,
      evidence_json: {
        ...qaCommitPayload.evidence_json,
        operation_key: legacyQaOperationKey,
      },
    };
    await assert.rejects(
      appPool.query("SELECT * FROM public.nexid_commit_supplier_qa_v2($1::jsonb)", [JSON.stringify(legacyQaPayload)]),
      /supplier_qa_legacy_context_receipt_unbound/,
    );
    assert.equal(Number((await client.query(`SELECT count(*)::integer AS count
      FROM supplier_qa_verification_context_receipts
      WHERE qa_check_id = $1::uuid`, [legacyQaCheckId])).rows[0].count), 0);

    // Supplier rotation v2: commit one eligible 2/2/1/1/1 transition, then
    // start a second rotation while a QA transaction owns the shared purpose
    // lock. Once QA commits passed, the waiting writer must re-read the locked
    // row, fail, and leave every key/audit projection at the first receipt.
    const rotationSupplierOrderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const rotationSupplierSubBatchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const rotationBatchId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const rotationPairId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const rotationQaCheckId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const rotationBid = "E2E-ROTATION-V2-001";
    const { buildBatchKeyLifecycleRecords, generateSupplierBatchKeyPair } = await import("../src/lib/batch-keys.ts");
    const oldRotationPair = generateSupplierBatchKeyPair();
    const oldRotationMaterial = buildBatchKeyLifecycleRecords({
      tenantId,
      bid: rotationBid,
      kMetaHex: oldRotationPair.kMetaHex,
      kFileHex: oldRotationPair.kFileHex,
      keyVersion: 1,
      createdBy: "enterprise-e2e@nexid.invalid",
    });
    const oldMeta = oldRotationMaterial.find((row) => row.keyRole === "K_META_BATCH");
    const oldFile = oldRotationMaterial.find((row) => row.keyRole === "K_FILE_BATCH");
    assert.ok(oldMeta && oldFile);
    await client.query(`INSERT INTO supplier_orders (
      id, tenant_id, customer_slug, order_name, base_batch_id, total_quantity,
      sub_batch_size, chip_model, carrier_profile_code, status, created_by,
      pack_purpose, purpose_locked_at, purpose_locked_by
    ) VALUES (
      $1::uuid, $2::uuid, 'enterprise-e2e', 'Rotation v2 race fixture', $3, 10,
      10, 'NTAG 424 DNA', 'ntag424_dna', 'pack_ready', 'enterprise-e2e@nexid.invalid',
      'trial_integration', now(), $4::uuid
    )`, [rotationSupplierOrderId, tenantId, rotationBid, userId]);
    await client.query(`INSERT INTO batches (
      id, tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config,
      carrier_profile_code, supplier_order_id, expected_quantity, qa_status
    ) VALUES (
      $1::uuid, $2::uuid, $3, 'production_registered', $4, $5,
      '{"key_version":1,"tagtamper_enabled":false}'::jsonb,
      'ntag424_dna', $6::uuid, 10, 'pending'
    )`, [
      rotationBatchId,
      tenantId,
      rotationBid,
      oldMeta.encryptedKeyCt,
      oldFile.encryptedKeyCt,
      rotationSupplierOrderId,
    ]);
    await client.query(`INSERT INTO supplier_sub_batches (
      id, supplier_order_id, tenant_id, batch_id, bid, sequence_index,
      expected_quantity, manifest_count, manifest_status, qa_status, status,
      key_export_count, pack_purpose
    ) VALUES (
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 1,
      10, 0, 'pending', 'pending', 'pack_ready', 0, 'trial_integration'
    )`, [rotationSupplierSubBatchId, rotationSupplierOrderId, tenantId, rotationBatchId, rotationBid]);
    await client.query(`UPDATE batches SET supplier_sub_batch_id = $1::uuid
      WHERE id = $2::uuid AND tenant_id = $3::uuid`, [rotationSupplierSubBatchId, rotationBatchId, tenantId]);
    await client.query(`INSERT INTO batch_keys (
      id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
      meta_key_ct, file_key_ct, key_fingerprint, status, export_count,
      key_version, created_by
    ) VALUES (
      $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6,
      $7, $8, $9, 'active', 0, 1, 'enterprise-e2e@nexid.invalid'
    )`, [
      rotationPairId,
      tenantId,
      rotationSupplierOrderId,
      rotationSupplierSubBatchId,
      rotationBatchId,
      rotationBid,
      oldMeta.encryptedKeyCt,
      oldFile.encryptedKeyCt,
      oldRotationPair.fingerprint,
    ]);
    for (const material of oldRotationMaterial) {
      await client.query(`INSERT INTO batch_key_material (
        tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
        key_role, key_version, encrypted_key_ct, key_fingerprint, status,
        export_count, created_by
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
        $6, 1, $7, $8, 'active', 0, 'enterprise-e2e@nexid.invalid'
      )`, [
        tenantId,
        rotationSupplierOrderId,
        rotationSupplierSubBatchId,
        rotationBatchId,
        rotationBid,
        material.keyRole,
        material.encryptedKeyCt,
        material.keyFingerprint,
      ]);
    }
    const rotationCapability = (await client.query(
      "SELECT public.nexid_supplier_key_rotation_v2_capability() AS marker",
    )).rows[0];
    assert.equal(rotationCapability.marker, "supplier-key-rotation/v2");

    function rotationPayload(pair, material, expectedMaterial, expectedVersion, expectedFingerprint, nextVersion, reason) {
      const meta = material.find((row) => row.keyRole === "K_META_BATCH");
      const file = material.find((row) => row.keyRole === "K_FILE_BATCH");
      const expectedMeta = expectedMaterial.find((row) => row.keyRole === "K_META_BATCH");
      const expectedFile = expectedMaterial.find((row) => row.keyRole === "K_FILE_BATCH");
      assert.ok(meta && file && expectedMeta && expectedFile);
      return {
        tenant_id: tenantId,
        supplier_order_id: rotationSupplierOrderId,
        supplier_sub_batch_id: rotationSupplierSubBatchId,
        batch_id: rotationBatchId,
        bid: rotationBid,
        expected_tenant_slug: tenantSlug,
        expected_pair_id: rotationPairId,
        expected_pair_version: expectedVersion,
        expected_pair_fingerprint: expectedFingerprint,
        expected_meta_key_fingerprint: expectedMeta.keyFingerprint,
        expected_file_key_fingerprint: expectedFile.keyFingerprint,
        next_key_version: nextVersion,
        new_pair_fingerprint: pair.fingerprint,
        meta_encrypted_key_ct: meta.encryptedKeyCt,
        file_encrypted_key_ct: file.encryptedKeyCt,
        meta_key_fingerprint: meta.keyFingerprint,
        file_key_fingerprint: file.keyFingerprint,
        actor_id: userId,
        actor_email: "enterprise-e2e@nexid.invalid",
        rotation_reason: reason,
        request_id: `enterprise-e2e-rotation-v${nextVersion}`,
      };
    }

    const rotationPairV2 = generateSupplierBatchKeyPair();
    const rotationMaterialV2 = buildBatchKeyLifecycleRecords({
      tenantId,
      bid: rotationBid,
      kMetaHex: rotationPairV2.kMetaHex,
      kFileHex: rotationPairV2.kFileHex,
      keyVersion: 2,
      createdBy: "enterprise-e2e@nexid.invalid",
    });
    const rotationReceipt = (await client.query(
      "SELECT * FROM public.nexid_rotate_supplier_batch_keys_v2($1::jsonb)",
      [JSON.stringify(rotationPayload(
        rotationPairV2,
        rotationMaterialV2,
        oldRotationMaterial,
        1,
        oldRotationPair.fingerprint,
        2,
        "Enterprise E2E eligible pre-export rotation",
      ))],
    )).rows[0];
    assert.deepEqual({
      rotated: Number(rotationReceipt.rotated_material_count),
      inserted: Number(rotationReceipt.inserted_material_count),
      pair: Number(rotationReceipt.updated_pair_count),
      batch: Number(rotationReceipt.updated_batch_count),
      subBatch: Number(rotationReceipt.updated_sub_batch_count),
    }, { rotated: 2, inserted: 2, pair: 1, batch: 1, subBatch: 1 });

    const rotationPairV3 = generateSupplierBatchKeyPair();
    const rotationMaterialV3 = buildBatchKeyLifecycleRecords({
      tenantId,
      bid: rotationBid,
      kMetaHex: rotationPairV3.kMetaHex,
      kFileHex: rotationPairV3.kFileHex,
      keyVersion: 3,
      createdBy: "enterprise-e2e@nexid.invalid",
    });
    const beforeRejectedRotation = (await client.query(`SELECT
      (SELECT key_version FROM batch_keys WHERE id = $1::uuid) AS pair_version,
      (SELECT key_fingerprint FROM batch_keys WHERE id = $1::uuid) AS pair_fingerprint,
      (SELECT count(*)::integer FROM batch_key_material WHERE supplier_sub_batch_id = $2::uuid) AS material_count,
      (SELECT count(*)::integer FROM batch_key_material WHERE supplier_sub_batch_id = $2::uuid AND status = 'active') AS active_count,
      (SELECT count(*)::integer FROM evidence_events WHERE resource_id = $2::text AND event_type = 'batch_keys_rotated') AS event_count,
      (SELECT count(*)::integer FROM vault_artifacts WHERE supplier_sub_batch_id = $2::uuid AND artifact_type = 'batch_key_rotation_report') AS vault_count,
      (SELECT count(*)::integer FROM audit_logs WHERE resource_id = $2::text AND action = 'supplier_batch_keys_rotated') AS audit_count`,
    [rotationPairId, rotationSupplierSubBatchId])).rows[0];

    let rotationQaTransactionOpen = false;
    try {
      await client.query("BEGIN");
      rotationQaTransactionOpen = true;
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended(
        'supplier-pack-purpose' || chr(31) || $1::text, 0
      ))`, [rotationSupplierOrderId]);
      await client.query(`INSERT INTO supplier_qa_checks (
        id, tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
        status, sample_count, replay_checked, ttstatus_checked, evidence_json,
        checked_by, operation_key, request_fingerprint, actor_id, event_hash,
        database_binding_digest
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6,
        'passed', 10, true, false, $7::jsonb,
        'enterprise-e2e@nexid.invalid', 'enterprise-e2e-rotation-qa-pass',
        $8, $9::uuid, $10, $11
      )`, [
        rotationQaCheckId,
        tenantId,
        rotationSupplierOrderId,
        rotationSupplierSubBatchId,
        rotationBatchId,
        rotationBid,
        JSON.stringify({
          schema_version: "supplier-qa-sun/v1",
          physical_ceremony_verified: false,
          fixture: "rotation_concurrency_boundary",
        }),
        "1".repeat(64),
        userId,
        `sha256:${"2".repeat(64)}`,
        `sha256:${"3".repeat(64)}`,
      ]);
      await client.query(`UPDATE supplier_sub_batches
        SET qa_status = 'passed', qa_passed_at = now(), updated_at = now()
        WHERE id = $1::uuid AND tenant_id = $2::uuid`, [rotationSupplierSubBatchId, tenantId]);
      await client.query(`UPDATE batches SET qa_status = 'passed'
        WHERE id = $1::uuid AND tenant_id = $2::uuid`, [rotationBatchId, tenantId]);

      let waitingRotationSettled = false;
      const waitingRotation = appPool.query(
        "SELECT * FROM public.nexid_rotate_supplier_batch_keys_v2($1::jsonb)",
        [JSON.stringify(rotationPayload(
          rotationPairV3,
          rotationMaterialV3,
          rotationMaterialV2,
          2,
          rotationPairV2.fingerprint,
          3,
          "Enterprise E2E rotation racing a QA pass",
        ))],
      ).finally(() => { waitingRotationSettled = true; });
      await new Promise((resolve) => setTimeout(resolve, 75));
      assert.equal(waitingRotationSettled, false, "rotation must wait behind the QA purpose lock");
      await client.query("COMMIT");
      rotationQaTransactionOpen = false;
      await assert.rejects(waitingRotation, /supplier_key_rotation_qa_passed/);
    } finally {
      if (rotationQaTransactionOpen) await client.query("ROLLBACK");
    }
    const afterRejectedRotation = (await client.query(`SELECT
      (SELECT key_version FROM batch_keys WHERE id = $1::uuid) AS pair_version,
      (SELECT key_fingerprint FROM batch_keys WHERE id = $1::uuid) AS pair_fingerprint,
      (SELECT count(*)::integer FROM batch_key_material WHERE supplier_sub_batch_id = $2::uuid) AS material_count,
      (SELECT count(*)::integer FROM batch_key_material WHERE supplier_sub_batch_id = $2::uuid AND status = 'active') AS active_count,
      (SELECT count(*)::integer FROM evidence_events WHERE resource_id = $2::text AND event_type = 'batch_keys_rotated') AS event_count,
      (SELECT count(*)::integer FROM vault_artifacts WHERE supplier_sub_batch_id = $2::uuid AND artifact_type = 'batch_key_rotation_report') AS vault_count,
      (SELECT count(*)::integer FROM audit_logs WHERE resource_id = $2::text AND action = 'supplier_batch_keys_rotated') AS audit_count,
      (SELECT qa_status FROM supplier_sub_batches WHERE id = $2::uuid) AS qa_status`,
    [rotationPairId, rotationSupplierSubBatchId])).rows[0];
    assert.deepEqual({
      pair_version: afterRejectedRotation.pair_version,
      pair_fingerprint: afterRejectedRotation.pair_fingerprint,
      material_count: afterRejectedRotation.material_count,
      active_count: afterRejectedRotation.active_count,
      event_count: afterRejectedRotation.event_count,
      vault_count: afterRejectedRotation.vault_count,
      audit_count: afterRejectedRotation.audit_count,
    }, beforeRejectedRotation);
    assert.equal(afterRejectedRotation.qa_status, "passed");

    const { createSession, sessionCookieValue } = await import("../src/lib/iam.ts");
    const session = await createSession(query, {
      user: {
        id: userId,
        email: "enterprise-e2e@nexid.invalid",
        label: "Enterprise E2E Operator",
        admin_status: "active",
        role: "tenant_admin",
        tenant_id: tenantId,
        password_hash: "not-used-by-ephemeral-e2e",
        permissions: [
          "incidents:read",
          "incidents:write",
          "sdk:keys:read",
          "sdk:keys:write",
          "webhooks:read",
          "webhooks:write",
        ],
        mfa_enabled: false,
      },
      mfaVerified: true,
      ip: "127.0.0.1",
      userAgent: "nexid-enterprise-ephemeral-e2e",
    });
    const bearer = sessionCookieValue(String(session.id), session.secret);
    const adminHeaders = { authorization: `Bearer ${bearer}` };

    // Exercise the real admin API-key lifecycle against the disposable
    // database. The tenant in the request body is deliberately forged: the
    // verified tenant-admin principal must remain authoritative.
    const { POST: createSdkApiKey } = await import("../src/app/admin/sdk/api-keys/route.ts");
    const { DELETE: revokeSdkApiKey } = await import("../src/app/admin/sdk/api-keys/[id]/route.ts");
    const createKeyResponse = await createSdkApiKey(new Request("http://127.0.0.1/admin/sdk/api-keys", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        tenant: "enterprise-e2e-other",
        name: "Enterprise E2E verifier",
        scopes: ["sdk:verify"],
      }),
    }));
    assert.equal(createKeyResponse.status, 201);
    const createKeyPayload = await createKeyResponse.json();
    assert.equal(createKeyPayload.tenant.slug, tenantSlug);
    const apiKeyId = String(createKeyPayload.key.id);
    const apiKeySecret = String(createKeyPayload.secret);
    assert.match(apiKeySecret, /^nxid_live_[A-Za-z0-9_-]+$/);

    const { authenticateSdkRequest, hashSdkApiKey } = await import("../src/lib/sdk-auth.ts");
    const sdkAuthRequest = (headers = {}) => new Request("http://127.0.0.1/api/v1/sdk/verify", {
      headers: { "x-nexid-api-key": apiKeySecret, ...headers },
    });
    const verifiedSdkAuth = await authenticateSdkRequest(sdkAuthRequest(), "sdk:verify");
    assert.equal(verifiedSdkAuth.ok, true);
    assert.equal(verifiedSdkAuth.context.tenantId, tenantId);
    assert.equal(verifiedSdkAuth.context.tenantSlug, tenantSlug);

    const deniedSdkScope = await authenticateSdkRequest(sdkAuthRequest(), "sdk:claim");
    assert.equal(deniedSdkScope.ok, false);
    assert.equal(deniedSdkScope.response.status, 403);
    const wrongSdkTenant = await authenticateSdkRequest(
      sdkAuthRequest({ "x-nexid-tenant-slug": "enterprise-e2e-other" }),
      "sdk:verify",
    );
    assert.equal(wrongSdkTenant.ok, false);
    assert.equal(wrongSdkTenant.response.status, 401);

    const persistedApiKey = (await client.query(`SELECT key_hash, key_prefix, status, last_used_at
      FROM tenant_api_keys WHERE id = $1::uuid AND tenant_id = $2::uuid`, [apiKeyId, tenantId])).rows[0];
    assert.equal(persistedApiKey.key_hash, hashSdkApiKey(apiKeySecret));
    assert.notEqual(persistedApiKey.key_hash, apiKeySecret);
    assert.ok(persistedApiKey.last_used_at);

    // Atomic PostgreSQL reservations are exercised concurrently through the
    // control connection and the application pool, modelling independent
    // instances sharing the durable limiter without persisting raw dimensions.
    const { rateLimitBucketKey, reserveSunRateLimit } = await import("../src/lib/sun-rate-limit-store.ts");
    const distributedScope = "enterprise-e2e:distributed";
    const distributedScopeKey = `${tenantId}:sdk-key:${apiKeyId}:synthetic-source`;
    const distributedReservations = await Promise.all([
      reserveSunRateLimit(taggedExecutor(client), distributedScope, distributedScopeKey, 60, 2),
      reserveSunRateLimit(query, distributedScope, distributedScopeKey, 60, 2),
      reserveSunRateLimit(query, distributedScope, distributedScopeKey, 60, 2),
    ]);
    assert.deepEqual(distributedReservations.map((entry) => entry.hits).sort((a, b) => a - b), [1, 2, 3]);
    assert.equal(distributedReservations.filter((entry) => entry.limited).length, 1);
    const expectedDistributedKey = rateLimitBucketKey(distributedScope, distributedScopeKey);
    const distributedBucket = (await client.query(`SELECT scope, scope_key_hash, hit_count::integer AS hit_count
      FROM sun_rate_limit_buckets WHERE scope = $1`, [distributedScope])).rows[0];
    assert.equal(distributedBucket.scope_key_hash, expectedDistributedKey.scopeKeyHash);
    assert.equal(distributedBucket.hit_count, 3);
    assert.equal(JSON.stringify(distributedBucket).includes(distributedScopeKey), false);

    const { enforceSdkEpcisCaptureRateLimit } = await import("../src/lib/critical-rate-limit.ts");
    const epcisRateRequest = () => new Request("http://127.0.0.1/api/v1/sdk/epcis/capture", { method: "POST" });
    assert.equal(await enforceSdkEpcisCaptureRateLimit(epcisRateRequest(), { tenantId, apiKeyId }), null);
    assert.equal(await enforceSdkEpcisCaptureRateLimit(epcisRateRequest(), { tenantId, apiKeyId }), null);
    const limitedEpcisResponse = await enforceSdkEpcisCaptureRateLimit(epcisRateRequest(), { tenantId, apiKeyId });
    assert.equal(limitedEpcisResponse?.status, 429);
    assert.equal((await limitedEpcisResponse.json()).reason, "rate_limited");

    const otherTenantApiKeySecret = `nxid_live_${randomBytes(24).toString("base64url")}`;
    const otherTenantApiKeyId = (await client.query(`INSERT INTO tenant_api_keys (
      tenant_id, name, key_prefix, key_hash, scopes, status
    ) VALUES ($1::uuid, 'Other tenant key', $2, $3, '["sdk:verify"]'::jsonb, 'active')
    RETURNING id::text AS id`, [
      otherTenantId,
      otherTenantApiKeySecret.slice(0, 12),
      hashSdkApiKey(otherTenantApiKeySecret),
    ])).rows[0].id;
    const crossTenantKeyRevoke = await revokeSdkApiKey(
      new Request("http://127.0.0.1/admin/sdk/api-keys/cross-tenant", { method: "DELETE", headers: adminHeaders }),
      { params: Promise.resolve({ id: otherTenantApiKeyId }) },
    );
    assert.equal(crossTenantKeyRevoke.status, 404);

    const revokeKeyResponse = await revokeSdkApiKey(
      new Request(`http://127.0.0.1/admin/sdk/api-keys/${apiKeyId}`, { method: "DELETE", headers: adminHeaders }),
      { params: Promise.resolve({ id: apiKeyId }) },
    );
    assert.equal(revokeKeyResponse.status, 200);
    const revokedSdkAuth = await authenticateSdkRequest(sdkAuthRequest(), "sdk:verify");
    assert.equal(revokedSdkAuth.ok, false);
    assert.equal(revokedSdkAuth.response.status, 401);

    // Webhook lifecycle: tenant binding, one-time secret storage, optimistic
    // rotation, append-only audit, idempotent outbox, leased delivery and v2
    // signature verification. The transport is an in-process verifier, so no
    // DNS lookup, socket or external request can occur.
    const { POST: createWebhook } = await import("../src/app/admin/webhooks/route.ts");
    const { GET: readWebhook } = await import("../src/app/admin/webhooks/[id]/route.ts");
    const { POST: rotateWebhook } = await import("../src/app/admin/webhooks/[id]/rotate/route.ts");
    const forgedWebhookResponse = await createWebhook(new Request("http://127.0.0.1/admin/webhooks", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        tenant: "enterprise-e2e-other",
        name: "Forged tenant webhook",
        url: "https://webhook.enterprise-e2e.invalid/forged",
        enabled: false,
        events: ["sdk.verify"],
        signatureVersion: "v2",
      }),
    }));
    assert.equal(forgedWebhookResponse.status, 400);

    const webhookUrl = "https://webhook.enterprise-e2e.invalid/hooks/synthetic-secret";
    const createWebhookResponse = await createWebhook(new Request("http://127.0.0.1/admin/webhooks", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        tenant: tenantSlug,
        name: "Enterprise E2E webhook",
        url: webhookUrl,
        enabled: false,
        events: ["sdk.verify"],
        signatureVersion: "v2",
      }),
    }));
    assert.equal(createWebhookResponse.status, 201);
    const createWebhookPayload = await createWebhookResponse.json();
    const webhookEndpointId = String(createWebhookPayload.endpoint.id);
    const firstWebhookSecret = String(createWebhookPayload.secret);
    assert.match(firstWebhookSecret, /^whsec_[A-Za-z0-9_-]+$/);
    assert.equal(createWebhookPayload.endpoint.tenant_id, undefined);
    assert.match(createWebhookPayload.endpoint.url, /\/\[redacted\]/);

    const persistedWebhookBeforeRotation = (await client.query(`SELECT signing_secret, signing_secret_version,
      signing_secret_fingerprint, tenant_id::text AS tenant_id
      FROM webhook_endpoints WHERE id = $1::uuid`, [webhookEndpointId])).rows[0];
    assert.equal(persistedWebhookBeforeRotation.tenant_id, tenantId);
    assert.notEqual(persistedWebhookBeforeRotation.signing_secret, firstWebhookSecret);
    assert.match(persistedWebhookBeforeRotation.signing_secret, /^nexid:whsec:v1:/);
    assert.equal(Number(persistedWebhookBeforeRotation.signing_secret_version), 1);

    const rotateWebhookResponse = await rotateWebhook(new Request(
      `http://127.0.0.1/admin/webhooks/${webhookEndpointId}/rotate`,
      {
        method: "POST",
        headers: { ...adminHeaders, "content-type": "application/json" },
        body: JSON.stringify({ expectedSecretVersion: 1, overlapSeconds: 300 }),
      },
    ), { params: Promise.resolve({ id: webhookEndpointId }) });
    assert.equal(rotateWebhookResponse.status, 200);
    const rotateWebhookPayload = await rotateWebhookResponse.json();
    const rotatedWebhookSecret = String(rotateWebhookPayload.secret);
    assert.notEqual(rotatedWebhookSecret, firstWebhookSecret);
    assert.equal(Number(rotateWebhookPayload.endpoint.signing_secret_version), 2);
    assert.equal(Number(rotateWebhookPayload.endpoint.signing_secret_previous_version), 1);
    assert.equal(rotateWebhookPayload.endpoint.audit_committed, true);

    const staleRotationResponse = await rotateWebhook(new Request(
      `http://127.0.0.1/admin/webhooks/${webhookEndpointId}/rotate`,
      {
        method: "POST",
        headers: { ...adminHeaders, "content-type": "application/json" },
        body: JSON.stringify({ expectedSecretVersion: 1, overlapSeconds: 300 }),
      },
    ), { params: Promise.resolve({ id: webhookEndpointId }) });
    assert.equal(staleRotationResponse.status, 409);
    assert.equal((await staleRotationResponse.json()).reason, "webhook_secret_version_conflict");

    const webhookReadResponse = await readWebhook(
      new Request(`http://127.0.0.1/admin/webhooks/${webhookEndpointId}`, { headers: adminHeaders }),
      { params: Promise.resolve({ id: webhookEndpointId }) },
    );
    assert.equal(webhookReadResponse.status, 200);
    const webhookReadPayload = await webhookReadResponse.json();
    assert.equal(webhookReadPayload.history.length, 2);
    assert.equal(JSON.stringify(webhookReadPayload).includes(firstWebhookSecret), false);
    assert.equal(JSON.stringify(webhookReadPayload).includes(rotatedWebhookSecret), false);

    await assert.rejects(
      () => client.query(`INSERT INTO webhook_endpoint_audit_events (
        endpoint_id, tenant_id, event_type
      ) VALUES ($1::uuid, $2::uuid, 'webhook_endpoint_updated')`, [webhookEndpointId, otherTenantId]),
      (error) => error?.code === "23503",
    );
    await assert.rejects(
      () => client.query(`UPDATE webhook_endpoint_audit_events
        SET metadata_json = '{"tampered":true}'::jsonb WHERE endpoint_id = $1::uuid`, [webhookEndpointId]),
      (error) => error?.code === "55000",
    );

    // Fixture-only activation bypasses DNS preflight solely so the durable
    // worker can be exercised with the injected no-network transport below.
    await client.query(`UPDATE webhook_endpoints
      SET enabled = true, disabled_at = NULL, disabled_by = NULL, updated_at = now()
      WHERE id = $1::uuid AND tenant_id = $2::uuid`, [webhookEndpointId, tenantId]);
    const {
      claimWebhookDeliveries,
      dispatchTenantWebhooks,
      processClaimedWebhookDelivery,
    } = await import("../src/lib/sdk-webhooks.ts");
    const webhookDispatch = await dispatchTenantWebhooks({
      tenantId,
      eventName: "sdk.verify",
      payload: { bid, verdict: "VALID", physical_custody_verified: false },
      idempotencyKey: "enterprise-e2e-webhook-001",
    });
    const webhookReplay = await dispatchTenantWebhooks({
      tenantId,
      eventName: "sdk.verify",
      payload: { bid, verdict: "VALID", physical_custody_verified: false },
      idempotencyKey: "enterprise-e2e-webhook-001",
    });
    assert.equal(webhookDispatch.queued, 1);
    assert.equal(webhookDispatch.deduplicated, 0);
    assert.equal(webhookReplay.queued, 0);
    assert.equal(webhookReplay.deduplicated, 1);
    assert.equal(webhookReplay.eventId, webhookDispatch.eventId);

    const claimedWebhooks = await claimWebhookDeliveries(10);
    assert.equal(claimedWebhooks.length, 1);
    const webhookDeliveryId = String(claimedWebhooks[0].id);
    const { verifyNexIdWebhookSignature } = await import("../../../packages/sdk/src/index.ts");
    let inProcessWebhookDeliveries = 0;
    const processedWebhook = await processClaimedWebhookDelivery(claimedWebhooks[0], {
      deliver: async (delivery) => {
        inProcessWebhookDeliveries += 1;
        assert.equal(delivery.url, webhookUrl);
        const timestamp = Number(delivery.headers["x-nexid-timestamp"]);
        const verification = verifyNexIdWebhookSignature({
          secret: rotatedWebhookSecret,
          rawBody: delivery.body,
          headers: delivery.headers,
          now: timestamp,
        });
        assert.equal(verification.ok, true);
        assert.equal(verification.version, "v2");
        assert.equal(verification.keyIdAuthenticated, true);
        assert.equal(verification.deliveryId, webhookDeliveryId);
        assert.equal(verification.eventId, webhookDispatch.eventId);
        const payload = JSON.parse(delivery.body);
        assert.equal(payload.schemaVersion, "1.0");
        assert.equal(payload.data.physical_custody_verified, false);
        return { statusCode: 204 };
      },
    });
    assert.equal(inProcessWebhookDeliveries, 1);
    assert.equal(processedWebhook.ok, true);
    assert.equal(processedWebhook.status, "delivered");
    const durableWebhookDelivery = (await client.query(`SELECT status, ok, status_code, attempt_count,
      delivered_at, lock_token FROM webhook_deliveries WHERE id::text = $1`, [webhookDeliveryId])).rows[0];
    assert.equal(durableWebhookDelivery.status, "delivered");
    assert.equal(durableWebhookDelivery.ok, true);
    assert.equal(durableWebhookDelivery.status_code, 204);
    assert.equal(durableWebhookDelivery.attempt_count, 1);
    assert.ok(durableWebhookDelivery.delivered_at);
    assert.equal(durableWebhookDelivery.lock_token, null);

    const { GET: openEventStream } = await import("../src/app/admin/events/stream/route.ts");
    const streamResponse = await openEventStream(new Request(
      `http://127.0.0.1/admin/events/stream?tenant=${tenantSlug}&source=production&window=5m`,
      { headers: adminHeaders, signal: abortStream.signal },
    ));
    sseProbe = new SseProbe(streamResponse);
    const initialSnapshot = await sseProbe.next((entry) => entry.event === "snapshot");
    assert.equal(initialSnapshot.data.availability, "ready");

    const { generateSunParams } = await import("../src/lib/crypto/sdm.ts");
    const sun = generateSunParams({ uidHex, ctr: 1, kMetaHex, kFileHex });
    const { processSunScan } = await import("../src/lib/sun-service.ts");
    const scan = await processSunScan({
      bid,
      ...sun,
      rawQuery: {
        bid,
        picc_data: sun.piccDataHex,
        enc: sun.encHex,
        cmac: sun.cmacHex,
        safe_fixture_label: "enterprise-e2e",
      },
      context: {
        requestId: "enterprise-e2e-tap-001",
        source: "real",
        userAgent: "nexid-enterprise-ephemeral-e2e",
        city: "Rosario",
        countryCode: "AR",
        lat: -32.95,
        lng: -60.66,
        deviceLabel: "ephemeral-e2e-reader",
        meta: { trace_id: "enterprise-e2e-tap-001", fixture: true },
      },
      sideEffectMode: "persist",
    });
    assert.equal(scan.status, 200);
    assert.equal(scan.body.ok, true);
    assert.equal(scan.body.cryptographic_verification, true);
    assert.equal(scan.body.allowlisted, true);
    assert.equal(scan.body.result, "VALID");
    const eventId = Number(scan.body.event_id);
    assert.ok(Number.isSafeInteger(eventId) && eventId > 0);

    const tapSse = await sseProbe.next((entry) => (
      entry.event === "event" && String(entry.data.eventId || "") === String(eventId)
    ));
    assert.equal(tapSse.data.tenantSlug, tenantSlug);
    assert.equal(tapSse.data.eventSource, "real");
    assert.equal(Object.hasOwn(tapSse.data, "uidHex"), false);
    assert.match(String(tapSse.data.uidMasked || ""), /\*{4}/);

    const { GET: pollEvents } = await import("../src/app/admin/events/route.ts");
    const pollResponse = await pollEvents(new Request(
      `http://127.0.0.1/admin/events?tenant=${tenantSlug}&source=real&limit=10`,
      { headers: adminHeaders },
    ));
    assert.equal(pollResponse.status, 200);
    const polled = await pollResponse.json();
    const polledEvent = polled.rows.find((row) => String(row.id) === String(eventId));
    assert.ok(polledEvent, "polling route must expose the committed tenant event");
    assert.equal(polledEvent.tenantSlug, tenantSlug);

    const { POST: openIncident } = await import("../src/app/admin/incidents/route.ts");
    const incidentBody = {
      tenantSlug,
      eventId: String(eventId),
      severity: "high",
      title: "Enterprise E2E custody review",
      summary: "Synthetic, isolated incident created from a cryptographically verified ephemeral SUN tap.",
      reason: "exercise durable event to ticket workflow",
    };
    const incidentResponse = await openIncident(new Request("http://127.0.0.1/admin/incidents", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify(incidentBody),
    }));
    const incidentPayload = await incidentResponse.json();
    assert.equal(
      incidentResponse.status,
      201,
      `incident_create_failed:${String(incidentPayload?.reason || incidentPayload?.error || "unknown")}`,
    );
    const incident = incidentPayload.incident;
    assert.equal(incident.tenantSlug, tenantSlug);
    assert.equal(incident.eventId, String(eventId));
    assert.ok(incident.ticketId);

    const incidentSse = await sseProbe.next((entry) => (
      entry.event === "event"
      && entry.data.event_type === "incident.created"
      && entry.data.incident_id === incident.id
    ));
    assert.equal(incidentSse.data.ticket_id, incident.ticketId);
    assert.equal(incidentSse.data.tenant_slug, tenantSlug);

    const { GET: pollIncidents } = await import("../src/app/admin/incidents/route.ts");
    const incidentPollResponse = await pollIncidents(new Request(
      `http://127.0.0.1/admin/incidents?tenant=${tenantSlug}&eventId=${eventId}`,
      { headers: adminHeaders },
    ));
    assert.equal(incidentPollResponse.status, 200);
    const incidentPoll = await incidentPollResponse.json();
    assert.equal(incidentPoll.count, 1);
    assert.equal(incidentPoll.incidents[0].ticketId, incident.ticketId);

    const idempotentResponse = await openIncident(new Request("http://127.0.0.1/admin/incidents", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify(incidentBody),
    }));
    assert.equal(idempotentResponse.status, 200);
    const idempotentPayload = await idempotentResponse.json();
    assert.equal(idempotentPayload.incident.id, incident.id);
    assert.equal(idempotentPayload.incident.ticketId, incident.ticketId);
    assert.equal(idempotentPayload.incident.idempotentReplay, true);

    // Current operational signals must not lose an unresolved incident merely
    // because it aged out of the selected SLI cohort. This fixture deliberately
    // places the still-open incident just beyond the largest bounded window.
    await client.query(`UPDATE event_incidents
      SET created_at = now() - interval '31 days',
          opened_at = now() - interval '31 days',
          updated_at = now() - interval '31 days'
      WHERE id = $1`, [incident.id]);
    const { buildServiceLevelSnapshot } = await import("../src/lib/service-level-observability.ts");
    const serviceLevels = await buildServiceLevelSnapshot({ tenantId, window: "30d" });
    const incidentService = serviceLevels.services.find((service) => service.id === "incidents");
    assert.equal(incidentService?.availability, "ready");
    const openHighCritical = incidentService.signals.find((signal) => signal.id === "incidents.open_high_critical_count");
    const oldestOpen = incidentService.signals.find((signal) => signal.id === "incidents.oldest_open_age");
    assert.equal(openHighCritical?.value, 1);
    assert.ok(Number(oldestOpen?.value || 0) >= 31 * 24 * 60 * 60);

    const forbiddenTenantResponse = await openIncident(new Request("http://127.0.0.1/admin/incidents", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ...incidentBody, tenantSlug: "enterprise-e2e-other" }),
    }));
    assert.equal(forbiddenTenantResponse.status, 403);

    const databaseEvidence = (await client.query(`SELECT
      e.result, e.verdict, e.event_type::text AS event_type, e.cmac_ok, e.allowlisted,
      e.raw_query, t.scan_count, t.last_seen_ctr,
      (SELECT count(*)::integer FROM event_incidents WHERE event_id = e.id) AS incident_count,
      (SELECT count(*)::integer FROM tickets WHERE tap_event_id = e.id AND tenant_id = e.tenant_id) AS ticket_count,
      (SELECT count(*)::integer FROM event_incident_history h
        JOIN event_incidents i ON i.id = h.incident_id
        WHERE i.event_id = e.id) AS history_count
      FROM events e
      JOIN tags t ON t.id = e.tag_id
      WHERE e.id = $1 AND e.tenant_id = $2`, [eventId, tenantId])).rows[0];
    assert.equal(databaseEvidence.result, "VALID");
    assert.equal(databaseEvidence.verdict, "valid");
    assert.equal(databaseEvidence.event_type, "TAP_VALID");
    assert.equal(databaseEvidence.cmac_ok, true);
    assert.equal(databaseEvidence.allowlisted, true);
    assert.equal(Number(databaseEvidence.scan_count), 1);
    assert.equal(Number(databaseEvidence.last_seen_ctr), 1);
    assert.equal(Number(databaseEvidence.incident_count), 1);
    assert.equal(Number(databaseEvidence.ticket_count), 1);
    assert.equal(Number(databaseEvidence.history_count), 1);
    assert.equal(databaseEvidence.raw_query.picc_data, "[redacted_sun_dynamic]");
    assert.equal(databaseEvidence.raw_query.enc, "[redacted_sun_dynamic]");
    assert.equal(databaseEvidence.raw_query.cmac, "[redacted_sun_dynamic]");
    assert.equal(databaseEvidence.raw_query.safe_fixture_label, "enterprise-e2e");

    const crossTenantRows = await client.query(`SELECT count(*)::integer AS count
      FROM event_incidents WHERE tenant_id = $1`, [otherTenantId]);
    assert.equal(Number(crossTenantRows.rows[0]?.count || 0), 0);

    const enterpriseSecurityEvidence = (await client.query(`SELECT
      (SELECT status FROM tenant_api_keys WHERE id = $1::uuid AND tenant_id = $2::uuid) AS api_key_status,
      (SELECT status FROM tenant_api_keys WHERE id = $3::uuid AND tenant_id = $4::uuid) AS other_api_key_status,
      (SELECT count(*)::integer FROM webhook_endpoints WHERE id = $5::uuid AND tenant_id = $2::uuid) AS webhook_count,
      (SELECT count(*)::integer FROM webhook_endpoint_audit_events
        WHERE endpoint_id = $5::uuid AND tenant_id = $2::uuid) AS webhook_audit_count,
      (SELECT count(*)::integer FROM webhook_deliveries
        WHERE id::text = $6 AND endpoint_id = $5::uuid AND status = 'delivered') AS webhook_delivery_count,
      (SELECT payload #>> '{data,physical_custody_verified}' FROM webhook_deliveries
        WHERE id::text = $6 AND endpoint_id = $5::uuid) AS physical_custody_verified,
      (SELECT count(*)::integer FROM sun_rate_limit_buckets
        WHERE scope = 'enterprise-e2e:distributed'
           OR scope LIKE 'fleet:sdk_epcis_capture:%') AS distributed_rate_bucket_count`, [
      apiKeyId,
      tenantId,
      otherTenantApiKeyId,
      otherTenantId,
      webhookEndpointId,
      webhookDeliveryId,
    ])).rows[0];
    assert.equal(enterpriseSecurityEvidence.api_key_status, "revoked");
    assert.equal(enterpriseSecurityEvidence.other_api_key_status, "active");
    assert.equal(Number(enterpriseSecurityEvidence.webhook_count), 1);
    assert.equal(Number(enterpriseSecurityEvidence.webhook_audit_count), 2);
    assert.equal(Number(enterpriseSecurityEvidence.webhook_delivery_count), 1);
    assert.equal(enterpriseSecurityEvidence.physical_custody_verified, "false");
    assert.ok(Number(enterpriseSecurityEvidence.distributed_rate_bucket_count) >= 4);

    console.log(JSON.stringify({
      ok: true,
      harness: "enterprise_ephemeral_e2e_v1",
      target: emptyTarget,
      migrations: { expected: expectedMigrationCount, applied: Number(ledger.rows[0].count) },
      boundaries: {
        sun_crypto: "production_cmac_sdm_code_with_synthetic_inputs",
        sun_atomic_event: "committed",
        sse_tenant_projection: "observed",
        polling_tenant_projection: "observed",
        incident: "committed",
        ticket: "committed",
        incident_history: "committed",
        incident_idempotency: "replayed_without_duplicate",
        aged_open_incident_signal: "visible_beyond_selected_sli_window",
        cross_tenant_mutation: "rejected",
        dynamic_sun_query_values: "redacted",
        api_key_lifecycle: "created_authenticated_scope_checked_tenant_bound_revoked",
        webhook_secret_storage: "software_envelope_encrypted_tenant_bound",
        webhook_lifecycle: "created_rotated_audited_and_stale_rotation_rejected",
        webhook_delivery: "leased_v2_signature_verified_and_committed_without_network",
        webhook_idempotency: "replayed_without_duplicate",
        distributed_rate_limit: "atomic_postgresql_budget_enforced_and_raw_dimensions_hashed",
        supplier_qa_verification_context_v2: "concurrent_stale_binding_rejected_before_evidence_consumption",
        supplier_key_rotation_v2: "eligible_2_2_1_1_1_committed_then_qa_race_rejected_without_effects",
        custody_boundary: "digital_event_explicitly_does_not_certify_physical_custody",
      },
      evidence_class: "synthetic_ephemeral_software_fixture",
      key_custody: {
        nfc_batch_key_envelope: "application_aes_256_gcm_with_process_secret",
        managed_kms: false,
        hsm_backed: false,
      },
      counts: {
        events: 1,
        incidents: Number(databaseEvidence.incident_count),
        tickets: Number(databaseEvidence.ticket_count),
        incident_history: Number(databaseEvidence.history_count),
        api_keys: 2,
        webhook_endpoints: Number(enterpriseSecurityEvidence.webhook_count),
        webhook_deliveries: Number(enterpriseSecurityEvidence.webhook_delivery_count),
        webhook_audit_events: Number(enterpriseSecurityEvidence.webhook_audit_count),
        distributed_rate_buckets: Number(enterpriseSecurityEvidence.distributed_rate_bucket_count),
      },
      external_effects: false,
      webhook_delivery_transport: "in_process_signature_verified_no_network",
      physical_nfc_tag_scanned: false,
      physical_tag_certification: false,
      tagtamper_physical_certification: false,
    }));
  } finally {
    abortStream.abort();
    if (sseProbe) await sseProbe.close();
    uninstallSqlExecutor();
    await appPool.end();
    await client.end();
  }
}

run().catch((error) => {
  const rawReason = error instanceof Error ? error.message : "enterprise_ephemeral_e2e_failed";
  const reason = rawReason
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted_database_url]")
    .replaceAll(config?.databaseUrl || "__no_configured_database_url__", "[redacted_database_url]")
    .slice(0, 500);
  console.error(JSON.stringify({ ok: false, harness: "enterprise_ephemeral_e2e_v1", reason }));
  process.exitCode = 1;
});
