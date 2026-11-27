import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compare = read("src/app/compare/page.tsx");
const compareCss = read("src/app/compare/compare.module.css");
const sections = read("src/components/home-extra-sections.tsx");
const home = read("src/app/page.tsx");
const sitemap = read("src/app/sitemap.ts");

test("the comparison names approaches, never vendors, and states its scope", () => {
  assert.doesNotMatch(compare, /prooftag|authena|qliktag|certilogo|scantrust/i);
  assert.match(compare, /Comparación general de enfoques, no de proveedores concretos/);
  assert.match(compare, /A general comparison of approaches, not of specific vendors/);
  assert.match(compare, /Comparação geral de abordagens, não de fornecedores específicos/);
});

test("the comparison keeps the nexID evidence boundary and the QR caveat", () => {
  assert.match(compare, /No certifica por sí solo el objeto físico, y un sello abierto tampoco demuestra falsificación/);
  assert.match(compare, /El QR de nexID se comporta como cualquier QR/);
  assert.match(compare, /según permisos y consentimiento/);
  assert.doesNotMatch(compare, /imposible|infalible|100\s?%|garantiz/i);
});

test("the comparison is a shared public page that reflows on small screens", () => {
  assert.match(compare, /<PublicSiteHeader \/>/);
  assert.match(compare, /<main id="main-content" tabIndex=\{-1\}/);
  assert.match(compare, /<dt>\{copy\.approaches\[key\]\.name\}<\/dt>/);
  assert.match(compareCss, /@media \(max-width: 860px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(compareCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(sitemap, /path: "\/compare"/);
});

test("the home explains the three reading outcomes with curated demo scenarios", () => {
  assert.match(sections, /export function ReadingOutcomesSection/);
  assert.match(sections, /const scenarios = \["closed", "opened", "invalid"\] as const;/);
  assert.match(sections, /sunDemoScenarioHref\("valle-secreto", scenarios\[index\] \?\? "closed"\)/);
  assert.match(sections, /No demuestra falsificación: qué significa lo define la política de cada marca/);
  assert.match(sections, /la ficha sigue disponible y las acciones protegidas se bloquean/);
  assert.match(sections, /<Link href="\/compare" prefetch=\{false\}/);
  assert.match(home, /<ReadingOutcomesSection locale=\{locale\} \/>\s*<AudienceSection/);
});
