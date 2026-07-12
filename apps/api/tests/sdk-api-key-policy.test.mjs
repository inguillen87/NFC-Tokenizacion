import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  SDK_API_KEY_SCOPES,
  checkSdkApiKeyPermission,
  parseSdkApiKeyScopes,
} = await import("../src/app/admin/sdk/api-keys/policy.ts");

function scopedRequest(scope, permissions = []) {
  return new Request("https://api.nexid.test/admin/sdk/api-keys", {
    headers: {
      "x-nexid-admin-scope": scope,
      "x-nexid-permissions": permissions.join(","),
      "x-nexid-tenant-slug": "tenant-a",
    },
  });
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

test("SDK API key admin permissions preserve authorized super and tenant admins", () => {
  assert.equal(checkSdkApiKeyPermission(scopedRequest("super_admin"), "write"), null);
  assert.equal(checkSdkApiKeyPermission(scopedRequest("tenant_admin", ["sdk:keys:read"]), "read"), null);
  assert.equal(checkSdkApiKeyPermission(scopedRequest("tenant_admin", ["sdk:keys:read"]), "write")?.status, 403);
  assert.equal(checkSdkApiKeyPermission(scopedRequest("tenant_admin", ["tenant:*"]), "read"), null);
  assert.equal(checkSdkApiKeyPermission(scopedRequest("tenant_admin", ["tenant:*"]), "write"), null);
  assert.equal(checkSdkApiKeyPermission(scopedRequest("tenant_admin", ["events:*"]), "read")?.status, 403);
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
