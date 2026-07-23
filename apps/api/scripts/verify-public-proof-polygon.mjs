import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Contract,
  JsonRpcProvider,
  ZeroAddress,
  getAddress,
  isAddress,
  verifyMessage,
} from "ethers";
import {
  PUBLIC_POLYGON_CHAIN_ID,
  PUBLIC_POLYGON_CONTRACT,
  PUBLIC_POLYGON_OWNER,
  buildPublicPolygonWalletProofMessage,
  validatePublicPolygonMetadataDocument,
} from "../src/lib/public-polygon-ownership.ts";

const envPath = resolve(process.cwd(), ".env.local");
const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const POLYGON_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function chipUidHashByTokenId(uint256 tokenId) view returns (string)",
  "function assetRefByTokenId(uint256 tokenId) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event DigitalTwinMinted(uint256 indexed tokenId, address indexed to, string chipUidHash, string assetRef, string tokenUri)",
];
const SAFE_ENV_KEYS = new Set([
  "POLYGON_RPC_URL",
  "POLYGON_CONTRACT_ADDRESS",
  "POLYGON_EXPLORER_BASE_URL",
  "PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID",
  "PUBLIC_PROOF_DEMO_POLYGON_TX_HASH",
  "PUBLIC_PROOF_DEMO_POLYGON_CLAIM_TX_HASH",
  "PUBLIC_PROOF_DEMO_POLYGON_BUYER_ADDRESS",
  "PUBLIC_PROOF_DEMO_POLYGON_WALLET_SIGNATURE",
]);

function loadPublicEnvironment() {
  if (!existsSync(envPath)) throw new Error("missing_apps_api_env_local");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || !SAFE_ENV_KEYS.has(match[1])) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function clean(value) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function assert(condition, reason) {
  if (!condition) throw new Error(reason);
}

function matchingEvents(receipt, contractAddress, contract, eventName, tokenId) {
  return (receipt?.logs || []).flatMap((log) => {
    if (String(log.address).toLowerCase() !== contractAddress.toLowerCase()) return [];
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      return parsed?.name === eventName && String(parsed.args.tokenId) === tokenId ? [parsed] : [];
    } catch {
      return [];
    }
  });
}

function isSourcifyMatch(value) {
  return ["match", "exact_match"].includes(clean(value).toLowerCase());
}

function safeFailureReason(error) {
  const message = error instanceof Error ? error.message : "";
  return /^[a-z0-9_:.-]{1,160}$/i.test(message)
    ? message
    : "polygon_verifier_rpc_or_chain_failure";
}

