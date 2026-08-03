export type CarrierProfileCode =
  | "qr_basic"
  | "gs1_digital_link"
  | "ntag213"
  | "ntag215"
  | "ntag216"
  | "ntag424_dna"
  | "ntag424_dna_tt"
  | "uhf_rfid"
  | "event_wristband"
  | "hotel_keycard"
  | "iot_tracker_placeholder";

export type CarrierTechnology = "QR" | "NFC" | "UHF" | "IOT";

/**
 * Stable enterprise capability contract projected from the canonical carrier
 * catalog.  Packaging, QA and UI code consume this contract instead of
 * inferring security behavior from a BID, SKU or marketing label.
 *
 * `gs1_qr` remains an accepted external alias for the existing canonical
 * `gs1_digital_link` profile; keeping one canonical row avoids two policies
 * drifting for the same physical carrier.
 */
export type EnterpriseCarrierContract = {
  canonicalCode: CarrierProfileCode;
  aliases: string[];
  displayName: string;
  technology: CarrierTechnology;
  chipModel: string | null;
  cryptographicAuthentication: boolean;
  supportsDynamicUid: boolean;
  supportsReadCounter: boolean;
  supportsCmac: boolean;
  supportsReplayDetection: boolean;
  supportsTamper: boolean;
  supportsBulkRead: boolean;
  requiresReader: boolean;
  requiresBatchKeys: boolean;
  trustLevel: string;
  assuranceModel:
    | "declared_identity"
    | "server_uid"
    | "sun_sdm"
    | "sun_sdm_tamper"
    | "declared_logistics"
    | "sensor_evidence";
  tamperEvidenceMode: "none" | "ttstatus_2byte_or_explicit_manual_evidence";
  allowedProductStates: string[];
  descriptionConsumer: string;
  descriptionOperator: string;
  active: boolean;
};

