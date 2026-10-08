import test from "node:test";
import assert from "node:assert/strict";
import {resolveSunDemoScenario, sunDemoScenarioSignals} from "../src/app/sun/sun-demo-scenario.ts";

test("only explicit sample scenario enums replace the selected legacy default", () => {
  for (const value of ["closed", "opened", "invalid"]) assert.equal(resolveSunDemoScenario(value), value);
  for (const value of [undefined, null, "", "CLOSED", "closed ", "fake", ["closed"], {scenario: "closed"}]) {
    assert.equal(resolveSunDemoScenario(value), "opened");
    assert.equal(resolveSunDemoScenario(value, "closed"), "closed");
  }
  assert.equal(resolveSunDemoScenario("unknown", "untrusted"), "opened");
});

test("a rejected sample cannot masquerade as a closed or opened authenticated reading", () => {
  const result = sunDemoScenarioSignals("invalid");
  assert.equal(result.ok, false);
  assert.equal(result.code, "DEMO_READ_INVALID");
  assert.equal(result.productState, "INVALID");
  assert.equal(result.tamperStatus, "UNKNOWN");
  assert.equal(result.tagAvailable, false);
  assert.equal(result.tagStatus, "unknown");
  assert.match(result.label, /demo/);
  assert.doesNotMatch(result.label, /cerrado|abierto|original|falsificado/);
  assert(Object.isFrozen(result));
});

test("opened and closed samples remain distinct without asserting physical authenticity", () => {
  const closed = sunDemoScenarioSignals("closed"), opened = sunDemoScenarioSignals("opened");
  assert.equal(closed.productState, "VALID_CLOSED");
  assert.equal(opened.productState, "VALID_OPENED");
  assert.equal(closed.tamperStatus, "CLOSED");
  assert.equal(opened.tamperStatus, "OPENED");
  assert.match(closed.summary, /No corresponde a una lectura NFC ni valida el contenido físico/);
  assert.match(opened.summary, /Una apertura no demuestra falsificación/);
  for (const result of [closed, opened]) {
    assert.match(result.label, /demo/);
    assert(Object.isFrozen(result));
  }
});

test("sample signals supply no identity, signature, permission, sensor reading or commercial capability", () => {
  for (const scenario of ["closed", "opened", "invalid"]) {
    const result = sunDemoScenarioSignals(scenario);
    for (const forbidden of ["identity", "uid", "cmac", "freshToken", "tapContext", "tenant", "allowedActions", "claimOwnership", "purchase", "rewards", "iot", "sensorSnapshot"]) assert.equal(Object.hasOwn(result, forbidden), false, forbidden);
  }
  const invalid = sunDemoScenarioSignals("untrusted");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.productState, "INVALID");
});
