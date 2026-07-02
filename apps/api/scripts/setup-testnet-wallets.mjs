import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { JsonRpcProvider, Wallet, isAddress } from "ethers";

const envPath = resolve(process.cwd(), ".env.local");
const IOTA_RPC_URL = "https://json-rpc.evm.testnet.iota.cafe";
const IOTA_EXPLORER_BASE_URL = "https://explorer.evm.testnet.iota.cafe";
const POLYGON_AMOY_RPC_URL = "https://polygon-amoy.drpc.org";

function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

function cleanEnvValue(value) {
  const text = String(value || "").trim();
  if (!text || text === "\"\"" || text === "''") return "";
  return text.replace(/^['"]|['"]$/g, "").trim();
}

function upsertEnv(text, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, `${key}=${value}`);
  return `${text.replace(/\s*$/, "")}\n${key}=${value}\n`;
}

function ensureHexPrivateKey(value) {
  const normalized = cleanEnvValue(value);
  return /^0x[0-9a-fA-F]{64}$/.test(normalized) ? normalized : "";
}

async function balanceOf(rpcUrl, address) {
  const provider = new JsonRpcProvider(rpcUrl);
  const [network, balance] = await Promise.all([
    provider.getNetwork(),
    provider.getBalance(address),
  ]);
  return {
    chainId: network.chainId.toString(),
    wei: balance.toString(),
    native: Number(balance) / 1e18,
  };
}

async function main() {
  const existingText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const values = parseEnv(existingText);
  let nextText = existingText;

  let iotaPrivateKey = ensureHexPrivateKey(values.get("IOTA_EVM_PRIVATE_KEY"));
  let createdIotaWallet = false;
  if (!iotaPrivateKey) {
    const wallet = Wallet.createRandom();
    iotaPrivateKey = wallet.privateKey;
    nextText = upsertEnv(nextText, "IOTA_EVM_PRIVATE_KEY", iotaPrivateKey);
    createdIotaWallet = true;
  }
  const iotaWallet = new Wallet(iotaPrivateKey);

  nextText = upsertEnv(nextText, "IOTA_EVM_RPC_URL", cleanEnvValue(values.get("IOTA_EVM_RPC_URL")) || IOTA_RPC_URL);
  nextText = upsertEnv(nextText, "IOTA_EXPLORER_BASE_URL", cleanEnvValue(values.get("IOTA_EXPLORER_BASE_URL")) || IOTA_EXPLORER_BASE_URL);
  nextText = upsertEnv(nextText, "IOTA_PROVIDER_MODE", cleanEnvValue(values.get("IOTA_PROVIDER_MODE")) || "disabled");
  nextText = upsertEnv(nextText, "IOTA_EVM_DEPLOYER_ADDRESS", iotaWallet.address);

  let polygonPrivateKey = ensureHexPrivateKey(values.get("POLYGON_MINTER_PRIVATE_KEY"));
  let createdPolygonWallet = false;
  if (!polygonPrivateKey) {
    const wallet = Wallet.createRandom();
    polygonPrivateKey = wallet.privateKey;
    nextText = upsertEnv(nextText, "POLYGON_MINTER_PRIVATE_KEY", polygonPrivateKey);
    createdPolygonWallet = true;
  }
  const polygonWallet = polygonPrivateKey ? new Wallet(polygonPrivateKey) : null;
  if (!cleanEnvValue(values.get("POLYGON_RPC_URL"))) nextText = upsertEnv(nextText, "POLYGON_RPC_URL", POLYGON_AMOY_RPC_URL);
  if (polygonWallet && !isAddress(cleanEnvValue(values.get("POLYGON_MINTER_ADDRESS")))) {
    nextText = upsertEnv(nextText, "POLYGON_MINTER_ADDRESS", polygonWallet.address);
  }
  if (polygonWallet && !isAddress(cleanEnvValue(values.get("POLYGON_DEPLOY_OWNER")))) {
    nextText = upsertEnv(nextText, "POLYGON_DEPLOY_OWNER", polygonWallet.address);
  }
  if (polygonWallet && !isAddress(cleanEnvValue(values.get("POLYGON_DEFAULT_RECIPIENT")))) {
    nextText = upsertEnv(nextText, "POLYGON_DEFAULT_RECIPIENT", polygonWallet.address);
  }

  writeFileSync(envPath, nextText, "utf8");

  const [iotaBalance, polygonBalance] = await Promise.allSettled([
    balanceOf(cleanEnvValue(values.get("IOTA_EVM_RPC_URL")) || IOTA_RPC_URL, iotaWallet.address),
    polygonWallet ? balanceOf(cleanEnvValue(values.get("POLYGON_RPC_URL")) || POLYGON_AMOY_RPC_URL, polygonWallet.address) : Promise.resolve(null),
  ]);

  console.log(JSON.stringify({
    ok: true,
    env_file: envPath,
    iota: {
      address: iotaWallet.address,
      created_wallet: createdIotaWallet,
      private_key_stored: true,
      rpc_url: cleanEnvValue(values.get("IOTA_EVM_RPC_URL")) || IOTA_RPC_URL,
      explorer_base_url: cleanEnvValue(values.get("IOTA_EXPLORER_BASE_URL")) || IOTA_EXPLORER_BASE_URL,
      faucet_url: "https://testnet.evm-bridge.iota.org",
      balance: iotaBalance.status === "fulfilled" ? iotaBalance.value : { error: String(iotaBalance.reason?.message || iotaBalance.reason) },
    },
    polygon_amoy: {
      address: polygonWallet?.address || null,
      private_key_configured: Boolean(polygonWallet),
      created_wallet: createdPolygonWallet,
      rpc_url: cleanEnvValue(values.get("POLYGON_RPC_URL")) || POLYGON_AMOY_RPC_URL,
      faucet_url: "https://faucet.quicknode.com/polygon/amoy",
      explorer_base_url: "https://amoy.polygonscan.com",
      balance: polygonBalance.status === "fulfilled" ? polygonBalance.value : { error: String(polygonBalance.reason?.message || polygonBalance.reason) },
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "setup_testnet_wallets_failed" }));
  process.exit(1);
});
