#!/usr/bin/env node
import { createHash } from "node:crypto";

const abi = [
  "function mintWithChipHash(address to, string chipUidHash, string tokenUri, string assetRef) external returns (uint256)",
];

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function required(name, value) {
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function hashUid(uidHex, salt = "") {
  const normalizedUid = String(uidHex || "").trim().toUpperCase();
  const normalizedSalt = String(salt || process.env.TOKENIZATION_UID_SALT || "").trim();
  return `sha256:${createHash("sha256").update(`${normalizedUid}:${normalizedSalt}`).digest("hex")}`;
}

async function main() {
  const rpcUrl = required("POLYGON_RPC_URL", process.env.POLYGON_RPC_URL || "");
  const privateKey = required("POLYGON_MINTER_PRIVATE_KEY", process.env.POLYGON_MINTER_PRIVATE_KEY || "");
  const contractAddress = required("POLYGON_CONTRACT_ADDRESS", process.env.POLYGON_CONTRACT_ADDRESS || "");

  const uidHex = getArg("uid");
  const chipUidHashInput = getArg("chip_uid_hash");
  const salt = getArg("uid_salt", process.env.TOKENIZATION_UID_SALT || "");
  const to = required("to", getArg("to", process.env.POLYGON_DEFAULT_RECIPIENT || ""));
  const tokenUri = required("token_uri", getArg("token_uri"));
  const assetRef = required("asset_ref", getArg("asset_ref"));
  const chipUidHash = chipUidHashInput || hashUid(required("uid_or_chip_uid_hash", uidHex), salt);

  let ethers;
  try {
    ({ ethers } = await import("ethers"));
  } catch {
    throw new Error("ethers_not_installed: run `npm install ethers` in apps/api runtime");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, abi, wallet);

  const tx = await contract.mintWithChipHash(to, chipUidHash, tokenUri, assetRef);
  const receipt = await tx.wait();
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const transferLog = receipt.logs.find((log) => log.topics[0] === transferTopic);
  const tokenId = transferLog ? String(BigInt(transferLog.topics[3])) : "";

  const output = {
    ok: true,
    network: "polygon",
    tx_hash: tx.hash,
    token_id: tokenId || null,
    chip_uid_hash: chipUidHash,
    block_number: receipt.blockNumber,
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "mint_failed" })}\n`);
  process.exit(1);
});
