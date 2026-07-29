export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { ensureSdkSchema } from "../../../../lib/commercial-runtime-schema";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

function clean(value: unknown) {
  return String(value || "").trim();
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function pinHash(input: { pin: string; tenantId: string; bid: string; uidHex?: string | null }) {
  const pin = input.pin.trim();
  const uid = clean(input.uidHex).toUpperCase();
  return uid
    ? sha256Hex(`${input.tenantId}:${input.bid}:${uid}:${pin}`)
    : sha256Hex(`${input.tenantId}:${input.bid}:${pin}`);
}

async function resolveBatch(req: Request, bid: string, tenant?: string) {
  const tenantScope = getAdminTenantScope(req).forcedTenantSlug;
  const tenantSlug = clean(tenantScope || tenant).toLowerCase();
  const rows = tenantSlug
    ? await sql/*sql*/`
      SELECT b.id::text AS batch_id, b.tenant_id::text AS tenant_id, b.bid, tn.slug AS tenant_slug, b.sdm_config
      FROM batches b
      JOIN tenants tn ON tn.id = b.tenant_id
      WHERE b.bid = ${bid}
        AND tn.slug = ${tenantSlug}
      LIMIT 1
    `
    : await sql/*sql*/`
      SELECT b.id::text AS batch_id, b.tenant_id::text AS tenant_id, b.bid, tn.slug AS tenant_slug, b.sdm_config
      FROM batches b
      JOIN tenants tn ON tn.id = b.tenant_id
      WHERE b.bid = ${bid}
      LIMIT 1
    `;
  return rows[0] as Record<string, unknown> | undefined;
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req);
  if (auth) return auth;
  await ensureSdkSchema();

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const bid = clean(body.bid);
  const tenant = clean(body.tenant || body.tenantSlug);
  const uidHex = clean(body.uidHex || body.uid_hex).toUpperCase();
  if (!bid) return json({ ok: false, reason: "bid_required" }, 400);

  const batch = await resolveBatch(req, bid, tenant);
  if (!batch) return json({ ok: false, reason: "batch_not_found_for_tenant", bid }, 404);

  const activeForClaim = body.activeForClaim ?? body.active_for_claim;
  const claimPinRequired = body.claimPinRequired ?? body.claim_pin_required;
  const claimRequiresPos = body.claimRequiresPos ?? body.claim_requires_pos;
  const autoClaimEnabled = body.autoClaimEnabled ?? body.auto_claim_enabled;
  const pin = clean(body.pin);
  const hashPin = pin ? pinHash({ pin, tenantId: String(batch.tenant_id), bid, uidHex: uidHex || null }) : null;

  const currentConfig = (batch.sdm_config && typeof batch.sdm_config === "object" ? batch.sdm_config : {}) as Record<string, unknown>;
  const nextConfig = {
    ...currentConfig,
    ...(typeof claimRequiresPos === "boolean" ? { claim_requires_pos: claimRequiresPos } : {}),
    ...(typeof autoClaimEnabled === "boolean" ? { sdk_auto_claim_enabled: autoClaimEnabled } : {}),
    ...(typeof activeForClaim === "boolean" ? { active_for_claim: activeForClaim } : {}),
    ...(typeof claimPinRequired === "boolean" ? { claim_pin_required: claimPinRequired } : {}),
    ...(hashPin && !uidHex ? { claim_pin_hash: hashPin, hash_pin: hashPin } : {}),
  };

  if (uidHex) {
    const tagRows = await sql/*sql*/`
      UPDATE tags
      SET
        active_for_claim = COALESCE(${typeof activeForClaim === "boolean" ? activeForClaim : null}, active_for_claim),
        claim_pin_required = COALESCE(${typeof claimPinRequired === "boolean" ? claimPinRequired : null}, claim_pin_required),
        hash_pin = COALESCE(${hashPin}, hash_pin)
      WHERE batch_id = ${String(batch.batch_id)}
        AND UPPER(uid_hex) = ${uidHex}
      RETURNING id::text AS id, uid_hex
    `;
    if (!tagRows[0]) return json({ ok: false, reason: "tag_not_found_for_batch", bid, uidHex }, 404);
  } else {
    await sql/*sql*/`
      UPDATE batches
      SET
        active_for_claim = COALESCE(${typeof activeForClaim === "boolean" ? activeForClaim : null}, active_for_claim),
        claim_pin_required = COALESCE(${typeof claimPinRequired === "boolean" ? claimPinRequired : null}, claim_pin_required),
        hash_pin = COALESCE(${hashPin}, hash_pin),
        sdm_config = ${JSON.stringify(nextConfig)}::jsonb
      WHERE id = ${String(batch.batch_id)}
    `;
  }

  return json({
    ok: true,
    tenant: String(batch.tenant_slug),
    bid,
    uidHex: uidHex || null,
    policy: {
      activeForClaim: typeof activeForClaim === "boolean" ? activeForClaim : null,
      claimPinRequired: typeof claimPinRequired === "boolean" ? claimPinRequired : null,
      claimRequiresPos: typeof claimRequiresPos === "boolean" ? claimRequiresPos : null,
      autoClaimEnabled: typeof autoClaimEnabled === "boolean" ? autoClaimEnabled : null,
      pinUpdated: Boolean(hashPin),
    },
  });
}
