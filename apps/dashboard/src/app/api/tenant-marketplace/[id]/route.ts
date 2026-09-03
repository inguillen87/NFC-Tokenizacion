import { NextResponse } from "next/server";
import {
  authorizeTenantMarketplaceMutation,
  getTenantMarketplaceStore,
  normalizeTenantMarketplaceDraft,
  readTenantMarketplacePayload,
  tenantMarketplaceNoStoreHeaders,
  tenantMarketplaceSameOrigin,
} from "../route-helpers";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!tenantMarketplaceSameOrigin(req)) return NextResponse.json({ ok: false, reason: "same_origin_required" }, { status: 403, headers: tenantMarketplaceNoStoreHeaders });
  const authorization = await authorizeTenantMarketplaceMutation(req);
  if ("response" in authorization) return authorization.response;
  const { id } = await params;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) return NextResponse.json({ ok: false, reason: "marketplace_item_id_invalid" }, { status: 400, headers: tenantMarketplaceNoStoreHeaders });
  const payload = await readTenantMarketplacePayload(req);
  if (payload === null) return NextResponse.json({ ok: false, reason: "payload_too_large" }, { status: 413, headers: tenantMarketplaceNoStoreHeaders });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ ok: false, reason: "marketplace_item_invalid" }, { status: 400, headers: tenantMarketplaceNoStoreHeaders });
  const store = getTenantMarketplaceStore(authorization.tenantSlug);
  const index = store.items.findIndex((item) => item.id === id);

  if (index < 0) {
    return NextResponse.json({ ok: false, reason: "item_not_found" }, { status: 404, headers: tenantMarketplaceNoStoreHeaders });
  }

  const current = store.items[index];
  const normalized = normalizeTenantMarketplaceDraft({ ...current, ...payload });
  if (!normalized) return NextResponse.json({ ok: false, reason: "marketplace_item_invalid" }, { status: 400, headers: tenantMarketplaceNoStoreHeaders });
  const updated = {
    ...current,
    ...normalized,
  };
  store.items[index] = updated;
  return NextResponse.json({ ok: true, item: updated }, { headers: tenantMarketplaceNoStoreHeaders });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!tenantMarketplaceSameOrigin(req)) return NextResponse.json({ ok: false, reason: "same_origin_required" }, { status: 403, headers: tenantMarketplaceNoStoreHeaders });
  const authorization = await authorizeTenantMarketplaceMutation(req);
  if ("response" in authorization) return authorization.response;
  const { id } = await params;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) return NextResponse.json({ ok: false, reason: "marketplace_item_id_invalid" }, { status: 400, headers: tenantMarketplaceNoStoreHeaders });
  const store = getTenantMarketplaceStore(authorization.tenantSlug);
  const before = store.items.length;
  store.items = store.items.filter((item) => item.id !== id);
  if (store.items.length === before) {
    return NextResponse.json({ ok: false, reason: "item_not_found" }, { status: 404, headers: tenantMarketplaceNoStoreHeaders });
  }
  return NextResponse.json({ ok: true }, { headers: tenantMarketplaceNoStoreHeaders });
}
