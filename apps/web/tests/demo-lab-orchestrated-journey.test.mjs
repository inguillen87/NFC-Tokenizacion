import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const journeyUrl = new URL("../src/app/(public)/demo-lab/demo-lab-featured-journey.tsx", import.meta.url);
const journeyCssUrl = new URL("../src/app/(public)/demo-lab/demo-lab-featured-journey.module.css", import.meta.url);
const hubUrl = new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url);
const sunUrl = new URL("../src/app/sun/page.tsx", import.meta.url);
const profilesUrl = new URL("../src/lib/demo-product-profiles.ts", import.meta.url);

test("Demo Lab leads with one guided product journey and progressively discloses technical scenarios", async () => {
  const [journey, hub] = await Promise.all([
    readFile(journeyUrl, "utf8"),
    readFile(hubUrl, "utf8"),
  ]);

  assert.match(journey, /^"use client";/);
  assert.match(journey, /import Image from "next\/image"/);
  assert.match(journey, /data-demo-featured-journey/);
  assert.match(journey, /role="progressbar"/);
  assert.match(journey, /aria-current=\{isCurrent \? "step"/);
  assert.match(journey, /type DemoProductProfileKey/);
  assert.match(journey, /initialProfile\?: DemoProductProfileKey/);
  assert.match(journey, /useState<DemoProductProfileKey>\(initialProfile\)/);
  assert.match(journey, /Probá cómo un producto abre una relación/);
  assert.match(journey, /Elegí un ejemplo\. Al final vas a ver la experiencia exacta que se abre en el celular/);
  assert.match(journey, /Demo ilustrativa · sin tap físico/);
  assert.match(journey, /No certifica por sí sola el producto, su contenido ni su autenticidad física/);
  assert.match(journey, /data-sun-preview-handoff/);
  assert.match(journey, /const sunPreviewHref = buildSunPreviewHref\(productKey, selectedAction, locale\)/);
  assert.equal((journey.match(/data-sun-preview-handoff/g) ?? []).length, 1);
  assert.match(journey, /Premium bottle/);
  assert.match(journey, /Garrafa premium/);
  assert.match(journey, /demo: "1"/);
  assert.match(journey, /source: "demo-lab"/);
  assert.match(journey, /profile,/);
  assert.match(journey, /action: intent/);
  assert.match(journey, /locale,/);
  const handoffBuilder = journey.match(/function buildSunPreviewHref[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(handoffBuilder, /product:|brand:|region:|origin:|demo_lot|bid:|uid:|picc_data|enc:|cmac:|snapshot|access:|fresh|qr:/);

  const featuredPosition = hub.indexOf("<DemoLabFeaturedJourney");
  const advancedPosition = hub.indexOf("<details className=\"demo-lab-hub-advanced");
  assert.ok(featuredPosition > 0, "featured journey must render on the hub");
  assert.ok(advancedPosition > featuredPosition, "technical catalog must follow the guided journey");
  assert.doesNotMatch(hub.slice(advancedPosition, advancedPosition + 100), /\sopen(?:=|\s|>)/);
  assert.match(hub, /Explorar otros escenarios y capas técnicas/);
  assert.match(hub, /Evidence verifier/);
  assert.match(hub, /Voltar à nexID/);
  assert.match(hub, /const DEMO_LAB_VERTICAL_PROFILE_MAP/);
  assert.match(hub, /wine: "wine"/);
  assert.match(hub, /perfume: "perfume"/);
  assert.match(hub, /seeds: "agro"/);
  assert.match(hub, /resolveFeaturedProfile\(params\.profile, requestedVertical\)/);
  assert.match(hub, /initialProfile=\{initialProfile\}/);
});

test("the guided journey is keyboard-visible, responsive and motion-safe", async () => {
  const css = await readFile(journeyCssUrl, "utf8");

  assert.match(css, /\.journey button:focus-visible,[\s\S]*\.journey a:focus-visible/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.productSelector > div:last-child\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration:\s*0\.01ms !important/);
  assert.match(css, /:global\(\.demo-lab-hub-root--light\) \.journey/);
});

test("SUN reuses its existing demo preview for Demo Lab product handoffs", async () => {
  const [sun, profiles] = await Promise.all([
    readFile(sunUrl, "utf8"),
    readFile(profilesUrl, "utf8"),
  ]);

  assert.match(sun, /readParam\(params, "demo"\) === "1"/);
  assert.match(sun, /readParam\(params, "source"\) === "demo-lab"/);
  assert.match(sun, /resolveDemoProductProfile\(readParam\(params, "profile"\)\)/);
  assert.match(sun, /resolveDemoExperienceAction\(readParam\(params, "action"\)\)/);
  assert.match(sun, /demoIntent=\{demoLabAction\}/);
  assert.match(sun, /handoffProfile\.brand/);
  assert.match(sun, /handoffProfile\.lot/);
  assert.match(sun, /const isDemoPreview = !isQrScan && query\.toString\(\)\.length === 0 && !snapshotId/);
  assert.match(sun, /const requestedBrandDisplay = isDemoPreview\s*\? ""\s*:\s*readParam\(params, "winery"\) \|\| readParam\(params, "brand"\)/);
  assert.match(sun, /const engagementBaseEligible = !isDemoPreview/);
  assert.match(sun, /const primaryPostTapAction = isDemoPreview\s*\? \{ label: "Ver opciones de muestra", href: "#sun-services"/);
  assert.match(sun, /\{!isDemoPreview \? <details className="group rounded-2xl/);
  assert.match(sun, /\{!isDemoPreview && bid && \(uid \|\| eventId\) \? \(/);
  assert.match(sun, /const canRequestBrowserLocation = !isQrScan\s*&& !isDemoPreview/);
  assert.match(sun, /const demoLabReturnHref = demoLabProfile/);
  assert.match(sun, /const requestedDemoLocale = readParam\(params, "locale"\)/);
  assert.match(sun, /requestedDemoLocale === "en" \|\| requestedDemoLocale === "pt-BR" \|\| requestedDemoLocale === "es-AR"/);
  assert.match(sun, /Volver al Demo Lab/);
  assert.match(sun, /SUN_DEMO_BADGE/);
  assert.match(profiles, /type DemoProductProfileKey = "wine" \| "perfume" \| "agro"/);
  assert.match(profiles, /resolveDemoProductProfile/);
  assert.match(profiles, /type DemoExperienceAction = "warranty" \| "benefit" \| "support"/);
  assert.match(profiles, /resolveDemoExperienceAction/);
  assert.match(profiles, /Reserva Andina/);
  assert.match(profiles, /Esencia Aurora/);
  assert.match(profiles, /Semilla Norte/);
});
