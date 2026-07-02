import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { blake2b } from "@noble/hashes/blake2b";
import { IotaClient } from "@iota/iota-sdk/client";
import { bcs } from "@iota/iota-sdk/bcs";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";

const envPath = resolve(process.cwd(), ".env.local");
const IOTA_COIN_TYPE = "0x2::iota::IOTA";
const TESTNET_CHAIN_ID = "0x2f11f5ea9d3c093c9cc2e329cf92e05aa00ac052ada96c4c14a2f6869a7cbcaf";
const TESTNET_PACKAGE_ID = "0x1e6e060b87f55acc0a7632acab9cf5712ff01643f8577c9a6f99ebd1010e3f4c";
const TESTNET_L1_RPC_URL = "https://indexer.testnet.iota.cafe";
const TESTNET_EVM_RPC_URL = "https://json-rpc.evm.testnet.iota.cafe";
const DEFAULT_BRIDGE_AMOUNT = 2_000_000_000n;
const DEFAULT_GAS_BUDGET = 1_000_000n;

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

function parseAmountArg() {
  const raw = process.argv.find((arg) => arg.startsWith("--amount-iota="))?.split("=")[1];
  if (!raw) return DEFAULT_BRIDGE_AMOUNT;
  if (!/^\d+(\.\d{1,9})?$/.test(raw)) throw new Error("invalid_amount_iota");
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"));
}

function parseHexBytes(hex, expectedBytes) {
  const compact = cleanEnvValue(hex).replace(/^0x/, "");
  if (!new RegExp(`^[0-9a-fA-F]{${expectedBytes * 2}}$`).test(compact)) {
    throw new Error(`invalid_hex_${expectedBytes}_bytes`);
  }
  return Uint8Array.from(compact.match(/.{2}/g).map((part) => Number.parseInt(part, 16)));
}

function hname(name) {
  const digest = blake2b(new TextEncoder().encode(name), { dkLen: 32 });
  return (digest[0] | (digest[1] << 8) | (digest[2] << 16) | (digest[3] << 24)) >>> 0;
}

function buildEthereumAgentId(evmAddress) {
  const iscEthereumAddressAgentId = bcs.struct("IscEthereumAddressAgentID", {
    eth: bcs.fixedArray(20, bcs.u8()),
  });
  const iscAgentId = bcs.enum("IscAgentID", {
    NoType: null,
    AddressAgentID: bcs.struct("IscAddressAgentID", { a: bcs.fixedArray(32, bcs.u8()) }),
    ContractAgentID: bcs.struct("IscContractAgentID", { hname: bcs.u32() }),
    EthereumAddressAgentID: iscEthereumAddressAgentId,
    NilAgentID: bcs.struct("IscNilAgentID", {}),
  });
  return iscAgentId.serialize({
    EthereumAddressAgentID: { eth: Array.from(parseHexBytes(evmAddress, 20)) },
  }).toBytes();
}

function buildIscAssets(transfers) {
  const iscAssets = bcs.struct("IscAssets", {
    coins: bcs.map(bcs.string(), bcs.u64()),
    objects: bcs.map(bcs.fixedArray(32, bcs.u8()), bcs.string()),
  });
  return iscAssets.serialize({
    coins: new Map(transfers.map(([coinType, amount]) => [coinType, amount])),
    objects: new Map(),
  }).toBytes();
}

async function readEvmBalance(address) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getBalance",
    params: [address, "latest"],
  };
  const response = await fetch(TESTNET_EVM_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "evm_balance_rpc_error");
  return BigInt(json.result);
}

