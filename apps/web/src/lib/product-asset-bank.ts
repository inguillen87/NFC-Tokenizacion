export type AssetVisualKind = "wine" | "creamJar" | "perfume" | "creamTube" | "bracelet" | "ticket" | "seeds" | "sneaker" | "apparel";

export type ProductAssetSlot = {
  id: string;
  label: string;
  detail: string;
  status: "ready" | "demo" | "missing";
  tone: "photo" | "label" | "tag" | "document" | "model";
  imageUrl?: string | null;
};

export type ProductAssetProfile = {
  key: string;
  tenantSlug: string;
  brandName: string;
  productName: string;
  verticalLabel: string;
  visualKind: AssetVisualKind;
  batchLabel: string;
  skuLabel: string;
  primaryImageUrl?: string | null;
  labelImageUrl?: string | null;
  modelUrl?: string | null;
  galleryUrls: string[];
  assetScore: number;
  heroLine: string;
  claimLine: string;
  ownerStory: string;
  marketplaceLine: string;
  uploadChecklist: string[];
  slots: ProductAssetSlot[];
};

type ProductAssetInput = {
  tenantSlug?: string | null;
  brandName?: string | null;
  productName?: string | null;
  bid?: string | null;
  vertical?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  labelImageUrl?: string | null;
  modelUrl?: string | null;
  galleryUrls?: string[] | null;
  sku?: string | null;
};

const demoStockAssets: Partial<Record<AssetVisualKind, { productImageUrl: string; sourceLabel: string }>> = {
  wine: {
    productImageUrl: "/demo/wine-secure/real-malbec-bottle-pexels.jpg",
    sourceLabel: "Pexels / Imperio Ame",
  },
  bracelet: {
    productImageUrl: "/demo/events-basic/real-event-wristband-pexels.jpg",
    sourceLabel: "Pexels / freestocks.org",
  },
  ticket: {
    productImageUrl: "/demo/events-basic/real-event-wristband-pexels.jpg",
    sourceLabel: "Pexels / freestocks.org",
  },
  creamJar: {
    productImageUrl: "/demo/cosmetics-secure/real-premium-skincare-set-pexels.jpg",
    sourceLabel: "Pexels / mskin pro",
  },
  creamTube: {
    productImageUrl: "/demo/cosmetics-secure/real-premium-skincare-set-pexels.jpg",
    sourceLabel: "Pexels / mskin pro",
  },
  perfume: {
    productImageUrl: "/demo/cosmetics-secure/real-luxury-perfume-pexels.jpg",
    sourceLabel: "Pexels / Suhashan Jar",
  },
  seeds: {
    productImageUrl: "/demo/agro-secure/real-seed-packet-pexels.jpg",
    sourceLabel: "Pexels / RDNE Stock project",
  },
  sneaker: {
    productImageUrl: "/demo/luxury-basic/real-sneakers-pexels.jpg",
    sourceLabel: "Pexels / Hurrah suhail",
  },
  apparel: {
    productImageUrl: "/demo/luxury-basic/real-apparel-tag-pexels.jpg",
    sourceLabel: "Pexels / Andrzej Gdula",
  },
};

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
}

function compactKey(value: unknown) {
  return normalize(value).replace(/\s+/g, "-") || "producto";
}

function useful(...values: unknown[]) {
  return String(values.find((value) => String(value || "").trim()) || "").trim();
}

function inferVisualKind(input: ProductAssetInput): AssetVisualKind {
  const blob = normalize(`${input.productName || ""} ${input.brandName || ""} ${input.vertical || ""} ${input.category || ""}`);
  if (blob.includes("zapatilla") || blob.includes("sneaker") || blob.includes("shoe") || blob.includes("calzado")) return "sneaker";
  if (blob.includes("prenda") || blob.includes("ropa") || blob.includes("apparel") || blob.includes("clothing") || blob.includes("garment") || blob.includes("textil")) return "apparel";
  if (blob.includes("ticket") || blob.includes("entrada")) return "ticket";
  if (blob.includes("pulsera") || blob.includes("bracelet") || blob.includes("wristband") || blob.includes("evento")) return "bracelet";
  if (blob.includes("semilla") || blob.includes("seed") || blob.includes("agro")) return "seeds";
  if (blob.includes("perfume") || blob.includes("parfum")) return "perfume";
  if (blob.includes("crema") || blob.includes("cream") || blob.includes("cosmet") || blob.includes("serum")) return blob.includes("tubo") || blob.includes("tube") ? "creamTube" : "creamJar";
  return "wine";
}

function verticalLabel(kind: AssetVisualKind) {
  if (kind === "bracelet" || kind === "ticket") return "Eventos y acceso";
  if (kind === "creamJar" || kind === "creamTube" || kind === "perfume") return "Cosmetica premium";
  if (kind === "seeds") return "Agro trazable";
  if (kind === "sneaker" || kind === "apparel") return "Moda y lujo";
  return "Vinos y bebidas premium";
}

function defaultProductName(kind: AssetVisualKind) {
  if (kind === "bracelet") return "Brazalete VIP evento";
  if (kind === "ticket") return "Entrada verificada";
  if (kind === "creamJar") return "Set skincare premium";
  if (kind === "creamTube") return "Set skincare premium";
  if (kind === "perfume") return "Perfume premium";
  if (kind === "seeds") return "Semillas trazables";
  if (kind === "sneaker") return "Zapatillas autenticadas";
  if (kind === "apparel") return "Prenda premium autenticada";
  return "Gran Reserva Malbec";
}

