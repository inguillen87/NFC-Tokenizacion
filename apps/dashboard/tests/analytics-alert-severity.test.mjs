import test from "node:test";
import assert from "node:assert/strict";

const { classifyEventAlertSeverity, matchesSeverityFilter } = await import("../src/lib/alert-severity.ts");

test("classifyEventAlertSeverity maps event outcomes to alert severities", () => {
  assert.equal(classifyEventAlertSeverity("REPLAY_SUSPECT"), "high");
  assert.equal(classifyEventAlertSeverity("DUPLICATE"), "high");
  assert.equal(classifyEventAlertSeverity("TAMPER"), "critical");
  assert.equal(classifyEventAlertSeverity("INVALID"), "medium");
  assert.equal(classifyEventAlertSeverity("VALID"), "none");
});

test("matchesSeverityFilter keeps all vs exact filter behavior", () => {
  assert.equal(matchesSeverityFilter("critical", "all"), true);
  assert.equal(matchesSeverityFilter("critical", "critical"), true);
  assert.equal(matchesSeverityFilter("high", "critical"), false);
});
