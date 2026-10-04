import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const { json } = await import("../src/lib/http.ts");
const marketplacePolicy = await import("../src/lib/marketplace-policy.ts");

const publicRoute = await readFile(new URL("../src/app/marketplace/offers/route.ts", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../src/app/admin/consumer-network/offers/route.ts", import.meta.url), "utf8");
const dashboardPage = await readFile(new URL("../../dashboard/src/app/(app)/consumer-network/offers/page.tsx", import.meta.url), "utf8");

test("anonymous marketplace catalog returns only explicit public-network offers", () => {
  assert.match(publicRoute, /enforceCriticalRateLimit/);
  assert.match(publicRoute, /o\.visibility = 'nexid_network'/);
  assert.match(publicRoute, /visibility: "nexid_network"/);
  assert.match(publicRoute, /cache-control/);
  assert.doesNotMatch(publicRoute, /SELECT\s+o\.\*/);
  assert.doesNotMatch(publicRoute, /eligibility_json/);
});

test("private offer inventory uses the authenticated tenant-scoped admin route", () => {
  assert.ok(adminRoute.indexOf("checkAdmin(req)") < adminRoute.indexOf("ensureConsumerPortalSchema()"));
  assert.match(adminRoute, /getAdminTenantScope\(req\)/);
  assert.match(adminRoute, /resolveConsumerNetworkTenant\(\{ forcedTenantSlug, requestedTenantSlug \}\)/);
  assert.match(adminRoute, /WHERE \(\$\{tenant\} = '' OR t\.slug = \$\{tenant\}\)/);
  assert.match(adminRoute, /LIMIT 100/);

  assert.match(dashboardPage, /createAdminPageContext\(session, query\.tenant\)/);
  assert.match(dashboardPage, /fetchAdminPage\(context, "consumer-network\/offers"\)/);
  assert.doesNotMatch(dashboardPage, /\/marketplace\/offers/);
  assert.doesNotMatch(dashboardPage, /<button[^>]*>[\s\S]{0,80}\+ Crear oferta/);
});

// Execute the production handlers with synthetic auth, rate and persistence
// adapters. Unexpected dependencies fail; no host environment or network is used.
async function routeHarness(path, options = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  const calls = { auth: 0, rate: [], body: 0, schema: 0, queries: [], capability: 0, settlement: 0 };
  const forbidden = (key) => () => { calls[key]++; throw new Error(`unexpected_${key}`); };
  const modules = {
    http: { json },
    "consumer-auth": { getConsumerFromRequest: async () => { calls.auth++; return options.consumer === undefined ? { id: "synthetic-consumer" } : options.consumer; } },
    "critical-rate-limit": { enforceCriticalRateLimit: async (_req, context) => { calls.rate.push(context); return options.limited || null; } },
    db: { sql: async (strings, ...values) => {
      const statement = strings.join("?").replace(/\s+/g, " ").trim();
      calls.queries.push({ statement, values });
      if (!options.query) throw new Error("unexpected_database_call");
      return options.query(statement, values);
    } },
    "sun-fresh-handoff": { consumeSunFreshHandoff: forbidden("capability") },
    "tokenization-engine": { transferBlockchainToken: forbidden("settlement") },
    "bounded-request-body": {
      RequestBodyTooLargeError: class extends Error {},
      readBoundedJsonBody: async (req, limit) => { calls.body++; assert.equal(limit, 24 * 1024); return req.json(); },
    },
    "commercial-runtime-schema": { ensureConsumerPortalSchema: async () => { calls.schema++; } },
    "commercial-asset-scope": {
      requireCommercialAssetScopeSchema: async () => { calls.schema++; },
      isCommercialAssetScopeSchemaError: () => false,
    },
    "consumer-demo-policy": { canUseConsumerDemoBypass: () => false },
    "marketplace-policy": marketplacePolicy,
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "fetch", compiled)(
    (name) => {
      const key = name.split("/").at(-1);
      assert.ok(name.includes("/lib/") && Object.hasOwn(modules, key), `Unexpected dependency ${name}`);
      return modules[key];
    }, module, module.exports, { env: {} }, () => { throw new Error("real_network_forbidden"); },
  );
  return { api: module.exports, calls };
}

function unreadableRequest(body = "{malformed") {
  const req = new Request("https://fixture.invalid/marketplace/p2p/list", { method: "POST", body });
  for (const method of ["json", "text", "arrayBuffer", "formData"]) {
    req[method] = () => { throw new Error("request_body_must_remain_unread"); };
  }
  return req;
}

function assertNoUnitSideEffects(h, req) {
  assert.equal(h.calls.body, 0);
  assert.equal(h.calls.schema, 0);
  assert.equal(h.calls.queries.length, 0);
  assert.equal(h.calls.capability, 0);
  assert.equal(h.calls.settlement, 0);
  assert.equal(req.bodyUsed, false);
  assert.equal(req.body.locked, false);
}

test("closed P2P listing rejects valid, malformed and oversized bodies without reading or consuming them", async () => {
  for (const body of [JSON.stringify({ uidHex: "04ABCDEF012345", eventId: "99001", ctr: 19, fresh_token: "synthetic-unused-capability", price: 100 }), "{malformed", "x".repeat(1024 * 1024)]) {
    const h = await routeHarness("../src/app/marketplace/p2p/list/route.ts");
    const req = unreadableRequest(body);
    const response = await h.api.POST(req);
    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(payload.error, "p2p_listing_unavailable");
    assert.equal(payload.state, "feature_disabled");
    for (const key of ["retryable", "listing_created", "sellable", "fresh_tap_consumed", "nft_transfer_executed"]) assert.equal(payload[key], false);
    assert.equal(payload.chain_transfer_status, "not_executed");
    assert.equal(payload.custody_unchanged, true);
    assert.equal(h.calls.auth, 1);
    assert.deepEqual(h.calls.rate, [{ rateClass: "public_write", tenantId: "marketplace", subjectId: "p2p-list:synthetic-consumer", globalPrincipal: true }]);
    assertNoUnitSideEffects(h, req);
  }
});

test("closed P2P listing preserves authentication and rate-limit refusal", async () => {
  const anonymous = await routeHarness("../src/app/marketplace/p2p/list/route.ts", { consumer: null });
  const anonymousReq = unreadableRequest();
  const unauthorized = await anonymous.api.POST(anonymousReq);
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), { ok: false, error: "unauthorized" });
  assert.equal(anonymous.calls.rate.length, 0);
  assertNoUnitSideEffects(anonymous, anonymousReq);
  for (const status of [429, 503]) {
    const limited = json({ ok: false, error: "synthetic_rate_refusal" }, status);
    const h = await routeHarness("../src/app/marketplace/p2p/list/route.ts", { limited });
    const req = unreadableRequest();
    assert.equal(await h.api.POST(req), limited);
    assert.equal(h.calls.auth, 1);
    assert.equal(h.calls.rate.length, 1);
    assertNoUnitSideEffects(h, req);
  }
});

