import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  boundedIncidentText,
  incidentWorkflowError,
  isIncidentSeverity,
  isIncidentStatus,
  listEventIncidents,
  maskIncidentUid,
  validIncidentEventId,
  validIncidentId,
  validIncidentIdempotencyKey,
  validIncidentTenantSlug,
} from "../src/lib/incident-workflow.ts";

const read = (url) => readFile(new URL(url, import.meta.url), "utf8");

test("incident input contract rejects ambiguous and oversized values", () => {
  assert.equal(validIncidentEventId("42"), true);
  assert.equal(validIncidentEventId("0"), false);
  assert.equal(validIncidentEventId("42 OR 1=1"), false);
  assert.equal(validIncidentEventId("9223372036854775808"), false);
  assert.equal(validIncidentTenantSlug("tenant-a"), true);
  assert.equal(validIncidentTenantSlug("tenant/a"), false);
  assert.equal(validIncidentId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), true);
  assert.equal(validIncidentId("../../other-tenant"), false);
  assert.equal(validIncidentIdempotencyKey("transition:12345678"), true);
  assert.equal(validIncidentIdempotencyKey("short"), false);
  assert.equal(isIncidentStatus("investigating"), true);
  assert.equal(isIncidentStatus("deleted"), false);
  assert.equal(isIncidentSeverity("critical"), true);
  assert.equal(isIncidentSeverity("emergency"), false);
  assert.equal(boundedIncidentText(" auditable reason ", 3, 20), "auditable reason");
  assert.equal(boundedIncidentText("x".repeat(21), 3, 20), null);
  assert.equal(maskIncidentUid("04-87-856A-0B10-90"), "0487****1090");
});

test("incident list mapping preserves durable links while masking UID evidence", async () => {
  let queryText = "";
  const rows = await listEventIncidents({ tenantSlug: "tenant-a", eventId: "42", status: "open", limit: 500 }, async (strings, ...values) => {
    queryText = strings.join("?");
    assert.deepEqual(values, ["tenant-a", "tenant-a", "42", "42", "open", "open", 100]);
    return [{
      incident_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenant_slug: "Tenant-A",
      event_id: "42",
      ticket_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ticket_status: "open",
      status: "open",
      severity: "high",
      title: "Replay investigation",
      summary: "Counter reused",
      opened_at: "2026-07-28T17:30:00.000Z",
      created_at: "2026-07-28T17:30:00.000Z",
      updated_at: "2026-07-28T17:30:00.000Z",
      version: 1,
      event_result: "BLOCKED_REPLAY",
      event_verdict: "blocked_replay",
      event_reason: "counter_not_monotonic",
      event_risk_level: "high",
      uid_hex: "0487856A0B1090",
      bid: "BATCH-01",
      event_created_at: "2026-07-28T17:29:00.000Z",
      city: "Rosario",
      country_code: "AR",
      event_source: "real",
    }];
  });

  assert.match(queryText, /JOIN tenants t ON t\.id = i\.tenant_id/);
  assert.match(queryText, /JOIN tickets tk ON tk\.id = i\.ticket_id/);
  assert.match(queryText, /t\.slug =/);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tenantSlug, "tenant-a");
  assert.equal(rows[0].evidence.uidMasked, "0487****1090");
  assert.equal(rows[0].evidence.source, "real");
  assert.equal(rows[0].ticketId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
});

test("workflow errors are sanitized into stable API outcomes", () => {
  assert.deepEqual(incidentWorkflowError(new Error("incident_tenant_scope_mismatch")), { status: 403, reason: "incident_tenant_scope_mismatch" });
  assert.deepEqual(incidentWorkflowError(new Error("incident_event_tenant_conflict")), { status: 409, reason: "incident_event_tenant_conflict" });
  assert.deepEqual(incidentWorkflowError(new Error("incident_event_identity_ambiguous")), { status: 409, reason: "incident_event_identity_ambiguous" });
  assert.deepEqual(incidentWorkflowError(new Error("incident_tenant_link_broken")), { status: 409, reason: "incident_tenant_link_broken" });
  assert.deepEqual(incidentWorkflowError(new Error("incident_idempotency_key_conflict")), { status: 409, reason: "incident_idempotency_key_conflict" });
  assert.deepEqual(incidentWorkflowError({ code: "42883" }), { status: 503, reason: "incident_schema_migration_required" });
  assert.deepEqual(incidentWorkflowError(new Error("password=secret internal stack")), { status: 503, reason: "incident_workflow_unavailable" });
});

