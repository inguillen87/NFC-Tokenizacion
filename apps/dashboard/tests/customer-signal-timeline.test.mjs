import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildCustomerSignalTimeline,
  collectionHasConfirmedEmptyState,
} from "../src/lib/customer-signal-timeline.ts";
import {
  appendCustomerMemberTimelinePage,
  normalizeCustomerMembers,
  parseCustomerMemberTimelinePayload,
} from "../src/lib/customer-member-timeline.ts";
import { requiredPermissionForAdminResource } from "../src/lib/permission-policy.ts";

const READY_PRODUCTION = { availability: "ready", source: "production" };
const READY_DEMO = { availability: "ready", source: "demo" };
const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_SCOPE = { tenant: "demobodega", consumerId: MEMBER_ID };

function durableTimelinePayload(overrides = {}) {
  return {
    ok: true,
    tenant: "demobodega",
    consumerId: MEMBER_ID,
    order: "desc",
    items: [{
      sourceKind: "consumer_tap",
      sourceId: "tap-1",
      occurredAt: "2026-09-03T12:00:00.000Z",
      dataMode: "production",
      provenance: { persistence: "durable", relation: "consumer_tap_history", dataModeField: "events.source" },
      correlation: { consumerId: MEMBER_ID, tapEventId: "42", basis: ["consumer_id", "tap_event_id"] },
      data: { verdict: "VALID", city: "Mendoza", contact: "must-not-cross-bff" },
    }],
    page: { hasMore: false, nextCursor: null },
    partial: false,
    sourceErrors: [],
    ...overrides,
  };
}

test("merges confirmed collections chronologically and preserves source provenance", () => {
  const signals = buildCustomerSignalTimeline({
    leads: [{ id: "lead-1", created_at: "2026-09-03T10:00:00Z", name: "Cuenta informada", role_interest: "Piloto NFC" }],
    tickets: [{ id: "ticket-1", created_at: "2026-09-03T12:00:00Z", contact: "canal@empresa.test", title: "Consulta técnica" }],
    orders: [{ id: "order-1", created_at: "2026-09-03T11:00:00Z", contact: "compras@empresa.test", product_title: "Kit NFC" }],
    collections: { leads: READY_PRODUCTION, tickets: READY_PRODUCTION, orders: READY_DEMO },
  });

  assert.deepEqual(signals.map((signal) => signal.id), ["ticket-1", "order-1", "lead-1"]);
  assert.equal(signals[1].source, "demo");
  assert.equal(signals[2].objective, "Piloto NFC");
  assert.equal(signals[2].objectiveLabel, "Interés informado");
});

test("does not invent people, owners or actions when the source omits them", () => {
  const [signal] = buildCustomerSignalTimeline({
    leads: [{ id: "lead-2", created_at: "2026-09-03T10:00:00Z" }],
    tickets: [],
    orders: [],
    collections: { leads: READY_PRODUCTION, tickets: READY_PRODUCTION, orders: READY_PRODUCTION },
  });

  assert.equal(signal.subject, "Identidad no informada");
  assert.equal(signal.owner, null);
  assert.equal(signal.objective, null);
  assert.equal(signal.nextAction, null);
});

test("uses only explicit operational fields, including bounded metadata", () => {
  const [signal] = buildCustomerSignalTimeline({
    leads: [],
    tickets: [{
      id: "ticket-2",
      created_at: "2026-09-03T10:00:00Z",
      contact: "cliente@empresa.test",
      title: "Necesito soporte",
      assigned_to: "Equipo postventa",
      meta: JSON.stringify({ objective: "Resolver consulta", next_action: "Responder por el canal informado" }),
    }],
    orders: [],
    collections: { leads: READY_PRODUCTION, tickets: READY_PRODUCTION, orders: READY_PRODUCTION },
  });

  assert.equal(signal.owner, "Equipo postventa");
  assert.equal(signal.objective, "Resolver consulta");
  assert.equal(signal.nextAction, "Responder por el canal informado");
});

test("excludes unavailable collections and distinguishes a confirmed empty source", () => {
  const signals = buildCustomerSignalTimeline({
    leads: [{ id: "lead-hidden", created_at: "2026-09-03T10:00:00Z", name: "No debe aparecer" }],
    tickets: [],
    orders: [],
    collections: {
      leads: { availability: "access_denied", source: "unavailable" },
      tickets: READY_PRODUCTION,
      orders: { availability: "unreachable", source: "unavailable" },
    },
  });

  assert.deepEqual(signals, []);
  assert.equal(collectionHasConfirmedEmptyState(READY_PRODUCTION, 0), true);
  assert.equal(collectionHasConfirmedEmptyState({ availability: "unreachable", source: "unavailable" }, 0), false);
});

