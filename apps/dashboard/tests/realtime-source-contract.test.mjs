import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tsImport } from "tsx/esm/api";

const { classifyRealtimeEventSource } = await tsImport("../src/lib/realtime-feed.ts", import.meta.url);

const homeSource = await readFile(new URL("../src/app/(app)/page.tsx", import.meta.url), "utf8");
const crmSource = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const realtimeProviderSource = await readFile(new URL("../src/components/dashboard-realtime-provider.tsx", import.meta.url), "utf8");
const streamBffSource = await readFile(new URL("../src/app/api/admin/events/stream/route.ts", import.meta.url), "utf8");

test("dashboard keeps seed and unknown origins out of the production label", () => {
  assert.deepEqual(classifyRealtimeEventSource("real"), { source: "production", eventSource: "real" });
  assert.deepEqual(classifyRealtimeEventSource("imported"), { source: "production", eventSource: "imported" });
  assert.deepEqual(classifyRealtimeEventSource("demo"), { source: "demo", eventSource: "demo" });
  assert.deepEqual(classifyRealtimeEventSource("seed"), { source: "demo", eventSource: "seed" });
  assert.deepEqual(classifyRealtimeEventSource("mystery"), { source: "unknown", eventSource: "mystery" });
});

test("Home returns explicit source and availability when upstream data falls back", () => {
  assert.match(homeSource, /type HomeRealtimeAvailability = "ready" \| "fallback" \| "upstream_error" \| "invalid_payload" \| "unreachable"/);
  assert.match(homeSource, /source: includeSeedRows \? "seed" : "unavailable"/);
  assert.match(homeSource, /availability: includeSeedRows \? "fallback" : availability/);
  assert.match(homeSource, /classifyRealtimeEventSource\(row\.source\)/);
  assert.match(homeSource, /realtimeStreamSource = session\.isDemo \? "demo" : "production"/);
  assert.match(homeSource, /limit: "18",\s*range: "24h",\s*source:/);
});

test("shared realtime provider requests one stable source while CRM replaces snapshots and labels them", () => {
  assert.match(realtimeProviderSource, /streamUrl\.searchParams\.set\("source", activeScope\.source\)/);
  assert.match(realtimeProviderSource, /streamUrl\.searchParams\.set\("window", activeScope\.window\)/);
  assert.match(realtimeProviderSource, /window: "all"/);
  assert.match(realtimeProviderSource, /const stream = new EventSource\(streamUrl\.toString\(\)\)/);
  assert.doesNotMatch(crmSource, /new EventSource\(/);
  assert.match(crmSource, /realtime\.activeScope\.source/);
  assert.match(crmSource, /setEvents\(sortRealtimeEvents\(normalizedRows, EXECUTIVE_REALTIME_EVENT_LIMIT\)\)/);
  assert.match(crmSource, /data-testid="crm-source-badge"/);
  assert.match(crmSource, /"Respaldo seed"/);
  assert.match(crmSource, /"Demo declarada"/);
  assert.match(crmSource, /"Fuente mixta"/);
});

test("dashboard SSE BFF validates source and never injects demo rows into production fallback", () => {
  assert.match(streamBffSource, /reason: "invalid_source_filter"/);
  assert.match(streamBffSource, /const effectiveSource: DashboardStreamSource = forceSandbox \? "demo" : requestedSource/);
  assert.match(streamBffSource, /const includeDemoRows = effectiveSource === "demo"/);
  assert.match(streamBffSource, /availability: includeDemoRows \? "fallback" : "upstream_error"/);
  assert.match(streamBffSource, /scope: \{ tenant: tenant \|\| "global", window: options\.window \|\| "24h" \}/);
  assert.match(streamBffSource, /source: options\.source \|\| "production"/);
});

test("dashboard SSE BFF rejects unauthenticated and unauthorized requests before opening a stream", () => {
  assert.match(streamBffSource, /function streamAuthorizationError\(/);
  assert.match(streamBffSource, /"cache-control": "private, no-store, max-age=0"/);
  assert.match(streamBffSource, /if \(!session\) return streamAuthorizationError\("dashboard_session_required", requestId\)/);
  assert.match(streamBffSource, /if \(!scopedRole\) return streamAuthorizationError\("dashboard_session_role_invalid", requestId\)/);
  assert.match(streamBffSource, /return streamAuthorizationError\(error\.code, requestId, 403\)/);
  assert.match(streamBffSource, /if \(!credential\?\.bearerToken\) return streamAuthorizationError\("validated_dashboard_session_required", requestId\)/);
  assert.doesNotMatch(streamBffSource, /fallbackStream\("Dashboard session required"/);
  assert.doesNotMatch(streamBffSource, /fallbackStream\("Unsupported dashboard role"/);
  assert.doesNotMatch(streamBffSource, /fallbackStream\("Validated dashboard session required"/);
});
