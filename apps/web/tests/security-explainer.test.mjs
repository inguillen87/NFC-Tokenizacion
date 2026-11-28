import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const explainer = read("src/components/security-explainer.tsx");
const platform = read("src/app/platform/page.tsx");

test("the security explainer tells each fact at two levels in three languages", () => {
  for (const marker of ["En simple", "Para técnicos", "In plain words", "For engineers", "Em palavras simples"]) {
    assert.match(explainer, new RegExp(marker));
  }
  assert.equal((explainer.match(/key: "unique"/g) ?? []).length, 3);
  assert.equal((explainer.match(/key: "limit"/g) ?? []).length, 3);
  assert.match(explainer, /role="radiogroup"/);
  assert.match(explainer, /useReducedMotion\(\)/);
});

test("the security explainer keeps the platform's evidence boundaries", () => {
  assert.match(explainer, /Abierto no significa falso/);
  assert.match(explainer, /No se envía cada tap ni se escriben datos personales en la cadena/);
  assert.match(explainer, /nunca el UID crudo/);
  assert.match(explainer, /No reemplaza una pericia sobre el objeto físico/);
  assert.doesNotMatch(explainer, /imposible|infalible|inhackeable|unhackable|100\s?%|garantiz/i);
  assert.match(platform, /<SecurityExplainer locale=\{locale\} \/>/);
});
