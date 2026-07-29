export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, randomBytes } from "node:crypto";
import { isAddress } from "ethers";
import { sessionCookieHeader } from "../../../../lib/consumer-auth";
import { ensureConsumerAuthSchema } from "../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { getRequestMeta } from "../../../../lib/request-meta";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { resolveVerifiedClerkIdentity } from "../../../../lib/clerk-admin-auth";

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanText(value: unknown, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function maskAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function POST(req: Request) {
  const sourceLimited = await enforceCriticalRateLimit(req, {
    rateClass: "auth",
    tenantId: "platform",
    subjectId: "consumer-auth-web3:unauthenticated",
  });
  if (sourceLimited) return sourceLimited;
  const clerk = await resolveVerifiedClerkIdentity(req);
  if (!clerk.ok) return json({ ok: false, error: clerk.reason }, clerk.status);

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const externalUserId = cleanText(clerk.identity.externalUserId, 120);
  const displayName = cleanText(clerk.identity.fullName || "Usuario Web3 nexID", 120);
  const verifiedWallet = clerk.identity.verifiedWeb3Wallets[0] || null;
  const walletAddress = cleanText(verifiedWallet?.address, 64);
  const normalizedWallet = walletAddress && isAddress(walletAddress) ? walletAddress.toLowerCase() : "";
  const chainId = cleanText(body.chainId, 24);
  const provider = cleanText(verifiedWallet?.provider || "clerk_web3", 60);
  if (!externalUserId) return json({ ok: false, error: "clerk_user_required" }, 401);
  if (!normalizedWallet) {
    return json({ ok: false, error: "verified_clerk_wallet_required" }, 400);
  }

  await ensureConsumerAuthSchema();
  const linkedIdentityRows = await sql/*sql*/`
    SELECT DISTINCT consumer_id
    FROM consumer_identities
    WHERE (provider = 'clerk_web3' AND provider_subject = ${externalUserId})
       OR (provider = 'web3_wallet' AND lower(provider_subject) = ${normalizedWallet})
  `;
  const linkedConsumerIds = [...new Set(linkedIdentityRows.map((row) => String(row.consumer_id)))];
  if (linkedConsumerIds.length > 1) return json({ ok: false, error: "web3_identity_conflict" }, 409);
  const linkedConsumerId = linkedConsumerIds[0] || null;

  if (!linkedConsumerId) {
    const legacyWallet = await sql/*sql*/`
      SELECT id FROM consumers
      WHERE lower(wallet_address) = ${normalizedWallet}
      LIMIT 1
    `;
    if (legacyWallet[0]) {
      return json({ ok: false, error: "wallet_account_link_required" }, 409);
    }
  }

  const requestMeta = getRequestMeta(req);
  const rawSession = randomBytes(24).toString("hex");
  const sessionHash = sha(rawSession);
  let rows;
  try {
    rows = linkedConsumerId
      ? await sql/*sql*/`
        WITH updated_consumer AS MATERIALIZED (
          UPDATE consumers consumer
          SET display_name = COALESCE(consumer.display_name, ${displayName || null}),
              wallet_address = ${normalizedWallet},
              wallet_chain_id = COALESCE(NULLIF(${chainId}, ''), consumer.wallet_chain_id),
              wallet_network = COALESCE(NULLIF(${provider}, ''), consumer.wallet_network),
              wallet_verified_at = now(),
              last_login_at = now(),
              updated_at = now()
          WHERE consumer.id = ${linkedConsumerId}
            AND (consumer.wallet_address IS NULL OR lower(consumer.wallet_address) = ${normalizedWallet})
          RETURNING consumer.*
        ),
        clerk_identity AS MATERIALIZED (
          INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
          SELECT id, 'clerk_web3', ${externalUserId}, now() FROM updated_consumer
          ON CONFLICT (provider, provider_subject)
          DO UPDATE SET verified_at = now(), updated_at = now()
          WHERE consumer_identities.consumer_id = EXCLUDED.consumer_id
          RETURNING consumer_id
        ),
        wallet_identity AS MATERIALIZED (
          INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
          SELECT id, 'web3_wallet', ${normalizedWallet}, now() FROM updated_consumer
          ON CONFLICT (provider, provider_subject)
          DO UPDATE SET verified_at = now(), updated_at = now()
          WHERE consumer_identities.consumer_id = EXCLUDED.consumer_id
          RETURNING consumer_id
        ),
        created_session AS MATERIALIZED (
          INSERT INTO consumer_sessions (consumer_id, session_token_hash, expires_at, user_agent_hash, ip_hash)
          SELECT updated_consumer.id, ${sessionHash}, now() + interval '30 days',
                 ${requestMeta.userAgent ? sha(requestMeta.userAgent) : null}, ${requestMeta.ip ? sha(requestMeta.ip) : null}
          FROM updated_consumer, clerk_identity, wallet_identity
          RETURNING consumer_id
        )
        SELECT updated_consumer.*
        FROM updated_consumer, created_session
      `
      : await sql/*sql*/`
        WITH new_consumer AS MATERIALIZED (
          INSERT INTO consumers (display_name, wallet_address, wallet_chain_id, wallet_network, wallet_verified_at, status, preferred_locale, last_login_at)
          VALUES (${displayName || null}, ${normalizedWallet}, ${chainId || null}, ${provider}, now(), 'registered', 'es-AR', now())
          RETURNING *
        ),
        clerk_identity AS MATERIALIZED (
          INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
          SELECT id, 'clerk_web3', ${externalUserId}, now() FROM new_consumer
          RETURNING consumer_id
        ),
        wallet_identity AS MATERIALIZED (
          INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
          SELECT id, 'web3_wallet', ${normalizedWallet}, now() FROM new_consumer
          RETURNING consumer_id
        ),
        created_session AS MATERIALIZED (
          INSERT INTO consumer_sessions (consumer_id, session_token_hash, expires_at, user_agent_hash, ip_hash)
          SELECT new_consumer.id, ${sessionHash}, now() + interval '30 days',
                 ${requestMeta.userAgent ? sha(requestMeta.userAgent) : null}, ${requestMeta.ip ? sha(requestMeta.ip) : null}
          FROM new_consumer, clerk_identity, wallet_identity
          RETURNING consumer_id
        )
        SELECT new_consumer.*
        FROM new_consumer, created_session
      `;
  } catch (error) {
    if (String((error as { code?: string } | null)?.code || "") === "23505") {
      return json({ ok: false, error: "web3_identity_conflict" }, 409);
    }
    throw error;
  }
  const consumer = rows[0];
  if (!consumer) return json({ ok: false, error: "web3_account_link_unavailable" }, 409);

  return new Response(JSON.stringify({
    ok: true,
    consumer: {
      id: consumer.id,
      email: consumer.email || null,
      phone: consumer.phone || null,
      displayName: consumer.display_name || null,
      accountStatus: consumer.status || null,
    },
    wallet: {
      addressMasked: maskAddress(normalizedWallet),
      chainId: consumer.wallet_chain_id || chainId || null,
      network: consumer.wallet_network || provider || null,
      controlVerified: true,
      verificationSource: "clerk_verified_web3",
      verifiedAt: consumer.wallet_verified_at || null,
    },
    authenticationModel: "clerk_session_plus_verified_wallet",
  }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookieHeader(rawSession),
      "cache-control": "no-store",
    },
  });
}
