import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/consumer/experiences/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const CONSUMER = "11111111-1111-4111-8111-111111111111";
const TENANT = "22222222-2222-4222-8222-222222222222";
const FOREIGN_TENANT = "44444444-4444-4444-8444-444444444444";
const OWNERSHIP = "55555555-5555-4555-8555-555555555555";
const EXPERIENCE = "33333333-3333-4333-8333-333333333333";
const published = () => ({ tenantId: TENANT, version: "nexid.tenant-actions.v1", status: "published", allowedActions: ["feedback"] });

function fixture(options = {}) {
  let profile = Object.hasOwn(options, "profile") ? options.profile : published();
  const calls = [], writes = [];
  let schemaCalls = 0;
  const evidence = options.evidence === null ? null : { ownership_id: options.update ? OWNERSHIP : null, tenant_id: TENANT, event_id: "17", uid_hex: "04A1A2A3A4A5A6", status: options.update ? "claimed" : null, verdict: "VALID_CLOSED", risk_level: "low", tenant_slug: "fixture-brand", product_name: "Fixture product", evidence_type: options.update ? "ownership" : "tap", ...options.evidence };
  const sql = async (parts, ...values) => {
    const query = parts.join("?").replace(/\s+/g, " ").trim();
    calls.push({ query, values });
    if (query.includes("FROM rewards r")) {
      assert.match(query, /m\.tenant_id = r\.tenant_id AND m\.consumer_id = \?/);
      assert.match(query, /JOIN loyalty_programs p ON p\.id = r\.program_id AND p\.tenant_id = r\.tenant_id/);
      assert.match(query, /m\.status = 'active' AND p\.status = 'active'/);
      assert.match(query, /p\.start_at IS NULL OR p\.start_at <= now\(\)/);
      assert.match(query, /p\.end_at IS NULL OR p\.end_at > now\(\)/);
      assert.match(query, /r\.starts_at IS NULL OR r\.starts_at <= now\(\)/);
      assert.match(query, /r\.ends_at IS NULL OR r\.ends_at > now\(\)/);
      assert.match(query, /r\.stock_remaining IS NULL OR r\.stock_remaining > 0/);
      assert.match(query, /NOT EXISTS \( SELECT 1 FROM consumer_reward_claims claim WHERE claim\.reward_id = r\.id AND claim\.tenant_id = r\.tenant_id AND claim\.consumer_id = \?::uuid \)/);
      assert.match(query, /LIMIT 100$/); assert.deepEqual(values, [CONSUMER, CONSUMER]);
      // Explicit synthetic adapter. SQL semantics still require PostgreSQL QA;
      // these assertions guard the real handler query and authenticated scope.
      return options.offers || [];
    }
    if (query.includes("FROM consumer_product_experiences e")) { assert.deepEqual(values, [CONSUMER]); return options.reviews || []; }
    if (/FROM consumer_tap_history|FROM consumer_product_ownerships o/.test(query)) {
      assert(values.includes(CONSUMER), "evidence lookup uses the authenticated consumer");
      assert.match(query, options.update ? /LEFT JOIN events e ON e\.id = o\.event_id AND e\.tenant_id = o\.tenant_id/ : /JOIN events e ON e\.id = h\.tap_event_id AND e\.tenant_id = h\.tenant_id/);
      assert.match(query, /LIMIT 2$/);
      if (options.beforeWrite) profile = options.beforeWrite(profile);
      if (options.eventCandidates) {
        const own = options.eventCandidates.filter(event => event.tenantId === TENANT && event.eventId === "17");
        return own.map(event => ({ ...evidence, product_name: event.productName }));
      }
      return evidence ? [evidence] : [];
    }
    if (query.startsWith("SELECT id FROM consumer_product_experiences")) return options.update ? [{ id: EXPERIENCE }] : [];
    if (/INSERT INTO consumer_product_experiences|UPDATE consumer_product_experiences/.test(query)) {
      assert.match(query, /^WITH permitted_profile AS MATERIALIZED/);
      assert.match(query, /tenant_id = \?::uuid/);
      assert.match(query, /postTap,version.*nexid\.tenant-actions\.v1/);
      assert.match(query, /postTap,status.*published/);
      assert.match(query, /jsonb_typeof\(metadata #> '\{postTap,allowedActions\}'\) = 'array'/);
      assert.match(query, /allowedActions.*<@ '\["lead","feedback","sommelier","marketplace"\]'::jsonb/);
      assert.match(query, /allowedActions.*\? 'feedback'/);
      assert.match(query, /FOR SHARE/);
      assert.match(query, /WHERE.*EXISTS \(SELECT 1 FROM permitted_profile\)/);
      assert.equal(values[0], TENANT, "authority comes from persisted evidence, never a caller tenant");
      if (options.update) {
        assert.match(query, /WHERE id = \? AND consumer_id = \? AND tenant_id = \?::uuid/);
        assert(values.includes(EXPERIENCE));
      }
      if (!profile || profile.tenantId !== TENANT || profile.version !== "nexid.tenant-actions.v1" || profile.status !== "published" || !Array.isArray(profile.allowedActions) || profile.allowedActions.some(action => !["lead", "feedback", "sommelier", "marketplace"].includes(action)) || !profile.allowedActions.includes("feedback")) return [];
      writes.push({ query, values });
      return [{ id: EXPERIENCE, tenant_id: TENANT, consumer_id: CONSUMER, event_id: "17", photo_urls_json: [], verification_badges_json: [] }];
    }
    throw new Error("unexpected_fixture_query");
  };
  class RequestBodyTooLargeError extends Error {}
  const dependencies = {
    "consumer-auth": { getConsumerFromRequest: async () => options.unauthenticated ? null : { id: CONSUMER } },
    "commercial-runtime-schema": { ensureConsumerPortalSchema: async () => { schemaCalls++; } },
    db: { sql }, http: { json: (body, status = 200, headers) => Response.json(body, { status, headers }) },
    "critical-rate-limit": { enforceCriticalRateLimit: async () => null },
    "bounded-request-body": { RequestBodyTooLargeError, readBoundedJsonBody: req => req.json() },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", "process", compiled)(name => {
    const dependency = name.split("/").at(-1);
    assert(Object.hasOwn(dependencies, dependency));
    return dependencies[dependency];
  }, module, module.exports, () => { throw new Error("network_forbidden"); }, { env: {} });
  return { calls, writes, get schemaCalls() { return schemaCalls; }, get: async () => {
    const response = await module.exports.GET(new Request("https://fixture.nexid.test/consumer/experiences"));
    return { status: response.status, headers: response.headers, body: await response.json() };
  }, post: async (extra = {}) => {
    const response = await module.exports.POST(new Request("https://fixture.nexid.test/consumer/experiences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: "17", rating: 4, body: "A meaningful fixture comment.", ...(options.update ? { ownershipId: OWNERSHIP } : {}), ...extra }) }));
    return { status: response.status, headers: response.headers, body: await response.json() };
  } };
}

test("published brand feedback permits own comment inserts and updates", async () => {
  for (const update of [false, true]) {
    const f = fixture({ update }), response = await f.post();
    assert.equal(response.status, 200); assert.equal(response.body.ok, true); assert.equal(f.writes.length, 1);
    assert.equal(response.body.item.trust_score, null);
    assert.equal(response.body.item.evidence_completeness.physical_product_authenticity_confirmed, false);
  }
});

test("paused, disabled, draft, unknown-version, malformed and other-tenant settings deny inserts and updates", async () => {
  const profiles = [null, { ...published(), status: "paused" }, { ...published(), status: "draft" }, { ...published(), allowedActions: [] }, { ...published(), version: "unknown" }, { ...published(), allowedActions: { feedback: true } }, { ...published(), allowedActions: ["feedback", "invented"] }, { ...published(), allowedActions: ["feedback", null] }, { ...published(), tenantId: FOREIGN_TENANT }];
  for (const update of [false, true]) for (const profile of profiles) {
    const f = fixture({ update, profile }), response = await f.post();
    assert.equal(response.status, 403); assert.equal(response.body.error, "customer_action_unpublished"); assert.equal(f.writes.length, 0);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
});

test("permission removed after evidence is loaded is checked by the final locked writer", async () => {
  for (const update of [false, true]) {
    const f = fixture({ update, beforeWrite: profile => ({ ...profile, status: "paused" }) }), response = await f.post();
    assert.equal(response.status, 403); assert.equal(f.writes.length, 0);
    assert(f.calls.some(({ query }) => query.includes("FOR SHARE")));
  }
  // Synthetic dependency scheduling verifies handler behavior and writer shape;
  // it is not a live PostgreSQL concurrency test.
});

test("caller tenant/consumer overrides cannot borrow another brand's feedback permission", async () => {
  const f = fixture({ profile: { ...published(), tenantId: FOREIGN_TENANT } });
  const response = await f.post({ tenantId: FOREIGN_TENANT, consumerId: FOREIGN_TENANT, tenant: "foreign-brand" });
  assert.equal(response.status, 403); assert.equal(f.writes.length, 0);
  assert(f.calls.every(({ values }) => !values.includes(FOREIGN_TENANT)));
});

test("missing own evidence and unauthenticated requests never reach the feedback writer", async () => {
  for (const options of [{ evidence: null }, { unauthenticated: true }]) {
    const f = fixture(options), response = await f.post();
    assert.equal(response.status, options.unauthenticated ? 401 : 404); assert.equal(f.writes.length, 0);
    assert(!f.calls.some(({ query }) => query.includes("permitted_profile")));
  }
});

test("historical open-seal feedback stays separate from commercial eligibility", async () => {
  for (const verdict of ["OPENED", "OPENED_PREVIOUSLY"]) {
    const f = fixture({ evidence: { verdict, risk_level: "low" } }), response = await f.post();
    assert.equal(response.status, 200); assert.equal(f.writes.length, 1);
    assert.equal(response.body.item.evidence_completeness.physical_product_authenticity_confirmed, false);
  }
  const f = fixture({ evidence: { verdict: "REPLAY", risk_level: "high" } }), response = await f.post();
  assert.equal(response.status, 403); assert.equal(response.body.error, "review_blocked_by_risk_policy"); assert.equal(f.writes.length, 0);
});

test("partitioned event identities are tenant-bound and duplicate own candidates cannot supply arbitrary feedback evidence", async () => {
  for (const update of [false, true]) {
    const own = { tenantId: TENANT, eventId: "17", productName: "Own fixture product" };
    const foreign = { tenantId: FOREIGN_TENANT, eventId: "17", productName: "Foreign fixture product" };
    const valid = fixture({ update, eventCandidates: [foreign, own] }), response = await valid.post();
    assert.equal(response.status, 200); assert.equal(valid.writes.length, 1);
    assert(!valid.writes[0].values.includes(foreign.productName));
    const ambiguous = fixture({ update, eventCandidates: [own, { ...own, productName: "Duplicate own event" }] });
    const denied = await ambiguous.post();
    assert.equal(denied.status, 404); assert.equal(denied.body.error, "verified_evidence_not_found"); assert.equal(ambiguous.writes.length, 0);
  }
});

test("unsafe, zero, noncanonical and out-of-range caller event IDs reach no evidence query", async () => {
  for (const eventId of ["0", "01", "9223372036854775808", "1/2", -1, 9007199254740992]) {
    const f = fixture(), response = await f.post({ eventId });
    assert.equal(response.status, 400); assert.equal(response.body.error, "verified_evidence_required"); assert.equal(f.calls.length, 0);
  }
});

test("private experience GET authenticates before schema or reads and only queries current unused own-brand proposals", async () => {
  const denied = fixture({ unauthenticated: true }), unauthorized = await denied.get();
  assert.equal(unauthorized.status, 401); assert.equal(denied.schemaCalls, 0); assert.equal(denied.calls.length, 0);
  assert.match(unauthorized.headers.get("cache-control"), /private, no-store/);
  const f = fixture({ offers: [{ id: EXPERIENCE, title: "Current proposal", tenant_slug: "fixture-brand" }], reviews: [{ id: EXPERIENCE, trust_score: 100 }] });
  const response = await f.get();
  assert.equal(response.status, 200); assert.equal(f.schemaCalls, 1); assert.equal(f.calls.length, 2); assert.equal(f.writes.length, 0);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.deepEqual(response.body.items, [{ id: EXPERIENCE, title: "Current proposal", tenant_slug: "fixture-brand" }]);
  assert.equal(response.body.verifiedExperiences[0].trust_score, null);
});
