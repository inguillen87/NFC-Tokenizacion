import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [sw, page, client, store, route, model, sunPage, publicCache, manifest] = await Promise.all([
  read("../public/sw.js"),
  read("../src/app/offline/page.tsx"),
  read("../src/app/offline/offline-queue-client.tsx"),
  read("../src/app/offline/offline-store.ts"),
  read("../src/app/api/offline/sun-sync/route.ts"),
  read("../src/lib/offline-sun-contract.ts"),
  read("../src/app/sun/page.tsx"),
  read("../src/app/sun/offline-public-product-cache.tsx"),
  read("../src/app/manifest.ts"),
]);

test("service worker captures only valid same-origin SUN navigations", () => {
  const context = vm.createContext({
    AbortController,
    Error,
    Promise,
    Request,
    Response,
    Set,
    TextEncoder,
    URL,
    URLSearchParams,
    clearTimeout,
    crypto,
    fetch: () => Promise.reject(new Error("unused")),
    indexedDB: {},
    setTimeout,
    self: {
      addEventListener() {},
      clients: { claim() {}, matchAll: async () => [] },
      location: { origin: "https://web.example.test" },
      skipWaiting() {},
    },
    caches: {},
  });
  vm.runInContext(sw, context);

  const validUrl = `https://web.example.test/sun?v=1&bid=PILOT-2026-001&picc_data=0011223344556677&enc=00112233445566778899AABBCCDDEEFF&cmac=0011223344556677`;
  const normalized = vm.runInContext(`normalizeSunNavigation(new URL(${JSON.stringify(validUrl)}))`, context);
  assert.equal(normalized.bid, "PILOT-2026-001");
  assert.equal(normalized.enc, "00112233445566778899AABBCCDDEEFF");
  assert.equal(
    vm.runInContext(`normalizeSunNavigation(new URL(${JSON.stringify(validUrl.replace("/sun?", "/sun/?"))})).bid`, context),
    "PILOT-2026-001",
  );
  assert.equal(
    vm.runInContext(`normalizeSunNavigation(new URL(${JSON.stringify(validUrl.replace("web.example.test", "attacker.invalid"))}))`, context),
    null,
  );
  assert.equal(
    vm.runInContext(`normalizeSunNavigation(new URL(${JSON.stringify(`${validUrl}&cmac=0011223344556677`)}))`, context),
    null,
  );
});

test("PWA queue is local, deduplicated, bounded and routes failed SUN navigation to /offline", () => {
  assert.match(sw, /APP_SHELL[\s\S]*"\/offline"/);
  assert.match(manifest, /name: "Cola offline"[\s\S]*url: "\/offline"/);
  assert.match(sw, /function isSunPath\(pathname\)[\s\S]*pathname === "\/sun"/);
  assert.match(sw, /enqueueFailedSunNavigation\(url\)/);
  assert.match(sw, /indexedDB\.open\(OFFLINE_DB_NAME, OFFLINE_DB_VERSION\)/);
  assert.match(sw, /store\.get\(id\)/);
  assert.match(sw, /duplicateCount/);
  assert.match(sw, /MAX_OFFLINE_SCANS = 25/);
  assert.match(sw, /MAX_OFFLINE_AGE_MS/);
  assert.match(store, /MAX_CACHED_PRODUCTS = 50/);
  assert.match(store, /MAX_CACHED_PRODUCT_AGE_MS/);
  assert.match(sw, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(sw, /new URL\("\/offline", self\.location\.origin\)/);
  assert.doesNotMatch(sw, /https:\/\/(?:api\.)?nexid\.lat\/sun/);
  assert.doesNotMatch(`${sw}\n${store}\n${client}`, /K_META|K_FILE|KMS/);
});

test("offline page exposes exact pending truth and no sensitive action enablement", () => {
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(client, /Verificación pendiente/);
  assert.match(client, /VERIFICATION_PENDING/);
  assert.match(client, /Sin conexión\. La información pública está disponible\. La autenticidad criptográfica se confirmará al recuperar conexión\./);
  assert.match(client, /PENDING_BACKEND_VERIFICATION/);
  assert.match(client, /SYNCED_VALID/);
  assert.match(client, /SYNCED_INVALID/);
  assert.match(client, /REPLAY_SUSPECT/);
  assert.match(client, /SYNC_FAILED/);
  assert.match(client, /navigator\.onLine/);
  assert.match(client, /navigator\.locks\.request\("nexid-offline-sun-sync"/);
  assert.match(client, /window\.addEventListener\("online"/);
  assert.match(client, /fetch\("\/api\/offline\/sun-sync"/);
  assert.doesNotMatch(client, /Autenticidad confirmada|Sello intacto|Sello abierto|Ownership claim enabled|Warranty enabled|Tokenization enabled/);
  assert.doesNotMatch(client, /record\.params\.(?:picc_data|enc|cmac)/);
});

test("same-origin BFF is bounded, rate-limited, non-redirecting and redacted", () => {
  assert.match(route, /isSameOriginRequest\(req\)/);
  assert.match(route, /isJsonRequest\(req\)/);
  assert.match(route, /MAX_PAYLOAD_BYTES = 4_096/);
  assert.match(route, /readBoundedText\(req, MAX_PAYLOAD_BYTES\)/);
  assert.match(route, /consumePublicApiRateLimit\("offline-sun-sync"/);
  assert.match(route, /Object\.keys\(body\).*ALLOWED_BODY_KEYS/s);
  assert.match(route, /offlineSunIdFromParams\(normalized\.params\)/);
  assert.match(route, /executeConfiguredOfflineSunSync\(productUrls\.api, normalized\.params\)/);
  assert.match(model, /buildConfiguredSunTarget\(apiBase, params\)/);
  assert.match(model, /redirect: "error"/);
  assert.match(model, /maxResponseBytes \?\? 65_536/);
  assert.match(model, /redactOfflineSunUpstream/);
  assert.match(route, /"cache-control": "no-store"/);
  assert.doesNotMatch(route, /body\.(?:url|origin|host|protocol)/);
  assert.doesNotMatch(route, /authorization|cookie|x-forwarded-for/i);
  assert.doesNotMatch(route, /new URL\([^\n]*(?:body|req\.)/);
});

test("online passport caches only bounded public product context for later offline display", () => {
  assert.match(sunPage, /<OfflinePublicProductCache/);
  assert.match(sunPage, /enabled=\{!isDemoPreview && result\.ok === true && Boolean\(bid\)\}/);
  assert.match(publicCache, /cacheOfflinePublicProduct/);
  assert.match(publicCache, /publicText\(name, 120\)/);
  assert.doesNotMatch(publicCache, /uid|readCounter|cmac|picc_data|enc|token|secret/i);
  assert.match(model, /sanitizePublicProduct/);
  assert.doesNotMatch(model, /identity\?\.(?:uid|tenantId)|technical\?\.raw/);
});
