import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FLAG_ENV_KEYS = [
  "DASHBOARD_ONE_CLICK_ACCESS",
  "DASHBOARD_ALLOW_DEMO_LOGIN",
  "DASHBOARD_SUPERADMIN_DEMO_ACCESS",
  "DASHBOARD_ALLOW_SUPERADMIN_DEMO",
  "DASHBOARD_BODEGA_DEMO_ACCESS",
  "DASHBOARD_ALLOW_BODEGA_DEMO",
  "ENABLE_BODEGA_BALMEC_DEMO",
];

function withEnv(updates, run) {
  const backup = new Map(FLAG_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of FLAG_ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(updates)) process.env[key] = value;
  try {
    return run();
  } finally {
    for (const [key, value] of backup.entries()) {
      if (typeof value === "undefined") delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("super admin demo remains disabled even if legacy env flags are enabled", async () => {
  const flags = await import(`../src/lib/dashboard-access-flags.ts?ts=${Date.now()}-superadmin-disabled`);

  withEnv(
    {
      DASHBOARD_SUPERADMIN_DEMO_ACCESS: "true",
      DASHBOARD_ALLOW_SUPERADMIN_DEMO: "true",
      DASHBOARD_ONE_CLICK_ACCESS: "true",
    },
    () => {
      assert.equal(flags.dashboardSuperAdminDemoAccessAllowed(), false);
      assert.equal(flags.dashboardDemoAccessAllowedForRole("super-admin"), false);
    },
  );
});

test("bodega tenant demo stays available by default and can be disabled per environment", async () => {
  const flags = await import(`../src/lib/dashboard-access-flags.ts?ts=${Date.now()}-bodega-policy`);

  withEnv({}, () => {
    assert.equal(flags.dashboardDemoAccessAllowedForRole("tenant-admin"), true);
  });

  withEnv({ DASHBOARD_BODEGA_DEMO_ACCESS: "false" }, () => {
    assert.equal(flags.dashboardDemoAccessAllowedForRole("tenant-admin"), false);
  });
});

test("login surfaces separate founder Google auth from tenant demo access", () => {
  const loginPage = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
  const loginPanel = readFileSync(new URL("../src/components/login-form-panel.tsx", import.meta.url), "utf8");
  const signInPage = readFileSync(new URL("../src/app/sign-in/[[...sign-in]]/page.tsx", import.meta.url), "utf8");
  const demoRoute = readFileSync(new URL("../src/app/api/session/demo/route.ts", import.meta.url), "utf8");

  assert.match(loginPage, /profile\.role !== "super-admin"/);
  assert.doesNotMatch(loginPage, /demoLoginAllowed/);

  assert.doesNotMatch(loginPanel, /DEMO_ROLES/);
  assert.doesNotMatch(loginPanel, /api\/session\/demo\?role=\$\{encodeURIComponent/);
  assert.match(loginPanel, /demoLogin:\s*true/);
  assert.match(loginPanel, /demoRole:\s*"tenant-admin"/);
  assert.match(loginPanel, /Super Admin entra por Google\/Clerk/);
  assert.match(loginPanel, /Continuar con Google allowlisted/);

  assert.doesNotMatch(signInPage, /getAccessProfiles/);
  assert.doesNotMatch(signInPage, /profile\.role/);
  assert.match(signInPage, /\/api\/session\/demo\?role=tenant-admin/);

  assert.match(demoRoute, /superadmin_requires_clerk/);
  assert.doesNotMatch(demoRoute, /permissions:\s*\["\*"\]/);
});
