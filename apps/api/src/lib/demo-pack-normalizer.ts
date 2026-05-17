type GenericRecord = Record<string, unknown>;

function toObject(value: unknown): GenericRecord {
  return value && typeof value === "object" ? (value as GenericRecord) : {};
}

function valueFromPaths(source: GenericRecord, paths: string[]): unknown {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as GenericRecord)[key] : undefined), source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function urlList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter((item) => /^https?:\/\//i.test(item));
  }
  if (typeof value === "string") {
    return value.split(/[|,;\n]/).map((item) => item.trim()).filter((item) => /^https?:\/\//i.test(item));
  }
  return [];
}

export type NormalizedSeedProduct = GenericRecord & {
  uidHex: string;
  sku?: string;
  productName?: string;
  vertical?: string;
  region?: string;
  notes?: string;
  imageUrl?: string;
  labelImageUrl?: string;
  modelUrl?: string;
  galleryUrls?: string[];
};

export function normalizeSeedProducts(seedInput: unknown): NormalizedSeedProduct[] {
  const seed = toObject(seedInput);
  const catalog = toObject(seed.catalog);
  const rawItems = [
    ...(Array.isArray(seed.products) ? seed.products : []),
    ...(Array.isArray(seed.bottles) ? seed.bottles : []),
    ...(Array.isArray(seed.items) ? seed.items : []),
    ...(Array.isArray(catalog.items) ? (catalog.items as unknown[]) : []),
  ];

  return rawItems
    .map((entry) => {
      const item = toObject(entry);
      const uidHexRaw = valueFromPaths(item, ["uidHex", "uid_hex", "tag.uidHex", "tag.uid_hex", "tag.uid", "tagUid", "tag_uid"]);
      const uidHex = String(uidHexRaw || "").toUpperCase();
      if (!uidHex) return null;

      const identity = toObject(item.identity);
      const product = toObject(item.product);
      const passport = toObject(item.passport);
      const source = toObject(item.source);
      const media = toObject(valueFromPaths(item, ["media", "product.media", "assets", "product.assets"]));
      const galleryUrls = urlList(valueFromPaths(item, ["galleryUrls", "gallery_urls", "media.galleryUrls", "media.gallery_urls", "product.galleryUrls", "product.media.galleryUrls"]));

      const normalized: NormalizedSeedProduct = {
        ...item,
        uidHex,
        sku: String(valueFromPaths(item, ["sku", "product.sku", "identity.sku"]) || "") || undefined,
        productName: String(valueFromPaths(item, ["productName", "product_name", "name", "display_name", "product.name", "identity.name"]) || "") || undefined,
        vertical: String(valueFromPaths(item, ["vertical", "product.vertical", "identity.vertical"]) || "") || undefined,
        region: String(valueFromPaths(item, ["region", "origin.region", "passport.provenance.region"]) || "") || undefined,
        notes: String(valueFromPaths(item, ["notes", "narrative", "passport.story", "metadata.notes"]) || "") || undefined,
        imageUrl: String(valueFromPaths(item, ["imageUrl", "image_url", "photoUrl", "photo_url", "product.imageUrl", "product.image_url", "media.imageUrl", "media.image_url"]) || "") || undefined,
        labelImageUrl: String(valueFromPaths(item, ["labelImageUrl", "label_image_url", "product.labelImageUrl", "media.labelImageUrl", "media.label_image_url"]) || "") || undefined,
        modelUrl: String(valueFromPaths(item, ["modelUrl", "model_url", "glbUrl", "glb_url", "product.modelUrl", "media.modelUrl", "media.model_url"]) || "") || undefined,
        galleryUrls: galleryUrls.length ? galleryUrls : undefined,
        identity,
        product,
        passport,
        media,
        source,
      };

      return normalized;
    })
    .filter((item): item is NormalizedSeedProduct => Boolean(item));
}
