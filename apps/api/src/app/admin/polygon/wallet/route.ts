export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Wallet, JsonRpcProvider, formatEther, isAddress } from "ethers";
import { checkAdmin, checkAdminPermission } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { probePolygonExecutorReadiness } from "../../../../lib/polygon-executor-readiness";

const AMOY_CHAIN_ID = 80002n;

type ReadinessStatus = "pass" | "warn" | "fail";

function env(name: string, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function boolEnv(name: string) {
  return ["1", "true", "yes", "on"].includes(env(name).toLowerCase());
}

function check(key: string, label: string, status: ReadinessStatus, detail = "") {
  return { key, label, status, detail };
}

function maskUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.pathname.length > 8) url.pathname = `${url.pathname.slice(0, 8)}...`;
    if (url.search) url.search = "?...";
    return url.toString();
  } catch {
    return "configured";
  }
}

export async function GET(req: Request): Promise<Response> {
  const auth = checkAdmin(req);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "tokenization:read");
  if (permission) return permission;

  const mode = env("TOKENIZATION_MODE", "disabled").toLowerCase();
  const polygonMode = mode === "polygon";
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
  const executorConfigured = Boolean(executorUrl);
  const simulated = Number(process.env.POLYGON_SIM_GAS_AVAILABLE || "0");

  const checks = [
    mode === "polygon" || mode === "simulated" || mode === "disabled" || mode === "off"
      ? check("mode", "TOKENIZATION_MODE", "pass", mode)
      : check("mode", "TOKENIZATION_MODE", "fail", "Use disabled, simulated or polygon."),
    autoTokenize
      ? check("auto_tokenize", "SUN auto tokenization", "pass", "Valid taps can create tokenization requests.")
      : check("auto_tokenize", "SUN auto tokenization", polygonMode ? "fail" : "warn", "Set SUN_AUTO_TOKENIZE_ON_VALID_TAP=true for pilot."),
    uidSalt.length >= 32
      ? check("uid_salt", "UID privacy salt", "pass", `${uidSalt.length} chars`)
      : check("uid_salt", "UID privacy salt", polygonMode ? "fail" : "warn", "Use a long secret salt before Polygon."),
    metadataPrefix
      ? check("metadata", "Metadata prefix", "pass", metadataPrefix)
      : check("metadata", "Metadata prefix", "warn", "Recommended for stable token URI."),
  ];

  let minterAddress: string | null = null;
  let minterBalancePol: number | null = null;
  let recipientBalancePol: number | null = null;
  let chainId: string | null = null;
  let contractDeployed = false;
  let executorReadiness: Awaited<ReturnType<typeof probePolygonExecutorReadiness>> | null = null;

  if (!polygonMode) {
    checks.push(check(
      "polygon_mode",
      "Polygon mode",
      "warn",
      mode === "simulated"
        ? "Simulation only: no transaction or token is created."
        : "Tokenization is disabled until an operator explicitly selects simulated or polygon mode.",
    ));
    const failed = checks.filter((item) => item.status === "fail");
    return json({
      ok: true,
      ready: mode === "simulated" && failed.length === 0,
      chainReady: false,
      mode,
      network: "polygon-amoy",
      chainId,
      autoTokenize,
      useLocalMinter,
      rpc: { configured: Boolean(rpcUrl), url: maskUrl(rpcUrl) },
      verificationLevel: "not_live_verified",
      executor: { configured: executorConfigured, liveVerified: false, reason: polygonMode ? "not_probed" : "polygon_mode_inactive", url: maskUrl(executorUrl), secretConfigured: Boolean(executorSecret) },
      contract: { address: contractAddress || null, deployed: false },
      minter: { address: null, configuredAddress: configuredMinterAddress || null, configured: Boolean(minterPrivateKey), balancePol: simulated || null },
      recipient: { address: defaultRecipient || null, balancePol: recipientBalancePol },
      metadataPrefix,
      checks,
    });
  }

  checks.push(rpcUrl
    ? check("rpc_url", "Polygon RPC", "pass", maskUrl(rpcUrl) || "configured")
    : check("rpc_url", "Polygon RPC", useLocalMinter ? "fail" : "warn", "Required in API only for local minter; executor can hold its own RPC."));
  checks.push(isAddress(contractAddress)
    ? check("contract_address", "Contract address", "pass", contractAddress)
    : check("contract_address", "Contract address", useLocalMinter ? "fail" : "warn", "Required in API only for local minter; executor can hold its own contract."));
  checks.push(isAddress(defaultRecipient)
    ? check("default_recipient", "Default recipient", "pass", defaultRecipient)
    : check("default_recipient", "Default recipient", useLocalMinter ? "fail" : "warn", "Required in API only for local minter; executor can hold its own recipient."));
  checks.push(!deployOwner || isAddress(deployOwner)
    ? check("deploy_owner", "Deploy owner", deployOwner ? "pass" : "warn", deployOwner || "Needed for deploy, optional after runtime is live.")
    : check("deploy_owner", "Deploy owner", "fail", "POLYGON_DEPLOY_OWNER must be a valid address."));
  checks.push(!configuredMinterAddress || isAddress(configuredMinterAddress)
    ? check("minter_address", "Authorized minter", configuredMinterAddress ? "pass" : "warn", configuredMinterAddress || "Recommended for deploy so owner and minter are explicit.")
    : check("minter_address", "Authorized minter", "fail", "POLYGON_MINTER_ADDRESS must be a valid address."));

  if (useLocalMinter) {
    try {
      minterAddress = new Wallet(minterPrivateKey).address;
      checks.push(check("minter_key", "Local minter private key", "pass", `Minter ${minterAddress}`));
      if (configuredMinterAddress && configuredMinterAddress.toLowerCase() !== minterAddress.toLowerCase()) {
        checks.push(check("minter_match", "Minter key/address match", "fail", `Private key resolves to ${minterAddress}.`));
      } else if (configuredMinterAddress) {
        checks.push(check("minter_match", "Minter key/address match", "pass", "Private key matches authorized minter."));
      }
    } catch {
      checks.push(check("minter_key", "Local minter private key", "fail", "Invalid or missing POLYGON_MINTER_PRIVATE_KEY."));
    }
  } else if (executorConfigured) {
    executorReadiness = await probePolygonExecutorReadiness();
    if (executorReadiness.liveVerified) {
      chainId = executorReadiness.chainId;
      contractDeployed = executorReadiness.contractDeployed;
      minterAddress = executorReadiness.signerAddress;
      minterBalancePol = executorReadiness.signerBalancePol;
      checks.push(check("executor", "External executor", "pass", "Authenticated /ready verified RPC, Amoy 80002, contract bytecode, authorized signer and gas."));
    } else {
      checks.push(check("executor", "External executor", "fail", executorReadiness.reason));
    }
  } else {
    checks.push(check("minter_or_executor", "Minter/executor", "fail", "Enable local minter or configure executor."));
  }

  if (rpcUrl && useLocalMinter) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      chainId = String(network.chainId);
      checks.push(network.chainId === AMOY_CHAIN_ID
        ? check("chain_id", "RPC chain", "pass", "Polygon Amoy 80002")
        : check("chain_id", "RPC chain", "fail", `Expected 80002, got ${network.chainId}.`));

      if (isAddress(contractAddress)) {
        const code = await provider.getCode(contractAddress);
        contractDeployed = Boolean(code && code !== "0x");
        checks.push(contractDeployed
          ? check("contract_code", "Contract bytecode", "pass", "Contract exists on Amoy.")
          : check("contract_code", "Contract bytecode", "fail", "No bytecode at POLYGON_CONTRACT_ADDRESS."));
      }

      if (minterAddress) {
        const balance = await provider.getBalance(minterAddress);
        minterBalancePol = Number(formatEther(balance));
        checks.push(balance > 0n
          ? check("minter_gas", "Minter gas", "pass", `${minterBalancePol.toFixed(6)} POL`)
          : check("minter_gas", "Minter gas", "fail", "Minter wallet has 0 POL on Amoy."));
      }

      if (isAddress(defaultRecipient)) {
        const balance = await provider.getBalance(defaultRecipient);
        recipientBalancePol = Number(formatEther(balance));
      }
    } catch (error) {
      checks.push(check("rpc_live", "RPC live check", "fail", error instanceof Error ? error.message : "polygon_rpc_failed"));
    }
  }

  const failed = checks.filter((item) => item.status === "fail");
  const executionPathLive = useLocalMinter
    ? chainId === String(AMOY_CHAIN_ID) && contractDeployed && Boolean(minterAddress) && Number(minterBalancePol || 0) > 0
    : executorReadiness?.liveVerified === true;
  const chainReady = failed.length === 0 && executionPathLive;
  return json({
    ok: true,
    ready: chainReady,
    chainReady,
    verificationLevel: chainReady ? "live_verified" : executorConfigured ? "configured_unverified" : "not_live_verified",
    mode,
    network: "polygon-amoy",
    chainId,
    autoTokenize,
    useLocalMinter,
    rpc: { configured: Boolean(rpcUrl), url: maskUrl(rpcUrl) },
    executor: {
      configured: executorConfigured,
      liveVerified: executorReadiness?.liveVerified === true,
      reason: executorReadiness?.reason || (executorConfigured ? "not_probed" : "executor_not_configured"),
      url: maskUrl(executorUrl),
      secretConfigured: Boolean(executorSecret),
      chainId: executorReadiness?.chainId || null,
      contractAddress: executorReadiness?.contractAddress || null,
      signerAddress: executorReadiness?.signerAddress || null,
      signerAuthorized: executorReadiness?.signerAuthorized === true,
    },
    contract: { address: contractAddress || executorReadiness?.contractAddress || null, deployed: contractDeployed },
    minter: { address: minterAddress, configuredAddress: configuredMinterAddress || null, configured: Boolean(minterPrivateKey), balancePol: minterBalancePol },
    recipient: { address: defaultRecipient || null, balancePol: recipientBalancePol },
    metadataPrefix,
    checks,
  });
}
