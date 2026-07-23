import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Wallet, getAddress, verifyMessage } from "ethers";
import {
  PUBLIC_POLYGON_CHAIN_ID,
  PUBLIC_POLYGON_CONTRACT,
  buildPublicPolygonAssetMetadata,
  buildPublicPolygonMetadata,
  buildPublicPolygonWalletProofMessage,
  validatePublicPolygonMetadataDocument,
} from "../src/lib/public-polygon-ownership.ts";

test("Polygon ownership metadata is public, resolvable and explicit about testnet", () => {
  const metadata = buildPublicPolygonMetadata();

  assert.equal(PUBLIC_POLYGON_CHAIN_ID, 80002);
  assert.match(metadata.external_url, /^https:\/\/nexid\.lat\/proof\/ownership/);
  assert.match(metadata.image, /^https:\/\/nexid\.lat\//);
  assert.equal(metadata.properties.environment, "testnet");
  assert.equal(metadata.properties.schema_version, "nexid-ownership-certificate-v3");
  assert.match(metadata.properties.does_not_prove_alone, /does not authenticate the physical object/i);
  assert.match(metadata.description, /current owner/i);
  assert.doesNotMatch(metadata.description, /platform custody/i);
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

test("public wallet proof is deterministic, domain-bound and non-authorizing", async () => {
  const wallet = Wallet.createRandom();
  const input = {
    contractAddress: PUBLIC_POLYGON_CONTRACT,
    tokenId: "20",
    ownerAddress: wallet.address,
  };
  const first = buildPublicPolygonWalletProofMessage(input);
  const second = buildPublicPolygonWalletProofMessage(input);
  const signature = await wallet.signMessage(first);

  assert.equal(first, second);
  assert.match(first, /Polygon Amoy \(eip155:80002\)/);
  assert.match(first, /Token ID: 20/);
  assert.match(first, /Certificate: https:\/\/nexid\.lat\/proof\/ownership/);
  assert.match(first, /cannot authorize a transfer, login or purchase/i);
  assert.equal(getAddress(verifyMessage(first, signature)), getAddress(wallet.address));
});

test("generic Polygon asset metadata uses only the salted public asset id", () => {
  const metadata = buildPublicPolygonAssetMetadata("nx-0123456789abcdef01234567");

  assert.equal(metadata.properties.public_asset_id, "nx-0123456789abcdef01234567");
  assert.match(metadata.description, /salted product hash/i);
  assert.doesNotMatch(JSON.stringify(metadata), /uid_hex|buyer_email|private.?key/i);
});

test("public Polygon metadata is semantically bound to schema, testnet, chain and contract", () => {
  const metadata = buildPublicPolygonMetadata();
  const valid = validatePublicPolygonMetadataDocument(metadata, PUBLIC_POLYGON_CONTRACT);

  assert.equal(valid.ok, true);
  assert.equal(valid.reason, null);
  assert.equal(valid.schema_version, "nexid-ownership-certificate-v3");
  assert.equal(valid.chain_id, PUBLIC_POLYGON_CHAIN_ID);
  assert.equal(valid.contract, PUBLIC_POLYGON_CONTRACT);

  for (const [field, value, reason] of [
    ["schema_version", "nexid-ownership-certificate-v2", "metadata_schema_version_mismatch"],
    ["environment", "mainnet", "metadata_environment_mismatch"],
    ["chain_id", 137, "metadata_chain_id_mismatch"],
    ["contract", "0x0000000000000000000000000000000000000001", "metadata_contract_mismatch"],
  ]) {
    const candidate = structuredClone(metadata);
    candidate.properties[field] = value;
    const result = validatePublicPolygonMetadataDocument(candidate, PUBLIC_POLYGON_CONTRACT);
    assert.equal(result.ok, false, `${field} mismatch must fail closed`);
    assert.equal(result.reason, reason);
  }
});

test("public Polygon routes keep metadata and chain verification separate", async () => {
  const metadataRoute = await readFile(new URL("../src/app/public/polygon/metadata/[slug]/route.ts", import.meta.url), "utf8");
  const ownershipRoute = await readFile(new URL("../src/app/public/polygon/ownership/route.ts", import.meta.url), "utf8");
  const assetRoute = await readFile(new URL("../src/app/public/polygon/assets/[assetId]/route.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("../src/lib/public-polygon-ownership.ts", import.meta.url), "utf8");
  const verifier = await readFile(new URL("../scripts/verify-public-proof-polygon.mjs", import.meta.url), "utf8");
  const claimScript = await readFile(new URL("../scripts/claim-public-proof-polygon-demo.mjs", import.meta.url), "utf8");

  assert.match(metadataRoute, /buildPublicPolygonMetadata/);
  assert.match(ownershipRoute, /readPublicPolygonOwnershipCertificate/);
  assert.match(assetRoute, /invalid_public_polygon_asset_id/);
  assert.match(service, /ownerOf/);
  assert.match(service, /tokenURI/);
  assert.match(service, /getTransactionReceipt/);
  assert.match(service, /DigitalTwinMinted/);
  assert.match(service, /readMetadataDocument/);
  assert.match(service, /verifyMessage/);
  assert.match(service, /PUBLIC_PROOF_DEMO_POLYGON_CLAIM_TX_HASH/);
  assert.match(service, /PUBLIC_PROOF_DEMO_POLYGON_WALLET_SIGNATURE/);
  assert.match(service, /claimEventsMatch/);
  assert.match(service, /buyerControlVerified/);
  assert.match(service, /freshness: "archival_static_demo"/);
  assert.match(service, /log\.address\.toLowerCase\(\) !== contractAddress\.toLowerCase\(\)/);
  assert.match(service, /mintReceipt\.from\.toLowerCase\(\) === PUBLIC_POLYGON_OWNER\.toLowerCase\(\)/);
  assert.match(service, /claimReceipt\.from\.toLowerCase\(\) === PUBLIC_POLYGON_OWNER\.toLowerCase\(\)/);
  assert.match(service, /mintTransferEvent\.args\.from[\s\S]*ZeroAddress/);
  assert.match(service, /wallet_control_verified: buyerControlVerified/);
  assert.match(service, /sourcify\.dev\/server\/v2\/contract/);
  assert.match(service, /creationMatch/);
  assert.match(service, /runtimeMatch/);
  assert.match(service, /metadata_url_mismatch/);
  assert.match(service, /tokenUri !== expectedTokenUri/);
  assert.match(service, /validatePublicPolygonMetadataDocument/);
  assert.match(service, /metadata_contract_mismatch/);
  assert.match(service, /validated_https_document_not_content_addressed/);
  assert.match(service, /POLYGON_CERTIFICATE_CACHE_KEY/);
  assert.match(service, /5 \* 60_000/);
  assert.doesNotMatch(service, /knownSourcifyContract/);
  assert.doesNotMatch(service, /PUBLIC_PROOF_DEMO_POLYGON_SOURCE_VERIFIED/);
  assert.match(service, /does_not_prove_alone/);
  assert.doesNotMatch(service, /reason: error instanceof Error \? error\.message/);
  assert.doesNotMatch(service, /POLYGON_MINTER_PRIVATE_KEY/);
  assert.doesNotMatch(service, /PUBLIC_PROOF_DEMO_POLYGON_BUYER_PRIVATE_KEY/);
  assert.doesNotMatch(verifier, /readPublicPolygonOwnershipCertificate/);
  assert.match(verifier, /verifier: "independent-rpc-v1"/);
  assert.match(verifier, /log\.address/);
  assert.match(verifier, /unexpected_mint_transfer_count/);
  assert.match(verifier, /mint_transfer_origin_not_zero_address/);
  assert.match(verifier, /sourcify_creation_mismatch/);
  assert.match(verifier, /metadataValidation\.ok/);
  assert.match(verifier, /metadata_schema_version/);
  assert.match(claimScript, /claim_transfer_contract_mismatch/);
  assert.match(claimScript, /claim_transfer_submitter_mismatch/);
});

test("IOTA proof documentation describes the live V2 fixture without obsolete network claims", async () => {
  const docs = await readFile(new URL("../../../docs/iota-proof-layer.md", import.meta.url), "utf8");

  assert.match(docs, /IOTA EVM Testnet \(chain ID 1076\)/);
  assert.match(docs, /NexidEvidenceAnchor` V2/);
  assert.match(docs, /0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0/);
  assert.match(docs, /no afirma que IOTA sea gratis/i);
  assert.doesNotMatch(docs, /Feelless Transactions|Stardust framework/i);
});

test("proof layer runbook separates runtime writers from public read-only fixtures", async () => {
  const runbook = await readFile(new URL("../../../docs/proof-layer-runbook.md", import.meta.url), "utf8");

  assert.match(runbook, /IOTA_PROVIDER_MODE/);
  assert.match(runbook, /IOTA_EVM_ANCHOR_CONTRACT=/);
  assert.match(runbook, /adapter runtime actual invoca `anchorRoot/);
  assert.match(runbook, /IOTA_EVM_ANCHOR_CONTRACT_V2/);
  assert.match(runbook, /contrato V2 expone `anchorEvidence/);
  assert.match(runbook, /no habilita por si solo nuevas escrituras/i);
  assert.match(runbook, /mock.*prohibido.*NODE_ENV=production/is);
  assert.match(runbook, /polygon:verify-proof-demo/);
  assert.match(runbook, /iota:verify-proof-v2/);
  assert.match(runbook, /metadata semanticamente ligada a schema, entorno, chain ID y contrato/i);
  assert.match(runbook, /HTTPS no es content-addressed/i);
  assert.match(runbook, /PII, UID NFC crudo, secretos SUN\/KMS/i);
  assert.doesNotMatch(runbook, /IOTA (es|is) (gratis|free)/i);
});