test("dashboard wiring accepts the order-request items envelope and labels snapshot truthfully", async () => {
  const testDirectory = fileURLToPath(new URL(".", import.meta.url));
  const page = await readFile(new URL("../src/app/(app)/leads-tickets/page.tsx", import.meta.url), "utf8");
  const component = await readFile(new URL("../src/components/customer-signal-timeline.tsx", import.meta.url), "utf8");

  assert.ok(testDirectory);
  assert.match(page, /Array\.isArray\(\(payload as Record<string, unknown>\)\.items\)/);
  assert.match(page, /order-requests", allowDemoData\)/);
  assert.match(page, /consumer-portal\/members", allowDemoData\)/);
  assert.match(page, /consumer-network\/member\/\$\{encodeURIComponent\(consumerId\)\}\/timeline/);
  assert.match(page, /signalCollections=/);
  assert.match(component, /Snapshot confirmado al cargar\. Esta vista no afirma tiempo real\./);
  assert.match(component, /no representa(?:n)? clientes ni actividad productiva/);
  assert.match(component, /Próxima acción no informada por la fuente/);
});

test("normalizes authorized members without synthesizing identity", () => {
  const members = normalizeCustomerMembers([
    { id: "member-1", display_name: "", email: "member@company.test", points_balance: "12" },
    { display_name: "Missing id" },
  ]);

  assert.deepEqual(members, [{
    id: "member-1",
    displayName: null,
    email: "member@company.test",
    phone: null,
    status: null,
    pointsBalance: 12,
  }]);
});

test("accepts only durable member timeline entries with explicit correlation", () => {
  const parsed = parseCustomerMemberTimelinePayload(durableTimelinePayload(), MEMBER_SCOPE);

  assert.equal(parsed?.items.length, 1);
  assert.equal(parsed?.items[0].provenance.persistence, "durable");
  assert.equal(parsed?.items[0].correlation.basis.join("+"), "consumer_id+tap_event_id");
  assert.equal(parsed?.nextCursor, null);
  assert.equal("contact" in parsed.items[0].data, false);
  assert.equal(parseCustomerMemberTimelinePayload({
    ok: true,
    items: [{ sourceKind: "consumer_tap", sourceId: "tap-2" }],
    page: { hasMore: false, nextCursor: null },
    partial: false,
    sourceErrors: [],
  }, MEMBER_SCOPE), null);
});

test("retains a validated cursor and rejects cross-scope timeline payloads", () => {
  const nextCursor = "eyJ2IjoxLCJvY2N1cnJlZEF0IjoiMjAyNi0wOS0wM1QxMjowMDowMC4wMDBaIn0";
  const paged = parseCustomerMemberTimelinePayload(durableTimelinePayload({
    page: { hasMore: true, nextCursor },
  }), MEMBER_SCOPE);

  assert.equal(paged?.hasMore, true);
  assert.equal(paged?.nextCursor, nextCursor);
  assert.equal(parseCustomerMemberTimelinePayload(durableTimelinePayload({ tenant: "other-tenant" }), MEMBER_SCOPE), null);
  assert.equal(parseCustomerMemberTimelinePayload(durableTimelinePayload({ consumerId: OTHER_MEMBER_ID }), MEMBER_SCOPE), null);
  assert.equal(parseCustomerMemberTimelinePayload(durableTimelinePayload({
    items: [{
      ...durableTimelinePayload().items[0],
      correlation: { consumerId: OTHER_MEMBER_ID, tapEventId: "42", basis: ["consumer_id", "tap_event_id"] },
    }],
  }), MEMBER_SCOPE), null);
  assert.equal(parseCustomerMemberTimelinePayload(durableTimelinePayload({
    page: { hasMore: true, nextCursor: "cursor with spaces" },
  }), MEMBER_SCOPE), null);
  assert.equal(parseCustomerMemberTimelinePayload(durableTimelinePayload({
    page: { hasMore: false, nextCursor: "stale-cursor" },
  }), MEMBER_SCOPE), null);
});

test("appends cursor pages without duplicating durable events and keeps descending order", () => {
  const initial = {
    availability: "ready",
    ...parseCustomerMemberTimelinePayload(durableTimelinePayload({
      page: { hasMore: true, nextCursor: "next-page" },
    }), MEMBER_SCOPE),
  };
  const next = parseCustomerMemberTimelinePayload(durableTimelinePayload({
    items: [
      durableTimelinePayload().items[0],
      {
        ...durableTimelinePayload().items[0],
        sourceId: "tap-older",
        occurredAt: "2026-09-02T12:00:00.000Z",
      },
    ],
  }), MEMBER_SCOPE);

  assert.ok(next);
  const merged = appendCustomerMemberTimelinePage(initial, next);
  assert.deepEqual(merged.items.map((item) => item.sourceId), ["tap-1", "tap-older"]);
  assert.equal(merged.hasMore, false);
  assert.equal(merged.nextCursor, null);
});

test("member timeline crosses the dashboard BFF only with the consumer PII capability", () => {
  assert.equal(
    requiredPermissionForAdminResource("GET", "consumer-network/member/consumer-1/timeline"),
    "consumers.read_pii",
  );
});

test("member pagination BFF enforces both permissions, tenant scope and sanitized parsing", async () => {
  const route = await readFile(new URL("../src/app/api/customer-member-timeline/[consumerId]/route.ts", import.meta.url), "utf8");
  const component = await readFile(new URL("../src/components/customer-member-timeline.tsx", import.meta.url), "utf8");

  assert.match(route, /dashboardHighImpactPermissionMatches\([\s\S]*?"consumers\.read_pii"/);
  assert.match(route, /dashboardPermissionMatches\([\s\S]*?"incidents:read"/);
  assert.match(route, /resolveDashboardTenantScope\(session, requestedTenant\)/);
  assert.match(route, /tenantScope\.tenantSlug !== requestedTenant/);
  assert.match(route, /parseCustomerMemberTimelinePayload\(payload, \{[\s\S]*?tenant: tenantScope\.tenantSlug,[\s\S]*?consumerId/);
  assert.match(component, /\/api\/customer-member-timeline\/\$\{encodeURIComponent\(selectedMemberId\)\}/);
  assert.match(component, /aria-busy=\{pageLoadState === "loading"\}/);
  assert.match(component, /paginación manual, no tiempo real/);
});
