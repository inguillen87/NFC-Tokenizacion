import { NextResponse } from "next/server";
import { dashboardPermissionMatches } from "../../../lib/permission-policy";
import {
  authorizeTenantMarketplaceMutation,
  authorizeTenantMarketplaceRead,
  getTenantMarketplaceStore,
  normalizeTenantMarketplaceDraft,
  readTenantMarketplacePayload,
  tenantMarketplaceNoStoreHeaders,
  tenantMarketplaceSameOrigin,
  type MarketplaceItem,
} from "./route-helpers";

const MAX_IMPORT_ITEMS = 100;

export async function GET(req: Request) {
  const authorization = await authorizeTenantMarketplaceRead(req);
  if ("response" in authorization) return authorization.response;
  const canWrite = dashboardPermissionMatches(
    authorization.session.permissions,
    "marketplace:write",
    authorization.session.deniedPermissions,
  );
  return NextResponse.json({
    ok: true,
    tenant: authorization.tenantSlug,
    items: getTenantMarketplaceStore(authorization.tenantSlug).items,
    canWrite,
    demoMode: true,
    dataSource: "demo",
  }, { headers: tenantMarketplaceNoStoreHeaders });
}

export async function POST(req: Request) {
  if (!tenantMarketplaceSameOrigin(req)) {
    return NextResponse.json({ ok: false, reason: "same_origin_required" }, { status: 403, headers: tenantMarketplaceNoStoreHeaders });
  }
  const authorization = await authorizeTenantMarketplaceMutation(req);
  if ("response" in authorization) return authorization.response;
  const payload = await readTenantMarketplacePayload(req);
  if (payload === null) {
    return NextResponse.json({ ok: false, reason: "payload_too_large" }, { status: 413, headers: tenantMarketplaceNoStoreHeaders });
  }
  if (payload === undefined) {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400, headers: tenantMarketplaceNoStoreHeaders });
  }
  const payloads = Array.isArray(payload) ? payload : [payload];
  if (!payloads.length || payloads.length > MAX_IMPORT_ITEMS) {
    return NextResponse.json({ ok: false, reason: "import_limit_exceeded" }, { status: 413, headers: tenantMarketplaceNoStoreHeaders });
  }
  const normalized = payloads
    .map(normalizeTenantMarketplaceDraft)
    .filter((entry): entry is Omit<MarketplaceItem, "id"> => Boolean(entry))
    .map((entry) => ({ id: crypto.randomUUID(), ...entry }));
  if (normalized.length !== payloads.length) {
    return NextResponse.json({ ok: false, reason: "marketplace_item_invalid" }, { status: 400, headers: tenantMarketplaceNoStoreHeaders });
  }

  const store = getTenantMarketplaceStore(authorization.tenantSlug);
  store.items = [...normalized, ...store.items];
  return NextResponse.json({
    ok: true,
    item: normalized[0],
    items: normalized,
    imported: normalized.length,
  }, { status: 201, headers: tenantMarketplaceNoStoreHeaders });
}
