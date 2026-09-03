import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
const webPassport = await readFile(new URL("../../web/src/app/sun/page.tsx", import.meta.url), "utf8");
const sensorEvidence = await readFile(new URL("../src/lib/sun-sensor-evidence.ts", import.meta.url), "utf8");

test("physical SUN passport puts official configured product and image in the first mobile card", () => {
  assert.match(route, /name: params\.passport\?\.product_name \|\| params\.passport\?\.sku \|\| fallbackName/);
  assert.match(route, /imageUrl: params\.passport\?\.image_url \|\| fallbackImageUrl/);
  assert.match(route, /image_url: params\.passport\?\.image_url \|\| fallbackImageUrl/);
  assert.match(route, /return Response\.redirect\(webTarget, 303\)/);

  const summaryStart = webPassport.indexOf('data-testid="sun-summary-product"');
  const summaryEnd = webPassport.indexOf('data-testid="sun-summary-status"', summaryStart);
  const firstMobileCard = webPassport.slice(summaryStart, summaryEnd);
  assert.ok(summaryStart >= 0 && summaryEnd > summaryStart);
  assert.match(firstMobileCard, /productHeroImageUrl/);
  assert.match(firstMobileCard, /productDisplayName/);
  assert.match(firstMobileCard, /fetchPriority="high"/);
  assert.match(firstMobileCard, /<SunProductHeroStage/);
});

test("seal state and SUN freshness remain independent above the fold", () => {
  const openedStart = webPassport.indexOf("const isVerifiedOpenedState =");
  const openedEnd = webPassport.indexOf("const isOpenedAttentionState =", openedStart);
  const closedStart = webPassport.indexOf("const isVerifiedClosedState =");
  const closedEnd = webPassport.indexOf("const isInvalidSealState =", closedStart);
  const freshnessStart = webPassport.indexOf("const isFreshCommercialTap =");
  const freshnessEnd = webPassport.indexOf("const isVerifiedClosedState =", freshnessStart);
  assert.ok(openedStart >= 0 && openedEnd > openedStart);
  assert.ok(closedStart >= 0 && closedEnd > closedStart);
  assert.ok(freshnessStart >= 0 && freshnessEnd > freshnessStart);
  assert.match(webPassport.slice(openedStart, openedEnd), /ttStatus === "opened"/);
  assert.doesNotMatch(webPassport.slice(openedStart, openedEnd), /isFresh/);
  assert.match(webPassport.slice(closedStart, closedEnd), /ttStatus === "closed"/);
  assert.doesNotMatch(webPassport.slice(closedStart, closedEnd), /isFresh/);
  assert.match(webPassport.slice(freshnessStart, freshnessEnd), /resolveCommercialTapFreshness/);
  assert.match(route, /freshTap: hasValidatedTagMessage && verdictRisk\.verdict !== "replay_suspect"/);
});

test("manual opening remains an operator declaration and never becomes TT evidence", () => {
  const normalizedRoute = route.replace(/\r\n/g, "\n");
  assert.match(route, /const isManualOpenedState = productState === "VALID_MANUAL_OPENED" \|\| statusCode === "MANUAL_OPENED"/);
  const openedStateStart = route.indexOf("const isOpenedState =");
  const openedStateEnd = route.indexOf("const authPanelMessage =", openedStateStart);
  const openedStateSource = route.slice(openedStateStart, openedStateEnd);
  assert.doesNotMatch(openedStateSource, /VALID_MANUAL_OPENED|MANUAL_OPENED/);
  assert.match(route, /Apertura declarada/);
  assert.match(route, /Un operador declaró el estado abierto\. No es una medición criptográfica del contenido/);
  const manualCopyStart = normalizedRoute.indexOf(": isManualOpenedState\n      ?labels.manualOpened");
  const verifiedOpenedCopyStart = normalizedRoute.indexOf(': isOpenedState\n        ?(copy.lang === "en" ?"NFC message validated; TT reports open.');
  assert.notEqual(manualCopyStart, -1);
  assert.notEqual(verifiedOpenedCopyStart, -1);
  assert.ok(manualCopyStart < verifiedOpenedCopyStart);

  const verifiedTapStart = route.indexOf("const isVerifiedOpenedTap =");
  const verifiedTapEnd = route.indexOf("const hasValidatedTagMessage =", verifiedTapStart);
  const verifiedTapSource = route.slice(verifiedTapStart, verifiedTapEnd);
  assert.doesNotMatch(verifiedTapSource, /MANUAL_OPENED|VALID_MANUAL_OPENED/);

  const setupEvidenceStart = route.indexOf("const setupHasValidTagEvidence =");
  const setupEvidenceEnd = route.indexOf("const setupIsReplay =", setupEvidenceStart);
  assert.doesNotMatch(route.slice(setupEvidenceStart, setupEvidenceEnd), /MANUAL_OPENED|VALID_MANUAL_OPENED/);

  const webVerifiedStart = webPassport.indexOf("const isVerifiedOpenedState =");
  const webVerifiedEnd = webPassport.indexOf("const isOpenedAttentionState =", webVerifiedStart);
  assert.match(webPassport.slice(webVerifiedStart, webVerifiedEnd), /!isManualOpenedState/);
  assert.match(webPassport, /Apertura declarada/);
});

