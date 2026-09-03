import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start > -1, `missing ${startMarker}`);
  assert.ok(end > start, `missing ${endMarker} after ${startMarker}`);
  return source.slice(start, end);
}

test("home hero is large, friendly and truthful without becoming a technical dashboard", async () => {
  const [sections, content, css] = await Promise.all([
    readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/landing-content.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);
  const hero = sliceBetween(sections, "export function HeroSection", "export function SimpleTrustFlowSection");
  const h1Class = hero.match(/<h1 className="([^"]+)"/)?.[1];

  assert.ok(h1Class, "hero H1 must keep an explicit responsive type scale");
  const remSizes = [...h1Class.matchAll(/(\d+(?:\.\d+)?)rem/g)].map((match) => Number(match[1]));
  assert.ok(remSizes.length > 0, "hero H1 must expose auditable rem-based responsive sizes");
  assert.ok(Math.max(...remSizes) >= 4, "desktop hero H1 must reach at least 4rem");
  assert.match(css, /\.landing-hero-section h1 \{[\s\S]{0,260}font-size:\s*clamp\(2\.85rem, 4\.5vw, 4\.25rem\) !important/);
  assert.match(css, /\.landing-hero-section \.hero-subtitle \{[\s\S]{0,260}font-size:\s*clamp\(1rem, 1\.25vw, 1\.15rem\) !important/);
  assert.match(sections, /import nexIdDppHero from "\.\.\/\.\.\/public\/landing\/nexid-dpp-hero-v3\.webp"/);
  assert.match(hero, /src=\{nexIdDppHero\}/);
  assert.doesNotMatch(hero, /InstitutionalVideoPanel/);
  assert.doesNotMatch(hero, /HeroScene|heroStats|nexid-hero-atlas|nexid-hero-board/);

  const heroBodies = [...content.matchAll(/hero:\s*\{[\s\S]*?\bbody:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(heroBodies.length, 3, "Spanish, Portuguese and English need friendly hero copy");
  for (const body of heroBodies) {
    assert.ok(body.trim().split(/\s+/).length <= 36, "hero body must stay scannable");
    assert.doesNotMatch(body, /SUN|tenant|replay|hash-only|TagTamper|custod|\bTT\b/i);
    assert.doesNotMatch(body, /physical product|producto físico|produto físico/i);
  }
  assert.match(content, /title: "El futuro de la trazabilidad para tu producto\."/);
  assert.match(content, /title: "O futuro da rastreabilidade para o seu produto\."/);
  assert.match(content, /title: "The future of traceability for your product\."/);
  assert.match(heroBodies[0], /Pasaporte Digital: identidad, información, historia y trazabilidad declaradas/i);
  assert.match(heroBodies[1], /Passaporte Digital: identidade, informação, história e rastreabilidade declaradas/i);
  assert.match(heroBodies[2], /Digital Product Passport: identity, information, history and traceability/i);
  for (const body of heroBodies) assert.doesNotMatch(body, /cumple|compliant|certified|certificado/i);
  for (const body of heroBodies) assert.doesNotMatch(body, /piloto|pilot/i);
});

test("SimpleTrustFlow keeps one progressive industry journey and one clear action", async () => {
  const [sections, journey] = await Promise.all([
    readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/simple-trust-industry-journey.tsx", import.meta.url), "utf8"),
  ]);
  const flow = sliceBetween(sections, "export function SimpleTrustFlowSection", "export function CommercialValueSection");

  assert.equal((journey.match(/className="simple-trust-flow-cta"/g) ?? []).length, 1, "the compact flow must have one primary action");
  assert.match(journey, /href=\{`\/demo-lab\?profile=\$\{DEMO_PROFILE_BY_INDUSTRY\[activeIndustry\]\}`\}/);
  assert.doesNotMatch(flow, /href="\/sun"|audiences:|rubros:|claimTitle:|claimBody:|NFT|tenant|replay|SUN|\bTT\b|custod/i);
  assert.doesNotMatch(flow, /md:grid-cols-4/);
  assert.match(flow, /<SimpleTrustIndustryJourney locale=\{locale\} ctaLabel=\{copy\.primary\} \/>/);
  assert.match(journey, /\["discover", "signal", "aftercare"\]/);
  assert.match(journey, /<SimpleTrustFlowMotion/);
  assert.match(journey, /<HorizontalRailControls/);
  assert.match(flow, /Del producto a su pasaporte, en tres momentos/);
  assert.match(flow, /Do produto ao seu passaporte, em três momentos/);
  assert.match(flow, /From the product to its passport, in three moments/);
  assert.doesNotMatch(flow, /Botella, paquete o bolsa|Garrafa, pacote ou bolsa|Bottle, parcel or pouch/);
  assert.doesNotMatch(flow, /simple-trust-flow-continuity|continuityStages/);

  assert.doesNotMatch(flow, /respuesta viene de la etiqueta|controles específicos|separate checks/i);
  assert.doesNotMatch(flow, /copy\.note|<p>\{copy\.note\}<\/p>/);
  assert.match(flow, /id="como-funciona"/);
});

test("CommercialValue adds a white-first role-based DPP view instead of repeating the three-step journey", async () => {
  const [sections, explorer, styles] = await Promise.all([
    readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dpp-role-explorer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dpp-role-explorer.module.css", import.meta.url), "utf8"),
  ]);
  const value = sections.slice(sections.indexOf("export function CommercialValueSection"));

  assert.match(value, /<DppRoleExplorer locale=\{locale\} \/>/);
  assert.doesNotMatch(value, /BrandControlCenterPreview|Configurá la experiencia/);
  assert.match(explorer, /Un pasaporte\. La información justa para cada rol/);
  assert.match(explorer, /Persona/);
  assert.match(explorer, /Marca/);
  assert.match(explorer, /Servicio \/ canal/);
  assert.match(explorer, /Circularidad \/ autoridad/);
  assert.match(explorer, /role="tablist"/);
  assert.match(explorer, /role="tabpanel"/);
  assert.match(explorer, /source: string/);
  assert.match(explorer, /responsible: string/);
  assert.match(explorer, /granularity: string/);
  assert.match(explorer, /updated: string/);
  assert.match(explorer, /visibility: string/);
  assert.match(explorer, /Escenario ilustrativo · Sin datos productivos/);
  assert.match(explorer, /no implica cumplimiento normativo automático/);
  assert.match(explorer, /no certifica por sí sola la autenticidad física/);
  assert.match(styles, /linear-gradient\(145deg, #ffffff 0%, #f7fcfd 54%, #eff9fb 100%\)/);
  assert.match(styles, /@container \(max-width: 48rem\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@keyframes dataFlow/);
  assert.match(styles, /@keyframes panelEnter/);
  assert.match(styles, /:focus-visible/);
  assert.doesNotMatch(explorer, /\b(?:%|KPI|ROI|conversi[oó]n)\b/i);
  assert.doesNotMatch(value, /SUN|tenant|replay|hash-only|TagTamper|custod|\bTT\b/i);
});
