import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createRealtimeTapArrivalGate,
  realtimeTapArrivalIsVisible,
  startFiniteTapArrivalAnimation,
} from "../src/lib/realtime-tap-arrival.ts";

const base = Date.parse("2026-09-05T23:00:00.000Z");
const at = (offset) => new Date(base + offset).toISOString();
const expected = { tenant: "fixture-tenant", window: "all", source: "production" };
const connected = (id = "connection-1", offset = 0) => ({ availability: "ready", stream_request_id: id, ts: at(offset) });
const snapshot = (id = "connection-1", rows = []) => ({ availability: "ready", stream_request_id: id, source: "production", scope: { tenant: expected.tenant, window: "all" }, rows });
const event = (id = "event-1", offset = 1_000, connection = "connection-1") => ({
  eventId: id,
  stream_request_id: connection,
  occurredAt: at(offset),
  stream_sent_at: at(offset + 100),
  tenantSlug: expected.tenant,
  eventType: "TAP_VALID",
  source: "production",
  eventSource: "real",
  // Coordinates are local unit-test fixtures, never physical or production data.
  lat: -30,
  lng: -60,
});

const withoutPoint = (payload = event()) => ({ ...payload, lat: null, lng: null });

function composedArrivalFixture(rows = []) {
  let clock = base + 1_100;
  let sequence = 2;
  const gate = createRealtimeTapArrivalGate(expected, () => clock);
  gate.connect(connected());
  gate.snapshot(snapshot("connection-1", rows));
  return {
    gate,
    deliver(payload, receivedOffset = 1_100, viewChanges = {}) {
      clock = base + receivedOffset;
      const frame = {
        newPhysicalTapArrival: gate.accept(payload),
        sequence: ++sequence,
        receivedAt: at(receivedOffset),
      };
      return {
        accepted: frame.newPhysicalTapArrival,
        visible: realtimeTapArrivalIsVisible(frame, payload, {
          connected: true, active: true, snapshotSequence: 2,
          tenant: expected.tenant, windowStart: base, now: clock,
          ...viewChanges,
        }),
      };
    },
  };
}

test("gate and visibility wait for the first point of a fresh read, then consume one cue", () => {
  const fixture = composedArrivalFixture();
  assert.deepEqual(fixture.deliver(withoutPoint()), { accepted: false, visible: false });
  assert.deepEqual(fixture.deliver({ ...event(), lng: null, stream_sent_at: at(2_000) }, 2_000), { accepted: false, visible: false });
  const firstPoint = { ...event(), stream_sent_at: at(3_000) };
  assert.deepEqual(fixture.deliver(firstPoint, 3_000), { accepted: true, visible: true }, "a point can arrive after the original frame's 1.5-second visibility window");
  assert.deepEqual(fixture.deliver(firstPoint, 3_001), { accepted: false, visible: false });
  assert.deepEqual(fixture.deliver({ ...event(), locationSource: "edge_ip_approx", stream_sent_at: at(3_100) }, 3_100), { accepted: false, visible: false });
  assert.deepEqual(fixture.deliver(withoutPoint(), 3_200), { accepted: false, visible: false });
});

test("first point still obeys active view, receipt freshness and snapshot visibility", () => {
  for (const viewChanges of [{ active: false }, { connected: false }, { snapshotSequence: 10 }, { now: base + 5_000 }]) {
    const fixture = composedArrivalFixture();
    fixture.deliver(withoutPoint());
    assert.deepEqual(fixture.deliver({ ...event(), stream_sent_at: at(2_000) }, 2_000, viewChanges), { accepted: true, visible: false });
    assert.equal(fixture.deliver(event(), 2_001).accepted, false, "returning to the view cannot replay a consumed cue");
  }
});

test("pending expires at five seconds locally and cannot be renewed by coordinate-less revisions", () => {
  for (const age of [4_999, 5_000, 5_001]) {
    const fixture = composedArrivalFixture();
    fixture.deliver(withoutPoint());
    fixture.deliver({ ...withoutPoint(), stream_sent_at: at(2_000) }, 3_000);
    fixture.deliver({ ...event(), lat: 91, stream_sent_at: at(3_000) }, 5_000);
    assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(4_000) }, 1_100 + age).visible, age < 5_000);
    assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(4_001) }, 1_101 + age).visible, false);
  }
});

