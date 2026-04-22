import test from "node:test";
import assert from "node:assert/strict";

function canAwardForTap({ result, alreadyAwarded, cooldownActive }) {
  const blocked = new Set(["REPLAY_SUSPECT", "INVALID", "NOT_ACTIVE", "NOT_REGISTERED", "TAMPER", "REVOKED", "BROKEN"]);
  if (blocked.has(String(result || "").toUpperCase())) return false;
  if (alreadyAwarded) return false;
  if (cooldownActive) return false;
  return true;
}

function redeemOutcome({ pointsBalance, pointsCost, stockRemaining }) {
  if (pointsBalance < pointsCost) return "insufficient_points";
  if (stockRemaining !== null && stockRemaining <= 0) return "out_of_stock";
  return "ok";
}

test("valid tap awards points once", () => {
  const first = canAwardForTap({ result: "VALID", alreadyAwarded: false, cooldownActive: false });
  const second = canAwardForTap({ result: "VALID", alreadyAwarded: true, cooldownActive: false });
  assert.equal(first, true);
  assert.equal(second, false);
});

test("replay tap awards zero points", () => {
  assert.equal(canAwardForTap({ result: "REPLAY_SUSPECT", alreadyAwarded: false, cooldownActive: false }), false);
});

test("reward redemption deduct path blocks stock below zero", () => {
  assert.equal(redeemOutcome({ pointsBalance: 100, pointsCost: 50, stockRemaining: 0 }), "out_of_stock");
  assert.equal(redeemOutcome({ pointsBalance: 100, pointsCost: 50, stockRemaining: 3 }), "ok");
});
