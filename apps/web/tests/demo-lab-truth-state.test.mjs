import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  canUseVerifiedDemoLanguage,
  isPositiveDemoVerdict,
  resolveDemoExecutionTruth,
  resolveDemoFeedTruth,
} from "../src/app/(public)/demo-lab/demo-lab-truth-state.ts";

test("Demo Lab never promotes a synthetic or off-chain receipt to verified evidence", () => {
  const synthetic = resolveDemoExecutionTruth({
    execution: "visual",
    source: "synthetic_sun",
    degraded: true,
    persisted: false,
    chainWrite: false,
  });
  const persistedOnly = resolveDemoExecutionTruth({
    execution: "persisted",
    source: "demo-scan-api",
    degraded: false,
    persisted: true,
    chainWrite: false,
  });
  const verified = resolveDemoExecutionTruth({
    execution: "persisted",
    source: "public-proof",
    degraded: false,
    persisted: true,
    chainWrite: true,
    evidenceVerified: true,
    evidenceUrl: "https://explorer.example/tx/0xabc",
  });
  const unprovenWrite = resolveDemoExecutionTruth({
    execution: "persisted",
    source: "demo-scan-api",
    degraded: false,
    persisted: true,
    chainWrite: true,
    evidenceVerified: false,
    evidenceUrl: null,
  });

  assert.equal(synthetic, "synthetic_preview");
  assert.equal(persistedOnly, "persisted_unverified");
  assert.equal(verified, "verified_evidence");
  assert.equal(unprovenWrite, "persisted_unverified");
  assert.equal(canUseVerifiedDemoLanguage(synthetic), false);
  assert.equal(canUseVerifiedDemoLanguage(persistedOnly), false);
  assert.equal(canUseVerifiedDemoLanguage(verified), true);
});

test("Demo Lab maps and CRM fail closed when a feed is empty, degraded or merely recorded", () => {
  assert.equal(resolveDemoFeedTruth(null), "unavailable");
  assert.equal(resolveDemoFeedTruth({ degraded: true, source: "visual-demo", events: [] }), "synthetic_preview");
  assert.equal(resolveDemoFeedTruth({
    degraded: true,
    source: "public-proof",
    events: [{}],
    evidenceVerified: true,
    evidenceUrl: "https://explorer.example/event/0xdegraded",
  }), "synthetic_preview");
  assert.equal(resolveDemoFeedTruth({ degraded: false, source: "public-proof", events: [] }), "unavailable");
  assert.equal(resolveDemoFeedTruth({ degraded: false, source: "internal-demo-sanitized", events: [{}] }), "recorded_events");
  assert.equal(resolveDemoFeedTruth({ degraded: false, source: "public-proof", events: [{}] }), "recorded_events");
  assert.equal(resolveDemoFeedTruth({
    degraded: false,
    source: "public-proof",
    events: [{}],
    evidenceVerified: true,
    evidenceUrl: "https://explorer.example/event/0xabc",
  }), "public_evidence");
});

test("Demo Lab positive verdict matching is exact and cannot authenticate negative lookalikes", () => {
  assert.equal(isPositiveDemoVerdict("AUTH_OK"), true);
  assert.equal(isPositiveDemoVerdict("RESULTADO VALIDO"), true);
  assert.equal(isPositiveDemoVerdict("INVALID"), false);
  assert.equal(isPositiveDemoVerdict("NOT_AUTH_OK"), false);
  assert.equal(isPositiveDemoVerdict("UNVERIFIED"), false);
});

test("Demo Lab UI gates verification language through the shared truth model", async () => {
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");

  assert.match(client, /resolveDemoExecutionTruth\(simulationReceipt\)/);
  assert.match(client, /resolveDemoFeedTruth\(summary\)/);
  assert.match(client, /setStatus\(demoFeedStatus\(next, locale, txt\.controls\.adminKey\)\)/);
  assert.match(client, /data-demo-truth-state=\{executionTruthState\}/);
  assert.match(client, /formatDemoEventResult\(event\.result, feedTruthState, locale\)/);
  assert.match(client, /canUseVerifiedDemoLanguage\(feedTruthState\) && isPositiveDemoVerdict\(event\.result\)/);
  assert.doesNotMatch(client, /SUN Signature OK/);
  assert.doesNotMatch(client, /Tap verificado/);
  assert.doesNotMatch(client, /Feed en vivo/);
  assert.doesNotMatch(client, /Mapa Operativo en Tiempo Real/);
  assert.doesNotMatch(client, /ÚLTIMOS TAPS EN VIVO/);
  assert.doesNotMatch(client, /Escaneo Autenticado/);
  assert.doesNotMatch(client, /next\.degraded \|\| next\.source === ["']public-proof["']/);
  assert.doesNotMatch(client, /Real public feed connected|Registro p.blico real conectado|Feed publico real conectado/);
});

test("guided post-tap copy never upgrades digital evidence into physical authenticity", async () => {
  const client = await readFile(new URL("../src/app/(public)/demo-lab/demo-lab-client.tsx", import.meta.url), "utf8");

  assert.match(client, /nexID clasifica la evidencia digital disponible/);
  assert.match(client, /no certifican el contenido fisico/);
  assert.match(client, /Mensaje NFC validado; el producto físico requiere evidencia adicional/);
  assert.doesNotMatch(client, /nexID resuelve si el producto es confiable/);
  assert.doesNotMatch(client, /Producto, UID y canal validados/);
  assert.doesNotMatch(client, /Compra confiable/);
});
