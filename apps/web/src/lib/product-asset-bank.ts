export type AssetVisualKind = "wine" | "creamJar" | "perfume" | "creamTube" | "bracelet" | "ticket" | "seeds";

export type ProductAssetSlot = {
  id: string;
  label: string;
  detail: string;
  status: "ready" | "demo" | "missing";
  tone: "photo" | "label" | "tag" | "document";
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
  sku?: string | null;
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
  return "Vinos y bebidas premium";
}

function defaultProductName(kind: AssetVisualKind) {
  if (kind === "bracelet") return "Brazalete VIP evento";
  if (kind === "ticket") return "Entrada verificada";
  if (kind === "creamJar") return "Frasco crema alta gama";
  if (kind === "creamTube") return "Crema dermocosmetica";
  if (kind === "perfume") return "Perfume edicion limitada";
  if (kind === "seeds") return "Semillas trazables";
  return "Gran Reserva Malbec";
}

function slotSet(kind: AssetVisualKind, input: ProductAssetInput): ProductAssetSlot[] {
  const hasImage = Boolean(input.imageUrl);
  const productLabel = kind === "wine"
    ? "Foto botella real"
    : kind === "bracelet" || kind === "ticket"
      ? "Foto acceso real"
      : kind === "seeds"
        ? "Foto empaque real"
        : "Foto producto real";
  const tagDetail = kind === "wine"
    ? "Tag sobre capsula/cuello, listo para cortar al abrir."
    : kind === "bracelet" || kind === "ticket"
      ? "NFC en zona de tap del celular para acceso."
      : kind === "perfume"
        ? "Tag en union tapa/frasco para evidenciar apertura."
        : "Tag en punto de apertura entre tapa y envase.";

  return [
    {
      id: "product-photo",
      label: productLabel,
      detail: hasImage ? "Asset del tenant usado en Passport y marketplace." : "Demo render hasta que el tenant suba foto real.",
      status: hasImage ? "ready" : "demo",
      tone: "photo",
      imageUrl: input.imageUrl || null,
    },
    {
      id: "front-label",
      label: "Etiqueta frontal",
      detail: "Imagen limpia para que el comprador reconozca exactamente su producto.",
      status: "demo",
      tone: "label",
    },
    {
      id: "tag-position",
      label: "Tag aplicado",
      detail: tagDetail,
      status: "demo",
      tone: "tag",
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
  return Math.min(100, 48 + ready * 18 + demo * 7);
}

export function resolveProductAssetProfile(input: ProductAssetInput = {}): ProductAssetProfile {
  const kind = inferVisualKind(input);
  const tenantSlug = compactKey(useful(input.tenantSlug, input.brandName, "demobodega"));
  const brandName = useful(input.brandName, input.tenantSlug, "DemoBodega");
  const productName = useful(input.productName, defaultProductName(kind));
  const batchLabel = useful(input.bid, kind === "wine" ? "MZA-2026-0424" : `${tenantSlug.toUpperCase()}-2026-DEMO`);
  const skuLabel = useful(input.sku, `${kind.toUpperCase()}-DEMO`);
  const slots = slotSet(kind, input);

  return {
    key: `${tenantSlug}-${compactKey(productName)}-${compactKey(batchLabel)}`,
    tenantSlug,
    brandName,
    productName,
    verticalLabel: verticalLabel(kind),
    visualKind: kind,
    batchLabel,
    skuLabel,
    primaryImageUrl: input.imageUrl || null,
    assetScore: scoreFor(slots),
    heroLine: "Cada tap carga producto, etiqueta, tag aplicado y ficha del lote desde el banco de assets del tenant.",
    claimLine: "Para reclamar ownership se cruza tap fisico fresco, identidad validada, producto correcto y politica del lote.",
    ownerStory: "Nacio como pasaporte interno, viajo con su lote y queda listo para duenio, garantia, beneficios y NFT opcional.",
    marketplaceLine: "El marketplace no muestra un item generico: muestra el producto real, su lote, su estado y los beneficios habilitados.",
    uploadChecklist: ["Foto producto", "Etiqueta frontal", "Foto tag aplicado", "Ficha comercial", "Reglas claim/NFT"],
    slots,
  };
}

export function summarizeAssetReadiness(profile: ProductAssetProfile) {
  const ready = profile.slots.filter((slot) => slot.status === "ready").length;
  const demo = profile.slots.filter((slot) => slot.status === "demo").length;
  const missing = profile.slots.filter((slot) => slot.status === "missing").length;
  return `${ready} reales / ${demo} demo / ${missing} pendientes`;
}
