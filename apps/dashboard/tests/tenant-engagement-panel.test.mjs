import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyEngagementConfirmation,
  parseTenantEngagementPayload,
  readableEngagementEvent,
} from "../src/lib/tenant-engagement-view.ts";
import { requiredPermissionForAdminResource } from "../src/lib/permission-policy.ts";

// Synthetic API fixtures only: these records do not attest tenant activity.
function activity(overrides = {}) {
  return {
    id: "public-experience:1",
    domain: "content",
    stage: "VIEWED",
    occurredAt: "2026-09-03T17:30:00.000Z",
    dataMode: "real",
    sourceEventType: "TECHNICAL_SHEET_VIEWED",
    actor: {
      state: "anonymous",
      consumerId: null,
      contactable: false,
      consentChannels: [],
    },
    unit: {
      bid: "RA-2407",
      batchId: "batch-1",
      tagId: "tag-1",
      sourceTapEventId: "42",
      isActorIdentity: false,
    },
    provenance: {
      sourceKind: "public_experience_event",
      recordType: "sdk_external_events",
      recordId: "1",
      evidence: "client_reported_action",
      auditId: "audit-1",
      traceId: "trace-1",
      tenantScope: "server_derived",
      idempotency: {
        status: "recorded",
        key: "idem-1",
        requestFingerprint: "fingerprint-1",
      },
    },
    ...overrides,
  };
}

function payload(items, overrides = {}) {
  return {
    ok: true,
    scope: {
      tenant: { id: "tenant-1", slug: "demobodega", name: "Bodega Balmec" },
      range: "24h",
      domain: "all",
      stage: "all",
      source: "all",
      limit: 120,
    },
    taxonomy: { version: "nexid-post-tap-engagement-v1" },
    totals: { matched: items.length, returned: items.length, truncated: false },
    items,
    boundaries: {
      actor: "A UID, tag or tap is never treated as a person.",
      source: "Sources remain separated.",
      confirmed: "Confirmed means durably recorded by the source.",
    },
    ...overrides,
  };
}

test("engagement crosses the dashboard BFF only with crm:read", () => {
  assert.equal(requiredPermissionForAdminResource("GET", "engagement"), "crm:read");
  assert.equal(requiredPermissionForAdminResource("POST", "engagement"), null);
});

test("normalizes tenant-scoped activity and derives truthful visible counts", () => {
  const parsed = parseTenantEngagementPayload(payload([
    activity(),
    activity({
      id: "warranty:2",
      domain: "warranty",
      stage: "CONFIRMED",
      dataMode: "imported",
      sourceEventType: "WARRANTY_REGISTERED",
      provenance: {
        ...activity().provenance,
        sourceKind: "canonical_lifecycle_event",
        recordType: "events",
        evidence: "server_confirmed_warranty_registration",
      },
      actor: {
        state: "contactable_consumer",
        consumerId: "consumer-secret-reference",
        contactable: true,
        consentChannels: ["whatsapp"],
      },
    }),
  ]), "demobodega");

  assert.ok(parsed);
  assert.equal(parsed.matched, 2);
  assert.equal(parsed.counts.byDomain.content, 1);
  assert.equal(parsed.counts.byDomain.warranty, 1);
  assert.equal(parsed.counts.byStage.CONFIRMED, 1);
  assert.deepEqual(parsed.counts.confirmations, { source_confirmed: 1, client_declaration: 0, unverified_confirmation: 0 });
  assert.equal(parsed.counts.bySource.real, 1);
  assert.equal(parsed.counts.bySource.imported, 1);
  assert.equal(parsed.counts.contactable, 1);
  assert.deepEqual(parsed.activities[1].consentChannels, ["whatsapp"]);
  assert.equal("consumerId" in parsed.activities[1], false);
  assert.equal(parsed.activities[0].unit.bid, "RA-2407");
});

