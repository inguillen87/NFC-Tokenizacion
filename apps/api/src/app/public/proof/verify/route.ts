export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { canonicalSha256Hash, isSha256Hash, verifyHashInMerkleAnchor } from "../../../../lib/proof-layer";
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
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";

const MAX_PROOF_VERIFY_BODY_BYTES = 8 * 1024;

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
  const {
    input_hex: _inputHex,
    decoded_memo: _decodedMemo,
    decoded_call: _decodedCall,
    ...proof
  } = value;
  return proof;
}

async function verifyPublicProof(eventHash: string, anchorId = "") {
  if (!eventHash) return json({ ok: false, reason: "event_hash_required", verification_state: "invalid", evidence_level: "none" }, 400);
  if (!isSha256Hash(eventHash)) return json({ ok: false, reason: "event_hash_invalid", verification_state: "invalid", evidence_level: "none" }, 400);
  const canonicalEventHash = canonicalSha256Hash(eventHash);
  if (!canonicalEventHash) return json({ ok: false, reason: "event_hash_invalid", verification_state: "invalid", evidence_level: "none" }, 400);
  if (anchorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(anchorId)) {
    return json({ ok: false, reason: "anchor_id_invalid", message: "anchor_id must be a UUID.", verification_state: "invalid", evidence_level: "none" }, 400);
  }

  const demoCase = findPublicProofDemoCaseByHash(canonicalEventHash);
  const demoMembership = demoCase ? verifyHashInMerkleAnchor({
    eventHash: canonicalEventHash,
    eventHashes: demoCase.events.map((event) => event.hash),
    eventCount: demoCase.events.length,
    merkleRoot: demoCase.merkle_root,
  }) : null;
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
  const demoMatches: ProofMatch[] = demoCase && demoMembership?.included && (!anchorId || anchorId.toLowerCase() === demoCase.anchor_id.toLowerCase())
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
          WHERE event_hashes_json @> ${JSON.stringify([canonicalEventHash])}::jsonb
          ORDER BY created_at DESC
          LIMIT 8
        `;
    const includedRows = rows.filter((anchor) => verifyHashInMerkleAnchor({
      eventHash: canonicalEventHash,
      eventHashes: anchor.event_hashes_json,
      eventCount: anchor.event_count,
      merkleRoot: anchor.merkle_root,
    }).included);
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
          });
          const isV2 = verification.contract_version === "evidence_anchor_v2";
          const proofIdMatches = isV2
            ? Boolean(anchor.proof_id) && String(verification.proof_id || "").toLowerCase() === String(anchor.proof_id).toLowerCase()
            : !anchor.proof_id;
          const chainMatches = isV2
            ? Number.isSafeInteger(Number(anchor.chain_id)) && Number(verification.chain_id) === Number(anchor.chain_id)
            : !anchor.chain_id || Number(verification.chain_id) === Number(anchor.chain_id);
          const persistedContractMatches = !isV2 || (
            Boolean(anchor.contract_address)
            && String(verification.to || "").toLowerCase() === String(anchor.contract_address).toLowerCase()
          );
          const persistedPublisherMatches = !isV2 || (
            Boolean(anchor.publisher_address)
            && String(verification.from || "").toLowerCase() === String(anchor.publisher_address).toLowerCase()
          );
          const contractVersionMatches = !isV2 || anchor.contract_version === "evidence_anchor_v2";
          networkVerification = publicNetworkProof({
            ...verification,
            verified: Boolean(
              verification.verified
              && proofIdMatches
              && chainMatches
              && persistedContractMatches
              && persistedPublisherMatches
              && contractVersionMatches
            ),
            proof_id_matches: proofIdMatches,
            persisted_chain_matches: chainMatches,
            persisted_contract_matches: persistedContractMatches,
            persisted_publisher_matches: persistedPublisherMatches,
            persisted_contract_version_matches: contractVersionMatches,
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
        event_hash: canonicalEventHash,
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
  const usesDemoFixture = demoMatches.length > 0;
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
    event_hash: canonicalEventHash,
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
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "public-proof",
    subjectId: "proof-verify:public",
  });
  if (limited) return limited;
  const url = new URL(req.url);
  const eventHash = readText(url.searchParams.get("event_hash") || url.searchParams.get("hash"));
  const anchorId = readText(url.searchParams.get("anchor_id") || url.searchParams.get("anchorId"));
  if (eventHash.length > 80 || anchorId.length > 64) {
    return json({ ok: false, reason: "proof_input_too_large", verification_state: "invalid", evidence_level: "none" }, 413);
  }
  return verifyPublicProof(eventHash, anchorId);
}

export async function POST(req: Request) {
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "public-proof",
    subjectId: "proof-verify:public",
  });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_PROOF_VERIFY_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const eventHash = readText(body.event_hash || body.eventHash || body.hash);
  const anchorId = readText(body.anchor_id || body.anchorId);
  if (eventHash.length > 80 || anchorId.length > 64) {
    return json({ ok: false, reason: "proof_input_too_large", verification_state: "invalid", evidence_level: "none" }, 413);
  }
  return verifyPublicProof(eventHash, anchorId);
}
