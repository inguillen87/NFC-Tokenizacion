import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL(p,import.meta.url),"utf8");
const [page,model,reader,center,runbooks,shell,destinations,permissions]=await Promise.all([
  "../src/app/(app)/service-levels/page.tsx","../src/lib/usage-health-model.ts","../src/lib/usage-health-read.ts","../src/components/usage-health-center.tsx","../src/lib/usage-health-runbooks.ts","../src/components/dashboard-shell.tsx","../src/lib/dashboard-destination-policy.ts","../src/lib/permission-policy.ts",
].map(read));
test("SLO console accepts only persisted non-demo schema through its extracted validator",()=>{
  assert.match(model,/p.schemaVersion===\"nexid\.service-levels\.v1\"/);
  for(const marker of ['provenance.source===\"persisted_database_aggregates\"','provenance.synthetic===false','provenance.fixtures===false','provenance.demoExcluded===true'])assert.ok(model.includes(marker));
  assert.match(reader,/headers.get\("x-nexid-data-mode"\)===\"demo\"/);
  assert.match(reader,/if\(demo\)return/);assert.match(page,/demo:Boolean\(session.isDemo\)/);
});
test("unavailable sources stay explicit rather than becoming zero KPI fixtures",()=>{
  for(const text of ["El tablero no sustituye esa ausencia con ceros ni datos simulados","No se muestran métricas de demostración como si fueran SLOs","No se infiere un estado saludable"])assert.ok(center.includes(text));
  assert.doesNotMatch(page+model+reader,/demoSnapshot|fixtureSnapshot|fallbackSnapshot/);
});
test("response guides are preserved and candidate alerts are not automated paging",()=>{
  for(const name of ["sun-adjudication","canonical-event-outbox","webhook-delivery","incident-response","polygon-queue","iota-queue"])assert.ok(runbooks.includes(name));
  assert.match(center,/Paging automático requiere conectar el endpoint/);
  assert.match(runbooks,/No reemitir mint ambiguo/);assert.match(runbooks,/No volver a publicar una transacción ambigua/);
});
test("page, navigation and BFF enforce analytics read without adding polling",()=>{
  assert.match(page,/requireDashboardDestination\("serviceLevels"\)/);assert.match(shell,/destination: "serviceLevels"/);
  assert.match(destinations,/serviceLevels:\s*\{ href: "\/service-levels", requiredPermissions: \["analytics:read"\] \}/);
  assert.match(permissions,/normalizedPath === "observability\/service-levels"/);assert.match(permissions,/return "analytics:read"/);
  assert.doesNotMatch(center,/setInterval|EventSource|localStorage/);assert.match(center,/if\(!canExport\|\|!snapshot\)return/);
});
