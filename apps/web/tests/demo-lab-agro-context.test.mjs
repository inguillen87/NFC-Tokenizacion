import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [story, client, page, modal, proof, ownership, home, experience, globalCss] = await Promise.all([
  read("../src/lib/demo-lab-vertical-story.ts"),
  read("../src/app/(public)/demo-lab/demo-lab-client.tsx"),
  read("../src/app/(public)/demo-lab/page.tsx"),
  read("../src/components/commercial-contact-modal.tsx"),
  read("../src/app/proof/verify/page.tsx"),
  read("../src/app/proof/ownership/page.tsx"),
  read("../src/components/marketing-v4/nexid-home-v4.tsx"),
  read("../src/components/marketing-v4/nexid-home-experience.tsx"),
  read("../src/app/globals.css"),
]);

test("the seeds story is localized, agro-first and explicit about evidence limits", () => {
  assert.match(story, /export const DEMO_LAB_SEEDS_STORY/);
  assert.match(story, /"es-AR":\s*\{/);
  assert.match(story, /"pt-BR":\s*\{/);
  assert.match(story, /\ben:\s*\{/);

  assert.match(story, /La organización declara lote, variedad o formulación/);
  assert.match(story, /A organização declara lote, variedade ou formulação/);
  assert.match(story, /The organization declares the lot, variety or formulation/);
  assert.match(story, /no prueba apertura, contenido ni custodia física/);
  assert.match(story, /não prova abertura, conteúdo nem custódia física/);
  assert.match(story, /proves neither opening, contents nor physical custody/);
  assert.doesNotMatch(story, /Balmec|Malbec|Mendoza|Z[uü]rich|Syngenta/i);
});

test("the seeds route scopes visible evidence and preserves its vertical through handoffs", () => {
  assert.doesNotMatch(home, /NexidIndustryShowcase|caseStudy/);
  assert.match(experience, /agro: "seeds"/);
  assert.match(experience, /pharma: "pharma"/);
  assert.match(experience, /wine: "wine"/);
  assert.match(experience, /premium: "sneaker"/);
  assert.match(experience, /href=\{`\/demo-lab\?vertical=\$\{DEMO_VERTICAL_BY_SECTOR\[activeSector\.id\]\}`\}/);
  assert.match(client, /getDemoLabVerticalStory\(vertical, locale\)/);
  assert.match(client, /scopeDemoSummaryForVertical\(summary, vertical\)/);
  assert.match(client, /seeds: \{ imageUrl: "\/demo\/agro-secure\/real-seed-packet-pexels\.jpg", imageLightUrl: "\/demo\/agro-secure\/real-seed-packet-pexels\.jpg"/);
  assert.match(client, /normalizeCommercialVertical\(event\.vertical\) === "agro"/);
  assert.match(client, /recentTickets: \[\]/);
  assert.match(client, /recentOrders: \[\]/);
  assert.match(client, /NTAG 424 DNA TT \+ QR de respaldo/);
  assert.match(client, /Cambio de estado reportado/);
  assert.doesNotMatch(client, /seeds: \{[^\n]*proof: \[[^\n]*"Custodia agro"/);
  assert.match(client, /verticalStory\?\.origin \|\| LOCATIONS\.origin/);
  assert.match(client, /verticalStory\?\.destinations\[beat\]/);
  assert.match(client, /buildDemoPublicProofHref\(activeTrustScenario, vertical\)/);
  assert.match(client, /buildDemoScenarioHref\("offline-verifier", vertical\)/);
  assert.match(client, /buildDemoScenarioHref\("supplier-batch-factory", vertical\)/);
  assert.match(client, /new URLSearchParams\(\{ scenario: item\.key, vertical \}\)/);
  assert.match(client, /pack: DEMO_MOBILE_PACKS\[vertical\][\s\S]*locale,[\s\S]*vertical,/);
  assert.match(client, /vertical === "seeds" \? "consumer_tamper" : "consumer_opened"/);
  assert.match(client, /vertical === "wine" \? DEMO_TENANT_SLUG : "demo-nexid"/);
  assert.match(client, /nextUrl\.searchParams\.set\("vertical", nextVertical\)/);
  assert.match(client, /window\.history\.replaceState/);
  assert.match(client, /const validSimulationDestination = verticalStory\?\.destinations\[1\]/);
  assert.match(client, /\{validDestination\.city\}/);
  assert.equal((client.match(/mesh="none"/g) ?? []).length, 2);
  assert.match(client, /href=\{commercialDemoHref\}/);
  assert.match(client, /open=\{!activeTrustScenario && vertical !== "seeds"\}/);
  assert.match(globalCss, /Demo Lab 4\.0: the page header owns navigation, theme and sales actions/);
  assert.match(globalCss, /\.demo-lab-fullscreen-root \.demo-lab-wizard-nav-back,[\s\S]*\.demo-lab-fullscreen-root \.demo-lab-wizard-actions[\s\S]*display: none !important/);

  assert.match(page, /buildProofVerifierHandoffHref\(initialScenario, initialVertical\)/);
  assert.match(page, /buildDemoContactHref\(initialVertical\)/);
  assert.match(page, /if \(requestedVertical\) query\.set\("vertical", requestedVertical\)/);
  assert.match(proof, /requestedVertical === "seeds"/);
  assert.match(proof, /if \(handoff\.vertical\) query\.set\("vertical", handoff\.vertical\)/);
  assert.match(ownership, /demo-lab\?scenario=polygon-ownership&vertical=seeds/);
  assert.match(ownership, /isSeedsContext \? "\/demo\/agro-secure\/real-seed-packet-pexels\.jpg"/);
  assert.match(ownership, /no certifica este lote, sus semillas ni el producto físico/);
});

test("the agro journey keeps public proof and sensitive actions truth-bounded", () => {
  assert.match(client, /Caso publico agro independiente/);
  assert.match(client, /No es evidencia de este sobre, esta lectura ni del producto fisico/);
  assert.match(client, /proofShowsCurrentExecution/);
  assert.match(client, /simulationReceipt=\{simulationReceipt\}/);
  assert.match(client, /const hasRecordedExecution = executionTruthState === "persisted_unverified" \|\| executionTruthState === "verified_evidence"/);
  assert.match(client, /Vista conceptual · sin solicitud creada/);
  assert.match(client, /Vista conceptual · sin reclamo creado/);
  assert.match(client, /data-demo-feed-truth=\{feedTruthState\}/);
  assert.match(client, /Controles demo; sin evidencia criptografica activa/);
  assert.doesNotMatch(client, /return "AUTENTICADO"/);
  assert.doesNotMatch(client, /Transacciones y verificaciones criptográficas activas/);
  assert.doesNotMatch(client, /Solicitud de tokenización lista para revisar/);
  assert.doesNotMatch(client, /Reclamo listo con política de dueño/);
});

test("generic commercial intents stay neutral while seeds is classified as agro", () => {
  const rolloutBlocks = [...modal.matchAll(/company_rollout:\s*\{([\s\S]*?)\n\s*\},/g)];
  const defaultBlocks = [...modal.matchAll(/default_demo:\s*\{([\s\S]*?)\n\s*\},/g)];

  assert.equal(rolloutBlocks.length, 3);
  assert.equal(defaultBlocks.length, 3);
  rolloutBlocks.forEach(([, block]) => {
    assert.match(block, /vertical: ""/);
    assert.doesNotMatch(block, /vertical: "wine"/);
  });
  defaultBlocks.forEach(([, block]) => assert.match(block, /vertical: ""/));

  assert.match(modal, /vertical: "", volume: "", message: ""/);
  assert.match(modal, /normalizeCommercialVertical\(search\.get\("vertical"\) \|\| intentCopy\.vertical\)/);
  assert.match(story, /\["seed", "seeds", "agro", "agrochemical", "agrochemicals", "agroquimico", "agroquimicos"\]/);
  assert.match(story, /return "agro"/);
  assert.match(story, /query\.set\("vertical", safeVertical\)/);
});
