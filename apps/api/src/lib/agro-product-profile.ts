export const AGRO_DPP_PROFILE_VERSION = "agro-dpp-v1" as const;

export type PublicAgroProductProfile = {
  schemaVersion: typeof AGRO_DPP_PROFILE_VERSION;
  productName: string | null;
  brand: string | null;
  sku: string | null;
  gtin: string | null;
  crop: string | null;
  seedVariety: string | null;
  productFamily: string | null;
  activeIngredient: string | null;
  formulation: string | null;
  registrationNumber: string | null;
  batchLot: string | null;
  productionDate: string | null;
  expirationDate: string | null;
  distributor: string | null;
  authorizedChannel: string | null;
  technicalSheetUrl: string | null;
  safetySheetUrl: string | null;
  ppe: { summary: string | null; items: string[] };
  stewardship: { summary: string | null; items: string[] };
  cropwiseUrl: string | null;
  support: {
    label: string | null;
    url: string | null;
    email: string | null;
    phone: string | null;
  };
  trainingUrl: string | null;
  loyaltyUrl: string | null;
  recallStatusUrl: string | null;
};

type AgroProfileInput = {
  batchConfig?: unknown;
  tagLocaleData?: unknown;
  registryMetadata?: unknown;
  identity?: { gtin?: unknown; lot?: unknown; serial?: unknown } | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function candidateRecords(source: unknown) {
  const root = record(source);
  const product = record(root.product);
  const sun = record(root.sun);
  const sunProduct = record(sun.product);
  const localeData = record(root.locale_data);
  return [
    record(root.agro_product_profile),
    record(root.agroProductProfile),
    record(root.agro),
    record(product.agro_product_profile),
    record(product.agroProductProfile),
    record(product.agro),
    record(sunProduct.agro_product_profile),
    record(sunProduct.agroProductProfile),
    record(sunProduct.agro),
    record(localeData.agro_product_profile),
    record(localeData.agroProductProfile),
    record(localeData.agro),
    product,
    sunProduct,
    root,
  ].filter((item) => Object.keys(item).length > 0);
}

function cleanText(value: unknown, maxLength = 240) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function firstText(records: Record<string, unknown>[], keys: string[], maxLength = 240) {
  for (const source of records) {
    for (const key of keys) {
      const value = cleanText(source[key], maxLength);
      if (value) return value;
    }
  }
  return null;
}

function safePublicUrl(value: unknown) {
  const raw = cleanText(value, 2_048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function firstUrl(records: Record<string, unknown>[], keys: string[]) {
  for (const source of records) {
    for (const key of keys) {
      const value = safePublicUrl(source[key]);
      if (value) return value;
    }
  }
  return null;
}

function safeEmail(value: unknown) {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function safePhone(value: unknown) {
  const phone = cleanText(value, 40);
  return /^\+?[0-9(). -]{7,40}$/.test(phone) ? phone : null;
}

function firstContactRecord(records: Record<string, unknown>[]) {
  for (const source of records) {
    const candidate = record(source.support_contact ?? source.supportContact ?? source.support);
    if (Object.keys(candidate).length > 0) return candidate;
  }
  return {};
}

function firstNestedRecord(records: Record<string, unknown>[], keys: string[]) {
  for (const source of records) {
    for (const key of keys) {
      const candidate = record(source[key]);
      if (Object.keys(candidate).length > 0) return candidate;
    }
  }
  return {};
}

function textList(value: unknown, maxItems = 12) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n;|]+/g)
      : [];
  const result: string[] = [];
  for (const item of source) {
    const normalized = cleanText(item, 180);
    if (normalized && !result.includes(normalized)) result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function firstList(records: Record<string, unknown>[], keys: string[]) {
  for (const source of records) {
    for (const key of keys) {
      const list = textList(source[key]);
      if (list.length > 0) return list;
    }
  }
  return [];
}

function isoDate(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed) ? value : null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

export function normalizeAgroProductProfile(input: AgroProfileInput): PublicAgroProductProfile {
  // Precedence is tag-specific profile, registered GS1 identity metadata, then
  // the batch defaults. All three channels therefore project one bounded DPP.
  const records = [
    ...candidateRecords(input.tagLocaleData),
    ...candidateRecords(input.registryMetadata),
    ...candidateRecords(input.batchConfig),
  ];
  const support = firstContactRecord(records);
  const supportScalar = firstText(records, ["support_contact", "supportContact"], 240);
  const supportScalarUrl = safePublicUrl(supportScalar);
  const ppeContent = firstNestedRecord(records, ["ppe_content", "ppeContent", "ppe"]);
  const stewardshipContent = firstNestedRecord(records, ["stewardship_content", "stewardshipContent", "stewardship"]);
  const identity = record(input.identity);

  return {
    schemaVersion: AGRO_DPP_PROFILE_VERSION,
    productName: firstText(records, ["product_name", "productName", "name"], 160),
    brand: firstText(records, ["brand", "manufacturer", "issuer", "company"], 160),
    sku: firstText(records, ["sku", "product_code", "productCode"], 120),
    gtin: firstText([identity, ...records], ["gtin"], 14),
    crop: firstText(records, ["crop", "cultivo"], 120),
    seedVariety: firstText(records, ["seed_variety", "seedVariety", "variety", "variedad"], 160),
    productFamily: firstText(records, ["product_family", "productFamily", "family", "familia"], 160),
    activeIngredient: firstText(records, ["active_ingredient", "activeIngredient", "principio_activo"], 240),
    formulation: firstText(records, ["formulation", "formulacion"], 160),
    registrationNumber: firstText(records, ["registration_number", "registrationNumber", "registration", "registro"], 160),
    batchLot: firstText([identity, ...records], ["lot", "batch_lot", "batchLot", "lot_number", "lotNumber", "bid"], 160),
    productionDate: isoDate(firstText(records, ["production_date", "productionDate", "manufactured_at", "manufacturedAt"], 40)),
    expirationDate: isoDate(firstText(records, ["expiration_date", "expirationDate", "expires_at", "expiresAt"], 40)),
    distributor: firstText(records, ["distributor", "distributor_name", "distributorName"], 200),
    authorizedChannel: firstText(records, ["authorized_channel", "authorizedChannel", "channel", "canal_autorizado"], 200),
    technicalSheetUrl: firstUrl(records, ["technical_sheet_url", "technicalSheetUrl", "technical_url", "technicalUrl"]),
    safetySheetUrl: firstUrl(records, ["safety_sheet_url", "safetySheetUrl", "sds_url", "sdsUrl"]),
    ppe: {
      summary: firstText([ppeContent, ...records], ["summary", "body", "content", "ppe_content", "ppeContent", "ppe_summary", "ppeSummary"], 600),
      items: firstList([ppeContent, ...records], ["items", "ppe_items", "ppeItems", "required_ppe", "requiredPpe"]),
    },
    stewardship: {
      summary: firstText([stewardshipContent, ...records], ["summary", "body", "content", "stewardship_content", "stewardshipContent", "responsible_use", "responsibleUse"], 1_000),
      items: firstList([stewardshipContent, ...records], ["items", "stewardship_items", "stewardshipItems", "responsible_use_items", "responsibleUseItems"]),
    },
    cropwiseUrl: firstUrl(records, ["cropwise_url", "cropwiseUrl"]),
    support: {
      label: firstText([support], ["label", "name", "title"], 160) || (supportScalarUrl ? "Soporte de producto" : supportScalar),
      url: firstUrl([support, ...records], ["url", "support_url", "supportUrl"]) || supportScalarUrl,
      email: safeEmail(support.email ?? firstText(records, ["support_email", "supportEmail"], 254) ?? supportScalar),
      phone: safePhone(support.phone ?? firstText(records, ["support_phone", "supportPhone"], 40) ?? supportScalar),
    },
    trainingUrl: firstUrl(records, ["training_url", "trainingUrl"]),
    loyaltyUrl: firstUrl(records, ["loyalty_url", "loyaltyUrl", "benefit_url", "benefitUrl"]),
    recallStatusUrl: firstUrl(records, ["recall_status_url", "recallStatusUrl", "recall_url", "recallUrl"]),
  };
}

export function hasConfiguredAgroProfile(profile: PublicAgroProductProfile) {
  return Boolean(
    profile.crop
    || profile.seedVariety
    || profile.productFamily
    || profile.activeIngredient
    || profile.formulation
    || profile.registrationNumber
    || profile.technicalSheetUrl
    || profile.safetySheetUrl
    || profile.ppe.summary
    || profile.ppe.items.length
    || profile.stewardship.summary
    || profile.stewardship.items.length
    || profile.cropwiseUrl
    || profile.support.url
    || profile.support.email
    || profile.support.phone
    || profile.trainingUrl
    || profile.loyaltyUrl
    || profile.recallStatusUrl,
  );
}

export function agroPublicLinks(profile: PublicAgroProductProfile) {
  return {
    technicalSheet: profile.technicalSheetUrl,
    safetySheet: profile.safetySheetUrl,
    cropwise: profile.cropwiseUrl,
    support: profile.support.url,
    training: profile.trainingUrl,
    loyalty: profile.loyaltyUrl,
    recallStatus: profile.recallStatusUrl,
  };
}
