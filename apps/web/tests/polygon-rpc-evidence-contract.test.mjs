import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proofSource = await readFile(new URL("../src/app/proof/verify/page.tsx", import.meta.url), "utf8");

const demoCasesTypeStart = proofSource.indexOf("type DemoCasesResponse = {");
const demoCasesTypeEnd = proofSource.indexOf("type DecodedProofField", demoCasesTypeStart);
assert.ok(demoCasesTypeStart >= 0 && demoCasesTypeEnd > demoCasesTypeStart, "DemoCasesResponse contract must exist");
const demoCasesType = proofSource.slice(demoCasesTypeStart, demoCasesTypeEnd);

function declaration(name) {
  const match = proofSource.match(new RegExp(`const ${name} = ([\\s\\S]*?);`));
  assert.ok(match, `missing ${name} declaration`);
  return match[1];
}

test("Polygon public readiness requires RPC verification, not demo_tx_hash", () => {
  assert.match(demoCasesType, /polygon\?:\s*\{[\s\S]{0,900}?rpc_verified\?:\s*boolean/);

  const polygonRpcExpression = declaration("polygonRpcVerified");
  assert.match(polygonRpcExpression, /demoCatalog\.testnet\?\.polygon\?\.rpc_verified\s*===\s*true/);
  assert.doesNotMatch(polygonRpcExpression, /demo_tx_hash|demo_token_id/);

  const liveTestnetExpression = declaration("liveTestnetReady");
  assert.match(liveTestnetExpression, /\bpolygonRpcVerified\b/);
  assert.doesNotMatch(liveTestnetExpression, /polygon\?\.demo_tx_hash|Boolean\([^)]*demo_tx_hash/);
});

test("Polygon ownership metric and mint confirmation copy require RPC verification", () => {
  const metricStart = proofSource.indexOf('label: "Polygon ownership"');
  const metricEnd = proofSource.indexOf("\n    },", metricStart);
  assert.ok(metricStart >= 0 && metricEnd > metricStart, "Polygon ownership metric must exist");
  const metric = proofSource.slice(metricStart, metricEnd);

  assert.match(metric, /value:\s*polygonRpcVerified\s*\?/);
  assert.match(metric, /live:\s*polygonRpcVerified\b/);
  assert.doesNotMatch(metric, /demo_tx_hash/);

  const panelStart = proofSource.indexOf('<article id="polygon-ownership"');
  const panelEnd = proofSource.indexOf('<article id="iota-proof"', panelStart);
  assert.ok(panelStart >= 0 && panelEnd > panelStart, "Polygon ownership panel must exist");
  const polygonPanel = proofSource.slice(panelStart, panelEnd);

  assert.match(polygonPanel, /polygonRpcVerified\s*\?[\s\S]{0,180}(?:RPC|confirm)/i);
  assert.match(polygonPanel, /polygonRpcVerified\s*\?[\s\S]{0,320}:[\s\S]{0,180}(?:pendiente|configurad|unverified)/i);
  assert.doesNotMatch(polygonPanel, /<dt[^>]*>Mint demo real<\/dt>/i);
});
