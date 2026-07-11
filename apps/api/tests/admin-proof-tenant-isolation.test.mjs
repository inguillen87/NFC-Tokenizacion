import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { resolveAdminProofTenantScope } = await import("../src/lib/admin-proof-tenant-scope.ts");
const { checkAdminPermission } = await import("../src/lib/auth.ts");

function tenantRequest(slug) {
  return new Request("https://api.nexid.lat/admin/proof/anchors", {
    headers: {
      authorization: "Bearer test-admin-key",
      "x-nexid-admin-scope": "tenant_admin",
      "x-nexid-tenant-slug": slug,
    },
  });
}

test("forced proof tenant wins over a requested tenant and fails closed when absent", async () => {
  const calls = [];
  const query = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return [];
  };

  const scope = await resolveAdminProofTenantScope(tenantRequest("missing-tenant"), "other-tenant", query);
  assert.deepEqual(scope, {
    requested: true,
    found: false,
    tenantId: null,
    tenantSlug: "missing-tenant",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values[0], "missing-tenant");
});

test("resolved proof tenant returns the tenant id used by every evidence query", async () => {
  const query = async () => [{ id: "11111111-1111-4111-8111-111111111111", slug: "tenant-a" }];
  const scope = await resolveAdminProofTenantScope(tenantRequest("tenant-a"), "tenant-b", query);
  assert.equal(scope.found, true);
  assert.equal(scope.tenantId, "11111111-1111-4111-8111-111111111111");
  assert.equal(scope.tenantSlug, "tenant-a");
});

test("unscoped super admin proof reads remain explicitly global", async () => {
  let queryCalls = 0;
  const scope = await resolveAdminProofTenantScope(
    new Request("https://api.nexid.lat/admin/proof/anchors", {
      headers: { "x-nexid-admin-scope": "super_admin" },
    }),
    "",
    async () => {
      queryCalls += 1;
      return [];
    },
  );
  assert.deepEqual(scope, { requested: false, found: true, tenantId: null, tenantSlug: null });
  assert.equal(queryCalls, 0);
});

test("tenant proof permissions distinguish read from write", async () => {
  const readOnly = new Request("https://api.nexid.lat/admin/proof/anchors", {
    headers: {
      "x-nexid-admin-scope": "tenant_admin",
      "x-nexid-tenant-slug": "tenant-a",
      "x-nexid-permissions": "events:read,proof:read",
    },
  });
  assert.equal(checkAdminPermission(readOnly, "proof:read"), null);
  assert.equal(checkAdminPermission(readOnly, "proof:write")?.status, 403);

  const superAdmin = new Request("https://api.nexid.lat/admin/proof/anchors", {
    headers: { "x-nexid-admin-scope": "super_admin" },
  });
  assert.equal(checkAdminPermission(superAdmin, "proof:write"), null);
});

test("proof routes reject unresolved tenant scope before global reads or writes", async () => {
  const anchors = await readFile(new URL("../src/app/admin/proof/anchors/route.ts", import.meta.url), "utf8");
  const events = await readFile(new URL("../src/app/admin/proof/events/route.ts", import.meta.url), "utf8");
  const localAnchor = await readFile(new URL("../src/app/admin/proof/anchor/route.ts", import.meta.url), "utf8");
  const providers = await readFile(new URL("../src/app/admin/proof/providers/route.ts", import.meta.url), "utf8");

  for (const source of [anchors, events, localAnchor]) {
    assert.match(source, /resolveAdminProofTenantScope/);
    assert.match(source, /tenantScope\.requested && !tenantScope\.found/);
    assert.match(source, /tenant_not_found/);
    assert.match(source, /checkAdminPermission/);
  }
  assert.match(events, /export async function GET/);
  assert.match(events, /WHERE tenant_id = \$\{tenantScope\.tenantId\}::uuid/);
  assert.match(anchors, /eventHashesFromIds\(eventIds, tenantId\)/);
  assert.match(anchors, /proof_anchor_external_created/);
  assert.match(anchors, /tx_hash: txHash/);
  assert.match(localAnchor, /WHERE tenant_id = \$\{tenantId\}::uuid/);
  assert.match(anchors, /tenant_required/);
  assert.match(events, /tenant_required/);
  assert.match(localAnchor, /tenant_required/);
  assert.match(providers, /FROM ledger_providers/);
  assert.match(providers, /runtime_status/);
  assert.match(providers, /write_enabled/);
  assert.match(providers, /policy_disabled/);
  assert.doesNotMatch(providers, /status:\s*["']active["']/);
});
