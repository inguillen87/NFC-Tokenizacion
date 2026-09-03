import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("reward mutations require rewards:write without weakening the existing admin role gate", () => {
  const postBody = route.slice(route.indexOf("export async function POST"));
  const authIndex = postBody.indexOf("await checkAdmin(req)");
  const permissionIndex = postBody.indexOf('checkAdminPermission(req, "rewards:write")');
  const scopeIndex = postBody.indexOf("getAdminTenantScope(req)");

  assert.ok(authIndex >= 0 && permissionIndex > authIndex && scopeIndex > permissionIndex);
  assert.match(postBody, /effectiveTenantFilter\(\{[\s\S]*forcedTenantSlug,[\s\S]*requestedTenantSlug: String\(body\.tenant_slug \|\| body\.tenant \|\| ""\)/);
});
