import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../src/${path}`, import.meta.url), "utf8");
}

test("sensitive events page checks its high-impact capability before loading events", async () => {
  const page = await source("app/(app)/events/page.tsx");
  assert.match(page, /dashboardHighImpactPermissionMatches\(\s*session\.role,\s*session\.permissions,\s*"events\.read_sensitive",\s*session\.deniedPermissions,\s*\)/s);
  assert.match(page, /if \(!canReadSensitiveEvents\)[\s\S]*?return \([\s\S]*?events-access-denied/);
  assert.ok(page.indexOf("if (!canReadSensitiveEvents)") < page.indexOf("const eventsResult = await getLiveEvents"));
});

test("consumer experiences page fails closed before its PII fetch", async () => {
  const page = await source("app/(app)/loyalty/experiences/page.tsx");
  assert.match(page, /dashboardHighImpactPermissionMatches\(\s*session\.role,\s*session\.permissions,\s*"consumer_experiences\.read_pii",\s*session\.deniedPermissions,\s*\)/s);
  assert.match(page, /if \(!canReadConsumerExperiencePii\)[\s\S]*?return \([\s\S]*?consumer-experiences-access-denied/);
  assert.ok(page.indexOf("if (!canReadConsumerExperiencePii)") < page.indexOf("const experiencesResult = await adminGet"));
});

test("leads pages omit only the sensitive leads request when access is denied", async () => {
  const [leadsPage, resellersPage] = await Promise.all([
    source("app/(app)/leads-tickets/page.tsx"),
    source("app/(app)/resellers/page.tsx"),
  ]);

  for (const page of [leadsPage, resellersPage]) {
    assert.match(page, /dashboardHighImpactPermissionMatches\(\s*session\.role,\s*session\.permissions,\s*"leads\.manage",\s*session\.deniedPermissions,\s*\)/s);
    assert.match(page, /canManageLeads\s*\?\s*adminGet\(adminContext, "\/admin\/leads"/s);
    assert.match(page, /leads-access-denied/);
    assert.match(page, /adminGet\(adminContext, "\/admin\/tickets"/);
  }

  assert.match(leadsPage, /adminGet\(adminContext, "\/admin\/consumer-portal\/order-requests", allowDemoData\)/);
  assert.match(resellersPage, /adminGet\(adminContext, "\/admin\/orders"\)/);
});
