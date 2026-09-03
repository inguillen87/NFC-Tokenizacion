import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  resolveConsumerNetworkTenant,
  computeConsumerNetworkOverview,
  maskConsumerEmail,
  segmentConsumerNetworkMember,
} = await import("../src/lib/consumer-network-metrics.ts");

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
  assert.match(route, /COUNT\(DISTINCT NULLIF\(BTRIM\(e\.tag_id::text\), ''\)\)/);
  assert.match(route, /consumer_identities identity/);
  assert.match(route, /identity\.verified_at IS NOT NULL/);
  assert.match(route, /a\.source = 'public_passport'/);
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
  assert.doesNotMatch(taps, /consumer_display_name|JOIN consumers/);
  assert.match(products, /checkAdminWithPermission\(req, "crm:read"\)/);
  assert.match(members, /checkAdminWithPermission\(req, "consumers.read_pii"\)/);
});
