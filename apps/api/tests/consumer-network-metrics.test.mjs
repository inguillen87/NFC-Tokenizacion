import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  resolveConsumerNetworkTenant,
  computeConsumerNetworkOverview,
  maskConsumerEmail,
  segmentConsumerNetworkMember,
} = await import("../src/lib/consumer-network-metrics.ts");
const {
  buildConsumerNetworkProvenance,
  classifyConsumerNetworkEvent,
  readConsumerNetworkAggregateCount,
} = await import("../src/lib/consumer-network-provenance.ts");

test("tenant admin forced scope overrides requested tenant (tenant A cannot query tenant B)", () => {
  assert.equal(resolveConsumerNetworkTenant({ forcedTenantSlug: "tenant-a", requestedTenantSlug: "tenant-b" }), "tenant-a");
});

test("superadmin can filter by requested tenant when no forced scope", () => {
  assert.equal(resolveConsumerNetworkTenant({ forcedTenantSlug: "", requestedTenantSlug: "tenant-b" }), "tenant-b");
});

test("overview metrics are derived only from persisted aggregate inputs", () => {
  const overview = computeConsumerNetworkOverview({
    totalTaps: 80,
    customerActions: 20,
    tapsWithKnownActor: 15,
    actionsWithKnownActor: 5,
    recognizedUnits: 12,
    knownActors: 10,
    verifiedIdentityActors: 7,
    activeTenantMembers: 8,
    consentedEmailActors: 6,
    consentedWhatsappActors: 4,
    consentedPhoneActors: 2,
    savedProducts: 12,
    riskBlockedClaims: 4,
  });
  assert.equal(overview.totalActivity, 100);
  assert.equal(overview.totalTaps, 80);
  assert.equal(overview.customerActions, 20);
  assert.equal(overview.activityWithKnownActor, 20);
  assert.equal(overview.activityWithoutActor, 80);
  assert.equal(overview.actorLinkedActivityRate, 20);
  assert.equal(overview.recognizedUnits, 12);
  assert.equal(overview.knownActors, 10);
  assert.equal(overview.verifiedIdentityActors, 7);
  assert.equal(overview.activeTenantMembers, 8);
  assert.deepEqual(overview.consentedActorsByChannel, { email: 6, whatsapp: 4, phone: 2 });
  assert.equal(overview.savedProducts, 12);
  assert.equal(overview.riskBlockedClaims, 4);
  assert.equal("anonymousTappers" in overview, false);
  assert.equal("tapToRegistrationRate" in overview, false);
  assert.equal("registrationToMembershipRate" in overview, false);
});

test("actor-linked activity never exceeds total activity", () => {
  const overview = computeConsumerNetworkOverview({
    totalTaps: 2,
    customerActions: 1,
    tapsWithKnownActor: 99,
    actionsWithKnownActor: 99,
    recognizedUnits: 1,
    knownActors: 1,
    verifiedIdentityActors: 1,
    activeTenantMembers: 1,
    consentedEmailActors: 0,
    consentedWhatsappActors: 0,
    consentedPhoneActors: 0,
    savedProducts: 0,
    riskBlockedClaims: 0,
  });
  assert.equal(overview.activityWithKnownActor, 3);
  assert.equal(overview.activityWithoutActor, 0);
  assert.equal(overview.actorLinkedActivityRate, 100);
});

test("consumer event provenance fails closed for historical real defaults", () => {
  assert.equal(classifyConsumerNetworkEvent({
    source: "real",
    eventType: "TAP_VALID",
    meta: {},
    hasExactTenantAssetBinding: true,
  }), "legacy_unclassified");

  assert.equal(classifyConsumerNetworkEvent({
    source: "real",
    eventType: "TAP_VALID",
    meta: { replay_execution_class: "operational" },
    hasExactTenantAssetBinding: true,
  }), "operational_tap");

  assert.equal(classifyConsumerNetworkEvent({
    source: "real",
    eventType: "TAP_VALID",
    meta: { replay_execution_class: "operational" },
    hasExactTenantAssetBinding: false,
  }), "legacy_unclassified");
});