function buildDepositTransaction({ amount, evmAddress }) {
  const tx = new Transaction();
  const bag = tx.moveCall({
    target: `${TESTNET_PACKAGE_ID}::assets_bag::new`,
    arguments: [],
  });
  const [coin] = tx.splitCoins(tx.gas, [tx.pure(bcs.U64.serialize(amount + DEFAULT_GAS_BUDGET))]);
  tx.moveCall({
    target: `${TESTNET_PACKAGE_ID}::assets_bag::place_coin`,
    typeArguments: [IOTA_COIN_TYPE],
    arguments: [bag, coin],
  });
  tx.moveCall({
    target: `${TESTNET_PACKAGE_ID}::request::create_and_send_request`,
    arguments: [
      tx.pure(bcs.Address.serialize(TESTNET_CHAIN_ID)),
      bag,
      tx.pure(bcs.U32.serialize(hname("accounts"))),
      tx.pure(bcs.U32.serialize(hname("transferAllowanceTo"))),
      tx.pure(bcs.vector(bcs.vector(bcs.u8())).serialize([buildEthereumAgentId(evmAddress)])),
      tx.pure(bcs.vector(bcs.u8()).serialize(buildIscAssets([[IOTA_COIN_TYPE, amount]]))),
      tx.pure(bcs.U64.serialize(DEFAULT_GAS_BUDGET)),
    ],
  });
  return tx;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const amount = parseAmountArg();
  const text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const values = parseEnv(text);
  const secretKey = cleanEnvValue(values.get("IOTA_L1_SECRET_KEY"));
  if (!secretKey) throw new Error("missing_IOTA_L1_SECRET_KEY_run_iota_l1_faucet_first");
  const evmAddress = cleanEnvValue(values.get("IOTA_EVM_DEPLOYER_ADDRESS"));
  if (!/^0x[0-9a-fA-F]{40}$/.test(evmAddress)) throw new Error("missing_or_invalid_IOTA_EVM_DEPLOYER_ADDRESS");

  const signer = Ed25519Keypair.fromSecretKey(secretKey);
  const l1Address = signer.getPublicKey().toIotaAddress();
  const client = new IotaClient({ url: cleanEnvValue(values.get("IOTA_L1_RPC_URL")) || TESTNET_L1_RPC_URL });
  const [l1Before, evmBefore] = await Promise.all([
    client.getBalance({ owner: l1Address }),
    readEvmBalance(evmAddress),
  ]);
  if (BigInt(l1Before.totalBalance) <= amount + DEFAULT_GAS_BUDGET) {
    throw new Error(`insufficient_l1_balance:${l1Before.totalBalance}`);
  }

  const tx = buildDepositTransaction({ amount, evmAddress });
  tx.setSender(l1Address);
  const txBytes = await tx.build({ client });
  const dryRun = await client.dryRunTransactionBlock({ transactionBlock: txBytes });
  const dryRunStatus = dryRun.effects.status.status;
  if (dryRunStatus !== "success") {
    throw new Error(`iota_bridge_dry_run_failed:${dryRun.effects.status.error || "unknown"}`);
  }

  let result = null;
  if (execute) {
    result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer,
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
      },
    });
    if (result.digest) {
      let nextText = upsertEnv(text, "IOTA_L1_TO_EVM_BRIDGE_TX_DIGEST", result.digest);
      nextText = upsertEnv(nextText, "IOTA_PROVIDER_MODE", cleanEnvValue(values.get("IOTA_PROVIDER_MODE")) || "disabled");
      writeFileSync(envPath, nextText, "utf8");
    }
  }

  const [l1After, evmAfter] = await Promise.all([
    client.getBalance({ owner: l1Address }),
    readEvmBalance(evmAddress),
  ]);
  console.log(JSON.stringify({
    ok: true,
    executed: execute,
    amount_raw: amount.toString(),
    amount_iota: (Number(amount) / 1e9).toString(),
    l1_address: l1Address,
    evm_address: evmAddress,
    hnames: {
      accounts: hname("accounts"),
      transferAllowanceTo: hname("transferAllowanceTo"),
    },
    dry_run_status: dryRunStatus,
    digest: result?.digest || null,
    l1_balance_before: l1Before.totalBalance,
    l1_balance_after: l1After.totalBalance,
    evm_balance_before_wei: evmBefore.toString(),
    evm_balance_after_wei: evmAfter.toString(),
    note: execute
      ? "Bridge request submitted. EVM balance can take a short time to reflect on L2."
      : "Dry-run only. Re-run with --execute to submit the bridge request.",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "bridge_iota_l1_to_evm_failed" }, null, 2));
  process.exit(1);
});
