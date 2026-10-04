import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// No host environment, real network, recipient or credential enters this suite.
const ENV = {
  META_CONSUMER_OTP_GRAPH_VERSION: "v25.0", META_CONSUMER_OTP_PHONE_NUMBER_ID: "123456789012345",
  META_CONSUMER_OTP_ACCESS_TOKEN: "fixtureMetaAccessToken0123456789", META_CONSUMER_OTP_TEMPLATE_NAME: "fixture_login_code",
  META_CONSUMER_OTP_TEMPLATE_LANGUAGE: "es_AR",
};
const PAYLOAD = { contact: "+12025550123", code: "012345" };
const WAMID = "wamid.FIXTURE_RECEIPT_0123456789==";
const RAW_ERROR = `${ENV.META_CONSUMER_OTP_ACCESS_TOKEN} ${PAYLOAD.contact} ${PAYLOAD.code} ${WAMID}`;
const source = readFileSync(new URL("../src/lib/consumer-otp-meta-whatsapp.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function harness(transport) {
  const timers = new Map(), scheduled = [], cleared = [], calls = [];
  let timerId = 0;
  const module = { exports: {} };
  new Function("require", "module", "exports", "setTimeout", "clearTimeout", "fetch", "console", compiled)(
    (name) => { assert.equal(name, "node:crypto"); return { createHash }; }, module, module.exports,
    (callback, ms) => { const id = ++timerId; scheduled.push(ms); timers.set(id, callback); return id; },
    (id) => { cleared.push(id); timers.delete(id); },
    () => { throw new Error("real_network_blocked"); },
    { log: () => { throw new Error("transport_must_not_log"); }, warn: () => { throw new Error("transport_must_not_log"); }, error: () => { throw new Error("transport_must_not_log"); } },
  );
  const api = module.exports;
  return { api, calls, timers, scheduled, cleared,
    send: (env = ENV, payload = PAYLOAD) => api.sendConsumerMetaWhatsappOtp(env, payload, async (...args) => {
      calls.push(args);
      if (!transport) throw new Error("unexpected_transport_call");
      return transport(...args);
    }),
    expire: () => { for (const callback of [...timers.values()]) callback(); },
  };
}
const receipt = (extra = {}) => ({ messaging_product: "whatsapp", contacts: [{ input: "12025550123", wa_id: "different_normalized_id" }], messages: [{ id: WAMID }], ...extra });
const ok = () => Response.json(receipt());
async function failure(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.message, code);
    for (const value of [ENV.META_CONSUMER_OTP_ACCESS_TOKEN, PAYLOAD.contact, PAYLOAD.code, WAMID, RAW_ERROR]) {
      assert.equal(JSON.stringify(error).includes(value), false, "unsafe outward error");
    }
    return true;
  });
}

test("Meta copy-code authentication request is fixed, single and returns only an accepted hashed receipt", async () => {
  const h = harness(ok);
  assert.deepEqual(await h.send(), { httpStatus: 200, providerStatus: "accepted", receiptHash: createHash("sha256").update(WAMID).digest("hex").slice(0, 16) });
  assert.equal(h.calls.length, 1);
  const [url, init] = h.calls[0];
  assert.equal(url, "https://graph.facebook.com/v25.0/123456789012345/messages");
  assert.equal(init.method, "POST"); assert.equal(init.redirect, "error");
  assert.equal(init.headers.Authorization, `Bearer ${ENV.META_CONSUMER_OTP_ACCESS_TOKEN}`);
  assert.deepEqual(JSON.parse(init.body), { messaging_product: "whatsapp", recipient_type: "individual", to: "12025550123", type: "template", template: {
    name: "fixture_login_code", language: { code: "es_AR" }, components: [
      { type: "body", parameters: [{ type: "text", text: "012345" }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "012345" }] },
    ],
  } });
  assert.deepEqual(h.scheduled, [10_000]); assert.equal(h.timers.size, 0); assert.equal(h.cleared.length, 1);
  // Meta documents that contacts.input and wa_id may differ. Neither is returned.
});

test("each missing Meta configuration value rejects before sending", async () => {
  for (const name of Object.keys(ENV)) for (const absent of [undefined, null, ""]) {
    const h = harness(); await failure(h.send({ ...ENV, [name]: absent }), "meta_configuration_missing");
    assert.equal(h.calls.length + h.scheduled.length, 0);
  }
});

