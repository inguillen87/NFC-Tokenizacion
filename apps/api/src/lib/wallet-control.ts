import { createHash, randomBytes } from "node:crypto";
import { getAddress, isAddress, verifyMessage } from "ethers";

export const WALLET_CONTROL_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const WALLET_CONTROL_MAX_ATTEMPTS = 5;

export function normalizeWalletAddress(value: unknown) {
  const address = String(value || "").trim();
  if (!isAddress(address)) return null;
  return getAddress(address);
}

export function normalizeWalletChainId(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || (!/^0x[0-9a-f]+$/i.test(raw) && !/^\d{1,20}$/.test(raw))) return null;
  try {
    const chainId = BigInt(raw);
    if (chainId <= 0n || chainId > 9_223_372_036_854_775_807n) return null;
    return chainId.toString(10);
  } catch {
    return null;
  }
}

export function walletNetworkFromChainId(chainId: string) {
  if (chainId === "80002") return "polygon-amoy";
  if (chainId === "137") return "polygon-mainnet";
  if (chainId === "1") return "ethereum-mainnet";
  return `eip155:${chainId}`;
}

export function normalizeWalletProvider(value: unknown) {
  const provider = String(value || "wallet_evm").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  if (["metamask", "phantom", "rabby", "coinbase", "okx", "wallet_evm"].includes(provider)) return provider;
  return "wallet_evm";
}

export function createWalletControlNonce() {
  return randomBytes(18).toString("base64url");
}

export function walletControlAuditHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildWalletControlMessage(input: {
  domain: string;
  uri: string;
  address: string;
  chainId: string;
  nonce: string;
  requestId: string;
  issuedAt: string;
  expiresAt: string;
}) {
  return [
    `${input.domain} requests proof of wallet control for nexID.`,
    "",
    input.address,
    "",
    "Purpose: Link this wallet to a nexID Passport as proof of account control.",
    `URI: ${input.uri}`,
    "Version: 1",
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Request ID: ${input.requestId}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expiresAt}`,
    "",
    "This signature only links the wallet. It does not authorize a purchase, NFT transfer or blockchain transaction.",
  ].join("\n");
}

export function verifyWalletControlSignature(input: { message: string; signature: string; address: string }) {
  try {
    const recovered = getAddress(verifyMessage(input.message, input.signature));
    return recovered === getAddress(input.address);
  } catch {
    return false;
  }
}
