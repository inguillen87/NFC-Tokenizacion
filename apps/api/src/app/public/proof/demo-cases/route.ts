export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { PUBLIC_PROOF_DEMO_CASES } from "../../../../lib/public-proof-demos";
import {
  iotaAnchorTenantHash,
  verifyIotaAnchorPublication,
  verifyIotaMemoPublication,
} from "../../../../lib/iota-evm-proof";
import {
  publicProofIotaAnchorTx,
  publicProofIotaExplorerUrl,
  publicProofIotaReceiptTx,
} from "../../../../lib/public-proof-runtime";

function clean(value: unknown) {
  const text = String(value || "").trim();
  if (!text || text === "\"\"" || text === "''") return "";
  return text.replace(/^['"]|['"]$/g, "").trim();
}

function explorerUrl(baseUrl: string, kind: "address" | "tx", value: string) {
  if (!baseUrl || !value) return null;
  return `${baseUrl.replace(/\/$/, "")}/${kind}/${value}`;
}

function publicNetworkProof(value: Record<string, unknown> | null) {
  if (!value) return null;
  const { input_hex: _inputHex, decoded_memo: _decodedMemo, ...proof } = value;
  return proof;
}

export async function GET() {
  const polygonExplorerBaseUrl = clean(process.env.POLYGON_EXPLORER_BASE_URL) || "https://amoy.polygonscan.com";
  const polygonContract = clean(process.env.POLYGON_CONTRACT_ADDRESS) || "0x673CAE3D79f825bba9cfb2096184c295A5C9Eb4C";
  const polygonOwner = clean(process.env.POLYGON_MINTER_ADDRESS || process.env.POLYGON_DEPLOY_OWNER) || "0x644c5D77a34182Db01257bC4C469B01850bc6B2d";
  const polygonDemoTx = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TX_HASH || process.env.POLYGON_DEMO_TX_HASH);
  const polygonDemoTokenId = clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID);
  const polygonApiBaseUrl = (clean(process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL) || "https://api.nexid.lat").replace(/\/$/, "");
  const polygonMetadataUrl = `${polygonApiBaseUrl}/public/polygon/metadata/ownership-v2`;
  const iotaExplorerBaseUrl = clean(process.env.IOTA_EXPLORER_BASE_URL) || "https://explorer.evm.testnet.iota.cafe";
  const iotaContract = clean(process.env.IOTA_EVM_ANCHOR_CONTRACT);
  const cases = await Promise.all(PUBLIC_PROOF_DEMO_CASES.map(async (demoCase) => {
    const txHash = publicProofIotaAnchorTx(demoCase.id);
    const receiptTxHash = publicProofIotaReceiptTx(demoCase.id);
    const [anchorVerification, receiptVerification] = await Promise.all([
      txHash
        ? verifyIotaAnchorPublication({
            txHash,
            merkleRoot: demoCase.merkle_root,
            tenantIdHash: iotaAnchorTenantHash("public-demo"),
            resourceType: demoCase.resource_type,
            resourceId: demoCase.resource_id,
            eventCount: demoCase.events.length,
          })
        : Promise.resolve(null),
      receiptTxHash
        ? verifyIotaMemoPublication(receiptTxHash, demoCase.public_receipt.on_chain_memo)
        : Promise.resolve(null),
    ]);
    return {
      ...demoCase,
      tx_hash: txHash || demoCase.tx_hash,
      explorer_url: publicProofIotaExplorerUrl(txHash) || demoCase.explorer_url,
      status: anchorVerification?.verified ? "confirmed" : txHash ? "configured" : demoCase.status,
      network: txHash ? "iota-evm-testnet" : demoCase.network,
      network_verification: {
        anchor: publicNetworkProof(anchorVerification),
        receipt: publicNetworkProof(receiptVerification),
      },
      public_receipt: {
        ...demoCase.public_receipt,
        tx_hash: receiptTxHash || null,
        explorer_url: publicProofIotaExplorerUrl(receiptTxHash),
        status: receiptVerification?.verified ? "confirmed" : receiptTxHash ? "configured" : "unavailable",
      },
    };
  }));
  const iotaDemoTx = cases.find((demoCase) => demoCase.tx_hash)?.tx_hash || "";
  const verifiedAnchorCount = cases.filter((demoCase) => demoCase.network_verification.anchor?.verified === true).length;
  const verifiedReceiptCount = cases.filter((demoCase) => demoCase.network_verification.receipt?.verified === true).length;

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
        rpc_verified: verifiedAnchorCount === cases.length && verifiedReceiptCount === cases.length,
        verified_anchor_count: verifiedAnchorCount,
        verified_receipt_count: verifiedReceiptCount,
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
        demo_token_id: polygonDemoTokenId || null,
        metadata_url: polygonMetadataUrl,
        ownership_certificate_url: "https://nexid.lat/proof/ownership",
      },
    },
    privacy: "Demo hashes are generated from canonical non-sensitive demo events. No customer, route manifest, UID or private key is exposed.",
  }, 200, { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" });
}
