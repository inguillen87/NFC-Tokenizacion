import assert from "node:assert/strict";
import test from "node:test";
import { demoSommelierAnswer, demoSommelierCopy, demoSommelierPrompts } from "../src/app/sun/sun-demo-sommelier.ts";
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

test("the five Valle entries answer their own topic and link the appropriate producer source", () => {
  const wine = VALLE_SECRETO_DEMO;
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const prompts = demoSommelierPrompts(locale, wine);
    assert.equal(prompts.length, 5);
    assert.equal(new Set(prompts).size, 5);
    assert.equal(demoSommelierPrompts(locale).length, 3, "generic guide keeps its current entries");
    for (const [index, prompt] of prompts.entries()) {
      const answer = demoSommelierAnswer(prompt, locale, wine);
      assert.equal(answer.topic, ["gift", "pairing", "serving", "sustainability", "visit"][index]);
      assert.equal(answer.sourceUrl, [wine.technicalSheet, wine.technicalSheet, wine.technicalSheet, wine.practices, wine.experiences][index]);
      assert.equal(answer.followUps.length, 3);
      assert.equal(new Set(answer.followUps.map(next => next.question)).size, 3);
    }
  }
});

test("a brief dish reply continues a local pairing conversation without leaking producer facts into generic guidance", () => {
  for (const [locale, dish] of [["es-AR", "Cordero"], ["en", "Lamb"], ["pt-BR", "Cordeiro"]]) {
    const first = demoSommelierAnswer(demoSommelierCopy(locale).prompts[1], locale, VALLE_SECRETO_DEMO);
    const reply = demoSommelierAnswer(dish, locale, VALLE_SECRETO_DEMO, { topic: first.topic });
    assert.equal(reply.topic, "pairing");
    assert.match(reply.text, new RegExp(dish));
    assert.match(reply.text, /Profundo 2019/);
    assert.equal(reply.sourceUrl, VALLE_SECRETO_DEMO.technicalSheet);
    const generic = demoSommelierAnswer(dish, locale, null, { topic: "pairing" });
    assert.equal(generic.text, demoSommelierCopy(locale).unknown);
    assert.equal(generic.sourceUrl, undefined);
    assert.deepEqual(generic.followUps, []);
    const withoutConversation = demoSommelierAnswer(dish, locale, VALLE_SECRETO_DEMO);
    assert.equal(withoutConversation.topic, null, "a bare dish is not treated as published wine advice without a pairing conversation");
    assert.equal(withoutConversation.sourceUrl, undefined);
    const changedTopic = demoSommelierAnswer(demoSommelierCopy(locale).prompts[2], locale, VALLE_SECRETO_DEMO, { topic: "pairing" });
    assert.equal(changedTopic.topic, "serving");
    assert.match(changedTopic.text, /16–18/);
  }
});

test("ambiguous replies ask for clarification and never fabricate a pairing, stock or price", () => {
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const unknown = demoSommelierAnswer("???", locale, VALLE_SECRETO_DEMO);
    const dish = demoSommelierAnswer("salmon", locale, VALLE_SECRETO_DEMO, { topic: "pairing" });
    assert.match(unknown.text, /\?/);
    assert.match(dish.text, /\?/);
    assert.equal(unknown.sourceUrl, undefined);
    assert.equal(dish.sourceUrl, undefined);
    assert.doesNotMatch(dish.text, /salmon|salm[oó]n|perfect|ideal|garant|\$|USD/i);
    assert.equal(dish.topic, "pairing");
    const switchTopic = demoSommelierAnswer("origen", locale, VALLE_SECRETO_DEMO, { topic: "pairing" });
    assert.equal(switchTopic.topic, "facts");
    assert.match(switchTopic.text, /Cachapoal/);
  }
});
