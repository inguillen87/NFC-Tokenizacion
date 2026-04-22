export const DEMO_TENANT_SLUG = "demobodega";
export const DEMO_TENANT_NAME = "Demo Bodega";
export const DEMO_CANONICAL_BATCH_ID = "DEMO-2026-02";
export const DEMO_CANONICAL_TAG_COUNT = 10;
export const DEMO_WINE_ITEM_ID = "demo-item-001";

export function isDemoBatchId(bid: string | null | undefined) {
  return String(bid || "").trim().toUpperCase().startsWith("DEMO-");
}
