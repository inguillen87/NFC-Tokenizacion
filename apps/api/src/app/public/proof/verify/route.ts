export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { isSha256Hash, verifyHashInAnchor } from "../../../../lib/proof-layer";
import { findPublicProofDemoCaseByHash } from "../../../../lib/public-proof-demos";
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

function readText(value: unknown) {
  return String(value || "").trim();
}

type ProofMatch = {
  anchor_id: string;
  provider: string;
  network: string;
  merkle_root: string;
  tx_hash: string | null;
  explorer_url: string | null;
  status: string;
  anchored_at: unknown;
  demo_fixture: boolean;
  network_verified?: boolean;
  network_verification?: Record<string, unknown> | null;
};

function publicNetworkProof(value: Record<string, unknown> | null) {
  if (!value) return null;
  const { input_hex: _inputHex, decoded_memo: _decodedMemo, ...proof } = value;
  return proof;
}

async function verifyPublicProof(eventHash: string, anchorId = "") {
  if (!eventHash) return json({ ok: false, reason: "event_hash_required", verification_state: "invalid", evidence_level: "none" }, 400);
  if (!isSha256Hash(eventHash)) return json({ ok: false, reason: "event_hash_invalid", verification_state: "invalid", evidence_level: "none" }, 400);
  if (anchorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(anchorId)) {
    return json({ ok: false, reason: "anchor_id_invalid", message: "anchor_id must be a UUID.", verification_state: "invalid", evidence_level: "none" }, 400);
  }

  const demoCase = findPublicProofDemoCaseByHash(eventHash);
  const demoTxHash = demoCase ? publicProofIotaAnchorTx(demoCase.id) : "";
  const receiptTxHash = demoCase ? publicProofIotaReceiptTx(demoCase.id) : "";
  const demoExplorerUrl = publicProofIotaExplorerUrl(demoTxHash);
  const receiptExplorerUrl = publicProofIotaExplorerUrl(receiptTxHash);
  const [demoAnchorVerification, demoReceiptVerification] = demoCase
    ? await Promise.all([
        demoTxHash
          ? verifyIotaAnchorPublication({
              txHash: demoTxHash,
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
      ])
    : [null, null];
  const demoNetworkVerified = Boolean(demoAnchorVerification?.verified && demoReceiptVerification?.verified);
  const demoMatches: ProofMatch[] = demoCase && (!anchorId || anchorId.toLowerCase() === demoCase.anchor_id.toLowerCase())
    ? [{
        anchor_id: demoCase.anchor_id,
        provider: demoCase.provider,
        network: demoTxHash ? "iota-evm-testnet" : demoCase.network,
        merkle_root: demoCase.merkle_root,
        tx_hash: demoTxHash || demoCase.tx_hash,
        explorer_url: demoExplorerUrl || demoCase.explorer_url,
        status: demoNetworkVerified ? "confirmed" : demoTxHash ? "configured" : demoCase.status,
        anchored_at: demoCase.anchored_at,
        demo_fixture: true,
        network_verified: demoNetworkVerified,
        network_verification: publicNetworkProof(demoAnchorVerification),
      }]
    : [];
  let matches: ProofMatch[] = [];
  let registryWarning: string | null = null;

  try {
    await ensureSupplierOpsSchema();
    const rows = anchorId
      ? await sql/*sql*/`
          SELECT id, provider, network, merkle_root, event_hashes_json, tx_hash, explorer_url, status, anchored_at, created_at,
                 resource_type, resource_id, public_resource_id, event_count, tenant_id_hash, memo_hash,
                 proof_id, contract_version, chain_id, contract_address, publisher_address
          FROM evidence_anchors
          WHERE id = ${anchorId}::uuid
          LIMIT 1
        `
      : await sql/*sql*/`
          SELECT id, provider, network, merkle_root, event_hashes_json, tx_hash, explorer_url, status, anchored_at, created_at,
                 resource_type, resource_id, public_resource_id, event_count, tenant_id_hash, memo_hash,
                 proof_id, contract_version, chain_id, contract_address, publisher_address
          FROM evidence_anchors
          WHERE event_hashes_json @> ${JSON.stringify([eventHash])}::jsonb
          ORDER BY created_at DESC
          LIMIT 50
        `;
    const includedRows = rows.filter((anchor) => (
      verifyHashInAnchor(eventHash, Array.isArray(anchor.event_hashes_json) ? anchor.event_hashes_json : [])
    ));
    matches = await Promise.all(includedRows.map(async (anchor) => {
      let networkVerification: Record<string, unknown> | null = null;
      if (anchor.provider === "iota" && anchor.tx_hash) {
        try {
          const verification = await verifyIotaAnchorPublication({
            txHash: anchor.tx_hash,
            merkleRoot: anchor.merkle_root,
            tenantIdHash: anchor.tenant_id_hash,
            resourceType: anchor.resource_type,
            resourceId: anchor.public_resource_id || anchor.resource_id,
            eventCount: Number(anchor.event_count),
            memoHash: anchor.memo_hash || undefined,
            contractAddress: anchor.contract_address || undefined,
            publisherAddress: anchor.publisher_address || undefined,
          });
          const proofIdMatches = !anchor.proof_id
            || String(verification.proof_id || "").toLowerCase() === String(anchor.proof_id).toLowerCase();
          const chainMatches = !anchor.chain_id || Number(verification.chain_id) === Number(anchor.chain_id);
          networkVerification = publicNetworkProof({
            ...verification,
            verified: Boolean(verification.verified && proofIdMatches && chainMatches),
            proof_id_matches: proofIdMatches,
            persisted_chain_matches: chainMatches,
          });
        } catch {
          networkVerification = { verified: false, reason: "iota_rpc_verification_unavailable" };
        }
      }
      return {
        anchor_id: anchor.id,
        provider: anchor.provider,
        network: anchor.network,
        merkle_root: anchor.merkle_root,
        tx_hash: anchor.tx_hash || null,
        explorer_url: anchor.explorer_url || null,
        status: anchor.status,
        anchored_at: anchor.anchored_at || anchor.created_at,
        demo_fixture: false,
        network_verified: networkVerification?.verified === true,
        network_verification: networkVerification,
      };
    }));
  } catch {
    registryWarning = "private_anchor_registry_unavailable";
    if (!demoMatches.length) {
      return json({
        ok: false,
        valid: false,
        included: false,
        reason: registryWarning,
        verification_state: "unavailable",
        evidence_level: "none",
        event_hash: eventHash,
        privacy: "Verification is hash-only; no raw product, customer or business data is exposed.",
      }, 503);
    }
  }

  const effectiveMatches = Array.from(
    new Map([...matches, ...demoMatches].map((match) => [String(match.anchor_id), match])).values(),
  );
  const included = effectiveMatches.length > 0;
  const externallyConfirmed = effectiveMatches.some((match) => (
    match.network_verified === true
  ));
  const statuses = new Set(effectiveMatches.map((match) => String(match.status || "").toLowerCase()));
  const verificationState = !included
    ? "not_included"
    : externallyConfirmed
      ? "confirmed"
      : statuses.has("failed")
        ? "failed"
        : statuses.has("submitted")
          ? "submitted"
          : "local";
  const usesDemoFixture = Boolean(demoCase && included);
  const evidenceLevel = usesDemoFixture
    ? demoNetworkVerified ? "testnet_rpc" : "testnet_fixture"
    : externallyConfirmed
      ? "external_anchor"
      : included
        ? "registry_only"
        : "none";
  const firstMatch = effectiveMatches[0] || null;
  const effectiveDemoCase = demoMatches.length && demoCase
    ? {
        ...demoCase,
        tx_hash: demoTxHash || demoCase.tx_hash,
        explorer_url: demoExplorerUrl || demoCase.explorer_url,
        status: demoNetworkVerified ? "confirmed" : demoTxHash ? "configured" : demoCase.status,
        network: demoTxHash ? "iota-evm-testnet" : demoCase.network,
        network_verification: {
          anchor: publicNetworkProof(demoAnchorVerification),
          receipt: publicNetworkProof(demoReceiptVerification),
        },
        public_receipt: {
          ...demoCase.public_receipt,
          tx_hash: receiptTxHash || null,
          explorer_url: receiptExplorerUrl,
          status: demoReceiptVerification?.verified ? "confirmed" : receiptTxHash ? "configured" : "unavailable",
        },
      }
    : null;
  return json({
    ok: true,
    valid: externallyConfirmed,
    included,
    externally_confirmed: externallyConfirmed,
    verification_state: verificationState,
    evidence_level: evidenceLevel,
    demo: usesDemoFixture,
    event_hash: eventHash,
    provider: firstMatch?.provider || null,
    network: firstMatch?.network || null,
    merkle_root: firstMatch?.merkle_root || null,
    tx_hash: firstMatch?.tx_hash || null,
    explorer_url: firstMatch?.explorer_url || null,
    matches: effectiveMatches,
    demo_case: effectiveDemoCase,
    network_verification: usesDemoFixture ? {
      anchor: publicNetworkProof(demoAnchorVerification),
      receipt: publicNetworkProof(demoReceiptVerification),
    } : null,
    registry_warning: registryWarning,
    privacy: "Verification is hash-only; no raw product, customer or business data is exposed.",
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventHash = readText(url.searchParams.get("event_hash") || url.searchParams.get("hash"));
  const anchorId = readText(url.searchParams.get("anchor_id") || url.searchParams.get("anchorId"));
  return verifyPublicProof(eventHash, anchorId);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const eventHash = readText(body.event_hash || body.eventHash || body.hash);
  const anchorId = readText(body.anchor_id || body.anchorId);
  return verifyPublicProof(eventHash, anchorId);
}
