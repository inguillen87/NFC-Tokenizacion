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
import * as availability from "../src/app/sun/tenant-action-availability.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/app/sun/qr-engagement-suite.tsx", import.meta.url), "utf8");
const module = { exports: {} };
const overrides = {
  "./sun-trivia-model": trivia, "./post-tap-policy": policy, "./tenant-action-availability": availability, "../../lib/sommelier-guidance": sommelier,
  "./sun-locale-provider": { useSunLocale: () => ({ locale: "es-AR" }) },
  "./qr-engagement-suite.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
};
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
new Function("require", "module", "exports", js)(name => name in overrides ? overrides[name] : require(name), module, module.exports);
const quizId = "10000000-0000-4000-8000-000000000001", revision = "a".repeat(64);
const configuration = { version: availability.TENANT_ACTIONS_VERSION, status: "published", allowedActions: [], catalogAvailable: false,
  program: { id: "program-a", name: "Programa publicado", pointsName: "Puntos", pointsPerValidTap: 0 },
  trivia: { id: quizId, title: "Trivia publicada", revision, pointsPerCorrect: 0, completionBonus: 0 } };
const suite = props => renderToStaticMarkup(React.createElement(module.exports.QREngagementSuite, {
  wineryName: "Empresa reportada", productName: "Producto reportado", tenantSlug: "tenant-a", eventId: "715", initialTab: "trivia", configuration, allowedActions: ["rewards"], ...props,
}));
const quiz = { ok: true, quiz: { id: quizId, revision, questions: [{ id: "q1", prompt: "Pregunta publicada", options: ["Opción uno", "Opción dos"], correctIndex: 1 }] } };

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
    assert.match(html, /sun-(?:trivia|actions)-unavailable/);
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
  const input = { eventId: "9007199254740993", tenantSlug: "tenant-a", freshToken: "verified-pipeline-token", locale: "en", expectedQuizId: quizId, expectedQuizRevision: revision, answers: [{ questionId: "q1", answerIndex: 1 }] };
  assert.deepEqual(trivia.triviaSubmissionBody(input), { locale: "en", tenantSlug: "tenant-a", fresh_token: "verified-pipeline-token", expectedQuizId: quizId, expectedQuizRevision: revision, answers: input.answers });
  for (const changes of [{ expectedQuizId: undefined }, { expectedQuizRevision: "B".repeat(64) }, { expectedQuizRevision: "a".repeat(63) }, { eventId: "0" }, { eventId: "01" }, { eventId: "9223372036854775808" }, { eventId: null }, { tenantSlug: null }, { tenantSlug: "../other" }, { freshToken: "" }, { answers: [] }, { answers: [{ questionId: "q1", answerIndex: -1 }] }]) assert.equal(trivia.triviaSubmissionBody({ ...input, ...changes }), null);
  assert.equal(trivia.triviaSubmissionBody(input).productName, undefined);
  assert.equal(trivia.triviaSubmissionBody(input).brandName, undefined);
});
test("quiz publication identity is mandatory and never accepts correctness in questions", () => {
  assert.deepEqual(trivia.configuredTriviaQuiz(quiz), { id: quizId, revision, questions: [{ id: "q1", prompt: "Pregunta publicada", options: ["Opción uno", "Opción dos"] }] });
  for (const changes of [{ revision: null }, { revision: "A".repeat(64) }, { id: "quiz-a" }]) assert.equal(trivia.configuredTriviaQuiz({ ...quiz, quiz: { ...quiz.quiz, ...changes } }), null);
});
test("an absent or withdrawn service projection renders zero interactive tabs", () => {
  for (const config of [undefined, null, { ...configuration, status: "unpublished", program: null, trivia: null }, { ...configuration, status: "unavailable" }]) {
    const html = suite({ configuration: config, freshToken: "verified-pipeline-token" });
    assert.match(html, /sun-actions-unavailable/);
    assert.doesNotMatch(html, /<form|<input|<textarea|<button|Enviar pregunta|Finalizar trivia|Novedades/);
  }
});
test("Sommelier alone has no contact, feedback or reward form", () => {
  const html = suite({ configuration: { ...configuration, allowedActions: ["sommelier"], program: null, trivia: null }, initialTab: "contact" });
  assert.match(html, /Enviar pregunta/);
  assert.doesNotMatch(html, /Registrar contacto|Enviar opinión|Finalizar trivia|Calificar con/);
  assert.doesNotMatch(source, /qr_sommelier|anonymous_qr_sommelier|void submitLead/);
});
test("a configuration change has localized recovery and keeps old answers distinct", () => {
  for (const locale of ["es-AR", "en", "pt-BR"]) assert.equal(trivia.triviaRecoveryDescription("quiz_configuration_changed", false, locale), trivia.triviaRecoveryCopy[locale].changed);
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
  assert.match(trivia.triviaRecoveryDescription("quiz_not_configured", true), /todavía no publicó una trivia/);
  assert.match(trivia.triviaRecoveryDescription("fresh_tap_capability_required", true), /Acercá de nuevo el teléfono/);
  assert.match(trivia.triviaRecoveryDescription("unauthorized", true), /Ingresá a tu cuenta/);
  assert.match(trivia.triviaRecoveryDescription("trivia_submit_failed", true), /Revisá tu cuenta antes de volver a intentarlo/);
});
test("trivia recovery localizes the next step without exposing implementation or promising an award", () => {
  for (const [locale, unpublished, newReading, uncertain] of [
    ["es-AR", /todavía no publicó/, /Acercá de nuevo el teléfono/, /Revisá tu cuenta antes/],
    ["en", /has not published/, /Hold your phone near/, /Check your account before/],
    ["pt-BR", /ainda não publicou/, /Aproxime novamente o telefone/, /Confira sua conta antes/],
  ]) {
    assert.match(trivia.triviaRecoveryDescription("quiz_not_configured", true, locale), unpublished);
    assert.match(trivia.triviaRecoveryDescription("fresh_tap_capability_required", true, locale), newReading);
    assert.match(trivia.triviaRecoveryDescription(null, false, locale), newReading);
    assert.match(trivia.triviaRecoveryDescription("trivia_submit_failed", true, locale), uncertain);
    const messages = Object.values(trivia.triviaRecoveryCopy[locale]).join(" ");
    assert.doesNotMatch(messages, /capability|autorización vigente|authorization|API|fallback|sustituyen|points awarded|puntos otorgados|pontos concedidos/i);
    assert.match(source, /triviaRecoveryDescription\(quizChanged \? "quiz_configuration_changed" : triviaError, canSubmitTrivia, locale\)/);
  }
});
