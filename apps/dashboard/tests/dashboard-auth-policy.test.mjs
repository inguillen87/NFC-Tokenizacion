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

test("demo session cookies are issued only by a same-origin POST", async () => {
  const route = await import(`../src/app/api/session/demo/route.ts?ts=${Date.now()}-post-only`);
  const endpoint = "https://app.nexid.lat/api/session/demo?role=tenant-admin&next=%2F";
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDemoFlag = process.env.DASHBOARD_BODEGA_DEMO_ACCESS;

  try {
    process.env.NODE_ENV = "production";
    process.env.DASHBOARD_BODEGA_DEMO_ACCESS = "true";

    for (const handler of [route.GET, route.HEAD]) {
      const response = await handler(new Request(endpoint));
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("allow"), "POST");
      assert.match(response.headers.get("cache-control") || "", /no-store/);
      assert.equal(response.headers.get("set-cookie"), null);
    }

    const missingOrigin = await route.POST(new Request(endpoint, { method: "POST" }));
    assert.equal(missingOrigin.status, 403);
    assert.equal(missingOrigin.headers.get("set-cookie"), null);

    const crossOrigin = await route.POST(new Request(endpoint, {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }));
    assert.equal(crossOrigin.status, 403);
    assert.equal(crossOrigin.headers.get("set-cookie"), null);

    const sameOrigin = await route.POST(new Request(endpoint, {
      method: "POST",
      headers: { origin: "https://app.nexid.lat" },
    }));
    assert.equal(sameOrigin.status, 303);
    assert.equal(sameOrigin.headers.get("location"), "https://app.nexid.lat/");
    assert.match(sameOrigin.headers.get("cache-control") || "", /no-store/);
    assert.match(sameOrigin.headers.get("set-cookie") || "", /nexid_dashboard_session=/);
    assert.match(sameOrigin.headers.get("set-cookie") || "", /nexid_dashboard_session_snapshot=/);
  } finally {
    if (typeof previousNodeEnv === "undefined") delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (typeof previousDemoFlag === "undefined") delete process.env.DASHBOARD_BODEGA_DEMO_ACCESS;
    else process.env.DASHBOARD_BODEGA_DEMO_ACCESS = previousDemoFlag;
  }
});

