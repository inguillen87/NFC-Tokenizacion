import test from "node:test";
import assert from "node:assert/strict";

const {
  resolveConsumerNetworkTenant,
  computeConsumerNetworkOverview,
  maskConsumerEmail,
} = await import("../src/lib/consumer-network-metrics.ts");

test("tenant admin forced scope overrides requested tenant (tenant A cannot query tenant B)", () => {
  assert.equal(resolveConsumerNetworkTenant({ forcedTenantSlug: "tenant-a", requestedTenantSlug: "tenant-b" }), "tenant-a");
});

test("superadmin can filter by requested tenant when no forced scope", () => {
  assert.equal(resolveConsumerNetworkTenant({ forcedTenantSlug: "", requestedTenantSlug: "tenant-b" }), "tenant-b");
});

test("overview metrics are derived only from persisted aggregate inputs", () => {
  const overview = computeConsumerNetworkOverview({
    anonymousTappers: 80,
    registeredConsumers: 20,
    tenantMembers: 10,
    savedProducts: 12,
    riskBlockedClaims: 4,
  });
  assert.equal(overview.anonymousTappers, 80);
  assert.equal(overview.registeredConsumers, 20);
  assert.equal(overview.tenantMembers, 10);
  assert.equal(overview.savedProducts, 12);
  assert.equal(overview.riskBlockedClaims, 4);
  assert.equal(overview.tapToRegistrationRate, 20);
  assert.equal(overview.registrationToMembershipRate, 50);
});

test("maskConsumerEmail avoids raw email leakage", () => {
  assert.equal(maskConsumerEmail("user@example.com"), "us**@example.com");
  assert.equal(maskConsumerEmail(""), "");
});
