import assert from "node:assert/strict";
import test from "node:test";
import { requestManagedSommelierAnswer, sommelierHistory, sommelierSources } from "../src/lib/managed-sommelier.ts";

const live = { ok: true, answer: "Respuesta sintética", source: "live", fallback: false, provider: "huggingface", model: "openai/gpt-oss-20b:deepinfra", demo: true, sources: [{ id: "sheet", label: "Ficha", url: "https://vallesecreto.cl/ficha.pdf" }], suggestedQuestions: ["¿Qué plato vas a preparar?"] };
const syngentaLive = {
  ...live, demoProfile: "syngenta", contextSource: "syngenta_demo",
  answer: "Respuesta de producto sintética",
  sources: [{ id: "product", label: "Syngenta Argentina", url: "https://www.syngenta.com.ar/product/crop-protection/fungicida/amistar-xtra" }],
  suggestedQuestions: ["¿Para qué cultivo querés comparar las opciones?"],
};
const syngentaGrant = { ok: true, profile: "syngenta", expiresIn: 900 };
const demoFetch = payload => async url => Response.json(url.endsWith("/session") ? syngentaGrant : payload);
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

test("Syngenta grants and chat name the same demo profile without carrying tenant, NFC or browser product facts", async () => {
  const calls = [], history = [{ role: "user", content: "¿Y para trigo?" }];
  const result = await requestManagedSommelierAnswer("  Compará AMISTAR y XTRA  ", {
    locale: "pt-BR", demoProfile: "syngenta", history,
    fetchImpl: async (url, init) => {
      calls.push({ url, ...init, payload: JSON.parse(init.body) });
      return Response.json(url.endsWith("/session") ? syngentaGrant : syngentaLive);
    },
  });
  assert.equal(result.status, "received");
  assert.deepEqual(calls.map(({ url, payload }) => ({ url, payload })), [
    { url: "/api/sommelier/demo/session", payload: { profile: "syngenta", locale: "pt-BR" } },
    { url: "/api/sommelier/chat", payload: { mode: "demo", question: "Compará AMISTAR y XTRA", locale: "pt-BR", history, demoProfile: "syngenta" } },
  ]);
  assert.ok(calls.every(call => call.method === "POST" && call.credentials === "same-origin" && call.cache === "no-store"));
  assert.equal(calls[0].signal, calls[1].signal, "grant and chat share a cancellation scope");
  assert.deepEqual(result.data.sources, syngentaLive.sources);
  assert.deepEqual(result.data.suggestedQuestions, syngentaLive.suggestedQuestions);
});

test("Syngenta rejects answers from wine, consumer or unspecified context even when they claim to be live", async () => {
  for (const patch of [
    { demoProfile: "valle-secreto" }, { demoProfile: undefined },
    { contextSource: "valle_secreto_demo" }, { contextSource: "consumer_passport" }, { contextSource: undefined },
    { demo: false },
  ]) {
    const result = await requestManagedSommelierAnswer("Comparación", {
      locale: "es-AR", demoProfile: "syngenta", fetchImpl: demoFetch({ ...syngentaLive, ...patch }),
    });
    assert.deepEqual(result, { status: "unavailable", reason: "invalid-response" }, JSON.stringify(patch));
  }
  const wine = await requestManagedSommelierAnswer("Maridaje", {
    locale: "es-AR", demoProfile: "syngenta", fetchImpl: demoFetch(live),
  });
  assert.equal(wine.reason, "invalid-response");
});

test("Syngenta requires usable official evidence for live and fallback answers", async () => {
  for (const fallback of [false, true]) {
    for (const sources of [undefined, [], [{ id: "local", label: "Texto", url: null }], live.sources,
      [{ id: "external", label: "Otra fuente", url: "https://syngenta.com.ar.evil.invalid/" }]]) {
      const result = await requestManagedSommelierAnswer("¿Qué contiene?", {
        locale: "es-AR", demoProfile: "syngenta",
        fetchImpl: demoFetch({ ...syngentaLive, source: fallback ? "fallback" : "live", fallback, sources }),
      });
      assert.deepEqual(result, { status: "unavailable", reason: "invalid-response" });
    }
  }
  const fallback = await requestManagedSommelierAnswer("¿Qué contiene?", {
    locale: "es-AR", demoProfile: "syngenta",
    fetchImpl: demoFetch({ ...syngentaLive, source: "fallback", fallback: true }),
  });
  assert.equal(fallback.status, "received");
  assert.equal(fallback.data.fallback, true);
  assert.equal(fallback.data.provider, undefined);
  assert.equal(fallback.data.model, undefined);
});

test("Syngenta evidence permits only its official Argentine hosts and NXP without credentials, ports or URL data", () => {
  const allowed = ["https://syngenta.com.ar/", "https://www.syngenta.com.ar/sites/ficha.pdf", "https://www.nxp.com/products/ntag-424"];
  assert.deepEqual(sommelierSources(allowed.map((url, i) => ({ id: `source${i}`, label: `Source ${i}`, url })), true, "syngenta").map(source => source.url), allowed);
  const blocked = [
    "https://vallesecreto.cl/", "https://syngenta.com/", "https://subdomain.syngenta.com.ar/", "https://nxp.com/",
    "https://syngenta.com.ar.evil.invalid/", "http://www.syngenta.com.ar/",
    "https://user@www.syngenta.com.ar/", "https://user:password@www.syngenta.com.ar/", "https://www.syngenta.com.ar:8443/",
    "https://www.syngenta.com.ar/ficha.pdf?token=secret", "https://www.syngenta.com.ar/ficha.pdf#private",
    "https://www.nxp.com/products?eventId=715", "https://www.nxp.com/products#signature",
  ];
  for (const url of blocked) {
    assert.deepEqual(sommelierSources([{ id: "source", label: "Source", url }], true, "syngenta"), [], url);
  }
  assert.deepEqual(sommelierSources([{ id: "agro", label: "Agro", url: allowed[0] }], true, "valle-secreto"), []);
});

