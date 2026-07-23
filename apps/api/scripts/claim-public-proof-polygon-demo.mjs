import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatEther,
  getAddress,
  isAddress,
  parseEther,
  verifyMessage,
} from "ethers";
import {
  PUBLIC_POLYGON_CHAIN_ID,
  PUBLIC_POLYGON_CONTRACT,
  buildPublicPolygonWalletProofMessage,
} from "../src/lib/public-polygon-ownership.ts";

const envPath = resolve(process.cwd(), ".env.local");
const POLYGON_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];
const DEMO_BUYER_TARGET_BALANCE = parseEther("0.05");

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

function normalizePrivateKey(raw, label) {
  const value = String(raw || "").trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return `0x${value}`;
  throw new Error(`invalid_${label}`);
}

function findTransfer(contract, receipt, tokenId) {
  for (const log of receipt?.logs || []) {
    if (String(log.address).toLowerCase() !== String(contract.target).toLowerCase()) continue;
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "Transfer" && String(parsed.args.tokenId) === tokenId) return parsed;
    } catch {
      // Ignore malformed logs emitted by the expected contract.
    }
  }
  return null;
}

async function recoverExistingClaimTx(contract, provider, from, to, tokenId, mintTxHash) {
  const mintReceipt = mintTxHash ? await provider.getTransactionReceipt(mintTxHash) : null;
  const fromBlock = mintReceipt?.blockNumber || 0;
  const filter = contract.filters.Transfer(from, to, BigInt(tokenId));
  const events = await contract.queryFilter(filter, fromBlock, "latest");
  return events.at(-1)?.transactionHash || null;
}

