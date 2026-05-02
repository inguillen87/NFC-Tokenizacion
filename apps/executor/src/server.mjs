#!/usr/bin/env node
import http from "node:http";
import { createHash } from "node:crypto";
import { Contract, JsonRpcProvider, Wallet, formatEther, isAddress } from "ethers";

const abi = [
  "function mintWithChipHash(address to, string chipUidHash, string tokenUri, string assetRef) external returns (uint256)",
];

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += String(chunk);
      if (raw.length > 128 * 1024) {
        reject(new Error("payload_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function authOk(req) {
  const expected = env("TOKENIZATION_EXECUTOR_SECRET");
  if (!expected) return false;
  const headerSecret = String(req.headers["x-tokenization-secret"] || "");
  const auth = String(req.headers.authorization || "");
  return headerSecret === expected || auth === `Bearer ${expected}`;
}

function required(name, value) {
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function hashUid(uidHex, salt = "") {
  const normalizedUid = String(uidHex || "").trim().toUpperCase();
  const normalizedSalt = String(salt || env("TOKENIZATION_UID_SALT")).trim();
  return `sha256:${createHash("sha256").update(`${normalizedUid}:${normalizedSalt}`).digest("hex")}`;
}

function deriveTokenId(receipt) {
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const transferLog = receipt.logs.find((log) => log.topics?.[0] === transferTopic && log.topics?.[3]);
  return transferLog ? String(BigInt(transferLog.topics[3])) : null;
}

async function health() {
  const signerMode = env("EXECUTOR_SIGNER_MODE", "private_key").toLowerCase();
  const rpcUrl = env("POLYGON_RPC_URL");
  const contractAddress = env("POLYGON_CONTRACT_ADDRESS");
  const defaultRecipient = env("POLYGON_DEFAULT_RECIPIENT");
  const privateKey = env("POLYGON_MINTER_PRIVATE_KEY");
  const live = env("EXECUTOR_HEALTH_LIVE", "false").toLowerCase() === "true";

  let minterAddress = null;
  let minterBalancePol = null;
  let chainId = null;
  let contractDeployed = null;

  try {
    if (privateKey) minterAddress = new Wallet(privateKey).address;
  } catch {
    minterAddress = null;
  }

  if (live && rpcUrl) {
    const provider = new JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    chainId = String(network.chainId);
    if (minterAddress) {
      minterBalancePol = Number(formatEther(await provider.getBalance(minterAddress)));
    }
    if (isAddress(contractAddress)) {
      const code = await provider.getCode(contractAddress);
      contractDeployed = Boolean(code && code !== "0x");
    }
  }

  return {
    ok: true,
    service: "nexid-tokenization-executor",
    signerMode,
    network: "polygon-amoy",
    rpcConfigured: Boolean(rpcUrl),
    contract: { address: contractAddress || null, deployed: contractDeployed },
    minter: { address: minterAddress, configured: Boolean(privateKey), balancePol: minterBalancePol },
    defaultRecipient: defaultRecipient || null,
    kmsReady: signerMode === "kms",
    note: signerMode === "kms" ? "KMS adapter must be wired by provider-specific signer." : "Private-key executor is for Amoy pilot only.",
  };
}

async function mint(body) {
  const signerMode = env("EXECUTOR_SIGNER_MODE", "private_key").toLowerCase();
  if (signerMode !== "private_key") {
    throw new Error("executor_signer_mode_not_available_for_mint");
  }

  const rpcUrl = required("POLYGON_RPC_URL", env("POLYGON_RPC_URL"));
  const privateKey = required("POLYGON_MINTER_PRIVATE_KEY", env("POLYGON_MINTER_PRIVATE_KEY"));
  const contractAddress = required("POLYGON_CONTRACT_ADDRESS", env("POLYGON_CONTRACT_ADDRESS"));
  const uidHex = String(body.uid_hex || "").trim();
  const chipUidHash = String(body.chip_uid_hash || (uidHex ? hashUid(uidHex) : ""));
  const tokenUri = required("token_uri", body.token_uri);
  const recipient = required("recipient", body.issuer_wallet || env("POLYGON_DEFAULT_RECIPIENT"));
  const publicAssetId = String(body.public_asset_id || `nx-${chipUidHash.split(":").pop()?.slice(0, 24) || "asset"}`);
  const assetRef = String(body.asset_ref || `${body.bid || "nexid"}:${publicAssetId}`);
  required("chip_uid_hash", chipUidHash);

  if (!isAddress(contractAddress)) throw new Error("invalid_POLYGON_CONTRACT_ADDRESS");
  if (!isAddress(recipient)) throw new Error("invalid_recipient");

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const contract = new Contract(contractAddress, abi, wallet);
  const tx = await contract.mintWithChipHash(recipient, chipUidHash, tokenUri, assetRef);
  const receipt = await tx.wait();

  return {
    ok: true,
    network: "polygon-amoy",
    tx_hash: tx.hash,
    token_id: deriveTokenId(receipt),
    chip_uid_hash: chipUidHash,
    block_number: receipt.blockNumber,
    external_ref: `amoy:${contractAddress}:${tx.hash}`,
    request_id: body.request_id || null,
  };
}

async function handler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  try {
    if (req.method === "GET" && ["/", "/health"].includes(url.pathname)) {
      return json(res, 200, await health());
    }
    if (req.method === "POST" && ["/", "/mint", "/tokenize"].includes(url.pathname)) {
      if (!authOk(req)) return json(res, 401, { ok: false, reason: "unauthorized_executor" });
      const body = await readJson(req);
      return json(res, 200, await mint(body));
    }
    return json(res, 404, { ok: false, reason: "not_found" });
  } catch (error) {
    return json(res, 400, { ok: false, reason: error instanceof Error ? error.message : "executor_failed" });
  }
}

const port = Number(env("PORT", "3010"));
const server = http.createServer((req, res) => {
  void handler(req, res);
});

server.listen(port, () => {
  console.log(JSON.stringify({ ok: true, service: "nexid-tokenization-executor", port }));
});
