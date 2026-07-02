import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { JsonRpcProvider, Wallet, formatEther, hexlify, toUtf8Bytes } from "ethers";
import { buildPublicProofDemoCases } from "./public-proof-demo-fixtures.mjs";

const envPath = resolve(process.cwd(), ".env.local");

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

function envKeySuffix(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function main() {
  const env = readEnvFile();
  const rpcUrl = env.get("IOTA_EVM_RPC_URL") || "https://json-rpc.evm.testnet.iota.cafe";
  const explorerBaseUrl = env.get("IOTA_EXPLORER_BASE_URL") || "https://explorer.evm.testnet.iota.cafe";
  const privateKey = normalizePrivateKey(env.get("IOTA_EVM_PRIVATE_KEY"));
  const provider = new JsonRpcProvider(rpcUrl, 1076, { batchMaxCount: 1 });
  const wallet = new Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);
  if (balance === 0n) throw new Error(`iota_wallet_has_no_testnet_funds:${wallet.address}`);

  const updates = {
    IOTA_EVM_DEPLOYER_ADDRESS: wallet.address,
    IOTA_EXPLORER_BASE_URL: explorerBaseUrl,
  };
  const receipts = [];

  for (const demoCase of buildPublicProofDemoCases()) {
    const envKey = `PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH_${envKeySuffix(demoCase.id)}`;
    const existing = env.get(envKey);
    if (existing) {
      receipts.push({
        id: demoCase.id,
        skipped_existing_tx: existing,
        receipt_hash: demoCase.public_receipt.receipt_hash,
        explorer_url: `${explorerBaseUrl.replace(/\/$/, "")}/tx/${existing}`,
      });
      continue;
    }

    const memo = demoCase.public_receipt.on_chain_memo;
    if (Buffer.byteLength(memo, "utf8") > 512) {
      throw new Error(`public_receipt_memo_too_large:${demoCase.id}`);
    }
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0n,
      data: hexlify(toUtf8Bytes(memo)),
    });
    const receipt = await tx.wait();
    updates[envKey] = tx.hash;
    receipts.push({
      id: demoCase.id,
      tx_hash: tx.hash,
      receipt_hash: demoCase.public_receipt.receipt_hash,
      memo,
      memo_bytes: Buffer.byteLength(memo, "utf8"),
      block_number: receipt?.blockNumber || null,
      explorer_url: `${explorerBaseUrl.replace(/\/$/, "")}/tx/${tx.hash}`,
    });
  }

  updateEnv(updates);
  console.log(JSON.stringify({
    ok: true,
    wallet: wallet.address,
    balance_iota_before: formatEther(balance),
    receipts,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "publish_public_proof_receipts_iota_failed" }));
  process.exit(1);
});
