export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { parseTTStatusFromDecryptedPayload, processSunScan } from "../../../../lib/sun-service";

type Body = { closed_urls?: string[]; opened_urls?: string[] };

type ParsedSun = {
  bid: string;
  piccDataHex: string;
  encHex: string;
  cmacHex: string;
  rawQuery: Record<string, string>;
};

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

function looksLikeTTStatus(raw: string) {
  return ["4343", "4F4F", "4F43", "4949"].includes(raw.toUpperCase());
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
      context: { source: "imported", deviceLabel: `admin_find_ttstatus_${label}_${index}`, meta: { comparedFrom: "admin.sun.find_ttstatus_candidates" } },
    });
  }));

  const [closedResults, openedResults] = await Promise.all([inspectMany(closedUrls, "closed"), inspectMany(openedUrls, "opened")]);
  const closedBodies = closedResults.map((entry) => entry.body as Record<string, unknown>);
  const openedBodies = openedResults.map((entry) => entry.body as Record<string, unknown>);

  const sources: Array<"enc_decrypted" | "picc_data_decrypted"> = ["enc_decrypted", "picc_data_decrypted"];
  const candidates: Array<{
    source: "enc_decrypted" | "picc_data_decrypted";
    offset: number;
    closed_values: string[];
    opened_values: string[];
    confidence: "HIGH" | "MEDIUM";
  }> = [];

  for (const source of sources) {
    const closedHexes = closedBodies.map((x) => String(source === "enc_decrypted" ? (x.enc_plain_hex || "") : (x.picc_plain_hex || ""))).filter((hex) => hex.length >= 4);
    const openedHexes = openedBodies.map((x) => String(source === "enc_decrypted" ? (x.enc_plain_hex || "") : (x.picc_plain_hex || ""))).filter((hex) => hex.length >= 4);
    if (!closedHexes.length || !openedHexes.length) continue;

    const minLen = Math.min(
      ...closedHexes.map((h) => h.length),
      ...openedHexes.map((h) => h.length),
    );
    for (let i = 0; i + 4 <= minLen; i += 2) {
      const offset = i / 2;
      const closedParsed = closedHexes.map((hex) => parseTTStatusFromDecryptedPayload(hex, offset).raw.toUpperCase());
      const openedParsed = openedHexes.map((hex) => parseTTStatusFromDecryptedPayload(hex, offset).raw.toUpperCase());
      const closedAllClosed = closedParsed.every((raw) => raw === "4343");
      const openedAllOpen = openedParsed.every((raw) => raw === "4F4F" || raw === "4F43");
      const closedKnown = closedParsed.every((raw) => looksLikeTTStatus(raw));
      const openedKnown = openedParsed.every((raw) => looksLikeTTStatus(raw));
      if (closedAllClosed && openedAllOpen) {
        candidates.push({ source, offset, closed_values: Array.from(new Set(closedParsed)), opened_values: Array.from(new Set(openedParsed)), confidence: "HIGH" });
      } else if (closedKnown && openedKnown && closedParsed.some((raw) => raw === "4343") && openedParsed.some((raw) => raw === "4F4F" || raw === "4F43")) {
        candidates.push({ source, offset, closed_values: Array.from(new Set(closedParsed)), opened_values: Array.from(new Set(openedParsed)), confidence: "MEDIUM" });
      }
    }
  }

  return json({
    ok: true,
    closed_count: closedUrls.length,
    opened_count: openedUrls.length,
    candidate_offsets: candidates,
    recommendation: candidates.length
      ? "TTStatus candidate offsets found. Configure ttstatus_source + ttstatus_offset in batch config."
      : "No TTStatus pattern found. Supplier may not have mirrored TTStatus into SDMENCFileData.",
  });
}
