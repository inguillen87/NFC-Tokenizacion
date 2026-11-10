import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/admin/loyalty/programs/route.ts";
import { checkAdmin } from "../src/lib/auth.ts";
import { createAdminLoyaltyProgramOptionsGet } from "../src/lib/admin-loyalty-program-options.ts";

const TENANT = "bodega.ensayo";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const id = number => "bbbbbbbb-bbbb-4bbb-8bbb-" + String(number).padStart(12, "0");
const program = (index, status = "active", name = "Programa de ensayo") => ({
  tenant_slug: TENANT, id: id(index), name, status, extra: "fixture-internal",
});
const session = (patch = {}) => ({
  id: id(1), userId: id(2), email: "program-options@example.test", label: "Operador de ensayo",
  role: "marketing-manager", tenantId: TENANT_ID, tenantSlug: TENANT,
  permissions: ["rewards:read"], deniedPermissions: [], mfaVerified: true,
  expiresAt: new Date(Date.now() + 60_000).toISOString(), rotatedCookieValue: null, ...patch,
});

function harness(actor, rows = [program(3)]) {
  const queries = [];
  const read = createAdminLoyaltyProgramOptionsGet({
    checkAdmin: (request, scopes) => checkAdmin(request, scopes, async () => actor),
    query: async (strings, ...values) => {
      queries.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
      if (rows instanceof Error) throw rows;
      return rows;
    },
  });
  return { read, queries };
}

function request(query = "", method = "GET") {
  return new Request("https://api.nexid.test/admin/loyalty/programs" + query, {
    method,
    headers: { authorization: "Bearer synthetic-program-reader", "x-tenant-slug": "untrusted", "x-admin-role": "super-admin" },
  });
}

test("the published handler exposes GET and rejects non-GET reads", async () => {
  const unauthorized = await GET(new Request("https://api.nexid.test/admin/loyalty/programs"));
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers.get("cache-control"), /private, no-store/);
  const handler = harness(session());
  assert.equal((await handler.read(request("", "HEAD"))).status, 405);
  assert.equal((await handler.read(request("", "POST"))).status, 405);
  assert.equal(handler.queries.length, 0);
});

test("real IAM scope and permission decisions precede the business query", async () => {
  for (const [actor, status] of [
    [null, 401], [session({ permissions: [] }), 403],
    [session({ deniedPermissions: ["rewards:read"] }), 403],
    [session({ role: "operations-manager" }), 403],
    [session({ role: "reseller-admin" }), 403],
    [session({ role: "reseller" }), 403],
    [session({ tenantId: null, tenantSlug: null }), 403],
  ]) {
    const handler = harness(actor);
    const result = await handler.read(request("?tenant=" + TENANT));
    assert.equal(result.status, status, actor?.role);
    assert.match(result.headers.get("cache-control"), /private, no-store/);
    assert.deepEqual(handler.queries, []);
  }
});

test("company selection never broadens a scoped session or enables global reads", async () => {
  const operator = harness(session());
  for (const [query, status] of [
    ["?tenant=otra", 403], ["?tenant=" + TENANT + "&tenant=otra", 400],
    ["?tenant=" + TENANT + "&scope=global", 400], ["?tenant=", 400],
    ["?tenant=%2Fotra", 400], ["?tenant=Bodega.ensayo", 400], ["?tenant=bodega.", 400],
    ["?tenant=" + "a".repeat(129), 400],
  ]) assert.equal((await operator.read(request(query))).status, status, query);
  assert.deepEqual(operator.queries, []);

  const superAdmin = harness(session({ role: "super-admin", tenantId: null, tenantSlug: null }));
  assert.equal((await superAdmin.read(request())).status, 400);
  assert.equal((await superAdmin.read(request("?scope=global"))).status, 400);
  assert.deepEqual(superAdmin.queries, []);
  assert.equal((await superAdmin.read(request("?tenant=" + TENANT))).status, 200);
  assert.deepEqual(superAdmin.queries[0].values, [101, TENANT, null]);

  const long = "a".repeat(128);
  const longScope = harness(session({ tenantSlug: long }), [{ ...program(3), tenant_slug: long }]);
  assert.equal((await longScope.read(request("?tenant=" + long))).status, 200);
  assert.deepEqual(longScope.queries[0].values, [101, long, TENANT_ID]);
});

test("the business query binds company UUID and slug and has no dependency on benefits or SUN profiles", async () => {
  const handler = harness(session(), [program(3), program(4, "draft", "")]);
  const result = await handler.read(request());
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(await result.json(), { ok: true, version: "admin-loyalty-program-options.v1", tenant: TENANT,
    programs: [{ id: id(3), name: "Programa de ensayo", status: "active" }, { id: id(4), name: "", status: "draft" }],
    limit: 100, truncated: false });
  assert.equal(handler.queries.length, 1);
  const [read] = handler.queries;
  assert.deepEqual(read.values, [101, TENANT, TENANT_ID]);
  assert.match(read.text, /^SELECT .*FROM public\.tenants t LEFT JOIN LATERAL/);
  assert.match(read.text, /FROM public\.loyalty_programs WHERE tenant_id = t\.id/);
  assert.match(read.text, /WHERE t\.slug = \? AND t\.id = COALESCE\(\?::uuid, t\.id\)/);
  assert.doesNotMatch(read.text, /tenant_sun_profiles|\brewards\b|\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i);
});

test("empty, unavailable, invalid and truncated reads have distinct outcomes", async () => {
  const empty = harness(session(), [{ tenant_slug: TENANT, id: null, name: null, status: null }]);
  assert.deepEqual((await (await empty.read(request())).json()).programs, []);
  assert.equal((await harness(session(), []).read(request())).status, 404);
  for (const malformed of [
    [program(3, "unknown")], [program(3), program(3)], [{ ...program(3), tenant_slug: "otra" }],
    [{ ...program(3), name: null }], new Error("private diagnostic"),
  ]) {
    const failed = await harness(session(), malformed).read(request());
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), { ok: false, error: "program_options_unavailable" });
  }
  const bounded = harness(session(), Array.from({ length: 101 }, (_, index) => program(index)));
  const result = await (await bounded.read(request())).json();
  assert.equal(result.truncated, true);
  assert.equal(result.programs.length, 100);
});
