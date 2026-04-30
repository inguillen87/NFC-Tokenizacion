import test from "node:test";
import assert from "node:assert/strict";

const {
  isSecurityAlertCreatedEvent,
  toAlertCenterItem,
  mergeAlertCenterItems,
} = await import("../src/lib/realtime-alerts.ts");

test("detecta evento compacto security_alert.created", () => {
  assert.equal(isSecurityAlertCreatedEvent({ event_type: "security_alert.created", alert_id: "a1" }), true);
  assert.equal(isSecurityAlertCreatedEvent({ event_type: "tap.created", alert_id: "a1" }), false);
});

test("normaliza payload realtime de alerta a item de alert center", () => {
  const item = toAlertCenterItem({
    event_type: "security_alert.created",
    alert_id: "a-123",
    tenant_slug: "tenant-a",
    type: "tamper_rate",
    severity: "high",
    created_at: "2026-04-28T10:20:00.000Z",
  });
  assert.equal(item.id, "a-123");
  assert.equal(item.status, "open");
  assert.equal(item.tenant_slug, "tenant-a");
});

test("merge mantiene dedupe por id y ordena por created_at descendente", () => {
  const base = [
    { id: "a-1", type: "invalid_rate", severity: "medium", status: "open", created_at: "2026-04-28T10:00:00.000Z" },
  ];
  const merged = mergeAlertCenterItems(base, {
    id: "a-2",
    type: "replay_spike",
    severity: "high",
    status: "open",
    created_at: "2026-04-28T11:00:00.000Z",
  }, 12);
  assert.equal(merged[0]?.id, "a-2");
  const deduped = mergeAlertCenterItems(merged, { ...merged[0], severity: "critical" }, 12);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0]?.severity, "critical");
});
