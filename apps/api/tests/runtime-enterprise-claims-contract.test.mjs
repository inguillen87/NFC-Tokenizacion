import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const carrierProfiles = source("../src/lib/carrier-profiles.ts");
const triviaService = source("../src/lib/trivia-service.ts");
const loyaltyRoute = source("../src/app/mobile/passport/[eventId]/loyalty/route.ts");
const marketplaceRoute = source("../src/app/marketplace/p2p/buy/route.ts");
const productAssetProfile = source("../src/lib/product-asset-profile.ts");
const sunDiagnostics = source("../src/lib/sun-diagnostics.ts");
const consumerAuthProvider = source("../src/lib/consumer-auth-provider.ts");
const useCases = source("../../../packages/config/src/use-cases.ts");
const i18n = source("../../../packages/config/src/i18n.ts");
const pricing = source("../../../packages/config/src/pricing.ts");
const assistantRoute = source("../src/app/assistant/chat/route.ts");
const realtimeRoute = source("../src/app/realtime/session/route.ts");
const publicProofDemos = source("../src/lib/public-proof-demos.ts");
const sunRoute = source("../src/app/sun/route.ts");
const proofVerifyRoute = source("../src/app/public/proof/verify/route.ts");
const proofDecodeRoute = source("../src/app/public/proof/decode/route.ts");
const publicLeadsRoute = source("../src/app/public/leads/route.ts");

test("carrier and loyalty copy describe eligible NFC evidence without certifying a physical product", () => {
  assert.match(carrierProfiles, /headline: "Mensaje NFC criptografico"/);
  assert.match(carrierProfiles, /headline: "Mensaje NFC \+ estado TT reportado"/);
  assert.match(carrierProfiles, /No certifica por si solo el contenido ni la condicion fisica/);
  assert.doesNotMatch(carrierProfiles, /headline: "Autenticidad(?: criptografica| \+ sello fisico)"/);

  assert.match(loyaltyRoute, /evento NFC elegible/);
  assert.match(loyaltyRoute, /evento NFC elegível/);
  assert.match(loyaltyRoute, /eligible NFC event/);
  assert.doesNotMatch(loyaltyRoute, /productos auténticos|produtos autênticos|authentic products/i);
});

test("trivia treats origin as issuer-declared data, not a fact proven by a tap", () => {
  assert.match(triviaService, /Origen declarado por \$\{brand\} y lote asociado al evento NFC/);
  assert.match(triviaService, /no prueba por si solo el origen ni el recorrido fisico/);
  assert.doesNotMatch(triviaService, /Origen verificado por NFC/);
});

test("marketplace fallback never upgrades an unconfirmed record into verified physical custody", () => {
  assert.match(marketplaceRoute, /p2p_settlement_unavailable/);
  assert.match(marketplaceRoute, /No purchase or blockchain transfer was executed/);
  assert.match(marketplaceRoute, /durable settlement coordinator/);
  assert.doesNotMatch(marketplaceRoute, /transferBlockchainToken/);
  assert.doesNotMatch(marketplaceRoute, /completed under verified custody/);
});

test("product asset defaults describe a tenant-declared digital reference, not a certified physical object", () => {
  assert.match(productAssetProfile, /referencia digital declarada por la marca/);
  assert.match(productAssetProfile, /origen declarado/);
  assert.match(productAssetProfile, /no prueba propiedad ni autenticidad fisica/);
  assert.match(productAssetProfile, /no certifica el item fisico/);
  assert.doesNotMatch(productAssetProfile, /Zapatillas autenticadas|Prenda premium autenticada|producto real|prueba de origen|viaja por canal autorizado/);
});

test("historical SUN diagnostics and consumer login avoid physical-authenticity verdicts", () => {
  assert.match(sunDiagnostics, /Mensaje NFC disponible en modo consulta; sin veredicto sobre el producto fisico/);
  assert.doesNotMatch(sunDiagnostics, /Autenticidad visible en modo consulta/);

  assert.match(consumerAuthProvider, /Global Digital Identity Passport/);
  assert.match(consumerAuthProvider, /pasaporte de identidad digital/);
  assert.match(consumerAuthProvider, /Este acceso no autentica por sí solo ningún producto físico/);
  assert.doesNotMatch(consumerAuthProvider, /Global Authenticity Passport|pasaporte digital de autenticidad/);
});