test("pending also rejects a late server revision despite immediate local delivery", () => {
  const fixture = composedArrivalFixture();
  fixture.deliver(withoutPoint());
  assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(6_100) }, 1_200).visible, false);
  assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(6_101) }, 1_201).visible, false);
});

test("pending retains the original thirty-second event freshness limit", () => {
  for (const age of [30_000, 30_001]) {
    const fixture = composedArrivalFixture();
    fixture.deliver({ ...withoutPoint(), stream_sent_at: at(30_000) }, 30_000);
    assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(1_000 + age) }, 1_000 + age).visible, age === 30_000);
  }
});

test("coordinate-less revisions cannot authorize a subsequently regressing server timestamp", () => {
  const fixture = composedArrivalFixture();
  fixture.deliver(withoutPoint());
  fixture.deliver({ ...withoutPoint(), stream_sent_at: at(3_000) }, 3_000);
  assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(2_000) }, 3_100).visible, false);
  assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(3_200) }, 3_200).visible, false);
});

test("newer arrivals supersede a pending point without moving the timestamp guard backwards", () => {
  const fixture = composedArrivalFixture();
  fixture.deliver(withoutPoint());
  assert.equal(fixture.deliver(event("newer", 2_000), 2_100).visible, true);
  assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(2_200) }, 2_200).visible, false);
  assert.equal(fixture.deliver(event("out-of-order", 1_500), 2_300).visible, false);
  assert.equal(fixture.deliver(event("next", 3_000), 3_100).visible, true);
});

test("a newer eligible read without coordinates also replaces the pending opportunity", () => {
  const fixture = composedArrivalFixture();
  fixture.deliver(withoutPoint());
  assert.equal(fixture.deliver(withoutPoint(event("newer", 2_000)), 2_100).visible, false);
  assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(2_200) }, 2_200).visible, false);
  assert.equal(fixture.deliver({ ...event("newer", 2_000), stream_sent_at: at(2_300) }, 2_300).visible, true);
});

test("bounded ID retention cannot revive an evicted pending point", () => {
  const fixture = composedArrivalFixture();
  fixture.deliver(withoutPoint());
  for (let index = 0; index < 256; index += 1) {
    assert.equal(fixture.deliver({ ...event(`non-physical-${index}`, 1_500), eventType: "CONTENT_VIEW" }, 1_600).visible, false);
  }
  assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(2_000) }, 2_000).visible, false);
});

test("snapshots and pause/reconnect discard pending first points permanently", () => {
  for (const reset of [
    (gate) => gate.snapshot(snapshot("connection-1", [event()])),
    (gate) => gate.snapshot(snapshot()),
    (gate) => { gate.pause(); gate.snapshot(snapshot()); },
    (gate) => { gate.connect(connected("connection-2", 2_000)); gate.snapshot(snapshot("connection-2")); },
    (gate) => { gate.snapshot({ ...snapshot(), availability: "fallback" }); gate.snapshot(snapshot()); },
  ]) {
    const fixture = composedArrivalFixture();
    fixture.deliver(withoutPoint());
    reset(fixture.gate);
    assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(2_100) }, 2_100).visible, false);
    assert.equal(fixture.deliver({ ...event("event-1", 1_000, "connection-2"), stream_sent_at: at(2_200) }, 2_200).visible, false);
  }
});

test("snapshot IDs and reads at or before connection never become pending", () => {
  for (const payload of [event("snapshot-id"), event("old", -1), event("at-connect", 0)]) {
    const fixture = composedArrivalFixture([event("snapshot-id")]);
    assert.equal(fixture.deliver(withoutPoint(payload)).visible, false);
    assert.equal(fixture.deliver({ ...payload, stream_sent_at: at(2_000) }, 2_000).visible, false);
    assert.equal(fixture.deliver({ ...payload, occurredAt: at(3_000), stream_sent_at: at(3_100) }, 3_100).visible, false);
  }
});

test("a pending revision cannot change its original date, physical type or valid server clock", () => {
  for (const change of [
    { occurredAt: at(500) }, { occurredAt: at(1_500) }, { occurredAt: "invalid" },
    { eventType: "CONTENT_VIEW" }, { eventType: "TAP_INVALID" },
    { stream_sent_at: "invalid" }, { stream_sent_at: at(1_099) },
  ]) {
    const fixture = composedArrivalFixture();
    fixture.deliver(withoutPoint());
    assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(2_000), ...change }, 2_000).visible, false);
    assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(2_100) }, 2_100).visible, false);
  }
});