test("P2P purchase remains unavailable with no body read, capability, offer write or settlement", async () => {
  const h = await routeHarness("../src/app/marketplace/p2p/buy/route.ts");
  const req = unreadableRequest();
  const response = await h.api.POST(req);
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.error, "p2p_settlement_unavailable");
  assert.equal(payload.chain_transfer_status, "not_executed");
  assert.equal(payload.nft_transfer_executed, false);
  assert.equal(payload.custody_unchanged, true);
  assert.equal(h.calls.rate[0].rateClass, "proof_write");
  assertNoUnitSideEffects(h, req);
});

test("public offer SQL excludes all unit resale while preserving active tenant-scoped network catalog offers", async () => {
  const fixtures = [
    { id: "catalog-benefit", type: "benefit", status: "active", visibility: "nexid_network", tenant_slug: "fixture-brand" },
    { id: "legacy-resale-closed", type: "p2p_resale", status: "active", visibility: "nexid_network", tenant_slug: "fixture-brand" },
    { id: "legacy-resale-opened", type: "p2p_resale", status: "active", visibility: "nexid_network", tenant_slug: "fixture-brand" },
    { id: "private-benefit", type: "benefit", status: "active", visibility: "private", tenant_slug: "fixture-brand" },
    { id: "inactive-benefit", type: "benefit", status: "inactive", visibility: "nexid_network", tenant_slug: "fixture-brand" },
    { id: "foreign-benefit", type: "benefit", status: "active", visibility: "nexid_network", tenant_slug: "foreign-brand" },
  ];
  const h = await routeHarness("../src/app/marketplace/offers/route.ts", { query(statement, values) {
    // Check the real SQL before evaluating synthetic fixtures: removing or
    // widening the exclusion must fail rather than being hidden by the adapter.
    assert.match(statement, /WHERE o\.status = 'active' AND o\.visibility = 'nexid_network'/);
    assert.match(statement, /AND o\.starts_at <= now\(\) AND \(o\.ends_at IS NULL OR o\.ends_at >= now\(\)\)/);
    assert.match(statement, /AND \(\? = '' OR t\.slug = \?\) AND o\.type <> 'p2p_resale' ORDER BY o\.updated_at DESC$/);
    assert.doesNotMatch(statement, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE)\b/i);
    assert.deepEqual(values, ["fixture-brand", "fixture-brand"]);
    return fixtures.filter(row => row.type !== "p2p_resale" && row.status === "active" && row.visibility === "nexid_network" && row.tenant_slug === values[0]);
  } });
  const response = await h.api.GET(new Request("https://fixture.invalid/marketplace/offers?tenant=FIXTURE-BRAND"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  const payload = await response.json();
  assert.equal(payload.p2p_resale_available, false);
  assert.deepEqual(payload.items.map(row => row.id), ["catalog-benefit"]);
  assert.equal(h.calls.queries.length, 1);
  assert.equal(h.calls.auth, 0);
  assert.equal(h.calls.capability + h.calls.settlement, 0);
});

test("public offer rate refusal returns before schema or catalog access", async () => {
  const limited = json({ ok: false, error: "synthetic_rate_refusal" }, 429);
  const h = await routeHarness("../src/app/marketplace/offers/route.ts", { limited });
  assert.equal(await h.api.GET(new Request("https://fixture.invalid/marketplace/offers")), limited);
  assert.equal(h.calls.schema + h.calls.queries.length + h.calls.capability + h.calls.settlement, 0);
});

test("an opened-product consumer may inquire about catalog stock without buying or reserving that scanned unit", async () => {
  for (const verdict of ["VALID_OPENED", "VALID_OPENED_PREVIOUSLY"]) {
    const source = { event_id: "99001", event_created_at: "2026-10-01T12:00:00Z", tag_id: "synthetic-tag", uid_hex: "04ABCDEF012345", batch_id: "synthetic-batch", bid: "SYNTHETIC-BATCH", verdict };
    const h = await routeHarness("../src/app/marketplace/products/[id]/request-to-buy/route.ts", { query(statement) {
      assert.doesNotMatch(statement, /marketplace_offers|points_ledger|UPDATE consumer_product_ownerships|UPDATE tags|UPDATE marketplace_products/i);
      if (statement.includes("FROM marketplace_products p")) return [{ id: "synthetic-catalog-product", tenant_id: "synthetic-tenant", status: "active", title: "Synthetic stock", request_to_buy_enabled: true, age_gate_required: false, brand_status: "active", visible_in_network: true }];
      if (statement.includes("AS active_membership")) return [{ active_membership: true, claimed_ownership: false, latest_verified_tap_event_id: source.event_id }];
      if (statement.includes("FROM events e")) return [source];
      assert.match(statement, /WITH created_request AS \( INSERT INTO marketplace_order_requests/);
      assert.match(statement, /INSERT INTO order_requests/);
      return [{ id: "synthetic-inquiry", was_created: true, source_tap_event_id: source.event_id, source_tap_event_created_at: source.event_created_at, source_tag_id: source.tag_id, source_uid_hex: source.uid_hex, source_batch_id: source.batch_id, source_bid: source.bid }];
    } });
    const response = await h.api.POST(new Request("https://fixture.invalid/marketplace/products/synthetic-catalog-product/request-to-buy", { method: "POST", body: JSON.stringify({ quantity: 2 }) }), { params: Promise.resolve({ id: "synthetic-catalog-product" }) });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.checkout, "request_only");
    assert.equal(payload.request_scope, "catalog_inquiry");
    for (const key of ["fulfills_scanned_unit", "purchase_executed", "stock_reserved"]) assert.equal(payload[key], false);
    assert.equal(payload.source.attribution_mode, "attribution_only");
    assert.equal(payload.loyalty.pointsAwarded, 0);
    assert.equal(h.calls.queries.length, 4);
    assert.equal(h.calls.capability + h.calls.settlement, 0);
  }
});
