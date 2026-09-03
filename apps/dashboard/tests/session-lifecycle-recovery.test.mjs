import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const heartbeat = await readFile(new URL("../src/components/session-heartbeat.tsx", import.meta.url), "utf8");
const currentSession = await readFile(new URL("../src/app/api/session/current/route.ts", import.meta.url), "utf8");
const login = await readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");

test("a hidden tab resumes session validation on visibility and focus", () => {
  assert.match(heartbeat, /document\.visibilityState === "hidden"/);
  assert.match(heartbeat, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(heartbeat, /window\.addEventListener\("focus", resumeHeartbeat\)/);
  assert.match(heartbeat, /if \(document\.visibilityState === "visible"\) resumeHeartbeat\(\)/);
  assert.match(heartbeat, /document\.removeEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(heartbeat, /window\.removeEventListener\("focus", resumeHeartbeat\)/);
  assert.match(heartbeat, /pingInFlight/);
});

test("expired sessions fail closed and redirect once with actionable copy", () => {
  assert.match(heartbeat, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(heartbeat, /stopHeartbeat = true/);
  assert.match(heartbeat, /loginUrl\.searchParams\.set\("auth_error", "session_expired"\)/);
  assert.match(heartbeat, /window\.location\.replace/);
  assert.match(login, /case "session_expired"/);
  assert.match(login, /Tu sesión venció o dejó de ser válida/);
});

test("the current-session BFF never turns an upstream denial into a guest session", () => {
  assert.match(currentSession, /upstream\.status === 401 \|\| upstream\.status === 403/);
  assert.match(currentSession, /return expiredSessionResponse\(upstream\.status\)/);
  assert.match(currentSession, /response\.cookies\.delete\(DASHBOARD_SESSION_COOKIE\)/);
  assert.match(currentSession, /response\.cookies\.delete\(DASHBOARD_SESSION_SNAPSHOT_COOKIE\)/);
  assert.match(currentSession, /reason: "session_expired"/);
  assert.match(currentSession, /response\.headers\.set\("Cache-Control", "no-store"\)/);
  assert.doesNotMatch(currentSession, /guest:\s*true/);
  assert.doesNotMatch(currentSession, /public@nexid\.demo/);
});

test("automatic demo fallback cannot replace an invalid real credential", () => {
  assert.match(currentSession, /if \(!localToken \|\| localToken\.startsWith\("demo\."\)\)/);
  assert.match(currentSession, /if \(localSession\?\.isDemo\)/);
  assert.doesNotMatch(currentSession, /localSession\.id\.startsWith\("demo-"\) \|\| localToken\.startsWith/);
});
