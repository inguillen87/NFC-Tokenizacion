import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");

test("physical SUN passport puts official configured product and image in the first mobile card", () => {
  const heroStart = route.indexOf('<section class="card hero product-hero"');
  const productDetails = route.indexOf('${copy.identityPanel}');
  assert.ok(heroStart > 0);
  assert.ok(productDetails > heroStart);
  assert.match(route.slice(heroStart, productDetails), /productImageUrl/);
  assert.match(route.slice(heroStart, productDetails), /productName/);
  assert.match(route.slice(heroStart, productDetails), /Perfil oficial del piloto/);
  assert.match(route.slice(heroStart, productDetails), /primaryActionLabel/);
  assert.match(route, /Continuar con mi producto/);
});

test("seal state and SUN freshness remain independent above the fold", () => {
  assert.match(route, /const ttReportsClosed = reportedTtRaw === "4343"/);
  assert.match(route, /reportedTtRaw === "4F4F" \|\| reportedTtRaw === "4F43"/);
  assert.match(route, /Estado electrónico del sello/);
  assert.match(route, /Frescura del enlace SUN/);
  assert.match(route, /Sello abierto/);
  assert.match(route, /Sello cerrado/);
});

test("manual opening remains an operator declaration and never becomes TT evidence", () => {
  assert.match(route, /const isManualOpenedState = productState === "VALID_MANUAL_OPENED" \|\| statusCode === "MANUAL_OPENED"/);
  const openedStateStart = route.indexOf("const isOpenedState =");
  const openedStateEnd = route.indexOf("const sealTone =", openedStateStart);
  const openedStateSource = route.slice(openedStateStart, openedStateEnd);
  assert.doesNotMatch(openedStateSource, /VALID_MANUAL_OPENED|MANUAL_OPENED/);
  assert.match(route, /Apertura declarada/);
  assert.match(route, /Un operador declaró una apertura; la etiqueta digital no la detectó automáticamente/);
  assert.ok(route.indexOf(": isManualOpenedState\n      ?labels.manualOpened") < route.indexOf(': isOpenedState\n        ?(copy.lang === "en" ?"NFC message validated; TT reports open.'));

  const verifiedTapStart = route.indexOf("const isVerifiedOpenedTap =");
  const verifiedTapEnd = route.indexOf("const hasValidatedTagMessage =", verifiedTapStart);
  const verifiedTapSource = route.slice(verifiedTapStart, verifiedTapEnd);
  assert.doesNotMatch(verifiedTapSource, /MANUAL_OPENED|VALID_MANUAL_OPENED/);

  const setupEvidenceStart = route.indexOf("const setupHasValidTagEvidence =");
  const setupEvidenceEnd = route.indexOf("const setupIsReplay =", setupEvidenceStart);
  assert.doesNotMatch(route.slice(setupEvidenceStart, setupEvidenceEnd), /MANUAL_OPENED|VALID_MANUAL_OPENED/);
});

test("technical bytes and unavailable actions are disclosed without a washed-out button wall", () => {
  assert.match(route, /BYTE 1 · MEMORIA PERMANENTE/);
  assert.match(route, /BYTE 2 · ESTADO ACTUAL/);
  assert.match(route, /Ver evidencia técnica de la lectura/);
  assert.match(route, /enabledActionButtons/);
  assert.match(route, /Las opciones no habilitadas no se muestran como botones/);
  assert.doesNotMatch(route, /data-cta="claim-ownership" \$\{contract\.cta\.claimOwnership \?"" : "disabled"\}/);
});

test("technical SUN evidence follows canonical cryptographic verification for every valid TT state", () => {
  assert.match(route, /cryptographicVerification: resultMeta\.cryptographic_verification === true/);
  assert.match(route, /const digitalTagValidated = contract\.technical\.cryptographicVerification === true/);
  assert.match(route, /Evidencia digital del tag:<\/b> \$\{digitalTagValidated \?/);
  assert.doesNotMatch(route, /\['VALID', 'VALID_AUTHENTIC', 'VALID_CLOSED', 'VALID_OPENED', 'VALID_OPENED_PREVIOUSLY'\]\.includes\(contract\.status\.code\)/);
});

test("sensor presentation preserves source, timestamp and privacy semantics", () => {
  assert.match(route, /sensorProvenance: sensorEvidence\.provenance/);
  assert.match(route, /tenant_manual: "Configurado manualmente por el tenant"/);
  assert.match(route, /csv_import: "Importado desde CSV"/);
  assert.match(route, /json_import: "Importado desde JSON"/);
  assert.match(route, /live_sensor: "Sensor conectado en vivo"/);
  assert.match(route, /responsable:/);
  assert.match(route, /privacidad:/);
  assert.match(route, /No se infiere el contenido ni la custodia física/);
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
  assert.match(timelineSurface, /eventId: null/);
  assert.match(timelineSurface, /device: null/);
  assert.match(timelineSurface, /lat: null/);
  assert.match(timelineSurface, /lng: null/);
  assert.doesNotMatch(timelineSurface, /e\.id::text|e\.device_label|e\.lat\b|e\.lng\b/);
  assert.doesNotMatch(route, /getCtaTimelineSummary|buildLifecycleState/);
  assert.match(route, /listDemoCta\(bid, uid\)[\s\S]{0,220}\.some\(\(item\) => String\(item\.action \|\| ""\) === "tokenize_request"\)/);
  assert.doesNotMatch(contractSurface, /params\.passport\?\.(?:first_verified_at|first_city|first_country|last_verified_at|last_city|last_country)/);
});

test("public traceability never rebuilds an exact current tap as a history checkpoint", () => {
  assert.doesNotMatch(
    route,
    /if \(!contract\.provenance\.timelineSummary\.length\)[\s\S]{0,600}stage:\s*["']current_tap["']/,
  );
});
