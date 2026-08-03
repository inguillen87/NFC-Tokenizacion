import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createSupplierOrderV2,
  hasSupplierOrderCreateV2,
  SUPPLIER_ORDER_CREATE_V2_MIGRATION,
  supplierOrderCreateError,
} from "../src/lib/supplier-order-create.ts";
import { resolveSupplierPublicTagOrigin } from "../src/lib/supplier-public-tag-origin.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

function readWorkspaceFile(path) {
  return readFileSync(`${repositoryRoot}/${path}`, "utf8");
}

function createInput() {
  const supplierOrderId = "22222222-2222-4222-8222-222222222222";
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const bid = "SYN-2026-001";
  const urlTemplate = `https://nexid.lat/sun?v=1&bid=${bid}&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>`;
  return {
    supplierOrderId,
    tenantId,
    actorId: "66666666-6666-4666-8666-666666666666",
    authSessionId: "77777777-7777-4777-8777-777777777777",
    customerSlug: "syngenta",
    orderName: "Syngenta pilot 2026",
    baseBatchId: "SYN-2026",
    totalQuantity: 1000,
    subBatchSize: 1000,
    chipModel: "NTAG 424 DNA TT",
    carrierProfileCode: "ntag424_dna_tt",
    packPurpose: "trial_integration",
    materialType: "wet inlay",
    notes: "Pilot",
    requestId: "request-create-1",
    userAgent: "test",
    subBatches: [{
      bid,
      sequenceIndex: 1,
      expectedQuantity: 1000,
      keyMaterialMode: "secure_sun",
      metaKeyCt: `nexid-app-envelope-v2.${"a".repeat(96)}`,
      fileKeyCt: `nexid-app-envelope-v2.${"b".repeat(96)}`,
      pairFingerprint: "AAAABBBBCCCCDDDD",
      metaKeyFingerprint: "AAAAAAAAAAAAAAAA",
      fileKeyFingerprint: "BBBBBBBBBBBBBBBB",
      urlTemplate,
      sdmConfig: {
        supplier_order_id: supplierOrderId,
        supplier_sequence_index: 1,
        carrier_profile_code: "ntag424_dna_tt",
        requested_quantity: 1000,
        key_material_mode: "secure_sun",
        url_template: urlTemplate,
        key_version: 1,
      },
    }],
  };
}

function receiptRow(overrides = {}) {
  const input = createInput();
  return {
    supplier_order: {
      id: input.supplierOrderId,
      tenant_id: input.tenantId,
      pack_purpose: input.packPurpose,
      packaging_governance_status: "legacy_unverified",
    },
    sub_batches: [{
      id: "33333333-3333-4333-8333-333333333333",
      bid: input.subBatches[0].bid,
      batch_id: "44444444-4444-4444-8444-444444444444",
      sequence_index: 1,
      expected_quantity: 1000,
      key_fingerprint: input.subBatches[0].pairFingerprint,
      url_template: input.subBatches[0].urlTemplate,
    }],
    ...overrides,
  };
}

test("supplier order helper uses one atomic writer and never serializes raw NFC keys", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [receiptRow()];
  };
  const result = await createSupplierOrderV2(createInput(), query);
  assert.equal(calls.length, 1);
  assert.match(calls[0].statement, /FROM public\.nexid_create_supplier_order_v2\(\?::jsonb\)/);
  const payload = JSON.parse(calls[0].values[0]);
  assert.equal(payload.supplier_order_id, createInput().supplierOrderId);
  assert.equal(payload.auth_session_id, createInput().authSessionId);
  assert.equal("actor_email" in payload, false);
  assert.equal(payload.sub_batches.length, 1);
  assert.equal(payload.sub_batches[0].meta_key_ct, createInput().subBatches[0].metaKeyCt);
  assert.equal("k_meta_hex" in payload.sub_batches[0], false);
  assert.equal("k_file_hex" in payload.sub_batches[0], false);
  assert.equal("raw_key" in payload.sub_batches[0], false);
  assert.equal(result.subBatches[0].bid, "SYN-2026-001");

  await assert.rejects(
    createSupplierOrderV2(createInput(), async () => [receiptRow({
      sub_batches: [{ ...receiptRow().sub_batches[0], expected_quantity: 999 }],
    })]),
    /supplier_order_create_readback_invalid/,
  );

  await assert.rejects(
    createSupplierOrderV2({
      ...createInput(),
      totalQuantity: 2000,
      subBatches: [
        createInput().subBatches[0],
        { ...createInput().subBatches[0], bid: "SYN-2026-002", sequenceIndex: 2 },
      ],
    }, async () => [receiptRow({
      sub_batches: [receiptRow().sub_batches[0], receiptRow().sub_batches[0]],
    })]),
    /supplier_order_create_readback_invalid/,
  );
});

