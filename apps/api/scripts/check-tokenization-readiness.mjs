#!/usr/bin/env node
import { Wallet, JsonRpcProvider, formatEther, isAddress } from "ethers";

const AMOY_CHAIN_ID = 80002n;

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function maskSecret(value, left = 6, right = 4) {
  const text = String(value || "");
  if (!text) return null;
  if (text.length <= left + right) return "*".repeat(text.length);
  return `${text.slice(0, left)}...${text.slice(-right)}`;
}

function maskUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.pathname.length > 8) url.pathname = `${url.pathname.slice(0, 8)}...`;
    if (url.search) url.search = "?...";
    return url.toString();
  } catch {
    return maskSecret(value, 16, 4);
  }
}

function makeCheck(key, label, status, detail = "") {
  return { key, label, status, detail };
}

function printCheck(check) {
  const icon = check.status === "pass" ? "OK" : check.status === "warn" ? "WARN" : "FAIL";
  console.log(`${icon.padEnd(5)} ${check.label}${check.detail ? ` - ${check.detail}` : ""}`);
}

async function main() {
  const mode = env("TOKENIZATION_MODE", "simulated").toLowerCase();
  const autoTokenize = boolEnv("SUN_AUTO_TOKENIZE_ON_VALID_TAP");
  const useLocalMinter = boolEnv("TOKENIZATION_USE_LOCAL_MINTER");
  const rpcUrl = env("POLYGON_RPC_URL");
  const minterPrivateKey = env("POLYGON_MINTER_PRIVATE_KEY");
  const configuredMinterAddress = env("POLYGON_MINTER_ADDRESS");
  const contractAddress = env("POLYGON_CONTRACT_ADDRESS");
  const defaultRecipient = env("POLYGON_DEFAULT_RECIPIENT");
  const deployOwner = env("POLYGON_DEPLOY_OWNER");
  const uidSalt = env("TOKENIZATION_UID_SALT");
  const metadataPrefix = env("TOKENIZATION_METADATA_CID_PREFIX", "nexid-metadata");
  const executorUrl = env("TOKENIZATION_EXECUTOR_URL");
  const executorSecret = env("TOKENIZATION_EXECUTOR_SECRET");

  const polygonMode = mode === "polygon";
  const executorConfigured = Boolean(executorUrl);
  const checks = [];

  console.log("nexID tokenization readiness");
  console.log("=============================");
  console.log(`Mode: ${mode}`);
  console.log(`Auto tokenize SUN: ${autoTokenize ? "true" : "false"}`);
  console.log(`Local minter: ${useLocalMinter ? "true" : "false"}`);
  console.log(`RPC: ${maskUrl(rpcUrl) || "-"}`);
  console.log(`Contract: ${contractAddress || "-"}`);
  console.log(`Authorized minter: ${configuredMinterAddress || "-"}`);
  console.log(`Default recipient: ${defaultRecipient || "-"}`);
  console.log(`Deploy owner: ${deployOwner || "-"}`);
  console.log(`Executor: ${maskUrl(executorUrl) || "-"}`);
  console.log(`Metadata prefix: ${metadataPrefix || "-"}`);
  console.log("");

  checks.push(mode === "polygon" || mode === "simulated"
    ? makeCheck("mode", "TOKENIZATION_MODE", "pass", mode)
    : makeCheck("mode", "TOKENIZATION_MODE", "fail", "Use simulated or polygon."));

  checks.push(autoTokenize
    ? makeCheck("auto_tokenize", "SUN_AUTO_TOKENIZE_ON_VALID_TAP", "pass", "valid SUN taps can enqueue/mint automatically")
    : makeCheck("auto_tokenize", "SUN_AUTO_TOKENIZE_ON_VALID_TAP", polygonMode ? "fail" : "warn", "set true before the real pilot"));

  checks.push(uidSalt.length >= 32
    ? makeCheck("uid_salt", "TOKENIZATION_UID_SALT", "pass", `${uidSalt.length} chars`)
    : makeCheck("uid_salt", "TOKENIZATION_UID_SALT", polygonMode ? "fail" : "warn", "use a long secret salt before Polygon mode"));

  checks.push(metadataPrefix
    ? makeCheck("metadata", "TOKENIZATION_METADATA_CID_PREFIX", "pass", metadataPrefix)
    : makeCheck("metadata", "TOKENIZATION_METADATA_CID_PREFIX", "warn", "recommended for stable token URI generation"));

  if (!polygonMode) {
    checks.push(makeCheck("polygon_mode", "Polygon readiness", "warn", "TOKENIZATION_MODE=simulated. This is fine until tomorrow."));
    checks.forEach(printCheck);
    console.log("");
    console.log(JSON.stringify({ ok: true, mode, readyForSimulatedPilot: true, checks }, null, 2));
    return;
  }

  checks.push(rpcUrl
    ? makeCheck("rpc_url", "POLYGON_RPC_URL", "pass", maskUrl(rpcUrl) || "configured")
    : makeCheck("rpc_url", "POLYGON_RPC_URL", useLocalMinter ? "fail" : "warn", "required in API only for local minter; executor can hold its own RPC"));

  checks.push(isAddress(contractAddress)
    ? makeCheck("contract_address", "POLYGON_CONTRACT_ADDRESS", "pass", contractAddress)
    : makeCheck("contract_address", "POLYGON_CONTRACT_ADDRESS", useLocalMinter ? "fail" : "warn", "required in API only for local minter; executor can hold its own contract"));

  checks.push(isAddress(defaultRecipient)
    ? makeCheck("default_recipient", "POLYGON_DEFAULT_RECIPIENT", "pass", defaultRecipient)
    : makeCheck("default_recipient", "POLYGON_DEFAULT_RECIPIENT", useLocalMinter ? "fail" : "warn", "required in API only for local minter; executor can hold its own recipient"));

  if (deployOwner) {
    checks.push(isAddress(deployOwner)
      ? makeCheck("deploy_owner", "POLYGON_DEPLOY_OWNER", "pass", deployOwner)
      : makeCheck("deploy_owner", "POLYGON_DEPLOY_OWNER", "fail", "must be a valid EVM address"));
  } else {
    checks.push(makeCheck("deploy_owner", "POLYGON_DEPLOY_OWNER", "warn", "needed for deploy; runtime can use the already deployed contract"));
  }

  if (configuredMinterAddress) {
    checks.push(isAddress(configuredMinterAddress)
      ? makeCheck("minter_address", "POLYGON_MINTER_ADDRESS", "pass", configuredMinterAddress)
      : makeCheck("minter_address", "POLYGON_MINTER_ADDRESS", "fail", "must be a valid EVM address"));
  } else {
    checks.push(makeCheck("minter_address", "POLYGON_MINTER_ADDRESS", "warn", "recommended for deploy so owner and minter are explicit"));
  }

  let minterAddress = "";
  if (useLocalMinter) {
    try {
      const wallet = new Wallet(minterPrivateKey);
      minterAddress = wallet.address;
      checks.push(makeCheck("minter_key", "POLYGON_MINTER_PRIVATE_KEY", "pass", `minter ${minterAddress}, key ${maskSecret(minterPrivateKey)}`));
      if (configuredMinterAddress && configuredMinterAddress.toLowerCase() !== minterAddress.toLowerCase()) {
        checks.push(makeCheck("minter_match", "Minter key/address match", "fail", `private key resolves to ${minterAddress}`));
      } else if (configuredMinterAddress) {
        checks.push(makeCheck("minter_match", "Minter key/address match", "pass", "private key matches POLYGON_MINTER_ADDRESS"));
      }
    } catch {
      checks.push(makeCheck("minter_key", "POLYGON_MINTER_PRIVATE_KEY", "fail", "invalid or missing private key"));
    }
  } else if (executorConfigured) {
    checks.push(executorSecret
      ? makeCheck("executor", "TOKENIZATION_EXECUTOR_URL/SECRET", "pass", "external executor configured")
      : makeCheck("executor", "TOKENIZATION_EXECUTOR_SECRET", "fail", "executor URL set without secret"));
  } else {
    checks.push(makeCheck("minter_or_executor", "Minter or executor", "fail", "enable TOKENIZATION_USE_LOCAL_MINTER=true or configure executor"));
  }

  if (rpcUrl) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      checks.push(network.chainId === AMOY_CHAIN_ID
        ? makeCheck("chain_id", "RPC chain", "pass", `Polygon Amoy ${network.chainId}`)
        : makeCheck("chain_id", "RPC chain", "fail", `expected 80002, got ${network.chainId}`));

      if (isAddress(contractAddress)) {
        const code = await provider.getCode(contractAddress);
        checks.push(code && code !== "0x"
          ? makeCheck("contract_code", "Contract deployed", "pass", `${contractAddress} has bytecode`)
          : makeCheck("contract_code", "Contract deployed", "fail", "no bytecode at POLYGON_CONTRACT_ADDRESS"));
      }

      if (minterAddress) {
        const balance = await provider.getBalance(minterAddress);
        const balancePol = Number(formatEther(balance));
        checks.push(balance > 0n
          ? makeCheck("minter_gas", "Minter gas", "pass", `${balancePol.toFixed(6)} POL`)
          : makeCheck("minter_gas", "Minter gas", "fail", "wallet has 0 POL on Amoy"));
      }
    } catch (error) {
      checks.push(makeCheck("rpc_live", "RPC live check", "fail", error instanceof Error ? error.message : "rpc_failed"));
    }
  }

  checks.forEach(printCheck);
  const failed = checks.filter((check) => check.status === "fail");
  console.log("");
  console.log(JSON.stringify({
    ok: failed.length === 0,
    mode,
    network: "polygon-amoy",
    minterAddress: minterAddress || null,
    configuredMinterAddress: configuredMinterAddress || null,
    contractAddress: contractAddress || null,
    executorUrl: executorConfigured ? maskUrl(executorUrl) : null,
    failed: failed.map((check) => check.key),
    checks,
  }, null, 2));

  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "readiness_check_failed" }, null, 2));
  process.exit(1);
});
