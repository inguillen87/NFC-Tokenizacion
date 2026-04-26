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
  const payload = (await req.json()) as Omit<MarketplaceItem, "id">;
  if (!payload?.name?.trim() || !payload?.vertical?.trim()) {
    return NextResponse.json({ error: "name and vertical are required" }, { status: 400 });
  }

  const item: MarketplaceItem = {
    id: `item-${Date.now()}`,
    emoji: payload.emoji || "🆕",
    name: payload.name.trim(),
    priceArs: Number(payload.priceArs) || 0,
    vertical: payload.vertical.trim(),
    checkout: payload.checkout || "request",
    visibility: payload.visibility || "network",
  };

  const store = getStore();
  store.items = [item, ...store.items];
  return NextResponse.json({ item }, { status: 201 });
}
