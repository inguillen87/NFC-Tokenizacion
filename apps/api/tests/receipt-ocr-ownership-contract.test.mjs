import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const claimRoute = await readFile(new URL("../src/app/public/cta/claim-ownership/route.ts", import.meta.url), "utf8");
const previewRoute = await readFile(new URL("../src/app/public/cta/receipt-ocr/route.ts", import.meta.url), "utf8");

test("durable ownership enforces confirmed OCR provenance before the write sink", () => {
  const decisionIndex = claimRoute.indexOf("evaluateReceiptOcrForOwnership(ocrResult)");
  const reviewWriteIndex = claimRoute.indexOf("INSERT INTO sdk_claim_requests", decisionIndex);
  const writeIndex = claimRoute.indexOf("claimOwnershipForConsumer({");
  assert.ok(decisionIndex > 0, "claim route must evaluate OCR provenance");
  assert.ok(reviewWriteIndex > decisionIndex, "OCR submissions must create a review request after evaluation");
  assert.ok(writeIndex > decisionIndex, "OCR decision must run before durable ownership write");
  assert.match(claimRoute, /request_status: "pending_manual_review"/);
  assert.match(claimRoute, /ownership_status: "not_claimed"/);
  assert.match(claimRoute, /ownership_created: false/);
  assert.match(claimRoute, /receipt_attachment_stored: false/);
  assert.match(claimRoute, /ocrResult\.provenance/);
  assert.doesNotMatch(claimRoute, /compliance_score\s*<\s*40/);
  assert.doesNotMatch(claimRoute, /allowDemoMock/);
});

test("purchase-proof policy requires a receipt before durable ownership", () => {
  assert.match(claimRoute, /claimPolicy === "purchase_proof_required" && !receiptFileData/);
  assert.match(claimRoute, /reason: "purchase_receipt_required"/);
});

test("OCR preview endpoint is review-only and returns 503 when provider is unavailable", () => {
  assert.match(previewRoute, /evaluateReceiptOcrForOwnership\(ocrResult\)/);
  assert.match(previewRoute, /providerUnavailable \? 503 : 200/);
  assert.match(previewRoute, /claim_eligible: false/);
  assert.match(previewRoute, /review_required: true/);
  assert.doesNotMatch(previewRoute, /claim_eligible: decision\.ok/);
});
