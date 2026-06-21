export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { performReceiptOcr } from "../../../../lib/ocr-service";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const { receiptFileData, receiptFileName, event_id, eventId, uid, uid_hex, uidHex, bid } = body;

    if (!receiptFileData) {
      return json({ ok: false, error: "receipt_file_data_required" }, 400);
    }

    let expectedProduct = "Gran Reserva Malbec";
    let expectedWinery = "Bodega Demo";

    const resolvedEventId = event_id || eventId;
    const resolvedUid = uid || uid_hex || uidHex;

    const { sql } = await import("../../../../lib/db");

    if (resolvedEventId) {
      const eventRows = await sql`SELECT batch_id, tenant_id FROM events WHERE id = ${resolvedEventId} LIMIT 1`;
      const batchId = eventRows[0]?.batch_id;
      const tenantId = eventRows[0]?.tenant_id;
      if (batchId) {
        const batchRows = await sql`SELECT sdm_config FROM batches WHERE id = ${batchId} LIMIT 1`;
        const sdmConfig = batchRows[0]?.sdm_config as any;
        const resolvedName = sdmConfig?.sun?.product?.name || sdmConfig?.productName || sdmConfig?.product_name || sdmConfig?.title;
        if (resolvedName) expectedProduct = String(resolvedName);
      }
      if (tenantId) {
        const tenantRows = await sql`SELECT name FROM tenants WHERE id = ${tenantId} LIMIT 1`;
        const resolvedWinery = tenantRows[0]?.name;
        if (resolvedWinery) expectedWinery = String(resolvedWinery);
      }
    } else if (resolvedUid && bid) {
      const tagRows = await sql`
        SELECT b.id AS batch_id, b.tenant_id FROM tags t
        JOIN batches b ON b.id = t.batch_id
        WHERE b.bid = ${bid} AND t.uid_hex = ${resolvedUid}
        LIMIT 1
      `;
      const batchId = tagRows[0]?.batch_id;
      const tenantId = tagRows[0]?.tenant_id;
      if (batchId) {
        const batchRows = await sql`SELECT sdm_config FROM batches WHERE id = ${batchId} LIMIT 1`;
        const sdmConfig = batchRows[0]?.sdm_config as any;
        const resolvedName = sdmConfig?.sun?.product?.name || sdmConfig?.productName || sdmConfig?.product_name || sdmConfig?.title;
        if (resolvedName) expectedProduct = String(resolvedName);
      }
      if (tenantId) {
        const tenantRows = await sql`SELECT name FROM tenants WHERE id = ${tenantId} LIMIT 1`;
        const resolvedWinery = tenantRows[0]?.name;
        if (resolvedWinery) expectedWinery = String(resolvedWinery);
      }
    }

    console.log(`[OCR API] Running Hugging Face VLM OCR for receipt: ${receiptFileName || "unnamed"}. Expected: ${expectedProduct} by ${expectedWinery}`);
    const ocrResult = await performReceiptOcr(
      receiptFileData,
      expectedProduct,
      expectedWinery,
      receiptFileName
    );

    return json({
      ok: true,
      ocr: ocrResult,
    });
  } catch (error: any) {
    console.error("[OCR API] Error in receipt-ocr handler:", error);
    return json({ ok: false, error: error.message || "ocr_internal_error" }, 500);
  }
}