test("configuration injection, unsupported language and malformed bounded values fail closed", async () => {
  const cases = [
    ["META_CONSUMER_OTP_GRAPH_VERSION", "https://evil.invalid"], ["META_CONSUMER_OTP_GRAPH_VERSION", "v25.0/../me"],
    ["META_CONSUMER_OTP_GRAPH_VERSION", "v0.0"], ["META_CONSUMER_OTP_GRAPH_VERSION", "v1000.0"], ["META_CONSUMER_OTP_GRAPH_VERSION", " v25.0"],
    ["META_CONSUMER_OTP_PHONE_NUMBER_ID", "123/../me"], ["META_CONSUMER_OTP_PHONE_NUMBER_ID", "123?token=x"],
    ["META_CONSUMER_OTP_PHONE_NUMBER_ID", "0"], ["META_CONSUMER_OTP_PHONE_NUMBER_ID", "9".repeat(33)],
    ["META_CONSUMER_OTP_ACCESS_TOKEN", "short"], ["META_CONSUMER_OTP_ACCESS_TOKEN", "t".repeat(4097)],
    ["META_CONSUMER_OTP_ACCESS_TOKEN", `${ENV.META_CONSUMER_OTP_ACCESS_TOKEN}\r\nX-Injected: value`], ["META_CONSUMER_OTP_ACCESS_TOKEN", ` ${ENV.META_CONSUMER_OTP_ACCESS_TOKEN}`],
    ["META_CONSUMER_OTP_TEMPLATE_NAME", "UpperCase"], ["META_CONSUMER_OTP_TEMPLATE_NAME", "bad template"], ["META_CONSUMER_OTP_TEMPLATE_NAME", "a".repeat(513)],
    ["META_CONSUMER_OTP_TEMPLATE_LANGUAGE", "es-AR"], ["META_CONSUMER_OTP_TEMPLATE_LANGUAGE", "xx_YY"], ["META_CONSUMER_OTP_TEMPLATE_LANGUAGE", "es_AR\n"],
    ["META_CONSUMER_OTP_GRAPH_VERSION", 25], ["META_CONSUMER_OTP_ACCESS_TOKEN", {}],
  ];
  for (const [name, value] of cases) {
    const h = harness(); await failure(h.send({ ...ENV, [name]: value }), "meta_configuration_invalid");
    assert.equal(h.calls.length + h.scheduled.length, 0, name);
  }
});

test("only already normalized international contact and six ASCII OTP digits enter a request", async () => {
  for (const contact of ["12025550123", "+02025550123", "+1202abc5550123", "+1202 5550123", " +12025550123", "+1234567", "+1234567890123456", null, {}]) {
    const h = harness(); await failure(h.send(ENV, { ...PAYLOAD, contact }), "meta_payload_invalid"); assert.equal(h.calls.length, 0);
  }
  for (const code of ["12345", "1234567", "１２３４５６", "12345 ", " 123456", 123456, null, {}]) {
    const h = harness(); await failure(h.send(ENV, { ...PAYLOAD, code }), "meta_payload_invalid"); assert.equal(h.calls.length, 0);
  }
});

test("HTTP failures and provider error bodies never accept or retry, even when a wamid is supplied", async () => {
  for (const status of [301, 400, 401, 403, 429, 500, 503]) {
    const h = harness(() => Response.json({ ...receipt(), error: { code: 132001, message: RAW_ERROR } }, { status }));
    const code = status === 401 || status === 403 ? "meta_authentication_failed" : "meta_delivery_failed";
    await failure(h.send(), code); assert.equal(h.calls.length, 1); assert.equal(h.timers.size, 0);
  }
  const h = harness(() => Response.error()); await failure(h.send(), "meta_delivery_failed"); assert.equal(h.calls.length, 1);
  const oauth = harness(() => Response.json({ error: { code: 190, type: "OAuthException", message: RAW_ERROR } }, { status: 400 }));
  await failure(oauth.send(), "meta_authentication_failed"); assert.equal(oauth.calls.length, 1);
});

