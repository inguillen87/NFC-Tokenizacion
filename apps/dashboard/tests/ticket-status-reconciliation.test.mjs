import assert from "node:assert/strict";
import test from "node:test";
import { reconcileAuthoritativeTicketStatus } from "../src/lib/ticket-status-reconciliation.ts";
import { prepareWorkflowCommand } from "../src/lib/ticket-workflow.ts";

const ID = "81000000-0000-8000-8000-000000000009", OTHER = "81000000-0000-8000-8000-000000000010";
const TENANT = "10000000-0000-4000-8000-000000000001", OTHER_TENANT = "10000000-0000-4000-8000-000000000002";
const context = { tenantScope: "qa-only", demoMode: false, canLookupTickets: true };
const row = (patch = {}) => ({ id: ID, tenant_id: TENANT, tenant_slug: "qa-only", status: "open", title: "Test report",
  contact: "qa@example.invalid", bid: "QA-ONLY", tap_event_id: "715", detail: "Literal description", ...patch });
const inbox = (rows = [row()]) => ({ rows, availability: "ready", source: "production" });
const current = (patch = {}) => ({ ticketId: ID, tenantId: TENANT, tenantSlug: "qa-only", status: "closed", revision: "b".repeat(64),
  updatedAt: "2026-09-23T13:00:00.000Z", canUpdate: true, blockedReason: null, ...patch });

test("confirmed current changes only status and preserves ticket fields, input rows and unrelated row identities", () => {
  const unrelated = row({ id: OTHER }), original = inbox([row(), unrelated]), before = structuredClone(original);
  const next = reconcileAuthoritativeTicketStatus(original, current(), context);
  assert.notEqual(next, original); assert.equal(next.rows[0].status, "closed");
  assert.deepEqual(next.rows[0], { ...original.rows[0], status: "closed" });
  assert.equal(next.rows[1], unrelated); assert.deepEqual(original, before);
  assert.equal(reconcileAuthoritativeTicketStatus(next, current(), context), next);
});

test("no row is inserted or reassigned from a lookup, malformed authority, duplicate reference or other tenant", () => {
  for (const changed of [current({ ticketId: OTHER }), current({ tenantId: OTHER_TENANT }), current({ tenantSlug: "other" }),
    current({ status: "invalid\u0000status" }), current({ status: " " }), current({ status: "x".repeat(65) }), current({ revision: "not-a-revision" }), current({ tenantId: null })]) {
    const original = inbox(); assert.equal(reconcileAuthoritativeTicketStatus(original, changed, context), original);
  }
  for (const rows of [[], [row(), row()], [row({ tenant_id: OTHER_TENANT })], [row({ tenant_slug: "other" })], [row({ tenant_id: undefined })]]) {
    const original = inbox(rows); assert.equal(reconcileAuthoritativeTicketStatus(original, current(), context), original);
  }
});

test("a valid read-only legacy status updates presentation without extending the command enum", () => {
  const original = inbox(), legacy = current({ status: "awaiting_supplier", canUpdate: false, blockedReason: "legacy_status" });
  const next = reconcileAuthoritativeTicketStatus(original, legacy, context);
  assert.equal(next.rows[0].status, "awaiting_supplier");
  assert.equal(prepareWorkflowCommand(legacy, "pending", "Review legacy ticket", OTHER), null);
});

test("unavailable, demo and denied collection contexts never gain an authoritative status", () => {
  for (const patch of [{ demoMode: true }, { canLookupTickets: false }, { tenantScope: "other" }]) {
    const original = inbox(); assert.equal(reconcileAuthoritativeTicketStatus(original, current(), { ...context, ...patch }), original);
  }
  for (const patch of [{ source: "demo" }, { source: "unavailable" }, { availability: "upstream_error" }, { availability: "access_denied" }]) {
    const original = { ...inbox(), ...patch }; assert.equal(reconcileAuthoritativeTicketStatus(original, current(), context), original);
  }
});

test("global scope can update the exact assigned row while retaining another tenant's rows", () => {
  const other = row({ id: OTHER, tenant_id: OTHER_TENANT, tenant_slug: "other" });
  const original = inbox([row(), other]), next = reconcileAuthoritativeTicketStatus(original, current(), { ...context, tenantScope: "" });
  assert.equal(next.rows[0].status, "closed"); assert.equal(next.rows[1], other);
  const duplicate = inbox([row(), { ...other, id: ID }]);
  assert.equal(reconcileAuthoritativeTicketStatus(duplicate, current(), { ...context, tenantScope: "" }), duplicate);
});
