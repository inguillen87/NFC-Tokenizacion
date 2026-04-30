import test from "node:test";
import assert from "node:assert/strict";

const { resolveMarketplaceTenant, ownershipTone, shouldRedirectToConsumerAuth } = await import("../src/app/me/_components/consumer-portal-model.ts");

test("marketplace usa tenant de query cuando existe", () => {
  const tenant = resolveMarketplaceTenant({
    tenantFromQuery: "tenant-query",
    products: [{ tenant_slug: "tenant-a", ownership_record_status: "claimed" }],
  });
  assert.equal(tenant, "tenant-query");
});

test("marketplace prioriza tenant de producto claimed", () => {
  const tenant = resolveMarketplaceTenant({
    products: [
      { tenant_slug: "tenant-b", ownership_record_status: "viewed" },
      { tenant_slug: "tenant-a", ownership_record_status: "claimed" },
    ],
  });
  assert.equal(tenant, "tenant-a");
});

test("ownershipTone clasifica estados críticos y claim", () => {
  assert.equal(ownershipTone("claimed"), "success");
  assert.equal(ownershipTone("revoked"), "danger");
  assert.equal(ownershipTone("blocked_replay"), "danger");
  assert.equal(ownershipTone("viewed"), "neutral");
});

test("unauthenticated session debe redirigir a consumer auth", () => {
  assert.equal(shouldRedirectToConsumerAuth(null), true);
  assert.equal(shouldRedirectToConsumerAuth({ ok: false, authenticated: false }), true);
  assert.equal(shouldRedirectToConsumerAuth({ ok: true, authenticated: false }), true);
  assert.equal(shouldRedirectToConsumerAuth({ ok: true, authenticated: true }), false);
});
