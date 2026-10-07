import assert from "node:assert/strict";
import test from "node:test";
import { demoWineTrivia } from "../src/app/sun/sun-demo-wine-quiz.ts";
import { translateSunUiText } from "../src/app/sun/sun-locale.ts";

const input = { productName: "Vino de ensayo", wineryName: "Bodega de ensayo", locale: "es-AR" };

test("demo wine education is usable without exposing technical or business questions", () => {
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const questions = demoWineTrivia({ ...input, locale });
    assert.equal(questions.length, 3);
    assert.equal(new Set(questions.map(question => question.id)).size, 3);
    for (const question of questions) {
      assert.equal(question.options.length, 3);
      assert.ok(Number.isInteger(question.correctIndex));
      assert.ok(question.options[question.correctIndex]);
      assert.ok(question.explanation.length > 20);
      assert.doesNotMatch(JSON.stringify(question), /\b(?:replay|SUN|CMAC|batch|CRM|puntos)\b|campañ|contraseñ|recompensa/i);
    }
  }
});

test("selected demo wine facts produce answers attributed to that wine sheet in each language", () => {
  const facts = { region: "Valle de ensayo", vintage: "2019", barrelMonths: 12 };
  for (const locale of ["es-AR", "en", "pt-BR"]) {
    const questions = demoWineTrivia({ ...input, locale, facts });
    assert.equal(questions[0].options[questions[0].correctIndex], facts.region);
    assert.equal(questions[1].options[questions[1].correctIndex], facts.vintage);
    assert.match(questions[2].options[questions[2].correctIndex], /12/);
    assert.match(questions[0].explanation, /Bodega de ensayo/);
    for (const question of questions) assert.equal(new Set(question.options).size, 3);
    assert.equal(questions[1].correctIndex, 1, "the quiz should not teach that every first choice is correct");
  }
});

test("malformed or incomplete demo facts fall back to wine education rather than invented wine metadata", () => {
  for (const facts of [
    { region: "", vintage: "2019", barrelMonths: 12 },
    { region: "Valle de ensayo", vintage: "sin dato", barrelMonths: 12 },
    { region: "Valle de ensayo", vintage: "2019", barrelMonths: -1 },
    { region: "Valle de ensayo", vintage: "2019", barrelMonths: 12.5 },
  ]) {
    const questions = demoWineTrivia({ ...input, facts });
    assert.equal(questions[0].id, "demo-wine-storage");
    assert.doesNotMatch(JSON.stringify(questions), /Valle de ensayo|2019/);
  }
});

test("conservation conditions have an explicit label in all three SUN languages", () => {
  assert.equal(translateSunUiText("Condiciones de conservación", "es-AR"), "Condiciones de conservación");
  assert.equal(translateSunUiText("Condiciones de conservación", "en"), "Storage conditions");
  assert.equal(translateSunUiText("Condiciones de conservación", "pt-BR"), "Condições de conservação");
});
