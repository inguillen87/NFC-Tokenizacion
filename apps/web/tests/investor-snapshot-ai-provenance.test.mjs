import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientSource = await readFile(
  new URL("../src/app/investor-snapshot/investor-snapshot-client.tsx", import.meta.url),
  "utf8",
);
const provenanceSource = await readFile(
  new URL("../src/app/investor-snapshot/investor-ai-provenance.ts", import.meta.url),
  "utf8",
);
const cognitiveRouteSource = await readFile(
  new URL("../src/app/api/cognitive-ai/route.ts", import.meta.url),
  "utf8",
);
const imageRouteSource = await readFile(
  new URL("../src/app/api/generate-label/route.ts", import.meta.url),
  "utf8",
);

test("investor AI declares live only from explicit provider provenance", () => {
  assert.match(provenanceSource, /payload\.fallback === false && provider && model/);
  assert.match(provenanceSource, /mode: "server-fallback"/);
  assert.match(provenanceSource, /provider_provenance_missing/);
  assert.match(provenanceSource, /TOKEN CONFIGURADO · SIN VERIFICAR/);
  assert.doesNotMatch(clientSource, /hfTokenInput \? "LLM LIVE CONECTADO"/);
});

test("chat and label results classify API fallback before rendering", () => {
  assert.equal(
    clientSource.match(/classifyInvestorAiResponse\(data\)/g)?.length,
    2,
    "both image and chat responses must classify provenance",
  );
  assert.match(provenanceSource, /Fallback determinístico · servidor/);
  assert.match(provenanceSource, /Fallback determinístico · navegador/);
  assert.match(clientSource, /shortInvestorAiProvenanceLabel\(msg\.provenance\)/);
  assert.match(clientSource, /shortInvestorAiProvenanceLabel\(item\.provenance\)/);
});

test("successful provider routes return the complete live contract", () => {
  for (const routeSource of [cognitiveRouteSource, imageRouteSource]) {
    assert.match(routeSource, /fallback: false/);
    assert.match(routeSource, /provider:/);
    assert.match(routeSource, /model:/);
    assert.match(routeSource, /fallback: true/);
  }
});
