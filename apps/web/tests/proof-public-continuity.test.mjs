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
  assert.match(page, /function buildProofVerifierHandoffHref\(scenario\?: string\)/);
  assert.match(page, /PROOF_VERIFY_HANDOFF_SCENARIOS\.has\(requestedScenario\)/);
  assert.match(page, /safeScenario\s*===\s*"hub"[\s\S]*"\/demo-lab"/);
  assert.match(page, /`\/demo-lab\?scenario=\$\{encodeURIComponent\(safeScenario\)\}`/);
  assert.match(page, /scenario:\s*safeScenario/);
  assert.match(page, /return_to:\s*returnTo/);
  assert.match(page, /href:\s*buildProofVerifierHandoffHref\(\)/);
  assert.match(page, /buildProofVerifierHandoffHref\(initialScenario\)/);
  assert.match(page, /href=\{proofVerifierHref\}/);
  assert.doesNotMatch(page, /href="\/proof\/verify"/);

  assert.match(client, /function buildDemoPublicProofHref\(scenario: DemoTrustScenarioKey \| null\)/);
  assert.match(client, /const safeScenario = scenario \|\| "hub"/);
  assert.match(client, /event_hash:\s*DEMO_PUBLIC_PROOF_EVENT_HASH/);
  assert.match(client, /anchor_id:\s*DEMO_PUBLIC_PROOF_ANCHOR_ID/);
  assert.match(client, /scenario:\s*safeScenario/);
  assert.match(client, /return_to:\s*returnTo/);
  assert.match(client, /buildDemoPublicProofHref\(activeTrustScenario\)/);
  assert.match(client, /getTrustScenarioContext\(activeTrustScenario, locale, proofVerifierHref\)/);
  assert.equal((client.match(/href=\{proofVerifierHref\}/g) ?? []).length, 3);
});

test("proof verify rejects non-canonical return targets and preserves handoff state", async () => {
  const page = await readWebSource("../src/app/proof/verify/page.tsx");

  assert.match(page, /const DEMO_LAB_PROOF_HANDOFF_SCENARIOS: ReadonlySet<string>/);
  assert.match(page, /"hub"/);
  assert.match(page, /function resolveProofHandoff\(/);
  assert.match(page, /DEMO_LAB_PROOF_HANDOFF_SCENARIOS\.has\(requestedScenario\)/);
  assert.match(page, /const expectedReturnTo = scenario === "hub"/);
  assert.match(page, /requestedReturnTo === expectedReturnTo/);
  assert.doesNotMatch(page, /requestedReturnTo\.startsWith/);
  assert.match(page, /const proofHandoff = resolveProofHandoff\(params, requestedLayer\)/);
  assert.match(page, /const demoLabBackHref = proofHandoff\.returnTo/);
  assert.match(page, /query\.set\("scenario", handoff\.scenario\)/);
  assert.match(page, /query\.set\("return_to", handoff\.returnTo\)/);
  assert.equal((page.match(/name="scenario" value=\{proofHandoff\.scenario\}/g) ?? []).length, 2);
  assert.equal((page.match(/name="return_to" value=\{demoLabBackHref\}/g) ?? []).length, 2);
  assert.match(page, /verifyHrefForDemo\(showcaseDemo, proofHandoff\)/);
  assert.match(page, /decoderHrefForDemo\(showcaseDemo, proofHandoff\)/);
  assert.match(page, /proofLayerHref\("polygon", "polygon-ownership", proofHandoff\)/);
  assert.doesNotMatch(page, /href=\{decodedProof\.matching_demo_case\.verify_path\}/);
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