test("shared commercial config scopes NFC claims to message evidence and reported TT state", () => {
  assert.match(useCases, /Verificacion del mensaje NFC\/SUN, lote y origen declarados, estado TT reportado/);
  assert.doesNotMatch(useCases, /Autenticidad, lote, experiencia premium/);

  assert.match(i18n, /Verificación de mensajes NFC, controles antifraude e identidad digital/);
  assert.match(i18n, /Verificação de mensagens NFC, controles antifraude e identidade digital/);
  assert.match(i18n, /NFC message verification, anti-fraud controls and digital product identity/);
  assert.match(i18n, /evidencia criptográfica, anti-replay y estado TT reportado/);
  assert.match(i18n, /evidência criptográfica, anti-replay e estado TT reportado/);
  assert.match(i18n, /cryptographic evidence, anti-replay controls and reported TT state/);
  assert.match(i18n, /no autentica por sí solo el producto físico/);
  assert.match(i18n, /o tag sozinho não autentica o produto físico/);
  assert.match(i18n, /the tag alone does not authenticate the physical product/);

  assert.doesNotMatch(i18n, /autenticación de producto de alta seguridad|autenticação de alta segurança|high-security authentication/i);
  assert.doesNotMatch(i18n, /Validación SUN, detección de duplicados, alertas de tamper y control de eventos en tiempo real/);
  assert.doesNotMatch(i18n, /Validação SUN, detecção de duplicatas, alertas tamper e eventos em tempo real/);
  assert.doesNotMatch(i18n, /SUN validation, duplicate detection, tamper alerts and real-time events/);
});

test("secure demo seeds disclose the limits of SUN and TT evidence", () => {
  const seeds = [
    source("../prisma/demo/wine-secure/wine-secure_seed.json"),
    source("../prisma/demo/cosmetics-secure/cosmetics-secure_seed.json"),
    source("../prisma/demo/pharma-secure/pharma-secure_seed.json"),
  ];

  for (const rawSeed of seeds) {
    const seed = JSON.parse(rawSeed);
    const claims = `${seed.narrative}\n${seed.why_nfc_over_qr}`;
    assert.match(claims, /SUN|cryptographic/i);
    assert.match(claims, /not (?:by itself|by themselves|standalone)/i);
    assert.doesNotMatch(claims, /prove unopened|prove chain-of-custody|validate originality|bottle authenticity/i);
  }
});

test("custody documentation separates historically staged SOFTWARE wrapping from current runtime evidence and target direct signing", () => {
  const architecture = source("../../../docs/enterprise-kms-cloudflare-architecture.md");
  assert.match(architecture, /implemented and historically staged blockchain pilot mode is `kms_wrapped`/i);
  assert.match(architecture, /Do not infer that an arbitrary current environment is configured or healthy/i);
  assert.doesNotMatch(architecture, /current blockchain pilot mode is `kms_wrapped`/i);
  assert.match(architecture, /`SOFTWARE` protection level/);
  assert.match(architecture, /not direct KMS signing, a non-exportable workload key or HSM custody/i);
  assert.match(architecture, /label it `HSM-backed` or `non-exportable` only after/i);
  assert.doesNotMatch(architecture, /Blockchain signing uses a separate non-exportable secp256k1 key/);
});

test("pricing and sales assistants scope 424 claims to dynamic message evidence and reported TT state", () => {
  assert.match(pricing, /SUN message verification, replay and copy-resistance signals, reported TT state/);
  assert.match(pricing, /Replay\/duplicate alerts/);
  assert.match(pricing, /Reported TT workflows/);
  assert.doesNotMatch(pricing, /SUN verification, anti-clone, tamper awareness/);

  for (const route of [assistantRoute, realtimeRoute]) {
    assert.match(route, /SUN\/SDM message evidence|evidencia dinamica de mensaje SUN\/SDM|evidencia dinamica de mensagem SUN\/SDM/);
    assert.match(route, /does not by itself certify the physical|no certifica por si solo el producto fisico|nao certifica sozinho o produto fisico/);
    assert.doesNotMatch(route, /must prove authenticity, route, owner|precisa provar autenticidade, rota, dono|necesita probar autenticidad, ruta, dueno/);
  }
});

test("pharma public proof distinguishes recorded checkpoints from continuous physical conditions", () => {
  assert.match(publicProofDemos, /no prueba continuidad fuera de esa observacion/);
  assert.match(publicProofDemos, /el evento no certifica integridad fisica por si solo/);
  assert.match(publicProofDemos, /no prueba cadena de frio continua ni sello fisico/);
  assert.doesNotMatch(publicProofDemos, /Sensor o operador confirma que el rango frio se mantuvo/);
  assert.doesNotMatch(publicProofDemos, /El sello llega intacto/);
});

