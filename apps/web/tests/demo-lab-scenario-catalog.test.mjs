import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  DEMO_LAB_MODE_ORDER,
  DEMO_LAB_SCENARIO_CATALOG,
  getDemoLabScenarioStatus,
} from "../src/app/(public)/demo-lab/demo-lab-scenario-catalog.ts";

const requiredScenarios = [
  ["polygon-ownership", "Polygon Ownership Demo", "configured"],
  ["iota-proof", "IOTA Proof Layer Demo", "configured"],
  ["dual-proof", "Dual Proof DPP", "simulated"],
  ["authorized-network", "Authorized Network Demo", "simulated"],
  ["sensor-evidence", "Sensor Evidence Demo", "simulated"],
  ["offline-verifier", "Offline Field Scan Demo", "demo"],
  ["supplier-batch-factory", "Supplier Batch Factory Demo", "simulated"],
];

test("DemoLab exposes the seven enterprise scenarios with explicit truthful modes", () => {
  assert.deepEqual(DEMO_LAB_MODE_ORDER, ["demo", "simulated", "configured", "live"]);

  for (const [id, title, mode] of requiredScenarios) {
    const scenario = DEMO_LAB_SCENARIO_CATALOG[id];
    assert.ok(scenario, `${id} must exist`);
    assert.equal(scenario.title, title);
    assert.equal(scenario.mode, mode);
    assert.equal(scenario.enterprise, true);
    assert.ok(scenario.statusDetail["es-AR"].length > 20);
  }

  assert.equal(
    Object.values(DEMO_LAB_SCENARIO_CATALOG).some((scenario) => scenario.mode === "live"),
    false,
    "the hub must not promote a scenario to live without runtime evidence",
  );
  assert.match(getDemoLabScenarioStatus("polygon-ownership", "es-AR").detail, /runtime/i);
  assert.match(getDemoLabScenarioStatus("iota-proof", "en").detail, /runtime/i);
});

test("every required DemoLab scenario has a navigable panel and client context", async () => {
  const page = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");

  for (const [id, title] of requiredScenarios) {
    assert.match(page, new RegExp(`id: ["']${id}["']`));
    assert.match(page, new RegExp(`["']${id}["']:\\s*\\{`));
    assert.match(client, new RegExp(`["']${id}["']:\\s*\\{`));
    assert.match(page + client, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(page, /href=\{`\/demo-lab\?scenario=\$\{s\.id\}`\}/);
  assert.match(client, /const query = new URLSearchParams\(\{ scenario: item\.key, vertical \}\)/);
  assert.match(client, /const href = `\/demo-lab\?\$\{query\.toString\(\)\}`/);
  assert.match(page, /data-demo-mode=\{scenarioStatus\.mode\}/);
  assert.match(client, /data-demo-mode=\{context\.mode\.mode\}/);
  assert.match(page, /const HUB_SCENARIO_ORDER:[\s\S]*"qr-gs1",[\s\S]*"nfc-424",[\s\S]*"offline-verifier",[\s\S]*"supplier-batch-factory",[\s\S]*"polygon-ownership"/);
  assert.match(page, /HUB_QUICK_LAUNCH_SCENARIOS = HUB_ORDERED_SCENARIOS\.slice\(0, 4\)/);
  assert.doesNotMatch(page, /Pruebas vivas/);
});

test("Supplier Batch Factory stays simulated, read-only and outside NFC secret custody", async () => {
  const page = await readFile(new URL("../src/app/(public)/demo-lab/page.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");
  const catalog = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-scenario-catalog.ts", import.meta.url), "utf8");
  const source = `${page}\n${client}\n${catalog}`;

  assert.match(client, /function SupplierBatchFactoryPreview/);
  assert.match(client, /data-demo-mode="simulated"/);
  assert.match(client, /no se creo ningun pedido, fila, pack de encoding ni tag/i);
  assert.match(client, /La referencia de clave es solo metadata/i);
  assert.match(client, /claves NFC crudas/i);
  assert.match(page, /no crea un pedido real, no programa tags y no exporta material de custodia/i);
  assert.doesNotMatch(source, /official partner|partner oficial|parceiro oficial|zero fees|cero fees|taxa zero/i);
  assert.doesNotMatch(source, /todas? las lecturas (?:se )?escriben on-chain|every tap is written on-chain/i);
});
