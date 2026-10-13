export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantAccess } from "../../../../../lib/auth";
import { sql } from "../../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../../lib/commercial-runtime-schema";
import { json } from "../../../../../lib/http";
import { consumerRewardClaimExpiresAt } from "../../../../../lib/consumer-rewards-read-model";

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizeCode(value: unknown) {
  return clean(value).toUpperCase().replace(/\s+/g, "");
}

function maskPhone(phone: string | null | undefined) {
  const value = String(phone || "");
  return value ? `${value.slice(0, 5)}***${value.slice(-3)}` : null;
}

function formatClaim(row: Record<string, any>) {
  const metadata = row.metadata_json || {};
  const expiresAt = consumerRewardClaimExpiresAt(row.expires_at_value ?? metadata.expires_at, row.created_at);
  const expired = !expiresAt || Date.parse(expiresAt) <= Date.now();
  return {
    id: row.id,
    redemption_code: row.redemption_code,
    status: expired && row.status === "claimed" ? "expired" : row.status,
    reward: {
      id: row.reward_id,
      code: row.reward_code,
      title: row.reward_title,
      description: row.reward_description,
    },
    consumer: {
      id: row.consumer_id,
      name: row.display_name || "Consumidor nexID",
      email_masked: row.email ? `${String(row.email).slice(0, 2)}***@${String(row.email).split("@")[1] || "mail"}` : null,
      phone_masked: maskPhone(row.phone),
    },
    tenant: {
      id: row.tenant_id,
      slug: row.tenant_slug,
    },
    tap_event_id: row.tap_event_id,
    seal: metadata.verification_seal || null,
    expires_at: expiresAt,
    created_at: row.created_at,
    updated_at: row.updated_at,
    staff_instruction: metadata.staff_instruction || "Validar codigo y telefono antes de entregar beneficio.",
  };
}

async function getClaim(code: string, forcedTenantSlug = "") {
  const rows = await sql/*sql*/`
    SELECT
      c.*,
      r.code AS reward_code,
      r.title AS reward_title,
      r.description AS reward_description,
      con.display_name,
      con.email,
      con.phone,
      t.slug AS tenant_slug,
      c.created_at::text AS claimed_at_text,
      c.metadata_json->'expires_at' AS expires_at_value
    FROM consumer_reward_claims c
    JOIN rewards r ON r.id = c.reward_id
    JOIN consumers con ON con.id = c.consumer_id
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.redemption_code = ${code}
      AND (${forcedTenantSlug} = '' OR t.slug = ${forcedTenantSlug})
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantAccess(req);
  await ensureConsumerPortalSchema();

  const payload = await req.json().catch(() => ({}));
  const code = normalizeCode(payload?.code);
  const action = clean(payload?.action || "lookup").toLowerCase();
  const providedSeal = clean(payload?.seal).toUpperCase();
  const phoneLast4 = clean(payload?.phoneLast4).replace(/[^\d]/g, "");

  if (!code) return json({ ok: false, reason: "redemption_code_required" }, 400);

  const claim = await getClaim(code, forcedTenantSlug);
  if (!claim) return json({ ok: false, reason: "redemption_not_found" }, 404);

  const formatted = formatClaim(claim);
  const expectedSeal = String(formatted.seal || "").toUpperCase();
  if (providedSeal && expectedSeal && providedSeal !== expectedSeal) {
    return json({ ok: false, reason: "seal_mismatch", redemption: formatted }, 409);
  }
  if (phoneLast4 && !String(claim.phone || "").replace(/[^\d]/g, "").endsWith(phoneLast4)) {
    return json({ ok: false, reason: "phone_mismatch", redemption: formatted }, 409);
  }
  if (formatted.status === "expired") {
    return json({ ok: false, reason: "redemption_expired", redemption: formatted }, 409);
  }

  if (action === "redeem" || action === "fulfill" || action === "canjear") {
    if (claim.status !== "claimed") {
      return json({ ok: false, reason: "redemption_not_claimed", redemption: formatted }, 409);
    }
    const rows = await sql/*sql*/`
      WITH locked AS MATERIALIZED (
        SELECT id, created_at::text AS claimed_at_text,
          metadata_json->'expires_at' AS expires_at_value
        FROM consumer_reward_claims
        WHERE id = ${claim.id}
          AND tenant_id = ${claim.tenant_id}
          AND consumer_id = ${claim.consumer_id}
          AND reward_id = ${claim.reward_id}
          AND redemption_code = ${code}
          AND status = 'claimed'
          AND (${forcedTenantSlug} = '' OR tenant_id = (SELECT id FROM tenants WHERE slug = ${forcedTenantSlug} LIMIT 1))
        FOR UPDATE
      ),
      eligible AS MATERIALIZED (
        SELECT id FROM locked
        WHERE ${formatted.expires_at}::timestamptz > clock_timestamp()
          AND claimed_at_text = ${claim.claimed_at_text}
          AND COALESCE(expires_at_value, 'null'::jsonb) = ${JSON.stringify(claim.expires_at_value ?? null)}::jsonb
      )
      UPDATE consumer_reward_claims
      SET status = 'redeemed',
          metadata_json = metadata_json || ${JSON.stringify({
            redeemed_at: new Date().toISOString(),
            redeemed_by: "admin_crm",
            validation_source: "admin_rewards_redemptions_validate",
          })}::jsonb,
          updated_at = now()
      FROM eligible
      WHERE consumer_reward_claims.id = eligible.id
        AND consumer_reward_claims.status = 'claimed'
      RETURNING consumer_reward_claims.*
    `;
    if (!rows[0]) {
      const current = await getClaim(code, forcedTenantSlug);
      return json({
        ok: false,
        reason: current ? "redemption_already_processed" : "redemption_not_found",
        redemption: current ? formatClaim(current) : undefined,
      }, current ? 409 : 404);
    }
    const updated = await getClaim(String(rows[0].redemption_code || code), forcedTenantSlug);
    return json({ ok: true, action: "redeemed", redemption: formatClaim(updated || rows[0]) });
  }

  return json({ ok: true, action: "lookup", redemption: formatted });
}
