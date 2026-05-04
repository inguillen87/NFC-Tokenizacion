export type CarrierProfileCode =
  | "qr_basic"
  | "gs1_digital_link"
  | "ntag213"
  | "ntag215"
  | "ntag216"
  | "ntag424_dna"
  | "ntag424_dna_tt";

export type CarrierProfile = {
  code: CarrierProfileCode;
  label: string;
  family: "qr" | "gs1" | "nfc";
  securityLevel: number;
  costBand: "entry" | "standard" | "secure" | "premium";
  estimatedUnitCostUsdMin: number;
  estimatedUnitCostUsdMax: number;
  capabilities: {
    supportsQr: boolean;
    supportsGs1: boolean;
    supportsNfc: boolean;
    supportsUid: boolean;
    supportsSun: boolean;
    supportsTamper: boolean;
    supportsReplayDetection: boolean;
    supportsOwnership: boolean;
    supportsTokenization: boolean;
    supportsLoyalty: boolean;
    supportsMarketplace: boolean;
    cryptographic: boolean;
  };
  recommendedVerticals: string[];
  allowedActions: string[];
  blockedActions: string[];
  consumerCopy: {
    headline: string;
    body: string;
    disclaimer: string;
  };
  adminCopy: {
    positioning: string;
    bestFor: string;
    avoid: string;
  };
  defaultPolicy: {
    requiresFreshTap: boolean;
    requiresPurchaseProof: boolean;
    claimMode: "disabled" | "declared" | "verified_purchase" | "tenant_approval";
    tokenizationMode: "disabled" | "request_only" | "verified_only";
    riskPolicy: "marketing" | "declared_traceability" | "server_uid" | "cryptographic" | "cryptographic_tamper";
  };
};

const entryCapabilities = {
  supportsQr: false,
  supportsGs1: false,
  supportsNfc: false,
  supportsUid: false,
  supportsSun: false,
  supportsTamper: false,
  supportsReplayDetection: false,
  supportsOwnership: false,
  supportsTokenization: false,
  supportsLoyalty: true,
  supportsMarketplace: true,
  cryptographic: false,
};

