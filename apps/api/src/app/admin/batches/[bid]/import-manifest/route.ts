export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from "../../../../../lib/db";
import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { parseTagManifest } from "../../../../../lib/tag-manifest";
import { requireTenantSunProfile } from "../../../../../lib/tenant-onboarding";
import { ensureCarrierProfileSchema } from "../../../../../lib/commercial-runtime-schema";
import { getCarrierProfile, normalizeCarrierProfileCode } from "../../../../../lib/carrier-profiles";
import { upsertTagSunPayload } from "../../../../../lib/sun-payload-registry.ts";

type ManifestPayload = {
  csv?: string;
  activateImported?: boolean;
  dryRun?: boolean;
};

async function readPayload(req: Request): Promise<ManifestPayload & { csv: string }> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as ManifestPayload;
    return { csv: String(body.csv || ""), activateImported: Boolean(body.activateImported), dryRun: Boolean(body.dryRun) };
  }

  const raw = await req.text();
  return { csv: raw, activateImported: false, dryRun: false };
}

export async function POST(req: Request, { params }: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;
  await ensureCarrierProfileSchema();

  const { bid } = await params;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const batchRows = forcedTenantSlug
    ? await sql/*sql*/`
      SELECT b.id, b.tenant_id, b.carrier_profile_code, b.sdm_config, b.status, b.created_at
      FROM batches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.bid = ${bid} AND t.slug = ${forcedTenantSlug}
      ORDER BY b.created_at ASC, b.id ASC
    `
    : await sql/*sql*/`
      SELECT id, tenant_id, carrier_profile_code, sdm_config, status, created_at
      FROM batches
      WHERE bid = ${bid}
      ORDER BY created_at ASC, id ASC
    `;
  if (batchRows.length > 1) {
    return json({
      ok: false,
      reason: "DUPLICATE_BID",
      message: "BID must be globally unique before importing a manifest.",
      batches: batchRows.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null })),
    }, 409);
  }
  const batch = batchRows[0];
  if (!batch) return json({ ok: false, reason: "batch not found" }, 404);

  // Validate batch status
  const allowedStatuses = ['production_registered', 'active_in_market', 'active'];
  if (!allowedStatuses.includes(batch.status)) {
    return json({
      ok: false,
      reason: 'invalid_batch_state',
      message: `Cannot import manifest while batch status is '${batch.status}'. Batch status must be 'production_registered' or 'active_in_market'.`
    }, 400);
  }

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
    if (!payload.dryRun) {
      await sql/*sql*/`
        INSERT INTO tenant_manifests (
          tenant_id, batch_id, bid, manifest_type, row_count, duplicate_count, rejected_count, content_hash, import_status, errors_json, carrier_profile_code
        ) VALUES (
          ${batch.tenant_id}, ${batch.id}, ${bid}, ${manifest.manifestType}, ${manifest.rows.length}, ${manifest.duplicateUids.length}, ${manifest.rejectedRows.length}, ${manifest.contentHash}, 'rejected', ${JSON.stringify(manifest.rejectedRows)}::jsonb, ${batchCarrierCode}
        )
      `;
    }
    return json({ ok: false, reason: "manifest_validation_failed", rejectedRows: manifest.rejectedRows, duplicateUids: manifest.duplicateUids }, 400);
  }

  // Dry run simulation
  if (payload.dryRun) {
    const manifestUids = manifest.rows.map((row) => row.uidHex).filter(Boolean);
    const existingTags = manifestUids.length > 0
      ? await sql/*sql*/`
        SELECT uid_hex
        FROM tags
        WHERE batch_id = ${batch.id} AND uid_hex = ANY(${manifestUids})
      `
      : [];
    const existingSet = new Set(existingTags.map((t) => String(t.uid_hex).toUpperCase()));

    let simulatedInserted = 0;
    let simulatedReactivated = 0;

    for (const row of manifest.rows) {
      const isExisting = existingSet.has(row.uidHex.toUpperCase());
      if (!isExisting) {
        simulatedInserted += 1;
      } else if (payload.activateImported) {
        simulatedReactivated += 1;
      }
    }

    return json({
      ok: true,
      dryRun: true,
      batch: bid,
      manifestType: manifest.manifestType,
      importedRows: manifest.rows.length,
      inserted: simulatedInserted,
      reactivated: simulatedReactivated,
      registeredSunPayloads: manifest.rows.filter(r => r.sunPayloadHashes).length,
      ignored: 0,
      duplicateUids: manifest.duplicateUids,
      activated: payload.activateImported,
      carrier: batchCarrier,
    });
  }

  let inserted = 0;
  let reactivated = 0;
  let registeredSunPayloads = 0;

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

    if (current?.id && row.sunPayloadHashes) {
      await upsertTagSunPayload({
        tenantId: String(batch.tenant_id),
        batchId: String(batch.id),
        bid: row.sunPayload?.bid || bid,
        tagId: String(current.id),
        uidHex: row.uidHex,
        hashes: row.sunPayloadHashes,
        source: "supplier_manifest",
        rawPayload: {
          sun_payload: row.sunPayload,
          manifest: row.raw,
        },
      });
      registeredSunPayloads += 1;
    }

    const hasUnitManifest = Boolean(
      row.lot
      || row.serial
      || row.expiresAt
      || row.imageUrl
      || row.labelImageUrl
      || row.modelUrl
      || row.galleryUrls.length
      || Object.keys(row.unitMetadata).length
      || row.iotData
      || rowCarrierCode !== batchCarrierCode,
    );
    const hasProductOverride = Boolean(row.productName || row.sku);

    if (hasUnitManifest || hasProductOverride) {
      const media = {
        imageUrl: row.imageUrl,
        labelImageUrl: row.labelImageUrl,
        modelUrl: row.modelUrl,
        galleryUrls: row.galleryUrls,
      };
      await sql/*sql*/`
        INSERT INTO tag_profiles (tag_id, sku, product_name, notes, image_url, locale_data, carrier_profile_code)
        VALUES (
          ${current.id},
          ${hasProductOverride ? row.sku : null},
          ${hasProductOverride ? row.productName : null},
          ${row.lot || row.serial || row.expiresAt || Object.keys(row.unitMetadata).length || row.iotData ? JSON.stringify({ lot: row.lot, serial: row.serial, expires_at: row.expiresAt, ...row.unitMetadata, iot: row.iotData }) : null},
          ${row.imageUrl},
          ${JSON.stringify({
            media,
            manifest: {
              lot: row.lot,
              serial: row.serial,
              external_unit_id: row.serial,
              expires_at: row.expiresAt,
              unit_metadata: row.unitMetadata,
              raw: row.raw,
              carrier_profile_code: rowCarrierCode,
              carrier_label: rowCarrier.label,
            },
            iot: row.iotData,
          })}::jsonb,
          ${rowCarrierCode}
        )
        ON CONFLICT (tag_id) DO UPDATE SET
          sku = COALESCE(EXCLUDED.sku, tag_profiles.sku),
          product_name = COALESCE(EXCLUDED.product_name, tag_profiles.product_name),
          notes = COALESCE(EXCLUDED.notes, tag_profiles.notes),
          image_url = COALESCE(EXCLUDED.image_url, tag_profiles.image_url),
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
      ${batch.tenant_id}, ${batch.id}, ${bid}, ${manifest.manifestType}, ${manifest.rows.length}, ${inserted}, ${reactivated}, 0, 0, ${manifest.contentHash}, 'imported', ${JSON.stringify({ registeredSunPayloads })}::jsonb, ${batchCarrierCode}
    )
  `;

  return json({
    ok: true,
    batch: bid,
    manifestType: manifest.manifestType,
    importedRows: manifest.rows.length,
    inserted,
    reactivated,
    registeredSunPayloads,
    ignored: 0,
    duplicateUids: [],
    activated: payload.activateImported,
    carrier: batchCarrier,
  });
}
