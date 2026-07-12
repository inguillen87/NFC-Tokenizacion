import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEMO_BATCH_BID,
  DEMO_TENANT_SLUG,
  classifyReservedDemoBatch,
  inspectReservedDemoBatch,
  requireReservedDemoBatch,
  validateDemoResourceScopeRequest,
} from "../src/lib/demo-resource-scope.ts";

function request(tenantSlug = "") {
  return new Request("https://api.test/internal/demo/test", {
    headers: tenantSlug ? { "x-nexid-tenant-slug": tenantSlug } : undefined,
  });
}

test("demo scope accepts only the reserved BID and tenant", () => {
  assert.deepEqual(validateDemoResourceScopeRequest(request(), {}), {
    ok: true,
    bid: DEMO_BATCH_BID,
    tenantSlug: DEMO_TENANT_SLUG,
  });
  assert.deepEqual(validateDemoResourceScopeRequest(request("DemoBodega"), {
    bid: DEMO_BATCH_BID,
    forceBid: DEMO_BATCH_BID,
    tenantSlug: "demobodega",
  }), {
    ok: true,
    bid: DEMO_BATCH_BID,
    tenantSlug: DEMO_TENANT_SLUG,
  });
});

test("demo scope rejects foreign BID aliases", () => {
  for (const body of [
    { bid: "TENANT-PROD-001" },
    { forceBid: "TENANT-PROD-001" },
    { batchBid: "TENANT-PROD-001" },
    { batch_id: "TENANT-PROD-001" },
    { bid: DEMO_BATCH_BID, forceBid: "TENANT-PROD-001" },
    { products: [{ bid: "TENANT-PROD-001" }] },
  ]) {
    assert.deepEqual(validateDemoResourceScopeRequest(request(), body), {
      ok: false,
      reason: "demo_bid_not_reserved",
      status: 403,
    });
  }
});

test("demo scope rejects foreign tenant body aliases and scoped headers", () => {
  for (const body of [
    { tenant: "customer-a" },
    { tenantSlug: "customer-a" },
    { tenant_slug: "customer-a" },
    { tenantId: "11111111-1111-4111-8111-111111111111" },
    { tenant_id: "11111111-1111-4111-8111-111111111111" },
    { products: [{ tenant_slug: "customer-a" }] },
  ]) {
    assert.deepEqual(validateDemoResourceScopeRequest(request(), body), {
      ok: false,
      reason: "demo_tenant_not_reserved",
      status: 403,
    });
  }

  assert.deepEqual(validateDemoResourceScopeRequest(request("customer-a"), { bid: DEMO_BATCH_BID }), {
    ok: false,
    reason: "demo_tenant_not_reserved",
    status: 403,
  });
});

test("reserved batch classification fails closed on missing or foreign ownership", () => {
  assert.deepEqual(classifyReservedDemoBatch(null), { ok: true, batch: null });
  assert.deepEqual(classifyReservedDemoBatch(null, true), {
    ok: false,
    reason: "demo_batch_not_found",
    status: 404,
  });
  assert.deepEqual(classifyReservedDemoBatch({
    id: "batch-1",
    tenant_id: "tenant-1",
    tenant_slug: "customer-a",
  }), {
    ok: false,
    reason: "demo_batch_tenant_conflict",
    status: 409,
  });
  assert.deepEqual(classifyReservedDemoBatch({
    id: "batch-1",
    tenant_id: "tenant-1",
    tenant_slug: DEMO_TENANT_SLUG,
  }), {
    ok: true,
    batch: {
      id: "batch-1",
      tenantId: "tenant-1",
      tenantSlug: DEMO_TENANT_SLUG,
    },
  });
});

test("batch lookup always queries the reserved BID and validates tenant ownership", async () => {
  const calls = [];
  const demoQuery = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return [{ id: "batch-1", tenant_id: "tenant-1", tenant_slug: DEMO_TENANT_SLUG }];
  };
  const result = await inspectReservedDemoBatch(demoQuery);

  assert.equal(result.ok, true);
  assert.deepEqual(calls[0].values, [DEMO_BATCH_BID]);
  assert.match(calls[0].text, /LEFT JOIN tenants/);

  const foreign = await requireReservedDemoBatch(async () => [{
    id: "batch-2",
    tenant_id: "tenant-2",
    tenant_slug: "customer-a",
  }]);
  assert.deepEqual(foreign, {
    ok: false,
    reason: "demo_batch_tenant_conflict",
    status: 409,
  });
});

test("all owned demo routes enforce the shared scope before mutation", async () => {
  const routePaths = [
    "../src/app/internal/demo/seed/route.ts",
    "../src/app/internal/demo/upload-manifest/route.ts",
    "../src/app/internal/demo/upload-products/route.ts",
    "../src/app/internal/demo/scan/route.ts",
    "../src/app/internal/demo/generate-live-scans/route.ts",
    "../src/app/internal/demo/use-pack/route.ts",
  ];
  const sources = await Promise.all(routePaths.map((path) => readFile(new URL(path, import.meta.url), "utf8")));

  for (const source of sources) {
    assert.match(source, /validateDemoResourceScopeRequest\(req, /);
    assert.match(source, /demo-resource-scope/);
  }

  const [seed, manifest, products, scan, generate, usePack] = sources;
  assert.ok(seed.indexOf("await inspectReservedDemoBatch()") < seed.indexOf("const result = await seedDemoPack"));
  assert.match(seed, /forceBid: DEMO_BATCH_BID/);
  assert.doesNotMatch(seed, /forceBid:\s*String\(body\./);
  assert.match(seed, /bid: DEMO_BATCH_BID/);

  for (const source of [manifest, products, scan, generate]) {
    assert.match(source, /await requireReservedDemoBatch\(\)/);
  }
  assert.ok(manifest.indexOf("const rowScope = validateDemoResourceScopeRequest(req, row)") < manifest.indexOf("let inserted = 0"));
  assert.doesNotMatch(manifest, /SELECT id FROM batches WHERE bid=\$\{bid\}/);
  assert.doesNotMatch(products, /SELECT id FROM batches WHERE bid=\$\{bid\}/);
  assert.match(scan, /WHERE b\.id = \$\{batchScope\.batch\.id\}/);
  assert.match(scan, /AND b\.tenant_id = \$\{batchScope\.batch\.tenantId\}/);
  assert.doesNotMatch(scan, /WHERE b\.bid = \$\{body\.bid\}/);
  assert.match(generate, /bid: DEMO_BATCH_BID/);
  assert.ok(usePack.indexOf("await inspectReservedDemoBatch()") < usePack.indexOf("const result = await seedDemoPack"));
  assert.match(usePack, /forceBid: DEMO_BATCH_BID/);
  assert.match(usePack, /await requireReservedDemoBatch\(\)/);
  assert.doesNotMatch(usePack, /forceBid:\s*String\(body\./);
});