test("wine legacy payload and source semantics remain unchanged with no explicit chat profile required", async () => {
  const sources = [{ id: "wine", label: "Ficha", url: "https://vallesecreto.cl/ficha.pdf?language=es#maridaje" }];
  const result = await requestManagedSommelierAnswer("Maridaje", {
    locale: "es-AR", demoProfile: "valle-secreto",
    fetchImpl: async url => Response.json(url.endsWith("/session") ? { ok: true } : { ...live, sources }),
  });
  assert.equal(result.status, "received");
  assert.deepEqual(result.data.sources, sources);
});

test("wine legacy does not accept an answer explicitly declaring another demo profile", async () => {
  for (const patch of [{ demoProfile: "syngenta" }, { contextSource: "syngenta_demo" }]) {
    const result = await requestManagedSommelierAnswer("Maridaje", {
      locale: "es-AR", demoProfile: "valle-secreto",
      fetchImpl: async url => Response.json(url.endsWith("/session") ? { ok: true } : { ...live, ...patch }),
    });
    assert.deepEqual(result, { status: "unavailable", reason: "invalid-response" });
  }
  const calls = [];
  const wrongGrant = await requestManagedSommelierAnswer("Maridaje", {
    locale: "es-AR", demoProfile: "valle-secreto", fetchImpl: async url => {
      calls.push(url); return Response.json(syngentaGrant);
    },
  });
  assert.equal(wrongGrant.status, "unavailable");
  assert.deepEqual(calls, ["/api/sommelier/demo/session"]);
});

test("unsupported demo profiles, invalid locale and demo NFC event IDs cause no request", async () => {
  let calls = 0;
  for (const options of [
    { demoProfile: "syngenta", eventId: "715" }, { demoProfile: "syngenta", eventId: null },
    { demoProfile: "unsupported" }, { demoProfile: "syngenta", locale: "fr" },
  ]) {
    const result = await requestManagedSommelierAnswer("QA", {
      locale: "en", ...options, fetchImpl: async () => { calls++; return Response.json(syngentaLive); },
    });
    assert.deepEqual(result, { status: "unavailable", reason: "invalid-response" });
  }
  assert.equal(calls, 0);
});

test("Syngenta session rejection and quota denial never start chat", async () => {
  for (const status of [403, 429, 503]) {
    const calls = [];
    const result = await requestManagedSommelierAnswer("QA", {
      locale: "en", demoProfile: "syngenta", fetchImpl: async url => {
        calls.push(url); return Response.json({ ok: false, error: "unavailable" }, { status });
      },
    });
    assert.deepEqual(result, { status: "unavailable", reason: "http-error" });
    assert.deepEqual(calls, ["/api/sommelier/demo/session"]);
  }
});

test("a Syngenta session grant for another or missing profile cannot start chat", async () => {
  for (const profile of ["valle-secreto", "unsupported", undefined]) {
    const calls = [];
    const result = await requestManagedSommelierAnswer("QA", {
      locale: "en", demoProfile: "syngenta", fetchImpl: async url => {
        calls.push(url); return Response.json({ ok: true, profile });
      },
    });
    assert.equal(result.status, "unavailable");
    assert.ok(["http-error", "invalid-response"].includes(result.reason));
    assert.deepEqual(calls, ["/api/sommelier/demo/session"]);
  }
});

test("a late Syngenta grant after deadline cannot begin chat even if fetch ignores abort", async () => {
  let releaseGrant, signal;
  const calls = [];
  const result = await requestManagedSommelierAnswer("QA", {
    locale: "en", demoProfile: "syngenta", timeoutMs: 20,
    fetchImpl: (url, init) => {
      calls.push(url); signal = init.signal;
      return new Promise(resolve => { releaseGrant = resolve; });
    },
  });
  assert.deepEqual(result, { status: "unavailable", reason: "timeout" });
  assert.equal(signal.aborted, true);
  releaseGrant(Response.json(syngentaGrant));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ["/api/sommelier/demo/session"]);
});

test("cancelling a Syngenta question cannot later commit its resolved chat JSON", async () => {
  const controller = new AbortController();
  let releaseAnswer, chatStarted;
  const started = new Promise(resolve => { chatStarted = resolve; });
  const pending = requestManagedSommelierAnswer("QA", {
    locale: "en", demoProfile: "syngenta", signal: controller.signal,
    fetchImpl: async url => {
      if (url.endsWith("/session")) return Response.json(syngentaGrant);
      return { ok: true, json: () => { chatStarted(); return new Promise(resolve => { releaseAnswer = resolve; }); } };
    },
  });
  await started;
  controller.abort();
  assert.deepEqual(await pending, { status: "unavailable", reason: "cancelled" });
  releaseAnswer(syngentaLive);
  await new Promise(resolve => setImmediate(resolve));
});
