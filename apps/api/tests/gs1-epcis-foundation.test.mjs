import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decodeGs1RegistryCursor,
  encodeGs1RegistryCursor,
  gs1IdentityKey,
  isValidGtin14,
  normalizeGs1GtinPrefixEntitlementGrant,
  normalizeGs1Identity,
  parseGs1DigitalLinkUri,
} from "../src/lib/gs1-digital-link-registry.ts";
import {
  CBV_VERSION,
  decodeEpcisCursor,
  encodeEpcisCursor,
  EPCIS_CAPTURE_MAX_BYTES,
  EPCIS_CAPTURE_MAX_EVENTS,
  EPCIS_CONTEXT,
  EPCIS_QUERY_MAX_LIMIT,
  EPCIS_VERSION,
  parseEpcisQueryFilters,
  validateEpcisDocument,
  validateEpcisIdempotencyKey,
} from "../src/lib/epcis.ts";

const VALID_GTIN = "09506000134352";
const EPC = `https://id.nexid.lat/01/${VALID_GTIN}/10/LOT-9/21/SER-42`;

function document(event = {}) {
  return {
    "@context": EPCIS_CONTEXT,
    type: "EPCISDocument",
    schemaVersion: "2.0",
    creationDate: "2026-07-29T12:00:00.000Z",
    epcisBody: {
      eventList: [{
        type: "ObjectEvent",
        eventTime: "2026-07-29T11:55:00.000Z",
        eventTimeZoneOffset: "-03:00",
        action: "OBSERVE",
        bizStep: "shipping",
        disposition: "in_transit",
        epcList: [EPC],
        ...event,
      }],
    },
  };
}

test("GS1 identities validate check digits and exact bounded Digital Link qualifiers", () => {
  assert.equal(isValidGtin14(VALID_GTIN), true);
  assert.equal(isValidGtin14("09506000134353"), false);
  const parsed = parseGs1DigitalLinkUri(EPC);
  assert.deepEqual(parsed, { gtin: VALID_GTIN, lot: "LOT-9", serial: "SER-42" });
  assert.equal(gs1IdentityKey(parsed), `${VALID_GTIN}\u0000LOT-9\u0000SER-42`);
  assert.throws(() => normalizeGs1Identity({ gtin: VALID_GTIN, lot: "bad/path" }), /gs1_lot_invalid/);
  assert.throws(() => parseGs1DigitalLinkUri(`http://id.nexid.lat/01/${VALID_GTIN}`), /epcis_identifier_invalid/);
  assert.throws(() => parseGs1DigitalLinkUri(`https://id.nexid.lat/01/${VALID_GTIN}/99/unknown`), /epcis_identifier_profile_unsupported/);
});

test("GTIN prefix grants require bounded platform-verified authority evidence", () => {
  assert.deepEqual(normalizeGs1GtinPrefixEntitlementGrant({
    tenantSlug: " Syngenta-AR ",
    canonicalGtinPrefix: "0950600",
    verificationMethod: "GS1_LICENSE_DOCUMENT",
    evidenceReference: "vault://gs1/syngenta-ar/license-2026",
    reason: "Verified by platform compliance before registry activation.",
  }), {
    tenantSlug: "syngenta-ar",
    canonicalGtinPrefix: "0950600",
    verificationMethod: "gs1_license_document",
    evidenceReference: "vault://gs1/syngenta-ar/license-2026",
    reason: "Verified by platform compliance before registry activation.",
  });
  assert.throws(() => normalizeGs1GtinPrefixEntitlementGrant({
    tenantSlug: "syngenta-ar",
    canonicalGtinPrefix: "123",
    verificationMethod: "gs1_license_document",
    evidenceReference: "vault://evidence",
    reason: "Verified authority.",
  }), /gs1_gtin_prefix_invalid/);
  assert.throws(() => normalizeGs1GtinPrefixEntitlementGrant({
    tenantSlug: "syngenta-ar",
    canonicalGtinPrefix: "0950600",
    verificationMethod: "tenant_self_assertion",
    evidenceReference: "vault://evidence",
    reason: "Self asserted.",
  }), /gs1_gtin_prefix_verification_method_invalid/);
  assert.throws(() => normalizeGs1GtinPrefixEntitlementGrant({
    tenantSlug: "syngenta-ar",
    canonicalGtinPrefix: "0950600",
    verificationMethod: "brand_authorization",
    evidenceReference: "ok\nforged",
    reason: "Verified authority.",
  }), /gs1_gtin_prefix_evidence_reference_invalid/);
});

