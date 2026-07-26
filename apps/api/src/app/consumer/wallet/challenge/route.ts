export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import {
  buildWalletControlMessage,
  createWalletControlNonce,
  normalizeWalletAddress,
  normalizeWalletChainId,
  normalizeWalletProvider,
  WALLET_CONTROL_CHALLENGE_TTL_MS,
  WALLET_CONTROL_MAX_ATTEMPTS,
  walletControlAuditHash,
  walletNetworkFromChainId,
} from "../../../../lib/wallet-control";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { getRequestMeta } from "../../../../lib/request-meta";

function publicWebOrigin() {
  const configured = String(process.env.NEXT_PUBLIC_WEB_URL || "https://nexid.lat").trim();
  try {
    return new URL(configured).origin;
  } catch {
    return "https://nexid.lat";
  }
}

function requestAuditHash(value: string | null) {
  const normalized = String(value || "").split(",")[0]?.trim();
  return normalized ? walletControlAuditHash(normalized) : null;
}

export async function POST(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401, { "cache-control": "no-store" });
  const limited = await enforceCriticalRateLimit(req, { rateClass: "auth", tenantId: "consumer", subjectId: `consumer:${consumer.id}:wallet-challenge` });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 8 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400, { "cache-control": "no-store" });
  }
  await ensureConsumerPortalSchema();

  const address = normalizeWalletAddress(body.address || body.walletAddress || body.wallet_address);
  const chainId = normalizeWalletChainId(body.chainId || body.chain_id);
  const provider = normalizeWalletProvider(body.provider);
  if (!address) return json({ ok: false, error: "invalid_wallet_address" }, 400, { "cache-control": "no-store" });
  if (!chainId) return json({ ok: false, error: "invalid_chain_id" }, 400, { "cache-control": "no-store" });

  const recentRows = await sql/*sql*/`
    SELECT count(*)::integer AS count
    FROM consumer_wallet_challenges
    WHERE consumer_id = ${consumer.id}
      AND created_at > now() - interval '10 minutes'
  `;
  if (Number(recentRows[0]?.count || 0) >= 8) {
    return json({ ok: false, error: "wallet_challenge_rate_limited" }, 429, { "cache-control": "no-store" });
  }

  const challengeId = randomUUID();
  const nonce = createWalletControlNonce();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + WALLET_CONTROL_CHALLENGE_TTL_MS);
  const uri = publicWebOrigin();
  const domain = new URL(uri).host;
  const network = walletNetworkFromChainId(chainId);
  const message = buildWalletControlMessage({
    domain,
    uri,
    address,
    chainId,
    nonce,
    requestId: challengeId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  await sql/*sql*/`
    WITH invalidated AS (
      UPDATE consumer_wallet_challenges
      SET used_at = now()
      WHERE consumer_id = ${consumer.id}
        AND used_at IS NULL
      RETURNING id
    )
    INSERT INTO consumer_wallet_challenges (
      id,
      consumer_id,
      wallet_address,
      chain_id,
      wallet_network,
      wallet_provider,
      message,
      message_hash,
      expires_at,
      max_attempts,
      user_agent_hash,
      ip_hash
    ) VALUES (
      ${challengeId}::uuid,
      ${consumer.id},
      ${address.toLowerCase()},
      ${chainId},
      ${network},
      ${provider},
      ${message},
      ${walletControlAuditHash(message)},
      ${expiresAt.toISOString()}::timestamptz,
      ${WALLET_CONTROL_MAX_ATTEMPTS},
      ${requestAuditHash(req.headers.get("user-agent"))},
      ${requestAuditHash(getRequestMeta(req).ip)}
    )
  `;

  return json({
    ok: true,
    challenge: {
      id: challengeId,
      address,
      chainId,
      network,
      provider,
      message,
      expiresAt: expiresAt.toISOString(),
      standard: "EIP-191 personal_sign",
      sendsTransaction: false,
    },
  }, 200, { "cache-control": "no-store" });
}
