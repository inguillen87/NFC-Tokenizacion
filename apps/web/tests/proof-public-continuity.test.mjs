import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readWebSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("demo lab sends an allowlisted proof origin with an exact internal return", async () => {
  const [page, client] = await Promise.all([
    readWebSource("../src/app/(public)/demo-lab/page.tsx"),
    readWebSource("../src/app/(public)/demo-lab/demo-lab-client.tsx"),
  ]);

  assert.match(page, /const PROOF_VERIFY_HANDOFF_SCENARIOS: ReadonlySet<string>/);
  assert.match(page, /"iota-proof"/);
  assert.match(page, /"dual-proof"/);
  assert.match(page, /function buildProofVerifierHandoffHref\(scenario\?: string, vertical\?: string\)/);
  assert.match(page, /PROOF_VERIFY_HANDOFF_SCENARIOS\.has\(requestedScenario\)/);
  assert.match(page, /if \(safeScenario !== "hub"\) returnQuery\.set\("scenario", safeScenario\)/);
  assert.match(page, /if \(requestedVertical\) returnQuery\.set\("vertical", requestedVertical\)/);
  assert.match(page, /scenario:\s*safeScenario/);
  assert.match(page, /return_to:\s*returnTo/);
  assert.match(page, /href:\s*buildProofVerifierHandoffHref\(\)/);
  assert.match(page, /buildProofVerifierHandoffHref\(initialScenario, initialVertical\)/);
  assert.match(page, /href=\{proofVerifierHref\}/);
  assert.doesNotMatch(page, /href="\/proof\/verify"/);

  assert.match(client, /function buildDemoPublicProofHref\(scenario: DemoTrustScenarioKey \| null, vertical: Vertical\)/);
  assert.match(client, /const safeScenario = scenario \|\| "hub"/);
  assert.match(client, /event_hash:\s*DEMO_PUBLIC_PROOF_EVENT_HASH/);
  assert.match(client, /anchor_id:\s*DEMO_PUBLIC_PROOF_ANCHOR_ID/);
  assert.match(client, /scenario:\s*safeScenario/);
  assert.match(client, /return_to:\s*returnTo/);
  assert.match(client, /buildDemoPublicProofHref\(activeTrustScenario, vertical\)/);
  assert.match(client, /const fixtureProofDestinationHref = useMemo\([\s\S]*buildDemoPublicProofHref\(activeTrustScenario, vertical\)/);
  assert.match(client, /const proofDestinationHref = currentExecutionEvidenceHref \|\| fixtureProofDestinationHref/);
  assert.match(client, /simulationReceipt\?\.evidenceVerified[\s\S]*simulationReceipt\.evidenceUrl/);
  assert.match(client, /getTrustScenarioContext\(activeTrustScenario, locale, proofDestinationHref, commercialDemoHref, vertical\)/);
  assert.equal((client.match(/href=\{proofDestinationHref\}/g) ?? []).length, 3);
});

test("proof verify rejects non-canonical return targets and preserves handoff state", async () => {
  const page = await readWebSource("../src/app/proof/verify/page.tsx");

  assert.match(page, /const DEMO_LAB_PROOF_HANDOFF_SCENARIOS: ReadonlySet<string>/);
  assert.match(page, /"hub"/);
  assert.match(page, /function resolveProofHandoff\(/);
  assert.match(page, /DEMO_LAB_PROOF_HANDOFF_SCENARIOS\.has\(requestedScenario\)/);
  assert.match(page, /const expectedReturnTo = scenario === "hub"/);
  assert.match(page, /requestedReturnTo === contextualReturnTo/);
  assert.doesNotMatch(page, /requestedReturnTo\.startsWith/);
  assert.match(page, /const proofHandoff = resolveProofHandoff\(params, requestedLayer\)/);
  assert.match(page, /const demoLabBackHref = proofHandoff\.returnTo/);
  assert.match(page, /query\.set\("scenario", handoff\.scenario\)/);
  assert.match(page, /query\.set\("return_to", handoff\.returnTo\)/);
  assert.equal((page.match(/name="scenario" value=\{proofHandoff\.scenario\}/g) ?? []).length, 2);
  assert.equal((page.match(/name="return_to" value=\{demoLabBackHref\}/g) ?? []).length, 2);
  assert.equal((page.match(/name="vertical" value=\{proofHandoff\.vertical\}/g) ?? []).length, 2);
  assert.match(page, /verifyHrefForDemo\(showcaseDemo, proofHandoff\)/);
  assert.match(page, /decoderHrefForDemo\(showcaseDemo, proofHandoff\)/);
  assert.match(page, /proofLayerHref\("polygon", "polygon-ownership", proofHandoff\)/);
  assert.match(page, /function demoLabScenarioHref\(scenario: string, vertical\?: string\)/);
  assert.match(page, /function ownershipPageHref\(vertical\?: string\)/);
  assert.match(page, /const iotaDemoLabHref = demoLabScenarioHref\("iota-proof", proofHandoff\.vertical\)/);
  assert.match(page, /const ownershipCertificateHref = ownershipPageHref\(proofHandoff\.vertical\)/);
  assert.match(page, /contextualConnectionCards\.map\(\(card\)/);
  assert.doesNotMatch(page, /<Link href="\/demo-lab\?scenario=iota-proof"/);
  assert.doesNotMatch(page, /<Link href="\/proof\/ownership"/);
  assert.doesNotMatch(page, /href=\{decodedProof\.matching_demo_case\.verify_path\}/);
});

test("seeds continuity reaches ownership and returns through IOTA without losing context", async () => {
  const ownership = await readWebSource("../src/app/proof/ownership/page.tsx");

  assert.match(ownership, /function buildIotaProofHref\(vertical\?: string\)/);
  assert.match(ownership, /const returnTo = "\/demo-lab\?scenario=iota-proof&vertical=seeds"/);
  assert.match(ownership, /scenario: "iota-proof"/);
  assert.match(ownership, /return_to: returnTo/);
  assert.match(ownership, /vertical: "seeds"/);
  assert.equal((ownership.match(/href=\{iotaProofHref\}/g) ?? []).length, 2);
  assert.equal((ownership.match(/href=\{demoLabHref\}/g) ?? []).length, 2);
  assert.doesNotMatch(ownership, /<Link href="\/proof\/verify\?layer=iota/);
});

test("the unpublished agro fixture stays independent and never claims physical or on-chain proof", async () => {
  const [page, ownership] = await Promise.all([
    readWebSource("../src/app/proof/verify/page.tsx"),
    readWebSource("../src/app/proof/ownership/page.tsx"),
  ]);
  const agroFixture = page.match(/id: "agro-stewardship",([\s\S]*?)\n  },\n\];/);

  assert.ok(agroFixture, "agro fixture must remain present");
  assert.match(agroFixture[1], /status: "declared_fixture"/);
  assert.match(agroFixture[1], /explorer_url: null/);
  assert.match(agroFixture[1], /tx_hash: null/);
  assert.match(agroFixture[1], /Caso público agro independiente/);
  assert.match(agroFixture[1], /no confirma publicación on-chain/);
  assert.match(agroFixture[1], /no prueba origen, contenido, aplicación, custodia ni autenticidad del producto físico/);
  assert.doesNotMatch(agroFixture[1], /business_claim: "Demuestra|manager_explanation: "Para canal y compliance: prueba stewardship/i);

  assert.match(page, /function isUnpublishedAgroFixture/);
  assert.match(page, /Memo público declarado · no publicado/);
  assert.match(page, /showcaseDemoIsUnpublishedAgro \? "Leer memo declarado" : "Leer memo real"/);
  assert.match(page, /showcaseDemoIsUnpublishedAgro \? "Revisar evidencia declarada" : "Probar verificación real"/);
  assert.match(page, /NO PUBLICADO/);
  assert.match(page, /Caso público agro independiente con hashes y Merkle root declarados/);
  assert.match(page, /sin tx y explorer sólo representa un memo declarado/);

  assert.match(ownership, /Caso público de ownership independiente del caso agro/);
  assert.match(ownership, /no corresponde al lote del Demo Lab ni prueba origen, contenido, aplicación, custodia o autenticidad del producto físico/);
});

test("proof verify exposes configured enterprise handoff and a mobile return dock", async () => {
  const [page, focusTarget, css] = await Promise.all([
    readWebSource("../src/app/proof/verify/page.tsx"),
    readWebSource("../src/app/proof/verify/proof-focus-target.tsx"),
    readWebSource("../src/app/globals.css"),
  ]);

  assert.match(page, /const ENTERPRISE_PROOF_CONSOLE_URL = `\$\{productUrls\.app\}\/proof`/);
  assert.match(page, /href=\{ENTERPRISE_PROOF_CONSOLE_URL\}/);
  assert.match(page, /Consola privada/);
  assert.match(page, /Consola privada enterprise/);
  assert.match(page, /Abrir consola de Proof/);
  assert.match(page, /target="_blank"/);
  assert.match(page, /returnHref=\{demoLabBackHref\}/);
  assert.match(page, /returnLabel=\{demoLabBackLabel\}/);

  assert.match(focusTarget, /if \(!targetId\) return null/);
  assert.match(focusTarget, /<nav className="proof-focus-return"/);
  assert.match(focusTarget, /href=\{returnHref\}/);
  assert.match(focusTarget, /className="proof-focus-return__link"/);
  assert.match(focusTarget, /ArrowLeft/);
  assert.match(focusTarget, /scrollIntoView/);
  assert.match(focusTarget, /focus\(\{ preventScroll: true \}\)/);

  assert.match(css, /\.proof-focus-return\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*\.proof-focus-return\s*\{[\s\S]*position:\s*fixed/);
  assert.match(css, /\.proof-focus-return\s*\{[\s\S]*padding:[^;]*env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.proof-focus-return__link\s*\{[\s\S]*min-height:\s*3rem/);
  assert.match(css, /html\[data-theme="light"\] \.proof-focus-return__link/);
  assert.match(page, /@media \(max-width: 640px\)[\s\S]*\.proof-verify-page\s*\{[\s\S]*padding-bottom: 6rem/);
  assert.match(page, /@media \(max-width: 640px\)[\s\S]*\.proof-decoder-code\s*\{[\s\S]*max-height: none;[\s\S]*overflow: visible/);
});

test("demo lab quick IOTA title gets a stable unclamped mobile row", async () => {
  const css = await readWebSource("../src/app/globals.css");
  const mobileRules = css.slice(css.indexOf("@media (max-width: 520px)"));

  assert.match(mobileRules, /\.demo-lab-hub-quick-launch__card\s*\{[\s\S]*min-height:\s*8\.55rem/);
  assert.match(mobileRules, /grid-template-rows:\s*2\.05rem minmax\(3rem, auto\) minmax\(1\.85rem, auto\)/);
  assert.match(mobileRules, /\.demo-lab-hub-quick-launch__card strong\s*\{[\s\S]*min-height:\s*3rem/);
  assert.match(mobileRules, /\.demo-lab-hub-quick-launch__card strong\s*\{[\s\S]*overflow:\s*visible/);
  assert.match(mobileRules, /-webkit-line-clamp:\s*unset/);
});