export type CarrierProfile = {
  code: CarrierProfileCode;
  label: string;
  family: "qr" | "gs1" | "nfc" | "rfid" | "iot";
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
      disclaimer: "No aporta evidencia criptografica dinamica ni anti-replay: una foto puede repetir la misma URL.",
    },
    adminCopy: {
      positioning: "Entrada comercial para clientes chicos o campanas rapidas.",
      bestFor: "Menus, landing pages, promos, leads, clubes y trazabilidad declarada.",
      avoid: "No usar como evidencia criptografica ni como prueba unica de ownership o del producto fisico.",
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
      disclaimer: "Es trazabilidad estandarizada, no evidencia criptografica dinamica ni control anti-replay.",
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
      disclaimer: "Controla UID y reglas server-side, pero no aporta evidencia criptografica dinamica ni autentica el producto fisico.",
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
      headline: "Mensaje NFC criptografico",
      body: "Cada tap aporta evidencia dinamica SUN/SDM para detectar replay, copias y URLs reutilizadas.",
      disclaimer: "No detecta apertura fisica si no usa TagTamper TT.",
    },
    adminCopy: {
      positioning: "Linea segura para validar el mensaje NFC y habilitar tokenizacion controlada.",
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
      headline: "Mensaje NFC + estado TT reportado",
      body: "Valida evidencia SUN/SDM y registra el estado TT reportado: cerrado, abierto o tamper.",
      disclaimer: "No certifica por si solo el contenido ni la condicion fisica; ownership y tokenizacion requieren tap fresco y politica del tenant.",
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
  {
    code: "uhf_rfid",
    label: "UHF RFID / EPC",
    family: "rfid",
    securityLevel: 3,
    costBand: "standard",
    estimatedUnitCostUsdMin: 0.08,
    estimatedUnitCostUsdMax: 0.25,
    capabilities: { ...entryCapabilities, supportsUid: true },
    recommendedVerticals: ["agro", "logistics", "retail", "warehouse", "pharma"],
    allowedActions: ["epc_inventory", "pallet_traceability", "warehouse_scans", "declared_provenance", "analytics", "reorder_signal"],
    blockedActions: ["cryptographic_auth", "sun", "tamper", "consumer_ownership_without_purchase"],
    consumerCopy: {
      headline: "Trazabilidad logística UHF",
      body: "Identifica cajas, pallets y movimientos de depósito con lectura masiva y eventos operativos.",
      disclaimer: "UHF aporta eventos logisticos reportados; no reemplaza evidencia dinamica SUN/SDM ni prueba envio o custodia fisica.",
    },
    adminCopy: {
      positioning: "Capa operativa para logística, agro y retail de alto volumen.",
      bestFor: "Pallets, cajas, inventario, recepción, despacho y auditoría de canal.",
      avoid: "No presentar sus lecturas como autenticidad fisica visible al consumidor final.",
    },
    defaultPolicy: {
      requiresFreshTap: false,
      requiresPurchaseProof: false,
      claimMode: "disabled",
      tokenizationMode: "request_only",
      riskPolicy: "declared_traceability",
    },
  },
  {
    code: "event_wristband",
    label: "Pulsera evento NFC",
    family: "nfc",
    securityLevel: 3,
    costBand: "standard",
    estimatedUnitCostUsdMin: 0.18,
    estimatedUnitCostUsdMax: 0.55,
    capabilities: { ...entryCapabilities, supportsNfc: true, supportsUid: true },
    recommendedVerticals: ["events", "hospitality", "clubs", "sports", "conferences"],
    allowedActions: ["check_in", "access_control", "cashless_reference", "loyalty", "voucher", "audience_capture"],
    blockedActions: ["cryptographic_auth", "sun", "tamper", "automatic_tokenization"],
    consumerCopy: {
      headline: "Acceso y beneficios por pulsera",
      body: "Permite check-in, beneficios, clubes y medición de recorrido con un tap rápido.",
      disclaimer: "La seguridad fuerte depende de reglas server-side y validación en puerta.",
    },
    adminCopy: {
      positioning: "Perfil para eventos, ferias, hospitality y activaciones presenciales.",
      bestFor: "Entradas, zonas VIP, beneficios por stand, trivia, canje y CRM post-evento.",
      avoid: "No vender como evidencia criptografica resistente a replay; 424 DNA mejora la resistencia a copias del mensaje, pero no vuelve imposible copiar el soporte fisico.",
    },
    defaultPolicy: {
      requiresFreshTap: true,
      requiresPurchaseProof: false,
      claimMode: "tenant_approval",
      tokenizationMode: "disabled",
      riskPolicy: "server_uid",
    },
  },
  {
    code: "hotel_keycard",
    label: "Credencial hotel / club",
    family: "nfc",
    securityLevel: 3,
    costBand: "standard",
    estimatedUnitCostUsdMin: 0.2,
    estimatedUnitCostUsdMax: 0.65,
    capabilities: { ...entryCapabilities, supportsNfc: true, supportsUid: true },
    recommendedVerticals: ["hospitality", "clubs", "events", "corporate"],
    allowedActions: ["credential_check", "membership", "access_log", "guest_benefits", "analytics"],
    blockedActions: ["cryptographic_auth", "sun", "tamper", "ownership_without_purchase"],
    consumerCopy: {
      headline: "Credencial digital de experiencia",
      body: "Une tarjeta física, beneficios y registro operativo para hotel, club o evento.",
      disclaimer: "Para evidencia dinamica con resistencia a replay se recomienda NTAG 424 DNA; eso no certifica por si solo el soporte fisico.",
    },
    adminCopy: {
      positioning: "Tarjeta de experiencia para membresías, acceso y beneficios.",
      bestFor: "Hoteles, clubes, eventos corporativos, membresías y pases temporales.",
      avoid: "No reemplazar controles críticos de seguridad física.",
    },
    defaultPolicy: {
      requiresFreshTap: true,
      requiresPurchaseProof: false,
      claimMode: "tenant_approval",
      tokenizationMode: "request_only",
      riskPolicy: "server_uid",
    },
  },
  {
    code: "iot_tracker_placeholder",
    label: "IoT tracker / sensor",
    family: "iot",
    securityLevel: 4,
    costBand: "premium",
    estimatedUnitCostUsdMin: 2.5,
    estimatedUnitCostUsdMax: 18,
    capabilities: { ...entryCapabilities, supportsUid: true },
    recommendedVerticals: ["cold_chain", "logistics", "pharma", "agro", "high_value_shipping"],
    allowedActions: ["sensor_evidence", "temperature_log", "shock_log", "route_audit", "proof_anchor"],
    blockedActions: ["consumer_tap", "sun", "tamper_without_sensor", "automatic_tokenization"],
    consumerCopy: {
      headline: "Evidencia de cadena fría y sensores",
      body: "Adjunta temperatura, golpes, humedad o ruta al pasaporte del producto cuando el caso lo requiere.",
      disclaimer: "Es una capa de evidencia logística; no todos los productos necesitan sensores.",
    },
    adminCopy: {
      positioning: "Capa enterprise para trazabilidad ambiental y auditoría logística.",
      bestFor: "Cadena fría, pharma, agro exportación, sensores de shock y transporte crítico.",
      avoid: "No usar en productos masivos donde NFC/QR alcanza.",
    },
    defaultPolicy: {
      requiresFreshTap: false,
      requiresPurchaseProof: false,
      claimMode: "disabled",
      tokenizationMode: "request_only",
      riskPolicy: "declared_traceability",
    },
  },
];