test("never enables contact without both explicit consent and the contactable actor state", () => {
  const missingConsent = activity({
    actor: {
      state: "contactable_consumer",
      consumerId: "consumer-1",
      contactable: true,
      consentChannels: [],
    },
  });
  const conflictingState = activity({
    id: "content:2",
    actor: {
      state: "linked_without_contact_consent",
      consumerId: "consumer-2",
      contactable: true,
      consentChannels: ["email"],
    },
  });
  const parsed = parseTenantEngagementPayload(payload([missingConsent, conflictingState]), "demobodega");

  assert.ok(parsed);
  assert.equal(parsed.counts.contactable, 0);
  assert.deepEqual(parsed.activities.map((item) => item.consentChannels), [[], []]);
});

test("fails closed on cross-tenant, unknown-source or identity-confused payloads", () => {
  assert.equal(parseTenantEngagementPayload(payload([activity()]), "otro-tenant"), null);
  assert.equal(parseTenantEngagementPayload(payload([activity({ dataMode: "synthetic" })]), "demobodega"), null);
  assert.equal(parseTenantEngagementPayload(payload([activity({
    unit: {
      bid: "RA-2407",
      batchId: "batch-1",
      tagId: "tag-1",
      sourceTapEventId: "42",
      isActorIdentity: true,
    },
  })]), "demobodega"), null);
  assert.equal(parseTenantEngagementPayload(payload([activity()], {
    totals: { matched: 4, returned: 2, truncated: true },
  }), "demobodega"), null);
});

test("turns known event codes into client-readable activity labels", () => {
  assert.equal(readableEngagementEvent("STEWARDSHIP_CONFIRMED"), "Lectura declarada por el usuario");
  assert.equal(readableEngagementEvent("LOYALTY_JOINED"), "Adhesión a fidelización confirmada");
  assert.equal(readableEngagementEvent("CUSTOM_RECORDED_ACTION"), "Custom Recorded Action");
});

test("client confirmations remain declarations and never inflate system results", () => {
  const parsed = parseTenantEngagementPayload(payload([
    activity({ sourceEventType: "STEWARDSHIP_CONFIRMED", stage: "CONFIRMED" }),
    activity({ id: "legacy-client:2", sourceEventType: "LOYALTY_JOINED", stage: "CONFIRMED", domain: "loyalty" }),
  ]), "demobodega");
  assert.ok(parsed);
  assert.deepEqual(parsed.counts.confirmations, { source_confirmed: 0, client_declaration: 2, unverified_confirmation: 0 });
  assert.equal(parsed.counts.byStage.CONFIRMED, 2, "wire stages are preserved, not renamed");
  assert.ok(parsed.activities.every((item) => classifyEngagementConfirmation(item) === "client_declaration"));
});

test("only exact authoritative provenance tuples contribute to system results", () => {
  const contracts = [
    ["warranty", "WARRANTY_REGISTERED", "canonical_lifecycle_event", "events", "server_confirmed_warranty_registration"],
    ["support", "TICKET_CREATED", "support_ticket", "tickets", "durable_ticket_created"],
    ["ownership", "OWNERSHIP_ACTIVATED", "ownership_registry", "consumer_product_ownerships", "durable_claimed_ownership_record"],
    ["loyalty", "LOYALTY_JOINED", "loyalty_registry", "loyalty_members", "durable_loyalty_membership"],
  ];
  const items = contracts.map(([domain, sourceEventType, sourceKind, recordType, evidence], index) => activity({
    id: `system-fixture:${index}`,
    domain,
    sourceEventType,
    stage: "CONFIRMED",
    provenance: { ...activity().provenance, sourceKind, recordType, evidence },
  }));
  const parsed = parseTenantEngagementPayload(payload(items), "demobodega");
  assert.ok(parsed);
  assert.equal(parsed.counts.confirmations.source_confirmed, 4);
  assert.ok(parsed.activities.every((item) => classifyEngagementConfirmation(item) === "source_confirmed"));
});

