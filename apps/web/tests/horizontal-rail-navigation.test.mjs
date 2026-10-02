import assert from "node:assert/strict";
import test from "node:test";
import { horizontalRailTargetLeft, reconcileHorizontalRailNavigation } from "../src/lib/horizontal-rail-model.mjs";

const geometry = {
  itemLeft: 308.59375,
  railLeft: 29,
  scrollLeft: 0,
  clientLeft: 0,
  scrollPaddingStart: 17.6,
  maximumLeft: 524,
};
const intent = (values = {}) => ({ generation: 4, index: 0, left: 0, reframed: false, ...values });

test("a padded rail targets the visible snap start rather than the outer rail edge", () => {
  assert.equal(horizontalRailTargetLeft(geometry), 261.99375);
  assert.equal(horizontalRailTargetLeft({ ...geometry, itemLeft: 46.59375 }), 0);
  assert.equal(horizontalRailTargetLeft({ ...geometry, itemLeft: 278.59375, scrollLeft: 30 }), 261.99375);
  assert.equal(horizontalRailTargetLeft({ ...geometry, clientLeft: 2 }), 259.99375);
});

test("the final destination remains reachable at both edges and on a rail without overflow", () => {
  assert.equal(horizontalRailTargetLeft({ ...geometry, itemLeft: -500 }), 0);
  assert.equal(horizontalRailTargetLeft({ ...geometry, itemLeft: 900 }), 524);
  assert.equal(horizontalRailTargetLeft({ ...geometry, maximumLeft: 0 }), 0);
  assert.equal(horizontalRailTargetLeft({ ...geometry, maximumLeft: -10 }), 0);
  assert.equal(horizontalRailTargetLeft({ ...geometry, itemLeft: Number.NaN }), 0);
});

test("the last requested card can settle at a clamped tablet edge rather than its unclamped left", () => {
  const left = horizontalRailTargetLeft({ ...geometry, itemLeft: 680, maximumLeft: 250 });
  assert.equal(left, 250);
  const command = intent({ index: 2, left });
  assert.equal(reconcileHorizontalRailNavigation(command, 250, 4).action, "settled");
  assert.equal(command.index, 2, "the destination remains the last requested card");
});

test("a previous command survives the observed return from discover to signal", () => {
  const command = intent();
  const result = reconcileHorizontalRailNavigation(command, 262, command.generation);
  assert.equal(result.action, "reframe");
  assert.deepEqual(result.navigation, { ...command, reframed: true });
  assert.equal(result.navigation.index, 0);
  assert.equal(result.navigation.left, 0);
  assert.deepEqual(command, intent(), "the original intent is not mutated");
});

test("a command replays at most once and remains the owner even at its destination", () => {
  const first = reconcileHorizontalRailNavigation(intent(), 262, 4);
  const stillWrong = reconcileHorizontalRailNavigation(first.navigation, 262, 4);
  assert.equal(stillWrong.action, "wait");
  assert.equal(stillWrong.navigation, first.navigation);
  assert.deepEqual(reconcileHorizontalRailNavigation(stillWrong.navigation, 0, 4), { action: "settled", navigation: stillWrong.navigation });
});

test("the observed early scrollend0 then late268 then scrollend262 cannot discard the requested first step", () => {
  const command = Object.freeze(intent());
  const earlyEnd = reconcileHorizontalRailNavigation(command, 0, 4);
  assert.equal(earlyEnd.action, "settled");
  assert.equal(earlyEnd.navigation, command);
  assert.equal(earlyEnd.navigation.index, 0);
  const lateEnd = reconcileHorizontalRailNavigation(earlyEnd.navigation, 262, 4);
  assert.equal(lateEnd.action, "reframe");
  assert.equal(lateEnd.navigation.left, 0);
  assert.equal(lateEnd.navigation.index, 0);
  assert.equal(lateEnd.navigation.reframed, true);
  const restoredEnd = reconcileHorizontalRailNavigation(lateEnd.navigation, 0, 4);
  assert.equal(restoredEnd.action, "settled");
  assert.equal(restoredEnd.navigation, lateEnd.navigation);
  assert.equal(reconcileHorizontalRailNavigation(restoredEnd.navigation, 268, 4).action, "wait");
});

test("replacing a settled owner with a newer request also replaces its replay budget", () => {
  const old = reconcileHorizontalRailNavigation(intent(), 0, 4).navigation;
  const latest = intent({ generation: old.generation + 1, index: 2, left: 524 });
  assert.equal(reconcileHorizontalRailNavigation(latest, 262, old.generation).action, "ignore");
  const result = reconcileHorizontalRailNavigation(latest, 262, latest.generation);
  assert.equal(result.action, "reframe");
  assert.equal(result.navigation.left, 524);
  assert.equal(result.navigation.index, 2);
});

test("an older callback cannot complete or replay the newer command", () => {
  const latest = intent({ generation: 5, index: 2, left: 524 });
  for (const position of [0, 262, 524]) {
    assert.deepEqual(reconcileHorizontalRailNavigation(latest, position, 4), { action: "ignore", navigation: latest });
  }
  assert.equal(reconcileHorizontalRailNavigation(latest, 524, 5).action, "settled");
});

test("canceling an intent for a new user gesture leaves native scrolling free to select its card", () => {
  assert.deepEqual(reconcileHorizontalRailNavigation(null, 262, 4), { action: "ignore", navigation: null });
  assert.deepEqual(reconcileHorizontalRailNavigation(null, 524, undefined), { action: "ignore", navigation: null });
});

test("fractional native rounding can complete a destination but a different card cannot", () => {
  const command = intent({ index: 1, left: horizontalRailTargetLeft(geometry) });
  assert.equal(reconcileHorizontalRailNavigation(command, 262, 4).action, "settled");
  assert.equal(reconcileHorizontalRailNavigation(command, 264, 4).action, "reframe");
  assert.equal(reconcileHorizontalRailNavigation(command, 524, 4).action, "reframe");
});

test("missing scroll observations never certify completion or consume the one replay", () => {
  const command = Object.freeze(intent());
  for (const position of [Number.NaN, Infinity, undefined]) {
    assert.deepEqual(reconcileHorizontalRailNavigation(command, position, 4), { action: "ignore", navigation: command });
  }
});