test("public QR scans fail closed on unknown tenant or batch and never create trusted context", () => {
  const qrStart = sunRoute.indexOf("async function resolveQrTenantBatch");
  const qrEnd = sunRoute.indexOf("async function getPassportSnapshot");
  assert.ok(qrStart >= 0 && qrEnd > qrStart);
  const qrSource = sunRoute.slice(qrStart, qrEnd);

  assert.match(qrSource, /INNER JOIN batches b/);
  assert.match(qrSource, /b\.status = 'active'/);
  assert.match(qrSource, /tn\.status = 'active'/);
  assert.match(qrSource, /reason: "qr_context_not_found"/);
  assert.match(qrSource, /return failQrContext\(422/);
  assert.match(qrSource, /return failQrContext\(404/);
  assert.match(qrSource, /declared_input: declaredInput/);
  assert.match(qrSource, /configuredProductName/);
  assert.match(qrSource, /verdict: "not_registered"/);
  assert.doesNotMatch(qrSource, /INSERT INTO tenants/);
  assert.doesNotMatch(qrSource, /INSERT INTO batches/);
  assert.doesNotMatch(qrSource, /ON CONFLICT \(slug\)/);
  assert.doesNotMatch(qrSource, /QR-DEFAULT/);
  assert.doesNotMatch(qrSource, /verdict: "valid"/);
});

test("QR geography preserves provenance between client-reported and edge-IP coordinates", () => {
  assert.match(sunRoute, /normalizeConsentedApproximateLocation/);
  assert.match(sunRoute, /const hasClientGeo = clientLocation\.accepted/);
  assert.match(sunRoute, /const hasEdgeGeo = edgeCoordinate !== null/);
  assert.match(sunRoute, /hasClientGeo \? "browser_rounded" : hasEdgeGeo \? "ip" : "none"/);
  assert.match(sunRoute, /hasClientGeo \? "browser_gps_approximate_consent" : hasEdgeGeo \? "edge_ip_approx" : "none"/);
  assert.match(sunRoute, /raw_query_location_redacted: true/);
  assert.match(sunRoute, /raw_query_sun_dynamic_redacted: true/);
  assert.match(sunRoute, /redactSensitiveQueryValues/);
  assert.doesNotMatch(sunRoute, /const hasGeo = Number\.isFinite\(browserLat\)/);
  assert.doesNotMatch(sunRoute, /Object\.fromEntries\(input\.url\.searchParams\.entries\(\)\);/);
});

test("SUN passport omits invented quality scores when source data is unavailable", () => {
  const unavailableQualityContracts = sunRoute.match(/quality: \{ score: null, tier: null, basis: "unavailable" \}/g) || [];
  assert.equal(unavailableQualityContracts.length, 2);
  assert.match(sunRoute, /const hasReportedQuality = reportedQualityScore !== null/);
  assert.match(sunRoute, /N\/D · \$\{noScoreLabel\}/);
  assert.doesNotMatch(sunRoute, /deterministic_policy_heuristic/);
  assert.doesNotMatch(sunRoute, /qualityScore|setupScore|trustPenalty|sensorPenalty/);
});

test("SUN browser HTML defaults to the clean web experience and keeps inline HTML as explicit noindex compatibility", () => {
  const inlineSelectorStart = sunRoute.indexOf("function wantsInlineApiHtml");
  const inlineSelectorEnd = sunRoute.indexOf("function webBaseUrl", inlineSelectorStart);
  const inlineSelector = sunRoute.slice(inlineSelectorStart, inlineSelectorEnd);
  assert.ok(inlineSelectorStart >= 0 && inlineSelectorEnd > inlineSelectorStart);
  assert.match(inlineSelector, /return view === "api-html" \|\| view === "legacy-html"/);
  assert.doesNotMatch(inlineSelector, /view === "html"/);

  const redirectStart = sunRoute.indexOf("const webTarget = wantsInlineApiHtml(url)");
  const redirectEnd = sunRoute.indexOf("const shareToken", redirectStart);
  const redirectContract = sunRoute.slice(redirectStart, redirectEnd);
  assert.ok(redirectStart >= 0 && redirectEnd > redirectStart);
  assert.match(redirectContract, /wantsInlineApiHtml\(url\)\s*\?\s*null\s*:\s*buildWebSunSnapshotUrl/);
  assert.match(redirectContract, /return Response\.redirect\(webTarget, 303\)/);

  const inlineResponseStart = sunRoute.indexOf("return new Response(renderSunHtml", redirectEnd);
  const inlineResponseEnd = sunRoute.indexOf("const response = json", inlineResponseStart);
  const inlineResponse = sunRoute.slice(inlineResponseStart, inlineResponseEnd);
  assert.ok(inlineResponseStart >= 0 && inlineResponseEnd > inlineResponseStart);
  assert.match(inlineResponse, /'x-robots-tag': 'noindex, nofollow'/);
  assert.match(inlineResponse, /'referrer-policy': 'no-referrer'/);

  assert.match(sunRoute, /const wineryLat = finiteCoordinate\(contract\.iot\.wineryCoordinates\?\.lat\)/);
  assert.match(sunRoute, /const tapLat = finiteCoordinate\(contract\.tapContext\.lat\)/);
  assert.match(sunRoute, /const mapAvailable = wineryLat !== null && wineryLng !== null && tapLat !== null && tapLng !== null/);
  assert.match(sunRoute, /const routeDistanceKm = mapAvailable/);
  assert.match(sunRoute, /the visual line does not prove a physical route or custody/);
  assert.doesNotMatch(sunRoute, /atlasReferencePath|nexid-evidence-routes/);
  assert.doesNotMatch(sunRoute, /-33\.0086|-68\.7794/);
  assert.match(sunRoute, /code: 'MANUAL_OPENED', label: 'Apertura declarada', summary: 'Un operador declaró el estado abierto\. No es una medición criptográfica del contenido\.'/);
  assert.match(sunRoute, /Mensaje NFC validado; TT reporta cerrado cuando aplica\. Esto no certifica el contenido físico\./);
});

test("public AI routes enforce cost, body and caller boundaries before expensive work", () => {
  const assistantRate = assistantRoute.indexOf("enforceCriticalRateLimit(req");
  const assistantBody = assistantRoute.indexOf("readBoundedJsonBody<Body>");
  const assistantSchema = assistantRoute.indexOf("ensureCrmOpsSchema()");
  assert.ok(assistantRate > 0 && assistantBody > assistantRate && assistantSchema > assistantBody);
  assert.match(assistantRoute, /rateClass: "ai_expensive"/);
  assert.match(assistantRoute, /MAX_HISTORY_ITEMS = 12/);
  assert.match(assistantRoute, /`mode` controls presentation only/);
  assert.match(assistantRoute, /const shouldSaveLead = hasQualifiedLeadData && commercialIntent/);
  assert.match(assistantRoute, /leadSaved = await upsertLeadCompat/);
  assert.match(assistantRoute, /persistenceIncomplete \? 503 : 200/);

  const realtimeRate = realtimeRoute.indexOf("enforceCriticalRateLimit(req");
  const realtimeBody = realtimeRoute.indexOf("readRequestTextBounded(req");
  const realtimeProvider = realtimeRoute.indexOf("https://api.openai.com/v1/realtime/calls");
  assert.ok(realtimeRate > 0 && realtimeBody > realtimeRate && realtimeProvider > realtimeBody);
  assert.match(realtimeRoute, /NEXID_REALTIME_PUBLIC_ENABLED/);
  assert.match(realtimeRoute, /authorizedRealtimeCaller/);
  assert.match(realtimeRoute, /MAX_SDP_BYTES = 64 \* 1024/);
  assert.match(realtimeRoute, /realtime_provider_response_too_large/);
});

test("public proof inputs fail on oversize instead of truncating to a valid prefix", () => {
  for (const route of [proofVerifyRoute, proofDecodeRoute]) {
    assert.match(route, /enforceCriticalRateLimit/);
    assert.match(route, /proof_input_too_large/);
    assert.doesNotMatch(route, /readText\([^;]+\)\.slice\(/s);
  }
});

test("public lead intake is bounded, rate-limited, idempotent and honest about delivery", () => {
  const rate = publicLeadsRoute.indexOf("enforceCriticalRateLimit(req");
  const body = publicLeadsRoute.indexOf("readBoundedJsonBody<Record<string, unknown>>");
  assert.ok(rate > 0 && body > rate);
  assert.match(publicLeadsRoute, /idempotencyKey/);
  assert.match(publicLeadsRoute, /companion_ticket_not_created/);
  assert.match(publicLeadsRoute, /turnstile: "not_configured"/);
});

test("SUN makes simulated and reported sensor provenance prominent", () => {
  assert.match(sunRoute, /SIMULATED - NOT MEASURED/);
  assert.match(sunRoute, /SIMULADO - NO MEDIDO/);
  assert.match(sunRoute, /REPORTED - NOT INDEPENDENTLY VERIFIED/);
  assert.match(sunRoute, /sensorEvidenceKind === "reported"/);
  assert.match(sunRoute, /no sensor measured them/);
});
