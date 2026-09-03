import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PublicCarrierIdentityError,
  resolvePublicCarrierIdentity,
} from "../src/lib/public-carrier-identity.ts";

const tenantA = {
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantSlug: "tenant-a",
  tenantName: "Tenant A",
  tenantStatus: "active",
  batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  bid: "LOT-A-2026",
  batchStatus: "active",
  batchCarrierProfileCode: "qr_basic",
  registeredCarrierProfileCode: "qr_basic",
  tenantCarrierPolicyEnabled: true,
  batchConfig: { product: { name: "Canonical batch product" } },
  tagId: null,
  tagUidHex: null,
  tagStatus: null,
  tagLifecycleState: null,
  tagCarrierProfileCode: null,
  tagProfileCarrierProfileCode: null,
  tagProfile: null,
};

const activeUnit = {
  ...tenantA,
  batchCarrierProfileCode: "ntag213",
  registeredCarrierProfileCode: "ntag213",
  tagId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  tagUidHex: "04AABBCCDD1122",
  tagStatus: "active",
  tagLifecycleState: "active",
  tagCarrierProfileCode: "ntag213",
  tagProfileCarrierProfileCode: "ntag213",
  tagProfile: { product_name: "Canonical unit product", sku: "SKU-A" },
};

const tenantBUnit = {
  ...activeUnit,
  tenantId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  tenantSlug: "tenant-b",
  tenantName: "Tenant B",
  batchId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  bid: "LOT-B-2026",
  tagId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  tagUidHex: "04BBCCDDEE2233",
  tagProfile: { product_name: "Tenant B product", sku: "SKU-B" },
};

function rejectsWith(code) {
  return (error) => error instanceof PublicCarrierIdentityError && error.code === code;
}

test("QR batch locator derives tenant, product scope and carrier from the persisted row", async () => {
  let lookupInput;
  const resolved = await resolvePublicCarrierIdentity({
    tenantSlug: tenantA.tenantSlug,
    bid: tenantA.bid,
    carrierProfileCode: "qr_basic",
    channel: "qr",
    // Browser-only business fields are deliberately ignored by this contract.
    product: "Attacker product",
    role: "superadmin",
  }, async (input) => {
    lookupInput = input;
    return [tenantA];
  });

  assert.deepEqual(lookupInput, { bid: tenantA.bid, uidHex: null, tagId: null });
  assert.equal(resolved.tenantId, tenantA.tenantId);
  assert.equal(resolved.identityScope, "batch");
  assert.equal(resolved.provisioningStatus, "batch_registered");
  assert.equal(resolved.provenance, "declared");
  assert.equal(resolved.physicalPresenceVerified, false);
  assert.equal(resolved.uidHex, null);
  assert.equal(resolved.batchConfig.product.name, "Canonical batch product");
});

test("static NFC unit locator requires an active provisioned UID in the same carrier scope", async () => {
  const resolved = await resolvePublicCarrierIdentity({
    tenantSlug: tenantA.tenantSlug,
    bid: tenantA.bid,
    carrierProfileCode: "ntag213",
    channel: "static_nfc",
    uidHex: "04aabbccdd1122",
  }, async (input) => {
    assert.deepEqual(input, { bid: tenantA.bid, uidHex: activeUnit.tagUidHex, tagId: null });
    return [activeUnit];
  });

  assert.equal(resolved.identityScope, "unit");
  assert.equal(resolved.provisioningStatus, "unit_active");
  assert.equal(resolved.provenance, "declared_static_nfc");
  assert.equal(resolved.physicalPresenceVerified, false);
  assert.equal(resolved.uidHex, activeUnit.tagUidHex);
  assert.equal(resolved.tagProfile.product_name, "Canonical unit product");
});

test("static NFC also supports an explicitly registered batch/model locator without inventing a UID", async () => {
  const batchLevel = {
    ...tenantA,
    batchCarrierProfileCode: "ntag216",
    registeredCarrierProfileCode: "ntag216",
  };
  const resolved = await resolvePublicCarrierIdentity({
    tenantSlug: tenantA.tenantSlug,
    bid: tenantA.bid,
    carrierProfileCode: "ntag216",
    channel: "static_nfc",
  }, async () => [batchLevel]);

  assert.equal(resolved.identityScope, "batch");
  assert.equal(resolved.uidHex, null);
  assert.equal(resolved.provenance, "declared_static_nfc");
  assert.equal(resolved.physicalPresenceVerified, false);
});

