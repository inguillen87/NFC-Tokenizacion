import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Wallet } from "ethers";

const envPath = resolve(process.cwd(), ".env.local");
const mode = String(process.argv[2] || "").trim().toLowerCase();

const POLYGON_OWNER = "0x644c5D77a34182Db01257bC4C469B01850bc6B2d";
const POLYGON_CONTRACT = "0x673CAE3D79f825bba9cfb2096184c295A5C9Eb4C";
const POLYGON_RPC_URL = "https://polygon-amoy.drpc.org";

function readStdin() {
  return new Promise((resolveRead) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolveRead(data));
  });
}

function normalizePrivateKey(raw) {
  const extracted = String(raw || "").match(/(?:0x)?[0-9a-fA-F]{64}/)?.[0] || "";
  const compact = extracted.replace(/\s+/g, "").trim();
  const withPrefix = compact.startsWith("0x") ? compact : `0x${compact}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) throw new Error("invalid_private_key_format");
  return withPrefix;
}

function upsertEnv(text, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, `${key}=${value}`);
  return `${text.replace(/\s*$/, "")}\n${key}=${value}\n`;
}

function getEnvValue(text, key) {
  const match = text.match(new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=(.*)$`, "m"));
  return String(match?.[1] || "").trim().replace(/^['"]|['"]$/g, "");
}

async function main() {
  if (!["polygon-owner", "iota-deployer"].includes(mode)) {
    throw new Error("usage: node scripts/import-testnet-key.mjs polygon-owner|iota-deployer");
  }

  const privateKey = normalizePrivateKey(await readStdin());
  const wallet = new Wallet(privateKey);
  let text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

  if (mode === "polygon-owner") {
    if (wallet.address.toLowerCase() !== POLYGON_OWNER.toLowerCase()) {
      throw new Error(`unexpected_polygon_key_address:${wallet.address}:expected:${POLYGON_OWNER}`);
    }

    text = upsertEnv(text, "POLYGON_RPC_URL", POLYGON_RPC_URL);
    text = upsertEnv(text, "POLYGON_CONTRACT_ADDRESS", POLYGON_CONTRACT);
    text = upsertEnv(text, "POLYGON_MINTER_PRIVATE_KEY", privateKey);
    text = upsertEnv(text, "POLYGON_MINTER_ADDRESS", POLYGON_OWNER);
    text = upsertEnv(text, "POLYGON_DEPLOY_OWNER", POLYGON_OWNER);
    text = upsertEnv(text, "POLYGON_DEFAULT_RECIPIENT", POLYGON_OWNER);
    text = upsertEnv(text, "TOKENIZATION_MODE", "polygon");
    text = upsertEnv(text, "TOKENIZATION_USE_LOCAL_MINTER", "true");
    text = upsertEnv(text, "SUN_AUTO_TOKENIZE_ON_VALID_TAP", "true");
    text = upsertEnv(text, "TOKENIZATION_METADATA_CID_PREFIX", getEnvValue(text, "TOKENIZATION_METADATA_CID_PREFIX") || "nexid-metadata");
    if (getEnvValue(text, "TOKENIZATION_UID_SALT").length < 32) {
      text = upsertEnv(text, "TOKENIZATION_UID_SALT", `nexid-amoy-${randomBytes(24).toString("hex")}`);
    }
  } else {
    text = upsertEnv(text, "IOTA_EVM_PRIVATE_KEY", privateKey);
    text = upsertEnv(text, "IOTA_EVM_DEPLOYER_ADDRESS", wallet.address);
    text = upsertEnv(text, "IOTA_EVM_RPC_URL", getEnvValue(text, "IOTA_EVM_RPC_URL") || "https://json-rpc.evm.testnet.iota.cafe");
    text = upsertEnv(text, "IOTA_EXPLORER_BASE_URL", getEnvValue(text, "IOTA_EXPLORER_BASE_URL") || "https://explorer.evm.testnet.iota.cafe");
  }

  writeFileSync(envPath, text, "utf8");
  console.log(JSON.stringify({
    ok: true,
    mode,
    address: wallet.address,
    env_file: envPath,
    private_key_stored: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "import_key_failed" }));
  process.exit(1);
});
