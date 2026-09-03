import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  POST_TAP_ENGAGEMENT_DOMAINS,
  POST_TAP_ENGAGEMENT_STAGES,
  POST_TAP_ENGAGEMENT_TAXONOMY_VERSION,
  classifyPublicExperienceEvent,
  publicExperienceRequestFingerprint,
  recordPublicExperienceEvent,
} = await import("../src/lib/public-experience-events.ts");
const {
  loadTenantEngagement,
  normalizeTenantEngagementRow,
  normalizeTenantEngagementSlug,
  parseTenantEngagementFilters,
  resolveTenantEngagementScope,
  summarizeTenantEngagement,
} = await import("../src/lib/tenant-engagement.ts");

const TENANT = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "tenant-a",
  name: "Tenant A",
};
const CONTEXT = {
  eventId: "42",
  tenantId: TENANT.id,
  batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  tagId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  bid: "BATCH-42",
  result: "VALID_CLOSED",
  verdict: "valid",
  riskLevel: "none",
  reason: "",
  productState: "VALID_CLOSED",
};

function row(overrides = {}) {
  return {
    activity_id: "public-experience:dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    domain: "passport",
    stage: "VIEWED",
    occurred_at: "2026-09-03T18:00:00.000Z",
    data_mode: "real",
    source_event_type: "PRODUCT_VIEWED",
    linked_actor_count: 1,
    actor_ref: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    consent_channels: ["email"],
    batch_id: CONTEXT.batchId,
    tag_id: CONTEXT.tagId,
    bid: CONTEXT.bid,
    source_tap_event_id: CONTEXT.eventId,
    source_kind: "public_experience_event",
    source_record_type: "sdk_external_events",
    source_record_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    evidence: "client_reported_action",
    audit_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    trace_id: "trace-42",
    idempotency_key: "engagement_1234567890",
    request_fingerprint: "1".repeat(64),
    dedupe_mode: "writer_idempotency_key",
    total_count: 3,
    ...overrides,
  };
}

test("post-tap taxonomy normalizes existing public event types without inventing outcomes", () => {
  assert.equal(POST_TAP_ENGAGEMENT_TAXONOMY_VERSION, "nexid-post-tap-engagement-v1");
  assert.deepEqual(POST_TAP_ENGAGEMENT_DOMAINS, ["passport", "content", "warranty", "support", "ownership", "loyalty"]);
  assert.deepEqual(POST_TAP_ENGAGEMENT_STAGES, ["VIEWED", "STARTED", "CONFIRMED"]);
  assert.deepEqual(classifyPublicExperienceEvent("PRODUCT_VIEWED"), { domain: "passport", stage: "VIEWED" });
  assert.deepEqual(classifyPublicExperienceEvent("TRAINING_STARTED"), { domain: "content", stage: "STARTED" });
  assert.deepEqual(classifyPublicExperienceEvent("TRAINING_COMPLETED"), { domain: "content", stage: "CONFIRMED" });
  assert.deepEqual(classifyPublicExperienceEvent("PROBLEM_REPORTED"), { domain: "support", stage: "STARTED" });
  assert.deepEqual(classifyPublicExperienceEvent("LOYALTY_JOINED"), { domain: "loyalty", stage: "CONFIRMED" });
});

test("public engagement fingerprint is stable and changes with tenant, event or semantic payload", () => {
  const base = {
    context: CONTEXT,
    eventType: "PRODUCT_VIEWED",
    idempotencyKey: "engagement_1234567890",
    data: { surface: "passport", placement: "hero" },
  };
  const fingerprint = publicExperienceRequestFingerprint(base);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(publicExperienceRequestFingerprint({ ...base, data: { placement: "hero", surface: "passport" } }), fingerprint);
  assert.notEqual(publicExperienceRequestFingerprint({ ...base, eventType: "TECHNICAL_SHEET_VIEWED" }), fingerprint);
  assert.notEqual(publicExperienceRequestFingerprint({ ...base, context: { ...CONTEXT, tenantId: "99999999-9999-4999-8999-999999999999" } }), fingerprint);
  assert.notEqual(publicExperienceRequestFingerprint({ ...base, data: { surface: "passport", placement: "footer" } }), fingerprint);
});

test("public engagement writer scopes idempotency by server tenant, detects payload drift and audits new writes atomically", async () => {
  let statement = "";
  let values = [];
  const saved = await recordPublicExperienceEvent({
    context: CONTEXT,
    eventType: "PRODUCT_VIEWED",
    idempotencyKey: "engagement_1234567890",
    data: { surface: "passport" },
    traceId: "trace-42",
  }, async (strings, ...parameters) => {
    statement = strings.join("?");
    values = parameters;
    return [{
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      created_at: "2026-09-03T18:00:00.000Z",
      replayed: false,
      conflict: false,
      audit_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    }];
  });

  assert.match(statement, /hashtextextended\(\?, 0\)/);
  assert.ok(values.includes(`${TENANT.id}:engagement_1234567890`));
  assert.match(statement, /external_event\.tenant_id = \?::uuid/);
  assert.match(statement, /existing\.request_fingerprint <> \?/);
  assert.match(statement, /existing\.data[^]*<> \?::jsonb/);
  assert.match(statement, /INSERT INTO audit_logs/);
  assert.match(statement, /post_tap\.engagement\.recorded/);
  assert.equal(saved.auditId, "ffffffff-ffff-4fff-8fff-ffffffffffff");
  assert.deepEqual(saved.taxonomy, { domain: "passport", stage: "VIEWED" });
});

