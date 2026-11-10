import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const routeSource = await readFile(new URL("../src/app/admin/loyalty/overview/route.ts", import.meta.url), "utf8");
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function fixture({ denial = null, sqlError = null, totals = { active_programs: 2, total_members: 7, points_issued: 120, points_redeemed: 34 }, forcedTenant = "tenant-bound", scopeError = null, overrideRows = false, resultRows } = {}) {
  const events = [], queries = [], requests = [];
  const dependencies = {
    "../../../../lib/auth": {
      checkAdminWithPermission: async (req, permission) => {
        events.push("auth:" + permission); requests.push(req);
        return denial ? Response.json({ ok: false }, { status: denial }) : null;
      },
      getAdminTenantAccess: (req, requested) => {
        events.push("tenant-scope"); requests.push(req);
        assert.equal(requested, new URL(req.url).searchParams.get("tenant"));
        if (scopeError) throw scopeError;
        return { effectiveTenantSlug: forcedTenant };
      },
    },
    "../../../../lib/db": { sql: async (strings, ...values) => {
      const text = strings.join("?"); queries.push({ text, values }); events.push("aggregate-read");
      assert.match(text, /WITH active_programs AS MATERIALIZED/);
      assert.doesNotMatch(text, /information_schema|to_regclass|\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|DO|CALL)\b/i, "direct overview performs no catalog, initialization or backfill statement");
      if (sqlError) throw sqlError;
      return overrideRows ? resultRows : [totals];
    } },
    "../../../../lib/http": { json: (body, status = 200, headers) => Response.json(body, { status, headers }) },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", compile(routeSource))(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Initializer or unexpected route dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return { route: module.exports, events, queries, requests, totals };
}
const request = () => new Request("https://example.test/admin/loyalty/overview?tenant=untrusted-caller");

for (const status of [401, 403]) test(`denied ${status} returns before scope or SQL`, async () => {
  const f = fixture({ denial: status }), req = request(), response = await f.route.GET(req);
  assert.equal(response.status, status); assert.deepEqual(f.events, ["auth:crm:read"]);
  assert.deepEqual(f.queries, []); assert.deepEqual(f.requests, [req]);
});

test("tenant-scope refusal propagates before the direct aggregate", async () => {
  const error = new Error("tenant_scope_invalid"), f = fixture({ scopeError: error });
  await assert.rejects(f.route.GET(request()), failure => failure === error);
  assert.deepEqual(f.events, ["auth:crm:read", "tenant-scope"]); assert.deepEqual(f.queries, []);
});

for (const forcedTenant of ["tenant-bound", ""]) test(`${forcedTenant || "authorized-global"} preserves the existing aggregate and exact four-field response`, async () => {
  const f = fixture({ forcedTenant }), req = request(), response = await f.route.GET(req);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), f.totals);
  assert.deepEqual(f.events, ["auth:crm:read", "tenant-scope", "aggregate-read"]);
  assert.ok(f.requests.every(value => value === req)); assert.equal(f.queries.length, 1);
  assert.deepEqual(f.queries[0].values, [forcedTenant, forcedTenant]);
  assert.ok(!f.queries[0].values.includes("untrusted-caller"));
  assert.match(f.queries[0].text, /WHERE program.status = 'active'/);
  assert.match(f.queries[0].text, /GROUP BY member.program_id/);
  assert.match(f.queries[0].text, /GROUP BY ledger.program_id/);
});

test("real zero values retain the existing success contract without an initializer", async () => {
  const totals = { active_programs: 0, total_members: 0, points_issued: 0, points_redeemed: 0 }, f = fixture({ totals });
  const response = await f.route.GET(request()); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), totals); assert.equal(f.queries.length, 1);
});

for (const [reason, error] of [
  ["missing-relation", Object.assign(new Error("private SQL detail"), { code: "42P01" })],
  ["missing-column", Object.assign(new Error("private column detail"), { code: "42703" })],
  ["missing-watermark", new Error("required_schema_migration_not_applied")],
  ["invalid-watermark-policy", new Error("required_schema_migration_id_invalid")],
]) test(`${reason} from the SQL boundary returns actionable sanitized503`, async () => {
  const f = fixture({ sqlError: error }), response = await f.route.GET(request()), body = await response.json();
  assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.error, "loyalty_overview_schema_unavailable"); assert.equal(body.retryable, false);
  assert.equal(body.message, "El resumen de fidelización necesita una revisión de NexID. Contactá a soporte."); assert.doesNotMatch(JSON.stringify(body), /private|42P01|42703|required_schema/);
  assert.deepEqual(f.events, ["auth:crm:read", "tenant-scope", "aggregate-read"]); assert.equal(f.queries.length, 1);
  for (const key of ["active_programs", "total_members", "points_issued", "points_redeemed"]) assert.equal(Object.hasOwn(body, key), false);
});