export const CARRIER_PROFILES: CarrierProfile[] = [
  {
    code: "qr_basic",
    label: "QR comun",
    family: "qr",
    securityLevel: 1,
    costBand: "entry",
    estimatedUnitCostUsdMin: 0.005,
    estimatedUnitCostUsdMax: 0.03,
    capabilities: { ...entryCapabilities, supportsQr: true },
    recommendedVerticals: ["marketing", "hospitality", "small_brand", "events"],
    allowedActions: ["content", "lead_capture", "marketplace", "analytics", "loyalty_declared"],
    blockedActions: ["cryptographic_auth", "anti_replay", "tamper", "ownership_without_purchase", "tokenization_without_review"],
    consumerCopy: {
      headline: "Experiencia digital por QR",
      body: "Abre contenido, promociones, marketplace y analitica de escaneos con muy bajo costo.",
      disclaimer: "No prueba autenticidad criptografica: un QR puede copiarse con una foto.",
    },
    adminCopy: {
      positioning: "Entrada comercial para clientes chicos o campanas rapidas.",
      bestFor: "Menus, landing pages, promos, leads, clubes y trazabilidad declarada.",
      avoid: "No usar como anti-fraude premium ni como prueba unica de ownership.",
    },
    defaultPolicy: {
      requiresFreshTap: false,
      requiresPurchaseProof: true,
      claimMode: "declared",
      tokenizationMode: "disabled",
      riskPolicy: "marketing",
    },
  },
  {
    code: "gs1_digital_link",
    label: "QR GS1 Digital Link",
    family: "gs1",
    securityLevel: 2,
    costBand: "entry",
    estimatedUnitCostUsdMin: 0.01,
    estimatedUnitCostUsdMax: 0.05,
    capabilities: { ...entryCapabilities, supportsQr: true, supportsGs1: true },
    recommendedVerticals: ["retail", "export", "agro", "pharma", "food"],
    allowedActions: ["gtin", "lot", "serial", "expiry", "declared_provenance", "marketplace", "analytics", "loyalty_declared"],
    blockedActions: ["cryptographic_auth", "anti_replay", "tamper", "tokenization_without_review"],
    consumerCopy: {
      headline: "Pasaporte retail con GS1",
      body: "Conecta GTIN, lote, serie, vencimiento y contenido web compatible con retail/exportacion.",
      disclaimer: "Es trazabilidad estandarizada, no una prueba criptografica anti-clon.",
    },
    adminCopy: {
      positioning: "Escalon profesional para retail y exportacion antes de pasar a NFC seguro.",
      bestFor: "Productos de volumen, lotes, alimentos, agro, pharma y marcas que necesitan GS1.",
      avoid: "No prometer anti-replay ni sello fisico.",
    },
    defaultPolicy: {
      requiresFreshTap: false,
      requiresPurchaseProof: true,
      claimMode: "verified_purchase",
      tokenizationMode: "request_only",
      riskPolicy: "declared_traceability",
    },
  },
  {
    code: "ntag213",
    label: "NTAG213",
    family: "nfc",
    securityLevel: 2,
    costBand: "standard",
    estimatedUnitCostUsdMin: 0.08,
    estimatedUnitCostUsdMax: 0.2,
    capabilities: { ...entryCapabilities, supportsNfc: true, supportsUid: true },
    recommendedVerticals: ["events", "hospitality", "marketing", "warranty"],
    allowedActions: ["tap_to_web", "uid_inventory", "warranty_basic", "marketplace", "analytics", "loyalty_declared"],
    blockedActions: ["cryptographic_auth", "sun", "anti_replay", "tamper", "automatic_tokenization"],
    consumerCopy: {
      headline: "Tap NFC economico",
      body: "Reduce friccion: el usuario toca con el celular y abre contenido, registro o garantia.",
      disclaimer: "No incluye SUN/SDM ni anti-replay criptografico.",
    },
    adminCopy: {
      positioning: "NFC de entrada para experiencias y garantias simples.",
      bestFor: "Campanas de volumen, activaciones, soporte postventa y UX tap-to-web.",
      avoid: "Productos premium con riesgo de clonacion o reventa.",
    },
    defaultPolicy: {
      requiresFreshTap: true,
      requiresPurchaseProof: true,
      claimMode: "verified_purchase",
      tokenizationMode: "request_only",
      riskPolicy: "server_uid",
    },
  },
  {
    code: "ntag215",
    label: "NTAG215",
    family: "nfc",
    securityLevel: 3,
    costBand: "standard",
    estimatedUnitCostUsdMin: 0.12,
    estimatedUnitCostUsdMax: 0.35,
    capabilities: { ...entryCapabilities, supportsNfc: true, supportsUid: true },
    recommendedVerticals: ["events", "credentials", "access", "mid_value_products"],
    allowedActions: ["tap_to_web", "uid_inventory", "server_rules", "warranty", "marketplace", "analytics", "loyalty"],
    blockedActions: ["cryptographic_auth", "sun", "tamper", "automatic_tokenization"],
    consumerCopy: {
      headline: "NFC para eventos y activaciones",
      body: "Sirve para pulseras, credenciales, tickets y productos donde importa velocidad y serializacion.",
      disclaimer: "Controla UID/reglas server-side, pero no es anti-clon premium.",
    },
    adminCopy: {
      positioning: "Muy buen punto medio para eventos, credenciales y marcas con validacion frecuente.",
      bestFor: "Check-in, pulseras, journeys de marca, garantias y marketplace contextual.",
      avoid: "No vender como prueba criptografica fuerte.",
    },
    defaultPolicy: {
      requiresFreshTap: true,
      requiresPurchaseProof: true,
      claimMode: "verified_purchase",
      tokenizationMode: "request_only",
      riskPolicy: "server_uid",
    },
  },
  {
    code: "ntag216",
    label: "NTAG216",
    family: "nfc",
    securityLevel: 3,
    costBand: "standard",
    estimatedUnitCostUsdMin: 0.18,
    estimatedUnitCostUsdMax: 0.45,
    capabilities: { ...entryCapabilities, supportsNfc: true, supportsUid: true },
    recommendedVerticals: ["events", "documents", "extended_content", "credentials"],
    allowedActions: ["tap_to_web", "larger_payload", "uid_inventory", "warranty", "marketplace", "analytics", "loyalty"],
    blockedActions: ["cryptographic_auth", "sun", "tamper", "automatic_tokenization"],
    consumerCopy: {
      headline: "NFC con mas memoria",
      body: "Ideal cuando hace falta mas contenido o payload local sin subir al nivel 424.",
      disclaimer: "No reemplaza SUN/SDM ni tamper fisico.",
    },
    adminCopy: {
      positioning: "NFC operativo con mas memoria para casos que exceden NTAG213/215.",
      bestFor: "Credenciales, documentos simples y activaciones con payload extendido.",
      avoid: "No usar como evidencia anti-fraude de alto valor.",
    },
    defaultPolicy: {
      requiresFreshTap: true,
      requiresPurchaseProof: true,
      claimMode: "verified_purchase",
      tokenizationMode: "request_only",
      riskPolicy: "server_uid",
    },
  },
  {
    code: "ntag424_dna",
    label: "NTAG 424 DNA",
    family: "nfc",
    securityLevel: 5,
    costBand: "secure",
    estimatedUnitCostUsdMin: 0.55,
    estimatedUnitCostUsdMax: 0.9,
    capabilities: {
      ...entryCapabilities,
      supportsNfc: true,
      supportsUid: true,
      supportsSun: true,
      supportsReplayDetection: true,
      supportsOwnership: true,
      supportsTokenization: true,
      cryptographic: true,
    },
    recommendedVerticals: ["wine", "cosmetics", "luxury", "documents", "pharma", "agro"],
    allowedActions: ["cryptographic_auth", "anti_replay", "ownership_after_purchase", "warranty", "tokenization_request", "marketplace", "loyalty"],
    blockedActions: ["tamper_physical_state"],
    consumerCopy: {
      headline: "Autenticidad criptografica",
      body: "Cada tap genera una prueba dinamica SUN/SDM para detectar replay, copias y URLs reutilizadas.",
      disclaimer: "No detecta apertura fisica si no usa TagTamper TT.",
    },
    adminCopy: {
      positioning: "Linea segura para autenticidad real y tokenizacion controlada.",
      bestFor: "Productos premium donde clonacion, reventa o garantia requieren prueba fuerte.",
      avoid: "No prometer sello abierto/cerrado sin hardware TT.",
    },
    defaultPolicy: {
      requiresFreshTap: true,
      requiresPurchaseProof: true,
      claimMode: "verified_purchase",
      tokenizationMode: "verified_only",
      riskPolicy: "cryptographic",
    },
  },
  {
    code: "ntag424_dna_tt",
    label: "NTAG 424 DNA TT",
    family: "nfc",
    securityLevel: 6,
    costBand: "premium",
    estimatedUnitCostUsdMin: 0.85,
    estimatedUnitCostUsdMax: 1.25,
    capabilities: {
      ...entryCapabilities,
      supportsNfc: true,
      supportsUid: true,
      supportsSun: true,
      supportsTamper: true,
      supportsReplayDetection: true,
      supportsOwnership: true,
      supportsTokenization: true,
      cryptographic: true,
    },
    recommendedVerticals: ["wine", "spirits", "luxury", "pharma", "documents", "collectibles"],
    allowedActions: ["cryptographic_auth", "anti_replay", "tamper_state", "ownership_after_purchase", "warranty", "tokenization_request", "marketplace", "loyalty"],
    blockedActions: ["claim_without_fresh_tap", "tokenize_without_purchase_policy"],
    consumerCopy: {
      headline: "Autenticidad + sello fisico",
      body: "Valida criptografia y estado del sello: cerrado, abierto o tamper para productos premium.",
      disclaimer: "Ownership y tokenizacion requieren tap fresco y politica comercial del tenant.",
    },
    adminCopy: {
      positioning: "Capa premium para confianza, lifecycle y evidencia de apertura.",
      bestFor: "Vino, lujo, pharma, documentos, coleccionables y productos con reventa o garantia.",
      avoid: "No habilitar ownership automatico sin venta, ticket o aprobacion del tenant.",
    },
    defaultPolicy: {
      requiresFreshTap: true,
      requiresPurchaseProof: true,
      claimMode: "verified_purchase",
      tokenizationMode: "verified_only",
      riskPolicy: "cryptographic_tamper",
    },
  },
];

