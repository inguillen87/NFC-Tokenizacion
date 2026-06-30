export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { json } from "../../../../../lib/http";
import { sql } from "../../../../../lib/db";
import { logAuditEvent } from "../../../../../lib/audit-logger";
import { ensureSupplierOpsSchema } from "../../../../../lib/supplier-ops-schema";
import { hashEvidencePayload } from "../../../../../lib/proof-layer";
import { requiresSecureSunEncoding, validateSupplierQaEvidence } from "../../../../../lib/supplier-ops";

function safeString(value: unknown) {
  return String(value || "").trim();
}

function safeActor(req: Request) {
  return safeString(req.headers.get("x-nexid-actor"))
    || safeString(req.headers.get("x-dashboard-user"))
    || safeString(req.headers.get("x-forwarded-user"))
    || "admin";
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const { orderId } = await params;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const bid = safeString(body.bid || body.batch_id);
  if (!bid) return json({ ok: false, reason: "bid_required" }, 400);

  const rows = forcedTenantSlug
    ? await sql/*sql*/`
        SELECT
          so.id AS supplier_order_id,
          so.tenant_id,
          ssb.id AS supplier_sub_batch_id,
          ssb.batch_id,
          ssb.bid,
          ssb.expected_quantity,
          ssb.manifest_status,
          ssb.manifest_count,
          ssb.qa_status,
          so.carrier_profile_code,
          t.slug AS tenant_slug
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        WHERE so.id = ${orderId}::uuid AND ssb.bid = ${bid} AND t.slug = ${forcedTenantSlug}
        LIMIT 1
      `
    : await sql/*sql*/`
        SELECT
          so.id AS supplier_order_id,
          so.tenant_id,
          ssb.id AS supplier_sub_batch_id,
          ssb.batch_id,
          ssb.bid,
          ssb.expected_quantity,
          ssb.manifest_status,
          ssb.manifest_count,
          ssb.qa_status,
          so.carrier_profile_code,
          t.slug AS tenant_slug
        FROM supplier_orders so
        JOIN tenants t ON t.id = so.tenant_id
        JOIN supplier_sub_batches ssb ON ssb.supplier_order_id = so.id
        WHERE so.id = ${orderId}::uuid AND ssb.bid = ${bid}
        LIMIT 1
      `;
  const subBatch = rows[0];
  if (!subBatch) return json({ ok: false, reason: "supplier_sub_batch_not_found" }, 404);

  const passed = Boolean(body.passed ?? body.qa_passed ?? body.status === "passed");
  if (passed && subBatch.manifest_status !== "imported") {
    return json({
      ok: false,
      reason: "manifest_required_before_qa",
      message: "Import and validate the UID manifest before marking QA as passed.",
    }, 409);
  }

  const sampleUrls = Array.isArray(body.sample_urls)
    ? body.sample_urls.map(safeString).filter(Boolean)
    : Array.isArray(body.sampleUrls)
      ? body.sampleUrls.map(safeString).filter(Boolean)
      : [];
  const replayChecked = Boolean(body.replay_checked ?? body.replayChecked);
  const ttstatusChecked = Boolean(body.ttstatus_checked ?? body.ttstatusChecked);
  const requiresTtstatus = String(subBatch.carrier_profile_code || "").trim() === "ntag424_dna_tt";
  const requiresSecureSun = requiresSecureSunEncoding(subBatch.carrier_profile_code);
  const evidenceGate = validateSupplierQaEvidence({
    passed,
    sampleUrls,
    replayChecked,
    ttstatusChecked,
    requiresTtstatus,
    requiresSecureSun,
    expectedBid: subBatch.bid,
  });
  if (!evidenceGate.ok) {
    return json({
      ok: false,
      reason: evidenceGate.reason,
      message: requiresTtstatus
        ? "QA passed requires at least one sample URL plus replay and TTStatus checks."
        : "QA passed requires at least one sample URL plus replay check.",
      bid: subBatch.bid,
      sample_count: evidenceGate.sampleCount,
      carrier_profile_code: subBatch.carrier_profile_code,
    }, 409);
  }
  const normalizedSampleUrls = evidenceGate.ok ? evidenceGate.sampleUrls ?? sampleUrls : sampleUrls;
  const sampleUrlHashes = evidenceGate.ok ? evidenceGate.sampleUrlHashes ?? [] : [];
  const notes = safeString(body.notes) || null;
  const status = passed ? "passed" : "failed";
  const actor = safeActor(req);
  const evidence = {
    sample_url_hashes: sampleUrlHashes,
    replay_checked: replayChecked,
    ttstatus_checked: ttstatusChecked,
    evidence_digest: evidenceGate.ok ? evidenceGate.evidenceDigest : null,
    requires_secure_sun: requiresSecureSun,
    notes,
    checked_by: actor,
  };

  await sql/*sql*/`
    INSERT INTO supplier_qa_checks (
      tenant_id, supplier_order_id, supplier_sub_batch_id, batch_id, bid, status,
      sample_count, replay_checked, ttstatus_checked, notes, evidence_json, checked_by
    ) VALUES (
      ${subBatch.tenant_id}, ${subBatch.supplier_order_id}, ${subBatch.supplier_sub_batch_id},
      ${subBatch.batch_id}, ${subBatch.bid}, ${status}, ${normalizedSampleUrls.length}, ${replayChecked},
      ${ttstatusChecked}, ${notes}, ${JSON.stringify(evidence)}::jsonb, ${actor}
    )
  `;
  await sql/*sql*/`
    INSERT INTO vault_artifacts (
      tenant_id, supplier_order_id, supplier_sub_batch_id, resource_type, resource_id,
      artifact_type, content_hash, mime_type, metadata_json
    ) VALUES (
      ${subBatch.tenant_id}, ${subBatch.supplier_order_id}, ${subBatch.supplier_sub_batch_id},
      'supplier_sub_batch', ${subBatch.supplier_sub_batch_id}, 'qa_report',
      ${evidenceGate.ok ? evidenceGate.evidenceDigest : hashEvidencePayload({ status, bid: subBatch.bid, sample_count: normalizedSampleUrls.length })},
      'application/json',
      ${JSON.stringify({
        bid: subBatch.bid,
        qa_status: status,
        sample_count: normalizedSampleUrls.length,
        replay_checked: replayChecked,
        ttstatus_checked: ttstatusChecked,
        evidence_digest: evidenceGate.ok ? evidenceGate.evidenceDigest : null,
      })}::jsonb
    )
  `;
  await sql/*sql*/`
    UPDATE supplier_sub_batches
    SET qa_status = ${status}, qa_passed_at = CASE WHEN ${passed} THEN now() ELSE qa_passed_at END, updated_at = now()
    WHERE id = ${subBatch.supplier_sub_batch_id}
  `;
  await sql/*sql*/`
    UPDATE batches
    SET qa_status = ${status}
    WHERE id = ${subBatch.batch_id}
  `;

  const eventPayload = {
    supplier_order_id: subBatch.supplier_order_id,
    supplier_sub_batch_id: subBatch.supplier_sub_batch_id,
    bid: subBatch.bid,
    status,
    sample_count: normalizedSampleUrls.length,
    replay_checked: replayChecked,
    ttstatus_checked: ttstatusChecked,
    requires_ttstatus: requiresTtstatus,
    requires_secure_sun: requiresSecureSun,
    evidence_digest: evidenceGate.ok ? evidenceGate.evidenceDigest : null,
  };
  const eventHash = hashEvidencePayload({
    tenantId: String(subBatch.tenant_id),
    resourceType: "supplier_sub_batch",
    resourceId: String(subBatch.supplier_sub_batch_id),
    eventType: passed ? "qa_passed" : "qa_failed",
    payload: eventPayload,
  });
  await sql/*sql*/`
    INSERT INTO evidence_events (tenant_id, resource_type, resource_id, event_type, payload_json, payload_hash)
    VALUES (${subBatch.tenant_id}, 'supplier_sub_batch', ${subBatch.supplier_sub_batch_id}, ${passed ? "qa_passed" : "qa_failed"}, ${JSON.stringify(eventPayload)}::jsonb, ${eventHash})
    ON CONFLICT (payload_hash) DO NOTHING
  `;

  await logAuditEvent({
    actorId: null,
    tenantId: String(subBatch.tenant_id),
    action: passed ? "supplier_qa_passed" : "supplier_qa_failed",
    resourceType: "supplier_sub_batch",
    resourceId: String(subBatch.supplier_sub_batch_id),
    afterData: eventPayload,
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    bid: subBatch.bid,
    qa_status: status,
    activation_gate: passed ? "manifest_imported_and_qa_passed" : "blocked_until_qa_passed",
    evidence_hash: eventHash,
    requires_ttstatus: requiresTtstatus,
  });
}
