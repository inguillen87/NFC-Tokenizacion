import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  aggregateTenantMetrics,
  classifyEventInteraction,
  classifyEventRiskBucket,
  isEventSecurityRisk,
  isRecognizedProductIdentityEvent,
  isVerifiedAuthenticationEvent,
  normalizeEventVerdict,
  normalizeTenantTapRealtimeEvent,
} from "../../../packages/core/src/event-contract.ts";

test("registered public identity stays neutral even with a legacy NOT_REGISTERED result", () => {
  const input = {
    eventType: "PROVENANCE_VIEWED",
    result: "NOT_REGISTERED",
    verdict: "identified_unverified",
    batchId: "batch-1",
  };
  assert.equal(normalizeEventVerdict(input), "identified_unverified");
  assert.equal(classifyEventRiskBucket(input), "identified_unverified");
  assert.equal(isEventSecurityRisk(input), false);
  assert.equal(isRecognizedProductIdentityEvent(input), true);
  assert.equal(isVerifiedAuthenticationEvent(input), false);
  assert.equal(classifyEventInteraction(input), "product_identity_recognized");
});

test("product recognition is independent from security verdict and authentication stays strict", () => {
  const replay = {
    eventType: "REPLAY_SUSPECT",
    result: "REPLAY_SUSPECT",
    verdict: "replay_suspect",
    batch_id: "batch-1",
    tag_id: "tag-1",
    cmac_ok: false,
    allowlisted: true,
  };
  assert.equal(isRecognizedProductIdentityEvent(replay), true);
  assert.equal(isVerifiedAuthenticationEvent(replay), false);
  assert.equal(classifyEventInteraction(replay), "security_signal");

  const merelyValid = { eventType: "TAP_VALID", result: "VALID", verdict: "valid", batchId: "batch-1" };
  assert.equal(isVerifiedAuthenticationEvent(merelyValid), false);

  const authenticated = { ...merelyValid, cmacOk: true, allowlisted: true };
  assert.equal(isVerifiedAuthenticationEvent(authenticated), true);
  assert.equal(isRecognizedProductIdentityEvent(authenticated), true);
  assert.equal(classifyEventInteraction(authenticated), "authentication_verified");
});

test("realtime normalizer preserves wire identity, actor count and channel consent without exposing a person id", () => {
  const snake = normalizeTenantTapRealtimeEvent({
    id: 41,
    tenant_id: "tenant-1",
    tenant_slug: "tenant-a",
    batch_id: "batch-1",
    tag_id: "tag-1",
    product_name: "Producto A",
    event_type: "PROVENANCE_VIEWED",
    result: "QR_SCAN",
    verdict: "identified_unverified",
    known_actor_count: 2,
    known_actor: true,
    commercial_consent_granted: true,
    commercial_consent_channels: ["whatsapp", "email"],
  });
  assert.equal(snake.tenantId, "tenant-1");
  assert.equal(snake.batchId, "batch-1");
  assert.equal(snake.tagId, "tag-1");
  assert.equal(snake.productName, "Producto A");
  assert.equal(snake.productIdentityRecognized, true);
  assert.equal(snake.authenticationVerified, false);
  assert.equal(snake.knownActorCount, 2);
  assert.equal(snake.knownActor, true);
  assert.deepEqual(snake.commercialConsentChannels, ["whatsapp", "email"]);
  assert.equal(snake.commercialConsentGranted, true);
  assert.equal("consumerId" in snake, false);

  const camel = normalizeTenantTapRealtimeEvent({
    id: 42,
    tenantId: "tenant-2",
    tenantSlug: "tenant-b",
    batchId: "batch-2",
    tagId: "tag-2",
    productName: "Producto B",
    eventType: "PROVENANCE_VIEWED",
    result: "QR_SCAN",
    verdict: "identified_unverified",
    knownActorCount: 1,
    knownActor: true,
    commercialConsentGranted: true,
    commercialConsentChannels: ["phone"],
  });
  assert.equal(camel.tenantId, "tenant-2");
  assert.equal(camel.batchId, "batch-2");
  assert.equal(camel.tagId, "tag-2");
  assert.equal(camel.productName, "Producto B");
  assert.equal(camel.commercialConsentGranted, true);

  const noChannel = normalizeTenantTapRealtimeEvent({
    batchId: "batch-3",
    verdict: "identified_unverified",
    knownActor: true,
    knownActorCount: 1,
    commercialConsentGranted: true,
    commercialConsentChannels: [],
  });
  assert.equal(noChannel.commercialConsentGranted, false);

  const unboundLocator = normalizeTenantTapRealtimeEvent({
    id: "evt-unbound",
    bid: "UNREGISTERED-LOCATOR",
    result: "NOT_REGISTERED",
    verdict: "not_registered",
  });
  assert.equal(unboundLocator.batchId, null);
  assert.equal(unboundLocator.productIdentityRecognized, false);

  const unboundNeutralClaim = normalizeTenantTapRealtimeEvent({
    id: "evt-unbound-neutral",
    event_type: "PROVENANCE_VIEWED",
    result: "IDENTIFIED_UNVERIFIED",
    verdict: "identified_unverified",
  });
  assert.equal(unboundNeutralClaim.productIdentityRecognized, false);
  assert.equal(unboundNeutralClaim.interactionClass, "lifecycle_activity");
});