test("login surfaces separate founder Google auth from tenant demo access", () => {
  const loginPage = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
  const loginPanel = readFileSync(new URL("../src/components/login-form-panel.tsx", import.meta.url), "utf8");
  const googleButton = readFileSync(new URL("../src/components/clerk-google-super-admin-button.tsx", import.meta.url), "utf8");
  const signInPage = readFileSync(new URL("../src/app/sign-in/[[...sign-in]]/page.tsx", import.meta.url), "utf8");
  const demoRoute = readFileSync(new URL("../src/app/api/session/demo/route.ts", import.meta.url), "utf8");
  const logoutRoute = readFileSync(new URL("../src/app/logout/route.ts", import.meta.url), "utf8");
  const settingsPage = readFileSync(new URL("../src/app/(app)/settings/page.tsx", import.meta.url), "utf8");
  const sessionLoginRoute = readFileSync(new URL("../src/lib/session-login-route.ts", import.meta.url), "utf8");
  const secureLogoutButton = readFileSync(new URL("../src/components/secure-dashboard-logout-button.tsx", import.meta.url), "utf8");
  const accountMenu = readFileSync(new URL("../src/components/tenant-account-menu.tsx", import.meta.url), "utf8");
  const registerPanel = readFileSync(new URL("../src/components/register-access-panel.tsx", import.meta.url), "utf8");
  const superadminPage = readFileSync(new URL("../src/app/(app)/superadmin-network/page.tsx", import.meta.url), "utf8");

  assert.match(loginPage, /profile\.role !== "super-admin"/);
  assert.doesNotMatch(loginPage, /demoLoginAllowed/);

  assert.doesNotMatch(loginPanel, /DEMO_ROLES/);
  assert.doesNotMatch(loginPanel, /api\/session\/demo\?role=\$\{encodeURIComponent/);
  assert.doesNotMatch(loginPanel, /demoLogin:\s*true/);
  assert.doesNotMatch(loginPanel, /startBodegaDemo/);
  assert.match(loginPanel, /action=\{`\/api\/session\/demo\?role=tenant-admin&next=\$\{encodeURIComponent\(safeNextPath\)\}`\}/);
  assert.match(loginPanel, /method="post"/);
  assert.match(loginPanel, /data-testid="login-access-status"/);
  assert.match(loginPanel, /data-testid="login-bodega-demo-button"/);
  assert.match(loginPanel, /data-testid="login-superadmin-google-card"/);
  assert.match(loginPanel, /data-testid="login-credentials-panel"/);
  assert.match(loginPanel, /Super Admin entra por Google\/Clerk/);
  assert.match(loginPanel, /Continuar con Google allowlisted/);
  assert.match(loginPage, /firstParam\(params\.logged_out\) === "1"/);
  assert.match(loginPage, /authErrorCode === "clerk_session_invalid"/);
  assert.match(loginPage, /authErrorCode === "clerk_google_required"/);
  assert.match(loginPanel, /resetSessionOnStart=\{clerkRecoveryRequired\}/);
  assert.match(loginPage, /Sesión cerrada\. Podés ingresar con una cuenta tenant real, abrir la demo simulada o usar Google allowlisted\./);

  assert.match(googleButton, /already signed in/);
  assert.match(googleButton, /completeUrl\.searchParams\.set\("next", safeNextPath\)/);
  assert.match(googleButton, /window\.location\.assign\(`\/auth\/clerk\/super-admin\?next=\$\{encodeURIComponent\(safeNextPath\)\}`\)/);
  assert.match(googleButton, /useClerk/);
  assert.match(googleButton, /resetSessionOnStart/);
  assert.match(googleButton, /await clerk\.signOut/);
  assert.match(googleButton, /Preparando acceso seguro/);

  assert.doesNotMatch(signInPage, /getAccessProfiles/);
  assert.doesNotMatch(signInPage, /profile\.role/);
  assert.match(signInPage, /data-testid="sign-in-superadmin-page"/);
  assert.match(signInPage, /data-testid="sign-in-auth-status"/);
  assert.match(signInPage, /data-testid="sign-in-bodega-demo-link"/);
  assert.match(signInPage, /action=\{`\/api\/session\/demo\?role=tenant-admin&next=\$\{encodeURIComponent\(nextPath\)\}`\}/);
  assert.match(signInPage, /method="post"/);
  assert.match(signInPage, /data-testid="sign-in-google-only-boundary"/);
  assert.doesNotMatch(signInPage, /<SignIn/);
  assert.doesNotMatch(signInPage, /Fallback Clerk/);

  assert.match(demoRoute, /superadmin_requires_clerk/);
  assert.doesNotMatch(demoRoute, /permissions:\s*\["\*"\]/);
  assert.match(demoRoute, /export async function POST\(req: Request\)/);
  assert.match(demoRoute, /!requireSameOrigin\(req\)/);
  assert.match(demoRoute, /export async function GET\(\)/);
  assert.match(demoRoute, /export async function HEAD\(\)/);
  assert.match(demoRoute, /status: 405/);
  assert.match(demoRoute, /Allow: "POST"/);
  assert.match(demoRoute, /"Cache-Control": "no-store, max-age=0"/);

  assert.match(logoutRoute, /loginUrl\.searchParams\.set\("logged_out", "1"\)/);
  assert.match(logoutRoute, /const redirectPath = `\$\{loginUrl\.pathname\}\$\{loginUrl\.search\}`/);
  assert.match(logoutRoute, /status: 200/);
  assert.match(logoutRoute, /location\.replace/);
  assert.match(logoutRoute, /response\.headers\.set\("Cache-Control", "no-store"\)/);
  assert.match(logoutRoute, /response\.headers\.set\("Clear-Site-Data", "\\"cookies\\", \\"storage\\""\)/);
  assert.match(logoutRoute, /response\.cookies\.delete\(DASHBOARD_SESSION_COOKIE\)/);
  assert.match(logoutRoute, /response\.cookies\.delete\(DASHBOARD_SESSION_SNAPSHOT_COOKIE\)/);
  assert.match(logoutRoute, /export async function GET[\s\S]*status: 405/);
  assert.match(logoutRoute, /response\.headers\.set\("Allow", "POST"\)/);
  assert.match(logoutRoute, /fetchSite === "cross-site" \|\| !requireSameOrigin\(req\)/);

  assert.match(settingsPage, /const isClerkSuperAdminSession = session\.role === "super-admin" && !session\.mfaVerified/);
  assert.match(settingsPage, /Google\/Clerk SSO verificado; TOTP nexID no disponible/);
  assert.match(settingsPage, /sessionSecurityLabel/);
  assert.match(settingsPage, /SecureDashboardLogoutButton/);
  assert.doesNotMatch(settingsPage, /href="\/logout"/);
  assert.doesNotMatch(settingsPage, /method="post" action="\/logout"/);

  assert.match(secureLogoutButton, /useClerk/);
  assert.match(secureLogoutButton, /await dashboardFetch\("\/logout", \{[\s\S]*method: "POST",[\s\S]*credentials: "same-origin"/);
  assert.match(secureLogoutButton, /const LOGOUT_REDIRECT = "\/login\?logged_out=1"/);
  assert.match(secureLogoutButton, /signOut\(\{ redirectUrl: LOGOUT_REDIRECT \}\)/);
  assert.match(secureLogoutButton, /window\.location\.href = LOGOUT_REDIRECT/);
  assert.match(accountMenu, /SecureDashboardLogoutButton/);
  assert.match(registerPanel, /const clerk = useClerk\(\)/);
  assert.match(registerPanel, /onClick=\{\(\) => void clerk\.openSignUp\(\)\}/);
  assert.doesNotMatch(registerPanel, /onClick=\{\(\) => \{\}\}/);

  assert.match(sessionLoginRoute, /accessProfile\?\.role === "super-admin"/);
  assert.match(sessionLoginRoute, /profile_login_denied/);
  assert.match(sessionLoginRoute, /superadmin_requires_clerk/);

  assert.match(superadminPage, /if \(session\.role !== "super-admin"\)/);
  assert.match(superadminPage, /data-testid="superadmin-network-access-denied"/);
  assert.ok(
    superadminPage.indexOf('if (session.role !== "super-admin")') < superadminPage.indexOf("Promise.all"),
    "superadmin-network must deny tenant sessions before admin fetches",
  );
});

test("dashboard auth presents identity, access, and secondary status in that mobile hierarchy", () => {
  const loginPage = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
  const loginPanel = readFileSync(new URL("../src/components/login-form-panel.tsx", import.meta.url), "utf8");
  const globalStyles = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(loginPage, /min-h-dvh items-start/);
  assert.match(loginPage, /dashboard-auth-intro-primary order-1/);
  assert.match(loginPage, /dashboard-auth-panel-column order-2/);
  assert.match(loginPage, /dashboard-auth-intro-secondary order-3/);
  assert.ok(
    loginPage.indexOf("dashboard-auth-intro-primary") < loginPage.indexOf("dashboard-auth-panel-column") &&
      loginPage.indexOf("dashboard-auth-panel-column") < loginPage.indexOf("dashboard-auth-intro-secondary"),
    "mobile DOM order must keep identity before access and secondary context",
  );

  assert.match(loginPanel, /dashboard-auth-access-flow/);
  assert.match(loginPanel, /dashboard-auth-primary-actions/);
  assert.match(loginPanel, /dashboard-auth-access-status/);
  assert.match(
    globalStyles,
    /@media \(max-width: 767px\) \{[\s\S]*\.dashboard-auth-access-flow \{[\s\S]*flex-direction:\s*column[\s\S]*\.dashboard-auth-access-status \{[\s\S]*order:\s*10/,
  );
  assert.match(
    globalStyles,
    /@media \(min-width: 768px\) \{[\s\S]*"intro-primary access-panel"[\s\S]*"intro-secondary access-panel"/,
  );

  assert.match(globalStyles, /body:has\(\.dashboard-auth-surface\) \.helpbot-trigger/);
  assert.match(globalStyles, /body:has\(\.dashboard-auth-surface\) \.helpbot-panel/);
  assert.match(globalStyles, /display:\s*none !important/);
});
