import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [home, css] = await Promise.all([
  readFile(new URL("../src/components/home-sections.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
]);

const commercialValue = home.slice(home.indexOf("export function CommercialValueSection"));
const participantCss = css.slice(css.indexOf("/* Landing ecosystem narrative."));

test("the landing uses one continuous atmospheric canvas in light and dark modes", () => {
  assert.match(participantCss, /html:is\(\.theme-light, \[data-theme="light"\]\) \.landing-root \{[\s\S]{0,980}radial-gradient[\s\S]{0,980}linear-gradient/);
  assert.match(participantCss, /html:is\(\.theme-dark, \[data-theme="dark"\]\) \.landing-root \{[\s\S]{0,980}radial-gradient[\s\S]{0,980}linear-gradient/);
  assert.match(participantCss, /rgba\(251, 191, 36, 0\.17\)/);
  assert.match(participantCss, /html:is\(\.theme-light, \[data-theme="light"\]\) \.simple-trust-flow-section \{[\s\S]{0,700}radial-gradient[\s\S]{0,700}!important/);
  assert.match(participantCss, /html:is\(\.theme-light, \[data-theme="light"\]\) \.landing-hero-section::before \{[\s\S]{0,700}rgba\(139, 92, 246, 0\.13\)/);
  assert.match(participantCss, /html:is\(\.theme-dark, \[data-theme="dark"\]\) \.landing-hero-section::before \{[\s\S]{0,700}rgba\(139, 92, 246, 0\.16\)/);
  assert.match(participantCss, /html:is\(\.theme-light, \[data-theme="light"\]\) \.commercial-value-section \{[\s\S]{0,850}radial-gradient[\s\S]{0,850}!important/);
  assert.match(participantCss, /html:is\(\.theme-dark, \[data-theme="dark"\]\) \.commercial-value-section \{[\s\S]{0,850}radial-gradient[\s\S]{0,850}!important/);
  assert.match(participantCss, /\.landing-root \.site-footer \{[\s\S]{0,260}linear-gradient/);
});

test("each product moment has its own restrained activation colour", () => {
  assert.match(participantCss, /\.simple-trust-flow-steps > li:nth-child\(1\)[\s\S]{0,180}#06b6d4/);
  assert.match(participantCss, /\.simple-trust-flow-steps > li:nth-child\(2\)[\s\S]{0,180}#7c5ce5/);
  assert.match(participantCss, /\.simple-trust-flow-steps > li:nth-child\(3\)[\s\S]{0,180}#10a783/);
  assert.match(participantCss, /\.simple-trust-flow-steps > li:hover/);
  assert.match(participantCss, /\.simple-trust-flow-steps > li:focus-within/);
  assert.match(participantCss, /\.simple-trust-flow-steps > li:active/);
  assert.match(participantCss, /\.simple-trust-flow-steps:focus-visible > li/);
  assert.match(participantCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.dpp-participant-arrow::after[\s\S]{0,100}animation: none !important/);
});

test("the closing section explains participants and the return to the business dashboard", () => {
  assert.match(commercialValue, /Cada participante ve lo que necesita\. La empresa conserva el control\./);
  assert.match(commercialValue, /data-participant=\{stage\.key\}/);
  assert.match(commercialValue, /actor: "Persona"/);
  assert.match(commercialValue, /actor: "Producto \+ pasaporte"/);
  assert.match(commercialValue, /actor: "Empresa"/);
  assert.match(commercialValue, /actor: "Dashboard de la empresa"/);
  assert.match(commercialValue, /Qué puede volver al CRM/);
  assert.match(commercialValue, /Lecturas por producto o lote/);
  assert.match(commercialValue, /Contenido consultado/);
  assert.match(commercialValue, /Servicios iniciados/);
  assert.match(commercialValue, /Zona informada o consentida/);
  assert.match(commercialValue, /Servicio \/ canal/);
  assert.match(commercialValue, /Circularidad \/ autoridad/);
  assert.match(commercialValue, /EXPERIENCIA DE LA PERSONA · LO QUE ABRE DESDE EL PRODUCTO/);
  assert.match(commercialValue, /OPERACIÓN DE LA EMPRESA · LO QUE VUELVE AL CENTRO DE CONTROL/);
  assert.match(commercialValue, /className="dpp-participant-map__lanes"/);
  assert.match(commercialValue, /boundaryBrand: "nexID"/);
  assert.match(commercialValue, /<strong>\{copy\.boundaryBrand\}<\/strong>/);
  assert.match(participantCss, /\.dpp-participant-map__boundary strong \{[\s\S]{0,180}font-weight: 950/);
  assert.match(commercialValue, /<DppRoleExplorer locale=\{locale\} \/>/);
});

test("the role narrative preserves identity, consent and physical-evidence boundaries", () => {
  assert.match(commercialValue, /datos personales requieren base válida y consentimiento aplicable/i);
  assert.match(commercialValue, /sin convertir una etiqueta en la identidad de una persona/i);
  assert.match(commercialValue, /no identifica a una persona desde una etiqueta/i);
  assert.match(commercialValue, /ni certifica por sí sola el producto físico/i);
  assert.doesNotMatch(commercialValue, /autenticidad garantizada|producto auténtico|persona identificada|ubicación real/i);
});

test("the participant map is responsive and its data packet animates only through intent", () => {
  const arrowBase = participantCss.slice(
    participantCss.indexOf(".dpp-participant-arrow::after {"),
    participantCss.indexOf(".dpp-participant-map:is(:hover, :focus-within)"),
  );

  assert.match(participantCss, /\.dpp-participant-map:is\(:hover, :focus-within\) \.dpp-participant-arrow::after/);
  assert.match(participantCss, /@keyframes dpp-participant-packet/);
  assert.match(participantCss, /@media \(max-width: 1180px\)[\s\S]{0,260}grid-template-columns: repeat\(2/);
  assert.match(participantCss, /@media \(max-width: 620px\)[\s\S]{0,420}grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(arrowBase, /animation:/);
});