test("keyless carrier order payloads contain no batch-key fields or sentinel secrets", async () => {
  const secureInput = createInput();
  const input = {
    ...secureInput,
    chipModel: "GS1 QR",
    carrierProfileCode: "gs1_digital_link",
    subBatches: secureInput.subBatches.map((item) => ({
      bid: item.bid,
      sequenceIndex: item.sequenceIndex,
      expectedQuantity: item.expectedQuantity,
      keyMaterialMode: "none",
      urlTemplate: `https://nexid.lat/01/<GTIN>/10/<LOT>/21/<SERIAL>`,
      sdmConfig: {
        supplier_order_id: secureInput.supplierOrderId,
        supplier_sequence_index: item.sequenceIndex,
        carrier_profile_code: "gs1_digital_link",
        requested_quantity: item.expectedQuantity,
        key_material_mode: "none",
        url_template: `https://nexid.lat/01/<GTIN>/10/<LOT>/21/<SERIAL>`,
      },
    })),
  };
  const calls = [];
  const keylessReceipt = receiptRow({
    supplier_order: {
      ...receiptRow().supplier_order,
      id: input.supplierOrderId,
      tenant_id: input.tenantId,
    },
    sub_batches: [{
      ...receiptRow().sub_batches[0],
      url_template: input.subBatches[0].urlTemplate,
      key_fingerprint: null,
    }],
  });
  await createSupplierOrderV2(input, async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [keylessReceipt];
  });
  const serialized = JSON.parse(calls[0].values[0]);
  assert.equal(serialized.sub_batches[0].key_material_mode, "none");
  for (const forbidden of [
    "meta_key_ct",
    "file_key_ct",
    "pair_fingerprint",
    "meta_key_fingerprint",
    "file_key_fingerprint",
  ]) {
    assert.equal(forbidden in serialized.sub_batches[0], false, forbidden);
  }
  assert.doesNotMatch(calls[0].values[0], /nexid-app-envelope|K_META_BATCH|K_FILE_BATCH/i);
});

test("supplier order capability check is catalog-only and rolling safe", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ statement: strings.join("?"), values });
    return [{ available: false }];
  };
  assert.equal(await hasSupplierOrderCreateV2(query), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.length, 0);
  assert.match(calls[0].statement, /to_regprocedure\('public\.nexid_create_supplier_order_v2\(jsonb\)'\)/);
  assert.match(calls[0].statement, /has_function_privilege/);
  assert.match(calls[0].statement, /nexid_supplier_order_create_keyless_v1_capability/);
  assert.doesNotMatch(calls[0].statement, /FROM\s+supplier_orders/i);
});

test("keyless carrier rollout waits for 0090 while secure SUN remains compatible with 0079", async () => {
  const query = async () => [{ available: true, keyless_carrier_available: false }];
  assert.equal(await hasSupplierOrderCreateV2(query), true);
  assert.equal(await hasSupplierOrderCreateV2(query, { requireKeylessCarrierSupport: true }), false);
  assert.equal(await hasSupplierOrderCreateV2(
    async () => [{ available: true, keyless_carrier_available: true }],
    { requireKeylessCarrierSupport: true },
  ), true);
});

