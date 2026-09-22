export type CurrentEditorialLocale = "es-AR" | "en" | "pt-BR";
export type CurrentEditorialState = "published" | "unpublished" | "legacy" | "withdrawn" | "invalid" | "unavailable";
export type CurrentEditorialResourcesProps = { currentEditorial?: unknown };

export const currentEditorialCopy = {
  "es-AR": {
    title: "Ficha editorial vigente", published: "Versión publicada", version: "Versión", expand: "Ver ficha y documentos",
    publishedAt: "Publicación de la ficha", observedAt: "Consulta de esta versión", language: "Idioma del contenido",
    languages: { "es-AR": "Español", en: "Inglés", "pt-BR": "Portugués" },
    product: "Producto", lot: "Lote publicado", sku: "SKU", company: "Empresa indicada", region: "Región indicada",
    identityMissing: "Esta versión no incluye datos de identificación para mostrar.",
    separation: "Esta publicación se consulta por separado de la lectura guardada. No modifica su resultado ni habilita acciones protegidas.",
    boundary: "Información editorial; no acredita el origen físico ni certifica el producto.",
    documentBoundary: "La fecha corresponde a la publicación de la ficha, no a una revisión o certificación de los documentos.",
    technical: "Ficha técnica", safety: "Ficha de seguridad", documents: "Documentos de esta versión", external: "Sitio externo",
    empty: "Esta versión no incluye enlaces a fichas técnica o de seguridad.",
    omitted: "No se pudo mostrar un enlace a documento de esta versión.",
    unpublished: "Sin ficha publicada", unpublishedHelp: "Todavía no hay una versión editorial publicada para esta consulta.",
    legacy: "Ficha anterior sin versión editorial", legacyHelp: "La información anterior no confirma una publicación editorial vigente.",
    withdrawn: "Ficha no disponible para este lote", withdrawnHelp: "El estado del lote impide mostrar esta publicación. Este aviso no confirma un retiro de producto.",
    invalid: "Ficha sin validar", invalidHelp: "No pudimos validar los datos de esta publicación. Sus contenidos y enlaces no se muestran.",
    unavailable: "Ficha no disponible", unavailableHelp: "La ficha editorial vigente no está disponible en esta consulta.",
  },
  en: {
    title: "Current editorial passport", published: "Published version", version: "Version", expand: "View passport and documents",
    publishedAt: "Passport publication", observedAt: "Version checked", language: "Content language",
    languages: { "es-AR": "Spanish", en: "English", "pt-BR": "Portuguese" },
    product: "Product", lot: "Published lot", sku: "SKU", company: "Listed company", region: "Listed region",
    identityMissing: "This version includes no identification details to display.",
    separation: "This publication is separate from the saved reading. It does not change that result or enable protected actions.",
    boundary: "Editorial information; it does not establish physical origin or certify the product.",
    documentBoundary: "The date is the passport publication date, not a document review or certification date.",
    technical: "Technical sheet", safety: "Safety sheet", documents: "Documents in this version", external: "External site",
    empty: "This version includes no technical or safety sheet links.",
    omitted: "A document link in this version could not be displayed.",
    unpublished: "No published passport", unpublishedHelp: "There is no published editorial version for this view yet.",
    legacy: "Earlier passport without an editorial version", legacyHelp: "Earlier information does not confirm a current editorial publication.",
    withdrawn: "Passport unavailable for this batch", withdrawnHelp: "The batch status prevents this publication from being displayed. This notice does not establish a product recall.",
    invalid: "Passport could not be validated", invalidHelp: "We could not validate this publication. Its content and links are not displayed.",
    unavailable: "Passport unavailable", unavailableHelp: "The current editorial passport is unavailable in this view.",
  },
  "pt-BR": {
    title: "Ficha editorial vigente", published: "Versão publicada", version: "Versão", expand: "Ver ficha e documentos",
    publishedAt: "Publicação da ficha", observedAt: "Consulta desta versão", language: "Idioma do conteúdo",
    languages: { "es-AR": "Espanhol", en: "Inglês", "pt-BR": "Português" },
    product: "Produto", lot: "Lote publicado", sku: "SKU", company: "Empresa indicada", region: "Região indicada",
    identityMissing: "Esta versão não inclui dados de identificação para exibir.",
    separation: "Esta publicação é consultada separadamente da leitura salva. Não altera seu resultado nem habilita ações protegidas.",
    boundary: "Informação editorial; não comprova a origem física nem certifica o produto.",
    documentBoundary: "A data corresponde à publicação da ficha, não à revisão ou certificação dos documentos.",
    technical: "Ficha técnica", safety: "Ficha de segurança", documents: "Documentos desta versão", external: "Site externo",
    empty: "Esta versão não inclui links para fichas técnica ou de segurança.",
    omitted: "Não foi possível exibir um link de documento desta versão.",
    unpublished: "Sem ficha publicada", unpublishedHelp: "Ainda não há uma versão editorial publicada para esta consulta.",
    legacy: "Ficha anterior sem versão editorial", legacyHelp: "As informações anteriores não confirmam uma publicação editorial vigente.",
    withdrawn: "Ficha indisponível para este lote", withdrawnHelp: "O estado do lote impede a exibição desta publicação. Este aviso não confirma um recolhimento de produto.",
    invalid: "Ficha sem validação", invalidHelp: "Não foi possível validar os dados desta publicação. Seus conteúdos e links não são exibidos.",
    unavailable: "Ficha indisponível", unavailableHelp: "A ficha editorial vigente está indisponível nesta consulta.",
  },
} as const;

