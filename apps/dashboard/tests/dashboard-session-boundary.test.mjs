import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sessionSource = await readFile(new URL("../src/lib/session.ts", import.meta.url), "utf8");
const proxySource = await readFile(new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
const setupSource = await readFile(new URL("../src/app/api/tenant/setup/route.ts", import.meta.url), "utf8");

test("unverified snapshot cookies are never accepted as an authenticated session", () => {
  assert.doesNotMatch(sessionSource, /function parseSnapshot/);
  assert.doesNotMatch(sessionSource, /if \(snapshot\) return snapshot/);
  assert.doesNotMatch(sessionSource, /snapshot \|\| demoFallbackSession/);
  assert.match(sessionSource, /if \(dashboardFallbackSessionAllowed\(\)\) \{[\s\S]*return \{ session: demoFallbackSession\(\), bearerToken: null, rotatedSessionToken: null \};[\s\S]*\}/);
});

test("demo sessions are isolated to readonly local admin responses", () => {
  assert.match(sessionSource, /isDemo\?: boolean/);
  assert.match(proxySource, /const scopedRole = demoSession \? "readonly_demo"/);
  assert.match(proxySource, /if \(demoSession && scopedRole === "readonly_demo"\) \{[\s\S]*return markDemoData\(demoAdminResponse/);
  assert.doesNotMatch(proxySource, /policy\.allowDemoFallback \|\| scopedRole === "readonly_demo"/);
  assert.match(setupSource, /demo sessions cannot mutate tenant setup/);
});
