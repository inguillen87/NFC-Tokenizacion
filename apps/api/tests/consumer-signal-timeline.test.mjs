import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE,
  decodeConsumerTimelineCursor,
  encodeConsumerTimelineCursor,
  listConsumerSignalTimeline,
  validConsumerTimelineConsumerId,
  validConsumerTimelineTenantSlug,
} from "../src/lib/consumer-signal-timeline.ts";

const read = (url) => readFile(new URL(url, import.meta.url), "utf8");
const CONSUMER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function fixtureExecutor(options = {}) {
  const queries = [];
  const executor = async (strings, ...values) => {
    const statement = strings.join("?");
    queries.push({ statement, values });
    if (/FROM tenant_consumer_memberships membership/.test(statement)) {
      return options.memberMissing ? [] : [{ tenant_id: TENANT_ID }];
    }
    if (/FROM consumer_tap_history history/.test(statement) && !/FROM event_incidents incident/.test(statement)) {
      return [{
        source_id: "401",
        tap_event_id: "9001",
        verdict: "valid",
        risk_level: "low",
        city: "Mendoza",
        country: "AR",
        occurred_at: "2026-09-03T10:04:00.000Z",
        data_mode: "real",
        event_matches: 1,
      }];
    }
    if (/FROM event_incidents incident/.test(statement)) {
      if (options.failIncidents) throw Object.assign(new Error("private database detail"), { code: "57P01" });
      return [{
        source_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        tap_event_id: "9001",
        status: "investigating",
        severity: "high",
        title: "Lectura para revisar",
        summary: "La regla durable abrió una investigación.",
        resolved_at: null,
        occurred_at: "2026-09-03T10:03:00.000Z",
        data_mode: "real",
      }];
    }
    if (/FROM points_ledger ledger/.test(statement)) {
      return [{
        source_id: "501",
        tap_event_id: "9001",
        program_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        points_source: "TAP_VALID",
        delta: 25,
        balance_after: 125,
        reason: "Lectura válida",
        occurred_at: "2026-09-03T10:02:00.000Z",
        data_mode: "production",
      }];
    }
    if (/FROM marketplace_order_requests request/.test(statement)) {
      return [{
        source_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        tap_event_id: null,
        marketplace_product_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        offer_id: null,
        status: "requested",
        quantity: 2,
        occurred_at: "2026-09-03T10:01:00.000Z",
        data_mode: null,
      }];
    }
    throw new Error(`unexpected_query:${statement}`);
  };
  return { executor, queries };
}

test("timeline input and cursor contracts are strict and canonical", () => {
  assert.equal(validConsumerTimelineTenantSlug("tenant-a"), true);
  assert.equal(validConsumerTimelineTenantSlug("tenant/a"), false);
  assert.equal(validConsumerTimelineConsumerId(CONSUMER_ID), true);
  assert.equal(validConsumerTimelineConsumerId("../../consumer"), false);

  const cursor = {
    v: 1,
    occurredAt: "2026-09-03T10:00:00.000Z",
    sourceKind: "incident",
    sourceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  };
  assert.deepEqual(decodeConsumerTimelineCursor(encodeConsumerTimelineCursor(cursor)), cursor);
  assert.throws(() => decodeConsumerTimelineCursor("not-json"), /consumer_timeline_cursor_invalid/);
  const extraField = Buffer.from(JSON.stringify({ ...cursor, tenant: "other" }), "utf8").toString("base64url");
  assert.throws(() => decodeConsumerTimelineCursor(extraField), /consumer_timeline_cursor_invalid/);
});

test("timeline merges only durable tenant-scoped sources and preserves explicit truth", async () => {
  const { executor, queries } = fixtureExecutor();
  const result = await listConsumerSignalTimeline({
    tenantSlug: "tenant-a",
    consumerId: CONSUMER_ID,
  }, executor);

  assert.equal(result.memberFound, true);
  assert.equal(result.tenantId, TENANT_ID);
  assert.equal(result.partial, false);
  assert.deepEqual(result.items.map((item) => item.sourceKind), [
    "consumer_tap",
    "incident",
    "loyalty_points",
    "order_request",
  ]);
  assert.equal(result.items[0].dataMode, "real");
  assert.equal(result.items[0].provenance.dataModeField, "events.source");
  assert.deepEqual(result.items[0].correlation, {
    consumerId: CONSUMER_ID,
    tapEventId: "9001",
    basis: ["consumer_id", "tap_event_id"],
  });
  assert.equal(result.items[2].dataMode, "production");
  assert.equal(result.items[2].provenance.dataModeField, "loyalty_programs.mode");
  assert.equal(result.items[3].dataMode, null);
  assert.deepEqual(result.items[3].correlation.basis, ["consumer_id"]);
  assert.equal(result.items[3].data.quantity, 2);
  assert.doesNotMatch(JSON.stringify(result), /consumer_message|contact_json|shipping_address_json/);

  const statements = queries.map((query) => query.statement).join("\n");
  assert.match(statements, /tenant\.slug = \?/);
  assert.match(statements, /history\.consumer_id = \?::uuid/);
  assert.match(statements, /member\.consumer_id = \?::uuid/);
  assert.match(statements, /request\.consumer_id = \?::uuid/);
  assert.match(statements, /history\.tap_event_id = incident\.event_id/);
  assert.match(statements, /event\.id = request\.source_tap_event_id[\s\S]*event\.created_at = request\.source_tap_event_created_at/);
  assert.doesNotMatch(statements, /display_name|consumer\.email|member\.email/);
  for (const query of queries) {
    assert.equal(query.values.includes("tenant-a"), true);
    assert.equal(query.values.includes(CONSUMER_ID), true);
  }
});

