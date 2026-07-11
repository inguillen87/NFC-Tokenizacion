import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Contract, JsonRpcProvider, Wallet, formatEther, isAddress } from "ethers";

const envPath = resolve(process.cwd(), ".env.local");
const POLYGON_ABI = [
  "function mintWithChipHash(address to, string chipUidHash, string tokenUri, string assetRef) external returns (uint256)",
  "function tokenByChipHash(string chipUidHash) external view returns (uint256)",
  "function owner() view returns (address)",
  "function authorizedMinters(address) view returns (bool)",
];

function readEnvFile() {
  if (!existsSync(envPath)) return new Map();
  const values = new Map();
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2].trim().replace(/^['"]|['"]$/g, ""));
  }
  return values;
}

function upsertEnv(text, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, `${key}=${value}`);
  return `${text.replace(/\s*$/, "")}\n${key}=${value}\n`;
}

function updateEnv(updates) {
  let text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  for (const [key, value] of Object.entries(updates)) {
    if (value !== null && value !== undefined && value !== "") text = upsertEnv(text, key, String(value));
  }
  writeFileSync(envPath, text, "utf8");
}

function normalizePrivateKey(raw) {
  const value = String(raw || "").trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return `0x${value}`;
  throw new Error("invalid_POLYGON_MINTER_PRIVATE_KEY");
}

async function main() {
  const env = readEnvFile();
  const rpcUrl = env.get("POLYGON_RPC_URL") || "https://polygon-amoy.drpc.org";
  const contractAddress = env.get("POLYGON_CONTRACT_ADDRESS") || "0x673CAE3D79f825bba9cfb2096184c295A5C9Eb4C";
  const privateKey = normalizePrivateKey(env.get("POLYGON_MINTER_PRIVATE_KEY"));
  const recipient = env.get("POLYGON_DEFAULT_RECIPIENT") || "0x644c5D77a34182Db01257bC4C469B01850bc6B2d";
  const explorerBaseUrl = env.get("POLYGON_EXPLORER_BASE_URL") || "https://amoy.polygonscan.com";

  if (!isAddress(contractAddress)) throw new Error("invalid_POLYGON_CONTRACT_ADDRESS");
  if (!isAddress(recipient)) throw new Error("invalid_POLYGON_DEFAULT_RECIPIENT");

  const provider = new JsonRpcProvider(rpcUrl, 80002, { batchMaxCount: 1 });
  const wallet = new Wallet(privateKey, provider);
  const contract = new Contract(contractAddress, POLYGON_ABI, wallet);
  const [owner, isMinter, balance] = await Promise.all([
    contract.owner(),
    contract.authorizedMinters(wallet.address),
    provider.getBalance(wallet.address),
  ]);

  if (owner.toLowerCase() !== wallet.address.toLowerCase() && !isMinter) {
    throw new Error(`polygon_wallet_not_authorized:${wallet.address}`);
  }
  if (balance === 0n) throw new Error(`polygon_wallet_has_no_POL:${wallet.address}`);

  const certificateVersion = "v2";
  const metadataBaseUrl = (env.get("PUBLIC_POLYGON_METADATA_BASE_URL") || "https://api.nexid.lat/public/polygon/metadata").replace(/\/$/, "");
  const tokenUri = `${metadataBaseUrl}/ownership-${certificateVersion}`;
  const assetRef = `public-proof-demo:polygon-ownership-${certificateVersion}`;
  const issuanceRecord = JSON.stringify({
    schema: "nexid-platform-custody-issuance-v2",
    environment: "polygon-amoy-testnet",
    recipient: recipient.toLowerCase(),
    token_uri: tokenUri,
    asset_ref: assetRef,
    privacy: "hash-only",
  });
  const chipUidHash = `sha256:${createHash("sha256").update(issuanceRecord).digest("hex")}`;
  const existingTokenId = await contract.tokenByChipHash(chipUidHash);

  if (BigInt(String(existingTokenId || "0")) > 0n) {
    updateEnv({
      PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID: String(existingTokenId),
      POLYGON_CONTRACT_ADDRESS: contractAddress,
      POLYGON_MINTER_ADDRESS: wallet.address,
      POLYGON_DEFAULT_RECIPIENT: recipient,
      POLYGON_EXPLORER_BASE_URL: explorerBaseUrl,
    });
    console.log(JSON.stringify({
      ok: true,
      already_minted: true,
      contract: contractAddress,
      minter: wallet.address,
      balance_pol: formatEther(balance),
      token_id: String(existingTokenId),
      chip_uid_hash: chipUidHash,
      contract_explorer_url: `${explorerBaseUrl.replace(/\/$/, "")}/address/${contractAddress}`,
    }, null, 2));
    return;
  }

  const tx = await contract.mintWithChipHash(recipient, chipUidHash, tokenUri, assetRef);
  const receipt = await tx.wait();
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const transferLog = receipt.logs.find((log) => log.topics?.[0] === transferTopic && log.topics?.[3]);
  const tokenId = transferLog?.topics?.[3] ? String(BigInt(transferLog.topics[3])) : "";

  updateEnv({
    PUBLIC_PROOF_DEMO_POLYGON_TX_HASH: tx.hash,
    PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID: tokenId,
    POLYGON_CONTRACT_ADDRESS: contractAddress,
    POLYGON_MINTER_ADDRESS: wallet.address,
    POLYGON_DEFAULT_RECIPIENT: recipient,
    POLYGON_EXPLORER_BASE_URL: explorerBaseUrl,
  });

  console.log(JSON.stringify({
    ok: true,
    contract: contractAddress,
    minter: wallet.address,
    recipient,
    balance_pol_before: formatEther(balance),
    tx_hash: tx.hash,
    token_id: tokenId || null,
    chip_uid_hash: chipUidHash,
    token_uri: tokenUri,
    asset_ref: assetRef,
    explorer_url: `${explorerBaseUrl.replace(/\/$/, "")}/tx/${tx.hash}`,
    block_number: receipt?.blockNumber || null,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "mint_public_proof_polygon_demo_failed" }));
  process.exit(1);
});
