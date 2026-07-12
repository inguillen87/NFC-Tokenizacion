import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { effectiveTenantFilter } = await import("../src/lib/admin-tenant-filter.ts");
const { isTokenizationRequestInTenantScope, resolveTokenizationRequestTenantId } = await import("../src/lib/admin-tokenization-scope.ts");

const routeUrl = new URL("../src/app/admin/tokenization/requests/route.ts", import.meta.url);
const requestId = "11111111-1111-1111-1111-111111111111";

test("tokenization GET forces the authenticated tenant over the query tenant", async () => {
  assert.equal(
    effectiveTenantFilter({ forcedTenantSlug: "Tenant-A", requestedTenantSlug: "tenant-b" }),
    "tenant-a",
  );

  const source = await readFile(routeUrl, "utf8");
  const getSource = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));

  assert.match(getSource, /getAdminTenantScope\(req\)/);
  assert.match(getSource, /effectiveTenantFilter\(\{[\s\S]*forcedTenantSlug,[\s\S]*requestedTenantSlug: searchParams\.get\("tenant"\)/);
});

test("tokenization POST rejects a request outside the forced tenant scope", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return [];
  };

  const allowed = await isTokenizationRequestInTenantScope(
    { requestId, forcedTenantSlug: "Tenant-A" },
    query,
  );

  assert.equal(allowed, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /SELECT tr\.tenant_id/);
  assert.match(calls[0].text, /JOIN tenants tn ON tn\.id = tr\.tenant_id/);
  assert.match(calls[0].text, /WHERE tr\.id = \?::uuid/);
  assert.match(calls[0].text, /AND tn\.slug = \?/);
  assert.deepEqual(calls[0].values, [requestId, "tenant-a"]);
});

test("tokenization POST resolves an authoritative tenant for scoped and super-admin callers", async () => {
  const tenantId = "22222222-2222-2222-2222-222222222222";
  const matchingQuery = async () => [{ tenant_id: tenantId }];

  assert.equal(
    await isTokenizationRequestInTenantScope({ requestId, forcedTenantSlug: "tenant-a" }, matchingQuery),
    true,
  );
  assert.equal(
    await resolveTokenizationRequestTenantId({ requestId, forcedTenantSlug: "" }, matchingQuery),
    tenantId,
  );
});

test("tokenization route checks tenant ownership before invoking the anchor engine", async () => {
  const source = await readFile(routeUrl, "utf8");
  const postSource = source.slice(source.indexOf("export async function POST"));
  const scopeIndex = postSource.indexOf("getAdminTenantScope(req)");
  const ownershipIndex = postSource.indexOf("resolveTokenizationRequestTenantId({ requestId, forcedTenantSlug })");
  const rejectionIndex = postSource.indexOf("if (!tenantId)");
  const anchorIndex = postSource.indexOf("anchorTokenizationRequest({");

  assert.ok(scopeIndex >= 0);
  assert.ok(ownershipIndex > scopeIndex);
  assert.ok(rejectionIndex > ownershipIndex);
  assert.ok(anchorIndex > rejectionIndex);
  assert.match(postSource, /if \(!tenantId\) return json\(\{ ok: false, reason: "request not found" \}, 404\)/);
  assert.match(postSource, /anchorTokenizationRequest\(\{[\s\S]*tenantId,/);
});

test("tokenization route separates read and write permissions", async () => {
  const source = await readFile(routeUrl, "utf8");
  const getSource = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));
  const postSource = source.slice(source.indexOf("export async function POST"));

  assert.match(getSource, /checkAdminPermission\(req, "tokenization:read"\)/);
  assert.match(postSource, /checkAdminPermission\(req, "tokenization:write"\)/);
});
