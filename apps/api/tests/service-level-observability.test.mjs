import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  SERVICE_LEVEL_BURN_THRESHOLDS,
  SERVICE_LEVEL_DEFINITIONS,
  SERVICE_LEVEL_SNAPSHOT_CACHE_MAX_ENTRIES,
  SERVICE_LEVEL_SNAPSHOT_CACHE_TTL_MS,
  evaluateOperationalSignal,
  evaluateServiceLevelIndicator,
  getCachedServiceLevelSnapshot,
  resetServiceLevelSnapshotCacheForTests,
  resolveServiceLevelWindow,
} = await import("../src/lib/service-level-observability.ts");
const { buildFleetRateLimitDecision, classifyFleetRateLimit } = await import("../src/lib/fleet-rate-limit-policy.ts");
const { checkAdmin, getAdminTenantAccess } = await import("../src/lib/auth.ts");
const { installEphemeralE2eSqlExecutor } = await import("../src/lib/db.ts");

const observabilitySource = await readFile(new URL("../src/lib/service-level-observability.ts", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../src/app/admin/observability/service-levels/route.ts", import.meta.url), "utf8");

test("window parser accepts only bounded server-defined windows", () => {
  assert.equal(resolveServiceLevelWindow("1h"), "1h");
  assert.equal(resolveServiceLevelWindow("30d"), "30d");
  assert.equal(resolveServiceLevelWindow("1 year; drop table events"), "24h");
});

test("zero traffic is no_data rather than a false healthy result", () => {
  const indicator = evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.webhooks, 0, 0);
  assert.equal(indicator.state, "no_data");
  assert.equal(indicator.ratio, null);
  assert.equal(indicator.burnRate, null);
});

test("clean but undersized samples stay insufficient_data", () => {
  const indicator = evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.webhooks, 3, 3);
  assert.equal(indicator.state, "insufficient_data");
  assert.equal(indicator.ratio, 1);
});

test("actual errors consume budget and page even before the minimum healthy sample", () => {
  const indicator = evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.canonical, 10, 9);
  assert.equal(indicator.badEvents, 1);
  assert.equal(indicator.state, "page");
  assert.ok((indicator.burnRate || 0) >= 14.4);
});

test("burn states follow the selected multi-window contract instead of one global threshold", () => {
  const oneHour = evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.webhooks, 100, 93, "1h");
  const twentyFourHour = evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.webhooks, 100, 93, "24h");
  const sevenDay = evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.webhooks, 100, 99, "7d");
  const thirtyDay = evaluateServiceLevelIndicator(SERVICE_LEVEL_DEFINITIONS.webhooks, 100, 98, "30d");

  assert.equal(oneHour.burnRate, 7);
  assert.equal(oneHour.state, "breach");
  assert.deepEqual(oneHour.alertThresholds, SERVICE_LEVEL_BURN_THRESHOLDS["1h"]);
  assert.equal(twentyFourHour.state, "page");
  assert.equal(twentyFourHour.alertThresholds.page, 6);
  assert.equal(sevenDay.state, "ticket");
  assert.equal(sevenDay.alertThresholds.ticket, 1);
  assert.equal(thirtyDay.state, "breach");
  assert.deepEqual(thirtyDay.alertThresholds, { page: null, ticket: null });
});

test("operational signals implement deterministic ticket and page thresholds", () => {
  const base = {
    id: "queue.age",
    name: "Queue age",
    unit: "seconds",
    warningThreshold: 300,
    criticalThreshold: 900,
    runbookId: "queue",
  };
  assert.equal(evaluateOperationalSignal({ ...base, value: 299 }).state, "healthy");
  assert.equal(evaluateOperationalSignal({ ...base, value: 300 }).state, "ticket");
  assert.equal(evaluateOperationalSignal({ ...base, value: 900 }).state, "page");
});