test("engagement filters default to 24h and reject unsupported dimensions", () => {
  const defaults = parseTenantEngagementFilters(new URLSearchParams());
  assert.equal(defaults.ok, true);
  assert.equal(defaults.filters.range, "24h");
  assert.equal(defaults.filters.rangeSql, "24 hours");
  assert.equal(defaults.filters.limit, 100);

  const filtered = parseTenantEngagementFilters(new URLSearchParams("range=7d&domain=ownership&stage=confirmed&source=demo&limit=12"));
  assert.equal(filtered.ok, true);
  assert.deepEqual(filtered.filters, {
    range: "7d",
    rangeSql: "7 days",
    domain: "ownership",
    stage: "CONFIRMED",
    dataMode: "demo",
    limit: 12,
  });
  assert.deepEqual(parseTenantEngagementFilters(new URLSearchParams("range=all")), { ok: false, reason: "engagement_range_invalid" });
  assert.deepEqual(parseTenantEngagementFilters(new URLSearchParams("domain=payments")), { ok: false, reason: "engagement_domain_invalid" });
  assert.deepEqual(parseTenantEngagementFilters(new URLSearchParams("stage=clicked")), { ok: false, reason: "engagement_stage_invalid" });
  assert.deepEqual(parseTenantEngagementFilters(new URLSearchParams("source=synthetic")), { ok: false, reason: "engagement_source_invalid" });
  assert.equal(normalizeTenantEngagementSlug("Tenant-A"), "tenant-a");
  assert.equal(normalizeTenantEngagementSlug("../tenant-a"), null);
});

