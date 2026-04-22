export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { processSunScan } from "../../../../lib/sun-service";

type InspectBody = { url?: string };

function bytesTable(hex: string) {
  const normalized = String(hex || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  const rows: Array<{ offset: number; hex: string }> = [];
  for (let i = 0; i + 2 <= normalized.length; i += 2) {
    rows.push({ offset: i / 2, hex: normalized.slice(i, i + 2) });
  }
  return rows;
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as InspectBody;
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
  const replayStatus = bodyResult.result === "REPLAY_SUSPECT" ? "REPLAY_SUSPECT" : "NO_REPLAY";
  return json({
    ok: true,
    bid,
    uid_hex: uidHex || null,
    read_counter: Number.isFinite(readCounter) && readCounter >= 0 ? readCounter : null,
    auth_status: bodyResult.ok === true ? "VALID_AUTH" : "INVALID_AUTH",
    replay_status: replayStatus,
    picc_data_raw: piccDataHex,
    picc_data_decrypted_hex: bodyResult.picc_plain_hex || null,
    picc_data_bytes_table: bytesTable(String(bodyResult.picc_plain_hex || "")),
    enc_raw: encHex,
    enc_decrypted_hex: bodyResult.enc_plain_hex || null,
    enc_bytes_table: bytesTable(String(bodyResult.enc_plain_hex || "")),
    cmac: cmacHex,
    validation_result: bodyResult.result || null,
    tamper_supported: bodyResult.tamper_supported ?? false,
    tamper_configured: bodyResult.tamper_configured ?? false,
    tamper_status: bodyResult.tamper_status || "UNKNOWN",
    tamper_raw_value: bodyResult.tamper_raw_value ?? null,
    notes: bodyResult.tamper_reason || "No secrets exposed (keys omitted).",
    parser_config: {
      source: bodyResult.tamper_status_source || "none",
      offset: bodyResult.tamper_status_offset ?? null,
      length: bodyResult.tamper_status_length ?? null,
      closed_values: bodyResult.tamper_closed_values || [],
      open_values: bodyResult.tamper_open_values || [],
    },
  }, 200);
}
