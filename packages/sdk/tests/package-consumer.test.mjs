import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NEXID_SDK_VERSION,
  NEXID_WEBHOOK_SIGNATURE_VERSION_V2,
  NexIdApiError,
  NexIdClient,
} from "@product/nexid-server-sdk";

test("a Node ESM consumer resolves the package exports from dist", async () => {
  let requestedUrl = "";
  const client = new NexIdClient({
    apiKey: "nxid_consumer_smoke",
    tenantSlug: "consumer-smoke",
    retry: false,
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return Response.json({
        ok: true,
        tenant: { slug: "consumer-smoke" },
        batch: {},
        carrier: {},
        product: {},
        stats: {},
        tags: [],
      });
    },
  });

  const result = await client.getProduct("LOT/ESM");
  assert.equal(result.ok, true);
  assert.equal(requestedUrl, "https://api.nexid.lat/api/v1/sdk/products/LOT%2FESM");
  assert.equal(NEXID_SDK_VERSION, "0.2.0");
  assert.equal(NEXID_WEBHOOK_SIGNATURE_VERSION_V2, "v2");
  assert.equal(typeof NexIdApiError, "function");
});
