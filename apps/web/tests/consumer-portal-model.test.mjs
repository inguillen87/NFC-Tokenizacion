import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

test("marketplace consumer UI no expone textos de demo ni mojibake", () => {
  const page = readFileSync(new URL("../src/app/me/marketplace/page.tsx", import.meta.url), "utf8");
  const grid = readFileSync(new URL("../src/app/me/marketplace/marketplace-grid-client.tsx", import.meta.url), "utf8");
  const visibleSurface = `${page}\n${grid}`;

  assert.match(visibleSurface, /Bodega Balmec/);
  assert.match(visibleSurface, /Request-to-buy . sin cobro/);
  assert.match(visibleSurface, /MercadoPago/);
  assert.match(visibleSurface, /MetaMask \/ USDC/);
  assert.doesNotMatch(visibleSurface, /Ã|Â|�|Demo Bodega|sandbox commerce|Lote Experimental/);
});

test("consumer experiences preserves an uncomputed trust score instead of fabricating zero", async () => {
  const { buildExperienceModel } = await import("../src/app/me/experiences/experience-model.ts");
  for (const status of [undefined, "not_computed", "unknown"]) {
    const result = buildExperienceModel({ ok: true, items: [], verifiedExperiences: [{ id: "test-review", trust_score: 0, trust_score_status: status }] });
    assert.equal(result.reviews.items[0].trust, null);
  }
});
