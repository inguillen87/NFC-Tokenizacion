import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  metadata, assets, verticals, landing, assistant, video, docs, glossary, wallet, walletCard, audiences, sdk, layout,
  home, demoPage, mobileDemo, demoLab, heroScene, landingSections, calculator, pricing, interactiveDemo, radar,
  ogImage, demoSummary, labelRoute, investorSnapshot, sunPage, ctaActions, manifest, videoEsVtt, videoEnVtt,
  videoPtVtt, wineSeed, cosmeticsSeed, agroSeed, pharmaSeed, luxurySeed, eventsSeed,
] = await Promise.all([
  read("../src/lib/public-page-metadata.ts"),
  read("../src/lib/product-asset-bank.ts"),
  read("../src/lib/platform-verticals.ts"),
  read("../src/lib/landing-content.ts"),
  read("../src/app/api/assistant/chat/route.ts"),
  read("../src/components/institutional-video-panel.tsx"),
  read("../src/app/docs/page.tsx"),
  read("../src/app/glossary/page.tsx"),
  read("../src/app/me/_components/wallet-interactive-client.tsx"),
  read("../src/app/me/wallet/metamask-sandbox-card.tsx"),
  read("../src/app/audiences/page.tsx"),
  read("../src/app/sdk/page.tsx"),
  read("../src/app/layout.tsx"),
  read("../src/app/page.tsx"),
  read("../src/app/demo/page.tsx"),
  read("../src/components/mobile-demo-client.tsx"),
  read("../src/app/(public)/demo-lab/demo-lab-client.tsx"),
  read("../src/components/hero-scene.tsx"),
  read("../src/components/landing-sections.tsx"),
  read("../src/components/calculator-section.tsx"),
  read("../src/app/pricing/page.tsx"),
  read("../src/components/interactive-demo-section.tsx"),
  read("../src/components/radar-section.tsx"),
  read("../src/app/og-image.tsx"),
  read("../src/app/api/demo/summary/route.ts"),
  read("../src/app/api/generate-label/route.ts"),
  read("../src/app/investor-snapshot/investor-snapshot-client.tsx"),
  read("../src/app/sun/page.tsx"),
  read("../src/app/sun/cta-actions.tsx"),
  read("../src/app/manifest.ts"),
  read("../public/video/nexid_institutional_es.vtt"),
  read("../public/video/nexid_institutional_en.vtt"),
  read("../public/video/nexid_institutional_pt.vtt"),
  read("../public/demo/wine-secure/wine-secure_seed.json"),
  read("../public/demo/cosmetics-secure/cosmetics-secure_seed.json"),
  read("../public/demo/agro-secure/agro-secure_seed.json"),
  read("../public/demo/pharma-secure/pharma-secure_seed.json"),
  read("../public/demo/luxury-basic/luxury-basic_seed.json"),
  read("../public/demo/events-basic/seed.json"),
]);

test("public metadata and global SEO describe digital evidence instead of physical authentication", () => {
  assert.match(metadata, /NFC\/SUN message validation, declared data/);
  assert.match(metadata, /conecta validaci.n de mensajes NFC\/SUN, datos declarados/);
  assert.doesNotMatch(metadata, /physical product authentication|autenticaci.n de productos f.sicos|autentica..o de produtos f.sicos/i);

  assert.match(layout, /Pasaporte digital de producto y trazabilidad/);
  assert.match(layout, /Digital product passports and traceability/);
  assert.match(layout, /Con NFC o QR, nexID conecta cada producto/i);
  assert.match(layout, /información, historia y trazabilidad/i);
  assert.doesNotMatch(layout, /cada piloto|each pilot/i);
  assert.doesNotMatch(layout, /Product Authentication|Autenticaci.n de Productos|Autentica..o de Produtos/);
});

test("asset defaults distinguish tenant declarations from demo imagery", () => {
  assert.match(assets, /Entrada con identidad digital/);
  assert.match(assets, /Imagen cargada por el tenant/);
  assert.match(assets, /no representa el producto del tenant/);
  assert.match(assets, /cargados \/ \$\{demo\} demo/);
  assert.doesNotMatch(assets, /Entrada verificada|Foto (?:botella|acceso|empaque|calzado|prenda|producto) real|Foto real del tenant|Foto real de banco visual/);
});

test("pharma and ROI copy remain evidence-led and measurable", () => {
  assert.match(verticals, /NFC\/QR message evidence, digital leaflets, declared batches/);
  assert.match(verticals, /Evid.ncia da mensagem NFC\/QR, bula digital, lote declarado/);
  assert.doesNotMatch(verticals, /Medicine authenticity|Autenticidade de medicamentos/);

  assert.match(landing, /Measure in pilot/);
  assert.match(landing, /Medir en piloto/);
  assert.match(landing, /Medir no piloto/);
  assert.doesNotMatch(landing, /-30%|\+10x|\+8%|\+18%|-70%/);
});