async function main() {
  const env = readEnvFile();
  const rpcUrl = env.get("POLYGON_RPC_URL") || "https://polygon-amoy.drpc.org";
  const explorerBaseUrl = (env.get("POLYGON_EXPLORER_BASE_URL") || "https://amoy.polygonscan.com").replace(/\/$/, "");
  const contractAddress = env.get("POLYGON_CONTRACT_ADDRESS") || PUBLIC_POLYGON_CONTRACT;
  const tokenId = env.get("PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID");
  const mintTxHash = env.get("PUBLIC_PROOF_DEMO_POLYGON_TX_HASH");
  const platformPrivateKey = normalizePrivateKey(env.get("POLYGON_MINTER_PRIVATE_KEY"), "POLYGON_MINTER_PRIVATE_KEY");

  if (!isAddress(contractAddress)) throw new Error("invalid_POLYGON_CONTRACT_ADDRESS");
  if (!/^\d+$/.test(String(tokenId || ""))) throw new Error("invalid_PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID");

  let buyerPrivateKey = env.get("PUBLIC_PROOF_DEMO_POLYGON_BUYER_PRIVATE_KEY");
  if (!buyerPrivateKey) buyerPrivateKey = Wallet.createRandom().privateKey;
  buyerPrivateKey = normalizePrivateKey(buyerPrivateKey, "PUBLIC_PROOF_DEMO_POLYGON_BUYER_PRIVATE_KEY");

  const provider = new JsonRpcProvider(rpcUrl, PUBLIC_POLYGON_CHAIN_ID, { batchMaxCount: 1 });
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== PUBLIC_POLYGON_CHAIN_ID) throw new Error(`unexpected_chain_id:${network.chainId}`);

  const platformWallet = new Wallet(platformPrivateKey, provider);
  const buyerWallet = new Wallet(buyerPrivateKey, provider);
  const buyerAddress = getAddress(buyerWallet.address);
  const configuredBuyer = env.get("PUBLIC_PROOF_DEMO_POLYGON_BUYER_ADDRESS");
  if (configuredBuyer && (!isAddress(configuredBuyer) || getAddress(configuredBuyer) !== buyerAddress)) {
    throw new Error("configured_buyer_does_not_match_local_demo_key");
  }

  // Persist the generated demo key before broadcasting. The file is gitignored and never uploaded to Vercel.
  updateEnv({
    PUBLIC_PROOF_DEMO_POLYGON_BUYER_PRIVATE_KEY: buyerPrivateKey,
    PUBLIC_PROOF_DEMO_POLYGON_BUYER_ADDRESS: buyerAddress,
  });

  const contract = new Contract(contractAddress, POLYGON_ABI, platformWallet);
  const ownerBefore = getAddress(await contract.ownerOf(tokenId));
  let claimTxHash = env.get("PUBLIC_PROOF_DEMO_POLYGON_CLAIM_TX_HASH") || null;
  let claimReceipt = claimTxHash ? await provider.getTransactionReceipt(claimTxHash) : null;

  if (ownerBefore === getAddress(platformWallet.address)) {
    const transfer = await contract["safeTransferFrom(address,address,uint256)"](
      platformWallet.address,
      buyerAddress,
      BigInt(tokenId),
    );
    claimReceipt = await transfer.wait();
    claimTxHash = transfer.hash;
    updateEnv({ PUBLIC_PROOF_DEMO_POLYGON_CLAIM_TX_HASH: claimTxHash });
  } else if (ownerBefore === buyerAddress) {
    if (!claimTxHash) {
      claimTxHash = await recoverExistingClaimTx(
        contract,
        provider,
        platformWallet.address,
        buyerAddress,
        tokenId,
        mintTxHash,
      );
      if (claimTxHash) {
        claimReceipt = await provider.getTransactionReceipt(claimTxHash);
        updateEnv({ PUBLIC_PROOF_DEMO_POLYGON_CLAIM_TX_HASH: claimTxHash });
      }
    }
  } else {
    throw new Error(`token_owned_by_unexpected_wallet:${ownerBefore}`);
  }

  if (!claimTxHash || !claimReceipt || claimReceipt.status !== 1) throw new Error("claim_transfer_receipt_not_confirmed");
  if (String(claimReceipt.to).toLowerCase() !== contractAddress.toLowerCase()) throw new Error("claim_transfer_contract_mismatch");
  if (String(claimReceipt.from).toLowerCase() !== platformWallet.address.toLowerCase()) throw new Error("claim_transfer_submitter_mismatch");
  const transferEvent = findTransfer(contract, claimReceipt, tokenId);
  if (!transferEvent) throw new Error("claim_transfer_event_missing");
  if (getAddress(transferEvent.args.from) !== getAddress(platformWallet.address)) throw new Error("claim_transfer_sender_mismatch");
  if (getAddress(transferEvent.args.to) !== buyerAddress) throw new Error("claim_transfer_recipient_mismatch");

  const ownerAfter = getAddress(await contract.ownerOf(tokenId));
  if (ownerAfter !== buyerAddress) throw new Error("ownerOf_does_not_match_demo_buyer");

  const buyerBalanceBefore = await provider.getBalance(buyerAddress);
  let fundingTxHash = null;
  if (buyerBalanceBefore < DEMO_BUYER_TARGET_BALANCE) {
    const fundingTx = await platformWallet.sendTransaction({
      to: buyerAddress,
      value: DEMO_BUYER_TARGET_BALANCE - buyerBalanceBefore,
    });
    await fundingTx.wait();
    fundingTxHash = fundingTx.hash;
  }

  const walletProofMessage = buildPublicPolygonWalletProofMessage({
    contractAddress,
    tokenId,
    ownerAddress: buyerAddress,
  });
  const walletSignature = await buyerWallet.signMessage(walletProofMessage);
  const recoveredAddress = getAddress(verifyMessage(walletProofMessage, walletSignature));
  if (recoveredAddress !== buyerAddress) throw new Error("wallet_control_signature_verification_failed");

  updateEnv({
    PUBLIC_PROOF_DEMO_POLYGON_BUYER_ADDRESS: buyerAddress,
    PUBLIC_PROOF_DEMO_POLYGON_WALLET_SIGNATURE: walletSignature,
    PUBLIC_PROOF_DEMO_POLYGON_CLAIM_TX_HASH: claimTxHash,
    PUBLIC_PROOF_DEMO_POLYGON_BUYER_FUNDING_TX_HASH: fundingTxHash,
  });

  const [buyerBalance, platformBalance, latestBlock] = await Promise.all([
    provider.getBalance(buyerAddress),
    provider.getBalance(platformWallet.address),
    provider.getBlockNumber(),
  ]);

  console.log(JSON.stringify({
    ok: true,
    environment: "polygon-amoy-testnet",
    chain_id: PUBLIC_POLYGON_CHAIN_ID,
    contract: getAddress(contractAddress),
    token_id: tokenId,
    owner_before: ownerBefore,
    owner_after: ownerAfter,
    wallet_control_verified: true,
    claim_tx_hash: claimTxHash,
    claim_confirmations: Math.max(0, latestBlock - claimReceipt.blockNumber + 1),
    claim_explorer_url: `${explorerBaseUrl}/tx/${claimTxHash}`,
    funding_tx_hash: fundingTxHash,
    buyer_balance_pol: formatEther(buyerBalance),
    platform_balance_pol: formatEther(platformBalance),
  }, null, 2));

  provider.destroy();
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    reason: error instanceof Error ? error.message : "claim_public_proof_polygon_demo_failed",
  }));
  process.exit(1);
});
