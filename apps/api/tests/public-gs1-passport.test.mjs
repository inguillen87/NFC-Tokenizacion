import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Gs1RegistryError } from "../src/lib/gs1-digital-link-registry.ts";
import { resolvePublicGs1PassportBinding } from "../src/lib/public-gs1-passport.ts";

const record = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  tenantSlug: "agro-one",
  batchId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  bid: "AGRO-LOT-1",
  tagId: null,
  gtin: "09506000134352",
  lot: "LOT-1",
  serial: "SER-1",
  status: "active",
  entitlementId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  displayName: "Registered agro product",
  metadata: { agro: { crop: "maize" } },
  createdAt: "2026-08-02T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
};

const input = {
  registryId: record.id,
  tenantSlug: record.tenantSlug,
  bid: record.bid,
  gtin: record.gtin,
  lot: record.lot,
  serial: record.serial,
};

test("public GS1 passport scope is re-resolved and bound to the active registry record", async () => {
  let receivedIdentity;
  const resolved = await resolvePublicGs1PassportBinding(input, async (identity) => {
    receivedIdentity = identity;
    return record;
  });
  assert.deepEqual(receivedIdentity, { gtin: record.gtin, lot: record.lot, serial: record.serial });
  assert.equal(resolved.batchId, record.batchId);
  assert.equal(resolved.metadata.agro.crop, "maize");
});

test("public GS1 passport rejects registry, tenant, batch and qualifier mismatches", async () => {
  for (const changed of [
    { registryId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
    { tenantSlug: "other-tenant" },
    { bid: "OTHER-BATCH" },
  ]) {
    await assert.rejects(
      () => resolvePublicGs1PassportBinding({ ...input, ...changed }, async () => record),
      (error) => error instanceof Gs1RegistryError && error.code === "gs1_registry_binding_mismatch",
    );
  }

  await assert.rejects(
    () => resolvePublicGs1PassportBinding({ ...input, serial: "SER-2" }, async () => record),
    (error) => error instanceof Gs1RegistryError && error.code === "gs1_registry_binding_mismatch",
  );
  await assert.rejects(
    () => resolvePublicGs1PassportBinding({ ...input, registryId: "not-a-uuid" }, async () => record),
    (error) => error instanceof Gs1RegistryError && error.code === "gs1_registry_id_invalid",
  );
});

test("SUN QR path derives GS1 tenant/batch from the registry and keeps authentication claims false", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  assert.match(route, /resolvePublicGs1PassportBinding/);
  assert.match(route, /tenantSlug = gs1Registry\.tenantSlug\.toLowerCase\(\)/);
  assert.match(route, /requestedBid = gs1Registry\.bid/);
  assert.match(route, /gs1_registry_batch_binding_mismatch/);
  assert.match(route, /GS1_IDENTITY_RESOLVED_NOT_AUTHENTICATED/);
  assert.match(route, /cryptographicNfcAuthentication: false/);
  assert.doesNotMatch(route, /trust_level[^\n]{0,120}(?:===|==)/);
  assert.doesNotMatch(route, /authentication_level[^\n]{0,120}(?:===|==)/);
});