test("2xx requires one real bounded wamid and WhatsApp schema, without a Graph error", async () => {
  const invalid = [null, [], {}, receipt({ messaging_product: "other" }), receipt({ messaging_product: undefined }),
    receipt({ error: { message: RAW_ERROR } }), receipt({ error: null }), receipt({ messages: [] }), receipt({ messages: [{ id: WAMID }, { id: WAMID }] }),
    ...["failed", "delivered", "unknown", null, RAW_ERROR].map((message_status) => receipt({ messages: [{ id: WAMID, message_status }] })),
    ...[null, 42, "", "wamid.", "other.id", "wamid.invalid id", "wamid.invalid\n", `wamid.${"a".repeat(2049)}`].map((id) => receipt({ messages: [{ id }] })),
  ];
  for (const body of invalid) {
    const h = harness(() => Response.json(body)); await failure(h.send(), "meta_receipt_invalid"); assert.equal(h.calls.length, 1);
  }
  for (const body of ["not json", "{\"messages\":"]) {
    const h = harness(() => new Response(body)); await failure(h.send(), "meta_receipt_invalid");
  }
  const h = harness(() => new Response(new Uint8Array([255, 254]))); await failure(h.send(), "meta_receipt_invalid");
});

test("JSON limit counts actual streamed bytes and rejects advertised oversize without waiting for cancellation", async () => {
  const h = harness(() => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(JSON.stringify(receipt({ padding: "á".repeat(9000) })))); controller.close(); },
    cancel() { return new Promise(() => {}); },
  }), { headers: { "content-length": "12" } }));
  await failure(h.send(), "meta_receipt_invalid"); assert.equal(h.calls.length, 1);
  for (const contentLength of ["16385", "9999999999999", "not-a-number"]) {
    const h = harness(() => new Response(new ReadableStream({ cancel() { return new Promise(() => {}); } }), { headers: { "content-length": contentLength } }));
    await failure(h.send(), "meta_receipt_invalid"); assert.equal(h.timers.size, 0);
  }
  const base = JSON.stringify(receipt({ padding: "" }));
  const exact = JSON.stringify(receipt({ padding: "x".repeat(16384 - Buffer.byteLength(base)) }));
  assert.equal(Buffer.byteLength(exact), 16384);
  const boundary = harness(() => new Response(exact)); assert.equal((await boundary.send()).providerStatus, "accepted");
  const exceeded = harness(() => new Response(exact.slice(0, -1) + " "+ "}")); await failure(exceeded.send(), "meta_receipt_invalid");
});

test("a fetch that ignores abort still settles at the one fixed deadline", async () => {
  const h = harness(() => new Promise(() => {})); const pending = h.send();
  assert.equal(h.calls.length, 1); h.expire(); await failure(pending, "meta_delivery_timeout");
  assert.equal(h.calls[0][1].signal.aborted, true); assert.equal(h.calls.length, 1); assert.equal(h.timers.size, 0);
});

test("headers followed by a stalled stream are bounded and cancellation is not awaited", async () => {
  let started, cancellationCount = 0;
  const reading = new Promise((resolve) => { started = resolve; });
  const h = harness(() => new Response(new ReadableStream({
    pull() { started(); return new Promise(() => {}); },
    cancel() { cancellationCount += 1; return new Promise(() => {}); },
  }, { highWaterMark: 0 })));
  const pending = h.send(); await reading; h.expire(); await failure(pending, "meta_delivery_timeout");
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0][1].signal.aborted, true); assert.equal(cancellationCount, 1);
});

test("late success after deadline is never read or accepted", async () => {
  let resolveFetch;
  const h = harness(() => new Promise((resolve) => { resolveFetch = resolve; }));
  const pending = h.send(); h.expire(); await failure(pending, "meta_delivery_timeout");
  resolveFetch(ok()); await Promise.resolve(); await Promise.resolve(); assert.equal(h.calls.length, 1);
});

test("network and stream error strings cannot escape through the stable error or diagnostics", async () => {
  for (const transport of [() => { throw new Error(RAW_ERROR); }, () => new Response(new ReadableStream({ start(controller) { controller.error(new Error(RAW_ERROR)); } }))]) {
    const h = harness(transport); await failure(h.send(), "meta_delivery_failed"); assert.equal(h.calls.length, 1);
  }
});

test("even an injected transport's forged typed error is rebuilt from closed safe diagnostics", async () => {
  let h;
  h = harness(() => { throw new h.api.ConsumerMetaOtpError("meta_delivery_failed", { providerStatus: RAW_ERROR, httpStatus: 1234, errorCode: RAW_ERROR }); });
  await assert.rejects(h.send(), (error) => {
    assert.equal(error.message, "meta_delivery_failed"); assert.deepEqual(error.diagnostics, { providerStatus: "request_failed" });
    assert.equal(JSON.stringify(error).includes(RAW_ERROR), false); return true;
  });
});
