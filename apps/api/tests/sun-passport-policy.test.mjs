import test from "node:test";
import assert from "node:assert/strict";

const { mapVerdictAndRisk, resolveActionMatrix, resolveRightsPolicy } = await import("../src/lib/sun-passport-policy.ts");

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

test("operator-declared opening never becomes verified TT evidence or commercial rights", () => {
  const mapped = mapVerdictAndRisk({
    statusCode: "MANUAL_OPENED",
    productState: "VALID_MANUAL_OPENED",
    reason: "manual_opened_by_operator",
  });
  assert.equal(mapped.verdict, "manual_opened_declared");
  assert.equal(mapped.riskLevel, "medium");

  const policy = resolveRightsPolicy({
    verdict: mapped.verdict,
    vertical: "wine",
    tokenizationMode: "valid_and_opened",
    statusCode: "MANUAL_OPENED",
    productState: "VALID_MANUAL_OPENED",
    reason: "manual_opened_by_operator",
  });
  assert.equal(policy.conditionState, "manual_opened_declared");
  assert.deepEqual(policy.allowedActions, ["provenance"]);
  assert.equal(policy.blockedActions.includes("claim"), true);
  assert.equal(policy.blockedActions.includes("warranty"), true);
  assert.equal(policy.blockedActions.includes("rewards"), true);
  assert.equal(policy.blockedActions.includes("tokenization"), true);
  assert.equal(policy.canClaimPublicly, false);
  assert.equal(policy.canTokenize, false);
  assert.equal(policy.requiresReview, true);
  assert.equal(policy.tokenizationPolicy, "blocked_manual_declaration");
  assert.match(policy.statusTitle, /Apertura declarada/i);
  assert.match(policy.statusSummary, /no equivale a una apertura detectada por la etiqueta/i);
  assert.doesNotMatch(policy.statusTitle, /SUN válido/i);

  const contradictory = resolveRightsPolicy({
    verdict: "valid_opened",
    vertical: "wine",
    statusCode: "MANUAL_OPENED",
    productState: "VALID_MANUAL_OPENED",
  });
  assert.equal(contradictory.conditionState, "manual_opened_declared");
  assert.deepEqual(contradictory.allowedActions, ["provenance"]);
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

test("wine opened records the seal state while commercial rights require proof", () => {
  const policy = resolveRightsPolicy({
    verdict: "valid_opened",
    vertical: "wine",
    tokenizationMode: "valid_and_opened",
    claimPolicy: "purchase_proof_required",
    statusCode: "OPENED",
    encPlainStatusByte: "4F",
  });
  assert.equal(policy.conditionState, "opened_verified");
  assert.equal(policy.canTokenize, true);
  assert.equal(policy.claimMode, "purchase_or_custody_proof");
  assert.match(policy.statusSummary, /sello/i);
  assert.match(policy.statusSummary, /apertura|abierto/i);
});

test("pharma opened keeps provenance but blocks public tokenization", () => {
  const policy = resolveRightsPolicy({
    verdict: "valid_opened",
    vertical: "pharma",
    statusCode: "OPENED",
    encPlainStatusByte: "4F",
  });
  assert.equal(policy.allowedActions.includes("provenance"), true);
  assert.equal(policy.allowedActions.includes("tokenization"), false);
  assert.equal(policy.tokenizationPolicy, "blocked_opened_policy");
});

test("luxury opened supports issuer-governed ownership", () => {
  const policy = resolveRightsPolicy({
    verdict: "valid_opened",
    vertical: "luxury",
    statusCode: "OPENED",
    encPlainStatusByte: "4F",
  });
  assert.equal(policy.claimMode, "issuer_transfer_required");
  assert.equal(policy.allowedActions.includes("claim"), true);
  assert.equal(policy.tokenizationPolicy, "verified_opened_tap");
});

test("events activation avoids tokenization by default", () => {
  const policy = resolveRightsPolicy({
    verdict: "valid",
    vertical: "events",
    statusCode: "VALID",
    encPlainStatusByte: "43",
  });
  assert.equal(policy.marketplaceMode, "ticket_activation");
  assert.equal(policy.allowedActions.includes("tokenization"), false);
  assert.equal(policy.tokenizationPolicy, "blocked_policy");
});

test("agro uses lot anchor tokenization policy", () => {
  const policy = resolveRightsPolicy({
    verdict: "valid",
    vertical: "agro",
    statusCode: "VALID",
    encPlainStatusByte: "43",
  });
  assert.equal(policy.canTokenize, true);
  assert.equal(policy.tokenizationPolicy, "lot_anchor");
  assert.equal(policy.marketplaceMode, "lot_traceability");
});

test("documents require issuer transfer", () => {
  const policy = resolveRightsPolicy({
    verdict: "valid",
    vertical: "documents",
    statusCode: "VALID",
    encPlainStatusByte: "43",
  });
  assert.equal(policy.claimMode, "issuer_transfer_required");
  assert.equal(policy.tokenizationPolicy, "issuer_transfer");
  assert.equal(policy.marketplaceMode, "issuer_private");
});

test("SUN passport copy limits evidence to the chip message, digital identity and recorded state", () => {
  const verticals = ["wine", "spirits", "cosmetics", "pharma", "luxury", "art", "events", "agro", "documents", "generic"];
  const forbiddenClaims = [
    /\bproducto original\b/i,
    /\bbotella original\b/i,
    /\bproducto aut[eé]ntico\b/i,
    /\bart[ií]culo(?: de lujo)? original\b/i,
    /\bmedicamento verificado\b/i,
    /\bautenticidad (?:confirmada|vigente)\b/i,
    /\bautenticidad de la obra (?:est[aá] )?confirmada\b/i,
    /\btrazabilidad completa(?: confirmada)?\b/i,
    /\blote aut[eé]ntico\b/i,
    /\bpropiedad oficial\b/i,
  ];

  for (const vertical of verticals) {
    for (const verdict of ["valid", "valid_opened"]) {
      const policy = resolveRightsPolicy({
        verdict,
        vertical,
        statusCode: verdict === "valid" ? "VALID" : "OPENED",
        productState: verdict === "valid" ? "VALID_CLOSED" : "VALID_OPENED",
      });
      const copy = `${policy.statusTitle} ${policy.statusSummary}`;
      assert.match(copy, /SUN/i, `${vertical}/${verdict} must name the evidence source`);
      assert.doesNotMatch(copy, /Ã|Â|�/, `${vertical}/${verdict} must remain valid UTF-8 copy`);
      for (const claim of forbiddenClaims) {
        assert.doesNotMatch(copy, claim, `${vertical}/${verdict} must not imply ${claim}`);
      }
    }
  }
});

test("unknown seal state does not become a physical authenticity claim", () => {
  const policy = resolveRightsPolicy({
    verdict: "valid",
    vertical: "generic",
    statusCode: "VALID",
    productState: "VALID_UNKNOWN_TAMPER",
  });
  assert.equal(policy.conditionState, "unknown");
  assert.equal(policy.statusTitle, "Evidencia digital disponible");
  assert.match(policy.statusSummary, /no informa el estado de apertura/i);
  assert.match(policy.statusSummary, /no certifica por sí solo/i);
  assert.doesNotMatch(`${policy.statusTitle} ${policy.statusSummary}`, /autenticidad confirmada|producto aut[eé]ntico/i);
});
