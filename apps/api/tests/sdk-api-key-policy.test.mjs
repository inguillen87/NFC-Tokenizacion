import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  SDK_API_KEY_SCOPES,
  checkSdkApiKeyPermission,
  parseSdkApiKeyScopes,
} = await import("../src/app/admin/sdk/api-keys/policy.ts");
const { checkAdmin } = await import("../src/lib/auth.ts");

async function scopedRequest(scope, permissions = []) {
  const req = new Request("https://api.nexid.test/admin/sdk/api-keys", {
    headers: {
      authorization: "Bearer opaque-session",
      "x-nexid-admin-scope": scope === "super_admin" ? "tenant_admin" : "super_admin",
      "x-nexid-permissions": "*",
      "x-nexid-tenant-slug": "forged-tenant",
    },
  });
  const role = scope === "super_admin" ? "super-admin" : "tenant-admin";
  const tenantSlug = role === "tenant-admin" ? "tenant-a" : null;
  assert.equal(await checkAdmin(req, [scope], async () => ({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "admin@example.com",
    label: "Admin",
    role,
    tenantId: tenantSlug ? "cccccccc-cccc-4ccc-8ccc-cccccccccccc" : null,
    tenantSlug,
    permissions,
    mfaVerified: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rotatedCookieValue: null,
    setupCompleted: true,
  })), null);
  return req;
}

test("SDK API key scopes must be explicit, non-empty and allowlisted", () => {
  assert.deepEqual(parseSdkApiKeyScopes(undefined), {
    ok: false,
    reason: "scopes_required",
    invalidScopes: [],
  });
  assert.deepEqual(parseSdkApiKeyScopes([]), {
    ok: false,
    reason: "scopes_required",
    invalidScopes: [],
  });
  assert.deepEqual(parseSdkApiKeyScopes(["sdk:verify", "sdk:*", "unknown"]), {
    ok: false,
    reason: "invalid_scopes",
    invalidScopes: ["sdk:*", "unknown"],
  });
  assert.deepEqual(parseSdkApiKeyScopes(["sdk:verify", "sdk:verify", "sdk:products"]), {
    ok: true,
    scopes: ["sdk:verify", "sdk:products"],
  });
  assert.deepEqual([...SDK_API_KEY_SCOPES], [
    "sdk:verify",
    "sdk:claim",
    "sdk:products",
    "sdk:events",
    "sdk:pos",
    "sdk:logistics",
  ]);
});

test("SDK API key admin permissions preserve authorized super and tenant admins", async () => {
  assert.equal(checkSdkApiKeyPermission(await scopedRequest("super_admin"), "write"), null);
  assert.equal(checkSdkApiKeyPermission(await scopedRequest("tenant_admin", ["sdk:keys:read"]), "read"), null);
  assert.equal(checkSdkApiKeyPermission(await scopedRequest("tenant_admin", ["sdk:keys:read"]), "write")?.status, 403);
  assert.equal(checkSdkApiKeyPermission(await scopedRequest("tenant_admin", ["tenant:*"]), "read"), null);
  assert.equal(checkSdkApiKeyPermission(await scopedRequest("tenant_admin", ["tenant:*"]), "write"), null);
  assert.equal(checkSdkApiKeyPermission(await scopedRequest("tenant_admin", ["events:*"]), "read")?.status, 403);
});

test("SDK API key routes enforce read and write permissions at every handler", async () => {
  const collectionRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/route.ts", import.meta.url), "utf8");
  const itemRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/[id]/route.ts", import.meta.url), "utf8");

  assert.match(collectionRoute, /GET[\s\S]*checkSdkApiKeyPermission\(req, "read"\)/);
  assert.match(collectionRoute, /POST[\s\S]*checkSdkApiKeyPermission\(req, "write"\)/);
  assert.match(itemRoute, /PATCH[\s\S]*checkSdkApiKeyPermission\(req, "write"\)/);
  assert.match(itemRoute, /DELETE[\s\S]*checkSdkApiKeyPermission\(req, "write"\)/);
  assert.match(collectionRoute, /parseSdkApiKeyScopes\(body\.scopes\)/);
  assert.match(itemRoute, /parseSdkApiKeyScopes\(body\.scopes\)/);
});
