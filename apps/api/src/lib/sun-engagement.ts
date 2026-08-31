export type SunPublishedPromotion = {
  title: string;
  description: string | null;
  points: number | null;
  state: string | null;
  sourceLabel: "DECLARADO POR LA MARCA";
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundedText(value: unknown, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized && normalized.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(normalized)
    ? normalized
    : null;
}

/**
 * Projects only public promotional copy from a unit manifest. Coupon codes,
 * secrets, targeting rules and arbitrary engagement JSON are never returned.
 */
export function publishedPromotionsFromLocaleData(localeData: unknown): SunPublishedPromotion[] {
  const data = record(localeData);
  const manifest = record(data.manifest);
  const engagement = Object.keys(record(data.engagement)).length
    ? record(data.engagement)
    : record(manifest.engagement);
  const promotions = Array.isArray(engagement.promotions) ? engagement.promotions : [];

  return promotions.flatMap((value) => {
    const item = record(value);
    if (item.public !== true || String(item.state || "").trim().toLowerCase() !== "published") return [];
    const title = boundedText(item.title, 120);
    if (!title) return [];
    const description = boundedText(item.description, 320);
    const state = "published";
    const parsedPoints = Number(item.points);
    const points = Number.isFinite(parsedPoints) && parsedPoints > 0 && parsedPoints <= 1_000_000
      ? Math.floor(parsedPoints)
      : null;
    return [{
      title,
      description,
      points,
      state,
      sourceLabel: "DECLARADO POR LA MARCA" as const,
    }];
  }).slice(0, 3);
}