test("explicit demo evidence wins without inferring demo from tenant or BID", () => {
  assert.equal(classifyConsumerNetworkEvent({
    source: "demo",
    eventType: "TAP_VALID",
    meta: {},
    hasExactTenantAssetBinding: true,
  }), "declared_demo");
  assert.equal(classifyConsumerNetworkEvent({
    source: "real",
    eventType: "TAP_VALID",
    meta: { demoEmitter: true, corpus: "demobodega-flagship" },
    hasExactTenantAssetBinding: true,
  }), "declared_demo");
  assert.equal(classifyConsumerNetworkEvent({
    source: "real",
    eventType: "TAP_VALID",
    meta: { canonical_event: true, event_family: "tap", event_mode: "live", metric_scope: "scan", simulated: false },
    hasExactTenantAssetBinding: true,
    hasCanonicalOperation: true,
  }), "operational_tap");
  assert.equal(classifyConsumerNetworkEvent({
    source: "real",
    eventType: "TAP_VALID",
    meta: { canonical_event: true, event_family: "tap", event_mode: "live", metric_scope: "scan", simulated: false },
    hasExactTenantAssetBinding: true,
    hasCanonicalOperation: false,
  }), "legacy_unclassified");
  assert.equal(classifyConsumerNetworkEvent({
    source: "real",
    eventType: "OWNERSHIP_ACTIVATED",
    meta: { replay_execution_class: "operational" },
    hasExactTenantAssetBinding: true,
  }), "legacy_unclassified");
  assert.equal(classifyConsumerNetworkEvent({
    source: "real",
    eventType: "TAP_VALID",
    meta: { replay_execution_class: "operational", simulated: true },
    hasExactTenantAssetBinding: true,
  }), "declared_demo");
});

test("provenance envelope exposes isolated demo and legacy without a physical-presence claim", () => {
  const provenance = buildConsumerNetworkProvenance({
    counts: { operationalTap: 16, declaredDemo: 300, imported: 2, legacyUnclassified: 4, mixed: 1 },
    latestOperationalAt: "2026-09-03T20:00:00-03:00",
    observedAt: new Date("2026-09-03T23:05:00Z"),
  });
  assert.equal(provenance.state, "partial_legacy_unclassified");
  assert.equal(provenance.primaryScope, "operational_tap");
  assert.equal(provenance.physicalPresenceClaim, "not_asserted");
  assert.equal(provenance.latestOperationalAt, "2026-09-03T23:00:00.000Z");
  assert.equal(provenance.hasIsolatedRecords, true);
});

test("provenance aggregate aliases and operational freshness fail closed", () => {
  for (const value of [null, undefined, "", " ", true, false, [], {}]) {
    assert.throws(
      () => readConsumerNetworkAggregateCount(value, "total_taps"),
      /consumer_network_provenance_invalid:total_taps/,
    );
  }
  assert.equal(readConsumerNetworkAggregateCount("12", "total_taps"), 12);
  assert.throws(() => buildConsumerNetworkProvenance({
    counts: { operationalTap: 1, declaredDemo: 0, imported: 0, legacyUnclassified: 0, mixed: 0 },
    latestOperationalAt: null,
  }), /latest_operational_at_consistency/);
  assert.throws(() => buildConsumerNetworkProvenance({
    counts: { operationalTap: 0, declaredDemo: 0, imported: 0, legacyUnclassified: 0, mixed: 0 },
    latestOperationalAt: "2026-09-03T23:00:00Z",
  }), /latest_operational_at_consistency/);
  assert.throws(() => buildConsumerNetworkProvenance({
    counts: { operationalTap: 1, declaredDemo: 0, imported: 0, legacyUnclassified: 0, mixed: 0 },
    latestOperationalAt: "2026-09-03T23:06:00Z",
    observedAt: new Date("2026-09-03T23:05:00Z"),
  }), /latest_operational_at_future/);
  assert.throws(() => buildConsumerNetworkProvenance({
    counts: { operationalTap: 0, declaredDemo: 0, imported: 0, legacyUnclassified: 0, mixed: 0 },
    latestOperationalAt: null,
    observedAt: new Date("invalid"),
  }), /observed_at/);
});