test("all service metrics are persisted aggregates with demo exclusion and tenant predicates", () => {
  for (const table of [
    "events e",
    "canonical_event_operations operation",
    "webhook_deliveries delivery",
    "event_incidents incident",
    "tokenization_requests request",
    "evidence_anchors anchor",
  ]) {
    assert.match(observabilitySource, new RegExp(table.replaceAll(" ", "\\s+")));
  }
  assert.match(observabilitySource, /source::text, 'real'\) <> 'demo'/);
  assert.match(observabilitySource, /event_mode = 'live'/);
  assert.match(observabilitySource, /NOT IN \('demo', 'simulated'\)/);
  assert.match(observabilitySource, /error_code, ''\) <> 'mock_test_only'/);
  assert.match(observabilitySource, /evt_canonical_/);
  assert.doesNotMatch(observabilitySource, /["']canonical:/);
  assert.match(observabilitySource, /delivery\.payload->>'schemaVersion'.*<> '1\.0'/);
  assert.ok((observabilitySource.match(/\$\{tenantId\}::uuid IS NULL/g) || []).length >= 6);
  assert.match(observabilitySource, /tenantIdentifiersExposed: false/);
  assert.match(observabilitySource, /fixtures: false/);
  assert.match(observabilitySource, /synthetic: false/);
});

test("current incident signals are all-time while acknowledgement and disposition remain window cohorts", () => {
  const cohortStart = observabilitySource.indexOf("WITH cohort_incidents AS MATERIALIZED");
  const currentStart = observabilitySource.indexOf("current_open_incidents AS MATERIALIZED", cohortStart);
  const aggregateStart = observabilitySource.indexOf("SELECT\n      count(*) FILTER", currentStart);
  assert.ok(cohortStart >= 0 && currentStart > cohortStart && aggregateStart > currentStart);
  const cohortSql = observabilitySource.slice(cohortStart, currentStart);
  const currentSql = observabilitySource.slice(currentStart, aggregateStart);
  assert.match(cohortSql, /incident\.created_at >= \$\{cutoff\}::timestamptz/);
  assert.match(currentSql, /incident\.status NOT IN \('resolved', 'dismissed'\)/);
  assert.doesNotMatch(currentSql, /cutoff|interval '30 days'/);
  assert.match(observabilitySource.slice(aggregateStart), /FROM current_open_incidents/);
});

test("SUN SLI describes its pre-persistence blind spot rather than claiming API availability", () => {
  assert.match(SERVICE_LEVEL_DEFINITIONS.sun.objective, /does not measure requests that failed before persistence/i);
  assert.doesNotMatch(SERVICE_LEVEL_DEFINITIONS.sun.name, /availability/i);
});

