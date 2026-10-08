import assert from "node:assert/strict";
import test from "node:test";
import { proxySommelierRequest } from "../src/app/api/_lib/sommelier-proxy.ts";
const request = (headers = {}, body = "{}") => new Request("https://nexid.lat/api/sommelier/chat", { method: "POST", headers: { origin: "https://nexid.lat", "sec-fetch-site": "same-origin", "content-type": "application/json", ...headers }, body });
test("BFF denies foreign/missing origins, hostile fetch sites and non-JSON before contacting API", async () => {
  for (const headers of [{ origin: "https://hostile.nexid.lat" }, { origin: "" }, { "sec-fetch-site": "same-site" }, { "content-type": "text/plain" }]) {
    const result = await proxySommelierRequest(request(headers), "/sommelier/chat", { fetchImpl: () => { throw Error("Must not forward"); } });
    assert.ok([403, 415].includes(result.status));
  }
});
test("BFF preserves caller provenance, keeps NFC capabilities away, and does not echo provider credentials/errors", async () => {
  const calls = [];
  const result = await proxySommelierRequest(request({ cookie: "__Host-nexid_tap_715=private; consumer=session; __Host-nexid_sommelier_demo=grant", "user-agent": "QA mobile", "x-forwarded-for": "192.0.2.1" }, '{"mode":"consumer"}'), "/sommelier/chat", { fetchImpl: async (url, init) => {
    calls.push({ url, ...init });
    return Response.json({ ok: true, answer: "QA" });
  } });
  assert.equal(result.status, 200);
  assert.equal(calls[0].url, "https://api.nexid.lat/sommelier/chat");
  assert.equal(calls[0].headers.origin, "https://nexid.lat");
  assert.equal(calls[0].headers.cookie, "consumer=session; __Host-nexid_sommelier_demo=grant");
  assert.equal(calls[0].headers["x-forwarded-for"], "192.0.2.1");
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.equal(result.headers.get("vary"), "Cookie");
  const failed = await proxySommelierRequest(request(), "/sommelier/chat", { fetchImpl: async () => { throw Error("Sensitive diagnostic"); } });
  assert.doesNotMatch(await failed.text(), /Sensitive/);
});
test("only the dedicated HttpOnly Secure cookie crosses the demo BFF", async () => {
  const upstream = new Response('{"ok":true}', { headers: { "set-cookie": "__Host-nexid_sommelier_demo=grant; Path=/; HttpOnly; SameSite=Lax; Secure; Domain=api.nexid.lat" } });
  const result = await proxySommelierRequest(request(), "/public/sommelier/demo/session", { fetchImpl: async () => upstream });
  assert.match(result.headers.get("set-cookie"), /^__Host-nexid_sommelier_demo=grant/);
  assert.doesNotMatch(result.headers.get("set-cookie"), /Domain=/);
  for (const cookie of ["other=unsafe; Path=/; HttpOnly; Secure", "__Host-nexid_sommelier_demo=grant; Path=/; Secure", "__Host-nexid_sommelier_demo=grant; Path=/; HttpOnly"]) {
    const res = await proxySommelierRequest(request(), "/public/sommelier/demo/session", { fetchImpl: async () => new Response("{}", { headers: { "set-cookie": cookie } }) });
    assert.equal(res.headers.get("set-cookie"), null);
  }
});
test("BFF bounds streaming payloads/responses and cannot hang on a provider body", async () => {
  let calls = 0;
  const tooLarge = await proxySommelierRequest(request({}, "x".repeat(12_289)), "/sommelier/chat", { fetchImpl: async () => { calls++; return Response.json({}); } });
  assert.equal(tooLarge.status, 413);
  assert.equal(calls, 0);
  const responseLarge = await proxySommelierRequest(request(), "/sommelier/chat", { fetchImpl: async () => new Response("x".repeat(24_577)) });
  assert.equal(responseLarge.status, 503);
  const result = await proxySommelierRequest(request(), "/sommelier/chat", { timeoutMs: 20, fetchImpl: async () => new Response(new ReadableStream({ start() {} })) });
  assert.equal(result.status, 503);
});
test("an unfinished browser upload is stopped before an upstream API call", async () => {
  let calls = 0;
  const slow = new Request("https://nexid.lat/api/sommelier/chat", { method: "POST", headers: { origin: "https://nexid.lat", "content-type": "application/json" }, body: new ReadableStream({ start() {} }), duplex: "half" });
  const result = await proxySommelierRequest(slow, "/sommelier/chat", { timeoutMs: 20, fetchImpl: async () => { calls++; return Response.json({}); } });
  assert.equal(result.status, 408);
  assert.equal(calls, 0);
});