test("unknown or contradictory confirmation provenance stays visible but fails closed for results", () => {
  const base = activity().provenance;
  const uncertain = [
    { ...base, sourceKind: "new_source", recordType: "new_records", evidence: "new_confirmation" },
    { ...base, sourceKind: "support_ticket", recordType: "tickets", evidence: "client_reported_action" },
    { ...base, evidence: "durable_ticket_created" },
    { ...base, sourceKind: "support_ticket", recordType: "tickets", evidence: "durable_ticket_created", recordId: "" },
    { ...base, sourceKind: "support_ticket", recordType: "tickets", evidence: "DURABLE_TICKET_CREATED" },
  ].map((provenance, index) => activity({
    id: `unknown-fixture:${index}`,
    stage: "CONFIRMED",
    sourceEventType: "TICKET_CREATED",
    dataMode: "unknown",
    provenance,
  }));
  const parsed = parseTenantEngagementPayload(payload(uncertain), "demobodega");
  assert.ok(parsed);
  assert.equal(parsed.activities.length, uncertain.length);
  assert.deepEqual(parsed.counts.confirmations, { source_confirmed: 0, client_declaration: 0, unverified_confirmation: uncertain.length });
  assert.equal(Object.values(parsed.counts.confirmations).reduce((sum, value) => sum + value, 0), parsed.counts.byStage.CONFIRMED);
});

test("viewed and started stages do not become confirmations because their source is authoritative", () => {
  const parsed = parseTenantEngagementPayload(payload([activity({
    stage: "STARTED",
    sourceEventType: "WARRANTY_REVIEW_REQUESTED",
    provenance: { ...activity().provenance, sourceKind: "canonical_lifecycle_event", recordType: "events", evidence: "server_confirmed_warranty_registration" },
  }), activity()]), "demobodega");
  assert.ok(parsed);
  assert.deepEqual(parsed.counts.confirmations, { source_confirmed: 0, client_declaration: 0, unverified_confirmation: 0 });
  assert.ok(parsed.activities.every((item) => classifyEngagementConfirmation(item) === null));
});

test("CRM overview renders an interactive, source-separated engagement surface", async () => {
  const [page, component] = await Promise.all([
    readFile(new URL("../src/app/(app)/loyalty/overview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/tenant-engagement-panel.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<TenantEngagementPanel[\s\S]*?tenantSlug=\{tenantScope\}[\s\S]*?tenantName=\{tenantName\}[\s\S]*?canRead=\{canReadEngagement\}[\s\S]*?streamEnabled=\{canStreamEngagement\}/);
  assert.match(page, /Workspace activo:[\s\S]*?\{tenantName\}/);
  assert.match(component, /Inteligencia post-tap · \{tenantName \|\| tenantSlug\}/);
  assert.match(page, /dashboardPermissionMatches\([\s\S]*?"crm:read"/);
  assert.match(page, /dashboardHighImpactPermissionMatches\([\s\S]*?"events\.read_sensitive"/);
  assert.match(component, /\/api\/admin\/engagement\?\$\{query\.toString\(\)\}/);
  assert.match(component, /"24h"/);
  assert.match(component, /"7d"/);
  assert.match(component, /"30d"/);
  assert.match(component, /Lecturas de unidad ≠ acciones post-tap ≠ personas/);
  assert.match(component, /Cero acciones en esta vista no significa cero taps/);
  assert.match(component, /No se muestran ceros ni estimaciones/);
  assert.match(component, /Contacto habilitado/);
  assert.match(component, /consentChannels/);
  assert.match(component, /data-source=\{activity\.source\}/);
  assert.match(component, /aria-busy=/);
  assert.match(component, /useDashboardRealtime\(\)/);
  assert.doesNotMatch(component, /new EventSource\(/);
  assert.match(component, /const frame = realtime\.snapshot/);
  assert.match(component, /const frames = unreadDashboardRealtimeFrames\(/);
  assert.match(component, /frames\.some\(\(frame\) => isTenantEngagementStreamEvent\(frame\.data, tenantSlug\)\)/);
  assert.match(component, /dashboardRealtimeConsumerFellBehind\(/);
  assert.match(component, /return snapshot\.availability === "ready"/);
  assert.match(component, /document\.addEventListener\("visibilitychange", onVisibility\)/);
  assert.doesNotMatch(component, /setInterval|Consulta automática cada 15 s/);
});
