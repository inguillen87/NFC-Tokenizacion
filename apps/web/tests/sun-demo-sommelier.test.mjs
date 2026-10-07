import assert from "node:assert/strict";
import test from "node:test";
import { demoSommelierAnswer, demoSommelierCopy } from "../src/app/sun/sun-demo-sommelier.ts";
import { selectedValleSecretoDemo, VALLE_SECRETO_DEMO } from "../src/app/sun/valle-secreto-demo.ts";

test("demo wine guide answers a gift, pairing and serving prompt in each language", () => {
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const copy = demoSommelierCopy(locale);
    assert.equal(copy.prompts.length, 3);
    for (const prompt of copy.prompts) {
      const generic = demoSommelierAnswer(prompt, locale);
      const named = demoSommelierAnswer(prompt, locale, VALLE_SECRETO_DEMO);
      assert.ok(generic.text.length > 60);
      assert.notEqual(generic.text, copy.unknown, `${locale}: suggested prompt has a useful answer`);
      assert.equal(generic.sourceUrl, undefined);
      assert.doesNotMatch(generic.text, /Profundo|Cachapoal|24 meses|16–18/);
      assert.equal(named.sourceUrl, VALLE_SECRETO_DEMO.technicalSheet);
      assert.notEqual(named.text, generic.text);
    }
  }
});

test("producer claims link to their actual public source without fabricating commercial terms", () => {
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const serving = demoSommelierAnswer("temperatura", locale, VALLE_SECRETO_DEMO);
    const treasure = demoSommelierAnswer("Mapa del Tesoro", locale, VALLE_SECRETO_DEMO);
    const sustainability = demoSommelierAnswer("sustentabilidad CO2", locale, VALLE_SECRETO_DEMO);
    assert.match(serving.text, /16–18/);
    assert.equal(treasure.sourceUrl, VALLE_SECRETO_DEMO.experiences);
    assert.equal(sustainability.sourceUrl, VALLE_SECRETO_DEMO.practices);
    assert.doesNotMatch(sustainability.text, /\d+\s*(?:kg|litros|liters|litros|CO2)/i);
    assert.doesNotMatch(treasure.text, /(?:ganaste|you won|voc[eê] ganhou)/i);
  }
});

test("an explicit named demo never selects producer facts for a real passport", () => {
  assert.equal(selectedValleSecretoDemo(false, "valle-secreto"), null);
  assert.equal(selectedValleSecretoDemo(true, "other-brand"), null);
  assert.equal(selectedValleSecretoDemo(true, ["valle-secreto"]), null);
  assert.equal(selectedValleSecretoDemo(true, "valle-secreto"), VALLE_SECRETO_DEMO);
});
