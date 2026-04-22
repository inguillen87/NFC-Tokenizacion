export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { processSunScan } from "../../../../lib/sun-service";

type CompareBody = { before_url?: string; after_url?: string };

function parseSunUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  return {
    bid: String(parsed.searchParams.get("bid") || "").trim(),
    piccDataHex: String(parsed.searchParams.get("picc_data") || "").trim(),
    encHex: String(parsed.searchParams.get("enc") || "").trim(),
    cmacHex: String(parsed.searchParams.get("cmac") || "").trim(),
    rawQuery: Object.fromEntries(parsed.searchParams.entries()),
  };
}

function diffHex(a: string, b: string) {
  const left = String(a || "").toUpperCase();
  const right = String(b || "").toUpperCase();
  const maxLen = Math.max(left.length, right.length);
  const rows: Array<{ offset: number; before: string; after: string }> = [];
  for (let i = 0; i < maxLen; i += 2) {
    const before = left.slice(i, i + 2);
    const after = right.slice(i, i + 2);
    if (before !== after) rows.push({ offset: i / 2, before, after });
  }
  return rows;
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as CompareBody;
  const beforeUrl = String(body.before_url || "").trim();
  const afterUrl = String(body.after_url || "").trim();
  if (!beforeUrl || !afterUrl) return json({ ok: false, reason: "before_url and after_url required" }, 400);

  let beforeInput: ReturnType<typeof parseSunUrl>;
  let afterInput: ReturnType<typeof parseSunUrl>;
  try {
    beforeInput = parseSunUrl(beforeUrl);
    afterInput = parseSunUrl(afterUrl);
  } catch {
    return json({ ok: false, reason: "invalid URL format" }, 400);
  }

  if (!beforeInput.bid || !beforeInput.piccDataHex || !beforeInput.encHex || !beforeInput.cmacHex) return json({ ok: false, reason: "before_url missing required SUN params" }, 400);
  if (!afterInput.bid || !afterInput.piccDataHex || !afterInput.encHex || !afterInput.cmacHex) return json({ ok: false, reason: "after_url missing required SUN params" }, 400);

  const [beforeResult, afterResult] = await Promise.all([
    processSunScan({ ...beforeInput, context: { source: "imported", deviceLabel: "admin_sun_compare_before", meta: { comparedFrom: "admin.sun.compare_tamper.before" } } }),
    processSunScan({ ...afterInput, context: { source: "imported", deviceLabel: "admin_sun_compare_after", meta: { comparedFrom: "admin.sun.compare_tamper.after" } } }),
  ]);

  const before = beforeResult.body as Record<string, unknown>;
  const after = afterResult.body as Record<string, unknown>;
  const sdmDiff = diffHex(String(before.enc_plain_hex || ""), String(after.enc_plain_hex || ""));
  const encDiff = diffHex(beforeInput.encHex, afterInput.encHex);
  const possibleOffset = sdmDiff[0]?.offset ?? encDiff[0]?.offset ?? null;

  return json({
    ok: true,
    comparison: {
      SAME_UID: Boolean(before.uid && after.uid && String(before.uid) === String(after.uid)),
      COUNTER_INCREASED: Number(after.ctr || -1) > Number(before.ctr || -1),
      ENC_CHANGED: encDiff.length > 0,
      POSSIBLE_TAMPER_FIELD_FOUND: possibleOffset != null,
      detected_closed_value: before.tamper_raw_value || null,
      detected_open_value: after.tamper_raw_value || null,
      recommended_tamper_status_offset: possibleOffset,
      recommended_mapping: possibleOffset != null
        ? { closed: [sdmDiff[0]?.before || encDiff[0]?.before || "00"], opened: [sdmDiff[0]?.after || encDiff[0]?.after || "01"] }
        : null,
      message: possibleOffset == null
        ? "No TagTamper signal detected in current payload. Supplier may not have encoded TagTamper status, or physical loop may not have been broken."
        : "Potential tamper signal found. Configure batch parser and retest.",
    },
    changed_bytes: {
      decrypted_sdm: sdmDiff,
      enc: encDiff,
      picc_data: diffHex(beforeInput.piccDataHex, afterInput.piccDataHex),
    },
    before: {
      result: before.result || null,
      uid: before.uid || null,
      ctr: before.ctr ?? null,
      tamper_status: before.tamper_status || "UNKNOWN",
    },
    after: {
      result: after.result || null,
      uid: after.uid || null,
      ctr: after.ctr ?? null,
      tamper_status: after.tamper_status || "UNKNOWN",
    },
  });
}