test("GS1 stays bound to the active registry tenant, batch and optional unit", async () => {
  const gs1Unit = {
    ...activeUnit,
    batchCarrierProfileCode: "gs1_digital_link",
    registeredCarrierProfileCode: "gs1_digital_link",
    tagCarrierProfileCode: "gs1_digital_link",
    tagProfileCarrierProfileCode: "gs1_digital_link",
  };
  const registryBinding = {
    tenantId: tenantA.tenantId,
    tenantSlug: tenantA.tenantSlug,
    batchId: tenantA.batchId,
    bid: tenantA.bid,
    tagId: activeUnit.tagId,
  };
  const resolved = await resolvePublicCarrierIdentity({
    tenantSlug: tenantA.tenantSlug,
    bid: tenantA.bid,
    carrierProfileCode: "gs1_digital_link",
    channel: "gs1_qr",
    registryBinding,
  }, async (input) => {
    assert.deepEqual(input, { bid: tenantA.bid, uidHex: null, tagId: activeUnit.tagId });
    return [gs1Unit];
  });

  assert.equal(resolved.identityScope, "unit");
  assert.equal(resolved.uidHex, activeUnit.tagUidHex);
  assert.equal(resolved.provenance, "declared");
});

test("two valid tenants resolve independently while cross-tenant, cross-carrier and cross-unit locators fail closed", async () => {
  const [resolvedA, resolvedB] = await Promise.all([
    resolvePublicCarrierIdentity({
      tenantSlug: tenantA.tenantSlug,
      bid: tenantA.bid,
      carrierProfileCode: "ntag213",
      channel: "static_nfc",
      uidHex: activeUnit.tagUidHex,
    }, async () => [activeUnit]),
    resolvePublicCarrierIdentity({
      tenantSlug: tenantBUnit.tenantSlug,
      bid: tenantBUnit.bid,
      carrierProfileCode: "ntag213",
      channel: "static_nfc",
      uidHex: tenantBUnit.tagUidHex,
    }, async () => [tenantBUnit]),
  ]);
  assert.equal(resolvedA.tenantId, tenantA.tenantId);
  assert.equal(resolvedA.tagProfile.sku, "SKU-A");
  assert.equal(resolvedB.tenantId, tenantBUnit.tenantId);
  assert.equal(resolvedB.tagProfile.sku, "SKU-B");

  await assert.rejects(
    () => resolvePublicCarrierIdentity({
      tenantSlug: "tenant-b",
      bid: tenantA.bid,
      carrierProfileCode: "qr_basic",
      channel: "qr",
    }, async () => [tenantA]),
    rejectsWith("public_carrier_tenant_binding_mismatch"),
  );

  await assert.rejects(
    () => resolvePublicCarrierIdentity({
      tenantSlug: tenantA.tenantSlug,
      bid: tenantA.bid,
      carrierProfileCode: "ntag215",
      channel: "static_nfc",
    }, async () => [{
      ...tenantA,
      batchCarrierProfileCode: "ntag213",
      registeredCarrierProfileCode: "ntag213",
    }]),
    rejectsWith("public_carrier_profile_binding_mismatch"),
  );

  await assert.rejects(
    () => resolvePublicCarrierIdentity({
      tenantSlug: tenantA.tenantSlug,
      bid: tenantA.bid,
      carrierProfileCode: "ntag213",
      channel: "static_nfc",
      uidHex: "04DEADBEEF0001",
    }, async () => [{
      ...activeUnit,
      tagId: null,
      tagUidHex: null,
      tagStatus: null,
      tagLifecycleState: null,
      tagCarrierProfileCode: null,
      tagProfile: null,
    }]),
    rejectsWith("public_carrier_unit_not_registered"),
  );

  await assert.rejects(
    () => resolvePublicCarrierIdentity({
      tenantSlug: tenantA.tenantSlug,
      bid: tenantA.bid,
      carrierProfileCode: "ntag213",
      channel: "static_nfc",
      uidHex: tenantBUnit.tagUidHex,
    }, async () => [{
      ...activeUnit,
      tagId: null,
      tagUidHex: null,
      tagStatus: null,
      tagLifecycleState: null,
      tagCarrierProfileCode: null,
      tagProfile: null,
    }]),
    rejectsWith("public_carrier_unit_not_registered"),
  );
});

