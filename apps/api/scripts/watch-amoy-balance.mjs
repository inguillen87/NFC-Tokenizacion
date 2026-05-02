#!/usr/bin/env node

const DEFAULT_RPC = "https://polygon-amoy.drpc.org";
const AMOY_CHAIN_ID = 80002n;

function arg(name, fallback = "") {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) return String(process.argv[index + 1]).trim();
  return String(process.env[name.toUpperCase().replaceAll("-", "_")] || fallback).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseWeiToPol(weiHex) {
  const wei = BigInt(weiHex || "0x0");
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  return `${whole}.${frac.toString().padStart(18, "0").slice(0, 6)}`;
}

async function rpcCall(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "rpc_error");
  return json.result;
}

async function main() {
  const address = arg("address");
  const rpcUrl = arg("rpc", process.env.POLYGON_RPC_URL || DEFAULT_RPC);
  const minPol = Number(arg("min", "0.001"));
  const intervalSeconds = Number(arg("interval", "20"));
  const once = process.argv.includes("--once");

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Usage: node scripts/watch-amoy-balance.mjs --address 0x... [--once] [--min 0.001]");
  }

  const chainId = BigInt(await rpcCall(rpcUrl, "eth_chainId"));
  if (chainId !== AMOY_CHAIN_ID) throw new Error(`wrong_chain_expected_80002_got_${chainId}`);

  for (;;) {
    const balanceHex = await rpcCall(rpcUrl, "eth_getBalance", [address, "latest"]);
    const balancePolText = parseWeiToPol(balanceHex);
    const balancePol = Number(balancePolText);
    const ready = balancePol >= minPol;
    const stamp = new Date().toISOString();
    console.log(`${stamp} ${address} balance=${balancePolText} POL ${ready ? "READY" : "waiting"}`);
    if (ready || once) process.exit(ready ? 0 : 2);
    await sleep(intervalSeconds * 1000);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "watch_failed");
  process.exit(1);
});
