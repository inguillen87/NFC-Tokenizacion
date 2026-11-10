import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const { effectiveTenantFilter } = await import("../src/lib/admin-tenant-filter.ts");
const { checkAdmin, checkAdminPermission, getAdminTenantScope } = await import("../src/lib/auth.ts");
const { toAdminRewardReadItem } = await import("../src/lib/admin-reward-read-model.ts");
const { json } = await import("../src/lib/http.ts");
const route = await readFile(
  new URL("../src/app/admin/loyalty/rewards/route.ts", import.meta.url),
  "utf8",
);

function load(text, require) {
  const compiled = ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

test("a forced tenant always wins over a caller-selected rewards tenant", () => {
  assert.equal(
    effectiveTenantFilter({
      forcedTenantSlug: "Bodega-Balmec",
      requestedTenantSlug: "otro-tenant",
    }),
    "bodega-balmec",
  );
  assert.equal(
    effectiveTenantFilter({ forcedTenantSlug: "", requestedTenantSlug: " Tenant-AR " }),
    "tenant-ar",
  );
});

test("admin rewards GET applies the real capability policy and only queries the effective tenant", async () => {
  const scenarios = [
    { name: "marketing forced tenant", role: "marketing-manager", query: "?tenant=other-tenant&scope=global", status: 200, tenant: "tenant-forced" },
    { name: "marketing cannot select global", role: "marketing-manager", query: "?scope=global", status: 200, tenant: "tenant-forced" },
    { name: "marketing without permission", role: "marketing-manager", permissions: [], status: 403 },
    { name: "marketing explicit deny", role: "marketing-manager", deniedPermissions: ["rewards:read"], status: 403 },
    { name: "marketing without tenant", role: "marketing-manager", missingTenant: true, query: "?scope=global", status: 403 },
    { name: "unrelated operator with grant", role: "operations-manager", status: 403 },
    { name: "reseller admin with grant", role: "reseller-admin", status: 403 },
    { name: "reseller with grant", role: "reseller", status: 403 },
    { name: "tenant admin remains scoped", role: "tenant-admin", query: "?scope=global", status: 200, tenant: "tenant-forced" },
    { name: "explicit super-admin global", role: "super-admin", query: "?scope=global", status: 200, tenant: null },
    { name: "implicit super-admin global refused", role: "super-admin", status: 400 },
    { name: "no session", role: null, status: 401 },
  ];
  for (const scenario of scenarios) {
    const queries = [];
    const hasTenant = scenario.role !== "super-admin" && !scenario.missingTenant;
    const session = scenario.role ? {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      email: "rewards-reader@example.test", label: "Synthetic rewards reader", role: scenario.role,
      tenantId: hasTenant ? "11111111-1111-4111-8111-111111111111" : null,
      tenantSlug: hasTenant ? "tenant-forced" : null,
      permissions: scenario.permissions ?? ["rewards:read"], deniedPermissions: scenario.deniedPermissions ?? [],
      mfaVerified: true, expiresAt: new Date(Date.now() + 60_000).toISOString(), rotatedCookieValue: null,
    } : null;
    const handler = load(route, name => {
      if (name.endsWith("/auth")) return {
        checkAdmin: (req, scopes) => checkAdmin(req, scopes, async () => session),
        checkAdminPermission,
        getAdminTenantScope,
      };
      if (name.endsWith("/db")) return { sql: async (strings, ...values) => {
        queries.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
        return [{ id: "reward-fixture", tenant_slug: values[0] ?? "tenant-forced", code: "VISIT", title: "Visit", status: "draft" }];
      } };
      if (name.endsWith("/http")) return { json };
      if (name.endsWith("/admin-tenant-filter")) return { effectiveTenantFilter };
      if (name.endsWith("/admin-reward-read-model")) return { toAdminRewardReadItem };
      if (name.endsWith("/admin-reward-request")) return { handleAdminRewardPost: () => { throw new Error("unexpected reward write during GET"); } };
      throw new Error(`unexpected rewards GET dependency ${name}`);
    });
    const request = new Request(`https://api.nexid.test/admin/loyalty/rewards${scenario.query ?? ""}`, {
      headers: session ? { authorization: "Bearer synthetic-rewards-session" } : {},
    });
    const response = await handler.GET(request);
    assert.equal(response.status, scenario.status, scenario.name);
    if (scenario.status !== 200) {
      assert.deepEqual(queries, [], scenario.name);
      if (scenario.status === 400) assert.deepEqual(await response.json(), { ok: false, error: "tenant_required" });
      continue;
    }
    assert.equal(queries.length, 1, scenario.name);
    assert.deepEqual(queries[0].values, scenario.tenant ? [scenario.tenant] : [], scenario.name);
    assert.equal(queries[0].text.includes("WHERE t.slug = ?"), Boolean(scenario.tenant), scenario.name);
    assert.match(queries[0].text, /^SELECT\b/);
    const body = await response.json();
    assert.equal(body.ok, true, scenario.name);
    assert.equal(body.tenant, scenario.tenant, scenario.name);
    assert.equal(body.scope, scenario.tenant ? "tenant" : "global", scenario.name);
    assert.equal(body.rewards[0].tenant_slug, "tenant-forced", scenario.name);
    assert.equal(body.rewards[0].status, "draft", scenario.name);
  }
});

test("only an explicit super-admin global rewards read may omit a tenant", () => {
  const getBody = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(getBody, /const explicitGlobalScope = searchParams\.get\("scope"\) === "global"/);
  assert.match(getBody, /!tenant && !\(scope === "super_admin" && explicitGlobalScope\)/);
  assert.match(getBody, /error: "tenant_required"/);
  assert.match(getBody, /scope: tenant \? "tenant" : "global"/);
});

test("reward mutations require rewards:write without weakening the existing admin role gate", async () => {
  const handlerText = await readFile(new URL("../src/lib/admin-reward-request.ts", import.meta.url), "utf8");
  const strictText = await readFile(new URL("../src/app/admin/loyalty/rewards/create/route.ts", import.meta.url), "utf8");
  const policyText = await readFile(new URL("../src/lib/admin-reward-policy.ts", import.meta.url), "utf8");
  const policy = load(policyText, name => { throw new Error(`unexpected policy dependency ${name}`); });
  for (const strict of [false, true]) for (const denial of [null, "auth", "permission"]) {
    const events = []; const seen = []; let saved; const TENANT = "10000000-0000-4000-8000-000000000001";
    const handler = load(handlerText, name => {
      if (name === "./auth") return {
        checkAdmin: async req => { events.push("auth"); seen.push(req); return denial === "auth" ? Response.json({}, { status: 401 }) : null; },
        checkAdminPermission: (req, permission) => { events.push(permission); seen.push(req); return denial === "permission" ? Response.json({}, { status: 403 }) : null; },
        getAdminTenantScope: req => { events.push("scope"); seen.push(req); return { forcedTenantSlug: "tenant-forced" }; },
      };
      if (name === "./http") return { json: (body, status = 200, headers) => Response.json(body, { status, headers }) };
      if (name === "./admin-tenant-filter") return { effectiveTenantFilter };
      if (name === "./admin-reward-policy") return { ...policy, parseAdminRewardCommand: raw => { events.push("parse"); return policy.parseAdminRewardCommand(raw); } };
      if (name === "./db") return { sql: async (strings, ...values) => { events.push("tenant-query"); assert.deepEqual(values, ["tenant-forced"]); return [{ id: TENANT }]; } };
      if (name === "./admin-reward-service") return { saveAdminReward: async (tenant, command) => { events.push("save"); saved = { tenant, command }; return { id: "saved" }; } };
      throw new Error(`unexpected handler dependency ${name}`);
    });
    const wrapper = load(strict ? strictText : route, name => {
      if (name.endsWith("/admin-reward-request")) return handler;
      if (name.endsWith("/auth") || name.endsWith("/db") || name.endsWith("/http") || name.endsWith("/admin-tenant-filter") || name.endsWith("/admin-reward-read-model")) return {};
      throw new Error(`unexpected wrapper dependency ${name}`);
    });
    const req = new Request("https://example.test/admin/loyalty/rewards" + (strict ? "/create" : ""), { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: "other-tenant", code: "VISIT", title: "Visit", ...(strict ? { creationIntent: "admin-reward-first-create.v1" } : {}) }) });
    const response = await wrapper.POST(req);
    assert.equal(response.status, denial === "auth" ? 401 : denial === "permission" ? 403 : 200);
    assert.ok(seen.every(item => item === req));
    assert.deepEqual(events, denial === "auth" ? ["auth"] : denial === "permission" ? ["auth", "rewards:write"] : ["auth", "rewards:write", "scope", "parse", "tenant-query", "save"]);
    if (denial) { assert.equal(req.bodyUsed, false); assert.equal(saved, undefined); }
    else { assert.equal(saved.tenant, TENANT); assert.equal(saved.command.creationIntent, strict ? "admin-reward-first-create.v1" : undefined); }
  }
});
