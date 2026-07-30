import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NEXID_EPCIS_CONTEXT,
  NEXID_EPCIS_MEDIA_TYPE,
  NEXID_EPCIS_VERSION,
  NexIdApiError,
  NexIdClient,
} from "../src/index.ts";

const baseConfig = {
  apiKey: "nxid_epcis_secret",
  tenantSlug: "tenant-a",
  retry: false,
};

const event = {
  type: "ObjectEvent",
  eventTime: "2026-07-29T12:00:00.000Z",
  eventTimeZoneOffset: "-03:00",
  action: "OBSERVE",
  epcList: ["https://id.nexid.lat/01/09506000134352/10/LOTE-1"],
};

const captureDocument = {
  "@context": NEXID_EPCIS_CONTEXT,
  type: "EPCISDocument",
  schemaVersion: NEXID_EPCIS_VERSION,
  epcisBody: { eventList: [event] },
};

test("captures EPCIS with mandatory durable idempotency, media types and safe retry", async () => {
  const calls = [];
  const responses = [
    Response.json({ ok: false, reason: "epcis_capture_unavailable" }, { status: 503 }),
    Response.json({
      ok: true,
      captureID: "10000000-0000-4000-8000-000000000001",
      documentRecordID: "20000000-0000-4000-8000-000000000002",
      eventCount: 1,
      canonicalProjectionCount: 1,
      capturedAt: "2026-07-29T12:00:01.000Z",
      replayed: false,
      evidence: { level: "declared_business_event", cryptographicNfcAuthentication: false },
    }, { headers: { "x-nexid-trace-id": "srv_epcis_42" } }),
  ];
  const client = new NexIdClient({
    ...baseConfig,
    retry: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return responses.shift();
    },
  });

  const receipt = await client.captureEpcisDocument(captureDocument, {
    idempotencyKey: "erp:epcis:42",
    requestId: "erp_epcis_42",
    maxRetries: 1,
  });

  assert.equal(receipt.traceId, "srv_epcis_42");
  assert.equal(receipt.evidence.cryptographicNfcAuthentication, false);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url, "https://api.nexid.lat/api/v1/sdk/epcis/capture");
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.headers.accept, NEXID_EPCIS_MEDIA_TYPE);
    assert.equal(call.init.headers["content-type"], NEXID_EPCIS_MEDIA_TYPE);
    assert.equal(call.init.headers["idempotency-key"], "erp:epcis:42");
    assert.equal(call.init.headers["x-nexid-trace-id"], "erp_epcis_42");
    assert.deepEqual(JSON.parse(call.init.body), captureDocument);
  }
});

test("rejects missing idempotency and documents outside the bounded profile before network I/O", async () => {
  let calls = 0;
  const client = new NexIdClient({ ...baseConfig, fetchImpl: async () => { calls += 1; return Response.json({}); } });

  assert.throws(() => client.captureEpcisDocument(captureDocument), /requires options with idempotencyKey/);
  assert.throws(
    () => client.captureEpcisDocument(captureDocument, { idempotencyKey: "contains spaces" }),
    /unsupported characters/,
  );
  assert.throws(
    () => client.captureEpcisDocument({ ...captureDocument, schemaVersion: "1.2" }, { idempotencyKey: "epcis-1" }),
    /bounded EPCIS 2.0 profile/,
  );
  assert.equal(calls, 0);
});

test("queries EPCIS with encoded filters and exposes keyset pagination metadata", async () => {
  let captured;
  const cursor = "eyJldmVudFRpbWUiOiIyMDI2LTA3LTI5VDEyOjAwOjAwLjAwMFoifQ";
  const client = new NexIdClient({
    ...baseConfig,
    fetchImpl: async (url, init) => {
      captured = { url: new URL(String(url)), init };
      return Response.json({
        "@context": NEXID_EPCIS_CONTEXT,
        type: "EPCISQueryDocument",
        schemaVersion: NEXID_EPCIS_VERSION,
        epcisBody: {
          queryResults: {
            queryName: "SimpleEventQuery",
            resultsBody: { eventList: [event] },
          },
        },
      }, { headers: { "x-nexid-page-size": "1", "x-nexid-next-cursor": cursor } });
    },
  });

  const page = await client.queryEpcisEvents({
    limit: 1,
    eventType: "ObjectEvent",
    gtin: "09506000134352",
    lot: "LOTE-1",
    eventTimeFrom: new Date("2026-07-01T00:00:00.000Z"),
  }, { requestId: "query_epcis_42" });

  assert.equal(captured.url.pathname, "/api/v1/sdk/epcis/events");
  assert.equal(captured.url.searchParams.get("limit"), "1");
  assert.equal(captured.url.searchParams.get("eventType"), "ObjectEvent");
  assert.equal(captured.url.searchParams.get("gtin"), "09506000134352");
  assert.equal(captured.url.searchParams.get("lot"), "LOTE-1");
  assert.equal(captured.url.searchParams.get("eventTimeFrom"), "2026-07-01T00:00:00.000Z");
  assert.equal(captured.init.headers.accept, NEXID_EPCIS_MEDIA_TYPE);
  assert.equal(captured.init.headers["content-type"], undefined);
  assert.equal(page.document.type, "EPCISQueryDocument");
  assert.equal(page.pageSize, 1);
  assert.equal(page.nextCursor, cursor);
  assert.equal(page.traceId, "query_epcis_42");
});

test("exports one portable EPCIS document page", async () => {
  let requestedUrl = "";
  const client = new NexIdClient({
    ...baseConfig,
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return Response.json({
        "@context": NEXID_EPCIS_CONTEXT,
        type: "EPCISDocument",
        schemaVersion: NEXID_EPCIS_VERSION,
        epcisBody: { eventList: [] },
      }, { headers: { "x-nexid-page-size": "0" } });
    },
  });

  const page = await client.exportEpcisEvents({ limit: 25, disposition: "in_transit" });
  assert.match(requestedUrl, /\/api\/v1\/sdk\/epcis\/export\?/);
  assert.equal(page.document.type, "EPCISDocument");
  assert.equal(page.pageSize, 0);
  assert.equal(page.nextCursor, null);
});

test("rejects unsafe EPCIS filters and malformed success responses", async () => {
  let calls = 0;
  const client = new NexIdClient({
    ...baseConfig,
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ type: "EPCISQueryDocument", schemaVersion: "1.2" }, { headers: { "x-nexid-page-size": "0" } });
    },
  });

  assert.throws(() => client.queryEpcisEvents({ limit: 201 }), /EPCIS limit/);
  assert.throws(() => client.queryEpcisEvents({ lot: "L1" }), /require gtin/);
  assert.throws(() => client.queryEpcisEvents({ gtin: "09506000134353" }), /valid GTIN-14/);
  assert.throws(() => client.queryEpcisEvents({
    eventTimeFrom: "2026-08-01T00:00:00Z",
    eventTimeTo: "2026-07-01T00:00:00Z",
  }), /must not be after/);
  await assert.rejects(
    client.queryEpcisEvents(),
    (error) => error instanceof NexIdApiError && error.status === 502 && error.reason === "invalid_epcis_response",
  );
  assert.equal(calls, 1);
});
