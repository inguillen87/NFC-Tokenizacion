import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [cork, mePage, mePortal, wallet, voting, model, brands, rewards, marketplace, sun, telemetry, publicReward, staffReward, demoReadme, demoSummary, globe] = await Promise.all([
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

test("consumer home renders backend empty states and an explicit readiness checklist", () => {
  assert.match(mePage, /savedProductProfiles\[0\]\?\.profile \|\| null/);
  assert.match(mePage, /const readinessChecks = \[/);
  assert.match(mePage, /hasReadinessData/);
  assert.doesNotMatch(mePage, /42 \+ claimedProducts|Gran Reserva Premium Magnum|premium_magnum/);
  assert.match(mePortal, /Todav.a no hay productos reportados/);
  assert.match(mePortal, /Nombre no reportado/);
  assert.match(mePortal, /Ownership no reportado/);
  assert.doesNotMatch(mePortal, /Coleccionista Premium|Vino Premium|ownership_status \|\| "Reclamado"/);
});

test("commerce and wallet demos fail closed and never fabricate blockchain receipts", () => {
  assert.match(mePortal, /NEXT_PUBLIC_ME_PORTAL_COMMERCE_DEMO_ENABLED/);
  assert.match(mePortal, /DEMO COMERCIO SIMULADO/);
  assert.match(mePortal, /const \[trades, setTrades\].*\(\[\]\)/);
  assert.match(mePortal, /No se cre. una compra, orden, pago, reserva, escrow ni transacci.n on-chain/);
  assert.doesNotMatch(mePortal, /Math\.random|setWeb3Address\("0x71C|amoy\.polygonscan\.com\/tx\/\$\{activeTxHash\}|Compra Exitosa|escrow inteligente/);

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

test("SUN map preserves missing counts and timestamps", () => {
  assert.match(sun, /const reportedScanCount = hasReportedScanCount \? rawReportedScanCount : 0/);
  assert.match(sun, /lastSeen: point\.lastSeen/);
  assert.match(sun, /lastSeen: result\.tapContext\?\.utcTime \|\| result\.tapContext\?\.localTime \|\| result\.provenance\?\.lastVerifiedLocation\?\.at \|\| null/);
  assert.match(sun, /taps: observedEventCount/);
  assert.match(sun, /scans: point\.count/);
  assert.doesNotMatch(sun, /new Date\(index \+ 1\)|lastMapSeenAt \|\| new Date\(\)\.toISOString|Math\.max\(1, Number\(result\.identity\?\.scanCount|taps: routeTapCount/);
});

test("SUN precision telemetry preserves the fresh handoff proof", () => {
  assert.match(sun, /freshToken=\{freshToken\}/);
  assert.match(telemetry, /fresh_token: activeFreshToken \|\| undefined/);
  assert.match(telemetry, /nexid:tap-context-capability:/);
  assert.match(telemetry, /window\.location\.replace\(`\$\{refreshUrl\.pathname\}\$\{refreshUrl\.search\}\$\{refreshUrl\.hash\}`\)/);
  assert.match(telemetry, /geoConsent: true/);
  assert.match(telemetry, /geoPrecision: "approximate"/);
  assert.match(telemetry, /onClick=\{shareApproximateLocation\}/);
  assert.match(telemetry, /nexid:tap-location-prompt:/);
  assert.match(telemetry, /getHighEntropyValues/);
  assert.match(telemetry, /enableHighAccuracy: true/);
  assert.match(telemetry, /roundApproximateCoordinate\(position\.coords\.latitude\)/);
  assert.match(telemetry, /El pasaporte sigue (?:funcionando normalmente|disponible)/);
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
