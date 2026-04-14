import { promises as fs } from "node:fs";
import path from "node:path";
import { MobileDemoClient } from "../../../../../components/mobile-demo-client";

type DemoMode = "consumer_tap" | "consumer_opened" | "consumer_tamper" | "consumer_duplicate";

async function loadPackSeed(pack: string) {
  const filePath = path.join(process.cwd(), "public", "demo", pack, "seed.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { items?: unknown[] } | unknown[];
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    return [];
  } catch {
    return [];
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
  const pack = String(query.pack || "wine-secure");
  const modeValue = String(query.demoMode || "consumer_tap");
  const mode = (["consumer_tap", "consumer_opened", "consumer_tamper", "consumer_duplicate"].includes(modeValue) ? modeValue : "consumer_tap") as DemoMode;
  const locale = String(query.locale || "es-AR");
  const seedItems = await loadPackSeed(pack);

  return <MobileDemoClient tenant={tenant} itemId={itemId} pack={pack} mode={mode} locale={locale} seedItems={seedItems as never[]} />;
}
