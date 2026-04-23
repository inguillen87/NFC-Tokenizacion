export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { processSunScan } from "../../../../lib/sun-service";

type Body = { closed_urls?: string[]; opened_urls?: string[] };

type ParsedSun = { bid: string; piccDataHex: string; encHex: string; cmacHex: string; rawQuery: Record<string, string> };

const TT_PATTERNS = new Set(["4343", "4F4F", "4F43", "4949"]);

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

function bytesAtOffset(hex: string, offset: number) {
  const normalized = String(hex || "").toUpperCase();
  const start = offset * 2;
  if (normalized.length < start + 4) return "";
  return normalized.slice(start, start + 4);
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
    return processSunScan({
      ...parsed,
      context: { source: "imported", deviceLabel: `admin_find_ttstatus_${label}_${index}`, meta: { inspectedFrom: "admin.sun.find_ttstatus_candidates" } },
    });
  }));

  const [closedResults, openedResults] = await Promise.all([inspectMany(closedUrls, "closed"), inspectMany(openedUrls, "opened")]);
  const closedBodies = closedResults.map((entry) => entry.body as Record<string, unknown>);
  const openedBodies = openedResults.map((entry) => entry.body as Record<string, unknown>);

  const closedHexes = closedBodies.map((x) => String(x.enc_plain_hex || "")).filter(Boolean);
  const openedHexes = openedBodies.map((x) => String(x.enc_plain_hex || "")).filter(Boolean);
  const maxLen = Math.max(...closedHexes.map((h) => h.length), ...openedHexes.map((h) => h.length), 0);
  const maxOffset = Math.floor(maxLen / 2) - 2;

  const candidates: Array<{
    offset: number;
    closed_values: string[];
    opened_values: string[];
    confidence: "HIGH" | "MEDIUM" | "LOW";
    source: "enc_decrypted";
  }> = [];

  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const closedValues = Array.from(new Set(closedHexes.map((hex) => bytesAtOffset(hex, offset)).filter(Boolean)));
    const openedValues = Array.from(new Set(openedHexes.map((hex) => bytesAtOffset(hex, offset)).filter(Boolean)));
    if (!closedValues.length || !openedValues.length) continue;
    if (!closedValues.every((value) => TT_PATTERNS.has(value)) || !openedValues.every((value) => TT_PATTERNS.has(value))) continue;
    const closedHasClosedSignal = closedValues.includes("4343");
    const openedHasOpenSignal = openedValues.includes("4F4F") || openedValues.includes("4F43");
    if (!closedHasClosedSignal || !openedHasOpenSignal) continue;
    const confidence = closedValues.length === 1 && openedValues.length === 1 ? "HIGH" : closedValues.length <= 2 && openedValues.length <= 2 ? "MEDIUM" : "LOW";
    candidates.push({ offset, closed_values: closedValues, opened_values: openedValues, confidence, source: "enc_decrypted" });
  }

  return json({
    ok: true,
    closed_count: closedBodies.length,
    opened_count: openedBodies.length,
    candidate_offsets: candidates,
    recommendation: candidates.length
      ? "TTStatus candidate offsets found. Configure ttstatus_offset using the highest confidence candidate."
      : "No TTStatus pattern found. Supplier may not have mirrored TTStatus into SDMENCFileData.",
  });
}
