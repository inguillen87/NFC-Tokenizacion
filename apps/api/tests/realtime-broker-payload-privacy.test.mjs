import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  minimizeRealtimePayloadForBroker,
  REALTIME_DELIVERY_ID_PATTERN,
} = await import("../src/lib/realtime-broker-payload.ts");

test("broker projection drops direct contact, arbitrary content, raw UID and metadata", () => {
  const payload = minimizeRealtimePayloadForBroker({
    event_type: "lead.created",
    tenant_id: "78f2baf3-a530-4afe-8d44-0ab7b4b951ad",
    tenant_slug: "Bodega-Balmec",
    lead_id: "lead_123",
    contact: "+54 9 11 5555 1234",
    phone: "+54 9 11 5555 1234",
    email: "persona@example.com",
    company: "Nombre libre del formulario",
    title: "Texto libre",
    incident_title: "Texto sensible",
    uid_hex: "04AABBCCDDEEFF",
    trace_id: "persona@example.com",
    meta: { message: "diagnostico privado", email: "persona@example.com" },
    reason: "texto libre con telefono +54 9 11 5555 1234",
    source: "public_lead",
    status: "new",
    created_at: "2026-09-04T03:00:00.000Z",
  });

  assert.deepEqual(payload, {
    tenant_id: "78f2baf3-a530-4afe-8d44-0ab7b4b951ad",
    lead_id: "lead_123",
    tenant_slug: "bodega-balmec",
    event_type: "lead.created",
    source: "public_lead",
    status: "new",
    created_at: "2026-09-04T03:00:00.000Z",
    realtime_delivery_id: payload.realtime_delivery_id,
  });
  assert.match(payload.realtime_delivery_id, REALTIME_DELIVERY_ID_PATTERN);
  const serialized = JSON.stringify(payload);
  for (const sensitive of [
    "+54 9 11 5555 1234",
    "persona@example.com",
    "Nombre libre del formulario",
    "Texto sensible",
    "04AABBCCDDEEFF",
    "diagnostico privado",
  ]) assert.equal(serialized.includes(sensitive), false);
});

test("tap projection keeps operational fields but removes free text and device fingerprint", () => {
  const input = {
    id: "90210",
    event_type: "TAP_VALID",
    tenant_id: "78f2baf3-a530-4afe-8d44-0ab7b4b951ad",
    tenant_slug: "bodegabalmec",
    batch_id: "f31d5b4f-e57d-4984-9f2b-fdd30c9838ec",
    uid_hex: "04AABBCCDDEEFF",
    reason: "VALID_CMAC",
    created_at: "2026-09-04T03:00:00.000Z",
    tap_projection: {
      eventId: "90210",
      tenantId: "78f2baf3-a530-4afe-8d44-0ab7b4b951ad",
      tenantSlug: "bodegabalmec",
      batchId: "f31d5b4f-e57d-4984-9f2b-fdd30c9838ec",
      bid: "RA-2407",
      tagId: "cfca10ba-47a8-4c02-a102-12a1167f84c1",
      uidMasked: "04AA****FF",
      occurredAt: "2026-09-04T03:00:00.000Z",
      occurredAtUtc: "2026-09-04T03:00:00.000Z",
      occurredAtLocal: "04/09/2026, 00:00:00",
      timezone: "America/Argentina/Buenos_Aires",
      timezoneLabel: "Buenos Aires (GMT-3)",
      timezoneOffset: "GMT-3",
      eventType: "TAP_VALID",
      result: "VALID_CLOSED",
      verdict: "valid",
      interactionClass: "authentication_verified",
      productIdentityRecognized: true,
      authenticationVerified: true,
      knownActorCount: 1,
      knownActor: true,
      commercialConsentGranted: true,
      commercialConsentChannels: ["whatsapp", "email", "email"],
      riskLevel: "none",
      reason: "Cliente escribió su teléfono +54 9 11 5555 1234",
      city: "Buenos Aires",
      country: "ar",
      lat: -34.6037,
      lng: -58.3816,
      locationSource: "browser_rounded",
      locationAccuracyM: 150,
      deviceLabel: "Telefono de Guillermo",
      deviceOs: "Android",
      deviceType: "mobile",
      productName: "Gran Reserva 2022",
      source: "production",
      eventSource: "real",
      userAgent: "secret-agent-value",
      consumerEmail: "persona@example.com",
    },
  };

  const payload = minimizeRealtimePayloadForBroker(input);
  assert.equal(payload.uid_hex, undefined);
  assert.equal(payload.reason, "VALID_CMAC");
  assert.equal(payload.tap_projection.deviceLabel, null);
  assert.equal(payload.tap_projection.reason, null);
  assert.deepEqual(payload.tap_projection.commercialConsentChannels, ["email", "whatsapp"]);
  assert.equal(payload.tap_projection.uidMasked, "04AA****FF");
  assert.equal(payload.tap_projection.bid, "RA-2407");
  assert.equal(payload.tap_projection.lat, -34.6037);
  assert.equal(payload.tap_projection.lng, -58.3816);
  assert.equal(JSON.stringify(payload).includes("secret-agent-value"), false);
  assert.equal(JSON.stringify(payload).includes("persona@example.com"), false);
  assert.equal(JSON.stringify(payload).includes("Telefono de Guillermo"), false);
});

