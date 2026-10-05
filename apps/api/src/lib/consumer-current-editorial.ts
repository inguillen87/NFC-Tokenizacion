import type { CurrentPassportEditorial } from "./current-passport-editorial";

/** Current customer-facing identity comes only from a validated publication.
 * The saved copy remains explicit history; no verdict, ownership or date changes. */
export function withConsumerCurrentEditorial(row: Record<string, unknown>, currentEditorial: CurrentPassportEditorial) {
  const { editorial_tenant_id: _tenant, ...item } = row;
  const identity = currentEditorial.state === "published" ? currentEditorial.document.identity : null;
  return {
    ...item,
    historical_product_name: row.product_name ?? null,
    historical_brand_name: row.brand_name ?? null,
    historical_image_url: row.image_url ?? null,
    ...(identity ? {
      product_name: identity.product_name,
      brand_name: identity.winery,
      image_url: identity.image_url,
    } : {}),
    // Collection cards need identity and publication state, not a copy of the
    // complete document for every saved unit. Detail returns the full document.
    currentEditorialSummary: {
      protocol: "nexid.current-editorial-summary.v1",
      source: currentEditorial.source,
      state: currentEditorial.state,
      observedAt: currentEditorial.observedAt,
      ...(currentEditorial.state === "published" ? {
        version: currentEditorial.version,
        publishedAt: currentEditorial.publishedAt,
      } : {}),
    },
  };
}
