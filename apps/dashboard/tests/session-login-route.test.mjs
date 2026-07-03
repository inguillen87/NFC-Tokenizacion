import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/session-login-route.ts", import.meta.url), "utf8");

test("session login fallback requires upstream outage/5xx and explicit fallback guard", () => {
  assert.match(source, /function localProfileFallbackAllowed\(\)/);
  assert.match(source, /if \(accessProfile && localProfileFallbackAllowed\(\)\)/);
  assert.match(source, /if \(accessProfile && upstream\.status >= 500 && localProfileFallbackAllowed\(\)\)/);
});

test("session login does not contain unconditional accessProfile fallback", () => {
  assert.doesNotMatch(source, /if\s*\(\s*accessProfile\s*\)\s*\{/);
});
