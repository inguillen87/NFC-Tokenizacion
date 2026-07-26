import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const engineUrl = new URL("../src/lib/tokenization-engine.ts", import.meta.url);
const checkoutUrl = new URL("../src/app/marketplace/p2p/buy/route.ts", import.meta.url);

test("Polygon transfers fail closed and verify the resulting owner", async () => {
  const source = await readFile(engineUrl, "utf8");

  assert.match(source, /polygon_tokenization_record_not_found/);
  assert.match(source, /polygon_token_id_missing/);
  assert.match(source, /polygon_transfer_signer_unavailable/);
  assert.match(source, /polygon_exportable_signer_forbidden_in_production_use_executor/);
  assert.match(source, /isProductionRuntime\(\)/);
  assert.match(source, /const directPolygonMint = !productionRuntime && !external/);
  assert.match(source, /const localPolygonMint = !productionRuntime && !external/);
  assert.match(source, /polygon_signer_not_authorized/);
  assert.match(source, /receipt\.status !== 1/);
  assert.match(source, /polygon_transfer_event_mismatch/);
  assert.match(source, /ownerAfter !== destination/);
  assert.match(source, /state: "confirmed" as const/);
  assert.doesNotMatch(source, /Fallback to simulated for seamless demo experience/);

  const polygonCatch = source.slice(source.lastIndexOf("} catch (err)"));
  assert.doesNotMatch(polygonCatch, /ok: true/);
  assert.doesNotMatch(polygonCatch, /simulated: true/);
});

test("P2P checkout is fail-closed until a durable chain settlement coordinator exists", async () => {
  const source = await readFile(checkoutUrl, "utf8");

  assert.match(source, /p2p_settlement_unavailable/);
  assert.match(source, /feature_disabled/);
  assert.match(source, /chain_transfer_status: "not_executed"/);
  assert.match(source, /custody_unchanged: true/);
  assert.doesNotMatch(source, /transferBlockchainToken/);
  assert.doesNotMatch(source, /UPDATE consumer_product_ownerships|INSERT INTO consumer_product_ownerships/);
});
