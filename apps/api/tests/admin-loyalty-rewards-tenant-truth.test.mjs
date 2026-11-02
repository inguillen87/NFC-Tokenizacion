import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const { effectiveTenantFilter } = await import("../src/lib/admin-tenant-filter.ts");
const route = await readFile(
  new URL("../src/app/admin/loyalty/rewards/route.ts", import.meta.url),
  "utf8",
);

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

test("admin rewards reads require read permission and preserve tenant binding", () => {
  const getBody = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  const authIndex = getBody.indexOf("await checkAdmin(req)");
  const permissionIndex = getBody.indexOf('checkAdminPermission(req, "rewards:read")');
  const scopeIndex = getBody.indexOf("getAdminTenantScope(req)");
  const tenantIndex = getBody.indexOf("effectiveTenantFilter({");
  const queryIndex = getBody.indexOf("await sql`");

  assert.ok(authIndex >= 0, "GET must authenticate the existing admin roles");
  assert.ok(permissionIndex > authIndex, "GET must authorize rewards:read after authentication");
  assert.ok(scopeIndex > permissionIndex && tenantIndex > scopeIndex, "GET must derive the tenant from the validated principal");
  assert.ok(queryIndex > tenantIndex, "tenant scope must be resolved before querying rewards");
  assert.match(getBody, /forcedTenantSlug,[\s\S]*requestedTenantSlug: searchParams\.get\("tenant"\)/);
  assert.doesNotMatch(getBody, /const tenant = searchParams\.get\("tenant"\) \|\| ""/);
});

test("only an explicit super-admin global rewards read may omit a tenant", () => {
  const getBody = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(getBody, /const explicitGlobalScope = searchParams\.get\("scope"\) === "global"/);
  assert.match(getBody, /!tenant && !\(scope === "super_admin" && explicitGlobalScope\)/);
  assert.match(getBody, /error: "tenant_required"/);
  assert.match(getBody, /scope: tenant \? "tenant" : "global"/);
});

test("reward mutations require rewards:write without weakening the existing admin role gate", async () => {
  const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const load = (text, require) => { const module = { exports: {} }; new Function("require", "module", "exports", compile(text))(require, module, module.exports); return module.exports; };
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