type DateView = { iso: string; label: string };
type Resource = { kind: "technical" | "safety"; href: string; host: string; label: string };
type IdentityField = { key: string; label: string; value: string };
export type CurrentEditorialView = {
  state: CurrentEditorialState;
  status: string;
  description: string;
  observedAt: DateView | null;
  publication: null | {
    version: number;
    publishedAt: DateView;
    locale: CurrentEditorialLocale;
    language: string;
    identity: IdentityField[];
    resources: Resource[];
    omittedResource: boolean;
  };
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function dateView(value: unknown, locale: CurrentEditorialLocale): DateView | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)) return null;
  const date = new Date(value);
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return { iso: date.toISOString(), label: `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC", hourCycle: "h23" }).format(date).replace(/[\u00a0\u202f]/g, " ")} UTC` };
}

/** Public document navigation only; never relay proof or signed access links. */
function documentLink(value: unknown) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    const keys = [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()].map(key => key.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (keys.some(key => /token|secret|password|signature|credential|authorization|access/.test(key)
      || ["uid", "uidhex", "cmac", "picc", "piccdata", "enc", "fresh", "sunfresh", "apikey", "share"].includes(key))) return null;
    return { href: url.href, host: url.hostname };
  } catch { return null; }
}

/** The server authenticates the publication. A reading is never its fallback. */
export function currentEditorialResourcesModel(value: unknown, locale: CurrentEditorialLocale = "es-AR"): CurrentEditorialView {
  const copy = currentEditorialCopy[locale];
  const negative = (state: Exclude<CurrentEditorialState, "published">, observedAt: DateView | null = null): CurrentEditorialView => ({
    state, status: copy[state], description: copy[`${state}Help`], observedAt, publication: null,
  });
  if (value === undefined || value === null) return negative("unavailable");
  const payload = record(value);
  if (!payload || payload.protocol !== "nexid.current-editorial.v1" || payload.source !== "passport_studio"
    || !["published", "unpublished", "legacy", "withdrawn", "invalid", "unavailable"].includes(String(payload.state))) return negative("invalid");
  const observedAt = dateView(payload.observedAt, locale);
  if (payload.observedAt !== null && !observedAt) return negative("invalid");
  if (payload.state !== "published") return negative(payload.state as Exclude<CurrentEditorialState, "published">, observedAt);
  const document = record(payload.document), identity = record(document?.identity), agro = record(document?.agro_product_profile);
  const publishedAt = dateView(payload.publishedAt, locale);
  const identityKeys = ["product_name", "public_lot_label", "sku", "winery", "region", "image_url"];
  if (!Number.isSafeInteger(payload.version) || Number(payload.version) <= 0 || !publishedAt || !observedAt || publishedAt.iso > observedAt.iso
    || typeof payload.contentDigest !== "string" || !/^[a-f\d]{64}$/i.test(payload.contentDigest)
    || !document || document.schemaVersion !== "nexid.passport-editorial.v1"
    || !["general", "agro"].includes(String(document.template))
    || !["es-AR", "en", "pt-BR"].includes(String(document.locale)) || !identity
    || identityKeys.some(key => identity[key] !== null && typeof identity[key] !== "string")
    || (document.template === "general" ? document.agro_product_profile !== null : !agro)) return negative("invalid", observedAt);
  const fields = [["product_name", "product"], ["public_lot_label", "lot"], ["sku", "sku"], ["winery", "company"], ["region", "region"]] as const;
  const identityFields = fields.flatMap(([key, label]) => {
    const text = typeof identity[key] === "string" ? identity[key].replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 512) : "";
    return text ? [{ key, label: copy[label], value: text }] : [];
  });
  const resources: Resource[] = [];
  let omittedResource = false;
  for (const [key, kind] of [["technicalSheetUrl", "technical"], ["safetySheetUrl", "safety"]] as const) {
    const supplied = agro?.[key];
    if (supplied === undefined || supplied === null || supplied === "") continue;
    const link = documentLink(supplied);
    if (link) resources.push({ kind, ...link, label: copy[kind] });
    else omittedResource = true;
  }
  const contentLocale = document.locale as CurrentEditorialLocale;
  return { state: "published", status: copy.published, description: copy.separation, observedAt,
    publication: { version: Number(payload.version), publishedAt, locale: contentLocale, language: copy.languages[contentLocale], identity: identityFields, resources, omittedResource } };
}
