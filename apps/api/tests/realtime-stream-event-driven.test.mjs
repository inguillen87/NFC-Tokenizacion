import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeSource = await readFile(
  new URL("../src/app/admin/events/stream/route.ts", import.meta.url),
  "utf8",
);
const lifecycleSource = await readFile(
  new URL("../src/lib/realtime-stream-lifecycle.ts", import.meta.url),
  "utf8",
);

test("SSE opens with one bounded durable snapshot and then stays event-driven", () => {
  assert.equal((routeSource.match(/await fetchRows\(searchParams, realtimeWindow, forcedTenantSlug, sourceFilter\)/g) || []).length, 1);
  assert.match(routeSource, /runRealtimeStreamLifecycle/);
  assert.match(routeSource, /subscribe: \(listener\) => subscribeRealtimeEvent\([\s\S]*tenant[\s\S]*\{ tenantSlug: tenant, after: resumeCursor \|\| null, signal: req\.signal \}[\s\S]*\{ global: true, after: resumeCursor \|\| null, signal: req\.signal \}/);
  assert.match(lifecycleSource, /subscription = await options\.subscribe/);
  assert.match(routeSource, /scope: \{ tenant: tenant \|\| "global", window: realtimeWindow\.id \}/);
  assert.doesNotMatch(routeSource + lifecycleSource, /pollPersisted|reconcilePersisted|RECONCILIATION_INTERVAL|afterEventId/);
  assert.doesNotMatch(routeSource + lifecycleSource, /setInterval(?:Impl)?\(\(\) => \{\s*void fetchRows/);
});

test("broker readiness and startup buffering close the snapshot race", () => {
  const subscribeIndex = lifecycleSource.indexOf("await options.subscribe");
  const snapshotIndex = lifecycleSource.indexOf("await options.fetchSnapshot");
  assert.ok(subscribeIndex >= 0 && snapshotIndex > subscribeIndex);
  assert.match(lifecycleSource, /if \(!snapshotReady\)[\s\S]*startupBuffer\.push\(payload\)/);
  assert.match(lifecycleSource, /snapshotRows\.forEach\(options\.rememberSnapshotRow\)[\s\S]*snapshotReady = true[\s\S]*startupBuffer\.splice\(0\)/);
  assert.match(lifecycleSource, /if \(!subscription\.distributedReady\)[\s\S]*options\.emitTransportUnavailable\(\)[\s\S]*shutdown\(\)/);
  assert.match(routeSource, /reason: "realtime_transport_unavailable"/);
  assert.match(lifecycleSource, /catch \{[\s\S]*options\.emitTransportUnavailable\(\)[\s\S]*shutdown\(\)/);
});

test("the managed broker subscription is tenant-specific unless an authorized global view omitted the tenant", () => {
  assert.match(routeSource, /\{ tenantSlug: tenant, after: resumeCursor \|\| null, signal: req\.signal \}/);
  assert.match(routeSource, /\{ global: true, after: resumeCursor \|\| null, signal: req\.signal \}/);
  assert.doesNotMatch(routeSource, /subscribeRealtimeEvent\(listener\)\s*[,)]/);
});

test("snapshot and broker notifications share one bounded projection deduper", () => {
  assert.match(routeSource, /createBoundedRealtimeProjectionDeduper<TenantTapRealtimeEvent>/);
  assert.match(lifecycleSource, /const seen = new Map<string, string>\(\)/);
  assert.match(lifecycleSource, /seen\.size > boundedMaxEntries/);
  assert.match(routeSource, /commercialConsentChannels: \[\.\.\.event\.commercialConsentChannels\]\.sort\(\)/);
  assert.match(routeSource, /rememberSnapshotRow: rememberEvent/);
  assert.match(routeSource, /if \(!rememberEvent\(normalized\)\) return/);
  assert.equal((routeSource.match(/emitTapEvent\(rawPayload, transportCursor\)/g) || []).length, 1);
});

test("only durable tap frames advance the EventSource resume id", () => {
  assert.match(routeSource, /const resumeCursor = String\(req\.headers\.get\("last-event-id"\)/);
  assert.match(routeSource, /\^\\d\+-\\d\+\$\/\.test\(transportCursor\)/);
  assert.match(routeSource, /event === "event"[\s\S]*?"eventId" in/);
  assert.match(routeSource, /outputQueue\.write\(encodeEventFrame\(event, payload, eventId\)\)/);
  assert.match(routeSource, /emitTapEvent\(rawPayload, transportCursor\)/);
  assert.match(routeSource, /resolveJitteredRealtimeDelay\(3_000, \{ jitterRatio: 0\.15 \}\)/);
  assert.match(routeSource, /outputQueue\.write\(encoder\.encode\(`retry: \$\{reconnectRetryMs\}\\n\\n`\)\)/);
});

test("notification-domain events are allowlisted and tenant-scoped before delivery", () => {
  assert.match(routeSource, /OPERATIONAL_NOTIFICATION_EVENT_TYPES = new Set/);
  for (const eventType of ["lead.created", "ticket.created", "order_request.created", "supplier_order.created"]) {
    assert.match(routeSource, new RegExp(eventType.replace(".", "\\.")));
  }
  const branch = routeSource.match(/if \(isOperationalNotificationPayload\(rawPayload\)\)[\s\S]*?\n\s*\}/)?.[0] || "";
  assert.match(branch, /allowRealtimeEventForSource/);
  assert.match(branch, /allowRealtimeEventForScope/);
  assert.doesNotMatch(branch, /contact:/);
});

test("heartbeat is the only periodic stream task and all resources close", () => {
  const intervals = lifecycleSource.match(/setIntervalImpl\(\(\) =>/g) || [];
  assert.equal(intervals.length, 1);
  const shutdown = lifecycleSource.match(/const shutdown = \(closeController = true\)[\s\S]*?if \(closeController\) options\.closeController\(\);\s*\};/)?.[0] || "";
  assert.match(shutdown, /if \(heartbeat\) clearIntervalImpl\(heartbeat\)/);
  assert.match(shutdown, /clearTimeoutImpl\(lifetime\)/);
  assert.match(shutdown, /unsubscribe\(\)/);
  assert.match(shutdown, /removeEventListener\("abort", onAbort\)/);
  assert.match(lifecycleSource, /snapshotRows = await options\.fetchSnapshot\(\);[\s\S]*?if \(closed \|\| options\.isExternallyCancelled\(\)\) return;/);
  assert.match(lifecycleSource, /if \(closed \|\| options\.isExternallyCancelled\(\)\) return;\s*heartbeat = setIntervalImpl/);
  assert.match(lifecycleSource, /heartbeat = setIntervalImpl\(\(\) => \{\s*if \(closed \|\| options\.isExternallyCancelled\(\)\) return;/);
});

test("a broker transport reset closes the stream so EventSource recovers from a fresh durable snapshot", () => {
  assert.match(routeSource, /rawPayload\.event_type \|\| ""\) === "realtime\.transport_reset"/);
  assert.match(routeSource, /send\("warning", \{[\s\S]*?availability: "upstream_error"/);
  assert.match(routeSource, /isTerminalPayload: \(payload\) => String\(payload\.event_type \|\| ""\) === "realtime\.transport_reset"/);
  assert.match(lifecycleSource, /if \(options\.isTerminalPayload\(payload\)\)[\s\S]*options\.handlePayload\(payload\);\s*shutdown\(\)/);
});

test("trimmed or invalid managed cursors explicitly reset EventSource before the durable snapshot", () => {
  assert.match(routeSource, /export const maxDuration = 300/);
  assert.match(routeSource, /subscription\.replay === "snapshot_reset"/);
  assert.match(routeSource, /outputQueue\.write\(encoder\.encode\("id:\\n"\)\)/);
  assert.match(routeSource, /cursor_reset: resetResumeCursor/);
  assert.match(routeSource, /reset_reason: subscription\.replayResetReason \|\| null/);
  assert.match(lifecycleSource, /emitSnapshot: \(rows: Row\[\], subscription: RealtimeStreamSubscription\)/);
  assert.match(lifecycleSource, /options\.emitSnapshot\(snapshotRows, subscription\)/);
});

test("post-start output applies bounded backpressure and closes with a recoverable snapshot reset", () => {
  assert.match(routeSource, /createBoundedRealtimeSseOutputQueue/);
  assert.match(routeSource, /maxPendingFrames: MAX_PENDING_OUTPUT_FRAMES/);
  assert.match(routeSource, /maxPendingBytes: MAX_PENDING_OUTPUT_BYTES/);
  assert.match(routeSource, /reason: "output_backpressure_overflow"/);
  assert.match(routeSource, /recovery: "snapshot_reset"/);
  assert.match(routeSource, /overflowFrame: encoder\.encode\(`id:\\n/);
  assert.match(routeSource, /pull\(\) \{\s*flushOutput\?\.\(\)/);
  assert.match(routeSource, /highWaterMark: SSE_OUTPUT_HIGH_WATER_MARK_BYTES/);
  assert.doesNotMatch(routeSource, /controller\.enqueue/);
});

test("the long-lived lifecycle does not block ReadableStream pull/backpressure draining", () => {
  assert.match(routeSource, /new ReadableStream<Uint8Array>\(\{\s*start\(controller\)/);
  assert.match(routeSource, /void runRealtimeStreamLifecycle<TenantTapRealtimeEvent, Record<string, unknown>>\(\{/);
  assert.doesNotMatch(routeSource, /async start\(controller\)/);
  assert.match(routeSource, /pull\(\)\s*\{\s*flushOutput\?\.\(\)/);
});

test("database failures are logged as bounded codes without messages or connection strings", () => {
  assert.match(routeSource, /safeOperationalErrorCode\(error, "snapshot_query_failed"\)/);
  assert.match(routeSource, /reason: "snapshot_unavailable"/);
  assert.match(lifecycleSource, /options\.emitSnapshotUnavailable\(error\);\s*shutdown\(\)/);
  assert.doesNotMatch(routeSource + lifecycleSource, /error\.message/);
  assert.doesNotMatch(routeSource + lifecycleSource, /redacted_database_url/);
});
