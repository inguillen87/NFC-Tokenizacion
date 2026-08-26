import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [home, demo, landing, interactive, ogImage, assistant, demoLab, demoLabPage, chainLab, ownership, investor] = await Promise.all([
  read("../src/app/page.tsx"),
  read("../src/app/demo/page.tsx"),
  read("../src/components/landing-sections.tsx"),
  read("../src/components/interactive-demo-section.tsx"),
  read("../src/app/og-image.tsx"),
  read("../src/app/api/assistant/chat/route.ts"),
  read("../src/app/(public)/demo-lab/demo-lab-client.tsx"),
  read("../src/app/(public)/demo-lab/page.tsx"),
  read("../src/app/(public)/demo-lab/chains/chain-lab-client.tsx"),
  read("../src/app/proof/ownership/page.tsx"),
  read("../src/app/investor-snapshot/investor-snapshot-client.tsx"),
]);

test("guided public demos never masquerade simulation as production telemetry", () => {
  const publicDemo = [home, demo, landing, interactive, ogImage, assistant].join("\n");

  assert.match(landing, /A tap alone does not prove physical authenticity/);
  assert.match(demo, /source-labelled demo surfaces/);
  assert.match(landing, /View guided demo/);
  assert.match(interactive, /reported openings, duplicates and regions from the selected data source/);
  assert.match(assistant, /source-labelled demo events/);

  assert.doesNotMatch(publicDemo, /Simulate physical NFC scans[\s\S]{0,100}real-time|Review the live surfaces|View live demo|show live taps|mostr[aá] taps en vivo/i);
});

test("testnet and deployment claims require current runtime evidence", () => {
  const chainClaims = [demoLab, demoLabPage, chainLab, ownership, investor].join("\n");

  assert.match(demoLab, /Only that certificate may call a testnet mint confirmed when its current RPC checks pass/);
  assert.match(demoLabPage, /certificado confirma el mint testnet solo si pasan los checks actuales/);
  assert.match(chainLab, /consulta pública actual/);
  assert.match(ownership, /Ver mint en Amoy/);
  assert.match(investor, /no acredita por sí solo el estado del deploy actual/);

  assert.doesNotMatch(chainClaims, /This flow shows the policy plus a confirmed testnet mint|Este flujo muestra la politica y un mint testnet confirmado|runtime verificado hoy|Ver mint real|Live Demo Arena/);
});