test("bounded EPCIS profile normalizes CBV values and strips caller recordTime", () => {
  const first = validateEpcisDocument(document({ recordTime: "2020-01-01T00:00:00Z" }));
  const second = validateEpcisDocument(document({ recordTime: "2020-01-01T00:00:00Z" }));
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].event_type, "ObjectEvent");
  assert.equal(first.events[0].biz_step, "https://ref.gs1.org/cbv/BizStep-shipping");
  assert.equal(first.events[0].disposition, "https://ref.gs1.org/cbv/Disp-in_transit");
  assert.equal(first.events[0].event.recordTime, undefined);
  assert.match(first.events[0].client_event_id, /^urn:uuid:/);
  assert.equal(first.events[0].client_event_id, second.events[0].client_event_id);
  assert.deepEqual(first.events[0].identities, [{ gtin: VALID_GTIN, lot: "LOT-9", serial: "SER-42" }]);
});

test("EPCIS capture rejects unsupported profiles, invalid shapes and oversized event lists", () => {
  assert.throws(() => validateEpcisDocument({ ...document(), schemaVersion: "1.2" }), /epcis_document_profile_unsupported/);
  assert.throws(() => validateEpcisDocument({ ...document(), "@context": "https://attacker.example/context" }), /epcis_context_required/);
  assert.throws(() => validateEpcisDocument(document({ action: "INVALID" })), /epcis_action_invalid/);
  assert.throws(() => validateEpcisDocument(document({ epcList: [] })), /epcis_event_identifier_required/);
  const tooMany = document();
  tooMany.epcisBody.eventList = Array.from({ length: EPCIS_CAPTURE_MAX_EVENTS + 1 }, () => document().epcisBody.eventList[0]);
  assert.throws(() => validateEpcisDocument(tooMany), /epcis_event_count_invalid/);
  const tooManyProjections = document();
  const identifiers = Array.from({ length: 100 }, (_, index) =>
    `https://id.nexid.lat/01/${VALID_GTIN}/10/LOT-9/21/SER-${String(index).padStart(3, "0")}`);
  tooManyProjections.epcisBody.eventList = Array.from({ length: 11 }, (_, index) => ({
    ...document().epcisBody.eventList[0],
    eventID: `urn:uuid:00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    epcList: identifiers,
  }));
  assert.throws(() => validateEpcisDocument(tooManyProjections), /epcis_projection_count_invalid/);
});

test("idempotency and keyset pagination inputs are strict and bounded", () => {
  assert.equal(validateEpcisIdempotencyKey("erp-shipment:2026-07-29:42"), "erp-shipment:2026-07-29:42");
  assert.throws(() => validateEpcisIdempotencyKey(""), /epcis_idempotency_key_required/);
  const cursor = encodeEpcisCursor({
    eventTime: "2026-07-29T12:00:00.000Z",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  assert.deepEqual(decodeEpcisCursor(cursor), {
    eventTime: "2026-07-29T12:00:00.000Z",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  assert.throws(() => decodeEpcisCursor("not-json"), /epcis_cursor_invalid/);
  const registryCursor = encodeGs1RegistryCursor({
    updatedAt: "2026-07-29T12:00:00.000Z",
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  });
  assert.deepEqual(decodeGs1RegistryCursor(registryCursor), {
    updatedAt: "2026-07-29T12:00:00.000Z",
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  });
  assert.throws(() => decodeGs1RegistryCursor("not-json"), /gs1_cursor_invalid/);
  assert.equal(parseEpcisQueryFilters(new URLSearchParams("limit=200&eventType=ObjectEvent")).limit, EPCIS_QUERY_MAX_LIMIT);
  assert.throws(() => parseEpcisQueryFilters(new URLSearchParams("limit=201")), /epcis_limit_invalid/);
});

test("migrations separate the enum commit boundary and make capture atomic, append-only and canonical", async () => {
  const enumMigration = await readFile(new URL("../db/migrations/20260729110000_0068_epcis_event_type.sql", import.meta.url), "utf8");
  const migration = await readFile(new URL("../db/migrations/20260729110500_0069_gs1_epcis_foundation.sql", import.meta.url), "utf8");
  assert.match(enumMigration, /ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'EPCIS_EVENT_CAPTURED'/);
  assert.doesNotMatch(enumMigration, /CREATE OR REPLACE FUNCTION nexid_capture_epcis_document_v1/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS gs1_digital_link_identities/);
  assert.match(migration, /canonical_gtin_prefix text NOT NULL/);
  assert.match(migration, /entitlement\.canonical_gtin_prefix <> NEW\.canonical_gtin_prefix/);
  assert.match(migration, /FOREIGN KEY \(entitlement_id, tenant_id\)[\s\S]*REFERENCES gs1_gtin_prefix_entitlements\(id, tenant_id\)/);
  assert.match(migration, /CONSTRAINT gs1_identity_batch_fkey[\s\S]*FOREIGN KEY \(batch_id\) REFERENCES batches\(id\)/);
  assert.match(migration, /CONSTRAINT epcis_capture_api_key_fkey[\s\S]*FOREIGN KEY \(api_key_id\) REFERENCES tenant_api_keys\(id\)/);
  assert.match(migration, /CONSTRAINT epcis_identifier_canonical_operation_fkey[\s\S]*FOREIGN KEY \(canonical_operation_id\)[\s\S]*REFERENCES canonical_event_operations\(id\)/);
  assert.doesNotMatch(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_(?:batches_id_tenant_epcis|tenant_api_keys_id_tenant_epcis|canonical_event_operations_epcis_scope)/);
  assert.match(migration, /nexid_reject_referenced_batch_reparent_v1/);
  assert.match(migration, /nexid_reject_referenced_api_key_reparent_v1/);
  assert.match(migration, /FOR SHARE/);
  assert.match(migration, /uq_gs1_identity_public_path/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS epcis_capture_operations/);
  assert.match(migration, /UNIQUE \(tenant_id, idempotency_key\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION nexid_capture_epcis_document_v1/);
  assert.doesNotMatch(migration, /ALTER TYPE event_type ADD VALUE/);
  assert.match(migration, /epcis_api_key_tenant_mismatch/);
  assert.match(migration, /epcis_unknown_gs1_identity/);
  assert.match(migration, /JOIN gs1_gtin_prefix_entitlements entitlement[\s\S]*entitlement\.status = 'active'[\s\S]*FOR SHARE OF identity, entitlement/);
  assert.match(migration, /epcis_idempotency_conflict/);
  assert.match(migration, /INSERT INTO events/);
  assert.match(migration, /INSERT INTO canonical_event_operations/);
  assert.match(migration, /INSERT INTO webhook_deliveries/);
  assert.match(migration, /declared_business_event/);
  assert.match(migration, /'cryptographic_authentication', false/);
  assert.match(migration, /'schemaVersion', '1\.0'/);
  assert.match(migration, /'evt_canonical_' \|\| v_operation_id::text/);
  assert.match(migration, /epcis_append_only/);
  assert.doesNotMatch(migration, /nexid_persist_sun_scan_v1\s*\(/);
});

test("EPCIS routes enforce tenant API-key scopes, distributed limits, body bounds and cursor export", async () => {
  const capture = await readFile(new URL("../src/app/api/v1/sdk/epcis/capture/route.ts", import.meta.url), "utf8");
  const query = await readFile(new URL("../src/app/api/v1/sdk/epcis/events/route.ts", import.meta.url), "utf8");
  const exportRoute = await readFile(new URL("../src/app/api/v1/sdk/epcis/export/route.ts", import.meta.url), "utf8");
  const publicResolver = await readFile(new URL("../src/app/public/gs1/resolve/route.ts", import.meta.url), "utf8");
  const adminRegistry = await readFile(new URL("../src/app/admin/gs1/identities/route.ts", import.meta.url), "utf8");
  const adminRegistryStatus = await readFile(new URL("../src/app/admin/gs1/identities/[id]/route.ts", import.meta.url), "utf8");
  const entitlementAdmin = await readFile(new URL("../src/app/admin/gs1/entitlements/route.ts", import.meta.url), "utf8");
  const entitlementLifecycle = await readFile(new URL("../src/app/admin/gs1/entitlements/[id]/route.ts", import.meta.url), "utf8");
  const registryLibrary = await readFile(new URL("../src/lib/gs1-digital-link-registry.ts", import.meta.url), "utf8");
  const openApi = JSON.parse(await readFile(new URL("../public/openapi/nexid-sdk-v1.json", import.meta.url), "utf8"));
  assert.match(capture, /authenticateSdkRequest\(req, "sdk:epcis:write"\)/);
  assert.match(capture, /enforceSdkAuthenticationRateLimit/);
  assert.match(capture, /enforceSdkEpcisCaptureRateLimit/);
  assert.match(capture, /readRequestTextBounded\(req, EPCIS_CAPTURE_MAX_BYTES\)/);
  assert.match(capture, /idempotency-key/);
  assert.match(query, /authenticateSdkRequest\(req, "sdk:epcis:read"\)/);
  assert.match(query, /x-nexid-next-cursor/);
  assert.match(exportRoute, /authenticateSdkRequest\(req, "sdk:epcis:read"\)/);
  assert.match(exportRoute, /content-disposition/);
  assert.match(publicResolver, /resolveActiveGs1Identity/);
  assert.match(publicResolver, /gs1_identity_not_found/);
  assert.match(adminRegistry, /readBoundedJsonBody/);
  assert.match(adminRegistry, /checkGs1RegistryPermission/);
  assert.match(adminRegistry, /nextCursor/);
  assert.match(adminRegistry, /rateClass: "public"/);
  assert.doesNotMatch(adminRegistry, /authorityBasis|authorityReference|authority_basis|authority_reference/);
  assert.match(adminRegistryStatus, /updateGs1IdentityStatus/);
  assert.match(adminRegistryStatus, /expectedStatus/);
  assert.match(adminRegistryStatus, /retiredIsTerminal: true/);
  assert.match(entitlementAdmin, /checkAdmin\(req, \["super_admin"\]\)/);
  assert.doesNotMatch(entitlementAdmin, /principal\.mfaVerified|mfa_required/);
  assert.match(entitlementAdmin, /grantGs1GtinPrefixEntitlement/);
  assert.match(entitlementAdmin, /tenantSelfAssertionAccepted: false/);
  assert.match(entitlementLifecycle, /checkAdmin\(req, \["super_admin"\]\)/);
  assert.doesNotMatch(entitlementLifecycle, /principal\.mfaVerified|mfa_required/);
  assert.match(entitlementLifecycle, /revokeGs1GtinPrefixEntitlement/);
  assert.match(entitlementLifecycle, /activeIdentitiesResolveAfterRevocation: false/);
  assert.match(registryLibrary, /resolveTenantGtinPrefixEntitlement/);
  assert.match(registryLibrary, /entitlement\.canonical_gtin_prefix/);
  assert.doesNotMatch(registryLibrary, /entitlement\.gtin_prefix/);
  assert.match(registryLibrary, /entitlement\.status AS entitlement_status/);
  assert.match(registryLibrary, /effectiveStatus:/);
  assert.match(registryLibrary, /entitlement_missing/);
  assert.match(publicResolver, /no-store, max-age=0, must-revalidate/);
  assert.doesNotMatch(publicResolver, /s-maxage/);
  assert.equal(openApi.paths["/api/v1/sdk/epcis/capture"].post["x-nexid-required-scope"], "sdk:epcis:write");
  assert.equal(openApi.paths["/api/v1/sdk/epcis/events"].get["x-nexid-required-scope"], "sdk:epcis:read");
  assert.equal(openApi.paths["/api/v1/sdk/epcis/export"].get["x-nexid-profile"], "bounded-foundation-not-certified");
  for (const status of ["413", "422", "429", "503"]) {
    assert.ok(openApi.paths["/api/v1/sdk/epcis/capture"].post.responses[status]);
  }
  assert.equal(EPCIS_VERSION, "2.0");
  assert.equal(CBV_VERSION, "2.0");
  assert.equal(EPCIS_CAPTURE_MAX_BYTES, 524288);
});