test("pending eligibility never bypasses connection, tenant and production source checks", () => {
  for (const change of [
    { tenantSlug: "other" }, { stream_request_id: "other" },
    { source: "demo" }, { eventSource: "demo" }, { eventSource: "imported" },
  ]) {
    const fixture = composedArrivalFixture();
    fixture.deliver(withoutPoint());
    assert.equal(fixture.deliver({ ...event(), stream_sent_at: at(2_000), ...change }, 2_000).visible, false);
  }
});

test("a backwards local clock cannot keep a pending point eligible", () => {
  const fixture = composedArrivalFixture();
  fixture.deliver(withoutPoint());
  assert.equal(fixture.deliver(event(), 1_099).visible, false);
  assert.equal(fixture.deliver(event(), 1_200).visible, false);
});

test("startup frames and snapshots never animate; one fresh single SSE event does", () => {
  const gate = createRealtimeTapArrivalGate(expected);
  assert.equal(gate.accept(event()), false);
  gate.connect(connected());
  assert.equal(gate.accept(event()), false, "connection control alone is not a confirmed snapshot");
  gate.snapshot(snapshot("connection-1", [event("history", -1_000)]));
  assert.equal(gate.accept(event("history", -1_000)), false);
  assert.equal(gate.accept(event()), true);
  assert.equal(gate.accept(event()), false, "the same live delivery cannot repeat its cue");
});

test("reconnect pauses arrivals and recovered old reads cannot masquerade as new", () => {
  const gate = createRealtimeTapArrivalGate(expected);
  gate.connect(connected());
  gate.snapshot(snapshot());
  assert.equal(gate.accept(event()), true);
  gate.pause();
  assert.equal(gate.accept(event("during-disconnect", 2_000)), false);
  gate.connect(connected("connection-2", 4_000));
  assert.equal(gate.accept(event("before-snapshot", 5_000, "connection-2")), false);
  gate.snapshot(snapshot("connection-2"));
  assert.equal(gate.accept(event("old-unseen", 3_000, "connection-2")), false);
  assert.equal(gate.accept(event("event-1", 1_000, "connection-2")), false);
  assert.equal(gate.accept(event("wrong-connection", 5_000)), false);
  assert.equal(gate.accept(event("fresh-after-reconnect", 5_000, "connection-2")), true);
});

test("location enrichment, non-physical activity and delayed reads do not animate", () => {
  const gate = createRealtimeTapArrivalGate(expected);
  gate.connect(connected());
  gate.snapshot(snapshot());
  assert.equal(gate.accept(event()), true);
  assert.equal(gate.accept({ ...event(), locationSource: "edge_ip_approx", stream_sent_at: at(3_000) }), false);
  assert.equal(gate.accept({ ...event("post-tap", 4_000), eventType: "CONTENT_VIEW" }), false);
  assert.equal(gate.accept({ ...event("late", 5_000), stream_sent_at: at(50_000) }), false);
  assert.equal(gate.accept({ ...event("bad-clock", 6_000), stream_sent_at: at(4_000) }), false);
});

test("wrong tenant, source, connection or snapshot contract cannot authorize a cue", () => {
  for (const invalidSnapshot of [
    { ...snapshot(), stream_request_id: "wrong" },
    { ...snapshot(), availability: "fallback" },
    { ...snapshot(), source: "demo" },
    { ...snapshot(), scope: { tenant: "other", window: "all" } },
  ]) {
    const gate = createRealtimeTapArrivalGate(expected);
    gate.connect(connected());
    gate.snapshot(invalidSnapshot);
    assert.equal(gate.accept(event()), false);
  }
  const gate = createRealtimeTapArrivalGate(expected);
  gate.connect(connected());
  gate.snapshot(snapshot());
  assert.equal(gate.accept({ ...event(), tenantSlug: "other" }), false);
  assert.equal(gate.accept({ ...event(), source: "demo", eventSource: "demo" }), false);
  assert.equal(gate.accept({ ...event(), eventSource: "imported" }), false);
  assert.equal(gate.accept({ ...event(), occurredAt: "invalid" }), false);
});

test("bounded retention never reanimates an evicted or out-of-order event", () => {
  const gate = createRealtimeTapArrivalGate(expected);
  gate.connect(connected());
  gate.snapshot(snapshot());
  for (let index = 1; index <= 300; index += 1) assert.equal(gate.accept(event(`burst-${index}`, index)), true);
  assert.equal(gate.accept(event("burst-1", 1)), false);
  assert.equal(gate.accept(event("out-of-order", 299)), false);
  assert.equal(gate.accept(event("equal-time", 300)), false);
});