async function main() {
  loadPublicEnvironment();
  const rpcUrl = clean(process.env.POLYGON_RPC_URL) || "https://polygon-amoy.drpc.org";
  const contractAddressRaw = clean(process.env.POLYGON_CONTRACT_ADDRESS) || PUBLIC_POLYGON_CONTRACT;
  const tokenId = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID);
  const mintTxHash = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TX_HASH);
  const claimTxHash = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_CLAIM_TX_HASH);
  const buyerAddressRaw = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_BUYER_ADDRESS);
  const walletSignature = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_WALLET_SIGNATURE);

  assert(isAddress(contractAddressRaw), "invalid_polygon_contract_address");
  assert(/^\d+$/.test(tokenId), "invalid_polygon_token_id");
  assert(TX_HASH_PATTERN.test(mintTxHash), "invalid_polygon_mint_tx_hash");
  assert(TX_HASH_PATTERN.test(claimTxHash), "invalid_polygon_claim_tx_hash");
  assert(isAddress(buyerAddressRaw), "invalid_polygon_buyer_address");
  assert(/^0x[0-9a-fA-F]{130}$/.test(walletSignature), "invalid_polygon_wallet_signature");

  const contractAddress = getAddress(contractAddressRaw);
  const buyerAddress = getAddress(buyerAddressRaw);
  const platformAddress = getAddress(PUBLIC_POLYGON_OWNER);
  const provider = new JsonRpcProvider(rpcUrl, PUBLIC_POLYGON_CHAIN_ID, { batchMaxCount: 1 });
  const contract = new Contract(contractAddress, POLYGON_ABI, provider);

  try {
    const [network, code, owner, tokenUri, chipUidHash, assetRef, mintReceipt, claimReceipt] = await Promise.all([
      provider.getNetwork(),
      provider.getCode(contractAddress),
      contract.ownerOf(tokenId),
      contract.tokenURI(tokenId),
      contract.chipUidHashByTokenId(tokenId),
      contract.assetRefByTokenId(tokenId),
      provider.getTransactionReceipt(mintTxHash),
      provider.getTransactionReceipt(claimTxHash),
    ]);

    assert(Number(network.chainId) === PUBLIC_POLYGON_CHAIN_ID, `unexpected_chain_id:${network.chainId}`);
    assert(code !== "0x", "polygon_contract_not_deployed");
    assert(mintReceipt?.status === 1, "mint_receipt_not_confirmed");
    assert(getAddress(mintReceipt.to) === contractAddress, "mint_receipt_contract_mismatch");
    assert(getAddress(mintReceipt.from) === platformAddress, "mint_receipt_submitter_mismatch");
    assert(claimReceipt?.status === 1, "claim_receipt_not_confirmed");
    assert(getAddress(claimReceipt.to) === contractAddress, "claim_receipt_contract_mismatch");
    assert(getAddress(claimReceipt.from) === platformAddress, "claim_receipt_submitter_mismatch");

    const mintTransfers = matchingEvents(mintReceipt, contractAddress, contract, "Transfer", tokenId);
    const mintedEvents = matchingEvents(mintReceipt, contractAddress, contract, "DigitalTwinMinted", tokenId);
    const claimTransfers = matchingEvents(claimReceipt, contractAddress, contract, "Transfer", tokenId);
    assert(mintTransfers.length === 1, `unexpected_mint_transfer_count:${mintTransfers.length}`);
    assert(mintedEvents.length === 1, `unexpected_digital_twin_mint_count:${mintedEvents.length}`);
    assert(claimTransfers.length === 1, `unexpected_claim_transfer_count:${claimTransfers.length}`);

    const mintTransfer = mintTransfers[0];
    const mintedEvent = mintedEvents[0];
    const claimTransfer = claimTransfers[0];
    assert(getAddress(mintTransfer.args.from) === ZeroAddress, "mint_transfer_origin_not_zero_address");
    assert(getAddress(mintTransfer.args.to) === platformAddress, "mint_transfer_recipient_mismatch");
    assert(getAddress(mintedEvent.args.to) === platformAddress, "digital_twin_mint_recipient_mismatch");
    assert(String(mintedEvent.args.chipUidHash) === String(chipUidHash), "mint_chip_uid_hash_mismatch");
    assert(String(mintedEvent.args.assetRef) === String(assetRef), "mint_asset_ref_mismatch");
    assert(String(mintedEvent.args.tokenUri) === String(tokenUri), "mint_token_uri_mismatch");
    assert(getAddress(claimTransfer.args.from) === platformAddress, "claim_transfer_sender_mismatch");
    assert(getAddress(claimTransfer.args.to) === buyerAddress, "claim_transfer_recipient_mismatch");
    assert(getAddress(owner) === buyerAddress, "owner_of_does_not_match_buyer");

    const walletProofMessage = buildPublicPolygonWalletProofMessage({ contractAddress, tokenId, ownerAddress: buyerAddress });
    const recoveredSigner = getAddress(verifyMessage(walletProofMessage, walletSignature));
    assert(recoveredSigner === buyerAddress, "wallet_control_signature_mismatch");

    assert(String(tokenUri).startsWith("https://"), "metadata_uri_not_https");
    const metadataResponse = await fetch(String(tokenUri), { signal: AbortSignal.timeout(6_000) });
    assert(metadataResponse.ok, `metadata_http_${metadataResponse.status}`);
    assert(clean(metadataResponse.headers.get("content-type")).toLowerCase().includes("json"), "metadata_content_type_not_json");
    const metadata = await metadataResponse.json();
    const metadataValidation = validatePublicPolygonMetadataDocument(metadata, contractAddress);
    assert(metadataValidation.ok, metadataValidation.reason || "metadata_semantic_validation_failed");
    const imageResponse = await fetch(metadata.image, { method: "HEAD", signal: AbortSignal.timeout(6_000) });
    assert(imageResponse.ok, `metadata_image_http_${imageResponse.status}`);

    const sourcifyUrl = `https://sourcify.dev/server/v2/contract/${PUBLIC_POLYGON_CHAIN_ID}/${contractAddress}`;
    const sourcifyResponse = await fetch(sourcifyUrl, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(6_000) });
    assert(sourcifyResponse.ok, `sourcify_http_${sourcifyResponse.status}`);
    const source = await sourcifyResponse.json();
    assert(clean(source?.address).toLowerCase() === contractAddress.toLowerCase(), "sourcify_address_mismatch");
    assert(Number(source?.chainId) === PUBLIC_POLYGON_CHAIN_ID, "sourcify_chain_mismatch");
    assert(isSourcifyMatch(source?.match), "sourcify_overall_mismatch");
    assert(isSourcifyMatch(source?.creationMatch), "sourcify_creation_mismatch");
    assert(isSourcifyMatch(source?.runtimeMatch), "sourcify_runtime_mismatch");

    console.log(JSON.stringify({
      ok: true,
      verifier: "independent-rpc-v1",
      network: "polygon-amoy",
      chain_id: Number(network.chainId),
      contract: contractAddress,
      token_id: tokenId,
      current_owner: buyerAddress,
      mint_tx_hash: mintTxHash,
      claim_tx_hash: claimTxHash,
      wallet_proof_method: "EIP-191",
      recovered_signer: recoveredSigner,
      wallet_control_verified: true,
      metadata_verified: true,
      metadata_schema_version: metadataValidation.schema_version,
      metadata_contract: metadataValidation.contract,
      source_verified: true,
    }, null, 2));
  } finally {
    provider.destroy();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: safeFailureReason(error) }));
  process.exit(1);
});
