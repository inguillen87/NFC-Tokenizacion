import test from "node:test";
import assert from "node:assert/strict";
import { runRecovery } from "../src/index.js";

test("recovery is fail-closed without HTTPS origin or secret", async () => {
  let called = false;
  await runRecovery({ NEXID_API_ORIGIN: "http://api.nexid.lat", INTERNAL_WEBHOOK_WORKER_KEY: "secret" }, async () => { called = true; });
  assert.equal(called, false);
});

test("recovery sends bounded batch with private header", async () => {
  let request;
  await runRecovery({ NEXID_API_ORIGIN: "https://api.nexid.lat/", INTERNAL_WEBHOOK_WORKER_KEY: "secret" }, async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ claimed: 3, dead_letter: 0 }), { status: 200 });
  });
  assert.equal(request.url, "https://api.nexid.lat/internal/webhooks/worker");
  assert.equal(request.init.headers["x-internal-webhook-key"], "secret");
  assert.deepEqual(JSON.parse(request.init.body), { limit: 50 });
});

test("recovery does not throw on origin failure", async () => {
  await runRecovery({ NEXID_API_ORIGIN: "https://api.nexid.lat", INTERNAL_WEBHOOK_WORKER_KEY: "secret" }, async () => new Response("", { status: 503 }));
});
