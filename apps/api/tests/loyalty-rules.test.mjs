import { test } from 'node:test';
import assert from 'node:assert';

test('Loyalty rules block idempotencyKey duplicates', async () => {
  const events = [];
  const awardPoints = async (input) => {
    if (events.includes(input.idempotencyKey)) {
      return { awarded: false, duplicate: true };
    }
    events.push(input.idempotencyKey);
    return { awarded: true, duplicate: false, entry: { delta: input.delta } };
  };

  const firstCall = await awardPoints({ delta: 10, idempotencyKey: 'tap_123' });
  const secondCall = await awardPoints({ delta: 10, idempotencyKey: 'tap_123' });

  assert.strictEqual(firstCall.awarded, true);
  assert.strictEqual(secondCall.awarded, false);
  assert.strictEqual(secondCall.duplicate, true);
});

test('Reward redemption fails if points insufficient', () => {
  const memberPoints = 50;
  const rewardCost = 100;

  const redeemReward = (balance, cost) => {
    if (balance < cost) return { ok: false, reason: "insufficient_points" };
    return { ok: true, balanceAfter: balance - cost };
  };

  const result = redeemReward(memberPoints, rewardCost);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "insufficient_points");
});

test('Reward redemption fails if stock is depleted', () => {
  const reward = { cost: 50, stock: 0 };
  const memberPoints = 100;

  const redeemReward = (balance, r) => {
    if (balance < r.cost) return { ok: false, reason: "insufficient_points" };
    if (r.stock <= 0) return { ok: false, reason: "out_of_stock" };
    return { ok: true, balanceAfter: balance - r.cost };
  };

  const result = redeemReward(memberPoints, reward);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "out_of_stock");
});

test('Age gate blocks alcohol rewards', () => {
  const ageGatePassed = false;
  const rewardIsAlcohol = true;

  const checkEligibility = (ageOk, isAlcohol) => {
    if (isAlcohol && !ageOk) return { ok: false, reason: "age_verification_required" };
    return { ok: true };
  }

  const result = checkEligibility(ageGatePassed, rewardIsAlcohol);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, "age_verification_required");
});
