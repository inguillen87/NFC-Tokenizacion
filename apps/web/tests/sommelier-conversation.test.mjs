import assert from "node:assert/strict";
import test from "node:test";
import { requestSommelierAnswer, sommelierSelection, sommelierWelcome } from "../src/lib/sommelier-conversation.ts";
import { classifySommelierResponse } from "../src/lib/sommelier-guidance.ts";

test("selection accepts only single text values and never invents a product or brand", () => {
  assert.deepEqual(sommelierSelection({}), { productName: "", brandName: "" });
  assert.deepEqual(sommelierSelection({ product: ["one", "two"], brand: 42 }), { productName: "", brandName: "" });
  assert.deepEqual(sommelierSelection({ product: "  Vino\u0000\n de ensayo ", brand: " Marca\tde ensayo " }), { productName: "Vino de ensayo", brandName: "Marca de ensayo" });
  assert.equal(sommelierSelection({ product: "a".repeat(500) }).productName.length, 120);
  assert.match(sommelierWelcome({}), /No seleccionaste un producto/);
  assert.doesNotMatch(sommelierWelcome({}), /Gran Reserva|Bodega nexID Partner/);
});

test("one explicit question preserves the existing endpoint, tone and declared context contract", async () => {
  const calls = [];
  const result = await requestSommelierAnswer("Pregunta sintética", { productName: "Vino QA", brandName: "Marca QA" }, { fetchImpl: async (url, init) => {
    calls.push({ url, ...init });
    return new Response(JSON.stringify({ optimizedText: " Orientación sintética ", fallback: false, provider: "provider-qa", model: "model-qa" }));
  } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/cognitive-ai");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].credentials, "same-origin");
  assert.deepEqual(JSON.parse(calls[0].body), { text: "Pregunta sintética", tone: "sommelier-chat", productContext: { productName: "Vino QA", brandName: "Marca QA" } });
  assert.equal(result.status, "received");
  assert.equal(result.data.optimizedText, "Orientación sintética");
  assert.equal(classifySommelierResponse(result.data).mode, "live");
});

test("an HTTP denial cannot become received even if it contains text and live provenance", async () => {
  const result = await requestSommelierAnswer("QA", {}, { fetchImpl: async () => new Response(JSON.stringify({ optimizedText: "denied", fallback: false, provider: "qa", model: "qa" }), { status: 503 }) });
  assert.deepEqual(result, { status: "unavailable", reason: "http-error" });
});

test("malformed, empty and non-text answers remain unavailable", async () => {
  for (const body of ["not json", "null", "[]", "{}", '{"optimizedText":" "}', '{"optimizedText":42}']) {
    const result = await requestSommelierAnswer("QA", {}, { fetchImpl: async () => new Response(body) });
    assert.equal(result.status, "unavailable", body);
  }
});

test("header deadline finishes even if the transport ignores abort, with one request and no retry", async () => {
  let calls = 0, signal;
  const result = await requestSommelierAnswer("QA", {}, { timeoutMs: 15, fetchImpl: (_url, init) => { calls++; signal = init.signal; return new Promise(() => {}); } });
  assert.deepEqual(result, { status: "unavailable", reason: "timeout" });
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
});

test("JSON body deadline cannot hang or later classify a delayed answer as received", async () => {
  let release;
  const body = new Promise(resolve => { release = resolve; });
  const result = await requestSommelierAnswer("QA", {}, { timeoutMs: 15, fetchImpl: async () => ({ ok: true, json: () => body }) });
  assert.deepEqual(result, { status: "unavailable", reason: "timeout" });
  release({ optimizedText: "Late synthetic answer", fallback: false, provider: "qa", model: "qa" });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(result.status, "unavailable");
});

test("navigation cancellation finishes immediately while body decoding ignores abort", async () => {
  const controller = new AbortController();
  const result = requestSommelierAnswer("QA", {}, { signal: controller.signal, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  await new Promise(resolve => setTimeout(resolve, 0));
  controller.abort();
  assert.deepEqual(await result, { status: "unavailable", reason: "cancelled" });
});

test("a cancelled selection starts no request; network errors expose no upstream detail", async () => {
  let calls = 0;
  const controller = new AbortController(); controller.abort();
  assert.deepEqual(await requestSommelierAnswer("QA", {}, { signal: controller.signal, fetchImpl: () => { calls++; throw Error("Unexpected"); } }), { status: "unavailable", reason: "cancelled" });
  assert.equal(calls, 0);
  assert.deepEqual(await requestSommelierAnswer("QA", {}, { fetchImpl: async () => { throw Error("Private provider diagnostic"); } }), { status: "unavailable", reason: "connection" });
});
