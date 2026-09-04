import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { isAdminUpstreamAuthorizationOutcome } from "../src/lib/admin-proxy-policy.ts";

test("admin proxy classifies only upstream 401 and 403 as authorization outcomes", () => {
  assert.equal(isAdminUpstreamAuthorizationOutcome(401), true);
  assert.equal(isAdminUpstreamAuthorizationOutcome(403), true);
  assert.equal(isAdminUpstreamAuthorizationOutcome(400), false);
  assert.equal(isAdminUpstreamAuthorizationOutcome(500), false);
});

test("admin proxy preserves authorization outcomes before demo and invalid-payload fallbacks", async () => {
  const source = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
  const classifyAt = source.indexOf("const upstreamAuthorizationOutcome = isAdminUpstreamAuthorizationOutcome(response.status)");
  const fallbackAt = source.indexOf("if (!upstreamAuthorizationOutcome && !response.ok");
  const validationAt = source.indexOf("if (!upstreamAuthorizationOutcome && criticalGet");

  assert.ok(classifyAt > 0);
  assert.ok(fallbackAt > classifyAt);
  assert.ok(validationAt > fallbackAt);
  assert.doesNotMatch(source, /if \(response\.status === 401\) \{\s*return unavailable/);
});

test("admin BFF and event stream preserve session upstream outages as no-store 503 responses", async () => {
  const [proxy, stream] = await Promise.all([
    readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/events/stream/route.ts", import.meta.url), "utf8"),
  ]);

  for (const source of [proxy, stream]) {
    assert.match(source, /isDashboardSessionUpstreamUnavailable\(error\)/);
    assert.match(source, /reason: "dashboard_session_upstream_unavailable"/);
    assert.match(source, /status: 503/);
    assert.match(source, /"cache-control": "private, no-store, max-age=0"/);
    assert.match(source, /"x-nexid-auth-outcome": "session-resolver-unavailable"/);
    assert.doesNotMatch(source, /getDashboardSessionCredential\(\{ persistRotation: true \}\)\.catch\(\(\) => null\)/);
  }

  const proxyOutage = proxy.slice(
    proxy.indexOf("function dashboardSessionUnavailableResponse"),
    proxy.indexOf("function annotatePayload"),
  );
  const streamOutage = stream.slice(
    stream.indexOf("function streamSessionUnavailable"),
    stream.indexOf("function fallbackStream"),
  );
  assert.doesNotMatch(proxyOutage, /markDemoData|demoAdminResponse|cookies\.delete/);
  assert.doesNotMatch(streamOutage, /fallbackStream|getDashboardDemoEvents|cookies\.delete/);

  const proxyUpstream503 = proxy.indexOf("response.status === 503");
  const proxyFallback = proxy.indexOf("if (!upstreamAuthorizationOutcome && !response.ok");
  const streamUpstreamAuthorization = stream.indexOf("if (response.status === 401 || response.status === 403)");
  const streamUpstream503 = stream.indexOf("response.status === 503");
  const streamFallback = stream.indexOf("if (!response?.ok || !response.body)");
  assert.ok(proxyUpstream503 > 0 && proxyUpstream503 < proxyFallback);
  assert.ok(streamUpstreamAuthorization > 0 && streamUpstreamAuthorization < streamFallback);
  assert.ok(streamUpstream503 > 0 && streamUpstream503 < streamFallback);
  assert.match(proxy.slice(proxyUpstream503, proxyFallback), /return dashboardSessionUnavailableResponse\(\)/);
  assert.match(
    proxy.slice(proxyUpstream503, proxyFallback),
    /response\.headers\.get\("x-nexid-auth-outcome"\) === "session-resolver-unavailable"/,
  );
  assert.match(
    stream.slice(streamUpstreamAuthorization, streamUpstream503),
    /return streamAuthorizationError\("dashboard_session_rejected", requestId, response\.status\)/,
  );
  assert.match(stream.slice(streamUpstream503, streamFallback), /return streamSessionUnavailable\(requestId\)/);
  assert.match(
    stream.slice(streamUpstream503, streamFallback),
    /response\.headers\.get\("x-nexid-auth-outcome"\) === "session-resolver-unavailable"/,
  );

  assert.match(proxy, /catch \{\s*return unavailable\("Admin upstream unreachable\."\);\s*\}/);
  assert.match(
    stream,
    /catch \{\s*return fallbackStream\("upstream stream unreachable", requestId, limit, \{[\s\S]*?availability: effectiveSource === "demo" \? "fallback" : "upstream_error"/,
  );
  assert.doesNotMatch(proxy, /catch \{\s*return dashboardSessionUnavailableResponse\(\);\s*\}/);
  assert.doesNotMatch(stream, /catch \{\s*return streamSessionUnavailable\(requestId\);\s*\}/);
});