test("tenant aggregate separates activity, product recognition and verified authentication", () => {
  const aggregate = aggregateTenantMetrics({
    events: [
      { batch_id: "batch-1", event_type: "PROVENANCE_VIEWED", verdict: "identified_unverified" },
      { batch_id: "batch-1", tag_id: "tag-1", event_type: "REPLAY_SUSPECT", verdict: "replay_suspect" },
      { batch_id: "batch-1", tag_id: "tag-1", event_type: "TAP_VALID", result: "VALID", verdict: "valid", cmac_ok: true, allowlisted: true },
    ],
  });
  assert.equal(aggregate.activityTotal, 3);
  assert.equal(aggregate.recognizedProductIdentity, 3);
  assert.equal(aggregate.verifiedAuthentication, 1);
});

test("migration, projections and tenant joins enforce the neutral durable contract", async () => {
  const [migration, overview, analytics, stream, eventsRoute, sunService, preflight, dryRun, migrationSafety] = await Promise.all([
    readFile(new URL("../db/migrations/20260903130000_0101_identified_unverified_event_taxonomy.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/overview/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/analytics/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/events/stream/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/db-enterprise-release-preflight.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/db-enterprise-release-dry-run.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../../scripts/check-migration-safety.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /CREATE OR REPLACE FUNCTION nexid_write_canonical_event_v1/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS sun_scan_attempts/);
  assert.match(migration, /'identified_unverified'/);
  assert.match(migration, /public_carrier_unit_profile_reconciliation_required/);
  assert.match(migration, /trg_public_carrier_tag_profile_consistency/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);

  for (const source of [overview, analytics]) {
    assert.ok(source.indexOf("identified_unverified") < source.indexOf("NOT_REGISTERED"));
    assert.match(source, /authentication_verified/);
    assert.match(source, /product_recognized/);
  }
  assert.doesNotMatch(analytics, /ALTER TABLE|CREATE TABLE IF NOT EXISTS/);
  assert.doesNotMatch(sunService, /CREATE TABLE IF NOT EXISTS sun_scan_attempts/);

  for (const source of [stream, eventsRoute]) {
    assert.match(source, /b\.tenant_id = e\.tenant_id/);
    assert.match(source, /known_actor_count/);
    assert.match(source, /commercial_consent_channels/);
    assert.match(source, /e\.event_type/);
    assert.match(source, /e\.cmac_ok/);
    assert.match(source, /e\.allowlisted/);
    assert.doesNotMatch(source, /ALTER TABLE events ADD COLUMN/);
  }
  assert.match(stream, /if \(!normalized\.tenantId \|\| !normalized\.tenantSlug \|\| !normalized\.batchId\) return;/);
  assert.ok(
    stream.indexOf("!normalized.tenantId || !normalized.tenantSlug || !normalized.batchId")
      < stream.indexOf("rememberEvent(normalized)"),
  );
  assert.match(eventsRoute, /if \(eventSource === "" && !tenant\)/);
  assert.match(eventsRoute, /verdict: String\(row\.verdict \|\| ""\)/);
  assert.match(eventsRoute, /riskLevel: String\(row\.risk_level \|\| ""\)/);
  assert.match(eventsRoute, /'unassigned'::text AS tenant_slug/);
  assert.doesNotMatch(eventsRoute, /a\.bid ILIKE 'DEMO-%'/);

  for (const registry of [preflight, dryRun, migrationSafety]) {
    assert.match(registry, /20260903130000_0101_identified_unverified_event_taxonomy\.sql/);
  }
  assert.match(preflight, /has_identified_unverified_canonical_verdict/);
  assert.match(preflight, /tgfoid = to_regprocedure\('public\.nexid_enforce_public_carrier_unit_consistency_v1\(\)'\)/);
  assert.match(preflight, /tgdeferrable/);
  assert.match(preflight, /tginitdeferred/);
  assert.match(dryRun, /canonical_event_writer_identified_unverified/);
  assert.match(migrationSafety, /identifiedUnverifiedTaxonomyIsDurable/);
});
