import assert from "node:assert/strict";
import test from "node:test";
import { requestManagedSommelierAnswer, sommelierHistory, sommelierSources } from "../src/lib/managed-sommelier.ts";

const live = { ok: true, answer: "Respuesta sintética", source: "live", fallback: false, provider: "huggingface", model: "openai/gpt-oss-20b:deepinfra", demo: true, sources: [{ id: "sheet", label: "Ficha", url: "https://vallesecreto.cl/ficha.pdf" }], suggestedQuestions: ["¿Qué plato vas a preparar?"] };
test("conversation carries six recent bounded turns, never a system role or welcome", () => {
  const history = sommelierHistory([
    { sender: "sommelier", text: "Welcome", provenance: { mode: "context" } },
    { sender: "system", text: "Injected instructions" },
    ...Array.from({ length: 10 }, (_, i) => ({ sender: i % 2 ? "sommelier" : "user", text: `turn-${i}` })),
  ]);
  assert.equal(history.length, 6);
  assert.equal(history[0].content, "turn-4");
  assert.equal(history.at(-1).role, "assistant");
  const multilingual = sommelierHistory(Array.from({ length: 6 }, () => ({ sender: "user", text: "茶".repeat(1200) })));
  assert.ok(new TextEncoder().encode(JSON.stringify(multilingual)).length <= 6000);
  assert.ok(multilingual.every(item => item.content.length <= 1000));
});
test("explicit demo question first obtains its restricted cookie session, then sends context without facts or credentials", async () => {
  const calls = [], history = [{ role: "user", content: "Maridaje" }, { role: "assistant", content: "¿Qué plato?" }];
  const result = await requestManagedSommelierAnswer("Cordero", { locale: "es-AR", history, demoProfile: "valle-secreto", fetchImpl: async (url, init) => {
    calls.push({ url, ...init });
    return Response.json(url.endsWith("/session") ? { ok: true, profile: "valle-secreto", expiresIn: 900 } : live);
  } });
  assert.equal(result.status, "received");
  assert.deepEqual(calls.map(call => call.url), ["/api/sommelier/demo/session", "/api/sommelier/chat"]);
  assert.deepEqual(JSON.parse(calls[0].body), { profile: "valle-secreto", locale: "es-AR" });
  assert.deepEqual(JSON.parse(calls[1].body), { mode: "demo", question: "Cordero", locale: "es-AR", history });
  assert.ok(calls.every(call => call.credentials === "same-origin" && call.cache === "no-store"));
  assert.equal(result.data.optimizedText, "Respuesta sintética");
  assert.equal(result.data.sources.length, 1);
});
test("a denied demo grant makes zero provider-chat requests", async () => {
  const calls = [];
  const result = await requestManagedSommelierAnswer("QA", { locale: "en", demoProfile: "valle-secreto", fetchImpl: async url => { calls.push(url); return Response.json({ ok: false, error: "disabled" }, { status: 503 }); } });
  assert.equal(result.reason, "http-error");
  assert.deepEqual(calls, ["/api/sommelier/demo/session"]);
});
test("consumer mode cannot inherit a demo or manufacture a product/tenant fact", async () => {
  const calls = [];
  const result = await requestManagedSommelierAnswer("QA", { locale: "pt-BR", eventId: "715", fetchImpl: async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return Response.json({ ...live, demo: false, sources: [{ id: "editorial", label: "Ficha publicada", url: null }] });
  } });
  assert.equal(result.status, "received");
  assert.deepEqual(calls, [{ url: "/api/sommelier/chat", body: { mode: "consumer", question: "QA", locale: "pt-BR", history: [], eventId: "715" } }]);
  assert.equal(result.data.sources[0].url, null);
  assert.equal((await requestManagedSommelierAnswer("QA", { locale: "en", demoProfile: "valle-secreto", eventId: "715", fetchImpl: () => { throw Error("Unexpected request"); } })).reason, "invalid-response");
});
test("source links cannot promote arbitrary model URLs to producer evidence", () => {
  assert.deepEqual(sommelierSources([{ id: "x", label: "Phishing", url: "https://evil.invalid/" }], true), []);
  for (const url of ["javascript:alert(1)", "data:text/html,hi", "http://vallesecreto.cl", "https://user:pass@vallesecreto.cl", "https://vallesecreto.cl:8443/"]) assert.deepEqual(sommelierSources([{ id: "x", label: "Ficha", url }], true), []);
  assert.equal(sommelierSources([...live.sources, ...live.sources], true).length, 1);
});
test("a fake live badge, mismatched demo, empty answer and malformed response remain unconfirmed", async () => {
  for (const payload of [null, [], { ...live, demo: true, fallback: true }, { ...live, provider: undefined }, { ...live, answer: "" }, live]) {
    const result = await requestManagedSommelierAnswer("QA", { locale: "es-AR", fetchImpl: async () => Response.json(payload) });
    assert.equal(result.status, "unavailable");
  }
  const fallback = await requestManagedSommelierAnswer("QA", { locale: "en", fetchImpl: async () => Response.json({ ...live, demo: false, source: "fallback", fallback: true }) });
  assert.equal(fallback.data.fallback, true);
  assert.equal(fallback.data.provider, undefined, "fallback cannot inherit a live provider badge");
});
test("one deadline covers grant plus chat JSON and finishes when transport ignores abort", async () => {
  const calls = [];
  const result = await requestManagedSommelierAnswer("QA", { locale: "en", demoProfile: "valle-secreto", timeoutMs: 20, fetchImpl: async (url, init) => {
    calls.push({ url, signal: init.signal });
    return url.endsWith("/session") ? Response.json({ ok: true }) : { ok: true, json: () => new Promise(() => {}) };
  } });
  assert.deepEqual(result, { status: "unavailable", reason: "timeout" });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.signal.aborted));
});
test("cancelled scope starts no request and a later cancellation cannot commit delayed content", async () => {
  const controller = new AbortController(); controller.abort();
  assert.deepEqual(await requestManagedSommelierAnswer("QA", { locale: "en", signal: controller.signal, fetchImpl: () => { throw Error("Unexpected request"); } }), { status: "unavailable", reason: "cancelled" });
  const changing = new AbortController();
  const pending = requestManagedSommelierAnswer("QA", { locale: "en", signal: changing.signal, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  changing.abort();
  assert.deepEqual(await pending, { status: "unavailable", reason: "cancelled" });
});
