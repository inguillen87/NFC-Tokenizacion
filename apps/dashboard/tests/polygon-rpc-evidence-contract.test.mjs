import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proofSource = await readFile(new URL("../src/app/(app)/proof/page.tsx", import.meta.url), "utf8");

function declaration(name) {
  const match = proofSource.match(new RegExp(`const ${name} = ([\\s\\S]*?);`));
  assert.ok(match, `missing ${name} declaration`);
  return match[1];
}

test("private ownership metrics require meta.evidence_verified", () => {
  const typeStart = proofSource.indexOf("type TokenizationRequest = {");
  const typeEnd = proofSource.indexOf("type PublicProofReceipt", typeStart);
  assert.ok(typeStart >= 0 && typeEnd > typeStart, "TokenizationRequest contract must exist");
  const tokenizationType = proofSource.slice(typeStart, typeEnd);
  assert.match(tokenizationType, /meta\?:\s*\{[\s\S]*?evidence_verified\?:\s*boolean[\s\S]*?\}(?:\s*\|\s*null)?/);

  const helperStart = proofSource.indexOf("function isOwnershipTransaction");
  const helperEnd = proofSource.indexOf("function isRealIotaReference", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "ownership metric filter must exist");
  const ownershipFilter = proofSource.slice(helperStart, helperEnd);

  assert.match(ownershipFilter, /row\.meta\?\.evidence_verified\s*===\s*true/);
  assert.match(ownershipFilter, /readText\(row\.tx_hash\)/);
  assert.match(ownershipFilter, /network\.includes\("polygon"\)\s*\|\|\s*network\.includes\("amoy"\)/);

  const metricStart = proofSource.indexOf('label: "Ownership tx"');
  const metricEnd = proofSource.indexOf("\n    },", metricStart);
  assert.ok(metricStart >= 0 && metricEnd > metricStart, "private ownership metric must exist");
  const metric = proofSource.slice(metricStart, metricEnd);
  assert.match(metric, /evidence_verified|evidencia verificada|RPC verificada/i);
  assert.doesNotMatch(metric, /Polygon con tx_hash/);
});

test("dashboard Polygon confirmation requires polygon.rpc_verified", () => {
  const typeStart = proofSource.indexOf("type PolygonTestnetReference = {");
  const typeEnd = proofSource.indexOf("type PublicProofPayload", typeStart);
  assert.ok(typeStart >= 0 && typeEnd > typeStart, "PolygonTestnetReference contract must exist");
  const polygonType = proofSource.slice(typeStart, typeEnd);
  assert.match(polygonType, /rpc_verified\?:\s*boolean/);

  const polygonRpcExpression = declaration("polygonRpcVerified");
  assert.match(polygonRpcExpression, /polygonReference\?\.rpc_verified\s*===\s*true/);
  assert.doesNotMatch(polygonRpcExpression, /demo_tx_hash|demo_token_id|polygonTxHref/);

  const summaryStart = proofSource.indexOf('<article data-network="polygon"');
  const summaryEnd = proofSource.indexOf("</article>", summaryStart);
  assert.ok(summaryStart >= 0 && summaryEnd > summaryStart, "Polygon testnet summary must exist");
  const polygonSummary = proofSource.slice(summaryStart, summaryEnd);
  const statusCopy = polygonSummary.match(/<p>\s*\{([\s\S]*?)\}\s*<\/p>/);
  assert.ok(statusCopy, "Polygon summary status copy must exist");
  assert.match(statusCopy[1].trim(), /^polygonRpcVerified\s*\?/);
  assert.match(statusCopy[1], /verificacion (?:RPC )?pendiente/i);
  assert.doesNotMatch(statusCopy[1], /polygonTxHref\s*\?\s*"Transaccion de ownership disponible"/);
});
