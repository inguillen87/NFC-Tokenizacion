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
  assert.match(hero, /<InstitutionalVideoPanel locale=\{locale\} variant="landing" initialTheme=\{initialTheme\} \/>/);
  assert.doesNotMatch(hero, /HeroScene|heroStats|nexid-hero-atlas|nexid-hero-board/);

  const heroBodies = [...content.matchAll(/hero:\s*\{[\s\S]*?\bbody:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(heroBodies.length, 3, "Spanish, Portuguese and English need friendly hero copy");
  for (const body of heroBodies) {
    assert.ok(body.trim().split(/\s+/).length <= 36, "hero body must stay scannable");
    assert.doesNotMatch(body, /SUN|tenant|replay|hash-only|TagTamper|custod|\bTT\b/i);
    assert.doesNotMatch(body, /physical product|producto físico|produto físico/i);
  }
  assert.match(heroBodies[0], /registra lecturas y acciones/i);
  assert.match(heroBodies[1], /registra leituras e ações/i);
  assert.match(heroBodies[2], /records reads and actions/i);
  for (const body of heroBodies) assert.doesNotMatch(body, /piloto|pilot/i);
});

test("SimpleTrustFlow keeps one progressive industry journey and one clear action", async () => {
  const [sections, journey] = await Promise.all([
    readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/simple-trust-industry-journey.tsx", import.meta.url), "utf8"),
  ]);
  const flow = sliceBetween(sections, "export function SimpleTrustFlowSection", "export function CommercialValueSection");

  assert.equal((flow.match(/<Link href=/g) ?? []).length, 1, "the compact flow must have one primary action");
  assert.match(flow, /<Link href="\/demo-lab(?:\?[^\"]*)?"/);
  assert.doesNotMatch(flow, /href="\/sun"|audiences:|rubros:|claimTitle:|claimBody:|NFT|tenant|replay|SUN|\bTT\b|custod/i);
  assert.doesNotMatch(flow, /md:grid-cols-4/);
  assert.match(flow, /<SimpleTrustIndustryJourney locale=\{locale\} \/>/);
  assert.match(journey, /\["discover", "signal", "aftercare"\]/);
  assert.match(journey, /<SimpleTrustFlowMotion/);
  assert.match(journey, /<HorizontalRailControls/);
  assert.match(flow, /Un mismo recorrido\. Distintos productos/);
  assert.match(flow, /Uma jornada\. Produtos diferentes/);
  assert.match(flow, /One journey\. Different products/);
  assert.doesNotMatch(flow, /Botella, paquete o bolsa|Garrafa, pacote ou bolsa|Bottle, parcel or pouch/);
  assert.doesNotMatch(flow, /simple-trust-flow-continuity|continuityStages/);

  assert.doesNotMatch(flow, /respuesta viene de la etiqueta|produto físico|physical product|controles específicos|separate checks/i);
  assert.doesNotMatch(flow, /copy\.note|<p>\{copy\.note\}<\/p>/);
  assert.match(flow, /id="como-funciona"/);
});

test("CommercialValue explains one concrete brand-side lifecycle without repeating the consumer journey", async () => {
  const [sections, preview] = await Promise.all([
    readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/brand-control-center-preview.tsx", import.meta.url), "utf8"),
  ]);
  const value = sections.slice(sections.indexOf("export function CommercialValueSection"));

  assert.match(value, /Preparás la experiencia una vez\. Cada producto la pone en marcha/);
  assert.match(value, /Prepare a experiência uma vez\. Cada produto a coloca em ação/);
  assert.match(value, /Prepare the experience once\. Every product puts it to work/);
  assert.match(value, /<BrandControlCenterPreview locale=\{locale\} \/>/);
  assert.match(preview, /Ejemplo ilustrativo · Probá cada opción/);
  assert.match(preview, /Elegí qué querés activar/);
  assert.match(preview, /Historia y lote/);
  assert.match(preview, /Activá la garantía/);
  assert.match(preview, /Hablá con la bodega/);
  assert.match(preview, /Lectura recibida/);
  assert.match(preview, /aria-pressed=\{selected === key\}/);
  assert.match(preview, /onClick=\{\(\) => setSelected\(key\)\}/);
  assert.doesNotMatch(preview, /role="tablist"|role="tabpanel"/);
  assert.match(value, /Probarlo con una botella/);
  assert.match(value, /href="\/demo-lab\?profile=wine"/);
  assert.doesNotMatch(value, /Ver la plataforma en acción/);
  assert.doesNotMatch(preview, /ChevronRight|ArrowDown|ArrowUp|Capa digital activa|Producto entregado|Producto conectado/);
  assert.doesNotMatch(value, /Una relación que sigue generando valor|Uma relação que continua gerando valor|A relationship that keeps creating value/);
  assert.doesNotMatch(value, /commercial-value-grid|commercial-value-rail|HorizontalRailControls|0\{index \+ 1\}/);
  assert.doesNotMatch(preview, /\b(?:%|KPI|ROI|conversi[oó]n)\b/i);
  assert.doesNotMatch(value, /SUN|tenant|replay|hash-only|TagTamper|custod|\bTT\b/i);
});
