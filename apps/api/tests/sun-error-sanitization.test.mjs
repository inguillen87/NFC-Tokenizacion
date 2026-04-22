import test from "node:test";
import assert from "node:assert/strict";

function sanitizePublicErrorReason(raw) {
  const normalized = String(raw || "").toLowerCase();
  if (!normalized) return "sun_processing_error";
  if (normalized.includes("database_url") || normalized.includes("connect") || normalized.includes("neon")) {
    return "sun_processing_temporarily_unavailable";
  }
  if (normalized.includes("polygon") || normalized.includes("rpc") || normalized.includes("tokenization")) {
    return "tokenization_temporarily_unavailable";
  }
  return "sun_processing_error";
}

test("sanitizePublicErrorReason hides database/env internals", () => {
  assert.equal(
    sanitizePublicErrorReason("DATABASE_URL is not set"),
    "sun_processing_temporarily_unavailable",
  );
});

test("sanitizePublicErrorReason hides polygon/rpc internals", () => {
  assert.equal(
    sanitizePublicErrorReason("POLYGON_RPC_URL missing"),
    "tokenization_temporarily_unavailable",
  );
});

test("sanitizePublicErrorReason keeps generic fallback for unknown errors", () => {
  assert.equal(
    sanitizePublicErrorReason("unexpected failure"),
    "sun_processing_error",
  );
});
