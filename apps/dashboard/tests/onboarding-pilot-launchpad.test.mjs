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
const supplierPageSource = await readFile(new URL("../src/app/(app)/batches/supplier/page.tsx", import.meta.url), "utf8");

test("onboarding derives readiness from real tenant-scoped operational sources", () => {
  assert.match(pageSource, /withTenant\(context\.origin, "\/batches", tenantScope\)/);
  assert.match(pageSource, /withTenant\(context\.origin, "\/product-assets", tenantScope/);
  assert.match(pageSource, /withTenant\(context\.origin, "\/supplier-orders", tenantScope\)/);
  assert.match(pageSource, /withTenant\(context\.origin, "\/proof\/anchors", tenantScope\)/);
  assert.match(pageSource, /withTenant\(context\.origin, "\/tokenization\/requests", tenantScope/);
  assert.match(pageSource, /session\.role === "tenant-admin" \? String\(session\.tenantSlug \|\| ""\) : ""/);
  assert.match(pageSource, /headers: context\.cookie \? \{ cookie: context\.cookie \} : undefined/);
  assert.match(pageSource, /response\.headers\.get\("x-nexid-data-mode"\) === "demo"/);
  assert.match(pageSource, /value\.ok === false/);
  assert.match(pageSource, /setupComplete: setupCompleted === true/);
  assert.match(pageSource, /dataState: hasDemoSource \? "demo" : availableSources === 5 \? "live"/);
  assert.doesNotMatch(pageSource, /demobodega|Bodega Balmec|BALMEC-2026/);
});

test("pilot launchpad exposes one evidence-backed next action and five connected stages", () => {
  assert.match(launchpadSource, /data-testid="pilot-launchpad"/);
  assert.match(launchpadSource, /data-testid="pilot-primary-action"/);
  assert.match(launchpadSource, /aria-current=\{stage\.status === "current" \? "step"/);
  assert.match(launchpadSource, /role="progressbar"/);
  assert.match(launchpadSource, /Configurar identidad y politica/);
  assert.match(launchpadSource, /Preparar pedido y lote seguro/);
  assert.match(launchpadSource, /Cargar manifest e identidad visual/);
  assert.match(launchpadSource, /Validar muestra fisica/);
  assert.match(launchpadSource, /Abrir prueba y salida comercial/);
  assert.match(launchpadSource, /IOTA prueba evidencia; Polygon prueba ownership/);
  assert.match(launchpadSource, /Accion limitada al tenant de la sesion/);
  assert.match(launchpadSource, /Sandbox de solo lectura: explora el flujo sin escribir sobre datos productivos/);
  assert.match(launchpadSource, /Explorar pedidos seguros/);
  assert.match(launchpadSource, /Explorar centro de Proof/);
  assert.match(launchpadSource, /stage\.status === "blocked"/);
  assert.match(launchpadSource, /aria-disabled="true"/);
  assert.match(launchpadSource, /const productionEvidence = snapshot\.dataState !== "demo"/);
  assert.doesNotMatch(launchpadSource, /supplierOrderCount > 0 \|\| snapshot\.batchCount > 0/);
});

test("pilot launchpad supports explicit light mode and compact mobile workflow", () => {
  assert.match(launchpadStyles, /:global\(html\.theme-light\) \.launchpad/);
  assert.match(launchpadStyles, /:global\(html\[data-theme="light"\]\) \.launchpad/);
  assert.match(launchpadStyles, /@media \(max-width: 760px\)/);
  assert.match(launchpadStyles, /\.stage\s*\{[\s\S]*grid-template-columns: 2\.5rem minmax\(0, 1fr\)/);
  assert.match(launchpadStyles, /\.primaryAction,[\s\S]*min-height: 2\.75rem/);
  assert.doesNotMatch(launchpadStyles, /overflow-x:\s*auto/);
});

test("tenant setup mutation remains server-scoped", () => {
  assert.match(setupProxySource, /session\.role !== "tenant-admin"/);
  assert.match(setupProxySource, /"x-nexid-admin-scope": "tenant_admin"/);
  assert.match(setupProxySource, /"x-nexid-tenant-slug": tenantSlug/);
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
