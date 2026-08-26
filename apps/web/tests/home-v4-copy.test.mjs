import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [copy, home, navigation] = await Promise.all([
  readFile(new URL("../src/components/marketing-v4/home-copy.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/marketing-v4/nexid-home-v4.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/marketing-v4/nexid-navigation-v4.content.ts", import.meta.url), "utf8"),
]);

test("home v4 has one typed content schema for ES, EN and PT-BR", () => {
  assert.match(copy, /HOME_V4_COPY:\s*Record<AppLocale, HomeV4Copy>/);
  assert.equal((copy.match(/^\s{2}(?:"es-AR"|en|"pt-BR"):\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}hero:\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}flow:\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}roles:\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}video:\s*\{/gm) ?? []).length, 3);
  assert.equal((copy.match(/^\s{4}evidence:\s*\{/gm) ?? []).length, 3);
  assert.doesNotMatch(copy, /HomeCaseStudyCopy|\bcaseStudy:\s*\{|^\s{4}caseStudy:\s*\{/m);
  assert.doesNotMatch(home, /locale === "en"|locale === "pt-BR"/);
});

test("home v4 preserves the physical-evidence boundary in every locale", () => {
  assert.match(copy, /La lectura valida el mensaje y las reglas configuradas; no acredita por sí sola/);
  assert.match(copy, /The reading validates the configured message and policy; it does not prove/);
  assert.match(copy, /A leitura valida a mensagem e as regras configuradas; por si só, não comprova/);
  assert.match(copy, /Escenario ilustrativo · Sin datos de cliente/);
  assert.match(copy, /Simulated scenario · No customer data/);
  assert.match(copy, /Cenário ilustrativo · Sem dados de cliente/);
  assert.doesNotMatch(copy, /impossible to (?:clone|hack)|unclonable|autenticidad física confirmada|physical product authenticated|produto físico autenticado/i);
});

test("home v4 copy stays concrete, non-formulaic and avoids invented performance", () => {
  const spanish = copy.slice(copy.indexOf('"es-AR":'), copy.indexOf("  en:"));
  const english = copy.slice(copy.indexOf("  en:"), copy.indexOf('  "pt-BR":'));
  const portuguese = copy.slice(copy.indexOf('  "pt-BR":'));

  assert.match(spanish, /hero:\s*\{[\s\S]*?title: "(?:Convertí|Conectá|Identificá)[^"]*(?:producto|unidad)[^"]*"/);
  assert.match(english, /hero:\s*\{[\s\S]*?title: "(?:Turn|Connect|Identify)[^"]*(?:product|unit)[^"]*"/);
  assert.match(portuguese, /hero:\s*\{[\s\S]*?title: "(?:Transforme|Conecte|Identifique)[^"]*(?:produto|unidade)[^"]*"/);
  assert.doesNotMatch(copy, /Cada producto conectado|Every product connected|Cada produto conectado|Cada decisión, más clara|Every decision clearer|Cada decisão mais clara/);
  assert.doesNotMatch(copy, /\b(?:99(?:\.\d+)?%|10x|million products|clientes activos|active customers)\b/i);
  assert.doesNotMatch(copy, /Math\.random|crypto\.randomUUID/);
});

test("home v4 shows real multivertical breadth without presenting a prospect as a customer", () => {
  const spanish = copy.slice(copy.indexOf('"es-AR":'), copy.indexOf("  en:"));

  assert.match(copy, /Agro e insumos/);
  assert.match(copy, /Farma y salud/);
  assert.match(copy, /Bodegas de alta gama/);
  assert.match(copy, /Moda y bienes durables/);
  assert.match(copy, /\/images\/nexid-v4\/agro-enterprise\.webp/);
  assert.match(copy, /\/images\/nexid-v4\/pharma-enterprise\.webp/);
  assert.match(copy, /\/images\/nexid-v4\/winery-enterprise\.webp/);
  assert.match(copy, /\/images\/nexid-v4\/fashion-enterprise\.webp/);
  assert.match(copy, /Una plataforma\. Distintas industrias\./);
  assert.match(copy, /Escenario ilustrativo · Sin datos de cliente/);
  assert.doesNotMatch(copy, /Syngenta|Bayer|cliente confirmado|confirmed customer/i);
  assert.doesNotMatch(copy, /Gran Reserva|Wine Secure/i);
  assert.doesNotMatch(spanish, /(?:title|body|visualKicker|visualTitle): "[^"]*\bpremium\b/i);
});

test("Spanish commercial copy is plain-language and attributes nexID to Inmovar", () => {
  const spanish = copy.slice(copy.indexOf('"es-AR":'), copy.indexOf("  en:"));
  const visibleSpanish = (spanish.match(/"[^"\n]*"/g) ?? []).join("\n");
  assert.match(spanish, /etiqueta inteligente o un código/);
  assert.doesNotMatch(spanish, /código seguro/);
  assert.match(spanish, /lecturas repetidas/);
  assert.match(spanish, /Inmovar Latam SAS/);
  assert.doesNotMatch(visibleSpanish, /\b(?:tap|scan|freshness|replay|ownership|loyalty|Developers|Proof Verify|Demo Lab)\b/);
  assert.doesNotMatch(copy, /rights: "nexID · Intellitech/);
});

test("Spanish and Portuguese navigation do not leak English commercial labels", () => {
  const spanish = navigation.slice(navigation.indexOf("const esAR"), navigation.indexOf("const en"));
  const portuguese = navigation.slice(navigation.indexOf("const ptBR"), navigation.indexOf("export const"));
  assert.match(spanish, /label: "Demostraciones"/);
  assert.match(spanish, /label: "Desarrolladores"/);
  assert.match(portuguese, /label: "Demonstrações"/);
  assert.match(portuguese, /label: "Desenvolvedores"/);
  assert.doesNotMatch(`${spanish}\n${portuguese}`, /label: "(?:Demo|Developers|Stack|SDK)"/);
});