for (const [reason, error] of [
  ["connection", new Error("private connection detail")],
  ["unknown-sqlstate", { code: "53300", message: "private capacity detail" }],
  ["unstructured", "private transport detail"],
]) test(`${reason} SQL failure remains retryable503 without fabricated totals or raw details`, async () => {
  const f = fixture({ sqlError: error }), response = await f.route.GET(request()), body = await response.json();
  assert.equal(response.status, 503); assert.equal(body.error, "loyalty_overview_unavailable"); assert.equal(body.retryable, true);
  assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(body.message, "No pudimos cargar el resumen. Volvé a intentar; si continúa, contactá a soporte.");
  assert.doesNotMatch(JSON.stringify(body), /private|53300/); assert.equal(f.queries.length, 1);
  for (const key of ["active_programs", "total_members", "points_issued", "points_redeemed"]) assert.equal(Object.hasOwn(body, key), false);
});

test("repeated authorized reads select only one existing aggregate each and never a catalog or backfill", async () => {
  const f = fixture();
  assert.equal((await f.route.GET(request())).status, 200); assert.equal((await f.route.GET(request())).status, 200);
  assert.equal(f.queries.length, 2);
  assert.deepEqual(f.events, ["auth:crm:read", "tenant-scope", "aggregate-read", "auth:crm:read", "tenant-scope", "aggregate-read"]);
});

const metricKeys = ["active_programs", "total_members", "points_issued", "points_redeemed"];
const zeroRow = () => ({ active_programs: 0, total_members: 0, points_issued: 0, points_redeemed: 0 });
async function assertUnconfirmedRows(resultRows) {
  const f = fixture({ overrideRows: true, resultRows }), response = await f.route.GET(request()), body = await response.json();
  assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.error, "loyalty_overview_unavailable"); assert.equal(body.retryable, false);
  assert.equal(body.message, "El resumen de fidelización necesita una revisión de NexID. Contactá a soporte.");
  for (const key of metricKeys) assert.equal(Object.hasOwn(body, key), false, "unconfirmed result never turns into metric zero");
  assert.equal(f.queries.length, 1); return { response, body };
}

for (const [label, rows] of [
  ["undefined-result", undefined], ["null-result", null], ["object-result", {}],
  ["unexpected-driver-envelope", { rows: [zeroRow()] }], ["empty-result", []],
  ["multiple-rows", [zeroRow(), zeroRow()]], ["null-row", [null]],
  ["numeric-row", [0]], ["text-row", ["unknown"]], ["array-row", [[]]],
  ["inherited-metrics", [Object.create(zeroRow())]], ["extra-unknown-column", [{ ...zeroRow(), unexpected: 1 }]],
]) test(`${label} remains unconfirmed503 and never becomes four zeros`, async () => {
  await assertUnconfirmedRows(rows);
});

for (const key of metricKeys) test(`missing ${key} is not inferred from the other three metrics`, async () => {
  const row = zeroRow(); delete row[key]; await assertUnconfirmedRows([row]);
});

const invalidMetricValues = [
  ["undefined", undefined], ["null", null], ["NaN", NaN], ["infinity", Infinity],
  ["negative-infinity", -Infinity], ["negative", -1], ["fraction", 0.5],
  ["text-zero", "0"], ["text-integer", "12"], ["boolean", true], ["bigint", 0n],
  ["int4-overflow", 2_147_483_648], ["beyond-int4-safe-integer", Number.MAX_SAFE_INTEGER],
  ["unsafe-integer", 2 ** 53],
];
for (const key of metricKeys) for (const [label, value] of invalidMetricValues) test(`${key}/${label} is rejected without coercion or fabricated zero`, async () => {
  await assertUnconfirmedRows([{ ...zeroRow(), [key]: value }]);
});

test("one confirmed int4 boundary row preserves exactly the four numeric fields", async () => {
  const row = { active_programs: 2_147_483_647, total_members: 2_147_483_647, points_issued: 2_147_483_647, points_redeemed: 2_147_483_647 };
  const f = fixture({ overrideRows: true, resultRows: [row] }), response = await f.route.GET(request()), body = await response.json();
  assert.equal(response.status, 200); assert.deepEqual(body, row);
  assert.deepEqual(Object.keys(body), metricKeys); assert.equal(f.queries.length, 1);
});

test("one explicit four-field zero row is confirmed200 while an empty result is503", async () => {
  const zero = zeroRow(), f = fixture({ overrideRows: true, resultRows: [zero] });
  const response = await f.route.GET(request()), body = await response.json();
  assert.equal(response.status, 200); assert.deepEqual(body, zero); assert.deepEqual(Object.keys(body), metricKeys);
  assert.ok(metricKeys.every(key => typeof body[key] === "number" && body[key] === 0));
  await assertUnconfirmedRows([]);
});
