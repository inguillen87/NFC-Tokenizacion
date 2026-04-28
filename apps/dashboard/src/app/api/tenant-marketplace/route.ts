import { NextResponse } from "next/server";

type Visibility = "network" | "private";
type CheckoutMode = "request" | "external" | "direct";

export type MarketplaceItem = {
  id: string;
  emoji: string;
  name: string;
  priceArs: number;
  vertical: string;
  checkout: CheckoutMode;
  visibility: Visibility;
};

type MarketplaceStore = {
  items: MarketplaceItem[];
};

const initialItems: MarketplaceItem[] = [
  {
    id: "wine-01",
    emoji: "🍷",
    name: "Lote Experimental Malbec",
    priceArs: 45000,
    vertical: "Vino Premium",
    checkout: "request",
    visibility: "network",
  },
  {
    id: "box-01",
    emoji: "📦",
    name: "Caja Degustación Terroir",
    priceArs: 120000,
    vertical: "Caja / Combo",
    checkout: "external",
    visibility: "private",
  },
];

const globalStore = globalThis as typeof globalThis & { __tenantMarketplaceStore?: MarketplaceStore };
if (!globalStore.__tenantMarketplaceStore) {
  globalStore.__tenantMarketplaceStore = { items: initialItems };
}

function getStore() {
  return globalStore.__tenantMarketplaceStore!;
}

export async function GET() {
  return NextResponse.json({ items: getStore().items });
}

export async function POST(req: Request) {
  const payload = (await req.json()) as Omit<MarketplaceItem, "id"> | Array<Omit<MarketplaceItem, "id">>;
  const store = getStore();
  const payloads = Array.isArray(payload) ? payload : [payload];
  const normalized = payloads
    .filter((entry) => entry?.name?.trim() && entry?.vertical?.trim())
    .map((entry, index) => ({
      id: `item-${Date.now()}-${index}`,
      emoji: entry.emoji || "🆕",
      name: entry.name.trim(),
      priceArs: Number(entry.priceArs) || 0,
      vertical: entry.vertical.trim(),
      checkout: entry.checkout || "request",
      visibility: entry.visibility || "network",
    } satisfies MarketplaceItem));

  if (!normalized.length) {
    return NextResponse.json({ error: "name and vertical are required" }, { status: 400 });
  }

  store.items = [...normalized, ...store.items];
  return NextResponse.json({ item: normalized[0], items: normalized, imported: normalized.length }, { status: 201 });
}
