import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  describeLogisticsSource,
  resolveLogisticsStatsPayload,
} from "../src/lib/logistics-map-truth.ts";

const page = await readFile(new URL("../src/app/(app)/logistics/page.tsx", import.meta.url), "utf8");
const opsConsole = await readFile(new URL("../src/components/secure-delivery-ops-console.tsx", import.meta.url), "utf8");
const shipmentDetail = await readFile(new URL("../src/app/(app)/logistics/shipments/[shipmentId]/page.tsx", import.meta.url), "utf8");

const stats = { total: 4, in_transit: 2, delivered: 1, alerts: 1 };

test("logistics metrics retain demo, production and unconfirmed provenance", () => {
  assert.equal(resolveLogisticsStatsPayload({ stats, demoMode: true, dataSource: "demo" }, true).source, "demo");
  assert.equal(resolveLogisticsStatsPayload({ stats, dataSource: "production" }, true).source, "production");
  assert.equal(resolveLogisticsStatsPayload({ stats }, true).source, "unconfirmed");
  assert.match(describeLogisticsSource("demo").detail, /no representan envíos reales/);
});

test("logistics failures and malformed payloads never become confirmed zero inventory", () => {
  assert.equal(resolveLogisticsStatsPayload(null, false).availability, "unavailable");
  assert.equal(resolveLogisticsStatsPayload({ stats: { total: 0 } }, true).availability, "unavailable");
  assert.equal(resolveLogisticsStatsPayload({ stats: { ...stats, alerts: -1 } }, true).availability, "unavailable");
  assert.equal(resolveLogisticsStatsPayload(null, false).stats, null);
});

test("logistics avoids a geographic map until the API supplies shipment coordinates", () => {
  assert.match(page, /data-logistics-visual="non-geographic-process"/);
  assert.match(page, /Modelo de proceso · no geográfico/);
  assert.match(page, /La API actual no entrega coordenadas de los envíos/);
  assert.match(page, /data-logistics-source=\{statsResult\.source\}/);
  assert.match(page, /sourceCopy\.badge/);
  assert.match(page, /stats\?\.total \?\? "—"/);
  assert.doesNotMatch(page, /<svg|Mapa demo|rutas y marcadores simulados|HUB DEMO|DESTINO DEMO|maplibre-gl/);
  assert.doesNotMatch(page, /Live Network|real-time proof of custody|cryptographic chain of custody for all secure deliveries in real-time/);
});

test("logistics copy keeps recorded handling separate from proven custody or contents", () => {
  const copy = `${page}\n${opsConsole}\n${shipmentDetail}`;
  assert.match(copy, /do not prove physical custody or contents by themselves/);
  assert.match(copy, /Neither proves contents by itself/);
  assert.doesNotMatch(copy, /Closed seal confirms delivery|Transfer events keep chain of custody visible|Pre-encoded UID is bound to the physical package/);
});
