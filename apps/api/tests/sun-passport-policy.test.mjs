import test from "node:test";
import assert from "node:assert/strict";

const { mapVerdictAndRisk, resolveActionMatrix } = await import("../src/lib/sun-passport-policy.ts");

test("view=json contract keys mapping remains stable for valid verdict", () => {
  const mapped = mapVerdictAndRisk({ statusCode: "VALID", productState: "VALID_CLOSED", reason: "sun_ok" });
  assert.equal(mapped.verdict, "valid");
  assert.equal(mapped.riskLevel, "none");
});

test("replay blocks ownership/reward/tokenization actions", () => {
  const mapped = mapVerdictAndRisk({ statusCode: "REPLAY_SUSPECT", productState: "REPLAY_SUSPECT", reason: "copied URL / replay suspected" });
  const matrix = resolveActionMatrix(mapped.verdict);
  assert.equal(matrix.allowedActions.includes("claim"), false);
  assert.equal(matrix.blockedActions.includes("claim"), true);
  assert.equal(matrix.blockedActions.includes("rewards"), true);
  assert.equal(matrix.blockedActions.includes("tokenization"), true);
});

test("replay reason wins even when auth status is otherwise valid", () => {
  const mapped = mapVerdictAndRisk({ statusCode: "VALID", productState: "VALID_CLOSED", reason: "copied URL / replay suspected" });
  const matrix = resolveActionMatrix(mapped.verdict);
  assert.equal(mapped.verdict, "replay_suspect");
  assert.equal(mapped.riskLevel, "high");
  assert.equal(matrix.blockedActions.includes("tokenization"), true);
});

test("verified opened seal remains actionable as lifecycle event", () => {
  const mapped = mapVerdictAndRisk({ statusCode: "OPENED", productState: "VALID_OPENED", reason: "sun_ok", encPlainStatusByte: "4F" });
  const matrix = resolveActionMatrix(mapped.verdict);
  assert.equal(mapped.verdict, "valid_opened");
  assert.equal(mapped.riskLevel, "low");
  assert.equal(matrix.allowedActions.includes("claim"), true);
  assert.equal(matrix.allowedActions.includes("warranty"), true);
  assert.equal(matrix.allowedActions.includes("tokenization"), true);
  assert.equal(matrix.blockedActions.length, 0);
});

test("tamper risk still blocks commercial ownership and tokenization", () => {
  const mapped = mapVerdictAndRisk({ statusCode: "TAMPER_RISK", productState: "TAMPER_RISK", reason: "invalid_tamper" });
  const matrix = resolveActionMatrix(mapped.verdict);
  assert.equal(mapped.verdict, "tampered");
  assert.equal(mapped.riskLevel, "high");
  assert.equal(matrix.blockedActions.includes("claim"), true);
  assert.equal(matrix.blockedActions.includes("tokenization"), true);
});

test("invalid payload does not require leaking raw sun internals in public contract surface", () => {
  const mapped = mapVerdictAndRisk({ statusCode: "INVALID", productState: "INVALID", reason: "invalid_cmac" });
  const publicSurface = {
    eventId: null,
    uidMasked: "04A1****D4",
    verdict: mapped.verdict,
    riskLevel: mapped.riskLevel,
    allowedActions: resolveActionMatrix(mapped.verdict).allowedActions,
    blockedActions: resolveActionMatrix(mapped.verdict).blockedActions,
  };
  const serialized = JSON.stringify(publicSurface);
  assert.equal(serialized.includes("picc_data"), false);
  assert.equal(serialized.includes("enc"), false);
  assert.equal(serialized.includes("cmac"), false);
});
