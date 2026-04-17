import { createHash, randomBytes } from "node:crypto";
import { sql } from "./db";

type AnchorInput = {
  requestId: string;
  network?: string;
  issuerWallet?: string | null;
  processor?: string;
};

function buildSimulatedTxHash(requestId: string, uid: string) {
  return `0x${createHash("sha256").update(`${requestId}:${uid}:${Date.now()}`).digest("hex")}`;
}

function buildTokenId(uid: string) {
  return createHash("sha1").update(uid).digest("hex").slice(0, 16);
}

async function runExternalExecutor(payload: Record<string, unknown>) {
  const url = (process.env.TOKENIZATION_EXECUTOR_URL || "").trim();
  if (!url) return null;

  const secret = (process.env.TOKENIZATION_EXECUTOR_SECRET || "").trim();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-tokenization-secret": secret } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`executor_http_${response.status}`);
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

export async function anchorTokenizationRequest(input: AnchorInput) {
  const rows = await sql/*sql*/`
    SELECT id, bid, uid_hex, status, network, issuer_wallet, attempt_count
    FROM tokenization_requests
    WHERE id = ${input.requestId}::uuid
    LIMIT 1
  `;
  const existing = rows[0];
  if (!existing) return { ok: false, reason: "request_not_found" } as const;
  if (existing.status === "anchored") return { ok: true, status: "anchored", already_processed: true, request: existing } as const;

  const network = input.network || existing.network || "polygon-amoy";
  const issuerWallet = input.issuerWallet || existing.issuer_wallet || null;
  const processor = input.processor || "tokenization_engine";

  try {
    const external = await runExternalExecutor({
      request_id: existing.id,
      bid: existing.bid,
      uid_hex: existing.uid_hex,
      network,
      issuer_wallet: issuerWallet,
    });

    const txHash = String(external?.tx_hash || buildSimulatedTxHash(existing.id, existing.uid_hex));
    const tokenId = String(external?.token_id || buildTokenId(existing.uid_hex));
    const anchorHash = String(external?.anchor_hash || `0x${randomBytes(32).toString("hex")}`);
    const externalRef = external?.external_ref ? String(external.external_ref) : null;

    await sql/*sql*/`
      UPDATE tokenization_requests
      SET status = 'anchored',
          network = ${network},
          issuer_wallet = COALESCE(${issuerWallet}, issuer_wallet),
          tx_hash = ${txHash},
          token_id = ${tokenId},
          anchor_hash = ${anchorHash},
          external_ref = COALESCE(${externalRef}, external_ref),
          processed_at = now(),
          last_error = NULL,
          attempt_count = attempt_count + 1,
          meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, anchored_at: new Date().toISOString() })}::jsonb
      WHERE id = ${existing.id}::uuid
    `;

    await sql/*sql*/`
      INSERT INTO demo_cta_actions (action, bid, uid_hex, payload)
      VALUES (
        'ledger_anchored',
        ${existing.bid},
        ${existing.uid_hex},
        ${JSON.stringify({ tx_hash: txHash, token_id: tokenId, network, anchor_hash: anchorHash, issuer_wallet: issuerWallet, external_ref: externalRef })}::jsonb
      )
    `;

    return { ok: true, status: "anchored", request_id: existing.id, tx_hash: txHash, token_id: tokenId, network, anchor_hash: anchorHash } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "tokenization_failed";
    const attempts = Number(existing.attempt_count || 0) + 1;
    const retryMs = Math.min(15 * 60 * 1000, 30_000 * attempts);
    const nextAttemptAt = new Date(Date.now() + retryMs).toISOString();
    const nextStatus = attempts >= 6 ? "failed" : "pending";

    await sql/*sql*/`
      UPDATE tokenization_requests
      SET status = ${nextStatus},
          attempt_count = attempt_count + 1,
          last_error = ${message},
          next_attempt_at = ${nextAttemptAt}::timestamptz,
          meta = COALESCE(meta, '{}'::jsonb) || ${JSON.stringify({ processor, failed_at: new Date().toISOString() })}::jsonb
      WHERE id = ${existing.id}::uuid
    `;

    return { ok: false, reason: message, request_id: existing.id, status: nextStatus, next_attempt_at: nextAttemptAt } as const;
  }
}
