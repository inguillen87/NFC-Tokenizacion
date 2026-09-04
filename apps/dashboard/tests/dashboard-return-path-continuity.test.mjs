import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeSafeReturnPath } from "../../../packages/config/src/safe-return-path.ts";
import { dashboardAuthPath, normalizeDashboardReturnPath } from "../src/lib/dashboard-return-path.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("dashboard return paths stay internal and cannot loop through auth surfaces", () => {
  assert.equal(normalizeSafeReturnPath("/events?range=24h", "/"), "/events?range=24h");
  assert.equal(normalizeDashboardReturnPath("/events?range=24h"), "/events?range=24h");
  assert.equal(normalizeDashboardReturnPath("/login?next=/events"), "/");
  assert.equal(normalizeDashboardReturnPath("/session-recovery?next=/events"), "/");
  assert.equal(normalizeDashboardReturnPath("//evil.example"), "/");
  assert.equal(normalizeDashboardReturnPath("/safe/../login?next=/events"), "/");
  assert.equal(normalizeDashboardReturnPath("/safe/%2e%2e/logout"), "/");
  assert.equal(normalizeDashboardReturnPath("/safe/%2E%2E/api/session/demo?role=tenant-admin"), "/");
  assert.equal(normalizeDashboardReturnPath("/%61pi/session/demo"), "/");
  assert.equal(normalizeDashboardReturnPath("/%61uth/clerk/super-admin"), "/");
  assert.equal(normalizeDashboardReturnPath("/%6cogin"), "/");
  assert.equal(normalizeDashboardReturnPath("/%73ign-in"), "/");
  assert.equal(
    dashboardAuthPath("/login", "/events?range=24h", { auth_error: "session_expired" }),
    "/login?auth_error=session_expired&next=%2Fevents%3Frange%3D24h",
  );
});

test("dashboard return paths are canonical before auth and API denylist checks", () => {
  assert.equal(normalizeSafeReturnPath("/reports/../events?range=24h", "/"), "/events?range=24h");

  for (const unsafe of [
    "/reports/../logout",
    "/reports/%2e%2e/login?next=/events",
    "/reports/%2E%2E/session-recovery",
    "/reports/../auth/clerk/super-admin",
    "/reports/%2e%2e/api/session/demo?role=tenant-admin",
    "/reports/%2e%2e//evil.example/steal",
    "/%2561pi/session/demo",
    "/%2561uth/clerk/super-admin",
    "/%256cogin",
    "/%2573ign-in",
  ]) {
    assert.equal(normalizeDashboardReturnPath(unsafe), "/", unsafe);
  }
});

test("guard, heartbeat, recovery and login preserve one sanitized return path", async () => {
  const [proxy, session, heartbeat, recoveryPage, recoveryClient, loginPage, loginPanel, demoRoute] = await Promise.all([
    read("../src/proxy.ts"),
    read("../src/lib/session.ts"),
    read("../src/components/session-heartbeat.tsx"),
    read("../src/app/session-recovery/page.tsx"),
    read("../src/app/session-recovery/session-recovery-client.tsx"),
    read("../src/app/login/page.tsx"),
    read("../src/components/login-form-panel.tsx"),
    read("../src/app/api/session/demo/route.ts"),
  ]);

  assert.match(proxy, /DASHBOARD_RETURN_PATH_HEADER/);
  assert.match(proxy, /req\.nextUrl\.pathname/);
  assert.match(session, /dashboardAuthPath\("\/session-recovery", returnPath\)/);
  assert.match(session, /dashboardAuthPath\("\/login", returnPath\)/);
  assert.match(heartbeat, /window\.location\.pathname/);
  assert.match(heartbeat, /dashboardAuthPath\("\/login", returnPath/);
  assert.match(recoveryPage, /normalizeDashboardReturnPath\(rawNextPath\)/);
  assert.match(recoveryPage, /nextPath=\{nextPath\}/);
  assert.match(recoveryClient, /window\.location\.replace\(safeNextPath\)/);
  assert.match(loginPage, /normalizeDashboardReturnPath\(firstParam\(params\.next\)\)/);
  assert.match(loginPage, /if \(session\) redirect\(nextPath\)/);
  assert.match(loginPanel, /window\.location\.assign\(safeNextPath\)/);
  assert.match(demoRoute, /new URL\(nextPath, url\.origin\)/);
});

test("advanced dashboard access choices use progressive disclosure", async () => {
  const loginPanel = await read("../src/components/login-form-panel.tsx");
  assert.match(loginPanel, /<details data-testid="login-access-status"/);
  assert.match(loginPanel, /<details className="dashboard-auth-disclosure/);
  assert.match(loginPanel, /<details data-testid="login-credentials-panel"/);
  assert.match(loginPanel, /id="tenant-credentials"/);
  assert.match(loginPanel, /Requiere una cuenta tenant real; conserva aislamiento, permisos y trazabilidad/);
  assert.doesNotMatch(loginPanel, /text-emerald-100\/75/);
});
