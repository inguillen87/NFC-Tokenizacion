import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sdkRoutes = [
  "../src/app/api/v1/sdk/verify/route.ts",
  "../src/app/api/v1/sdk/claim/route.ts",
  "../src/app/api/v1/sdk/events/route.ts",
  "../src/app/api/v1/sdk/pos/activate/route.ts",
  "../src/app/api/v1/sdk/products/[bid]/route.ts",
  "../src/app/api/v1/sdk/offline-sync/route.ts",
];

test("every SDK route applies source limiting before auth SQL and tenant/API-key limiting before business work", () => {
  for (const route of sdkRoutes) {
    const source = readFileSync(new URL(route, import.meta.url), "utf8");
    const sourceLimit = source.indexOf("enforceSdkAuthenticationRateLimit(req)");
    const authentication = source.indexOf("authenticateSdkRequest(req");
    const authenticatedLimit = source.indexOf("enforceSdkRateLimit(req, auth.context)");
    const businessWork = [
      source.indexOf("req.json()", authenticatedLimit),
      source.indexOf("readRequestTextBounded(req", authenticatedLimit),
      source.indexOf("ensureSdkSchema()", authenticatedLimit),
      source.indexOf("ensureSupplierOpsSchema()", authenticatedLimit),
      source.indexOf("await sql", authenticatedLimit),
    ].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    assert.ok(sourceLimit >= 0 && sourceLimit < authentication, `${route}: source limiter must precede auth`);
    assert.ok(authentication < authenticatedLimit, `${route}: auth must precede tenant/API-key limiter`);
    assert.ok(authenticatedLimit < businessWork, `${route}: limiter must precede body/schema/business SQL`);
  }
});

test("offline sync binds identity to SDK auth, bounds payloads and deduplicates atomically", () => {
  const source = readFileSync(new URL("../src/app/api/v1/sdk/offline-sync/route.ts", import.meta.url), "utf8");
  assert.match(source, /const MAX_BODY_BYTES = 256 \* 1024/u);
  assert.match(source, /const MAX_EVENTS = 100/u);
  assert.match(source, /offline_sync_tenant_mismatch/u);
  assert.match(source, /bundle\.tenant_id = \$\{auth\.context\.tenantId\}/u);
  assert.match(source, /device\.tenant_id = \$\{auth\.context\.tenantId\}/u);
  assert.match(source, /ON CONFLICT \(tenant_id, device_id, client_event_id\) DO NOTHING/u);
  assert.doesNotMatch(source, /prisma\.offlineScanEvent/u);
  assert.doesNotMatch(source, /error\.message|error: error/u);
});

test("SDK IP attribution is centralized and does not parse caller X-Forwarded-For locally", () => {
  for (const route of ["../src/lib/sdk-auth.ts", "../src/app/api/v1/sdk/_shared.ts"]) {
    const source = readFileSync(new URL(route, import.meta.url), "utf8");
    assert.match(source, /getRequestMeta/u, route);
    assert.doesNotMatch(source, /headers\.get\(["']x-forwarded-for["']\)/u, route);
  }
});

test("SUN simulation fails closed, authenticates in constant time and limits before body or chain writes", () => {
  const source = readFileSync(new URL("../src/app/sun/simulate/route.ts", import.meta.url), "utf8");
  const missingKey = source.indexOf("if (!expectedKey)");
  const secretCheck = source.indexOf("if (!secretMatches(providedKey, expectedKey))");
  const limiter = source.indexOf("enforceCriticalRateLimit(req");
  const body = source.indexOf("readRequestTextBounded(req");
  const database = source.indexOf("await sql", body);
  assert.match(source, /timingSafeEqual/u);
  assert.match(source, /globalPrincipal: true/u);
  assert.ok(missingKey >= 0 && missingKey < secretCheck);
  assert.ok(secretCheck < limiter && limiter < body && body < database);
  assert.doesNotMatch(source, /providedKey\s*!==\s*expectedKey|providedKey\s*===\s*expectedKey/u);
});
