import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assertPolygonMintStateMatches } from "../src/lib/tokenization-engine.ts";

const expected = {
  expectedRecipient: "0x1111111111111111111111111111111111111111",
  expectedChipUidHash: `sha256:${"ab".repeat(32)}`,
  expectedTokenUri: "https://api.nexid.lat/public/polygon/assets/nx-proof",
  expectedAssetRef: "BATCH-2026:nx-proof",
};

const matchingState = {
  actualOwner: "0x1111111111111111111111111111111111111111",
  actualChipUidHash: expected.expectedChipUidHash,
  actualTokenUri: expected.expectedTokenUri,
  actualAssetRef: expected.expectedAssetRef,
};

function rejectsState(overrides, code) {
  assert.throws(
    () => assertPolygonMintStateMatches({ ...expected, ...matchingState, ...overrides }),
    (error) => {
      assert.equal(error?.message, code);
      assert.match(error?.message || "", /^polygon_anchor_[a-z0-9_]+$/);
      return true;
    },
  );
}

test("Polygon mint state accepts the exact intended recipient and product binding", () => {
  assert.doesNotThrow(() => assertPolygonMintStateMatches({ ...expected, ...matchingState }));
  assert.doesNotThrow(() => assertPolygonMintStateMatches({
    ...expected,
    ...matchingState,
    actualOwner: matchingState.actualOwner.toUpperCase().replace("0X", "0x"),
  }));
});

test("Polygon mint state fails closed on owner, chip hash, metadata URI, or asset reference drift", () => {
  rejectsState({ actualOwner: "0x2222222222222222222222222222222222222222" }, "polygon_anchor_owner_mismatch");
  rejectsState({ actualOwner: "not-an-address" }, "polygon_anchor_owner_invalid");
  rejectsState({ expectedRecipient: "not-an-address" }, "polygon_anchor_expected_recipient_invalid");
  rejectsState({ actualChipUidHash: `${expected.expectedChipUidHash}-altered` }, "polygon_anchor_chip_hash_mismatch");
  rejectsState({ actualTokenUri: `${expected.expectedTokenUri}?altered=1` }, "polygon_anchor_token_uri_mismatch");
  rejectsState({ actualAssetRef: `${expected.expectedAssetRef}-altered` }, "polygon_anchor_asset_ref_mismatch");
});

test("anchor verification reads every authoritative on-chain field and receives exact expectations", async () => {
  const source = await readFile(new URL("../src/lib/tokenization-engine.ts", import.meta.url), "utf8");
  const verifier = source.slice(source.indexOf("async function verifyPolygonMintEvidence"), source.indexOf("export async function anchorTokenizationRequest"));
  const anchor = source.slice(source.indexOf("export async function anchorTokenizationRequest"), source.indexOf("export async function transferBlockchainToken"));

  assert.match(verifier, /contract\.tokenByChipHash\(input\.chipUidHash\)/);
  assert.match(verifier, /contract\.ownerOf\(chainTokenId\)/);
  assert.match(verifier, /contract\.chipUidHashByTokenId\(chainTokenId\)/);
  assert.match(verifier, /contract\.tokenURI\(chainTokenId\)/);
  assert.match(verifier, /contract\.assetRefByTokenId\(chainTokenId\)/);
  assert.match(verifier, /receipt\.status !== 1/);
  assert.match(verifier, /polygon_anchor_contract_mismatch/);
  assert.match(verifier, /assertPolygonMintStateMatches/);

  assert.match(anchor, /externalInput\.issuer_wallet = expectedRecipient/);
  assert.match(anchor, /expectedRecipient,/);
  assert.match(anchor, /expectedTokenUri: tokenUri/);
  assert.match(anchor, /expectedAssetRef: assetRef/);
  assert.match(anchor, /safePolygonAnchorVerificationError/);
});