test("0079 owns the complete order graph under deterministic BID locks", () => {
  const migration = readWorkspaceFile(`apps/api/db/migrations/${SUPPLIER_ORDER_CREATE_V2_MIGRATION}`);
  const route = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/route.ts");
  const post = route.slice(route.indexOf("export async function POST"));

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.nexid_create_supplier_order_v2\(p_input jsonb\)/);
  assert.match(migration, /octet_length\(p_input::text\) > 4194304/);
  assert.match(migration, /FROM auth_sessions auth_session[\s\S]*auth_session\.role::text = 'super_admin'[\s\S]*auth_session\.tenant_id IS NULL/);
  assert.match(migration, /JOIN memberships membership[\s\S]*membership\.role::text = 'super_admin'[\s\S]*membership\.tenant_id IS NULL/);
  assert.doesNotMatch(migration, /p_input->>'actor_email'/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\([\s\S]*'supplier-bid'/);
  assert.ok(
    migration.indexOf("pg_advisory_xact_lock") < migration.indexOf("supplier_order_bid_already_exists"),
    "BID ownership must be checked after deterministic namespace locks",
  );
  assert.match(migration, /INSERT INTO supplier_orders[\s\S]*INSERT INTO batches[\s\S]*INSERT INTO supplier_sub_batches/);
  assert.match(migration, /INSERT INTO batch_keys[\s\S]*INSERT INTO batch_key_material[\s\S]*INSERT INTO evidence_events[\s\S]*INSERT INTO audit_logs/);
  assert.match(migration, /IF v_secure_sun THEN[\s\S]*INSERT INTO batch_keys[\s\S]*INSERT INTO batch_key_material[\s\S]*END IF;/);
  assert.match(migration, /NOT v_secure_sun AND \([\s\S]*item\.value \? 'meta_key_ct'[\s\S]*item\.value \? 'file_key_ct'/);
  assert.match(migration, /ALTER TABLE batches ALTER COLUMN meta_key_ct DROP NOT NULL/);
  assert.match(migration, /ALTER TABLE batches ALTER COLUMN file_key_ct DROP NOT NULL/);
  assert.match(migration, /'software_envelope', true/);
  assert.match(migration, /'managed_kms', false/);
  assert.match(migration, /'hsm_backed', false/);
  assert.doesNotMatch(migration, /hsm_backed'\s*,\s*true|managed_kms'\s*,\s*true/i);
  assert.doesNotMatch(migration, /k_meta_hex|k_file_hex|raw_key/i);
  assert.doesNotMatch(migration, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im);

  assert.match(post, /checkAdminWithPermission\(req, "supplier_order\.create"\)/);
  assert.match(post, /if \(secureSunProfile\)[\s\S]*checkAdminPermission\(req, "batch\.keys\.generate"\)/);
  assert.match(post, /readBoundedJsonBody<Record<string, unknown>>\(req, MAX_SUPPLIER_ORDER_BODY_BYTES\)/);
  assert.match(route, /MAX_SUPPLIER_ORDER_BODY_BYTES = 64 \* 1024/);
  assert.match(post, /RequestBodyTooLargeError[\s\S]*request_body_too_large[\s\S]*413/);
  assert.doesNotMatch(post, /req\.json\(/);
  assert.ok(post.indexOf("readBoundedJsonBody") < post.indexOf("buildSupplierSubBatchPlan("));
  assert.ok(post.indexOf("plannedSubBatchCount") < post.indexOf("buildSupplierSubBatchPlan("));
  assert.match(route, /Number\.isSafeInteger\(parsed\)/);
  assert.match(post, /totalQuantity > MAX_SUPPLIER_ORDER_QUANTITY/);
  assert.match(post, /subBatchSize > totalQuantity/);
  assert.ok(post.indexOf("hasSupplierOrderCreateV2()") < post.indexOf("generateSupplierBatchKeys()"));
  assert.equal((post.match(/createSupplierOrderV2\(/g) || []).length, 1);
  assert.doesNotMatch(post, /INSERT INTO supplier_orders|INSERT INTO batches|INSERT INTO supplier_sub_batches|INSERT INTO batch_keys|INSERT INTO batch_key_material/);
  assert.doesNotMatch(post, /non-transactional/i);
});

test("0090 enforces carrier-scoped batch keys without rewriting the physical SUN path", () => {
  const migration = readWorkspaceFile("apps/api/db/migrations/20260802250000_0090_supplier_carrier_key_scope.sql");
  const route = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/route.ts");
  const keyGenerationIndex = route.indexOf("const keys = generateSupplierBatchKeys()");
  const secureBranchIndex = route.lastIndexOf("if (secureSunProfile)", keyGenerationIndex);

  assert.ok(secureBranchIndex >= 0 && keyGenerationIndex > secureBranchIndex);
  assert.match(route, /keyMaterialMode: "none"/);
  assert.match(route, /requireKeylessCarrierSupport: !secureSunProfile/);
  assert.match(route, /20260802250000_0090_supplier_carrier_key_scope\.sql/);
  assert.match(migration, /ALTER TABLE batches ALTER COLUMN meta_key_ct DROP NOT NULL/);
  assert.match(migration, /ADD CONSTRAINT batches_supplier_carrier_key_scope_v1 CHECK/);
  assert.match(migration, /NOT IN \('ntag424_dna', 'ntag424_dna_tt'\)[\s\S]*meta_key_ct IS NULL[\s\S]*file_key_ct IS NULL/);
  assert.match(migration, /CREATE TRIGGER trg_batch_keys_supplier_carrier_scope_v1/);
  assert.match(migration, /CREATE TRIGGER trg_batch_key_material_supplier_carrier_scope_v1/);
  assert.match(migration, /supplier_batch_key_carrier_scope_forbidden/);
  assert.match(migration, /IF v_secure_sun THEN[\s\S]*INSERT INTO batch_keys[\s\S]*INSERT INTO batch_key_material/);
  assert.doesNotMatch(migration, /hsm_backed'\s*,\s*true|managed_kms'\s*,\s*true/i);
});

test("new physical supplier URLs ignore request-controlled forwarded hosts", () => {
  const route = readWorkspaceFile("apps/api/src/app/admin/supplier-orders/route.ts");
  const post = route.slice(route.indexOf("export async function POST"));

  assert.equal(resolveSupplierPublicTagOrigin({}), "https://nexid.lat");
  assert.equal(resolveSupplierPublicTagOrigin({
    NEXID_PUBLIC_TAG_ORIGIN: "https://tags.partner.example",
    NEXID_PUBLIC_TAG_ALLOWED_ORIGINS: "https://tags.partner.example",
  }), "https://tags.partner.example");
  assert.equal(resolveSupplierPublicTagOrigin({
    NEXID_PUBLIC_TAG_ORIGIN: "https://attacker.example",
    NEXID_PUBLIC_TAG_ALLOWED_ORIGINS: "https://trusted.example",
  }), "https://nexid.lat");
  assert.equal(resolveSupplierPublicTagOrigin({
    NEXID_PUBLIC_TAG_ORIGIN: "http://nexid.lat",
    NEXID_PUBLIC_TAG_ALLOWED_ORIGINS: "http://nexid.lat",
  }), "https://nexid.lat");
  assert.match(post, /resolveSupplierPublicTagOrigin\(\)/);
  assert.doesNotMatch(post, /x-forwarded-host|headers\.get\(["']host["']\)/i);
});

test("supplier order database errors are normalized without leaking SQL or secrets", () => {
  assert.deepEqual(
    supplierOrderCreateError(Object.assign(new Error("supplier_order_bid_already_exists"), { code: "23505" })),
    { status: 409, reason: "supplier_order_bid_already_exists" },
  );
  assert.deepEqual(
    supplierOrderCreateError(Object.assign(new Error("function public.nexid_create_supplier_order_v2(jsonb) does not exist"), { code: "42883" })),
    {
      status: 503,
      reason: "supplier_order_create_v2_migration_required",
      requiredMigration: SUPPLIER_ORDER_CREATE_V2_MIGRATION,
    },
  );
  assert.deepEqual(
    supplierOrderCreateError(new Error("password=must-not-leak host=internal")),
    { status: 503, reason: "supplier_order_create_v2_unavailable" },
  );
});