test("assistant bounds technical claims while the institutional video stays plain-language", () => {
  assert.match(assistant, /fresh cryptographic evidence from the tag message/);
  assert.match(assistant, /does not by itself prove the physical seal, contents or origin/);
  assert.match(assistant, /El registro digital no prueba ownership ni autenticidad fisica/);
  assert.doesNotMatch(assistant, /authentic physical presence|presencia fisica autentica|presenca fisica autentica/i);

  assert.match(video, /From the product to the next action/);
  assert.match(video, /Del producto a la próxima acción/);
  assert.doesNotMatch(video, /NFC\/SUN|\bTT\b|hash-only|under policy|bajo política/i);
  assert.doesNotMatch(video, /trusted tap|toque confiable|Autenticidad, trazabilidad|Authenticity, traceability|Autenticidade, rastreabilidade/);
});

test("docs distinguish message validation, provisional offline checks and digital title", () => {
  assert.match(docs, /La validaci.n criptogr.fica comprueba el mensaje del tag/);
  assert.match(docs, /Polygon can record a digital ownership title/);
  assert.match(docs, /local message result is provisional/);
  assert.match(docs, /resultado local del mensaje es provisional/);
  assert.doesNotMatch(docs, /Authentication proves the object|La autenticaci.n prueba el objeto|Autentica..o valida o objeto/);
  assert.doesNotMatch(docs, /identidades f.sicas verificables|physical digital identities|reclame el producto como suyo|claim the product as theirs|veredicto oficial/);
});

test("glossary canonical language stays on carrier evidence and digital rights", () => {
  assert.match(glossary, /Connected digital identity/);
  assert.match(glossary, /Replay controls and message-anomaly detection/);
  assert.match(glossary, /Secure for message evidence, replay controls and reported TT/);
  assert.match(glossary, /reported lifecycle events/);
  assert.doesNotMatch(glossary, /identidades f.sicas verificables|identidades f.sicas verific.veis|verifiable physical identit/i);
  assert.doesNotMatch(glossary, /verdad del objeto|verdade do objeto|truth of the object|primero verificamos el objeto|first verify the object/i);
  assert.doesNotMatch(glossary, /detectar falsificaciones|detectar falsifica..es|detect counterfeits|Traceability, authenticity|Trazabilidad, autenticidad/i);
});

test("audience, SDK and wallet surfaces name digital rights without authenticating products", () => {
  assert.match(audiences, /Verify \(mensaje NFC\/SUN \+ anti-replay \+ TT reportado\)/);
  assert.match(audiences, /Verify \(NFC\/SUN message, replay controls and reported TT\)/);
  assert.doesNotMatch(audiences, /Verify \(autenticidad \+ tamper\)|Presencia f.sica y cadena de custodia/);

  assert.match(sdk, /Mensaje NFC\/SUN - Evidencia - Derechos digitales/);
  assert.match(sdk, /no autentica por si sola el objeto fisico/);
  assert.doesNotMatch(sdk, /Identidad - Autenticidad - Confianza|integrar autenticidad, QR/);

  assert.match(wallet, /certificados y registros de ownership digital; no del objeto f.sico/);
  assert.match(walletCard, /La firma no prueba el objeto f.sico/);
  assert.doesNotMatch(`${wallet}\n${walletCard}`, /productos autenticados|tokenizar un producto premium/);
});

test("landing, pricing and demo surfaces label evidence and simulations precisely", () => {
  const surfaces = [home, demoPage, demoLab, heroScene, landingSections, calculator, pricing, interactiveDemo, radar, ogImage, demoSummary].join("\n");
  assert.match(landingSections, /nexID checks the digital label and shows a clear result[^.]*\. To validate the physical product as well[^.]*specific controls/);
  assert.match(landingSections, /A nexID verifica a etiqueta digital e mostra um resultado claro[^.]*\. Para validar também o produto físico[^.]*controles específicos/);
  assert.match(landingSections, /nexID verifica la etiqueta digital y muestra un resultado claro[^.]*\. Para validar también el producto físico[^.]*controles específicos/);
  assert.match(demoLab, /Product scene/);
  assert.match(demoLab, /Message NFC accepted|Mensaje NFC aceptado/);
  assert.match(radar, /Reported custody event \(demo\)/);
  assert.match(landingSections, /DEMO . MENSAJE NFC V.LIDO/);
  assert.match(landing, /Serverless gateway designed for resilience/);
  assert.match(landing, /Gateway serverless projetado para resili.ncia/);
  assert.match(landing, /SLA subject to readiness review/);
  assert.match(landing, /SLA sujeito a readiness review/);
  assert.match(landingSections, /Polygon opcional - sujeto a politica y confirmacion RPC/);
  assert.match(demoLab, /IOTA \/ Polygon: comprobar estado/);
  assert.doesNotMatch(landing, /High-availability validation gateway|Gateway de valida..o de alta disponibilidade|with SLA\.|com SLA\./i);
  assert.doesNotMatch(`${landingSections}\n${demoLab}`, /Polygon claim ready|Claim Polygon pronto|Claim Polygon listo|IOTA \/ Polygon ready/i);
  assert.doesNotMatch(surfaces, /Authenticity validated|Autenticidad validada|Tamper detected|Seal opened|Sello abierto|Chain-of-custody event|Anti-copy signals|Se.ales anticopia/i);
  assert.doesNotMatch(demoLab, /getPhysicalProductBadge|Toque f.sico validado|Toque f.sico fresco|Repetir tap f.sico|Repetir toque fisico/i);
  assert.doesNotMatch(pricing, /Anti-counterfeit|Antifraude/i);
});