test("technical bytes and action availability use structured contracts on the clean web passport", () => {
  assert.match(route, /function buildPublicSunTechnicalEvidence/);
  assert.match(route, /technical: publicTechnicalEvidence/);
  assert.match(route, /claimOwnership: actionMatrix\.allowedActions\.includes\("claim"\)/);
  assert.match(route, /tokenize: actionMatrix\.allowedActions\.includes\("tokenization"\)/);
  assert.match(webPassport, /ttEvidence\.bytes\.length === 2/);
  assert.match(webPassport, /Byte \{byte\.index\}/);
  assert.match(webPassport, /allowedActions=\{allowedActions\}/);
  assert.match(webPassport, /blockedActions=\{blockedActions\}/);
  assert.match(webPassport, /resolvePostTapQuickActionAvailability\(\{ allowedActions, blockedActions \}\)/);
});

test("technical SUN evidence follows canonical cryptographic verification for every valid TT state", () => {
  const helperStart = route.indexOf("function buildPublicSunTechnicalEvidence");
  const helperEnd = route.indexOf("function buildPublicContract", helperStart);
  const technicalProjection = route.slice(helperStart, helperEnd);
  assert.match(technicalProjection, /cryptographicVerification: resultMeta\.cryptographic_verification === true/);
  assert.doesNotMatch(technicalProjection, /VALID_CLOSED|VALID_OPENED|VALID_OPENED_PREVIOUSLY/);
  assert.equal((route.match(/technical: publicTechnicalEvidence/g) || []).length, 2);
  assert.match(route, /if \(ttEvidence\.raw && !ttEvidence\.state\)/);
});

test("sensor presentation preserves source, timestamp and privacy semantics", () => {
  assert.match(route, /declaredStaticSensorFromLocaleData\(params\.passport\?\.locale_data\)/);
  assert.match(route, /buildSunSensorEvidence\(\{/);
  assert.match(route, /sensorEvidenceKind: sensorEvidence\.kind/);
  assert.match(route, /sensorSnapshot: sensorEvidence\.snapshot/);
  assert.match(route, /sensorHistory,/);
  assert.match(sensorEvidence, /observedAt: input\.observedAt/);
  assert.match(sensorEvidence, /source: event\.sensorSource\?\.trim\(\) \|\| "event_measurement"/);
  assert.match(sensorEvidence, /deviceId: event\.sensorDeviceId\?\.trim\(\) \|\| null/);
  assert.match(sensorEvidence, /Reported readings win\. Synthetic values are emitted only when/);
  assert.match(webPassport, /No asumimos conexión directa con hardware, tiempo real ni medición del chip NFC pasivo/);
});

test("public product history never republishes earlier consumer tap identity or GPS", () => {
  const timelineStart = route.indexOf("async function getTimelineSummary");
  const timelineEnd = route.indexOf("function recordValue", timelineStart);
  const timelineSurface = route.slice(timelineStart, timelineEnd);
  const contractStart = route.indexOf("function buildPublicContract");
  const contractEnd = route.indexOf("function renderSunHtml", contractStart);
  const contractSurface = route.slice(contractStart, contractEnd);

  assert.ok(timelineStart >= 0 && timelineEnd > timelineStart);
  assert.match(timelineSurface, /date_trunc\('day', e\.created_at\)::date::text AS at/);
  assert.match(timelineSurface, /meta->'public_checkpoint'->>'visibility'/);
  assert.doesNotMatch(timelineSurface, /eventId/);
  assert.match(timelineSurface, /device: null/);
  assert.match(timelineSurface, /lat: null/);
  assert.match(timelineSurface, /lng: null/);
  assert.doesNotMatch(timelineSurface, /e\.id::text|e\.device_label|e\.lat\b|e\.lng\b/);
  assert.doesNotMatch(route, /getCtaTimelineSummary|buildLifecycleState/);
  assert.match(route, /listDemoCta\(bid, uid\)/);
  assert.match(route, /actions\.some\(\(item\) => String\(item\.action \|\| ""\) === "tokenize_request"\)/);
  const provenanceProjections = [...contractSurface.matchAll(/provenance:\s*\{([\s\S]*?)\n\s*tokenization:\s*\{/g)]
    .map((match) => match[1]);
  assert.equal(provenanceProjections.length, 2);
  for (const projection of provenanceProjections) {
    assert.doesNotMatch(projection, /params\.passport\?\.(?:first_verified_at|first_city|first_country|last_verified_at|last_city|last_country)/);
    assert.doesNotMatch(projection, /params\.tap\.(?:city|country|lat|lng)/);
  }
});

test("public traceability never rebuilds an exact current tap as a history checkpoint", () => {
  assert.doesNotMatch(
    route,
    /if \(!contract\.provenance\.timelineSummary\.length\)[\s\S]{0,600}stage:\s*["']current_tap["']/,
  );
});
