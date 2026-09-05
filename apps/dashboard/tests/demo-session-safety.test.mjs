import test from "node:test";
import assert from "node:assert/strict";

import { dashboardFallbackSessionAllowed } from "../src/lib/dashboard-access-flags.ts";

const FLAG_KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "DASHBOARD_AUTO_SESSION",
  "DASHBOARD_BODEGA_DEMO_ACCESS",
  "TENANT_ADMIN_EMAIL",
  "TENANT_ADMIN_PASSWORD",
];

async function withCleanEnv(updates, run) {
  const previous = new Map(FLAG_KEYS.map((key) => [key, process.env[key]]));
  for (const key of FLAG_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(updates)) process.env[key] = value;
  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (typeof value === "undefined") delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("automatic demo sessions stay disabled in Production", async () => {
  await withCleanEnv({ NODE_ENV: "production", VERCEL_ENV: "production", DASHBOARD_AUTO_SESSION: "true", DASHBOARD_BODEGA_DEMO_ACCESS: "true" }, () => {
    assert.equal(dashboardFallbackSessionAllowed(), false);
  });
  await withCleanEnv({ NODE_ENV: "development", DASHBOARD_AUTO_SESSION: "true" }, () => {
    assert.equal(dashboardFallbackSessionAllowed(), true);
  });
});

test("Bodega demo always uses a synthetic identity and avoids forbidden global destinations", async () => {
  await withCleanEnv({
    NODE_ENV: "development",
    TENANT_ADMIN_EMAIL: "real-operator@example.test",
    TENANT_ADMIN_PASSWORD: "not-a-real-secret",
  }, async () => {
    const route = await import(`../src/app/api/session/demo/route.ts?ts=${Date.now()}-synthetic`);
    const response = await route.POST(new Request("http://localhost:3002/api/session/demo?role=tenant-admin&next=%2Fsuperadmin-network", {
      method: "POST",
      headers: { origin: "http://localhost:3002" },
    }));
    const cookies = response.headers.get("set-cookie") || "";
    const token = cookies.match(/nexid_dashboard_session=demo\.([^;]+)/)?.[1] || "";
    const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "http://localhost:3002/");
    assert.equal(payload.email, "demobodega@nexid.lat");
    assert.notEqual(payload.email, "real-operator@example.test");
  });
});
