import { promises as fs } from "node:fs";
import path from "node:path";
import {
  MobileDemoClient,
  type MobileDemoBidSource,
  type SeedItem,
} from "../../../../../../components/mobile-demo-client";

type DemoMode = "consumer_tap" | "consumer_opened" | "consumer_tamper" | "consumer_duplicate";
type JsonRecord = Record<string, unknown>;

const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const PACK_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSeedItems(value: unknown): SeedItem[] {
  const candidate = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : isRecord(value) && Array.isArray(value.products)
        ? value.products
        : [];

  return candidate.filter(isRecord) as SeedItem[];
}

function normalizeIdentifier(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesItemField(item: SeedItem, itemId: string, fields: Array<keyof SeedItem>) {
  const requested = normalizeIdentifier(itemId);
  return requested.length > 0 && fields.some((field) => normalizeIdentifier(item[field]) === requested);
}

function resolveSeedItem(items: SeedItem[], itemId: string) {
  return items.find((item) => matchesItemField(item, itemId, ["itemId", "item_id", "id"]))
    || items.find((item) => matchesItemField(item, itemId, ["uidHex", "uid_hex"]))
    || items.find((item) => matchesItemField(item, itemId, ["sku", "serial", "rollId", "roll_id"]))
    || items.find((item) => normalizeIdentifier(item.uidHex || item.uid_hex).length > 0)
    || items[0];
}

function validBid(value: unknown) {
  const candidate = String(value ?? "").trim();
  return BID_RE.test(candidate) ? candidate : "";
}

function recordBid(value: unknown) {
  if (!isRecord(value)) return "";
  return validBid(value.bid || value.batchId || value.batch_id);
}

function parseManifestBid(raw: string) {
  const [headerLine = "", firstDataLine = ""] = raw.trim().split(/\r?\n/, 2);
  const headers = headerLine.split(",").map((value) => value.trim());
  const values = firstDataLine.split(",").map((value) => value.trim());
  const batchIndex = headers.findIndex((header) => ["batch_id", "batchId", "bid"].includes(header));
  return batchIndex >= 0 ? validBid(values[batchIndex]) : "";
}

async function loadPackSeed(pack: string, itemId: string) {
  const packDirectory = path.join(process.cwd(), "public", "demo", pack);
  const [seedRaw, manifestRaw] = await Promise.all([
    fs.readFile(path.join(packDirectory, "seed.json"), "utf8").catch(() => ""),
    fs.readFile(path.join(packDirectory, "manifest.csv"), "utf8").catch(() => ""),
  ]);

  if (!seedRaw) return { item: undefined, bid: parseManifestBid(manifestRaw) };

  try {
    const parsed = JSON.parse(seedRaw) as unknown;
    const items = parseSeedItems(parsed);
    const item = resolveSeedItem(items, itemId);
    const bid = recordBid(item) || recordBid(parsed) || parseManifestBid(manifestRaw);
    return { item, bid };
  } catch {
    return { item: undefined, bid: parseManifestBid(manifestRaw) };
  }
}

export default async function PublicMobileDemoItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, itemId } = await params;
  const query = await searchParams;
  const requestedPack = firstParam(query.pack) || "wine-secure";
  const pack = PACK_RE.test(requestedPack) ? requestedPack : "wine-secure";
  const modeValue = firstParam(query.demoMode) || "consumer_tap";
  const mode = (["consumer_tap", "consumer_opened", "consumer_tamper", "consumer_duplicate"].includes(modeValue)
    ? modeValue
    : "consumer_tap") as DemoMode;
  const locale = firstParam(query.locale) || "es-AR";
  const seed = await loadPackSeed(pack, itemId);
  const queryBid = validBid(firstParam(query.bid));
  const bid = queryBid || seed.bid;
  const bidSource: MobileDemoBidSource = queryBid ? "query" : bid ? "demo-pack" : "missing";

  return (
    <MobileDemoClient
      tenant={tenant}
      itemId={itemId}
      pack={pack}
      mode={mode}
      locale={locale}
      bid={bid}
      bidSource={bidSource}
      seedItem={seed.item}
    />
  );
}
