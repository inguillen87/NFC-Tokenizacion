import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { IotaClient, getNetwork, getRpcUrl } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import {
  FaucetRateLimitError,
  getFaucetHost,
  getFaucetWebsiteUrl,
  requestIotaFromFaucet,
  requestIotaFromFaucetV0,
} from "@iota/iota-sdk/faucet";

const envPath = resolve(process.cwd(), ".env.local");
const IOTA_NETWORK = "testnet";
const FALLBACK_FAUCET_HOST = "https://faucet.testnet.iota.cafe";
const EVM_BRIDGE_URL = "https://testnet.evm-bridge.iota.org";
const EVM_TOOLKIT_URL = "https://evm-toolkit.evm.testnet.iotaledger.net";

function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

function cleanEnvValue(value) {
  return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function upsertEnv(text, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, `${key}=${value}`);
  return `${text.replace(/\s*$/, "")}\n${key}=${value}\n`;
}

function boolArg(name) {
  return process.argv.includes(name);
}

function loadOrCreateKeypair(values) {
  const storedSecret = cleanEnvValue(values.get("IOTA_L1_SECRET_KEY"));
  if (storedSecret) {
    return { keypair: Ed25519Keypair.fromSecretKey(storedSecret), created: false };
  }
  return { keypair: Ed25519Keypair.generate(), created: true };
}

function rawToIota(totalBalance) {
  const raw = BigInt(totalBalance || "0");
  const whole = raw / 1_000_000_000n;
  const fraction = raw % 1_000_000_000n;
  return `${whole}.${fraction.toString().padStart(9, "0").replace(/0+$/, "") || "0"}`;
}

function serialiseError(error) {
  if (error instanceof FaucetRateLimitError) return { type: "rate_limited", message: error.message };
  return { type: error?.name || "Error", message: error instanceof Error ? error.message : String(error) };
}

async function readBalance(client, address) {
  const balance = await client.getBalance({ owner: address });
  return {
    coin_type: balance.coinType,
    raw_total: balance.totalBalance,
    approximate_iota: rawToIota(balance.totalBalance),
  };
}

async function requestFaucet({ host, address }) {
  try {
    const amount = await requestIotaFromFaucet({
      host,
      recipient: address,
      maxAttempts: 24,
      delayMs: 2500,
    });
    return { ok: true, protocol: "v1", transferred_raw: amount ?? null };
  } catch (error) {
    const v1Error = serialiseError(error);
    try {
      const response = await requestIotaFromFaucetV0({ host, recipient: address });
      const transferred = response.transferredGasObjects.reduce((total, coin) => total + BigInt(coin.amount), 0n);
      return { ok: true, protocol: "v0", transferred_raw: transferred.toString(), response };
    } catch (fallbackError) {
      return {
        ok: false,
        attempted_host: host,
        v1_error: v1Error,
        v0_error: serialiseError(fallbackError),
      };
    }
  }
}

async function main() {
  const shouldRequest = boolArg("--request");
  const existingText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const values = parseEnv(existingText);
  const { keypair, created } = loadOrCreateKeypair(values);
  const address = keypair.getPublicKey().toIotaAddress();
  const rpcUrl = cleanEnvValue(values.get("IOTA_L1_RPC_URL")) || getRpcUrl(IOTA_NETWORK);
  const client = new IotaClient({ url: rpcUrl });
  const network = getNetwork(IOTA_NETWORK);
  let sdkFaucetHost = "";
  try {
    sdkFaucetHost = getFaucetHost(IOTA_NETWORK);
  } catch {
    sdkFaucetHost = "";
  }
  const faucetHost = cleanEnvValue(values.get("IOTA_L1_FAUCET_HOST")) || sdkFaucetHost || FALLBACK_FAUCET_HOST;
  const faucetWebsite = network.faucetWebsite
    ? getFaucetWebsiteUrl(network.faucetWebsite, address)
    : getFaucetWebsiteUrl(EVM_BRIDGE_URL, address);

  let nextText = existingText;
  nextText = upsertEnv(nextText, "IOTA_L1_SECRET_KEY", keypair.getSecretKey());
  nextText = upsertEnv(nextText, "IOTA_L1_ADDRESS", address);
  nextText = upsertEnv(nextText, "IOTA_L1_RPC_URL", rpcUrl);
  nextText = upsertEnv(nextText, "IOTA_L1_FAUCET_HOST", faucetHost);
  nextText = upsertEnv(nextText, "IOTA_EVM_BRIDGE_URL", EVM_BRIDGE_URL);
  nextText = upsertEnv(nextText, "IOTA_EVM_TOOLKIT_URL", EVM_TOOLKIT_URL);
  writeFileSync(envPath, nextText, "utf8");

  const before = await readBalance(client, address);
  const faucet = shouldRequest ? await requestFaucet({ host: faucetHost, address }) : null;
  const after = shouldRequest ? await readBalance(client, address) : before;

  console.log(JSON.stringify({
    ok: Boolean(!faucet || faucet.ok),
    env_file: envPath,
    network: IOTA_NETWORK,
    l1_wallet: {
      address,
      created,
      secret_key_stored: true,
    },
    rpc_url: rpcUrl,
    faucet_host: faucetHost,
    faucet_website: faucetWebsite,
    evm_bridge_url: EVM_BRIDGE_URL,
    evm_toolkit_url: EVM_TOOLKIT_URL,
    balance_before: before,
    faucet,
    balance_after: after,
    next_step: after.raw_total === "0"
      ? "Open the faucet website for the stored IOTA_L1_ADDRESS, then bridge L1 IOTA to IOTA EVM for gas."
      : "Bridge part of this L1 testnet balance to the configured IOTA_EVM_DEPLOYER_ADDRESS, then deploy the anchor contract.",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "iota_l1_faucet_setup_failed" }));
  process.exit(1);
});
