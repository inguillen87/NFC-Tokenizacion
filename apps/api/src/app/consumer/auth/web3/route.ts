export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash, randomBytes } from "node:crypto";
import { isAddress } from "ethers";
import { sessionCookieHeader } from "../../../../lib/consumer-auth";
import { ensureConsumerAuthSchema } from "../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanText(value: unknown, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function normalizeEmail(value: unknown) {
  const email = cleanText(value, 180).toLowerCase();
  return email.includes("@") ? email : "";
}

function normalizePhone(value: unknown) {
  const raw = cleanText(value, 32);
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  return digits.length >= 10 ? `+${digits}` : digits;
}

function maskAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function createConsumerSession(consumerId: string, req: Request) {
  const rawSession = randomBytes(24).toString("hex");
  await sql/*sql*/`
    INSERT INTO consumer_sessions (consumer_id, session_token_hash, expires_at, user_agent_hash, ip_hash)
    VALUES (
      ${consumerId},
      ${sha(rawSession)},
      now() + interval '30 days',
      ${req.headers.get("user-agent") ? sha(String(req.headers.get("user-agent"))) : null},
      ${req.headers.get("x-forwarded-for") ? sha(String(req.headers.get("x-forwarded-for"))) : null}
    )
  `;
  return rawSession;
}

