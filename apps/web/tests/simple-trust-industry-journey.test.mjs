import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [journey, visuals, home, context] = await Promise.all([
  readFile(new URL("../src/components/simple-trust-industry-journey.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/simple-trust-step-visual.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/connected-product-industry-context.tsx", import.meta.url), "utf8"),
]);

test("industry selector exposes one keyboard-operable tab panel", () => {
  assert.match(journey, /^"use client";/);
  assert.match(journey, /const INDUSTRIES: readonly SimpleTrustIndustry\[\] = \["bottles", "perfume", "agro"\]/);
  assert.match(journey, /useState<SimpleTrustIndustry>\(SIMPLE_TRUST_DEFAULT_INDUSTRY\)/);
  assert.match(journey, /useConnectedProductIndustry\(\)/);
  assert.match(journey, /sharedIndustry\?\.activeIndustry \?\? localIndustry/);
  assert.equal(journey.match(/role="tabpanel"/g)?.length, 1);
  assert.match(journey, /role="tablist"/);
  assert.match(journey, /aria-orientation=\{tabOrientation\}/);
  assert.match(journey, /matchMedia\("\(max-width: 1100px\)"\)/);
  assert.match(journey, /role="tab"/);
  assert.match(journey, /aria-selected=\{isActive\}/);
  assert.match(journey, /aria-controls=\{panelId\}/);
  assert.match(journey, /aria-labelledby=\{`\$\{instanceId\}-\$\{activeIndustry\}-tab`\}/);
  assert.match(journey, /tabIndex=\{isActive \? 0 : -1\}/);
  assert.match(journey, /tabRefs\.current\[nextIndustry\]\?\.focus\(\)/);
  for (const key of ["Home", "End"]) {
    assert.match(journey, new RegExp(`case "${key}"`));
  }
  assert.match(journey, /tabOrientation === "horizontal" \? "ArrowRight" : "ArrowDown"/);
  assert.match(journey, /tabOrientation === "horizontal" \? "ArrowLeft" : "ArrowUp"/);
  assert.match(journey, /simple-trust-industry-tabs--desktop-lateral/);
  assert.match(journey, /simple-trust-industry-tabs--mobile-horizontal/);
  assert.match(journey, /data-active-industry=\{activeIndustry\}/);
  assert.match(journey, /bottles: "wine"/);
  assert.match(journey, /perfume: "packaging"/);
  assert.match(journey, /agro: "agro"/);
  assert.match(journey, /href=\{`\/demo-lab\?profile=\$\{DEMO_PROFILE_BY_INDUSTRY\[activeIndustry\]\}`\}/);
  assert.match(journey, /key=\{activeIndustry\}[\s\S]{0,160}id=\{panelId\}/);
  assert.match(journey, /const railId = `\$\{instanceId\}-\$\{activeIndustry\}-industry-rail`/);
});

test("industry choice stays in context for the journey and the role-based passport explorer", () => {
  assert.match(context, /createContext<ConnectedProductIndustryContextValue \| null>/);
  assert.match(context, /useState<SimpleTrustIndustry>\("bottles"\)/);
  assert.match(home, /<ConnectedProductIndustryProvider>[\s\S]*<SimpleTrustFlowSection locale=\{locale\} \/>[\s\S]*<CommercialValueSection locale=\{locale\} \/>[\s\S]*<\/ConnectedProductIndustryProvider>/);
});

test("selector and shared three-step journey are localized", () => {
  for (const label of [
    "Botellas",
    "Packaging",
    "Agro",
    "Bottles",
    "Agriculture",
    "Garrafas",
  ]) {
    assert.match(journey, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(journey, /Bidones, bolsas e insumos/);
  assert.match(journey, /Containers, bags and inputs/);
  assert.match(journey, /Bombonas, sacos e insumos/);
  assert.match(journey, /return locale === "en" \|\| locale === "pt-BR" \? locale : "es-AR"/);
  assert.match(journey, /const copy = JOURNEY_COPY\[normalizedLocale\]/);
  assert.match(journey, /const STEP_KINDS: readonly SimpleTrustVisualKind\[\] = \["discover", "signal", "aftercare"\]/);
  assert.match(journey, /<SimpleTrustFlowMotion/);
  assert.match(journey, /<SimpleTrustStepVisual kind=\{kind\} locale=\{normalizedLocale\} industry=\{activeIndustry\} \/>/);
  assert.match(journey, /<HorizontalRailControls/);
  assert.match(journey, /itemCount=\{activeCopy\.steps\.length\}/);
  assert.match(journey, /Abrí su pasaporte digital/);
  assert.match(journey, /Show materials and care/);
  assert.match(journey, /Consulte informação atual/);
});

test("each industry maps all three phases to deterministic local assets", () => {
  const expectedAssets = [
    "wine-journey-01.webp",
    "wine-journey-02.webp",
    "wine-journey-03.webp",
    "packaging-journey-01.webp",
    "packaging-journey-02.webp",
    "packaging-journey-03.webp",
    "agro-journey-01.webp",
    "agro-journey-02.webp",
    "agro-journey-03.webp",
  ];

  assert.match(visuals, /const PHOTO_BY_INDUSTRY: Record<SimpleTrustIndustry, Record<SimpleTrustVisualKind, string>>/);
  assert.match(visuals, /bottles: PHOTO_BY_KIND/);
  for (const asset of expectedAssets) {
    assert.match(visuals, new RegExp(asset.replace(".", "\\.")));
  }
  assert.match(visuals, /const photoByKind = PHOTO_BY_INDUSTRY\[normalizedIndustry\] \?\? PHOTO_BY_KIND/);
  assert.match(visuals, /src=\{photoByKind\[kind\]\}/);
  assert.match(visuals, /data-trust-industry=\{normalizedIndustry\}/);
});

test("unknown industry and locale values fail closed without expanding evidence claims", () => {
  assert.match(visuals, /export const SIMPLE_TRUST_DEFAULT_INDUSTRY: SimpleTrustIndustry = "bottles"/);
  assert.match(visuals, /industry === "perfume" \|\| industry === "agro" \|\| industry === "bottles"/);
  assert.match(visuals, /: SIMPLE_TRUST_DEFAULT_INDUSTRY/);
  assert.match(visuals, /industry = SIMPLE_TRUST_DEFAULT_INDUSTRY/);
  assert.match(visuals, /const normalizedLocale = locale === "en" \|\| locale === "pt-BR" \? locale : "es-AR"/);
  assert.match(visuals, /EJEMPLO ILUSTRATIVO/);
  assert.match(visuals, /EN EL CELULAR/);
  assert.match(visuals, /PASAPORTE ABIERTO/);
  assert.match(visuals, /REGISTRO VINCULADO/);
  assert.doesNotMatch(`${journey}\n${visuals}`, /autenticidad física|physical authenticity|autenticidade física|cadena de custodia|chain of custody|cadeia de custódia|origen verificado|verified origin|origem verificada/i);
});
