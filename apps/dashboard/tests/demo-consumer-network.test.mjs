import test from "node:test";
import assert from "node:assert/strict";
import { demoConsumerNetworkResource } from "../src/lib/demo-consumer-network.ts";
import {
  parseConsumerNetworkOverview, parseConsumerNetworkMembers,
  parseConsumerNetworkProducts, parseConsumerNetworkTaps, buildUtcHourlyHeatmap,
} from "../src/lib/consumer-network-overview-truth.ts";

const now = new Date("2026-09-04T20:00:00.000Z");
const read = (resource, tenant = "demobodega", method = "GET") =>
  demoConsumerNetworkResource(method, `consumer-network/${resource}`, tenant, now);

test("all four demo resources satisfy the actual CRM parsers", () => {
  for (const [resource, parse] of [
    ["overview", parseConsumerNetworkOverview], ["members", parseConsumerNetworkMembers],
    ["products", parseConsumerNetworkProducts], ["taps", parseConsumerNetworkTaps],
  ]) {
    const response = read(resource);
    assert.equal(response.status, 200);
    assert.equal(response.body.dataSource, "demo");
    const parsed = parse(response.body, "demobodega");
    assert.ok(parsed, resource);
    assert.equal(parsed.empty, false, resource);
    assert.equal(parsed.provenance.counts.operationalTap, 0);
    assert.equal(parsed.latestRecordedAt, null);
    assert.equal(parse(response.body, "another-tenant"), null);
  }
});

test("synthetic examples cannot populate operational activity, consent or heatmap", () => {
  const overview = parseConsumerNetworkOverview(read("overview").body, "demobodega").data.overview;
  assert.equal(overview.totalActivity, 0);
  assert.equal(overview.knownActors, 0);
  assert.deepEqual(overview.consentedActorsByChannel, { email: 0, whatsapp: 0, phone: 0 });
  const taps = parseConsumerNetworkTaps(read("taps").body, "demobodega").data;
  assert.equal(taps.length, 10);
  assert.ok(taps.every(tap => tap.dataProvenance === "declared_demo" && tap.verdict === null && tap.riskLevel === null));
  assert.equal(buildUtcHourlyHeatmap(taps).reduce((sum, cell) => sum + cell.count, 0), 0);
  const members = parseConsumerNetworkMembers(read("members").body, "demobodega").data;
  assert.equal(members.length, 3);
  assert.ok(members.every(member => member.label.startsWith("Perfil ficticio") && member.pointsBalance === null));
});

test("fixtures remain scoped, read-only and deterministic for the demo day", () => {
  for (const resource of ["overview", "members", "products", "taps"]) {
    assert.equal(read(resource, "balmec").status, 403);
    assert.equal(read(resource, "").status, 403);
    assert.equal(read(resource, "demobodega", "POST").status, 405);
    assert.equal(read(resource, "demobodega", "DELETE").status, 405);
  }
  assert.equal(demoConsumerNetworkResource("GET", "analytics", "demobodega", now), null);
  assert.equal(demoConsumerNetworkResource("GET", "consumer-network/taps/extra", "demobodega", now), null);
  const later = demoConsumerNetworkResource("GET", "consumer-network/taps", "demobodega", new Date("2026-09-04T23:00:00Z"));
  assert.deepEqual(read("taps").body.items, later.body.items);
});