test("actor projection exposes a consumer only with one durable link and explicit current consent", () => {
  const contactable = normalizeTenantEngagementRow(row());
  assert.equal(contactable.actor.state, "contactable_consumer");
  assert.equal(contactable.actor.contactable, true);
  assert.equal(contactable.actor.consumerId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  assert.deepEqual(contactable.actor.consentChannels, ["email"]);
  assert.equal(contactable.unit.isActorIdentity, false);
  assert.equal("uid" in contactable.unit, false);

  const unconsented = normalizeTenantEngagementRow(row({ actor_ref: null, consent_channels: [] }));
  assert.equal(unconsented.actor.state, "linked_without_contact_consent");
  assert.equal(unconsented.actor.contactable, false);
  assert.equal(unconsented.actor.consumerId, null);

  const ambiguous = normalizeTenantEngagementRow(row({ linked_actor_count: 2, actor_ref: null, consent_channels: ["email"] }));
  assert.equal(ambiguous.actor.state, "ambiguous_link");
  assert.equal(ambiguous.actor.contactable, false);
  assert.deepEqual(ambiguous.actor.consentChannels, []);

  const missing = normalizeTenantEngagementRow(row({
    activity_id: "ticket:missing-context",
    data_mode: "unknown",
    linked_actor_count: 0,
    actor_ref: null,
    consent_channels: [],
    batch_id: null,
    tag_id: null,
    bid: null,
    source_tap_event_id: null,
  }));
  assert.equal(missing.dataMode, "unknown");
  assert.equal(missing.actor.state, "anonymous");
  assert.deepEqual(missing.unit, {
    batchId: null,
    tagId: null,
    bid: null,
    sourceTapEventId: null,
    isActorIdentity: false,
  });
});

test("tenant engagement query scopes every source and keeps real, demo and missing evidence distinct", async () => {
  let statement = "";
  let values = [];
  const parsed = parseTenantEngagementFilters(new URLSearchParams());
  const result = await loadTenantEngagement({
    tenant: TENANT,
    filters: parsed.filters,
    query: async (strings, ...parameters) => {
      statement = strings.join("?");
      values = parameters;
      return [
        row(),
        row({
          activity_id: "ownership:11111111-1111-4111-8111-111111111111",
          domain: "ownership",
          stage: "CONFIRMED",
          data_mode: "demo",
          source_kind: "ownership_registry",
          source_record_type: "consumer_product_ownerships",
          source_record_id: "11111111-1111-4111-8111-111111111111",
          source_event_type: "OWNERSHIP_ACTIVATED",
          idempotency_key: null,
          request_fingerprint: null,
          dedupe_mode: "registry_unique_constraint",
          actor_ref: null,
          consent_channels: [],
        }),
        row({
          activity_id: "ticket:22222222-2222-4222-8222-222222222222",
          domain: "support",
          stage: "CONFIRMED",
          data_mode: "unknown",
          source_kind: "support_ticket",
          source_record_type: "tickets",
          source_record_id: "22222222-2222-4222-8222-222222222222",
          source_event_type: "TICKET_CREATED",
          linked_actor_count: 0,
          actor_ref: null,
          consent_channels: [],
          idempotency_key: null,
          request_fingerprint: null,
          dedupe_mode: "none",
        }),
      ];
    },
  });

  assert.match(statement, /external_event\.tenant_id = \?::uuid/);
  assert.match(statement, /lifecycle_event\.tenant_id = \?::uuid/);
  assert.match(statement, /ticket\.tenant_id = \?::uuid/);
  assert.match(statement, /ownership\.tenant_id = \?::uuid/);
  assert.match(statement, /member\.tenant_id = \?::uuid/);
  assert.match(statement, /consent\.tenant_id = \?::uuid/);
  assert.ok(values.filter((value) => value === TENANT.id).length >= 7);
  assert.match(statement, /consent\.granted = true/);
  assert.match(statement, /consent\.granted_at IS NOT NULL/);
  assert.match(statement, /consent\.revoked_at IS NULL/);
  assert.match(statement, /source_event\.tenant_id = external_event\.tenant_id/);
  assert.match(statement, /source_event\.tenant_id = ticket\.tenant_id/);
  assert.match(statement, /LEFT JOIN events source_event\s+ON source_event\.tenant_id = ticket\.tenant_id/);
  assert.match(statement, /LEFT JOIN events source_event\s+ON source_event\.tenant_id = ownership\.tenant_id/);
  assert.match(statement, /LEFT JOIN batches source_batch\s+ON source_batch\.tenant_id = ownership\.tenant_id/);
  assert.equal((statement.match(/tag_id::text AS tag_id/g) || []).length, 5);
  assert.equal(result.total, 3);
  assert.deepEqual(result.items.map((item) => item.dataMode), ["real", "demo", "unknown"]);
  assert.equal(result.items[1].provenance.idempotency.status, "registry_deduplicated");
  assert.equal(result.items[2].provenance.idempotency.status, "not_available");

  const summary = summarizeTenantEngagement(result.items);
  assert.equal(summary.real, 1);
  assert.equal(summary.demo, 1);
  assert.equal(summary.contactable, 1);
  assert.equal(summary.byDomain.passport, 1);
  assert.equal(summary.byDomain.ownership, 1);
  assert.equal(summary.byDomain.support, 1);
});

test("tenant lookup is an exact server-side slug lookup", async () => {
  let statement = "";
  let values = [];
  const tenant = await resolveTenantEngagementScope("tenant-a", async (strings, ...parameters) => {
    statement = strings.join("?");
    values = parameters;
    return [{ id: TENANT.id, slug: TENANT.slug, name: TENANT.name }];
  });
  assert.match(statement, /WHERE tenant\.slug = \?/);
  assert.deepEqual(values, ["tenant-a"]);
  assert.deepEqual(tenant, TENANT);
});

test("admin engagement route is CRM-authorized, requires one tenant and declares evidence boundaries", async () => {
  const route = await readFile(new URL("../src/app/admin/engagement/route.ts", import.meta.url), "utf8");
  assert.match(route, /checkAdminWithPermission\(req, "crm:read"\)/);
  assert.match(route, /getAdminTenantAccess\(req, requestedTenant\)/);
  assert.match(route, /tenant_required/);
  assert.match(route, /tenant_not_found/);
  assert.match(route, /UID, tag or tap is never treated as a person/);
  assert.match(route, /missing evidence stays unknown/);
  assert.doesNotMatch(route, /sample|mock|synthetic/i);
});

test("admin OpenAPI publishes the tenant engagement taxonomy and consent boundary", async () => {
  const spec = JSON.parse(await readFile(new URL("../public/openapi/nexid-admin-v1.json", import.meta.url), "utf8"));
  const operation = spec.paths["/admin/engagement"].get;
  assert.equal(operation["x-nexid-permission"], "crm:read");
  assert.deepEqual(operation.parameters.map((parameter) => parameter.name), ["tenant", "range", "domain", "stage", "source", "limit"]);
  assert.equal(operation.parameters.find((parameter) => parameter.name === "range").schema.default, "24h");
  assert.equal(operation.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/TenantEngagementResponse");
  const response = spec.components.schemas.TenantEngagementResponse;
  assert.equal(response.properties.taxonomy.properties.version.const, "nexid-post-tap-engagement-v1");
  const item = spec.components.schemas.TenantEngagementItem;
  assert.match(item.properties.actor.description, /current explicitly granted contact consent/);
  assert.equal(item.properties.unit.properties.isActorIdentity.const, false);
  assert.equal("uid" in item.properties.unit.properties, false);
});
