import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { demoIncidentResource } from "../src/lib/demo-incidents.ts";
import { getDashboardDemoStreamEvents, toDemoRealtimeEvent } from "../src/lib/demo-runtime-state.ts";
import { incidentByEvent } from "../src/lib/incident-workflow.ts";
import { canDemoSandboxAccess } from "../src/lib/admin-proxy-policy.ts";

const events = getDashboardDemoStreamEvents(160);
const read = (query = "", path = "incidents", tenant = "demobodega", method = "GET", rows = events) =>
  demoIncidentResource(method, path, tenant, new URLSearchParams(query), rows);

test("each visible demo event receives only its own incident or a confirmed empty list", () => {
  for (const event of events.map(toDemoRealtimeEvent)) {
    const response = read(new URLSearchParams({ tenant: event.tenantSlug, eventId: event.eventId, limit: "2" }));
    assert.equal(response.status, 200);
    const payload = response.body;
    assert.equal(payload.ok, true);
    assert.equal(payload.dataSource, "demo");
    assert.equal(payload.scope.tenant, event.tenantSlug);
    assert.ok(Array.isArray(payload.incidents));
    // The same scope/identity checks used by the actual drawer must accept every response.
    const matches = payload.incidents.filter((row) => row.eventId === event.eventId && row.tenantSlug === event.tenantSlug);
    assert.equal(matches.length, payload.incidents.length);
    assert.ok(matches.length <= 1);
    assert.equal(payload.count, event.eventId === "demo-baseline-replay-001" ? 1 : 0);
  }
});

test("demo overview, filtered lookup and detail share the same incident and coherent example history", () => {
  const initial = read().body;
  const byEvent = incidentByEvent(initial.incidents);
  const incident = byEvent["demo-baseline-replay-001"];
  assert.ok(incident);
  const lookup = read(`event_id=${incident.eventId}&status=investigating&limit=2`);
  assert.deepEqual(lookup.body.incidents, [incident]);
  const detail = read("tenant=demobodega", `incidents/${incident.id}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.incident, incident);
  assert.equal(detail.body.demoMode, true);
  assert.equal(detail.body.incident.evidence.source, "demo");
  assert.equal(detail.body.history.length, incident.version);
  assert.equal(detail.body.history[0].fromStatus, null);
  assert.equal(detail.body.history[0].toStatus, "open");
  assert.equal(detail.body.history.at(-1).toStatus, incident.status);
  assert.equal(detail.body.history.at(-1).createdAt, incident.updatedAt);
  assert.ok(detail.body.history.every((entry) => entry.actorLabel.includes("ficticio") && entry.actorEmail === ""));
  const replay = events.find((event) => event.id === incident.eventId);
  assert.equal(incident.evidence.occurredAt, replay.created_at);
  assert.equal(incident.evidence.bid, replay.bid);
  assert.equal(incident.evidence.city, replay.city);
  assert.deepEqual(read(`eventId=${incident.eventId}&status=resolved`).body.incidents, []);
  assert.deepEqual(read("eventId=demo-baseline-tamper-001").body.incidents, []);
});

test("missing and foreign demo cases cannot fall back to unrelated or productive records", () => {
  assert.equal(read("", "incidents/unknown").status, 404);
  assert.equal(read("", "incidents/demo-incident-replay-001/extra").status, 404);
  assert.equal(read("", "incidents/").status, 404);
  for (const tenant of ["demo-sandbox", "demoevents"]) {
    assert.deepEqual(read("", "incidents", tenant).body.incidents, []);
    assert.equal(read("", "incidents/demo-incident-replay-001", tenant).status, 404);
  }
  assert.equal(read("", "incidents", "production-tenant").status, 403);
  assert.equal(read("tenant=another-tenant").status, 403);
  assert.deepEqual(read("", "incidents", "demobodega", "GET", []).body.incidents, []);
  const unrelated = events.map((row) => ({ ...row, source: "operational" }));
  assert.deepEqual(read("", "incidents", "demobodega", "GET", unrelated).body.incidents, []);
  assert.equal(read("", "analytics"), null);
});

test("demo cases stay read-only, validate filters and never mutate the fixture", () => {
  const before = structuredClone(events);
  for (const path of ["incidents", "incidents/demo-incident-replay-001"]) {
    assert.equal(canDemoSandboxAccess("GET", path), true);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      assert.equal(canDemoSandboxAccess(method, path), false);
      assert.equal(read("", path, "demobodega", method).status, 405);
    }
  }
  assert.equal(read("limit=invalid").body.reason, "incident_limit_invalid");
  assert.equal(read("status=unknown").body.reason, "incident_status_invalid");
  assert.equal(read("eventId=not/a/demo-id").body.reason, "incident_event_id_invalid");
  assert.deepEqual(events, before);
});

test("the adapter is wired only inside demo response and has no network or persistence dependency", async () => {
  const [route, adapter] = await Promise.all([
    readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/demo-incidents.ts", import.meta.url), "utf8"),
  ]);
  const demoStart = route.indexOf("function demoAdminResponse(");
  const forwardStart = route.indexOf("async function forward(");
  const invocation = route.indexOf("const incidents = demoIncidentResource(");
  assert.ok(demoStart < invocation && invocation < forwardStart);
  assert.match(route.slice(invocation, invocation + 500), /private, no-store/);
  assert.match(route, /if \(demoSession && scopedRole === "readonly_demo"\)[\s\S]*?demoAdminResponse/);
  assert.doesNotMatch(adapter, /\bfetch\s*\(|process\.env|\b(?:INSERT|UPDATE|DELETE FROM)\b|setInterval\(/);
});
