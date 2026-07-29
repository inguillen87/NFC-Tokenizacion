import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  checkAdmin,
  checkAdminPermission,
  getAdminActor,
  getAdminPrincipal,
  getAdminTenantAccess,
} = await import("../src/lib/auth.ts");

function session(overrides = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "real-admin@tenant-a.example",
    label: "Real Admin",
    role: "tenant-admin",
    tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    tenantSlug: "tenant-a",
    permissions: ["proof:read"],
    mfaVerified: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rotatedCookieValue: null,
    setupCompleted: true,
    ...overrides,
  };
}

test("forged role, tenant, permission and actor headers never influence the verified principal", async () => {
  const req = new Request("https://api.nexid.lat/admin/proof/anchors?tenant=victim", {
    headers: {
      authorization: "Bearer opaque-session-secret",
      "x-nexid-admin-scope": "super_admin",
      "x-nexid-tenant-slug": "victim",
      "x-nexid-permissions": "*",
      "x-nexid-actor": "forged@example.com",
      "x-nexid-actor-id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    },
  });
  const auth = await checkAdmin(req, ["tenant_admin"], async (token) => {
    assert.equal(token, "opaque-session-secret");
    return session();
  });

  assert.equal(auth, null);
  assert.equal(getAdminPrincipal(req).scope, "tenant_admin");
  assert.equal(getAdminTenantAccess(req, "victim").effectiveTenantSlug, "tenant-a");
  assert.equal(checkAdminPermission(req, "proof:read"), null);
  assert.equal(checkAdminPermission(req, "proof:write")?.status, 403);
  assert.deepEqual(getAdminActor(req), {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "real-admin@tenant-a.example",
    label: "Real Admin",
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
});

test("unknown, revoked or expired opaque sessions fail closed without ADMIN_API_KEY fallback", async () => {
  const previous = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = "legacy-global-key";
  try {
    for (const token of ["legacy-global-key", "revoked-session", "expired-session"]) {
      const req = new Request("https://api.nexid.lat/admin/tenants", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-nexid-admin-scope": "super_admin",
          "x-nexid-permissions": "*",
        },
      });
      assert.equal((await checkAdmin(req, ["super_admin"], async () => null))?.status, 401);
      assert.equal(checkAdminPermission(req, "tenants:write")?.status, 401);
      assert.throws(() => getAdminTenantAccess(req), /authenticated_admin_principal_required/);
    }
  } finally {
    if (previous === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = previous;
  }
});

test("session role and tenant binding fail closed even when headers request a broader scope", async () => {
  const viewer = new Request("https://api.nexid.lat/admin/tenants", {
    headers: { authorization: "Bearer viewer", "x-nexid-admin-scope": "super_admin" },
  });
  assert.equal((await checkAdmin(viewer, ["super_admin"], async () => session({ role: "viewer", tenantId: null, tenantSlug: null })))?.status, 403);

  const malformedTenantAdmin = new Request("https://api.nexid.lat/admin/tenants", {
    headers: { authorization: "Bearer malformed", "x-nexid-tenant-slug": "victim" },
  });
  assert.equal((await checkAdmin(malformedTenantAdmin, ["tenant_admin"], async () => session({ tenantId: null, tenantSlug: null })))?.status, 403);
});

test("admin boundary and sensitive audit routes no longer consume caller authority headers", async () => {
  const authSource = await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
  const selectedRoutes = await Promise.all([
    "../src/app/admin/batches/[bid]/activate-all/route.ts",
    "../src/app/admin/batches/[bid]/import-manifest/route.ts",
    "../src/app/admin/logistics/shipments/[shipmentId]/claims/route.ts",
    "../src/app/admin/offline-verifier/sync/route.ts",
    "../src/app/admin/supplier-orders/route.ts",
    "../src/app/admin/supplier-orders/[orderId]/sub-batches/[bid]/keys/rotate/route.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

  assert.doesNotMatch(authSource, /ADMIN_API_KEY|x-nexid-admin-scope|x-nexid-tenant-slug|x-nexid-permissions|x-nexid-actor/);
  for (const source of selectedRoutes) {
    assert.doesNotMatch(source, /x-nexid-permissions|x-nexid-actor|x-dashboard-user|x-forwarded-user/);
  }
});

test("session rotation uses compare-and-swap and never returns a losing bearer", async () => {
  const source = await readFile(new URL("../src/lib/iam.ts", import.meta.url), "utf8");
  const rotation = source.slice(source.indexOf("if (options.rotate === true"), source.indexOf("return {", source.indexOf("if (options.rotate === true")));

  assert.match(rotation, /SET session_token_hash = \$\{sha256\(newSecret\)\}/);
  assert.match(rotation, /AND session_token_hash = \$\{String\(session\.session_token_hash\)\}/);
  assert.match(rotation, /AND revoked_at IS NULL/);
  assert.match(rotation, /AND expires_at > now\(\)/);
  assert.match(rotation, /RETURNING expires_at/);
  assert.match(rotation, /if \(!refreshedRows\[0\]\) return null;[\s\S]*rotatedCookieValue = sessionCookieValue/);
});

test("admin scopes contain only persisted IAM roles and super-admin membership remains current with NULL tenant", async () => {
  const [authSource, iamSource, clerkSource] = await Promise.all([
    readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/iam.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/auth/clerk-sync/route.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(authSource, /security_operator/);
  assert.match(iamSource, /current_membership\.tenant_id IS NOT DISTINCT FROM s\.tenant_id/);
  assert.match(clerkSource, /membership\.role = 'super_admin'::membership_role/);
  assert.match(clerkSource, /membership\.tenant_id IS NULL/);
  assert.match(clerkSource, /pg_advisory_xact_lock/);
  assert.match(clerkSource, /WHERE NOT EXISTS \(SELECT 1 FROM existing_super_admin\)/);
  assert.match(clerkSource, /ON CONFLICT DO NOTHING/);
  assert.doesNotMatch(clerkSource, /UPDATE memberships/);
  assert.match(iamSource, /WHEN 'super_admin' THEN 1[\s\S]*m\.tenant_id ASC NULLS FIRST/);
});
