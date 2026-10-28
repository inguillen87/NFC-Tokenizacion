import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { portalSommelierFailure, portalSommelierHistory, requestPortalSommelierAnswer } from "../src/app/me/sommelier/portal-managed-sommelier.ts";

const client = readFileSync(new URL("../src/app/me/sommelier/sommelier-client.tsx", import.meta.url), "utf8");
const legacy = readFileSync(new URL("../src/lib/sommelier-conversation.ts", import.meta.url), "utf8");
const received = (overrides = {}) => ({ ok: true, answer: "Orientación sintética: contame qué comida vas a preparar.", source: "live", fallback: false, provider: "huggingface", model: "synthetic-managed-model", demo: false, sources: [], suggestedQuestions: ["¿Qué comida vas a preparar?"], ...overrides });
const reply = body => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

test("portal sends one authenticated general managed request and no URL identity/event/demo facts", async () => {
  const calls = [];
  const result = await requestPortalSommelierAnswer("  Pregunta sintética  ", [], Object.assign({ fetchImpl: async (url, init) => { calls.push({ url, init }); return reply(received()); } }, { eventId: "715", demoProfile: "valle-secreto", productContext: { productName: "Untrusted URL name" }, tenant: "foreign" }));
  assert.equal(result.status, "received"); assert.equal(result.data.fallback, false); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/sommelier/chat"); assert.equal(calls[0].init.credentials, "same-origin"); assert.equal(calls[0].init.cache, "no-store");
  assert.deepEqual(JSON.parse(calls[0].init.body), { mode: "consumer", question: "Pregunta sintética", locale: "es-AR", history: [] });
});
test("history excludes welcome, failed/pending questions and local guides, retaining reported previous conversation", () => {
  const rows = [{ sender: "sommelier", text: "Local declared URL name", provenance: { mode: "context" } }, { sender: "user", text: "failed private query", delivery: "unconfirmed" }, { sender: "user", text: "pending", delivery: "pending" }, { sender: "sommelier", text: "Local static guidance", provenance: { mode: "local-fallback" } }, { sender: "user", text: "Dinner", delivery: "received" }, { sender: "sommelier", text: "What food?", provenance: { mode: "live" } }];
  assert.deepEqual(portalSommelierHistory(rows), [{ role: "user", content: "Dinner" }, { role: "assistant", content: "What food?" }]);
});
test("managed history retains its six-message, per-message and UTF-8 bounds without mutating source messages", async () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ sender: i % 2 ? "sommelier" : "user", text: "😀".repeat(800) + i, delivery: "received" })), before = JSON.stringify(rows), history = portalSommelierHistory(rows);
  assert.ok(history.length <= 6); assert.ok(history.every(row => row.content.length <= 1000)); assert.ok(new TextEncoder().encode(JSON.stringify(history)).length <= 6000); assert.equal(JSON.stringify(rows), before);
});
test("successful managed fallback is disclosed as server guidance and strips provider claims", async () => {
  const result = await requestPortalSommelierAnswer("QA", [], { fetchImpl: async () => reply(received({ source: "fallback", fallback: true, provider: "ignored", model: "ignored", suggestedQuestions: [] })) });
  assert.equal(result.status, "received"); assert.equal(result.data.fallback, true); assert.equal(Object.hasOwn(result.data, "provider"), false); assert.equal(Object.hasOwn(result.data, "model"), false);
});
test("consumer session denial remains distinct and never falls back to a local success", async () => {
  for (const [httpStatus, reason] of [[401, undefined], [403, "sommelier_consumer_session_required"]]) {
    const result = await requestPortalSommelierAnswer("QA", [], { fetchImpl: async () => new Response(JSON.stringify({ ok: false, reason }), { status: httpStatus }) });
    assert.equal(result.status, "unavailable"); assert.equal(portalSommelierFailure(result).kind, "session"); assert.equal(portalSommelierFailure(result).allowLocalGuide, false);
  }
});
test("403 access denial never becomes a successful empty response or a local guide", async () => {
  for (const reason of [undefined, "sommelier_event_not_authorized", "sommelier_origin_rejected", "private-provider-message"] ) {
    const result = await requestPortalSommelierAnswer("QA", [], { fetchImpl: async () => new Response(JSON.stringify({ ok: false, reason }), { status: 403 }) });
    assert.equal(result.status, "unavailable"); const failure = portalSommelierFailure(result); assert.equal(failure.kind, "access"); assert.equal(failure.allowLocalGuide, false); assert.doesNotMatch(failure.feedback, /private-provider-message/);
  }
});
test("429 retains quota meaning and never enables a local guide or an automatic retry", async () => {
  let calls = 0; const result = await requestPortalSommelierAnswer("QA", [], { fetchImpl: async () => { calls++; return new Response(JSON.stringify({ ok: false, reason: "synthetic_limit" }), { status: 429 }); } });
  assert.equal(calls, 1); assert.equal(result.status, "unavailable"); const failure = portalSommelierFailure(result); assert.equal(failure.kind, "limit"); assert.equal(failure.allowLocalGuide, false); assert.match(failure.feedback, /límite temporal/);
});
test("503 and connection failure allow only an explicitly local unconfirmed guide", async () => {
  for (const fetchImpl of [async () => new Response(JSON.stringify({ ok: false }), { status: 503 }), async () => { throw Error("synthetic private diagnostic"); }]) {
    const result = await requestPortalSommelierAnswer("QA", [], { fetchImpl }); assert.equal(result.status, "unavailable"); const failure = portalSommelierFailure(result); assert.equal(failure.kind, "service"); assert.equal(failure.allowLocalGuide, true); assert.match(failure.feedback, /La guía local no confirma una respuesta de IA/); assert.doesNotMatch(failure.feedback, /synthetic private diagnostic/);
  }
});
test("deadline covers stalled headers and aborts one managed request without retry", async () => {
  let calls = 0, signal; const result = await requestPortalSommelierAnswer("QA", [], { timeoutMs: 10, fetchImpl: async (_url, init) => { calls++; signal = init.signal; return new Promise(() => {}); } });
  assert.equal(calls, 1); assert.equal(signal.aborted, true); assert.deepEqual(result, { status: "unavailable", reason: "timeout" }); assert.match(portalSommelierFailure(result).feedback, /no respondió a tiempo/);
});
test("a pre-aborted question makes zero requests and invalid managed success envelopes stay unavailable", async () => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  assert.deepEqual(await requestPortalSommelierAnswer("QA", [], { signal: controller.signal, fetchImpl: async () => { calls++; throw Error("unexpected"); } }), { status: "unavailable", reason: "cancelled" }); assert.equal(calls, 0);
  for (const body of [received({ demo: true }), received({ fallback: true }), received({ source: "unknown" }), received({ provider: "" }), { optimizedText: "legacy response", fallback: false }]) {
    assert.equal((await requestPortalSommelierAnswer("QA", [], { fetchImpl: async () => reply(body) })).status, "unavailable");
  }
});
test("source retains declared URL identity while routing the portal to managed general guidance only", () => {
  assert.ok(client.includes("requestPortalSommelierAnswer"));
  assert.ok(client.includes("MANAGED_SOMMELIER_QUESTION_MAX_CHARS"));
  assert.ok(client.includes("Identidad declarada"));
  assert.ok(client.includes("No se envían como ficha al servicio"));
  assert.ok(client.includes("safeSommelierGuidance(textToSend"));
  assert.equal(client.includes("requestSommelierAnswer"), false);
  assert.equal(client.includes("/api/cognitive-ai"), false);
  assert.ok(legacy.includes("/api/cognitive-ai"));
});
test("source keeps cancellation, explicit send, truthful errors and prepare-only suggestions", () => {
  assert.ok(client.includes("controller.signal.aborted || requestRef.current !== controller"));
  assert.ok(client.includes("delivery: \"unconfirmed\""));
  assert.ok(client.includes("failure.allowLocalGuide"));
  assert.ok(client.includes("provenance: { mode: \"local-fallback\""));
  assert.ok(client.includes("setInput(question); inputRef.current?.focus()"));
  assert.ok(client.includes("maxLength={MANAGED_SOMMELIER_QUESTION_MAX_CHARS}"));
  assert.ok(client.includes("Volver a ingresar"));
  assert.ok(client.includes("Revisar mis productos"));
});

