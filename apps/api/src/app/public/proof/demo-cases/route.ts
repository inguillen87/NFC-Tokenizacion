export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { PUBLIC_PROOF_DEMO_CASES } from "../../../../lib/public-proof-demos";
import { readPublicPolygonOwnershipCertificate } from "../../../../lib/public-polygon-ownership";
import {
  iotaAnchorTenantHash,
  verifyIotaAnchorPublication,
  verifyIotaMemoPublication,
} from "../../../../lib/iota-evm-proof";
import {
  publicProofIotaAnchorTx,
  publicProofIotaContractAddress,
  publicProofIotaContractVersion,
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function GET() {
  const polygonExplorerBaseUrl = clean(process.env.POLYGON_EXPLORER_BASE_URL) || "https://amoy.polygonscan.com";
  const polygonApiBaseUrl = (clean(process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL) || "https://api.nexid.lat").replace(/\/$/, "");
  const iotaExplorerBaseUrl = clean(process.env.IOTA_EXPLORER_BASE_URL) || "https://explorer.evm.testnet.iota.cafe";
  const iotaContract = publicProofIotaContractAddress();
  const [cases, polygonCertificateValue] = await Promise.all([
    Promise.all(PUBLIC_PROOF_DEMO_CASES.map(async (demoCase) => {
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
              memoHash: demoCase.public_receipt.receipt_hash,
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
    })),
    readPublicPolygonOwnershipCertificate(),
  ]);
  const polygonCertificate = asRecord(polygonCertificateValue);
  const polygonMint = asRecord(polygonCertificate.mint);
  const polygonOwnerSnapshot = asRecord(polygonCertificate.owner);
  const polygonMetadata = asRecord(polygonCertificate.metadata);
  const polygonLinks = asRecord(polygonCertificate.links);
  const polygonChecks = Array.isArray(polygonCertificate.checks)
    ? polygonCertificate.checks.map(asRecord)
    : [];
  const polygonRpcVerified = polygonCertificate.ok === true
    && polygonCertificate.verification_state === "confirmed"
    && polygonMint.status === "confirmed"
    && polygonMint.events_match === true;
  const polygonContract = clean(polygonCertificate.contract_address)
    || clean(process.env.POLYGON_CONTRACT_ADDRESS)
    || "0x673CAE3D79f825bba9cfb2096184c295A5C9Eb4C";
  const polygonOwner = clean(polygonOwnerSnapshot.address)
    || clean(process.env.POLYGON_MINTER_ADDRESS || process.env.POLYGON_DEPLOY_OWNER)
    || "0x644c5D77a34182Db01257bC4C469B01850bc6B2d";
  const polygonDemoTx = clean(polygonMint.tx_hash)
    || clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TX_HASH || process.env.POLYGON_DEMO_TX_HASH);
  const polygonDemoTokenId = clean(polygonCertificate.token_id)
    || clean(process.env.PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID);
  const polygonMetadataUrl = clean(polygonLinks.metadata)
    || `${polygonApiBaseUrl}/public/polygon/metadata/ownership-v2`;
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
        contract_configured: Boolean(iotaContract),
        contract_version: publicProofIotaContractVersion(),
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
        rpc_verified: polygonRpcVerified,
        verification_state: clean(polygonCertificate.verification_state) || "unavailable",
        evidence_level: polygonRpcVerified ? "testnet_rpc" : "configured_reference",
        verified_at: clean(polygonCertificate.generated_at) || null,
        contract_address: polygonContract,
        owner_address: polygonOwner,
        owner_custody: clean(polygonOwnerSnapshot.custody) || null,
        wallet_control_verified: polygonOwnerSnapshot.wallet_control_verified === true,
        claim_state: polygonOwnerSnapshot.wallet_control_verified === true ? "buyer_controlled" : "platform_custody_pilot",
        contract_explorer_url: clean(polygonLinks.contract_explorer) || explorerUrl(polygonExplorerBaseUrl, "address", polygonContract),
        owner_explorer_url: clean(polygonLinks.owner_explorer) || explorerUrl(polygonExplorerBaseUrl, "address", polygonOwner),
        demo_tx_hash: polygonDemoTx || null,
        demo_tx_explorer_url: clean(polygonLinks.transaction_explorer) || explorerUrl(polygonExplorerBaseUrl, "tx", polygonDemoTx),
        demo_token_id: polygonDemoTokenId || null,
        metadata_url: polygonMetadataUrl,
        metadata_verified: polygonMetadata.document_ok === true && polygonMetadata.image_ok === true,
        mint_events_match: polygonMint.events_match === true,
        source_verified: polygonChecks.some((check) => check.id === "source" && check.ok === true),
        ownership_certificate_url: "https://nexid.lat/proof/ownership",
        certificate_url: clean(polygonLinks.certificate) || "https://nexid.lat/proof/ownership",
      },
    },
    privacy: "Demo hashes are generated from canonical non-sensitive demo events. No customer, route manifest, UID or private key is exposed.",
  }, 200, { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" });
}