test("mixed classified records stay isolated without being relabeled as legacy", () => {
  const provenance = buildConsumerNetworkProvenance({
    counts: { operationalTap: 0, declaredDemo: 0, imported: 0, legacyUnclassified: 0, mixed: 1 },
    latestOperationalAt: null,
    observedAt: new Date("2026-09-03T23:05:00Z"),
  });
  assert.equal(provenance.state, "classified");
  assert.equal(provenance.hasIsolatedRecords, true);
});

test("maskConsumerEmail avoids raw email leakage", () => {
  assert.equal(maskConsumerEmail("user@example.com"), "us**@example.com");
  assert.equal(maskConsumerEmail(""), "");
});

test("registered unverified activity stays warm and never becomes trust-recovery risk", async () => {
  const members = await readFile(new URL("../src/app/admin/consumer-network/members/route.ts", import.meta.url), "utf8");
  const neutralHistoryProjection = {
    tap_count: 1,
    valid_taps: 0,
    risk_taps: 0,
    lifetime_points: 0,
    whatsapp_opt_in: false,
  };

  assert.equal(segmentConsumerNetworkMember(neutralHistoryProjection), "post_tap_warm");
  assert.doesNotMatch(members, /verdict, ''\)\) NOT IN \('', 'VALID'/);
  assert.match(members, /'REPLAY_SUSPECT', 'BLOCKED_REPLAY', 'DUPLICATE'/);
  assert.match(members, /risk_level, ''\)\) IN \('medium', 'high', 'critical'\)/);
  assert.doesNotMatch(members, /IDENTIFIED_UNVERIFIED[\s\S]{0,100}risk_taps/);
});