function slotSet(kind: AssetVisualKind, input: ProductAssetInput): ProductAssetSlot[] {
  const hasImage = Boolean(input.imageUrl);
  const hasLabel = Boolean(input.labelImageUrl);
  const hasModel = Boolean(input.modelUrl);
  const hasGallery = Boolean((input.galleryUrls || []).length);
  const stockAsset = demoStockAssets[kind];
  const productLabel = kind === "wine"
    ? "Foto botella real"
    : kind === "bracelet" || kind === "ticket"
      ? "Foto acceso real"
      : kind === "seeds"
        ? "Foto empaque real"
        : kind === "sneaker"
          ? "Foto calzado real"
          : kind === "apparel"
            ? "Foto prenda real"
        : "Foto producto real";
  const tagDetail = kind === "wine"
    ? "Tag sobre capsula/cuello, listo para cortar al abrir."
    : kind === "bracelet" || kind === "ticket"
      ? "NFC en zona de tap del celular para acceso."
      : kind === "sneaker"
        ? "NFC en lengueta, plantilla o packaging para autenticidad y recompra."
        : kind === "apparel"
          ? "NFC en etiqueta colgante o interior para autenticidad, cuidado y reventa."
      : kind === "perfume"
        ? "Tag en union tapa/frasco para evidenciar apertura."
        : "Tag en punto de apertura entre tapa y envase.";

  return [
    {
      id: "product-photo",
      label: productLabel,
      detail: hasImage
        ? "Foto real del tenant usada en tap, Passport, certificado y marketplace."
        : stockAsset
          ? `Foto real de banco visual demo (${stockAsset.sourceLabel}) hasta que el tenant suba su packshot.`
          : "Demo render hasta que el tenant suba foto real.",
      status: hasImage ? "ready" : "demo",
      tone: "photo",
      imageUrl: input.imageUrl || stockAsset?.productImageUrl || null,
    },
    {
      id: "front-label",
      label: "Etiqueta frontal",
      detail: hasLabel ? "Etiqueta real cargada para reconocer el producto exacto." : "Pendiente de foto limpia de etiqueta o packshot.",
      status: hasLabel ? "ready" : "demo",
      tone: "label",
      imageUrl: input.labelImageUrl || null,
    },
    {
      id: "tag-position",
      label: "Tag aplicado",
      detail: tagDetail,
      status: hasGallery ? "ready" : "demo",
      tone: "tag",
      imageUrl: input.galleryUrls?.[0] || null,
    },
    {
      id: "model-3d",
      label: "Modelo 3D / GLB",
      detail: hasModel ? "Modelo 3D listo para render interactivo por tenant." : "Opcional para experiencias premium con rotacion real.",
      status: hasModel ? "ready" : "missing",
      tone: "model",
    },
    {
      id: "batch-sheet",
      label: "Ficha lote",
      detail: "SKU, batch, origen, reglas de claim, fotos y politica NFT por tenant.",
      status: "demo",
      tone: "document",
    },
  ];
}

function scoreFor(slots: ProductAssetSlot[]) {
  const ready = slots.filter((slot) => slot.status === "ready").length;
  const demo = slots.filter((slot) => slot.status === "demo").length;
  return Math.min(100, 40 + ready * 16 + demo * 6);
}

export function resolveProductAssetProfile(input: ProductAssetInput = {}): ProductAssetProfile {
  const kind = inferVisualKind(input);
  const tenantSlug = compactKey(useful(input.tenantSlug, input.brandName, "demobodega"));
  const brandName = useful(input.brandName, input.tenantSlug, "DemoBodega");
  const productName = useful(input.productName, defaultProductName(kind));
  const batchLabel = useful(input.bid, kind === "wine" ? "MZA-2026-0424" : `${tenantSlug.toUpperCase()}-2026-DEMO`);
  const skuLabel = useful(input.sku, `${kind.toUpperCase()}-DEMO`);
  const galleryUrls = Array.isArray(input.galleryUrls) ? input.galleryUrls.filter(Boolean) : [];
  const slots = slotSet(kind, { ...input, galleryUrls });
  const stockAsset = demoStockAssets[kind];

  return {
    key: `${tenantSlug}-${compactKey(productName)}-${compactKey(batchLabel)}`,
    tenantSlug,
    brandName,
    productName,
    verticalLabel: verticalLabel(kind),
    visualKind: kind,
    batchLabel,
    skuLabel,
    primaryImageUrl: input.imageUrl || galleryUrls[0] || stockAsset?.productImageUrl || null,
    labelImageUrl: input.labelImageUrl || null,
    modelUrl: input.modelUrl || null,
    galleryUrls,
    assetScore: scoreFor(slots),
    heroLine: "El tap abre el mismo producto real que carga la marca: foto, etiqueta, tag aplicado, lote y estado SUN.",
    claimLine: "Ownership solo se habilita con tap fisico fresco, identidad validada, producto correcto y politica del lote.",
    ownerStory: "El objeto nace con lote y carrier, viaja por canal autorizado y termina en Passport con garantia, beneficios y NFT opcional.",
    marketplaceLine: "El marketplace muestra el item real con lote, estado SUN, prueba de origen y beneficios habilitados.",
    uploadChecklist: ["Foto producto", "Etiqueta frontal", "Foto tag aplicado", "Ficha comercial", "Reglas claim/NFT", "Modelo GLB opcional"],
    slots,
  };
}

export function summarizeAssetReadiness(profile: ProductAssetProfile) {
  const ready = profile.slots.filter((slot) => slot.status === "ready").length;
  const demo = profile.slots.filter((slot) => slot.status === "demo").length;
  const missing = profile.slots.filter((slot) => slot.status === "missing").length;
  return `${ready} reales / ${demo} demo / ${missing} pendientes`;
}
