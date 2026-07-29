export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantAccess } from "../../../../lib/auth";
import { areAdminSunBidsInTenantScope, isAdminSunDiagnosticInTenantScope } from "../../../../lib/admin-sun-tenant-scope";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import {
  buildSunPayloadHashes,
  isCompleteSunPayload,
  normalizeSunHex,
  parseSunPayloadFromFields,
  type SunPayloadParts,
} from "../../../../lib/sun-payload.ts";
import { upsertTagSunPayload } from "../../../../lib/sun-payload-registry.ts";

type RegisterPayloadBody = {
  bid?: string;
  uidHex?: string;
  diagnosticId?: string | number;
  url?: string;
  sampleUrl?: string;
  picc_data?: string;
  picc?: string;
  enc?: string;
  encrypted_data?: string;
  cmac?: string;
  mac?: string;
  source?: string;
};

function readString(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function payloadFromDiagnosticRequest(requestJson: unknown, fallbackBid: string): SunPayloadParts | null {
  if (!requestJson || typeof requestJson !== "object") return null;
  const record = requestJson as Record<string, unknown>;
  const bid = readString(record.bid || fallbackBid);
  const piccDataHex = normalizeSunHex(record.picc_data || record.picc || record.p);
  const encHex = normalizeSunHex(record.enc || record.encrypted_data || record.e);
  const cmacHex = normalizeSunHex(record.cmac || record.mac || record.c);
  return { bid, piccDataHex, encHex, cmacHex, sourceUrl: null };
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const { forcedTenantSlug } = getAdminTenantAccess(req);

  const body = (await req.json().catch(() => ({}))) as RegisterPayloadBody;
  const uidHex = normalizeSunHex(body.uidHex);
  const requestedBid = readString(body.bid);
  const diagnosticId = readString(body.diagnosticId);

  if (!uidHex) return json({ ok: false, reason: "uid_hex_required" }, 400);
  if (!requestedBid && !diagnosticId) return json({ ok: false, reason: "bid_or_diagnostic_required" }, 400);

  let diagnostic: Record<string, unknown> | null = null;
  if (diagnosticId) {
    if (!await isAdminSunDiagnosticInTenantScope({ diagnosticId, forcedTenantSlug })) {
      return json({ ok: false, reason: "diagnostic_not_found" }, 404);
    }
    const rows = await sql/*sql*/`
      SELECT id, bid, request_json
      FROM sun_diagnostics
      WHERE id = ${diagnosticId}
      LIMIT 1
    `;
    diagnostic = (rows[0] as Record<string, unknown> | undefined) || null;
    if (!diagnostic) return json({ ok: false, reason: "diagnostic_not_found" }, 404);
  }

  const bid = requestedBid || readString(diagnostic?.bid);
  if (!bid) return json({ ok: false, reason: "batch_required" }, 400);
  if (!await areAdminSunBidsInTenantScope({ bids: [bid], forcedTenantSlug })) {
    return json({ ok: false, reason: "batch_not_found" }, 404);
  }

  const batchRows = await sql/*sql*/`
    SELECT b.id, b.tenant_id, b.bid, b.status, b.created_at, t.slug AS tenant_slug
    FROM batches b
    LEFT JOIN tenants t ON t.id = b.tenant_id
    WHERE b.bid = ${bid}
    ORDER BY b.created_at ASC, b.id ASC
  `;
  if (batchRows.length > 1) {
    return json({
      ok: false,
      reason: "DUPLICATE_BID",
      message: "BID must be globally unique before binding supplier SUN payloads.",
      batches: batchRows.map((row) => ({ id: row.id, status: row.status || null, created_at: row.created_at || null, tenant_slug: row.tenant_slug || null })),
    }, 409);
  }
  const batch = batchRows[0] as Record<string, unknown> | undefined;
  if (!batch) return json({ ok: false, reason: "batch_not_found" }, 404);

  const tagRows = await sql/*sql*/`
    SELECT id, uid_hex, status, carrier_profile_code
    FROM tags
    WHERE batch_id = ${batch.id}
      AND UPPER(uid_hex) = UPPER(${uidHex})
    LIMIT 1
  `;
  const tag = tagRows[0] as Record<string, unknown> | undefined;
  if (!tag) {
    return json({
      ok: false,
      reason: "uid_not_in_batch",
      message: "Import the supplier UID manifest before binding SUN payloads.",
      bid,
      uidHex,
    }, 404);
  }

  const payload =
    parseSunPayloadFromFields(body, bid)
    || payloadFromDiagnosticRequest(diagnostic?.request_json, bid);

  if (!isCompleteSunPayload(payload)) {
    return json({
      ok: false,
      reason: "complete_sun_payload_required",
      need: ["bid", "picc_data", "enc", "cmac"],
    }, 400);
  }
  if (payload.bid !== bid || !await areAdminSunBidsInTenantScope({ bids: [payload.bid], forcedTenantSlug })) {
    return json({ ok: false, reason: "payload_bid_mismatch" }, 400);
  }

  const hashes = buildSunPayloadHashes({
    bid: payload.bid || bid,
    piccDataHex: payload.piccDataHex,
    encHex: payload.encHex,
    cmacHex: payload.cmacHex,
  });

  const registered = await upsertTagSunPayload({
    tenantId: String(batch.tenant_id),
    batchId: String(batch.id),
    bid: payload.bid || bid,
    tagId: String(tag.id),
    uidHex,
    hashes,
    source: readString(body.source) || (diagnosticId ? "admin_diagnostic_binding" : "admin_payload_binding"),
    rawPayload: {
      source: "admin.sun.register-payload",
      diagnosticId: diagnosticId || null,
      tenantSlug: batch.tenant_slug || null,
      bid,
      hasUrl: Boolean(payload.sourceUrl),
    },
  });

  return json({
    ok: true,
    bid,
    uidHex,
    tagStatus: tag.status,
    payloadId: registered?.id || null,
    diagnosticId: diagnosticId || null,
    verificationPath: "supplier_payload_manifest",
  });
}
