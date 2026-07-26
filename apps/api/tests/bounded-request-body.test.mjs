import assert from "node:assert/strict";
import test from "node:test";

import {
  RequestBodyTooLargeError,
  readBoundedJsonBody,
  readRequestTextBounded,
} from "../src/lib/bounded-request-body.ts";

test("bounded request reader rejects an oversized declared Content-Length before reading", async () => {
  const req = new Request("https://api.nexid.lat/test", {
    method: "POST",
    headers: { "content-length": "11" },
    body: "small",
  });
  await assert.rejects(() => readRequestTextBounded(req, 10), RequestBodyTooLargeError);
  assert.equal(req.bodyUsed, false);
});

test("bounded request reader rejects actual streamed bytes even without Content-Length", async () => {
  const req = new Request("https://api.nexid.lat/test", {
    method: "POST",
    body: "123456",
  });
  await assert.rejects(() => readRequestTextBounded(req, 5), RequestBodyTooLargeError);
});

test("bounded request reader returns valid UTF-8 at or below the byte limit", async () => {
  const payload = "nexID-ñ";
  const size = new TextEncoder().encode(payload).byteLength;
  const req = new Request("https://api.nexid.lat/test", { method: "POST", body: payload });
  assert.equal(await readRequestTextBounded(req, size), payload);
});

test("bounded request reader rejects malformed Content-Length", async () => {
  const req = new Request("https://api.nexid.lat/test", {
    method: "POST",
    headers: { "content-length": "not-a-number" },
    body: "{}",
  });
  await assert.rejects(() => readRequestTextBounded(req, 100), /invalid_content_length/);
});

test("bounded JSON reader parses an object only after enforcing the byte limit", async () => {
  const payload = JSON.stringify({ ok: true, value: "nexID" });
  const req = new Request("https://api.nexid.lat/test", { method: "POST", body: payload });
  assert.deepEqual(await readBoundedJsonBody(req, new TextEncoder().encode(payload).byteLength), { ok: true, value: "nexID" });
});

test("bounded JSON reader rejects malformed JSON", async () => {
  const req = new Request("https://api.nexid.lat/test", { method: "POST", body: "{" });
  await assert.rejects(() => readBoundedJsonBody(req, 10), SyntaxError);
});
