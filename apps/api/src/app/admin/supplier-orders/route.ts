export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminActor, getAdminTenantScope } from "../../../lib/auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { logAuditEvent } from "../../../lib/audit-logger";
import { ensureCarrierProfileSchema } from "../../../lib/commercial-runtime-schema";
import { ensureSupplierOpsSchema } from "../../../lib/supplier-ops-schema";
import { getCarrierProfile, inferCarrierProfileFromPayload } from "../../../lib/carrier-profiles";
import { buildBatchKeyLifecycleRecords } from "../../../lib/batch-keys";
import {
  buildSupplierSubBatchPlan,
  generateSupplierBatchKeys,
  requiresSecureSunEncoding,
} from "../../../lib/supplier-ops";
import { requireTenantSunProfile } from "../../../lib/tenant-onboarding";
import { hashEvidencePayload } from "../../../lib/proof-layer";

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function positiveInt(value: unknown, field: string) {
  const parsed = Math.trunc(Number(value || 0));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} must be greater than zero`);
  return parsed;
}

async function resolveTenant(input: string) {
  const normalized = input.trim();
  if (!normalized) return null;
  const rows = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE id = ${normalized}::uuid LIMIT 1`
    : await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE slug = ${normalized.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

function resolveApiOrigin(req: Request) {
  const forwardedProto = (req.headers.get("x-forwarded-proto") || "").trim();
  const forwardedHost = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").trim();
  if (forwardedHost) {
    const proto = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
    return `${proto}://${forwardedHost}`.replace(/\/$/, "");
  }
  const fallback = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || "").trim();
  return fallback ? fallback.replace(/\/$/, "") : "https://api.nexid.lat";
}

