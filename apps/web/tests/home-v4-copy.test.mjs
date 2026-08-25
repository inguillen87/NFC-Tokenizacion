import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [copy, home] = await Promise.all([
  readFile(new URL("../src/components/marketing-v4/home-copy.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/marketing-v4/nexid-home-v4.tsx", import.meta.url), "utf8"),
]);

test("home v4 has one typed content schema for ES, EN and PT-BR", () => {
  assert.match(copy, /HOME_V4_COPY:\s*Record<AppLocale, HomeV4Copy>/);
  assert.equal((copy.match(/^\s{2}(?:"es-AR"|en|"pt-BR"):\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}hero:\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}flow:\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}roles:\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}caseStudy:\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}evidence:\s*\{/gm) ?? []).length, 3);
  assert.doesNotMatch(home, /locale === "en"|locale === "pt-BR"/);
});

test("home v4 preserves the physical-evidence boundary in every locale", () => {
  assert.match(copy, /El tap no confirma por sí solo el contenido, el origen físico ni la custodia/);
  assert.match(copy, /A tap alone does not confirm contents, physical origin or custody/);
  assert.match(copy, /O tap, isoladamente, não confirma conteúdo, origem física ou custódia/);
  assert.match(copy, /Escenario simulado/);
  assert.match(copy, /Simulated scenario/);
  assert.match(copy, /Cenário simulado/);
  assert.doesNotMatch(copy, /impossible to (?:clone|hack)|unclonable|autenticidad física confirmada|physical product authenticated|produto físico autenticado/i);
});

test("home v4 copy stays outcome-led and avoids invented performance", () => {
  assert.match(copy, /Conectá\. Verificá\. Activá\./);
  assert.match(copy, /Connect\. Verify\. Activate\./);
  assert.match(copy, /Conecte\. Verifique\. Ative\./);
  assert.doesNotMatch(copy, /\b(?:99(?:\.\d+)?%|10x|million products|clientes activos|active customers)\b/i);
  assert.doesNotMatch(copy, /Math\.random|crypto\.randomUUID/);
});