const profileByCode = new Map(CARRIER_PROFILES.map((profile) => [profile.code, profile]));

export function listCarrierProfiles() {
  return CARRIER_PROFILES;
}

export function getCarrierProfile(input: unknown) {
  const code = normalizeCarrierProfileCode(input);
  return code ? profileByCode.get(code) || null : null;
}

export function normalizeCarrierProfileCode(input: unknown): CarrierProfileCode | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const value = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!value) return null;
  if (profileByCode.has(value as CarrierProfileCode)) return value as CarrierProfileCode;

  if (["qr", "qr_common", "qr_comun", "qr_code", "qr_basic", "basic_qr"].includes(value)) return "qr_basic";
  if (value.includes("gs1") || value.includes("digital_link") || value.includes("gtin")) return "gs1_digital_link";
  if (value.includes("213")) return "ntag213";
  if (value.includes("215")) return "ntag215";
  if (value.includes("216")) return "ntag216";
  if (value.includes("424") && (value.includes("tt") || value.includes("tamper") || value.includes("tagtamper"))) return "ntag424_dna_tt";
  if (value.includes("424") || value.includes("sdm") || value.includes("sun") || value.includes("dna")) return "ntag424_dna";
  if (value === "secure" || value === "premium" || value.includes("anti_clone")) return "ntag424_dna";
  if (value === "basic" || value.includes("event")) return "ntag215";
  return null;
}

export function inferCarrierProfileFromPayload(payload: Record<string, unknown>): CarrierProfileCode | null {
  const keys = [
    "carrier_profile_code",
    "carrierProfileCode",
    "carrier_profile",
    "carrierProfile",
    "carrier",
    "chip_model",
    "chip",
    "chip_type",
    "tag_type",
    "ic_type",
    "profile",
    "security_profile",
    "sku",
  ];

  for (const key of keys) {
    const direct = normalizeCarrierProfileCode(payload[key]);
    if (direct) return direct;
  }

  const combined = keys.map((key) => String(payload[key] || "")).filter(Boolean).join(" ");
  return normalizeCarrierProfileCode(combined);
}