test('portal adapter retains received-fallback recovery for the real consumer UI', async () => {
  let calls = 0;
  const result = await requestPortalSommelierAnswer('Conservar esta pregunta', [], { fetchImpl: async () => {
    calls++; return reply(received({ source: 'fallback', fallback: true, provider: undefined, model: undefined,
      reason: 'sommelier_budget_exhausted', retryAfter: 60 }));
  } });
  assert.equal(calls, 1); assert.equal(result.status, 'received'); assert.equal(result.data.fallback, true);
  assert.deepEqual(result.data.recovery, { reason: 'sommelier_budget_exhausted', retryAfter: 60 });
  assert.equal(Object.hasOwn(result.data, 'provider'), false);
});
test('portal HTTP429 keeps an API wait without inferring missing balance or retrying', async () => {
  let calls = 0;
  const result = await requestPortalSommelierAnswer('Conservar esta consulta', [], { fetchImpl: async () => {
    calls++; return Response.json({ ok: false, reason: 'private-provider-insufficient_quota' }, { status: 429, headers: { 'retry-after': '24' } });
  } });
  assert.equal(calls, 1); assert.equal(result.status, 'unavailable'); assert.deepEqual(result.recovery, { retryAfter: 24 });
  const failure = portalSommelierFailure(result); assert.equal(failure.kind, 'limit');
  assert.doesNotMatch(failure.feedback + JSON.stringify(result), /private-provider|insufficient_quota|sin cr[eé]dito|saldo insuficiente/i);
});
