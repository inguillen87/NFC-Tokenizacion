import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  evaluateTapCommercialRights,
  isManualOpeningDeclared,
  readCurrentTapCommercialRights,
} = await import("../src/lib/tap-commercial-rights.ts");
const { evaluateLoyaltyForTap } = await import("../src/lib/loyalty-service.ts");
const { evaluateOwnershipEligibility } = await import("../src/lib/ownership-policy.ts");
const { installEphemeralE2eSqlExecutor } = await import("../src/lib/db.ts");

const apiRoot = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, apiRoot), "utf8");

test("VALID_CLOSED plus a later manual_tamper_opened declaration awards no loyalty points", async () => {
  const event = {
    id: "650",
    result: "VALID_CLOSED",
    reason: "manual_tamper_opened:operator_override",
  };

  assert.equal(isManualOpeningDeclared(event), true);
  assert.deepEqual(evaluateTapCommercialRights(event), {
    allowed: false,
    reason: "manual_opening_declared",
    manualOpeningDeclared: true,
  });
  assert.deepEqual(
    await evaluateLoyaltyForTap({ eventId: event.id, memberId: "member-1", program: {}, event }),
    { award: false, reason: "blocked_validation" },
  );
});

test("manual override blocks ownership without changing the canonical chip result", () => {
  const event = {
    result: "VALID_CLOSED",
    reason: "tagtamper_closed:4343",
    manual_tamper_status: "MANUAL_OPENED",
    manual_tamper_reason: "physical seal broken during demo",
  };
  const decision = evaluateTapCommercialRights(event);
  const ownership = evaluateOwnershipEligibility({ ...event, tagStatus: "active" });

  assert.equal(event.result, "VALID_CLOSED");
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "manual_opening_declared");
  assert.equal(ownership.isBlocked, true);
  assert.equal(ownership.nextStatus, "revoked");
});

test("legacy manual-open result aliases stay blocked while verified hardware opening remains distinct", () => {
  assert.equal(evaluateTapCommercialRights({ result: "MANUAL_OPENED" }).allowed, false);
  assert.equal(evaluateTapCommercialRights({ result: "VALID_MANUAL_OPENED" }).allowed, false);
  assert.equal(evaluateTapCommercialRights({ result: "VALID_OPENED", reason: "tagtamper_opened:4F4F" }).allowed, true);
});

test("durable rights lookup combines event truth with the current override and fails closed on read errors", async () => {
  let mode = "manual";
  const removeExecutor = installEphemeralE2eSqlExecutor(async (strings) => {
    const statement = strings.join("?");
    assert.match(statement, /LEFT JOIN tag_manual_tamper_overrides/);
    if (mode === "error") throw new Error("database unavailable");
    return [{
      result: "VALID_CLOSED",
      reason: "tagtamper_closed:4343",
      manual_tamper_status: "MANUAL_OPENED",
      manual_tamper_reason: "operator declaration",
    }];
  }, {
    NODE_ENV: "test",
    VERCEL_ENV: "test",
    NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
    NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:test-only@localhost/nexid_e2e_manual_rights",
  });

  try {
    assert.deepEqual(await readCurrentTapCommercialRights("650"), {
      allowed: false,
      reason: "manual_opening_declared",
      manualOpeningDeclared: true,
    });
    mode = "error";
    assert.deepEqual(await readCurrentTapCommercialRights("650"), {
      allowed: false,
      reason: "rights_evidence_unavailable",
      manualOpeningDeclared: false,
    });
  } finally {
    removeExecutor();
  }
});

test("protected sinks re-check durable manual state after the fresh capability and at mutations", async () => {
  const [loyalty, ownership, trivia, warranty, tokenizationRoute, tokenizationEngine] = await Promise.all([
    source("src/lib/loyalty-service.ts"),
    source("src/lib/consumer-portal-service.ts"),
    source("src/lib/trivia-service.ts"),
    source("src/app/public/cta/register-warranty/route.ts"),
    source("src/app/public/cta/tokenize-request/route.ts"),
    source("src/lib/tokenization-engine.ts"),
  ]);

  assert.match(loyalty, /WITH tap_rights AS MATERIALIZED/);
  assert.match(loyalty, /LEFT JOIN tag_manual_tamper_overrides manual_override/);
  assert.match(loyalty, /UPPER\(COALESCE\(manual_override\.tamper_status, ''\)\) NOT IN \('MANUAL_OPENED', 'OPENED'\)/);
  assert.match(ownership, /readCurrentTapCommercialRights\(String\(event\.id\)\)/);
  assert.match(ownership, /const durableBlocked = isBlocked \|\| !currentRights\.allowed/);
  assert.match(ownership, /THEN 'revoked'[\s\S]*ELSE \$\{durableNextStatus\}/);
  assert.match(trivia, /WITH tap_rights AS MATERIALIZED/);
  assert.match(trivia, /readCurrentTapCommercialRights\(event\.id\)/);

  const warrantyFresh = warranty.indexOf("consumeSunFreshHandoff(req, body");
  assert.ok(warranty.indexOf("readCurrentTapCommercialRights(eventId)", warrantyFresh) > warrantyFresh);
  const tokenFresh = tokenizationRoute.indexOf("consumeSunFreshHandoff(");
  assert.ok(tokenizationRoute.indexOf("readCurrentTapCommercialRights(eventId)", tokenFresh) > tokenFresh);
  assert.match(tokenizationEngine, /readCurrentTapCommercialRights\(String\(existing\.source_event_id\)\)/);
  assert.match(tokenizationEngine, /status = 'blocked'[\s\S]*blocked_by: "source_event_commercial_rights"/);
});

test("manual tamper truth is migration-owned and request paths do not hide lookup failures", async () => {
  const [sunService, markOpenedRoute] = await Promise.all([
    source("src/lib/sun-service.ts"),
    source("src/app/admin/tags/mark-opened/route.ts"),
  ]);

  assert.doesNotMatch(sunService, /CREATE TABLE IF NOT EXISTS tag_manual_tamper_overrides/);
  assert.doesNotMatch(markOpenedRoute, /CREATE TABLE IF NOT EXISTS tag_manual_tamper_overrides/);
  const lookup = sunService.match(
    /async function getManualTamperOverride[\s\S]*?\r?\n  }\r?\n  async function logUnassignedAttempt/,
  )?.[0] || "";
  assert.match(lookup, /SELECT tamper_status, reason, evidence_note, source/);
  assert.doesNotMatch(lookup, /catch\s*\{/);
});
