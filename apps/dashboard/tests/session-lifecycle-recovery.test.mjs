import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const heartbeat = await readFile(new URL("../src/components/session-heartbeat.tsx", import.meta.url), "utf8");
const currentSession = await readFile(new URL("../src/app/api/session/current/route.ts", import.meta.url), "utf8");
const login = await readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
const sessionBoundary = await readFile(new URL("../src/lib/session.ts", import.meta.url), "utf8");
const recoveryPage = await readFile(new URL("../src/app/session-recovery/page.tsx", import.meta.url), "utf8");
const recoveryClient = await readFile(new URL("../src/app/session-recovery/session-recovery-client.tsx", import.meta.url), "utf8");
const secureLogout = await readFile(new URL("../src/components/secure-dashboard-logout-button.tsx", import.meta.url), "utf8");

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
  assert.match(heartbeat, /normalizeDashboardReturnPath/);
  assert.match(heartbeat, /dashboardAuthPath\("\/login", returnPath, \{ auth_error: "session_expired" \}\)/);
  assert.match(heartbeat, /window\.location\.replace/);
  assert.match(login, /case "session_expired"/);
  assert.match(login, /Tu sesión venció o dejó de ser válida/);
});

test("heartbeat requires a confirmed session payload and explains transient failures", () => {
  assert.match(heartbeat, /payload\.ok === true/);
  assert.match(heartbeat, /payload\.session/);
  assert.match(heartbeat, /setConnectionState\("degraded"\)/);
  assert.match(heartbeat, /data-testid="session-heartbeat-degraded"/);
  assert.match(heartbeat, /No se toma una respuesta vacía o inválida como sesión activa/);
  assert.match(heartbeat, /dashboardAuthPath\("\/session-recovery", returnPath\)/);
  assert.match(heartbeat, /if \(failures >= 2\)[\s\S]*window\.location\.replace\(nextRecoveryHref\)/);
  assert.match(heartbeat, /onClick=\{\(\) => retryRef\.current\(\)\}/);
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

test("transient auth outages preserve the opaque credential and use a real recovery route", () => {
  assert.match(sessionBoundary, /class DashboardSessionUpstreamUnavailableError extends Error/);
  assert.match(sessionBoundary, /res && \(res\.status === 401 \|\| res\.status === 403\)\) return null/);
  assert.match(sessionBoundary, /throw new DashboardSessionUpstreamUnavailableError/);
  assert.match(sessionBoundary, /redirect\(dashboardAuthPath\("\/session-recovery", returnPath\)\)/);
  assert.match(login, /redirect\(dashboardAuthPath\("\/session-recovery", nextPath\)\)/);
  assert.match(recoveryPage, /SessionRecoveryClient/);
  assert.match(recoveryPage, /session-recovery-title/);
  assert.doesNotMatch(sessionBoundary, /cookieStore\.get\(DASHBOARD_SESSION_SNAPSHOT_COOKIE\)\?\.value/);
});

test("recovery retries without overlapping and only leaves on confirmed outcomes", () => {
  assert.match(recoveryClient, /dashboardFetch\("\/api\/session\/current"/);
  assert.match(recoveryClient, /requestInFlight\.current/);
  assert.match(recoveryClient, /window\.setInterval\(\(\) => void validateSession\(\), RETRY_INTERVAL_MS\)/);
  assert.match(recoveryClient, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(recoveryClient, /dashboardAuthPath\("\/login", safeNextPath, \{ auth_error: "session_expired" \}\)/);
  assert.match(recoveryClient, /response\.ok && payload\?\.ok === true && payload\?\.session/);
  assert.match(recoveryClient, /window\.location\.replace\(safeNextPath\)/);
  assert.match(recoveryClient, /window\.addEventListener\("focus", resume\)/);
  assert.match(recoveryClient, /document\.addEventListener\("visibilitychange", resume\)/);
  assert.doesNotMatch(recoveryClient, /document\.cookie/);
});

test("recovery and account-switch actions revoke the upstream session with POST", async () => {
  const dashboardHome = await readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8");
  const physicalTaps = await readFile(new URL("../src/components/physical-taps-command-center.tsx", import.meta.url), "utf8");

  assert.match(recoveryClient, /SecureDashboardLogoutButton/);
  assert.doesNotMatch(recoveryClient, /href="\/logout"/);
  assert.match(dashboardHome, /testId="dashboard-demo-exit"/);
  assert.doesNotMatch(dashboardHome, /href="\/logout"/);
  assert.match(physicalTaps, /testId="physical-taps-change-account"/);
  assert.doesNotMatch(physicalTaps, /href="\/logout"/);
  assert.match(secureLogout, /method="post" action="\/logout"/);
  assert.match(secureLogout, /dashboardFetch\("\/logout", \{[\s\S]*method: "POST",[\s\S]*credentials: "same-origin"/);
});
