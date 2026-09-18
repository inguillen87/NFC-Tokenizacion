import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {describeLogisticsSource,resolveLogisticsStatsPayload} from "../src/lib/logistics-map-truth.ts";
const page=await readFile(new URL("../src/components/logistics-workspace.tsx",import.meta.url),"utf8");
const opsConsole=await readFile(new URL("../src/components/secure-delivery-ops-console.tsx",import.meta.url),"utf8");
const shipmentDetail=await readFile(new URL("../src/app/(app)/logistics/shipments/[shipmentId]/page.tsx",import.meta.url),"utf8");
const stats={total:4,in_transit:2,delivered:1,alerts:1};
test("logistics metrics retain demo, production and unconfirmed provenance",()=>{
  assert.equal(resolveLogisticsStatsPayload({stats,demoMode:true,dataSource:"demo"},true).source,"demo");
  assert.equal(resolveLogisticsStatsPayload({stats,dataSource:"production"},true).source,"production");
  assert.equal(resolveLogisticsStatsPayload({stats},true).source,"unconfirmed");
  assert.match(describeLogisticsSource("demo").detail,/no representan envíos reales/);
});
test("logistics failures and malformed payloads never become confirmed zero inventory",()=>{
  assert.equal(resolveLogisticsStatsPayload(null,false).availability,"unavailable");
  assert.equal(resolveLogisticsStatsPayload({stats:{total:0}},true).availability,"unavailable");
  assert.equal(resolveLogisticsStatsPayload({stats:{...stats,alerts:-1}},true).availability,"unavailable");
  assert.equal(resolveLogisticsStatsPayload(null,false).stats,null);
});
test("logistics does not draw shipment coordinates absent from its API",()=>{
  assert.match(page,/data-logistics-visual="non-geographic-process"/);
  assert.match(page,/no es un mapa geográfico/);
  assert.match(page,/data-logistics-source=/);
  assert.match(page,/typeof value==="number"/);
  assert.doesNotMatch(page,/<svg|maplibre-gl|rutas y marcadores simulados/);
});
test("recorded handling is distinct from proven custody or contents",()=>{
  const copy=`${page}\n${opsConsole}\n${shipmentDetail}`;
  assert.match(copy,/no prueban contenido, custodia física ni ubicación continua/i);
  assert.match(copy,/no prueba por sí sola autenticidad, contenido o custodia física/);
  assert.doesNotMatch(copy,/Closed seal confirms delivery|Pre-encoded UID is bound to the physical package/);
});
