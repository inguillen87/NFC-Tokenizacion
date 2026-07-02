export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { PUBLIC_PROOF_DEMO_CASES } from "../../../../lib/public-proof-demos";

function clean(value: unknown) {
  const text = String(value || "").trim();
  if (!text || text === "\"\"" || text === "''") return "";
  return text.replace(/^['"]|['"]$/g, "").trim();
}

function explorerUrl(baseUrl: string, kind: "address" | "tx", value: string) {
  if (!baseUrl || !value) return null;
  return `${baseUrl.replace(/\/$/, "")}/${kind}/${value}`;
}

function envKeySuffix(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function iotaDemoTxFor(caseId: string) {
  return clean(process.env[`PUBLIC_PROOF_DEMO_IOTA_TX_HASH_${envKeySuffix(caseId)}`])
    || clean(process.env.PUBLIC_PROOF_DEMO_IOTA_TX_HASH)
    || clean(process.env.IOTA_DEMO_TX_HASH);
}

function iotaReceiptTxFor(caseId: string) {
  return clean(process.env[`PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH_${envKeySuffix(caseId)}`])
    || clean(process.env.PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH);
}

export async function GET() {
  const polygonExplorerBaseUrl = clean(process.env.POLYGON_EXPLORER_BASE_URL) || "https://amoy.polygonscan.com";
  const polygonContract = clean(process.env.POLYGON_CONTRACT_ADDRESS) || "0x673CAE3D79f825bba9cfb2096184c295A5C9Eb4C";
  const polygonOwner = clean(process.env.POLYGON_MINTER_ADDRESS || process.env.POLYGON_DEPLOY_OWNER) || "0x644c5D77a34182Db01257bC4C469B01850bc6B2d";
  const polygonDemoTx = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TX_HASH || process.env.POLYGON_DEMO_TX_HASH);
  const iotaExplorerBaseUrl = clean(process.env.IOTA_EXPLORER_BASE_URL) || "https://explorer.evm.testnet.iota.cafe";
  const iotaContract = clean(process.env.IOTA_EVM_ANCHOR_CONTRACT);
  const cases = PUBLIC_PROOF_DEMO_CASES.map((demoCase) => {
    const txHash = iotaDemoTxFor(demoCase.id);
    const receiptTxHash = iotaReceiptTxFor(demoCase.id);
    return {
      ...demoCase,
      tx_hash: txHash || demoCase.tx_hash,
      explorer_url: explorerUrl(iotaExplorerBaseUrl, "tx", txHash) || demoCase.explorer_url,
      status: txHash ? "confirmed" : demoCase.status,
      network: txHash ? "iota-evm-testnet" : demoCase.network,
      public_receipt: {
        ...demoCase.public_receipt,
        tx_hash: receiptTxHash || null,
        explorer_url: explorerUrl(iotaExplorerBaseUrl, "tx", receiptTxHash),
      },
    };
  });
  const iotaDemoTx = cases.find((demoCase) => demoCase.tx_hash)?.tx_hash || "";

  return json({
    ok: true,
    cases,
    testnet: {
      iota: {
        mode: process.env.IOTA_PROVIDER_MODE || process.env.IOTA_PROOF_MODE || "disabled",
        network: "iota_evm_testnet",
        rpc_configured: Boolean(process.env.IOTA_EVM_RPC_URL),
        contract_configured: Boolean(process.env.IOTA_EVM_ANCHOR_CONTRACT),
        signer_configured: Boolean(process.env.IOTA_EVM_PRIVATE_KEY),
        deployer_address: clean(process.env.IOTA_EVM_DEPLOYER_ADDRESS) || null,
        contract_address: iotaContract || null,
        contract_explorer_url: explorerUrl(iotaExplorerBaseUrl, "address", iotaContract),
        demo_tx_hash: iotaDemoTx || null,
        demo_tx_explorer_url: explorerUrl(iotaExplorerBaseUrl, "tx", iotaDemoTx),
        demo_txs: Object.fromEntries(cases.map((demoCase) => [
          demoCase.id,
          {
            tx_hash: demoCase.tx_hash,
            explorer_url: demoCase.explorer_url,
            receipt_tx_hash: demoCase.public_receipt.tx_hash,
            receipt_explorer_url: demoCase.public_receipt.explorer_url,
          },
        ])),
      },
      polygon: {
        network: "amoy",
        rpc_configured: Boolean(process.env.POLYGON_RPC_URL),
        contract_configured: Boolean(process.env.POLYGON_CONTRACT_ADDRESS),
        signer_configured: Boolean(process.env.POLYGON_MINTER_PRIVATE_KEY),
        contract_address: polygonContract,
        owner_address: polygonOwner,
        contract_explorer_url: explorerUrl(polygonExplorerBaseUrl, "address", polygonContract),
        owner_explorer_url: explorerUrl(polygonExplorerBaseUrl, "address", polygonOwner),
        demo_tx_hash: polygonDemoTx || null,
        demo_tx_explorer_url: explorerUrl(polygonExplorerBaseUrl, "tx", polygonDemoTx),
      },
    },
    privacy: "Demo hashes are generated from canonical non-sensitive demo events. No customer, route manifest, UID or private key is exposed.",
  });
}
