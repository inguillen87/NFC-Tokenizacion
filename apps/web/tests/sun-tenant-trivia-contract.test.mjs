import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { resolveSunTenantIdentity } from "../src/app/sun/sun-tenant-identity.ts";
import * as trivia from "../src/app/sun/sun-trivia-model.ts";
import * as policy from "../src/app/sun/post-tap-policy.ts";
import * as sommelier from "../src/lib/sommelier-guidance.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/app/sun/qr-engagement-suite.tsx", import.meta.url), "utf8");
const module = { exports: {} };
const overrides = {
  "./sun-trivia-model": trivia, "./post-tap-policy": policy, "../../lib/sommelier-guidance": sommelier,
  "./sun-locale-provider": { useSunLocale: () => ({ locale: "es-AR" }) },
  "./qr-engagement-suite.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
};
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
new Function("require", "module", "exports", js)(name => name in overrides ? overrides[name] : require(name), module, module.exports);
const suite = props => renderToStaticMarkup(React.createElement(module.exports.QREngagementSuite, {
  wineryName: "Empresa reportada", productName: "Producto reportado", tenantSlug: "tenant-a", eventId: "715", initialTab: "trivia", allowedActions: ["rewards"], ...props,
}));
const quiz = { ok: true, quiz: { id: "quiz-a", questions: [{ id: "q1", prompt: "Pregunta publicada", options: ["Opción uno", "Opción dos"], correctIndex: 1 }] } };

test("a real SUN contract ignores URL-shaped brand and company fields", () => {
  const contract = { identity: { tenantSlug: "tenant-a" }, tenant: { slug: "tenant-a", name: "Empresa API" }, product: { winery: "Productor API" },
    tenantSlug: "demobodega", brand: "Marca en URL", winery: "Balmec", query: new URLSearchParams("tenant=tenant-b&brand=URL&winery=URL") };
  assert.deepEqual(resolveSunTenantIdentity(contract), { tenantSlug: "tenant-a", brandName: "Productor API" });
  assert.equal(resolveSunTenantIdentity(contract).tenantSlug, "tenant-a");
});
test("missing, conflicting or malformed company identity never selects a demo tenant", () => {
  for (const contract of [{}, { identity: { tenantSlug: "tenant-a" }, tenant: { slug: "tenant-b" } }, { identity: { tenantSlug: "../tenant-a" } }, { tenant: { slug: "tenant-a\n" } }]) {
    assert.equal(resolveSunTenantIdentity(contract).tenantSlug, null);
  }
  assert.deepEqual(resolveSunTenantIdentity({}), { tenantSlug: null, brandName: null });
  assert.equal(resolveSunTenantIdentity({ identity: { tenantSlug: "demobodega" }, product: { winery: "Marca de demo explícita" } }).brandName, "Marca de demo explícita");
});
test("only a configured successful quiz can supply playable public questions", () => {
  assert.deepEqual(trivia.configuredTriviaQuestions(quiz), [{ id: "q1", prompt: "Pregunta publicada", options: ["Opción uno", "Opción dos"] }]);
  for (const payload of [null, { ...quiz, ok: false }, { quiz: quiz.quiz }, { ok: true, quiz: { id: "quiz-a", questions: [] } },
    { ok: true, quiz: { id: "quiz-a", questions: [...quiz.quiz.questions, ...quiz.quiz.questions] } },
    { ok: true, quiz: { id: "quiz-a", questions: [{ id: "q1", prompt: "Pregunta", options: ["solo una"] }] } }]) assert.equal(trivia.configuredTriviaQuestions(payload), null);
});
test("real trivia without confirmed questions renders recovery and no invented exercise", () => {
  for (const props of [{}, { freshToken: "verified-pipeline-token" }, { tenantSlug: null }, { eventId: null }]) {
    const html = suite(props);
    assert.match(html, /sun-trivia-unavailable/);
    assert.doesNotMatch(html, /Cata, visita o voucher|Elegir respuesta|Finalizar trivia|Resultado educativo local|Trivia completada|Puntos guardados/);
  }
});
test("local illustration is opt-in only and labels its lack of award or persistence", () => {
  const html = suite({ isDemoPreview: true, eventId: null, tenantSlug: null });
  assert.match(html, /Trivia ilustrativa de demostración/);
  assert.match(html, /No guarda respuestas ni otorga puntos o premios/);
  assert.match(html, /Elegir respuesta/);
});
test("submission requires exact event scope and a capability while leaving it out of navigation", () => {
  const input = { eventId: "9007199254740993", tenantSlug: "tenant-a", freshToken: "verified-pipeline-token", locale: "en", answers: [{ questionId: "q1", answerIndex: 1 }] };
  assert.deepEqual(trivia.triviaSubmissionBody(input), { locale: "en", tenantSlug: "tenant-a", fresh_token: "verified-pipeline-token", answers: input.answers });
  for (const changes of [{ eventId: "0" }, { eventId: "01" }, { eventId: "9223372036854775808" }, { eventId: null }, { tenantSlug: null }, { tenantSlug: "../other" }, { freshToken: "" }, { answers: [] }, { answers: [{ questionId: "q1", answerIndex: -1 }] }]) assert.equal(trivia.triviaSubmissionBody({ ...input, ...changes }), null);
  assert.equal(trivia.triviaSubmissionBody(input).productName, undefined);
  assert.equal(trivia.triviaSubmissionBody(input).brandName, undefined);
});
test("a quiz score exists only after a complete validated server confirmation", () => {
  const result = { ok: true, score: 1, total: 2, pointsAwarded: 10, requiresLogin: false, alreadyCompleted: false };
  assert.deepEqual(trivia.confirmedTriviaResult(result, 2), { score: 1, total: 2, pointsAwarded: 10, requiresLogin: false, alreadyCompleted: false });
  for (const changes of [{ ok: false }, { score: 3 }, { total: 1 }, { pointsAwarded: null }, { pointsAwarded: -10 }, { requiresLogin: undefined }, { alreadyCompleted: undefined }]) assert.equal(trivia.confirmedTriviaResult({ ...result, ...changes }, 2), null);
  assert.equal(trivia.confirmedTriviaResult({}, 2), null);
});
test("only a completed previous attempt can confirm existing points", () => {
  const attempt = { status: "completed", score: 1, total_questions: 2, points_awarded: 10 };
  assert.equal(trivia.confirmedPreviousTrivia(attempt, 2, true).alreadyCompleted, true);
  assert.equal(trivia.confirmedPreviousTrivia({ ...attempt, status: "pending" }, 2, true), null);
  assert.equal(trivia.confirmedPreviousTrivia({ ...attempt, points_awarded: undefined }, 2, true), null);
  for (const points_awarded of [null, "", " ", -1]) assert.equal(trivia.confirmedPreviousTrivia({ ...attempt, points_awarded }, 2, true), null);
});
test("missing configuration, expired authorization and uncertain submissions have honest recovery", () => {
  assert.match(trivia.triviaRecoveryDescription("quiz_not_configured", true), /no tiene una trivia publicada/);
  assert.match(trivia.triviaRecoveryDescription("fresh_tap_capability_required", true), /autorización vigente/);
  assert.match(trivia.triviaRecoveryDescription("unauthorized", true), /Ingresá a tu cuenta/);
  assert.match(trivia.triviaRecoveryDescription("trivia_submit_failed", true), /ni se repite el envío/);
});
