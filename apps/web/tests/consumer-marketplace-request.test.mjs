import test from "node:test";
import assert from "node:assert/strict";
import { MARKETPLACE_REQUEST_TIMEOUT_MS, sendMarketplaceRequest } from "../src/app/me/marketplace/marketplace-request.ts";

const body = { quantity: 1, message: null, ageGateAccepted: false };
const path = "/api/marketplace/products/synthetic/request-to-buy";
async function request(fetcher, timeoutMs = 50) {
  return sendMarketplaceRequest(path, body, { fetcher, timeoutMs });
}

test("marketplace uses one 12-second deadline for headers and JSON without retry", async (t) => {
  assert.equal(MARKETPLACE_REQUEST_TIMEOUT_MS, 12_000);
  for (const phase of ["headers", "body"]) await t.test(phase, async () => {
    let calls = 0, aborted = false;
    const fetcher = async (_path, options) => {
      calls++;
      assert.equal(_path, path);
      assert.equal(options.method, "POST");
      assert.equal(options.credentials, "include");
      assert.deepEqual(JSON.parse(options.body), body);
      options.signal.addEventListener("abort", () => { aborted = true; });
      if (phase === "headers") return new Promise(() => {});
      return { status: 200, ok: true, json: () => new Promise(() => {}) };
    };
    assert.deepEqual(await request(fetcher, 15), { kind: "uncertain" });
    assert.equal(calls, 1);
    assert.equal(aborted, true);
  });
});

test("network failure or invalid JSON after POST is uncertain and never retried", async () => {
  for (const fetcher of [
    async () => { throw Error("synthetic network loss"); },
    async () => new Response("not JSON", { status: 200 }),
    async () => Response.json(null),
    async () => Response.json([]),
    async () => Response.json({ request: "unknown acknowledgement" }),
  ]) {
    let calls = 0;
    const result = await request((...args) => { calls++; return fetcher(...args); });
    assert.deepEqual(result, { kind: "uncertain" });
    assert.equal(calls, 1);
  }
});

test("confirmed statuses retain server error payload for authentication and actionable denial", async () => {
  for (const status of [200, 401, 403, 429, 503]) {
    const payload = { ok: status === 200, error: "synthetic_error", deduplicated: status === 200 };
    const result = await request(async () => Response.json(payload, { status }));
    assert.deepEqual(result, { kind: "response", status, ok: status === 200, payload });
  }
});