test("unlinked tap truth remains explicitly unknown instead of being called production", async () => {
  const { executor: baseExecutor } = fixtureExecutor();
  const executor = async (strings, ...values) => {
    const statement = strings.join("?");
    const rows = await baseExecutor(strings, ...values);
    if (/FROM consumer_tap_history history/.test(statement) && !/FROM event_incidents incident/.test(statement)) {
      return rows.map((row) => ({ ...row, data_mode: null, event_matches: 0 }));
    }
    return rows;
  };
  const result = await listConsumerSignalTimeline({ tenantSlug: "tenant-a", consumerId: CONSUMER_ID }, executor);
  const tap = result.items.find((item) => item.sourceKind === "consumer_tap");
  assert.equal(tap.dataMode, null);
  assert.equal(tap.provenance.dataModeField, null);
  assert.equal(tap.data.eventMatchCount, 0);
});

test("one unavailable source is explicit while other durable sources remain usable", async () => {
  const { executor } = fixtureExecutor({ failIncidents: true });
  const result = await listConsumerSignalTimeline({ tenantSlug: "tenant-a", consumerId: CONSUMER_ID }, executor);
  assert.equal(result.memberFound, true);
  assert.equal(result.partial, true);
  assert.equal(result.page.hasMore, false);
  assert.equal(result.page.nextCursor, null);
  assert.deepEqual(result.sourceErrors, [{
    sourceKind: "incident",
    code: "source_temporarily_unavailable",
    retryable: true,
  }]);
  assert.deepEqual(result.items.map((item) => item.sourceKind), ["consumer_tap", "loyalty_points", "order_request"]);
  assert.doesNotMatch(JSON.stringify(result.sourceErrors), /private database detail/);
});

test("membership absence is a scoped not-found result and never queries downstream sources", async () => {
  const { executor, queries } = fixtureExecutor({ memberMissing: true });
  const result = await listConsumerSignalTimeline({ tenantSlug: "tenant-a", consumerId: CONSUMER_ID }, executor);
  assert.equal(result.memberFound, false);
  assert.deepEqual(result.items, []);
  assert.equal(result.partial, false);
  assert.equal(queries.length, 1);
});

test("timeline emits an opaque next cursor from the last durable row", async () => {
  const { executor: baseExecutor } = fixtureExecutor();
  const executor = async (strings, ...values) => {
    const statement = strings.join("?");
    if (/FROM tenant_consumer_memberships membership/.test(statement)) return [{ tenant_id: TENANT_ID }];
    if (/FROM consumer_tap_history history/.test(statement) && !/FROM event_incidents incident/.test(statement)) {
      return Array.from({ length: CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE + 1 }, (_, index) => ({
        source_id: String(1000 + index),
        tap_event_id: String(9000 + index),
        verdict: "valid",
        risk_level: "low",
        city: null,
        country: null,
        occurred_at: new Date(Date.UTC(2026, 8, 3, 12, 0, -index)).toISOString(),
        data_mode: "real",
        event_matches: 1,
      }));
    }
    return baseExecutor(strings, ...values).then((rows) => (
      /FROM tenant_consumer_memberships membership/.test(statement) ? [] : rows
    ));
  };
  const result = await listConsumerSignalTimeline({ tenantSlug: "tenant-a", consumerId: CONSUMER_ID }, executor);
  assert.equal(result.items.length, CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE);
  assert.equal(result.page.hasMore, true);
  assert.ok(result.page.nextCursor);
  assert.deepEqual(decodeConsumerTimelineCursor(result.page.nextCursor), {
    v: 1,
    occurredAt: result.items.at(-1).occurredAt,
    sourceKind: result.items.at(-1).sourceKind,
    sourceId: result.items.at(-1).sourceId,
  });
});

test("route requires both permissions and an explicit tenant before reading the timeline", async () => {
  const route = await read("../src/app/admin/consumer-network/member/[consumerId]/timeline/route.ts");
  const piiPermission = route.indexOf('checkAdminWithPermission(req, "consumers.read_pii")');
  const incidentPermission = route.indexOf('checkAdminPermission(req, "incidents:read")');
  const timelineRead = route.indexOf("listConsumerSignalTimeline({");
  assert.ok(piiPermission >= 0 && incidentPermission > piiPermission && timelineRead > incidentPermission);
  assert.match(route, /consumer_timeline_tenant_required/);
  assert.match(route, /forcedTenantSlug !== requestedTenant/);
  assert.match(route, /consumer_timeline_tenant_forbidden/);
  assert.match(route, /consumer_timeline_member_not_found/);
  assert.match(route, /order: "desc"/);
  assert.match(route, /partial: timeline\.partial/);
  assert.match(route, /sourceErrors: timeline\.sourceErrors/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.doesNotMatch(route, /resolveConsumerNetworkTenant|ensure[A-Z].*Schema|demoFallback|fallback.*demo/i);
});