test("mobile demo never invents missing product metrics or locations", () => {
  assert.match(mobileDemo, /function optionalMetric/);
  assert.match(mobileDemo, /function optionalText/);
  assert.match(mobileDemo, /return text \|\| "N\/D"/);
  assert.doesNotMatch(mobileDemo, /"16.C"|"38%"|"55%"|"15.25.C"|"20.C"|"2.8.C"/);
  assert.doesNotMatch(mobileDemo, /"Mendoza, AR"|"Bogot., CO"|"C.rdoba, AR"|"S.o Paulo, BR"|"13\.9%"|"12 months"|"Woody \/ Floral"|"PF-001"|"PH-001"/);
});

test("public subtitles, label fallback and demo seeds avoid physical-authenticity claims", () => {
  const subtitles = `${videoEsVtt}\n${videoEnVtt}\n${videoPtVtt}`;
  const seeds = [wineSeed, cosmeticsSeed, agroSeed, pharmaSeed, luxurySeed, eventsSeed].join("\n");
  assert.match(subtitles, /declared digital identity|identidad digital declarada|identidade digital declarada/i);
  assert.doesNotMatch(subtitles, /original product|producto original|produto original/i);
  assert.match(labelRoute, /Identidad digital, evidencia NFC y trazabilidad declarada/);
  assert.doesNotMatch(labelRoute, /trazabilidad y autenticidad/i);
  assert.doesNotMatch(seeds, /anti-clone tap|prove unopened|prove chain-of-custody|validate originality|seal integrity|authenticity-lite|authenticate (?:agro|medicine|premium)/i);
});

test("calculator and investor snapshot expose hypotheses instead of promising ROI", () => {
  assert.match(calculator, /contributionPerActiveUnit/);
  assert.match(calculator, /modeledCoveragePct/);
  assert.match(calculator, /resellerMarkupPct/);
  assert.match(calculator, /not a payback guarantee/);
  assert.doesNotMatch(calculator, /firstYearCost \/ Math\.max\(1, protectedValuePerUnit\)/);
  assert.match(investorSnapshot, /Hip.tesis a validar por cliente/);
  assert.match(investorSnapshot, /Solo un NTAG 424 correctamente provisionado/);
  assert.match(investorSnapshot, /no prueba por s. sola apertura f.sica/);
  assert.doesNotMatch(investorSnapshot, /tasas de conversi.n mediocres \(<2% CTR\)|Cada tap genera una firma din.mica|margen del 40%\./);
});

test("SUN fallbacks and post-tap actions fail closed and stay pending until confirmed", () => {
  assert.match(sunPage, /code: "QR_UPSTREAM_UNAVAILABLE"/);
  assert.match(sunPage, /ok: false/);
  assert.match(sunPage, /const requestedProduct = readParam\(params, "product"\) \|\| readParam\(params, "productName"\);/);
  assert.match(sunPage, /const requestedWinery = readParam\(params, "winery"\) \|\| readParam\(params, "brand"\);/);
  assert.match(sunPage, /requestedRegion \|\| "N\/D"/);
  assert.match(ctaActions, /Solicitud de garant.a registrada . pendiente de revisi.n/);
  assert.match(ctaActions, /Aviso registrado para revisi.n/);
  assert.match(ctaActions, /Boolean\(data\.ticket\?\.id\)/);
  assert.match(ctaActions, /tenant_assigned/);
  assert.match(ctaActions, /confirmedStatuses/);
  assert.match(ctaActions, /Lectura digital/);
  assert.match(ctaActions, /Apertura declarada/);
  assert.match(ctaActions, /OCR solo extrae campos y un score de lectura/);
  assert.match(ctaActions, /signed_pos/);
  assert.match(ctaActions, /tenant_manual_approval/);
  assert.doesNotMatch(ctaActions, /tap fisico valido y fresco|Verificado por proveedor|data\.claim_eligible === true|validen ticket, producto y score/i);
  assert.doesNotMatch(ctaActions, /Activa cobertura|Garantia registrada para postventa|Crea un ticket|Ticket creado para revisar/);
  assert.match(manifest, /NFC Message Evidence & Digital Product Identity/);
});
