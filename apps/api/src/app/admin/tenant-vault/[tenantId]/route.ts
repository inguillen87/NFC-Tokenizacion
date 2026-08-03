export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  checkAdmin,
  checkAdminPermission,
  getAdminPrincipal,
  getAdminTenantScope,
} from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import {
  emptyTenantVaultFolders,
  projectTenantVaultArtifact,
  resolveTenantVaultNextAction,
  TENANT_VAULT_FOLDERS,
  type TenantVaultViewer,
} from "../../../../lib/tenant-vault";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const ORDER_PAGE_SIZE = 25;
const ARTIFACT_PAGE_SIZE = 1_000;
const AUDIT_PAGE_SIZE = 100;

function vaultJson(data: unknown, status = 200) {
  return json(data, status, {
    "cache-control": "private, no-store, max-age=0",
    pragma: "no-cache",
  });
}

function normalizeTenantIdentifier(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return UUID_PATTERN.test(normalized) || TENANT_SLUG_PATTERN.test(normalized) ? normalized : "";
}

function safeDigest(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^(?:sha256:)?[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function isoOrNull(value: unknown) {
  const parsed = new Date(String(value || ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function folderName(order: Record<string, unknown>) {
  const source = String(order.base_batch_id || order.order_name || order.id || "supplier-order").trim();
  return source.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "supplier-order";
}

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "supplier_orders:read");
  if (permission) return permission;

  const { tenantId } = await params;
  const requestedTenant = normalizeTenantIdentifier(tenantId);
  if (!requestedTenant) return vaultJson({ ok: false, reason: "tenant_vault_not_found" }, 404);

  const principal = getAdminPrincipal(req);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const viewer: TenantVaultViewer = principal.scope === "super_admin" ? "operator" : "tenant";
  const canPrivilegedDownload = viewer === "operator" && principal.mfaVerified;

  if (viewer === "tenant") {
    const allowedIdentifiers = new Set([
      String(principal.tenantId || "").trim().toLowerCase(),
      String(forcedTenantSlug || "").trim().toLowerCase(),
    ].filter(Boolean));
    if (!allowedIdentifiers.has(requestedTenant)) {
      return vaultJson({ ok: false, reason: "tenant_vault_not_found" }, 404);
    }
  }

  try {
    await ensureSupplierOpsSchema();

    const tenantRows = viewer === "tenant"
      ? await sql/*sql*/`
          SELECT id, slug, name
          FROM tenants
          WHERE id = ${principal.tenantId}::uuid
            AND slug = ${forcedTenantSlug}
          LIMIT 1
        `
      : UUID_PATTERN.test(requestedTenant)
        ? await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE id = ${requestedTenant}::uuid LIMIT 1`
        : await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE lower(slug) = ${requestedTenant} LIMIT 1`;
    const tenant = tenantRows[0];
    if (!tenant) return vaultJson({ ok: false, reason: "tenant_vault_not_found" }, 404);

    const summaryRows = await sql/*sql*/`
      SELECT
        (SELECT COUNT(*)::int FROM supplier_orders so WHERE so.tenant_id = ${tenant.id}) AS order_count,
        (SELECT COUNT(*)::int FROM supplier_sub_batches ssb WHERE ssb.tenant_id = ${tenant.id}) AS sub_batch_count,
        (SELECT COALESCE(SUM(ssb.expected_quantity), 0)::int FROM supplier_sub_batches ssb WHERE ssb.tenant_id = ${tenant.id}) AS planned_tag_count,
        (SELECT COALESCE(SUM(ssb.manifest_count), 0)::int FROM supplier_sub_batches ssb WHERE ssb.tenant_id = ${tenant.id}) AS manifested_tag_count,
        (SELECT COUNT(*)::int FROM supplier_sub_batches ssb WHERE ssb.tenant_id = ${tenant.id} AND ssb.qa_status = 'passed') AS qa_passed_sub_batch_count,
        (
          SELECT COUNT(DISTINCT tag.id)::int
          FROM tags tag
          JOIN batches batch ON batch.id = tag.batch_id AND batch.tenant_id = ${tenant.id}
          JOIN supplier_sub_batches ssb
            ON ssb.batch_id = batch.id
           AND ssb.tenant_id = batch.tenant_id
          WHERE tag.status::text = 'active'
        ) AS active_tag_count,
        (SELECT COUNT(*)::int FROM vault_artifacts va WHERE va.tenant_id = ${tenant.id}) AS artifact_count
    `;
    const summary = summaryRows[0] || {};

    const orderRows = await sql/*sql*/`
      SELECT
        so.id,
        so.customer_slug,
        so.order_name,
        so.base_batch_id,
        so.total_quantity,
        so.sub_batch_size,
        so.chip_model,
        so.carrier_profile_code,
        so.material_type,
        so.status,
        public.nexid_effective_supplier_pack_purpose_v1(so.id) AS effective_pack_purpose,
        so.packaging_governance_status,
        so.packaging_spec_revision,
        so.packaging_spec_hash,
        so.created_at,
        so.updated_at
      FROM supplier_orders so
      WHERE so.tenant_id = ${tenant.id}
      ORDER BY so.created_at DESC, so.id DESC
      LIMIT ${ORDER_PAGE_SIZE + 1}
    `;
    const ordersTruncated = orderRows.length > ORDER_PAGE_SIZE;
    const selectedOrders = orderRows.slice(0, ORDER_PAGE_SIZE);
    const orderIds = selectedOrders.map((row) => String(row.id));

    const subBatchRows = orderIds.length
      ? await sql/*sql*/`
          SELECT
            ssb.id,
            ssb.supplier_order_id,
            ssb.bid,
            ssb.sequence_index,
            ssb.expected_quantity,
            ssb.manifest_count,
            ssb.manifest_hash,
            ssb.manifest_status,
            ssb.qa_status,
            ssb.status,
            ssb.key_export_count,
            ssb.key_exported_at,
            ssb.manifest_imported_at,
            ssb.qa_passed_at,
            ssb.activated_at,
            COUNT(tag.id) FILTER (WHERE tag.status::text = 'active')::int AS active_tag_count
          FROM supplier_sub_batches ssb
          LEFT JOIN tags tag ON tag.batch_id = ssb.batch_id
          WHERE ssb.tenant_id = ${tenant.id}
            AND ssb.supplier_order_id = ANY(${orderIds}::uuid[])
          GROUP BY ssb.id
          ORDER BY ssb.supplier_order_id, ssb.sequence_index ASC
        `
      : [];

    const artifactRows = orderIds.length
      ? await sql/*sql*/`
          SELECT
            va.id,
            va.supplier_order_id,
            va.supplier_sub_batch_id,
            va.artifact_type,
            va.content_hash,
            va.mime_type,
            va.status,
            va.delivery_status,
            va.delivery_attempt_count,
            va.last_delivery_attempt_at,
            va.download_count,
            va.last_downloaded_at,
            va.metadata_json,
            va.created_at
          FROM vault_artifacts va
          WHERE va.tenant_id = ${tenant.id}
            AND va.supplier_order_id = ANY(${orderIds}::uuid[])
          ORDER BY va.created_at DESC, va.id DESC
          LIMIT ${ARTIFACT_PAGE_SIZE + 1}
        `
      : [];
    const artifactsTruncated = artifactRows.length > ARTIFACT_PAGE_SIZE;
    const projectedArtifacts = artifactRows
      .slice(0, ARTIFACT_PAGE_SIZE)
      .map((row) => {
        const artifact = projectTenantVaultArtifact(row, viewer);
        if (!artifact.download.available || !artifact.id) return artifact;
        if (!canPrivilegedDownload) {
          return {
            ...artifact,
            download: {
              ...artifact.download,
              available: false,
              reason: "operator_mfa_required",
            },
          };
        }
        return {
          ...artifact,
          download: {
            ...artifact.download,
            method: "POST" as const,
            href: `/admin/tenant-vault/${encodeURIComponent(String(tenant.id))}/artifacts/${encodeURIComponent(artifact.id)}/download`,
          },
        };
      });

    const auditRows = viewer === "operator"
      ? await sql/*sql*/`
          SELECT
            audit.id,
            audit.action,
            audit.resource_type,
            audit.resource_id,
            audit.before_hash,
            audit.after_hash,
            audit.request_id,
            audit.created_at,
            actor.email AS actor_email,
            actor.full_name AS actor_name
          FROM audit_logs audit
          LEFT JOIN users actor ON actor.id = audit.actor_id
          WHERE audit.tenant_id = ${tenant.id}
            AND left(audit.action, 9) = 'supplier_'
          ORDER BY audit.created_at DESC, audit.id DESC
          LIMIT ${AUDIT_PAGE_SIZE}
        `
      : [];

    const orders = selectedOrders.map((order) => {
      const subBatches = subBatchRows
        .filter((row) => String(row.supplier_order_id) === String(order.id))
        .map((row) => ({
          id: row.id,
          bid: row.bid,
          sequence_index: Number(row.sequence_index || 0),
          expected_quantity: Number(row.expected_quantity || 0),
          manifest_count: Number(row.manifest_count || 0),
          manifest_hash: safeDigest(row.manifest_hash),
          manifest_status: row.manifest_status,
          qa_status: row.qa_status,
          status: row.status,
          active_tag_count: Number(row.active_tag_count || 0),
          manifest_imported_at: isoOrNull(row.manifest_imported_at),
          qa_passed_at: isoOrNull(row.qa_passed_at),
          activated_at: isoOrNull(row.activated_at),
          ...(viewer === "operator" ? {
            key_export: {
              exported: Number(row.key_export_count || 0) > 0,
              count: Number(row.key_export_count || 0),
              exported_at: isoOrNull(row.key_exported_at),
            },
          } : {}),
        }));
      const folders = emptyTenantVaultFolders();
      for (const artifact of projectedArtifacts) {
        if (artifact.supplier_order_id !== String(order.id)) continue;
        folders[artifact.folder].push(artifact);
      }
      return {
        id: order.id,
        folder_name: folderName(order),
        order_name: order.order_name,
        base_batch_id: order.base_batch_id,
        total_quantity: Number(order.total_quantity || 0),
        sub_batch_size: Number(order.sub_batch_size || 0),
        chip_model: order.chip_model,
        carrier_profile_code: order.carrier_profile_code,
        material_type: order.material_type,
        status: order.status,
        pack_purpose: order.effective_pack_purpose,
        packaging: {
          status: order.packaging_governance_status,
          revision: Number(order.packaging_spec_revision || 0),
          spec_hash: safeDigest(order.packaging_spec_hash),
        },
        created_at: isoOrNull(order.created_at),
        updated_at: isoOrNull(order.updated_at),
        next_action: resolveTenantVaultNextAction(order, subBatches, viewer),
        sub_batches: subBatches,
        folders,
      };
    });

    return vaultJson({
      ok: true,
      generated_at: new Date().toISOString(),
      viewer: {
        mode: viewer,
        can_view_export_audit: viewer === "operator",
        can_download_supplier_packs: canPrivilegedDownload,
      },
      custody: {
        classification: "application_envelope_encryption",
        managed_kms: false,
        hsm_backed: false,
        plaintext_artifact_persisted: false,
        tenant_key_export_allowed: false,
        download_status: viewer === "operator"
          ? canPrivilegedDownload
            ? "privileged_idempotent_audited_delivery"
            : "operator_mfa_required"
          : "tenant_key_pack_download_forbidden",
      },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      hierarchy: {
        root: String(tenant.slug),
        supplier_orders: "supplier-orders",
        folders: ["sub-batches", ...TENANT_VAULT_FOLDERS],
      },
      summary: {
        orders: Number(summary.order_count || 0),
        sub_batches: Number(summary.sub_batch_count || 0),
        planned_tags: Number(summary.planned_tag_count || 0),
        manifested_tags: Number(summary.manifested_tag_count || 0),
        qa_passed_sub_batches: Number(summary.qa_passed_sub_batch_count || 0),
        active_tags: Number(summary.active_tag_count || 0),
        artifacts: Number(summary.artifact_count || 0),
      },
      pagination: {
        order_limit: ORDER_PAGE_SIZE,
        orders_truncated: ordersTruncated,
        artifact_limit: ARTIFACT_PAGE_SIZE,
        artifacts_truncated: artifactsTruncated,
      },
      orders,
      ...(viewer === "operator" ? {
        export_audit: auditRows.map((row) => ({
          id: row.id,
          action: row.action,
          resource_type: row.resource_type,
          resource_id: row.resource_id,
          before_hash: safeDigest(row.before_hash),
          after_hash: safeDigest(row.after_hash),
          request_id: String(row.request_id || "").slice(0, 160) || null,
          actor_email: row.actor_email || null,
          actor_name: row.actor_name || null,
          created_at: isoOrNull(row.created_at),
        })),
      } : {}),
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32)
      : "unknown_error";
    console.error("[tenant_vault_read_failed]", code || "unknown_error");
    return vaultJson({ ok: false, reason: "tenant_vault_unavailable" }, 503);
  }
}
