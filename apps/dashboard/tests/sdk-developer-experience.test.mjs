import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  buildWebhookVerificationQuickstart,
  buildVerifyQuickstart,
  combineDeveloperDataModes,
  developerErrorMessage,
  developerMutationsAllowed,
  developerReadiness,
  isCurrentDeveloperLoad,
  NEXID_WEBHOOK_SIGNATURE_CONTRACT,
  resolveDeveloperResponseDataMode,
  SDK_INTEGRATION_PROFILES,
  SDK_SCOPE_OPTIONS,
  stringList,
  WEBHOOK_EVENT_OPTIONS,
} = await import("../src/lib/sdk-developer-experience.ts");

const consoleSource = await readFile(new URL("../src/components/sdk-admin-console.tsx", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../src/app/(app)/api-keys/page.tsx", import.meta.url), "utf8");

test("integration profiles are least-privilege paths for pilot, commerce and enterprise", () => {
  assert.deepEqual(SDK_INTEGRATION_PROFILES.map((profile) => profile.id), ["pilot", "commerce", "supply-chain"]);
  const allowedScopes = new Set(SDK_SCOPE_OPTIONS.map((scope) => scope.value));

  for (const profile of SDK_INTEGRATION_PROFILES) {
    assert.ok(profile.scopes.length > 0);
    assert.ok(profile.scopes.length < allowedScopes.size, `${profile.id} must not become a full-access preset`);
    assert.equal(new Set(profile.scopes).size, profile.scopes.length);
    assert.ok(profile.scopes.every((scope) => allowedScopes.has(scope)));
    assert.ok(profile.webhookEvents.every((event) => WEBHOOK_EVENT_OPTIONS.some((candidate) => candidate.value === event)));
  }

  assert.deepEqual(SDK_INTEGRATION_PROFILES[0].scopes, ["sdk:verify", "sdk:products"]);
  assert.ok(SDK_INTEGRATION_PROFILES.find((profile) => profile.id === "commerce").scopes.includes("sdk:pos"));
  assert.ok(SDK_INTEGRATION_PROFILES.find((profile) => profile.id === "supply-chain").scopes.includes("sdk:logistics"));
});

test("SDK profile copy does not upgrade digital or operator evidence into physical proof", () => {
  const verifyScope = SDK_SCOPE_OPTIONS.find((scope) => scope.value === "sdk:verify");
  const logisticsScope = SDK_SCOPE_OPTIONS.find((scope) => scope.value === "sdk:logistics");
  const supplyChain = SDK_INTEGRATION_PROFILES.find((profile) => profile.id === "supply-chain");
  assert.match(verifyScope.description, /no certifica por sí solo el contenido físico/);
  assert.match(logisticsScope.description, /no prueba por sí solo contenido ni custodia física/);
  assert.doesNotMatch(supplyChain.description, /operaciones con custodia/);
  assert.equal(SDK_INTEGRATION_PROFILES[0].title, "Evidencia NFC y catálogo");
  assert.equal(
    WEBHOOK_EVENT_OPTIONS.find((event) => event.value === "sdk.verify").description,
    "Resultado de validación del mensaje NFC.",
  );
});

test("quickstart uses the canonical server-side endpoint without embedding a live key", () => {
  const snippets = buildVerifyQuickstart({ tenantSlug: "syngenta-ar", bid: "BATCH-2026-01" });

  for (const snippet of Object.values(snippets)) {
    assert.match(snippet, /https:\/\/api\.nexid\.lat\/api\/v1\/sdk\/verify/);
    assert.match(snippet, /x-nexid-api-key/);
    assert.match(snippet, /x-nexid-tenant-slug/);
    assert.match(snippet, /NEXID_API_KEY/);
    assert.match(snippet, /PICC_DATA_FROM_NFC_READ/);
    assert.doesNotMatch(snippet, /nxid_live_[A-Za-z0-9_-]+/);
    assert.doesNotMatch(snippet, /Authorization: Bearer/);
  }

  assert.match(snippets.curl, /<<'JSON'/);
  assert.match(snippets.node, /if \(!apiKey\) throw new Error/);
  assert.match(snippets.node, /if \(!response\.ok\)/);
  assert.match(snippets.node, /traceId/);
});

test("quickstart sanitizes display inputs before they reach copyable shell code", () => {
  const snippets = buildVerifyQuickstart({
    tenantSlug: "bad tenant; curl attacker",
    bid: "BAD\n$(malicious-command)",
  });

  assert.match(snippets.curl, /x-nexid-tenant-slug: your-tenant/);
  assert.match(snippets.curl, /"bid": "YOUR-BATCH-ID"/);
  assert.doesNotMatch(snippets.curl, /malicious-command/);
});

test("readiness gates the first call but keeps async webhooks optional", () => {
  const beforeWebhook = developerReadiness({
    tenantSelected: true,
    activeKeys: 1,
    monthRequests: 1,
    enabledWebhooks: 0,
    successfulDeliveries: 0,
  });
  assert.equal(beforeWebhook.productionReady, true);
  assert.equal(beforeWebhook.percentage, 100);
  assert.equal(beforeWebhook.steps.find((step) => step.id === "webhook").optional, true);

  const incomplete = developerReadiness({
    tenantSelected: true,
    activeKeys: 1,
    monthRequests: 0,
    enabledWebhooks: 1,
    successfulDeliveries: 1,
  });
  assert.equal(incomplete.productionReady, false);
  assert.equal(incomplete.requiredComplete, 2);
});

test("demo fallback signals survive response parsing and never count as production readiness", () => {
  assert.equal(resolveDeveloperResponseDataMode({
    payload: [{ id: "demo-webhook" }],
    headerDataMode: "demo",
    headerDemoData: "DEMO DATA",
  }), "demo");
  assert.equal(resolveDeveloperResponseDataMode({
    payload: { demoMode: true, dataSource: "demo" },
  }), "demo");
  assert.equal(resolveDeveloperResponseDataMode({ payload: { ok: true } }), "production");
  assert.equal(combineDeveloperDataModes(["production", "demo", "production"]), "demo");

  const demoReadiness = developerReadiness({
    tenantSelected: true,
    activeKeys: 1,
    monthRequests: 61,
    enabledWebhooks: 1,
    successfulDeliveries: 1,
    dataMode: "demo",
  });
  assert.equal(demoReadiness.productionReady, false);
  assert.equal(demoReadiness.requiredComplete, 0, "demo fallback must not satisfy any production readiness gate");
  assert.equal(demoReadiness.steps.find((step) => step.id === "tenant").complete, false);
  assert.equal(demoReadiness.steps.find((step) => step.id === "key").complete, false);
  assert.equal(demoReadiness.steps.find((step) => step.id === "first-call").complete, false);
  const unscopedReadiness = developerReadiness({
    tenantSelected: false,
    activeKeys: 20,
    monthRequests: 500,
    enabledWebhooks: 3,
    successfulDeliveries: 30,
    dataMode: "production",
  });
  assert.equal(unscopedReadiness.requiredComplete, 0, "global aggregates must not count as tenant readiness");
  assert.match(consoleSource, /x-nexid-data-mode/);
  assert.match(consoleSource, /DEMO DATA · sólo lectura/);
  assert.match(consoleSource, /No cuentan como readiness de producción/);
});

test("tenant loads reject aborted or out-of-order responses and hide previous rows", () => {
  assert.equal(isCurrentDeveloperLoad({ requestId: 4, activeRequestId: 4 }), true);
  assert.equal(isCurrentDeveloperLoad({ requestId: 3, activeRequestId: 4 }), false);
  assert.equal(isCurrentDeveloperLoad({ requestId: 4, activeRequestId: 4, aborted: true }), false);
  assert.match(consoleSource, /new AbortController\(\)/);
  assert.match(consoleSource, /loadSequenceRef\.current/);
  assert.match(consoleSource, /clearOperationalData\(\)/);
  assert.match(consoleSource, /!loading \? keys\.map/);
  assert.match(consoleSource, /!loading \? webhooks\.map/);
  assert.match(consoleSource, /!loading \? deliveries\.map/);
});

test("readonly demo disables every developer mutation before the proxy can return 403", () => {
  assert.equal(developerMutationsAllowed({ dataMode: "demo", loading: false }), false);
  assert.equal(developerMutationsAllowed({ dataMode: "unknown", loading: false }), false);
  assert.equal(developerMutationsAllowed({ dataMode: "production", loading: true }), false);
  assert.equal(developerMutationsAllowed({ dataMode: "production", loading: false }), true);
  assert.equal((consoleSource.match(/if \(!ensureMutationAllowed\(\)\) return/g) || []).length, 5);
  assert.match(consoleSource, /disabled=\{!mutationsAllowed[^}]*\}/);
  assert.match(consoleSource, /developer-mutation-gate/);
});

test("webhook verifier defaults to v2, authenticates key ID and keeps explicit v1 compatibility", () => {
  const snippet = buildWebhookVerificationQuickstart();
  assert.deepEqual(NEXID_WEBHOOK_SIGNATURE_CONTRACT.headers, {
    version: "x-nexid-signature-version",
    timestamp: "x-nexid-timestamp",
    keyId: "x-nexid-key-id",
    deliveryId: "x-nexid-delivery-id",
    eventId: "x-nexid-event-id",
    signature: "x-nexid-signature",
  });
  for (const header of Object.values(NEXID_WEBHOOK_SIGNATURE_CONTRACT.headers)) {
    assert.match(snippet, new RegExp(header));
  }
  assert.match(snippet, /process\.env\.NEXID_WEBHOOK_SECRET/);
  assert.equal(NEXID_WEBHOOK_SIGNATURE_CONTRACT.version, "v2");
  assert.deepEqual(NEXID_WEBHOOK_SIGNATURE_CONTRACT.supportedVersions, ["v1", "v2"]);
  assert.match(snippet, /version === "v1" \|\| version === "v2"/);
  assert.match(snippet, /Buffer\.byteLength\(keyId, "utf8"\)/);
  assert.match(snippet, /Buffer\.byteLength\(deliveryId, "utf8"\)/);
  assert.match(snippet, /Buffer\.byteLength\(eventId, "utf8"\)/);
  assert.match(snippet, /rawBody\.byteLength/);
  assert.match(snippet, /createHmac\("sha256", secret\)/);
  assert.match(snippet, /timingSafeEqual\(received, expected\)/);
  assert.ok(snippet.indexOf("timingSafeEqual(received, expected)") < snippet.indexOf("JSON.parse(rawBody"));
  assert.doesNotMatch(snippet, /nxid_live_|whsec_|webhookSecret/);
  assert.match(consoleSource, /Implementar verificación de firma v2/);
  assert.match(consoleSource, /key ID no debe usarse para seleccionar secretos/);
});

test("backend reasons become actionable developer copy without hiding unknown diagnostics", () => {
  assert.match(developerErrorMessage("webhook_signing_secret_too_short", "fallback"), /32 bytes/);
  assert.match(developerErrorMessage("rate_limited", "fallback"), /Retry-After/);
  assert.equal(developerErrorMessage("new_safe_reason", "fallback"), "new safe reason");
  assert.equal(developerErrorMessage("", "fallback"), "fallback");
});

test("JSON and comma-delimited database fields render as stable lists", () => {
  assert.deepEqual(stringList('["sdk:verify","sdk:products"]'), ["sdk:verify", "sdk:products"]);
  assert.deepEqual(stringList("sdk.verify, sdk.external_event"), ["sdk.verify", "sdk.external_event"]);
  assert.deepEqual(stringList(null), []);
});

test("developer hub exposes explicit empty, error, one-time-secret and webhook delivery states", () => {
  assert.match(pageSource, /Piloto \/ pyme/);
  assert.match(pageSource, /Enterprise/);
  assert.match(consoleSource, /De cero a primera llamada/);
  assert.match(consoleSource, /role="progressbar"/);
  assert.match(consoleSource, /role="tablist"/);
  assert.match(consoleSource, /key === "ArrowRight"/);
  assert.match(consoleSource, /snippetTabRefs\.current\[next\]\?\.focus\(\)/);
  assert.match(consoleSource, /Secreto visible una sola vez/);
  assert.match(consoleSource, /Ya lo guardé, ocultar/);
  assert.match(consoleSource, /Todavía no hay API keys/);
  assert.match(consoleSource, /Aún no hay entregas/);
  assert.match(consoleSource, /notice\.tone === "error" \? "alert" : "status"/);
  assert.match(consoleSource, /notice\.tone === "error" && loadFailed \? load : undefined/);
  assert.match(consoleSource, /Retry-After/);
});

test("webhook UX requires signatures, uses existing events and does not invent redelivery", () => {
  assert.doesNotMatch(consoleSource, /signingSecret:\s*webhookSecret/);
  assert.doesNotMatch(consoleSource, /id="webhook-secret"\s+type="password"/);
  assert.match(consoleSource, /asRecord\(created\.data\)\.secret/);
  assert.match(consoleSource, /events: selectedWebhookEvents/);
  assert.match(consoleSource, /signatureVersion: "v2"/);
  assert.match(consoleSource, /expectedSecretVersion: Number\(row\.signing_secret_version\)/);
  assert.match(consoleSource, /overlapSeconds: 3600/);
  assert.match(consoleSource, /Rotar secreto/);
  assert.match(consoleSource, /Reactivar \+ secreto nuevo/);
  assert.match(consoleSource, /Eliminar y destruir secreto/);
  assert.match(consoleSource, /Sólo se aceptan destinos HTTPS públicos/);
  assert.match(consoleSource, /row\.signature_version \|\| "legacy"/);
  assert.match(consoleSource, /attempt_count/);
  assert.match(consoleSource, /next_attempt_at/);
  assert.doesNotMatch(consoleSource, /Redeliver|Reenviar entrega|\/redeliver/);
  assert.doesNotMatch(consoleSource, /Signing secret opcional/);
});

test("key lifecycle UX sends an expiry and requires confirmation before revocation", () => {
  assert.match(consoleSource, /expiresAt: keyExpiryDays === "never"/);
  assert.match(consoleSource, /new Date\(Date\.now\(\) \+ Number\(keyExpiryDays\)/);
  assert.match(consoleSource, /window\.confirm\(`/);
  assert.match(consoleSource, /La integración dejará de autenticar inmediatamente/);
  assert.match(consoleSource, /Sin vencimiento/);
});
