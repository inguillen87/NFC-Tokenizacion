export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { processSunScan } from "../../../../lib/sun-service";

type CompareBody = { before_url?: string; after_url?: string; closed_url?: string; opened_url?: string };

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
  const beforeUrl = String(body.before_url || body.closed_url || "").trim();
  const afterUrl = String(body.after_url || body.opened_url || "").trim();
  if (!beforeUrl || !afterUrl) return json({ ok: false, reason: "closed_url/opened_url required" }, 400);

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

  const piccDiff = diffHex(String(before.picc_plain_hex || ""), String(after.picc_plain_hex || ""));
  const sameUid = Boolean(before.uid && after.uid && String(before.uid) === String(after.uid));
  const confidence = possibleOffset == null ? "low" : sdmDiff.length <= 2 ? "medium" : "high";
  const recommendation = possibleOffset == null
    ? "No stable TagTamper status candidate detected. Need more samples."
    : `Candidate offset ${possibleOffset} detected. Validate with multi-sample compare before saving parser.`;
  return json({
    ok: true,
    same_uid: sameUid,
    closed_counter: Number(before.ctr ?? -1) >= 0 ? Number(before.ctr) : null,
    opened_counter: Number(after.ctr ?? -1) >= 0 ? Number(after.ctr) : null,
    picc_changed_bytes: piccDiff,
    enc_changed_bytes: sdmDiff,
    possible_tamper_candidates: possibleOffset == null
      ? []
      : [{
        offset: possibleOffset,
        closed_value: sdmDiff[0]?.before || encDiff[0]?.before || null,
        opened_value: sdmDiff[0]?.after || encDiff[0]?.after || null,
      }],
    recommendation,
    confidence,
    validation: {
      closed_result: before.result || null,
      opened_result: after.result || null,
      closed_tamper_status: before.tamper_status || "UNKNOWN",
      opened_tamper_status: after.tamper_status || "UNKNOWN",
    },
  });
}