function buildSupplierUrlTemplate(apiOrigin: string, carrierProfileCode: string, bid: string) {
  const encodedBid = encodeURIComponent(bid);
  if (requiresSecureSunEncoding(carrierProfileCode)) {
    return `${apiOrigin}/sun?v=1&bid=${encodedBid}&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>`;
  }
  switch (carrierProfileCode) {
    case "gs1_digital_link":
      return `${apiOrigin}/01/<GTIN>/10/<LOT>/21/<SERIAL>?bid=${encodedBid}`;
    case "uhf_rfid":
      return `${apiOrigin}/ops/rfid/${encodedBid}/<EPC_OR_UID>`;
    case "event_wristband":
      return `${apiOrigin}/event/${encodedBid}/<UID_HEX>`;
    case "hotel_keycard":
      return `${apiOrigin}/credential/${encodedBid}/<UID_HEX>`;
    case "iot_tracker_placeholder":
      return `${apiOrigin}/telemetry/${encodedBid}/<DEVICE_ID>`;
    default:
      return `${apiOrigin}/t/${encodedBid}/<UID_HEX>`;
  }
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { forcedTenantSlug } = getAdminTenantScope(req);
  const rows = forcedTenantSlug
    ? await sql/*sql*/`
        SELECT
          so.*,
          t.slug AS tenant_slug,
          COUNT(ssb.id)::int AS sub_batch_count,
          COALESCE(SUM(ssb.expected_quantity), 0)::int AS planned_quantity,
          COUNT(*) FILTER (WHERE ssb.manifest_status = 'imported')::int AS manifests_imported,
          COUNT(*) FILTER (WHERE ssb.qa_status = 'passed')::int AS qa_passed,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', ssb.id,
                'bid', ssb.bid,
                'batch_id', ssb.batch_id,
                'sequence_index', ssb.sequence_index,
                'expected_quantity', ssb.expected_quantity,
                'manifest_status', ssb.manifest_status,
                'qa_status', ssb.qa_status,
                'key_fingerprint', ssb.metadata_json->>'key_fingerprint',
                'url_template', ssb.metadata_json->>'url_template'
              )
              ORDER BY ssb.sequence_index
            ) FILTER (WHERE ssb.id IS NOT NULL),
            '[]'::jsonb
          ) AS sub_batches
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        LEFT JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        WHERE t.slug = ${forcedTenantSlug}
        GROUP BY so.id, t.slug
        ORDER BY so.created_at DESC
        LIMIT 100
      `
    : await sql/*sql*/`
        SELECT
          so.*,
          t.slug AS tenant_slug,
          COUNT(ssb.id)::int AS sub_batch_count,
          COALESCE(SUM(ssb.expected_quantity), 0)::int AS planned_quantity,
          COUNT(*) FILTER (WHERE ssb.manifest_status = 'imported')::int AS manifests_imported,
          COUNT(*) FILTER (WHERE ssb.qa_status = 'passed')::int AS qa_passed,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', ssb.id,
                'bid', ssb.bid,
                'batch_id', ssb.batch_id,
                'sequence_index', ssb.sequence_index,
                'expected_quantity', ssb.expected_quantity,
                'manifest_status', ssb.manifest_status,
                'qa_status', ssb.qa_status,
                'key_fingerprint', ssb.metadata_json->>'key_fingerprint',
                'url_template', ssb.metadata_json->>'url_template'
              )
              ORDER BY ssb.sequence_index
            ) FILTER (WHERE ssb.id IS NOT NULL),
            '[]'::jsonb
          ) AS sub_batches
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        LEFT JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        GROUP BY so.id, t.slug
        ORDER BY so.created_at DESC
        LIMIT 100
      `;
  return json({ ok: true, orders: rows });
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureCarrierProfileSchema();
  await ensureSupplierOpsSchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tenantInput = firstString(body.tenant_id, body.tenantId, body.tenant_slug, body.tenantSlug, body.tenant);
  const tenant = await resolveTenant(tenantInput);
  if (!tenant) return json({ ok: false, reason: "tenant_not_found" }, 404);

  const tenantScope = getAdminTenantScope(req);
  if (tenantScope.forcedTenantSlug && tenantScope.forcedTenantSlug !== tenant.slug) {
    return json({ ok: false, reason: "tenant_scope_forbidden" }, 403);
  }

  try {
    const customerSlug = firstString(body.customer_slug, body.customerSlug, tenant.slug);
    const orderName = firstString(body.order_name, body.orderName);
    const baseBatchId = firstString(body.base_batch_id, body.baseBatchId, orderName);
    const totalQuantity = positiveInt(body.total_quantity ?? body.totalQuantity, "total_quantity");
    const subBatchSize = positiveInt(body.sub_batch_size ?? body.subBatchSize, "sub_batch_size");
    const chipModel = firstString(body.chip_model, body.chipModel, body.chip);
    const carrierProfileCode = inferCarrierProfileFromPayload(body);
    const carrierProfile = getCarrierProfile(carrierProfileCode);
    if (!orderName || !chipModel || !carrierProfileCode || !carrierProfile) {
      return json({
        ok: false,
        reason: "supplier_order_identity_required",
        missing: [
          !orderName ? "order_name" : "",
          !chipModel ? "chip_model" : "",
          !carrierProfileCode ? "carrier_profile_code" : "",
        ].filter(Boolean),
      }, 400);
    }

    if (requiresSecureSunEncoding(carrierProfileCode)) {
      const readiness = await requireTenantSunProfile(String(tenant.id)).catch((error) => ({
        ok: false,
        missing: (error as Error & { missing?: string[] }).missing || ["tenant_sun_profiles"],
      }));
      if (!readiness.ok) {
        return json({
          ok: false,
          reason: "tenant_sun_profile_incomplete",
          message: "Complete SUN tenant profile before creating NTAG 424 DNA supplier orders.",
          missing: readiness.missing,
        }, 409);
      }
    }

    const plan = buildSupplierSubBatchPlan({
      customerSlug,
      orderName,
      baseBatchId,
      totalQuantity,
      subBatchSize,
    });
    if (plan.length > 52) {
      return json({ ok: false, reason: "too_many_sub_batches", max: 52, received: plan.length }, 400);
    }

    const existingBids = await sql/*sql*/`
      SELECT bid FROM batches WHERE bid = ANY(${plan.map((item) => item.bid)})
      UNION
      SELECT bid FROM supplier_sub_batches WHERE bid = ANY(${plan.map((item) => item.bid)})
    `;
    if (existingBids.length) {
      return json({
        ok: false,
        reason: "batch_bid_already_exists",
        bids: existingBids.map((row) => row.bid),
      }, 409);
    }

    const actor = getAdminActor(req).email;
    // Order provisioning below spans multiple statements and is not an atomic
    // packaging-decision transaction. A caller-supplied packaging_spec is
    // therefore never trusted here; migration 0063 defaults the order to
    // legacy_unverified and the dedicated route records its first draft.
    const orderRows = await sql/*sql*/`
      INSERT INTO supplier_orders (
        tenant_id, customer_slug, order_name, base_batch_id, total_quantity, sub_batch_size,
        chip_model, carrier_profile_code, material_type, notes, status, created_by
      ) VALUES (
        ${tenant.id}, ${customerSlug}, ${orderName}, ${baseBatchId}, ${totalQuantity}, ${subBatchSize},
        ${chipModel}, ${carrierProfileCode}, ${firstString(body.material_type, body.materialType) || null},
        ${firstString(body.notes) || null}, 'pack_ready', ${actor}
      )
      RETURNING *
    `;
    const order = orderRows[0];
    const apiOrigin = resolveApiOrigin(req);
    const subBatches = [];

    for (const subBatch of plan) {
      const keys = generateSupplierBatchKeys();
      const keyMaterial = buildBatchKeyLifecycleRecords({
        tenantId: String(tenant.id),
        bid: subBatch.bid,
        kMetaHex: keys.kMetaHex,
        kFileHex: keys.kFileHex,
        keyVersion: 1,
        createdBy: actor,
      });
      const metaKey = keyMaterial.find((item) => item.keyRole === "K_META_BATCH");
      const fileKey = keyMaterial.find((item) => item.keyRole === "K_FILE_BATCH");
      if (!metaKey || !fileKey) throw new Error("supplier_batch_key_material_missing");
      const metaCt = metaKey.encryptedKeyCt;
      const fileCt = fileKey.encryptedKeyCt;
      const secureSunProfile = requiresSecureSunEncoding(carrierProfileCode);
      const urlTemplate = buildSupplierUrlTemplate(apiOrigin, carrierProfileCode, subBatch.bid);
      const sdmConfig = {
        profile: secureSunProfile ? "enterprise_supplier_sun" : "enterprise_supplier_declared",
        sku: firstString(body.sku) || orderName,
        chip_model: chipModel,
        carrier_profile_code: carrierProfileCode,
        carrier_label: carrierProfile.label,
        requested_quantity: subBatch.expectedQuantity,
        supplier_order_id: order.id,
        supplier_sequence_index: subBatch.sequenceIndex,
        source: "supplier_order",
        mode: "supplier",
        key_version: 1,
        url_template: urlTemplate,
        mac_input: secureSunProfile ? "enc_plus_cmac_literal" : "not_applicable",
        tagtamper_enabled: carrierProfileCode === "ntag424_dna_tt",
        ttstatus_enabled: carrierProfileCode === "ntag424_dna_tt",
        ttstatus_source: "enc_decrypted",
        ttstatus_offset: 0,
        ttstatus_length: 2,
        ttstatus_closed_values: ["4343"],
        ttstatus_opened_values: ["4F4F", "4F43"],
        ttstatus_invalid_values: ["4949"],
      };

      const batchRows = await sql/*sql*/`
        INSERT INTO batches (
          tenant_id, bid, status, meta_key_ct, file_key_ct, sdm_config, carrier_profile_code,
          supplier_order_id, expected_quantity, manifest_status, qa_status
        ) VALUES (
          ${tenant.id}, ${subBatch.bid}, 'production_registered', ${metaCt}, ${fileCt},
          ${JSON.stringify(sdmConfig)}::jsonb, ${carrierProfileCode}, ${order.id}, ${subBatch.expectedQuantity}, 'pending', 'pending'
        )
        RETURNING id, bid, status, created_at
      `;
      const batch = batchRows[0];
      const subBatchRows = await sql/*sql*/`
        INSERT INTO supplier_sub_batches (
          supplier_order_id, tenant_id, batch_id, bid, sequence_index, expected_quantity, status, metadata_json
        ) VALUES (
          ${order.id}, ${tenant.id}, ${batch.id}, ${subBatch.bid}, ${subBatch.sequenceIndex},
          ${subBatch.expectedQuantity}, 'pack_ready', ${JSON.stringify({ url_template: urlTemplate, key_fingerprint: keys.fingerprint })}::jsonb
        )
        RETURNING *
      `;
      const createdSubBatch = subBatchRows[0];
      await sql/*sql*/`
        UPDATE batches
        SET supplier_sub_batch_id = ${createdSubBatch.id}
        WHERE id = ${batch.id}
      `;
      await sql/*sql*/`
        INSERT INTO batch_keys (
          tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
          meta_key_ct, file_key_ct, key_fingerprint
        ) VALUES (
          ${tenant.id}, ${order.id}, ${createdSubBatch.id}, ${batch.id}, ${subBatch.bid},
          ${metaCt}, ${fileCt}, ${keys.fingerprint}
        )
      `;
      await sql/*sql*/`
        INSERT INTO batch_key_material (
          tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid,
          key_role, key_version, encrypted_key_ct, key_fingerprint, status, created_by, metadata_json
        ) VALUES
          (
            ${tenant.id}, ${order.id}, ${createdSubBatch.id}, ${batch.id}, ${subBatch.bid},
            ${metaKey.keyRole}, ${metaKey.keyVersion}, ${metaKey.encryptedKeyCt}, ${metaKey.keyFingerprint},
            ${metaKey.status}, ${metaKey.createdBy}, ${JSON.stringify({ source: "supplier_order", pair_fingerprint: keys.fingerprint })}::jsonb
          ),
          (
            ${tenant.id}, ${order.id}, ${createdSubBatch.id}, ${batch.id}, ${subBatch.bid},
            ${fileKey.keyRole}, ${fileKey.keyVersion}, ${fileKey.encryptedKeyCt}, ${fileKey.keyFingerprint},
            ${fileKey.status}, ${fileKey.createdBy}, ${JSON.stringify({ source: "supplier_order", pair_fingerprint: keys.fingerprint })}::jsonb
          )
      `;
      const eventPayload = {
        supplier_order_id: order.id,
        supplier_sub_batch_id: createdSubBatch.id,
        bid: subBatch.bid,
        expected_quantity: subBatch.expectedQuantity,
        carrier_profile_code: carrierProfileCode,
      };
      const eventHash = hashEvidencePayload({
        tenantId: String(tenant.id),
        resourceType: "supplier_sub_batch",
        resourceId: String(createdSubBatch.id),
        eventType: "batch_created",
        payload: eventPayload,
      });
      await sql/*sql*/`
        INSERT INTO evidence_events (tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash)
        VALUES (${tenant.id}, 'supplier_sub_batch', ${createdSubBatch.id}, 'batch_created', ${JSON.stringify(eventPayload)}::jsonb, ${eventHash})
        ON CONFLICT (payload_hash) DO NOTHING
      `;
      subBatches.push({
        id: createdSubBatch.id,
        bid: subBatch.bid,
        batch_id: batch.id,
        sequence_index: subBatch.sequenceIndex,
        expected_quantity: subBatch.expectedQuantity,
        key_fingerprint: keys.fingerprint,
        url_template: urlTemplate,
      });
    }

    await logAuditEvent({
      actorId: null,
      tenantId: String(tenant.id),
      action: "supplier_order_created",
      resourceType: "supplier_order",
      resourceId: String(order.id),
      afterData: { order, sub_batches: subBatches.map(({ key_fingerprint, ...safe }) => safe) },
      userAgent: req.headers.get("user-agent"),
      requestId: req.headers.get("x-request-id"),
    });

    return json({
      ok: true,
      order: { ...order, tenant_slug: tenant.slug },
      sub_batches: subBatches,
      packaging_governance: {
        status: String(order.packaging_governance_status || "legacy_unverified"),
        spec_revision: Number(order.packaging_spec_revision || 0),
        initial_spec_accepted: false,
        supplied_spec_was_persisted: false,
        next: `/admin/supplier-orders/${order.id}/packaging`,
      },
      warning: "Keys are encrypted. This non-transactional creation flow intentionally leaves packaging legacy_unverified; create and approve its packaging specification before the explicit supplier-pack export endpoint can release factory material.",
    }, 201);
  } catch (error) {
    return json({ ok: false, reason: error instanceof Error ? error.message : "supplier_order_failed" }, 400);
  }
}
