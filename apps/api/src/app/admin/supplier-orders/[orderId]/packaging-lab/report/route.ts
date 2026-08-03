export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminPrincipal } from "../../../../../../lib/auth";
import { sql } from "../../../../../../lib/db";
import { json } from "../../../../../../lib/http";
import { buildPackagingLabCsvReport, buildPackagingLabPdfReport } from "../../../../../../lib/packaging-lab";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function filePart(value: unknown) {
  return String(value || "packaging-lab").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "packaging-lab";
}

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await checkAdminWithPermission(req, "reports.export");
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  const { orderId } = await params;
  const url = new URL(req.url);
  const projectId = String(url.searchParams.get("projectId") || "");
  const format = String(url.searchParams.get("format") || "pdf").toLowerCase();
  if (!UUID_PATTERN.test(orderId) || !UUID_PATTERN.test(projectId)) {
    return json({ ok: false, reason: "packaging_lab_report_not_found" }, 404);
  }
  if (!['pdf', 'csv'].includes(format)) return json({ ok: false, reason: "packaging_lab_report_format_invalid" }, 400);

  try {
    const rows = principal.scope === "super_admin"
      ? await sql/*sql*/`
          SELECT project.*, supplier_order.order_name, supplier_order.carrier_profile_code,
            tenant.slug AS tenant_slug, tenant.name AS tenant_name,
            to_jsonb(spec) AS carrier_spec,
            to_jsonb(placement) AS placement,
            CASE WHEN approval.id IS NULL THEN NULL ELSE to_jsonb(approval) END AS approval
          FROM packaging_lab_projects project
          JOIN supplier_orders supplier_order
            ON supplier_order.id = project.supplier_order_id AND supplier_order.tenant_id = project.tenant_id
          JOIN tenants tenant ON tenant.id = project.tenant_id
          JOIN packaging_carrier_specs spec
            ON spec.id = project.carrier_spec_id AND spec.tenant_id = project.tenant_id
          JOIN packaging_placements placement
            ON placement.id = project.placement_id AND placement.tenant_id = project.tenant_id
          LEFT JOIN packaging_lab_approvals approval
            ON approval.id = project.approval_id AND approval.tenant_id = project.tenant_id
          WHERE project.id = ${projectId}::uuid
            AND project.supplier_order_id = ${orderId}::uuid
          LIMIT 1
        `
      : await sql/*sql*/`
          SELECT project.*, supplier_order.order_name, supplier_order.carrier_profile_code,
            tenant.slug AS tenant_slug, tenant.name AS tenant_name,
            to_jsonb(spec) AS carrier_spec,
            to_jsonb(placement) AS placement,
            CASE WHEN approval.id IS NULL THEN NULL ELSE to_jsonb(approval) END AS approval
          FROM packaging_lab_projects project
          JOIN supplier_orders supplier_order
            ON supplier_order.id = project.supplier_order_id AND supplier_order.tenant_id = project.tenant_id
          JOIN tenants tenant ON tenant.id = project.tenant_id
          JOIN packaging_carrier_specs spec
            ON spec.id = project.carrier_spec_id AND spec.tenant_id = project.tenant_id
          JOIN packaging_placements placement
            ON placement.id = project.placement_id AND placement.tenant_id = project.tenant_id
          LEFT JOIN packaging_lab_approvals approval
            ON approval.id = project.approval_id AND approval.tenant_id = project.tenant_id
          WHERE project.id = ${projectId}::uuid
            AND project.supplier_order_id = ${orderId}::uuid
            AND project.tenant_id = ${principal.tenantId}::uuid
          LIMIT 1
        `;
    const project = rows[0];
    if (!project) return json({ ok: false, reason: "packaging_lab_report_not_found" }, 404);
    const tests = await sql/*sql*/`
      SELECT code, category, name, method, target, result, status,
        evidence_urls, tested_at
      FROM packaging_lab_test_cases
      WHERE project_id = ${project.id}::uuid
        AND tenant_id = ${project.tenant_id}::uuid
      ORDER BY sequence
    `;
    const reportInput = {
      orderName: String(project.order_name),
      tenantLabel: String(project.tenant_name || project.tenant_slug),
      carrierProfileCode: String(project.carrier_profile_code),
      project,
      carrierSpec: project.carrier_spec || {},
      placement: project.placement || {},
      tests,
      approval: project.approval || null,
    };
    const baseName = `${filePart(project.order_name)}-packaging-lab-${filePart(project.id)}`;
    if (format === "csv") {
      const body = buildPackagingLabCsvReport(reportInput);
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${baseName}.csv"`,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }
    const body = buildPackagingLabPdfReport(reportInput);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${baseName}.pdf"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code || "") : "";
    if (["42P01", "42703", "42883"].includes(code)) {
      return json({
        ok: false,
        reason: "packaging_lab_migration_required",
        required_migration: "20260802220000_0087_packaging_lab_foundation.sql",
      }, 503);
    }
    console.error("[packaging_lab_report_failed]", /^[A-Z0-9]{5}$/.test(code) ? code : "unknown");
    return json({ ok: false, reason: "packaging_lab_report_unavailable" }, 503);
  }
}
