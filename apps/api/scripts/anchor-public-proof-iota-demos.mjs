import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Contract, JsonRpcProvider, Wallet, formatEther } from "ethers";
import { buildPublicProofDemoCases } from "./public-proof-demo-fixtures.mjs";

const envPath = resolve(process.cwd(), ".env.local");
const IOTA_ABI = [
  "function anchorRoot(bytes32 merkleRoot, string calldata tenantIdHash, string calldata resourceType, string calldata resourceId, uint256 eventCount) external",
];

function readEnvFile() {
  const values = new Map();
  if (!existsSync(envPath)) return values;
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
  throw new Error("invalid_IOTA_EVM_PRIVATE_KEY");
}

function stripShaPrefix(value) {
  return String(value || "").replace(/^sha256:/i, "").trim().toLowerCase();
}

function envKeySuffix(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function main() {
  const env = readEnvFile();
  const rpcUrl = env.get("IOTA_EVM_RPC_URL") || "https://json-rpc.evm.testnet.iota.cafe";
  const explorerBaseUrl = env.get("IOTA_EXPLORER_BASE_URL") || "https://explorer.evm.testnet.iota.cafe";
  const contractAddress = env.get("IOTA_EVM_ANCHOR_CONTRACT");
  const privateKey = normalizePrivateKey(env.get("IOTA_EVM_PRIVATE_KEY"));
  if (!contractAddress) throw new Error("missing_IOTA_EVM_ANCHOR_CONTRACT_run_contracts_deploy_iota_testnet_first");

  const provider = new JsonRpcProvider(rpcUrl, 1076, { batchMaxCount: 1 });
  const wallet = new Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);
  if (balance === 0n) throw new Error(`iota_wallet_has_no_testnet_funds:${wallet.address}:faucet:https://testnet.evm-bridge.iota.org`);

  const contract = new Contract(contractAddress, IOTA_ABI, wallet);
  const tenantIdHash = createHash("sha256").update("public-demo", "utf8").digest("hex");
  const updates = {
    IOTA_PROVIDER_MODE: "iota_evm_contract",
    IOTA_EVM_DEPLOYER_ADDRESS: wallet.address,
    IOTA_EXPLORER_BASE_URL: explorerBaseUrl,
  };
  const receipts = [];

  for (const demoCase of buildPublicProofDemoCases()) {
    const existing = env.get(`PUBLIC_PROOF_DEMO_IOTA_TX_HASH_${envKeySuffix(demoCase.id)}`);
    if (existing) {
      receipts.push({
        id: demoCase.id,
        skipped_existing_tx: existing,
        explorer_url: `${explorerBaseUrl.replace(/\/$/, "")}/tx/${existing}`,
      });
      continue;
    }

    const tx = await contract.anchorRoot(
      `0x${stripShaPrefix(demoCase.merkle_root)}`,
      tenantIdHash,
      demoCase.resource_type,
      demoCase.resource_id,
      demoCase.events.length,
    );
    const receipt = await tx.wait();
    updates[`PUBLIC_PROOF_DEMO_IOTA_TX_HASH_${envKeySuffix(demoCase.id)}`] = tx.hash;
    receipts.push({
      id: demoCase.id,
      tx_hash: tx.hash,
      merkle_root: demoCase.merkle_root,
      event_count: demoCase.events.length,
      block_number: receipt?.blockNumber || null,
      explorer_url: `${explorerBaseUrl.replace(/\/$/, "")}/tx/${tx.hash}`,
    });
  }

  updateEnv(updates);
  console.log(JSON.stringify({
    ok: true,
    contract: contractAddress,
    deployer: wallet.address,
    balance_iota_before: formatEther(balance),
    receipts,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "anchor_public_proof_iota_demos_failed" }));
  process.exit(1);
});