test("inactive or ambiguously resolved units never reach the public DPP", async () => {
  await assert.rejects(
    () => resolvePublicCarrierIdentity({
      tenantSlug: tenantA.tenantSlug,
      bid: tenantA.bid,
      carrierProfileCode: "ntag213",
      channel: "static_nfc",
      uidHex: activeUnit.tagUidHex,
    }, async () => [{ ...activeUnit, tagStatus: "inactive", tagLifecycleState: "inactive" }]),
    rejectsWith("public_carrier_unit_not_active"),
  );

  await assert.rejects(
    () => resolvePublicCarrierIdentity({
      tenantSlug: tenantA.tenantSlug,
      bid: tenantA.bid,
      carrierProfileCode: "qr_basic",
      channel: "qr",
    }, async () => [tenantA, { ...tenantA }]),
    rejectsWith("public_carrier_identity_ambiguous"),
  );
});

test("tenant carrier policy and exact batch, tag and tag-profile bindings fail closed", async () => {
  await assert.rejects(
    () => resolvePublicCarrierIdentity({
      tenantSlug: tenantA.tenantSlug,
      bid: tenantA.bid,
      carrierProfileCode: "ntag213",
      channel: "static_nfc",
      uidHex: activeUnit.tagUidHex,
    }, async () => [{ ...activeUnit, tenantCarrierPolicyEnabled: false }]),
    rejectsWith("public_carrier_tenant_policy_not_enabled"),
  );

  await assert.rejects(
    () => resolvePublicCarrierIdentity({
      tenantSlug: tenantA.tenantSlug,
      bid: tenantA.bid,
      carrierProfileCode: "ntag213",
      channel: "static_nfc",
      uidHex: activeUnit.tagUidHex,
    }, async () => [{ ...activeUnit, tagCarrierProfileCode: null }]),
    rejectsWith("public_carrier_unit_profile_mismatch"),
  );

  await assert.rejects(
    () => resolvePublicCarrierIdentity({
      tenantSlug: tenantA.tenantSlug,
      bid: tenantA.bid,
      carrierProfileCode: "ntag213",
      channel: "static_nfc",
      uidHex: activeUnit.tagUidHex,
    }, async () => [{ ...activeUnit, tagProfileCarrierProfileCode: "ntag215" }]),
    rejectsWith("public_carrier_unit_profile_not_provisioned"),
  );
});

test("SUN public route records only the resolved identity and requires a durable canonical event", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  const qrStart = route.indexOf("async function resolveQrTenantBatch");
  const qrEnd = route.indexOf("async function getPassportSnapshot");
  const qrSource = route.slice(qrStart, qrEnd);
  const passportStart = route.indexOf("async function getPassportSnapshot");
  const passportEnd = route.indexOf("async function getBatchSunContext");
  const passportSource = route.slice(passportStart, passportEnd);
  const timelineStart = route.indexOf("async function getTimelineSummary");
  const timelineEnd = route.indexOf("async function getSdkSensorTimelineSummary");
  const timelineSource = route.slice(timelineStart, timelineEnd);

  assert.match(qrSource, /AND b\.bid = \$\{input\.bid\}/);
  assert.doesNotMatch(qrSource, /tn\.slug = \$\{input\./);
  assert.match(qrSource, /candidate\.batch_id = b\.id/);
  assert.match(qrSource, /FROM tenant_carrier_policies tcp/);
  assert.match(qrSource, /tcp\.tenant_id = tn\.id/);
  assert.match(qrSource, /tcp\.enabled = true/);
  assert.match(qrSource, /LEFT JOIN tag_profiles tp ON tp\.tag_id = tag\.id/);
  assert.match(qrSource, /resolvePublicCarrierIdentity/);
  assert.match(qrSource, /uidHex: carrierIdentity\.uidHex/);
  assert.match(qrSource, /tenantId = carrierIdentity\.tenantId/);
  assert.match(qrSource, /qr_event_persistence_unavailable/);
  assert.match(qrSource, /tagProfile\.product_name \|\| gs1Registry\?\.displayName/);
  assert.match(qrSource, /physicalPresenceVerified: carrierIdentity\.physicalPresenceVerified/);
  assert.match(qrSource, /verdict: "identified_unverified"/);
  assert.equal((passportSource.match(/AND e\.tenant_id = b\.tenant_id/g) || []).length, 3);
  assert.match(timelineSource, /JOIN batches b ON b\.id = e\.batch_id AND b\.tenant_id = e\.tenant_id/);
  assert.doesNotMatch(qrSource, /provenance:\s*"physical_tap"/);
  assert.doesNotMatch(qrSource, /productName:\s*firstParam/);
  assert.doesNotMatch(qrSource, /tenantId:\s*firstParam/);
  assert.doesNotMatch(qrSource, /CREATE TABLE IF NOT EXISTS sun_scan_attempts/);
});
