import test from "node:test";
import assert from "node:assert/strict";

const { allowRealtimeEventForScope } = await import("../src/lib/realtime-stream-filter.ts");
const { normalizeTenantTapRealtimeEvent } = await import("../../../packages/core/src/event-contract.ts");

test("tenant A no recibe evento de tenant B", () => {
  const allowed = allowRealtimeEventForScope({
    scope: "tenant_admin",
    forcedTenantSlug: "tenant-a",
    requestedTenant: "",
    eventTenantSlug: "tenant-b",
  });
  assert.equal(allowed, false);
});

test("snapshot/event normalized payload no expone uid crudo", () => {
  const normalized = normalizeTenantTapRealtimeEvent({
    id: 9,
    tenant_id: "t1",
    tenant_slug: "tenant-a",
    uid_hex: "04A1B2C3D4",
    result: "VALID",
    created_at: "2026-04-28T00:00:00.000Z",
    source: "real",
  });
  assert.equal(typeof normalized.eventId, "string");
  assert.equal(normalized.uidMasked.includes("****"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "uidHex"), false);
});
