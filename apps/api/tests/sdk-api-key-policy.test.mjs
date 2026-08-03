import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  SDK_API_KEY_ACTIVE_QUOTA_DEFAULT,
  SDK_API_KEY_ADMIN_BODY_MAX_BYTES,
  SDK_API_KEY_LIFECYCLE_REQUIRED_MIGRATION,
  SDK_API_KEY_SCOPES,
  checkSdkApiKeyPermission,
  isSdkApiKeyId,
  normalizeSdkApiKeyName,
  parseSdkApiKeyExpiry,
  parseSdkApiKeyNetworkPolicy,
  parseSdkApiKeyScopes,
  parseSdkApiKeyStatusPatch,
  readSdkApiKeyAdminBody,
  resolveSdkApiKeyActiveQuota,
} = await import("../src/app/admin/sdk/api-keys/policy.ts");
const { checkAdmin } = await import("../src/lib/auth.ts");
const { RequestBodyTooLargeError } = await import("../src/lib/bounded-request-body.ts");
const { classifyFleetRateLimit } = await import("../src/lib/fleet-rate-limit-policy.ts");

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
    "sdk:epcis:read",
    "sdk:epcis:write",
  ]);
});

test("SDK API key quota configuration is bounded and fails closed when explicitly invalid", () => {
  assert.equal(resolveSdkApiKeyActiveQuota({}), SDK_API_KEY_ACTIVE_QUOTA_DEFAULT);
  assert.equal(resolveSdkApiKeyActiveQuota({ SDK_API_KEY_MAX_ACTIVE_PER_TENANT: "7" }), 7);
  for (const value of ["0", "-1", "1.5", "not-a-number", "1001"]) {
    assert.equal(
      resolveSdkApiKeyActiveQuota({ SDK_API_KEY_MAX_ACTIVE_PER_TENANT: value }),
      null,
      value,
    );
  }
});

test("SDK API key identifiers, names and expirations are bounded before PostgreSQL", () => {
  assert.equal(isSdkApiKeyId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), true);
  assert.equal(isSdkApiKeyId("not-a-uuid"), false);
  assert.equal(normalizeSdkApiKeyName(" Production ERP "), "Production ERP");
  assert.equal(normalizeSdkApiKeyName("x".repeat(161)), null);
  assert.deepEqual(parseSdkApiKeyExpiry("2026-08-03T00:00:00.000Z", Date.parse("2026-08-02T00:00:00.000Z")), {
    ok: true,
    expiresAt: "2026-08-03T00:00:00.000Z",
  });
  assert.equal(parseSdkApiKeyExpiry("not-a-date").ok, false);
  assert.equal(parseSdkApiKeyExpiry("2026-08-01T00:00:00.000Z", Date.parse("2026-08-02T00:00:00.000Z")).ok, false);
});

test("SDK API key status mutation permits only terminal revocation", () => {
  assert.deepEqual(parseSdkApiKeyStatusPatch({ provided: false, value: undefined }), {
    ok: true,
    revokeRequested: false,
  });
  assert.deepEqual(parseSdkApiKeyStatusPatch({ provided: true, value: "revoked" }), {
    ok: true,
    revokeRequested: true,
  });
  assert.deepEqual(parseSdkApiKeyStatusPatch({ provided: true, value: "active" }), {
    ok: false,
    reason: "sdk_api_key_reactivation_forbidden",
  });
  assert.deepEqual(parseSdkApiKeyStatusPatch({ provided: true, value: "paused" }), {
    ok: false,
    reason: "sdk_api_key_status_invalid",
  });
});

test("SDK API key network policy is bounded, normalized and HTTPS-only", () => {
  assert.deepEqual(parseSdkApiKeyNetworkPolicy({
    allowedIpCidrs: ["203.0.113.7", "2001:db8::/48", "203.0.113.7/32"],
    allowedOrigins: ["https://erp.example.com", "https://ERP.EXAMPLE.COM/"],
    rateLimitProfile: "conservative",
  }), {
    ok: true,
    allowedIpCidrs: ["203.0.113.7/32", "2001:db8::/48"],
    allowedOrigins: ["https://erp.example.com"],
    rateLimitProfile: "conservative",
  });
  for (const policy of [
    { allowedIpCidrs: ["not-an-ip"] },
    { allowedOrigins: ["http://erp.example.com"] },
    { allowedOrigins: ["https://user:secret@erp.example.com"] },
    { rateLimitProfile: "unlimited" },
  ]) assert.equal(parseSdkApiKeyNetworkPolicy(policy).ok, false);
});

