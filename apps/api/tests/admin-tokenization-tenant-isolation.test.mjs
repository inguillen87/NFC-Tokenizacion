import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { effectiveTenantFilter } = await import("../src/lib/admin-tenant-filter.ts");
const { isTokenizationRequestInTenantScope } = await import("../src/lib/admin-tokenization-scope.ts");

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
  assert.match(calls[0].text, /JOIN tenants tn ON tn\.id = tr\.tenant_id/);
  assert.match(calls[0].text, /WHERE tr\.id = \?::uuid/);
  assert.match(calls[0].text, /AND tn\.slug = \?/);
  assert.deepEqual(calls[0].values, [requestId, "tenant-a"]);
});

test("tokenization POST accepts an in-scope request and leaves super-admin unscoped", async () => {
  const matchingQuery = async () => [{ id: requestId }];
  const forbiddenQuery = async () => {
    throw new Error("unscoped access must not query tenant ownership");
  };

  assert.equal(
    await isTokenizationRequestInTenantScope({ requestId, forcedTenantSlug: "tenant-a" }, matchingQuery),
    true,
  );
  assert.equal(
    await isTokenizationRequestInTenantScope({ requestId, forcedTenantSlug: "" }, forbiddenQuery),
    true,
  );
});

test("tokenization route checks tenant ownership before invoking the anchor engine", async () => {
  const source = await readFile(routeUrl, "utf8");
  const postSource = source.slice(source.indexOf("export async function POST"));
  const scopeIndex = postSource.indexOf("getAdminTenantScope(req)");
  const ownershipIndex = postSource.indexOf("isTokenizationRequestInTenantScope({ requestId, forcedTenantSlug })");
  const rejectionIndex = postSource.indexOf("if (!requestInScope)");
  const anchorIndex = postSource.indexOf("anchorTokenizationRequest({");

  assert.ok(scopeIndex >= 0);
  assert.ok(ownershipIndex > scopeIndex);
  assert.ok(rejectionIndex > ownershipIndex);
  assert.ok(anchorIndex > rejectionIndex);
  assert.match(postSource, /if \(!requestInScope\) return json\(\{ ok: false, reason: "request not found" \}, 404\)/);
});
