import { NextResponse } from "next/server";
import type { MarketplaceItem } from "../route";

type Store = {
  items: MarketplaceItem[];
};

const globalStore = globalThis as typeof globalThis & { __tenantMarketplaceStore?: Store };

function getStore() {
  if (!globalStore.__tenantMarketplaceStore) {
    globalStore.__tenantMarketplaceStore = { items: [] };
  }
  return globalStore.__tenantMarketplaceStore;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = (await req.json()) as Partial<MarketplaceItem>;
  const store = getStore();
  const index = store.items.findIndex((item) => item.id === id);

  if (index < 0) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }

  const current = store.items[index];
  const updated: MarketplaceItem = {
    ...current,
    ...payload,
    id: current.id,
    name: (payload.name ?? current.name).trim(),
    vertical: (payload.vertical ?? current.vertical).trim(),
    priceArs: Number(payload.priceArs ?? current.priceArs) || 0,
  };
  store.items[index] = updated;
  return NextResponse.json({ item: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const before = store.items.length;
  store.items = store.items.filter((item) => item.id !== id);
  if (store.items.length === before) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
