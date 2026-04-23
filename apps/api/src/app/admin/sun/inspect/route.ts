export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { parseTTStatusFromDecryptedPayload, processSunScan } from "../../../../lib/sun-service";
import { insertSunDiagnostic } from "../../../../lib/sun-diagnostics";

type InspectBody = { url?: string };

function bytesTable(hex: string) {
  const normalized = String(hex || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  const rows: Array<{ offset: number; hex: string; bin: string; meaning: string }> = [];
  for (let i = 0; i + 2 <= normalized.length; i += 2) {
    const hexByte = normalized.slice(i, i + 2);
    const value = Number.parseInt(hexByte, 16);
    rows.push({ offset: i / 2, hex: hexByte, bin: Number.isFinite(value) ? value.toString(2).padStart(8, "0") : "00000000", meaning: "unknown" });
  }
  return rows;
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as InspectBody;
  const traceId = `sun_${Date.now().toString(36)}_inspect`;
  const rawUrl = String(body.url || "").trim();
  if (!rawUrl) return json({ ok: false, reason: "url required" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return json({ ok: false, reason: "invalid URL format" }, 400);
  }

  const bid = String(parsed.searchParams.get("bid") || "").trim();
  const piccDataHex = String(parsed.searchParams.get("picc_data") || "").trim();
  const encHex = String(parsed.searchParams.get("enc") || "").trim();
  const cmacHex = String(parsed.searchParams.get("cmac") || "").trim();

  if (!bid || !piccDataHex || !encHex || !cmacHex) {
    return json({ ok: false, reason: "missing sun params", need: ["bid", "picc_data", "enc", "cmac"] }, 400);
  }

  const result = await processSunScan({
    bid,
    piccDataHex,
    encHex,
    cmacHex,
    rawQuery: Object.fromEntries(parsed.searchParams.entries()),
    context: {
      source: "imported",
      deviceLabel: "admin_sun_inspect",
      meta: { inspectedFrom: "admin.sun.inspect" },
    },
  });

  const bodyResult = result.body as Record<string, unknown>;

  const uidHex = String(bodyResult.uid || "");
  const readCounter = Number(bodyResult.ctr ?? -1);
  const replayStatus = bodyResult.auth_status === "REPLAY_SUSPECT" || bodyResult.result === "REPLAY_SUSPECT" ? "REPLAY_SUSPECT" : "NO_REPLAY";
  const payload = {
    ok: true,
    bid,
    uid_hex: uidHex || null,
    read_counter: Number.isFinite(readCounter) && readCounter >= 0 ? readCounter : null,
    auth_status: bodyResult.auth_status || (bodyResult.ok === true ? "VALID" : "INVALID"),
    replay_status: replayStatus,
    picc_data_raw: piccDataHex,
    picc_data_decrypted_hex: bodyResult.picc_plain_hex || null,
    picc_data_bytes: bytesTable(String(bodyResult.picc_plain_hex || "")),
    enc_raw: encHex,
    enc_decrypted_hex: bodyResult.enc_plain_hex || null,
    enc_bytes: bytesTable(String(bodyResult.enc_plain_hex || "")),
    cmac: cmacHex,
    validation_result: bodyResult.result || null,
    tamper_supported: bodyResult.tamper_supported ?? false,
    tamper_configured: bodyResult.tamper_configured ?? false,
    tamper_status: bodyResult.tamper_status || "UNKNOWN",
    tt_perm_status: bodyResult.tt_perm_status || "UNKNOWN",
    tt_curr_status: bodyResult.tt_curr_status || "UNKNOWN",
    ttstatus_raw: bodyResult.ttstatus_raw || null,
    ttstatus_reason: bodyResult.ttstatus_reason || null,
    encPlainStatusByte: bodyResult.enc_plain_status_byte || null,
    tamper_raw_value: bodyResult.tamper_raw_value ?? null,
    notes: [bodyResult.tamper_reason || "No secrets exposed (keys omitted)."].filter(Boolean),
    parser_config: {
      source: bodyResult.tamper_status_source || "none",
      offset: bodyResult.tamper_status_offset ?? null,
      length: bodyResult.tamper_status_length ?? null,
      ttstatus_source: bodyResult.ttstatus_source || bodyResult.tamper_status_source || "none",
      ttstatus_offset: bodyResult.ttstatus_offset ?? bodyResult.tamper_status_offset ?? null,
      ttstatus_length: bodyResult.ttstatus_length ?? 2,
      closed_values: bodyResult.tamper_closed_values || [],
      open_values: bodyResult.tamper_open_values || [],
    },
    ttstatus_bytes_at_offset: (() => {
      const offset = Number(bodyResult.ttstatus_offset ?? bodyResult.tamper_status_offset ?? -1);
      const encHex = String(bodyResult.enc_plain_hex || "");
      if (!Number.isInteger(offset) || offset < 0 || encHex.length < offset * 2 + 4) return null;
      return encHex.slice(offset * 2, offset * 2 + 4).toUpperCase();
    })(),
    recommendation: bodyResult.ttstatus_raw
      ? "TTStatus parsed from configured offset."
      : "TTStatus not parsed. Confirm ttstatus_enabled, source, and offset for this batch.",
  };
  const ttOffset = Number(payload.parser_config.ttstatus_offset);
  const parsedTT = Number.isInteger(ttOffset) && ttOffset >= 0 && payload.enc_decrypted_hex
    ? parseTTStatusFromDecryptedPayload(String(payload.enc_decrypted_hex), ttOffset)
    : null;
  const bytesAtOffset = Number.isInteger(ttOffset) && ttOffset >= 0 && payload.enc_decrypted_hex
    ? String(payload.enc_decrypted_hex).toUpperCase().slice(ttOffset * 2, ttOffset * 2 + 4)
    : null;
  const enhancedPayload = {
    ...payload,
    configured_ttstatus_offset: payload.parser_config.ttstatus_offset,
    bytes_at_offset: bytesAtOffset,
    parsed_ttstatus: parsedTT || (bodyResult.ttstatus_raw ? {
      raw: bodyResult.ttstatus_raw,
      perm: bodyResult.tt_perm_status || "UNKNOWN",
      current: bodyResult.tt_curr_status || "UNKNOWN",
      product_state: bodyResult.product_state || "VALID_UNKNOWN_TAMPER",
    } : null),
    recommendation: parsedTT
      ? `TTStatus detected at offset ${ttOffset}: ${parsedTT.raw}`
      : "No TTStatus parsed from decrypted payload. Verify ttstatus_offset and supplier SDM mirror config.",
  };
  const diagnosticId = await insertSunDiagnostic({
    trace_id: traceId,
    tool_type: "inspect",
    bid,
    uid_hex: uidHex || null,
    read_counter: Number.isFinite(readCounter) && readCounter >= 0 ? readCounter : null,
    auth_status: String(payload.auth_status || "UNKNOWN"),
    replay_status: replayStatus,
    tamper_status: String(payload.tamper_status || "UNKNOWN"),
    enc_plain_status_byte: String(payload.encPlainStatusByte || "") || null,
    request_json: body,
    result_json: enhancedPayload,
    notes: enhancedPayload.notes || [],
  });
  return json({ ok: true, diagnostic_id: diagnosticId, trace_id: traceId, result: enhancedPayload }, 200);
}
