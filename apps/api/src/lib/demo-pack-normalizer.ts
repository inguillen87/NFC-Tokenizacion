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

export type NormalizedSeedProduct = GenericRecord & {
  uidHex: string;
  sku?: string;
  productName?: string;
  vertical?: string;
  region?: string;
  notes?: string;
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

      const normalized: NormalizedSeedProduct = {
        ...item,
        uidHex,
        sku: String(valueFromPaths(item, ["sku", "product.sku", "identity.sku"]) || "") || undefined,
        productName: String(valueFromPaths(item, ["productName", "product_name", "name", "display_name", "product.name", "identity.name"]) || "") || undefined,
        vertical: String(valueFromPaths(item, ["vertical", "product.vertical", "identity.vertical"]) || "") || undefined,
        region: String(valueFromPaths(item, ["region", "origin.region", "passport.provenance.region"]) || "") || undefined,
        notes: String(valueFromPaths(item, ["notes", "narrative", "passport.story", "metadata.notes"]) || "") || undefined,
        identity,
        product,
        passport,
        source,
      };

      return normalized;
    })
    .filter((item): item is NormalizedSeedProduct => Boolean(item));
}
