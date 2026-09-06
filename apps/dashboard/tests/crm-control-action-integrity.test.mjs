import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [crm, home, activity] = await Promise.all([
  readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/crm-window-activity-panel.tsx", import.meta.url), "utf8"),
]);

test("CRM primary navigation uses client routing and the destination registry", () => {
  assert.match(crm, /import \{ DASHBOARD_DESTINATIONS \}/);
  assert.match(crm, /router\.push\(`\$\{DASHBOARD_DESTINATIONS\.events\.href\}\?filter=risk`\)/);
  assert.match(crm, /router\.push\(DASHBOARD_DESTINATIONS\.events\.href\)/);
  assert.match(crm, /onOpenAudit=\{canReadSensitiveEvents \? \(\) => router\.push\(DASHBOARD_DESTINATIONS\.events\.href\) : undefined\}/);
  assert.doesNotMatch(crm, /openCampaignStudio|DASHBOARD_DESTINATIONS\.campaigns/);
  assert.doesNotMatch(crm, /window\.location\.href\s*=\s*["'`]\/(?:events|loyalty\/campaigns)/);
});

test("restricted event actions render explanatory unavailable states without campaign promises", () => {
  assert.match(crm, /const eventsUnavailableReason = "Auditoría no habilitada: esta sesión no tiene events\.read_sensitive\."/);
  assert.match(crm, /data-testid="events-audit-unavailable">\{eventsUnavailableReason\}<\/span>/);
  assert.match(crm, /auditUnavailableReason=\{eventsUnavailableReason\}/);
  assert.match(activity, /onOpenAudit \? \([\s\S]*?data-testid="activity-audit-unavailable">Auditoría no habilitada<\/span>/);
  assert.doesNotMatch(activity, /Abrir campaña|Activar campaña|Enviar beneficio/);
});

test("CRM section controls cannot silently become inert", () => {
  assert.match(crm, /onSectionChange: \(section: CrmSection\) => void;/);
  assert.doesNotMatch(crm, /onSectionChange\?\./);
  assert.match(crm, /onSectionChange\("infra"\)/);
  assert.match(crm, /onSectionChange\("loyalty"\)/);
});

test("demo batch identifiers remain exact instead of being relabelled as production", () => {
  assert.match(home, /function displayBatchId\(value: unknown\)[\s\S]*return bid \|\| "BID pendiente";/);
  assert.doesNotMatch(home, /replace\(\/\^DEMO-\/,\s*"BALMEC-"\)/);
});

test("metric headers give long labels and counts separate bounded rows", () => {
  const metricCard = crm.slice(crm.indexOf("function MetricCard("), crm.indexOf("function FunnelNode("));
  assert.match(metricCard, /data-testid="crm-metric-card" className="min-w-0/);
  assert.match(metricCard, /className="flex min-w-0 flex-col items-start gap-2"/);
  assert.match(metricCard, /data-testid="crm-metric-label" className="flex min-w-0 items-start/);
  assert.match(metricCard, /data-testid="crm-metric-delta" className=\{`max-w-full break-words/);
});
