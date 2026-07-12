function cleanEnv(value: unknown) {
  const text = String(value || "").trim();
  if (!text || text === "\"\"" || text === "''") return "";
  return text.replace(/^['"]|['"]$/g, "").trim();
}

function envKeySuffix(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function publicProofIotaAnchorTx(caseId: string) {
  return cleanEnv(process.env[`PUBLIC_PROOF_DEMO_IOTA_TX_HASH_${envKeySuffix(caseId)}`])
    || cleanEnv(process.env.PUBLIC_PROOF_DEMO_IOTA_TX_HASH)
    || cleanEnv(process.env.IOTA_DEMO_TX_HASH);
}

export function publicProofIotaReceiptTx(caseId: string) {
  return cleanEnv(process.env[`PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH_${envKeySuffix(caseId)}`])
    || cleanEnv(process.env.PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH);
}

export function publicProofIotaExplorerUrl(txHash: string) {
  if (!txHash) return null;
  const baseUrl = cleanEnv(process.env.IOTA_EXPLORER_BASE_URL) || "https://explorer.evm.testnet.iota.cafe";
  return `${baseUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

export function publicProofIotaContractAddress() {
  return cleanEnv(process.env.IOTA_EVM_ANCHOR_CONTRACT);
}

export function publicProofIotaPublisherAddress() {
  return cleanEnv(process.env.IOTA_EVM_DEPLOYER_ADDRESS);
}

export function publicProofIotaRpcUrl() {
  const raw = cleanEnv(process.env.IOTA_EVM_RPC_URL) || "https://json-rpc.evm.testnet.iota.cafe";
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("iota_rpc_url_invalid");
  }
  return url.toString();
}