test("view, tenant, window, latest snapshot and receipt freshness independently restrict animation", () => {
  const frame = { newPhysicalTapArrival: true, sequence: 5, receivedAt: at(1_100) };
  const payload = { ...event(), lat: -30, lng: -60 };
  const view = { connected: true, active: true, snapshotSequence: 2, tenant: expected.tenant, windowStart: base, now: base + 1_200 };
  assert.equal(realtimeTapArrivalIsVisible(frame, payload, view), true);
  for (const change of [
    { connected: false }, { active: false }, { snapshotSequence: 6 },
    { tenant: "other" }, { windowStart: base + 2_000 }, { now: base + 3_000 },
  ]) assert.equal(realtimeTapArrivalIsVisible(frame, payload, { ...view, ...change }), false);
  assert.equal(realtimeTapArrivalIsVisible({ ...frame, newPhysicalTapArrival: false }, payload, view), false);
  assert.equal(realtimeTapArrivalIsVisible(frame, { ...payload, lat: null, lng: null }, view), false);
});

function animationFixture(reduced = false) {
  let clock = base;
  let id = 0;
  const frames = new Map();
  const listeners = new Set();
  const paints = [];
  let cleared = 0;
  const motion = {
    matches: reduced,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  return {
    frames, listeners, paints, motion,
    get cleared() { return cleared; },
    tick(offset) {
      clock = base + offset;
      const pending = [...frames.values()]; frames.clear();
      pending.forEach((callback) => callback());
    },
    start: (expiresAt = base + 1_500) => startFiniteTapArrivalAnimation({
      expiresAt, motion, now: () => clock,
      requestFrame: (callback) => { frames.set(++id, callback); return id; },
      cancelFrame: (frame) => frames.delete(frame),
      paint: (progress) => paints.push(progress),
      clear: () => { cleared += 1; },
    }),
  };
}

test("arrival animation ends once after 1.5 seconds and schedules no perpetual work", () => {
  const fixture = animationFixture();
  const stop = fixture.start();
  assert.deepEqual(fixture.paints, [0]);
  fixture.tick(750);
  assert.deepEqual(fixture.paints, [0, 0.5]);
  fixture.tick(1_500);
  assert.equal(fixture.cleared, 1);
  assert.equal(fixture.frames.size, 0);
  assert.equal(fixture.listeners.size, 0);
  stop();
  assert.equal(fixture.cleared, 1);
});

test("reduced motion, expiry, preference changes and unmount cleanup cancel all animation work", () => {
  for (const [reduced, expiresAt] of [[true, base + 1_500], [false, base - 1]]) {
    const fixture = animationFixture(reduced);
    fixture.start(expiresAt);
    assert.equal(fixture.paints.length, 0);
    assert.equal(fixture.frames.size, 0);
    assert.equal(fixture.cleared, 1);
  }
  const changing = animationFixture(); changing.start();
  changing.motion.matches = true;
  [...changing.listeners].forEach((listener) => listener());
  assert.equal(changing.frames.size, 0);
  assert.equal(changing.listeners.size, 0);
  assert.equal(changing.cleared, 1);
  const unmount = animationFixture(); const stop = unmount.start(); stop();
  assert.equal(unmount.frames.size, 0);
  assert.equal(unmount.listeners.size, 0);
});

test("presentation flags never remove frames or change CRM event merging", async () => {
  const provider = await readFile(new URL("../src/components/dashboard-realtime-provider.tsx", import.meta.url), "utf8");
  const crm = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
  assert.match(provider, /next\.newPhysicalTapArrival = arrivalGate\.accept\(next\.data\)/);
  assert.match(provider, /setEventBuffer\(\(current\) => appendDashboardRealtimeBuffer\(\s*current,\s*next,/);
  assert.ok(crm.indexOf("accepted.push({ payload, receivedAt: frame.receivedAt })") < crm.indexOf("realtimeTapArrivalIsVisible(frame, payload"));
  assert.match(crm, /mergeRealtimeEvents\(next, item\.payload, EXECUTIVE_REALTIME_EVENT_LIMIT\)/);
  assert.match(crm, /setMapArrival\(null\);[\s\S]{0,120}\[queryTenant, timeRange, activeView, realtime\.activeScopeKey, realtime\.snapshot\]/);
});
