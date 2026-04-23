import { test } from 'node:test';
import assert from 'node:assert';

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function computeRiskScore(input) {
  return clamp(
    input.replayRate * 45 +
    input.invalidRate * 25 +
    input.tamperRate * 50 +
    input.revokedTapRate * 35 +
    input.geoAnomalyRate * 20
  );
}

test('computeRiskScore returns 0 when all inputs are 0', () => {
  const score = computeRiskScore({
    replayRate: 0,
    invalidRate: 0,
    tamperRate: 0,
    revokedTapRate: 0,
    geoAnomalyRate: 0,
  });
  assert.strictEqual(score, 0);
});

test('computeRiskScore clamps to 100 on extreme inputs', () => {
  const score = computeRiskScore({
    replayRate: 1, // 45
    invalidRate: 1, // 25
    tamperRate: 1, // 50
    revokedTapRate: 1, // 35
    geoAnomalyRate: 1, // 20
  }); // Total: 175 -> clamped to 100
  assert.strictEqual(score, 100);
});

test('computeRiskScore computes correct intermediate value', () => {
  const score = computeRiskScore({
    replayRate: 0.5, // 22.5
    invalidRate: 0,
    tamperRate: 0.2, // 10
    revokedTapRate: 0,
    geoAnomalyRate: 0,
  });
  assert.strictEqual(score, 32.5); // 22.5 + 10
});
