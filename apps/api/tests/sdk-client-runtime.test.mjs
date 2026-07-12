import assert from "node:assert/strict";
import test from "node:test";

const { NexIdClient } = await import("../../../packages/sdk/src/index.ts");

test("server SDK defaults to the production API and sends tenant-scoped credentials", async () => {
  let captured = null;
  const client = new NexIdClient({
    apiKey: "nxid_test_secret",
    tenantSlug: "tenant-a",
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ ok: true, eventId: "evt_1", eventType: "qr.scan" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await client.reportEvent({ eventType: "qr.scan", bid: "LOT-1" });

  assert.equal(captured.url, "https://api.nexid.lat/api/v1/sdk/events");
  assert.equal(captured.init.headers["x-nexid-api-key"], "nxid_test_secret");
  assert.equal(captured.init.headers["x-nexid-tenant-slug"], "tenant-a");
});

test("server SDK rejects the retired public sandbox and requires an explicit private base URL", () => {
  assert.throws(
    () => new NexIdClient({ apiKey: "key", tenantSlug: "tenant", environment: "sandbox" }),
    /no public sandbox endpoint/,
  );
  assert.throws(
    () => new NexIdClient({ apiKey: "key", tenantSlug: "tenant", environment: "private" }),
    /private environment requires apiBaseUrl/,
  );
});

test("server SDK fails closed when bundled into a browser runtime", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = {};
  globalThis.document = {};
  try {
    assert.throws(
      () => new NexIdClient({ apiKey: "key", tenantSlug: "tenant" }),
      /cannot run in a browser/,
    );
  } finally {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) Reflect.deleteProperty(globalThis, "document");
    else globalThis.document = previousDocument;
  }
});