test("0065 makes event ownership, ticket creation, state and history one atomic DB boundary", async () => {
  const migration = await read("../db/migrations/20260728173000_0065_event_incident_workflow.sql");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS event_incidents/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_events_id_created_at[\s\S]*ON events\(id, created_at\)/);
  assert.match(migration, /FOREIGN KEY \(event_id, event_created_at\)[\s\S]*REFERENCES events\(id, created_at\)/);
  assert.match(migration, /CONSTRAINT uq_event_incidents_event UNIQUE \(event_id\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS event_incident_history/);
  assert.match(migration, /trg_event_incident_history_append_only/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION nexid_open_event_incident/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION nexid_transition_event_incident/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('event_incident:' \|\| p_event_id::text/);
  assert.match(migration, /v_event_count <> 1[\s\S]*incident_event_identity_ambiguous/);
  assert.match(migration, /FOR SHARE OF e, b, t/);
  assert.match(migration, /v_event_tenant_id <> v_batch_tenant_id/);
  assert.match(migration, /incident_event_tenant_conflict/);
  assert.match(migration, /INSERT INTO tickets[\s\S]*tenant_id, tap_event_id/);
  assert.match(migration, /INSERT INTO event_incident_history/);
  assert.match(migration, /request_fingerprint text NOT NULL/);
  assert.match(migration, /'open:event:' \|\| p_event_id::text/);
  assert.match(migration, /incident_idempotency_key_conflict/);
  assert.match(migration, /WHERE id = v_incident\.ticket_id[\s\S]*AND tenant_id = v_incident\.tenant_id[\s\S]*AND tap_event_id = v_incident\.event_id/);
  assert.match(migration, /actor_id uuid NOT NULL REFERENCES users/);
  assert.match(migration, /REVOKE ALL ON FUNCTION nexid_open_event_incident[\s\S]*FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION nexid_transition_event_incident[\s\S]*FROM PUBLIC/);
  assert.doesNotMatch(migration, /DELETE FROM event_incident_history|UPDATE event_incident_history/);
});

test("incident routes enforce AdminPrincipal permissions and publish only after durable workflow returns", async () => {
  const [collection, detail, stream] = await Promise.all([
    read("../src/app/admin/incidents/route.ts"),
    read("../src/app/admin/incidents/[incidentId]/route.ts"),
    read("../src/app/admin/events/stream/route.ts"),
  ]);

  assert.match(collection, /await checkAdmin\(req\)/);
  assert.match(collection, /checkAdminPermission\(req, "incidents:read"\)/);
  assert.match(collection, /checkAdminPermission\(req, "incidents:write"\)/);
  assert.match(collection, /getAdminPrincipal\(req\)/);
  assert.match(collection, /incident_tenant_scope_required/);
  const collectionPost = collection.slice(collection.indexOf("export async function POST"));
  assert.ok(collectionPost.indexOf("await openEventIncident(") < collectionPost.indexOf("publishIncident(incident"));
  assert.match(detail, /checkAdminPermission\(req, "incidents:write"\)/);
  assert.match(detail, /idempotency-key/);
  assert.ok(detail.indexOf("await transitionEventIncident(") < detail.indexOf("publishRealtimeEvent({"));
  assert.match(stream, /checkAdminPermission\(req, "incidents:read"\)/);
  assert.match(stream, /allowRealtimeEventForScope/);
  assert.match(stream, /isIncidentPayload/);
});

test("unauthenticated admin ticket creation is closed while the guarded public lead path remains", async () => {
  const [adminTickets, publicLeads] = await Promise.all([
    read("../src/app/admin/tickets/route.ts"),
    read("../src/app/public/leads/route.ts"),
  ]);
  const post = adminTickets.slice(adminTickets.indexOf("export async function POST"));
  assert.ok(post.indexOf("await checkAdmin(req, [\"super_admin\"])") < post.indexOf("await req.json()"));
  assert.match(publicLeads, /enforceCriticalRateLimit/);
  assert.match(publicLeads, /hitSunRateLimit/);
  assert.match(publicLeads, /export async function POST/);
  assert.doesNotMatch(publicLeads, /\/admin\/tickets/);
});