test("a field named uidMasked still requires the canonical masked shape", () => {
  const payload = minimizeRealtimePayloadForBroker({
    event_type: "tap.created",
    tenant_slug: "bodegabalmec",
    tap_projection: {
      eventId: "101",
      tenantId: "tenant-1",
      tenantSlug: "bodegabalmec",
      batchId: "batch-1",
      uidMasked: "persona@example.com",
      occurredAt: "2026-09-04T03:00:00.000Z",
      occurredAtUtc: "2026-09-04T03:00:00.000Z",
      eventType: "TAP_VALID",
      result: "VALID",
      verdict: "valid",
      interactionClass: "product_identity_recognized",
      productIdentityRecognized: true,
      authenticationVerified: false,
      knownActorCount: 0,
      knownActor: false,
      commercialConsentGranted: false,
      commercialConsentChannels: [],
      riskLevel: "none",
      source: "production",
      eventSource: "real",
    },
  });

  assert.equal(payload.tap_projection.uidMasked, undefined);
  assert.equal(JSON.stringify(payload).includes("persona@example.com"), false);
});

test("delivery id is stable for an exact safe projection and changes with its revision", () => {
  const base = {
    id: "99",
    event_type: "TAP_VALID",
    tenant_slug: "bodegabalmec",
    tap_projection: {
      eventId: "99",
      tenantId: "tenant-1",
      tenantSlug: "bodegabalmec",
      batchId: "batch-1",
      occurredAt: "2026-09-04T03:00:00.000Z",
      occurredAtUtc: "2026-09-04T03:00:00.000Z",
      eventType: "TAP_VALID",
      result: "VALID",
      verdict: "valid",
      interactionClass: "product_identity_recognized",
      productIdentityRecognized: true,
      authenticationVerified: false,
      knownActorCount: 0,
      knownActor: false,
      commercialConsentGranted: false,
      commercialConsentChannels: [],
      riskLevel: "none",
      source: "production",
      eventSource: "real",
    },
  };

  const first = minimizeRealtimePayloadForBroker(base);
  const exactReplay = minimizeRealtimePayloadForBroker(structuredClone(base));
  const revised = minimizeRealtimePayloadForBroker({
    ...base,
    tap_projection: { ...base.tap_projection, knownActorCount: 1, knownActor: true },
  });

  assert.equal(first.realtime_delivery_id, exactReplay.realtime_delivery_id);
  assert.notEqual(first.realtime_delivery_id, revised.realtime_delivery_id);
});

test("every transport receives the minimized payload rather than publisher PII", async () => {
  const previousMode = process.env.REALTIME_MODE;
  process.env.REALTIME_MODE = "memory";
  const { onRealtimeEvent, publishRealtimeEvent } = await import("../src/lib/realtime-events.ts");
  const received = [];
  const unsubscribe = onRealtimeEvent((payload) => received.push(payload));

  try {
    const result = await publishRealtimeEvent({
      event_type: "lead.created",
      lead_id: "lead_456",
      tenant_slug: "bodegabalmec",
      contact: "+54 9 11 5555 0000",
      company: "Texto privado",
      incident_title: "Contenido de investigación",
      uid_hex: "04AABBCCDDEEFF",
      trace_id: "persona@example.com",
      meta: { phone: "+54 9 11 5555 0000" },
      source: "public_lead",
      created_at: "2026-09-04T03:00:00.000Z",
    });

    assert.equal(result.distributed, true);
    assert.equal(received.length, 1);
    assert.equal(received[0].lead_id, "lead_456");
    assert.match(received[0].realtime_delivery_id, REALTIME_DELIVERY_ID_PATTERN);
    const serialized = JSON.stringify(received[0]);
    assert.equal(serialized.includes("+54 9 11 5555 0000"), false);
    assert.equal(serialized.includes("Texto privado"), false);
    assert.equal(serialized.includes("Contenido de investigación"), false);
    assert.equal(serialized.includes("04AABBCCDDEEFF"), false);
    assert.equal(serialized.includes("persona@example.com"), false);
  } finally {
    unsubscribe();
    if (previousMode === undefined) delete process.env.REALTIME_MODE;
    else process.env.REALTIME_MODE = previousMode;
  }
});

test("the broker boundary and SSE route enforce safe projection and delivery dedupe", async () => {
  const events = await readFile(new URL("../src/lib/realtime-events.ts", import.meta.url), "utf8");
  const stream = await readFile(new URL("../src/app/admin/events/stream/route.ts", import.meta.url), "utf8");

  assert.match(events, /const safePayload = brokerSafePayload\(brokerInput\)/);
  assert.match(events, /store\.emitter\.emit\("event", safePayload\)/);
  assert.match(events, /publishDistributed\(safePayload\)/);
  assert.match(events, /payload: safePayload as Record<string, unknown>/);
  assert.match(events, /const safePayload = brokerSafePayload\(envelope\.payload\)/);
  assert.match(stream, /REALTIME_DELIVERY_ID_PATTERN\.test\(deliveryId\)/);
  assert.match(stream, /if \(!rememberDelivery\(rawPayload\)\) return/);
  assert.doesNotMatch(stream, /incident_title: String\(rawPayload\.incident_title/);
  assert.doesNotMatch(stream, /origin_trace_id: typeof rawPayload\.trace_id/);
});