test("admin route is analytics-scoped, tenant-bound and emits only bounded structured log dimensions", () => {
  assert.match(routeSource, /checkAdminPermission\(req, "analytics:read"\)/);
  assert.match(routeSource, /rateClass: "observability_read"/);
  assert.match(routeSource, /getAdminTenantAccess\(req, requestedTenant\)/);
  assert.match(routeSource, /access\.tenantBound \? principal\.tenantId/);
  assert.match(routeSource, /scope: tenantSlug \? "tenant" : "global"/);
  assert.doesNotMatch(routeSource, /tenantSlug,\s*window/);
  assert.doesNotMatch(routeSource, /console\.(?:error|info)\([^\n]*error\.message/);
  assert.match(routeSource, /private, no-store, max-age=0/);
  assert.match(routeSource, /tenantWide: true/);
  assert.match(routeSource, /getCachedServiceLevelSnapshot/);
});

test("heavy aggregate endpoint has a dedicated distributed budget", () => {
  assert.equal(classifyFleetRateLimit("/admin/observability/service-levels", "GET"), "observability_read");
  const decision = buildFleetRateLimitDecision({
    method: "GET",
    pathname: "/admin/observability/service-levels",
    tenantId: "tenant-a",
    subjectId: "admin-session:session-a",
    clientIp: "203.0.113.12",
  });
  assert.equal(decision.rateClass, "observability_read");
  assert.equal(decision.limit, 12);
  assert.equal(decision.windowSeconds, 60);
});

test("aggregate snapshots coalesce per tenant/window, expire quickly and never cross tenant cache keys", { concurrency: false }, async () => {
  resetServiceLevelSnapshotCacheForTests();
  let queryCount = 0;
  const uninstall = installEphemeralE2eSqlExecutor(async () => {
    queryCount += 1;
    await Promise.resolve();
    return [{}];
  }, {
    NODE_ENV: "test",
    VERCEL_ENV: "test",
    NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE",
    NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:ephemeral@127.0.0.1:5432/nexid_e2e",
  });
  try {
    const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const clock = () => 1_000;
    const [first, coalesced] = await Promise.all([
      getCachedServiceLevelSnapshot({ tenantId: tenantA, window: "24h" }, { clock }),
      getCachedServiceLevelSnapshot({ tenantId: tenantA, window: "24h" }, { clock }),
    ]);
    assert.equal(queryCount, 6);
    assert.strictEqual(first, coalesced);

    const cached = await getCachedServiceLevelSnapshot({ tenantId: tenantA, window: "24h" }, { clock: () => 10_999 });
    assert.strictEqual(cached, first);
    assert.equal(queryCount, 6);

    const otherTenant = await getCachedServiceLevelSnapshot({ tenantId: tenantB, window: "24h" }, { clock });
    assert.notStrictEqual(otherTenant, first);
    assert.equal(queryCount, 12);

    const refreshed = await getCachedServiceLevelSnapshot({ tenantId: tenantA, window: "24h" }, { clock: () => 11_001 });
    assert.notStrictEqual(refreshed, first);
    assert.equal(queryCount, 18);
    assert.equal(SERVICE_LEVEL_SNAPSHOT_CACHE_TTL_MS, 10_000);
    assert.equal(SERVICE_LEVEL_SNAPSHOT_CACHE_MAX_ENTRIES, 128);
  } finally {
    resetServiceLevelSnapshotCacheForTests();
    uninstall();
  }
});

test("authoritative principal forces tenant scope while superadmin may select an aggregate", async () => {
  const tenantRequest = new Request("https://api.nexid.lat/admin/observability/service-levels?tenant=tenant-b", {
    headers: { authorization: "Bearer tenant-session" },
  });
  const tenantAuth = await checkAdmin(tenantRequest, undefined, async () => ({
    id: "session-tenant-a",
    userId: "11111111-1111-4111-8111-111111111111",
    email: "operator@example.test",
    label: "Operator",
    role: "tenant-admin",
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenantSlug: "tenant-a",
    permissions: ["analytics:read"],
    mfaVerified: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rotatedCookieValue: null,
    setupCompleted: true,
  }));
  assert.equal(tenantAuth, null);
  assert.deepEqual(getAdminTenantAccess(tenantRequest, "tenant-b"), {
    scope: "tenant_admin",
    tenantSlug: "tenant-a",
    forcedTenantSlug: "tenant-a",
    tenantBound: true,
    requestedTenantSlug: "tenant-b",
    effectiveTenantSlug: "tenant-a",
  });

  const superRequest = new Request("https://api.nexid.lat/admin/observability/service-levels?tenant=tenant-b", {
    headers: { authorization: "Bearer super-session" },
  });
  const superAuth = await checkAdmin(superRequest, undefined, async () => ({
    id: "session-super",
    userId: "22222222-2222-4222-8222-222222222222",
    email: "super@example.test",
    label: "Super",
    role: "super-admin",
    tenantId: null,
    tenantSlug: null,
    permissions: ["*"],
    mfaVerified: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rotatedCookieValue: null,
    setupCompleted: true,
  }));
  assert.equal(superAuth, null);
  assert.equal(getAdminTenantAccess(superRequest, "tenant-b").effectiveTenantSlug, "tenant-b");
  assert.equal(getAdminTenantAccess(superRequest, "tenant-b").tenantBound, false);
});
