import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [cork, mePage, mePortal, wallet, voting, model, brands, rewards, marketplace, sun, telemetry, tapLocationModel, publicReward, staffReward, demoReadme, demoSummary, globe] = await Promise.all([
  read("../src/app/me/cork-analyzer/cork-client.tsx"),
  read("../src/app/me/page.tsx"),
  read("../src/app/me/_components/me-portal-interactive-client.tsx"),
  read("../src/app/me/_components/wallet-interactive-client.tsx"),
  read("../src/app/me/brands/brands-voting-client.tsx"),
  read("../src/app/me/_components/consumer-portal-model.ts"),
  read("../src/app/me/brands/page.tsx"),
  read("../src/app/me/rewards/page.tsx"),
  read("../src/app/me/marketplace/marketplace-grid-client.tsx"),
  read("../src/app/sun/page.tsx"),
  read("../src/app/sun/tap-precision-telemetry.tsx"),
  read("../src/app/sun/tap-location-model.ts"),
  read("../src/app/r/[token]/page.tsx"),
  read("../src/app/s/[token]/page.tsx"),
  read("../public/demo/README.md"),
  read("../src/app/api/demo/summary/route.ts"),
  read("../src/components/premium-traceability-globe.tsx"),
]);

test("cork analyzer is a disabled-by-default random UI simulation, not a diagnosis", () => {
  assert.match(cork, /NEXT_PUBLIC_CORK_ANALYZER_DEMO_ENABLED/);
  assert.match(cork, /Demo simulado . valores aleatorios . no diagn.stico/);
  assert.match(cork, /Ejecutar simulaci.n/);
  assert.match(cork, /No se est. analizando la imagen/);
  assert.doesNotMatch(cork, /Analizar con IA|Diagn.stico de Guarda|Recomendaci.n Enol.gica|Apto para guarda|Consumir de inmediato|Corcho Seco|.ptimo/);
});

test("consumer home separates backend empty and unavailable states without arbitrary readiness scores", () => {
  assert.match(mePage, /buildConsumerHomeModel/);
  assert.match(mePage, /Promise\.all/);
  assert.match(mePage, /requireConsumerSession/);
  assert.doesNotMatch(mePage, /readinessChecks|passportReadiness|summarizeAssetReadiness|premium_magnum|asArray/);
  assert.match(mePortal, /model\.products\.status === "unavailable"/);
  assert.match(mePortal, /model\.taps\.status === "unavailable"/);
  assert.match(mePortal, /model\.brands\.status === "unavailable"/);
  assert.match(mePortal, /A.n no hay lecturas vinculadas/);
  assert.match(mePortal, /Reintentar carga/);
  assert.doesNotMatch(mePortal, /Coleccionista Premium|Vino Premium|ownership_status \|\| "Reclamado"|passportReadiness/);
});

test("home omits commerce simulators, preserves dedicated routes and wallet never fabricates blockchain receipts", () => {
  assert.match(mePortal, /href="\/me\/marketplace"/);
  assert.match(mePortal, /href="\/me\/wallet"/);
  assert.doesNotMatch(mePortal, /NEXT_PUBLIC_ME_PORTAL_COMMERCE_DEMO_ENABLED|DEMO COMERCIO SIMULADO|setTrades|window\.ethereum|checkout/);
  assert.doesNotMatch(mePortal, /Math\.random|setWeb3Address|activeTxHash|Compra Exitosa|escrow inteligente/);

  assert.match(wallet, /NEXT_PUBLIC_WALLET_TRANSFER_DEMO_ENABLED/);
  assert.match(wallet, /receipt confirmado por el backend/);
  assert.match(wallet, /Simular transferencia/);
  assert.doesNotMatch(wallet, /Math\.random|Hash demo|transfer\.txHash/);
});

