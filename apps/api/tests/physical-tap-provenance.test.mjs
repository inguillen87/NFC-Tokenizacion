import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyConsumerNetworkEvent,
  consumerNetworkEventProvenanceSql,
  withConsumerNetworkEventProvenance,
} from "../src/lib/consumer-network-provenance.ts";

const operational = { source: "real", eventType: "TAP_VALID", meta: { replay_execution_class: "operational" }, hasExactTenantAssetBinding: true };

test("every explicit simulation marker wins over otherwise operational evidence", () => {
  for (const extra of [
    { event_mode: "demo" }, { event_mode: "simulated" }, { simulated: true },
    { simulated: "true" }, { demoEmitter: true }, { seed: true, corpus: "demo-seed" },
    { replay_execution_class: "demo" },
    { simulated: " true " }, { simulated: "\ttrue\n" }, { demoEmitter: "\u00a0TRUE\ufeff" },
    { event_mode: " simulated " }, { replay_execution_class: " demo " },
    { seed: " true ", corpus: " demo-seed " },
  ]) assert.equal(classifyConsumerNetworkEvent({ ...operational, meta: { ...operational.meta, ...extra } }), "declared_demo");
});

test("valid, invalid and replay classifications use identical durable-origin requirements", () => {
  for (const eventType of ["TAP_VALID", "TAP_INVALID", "REPLAY_SUSPECT"]) {
    assert.equal(classifyConsumerNetworkEvent({ ...operational, eventType }), "operational_tap");
    assert.equal(classifyConsumerNetworkEvent({ ...operational, eventType, meta: {} }), "legacy_unclassified");
    assert.equal(classifyConsumerNetworkEvent({ ...operational, eventType, source: "imported" }), "imported");
    assert.equal(classifyConsumerNetworkEvent({ ...operational, eventType, hasExactTenantAssetBinding: false }), "legacy_unclassified");
  }
});

test("SQL provenance expands only its fixed marker and never binds request text as SQL", async () => {
  let captured;
  const query = withConsumerNetworkEventProvenance(async (strings, ...values) => {
    captured = { statement: strings.join("?"), values };
    return [];
  }, { event: "e", batch: "b", tag: "event_tag" });
  const userInput = "/* consumer-network-event-provenance */' OR true --";
  await query`SELECT /* consumer-network-event-provenance */ AS provenance WHERE tenant = ${userInput}`;
  assert.match(captured.statement, /CASE[\s\S]*THEN 'operational_tap'/);
  assert.ok(!captured.statement.includes(userInput));
  assert.deepEqual(captured.values, [userInput]);
  assert.throws(() => query`SELECT 1`, /marker_required_once/);
  assert.throws(() => query`SELECT /* consumer-network-event-provenance */, /* consumer-network-event-provenance */`, /marker_required_once/);
});

test("SQL aliases reject expressions, missing names and request-controlled syntax", () => {
  for (const event of [undefined, "e; DROP TABLE events", "e.id", "e'", "", "1event"]) {
    assert.throws(() => consumerNetworkEventProvenanceSql({ event, batch: "b", tag: "tag" }), /alias_invalid/);
  }
});
