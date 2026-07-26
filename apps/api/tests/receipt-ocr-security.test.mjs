import test from "node:test";
import assert from "node:assert/strict";

const {
  evaluateReceiptOcrForOwnership,
  performReceiptOcr,
} = await import("../src/lib/ocr-service.ts");

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  HF_TOKEN: process.env.HF_TOKEN,
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
  OCR_ALLOW_DEMO_MOCK: process.env.OCR_ALLOW_DEMO_MOCK,
};
const ORIGINAL_FETCH = globalThis.fetch;

function restoreEnvironment() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = ORIGINAL_FETCH;
}

function configureNoProvider() {
  delete process.env.HF_TOKEN;
  delete process.env.HUGGINGFACE_API_KEY;
  delete process.env.VERCEL_ENV;
  delete process.env.OCR_ALLOW_DEMO_MOCK;
  process.env.NODE_ENV = "test";
}

function providerResponse(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("receipt OCR security boundary", async (t) => {
  await t.test("missing provider credentials fails closed", async () => {
    configureNoProvider();
    const result = await performReceiptOcr("data:image/png;base64,ZmFrZQ==", "Wine", "Brand", "receipt.png");
    assert.equal(result.provenance.mode, "unavailable");
    assert.equal(result.provenance.confirmed, false);
    assert.equal(result.is_invoice, false);
    assert.equal(result.product_matched, false);
    assert.equal(result.compliance_score, 0);
    assert.deepEqual(evaluateReceiptOcrForOwnership(result), {
      ok: false,
      reason: "receipt_verification_unavailable",
      status: 503,
      message: "No pudimos confirmar el comprobante con el proveedor. No se creó la propiedad. Reintentá o envialo a revisión manual.",
      reviewRequired: true,
    });
  });

  await t.test("provider failure fails closed instead of returning a high-confidence receipt", async () => {
    configureNoProvider();
    process.env.HF_TOKEN = "test-token";
    globalThis.fetch = async () => new Response("down", { status: 503 });
    const result = await performReceiptOcr("data:image/png;base64,ZmFrZQ==", "Wine", "Brand", "receipt.png");
    assert.equal(result.provenance.mode, "unavailable");
    assert.equal(result.reason, "hugging_face_http_503");
    assert.equal(evaluateReceiptOcrForOwnership(result).ok, false);
  });

  await t.test("incomplete provider JSON cannot default invoice, match or score to passing values", async () => {
    configureNoProvider();
    process.env.HF_TOKEN = "test-token";
    globalThis.fetch = async () => providerResponse({ establishment: "Shop", products: [] });
    const result = await performReceiptOcr("data:image/png;base64,ZmFrZQ==", "Wine", "Brand", "receipt.png");
    assert.equal(result.provenance.mode, "unavailable");
    assert.equal(result.reason, "hugging_face_invalid_schema");
    assert.equal(result.is_invoice, false);
    assert.equal(result.product_matched, false);
    assert.equal(result.compliance_score, 0);
  });

  await t.test("known E2E filename never bypasses the provider in production", async () => {
    configureNoProvider();
    process.env.NODE_ENV = "production";
    process.env.OCR_ALLOW_DEMO_MOCK = "true";
    const result = await performReceiptOcr("data:image/png;base64,ZmFrZQ==", "Wine", "Brand", "comprobante_vinoteca.png", { allowDemoMock: true });
    assert.equal(result.provenance.mode, "unavailable");
    assert.equal(evaluateReceiptOcrForOwnership(result).ok, false);
  });

  await t.test("explicit non-production demo mock is labeled and never claimable", async () => {
    configureNoProvider();
    process.env.OCR_ALLOW_DEMO_MOCK = "true";
    const result = await performReceiptOcr("data:image/png;base64,ZmFrZQ==", "Wine", "Brand", "comprobante_vinoteca.png", { allowDemoMock: true });
    assert.equal(result.provenance.mode, "demo_mock");
    assert.equal(result.provenance.confirmed, false);
    assert.equal(result.review_required, true);
    assert.equal(evaluateReceiptOcrForOwnership(result).reason, "receipt_demo_only_not_claimable");
  });

  await t.test("strict complete live provider response remains review-only for ownership", async () => {
    configureNoProvider();
    process.env.HF_TOKEN = "test-token";
    globalThis.fetch = async () => providerResponse({
      establishment: "Authorized shop",
      date: "2026-07-26",
      time: "18:30",
      price: 120,
      products: ["Wine"],
      is_invoice: true,
      product_matched: true,
      compliance_score: 92,
    });
    const result = await performReceiptOcr("data:image/png;base64,ZmFrZQ==", "Wine", "Brand", "receipt.png");
    assert.equal(result.provenance.mode, "live_confirmed");
    assert.equal(result.provenance.confirmed, true);
    assert.equal(result.provenance.provider, "huggingface-router");
    assert.ok(result.provenance.model);
    assert.deepEqual(evaluateReceiptOcrForOwnership(result), {
      ok: false,
      reason: "receipt_manual_review_required",
      status: 422,
      message: "El OCR extrajo datos para asistir la revisión, pero no valida el pago, el comercio ni la custodia. Ownership requiere POS firmado, PIN o aprobación manual del tenant.",
      reviewRequired: true,
    });
  });

  await t.test("live provider low score is routed to manual review", async () => {
    configureNoProvider();
    process.env.HF_TOKEN = "test-token";
    globalThis.fetch = async () => providerResponse({
      establishment: "Shop",
      date: null,
      time: null,
      price: null,
      products: ["Wine"],
      is_invoice: true,
      product_matched: true,
      compliance_score: 60,
    });
    const result = await performReceiptOcr("data:image/png;base64,ZmFrZQ==", "Wine", "Brand", "receipt.png");
    const decision = evaluateReceiptOcrForOwnership(result);
    assert.equal(decision.ok, false);
    assert.equal(decision.reason, "receipt_manual_review_required");
    assert.equal(decision.status, 422);
  });
});

test.after(restoreEnvironment);
