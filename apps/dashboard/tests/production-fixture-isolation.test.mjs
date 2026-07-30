import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const crmPage = await readFile(new URL("../src/app/(app)/leads-tickets/page.tsx", import.meta.url), "utf8");
const crmClient = await readFile(new URL("../src/app/(app)/leads-tickets/leads-tickets-client.tsx", import.meta.url), "utf8");
const consumerOverview = await readFile(new URL("../src/app/(app)/consumer-network/overview/page.tsx", import.meta.url), "utf8");
const superadmin = await readFile(new URL("../src/app/(app)/superadmin-network/page.tsx", import.meta.url), "utf8");

test("production CRM rejects demo BFF payloads and never appends fixture conversations", () => {
  assert.match(crmPage, /readDemoDataMetaFromResponse/);
  assert.match(crmPage, /meta\.demoMode && !allowDemoData/);
  assert.match(crmPage, /const allowDemoData = Boolean\(session\.isDemo\)/);
  assert.match(crmPage, /demoMode=\{allowDemoData\}/);
  assert.match(crmPage, /leadsSource=\{leadsResult\.source\}/);

  assert.match(crmClient, /const demoAiQueries = useMemo<AiQuery\[\]>\(\(\) => demoMode/);
  assert.match(crmClient, /:\s*\[\], \[demoMode, tenantScope\]\)/);
  assert.match(crmClient, /const allAiQueries = useMemo<AiQuery\[\]>\(\(\) => \[\s*\.\.\.demoAiQueries,\s*\.\.\.parsedDbQueries/s);
  assert.match(crmClient, /data-ai-query-source=\{item\.source\}/);
  assert.match(crmClient, /item\.source === "demo" \? "DEMO" : "API"/);
  assert.doesNotMatch(crmClient, /const allAiQueries[\s\S]{0,240}\.\.\.DEFAULT_AI_QUERIES/);
});

test("consumer CRM and its heatmap accept fixture rows only for an explicit demo session", () => {
  assert.match(consumerOverview, /readDemoDataMetaFromResponse/);
  assert.match(consumerOverview, /meta\.demoMode && !allowDemoData/);
  assert.match(consumerOverview, /const allowDemoData = Boolean\(session\.isDemo\)/);
  assert.match(consumerOverview, /data-testid="consumer-network-source"/);
  assert.match(consumerOverview, /dataSource === "demo" \? " · DEMO DATA; no se agrega como actividad productiva\."/);
  assert.match(consumerOverview, /const heatmapCells = tapsReady \?/);
  assert.doesNotMatch(consumerOverview, /TENANT_DIRECTORY/);
});

test("superadmin withholds aggregate metrics when any production source is unavailable", () => {
  assert.match(superadmin, /meta\.demoMode \|\| !validate\(payload\)/);
  assert.match(superadmin, /const allSourcesReady = \[tenantsResult, batchesResult, tagsResult, experiencesResult, productAssetsResult\]/);
  assert.match(superadmin, /testId="superadmin-network-source-unavailable"/);
  assert.match(superadmin, /Se ocultan métricas, funnels, readiness y prioridades derivadas/);
  assert.match(superadmin, /\{allSourcesReady \? <OpsCommandCenter/);
  assert.doesNotMatch(superadmin, /fetchJson<TenantRow\[\]>\([^\n]+, \[\]\)/);
  assert.doesNotMatch(superadmin, /TENANT_DIRECTORY/);
});
