export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { verifyWalletControlSignature, walletControlAuditHash } from "../../../../lib/wallet-control";

function cleanText(value: unknown, max = 220) {
  return String(value || "").trim().slice(0, max);
}

function maskAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function POST(req: Request) {
  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const challengeId = cleanText(body.challengeId || body.challenge_id, 80);
  const signature = cleanText(body.signature, 220);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challengeId)) {
    return json({ ok: false, error: "invalid_wallet_challenge" }, 400, { "cache-control": "no-store" });
  }
  if (!/^0x[0-9a-f]{130}$/i.test(signature)) {
    return json({ ok: false, error: "invalid_wallet_signature" }, 400, { "cache-control": "no-store" });
  }

  const challengeRows = await sql/*sql*/`
    SELECT id, consumer_id, wallet_address, chain_id, wallet_network, wallet_provider,
           message, message_hash, expires_at, used_at, attempt_count, max_attempts
    FROM consumer_wallet_challenges
    WHERE id = ${challengeId}::uuid
      AND consumer_id = ${consumer.id}
    LIMIT 1
  `;
  const challenge = challengeRows[0];
  if (!challenge) return json({ ok: false, error: "wallet_challenge_not_found" }, 404, { "cache-control": "no-store" });
  if (challenge.used_at) return json({ ok: false, error: "wallet_challenge_already_used" }, 409, { "cache-control": "no-store" });
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    return json({ ok: false, error: "wallet_challenge_expired" }, 410, { "cache-control": "no-store" });
  }
  if (Number(challenge.attempt_count || 0) >= Number(challenge.max_attempts || 5)) {
    return json({ ok: false, error: "wallet_challenge_locked" }, 429, { "cache-control": "no-store" });
  }
  if (walletControlAuditHash(String(challenge.message)) !== String(challenge.message_hash)) {
    return json({ ok: false, error: "wallet_challenge_integrity_failed" }, 500, { "cache-control": "no-store" });
  }

  const signatureValid = verifyWalletControlSignature({
    message: String(challenge.message),
    signature,
    address: String(challenge.wallet_address),
  });
  if (!signatureValid) {
    await sql/*sql*/`
      UPDATE consumer_wallet_challenges
      SET attempt_count = attempt_count + 1,
          used_at = CASE WHEN attempt_count + 1 >= max_attempts THEN now() ELSE used_at END
      WHERE id = ${challengeId}::uuid
        AND consumer_id = ${consumer.id}
        AND used_at IS NULL
    `;
    return json({ ok: false, error: "wallet_signature_does_not_match" }, 401, { "cache-control": "no-store" });
  }

  const signatureHash = walletControlAuditHash(signature);
  const rows = await sql/*sql*/`
    WITH claimed_challenge AS (
      UPDATE consumer_wallet_challenges
      SET used_at = now(),
          attempt_count = attempt_count + 1,
          signature_hash = ${signatureHash}
      WHERE id = ${challengeId}::uuid
        AND consumer_id = ${consumer.id}
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING wallet_address, chain_id, wallet_network, wallet_provider
    ),
    claimed_identity AS (
      INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
      SELECT ${consumer.id}, 'web3_wallet', lower(wallet_address), now()
      FROM claimed_challenge
      ON CONFLICT (provider, provider_subject)
      DO UPDATE SET verified_at = now(), updated_at = now()
      WHERE consumer_identities.consumer_id = EXCLUDED.consumer_id
      RETURNING consumer_id
    ),
    updated_consumer AS (
      UPDATE consumers c
      SET wallet_address = lower(ch.wallet_address),
          wallet_chain_id = ch.chain_id,
          wallet_network = ch.wallet_network,
          wallet_verified_at = now(),
          status = 'verified'::consumer_status,
          updated_at = now()
      FROM claimed_challenge ch
      WHERE c.id = ${consumer.id}
        AND EXISTS (SELECT 1 FROM claimed_identity ci WHERE ci.consumer_id = c.id)
      RETURNING c.id, c.wallet_address, c.wallet_chain_id, c.wallet_network, c.wallet_verified_at
    )
    SELECT u.*, ch.wallet_provider
    FROM updated_consumer u
    JOIN claimed_challenge ch ON true
  `;

  const wallet = rows[0];
  if (!wallet) {
    return json({ ok: false, error: "wallet_already_linked_to_another_account" }, 409, { "cache-control": "no-store" });
  }
  return json({
    ok: true,
    wallet: {
      address: wallet.wallet_address,
      addressMasked: maskAddress(String(wallet.wallet_address)),
      chainId: wallet.wallet_chain_id || null,
      network: wallet.wallet_network || null,
      provider: wallet.wallet_provider || null,
      verifiedAt: wallet.wallet_verified_at || null,
      controlVerified: true,
      verificationMethod: "eip191_signature",
    },
  }, 200, { "cache-control": "no-store" });
}
