import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../src/app/(app)/onboarding/page.tsx", import.meta.url), "utf8");
const appLayoutSource = await readFile(new URL("../src/app/(app)/layout.tsx", import.meta.url), "utf8");
const launchpadSource = await readFile(new URL("../src/components/pilot-launchpad.tsx", import.meta.url), "utf8");
const launchpadStyles = await readFile(new URL("../src/components/pilot-launchpad.module.css", import.meta.url), "utf8");
const setupWizardSource = await readFile(new URL("../src/components/onboarding-setup-wizard.tsx", import.meta.url), "utf8");
const setupWizardStyles = await readFile(new URL("../src/components/onboarding-setup-wizard.module.css", import.meta.url), "utf8");
const setupProxySource = await readFile(new URL("../src/app/api/tenant/setup/route.ts", import.meta.url), "utf8");
const guardrailSource = await readFile(new URL("../src/components/supplier-legacy-intake-blocked.tsx", import.meta.url), "utf8");
const guardrailStyles = await readFile(new URL("../src/components/supplier-legacy-intake-blocked.module.css", import.meta.url), "utf8");
const supplierPageSource = await readFile(new URL("../src/components/supplier-reception-workspace.tsx", import.meta.url), "utf8");

test("launchpad uses a scoped lot source, without inferred pilot readiness",()=>{
 assert.match(pageSource,/resolvePilotScope/);assert.match(pageSource,/readPilotSource/);
 assert.doesNotMatch(pageSource,/assetScore|qaPassed|tokenizationResult|anchorsResult/);
 assert.match(launchpadSource,/Del lote al pasaporte digital/);
 assert.doesNotMatch(launchpadSource,/progressbar|etapas listas|prueba vendible|buildStages/);
});
test("launchpad keeps permissions, explicit selection and bounded counts",()=>{
 assert.match(launchpadSource,/task.href/);assert.match(launchpadSource,/No disponible con los permisos actuales/);
 assert.match(launchpadSource,/no es un total histórico/);assert.match(launchpadSource,/No se abre automáticamente el primer lote/);
});
test("launchpad retains mobile layout, local themes and keyboard focus",()=>{
 assert.match(launchpadStyles,/theme-light/);assert.match(launchpadStyles,/max-width:760px/);
 assert.match(launchpadStyles,/min-height:44px/);assert.match(launchpadStyles,/:focus-visible/);assert.match(launchpadStyles,/prefers-reduced-motion/);
});

test("tenant setup mutation remains server-scoped", () => {
  assert.match(setupProxySource, /session\.role !== "tenant-admin"/);
  assert.match(setupProxySource, /getDashboardSessionCredential\(\{ persistRotation: true \}\)/);
  assert.match(setupProxySource, /Authorization": `Bearer \$\{credential\.bearerToken\}`/);
  assert.doesNotMatch(setupProxySource, /ADMIN_API_KEY|x-nexid-admin-scope|x-nexid-tenant-slug/);
  assert.match(setupProxySource, /session\.isDemo/);
  assert.match(setupProxySource, /originLat < -90 \|\| originLat > 90/);
  assert.match(setupProxySource, /originLng < -180 \|\| originLng > 180/);
  assert.doesNotMatch(launchpadSource, /fetch\(|method:\s*"POST"/);
});

test("workspace setup is inline, accessible and no longer blocks every dashboard route", () => {
  assert.doesNotMatch(appLayoutSource, /<OnboardingSetupWizard/);
  assert.match(pageSource, /session\.setupCompleted === false \? <OnboardingSetupWizard session=\{session\}/);
  assert.match(setupWizardSource, /data-testid="tenant-setup-panel"/);
  assert.match(setupWizardSource, /aria-labelledby="tenant-setup-title"/);
  assert.match(setupWizardSource, /role="radiogroup"/);
  assert.match(setupWizardSource, /aria-checked=\{selected\}/);
  assert.match(setupWizardSource, /role="alert"/);
  assert.match(setupWizardSource, /htmlFor=\{id\}/);
  assert.match(setupWizardSource, /latitude < -90 \|\| latitude > 90/);
  assert.match(setupWizardSource, /longitude < -180 \|\| longitude > 180/);
  assert.match(setupWizardSource, /stepHeadingRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(setupWizardSource, /fixed inset-0|overflow-y-auto|max-h-\[/);
});

test("legacy supplier warning is a flat light-safe operational guardrail", () => {
  assert.match(guardrailSource, /data-testid="supplier-intake-guardrail"/);
  assert.match(guardrailSource, /href="\/batches\/supplier#supplier-order-console"/);
  assert.doesNotMatch(guardrailSource, /<Card|rounded-2xl|rounded-3xl/);
  assert.match(guardrailStyles, /:global\(html\.theme-light\) \.guardrail/);
  assert.match(guardrailStyles, /:global\(html\.theme-light\) \.action/);
  assert.match(guardrailStyles, /background: #0e7490;[\s\S]*color: #ffffff/);
  assert.match(supplierPageSource, /scroll-mt-52 md:scroll-mt-24/);
});

test("setup validation keeps light-mode errors readable", () => {
  assert.match(setupWizardStyles, /:global\(html\.theme-light\) \.error/);
  assert.match(setupWizardStyles, /color: #9f1239/);
});