const profileByCode = new Map(CARRIER_PROFILES.map((profile) => [profile.code, profile]));

export function listCarrierProfiles() {
  return CARRIER_PROFILES;
}

export function enterpriseCarrierContract(input: CarrierProfile | CarrierProfileCode | unknown): EnterpriseCarrierContract | null {
  const profile = typeof input === "object" && input && "code" in input
    ? input as CarrierProfile
    : getCarrierProfile(input);
  if (!profile) return null;

  const code = profile.code;
  const secureSun = code === "ntag424_dna" || code === "ntag424_dna_tt";
  const tagTamper = code === "ntag424_dna_tt";
  const declaredIdentity = code === "qr_basic" || code === "gs1_digital_link";
  const declaredLogistics = code === "uhf_rfid";
  const sensorEvidence = code === "iot_tracker_placeholder";
  const technology: CarrierTechnology = profile.family === "rfid"
    ? "UHF"
    : profile.family === "iot"
      ? "IOT"
      : profile.family === "nfc"
        ? "NFC"
        : "QR";
  const assuranceModel: EnterpriseCarrierContract["assuranceModel"] = tagTamper
    ? "sun_sdm_tamper"
    : secureSun
      ? "sun_sdm"
      : declaredLogistics
        ? "declared_logistics"
        : sensorEvidence
          ? "sensor_evidence"
          : declaredIdentity
            ? "declared_identity"
            : "server_uid";

  const allowedProductStates = tagTamper
    ? ["VALID_CLOSED", "VALID_OPENED", "VALID_OPENED_PREVIOUSLY", "VALID_MANUAL_OPENED", "REPLAY_SUSPECT", "INVALID"]
    : secureSun
      ? ["VALID_AUTHENTIC", "REPLAY_SUSPECT", "INVALID"]
      : declaredIdentity
        ? ["DECLARED_IDENTITY", "INVALID"]
        : declaredLogistics
          ? ["DECLARED_LOGISTICS_EVENT", "INVALID"]
          : sensorEvidence
            ? ["DECLARED_SENSOR_EVIDENCE", "INVALID"]
            : ["SERVER_UID_MATCH", "INVALID"];

  return {
    canonicalCode: code,
    aliases: code === "gs1_digital_link" ? ["gs1_qr"] : [],
    displayName: profile.label,
    technology,
    chipModel: code.startsWith("ntag") ? code.replace(/^ntag/, "NTAG ").replace(/_/g, " ").toUpperCase() : null,
    cryptographicAuthentication: secureSun,
    supportsDynamicUid: secureSun,
    supportsReadCounter: secureSun,
    supportsCmac: secureSun,
    supportsReplayDetection: profile.capabilities.supportsReplayDetection,
    supportsTamper: tagTamper,
    supportsBulkRead: declaredLogistics,
    requiresReader: declaredLogistics || sensorEvidence,
    requiresBatchKeys: secureSun,
    trustLevel: profile.defaultPolicy.riskPolicy,
    assuranceModel,
    tamperEvidenceMode: tagTamper ? "ttstatus_2byte_or_explicit_manual_evidence" : "none",
    allowedProductStates,
    descriptionConsumer: profile.consumerCopy.body,
    descriptionOperator: `${profile.adminCopy.positioning} ${profile.adminCopy.avoid}`.trim(),
    active: true,
  };
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
  if (value.includes("uhf") || value.includes("rfid") || value.includes("epc")) return "uhf_rfid";
  if (value.includes("wristband") || value.includes("pulsera") || value.includes("bracelet") || value.includes("festival")) return "event_wristband";
  if (value.includes("hotel") || value.includes("keycard") || value.includes("credential") || value.includes("credencial")) return "hotel_keycard";
  if (value.includes("iot") || value.includes("tracker") || value.includes("sensor") || value.includes("logger")) return "iot_tracker_placeholder";
  if (value === "secure" || value === "premium" || value.includes("anti_clone")) return "ntag424_dna";
  if (value === "basic") return "ntag215";
  if (value.includes("event")) return "event_wristband";
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