export async function POST(req: Request) {
  await ensureConsumerAuthSchema();
  const expected = String(process.env.ADMIN_API_KEY || "").trim();
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!expected || token !== expected) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const externalUserId = cleanText(body.externalUserId || body.clerkUserId, 120);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const displayName = cleanText(body.fullName || body.displayName || "Usuario Web3 nexID", 120);
  const walletAddress = cleanText(body.walletAddress || body.address, 64);
  const normalizedWallet = walletAddress && isAddress(walletAddress) ? walletAddress.toLowerCase() : "";
  const chainId = cleanText(body.chainId, 24);
  const provider = cleanText(body.provider || "clerk_web3_metamask", 60);
  const walletVerificationSource = cleanText(body.walletVerificationSource, 60);
  const walletVerifiedAt = normalizedWallet ? new Date().toISOString() : null;

  if (!externalUserId) return json({ ok: false, error: "clerk_user_required" }, 400);
  if (!email && !phone && !normalizedWallet) return json({ ok: false, error: "consumer_identity_required" }, 400);
  if (normalizedWallet && walletVerificationSource !== "clerk_verified_web3") {
    return json({ ok: false, error: "verified_clerk_wallet_required" }, 400);
  }

  const linkedIdentityRows = await sql/*sql*/`
    SELECT DISTINCT consumer_id
    FROM consumer_identities
    WHERE (provider = 'clerk_web3' AND provider_subject = ${externalUserId})
       OR (
         ${normalizedWallet} <> ''
         AND provider = 'web3_wallet'
         AND lower(provider_subject) = ${normalizedWallet}
       )
  `;
  const linkedConsumerIds = [...new Set(linkedIdentityRows.map((row) => String(row.consumer_id)))];
  if (linkedConsumerIds.length > 1) {
    return json({ ok: false, error: "web3_identity_conflict" }, 409);
  }
  const linkedConsumerId = linkedConsumerIds[0] || null;

  let rows;
  if (linkedConsumerId) {
    rows = await sql/*sql*/`
      UPDATE consumers
      SET email = COALESCE(consumers.email, ${email || null}),
          phone = COALESCE(consumers.phone, ${phone || null}),
          display_name = COALESCE(consumers.display_name, ${displayName || null}),
          wallet_address = COALESCE(NULLIF(${normalizedWallet}, ''), consumers.wallet_address),
          wallet_chain_id = COALESCE(NULLIF(${chainId}, ''), consumers.wallet_chain_id),
          wallet_network = COALESCE(NULLIF(${provider}, ''), consumers.wallet_network),
          wallet_verified_at = CASE WHEN ${normalizedWallet} <> '' THEN now() ELSE consumers.wallet_verified_at END,
          status = CASE WHEN ${normalizedWallet} <> '' THEN 'verified'::consumer_status ELSE consumers.status END,
          last_login_at = now(),
          updated_at = now()
      WHERE id = ${linkedConsumerId}
      RETURNING *
    `;
  } else if (email) {
    rows = await sql/*sql*/`
      INSERT INTO consumers (email, phone, display_name, wallet_address, wallet_chain_id, wallet_network, wallet_verified_at, status, preferred_locale, last_login_at)
      VALUES (
        ${email},
        ${phone || null},
        ${displayName || null},
        ${normalizedWallet || null},
        ${chainId || null},
        ${provider || "clerk_web3_metamask"},
        ${walletVerifiedAt},
        ${normalizedWallet ? "verified" : "registered"}::consumer_status,
        'es-AR',
        now()
      )
      ON CONFLICT (email)
      DO UPDATE SET
        display_name = COALESCE(consumers.display_name, EXCLUDED.display_name),
        phone = COALESCE(consumers.phone, EXCLUDED.phone),
        wallet_address = COALESCE(EXCLUDED.wallet_address, consumers.wallet_address),
        wallet_chain_id = COALESCE(EXCLUDED.wallet_chain_id, consumers.wallet_chain_id),
        wallet_network = COALESCE(EXCLUDED.wallet_network, consumers.wallet_network),
        wallet_verified_at = CASE WHEN EXCLUDED.wallet_address IS NOT NULL THEN now() ELSE consumers.wallet_verified_at END,
        status = CASE WHEN EXCLUDED.wallet_address IS NOT NULL THEN 'verified'::consumer_status ELSE consumers.status END,
        last_login_at = now(),
        updated_at = now()
      RETURNING *
    `;
  } else if (phone) {
    rows = await sql/*sql*/`
      INSERT INTO consumers (email, phone, display_name, wallet_address, wallet_chain_id, wallet_network, wallet_verified_at, status, preferred_locale, last_login_at)
      VALUES (
        ${null},
        ${phone},
        ${displayName || null},
        ${normalizedWallet || null},
        ${chainId || null},
        ${provider || "clerk_web3_metamask"},
        ${walletVerifiedAt},
        ${normalizedWallet ? "verified" : "registered"}::consumer_status,
        'es-AR',
        now()
      )
      ON CONFLICT (phone) WHERE phone IS NOT NULL
      DO UPDATE SET
        display_name = COALESCE(consumers.display_name, EXCLUDED.display_name),
        wallet_address = COALESCE(EXCLUDED.wallet_address, consumers.wallet_address),
        wallet_chain_id = COALESCE(EXCLUDED.wallet_chain_id, consumers.wallet_chain_id),
        wallet_network = COALESCE(EXCLUDED.wallet_network, consumers.wallet_network),
        wallet_verified_at = CASE WHEN EXCLUDED.wallet_address IS NOT NULL THEN now() ELSE consumers.wallet_verified_at END,
        status = CASE WHEN EXCLUDED.wallet_address IS NOT NULL THEN 'verified'::consumer_status ELSE consumers.status END,
        last_login_at = now(),
        updated_at = now()
      RETURNING *
    `;
  } else {
    const existing = await sql/*sql*/`
      SELECT *
      FROM consumers
      WHERE lower(wallet_address) = ${normalizedWallet}
      LIMIT 1
    `;
    rows = existing.length
      ? await sql/*sql*/`
          UPDATE consumers
          SET display_name = COALESCE(display_name, ${displayName || null}),
              wallet_chain_id = COALESCE(NULLIF(${chainId}, ''), wallet_chain_id),
              wallet_network = COALESCE(NULLIF(${provider}, ''), wallet_network),
              wallet_verified_at = now(),
              status = 'verified'::consumer_status,
              last_login_at = now(),
              updated_at = now()
          WHERE id = ${existing[0].id}
          RETURNING *
        `
      : await sql/*sql*/`
          INSERT INTO consumers (display_name, wallet_address, wallet_chain_id, wallet_network, wallet_verified_at, status, preferred_locale, last_login_at)
          VALUES (${displayName || null}, ${normalizedWallet}, ${chainId || null}, ${provider || "clerk_web3_metamask"}, now(), 'verified', 'es-AR', now())
          RETURNING *
        `;
  }

  const consumer = rows[0];
  const clerkIdentityRows = await sql/*sql*/`
    INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
    VALUES (${consumer.id}, 'clerk_web3', ${externalUserId}, now())
    ON CONFLICT (provider, provider_subject)
    DO UPDATE SET verified_at = now(), updated_at = now()
    WHERE consumer_identities.consumer_id = EXCLUDED.consumer_id
    RETURNING consumer_id
  `;
  if (!clerkIdentityRows[0]) return json({ ok: false, error: "clerk_web3_identity_conflict" }, 409);

  if (normalizedWallet) {
    const walletIdentityRows = await sql/*sql*/`
      INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
      VALUES (${consumer.id}, 'web3_wallet', ${normalizedWallet}, now())
      ON CONFLICT (provider, provider_subject)
      DO UPDATE SET verified_at = now(), updated_at = now()
      WHERE consumer_identities.consumer_id = EXCLUDED.consumer_id
      RETURNING consumer_id
    `;
    if (!walletIdentityRows[0]) return json({ ok: false, error: "wallet_already_linked_to_another_account" }, 409);
  }

  const sessionToken = await createConsumerSession(String(consumer.id), req);
  return new Response(JSON.stringify({
    ok: true,
    consumer: {
      id: consumer.id,
      email: consumer.email || null,
      phone: consumer.phone || null,
      displayName: consumer.display_name || null,
      status: consumer.status || null,
    },
    wallet: normalizedWallet ? {
      addressMasked: maskAddress(normalizedWallet),
      chainId: consumer.wallet_chain_id || chainId || null,
      network: consumer.wallet_network || provider || null,
      verifiedAt: consumer.wallet_verified_at || null,
    } : null,
  }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookieHeader(sessionToken),
    },
  });
}
