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
