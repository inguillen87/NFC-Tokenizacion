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

test("P2P checkout confirms the chain before one atomic ownership write", async () => {
  const source = await readFile(checkoutUrl, "utf8");
  const transferIndex = source.indexOf("const txResult = await transferBlockchainToken");
  const persistenceIndex = source.indexOf("WITH eligible_offer AS");

  assert.ok(transferIndex >= 0);
  assert.ok(persistenceIndex > transferIndex);
  assert.match(source, /if \(!txResult\.ok\)/);
  assert.match(source, /blockchain_transfer_not_confirmed/);
  assert.match(source, /simulationOnly \? 409 : 502/);
  assert.match(source, /blockchain_transfer_simulation_only/);
  assert.match(source, /revoked_ownership AS/);
  assert.match(source, /WITH eligible_offer AS/);
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /buyer_ownership AS/);
  assert.match(source, /completed_offer AS/);
  assert.match(source, /FROM completed_offer\s+RETURNING id/);
  assert.match(source, /reconciliationRequired/);
  assert.match(source, /custody_unchanged/);
  assert.match(source, /already_transferred/);
  assert.doesNotMatch(source, /0x742d35Cc6634C0532925a3b844Bc454e4438f44e/);
});
