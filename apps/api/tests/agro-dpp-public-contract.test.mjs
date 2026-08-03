import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  agroPublicLinks,
  hasConfiguredAgroProfile,
  normalizeAgroProductProfile,
} = await import("../src/lib/agro-product-profile.ts");
const {
  isPublicExperienceContextBlocked,
  isPublicClientExperienceEvent,
  isSensitivePublicExperienceEvent,
  loadPublicExperienceContext,
  normalizePublicExperienceEventType,
  normalizePublicExperienceIdempotencyKey,
  recordPublicExperienceEvent,
  sanitizePublicExperienceData,
} = await import("../src/lib/public-experience-events.ts");

test("Agro DPP merges tag, GS1 and batch profiles without leaking arbitrary metadata", () => {
  const profile = normalizeAgroProductProfile({
    batchConfig: {
      product_name: "Batch product",
      agro_product_profile: {
        crop: "Maíz",
        active_ingredient: "Ingredient A",
        technical_sheet_url: "https://docs.example.test/technical.pdf#private-fragment",
        safety_sheet_url: "http://unsafe.example.test/sds.pdf",
        ppe_items: ["Guantes", "Protección ocular"],
        support_contact: { email: "AGRO@EXAMPLE.TEST", phone: "+54 11 4444 5555" },
      },
    },
    registryMetadata: { agro: { batch_lot: "LOT-GS1", registration_number: "REG-77" } },
    tagLocaleData: { agro: { product_name: "Tag product", seed_variety: "VT-1" } },
    identity: { gtin: "09506000134352", lot: "LOT-IDENTITY" },
  });

  assert.equal(profile.schemaVersion, "agro-dpp-v1");
  assert.equal(profile.productName, "Tag product");
  assert.equal(profile.crop, "Maíz");
  assert.equal(profile.seedVariety, "VT-1");
  assert.equal(profile.batchLot, "LOT-IDENTITY");
  assert.equal(profile.registrationNumber, "REG-77");
  assert.equal(profile.technicalSheetUrl, "https://docs.example.test/technical.pdf");
  assert.equal(profile.safetySheetUrl, null);
  assert.deepEqual(profile.ppe.items, ["Guantes", "Protección ocular"]);
  assert.equal(profile.support.email, "agro@example.test");
  assert.equal(hasConfiguredAgroProfile(profile), true);
  assert.deepEqual(agroPublicLinks(profile), {
    technicalSheet: "https://docs.example.test/technical.pdf",
    safetySheet: null,
    cropwise: null,
    support: null,
    training: null,
    loyalty: null,
    recallStatus: null,
  });
  assert.equal("secret" in profile, false);
});

test("the tenant-scoped batch product endpoint persists only the normalized Agro profile", async () => {
  const route = await readFile(new URL("../src/app/admin/batches/[bid]/product-config/route.ts", import.meta.url), "utf8");
  assert.match(route, /getAdminTenantAccess\(req\)/);
  assert.match(route, /normalizeAgroProductProfile/);
  assert.match(route, /hasConfiguredAgroProfile/);
  assert.match(route, /nextConfig\.agro_product_profile = agroProfile/);
  assert.match(route, /agro_product_profile_invalid/);
});

test("public experience events are exact, payload-bounded and trust-gated", () => {
  assert.equal(normalizePublicExperienceEventType("technical_sheet_viewed"), "TECHNICAL_SHEET_VIEWED");
  assert.equal(normalizePublicExperienceEventType("OWNERSHIP_ACTIVATED"), null);
  assert.equal(normalizePublicExperienceIdempotencyKey("agro_1234567890123456"), "agro_1234567890123456");
  assert.equal(normalizePublicExperienceIdempotencyKey("short"), null);
  assert.equal(isSensitivePublicExperienceEvent("LOYALTY_JOINED"), true);
  assert.equal(isSensitivePublicExperienceEvent("LOYALTY_OFFER_VIEWED"), true);
  assert.equal(isSensitivePublicExperienceEvent("PRODUCT_VIEWED"), false);
  assert.equal(isPublicClientExperienceEvent("TRAINING_STARTED"), true);
  assert.equal(isPublicClientExperienceEvent("LOYALTY_OFFER_VIEWED"), true);
  assert.equal(isPublicClientExperienceEvent("TRAINING_COMPLETED"), false);
  assert.equal(isPublicClientExperienceEvent("LOYALTY_JOINED"), false);
  assert.equal(isPublicClientExperienceEvent("LEAD_CREATED"), false);
  assert.equal(isPublicExperienceContextBlocked({ result: "VALID", verdict: "valid", riskLevel: "none", reason: "", productState: "VALID_CLOSED" }), false);
  assert.equal(isPublicExperienceContextBlocked({ result: "INVALID", verdict: "invalid", riskLevel: "high", reason: "SUN_PROFILE_MISMATCH", productState: "" }), true);
  assert.equal(isPublicExperienceContextBlocked({ result: "INVALID", verdict: "valid", riskLevel: "none", reason: "", productState: "" }), true);
  assert.equal(isPublicExperienceContextBlocked({ result: "UNKNOWN_FUTURE_STATE", verdict: "valid", riskLevel: "none", reason: "", productState: "" }), true);
  assert.equal(isPublicExperienceContextBlocked({ result: "VALID_CLOSED", verdict: "unexpected", riskLevel: "none", reason: "", productState: "VALID_CLOSED" }), true);
  assert.deepEqual(sanitizePublicExperienceData({
    surface: "agro_dpp",
    destinationHost: "docs.example.test",
    email: "must-not-persist@example.test",
    nested: { unsafe: true },
  }), { surface: "agro_dpp", destinationHost: "docs.example.test" });
});

test("experience context and writer bind tenant/event identity and use a transaction advisory lock", async () => {
  let contextSql = "";
  const context = await loadPublicExperienceContext("42", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", async (strings) => {
    contextSql = strings.join("?");
    return [{
      event_id: "42",
      tenant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tag_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      bid: "BATCH-42",
      result: "VALID",
      verdict: "valid",
      risk_level: "none",
      reason: "ok",
      product_state: "VALID_CLOSED",
    }];
  });
  assert.match(contextSql, /e\.tenant_id = \?::uuid/);
  assert.equal(context?.eventId, "42");

  let writerSql = "";
  let writerValues = [];
  const saved = await recordPublicExperienceEvent({
    context,
    eventType: "PRODUCT_VIEWED",
    idempotencyKey: "agro_1234567890123456",
    data: { surface: "agro_dpp" },
    traceId: "trace-42",
  }, async (strings, ...values) => {
    writerSql = strings.join("?");
    writerValues = values;
    return [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", created_at: "2026-08-02T12:00:00.000Z", replayed: false }];
  });
  assert.match(writerSql, /pg_advisory_xact_lock/);
  assert.match(writerSql, /sdk_external_events/);
  assert.match(writerSql, /api_key_id, batch_id, tag_id/);
  assert.match(writerSql, /NULL, \?/);
  assert.ok(writerValues.includes("PRODUCT_VIEWED"));
  assert.equal(saved.replayed, false);

  await assert.rejects(
    () => recordPublicExperienceEvent({
      context,
      eventType: "SAFETY_SHEET_VIEWED",
      idempotencyKey: "agro_1234567890123456",
      data: { surface: "agro_dpp" },
      traceId: "trace-42",
    }, async () => [{
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      created_at: "2026-08-02T12:00:00.000Z",
      replayed: true,
      conflict: true,
    }]),
    /public_experience_event_idempotency_conflict/,
  );
});
