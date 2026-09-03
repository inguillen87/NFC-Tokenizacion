import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../src/app/(app)/service-levels/page.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
const destinations = await readFile(new URL("../src/lib/dashboard-destination-policy.ts", import.meta.url), "utf8");
const permissions = await readFile(new URL("../src/lib/permission-policy.ts", import.meta.url), "utf8");

test("SLO console accepts only the persisted non-demo schema", () => {
  assert.match(page, /schemaVersion === "nexid\.service-levels\.v1"/);
  assert.match(page, /provenance\?\.source === "persisted_database_aggregates"/);
  assert.match(page, /provenance\.synthetic === false/);
  assert.match(page, /provenance\.fixtures === false/);
  assert.match(page, /provenance\.demoExcluded === true/);
  assert.match(page, /response\.headers\.get\("x-nexid-data-mode"\) === "demo"/);
  assert.match(page, /session\.isDemo \? null/);
});

test("unavailable sources are explicit and are not replaced by zero KPI fixtures", () => {
  assert.match(page, /El tablero no sustituye esa ausencia con ceros ni datos simulados/);
  assert.match(page, /No se muestran métricas de demostración como si fueran SLOs/);
  assert.match(page, /No se infiere un estado saludable/);
  assert.doesNotMatch(page, /demoSnapshot|fixtureSnapshot|fallbackSnapshot/);
});

test("console exposes response contracts and differentiates measured evaluation from automated paging", () => {
  for (const runbook of ["sun-adjudication", "canonical-event-outbox", "webhook-delivery", "incident-response", "polygon-queue", "iota-queue"]) {
    assert.match(page, new RegExp(`"${runbook}"`));
  }
  assert.match(page, /Paging automático requiere conectar el endpoint/);
  assert.match(page, /No reemitir mint ambiguo/);
  assert.match(page, /No volver a publicar una transacción ambigua/);
});

test("navigation and BFF permission policy require analytics read access", () => {
  assert.match(shell, /destination: "serviceLevels"/);
  assert.match(destinations, /serviceLevels:\s*\{ href: "\/service-levels", requiredPermissions: \["analytics:read"\] \}/);
  assert.match(permissions, /normalizedPath === "observability\/service-levels"/);
  assert.match(permissions, /return "analytics:read"/);
});
