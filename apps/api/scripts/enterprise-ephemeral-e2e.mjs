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
import { startEnterpriseEphemeralHttpHarness } from "./lib/enterprise-ephemeral-http.mjs";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { Client, Pool } = pg;
let config = null;

function taggedExecutor(client, { observeStatement } = {}) {
  return async (strings, ...values) => {
    let statement = strings[0] || "";
    for (let index = 0; index < values.length; index += 1) {
      statement += `$${index + 1}${strings[index + 1] || ""}`;
    }
    observeStatement?.({ statement, values: [...values] });
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
  process.env.SDK_IDEMPOTENCY_MASTER_KEY_HEX = randomBytes(32).toString("hex");
  process.env.SDK_IDEMPOTENCY_MASTER_KEY_ID = "ephemeral-e2e-v1";
  delete process.env.SDK_IDEMPOTENCY_PREVIOUS_KEYS_JSON;

  const client = new Client({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5_000 });
  await client.connect();
  const appPool = new Pool({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
    query_timeout: 6_000,
    max: 4,
  });
  const consumerNetworkSqlCaptures = new Map();
  let activeConsumerNetworkSqlLabel = null;
  const query = taggedExecutor(appPool, {
    observeStatement({ statement, values }) {
      if (
        !activeConsumerNetworkSqlLabel
        || !/\bWITH\s+tenant_scope\s+AS\s*\(/i.test(statement)
        || !/\bevent_evidence_candidates\s+AS\s*\(/i.test(statement)
      ) return;
      assert.equal(
        consumerNetworkSqlCaptures.has(activeConsumerNetworkSqlLabel),
        false,
        `consumer-network ${activeConsumerNetworkSqlLabel} must execute exactly one aggregate SQL statement`,
      );
      consumerNetworkSqlCaptures.set(activeConsumerNetworkSqlLabel, { statement, values });
    },
  });
  const { installEphemeralE2eSqlExecutor } = await import("../src/lib/db.ts");
  const uninstallSqlExecutor = installEphemeralE2eSqlExecutor(query, process.env);
  const abortStream = new AbortController();
  let sseProbe = null;
  let httpHarness = null;

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
    const otherTenantUserId = "56565656-5656-4656-8656-565656565656";
    const packagingApproverUserId = "57575757-5757-4757-8757-575757575757";
    const superAdminUserId = "58585858-5858-4858-8858-585858585858";
    const supplierDeniedUserId = "59595959-5959-4959-8959-595959595959";
    const tenantSlug = "enterprise-e2e";
    const otherTenantSlug = "enterprise-e2e-other";
    const bid = "E2E-ENTERPRISE-001";
    const uidHex = "0487856A0B1090";
    const consumerNetworkFixture = {
      tenantA: {
        tenantId,
        slug: tenantSlug,
        marker: "CN-E2E-A",
        batchId: "19191919-1919-4191-8191-191919191919",
        bid: "CN-E2E-A-BATCH",
        operational: {
          eventId: 910000001,
          tagId: "a1010101-0101-4101-8101-010101010101",
          uidHex: "04A10101010101",
          consumerId: "a3030303-0303-4303-8303-030303030303",
          productId: "a5050505-0505-4505-8505-050505050505",
          ownershipId: "a7070707-0707-4707-8707-070707070707",
        },
        demo: {
          eventId: 910000002,
          tagId: "a2020202-0202-4202-8202-020202020202",
          uidHex: "04A20202020202",
          consumerId: "a4040404-0404-4404-8404-040404040404",
          productId: "a6060606-0606-4606-8606-060606060606",
        },
      },
      tenantB: {
        tenantId: otherTenantId,
        slug: otherTenantSlug,
        marker: "CN-E2E-B",
        batchId: "29292929-2929-4292-8292-292929292929",
        bid: "CN-E2E-B-BATCH",
        operational: {
          eventId: 920000001,
          tagId: "b1010101-0101-4101-8101-010101010101",
          uidHex: "04B10101010101",
          consumerId: "b3030303-0303-4303-8303-030303030303",
          productId: "b5050505-0505-4505-8505-050505050505",
          ownershipId: "b7070707-0707-4707-8707-070707070707",
        },
        demo: {
          eventId: 920000002,
          tagId: "b2020202-0202-4202-8202-020202020202",
          uidHex: "04B20202020202",
          consumerId: "b4040404-0404-4404-8404-040404040404",
          productId: "b6060606-0606-4606-8606-060606060606",
        },
      },
    };
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
      id, tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config, carrier_profile_code
    ) VALUES ($1, $2, $3, 'active', $4, $5, $6::jsonb, 'ntag424_dna')`, [
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
      id, batch_id, uid_hex, status, lifecycle_state, lifecycle_revision, carrier_profile_code
    ) VALUES ($1, $2, $3, 'active', 'active', 0, 'ntag424_dna')`, [tagId, batchId, uidHex]);
    await client.query(`INSERT INTO tag_profiles (
      tag_id, sku, product_name, region, winery, notes, locale_data
    ) VALUES (
      $1::uuid, 'E2E-AGRO-001', 'Enterprise ephemeral fixture',
      'Rosario, Santa Fe', 'Enterprise E2E Agro',
      'Synthetic disposable product profile for the isolated HTTP acceptance harness.',
      '{"vertical":"agro","evidence_class":"synthetic_ephemeral_software_fixture"}'::jsonb
    )`, [tagId]);

    await client.query(`INSERT INTO batches (
      id, tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config
    ) VALUES
      ($1::uuid, $2::uuid, $3, 'active', NULL, NULL, $4::jsonb),
      ($5::uuid, $6::uuid, $7, 'active', NULL, NULL, $8::jsonb)`, [
      consumerNetworkFixture.tenantA.batchId,
      consumerNetworkFixture.tenantA.tenantId,
      consumerNetworkFixture.tenantA.bid,
      JSON.stringify({ fixture: "consumer-network-ephemeral-e2e", tenant: "A" }),
      consumerNetworkFixture.tenantB.batchId,
      consumerNetworkFixture.tenantB.tenantId,
      consumerNetworkFixture.tenantB.bid,
      JSON.stringify({ fixture: "consumer-network-ephemeral-e2e", tenant: "B" }),
    ]);

    for (const fixtureTenant of Object.values(consumerNetworkFixture)) {
      for (const eventClass of ["operational", "demo"]) {
        const fixtureEvent = fixtureTenant[eventClass];
        await client.query(`INSERT INTO tags (
          id, batch_id, uid_hex, status, lifecycle_state, lifecycle_revision
        ) VALUES ($1::uuid, $2::uuid, $3, 'active', 'active', 0)`, [
          fixtureEvent.tagId,
          fixtureTenant.batchId,
          fixtureEvent.uidHex,
        ]);
      }
    }

    await client.query(`INSERT INTO consumers (
      id, email, phone, display_name, preferred_locale, country, city, status
    ) VALUES
      ($1::uuid, 'cn-e2e-a-operational@nexid.invalid', '+5491100000101', 'CN-E2E-A Operational Actor', 'es-AR', 'AR', 'Tenant A City', 'verified'),
      ($2::uuid, 'cn-e2e-a-demo@nexid.invalid', '+5491100000102', 'CN-E2E-A Demo Actor', 'es-AR', 'AR', 'Tenant A City', 'registered'),
      ($3::uuid, 'cn-e2e-b-operational@nexid.invalid', '+5491100000201', 'CN-E2E-B Operational Actor', 'es-AR', 'AR', 'Tenant B City', 'verified'),
      ($4::uuid, 'cn-e2e-b-demo@nexid.invalid', '+5491100000202', 'CN-E2E-B Demo Actor', 'es-AR', 'AR', 'Tenant B City', 'registered')`, [
      consumerNetworkFixture.tenantA.operational.consumerId,
      consumerNetworkFixture.tenantA.demo.consumerId,
      consumerNetworkFixture.tenantB.operational.consumerId,
      consumerNetworkFixture.tenantB.demo.consumerId,
    ]);

    const consumerNetworkEvents = [
      {
        fixtureTenant: consumerNetworkFixture.tenantA,
        fixtureEvent: consumerNetworkFixture.tenantA.operational,
        eventClass: "operational",
        ageMinutes: 8,
      },
      {
        fixtureTenant: consumerNetworkFixture.tenantA,
        fixtureEvent: consumerNetworkFixture.tenantA.demo,
        eventClass: "demo",
        ageMinutes: 7,
      },
      {
        fixtureTenant: consumerNetworkFixture.tenantB,
        fixtureEvent: consumerNetworkFixture.tenantB.operational,
        eventClass: "operational",
        ageMinutes: 6,
      },
      {
        fixtureTenant: consumerNetworkFixture.tenantB,
        fixtureEvent: consumerNetworkFixture.tenantB.demo,
        eventClass: "demo",
        ageMinutes: 5,
      },
    ];
    for (const { fixtureTenant, fixtureEvent, eventClass, ageMinutes } of consumerNetworkEvents) {
      const operational = eventClass === "operational";
      await client.query(`INSERT INTO events (
        id, tenant_id, batch_id, tenant_slug, tag_id, uid_hex, bid,
        event_type, result, verdict, risk_level, cmac_ok, allowlisted, tag_status,
        source, meta, product_name, created_at
      ) VALUES (
        $1::bigint, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7,
        'TAP_VALID', 'VALID', 'valid', 'none', true, true, 'active',
        $8, $9::jsonb, $10, now() - ($11::integer * interval '1 minute')
      )`, [
        fixtureEvent.eventId,
        fixtureTenant.tenantId,
        fixtureTenant.batchId,
        fixtureTenant.slug,
        fixtureEvent.tagId,
        fixtureEvent.uidHex,
        fixtureTenant.bid,
        operational ? "real" : "demo",
        JSON.stringify(operational ? {
          fixture: "consumer-network-ephemeral-e2e",
          fixture_tenant: fixtureTenant.marker,
          replay_execution_class: "operational",
          simulated: false,
        } : {
          fixture: "consumer-network-ephemeral-e2e",
          fixture_tenant: fixtureTenant.marker,
          event_mode: "demo",
          demoEmitter: true,
          simulated: true,
        }),
        `${fixtureTenant.marker}-${eventClass.toUpperCase()}`,
        ageMinutes,
      ]);
    }

    await client.query(`INSERT INTO tenant_consumer_memberships (
      tenant_id, consumer_id, status, source, first_tap_event_id, last_tap_event_id,
      points_balance, lifetime_points, metadata_json
    ) VALUES
      ($1::uuid, $2::uuid, 'active', 'tap', $3::bigint, $3::bigint, 11, 111, $4::jsonb),
      ($1::uuid, $5::uuid, 'active', 'demo_login', $6::bigint, $6::bigint, 12, 112, $4::jsonb),
      ($7::uuid, $8::uuid, 'active', 'tap', $9::bigint, $9::bigint, 21, 221, $10::jsonb),
      ($7::uuid, $11::uuid, 'active', 'demo_login', $12::bigint, $12::bigint, 22, 222, $10::jsonb)`, [
      consumerNetworkFixture.tenantA.tenantId,
      consumerNetworkFixture.tenantA.operational.consumerId,
      consumerNetworkFixture.tenantA.operational.eventId,
      JSON.stringify({ fixture: "consumer-network-ephemeral-e2e", tenant: "A" }),
      consumerNetworkFixture.tenantA.demo.consumerId,
      consumerNetworkFixture.tenantA.demo.eventId,
      consumerNetworkFixture.tenantB.tenantId,
      consumerNetworkFixture.tenantB.operational.consumerId,
      consumerNetworkFixture.tenantB.operational.eventId,
      JSON.stringify({ fixture: "consumer-network-ephemeral-e2e", tenant: "B" }),
      consumerNetworkFixture.tenantB.demo.consumerId,
      consumerNetworkFixture.tenantB.demo.eventId,
    ]);

    for (const fixtureTenant of Object.values(consumerNetworkFixture)) {
      for (const eventClass of ["operational", "demo"]) {
        const fixtureEvent = fixtureTenant[eventClass];
        await client.query(`INSERT INTO consumer_tap_history (
          consumer_id, tenant_id, tap_event_id, product_passport_id, tag_id,
          verdict, risk_level, city, country, created_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::bigint, $4, $5::uuid,
          'valid', 'none', $6, 'AR', now() - interval '2 minutes'
        )`, [
          fixtureEvent.consumerId,
          fixtureTenant.tenantId,
          fixtureEvent.eventId,
          fixtureEvent.uidHex,
          fixtureEvent.tagId,
          fixtureTenant.marker === "CN-E2E-A" ? "Tenant A City" : "Tenant B City",
        ]);
        await client.query(`INSERT INTO consumer_products (
          id, consumer_id, tenant_id, product_passport_id, tag_id,
          first_tap_event_id, latest_tap_event_id, ownership_status, collection_type,
          product_name, brand_name, acquired_at, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, $5::uuid,
          $6::bigint, $6::bigint, $7, 'test_fixture',
          $8, 'nexID ephemeral E2E', now() - interval '2 minutes', now() - interval '1 minute'
        )`, [
          fixtureEvent.productId,
          fixtureEvent.consumerId,
          fixtureTenant.tenantId,
          fixtureEvent.uidHex,
          fixtureEvent.tagId,
          fixtureEvent.eventId,
          eventClass === "operational" ? "claimed" : "viewed",
          `${fixtureTenant.marker}-${eventClass.toUpperCase()}`,
        ]);
      }
      await client.query(`INSERT INTO consumer_product_ownerships (
        id, tenant_id, consumer_id, batch_id, tag_id, uid_hex, event_id,
        status, source, trust_snapshot
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7::bigint,
        'claimed', 'admin', $8::jsonb
      )`, [
        fixtureTenant.operational.ownershipId,
        fixtureTenant.tenantId,
        fixtureTenant.operational.consumerId,
        fixtureTenant.batchId,
        fixtureTenant.operational.tagId,
        fixtureTenant.operational.uidHex,
        fixtureTenant.operational.eventId,
        JSON.stringify({ fixture: "consumer-network-ephemeral-e2e", physical_presence_claim: "not_asserted" }),
      ]);
    }

    await client.query(`INSERT INTO users (id, email, full_name, admin_status) VALUES
      ($1, 'enterprise-e2e@nexid.invalid', 'Enterprise E2E Operator', 'active'),
      ($2, 'enterprise-e2e-other@nexid.invalid', 'Other Tenant E2E Operator', 'active'),
      ($3, 'enterprise-e2e-approver@nexid.invalid', 'Enterprise E2E Packaging Approver', 'active'),
      ($4, 'enterprise-e2e-superadmin@nexid.invalid', 'Enterprise E2E Super Admin', 'active')`, [
      userId,
      otherTenantUserId,
      packagingApproverUserId,
      superAdminUserId,
    ]);
    await client.query(`INSERT INTO memberships (user_id, tenant_id, role) VALUES
      ($1, $2, 'tenant_admin'),
      ($3, $4, 'tenant_admin'),
      ($5, $2, 'tenant_admin'),
      ($6, NULL, 'super_admin')`, [
      userId,
      tenantId,
      otherTenantUserId,
      otherTenantId,
      packagingApproverUserId,
      superAdminUserId,
    ]);
    await client.query(`INSERT INTO resource_permissions (user_id, tenant_id, resource, action, effect) VALUES
      ($1, $4, 'incidents', 'read', 'allow'),
      ($1, $4, 'incidents', 'write', 'allow'),
      ($1, $4, 'sdk:keys', 'read', 'allow'),
       ($1, $4, 'sdk:keys', 'write', 'allow'),
       ($1, $4, 'webhooks', 'read', 'allow'),
       ($1, $4, 'webhooks', 'write', 'allow'),
       ($2, $4, 'supplier', 'approve_packaging', 'allow'),
       ($3, $5, 'webhooks', 'read', 'allow')`, [userId, packagingApproverUserId, otherTenantUserId, tenantId, otherTenantId]);
    await client.query(`INSERT INTO users (id, email, full_name, admin_status)
      VALUES ($1::uuid, 'enterprise-e2e-supplier-denied@nexid.invalid', 'Enterprise E2E Supplier Denied', 'active')`,
    [supplierDeniedUserId]);
    await client.query(`INSERT INTO memberships (user_id, tenant_id, role)
      VALUES ($1::uuid, $2::uuid, 'tenant_admin')`, [supplierDeniedUserId, tenantId]);
    await client.query(`INSERT INTO resource_permissions (user_id, tenant_id, resource, action, effect)
      VALUES ($1::uuid, $2::uuid, 'supplier_orders', 'write', 'deny')`, [supplierDeniedUserId, tenantId]);
    await client.query(`INSERT INTO tenant_sun_profiles (
      tenant_id, vertical, club_name, product_label, origin_label, origin_address,
      origin_lat, origin_lng, tokenization_mode, claim_policy, ownership_policy,
      manifest_policy, metadata
    ) VALUES (
      $1::uuid, 'agro', 'Enterprise E2E Agro', 'Secure agrochemical',
      'Rosario packaging line', 'Rosario, Santa Fe, Argentina',
      -32.95, -60.66, 'manual', 'purchase_proof_required',
      '{"proof_required":true}'::jsonb, '{"manifest_required":true}'::jsonb,
      '{"setup_completed":true,"fixture":"enterprise_ephemeral_http"}'::jsonb
    )`, [tenantId]);

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
    async function issueHumanSession({ id, email, label, role, tenantId: sessionTenantId, permissions = [] }) {
      const issued = await createSession(query, {
        user: {
          id,
          email,
          label,
          admin_status: "active",
          role,
          tenant_id: sessionTenantId,
          password_hash: "not-used-by-ephemeral-e2e",
          permissions,
          mfa_enabled: false,
        },
        mfaVerified: true,
        ip: "127.0.0.1",
        userAgent: "nexid-enterprise-ephemeral-e2e",
      });
      return sessionCookieValue(String(issued.id), issued.secret);
    }
    const bearer = await issueHumanSession({
      id: userId,
      email: "enterprise-e2e@nexid.invalid",
      label: "Enterprise E2E Operator",
      role: "tenant_admin",
      tenantId,
      permissions: [
        "incidents:read",
        "incidents:write",
        "sdk:keys:read",
        "sdk:keys:write",
        "webhooks:read",
        "webhooks:write",
      ],
    });
    const otherTenantBearer = await issueHumanSession({
      id: otherTenantUserId,
      email: "enterprise-e2e-other@nexid.invalid",
      label: "Other Tenant E2E Operator",
      role: "tenant_admin",
      tenantId: otherTenantId,
      permissions: ["webhooks:read"],
    });
    const packagingApproverBearer = await issueHumanSession({
      id: packagingApproverUserId,
      email: "enterprise-e2e-approver@nexid.invalid",
      label: "Enterprise E2E Packaging Approver",
      role: "tenant_admin",
      tenantId,
      permissions: ["supplier:approve_packaging"],
    });
    const superAdminBearer = await issueHumanSession({
      id: superAdminUserId,
      email: "enterprise-e2e-superadmin@nexid.invalid",
      label: "Enterprise E2E Super Admin",
      role: "super_admin",
      tenantId: null,
    });
    const supplierDeniedBearer = await issueHumanSession({
      id: supplierDeniedUserId,
      email: "enterprise-e2e-supplier-denied@nexid.invalid",
      label: "Enterprise E2E Supplier Denied",
      role: "tenant_admin",
      tenantId,
    });
    const adminHeaders = { authorization: `Bearer ${bearer}` };
    const otherTenantAdminHeaders = { authorization: `Bearer ${otherTenantBearer}` };
    const packagingApproverHeaders = { authorization: `Bearer ${packagingApproverBearer}` };
    const superAdminHeaders = { authorization: `Bearer ${superAdminBearer}` };
    const supplierDeniedHeaders = { authorization: `Bearer ${supplierDeniedBearer}` };

    const { GET: listSupplierOrders, POST: createSupplierOrder } = await import("../src/app/admin/supplier-orders/route.ts");
    const { GET: readSupplierPackaging, POST: decideSupplierPackaging } = await import("../src/app/admin/supplier-orders/[orderId]/packaging/route.ts");
    const { POST: createSdkApiKey } = await import("../src/app/admin/sdk/api-keys/route.ts");
    const { DELETE: revokeSdkApiKey } = await import("../src/app/admin/sdk/api-keys/[id]/route.ts");
    const { POST: createWebhook } = await import("../src/app/admin/webhooks/route.ts");
    const { GET: readWebhook } = await import("../src/app/admin/webhooks/[id]/route.ts");
    const { POST: rotateWebhook } = await import("../src/app/admin/webhooks/[id]/rotate/route.ts");
    const { GET: readPublicSun } = await import("../src/app/sun/route.ts");
    const { GET: pollEvents } = await import("../src/app/admin/events/route.ts");
    const { GET: pollIncidents, POST: openIncident } = await import("../src/app/admin/incidents/route.ts");
    const { POST: writeSdkEvent } = await import("../src/app/api/v1/sdk/events/route.ts");
    const { GET: readConsumerNetworkOverview } = await import("../src/app/admin/consumer-network/overview/route.ts");
    const { GET: listConsumerNetworkMembers } = await import("../src/app/admin/consumer-network/members/route.ts");
    const { GET: listConsumerNetworkProducts } = await import("../src/app/admin/consumer-network/products/route.ts");
    const { GET: listConsumerNetworkTaps } = await import("../src/app/admin/consumer-network/taps/route.ts");
    const uuidSegment = "([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})";
    const exact = (pathname) => (url) => url.pathname === pathname ? true : null;
    const dynamic = (pattern, parameter) => (url) => {
      const match = pattern.exec(url.pathname);
      return match ? { [parameter]: match[1] } : null;
    };
    httpHarness = await startEnterpriseEphemeralHttpHarness({
      routes: [
        { method: "GET", match: exact("/sun"), handle: readPublicSun },
        { method: "GET", match: exact("/admin/supplier-orders"), handle: listSupplierOrders },
        { method: "POST", match: exact("/admin/supplier-orders"), handle: createSupplierOrder },
        {
          method: "GET",
          match: dynamic(new RegExp(`^/admin/supplier-orders/${uuidSegment}/packaging$`, "i"), "orderId"),
          handle: (request, { orderId }) => readSupplierPackaging(request, { params: Promise.resolve({ orderId }) }),
        },
        {
          method: "POST",
          match: dynamic(new RegExp(`^/admin/supplier-orders/${uuidSegment}/packaging$`, "i"), "orderId"),
          handle: (request, { orderId }) => decideSupplierPackaging(request, { params: Promise.resolve({ orderId }) }),
        },
        { method: "POST", match: exact("/admin/sdk/api-keys"), handle: createSdkApiKey },
        {
          method: "DELETE",
          match: dynamic(new RegExp(`^/admin/sdk/api-keys/${uuidSegment}$`, "i"), "id"),
          handle: (request, { id }) => revokeSdkApiKey(request, { params: Promise.resolve({ id }) }),
        },
        { method: "POST", match: exact("/admin/webhooks"), handle: createWebhook },
        {
          method: "GET",
          match: dynamic(new RegExp(`^/admin/webhooks/${uuidSegment}$`, "i"), "id"),
          handle: (request, { id }) => readWebhook(request, { params: Promise.resolve({ id }) }),
        },
        {
          method: "POST",
          match: dynamic(new RegExp(`^/admin/webhooks/${uuidSegment}/rotate$`, "i"), "id"),
          handle: (request, { id }) => rotateWebhook(request, { params: Promise.resolve({ id }) }),
        },
        { method: "GET", match: exact("/admin/events"), handle: pollEvents },
        { method: "GET", match: exact("/admin/incidents"), handle: pollIncidents },
        { method: "POST", match: exact("/admin/incidents"), handle: openIncident },
        { method: "GET", match: exact("/admin/consumer-network/overview"), handle: readConsumerNetworkOverview },
        { method: "GET", match: exact("/admin/consumer-network/members"), handle: listConsumerNetworkMembers },
        { method: "GET", match: exact("/admin/consumer-network/products"), handle: listConsumerNetworkProducts },
        { method: "GET", match: exact("/admin/consumer-network/taps"), handle: listConsumerNetworkTaps },
        { method: "POST", match: exact("/api/v1/sdk/events"), handle: writeSdkEvent },
      ],
    });

    const consumerNetworkRouteSpecs = [
      { label: "overview", path: "/admin/consumer-network/overview" },
      { label: "members", path: "/admin/consumer-network/members" },
      { label: "products", path: "/admin/consumer-network/products" },
      { label: "taps", path: "/admin/consumer-network/taps" },
    ];

    function stableConsumerNetworkPayload(payload) {
      const stable = structuredClone(payload);
      if (stable?.provenance) delete stable.provenance.observedAt;
      return stable;
    }

    function assertConsumerNetworkFixturePayload(label, payload, expectedTenant, forbiddenTenant) {
      assert.equal(payload.ok, true);
      assert.equal(payload.tenant, expectedTenant.slug);
      assert.equal(payload.provenance?.contractVersion, "consumer-network-event-provenance/v1");
      assert.deepEqual(payload.provenance?.counts, {
        operationalTap: 1,
        declaredDemo: 1,
        imported: 0,
        legacyUnclassified: 0,
        mixed: 0,
      });
      assert.equal(payload.provenance?.physicalPresenceClaim, "not_asserted");
      assert.ok(payload.provenance?.latestOperationalAt);
      const serialized = JSON.stringify(payload);
      assert.equal(serialized.includes(forbiddenTenant.marker), false, `${label} leaked the other tenant marker`);

      if (label === "overview") {
        assert.equal(payload.overview?.totalTaps, 1);
        assert.equal(payload.overview?.savedProducts, 1);
        assert.deepEqual(
          payload.topProductsByClaims?.map((item) => item.product_name),
          [`${expectedTenant.marker}-OPERATIONAL`],
        );
        return;
      }

      assert.ok(Array.isArray(payload.items));
      assert.equal(payload.items.length, 2);
      assert.equal(payload.items.every((item) => item.tenant_slug === expectedTenant.slug), true);
      if (label === "members") {
        assert.deepEqual(
          payload.items.map((item) => item.consumer_id).sort(),
          [expectedTenant.operational.consumerId, expectedTenant.demo.consumerId].sort(),
        );
        assert.equal(payload.items.every((item) => item.email === undefined && item.phone === undefined), true);
        assert.equal(serialized.includes("cn-e2e-a-operational@nexid.invalid"), false);
        assert.equal(serialized.includes("cn-e2e-b-operational@nexid.invalid"), false);
      } else if (label === "products") {
        assert.deepEqual(
          payload.items.map((item) => item.product_name).sort(),
          [`${expectedTenant.marker}-OPERATIONAL`, `${expectedTenant.marker}-DEMO`].sort(),
        );
      } else if (label === "taps") {
        assert.deepEqual(
          payload.items.map((item) => String(item.tap_event_id)).sort(),
          [expectedTenant.operational.eventId, expectedTenant.demo.eventId].map(String).sort(),
        );
        assert.equal(
          payload.items.some((item) => [forbiddenTenant.operational.eventId, forbiddenTenant.demo.eventId]
            .map(String)
            .includes(String(item.tap_event_id))),
          false,
        );
      }
    }

    async function fetchConsumerNetworkPayload({ spec, headers, requestedTenantSlug, capture = false }) {
      assert.equal(activeConsumerNetworkSqlLabel, null, "consumer-network SQL capture must not overlap");
      activeConsumerNetworkSqlLabel = capture ? spec.label : null;
      try {
        const response = await httpHarness.fetch(
          `${spec.path}?tenant=${encodeURIComponent(requestedTenantSlug)}`,
          { headers },
        );
        assert.equal(response.status, 200, `${spec.label} must accept the persisted tenant session`);
        return await response.json();
      } finally {
        activeConsumerNetworkSqlLabel = null;
      }
    }

    const consumerNetworkPayloads = {};
    for (const spec of consumerNetworkRouteSpecs) {
      const unauthenticated = await httpHarness.fetch(`${spec.path}?tenant=${tenantSlug}`);
      assert.equal(unauthenticated.status, 401, `${spec.label} must reject an unauthenticated request`);

      const tenantA = await fetchConsumerNetworkPayload({
        spec,
        headers: adminHeaders,
        requestedTenantSlug: consumerNetworkFixture.tenantA.slug,
        capture: true,
      });
      assertConsumerNetworkFixturePayload(
        spec.label,
        tenantA,
        consumerNetworkFixture.tenantA,
        consumerNetworkFixture.tenantB,
      );

      const tenantARequestingB = await fetchConsumerNetworkPayload({
        spec,
        headers: adminHeaders,
        requestedTenantSlug: consumerNetworkFixture.tenantB.slug,
      });
      assertConsumerNetworkFixturePayload(
        spec.label,
        tenantARequestingB,
        consumerNetworkFixture.tenantA,
        consumerNetworkFixture.tenantB,
      );
      assert.deepEqual(
        stableConsumerNetworkPayload(tenantARequestingB),
        stableConsumerNetworkPayload(tenantA),
        `${spec.label} must ignore tenant B requested by tenant A`,
      );

      const tenantBRequestingA = await fetchConsumerNetworkPayload({
        spec,
        headers: otherTenantAdminHeaders,
        requestedTenantSlug: consumerNetworkFixture.tenantA.slug,
      });
      assertConsumerNetworkFixturePayload(
        spec.label,
        tenantBRequestingA,
        consumerNetworkFixture.tenantB,
        consumerNetworkFixture.tenantA,
      );
      consumerNetworkPayloads[spec.label] = { tenantA, tenantARequestingB, tenantBRequestingA };
    }

    assert.deepEqual(
      [...consumerNetworkSqlCaptures.keys()].sort(),
      consumerNetworkRouteSpecs.map((spec) => spec.label).sort(),
      "all four production consumer-network SQL statements must be captured",
    );
    const consumerNetworkExplainEvidence = {};
    for (const spec of consumerNetworkRouteSpecs) {
      const capture = consumerNetworkSqlCaptures.get(spec.label);
      assert.ok(capture?.statement && Array.isArray(capture.values));
      assert.ok(capture.values.includes(consumerNetworkFixture.tenantA.slug));
      await client.query("BEGIN READ ONLY");
      try {
        await client.query("SET LOCAL statement_timeout = '5s'");
        await client.query("SET LOCAL lock_timeout = '1s'");
        const startedAt = Date.now();
        const explained = await client.query(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${capture.statement}`,
          capture.values,
        );
        const elapsedMs = Date.now() - startedAt;
        const planDocuments = explained.rows[0]?.["QUERY PLAN"];
        assert.ok(Array.isArray(planDocuments) && planDocuments.length === 1);
        const planDocument = planDocuments[0];
        const executionTimeMs = Number(planDocument?.["Execution Time"]);
        const planningTimeMs = Number(planDocument?.["Planning Time"]);
        const topNode = String(planDocument?.Plan?.["Node Type"] || "");
        assert.ok(Number.isFinite(executionTimeMs) && executionTimeMs >= 0 && executionTimeMs <= 5_000);
        assert.ok(Number.isFinite(planningTimeMs) && planningTimeMs >= 0);
        assert.ok(elapsedMs <= 6_500, `${spec.label} EXPLAIN exceeded the bounded wall-clock budget`);
        assert.ok(topNode, `${spec.label} EXPLAIN must expose a top-level plan node`);
        consumerNetworkExplainEvidence[spec.label] = {
          planning_time_ms: planningTimeMs,
          execution_time_ms: executionTimeMs,
          wall_clock_ms: elapsedMs,
          top_node: topNode,
          statement_timeout_ms: 5_000,
          query_timeout_ms: 6_000,
        };
      } finally {
        await client.query("ROLLBACK");
      }
    }

    const unauthenticatedSupplierResponse = await httpHarness.fetch("/admin/supplier-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(unauthenticatedSupplierResponse.status, 401);

    const deniedSupplierBaseBatchId = "E2E-SUPPLIER-DENIED-001";
    const deniedSupplierResponse = await httpHarness.fetch("/admin/supplier-orders", {
      method: "POST",
      headers: { ...supplierDeniedHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        tenant: tenantSlug,
        customer_slug: tenantSlug,
        order_name: "Enterprise denied capability fixture",
        base_batch_id: deniedSupplierBaseBatchId,
        total_quantity: 1,
        sub_batch_size: 1,
        chip_model: "NTAG 213",
        carrier_profile_code: "ntag213",
        pack_purpose: "trial_integration",
        material_type: "converted_smart_label",
        notes: "Disposable authorization fixture; no physical order.",
      }),
    });
    assert.equal(deniedSupplierResponse.status, 403, "tenant-scoped deny must override the tenant-admin role default");
    assert.equal(await deniedSupplierResponse.text(), "Forbidden");
    const deniedSupplierMutation = await client.query(
      "SELECT count(*)::integer AS count FROM supplier_orders WHERE base_batch_id = $1",
      [deniedSupplierBaseBatchId],
    );
    assert.equal(Number(deniedSupplierMutation.rows[0]?.count || 0), 0, "denied supplier order must not mutate PostgreSQL");

    const tenantKeylessBaseBatchId = "E2E-TENANT-KEYLESS-001";
    const tenantKeylessSupplierResponse = await httpHarness.fetch("/admin/supplier-orders", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json", "x-request-id": "enterprise-e2e-tenant-keyless" },
      body: JSON.stringify({
        tenant: tenantSlug,
        customer_slug: tenantSlug,
        order_name: "Enterprise tenant keyless fixture",
        base_batch_id: tenantKeylessBaseBatchId,
        total_quantity: 1,
        sub_batch_size: 1,
        chip_model: "NTAG 213",
        carrier_profile_code: "ntag213",
        pack_purpose: "trial_integration",
        material_type: "converted_smart_label",
        notes: "Disposable keyless tenant-order fixture; no physical order.",
      }),
    });
    const tenantKeylessSupplierPayload = await tenantKeylessSupplierResponse.json();
    assert.equal(
      tenantKeylessSupplierResponse.status,
      201,
      `tenant_keyless_supplier_create_failed:${String(tenantKeylessSupplierPayload?.reason || "unknown")}`,
    );
    assert.equal(String(tenantKeylessSupplierPayload.order.tenant_id), tenantId);
    assert.equal(String(tenantKeylessSupplierPayload.order.base_batch_id), tenantKeylessBaseBatchId);

    const secureSupplierOrderPayload = {
      tenant: tenantSlug,
      customer_slug: tenantSlug,
      order_name: "Enterprise HTTP 5K secure pilot",
      base_batch_id: "E2E-SYN-HTTP-5000",
      total_quantity: 5000,
      sub_batch_size: 1000,
      chip_model: "NTAG 424 DNA",
      carrier_profile_code: "ntag424_dna",
      pack_purpose: "trial_integration",
      material_type: "converted_smart_label",
      notes: "Synthetic disposable HTTP acceptance fixture; not a physical manufacturing order.",
    };
    const tenantSecureSupplierResponse = await httpHarness.fetch("/admin/supplier-orders", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify(secureSupplierOrderPayload),
    });
    assert.equal(tenantSecureSupplierResponse.status, 403, "secure SUN supplier-order creation requires batch.keys.generate");
    assert.equal(await tenantSecureSupplierResponse.text(), "Forbidden");

    const supplierOrderResponse = await httpHarness.fetch("/admin/supplier-orders", {
      method: "POST",
      headers: {
        ...superAdminHeaders,
        "content-type": "application/json",
        "x-request-id": "enterprise-e2e-http-supplier-5000",
      },
      body: JSON.stringify(secureSupplierOrderPayload),
    });
    const supplierOrderPayload = await supplierOrderResponse.json();
    assert.equal(
      supplierOrderResponse.status,
      201,
      `supplier_http_create_failed:${String(supplierOrderPayload?.reason || "unknown")}`,
    );
    const httpSupplierOrderId = String(supplierOrderPayload.order.id);
    assert.equal(supplierOrderPayload.order.tenant_slug, tenantSlug);
    assert.equal(supplierOrderPayload.sub_batches.length, 5);
    assert.deepEqual(
      supplierOrderPayload.sub_batches.map((entry) => Number(entry.expected_quantity)),
      [1000, 1000, 1000, 1000, 1000],
    );
    assert.equal(new Set(supplierOrderPayload.sub_batches.map((entry) => entry.bid)).size, 5);
    const supplierHttpPublicPayload = JSON.stringify(supplierOrderPayload).toLowerCase();
    for (const forbidden of [
      "meta_key_ct", "file_key_ct", "encrypted_key_ct", "kms_master_key_hex",
    ]) {
      assert.equal(supplierHttpPublicPayload.includes(forbidden), false, `supplier HTTP response leaked ${forbidden}`);
    }

    const supplierHttpDatabaseEvidence = (await client.query(`SELECT
      (SELECT count(*)::integer FROM supplier_sub_batches
        WHERE supplier_order_id = $1::uuid AND tenant_id = $2::uuid) AS sub_batch_count,
      (SELECT count(*)::integer FROM batch_keys
        WHERE supplier_order_id = $1::uuid AND tenant_id = $2::uuid) AS pair_count,
      (SELECT count(DISTINCT key_fingerprint)::integer FROM batch_keys
        WHERE supplier_order_id = $1::uuid AND tenant_id = $2::uuid) AS distinct_pair_fingerprints,
      (SELECT count(DISTINCT meta_key_ct)::integer FROM batch_keys
        WHERE supplier_order_id = $1::uuid AND tenant_id = $2::uuid) AS distinct_meta_envelopes,
      (SELECT count(DISTINCT file_key_ct)::integer FROM batch_keys
        WHERE supplier_order_id = $1::uuid AND tenant_id = $2::uuid) AS distinct_file_envelopes,
      (SELECT count(*)::integer FROM batch_key_material
        WHERE supplier_order_id = $1::uuid AND tenant_id = $2::uuid) AS material_count`, [
      httpSupplierOrderId,
      tenantId,
    ])).rows[0];
    assert.deepEqual({
      sub_batch_count: Number(supplierHttpDatabaseEvidence.sub_batch_count),
      pair_count: Number(supplierHttpDatabaseEvidence.pair_count),
      distinct_pair_fingerprints: Number(supplierHttpDatabaseEvidence.distinct_pair_fingerprints),
      distinct_meta_envelopes: Number(supplierHttpDatabaseEvidence.distinct_meta_envelopes),
      distinct_file_envelopes: Number(supplierHttpDatabaseEvidence.distinct_file_envelopes),
      material_count: Number(supplierHttpDatabaseEvidence.material_count),
    }, {
      sub_batch_count: 5,
      pair_count: 5,
      distinct_pair_fingerprints: 5,
      distinct_meta_envelopes: 5,
      distinct_file_envelopes: 5,
      material_count: 10,
    });
    const supplierHttpAggregateEvidence = (await client.query(`SELECT
      count(DISTINCT supplier_order.id)::integer AS order_count,
      count(supplier_sub_batch.id)::integer AS sub_batch_count
      FROM supplier_orders supplier_order
      LEFT JOIN supplier_sub_batches supplier_sub_batch
        ON supplier_sub_batch.supplier_order_id = supplier_order.id
       AND supplier_sub_batch.tenant_id = supplier_order.tenant_id
      WHERE supplier_order.tenant_id = $1::uuid
        AND supplier_order.base_batch_id = ANY($2::text[])`, [
      tenantId,
      [tenantKeylessBaseBatchId, secureSupplierOrderPayload.base_batch_id],
    ])).rows[0];
    assert.deepEqual({
      order_count: Number(supplierHttpAggregateEvidence.order_count),
      sub_batch_count: Number(supplierHttpAggregateEvidence.sub_batch_count),
    }, {
      order_count: 2,
      sub_batch_count: 6,
    });

    const crossTenantPackagingResponse = await httpHarness.fetch(
      `/admin/supplier-orders/${httpSupplierOrderId}/packaging`,
      { headers: otherTenantAdminHeaders },
    );
    assert.equal(crossTenantPackagingResponse.status, 404);

    const packagingSpec = {
      inlayForm: "converted_smart_label",
      applicationSurface: "plastic_hdpe",
      placement: "cap",
      applicationMode: "automatic_labeler",
      substrateMaterial: "HDPE cap with induction liner",
      faceStock: "chemical-resistant synthetic film",
      adhesive: "permanent acrylic qualified for HDPE",
      liner: "glassine compatible with applicator",
      geometry: {
        labelWidthMm: 45,
        labelHeightMm: 30,
        antennaWidthMm: 40,
        antennaHeightMm: 24,
        pitchMm: 33,
        webWidthMm: 50,
      },
      roll: {
        coreDiameterMm: 76,
        maxOuterDiameterMm: 300,
        winding: "face_out",
        unwindDirection: 3,
        quantityPerRoll: 1000,
      },
      line: { unitsPerMinute: 120, printerEncoderModel: "synthetic qualified encoder" },
      environment: {
        minTemperatureC: -5,
        maxTemperatureC: 55,
        liquidProximity: true,
        metalProximity: false,
        outdoorUv: true,
        chemicalExposure: ["agrochemical splash", "water"],
      },
      tagTamper: { required: false, bridgesOpening: null, tailLengthMm: null, placementApproved: false },
      qa: {
        rfSampleApproved: true,
        lineTrialApproved: true,
        adhesiveApproved: true,
        artworkApproved: true,
        encodingTrialApproved: true,
      },
    };
    const packagingEvidenceRefs = {
      rf_sample: ["artifact://e2e/rf/sample-01"],
      line_trial: ["artifact://e2e/line/trial-01"],
      adhesive: ["artifact://e2e/adhesive/report-01"],
      artwork_dieline: ["artifact://e2e/artwork/dieline-01"],
      encoding_readback: ["artifact://e2e/encoding/readback-01"],
      tagtamper_placement: [],
    };
    const packagingPath = `/admin/supplier-orders/${httpSupplierOrderId}/packaging`;
    const forgedPackagingContext = await httpHarness.fetch(packagingPath, {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ status: "draft", tenant_id: otherTenantId, spec: packagingSpec }),
    });
    const forgedPackagingPayload = await forgedPackagingContext.json();
    assert.equal(
      forgedPackagingContext.status,
      400,
      `forged_packaging_context_status:${String(forgedPackagingPayload?.reason || "unknown")}`,
    );
    assert.equal(forgedPackagingPayload.reason, "packaging_context_fields_server_derived");

    const draftPackagingResponse = await httpHarness.fetch(packagingPath, {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json", "x-request-id": "enterprise-e2e-packaging-draft" },
      body: JSON.stringify({ status: "draft", spec: packagingSpec, evidence_refs: packagingEvidenceRefs }),
    });
    assert.equal(draftPackagingResponse.status, 201);
    assert.equal((await draftPackagingResponse.json()).decision.status, "draft");
    const submitPackagingResponse = await httpHarness.fetch(packagingPath, {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json", "x-request-id": "enterprise-e2e-packaging-submit" },
      body: JSON.stringify({ status: "submitted" }),
    });
    assert.equal(submitPackagingResponse.status, 201);
    assert.equal((await submitPackagingResponse.json()).decision.status, "submitted");

    const unauthorizedApprovalResponse = await httpHarness.fetch(packagingPath, {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    assert.equal(unauthorizedApprovalResponse.status, 403);
    const approvePackagingResponse = await httpHarness.fetch(packagingPath, {
      method: "POST",
      headers: {
        ...packagingApproverHeaders,
        "content-type": "application/json",
        "x-request-id": "enterprise-e2e-packaging-approve",
      },
      body: JSON.stringify({ status: "approved" }),
    });
    const approvePackagingPayload = await approvePackagingResponse.json();
    assert.equal(
      approvePackagingResponse.status,
      201,
      `supplier_http_packaging_approval_failed:${String(approvePackagingPayload?.reason || "unknown")}`,
    );
    assert.equal(approvePackagingPayload.decision.status, "approved");
    assert.equal(approvePackagingPayload.governance.single_operator_override, false);
    assert.equal(approvePackagingPayload.governance.decided_by, packagingApproverUserId);
    const readApprovedPackaging = await httpHarness.fetch(packagingPath, { headers: adminHeaders });
    assert.equal(readApprovedPackaging.status, 200);
    const approvedPackagingPayload = await readApprovedPackaging.json();
    assert.equal(approvedPackagingPayload.governance.status, "approved");
    assert.equal(approvedPackagingPayload.history.length, 3);

    const listedSupplierOrders = await httpHarness.fetch(`/admin/supplier-orders?tenant=${tenantSlug}`, { headers: adminHeaders });
    assert.equal(listedSupplierOrders.status, 200);
    const listedSupplierPayload = await listedSupplierOrders.json();
    assert.ok(listedSupplierPayload.orders.some((order) => String(order.id) === httpSupplierOrderId));
    assert.equal(listedSupplierPayload.orders.some((order) => String(order.tenant_id) === otherTenantId), false);

    // Exercise the real admin API-key lifecycle against the disposable
    // database. The tenant in the request body is deliberately forged: the
    // verified tenant-admin principal must remain authoritative.
    const createKeyResponse = await httpHarness.fetch("/admin/sdk/api-keys", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        tenant: "enterprise-e2e-other",
        name: "Enterprise E2E verifier",
        scopes: ["sdk:verify", "sdk:events"],
      }),
    });
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
    const otherTenantApiKeyId = (await client.query(`SELECT id::text AS id
      FROM public.nexid_create_tenant_api_key_v1($1::jsonb)`, [JSON.stringify({
        tenant_id: otherTenantId,
        actor_id: userId,
        name: "Other tenant key",
        key_prefix: otherTenantApiKeySecret.slice(0, 12),
        key_hash: hashSdkApiKey(otherTenantApiKeySecret),
        scopes: ["sdk:verify"],
        expires_at: null,
        max_active_keys: 20,
        request_id: "enterprise-e2e-other-tenant-key",
        ip_address: "127.0.0.1",
        user_agent: "nexid-enterprise-ephemeral-e2e",
      })])).rows[0].id;
    const crossTenantKeyRevoke = await httpHarness.fetch(`/admin/sdk/api-keys/${otherTenantApiKeyId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(crossTenantKeyRevoke.status, 404);

    const revokeKeyResponse = await httpHarness.fetch(`/admin/sdk/api-keys/${apiKeyId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    assert.equal(revokeKeyResponse.status, 200);
    const revokedSdkAuth = await authenticateSdkRequest(sdkAuthRequest(), "sdk:verify");
    assert.equal(revokedSdkAuth.ok, false);
    assert.equal(revokedSdkAuth.response.status, 401);

    // Webhook lifecycle: tenant binding, one-time secret storage, optimistic
    // rotation, append-only audit, idempotent outbox, leased delivery and v2
    // signature verification. Admin calls cross a real loopback HTTP socket;
    // delivery itself remains an injected in-process verifier, so no DNS lookup
    // or external request can occur.
    const forgedWebhookResponse = await httpHarness.fetch("/admin/webhooks", {
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
      });
    const forgedWebhookPayload = await forgedWebhookResponse.json();
    assert.equal(
      forgedWebhookResponse.status,
      400,
      `forged_webhook_context_status:${String(forgedWebhookPayload?.reason || "unknown")}`,
    );

    const webhookUrl = "https://webhook.enterprise-e2e.invalid/hooks/synthetic-secret";
    const createWebhookResponse = await httpHarness.fetch("/admin/webhooks", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        tenant: tenantSlug,
        name: "Enterprise E2E webhook",
        url: webhookUrl,
        enabled: false,
        events: ["sdk.verify", "sdk.external_event"],
        signatureVersion: "v2",
      }),
    });
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

    const rotateWebhookResponse = await httpHarness.fetch(`/admin/webhooks/${webhookEndpointId}/rotate`, {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ expectedSecretVersion: 1, overlapSeconds: 300 }),
    });
    assert.equal(rotateWebhookResponse.status, 200);
    const rotateWebhookPayload = await rotateWebhookResponse.json();
    const rotatedWebhookSecret = String(rotateWebhookPayload.secret);
    assert.notEqual(rotatedWebhookSecret, firstWebhookSecret);
    assert.equal(Number(rotateWebhookPayload.endpoint.signing_secret_version), 2);
    assert.equal(Number(rotateWebhookPayload.endpoint.signing_secret_previous_version), 1);
    assert.equal(rotateWebhookPayload.endpoint.audit_committed, true);

    const staleRotationResponse = await httpHarness.fetch(`/admin/webhooks/${webhookEndpointId}/rotate`, {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ expectedSecretVersion: 1, overlapSeconds: 300 }),
    });
    assert.equal(staleRotationResponse.status, 409);
    assert.equal((await staleRotationResponse.json()).reason, "webhook_secret_version_conflict");

    const crossTenantWebhookRead = await httpHarness.fetch(`/admin/webhooks/${webhookEndpointId}`, {
      headers: otherTenantAdminHeaders,
    });
    assert.equal(crossTenantWebhookRead.status, 404);
    const webhookReadResponse = await httpHarness.fetch(`/admin/webhooks/${webhookEndpointId}`, {
      headers: adminHeaders,
    });
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
      processClaimedWebhookDelivery,
    } = await import("../src/lib/sdk-webhooks.ts");

    const integrationKeyResponse = await httpHarness.fetch("/admin/sdk/api-keys", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        tenant: otherTenantId,
        name: "Enterprise E2E physical-event writer",
        scopes: ["sdk:events"],
      }),
    });
    assert.equal(integrationKeyResponse.status, 201);
    const integrationKeyPayload = await integrationKeyResponse.json();
    assert.equal(integrationKeyPayload.tenant.slug, tenantSlug);
    const integrationApiKeyId = String(integrationKeyPayload.key.id);
    const integrationApiKeySecret = String(integrationKeyPayload.secret);

    const sdkEventBody = JSON.stringify({
      eventType: "shipment.received",
      bid,
      uidHex,
      source: "sdk",
      connectorProfile: "cropwise_physical_product_event",
      data: {
        productId: "E2E-AGROCHEMICAL-001",
        sku: "E2E-SKU-001",
        lotNumber: bid,
        authStatus: "VALID_AUTHENTIC",
        tamperStatus: "NOT_SUPPORTED",
        replayStatus: "NO_REPLAY",
        distributorId: "E2E-DISTRIBUTOR-001",
        approximateLocation: { city: "Rosario", country: "AR", lat: -32.95, lng: -60.66 },
        consentFlags: { approximate_location: true },
      },
    });
    const sdkEventHeaders = {
      "content-type": "application/json",
      "x-nexid-api-key": integrationApiKeySecret,
      "x-nexid-tenant-slug": tenantSlug,
      "idempotency-key": "enterprise-e2e-http-sdk-event-001",
      "x-request-id": "enterprise-e2e-http-sdk-event-001",
    };
    const wrongTenantSdkEvent = await httpHarness.fetch("/api/v1/sdk/events", {
      method: "POST",
      headers: { ...sdkEventHeaders, "x-nexid-tenant-slug": "enterprise-e2e-other" },
      body: sdkEventBody,
    });
    assert.equal(wrongTenantSdkEvent.status, 401);

    const secretBearingSdkEvent = await httpHarness.fetch("/api/v1/sdk/events", {
      method: "POST",
      headers: { ...sdkEventHeaders, "idempotency-key": "enterprise-e2e-http-sdk-secret-reject" },
      body: JSON.stringify({
        eventType: "shipment.received",
        bid,
        data: { private_key: "synthetic-forbidden-value" },
        }),
      });
    const secretBearingSdkPayload = await secretBearingSdkEvent.json();
    assert.equal(
      secretBearingSdkEvent.status,
      400,
      `secret_bearing_sdk_event_status:${String(secretBearingSdkPayload?.reason || "unknown")}`,
    );
    assert.equal(secretBearingSdkPayload.reason, "enterprise_event_secret_fields_forbidden");
    const rejectedSecretIdempotency = await client.query(
      "SELECT count(*)::integer AS count FROM sdk_idempotency_operations WHERE tenant_id = $1::uuid AND route = $2 AND idempotency_key = $3",
      [tenantId, "/api/v1/sdk/events", "enterprise-e2e-http-sdk-secret-reject"],
    );
    assert.equal(
      Number(rejectedSecretIdempotency.rows[0]?.count || 0),
      0,
      "secret-bearing SDK events must be rejected before reserving idempotency state",
    );

    const sdkEventResponse = await httpHarness.fetch("/api/v1/sdk/events", {
      method: "POST",
      headers: sdkEventHeaders,
      body: sdkEventBody,
    });
    const sdkEventPayload = await sdkEventResponse.json();
    assert.equal(
      sdkEventResponse.status,
      201,
      `sdk_http_event_failed:${String(sdkEventPayload?.reason || "unknown")}`,
    );
    assert.equal(sdkEventPayload.tenant.slug, tenantSlug);
    assert.match(String(sdkEventPayload.uidMasked || ""), /\*{4}/);
    assert.equal(JSON.stringify(sdkEventPayload).includes(uidHex), false);
    assert.equal(Number(sdkEventPayload.webhookOutbox.queued), 1);
    assert.equal(Number(sdkEventPayload.webhookOutbox.deduplicated), 0);

    const sdkEventReplayResponse = await httpHarness.fetch("/api/v1/sdk/events", {
      method: "POST",
      headers: sdkEventHeaders,
      body: sdkEventBody,
    });
    assert.equal(sdkEventReplayResponse.status, 201);
    const sdkEventReplayPayload = await sdkEventReplayResponse.json();
    assert.equal(sdkEventReplayPayload.eventId, sdkEventPayload.eventId);
    assert.deepEqual(sdkEventReplayPayload.webhookOutbox, sdkEventPayload.webhookOutbox);

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
        const payload = JSON.parse(delivery.body);
        assert.equal(payload.schemaVersion, "1.0");
        assert.equal(payload.type, "sdk.external_event");
        assert.equal(payload.data.event_id, sdkEventPayload.eventId);
        assert.match(payload.data.uid_hash, /^sha256:[0-9a-f]{64}$/);
        assert.equal(JSON.stringify(payload).includes(uidHex), false);
        assert.equal(Object.hasOwn(payload.data, "physical_custody_verified"), false);
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
    const sunQuery = new URLSearchParams({
      view: "json",
      bid,
      picc_data: sun.piccDataHex,
      enc: sun.encHex,
      cmac: sun.cmacHex,
      safe_fixture_label: "enterprise-e2e",
    });
    const scanResponse = await httpHarness.fetch(`/sun?${sunQuery}`, {
      headers: {
        accept: "application/json",
        "user-agent": "nexid-enterprise-ephemeral-e2e",
        "x-request-id": "enterprise-e2e-tap-001",
        "x-vercel-ip-city": "Rosario",
        "x-vercel-ip-country": "AR",
        "x-vercel-ip-latitude": "-32.95",
        "x-vercel-ip-longitude": "-60.66",
      },
    });
    assert.equal(scanResponse.status, 200);
    const scan = await scanResponse.json();
    assert.equal(
      scan.ok,
      true,
      `sun_contract_failed:${String(scan?.status?.code || "unknown")}:${String(scan?.status?.reason || "unknown")}`,
    );
    assert.equal(scan.status.code, "VALID_AUTHENTIC");
    assert.equal(scan.status.productState, "VALID_AUTHENTIC");
    assert.equal(scan.tapSecurity.freshTap, true);
    assert.equal(scan.tapSecurity.replayDetected, false);
    assert.equal(scan.identity.uid, null);
    assert.match(String(scan.identity.uidMasked || ""), /\*{3}/);
    assert.equal(JSON.stringify(scan).includes(sun.piccDataHex), false);
    assert.equal(JSON.stringify(scan).includes(sun.encHex), false);
    assert.equal(JSON.stringify(scan).includes(sun.cmacHex), false);
    const eventId = Number(scan.identity.eventId);
    assert.ok(Number.isSafeInteger(eventId) && eventId > 0);
    assert.equal(Number(scanResponse.headers.get("x-nexid-event-id")), eventId);

    const tapSse = await sseProbe.next((entry) => (
      entry.event === "event" && String(entry.data.eventId || "") === String(eventId)
    ));
    assert.equal(tapSse.data.tenantSlug, tenantSlug);
    assert.equal(tapSse.data.eventSource, "real");
    assert.equal(Object.hasOwn(tapSse.data, "uidHex"), false);
    assert.match(String(tapSse.data.uidMasked || ""), /\*{4}/);

    const pollResponse = await httpHarness.fetch(
      `/admin/events?tenant=${tenantSlug}&source=real&limit=10`,
      { headers: adminHeaders },
    );
    assert.equal(pollResponse.status, 200);
    const polled = await pollResponse.json();
    const polledEvent = polled.rows.find((row) => String(row.id) === String(eventId));
    assert.ok(polledEvent, "polling route must expose the committed tenant event");
    assert.equal(polledEvent.tenantSlug, tenantSlug);

    const incidentBody = {
      tenantSlug,
      eventId: String(eventId),
      severity: "high",
      title: "Enterprise E2E custody review",
      summary: "Synthetic, isolated incident created from a cryptographically verified ephemeral SUN tap.",
      reason: "exercise durable event to ticket workflow",
    };
    const incidentResponse = await httpHarness.fetch("/admin/incidents", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify(incidentBody),
    });
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

    const incidentPollResponse = await httpHarness.fetch(
      `/admin/incidents?tenant=${tenantSlug}&eventId=${eventId}`,
      { headers: adminHeaders },
    );
    assert.equal(incidentPollResponse.status, 200);
    const incidentPoll = await incidentPollResponse.json();
    assert.equal(incidentPoll.count, 1);
    assert.equal(incidentPoll.incidents[0].ticketId, incident.ticketId);

    const idempotentResponse = await httpHarness.fetch("/admin/incidents", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify(incidentBody),
    });
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

    const forbiddenTenantResponse = await httpHarness.fetch("/admin/incidents", {
      method: "POST",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ...incidentBody, tenantSlug: "enterprise-e2e-other" }),
    });
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
    assert.equal(
      databaseEvidence.result,
      "VALID_AUTHENTIC",
      "non-TT NTAG 424 DNA taps must persist the canonical carrier trust state",
    );
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
      (SELECT status FROM tenant_api_keys WHERE id = $7::uuid AND tenant_id = $2::uuid) AS integration_api_key_status,
      (SELECT count(*)::integer FROM webhook_endpoints WHERE id = $5::uuid AND tenant_id = $2::uuid) AS webhook_count,
      (SELECT count(*)::integer FROM webhook_endpoint_audit_events
        WHERE endpoint_id = $5::uuid AND tenant_id = $2::uuid) AS webhook_audit_count,
      (SELECT count(*)::integer FROM webhook_deliveries
        WHERE id::text = $6 AND endpoint_id = $5::uuid AND status = 'delivered') AS webhook_delivery_count,
      (SELECT payload #>> '{data,physical_custody_verified}' FROM webhook_deliveries
        WHERE id::text = $6 AND endpoint_id = $5::uuid) AS physical_custody_verified,
      (SELECT payload #>> '{data,uid_hash}' FROM webhook_deliveries
        WHERE id::text = $6 AND endpoint_id = $5::uuid) AS webhook_uid_hash,
      (SELECT strpos(payload::text, $8::text) = 0 FROM webhook_deliveries
        WHERE id::text = $6 AND endpoint_id = $5::uuid) AS webhook_raw_uid_absent,
      (SELECT count(*)::integer FROM sdk_external_events
        WHERE id::text = $9 AND tenant_id = $2::uuid AND api_key_id = $7::uuid) AS sdk_event_count,
      (SELECT count(*)::integer FROM sun_rate_limit_buckets
        WHERE scope = 'enterprise-e2e:distributed'
           OR scope LIKE 'fleet:sdk_epcis_capture:%') AS distributed_rate_bucket_count`, [
      apiKeyId,
      tenantId,
      otherTenantApiKeyId,
      otherTenantId,
      webhookEndpointId,
      webhookDeliveryId,
      integrationApiKeyId,
      uidHex,
      sdkEventPayload.eventId,
    ])).rows[0];
    assert.equal(enterpriseSecurityEvidence.api_key_status, "revoked");
    assert.equal(enterpriseSecurityEvidence.other_api_key_status, "active");
    assert.equal(enterpriseSecurityEvidence.integration_api_key_status, "active");
    assert.equal(Number(enterpriseSecurityEvidence.webhook_count), 1);
    assert.equal(Number(enterpriseSecurityEvidence.webhook_audit_count), 2);
    assert.equal(Number(enterpriseSecurityEvidence.webhook_delivery_count), 1);
    assert.equal(enterpriseSecurityEvidence.physical_custody_verified, null);
    assert.match(enterpriseSecurityEvidence.webhook_uid_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(enterpriseSecurityEvidence.webhook_raw_uid_absent, true);
    assert.equal(Number(enterpriseSecurityEvidence.sdk_event_count), 1);
    assert.ok(Number(enterpriseSecurityEvidence.distributed_rate_bucket_count) >= 4);

    console.log(JSON.stringify({
      ok: true,
      harness: "enterprise_ephemeral_http_e2e_v2",
      target: emptyTarget,
      migrations: { expected: expectedMigrationCount, applied: Number(ledger.rows[0].count) },
      boundaries: {
        http_transport: "real_loopback_tcp_http_to_production_route_handlers",
        next_router_middleware_tls: "not_exercised",
        human_bearer_authentication: "persisted_revocable_sessions_resolved_per_http_request",
        supplier_order_http: "super_admin_created_5000_units_as_five_unique_secure_sub_batches",
        supplier_packaging_http: "tenant_scoped_draft_submit_distinct_approver_and_immutable_receipts",
        sun_crypto: "production_cmac_sdm_code_with_synthetic_inputs",
        public_sun_http: "synthetic_dynamic_message_verified_through_public_route",
        sun_atomic_event: "committed",
        sse_tenant_projection: "observed",
        polling_tenant_projection: "observed",
        incident: "committed",
        ticket: "committed",
        incident_history: "committed",
        incident_idempotency: "replayed_without_duplicate",
        aged_open_incident_signal: "visible_beyond_selected_sli_window",
        cross_tenant_mutation: "rejected",
        consumer_network_http: "four_production_handlers_exercised_with_persisted_tenant_sessions",
        consumer_network_tenant_isolation: "tenant_a_cannot_select_tenant_b_even_with_explicit_query_override",
        consumer_network_provenance: "operational_and_declared_demo_rows_isolated_per_tenant",
        consumer_network_query_budget: "five_second_statement_timeout_six_second_driver_timeout_explain_analyze_json",
        dynamic_sun_query_values: "redacted",
        api_key_lifecycle: "created_authenticated_scope_checked_tenant_bound_revoked",
        webhook_secret_storage: "software_envelope_encrypted_tenant_bound",
        webhook_lifecycle: "created_rotated_audited_and_stale_rotation_rejected",
        webhook_delivery: "leased_v2_signature_verified_and_committed_without_network",
        sdk_event_http: "api_key_authenticated_schema_checked_tenant_bound_and_idempotent",
        webhook_idempotency: "sdk_mutation_replayed_without_duplicate_outbox_or_delivery",
        webhook_uid_boundary: "sha256_uid_only_raw_uid_absent",
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
        api_keys: 3,
        http_supplier_orders: Number(supplierHttpAggregateEvidence.order_count),
        http_supplier_sub_batches: Number(supplierHttpAggregateEvidence.sub_batch_count),
        http_supplier_secure_sub_batches: Number(supplierHttpDatabaseEvidence.sub_batch_count),
        http_supplier_key_pairs: Number(supplierHttpDatabaseEvidence.pair_count),
        sdk_external_events: Number(enterpriseSecurityEvidence.sdk_event_count),
        webhook_endpoints: Number(enterpriseSecurityEvidence.webhook_count),
        webhook_deliveries: Number(enterpriseSecurityEvidence.webhook_delivery_count),
        webhook_audit_events: Number(enterpriseSecurityEvidence.webhook_audit_count),
        distributed_rate_buckets: Number(enterpriseSecurityEvidence.distributed_rate_bucket_count),
        consumer_network_fixture_events: consumerNetworkEvents.length,
        consumer_network_routes: Object.keys(consumerNetworkPayloads).length,
      },
      consumer_network_query_plans: consumerNetworkExplainEvidence,
      external_effects: false,
      webhook_delivery_transport: "in_process_signature_verified_no_network",
      next_router_middleware_exercised: false,
      tls_termination_exercised: false,
      physical_nfc_tag_scanned: false,
      physical_tag_certification: false,
      tagtamper_physical_certification: false,
    }));
  } finally {
    abortStream.abort();
    if (sseProbe) await sseProbe.close();
    if (httpHarness) await httpHarness.close();
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
  console.error(JSON.stringify({ ok: false, harness: "enterprise_ephemeral_http_e2e_v2", reason }));
  process.exitCode = 1;
});
