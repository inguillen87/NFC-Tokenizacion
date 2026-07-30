import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  NEXID_EPCIS_CONTEXT,
  NEXID_EPCIS_MEDIA_TYPE,
  NEXID_SDK_VERSION,
  NEXID_WEBHOOK_EVENT_SCHEMA_VERSION,
  NEXID_WEBHOOK_SIGNATURE_VERSION_V2,
  NexIdApiError,
  NexIdClient,
  verifyAndParseNexIdWebhook,
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

test("the packed ESM export verifies and parses the signed webhook envelope", () => {
  const secret = "consumer-smoke-webhook-secret-value-123456789";
  const timestamp = 1_730_000_000;
  const keyId = "endpoint_consumer";
  const deliveryId = "delivery_consumer";
  const eventId = "evt_consumer_smoke";
  const rawBody = JSON.stringify({
    schemaVersion: NEXID_WEBHOOK_EVENT_SCHEMA_VERSION,
    id: eventId,
    type: "sdk.verify",
    createdAt: "2024-10-27T03:33:20.000Z",
    data: { verdict: "VALID" },
  });
  const prefix = [
    "v2",
    timestamp,
    Buffer.byteLength(keyId, "utf8"),
    keyId,
    Buffer.byteLength(deliveryId, "utf8"),
    deliveryId,
    Buffer.byteLength(eventId, "utf8"),
    eventId,
    Buffer.byteLength(rawBody, "utf8"),
    "",
  ].join(".");
  const signature = createHmac("sha256", secret)
    .update(prefix, "utf8")
    .update(rawBody, "utf8")
    .digest("hex");

  const result = verifyAndParseNexIdWebhook({
    secret,
    rawBody,
    now: timestamp,
    headers: {
      "x-nexid-signature-version": "v2",
      "x-nexid-timestamp": String(timestamp),
      "x-nexid-key-id": keyId,
      "x-nexid-delivery-id": deliveryId,
      "x-nexid-event-id": eventId,
      "x-nexid-signature": `v2=${signature}`,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.contractVersion, "1.0");
  assert.equal(result.ok && result.event.type, "sdk.verify");
});

test("the built package exposes the bounded EPCIS client and cursor metadata", async () => {
  let accept = "";
  const client = new NexIdClient({
    apiKey: "nxid_consumer_epcis",
    tenantSlug: "consumer-smoke",
    retry: false,
    fetchImpl: async (_url, init) => {
      accept = init.headers.accept;
      return Response.json({
        "@context": NEXID_EPCIS_CONTEXT,
        type: "EPCISQueryDocument",
        schemaVersion: "2.0",
        epcisBody: {
          queryResults: {
            queryName: "SimpleEventQuery",
            resultsBody: { eventList: [] },
          },
        },
      }, { headers: { "x-nexid-page-size": "0" } });
    },
  });

  const page = await client.queryEpcisEvents({ limit: 1 });
  assert.equal(accept, NEXID_EPCIS_MEDIA_TYPE);
  assert.equal(page.document.type, "EPCISQueryDocument");
  assert.equal(page.pageSize, 0);
  assert.equal(page.nextCursor, null);
});
