import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const TENANT = "10000000-0000-4000-8000-000000000001";
const PROGRAM = "20000000-0000-4000-8000-000000000001";
const OTHER_PROGRAM = "20000000-0000-4000-8000-000000000002";
const REWARD = "30000000-0000-4000-8000-000000000001";
const files = { policy: "../src/lib/admin-reward-policy.ts", service: "../src/lib/admin-reward-service.ts", readModel: "../src/lib/admin-reward-read-model.ts", route: "../src/app/admin/loyalty/rewards/route.ts" };
for (const [name, relative] of Object.entries({ handler: "../src/lib/admin-reward-request.ts", createRoute: "../src/app/admin/loyalty/rewards/create/route.ts" })) {
  if (existsSync(new URL(relative, import.meta.url))) files[name] = relative;
}
const compiled = Object.fromEntries(Object.entries(files).map(([name, path]) => [name,
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
]));
function load(code, require) { const module = { exports: {} }; new Function("require", "module", "exports", code)(require, module, module.exports); return module.exports; }

function harness({ candidates = [{ id: REWARD, program_id: PROGRAM }], programs = [{ id: PROGRAM }], update = [{ id: REWARD }], current = [], insert = null, forcedTenantSlug = "tenant-a", authStatus = 0, permissionStatus = 0 } = {}) {
  const queries = []; const events = []; const requests = [];
  const execute = async (strings, ...values) => {
    events.push("sql");
    const query = strings.join("?").replace(/\s+/g, " ").trim(); queries.push({ query, values });
    if (query.startsWith("SELECT id FROM tenants")) return [{ id: TENANT }];
    if (query.startsWith("SELECT r.id")) return [{ id: REWARD, program_id: PROGRAM, requires_age_gate: true, network_visible: false, stock_total: 10, stock_remaining: 3 }];
    if (query.startsWith("SELECT reward.id")) return candidates;
    if (query.startsWith("SELECT id FROM loyalty_programs")) return programs;
    if (query.startsWith("SELECT stock_total")) return current;
    if (query.startsWith("UPDATE rewards")) return update;
    if (query.startsWith("INSERT INTO rewards")) return insert ?? [{ id: REWARD, program_id: programs[0]?.id }];
    throw new Error(`Unexpected statement ${query}`);
  };
  const policy = load(compiled.policy, () => { throw new Error("unexpected policy dependency"); });
  const service = load(compiled.service, name => name === "./db" ? { sql: execute } : name === "./admin-reward-policy" ? policy : null);
  const readModel = load(compiled.readModel, () => { throw new Error("unexpected read model dependency"); });
  let handler;
  const resolve = name => {
    if (name.endsWith("/auth")) return {
      checkAdmin: async req => { events.push("auth"); requests.push(req); return authStatus ? Response.json({ ok: false }, { status: authStatus }) : null; },
      checkAdminPermission: (req, permission) => { events.push(permission); requests.push(req); return permissionStatus ? Response.json({ ok: false }, { status: permissionStatus }) : null; },
      getAdminTenantScope: req => { events.push("scope"); requests.push(req); return { scope: forcedTenantSlug ? "tenant" : "super_admin", forcedTenantSlug }; },
    };
    if (name.endsWith("/db")) return { sql: execute };
    if (name.endsWith("/http")) return { json: (body, status = 200, headers) => Response.json(body, { status, headers }) };
    if (name.endsWith("/admin-tenant-filter")) return { effectiveTenantFilter: ({ forcedTenantSlug, requestedTenantSlug }) => forcedTenantSlug || String(requestedTenantSlug || "").trim().toLowerCase() };
    if (name.endsWith("/admin-reward-policy")) return { ...policy, parseAdminRewardCommand: raw => { events.push("parse"); return policy.parseAdminRewardCommand(raw); } };
    if (name.endsWith("/admin-reward-service")) return service;
    if (name.endsWith("/admin-reward-read-model")) return readModel;
    if (name.endsWith("/admin-reward-request")) { assert.ok(handler, "shared handler must exist"); return handler; }
    throw new Error(`Unexpected dependency ${name}`);
  };
  if (compiled.handler) handler = load(compiled.handler, resolve);
  const route = load(compiled.route, resolve);
  const createRoute = compiled.createRoute ? load(compiled.createRoute, resolve) : null;
  return { policy, service, route, createRoute, queries, execute, events, requests };
}
const body = overrides => ({ tenant_slug: "tenant-a", code: "VISIT", title: "Visita actualizada", ...overrides });
const post = (h, raw) => h.route.POST(new Request("https://example.test/admin/loyalty/rewards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(raw) }));

test("tenant and explicit global reads return saved age/network flags and stable reward/program identity", async () => {
  for (const global of [false, true]) {
    const h = harness({ forcedTenantSlug: global ? "" : "tenant-a" });
    const response = await h.route.GET(new Request(`https://example.test/admin/loyalty/rewards${global ? "?scope=global" : "?tenant=other-tenant"}`));
    assert.equal(response.status, 200);
    const reward = (await response.json()).rewards[0];
    assert.equal(reward.requires_age_gate, true); assert.equal(reward.network_visible, false);
    assert.equal(reward.id, REWARD); assert.equal(reward.program_id, PROGRAM);
    assert.match(h.queries[0].query, /r\.id, r\.program_id, t\.slug AS tenant_slug/);
    assert.match(h.queries[0].query, /r\.requires_age_gate, r\.network_visible/);
    if (!global) assert.deepEqual(h.queries[0].values, ["tenant-a"]);
  }
});

for (const [field, invalid] of [["points_cost", -1], ["points_cost", 1.5], ["points_cost", "50x"], ["points_cost", 2_147_483_648], ["stock_total", -1], ["stock_total", null], ["stock_remaining", -1], ["stock_remaining", 11], ["status", "published"], ["requires_age_gate", "false"], ["network_visible", 1]]) {
  test(`invalid ${field}=${String(invalid)} cannot query or bootstrap any program`, async () => {
    const h = harness(); const response = await post(h, body({ stock_total: 10, [field]: invalid }));
    assert.equal(response.status, 400); assert.equal(h.queries.length, 0);
  });
}
test("NaN and Infinity are rejected by the policy, with integer zero and multiline descriptions preserved", () => {
  const h = harness();
  for (const value of [NaN, Infinity, -Infinity]) assert.throws(() => h.policy.parseAdminRewardCommand(body({ stock_total: value })), /invalid_stock_total/);
  assert.equal(h.policy.parseAdminRewardCommand(body({ points_cost: 0, stock_total: 0, stock_remaining: 0, description: "Primera línea\nSegunda línea" })).stockTotal, 0);
});
test("an exact edit remains bound to its saved paused program and ignores legacy remaining stock", async () => {
  const h = harness();
  const response = await post(h, body({ tenant_slug: "other-tenant", reward_id: REWARD, program_id: PROGRAM, stock_total: 10, stock_remaining: 10, requires_age_gate: true, network_visible: false }));
  assert.equal(response.status, 200);
  assert.deepEqual(h.queries[0].values, ["tenant-a"]);
  const lookup = h.queries[1]; assert.deepEqual(lookup.values, [TENANT, REWARD, PROGRAM, "VISIT"]);
  const mutation = h.queries[2];
  assert.match(mutation.query, /stock_remaining = CASE WHEN \?::integer IS NULL THEN reward\.stock_remaining ELSE reward\.stock_remaining \+ \(\?::integer - reward\.stock_total\) END/);
  assert.match(mutation.query, /reward\.program_id = \?::uuid/);
  assert.ok(mutation.values.includes(PROGRAM)); assert.ok(mutation.values.includes(false));
  assert.ok(h.queries.every(q => !/UPDATE loyalty_programs|INSERT INTO loyalty_programs|status = 'active'/.test(q.query)));
  assert.doesNotMatch(mutation.query, /stock_remaining = EXCLUDED/);
});
test("omitted flags and unchanged stock leave persisted policy/counters untouched", async () => {
  const h = harness(); const response = await post(h, body({ reward_id: REWARD, program_id: PROGRAM }));
  assert.equal(response.status, 200);
  const mutation = h.queries.find(q => q.query.startsWith("UPDATE"));
  assert.match(mutation.query, /requires_age_gate = COALESCE\(\?::boolean, reward\.requires_age_gate\)/);
  assert.match(mutation.query, /network_visible = COALESCE\(\?::boolean, reward\.network_visible\)/);
  assert.equal(mutation.values.filter(v => v === 10).length, 0);
});
test("legacy code editing preserves its original program even when a different program is newest", async () => {
  const h = harness({ programs: [{ id: OTHER_PROGRAM }] });
  assert.equal((await post(h, body())).status, 200);
  assert.ok(h.queries.some(q => q.query.startsWith("UPDATE rewards") && q.values.includes(PROGRAM)));
  assert.ok(h.queries.every(q => !q.query.startsWith("SELECT id FROM loyalty_programs")));
});
test("a code present in multiple tenant programs is an explicit conflict before any mutation", async () => {
  const h = harness({ candidates: [{ id: REWARD, program_id: PROGRAM }, { id: "other", program_id: OTHER_PROGRAM }] });
  const response = await post(h, body());
  assert.equal(response.status, 409); assert.equal((await response.json()).error, "reward_program_ambiguous");
  assert.ok(h.queries.every(q => !q.query.startsWith("UPDATE") && !q.query.startsWith("INSERT")));
});
test("creation selects only a persisted tenant program and never activates a paused one", async () => {
  const h = harness({ candidates: [], programs: [{ id: PROGRAM, status: "paused" }] });
  const response = await post(h, body({ stock_total: 0, stock_remaining: 0 }));
  assert.equal(response.status, 200);
  const program = h.queries.find(q => q.query.startsWith("SELECT id FROM loyalty_programs"));
  assert.match(program.query, /tenant_id = \?::uuid ORDER BY created_at DESC, id DESC LIMIT 1/);
  assert.deepEqual(program.values, [TENANT]);
  assert.ok(h.queries.every(q => !/UPDATE loyalty_programs|INSERT INTO loyalty_programs/.test(q.query)));
});
test("an absent persisted program fails clearly without creating or seeding one", async () => {
  const h = harness({ candidates: [], programs: [] }); const response = await post(h, body());
  assert.equal(response.status, 409); assert.equal((await response.json()).error, "loyalty_program_not_found");
  assert.ok(h.queries.every(q => !q.query.startsWith("INSERT")));
});
test("a concurrent redemption raising consumption rejects totals below the actual floor", async () => {
  const h = harness({ update: [], current: [{ stock_total: 10, stock_remaining: 2 }] });
  const response = await post(h, body({ reward_id: REWARD, program_id: PROGRAM, stock_total: 7 }));
  assert.equal(response.status, 409); assert.equal((await response.json()).error, "stock_total_below_consumed");
  assert.equal(h.policy.adjustedAdminRewardStock(10, 2, 12), 4);
  assert.equal(h.policy.adjustedAdminRewardStock(10, 2, 8), 0);
  assert.throws(() => h.policy.adjustedAdminRewardStock(null, null, 0), /reward_stock_unavailable/);
});
test("exact reward/program mismatches cannot turn an edit into a creation", async () => {
  const h = harness({ candidates: [] }); const response = await post(h, body({ reward_id: REWARD, program_id: PROGRAM }));
  assert.equal(response.status, 404); assert.equal((await response.json()).error, "reward_not_found");
  assert.ok(h.queries.every(q => !q.query.startsWith("INSERT")));
});


test("explicit creation cannot overwrite a benefit already found by its code", async () => {
  const h = harness();
  const response = await post(h, body({ creationIntent: "admin-reward-first-create.v1", title: "A new unrelated benefit", points_cost: 0 }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "reward_create_conflict");
  assert.ok(h.queries.every(q => !/^(UPDATE|INSERT) /.test(q.query)), "creation cannot silently become legacy editing");
});

test("an unsupported creation intent is rejected before any tenant or program query", async () => {
  const h = harness();
  const response = await post(h, body({ creationIntent: "unrecognized-create-version" }));
  assert.equal(response.status, 400); assert.equal((await response.json()).error, "invalid_reward_creation_intent");
  assert.equal(h.queries.length, 0);
});


test("explicit creation rejects every existing match without changing tenant or program identity", async () => {
  for (const candidates of [[{ id: REWARD, program_id: PROGRAM }], [{ id: REWARD, program_id: PROGRAM }, { id: "other", program_id: OTHER_PROGRAM }]]) {
    const h = harness({ candidates });
    const response = await post(h, body({ tenant_slug: "foreign-tenant", creationIntent: "admin-reward-first-create.v1" }));
    assert.equal(response.status, 409); assert.equal((await response.json()).error, "reward_create_conflict");
    assert.deepEqual(h.queries[0].values, ["tenant-a"]);
    assert.ok(h.queries.every(q => !/^(UPDATE|INSERT) /.test(q.query)));
  }
});

test("valid explicit creation uses only its persisted scoped program and leaves its status untouched", async () => {
  const h = harness({ candidates: [], programs: [{ id: PROGRAM, status: "paused" }] });
  const response = await post(h, body({ creationIntent: "admin-reward-first-create.v1", program_id: PROGRAM, status: "draft", stock_total: 0 }));
  assert.equal(response.status, 200);
  const lookup = h.queries.find(q => q.query.startsWith("SELECT id FROM loyalty_programs"));
  assert.deepEqual(lookup.values, [TENANT, PROGRAM]); assert.doesNotMatch(lookup.query, /ORDER BY/);
  const inserted = h.queries.find(q => q.query.startsWith("INSERT INTO rewards"));
  assert.match(inserted.query, /ON CONFLICT \(program_id, code\) DO NOTHING/);
  assert.ok(inserted.values.includes("draft"));
  assert.ok(h.queries.every(q => !/^(UPDATE|INSERT INTO) loyalty_programs/.test(q.query) && !q.query.startsWith("UPDATE rewards")));
});

test("a conflicting insert remains a create conflict rather than falling back to an update", async () => {
  const h = harness({ candidates: [], insert: [] });
  const response = await post(h, body({ creationIntent: "admin-reward-first-create.v1", program_id: PROGRAM }));
  assert.equal(response.status, 409); assert.equal((await response.json()).error, "reward_create_conflict");
  assert.equal(h.queries.filter(q => q.query.startsWith("INSERT INTO rewards")).length, 1);
  assert.ok(h.queries.every(q => !q.query.startsWith("UPDATE rewards")));
});

test("creation intent is never combined with an exact edit and invalid values cannot reach SQL", async () => {
  for (const intent of [null, false, 1, "", {}, [], "ADMIN-REWARD-FIRST-CREATE.V1"]) {
    const h = harness(); const response = await post(h, body({ creationIntent: intent }));
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "invalid_reward_creation_intent"); assert.equal(h.queries.length, 0);
  }
  const h = harness();
  const response = await post(h, body({ creationIntent: "admin-reward-first-create.v1", reward_id: REWARD, program_id: PROGRAM }));
  assert.equal(response.status, 400); assert.equal((await response.json()).error, "invalid_reward_creation_intent"); assert.equal(h.queries.length, 0);
});

test("a missing scoped program never falls back or seeds a program for explicit creation", async () => {
  const h = harness({ candidates: [], programs: [] });
  const response = await post(h, body({ creationIntent: "admin-reward-first-create.v1", program_id: OTHER_PROGRAM }));
  assert.equal(response.status, 409); assert.equal((await response.json()).error, "loyalty_program_not_found");
  assert.ok(h.queries.every(q => !q.query.startsWith("INSERT") && !q.query.startsWith("UPDATE")));
});

const createRequest = raw => new Request("https://example.test/admin/loyalty/rewards/create?mode=legacy", {
  method: "POST", headers: { "content-type": "application/json", "x-reward-mode": "legacy" }, body: JSON.stringify(raw),
});
function strictPost(h, raw) {
  // Registration precondition only: an absent route is not a simulated Next response.
  assert.ok(h.createRoute, "strict create route is not registered in this source");
  return h.createRoute.POST(createRequest(raw));
}
test("strict endpoint exposes only valid Next runtime, dynamic and POST exports", () => {
  const h = harness(); assert.ok(h.createRoute, "strict create route is not registered in this source");
  assert.deepEqual(Object.keys(h.createRoute).sort(), ["POST", "dynamic", "runtime"]);
  assert.equal(h.createRoute.runtime, "nodejs"); assert.equal(h.createRoute.dynamic, "force-dynamic");
  assert.deepEqual(Object.keys(h.route).sort(), ["GET", "POST", "dynamic", "runtime"]);
});
test("strict endpoint creates a new benefit using the exact existing service", async () => {
  const h = harness({ candidates: [] });
  const response = await strictPost(h, body({ creationIntent: "admin-reward-first-create.v1", program_id: PROGRAM }));
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
  const result = await response.json(); assert.equal(result.ok, true); assert.equal(result.reward.id, REWARD);
  assert.equal(h.queries.filter(q => q.query.startsWith("INSERT INTO rewards")).length, 1);
  assert.ok(h.queries.every(q => !q.query.startsWith("UPDATE rewards")));
});
test("strict endpoint refuses missing, unsupported and edit intents before all SQL", async () => {
  for (const fields of [{}, { creationIntent: null }, { creationIntent: "legacy" }, { reward_id: REWARD, program_id: PROGRAM },
    { creationIntent: "admin-reward-first-create.v1", reward_id: REWARD, program_id: PROGRAM }]) {
    const h = harness(); const response = await strictPost(h, body({ mode: "legacy", ...fields }));
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "invalid_reward_creation_intent");
    assert.equal(h.queries.length, 0); assert.deepEqual(h.events, ["auth", "rewards:write", "scope", "parse"]);
  }
});
test("strict endpoint duplicate lookup and concurrent insert conflict never update", async () => {
  for (const options of [{}, { candidates: [], insert: [] }]) {
    const h = harness(options); const response = await strictPost(h, body({ creationIntent: "admin-reward-first-create.v1" }));
    assert.equal(response.status, 409); assert.equal((await response.json()).error, "reward_create_conflict");
    assert.ok(h.queries.every(q => !q.query.startsWith("UPDATE rewards")));
  }
});
test("both POST wrappers preserve a single original Request through auth permission and scope", async () => {
  for (const strict of [false, true]) {
    const h = harness({ candidates: [] }); const request = createRequest(body(strict ? { creationIntent: "admin-reward-first-create.v1" } : {}));
    assert.ok(h.createRoute, "strict create route is not registered in this source");
    const response = await (strict ? h.createRoute : h.route).POST(request);
    assert.equal(response.status, 200); assert.deepEqual(h.events.slice(0, 5), ["auth", "rewards:write", "scope", "parse", "sql"]);
    assert.deepEqual(h.requests, [request, request, request]); assert.deepEqual(h.queries[0].values, ["tenant-a"]);
  }
});
test("both POST wrappers reject auth and permission before reading any body or querying SQL", async () => {
  for (const strict of [false, true]) for (const [authStatus, permissionStatus, expected] of [[401, 0, 401], [503, 0, 503], [0, 403, 403]]) {
    const h = harness({ authStatus, permissionStatus }); const request = createRequest(body());
    assert.ok(h.createRoute, "strict create route is not registered in this source");
    const response = await (strict ? h.createRoute : h.route).POST(request);
    assert.equal(response.status, expected); assert.equal(request.bodyUsed, false); assert.equal(h.queries.length, 0);
    assert.deepEqual(h.events, authStatus ? ["auth"] : ["auth", "rewards:write"]);
  }
});
test("strict endpoint keeps the authenticated tenant despite foreign caller input", async () => {
  const h = harness({ candidates: [] });
  assert.equal((await strictPost(h, body({ tenant_slug: "foreign", creationIntent: "admin-reward-first-create.v1", program_id: PROGRAM }))).status, 200);
  assert.deepEqual(h.queries[0].values, ["tenant-a"]); assert.deepEqual(h.queries[1].values.slice(0, 1), [TENANT]);
});
test("strict endpoint keeps tenant-required and schema validation before SQL", async () => {
  const noTenant = harness({ forcedTenantSlug: "" });
  assert.equal((await strictPost(noTenant, body({ tenant_slug: "", creationIntent: "admin-reward-first-create.v1" }))).status, 400);
  assert.equal(noTenant.queries.length, 0); assert.ok(!noTenant.events.includes("parse"));
  const invalid = harness(); assert.equal((await strictPost(invalid, body({ creationIntent: "admin-reward-first-create.v1", points_cost: -1 }))).status, 400);
  assert.equal(invalid.queries.length, 0);
});
