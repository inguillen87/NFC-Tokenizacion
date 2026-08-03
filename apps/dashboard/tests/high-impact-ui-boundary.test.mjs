import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("sensitive event reads are gated before server fetches and every SSE connection", async () => {
  const [home, stream, executive, multirubro, bell, shell] = await Promise.all([
    source("../src/app/(app)/page.tsx"),
    source("../src/app/api/admin/events/stream/route.ts"),
    source("../src/components/executive-realtime-crm.tsx"),
    source("../src/components/multirubro-ops-panel.tsx"),
    source("../src/components/admin-notification-bell.tsx"),
    source("../src/components/dashboard-shell.tsx"),
  ]);

  assert.match(home, /dashboardHighImpactPermissionMatches\([\s\S]*"events\.read_sensitive"[\s\S]*canReadSensitiveEvents\s*\?\s*getLiveEvents/);
  assert.match(stream, /dashboardHighImpactPermissionMatches\([\s\S]*"events\.read_sensitive"[\s\S]*status: 403/);
  assert.match(executive, /if \(!canReadSensitiveEvents\)[\s\S]*return;[\s\S]*new EventSource/);
  assert.match(multirubro, /if \(!canReadSensitiveEvents\)[\s\S]*return;[\s\S]*new EventSource/);
  assert.match(bell, /if \(canReadSensitiveEvents && typeof EventSource/);
  assert.match(shell, /item\.href === "\/events" && !canReadSensitiveEvents/);
  assert.match(shell, /AdminNotificationBell canReadSensitiveEvents=\{canReadSensitiveEvents\}/);
});

test("high-impact mutation controls use separate capability gates", async () => {
  const [forms, batchPage, multirubro] = await Promise.all([
    source("../src/components/admin-action-forms.tsx"),
    source("../src/app/(app)/batches/[bid]/page.tsx"),
    source("../src/components/multirubro-ops-panel.tsx"),
  ]);

  assert.match(forms, /"batch\.tamper\.configure"[\s\S]*canConfigureTamper \? \(/);
  assert.match(forms, /\/tamper-config`[\s\S]*}, "PATCH"\)/);
  assert.match(forms, /"tag\.tamper\.override"[\s\S]*canOverrideTagTamper \? \(/);
  assert.match(forms, /"batch\.revoke"[\s\S]*canRevoke \? \(/);
  assert.match(batchPage, /"batch\.product\.configure"[\s\S]*canConfigureProduct \? <BatchConfigFormClient/);
  assert.match(multirubro, /"alerts\.ack"[\s\S]*canAcknowledgeAlerts && item\.status/);
});

test("role navigation mirrors sensitive read capability defaults", async () => {
  const shell = await source("../src/components/dashboard-shell.tsx");
  const content = await source("../src/lib/dashboard-content.ts");

  assert.match(shell, /entry\.href === "\/loyalty\/experiences" && !canReadConsumerExperiences/);
  assert.match(shell, /if \(canReadConsumerExperiences\)[\s\S]*loyaltyNetworkItems\.push\(\{ href: "\/loyalty\/experiences"/);
  assert.doesNotMatch(content, /"packaging-operator": \[[^\]]*"events"/);
  assert.doesNotMatch(content, /viewer: \[[^\]]*"events"/);
  assert.match(content, /"super-admin": \[[^\]]*"events"[^\]]*"experiences"/);
  assert.match(content, /"reseller-admin": \[[^\]]*"leadsTickets"/);
});
