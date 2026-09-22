import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  AGRO_EXPERIENCE_EVENT_TYPES,
  OFFLINE_VERIFICATION_PENDING_COPY,
  normalizeAgroDppProfile,
  resolveAgroSensitiveActionGate,
  resolveAgroTrustCopy,
} = await import("../src/app/sun/agro-dpp-model.ts");

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Agro post-tap trust copy is exact and sensitive actions fail closed", () => {
  assert.equal(OFFLINE_VERIFICATION_PENDING_COPY, "Sin conexión. La información pública está disponible. La autenticidad criptográfica se confirmará al recuperar conexión.");
  assert.deepEqual(resolveAgroTrustCopy({ isQr: true }), {
    code: "GS1_IDENTITY_RESOLVED",
    authenticationLevel: "NOT_CRYPTOGRAPHICALLY_AUTHENTICATED",
    title: "Identidad encontrada",
    summary: "El QR identifica el producto, lote o serie, pero no autentica criptográficamente el objeto físico. Usá NFC para confirmar autenticidad.",
  });
  assert.deepEqual(resolveAgroSensitiveActionGate({ isOffline: true }), { allowed: false, reason: "VERIFICATION_PENDING" });
  assert.deepEqual(resolveAgroSensitiveActionGate({ statusCode: "REPLAY_SUSPECT", isFreshTap: true }), { allowed: false, reason: "REPLAY_SUSPECT" });
  assert.deepEqual(resolveAgroSensitiveActionGate({ productState: "SUN_PROFILE_MISMATCH", isFreshTap: true }), { allowed: false, reason: "SUN_PROFILE_MISMATCH" });
  assert.deepEqual(resolveAgroSensitiveActionGate({ statusCode: "VALID", verdict: "valid", isFreshTap: true }), { allowed: true, reason: "FRESH_AUTHENTICATED_TAP" });
  assert.deepEqual(resolveAgroSensitiveActionGate({ statusCode: "MANUAL_OPENED", productState: "VALID_MANUAL_OPENED", verdict: "valid_opened", isFreshTap: true, manualPolicyAuthorized: true }), { allowed: false, reason: "MANUAL_DECLARATION_REVIEW_REQUIRED" });
  assert.deepEqual(resolveAgroSensitiveActionGate({ statusCode: "INVALID", verdict: "valid", isFreshTap: true }), { allowed: false, reason: "UNTRUSTED_STATUS" });
  assert.deepEqual(resolveAgroSensitiveActionGate({ statusCode: "NEW_UNKNOWN_STATE", verdict: "valid", isFreshTap: true }), { allowed: false, reason: "UNTRUSTED_STATUS" });
  assert.deepEqual(resolveAgroSensitiveActionGate({ statusCode: "VALID_CLOSED", verdict: "unexpected", isFreshTap: true }), { allowed: false, reason: "UNTRUSTED_VERDICT" });
});

test("Agro profile rejects unsafe destinations and keeps only bounded public fields", () => {
  const profile = normalizeAgroDppProfile({
    schemaVersion: "future-untrusted",
    crop: "Soja",
    technicalSheetUrl: "javascript:alert(1)",
    safetySheetUrl: "https://docs.example.test/sds.pdf",
    ppe: { summary: "Guantes", items: ["Protección ocular"] },
    support: { email: "support@example.test", phone: "+54 11 4444 5555" },
  });
  assert.equal(profile?.schemaVersion, "agro-dpp-v1");
  assert.equal(profile?.technicalSheetUrl, null);
  assert.equal(profile?.safetySheetUrl, "https://docs.example.test/sds.pdf");
  assert.deepEqual(profile?.ppe.items, ["Protección ocular"]);
});

test("mobile Agro DPP implements the ten ordered surfaces and all structured events", async () => {
  const [component, eventWriter, page, bff, offline] = await Promise.all([
    read("../src/app/sun/agro-dpp-experience.tsx"),
    read("../src/app/sun/public-experience-events.ts"),
    read("../src/app/sun/page.tsx"),
    read("../src/app/api/public-cta/[action]/route.ts"),
    read("../src/app/offline/offline-queue-client.tsx"),
  ]);
  const ordered = [
    "Pasaporte digital agro",
    "Confianza",
    "Lote, registro y canal",
    "Información técnica",
    "Uso responsable y EPP",
    "Soporte y asesor",
    "Herramienta agronómica",
    "Capacitación y beneficios",
    "Procedencia y eventos",
    "Datos técnicos del pasaporte",
  ];
  let cursor = -1;
  for (const label of ordered) {
    const next = component.indexOf(label);
    assert.ok(next > cursor, `${label} must preserve the mobile information order`);
    cursor = next;
  }
  for (const eventType of [
    "PRODUCT_VIEWED", "TECHNICAL_SHEET_VIEWED", "SAFETY_SHEET_VIEWED", "PPE_CONTENT_VIEWED",
    "STEWARDSHIP_CONFIRMED", "CROPWISE_CTA_CLICKED", "ADVISOR_CONTACT_REQUESTED",
    "LOYALTY_OFFER_VIEWED", "TRAINING_STARTED",
  ]) assert.match(component, new RegExp(eventType));
  assert.match(component, /href="#report-problem"/);
  assert.doesNotMatch(component, /eventType: "PROBLEM_REPORTED"|Se registró el pedido de revisión/);
  assert.deepEqual(AGRO_EXPERIENCE_EVENT_TYPES, [
    "PRODUCT_VIEWED", "TECHNICAL_SHEET_VIEWED", "SAFETY_SHEET_VIEWED", "PPE_CONTENT_VIEWED",
    "STEWARDSHIP_CONFIRMED", "CROPWISE_CTA_CLICKED", "ADVISOR_CONTACT_REQUESTED", "LOYALTY_OFFER_VIEWED", "LOYALTY_JOINED",
    "TRAINING_STARTED", "TRAINING_COMPLETED", "LEAD_CREATED", "PROBLEM_REPORTED",
  ]);
  assert.doesNotMatch(component, /eventType: "(?:LOYALTY_JOINED|TRAINING_COMPLETED|LEAD_CREATED)"/);
  assert.match(component, /eventType: "LOYALTY_OFFER_VIEWED"/);
  assert.match(component, /Abrir el beneficio registra intención, no adhesión/);
  assert.match(component, /recordPublicExperienceEvent/);
  assert.match(component, /freshToken: props\.freshToken/);
  assert.match(page, /<AgroDppExperience[\s\S]*?freshToken=\{freshToken\}/);
  assert.match(eventWriter, /fetch\("\/api\/public-cta\/experience-event"/);
  assert.match(eventWriter, /idempotency-key/);
  assert.match(page, /<AgroDppExperience/);
  assert.match(bff, /"experience-event"/);
  assert.match(offline, /VERIFICATION_PENDING/);
  assert.match(offline, /Sin conexión\. La información pública está disponible\. La autenticidad criptográfica se confirmará al recuperar conexión\./);
});
