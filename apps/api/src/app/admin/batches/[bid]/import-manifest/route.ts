export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../../../lib/db";
import { checkAdmin } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { parseTagManifest } from "../../../../../lib/tag-manifest";
import { requireTenantSunProfile } from "../../../../../lib/tenant-onboarding";
import { ensureCarrierProfileSchema } from "../../../../../lib/commercial-runtime-schema";
import { getCarrierProfile, normalizeCarrierProfileCode } from "../../../../../lib/carrier-profiles";

type ManifestPayload = {
  csv?: string;
  activateImported?: boolean;
};

async function readPayload(req: Request): Promise<ManifestPayload & { csv: string }> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as ManifestPayload;
    return { csv: String(body.csv || ""), activateImported: Boolean(body.activateImported) };
  }

  const raw = await req.text();
  return { csv: raw, activateImported: false };
}

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureCarrierProfileSchema();

  const { bid } = await params;
  const batchRows = await sql/*sql*/`SELECT id, tenant_id, carrier_profile_code, sdm_config FROM batches WHERE bid = ${bid} LIMIT 1`;
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);
  const batchCarrierCode = normalizeCarrierProfileCode(batch.carrier_profile_code || batch.sdm_config?.carrier_profile_code);
  const batchCarrier = getCarrierProfile(batchCarrierCode);
  if (!batchCarrierCode || !batchCarrier) {
    return json({
      ok: false,
      reason: "batch_carrier_profile_required",
      message: "The batch must have a carrier_profile_code before importing manifests. Edit/register the batch with qr_basic, gs1_digital_link, ntag213, ntag215, ntag216, ntag424_dna or ntag424_dna_tt.",
    }, 409);
  }
  const readiness = await requireTenantSunProfile(String(batch.tenant_id)).catch((error) => ({ ok: false, missing: (error as Error & { missing?: string[] }).missing || ["tenant_sun_profiles"] }));
  if (!readiness.ok) {
    return json({
      ok: false,
      reason: "tenant_sun_profile_incomplete",
      message: "Complete tenant SUN profile before importing manifests.",
      missing: readiness.missing,
    }, 409);
  }

  const payload = await readPayload(req);
  if (!payload.csv.trim()) return json({ ok: false, reason: "empty csv body" }, 400);

  const manifest = parseTagManifest(payload.csv, bid);
  if (!manifest.rows.length && !manifest.rejectedRows.length) return json({ ok: false, reason: "manifest has no rows" }, 400);
  if (manifest.rejectedRows.length > 0) {
    await sql/*sql*/`
      INSERT INTO tenant_manifests (
        tenant_id, batch_id, bid, manifest_type, row_count, duplicate_count, rejected_count, content_hash, import_status, errors_json, carrier_profile_code
      ) VALUES (
        ${batch.tenant_id}, ${batch.id}, ${bid}, ${manifest.manifestType}, ${manifest.rows.length}, ${manifest.duplicateUids.length}, ${manifest.rejectedRows.length}, ${manifest.contentHash}, 'rejected', ${JSON.stringify(manifest.rejectedRows)}::jsonb, ${batchCarrierCode}
      )
    `;
    return json({ ok: false, reason: "manifest_validation_failed", rejectedRows: manifest.rejectedRows, duplicateUids: manifest.duplicateUids }, 400);
  }

  let inserted = 0;
  let reactivated = 0;

  for (const row of manifest.rows) {
    const rowCarrierCode = row.carrierProfileCode || batchCarrierCode;
    const rowCarrier = getCarrierProfile(rowCarrierCode);
    if (!rowCarrier) {
      return json({ ok: false, reason: "invalid_carrier_profile", value: row.carrierProfileCode }, 400);
    }
    const result = await sql/*sql*/`
      INSERT INTO tags (batch_id, uid_hex, status, carrier_profile_code)
      VALUES (${batch.id}, ${row.uidHex}, ${payload.activateImported ? 'active' : 'inactive'}, ${rowCarrierCode})
      ON CONFLICT (batch_id, uid_hex)
      DO UPDATE SET status = CASE
        WHEN ${payload.activateImported} THEN 'active'::tag_status
        ELSE tags.status
      END,
      carrier_profile_code = COALESCE(tags.carrier_profile_code, EXCLUDED.carrier_profile_code)
      RETURNING id, xmax = 0 AS inserted, status
    `;
    const current = result[0];
    if (current?.inserted) inserted += 1;
    else if (payload.activateImported) reactivated += 1;

    if (row.productName || row.sku) {
      await sql/*sql*/`
        INSERT INTO tag_profiles (tag_id, sku, product_name, notes, locale_data, carrier_profile_code)
        VALUES (
          ${current.id},
          ${row.sku},
          ${row.productName},
          ${row.lot || row.serial || row.expiresAt ? JSON.stringify({ lot: row.lot, serial: row.serial, expires_at: row.expiresAt }) : null},
          ${JSON.stringify({ manifest: { lot: row.lot, serial: row.serial, expires_at: row.expiresAt, raw: row.raw, carrier_profile_code: rowCarrierCode, carrier_label: rowCarrier.label } })}::jsonb,
          ${rowCarrierCode}
        )
        ON CONFLICT (tag_id) DO UPDATE SET
          sku = COALESCE(EXCLUDED.sku, tag_profiles.sku),
          product_name = COALESCE(EXCLUDED.product_name, tag_profiles.product_name),
          notes = COALESCE(EXCLUDED.notes, tag_profiles.notes),
          locale_data = tag_profiles.locale_data || EXCLUDED.locale_data,
          carrier_profile_code = COALESCE(tag_profiles.carrier_profile_code, EXCLUDED.carrier_profile_code),
          updated_at = now()
      `;
    }
  }

  await sql/*sql*/`
    INSERT INTO tenant_manifests (
      tenant_id, batch_id, bid, manifest_type, row_count, inserted_count, reactivated_count, duplicate_count, rejected_count, content_hash, import_status, errors_json, carrier_profile_code
    ) VALUES (
      ${batch.tenant_id}, ${batch.id}, ${bid}, ${manifest.manifestType}, ${manifest.rows.length}, ${inserted}, ${reactivated}, 0, 0, ${manifest.contentHash}, 'imported', '[]'::jsonb, ${batchCarrierCode}
    )
  `;

  return json({
    ok: true,
    batch: bid,
    manifestType: manifest.manifestType,
    importedRows: manifest.rows.length,
    inserted,
    reactivated,
    ignored: 0,
    duplicateUids: [],
    activated: payload.activateImported,
    carrier: batchCarrier,
  });
}
