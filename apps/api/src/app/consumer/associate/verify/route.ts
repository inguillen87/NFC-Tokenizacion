export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { parseConsumerContact } from "../../../../lib/consumer-contact";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { ensureTenantMembership } from "../../../../lib/consumer-portal-service";
import { createHash } from "node:crypto";

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePhone(contact: string) {
  const trimmed = contact.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  return digits.length >= 10 ? `+${digits}` : digits;
}

export async function POST(req: Request) {
  await ensureConsumerPortalSchema();
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const parsedContact = parseConsumerContact(body);
  const code = String(body.code || "").trim();

  if (!parsedContact.ok) {
    return json({ ok: false, error: parsedContact.error }, 422);
  }
  if (!code) {
    return json({ ok: false, error: "code_required" }, 400);
  }

  const contact = parsedContact.contact;
  const isMail = contact.includes("@");
  const normalized = isMail ? contact.trim().toLowerCase() : normalizePhone(contact);

  // 1. Verify OTP challenge
  const challengeRows = await sql`
    SELECT id, code_hash, expires_at, attempts, max_attempts, locked_until
    FROM consumer_auth_challenges
    WHERE contact = ${normalized}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const challenge = challengeRows[0];
  if (!challenge) {
    return json({ ok: false, error: "invalid_code" }, 400);
  }
  if (challenge.locked_until && new Date(challenge.locked_until).getTime() > Date.now()) {
    return json({ ok: false, error: "locked" }, 423);
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "expired" }, 410);
  }

  if (String(challenge.code_hash) !== sha(code)) {
    const attempts = Number(challenge.attempts || 0) + 1;
    const maxAttempts = Number(challenge.max_attempts || 5);
    const lockedUntil = attempts >= maxAttempts ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await sql`UPDATE consumer_auth_challenges SET attempts = ${attempts}, locked_until = ${lockedUntil} WHERE id = ${challenge.id}`;
    return json({ ok: false, error: "invalid_code" }, 401);
  }

  // Code is verified! Clean up challenge.
  await sql`DELETE FROM consumer_auth_challenges WHERE id = ${challenge.id}`;

  // 2. Check duplicate again just to be safe
  let duplicateQuery;
  if (isMail) {
    duplicateQuery = await sql`SELECT id FROM consumers WHERE email = ${normalized} AND id != ${consumer.id} LIMIT 1`;
  } else {
    duplicateQuery = await sql`SELECT id FROM consumers WHERE phone = ${normalized} AND id != ${consumer.id} LIMIT 1`;
  }
  if (duplicateQuery.length > 0) {
    return json({ ok: false, error: "contact_already_linked" }, 409);
  }

  // 3. Update consumer contact and status to verified
  let updatedConsumerRows;
  if (isMail) {
    updatedConsumerRows = await sql`
      UPDATE consumers
      SET email = ${normalized},
          status = 'verified',
          updated_at = now()
      WHERE id = ${consumer.id}
      RETURNING *
    `;
    // Add identity
    await sql`
      INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
      VALUES (${consumer.id}, 'email_magic_link', ${normalized}, now())
      ON CONFLICT (provider, provider_subject)
      DO UPDATE SET verified_at = now(), updated_at = now()
    `;
  } else {
    updatedConsumerRows = await sql`
      UPDATE consumers
      SET phone = ${normalized},
          status = 'verified',
          updated_at = now()
      WHERE id = ${consumer.id}
      RETURNING *
    `;
    // Add identity
    await sql`
      INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
      VALUES (${consumer.id}, 'phone_otp', ${normalized}, now())
      ON CONFLICT (provider, provider_subject)
      DO UPDATE SET verified_at = now(), updated_at = now()
    `;
  }

  const updatedConsumer = updatedConsumerRows[0];

  // 4. Award 100 points incentive to memberships
  const memberships = await sql`SELECT id, tenant_id FROM tenant_consumer_memberships WHERE consumer_id = ${consumer.id}`;
  if (memberships.length > 0) {
    await sql`
      UPDATE tenant_consumer_memberships
      SET points_balance = points_balance + 100,
          lifetime_points = lifetime_points + 100,
          updated_at = now()
      WHERE consumer_id = ${consumer.id}
    `;
  } else {
    // If no memberships, associate with the default/active tenants to make sure they get the bonus points.
    const activeTenants = await sql`SELECT id FROM tenants LIMIT 5`;
    for (const tenant of activeTenants) {
      const membership = await ensureTenantMembership({ consumerId: consumer.id, tenantId: tenant.id, source: "2fa_incentive" });
      await sql`
        UPDATE tenant_consumer_memberships
        SET points_balance = points_balance + 100,
            lifetime_points = lifetime_points + 100,
            updated_at = now()
        WHERE id = ${membership.id}
      `;
    }
  }

  // 5. Send a verified notification
  await sql`
    INSERT INTO consumer_notifications (consumer_id, type, title, body)
    VALUES (${consumer.id}, 'points_rewarded', '¡2FA Activado! +100 Puntos', 'Completaste la verificación de doble factor y recibiste 100 puntos de regalo en tus clubes de bodegas.')
  `;

  return json({ ok: true, consumer: updatedConsumer });
}
