export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { isSha256Hash, verifyHashInAnchor } from "../../../../lib/proof-layer";
import { findPublicProofDemoCaseByHash } from "../../../../lib/public-proof-demos";

function readText(value: unknown) {
  return String(value || "").trim();
}

function cleanEnv(value: unknown) {
  const text = String(value || "").trim();
  if (!text || text === "\"\"" || text === "''") return "";
  return text.replace(/^['"]|['"]$/g, "").trim();
}

function envKeySuffix(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function demoIotaTxFor(caseId: string) {
  return cleanEnv(process.env[`PUBLIC_PROOF_DEMO_IOTA_TX_HASH_${envKeySuffix(caseId)}`])
    || cleanEnv(process.env.PUBLIC_PROOF_DEMO_IOTA_TX_HASH)
    || cleanEnv(process.env.IOTA_DEMO_TX_HASH);
}

function demoReceiptTxFor(caseId: string) {
  return cleanEnv(process.env[`PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH_${envKeySuffix(caseId)}`])
    || cleanEnv(process.env.PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH);
}

function txExplorerUrl(baseUrl: string, txHash: string) {
  if (!baseUrl || !txHash) return null;
  return `${baseUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

async function verifyPublicProof(eventHash: string, anchorId = "") {
  if (!eventHash) return json({ ok: false, reason: "event_hash_required", verification_state: "invalid", evidence_level: "none" }, 400);
  if (!isSha256Hash(eventHash)) return json({ ok: false, reason: "event_hash_invalid", verification_state: "invalid", evidence_level: "none" }, 400);
  if (anchorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(anchorId)) {
    return json({ ok: false, reason: "anchor_id_invalid", message: "anchor_id must be a UUID.", verification_state: "invalid", evidence_level: "none" }, 400);
  }

  const demoCase = findPublicProofDemoCaseByHash(eventHash);
  const demoTxHash = demoCase ? demoIotaTxFor(demoCase.id) : "";
  const receiptTxHash = demoCase ? demoReceiptTxFor(demoCase.id) : "";
  const iotaExplorerBaseUrl = cleanEnv(process.env.IOTA_EXPLORER_BASE_URL) || "https://explorer.evm.testnet.iota.cafe";
  const demoExplorerUrl = demoTxHash
    ? txExplorerUrl(iotaExplorerBaseUrl, demoTxHash)
    : null;
  const receiptExplorerUrl = receiptTxHash ? txExplorerUrl(iotaExplorerBaseUrl, receiptTxHash) : null;
  const demoMatches = demoCase && (!anchorId || anchorId.toLowerCase() === demoCase.anchor_id.toLowerCase())
    ? [{
        anchor_id: demoCase.anchor_id,
        provider: demoCase.provider,
        network: demoTxHash ? "iota-evm-testnet" : demoCase.network,
        merkle_root: demoCase.merkle_root,
        tx_hash: demoTxHash || demoCase.tx_hash,
        explorer_url: demoExplorerUrl || demoCase.explorer_url,
        status: demoTxHash ? "confirmed" : demoCase.status,
        anchored_at: demoCase.anchored_at,
      }]
    : [];
  let matches: typeof demoMatches = [];
  let registryWarning: string | null = null;

  try {
    await ensureSupplierOpsSchema();
    const rows = anchorId
      ? await sql/*sql*/`
          SELECT id, provider, network, merkle_root, event_hashes_json, tx_hash, explorer_url, status, anchored_at, created_at
          FROM evidence_anchors
          WHERE id = ${anchorId}::uuid
          LIMIT 1
        `
      : await sql/*sql*/`
          SELECT id, provider, network, merkle_root, event_hashes_json, tx_hash, explorer_url, status, anchored_at, created_at
          FROM evidence_anchors
          WHERE event_hashes_json @> ${JSON.stringify([eventHash])}::jsonb
          ORDER BY created_at DESC
          LIMIT 50
        `;
    matches = rows
      .filter((anchor) => verifyHashInAnchor(eventHash, Array.isArray(anchor.event_hashes_json) ? anchor.event_hashes_json : []))
      .map((anchor) => ({
        anchor_id: anchor.id,
        provider: anchor.provider,
        network: anchor.network,
        merkle_root: anchor.merkle_root,
        tx_hash: anchor.tx_hash || null,
        explorer_url: anchor.explorer_url || null,
        status: anchor.status,
        anchored_at: anchor.anchored_at || anchor.created_at,
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
  const externallyConfirmed = effectiveMatches.some((match) => String(match.status || "").toLowerCase() === "confirmed" && Boolean(match.tx_hash));
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
    ? "testnet_fixture"
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
        status: demoTxHash ? "confirmed" : demoCase.status,
        network: demoTxHash ? "iota-evm-testnet" : demoCase.network,
        public_receipt: {
          ...demoCase.public_receipt,
          tx_hash: receiptTxHash || null,
          explorer_url: receiptExplorerUrl,
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