test("consumer overview counts activity and units without treating UID as a person", async () => {
  const route = await readFile(new URL("../src/app/admin/consumer-network/overview/route.ts", import.meta.url), "utf8");
  assert.match(route, /checkAdminWithPermission\(req, "crm:read"\)/);
  assert.match(route, /GROUP BY e\.tenant_id, e\.tag_id/);
  assert.match(route, /consumer_identities identity/);
  assert.match(route, /identity\.verified_at IS NOT NULL/);
  assert.match(route, /a\.source = 'public_passport'/);
  assert.match(route, /e\.data_provenance = 'operational_tap'/);
  assert.match(route, /provenance_declared_demo/);
  assert.match(route, /provenance_legacy_unclassified/);
  assert.match(route, /withConsumerNetworkEventProvenance\(sql, \{ event: "e", batch: "provenance_batch", tag: "provenance_tag" \}\)/);
  assert.match(route, /await read\/\*sql\*\//);
  assert.match(route, /\/\* consumer-network-event-provenance \*\/ AS data_provenance/);
  const { consumerNetworkEventProvenanceSql } = await import("../src/lib/consumer-network-provenance.ts");
  const expression = consumerNetworkEventProvenanceSql({ event: "e", batch: "provenance_batch", tag: "provenance_tag" });
  assert.match(expression, /meta->>'replay_execution_class'/);
  assert.match(expression, /canonical_event_operations canonical_operation/);
  assert.match(expression, /canonical_operation\.event_created_at = e\.created_at/);
  assert.match(route, /provenance_tag\.id::text = e\.tag_id::text/);
  assert.match(route, /WHERE e\.event_type::text IN \('TAP_VALID', 'TAP_INVALID', 'REPLAY_SUSPECT'\)/);
  assert.match(route, /actor_provenance/);
  assert.match(route, /product_provenance/);
  assert.match(route, /product_event_references/);
  assert.match(route, /JOIN consumer_tap_history history[\s\S]*?linked_event\.tag_id/);
  assert.match(route, /unit_provenance/);
  assert.match(route, /FROM unit_provenance unit[\s\S]*?unit\.data_provenance = 'operational_tap'/);
  assert.match(route, /FROM product_provenance provenance[\s\S]*?WHERE provenance\.data_provenance = 'operational_tap'/);
  assert.match(route, /FROM actor_provenance[\s\S]*?WHERE data_provenance = 'operational_tap'/);
  assert.match(route, /lower\(c\.scope\) = 'whatsapp_marketing'/);
  assert.doesNotMatch(route, /COUNT\(DISTINCT e\.uid_hex\)/);
  assert.doesNotMatch(route, /actor_ref|latest_member_activity|display_name/);
  assert.doesNotMatch(route, /anonymous_tappers|registered_consumers/);
});

test("activity feed omits names while member data keeps its explicit PII permission", async () => {
  const [taps, products, members] = await Promise.all([
    readFile(new URL("../src/app/admin/consumer-network/taps/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/consumer-network/products/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/consumer-network/members/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(taps, /checkAdminWithPermission\(req, "crm:read"\)/);
  assert.match(taps, /data_provenance/);
  assert.match(taps, /withConsumerNetworkEventProvenance\(sql, \{ event: "e", batch: "provenance_batch", tag: "provenance_tag" \}\)/);
  assert.match(taps, /await read\/\*sql\*\//);
  assert.match(taps, /\/\* consumer-network-event-provenance \*\/ AS data_provenance/);
  for (const route of [members, products]) {
    assert.match(route, /withConsumerNetworkEventProvenance\(sql, \{ event: "e", batch: "provenance_batch", tag: "provenance_tag" \}\)/);
    assert.match(route, /await read\/\*sql\*\//);
    assert.match(route, /\/\* consumer-network-event-provenance \*\/ AS data_provenance/);
    assert.match(route, /provenance_batch\.tenant_id = e\.tenant_id/);
    assert.match(route, /provenance_tag\.id::text = e\.tag_id::text/);
    assert.match(route, /provenance_tag\.batch_id = e\.batch_id/);
    assert.match(route, /UPPER\(provenance_tag\.uid_hex\) = UPPER\(e\.uid_hex\)/);
    assert.match(route, /WHEN COUNT\(\*\) = 1 THEN MIN\(data_provenance\)/);
  }
  assert.match(taps, /legacy_unclassified/);
  assert.doesNotMatch(taps, /consumer_display_name|JOIN consumers/);
  assert.match(products, /checkAdminWithPermission\(req, "crm:read"\)/);
  assert.match(products, /product_provenance/);
  assert.match(products, /product_event_references/);
  assert.match(products, /JOIN consumer_tap_history history/);
  assert.match(products, /data_provenance/);
  assert.match(products, /VALUES \(cp\.first_tap_event_id\), \(cp\.latest_tap_event_id\)/);
  assert.match(products, /MAX\(provenance\.latest_operational_at\)/);
  assert.match(members, /checkAdminWithPermission\(req, "consumers.read_pii"\)/);
  assert.match(members, /membership_source/);
  assert.match(members, /'demo_login'/);
  assert.match(members, /member_provenance/);
  assert.match(members, /product_event_references/);
  assert.match(members, /JOIN consumer_tap_history history/);
  assert.match(members, /MAX\(mp\.latest_operational_at\)/);
  assert.match(taps, /MAX\(provenance_event_created_at\)/);
  assert.doesNotMatch(products, /MAX\(latest_activity_at\).*AS latest_operational_at/);
  assert.doesNotMatch(members, /MAX\(mb\.last_activity_at\).*AS latest_operational_at/);
  assert.doesNotMatch(taps, /MAX\(created_at\).*AS latest_operational_at/);
  assert.doesNotMatch([taps, products, members].join("\n"), /tenant_slug\s*=\s*'demobodega'|bid\s+LIKE\s+'DEMO/i);
});