test("SDK API key body reader rejects oversized input before JSON parsing", async () => {
  const request = new Request("https://api.nexid.test/admin/sdk/api-keys", {
    method: "POST",
    headers: { "content-length": String(SDK_API_KEY_ADMIN_BODY_MAX_BYTES + 1) },
    body: "{}",
  });
  await assert.rejects(() => readSdkApiKeyAdminBody(request), RequestBodyTooLargeError);
  assert.equal(request.bodyUsed, false);
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

test("SDK API key mutations authenticate and rate-limit before bounded body parsing or business DB work", async () => {
  const collectionRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/route.ts", import.meta.url), "utf8");
  const itemRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/[id]/route.ts", import.meta.url), "utf8");
  const criticalRateLimit = await readFile(new URL("../src/lib/critical-rate-limit.ts", import.meta.url), "utf8");
  const bodyMutationSlices = [
    collectionRoute.slice(collectionRoute.indexOf("export async function POST")),
    itemRoute.slice(itemRoute.indexOf("export async function PATCH"), itemRoute.indexOf("export async function DELETE")),
  ];

  for (const source of bodyMutationSlices) {
    const auth = source.indexOf("await checkAdmin(req,");
    const permission = source.indexOf('checkSdkApiKeyPermission(req, "write")');
    const limited = source.indexOf("enforceCriticalRateLimit(req");
    const body = source.indexOf("readSdkApiKeyAdminBody(req)");
    const schema = source.indexOf("await ensureSdkSchema()", body);
    assert.ok(auth >= 0 && auth < permission, "authentication must precede authorization");
    assert.ok(permission < limited, "authorization must precede rate limiting");
    assert.ok(limited < body, "rate limiting must precede body reads");
    assert.ok(body < schema, "bounded body parsing must precede business DB work");
    assert.doesNotMatch(source.slice(0, schema), /req\.json\(\)/);
    assert.match(source, /adminCriticalRateLimitIdentity\(req\)/);
    assert.match(source, /tenantWide:\s*true/);
  }

  const deleteSlice = itemRoute.slice(itemRoute.indexOf("export async function DELETE"));
  assert.ok(deleteSlice.indexOf("await checkAdmin(req,") < deleteSlice.indexOf('checkSdkApiKeyPermission(req, "write")'));
  assert.ok(deleteSlice.indexOf('checkSdkApiKeyPermission(req, "write")') < deleteSlice.indexOf("enforceCriticalRateLimit(req"));
  assert.ok(deleteSlice.indexOf("enforceCriticalRateLimit(req") < deleteSlice.indexOf("await ensureSdkSchema()"));
  assert.match(deleteSlice, /adminCriticalRateLimitIdentity\(req\)/);
  assert.match(deleteSlice, /tenantWide:\s*true/);
  assert.match(criticalRateLimit, /tenantId:\s*principal\.tenantId\s*\|\|\s*"platform"/);
  assert.match(criticalRateLimit, /subjectId:\s*`admin-user:\$\{principal\.userId\}`/);
});

test("SDK API key lifecycle is delegated to durable tenant-scoped PostgreSQL writers", async () => {
  const collectionRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/route.ts", import.meta.url), "utf8");
  const itemRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/[id]/route.ts", import.meta.url), "utf8");
  const lifecycle = await readFile(new URL("../src/lib/sdk-api-key-lifecycle.ts", import.meta.url), "utf8");
  const policy = await readFile(new URL("../src/app/admin/sdk/api-keys/policy.ts", import.meta.url), "utf8");

  assert.match(collectionRoute, /nexid_create_tenant_api_key_v2/);
  assert.match(itemRoute, /nexid_mutate_tenant_api_key_v1/g);
  assert.match(collectionRoute, /hasSdkApiKeyLifecycleV1/);
  assert.match(itemRoute, /hasSdkApiKeyLifecycleV1/);
  assert.match(lifecycle, /tenant_api_key_lifecycle_receipts/);
  assert.match(lifecycle, /tenant_api_key_policy_receipts/);
  assert.match(lifecycle, /trg_tenant_api_key_lifecycle_guard_v1/);
  assert.match(collectionRoute, /sdk_api_key_quota_exceeded/);
  assert.match(collectionRoute, /tenant_id: tenant\.id/);
  assert.match(itemRoute, /tenant_id: tenantId/);
  assert.match(itemRoute, /isSdkApiKeyId\(id\)/);
  assert.match(itemRoute, /already_revoked/);
  assert.match(policy, new RegExp(SDK_API_KEY_LIFECYCLE_REQUIRED_MIGRATION.replaceAll(".", "\\.")));
});

test("SDK API key mutation responses expose the raw secret only on successful creation", async () => {
  const collectionRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/route.ts", import.meta.url), "utf8");
  const itemRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/[id]/route.ts", import.meta.url), "utf8");

  assert.equal(collectionRoute.match(/secret:\s*rawKey/g)?.length, 1);
  assert.match(collectionRoute, /secret:\s*rawKey,[\s\S]*?},\s*201,\s*NO_STORE\)/);
  assert.doesNotMatch(itemRoute, /\bsecret\s*:/);
});