test("club voting and loyalty values are tenant-reported or explicitly simulated", () => {
  assert.match(voting, /NEXT_PUBLIC_BRANDS_VOTING_DEMO_ENABLED/);
  assert.match(voting, /DEMO SIMULADA/);
  assert.match(voting, /Simular voto:/);
  assert.doesNotMatch(voting, /Voto Registrado|Canal Descentralizado/);

  assert.match(model, /membership_tier/);
  assert.match(model, /membership_progress/);
  assert.match(model, /next_milestone/);
  assert.doesNotMatch(model, /tierFromScore|claimedCount \* 120|Math\.max\(8/);
  assert.match(brands, /Puntos reportados/);
  assert.match(brands, /Progreso no reportado/);
  assert.match(rewards, /saldos, beneficios y eventos reportados/);
  assert.doesNotMatch(rewards, /puntos reales|Emisor verificado por nexID/);
});

test("marketplace is request-to-buy and does not claim payment or reservation", () => {
  assert.match(marketplace, /Carrito de solicitudes/);
  assert.match(marketplace, /Enviar solicitudes/);
  assert.match(marketplace, /no cobra, reserva stock ni confirma una compra/);
  assert.match(marketplace, /item\.request_to_buy_enabled !== true/);
  assert.doesNotMatch(marketplace, /Carrito verificado|Marketplace vivo|Compr., reserv. o ped./);
});

test("SUN map uses only explicit origin and current-tap coordinates", () => {
  assert.match(sun, /origin=\{wineryPoint\[0\] \?/);
  assert.match(sun, /tap=\{currentTapPoint\[0\] \?/);
  assert.match(sun, /tapTimeLabel=\{localTapTimeLabel\}/);
  assert.match(sun, /tapTimeIso=\{localTapTimeIso\}/);
  assert.doesNotMatch(sun, /lastSeen: point\.lastSeen \|\| ""/);
  assert.doesNotMatch(sun, /new Date\(index \+ 1\)|lastMapSeenAt \|\| new Date\(\)\.toISOString|Math\.max\(1, Number\(result\.identity\?\.scanCount/);
});

test("SUN precision telemetry preserves the fresh handoff proof", () => {
  assert.match(sun, /freshToken=\{freshToken\}/);
  assert.match(telemetry, /fresh_token: freshToken/);
  assert.match(telemetry, /Boolean\(endpoint && bid && eventId && freshToken\)/);
  assert.match(telemetry, /Number\.isSafeInteger\(readCounter\)/);
  assert.match(telemetry, /geoConsent: true/);
  assert.match(telemetry, /geoPrecision: "approximate"/);
  assert.match(telemetry, /onClick=\{shareApproximateLocation\}/);
  assert.match(telemetry, /requestApproximateBrowserLocation\(navigator\.geolocation, locationRequestedAtMs\)/);
  assert.match(tapLocationModel, /enableHighAccuracy: true/);
  assert.match(tapLocationModel, /lat: roundApproximateCoordinate\(lat\)/);
  assert.match(tapLocationModel, /lat: roundApproximateCoordinate\(lat\)/);
  assert.match(telemetry, /El pasaporte sigue funcionando sin/);
  assert.doesNotMatch(telemetry, /consentOpen|autoPromptAttemptedRef|getHighEntropyValues|userAgent|deviceMemory/);
});

test("public rewards require explicit status and contact-verification evidence", () => {
  for (const source of [publicReward, staffReward]) {
    assert.match(source, /hasExplicitContactVerification/);
    assert.match(source, /verifiedAt && \["verified", "confirmed", "active"\]\.includes\(status\)/);
    assert.match(source, /Estado no reportado/);
    assert.match(source, /Vencimiento no disponible/);
    assert.doesNotMatch(source, /48h desde emisi.n|\|\| "NEXID"|\|\| "nexID Partner"|\|\| "Cliente nexID"/);
  }
  assert.match(staffReward, /BLOQUEADO: codigo o sello no reportado/);
  assert.match(staffReward, /ready: hasCodeAndSeal/);
});

test("public demo documentation preserves the physical evidence boundary", () => {
  assert.match(demoReadme, /do not prove the bottle, contents, cork or capsule/);
  assert.match(demoReadme, /does not independently prove the package or contents/);
  assert.doesNotMatch(demoReadme, /validate originality and seal integrity|prove unopened state|prove chain-of-custody|authenticity-lite/);
});

test("map coordinates expose their source and routes require a durable origin", () => {
  assert.match(demoSummary, /coordinate_source: coords \? "city_centroid" : "not_reported"/);
  assert.match(demoSummary, /coordinate_accuracy_m/);
  assert.match(globe, /Centroide de ciudad aproximado/);
  assert.match(globe, /const hasDurableOrigin/);
  assert.match(globe, /supplier_manifest/);
  assert.match(globe, /if \(!hasDurableOrigin\) return;/);
  assert.doesNotMatch(globe, /const getOrigin =|vertical === "agro"|vertical === "fashion"|vertical === "cosmetics"/);
});
