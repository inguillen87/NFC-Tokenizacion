import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPublicPolygonAssetMetadata, buildPublicPolygonMetadata, PUBLIC_POLYGON_CHAIN_ID } from "../src/lib/public-polygon-ownership.ts";

test("Polygon ownership metadata is public, resolvable and explicit about testnet", () => {
  const metadata = buildPublicPolygonMetadata();

  assert.equal(PUBLIC_POLYGON_CHAIN_ID, 80002);
  assert.match(metadata.external_url, /^https:\/\/nexid\.lat\/proof\/ownership/);
  assert.match(metadata.image, /^https:\/\/nexid\.lat\//);
  assert.equal(metadata.properties.environment, "testnet");
  assert.match(metadata.properties.does_not_prove_alone, /does not prove buyer wallet control/i);
  assert.match(metadata.description, /platform custody/i);
  assert.doesNotMatch(metadata.description, /approved product ownership claim/i);
  assert.deepEqual(metadata.properties.private_fields, [
    "raw NFC UID or secret",
    "buyer identity",
    "invoice",
    "warranty documents",
    "CRM segment",
  ]);
  assert.doesNotMatch(JSON.stringify(metadata), /private.?key|buyer@email|04A7\*\*\*\*1090/i);
});

test("generic Polygon asset metadata uses only the salted public asset id", () => {
  const metadata = buildPublicPolygonAssetMetadata("nx-0123456789abcdef01234567");

  assert.equal(metadata.properties.public_asset_id, "nx-0123456789abcdef01234567");
  assert.match(metadata.description, /salted product hash/i);
  assert.doesNotMatch(JSON.stringify(metadata), /uid_hex|buyer_email|private.?key/i);
});

test("public Polygon routes keep metadata and chain verification separate", async () => {
  const metadataRoute = await readFile(new URL("../src/app/public/polygon/metadata/[slug]/route.ts", import.meta.url), "utf8");
  const ownershipRoute = await readFile(new URL("../src/app/public/polygon/ownership/route.ts", import.meta.url), "utf8");
  const assetRoute = await readFile(new URL("../src/app/public/polygon/assets/[assetId]/route.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("../src/lib/public-polygon-ownership.ts", import.meta.url), "utf8");

  assert.match(metadataRoute, /buildPublicPolygonMetadata/);
  assert.match(ownershipRoute, /readPublicPolygonOwnershipCertificate/);
  assert.match(assetRoute, /invalid_public_polygon_asset_id/);
  assert.match(service, /ownerOf/);
  assert.match(service, /tokenURI/);
  assert.match(service, /getTransactionReceipt/);
  assert.match(service, /DigitalTwinMinted/);
  assert.match(service, /readMetadataDocument/);
  assert.match(service, /wallet_control_verified: false/);
  assert.match(service, /sourcify\.dev\/server\/v2\/contract/);
  assert.match(service, /creationMatch/);
  assert.match(service, /runtimeMatch/);
  assert.match(service, /metadata_url_mismatch/);
  assert.match(service, /tokenUri !== expectedTokenUri/);
  assert.match(service, /canonicalImage = "https:\/\/nexid\.lat\//);
  assert.match(service, /POLYGON_CERTIFICATE_CACHE_KEY/);
  assert.match(service, /5 \* 60_000/);
  assert.doesNotMatch(service, /knownSourcifyContract/);
  assert.doesNotMatch(service, /PUBLIC_PROOF_DEMO_POLYGON_SOURCE_VERIFIED/);
  assert.match(service, /does_not_prove_alone/);
  assert.doesNotMatch(service, /POLYGON_MINTER_PRIVATE_KEY/);
});
