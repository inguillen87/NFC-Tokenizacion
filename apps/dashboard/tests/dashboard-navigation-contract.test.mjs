import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const { DASHBOARD_DESTINATIONS } = await import("../src/lib/dashboard-destination-policy.ts");

test("every registered dashboard destination resolves to a real page", async () => {
  const hrefs = new Set();
  for (const [destination, policy] of Object.entries(DASHBOARD_DESTINATIONS)) {
    assert.match(policy.href, /^\//, destination);
    assert.equal(hrefs.has(policy.href), false, `duplicate href for ${destination}: ${policy.href}`);
    hrefs.add(policy.href);

    const routeFile = policy.href === "/"
      ? new URL("../src/app/(app)/page.tsx", import.meta.url)
      : new URL(`../src/app/(app)${policy.href}/page.tsx`, import.meta.url);
    await assert.doesNotReject(access(routeFile), `${destination} must resolve to ${routeFile.pathname}`);
  }
});

test("navigation controls do not ship inert primary actions", async () => {
  const [shell, accountMenu, registerPanel] = await Promise.all([
    readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/tenant-account-menu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/register-access-panel.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of [shell, accountMenu, registerPanel]) {
    assert.doesNotMatch(source, /onClick=\{\(\) => \{\}\}/);
    assert.doesNotMatch(source, /href=["']#["']/);
  }
});
