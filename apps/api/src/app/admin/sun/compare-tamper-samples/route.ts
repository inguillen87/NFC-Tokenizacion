export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { processSunScan } from "../../../../lib/sun-service";

type Body = { closed_urls?: string[]; opened_urls?: string[] };

type ParsedSun = { bid: string; piccDataHex: string; encHex: string; cmacHex: string; rawQuery: Record<string, string> };

function parseSunUrl(rawUrl: string): ParsedSun {
  const parsed = new URL(rawUrl);
  return {
    bid: String(parsed.searchParams.get("bid") || "").trim(),
    piccDataHex: String(parsed.searchParams.get("picc_data") || "").trim(),
    encHex: String(parsed.searchParams.get("enc") || "").trim(),
    cmacHex: String(parsed.searchParams.get("cmac") || "").trim(),
    rawQuery: Object.fromEntries(parsed.searchParams.entries()),
  };
}

function byteMap(hexList: string[]) {
  const map = new Map<number, Set<string>>();
  for (const hex of hexList) {
    const normalized = String(hex || "").toUpperCase();
    for (let i = 0; i + 2 <= normalized.length; i += 2) {
      const offset = i / 2;
      const value = normalized.slice(i, i + 2);
      const set = map.get(offset) || new Set<string>();
      set.add(value);
      map.set(offset, set);
    }
  }
  return map;
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as Body;
  const closedUrls = Array.isArray(body.closed_urls) ? body.closed_urls.filter(Boolean) : [];
  const openedUrls = Array.isArray(body.opened_urls) ? body.opened_urls.filter(Boolean) : [];
  if (!closedUrls.length || !openedUrls.length) return json({ ok: false, reason: "closed_urls and opened_urls required" }, 400);

  const inspectMany = async (urls: string[], label: string) => Promise.all(urls.map(async (url, index) => {
    const parsed = parseSunUrl(url);
    return processSunScan({ ...parsed, context: { source: "imported", deviceLabel: `admin_compare_samples_${label}_${index}`, meta: { comparedFrom: "admin.sun.compare_tamper_samples" } } });
  }));

  const [closedResults, openedResults] = await Promise.all([inspectMany(closedUrls, "closed"), inspectMany(openedUrls, "opened")]);
  const closedBodies = closedResults.map((entry) => entry.body as Record<string, unknown>);
  const openedBodies = openedResults.map((entry) => entry.body as Record<string, unknown>);

  const uidHex = String(closedBodies[0]?.uid || openedBodies[0]?.uid || "");
  const closedHexes = closedBodies.map((x) => String(x.enc_plain_hex || "")).filter(Boolean);
  const openedHexes = openedBodies.map((x) => String(x.enc_plain_hex || "")).filter(Boolean);

  const closedMap = byteMap(closedHexes);
  const openedMap = byteMap(openedHexes);

  const stableClosedBytes: Array<{ offset: number; value: string }> = [];
  const stableOpenedBytes: Array<{ offset: number; value: string }> = [];
  const candidateOffsets: Array<{ source: "enc_decrypted"; offset: number; closed_values: string[]; opened_values: string[]; confidence: "HIGH" | "MEDIUM" }> = [];

  for (const [offset, values] of closedMap.entries()) {
    if (values.size === 1) stableClosedBytes.push({ offset, value: Array.from(values)[0] });
  }
  for (const [offset, values] of openedMap.entries()) {
    if (values.size === 1) stableOpenedBytes.push({ offset, value: Array.from(values)[0] });
  }

  const stableClosedByOffset = new Map(stableClosedBytes.map((entry) => [entry.offset, entry.value]));
  const stableOpenedByOffset = new Map(stableOpenedBytes.map((entry) => [entry.offset, entry.value]));
  for (const [offset, closedValue] of stableClosedByOffset.entries()) {
    const openedValue = stableOpenedByOffset.get(offset);
    if (openedValue && openedValue !== closedValue) {
      candidateOffsets.push({ source: "enc_decrypted", offset, closed_values: [closedValue], opened_values: [openedValue], confidence: "HIGH" });
    }
  }

  return json({
    ok: true,
    uid_hex: uidHex || null,
    closed_count: closedBodies.length,
    opened_count: openedBodies.length,
    stable_closed_bytes: stableClosedBytes,
    stable_opened_bytes: stableOpenedBytes,
    candidate_offsets: candidateOffsets,
    recommended_config: candidateOffsets[0]
      ? {
        tamper_status_source: "enc_decrypted",
        tamper_status_offset: candidateOffsets[0].offset,
        tamper_status_length: 1,
        tamper_closed_values: candidateOffsets[0].closed_values,
        tamper_open_values: candidateOffsets[0].opened_values,
      }
      : null,
    recommendation: candidateOffsets.length
      ? "Stable offset candidates found across closed/opened sample groups."
      : "No electronic TagTamper signal detected in the decrypted payload. Supplier may not have included open/closed status, or the physical loop was not broken correctly.",
  });
}