test("SDK API key PATCH has an explicit field allowlist and cannot accept arbitrary lifecycle data", async () => {
  const itemRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/[id]/route.ts", import.meta.url), "utf8");

  assert.match(itemRoute, /const PATCH_FIELDS = new Set\(\["name", "scopes", "status"\]\)/);
  assert.match(itemRoute, /Object\.keys\(body\)\.filter\(\(field\) => !PATCH_FIELDS\.has\(field\)\)/);
  assert.match(itemRoute, /sdk_api_key_update_fields_invalid/);
  assert.match(itemRoute, /parseSdkApiKeyStatusPatch/);
});

test("SDK API key credential mutations require MFA, reject server-owned fields and disable caching", async () => {
  const collectionRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/route.ts", import.meta.url), "utf8");
  const itemRoute = await readFile(new URL("../src/app/admin/sdk/api-keys/[id]/route.ts", import.meta.url), "utf8");
  const sdkAuth = await readFile(new URL("../src/lib/sdk-auth.ts", import.meta.url), "utf8");

  assert.match(collectionRoute, /const POST_FIELDS = new Set/);
  assert.match(collectionRoute, /sdk_api_key_create_fields_invalid/);
  assert.match(collectionRoute, /sdk_api_key_mutation_mfa_required/);
  assert.match(itemRoute, /sdk_api_key_mutation_mfa_required/g);
  assert.match(collectionRoute, /tenant_selector_conflict/);
  assert.match(collectionRoute, /WHERE id = \$\{principal\.tenantId\}::uuid/);
  assert.doesNotMatch(collectionRoute, /WHERE slug = \$\{tenantSlug\} OR id::text/);
  assert.match(collectionRoute, /200, NO_STORE/);
  assert.match(itemRoute, /200, NO_STORE/g);
  assert.match(sdkAuth, /SET last_used_at = now\(\)/);
  assert.doesNotMatch(sdkAuth, /SET last_used_at = now\(\), updated_at = now\(\)/);
});

test("SDK API key mutations use the shared critical policy without weakening existing fleet classes", () => {
  assert.equal(classifyFleetRateLimit("/admin/sdk/api-keys", "POST"), "public_write");
  assert.equal(classifyFleetRateLimit("/admin/sdk/api-keys/key-id", "PATCH"), "public_write");
  assert.equal(classifyFleetRateLimit("/admin/sdk/api-keys/key-id", "DELETE"), "public_write");
  assert.equal(classifyFleetRateLimit("/admin/sdk/api-keys", "GET"), "public");
});
