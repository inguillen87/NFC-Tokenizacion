import test from "node:test";
import assert from "node:assert/strict";

const { normalizeTypeFromResult, toRealtimeAlertEvent } = await import("../src/lib/alert-events.ts");

test("normalizeTypeFromResult clasifica replay/tamper/invalid", () => {
  assert.equal(normalizeTypeFromResult("REPLAY_SUSPECT"), "replay_spike");
  assert.equal(normalizeTypeFromResult("TAMPERED"), "tamper_rate");
  assert.equal(normalizeTypeFromResult("INVALID"), "invalid_rate");
  assert.equal(normalizeTypeFromResult("VALID"), null);
});

test("toRealtimeAlertEvent emite payload compacto security_alert.created", () => {
  const payload = toRealtimeAlertEvent({
    alertId: "alert-123",
    tenantId: "tenant-1",
    tenantSlug: "demobodega",
    severity: "high",
    type: "replay_spike",
    createdAt: "2026-04-27T00:00:00.000Z",
  });

  assert.equal(payload.event_type, "security_alert.created");
  assert.equal(payload.alert_id, "alert-123");
  assert.equal(payload.tenant_id, "tenant-1");
  assert.equal(payload.tenant_slug, "demobodega");
  assert.equal(payload.severity, "high");
  assert.equal(payload.type, "replay_spike");
  assert.equal(payload.created_at, "2026-04-27T00:00:00.000Z");
  assert.equal(payload.result, "SECURITY_ALERT");
  assert.equal(payload.source, "alerts");
  assert.equal("uid_hex" in payload, false);
  assert.equal("raw_query" in payload, false);
});
