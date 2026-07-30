import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPolygonMintIntentDigest } from "../src/lib/polygon-mint-intent.ts";

const input = {
  requestId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  leaseId: "33333333-3333-4333-8333-333333333333",
  network: "polygon-amoy",
  executionClass: "testnet_trial",
  commercialDisposition: "NON_SELLABLE",
  issuerWallet: "0x1111111111111111111111111111111111111111",
  chipUidHash: `sha256:${"ab".repeat(32)}`,
  tokenUri: "https://api.nexid.test/tokenization/assets/nx-ab",
  assetRef: "BID-001:nx-ab",
};

test("Polygon mint intent digest binds the exact tenant lease custody tuple", () => {
  const canonical = [
    "nexid-polygon-mint-intent-v1",
    input.requestId,
    input.tenantId,
    input.leaseId,
    input.network,
    input.executionClass,
    input.commercialDisposition,
    input.issuerWallet,
    input.chipUidHash,
    input.tokenUri,
    input.assetRef,
  ];
  const expected = createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
  assert.equal(buildPolygonMintIntentDigest(input), expected);
  assert.notEqual(buildPolygonMintIntentDigest({ ...input, tenantId: "44444444-4444-4444-8444-444444444444" }), expected);
  assert.notEqual(buildPolygonMintIntentDigest({ ...input, issuerWallet: "0x2222222222222222222222222222222222222222" }), expected);
});

test("API persists a one-shot intent under the acquired lease before calling the executor", async () => {
  const source = await readFile(new URL("../src/lib/tokenization-engine.ts", import.meta.url), "utf8");
  const bind = source.indexOf("const intentRows = await sql");
  const dispatch = source.indexOf("runExternalExecutor(externalInput)", bind);
  assert.ok(bind >= 0 && dispatch > bind);
  assert.match(source.slice(bind, dispatch), /dispatch_intent_digest/);
  assert.match(source.slice(bind, dispatch), /AND status = 'processing'/);
  assert.match(source.slice(bind, dispatch), /AND lease_id = \$\{leaseId\}::uuid/);
  assert.match(source.slice(bind, dispatch), /AND lease_expires_at > now\(\)/);
});
