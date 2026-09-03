import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [component, styles] = await Promise.all([
  readFile(new URL("../src/components/dpp-role-explorer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/dpp-role-explorer.module.css", import.meta.url), "utf8"),
]);

test("DPP role explorer explains one structured passport through four authorized views", () => {
  assert.match(component, /export function DppRoleExplorer/);
  assert.match(component, /Un pasaporte\. La información justa para cada rol\./);
  assert.match(component, /Um passaporte\. A informação certa para cada função\./);
  assert.match(component, /One passport\. The right information for each role\./);

  for (const role of ["person", "brand", "service", "circularity"]) {
    assert.match(component, new RegExp(`${role}: \\{`));
  }
  for (const label of ["Persona", "Marca", "Servicio / canal", "Circularidad / autoridad"]) {
    assert.match(component, new RegExp(label.replace("/", "\\/")));
  }

  assert.match(component, /role="tablist"/);
  assert.match(component, /aria-orientation=\{tabOrientation\}/);
  assert.match(component, /ResizeObserver/);
  assert.match(component, /role="tab"/);
  assert.match(component, /role="tabpanel"/);
  assert.match(component, /<ul className=\{styles\.fieldList\}>/);
  assert.match(component, /<li key=\{`\$\{activeIndustry\}-\$\{selectedRole\}-\$\{field\.label\}`\}/);
  assert.match(component, /aria-selected=\{isSelected\}/);
  assert.match(component, /aria-controls=\{`\$\{baseId\}-role-panel`\}/);
  assert.match(component, /tabOrientation === "horizontal" && event\.key === "ArrowRight"/);
  assert.match(component, /tabOrientation === "vertical" && event\.key === "ArrowDown"/);
  assert.match(component, /event\.key === "Home"/);
  assert.match(component, /event\.key === "End"/);
});

test("DPP role explorer reuses the same accessible model for bottles, packaging and agro", () => {
  assert.match(component, /export type DppExplorerIndustry = "bottles" \| "perfume" \| "agro"/);
  assert.match(component, /useConnectedProductIndustry\(\)/);
  assert.match(component, /const activeIndustry = industry \?\? sharedIndustry\?\.activeIndustry \?\? "bottles"/);
  assert.match(component, /INDUSTRY_PROFILES\[localeKey\]\[activeIndustry\]/);
  assert.match(component, /getIndustryFields\(copy, industryProfile, selectedRole\)/);
  assert.match(component, /data-industry=\{activeIndustry\}/);
  assert.match(component, /key=\{`\$\{activeIndustry\}-\$\{selectedRole\}`\}/);

  for (const identity of ["Reserva Andina", "Estuche Aurora", "Insumo Horizonte"]) {
    assert.match(component, new RegExp(`product: "${identity}"`));
  }
  for (const id of ["RA-2407", "EA-2047", "AG-3184"]) {
    assert.match(component, new RegExp(id));
  }

  assert.match(component, /Materiales e instrucciones/);
  assert.match(component, /Composición del packaging/);
  assert.match(component, /Lote e instrucciones publicadas/);
  assert.match(component, /Gestión posterior del envase/);
  assert.match(component, /Materials and instructions/);
  assert.match(component, /Batch and published instructions/);
  assert.match(component, /Materiais e instruções/);
  assert.match(component, /Lote e instruções publicadas/);
  assert.doesNotMatch(component, /certified packaging|envase certificado|embalagem certificada/i);
});

test("DPP role explorer makes provenance, granularity and evidence state explicit", () => {
  for (const field of [
    "source",
    "responsible",
    "granularity",
    "updated",
    "visibility",
  ]) {
    assert.match(component, new RegExp(`${field}: string`));
  }
  assert.match(component, /evidence: EvidenceKey/);

  assert.match(component, /Declarado/);
  assert.match(component, /Verificado digitalmente/);
  assert.match(component, /No disponible/);
  assert.match(component, /data-evidence=\{field\.evidence\}/);
  assert.match(component, /copy\.legend\[field\.evidence\]\.label/);
  assert.match(component, /Modelo \+ lote/);
  assert.match(component, /granularity: "Lote"/);
  assert.match(component, /granularity: "Ítem"/);
  assert.match(component, /responsibleLabel: "Responsable"/);
  assert.match(component, /updatedLabel: "Última actualización"/);
  assert.match(component, /visibilityLabel: "Visibilidad"/);
});

test("DPP role explorer is truthful about demo data, permissions and verification limits", () => {
  assert.match(component, /Escenario ilustrativo · Sin datos productivos/);
  assert.match(component, /Los datos personales requieren consentimiento explícito/);
  assert.match(component, /no implica cumplimiento normativo automático/);
  assert.match(component, /La verificación digital no certifica por sí sola la autenticidad física/);
  assert.match(component, /no certifica el producto físico/);
  assert.match(component, /href="\/demo-lab\?profile=wine"/);

  assert.doesNotMatch(component, /cumple con (?:la )?UE|EU compliant|garantiza la autenticidad|certifica la autenticidad física/i);
  assert.doesNotMatch(component, /datos reales|real data|dados reais/i);
  assert.doesNotMatch(component, /ventas|conversi[oó]n|ROI|KPI/i);
});

test("DPP role explorer is white-first, responsive and motion-accessible", () => {
  assert.match(styles, /linear-gradient\(145deg, #ffffff 0%, #f7fcfd 54%, #eff9fb 100%\)/);
  assert.match(styles, /@container \(max-width: 62rem\)/);
  assert.match(styles, /@container \(max-width: 48rem\)/);
  assert.match(styles, /@container \(max-width: 34rem\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@keyframes panelEnter/);
  assert.match(styles, /@keyframes rowEnter/);
  assert.match(styles, /@keyframes orbitPulse/);
  assert.match(styles, /@keyframes dataFlow/);
  assert.match(styles, /@keyframes headerScan/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /:global\(html:is\(\.theme-dark, \[data-theme="dark"\]\)\) \.explorer/);
  assert.match(styles, /:global\(html:is\(\.theme-dark, \[data-theme="dark"\]\)\) \.introCopy h2/);
  assert.match(styles, /\.explorer\[data-industry="perfume"\]/);
  assert.match(styles, /\.explorer\[data-industry="agro"\]/);
  assert.doesNotMatch(styles, /introCopy h3/);
});
