import { enterpriseCarrierContract, normalizeCarrierProfileCode } from "./carrier-profiles";
import { sql } from "./db";
import { normalizeSupplierPackagingSpec, type SupplierPackagingSpec } from "./supplier-packaging-spec";
import { auditFreeformContainsSecret } from "./audit-freeform-secret-policy";

export const PACKAGING_DELIVERY_FORMATS = [
  "dry_inlay",
  "wet_inlay",
  "white_label",
  "transparent_pet",
  "void_label",
  "hard_tag",
] as const;

export const PACKAGING_TYPES = [
  "seed_bag",
  "woven_bag",
  "laminated_bag",
  "jerry_can",
  "cap",
  "box",
  "pallet",
  "other",
] as const;

export const PACKAGING_LAB_STATUSES = [
  "DRAFT",
  "MATERIALS_PENDING",
  "TESTING",
  "FAILED",
  "APPROVED",
  "ARCHIVED",
] as const;

export const PACKAGING_TEST_CATEGORIES = [
  "MATERIAL",
  "ADHESION",
  "RF",
  "CRYPTO",
  "LINE",
  "ENVIRONMENT",
  "UX",
] as const;

export const PACKAGING_TEST_STATUSES = ["PENDING", "PASS", "FAIL", "WAIVED"] as const;

export type PackagingDeliveryFormat = typeof PACKAGING_DELIVERY_FORMATS[number];
export type PackagingType = typeof PACKAGING_TYPES[number];
export type PackagingLabStatus = typeof PACKAGING_LAB_STATUSES[number];
export type PackagingTestCategory = typeof PACKAGING_TEST_CATEGORIES[number];
export type PackagingTestStatus = typeof PACKAGING_TEST_STATUSES[number];

export type PackagingLabTemplateCode = "seed_bag" | "jerry_can" | "roll_line" | "custom";

export const PACKAGING_LAB_PRESET_CODES = ["AGRO_SECURE_PACKAGING_PILOT"] as const;
export type PackagingLabPresetCode = typeof PACKAGING_LAB_PRESET_CODES[number];

export type PackagingLabPreset = {
  code: PackagingLabPresetCode;
  version: number;
  name: string;
  description: string;
  carrier_profile_code: string;
  carrier_spec_name: string;
  delivery_format: PackagingDeliveryFormat;
  packaging_type: PackagingType;
  placement_zone: string;
  objective: string;
  target_substrates: string[];
  forbidden_conditions: string[];
  crosses_opening: boolean;
  requires_tail_break: boolean;
  physical_validation_required: true;
  raw_key_material_allowed: false;
  security_truth: string[];
};

export type PackagingLabTemplateTest = {
  code: string;
  category: PackagingTestCategory;
  name: string;
  method: string;
  target: string;
  required: boolean;
  waiverAllowed: boolean;
};

/**
 * Reusable, tenant-neutral pilot preset. It proposes a construction and test
 * starting point; it never constitutes physical approval. The immutable
 * Packaging Lab receipt and its required tests remain the activation gate.
 */
export function packagingLabPresetFor(
  presetCode: unknown,
  carrierProfileCode: unknown,
): PackagingLabPreset {
  const code = String(presetCode || "").trim().toUpperCase();
  if (!PACKAGING_LAB_PRESET_CODES.includes(code as PackagingLabPresetCode)) {
    throw new Error("packaging_lab_preset_invalid");
  }
  const carrier = normalizeCarrierProfileCode(carrierProfileCode);
  const contract = carrier ? enterpriseCarrierContract(carrier) : null;
  if (!carrier || !contract) throw new Error("carrier_profile_code_invalid");

  const isTt = carrier === "ntag424_dna_tt";
  const isUhf = carrier === "uhf_rfid";
  const packagingType: PackagingType = isTt ? "cap" : isUhf ? "pallet" : "seed_bag";
  const deliveryFormat: PackagingDeliveryFormat = isUhf ? "white_label" : "transparent_pet";
  const placementZone = isTt
    ? "Puente fisico entre tapa y cuello; geometria exacta pendiente de validacion sacrificial"
    : isUhf
      ? "Cara exterior del pallet o caja, separada de metal y liquidos segun ensayo RF"
      : "Zona plana del arte trasero, fuera de costuras, pliegues y compresion";
  const targetSubstrates = isTt
    ? ["tapa y cuello reales del bidon", "PET transparente resistente a salpicadura quimica"]
    : isUhf
      ? ["carton o film stretch real del pallet", "superficie logistica final de produccion"]
      : ["bolsa tejida o laminada real del producto", "PET transparente convertido para aplicacion en rollo"];
  const forbiddenConditions = isTt
    ? [
        "placement decorativo que no cruce la apertura real",
        "contacto con metal o liquido sin separacion RF calificada",
        "claim de apertura sin TTStatus canonico de dos bytes",
      ]
    : isUhf
      ? [
          "uso o exportacion de K_META/K_FILE SUN",
          "claim de autenticidad criptografica o tamper desde una lectura UHF declarada",
          "contacto con metal o liquido sin inlay y separacion RF calificados",
        ]
      : [
          "costuras, pliegues y zonas de compresion",
          "contacto con metal o humedad sin ensayo representativo",
          "claim de apertura para carriers sin TagTamper",
        ];

  return {
    code: code as PackagingLabPresetCode,
    version: 1,
    name: "Agro Secure Packaging Pilot",
    description: "Preset reusable para piloto agro: construccion propuesta, placement, ensayo de linea, RF y verdad criptografica por carrier.",
    carrier_profile_code: carrier,
    carrier_spec_name: `Agro secure packaging pilot / ${contract.displayName}`,
    delivery_format: deliveryFormat,
    packaging_type: packagingType,
    placement_zone: placementZone,
    objective: isTt
      ? "Validar en envase real que el carrier TT cruza la apertura, se rompe al abrir y conserva SUN/SDM, anti-replay y TTStatus canonico sin inferir el estado fisico."
      : isUhf
        ? "Validar aplicacion en linea, lectura masiva y eventos logisticos declarados sobre pallet real sin presentar UHF como SUN, tamper o autenticidad criptografica."
        : "Validar en packaging agro real una etiqueta PET transparente convertida en rollo: adhesion, lectura NFC, aplicacion en linea y seguridad del carrier sin inferir apertura.",
    target_substrates: targetSubstrates,
    forbidden_conditions: forbiddenConditions,
    crosses_opening: isTt,
    requires_tail_break: isTt,
    physical_validation_required: true,
    raw_key_material_allowed: false,
    security_truth: [
      `Assurance: ${contract.assuranceModel}.`,
      contract.requiresBatchKeys
        ? "Las claves SUN permanecen fuera del Packaging Lab y del reporte cliente."
        : "Este carrier no recibe K_META/K_FILE SUN.",
      isTt
        ? "El preset propone el puente; solo la prueba fisica y TTStatus canonico permiten aprobarlo."
        : "El preset no habilita claims de tamper.",
    ],
  };
}

export function packagingLabPresetsForCarrier(carrierProfileCode: unknown): PackagingLabPreset[] {
  return PACKAGING_LAB_PRESET_CODES.map((code) => packagingLabPresetFor(code, carrierProfileCode));
}

const BASE_TEMPLATES: Record<Exclude<PackagingLabTemplateCode, "custom">, PackagingLabTemplateTest[]> = {
  seed_bag: [
    ["substrate_identification", "MATERIAL", "Identificacion de sustrato", "Registrar estructura real de la bolsa y proveedor.", "Sustrato y tratamiento superficial identificados."],
    ["flat_zone_placement", "RF", "Zona plana", "Ensayar posiciones fuera de costuras, pliegues y zonas de compresion.", "Placement repetible en zona plana."],
    ["seam_crease_avoidance", "MATERIAL", "Costuras y pliegues", "Inspeccionar tolerancias del arte y de la linea.", "Antena fuera de costuras y pliegues."],
    ["filled_bag_read", "RF", "Lectura con bolsa llena", "Medir lectura NFC sobre el producto y humedad nominales.", "Lectura estable sobre bolsa llena."],
    ["bending_wrinkling", "ENVIRONMENT", "Flexion y arrugas", "Flexionar y arrugar una muestra representativa.", "Sin rotura ni perdida de lectura."],
    ["abrasion", "ENVIRONMENT", "Abrasion", "Aplicar protocolo documentado de roce/manipulacion.", "Arte y antena permanecen funcionales."],
    ["dust", "ENVIRONMENT", "Polvo", "Exponer al polvo representativo de almacenamiento/campo.", "Adhesion y lectura dentro del objetivo."],
    ["humidity", "ENVIRONMENT", "Humedad", "Ensayar el ciclo de humedad definido por el cliente.", "Sin delaminacion ni perdida de lectura."],
    ["label_inlay_integration", "ADHESION", "Integracion label/inlay", "Revisar adhesivo, face stock, liner y troquel.", "Construccion convertida sin dano de antena."],
    ["mobile_device_matrix", "UX", "Matriz de celulares", "Probar los modelos de telefono acordados y registrar intentos.", "Tasa de lectura acordada por dispositivo."],
    ["line_application", "LINE", "Aplicacion en linea", "Ejecutar corrida controlada en la linea objetivo.", "Velocidad y rechazos dentro del limite."],
  ].map(templateTuple),
  jerry_can: [
    ["substrate_identification", "MATERIAL", "Sustrato HDPE/PE/PP", "Identificar resina, textura y tratamiento superficial.", "Sustrato real documentado."],
    ["filled_empty_read", "RF", "Bidon lleno vs vacio", "Medir lecturas en ambos estados.", "Lectura estable con el liquido objetivo."],
    ["body_label_read", "RF", "Lectura en cuerpo", "Probar la zona propuesta sobre el envase lleno.", "Lectura estable sin tocar metal o liquido."],
    ["cap_geometry", "MATERIAL", "Geometria de tapa", "Medir curvatura, apertura y tolerancias.", "Troquel compatible con tapa real."],
    ["condensation", "ENVIRONMENT", "Condensacion", "Aplicar ciclo documentado de condensacion.", "Sin delaminacion ni perdida de lectura."],
    ["chemical_splash", "ENVIRONMENT", "Salpicadura quimica", "Ensayar los quimicos declarados con protocolo aprobado.", "Face stock, tinta y adhesivo compatibles."],
    ["curved_surface_adhesion", "ADHESION", "Adhesion en curva", "Medir lift y permanencia sobre radio real.", "Sin levantamiento fuera de tolerancia."],
    ["body_or_cap_placement", "UX", "Placement operativo", "Validar acceso del celular y no interferencia con packaging.", "Tap intuitivo y repetible."],
    ["post_open_readability", "RF", "Lectura posterior a apertura", "Abrir muestra sacrificial y volver a leer.", "Chip legible segun politica de ciclo de vida."],
    ["line_application", "LINE", "Aplicacion en linea", "Ejecutar corrida controlada en la linea objetivo.", "Velocidad y rechazos dentro del limite."],
  ].map(templateTuple),
  roll_line: [
    ["roll_core", "LINE", "Core de rollo", "Medir core del rollo entregado.", "Coincide con la especificacion de linea."],
    ["web_width", "LINE", "Ancho de banda", "Medir web width en tres puntos.", "Dentro de tolerancia."],
    ["pitch", "LINE", "Pitch", "Medir repeticion longitudinal.", "Dentro de tolerancia."],
    ["unwind_direction", "LINE", "Sentido de desbobinado", "Confirmar diagrama y prueba de alimentacion.", "Unwind correcto."],
    ["die_cut_tolerance", "MATERIAL", "Tolerancia de troquel", "Inspeccionar troquel contra antena y liner.", "Sin cortes o presion sobre antena."],
    ["sensor_mark", "LINE", "Marca de sensor", "Validar gap/black mark con el aplicador.", "Deteccion estable."],
    ["application_speed", "LINE", "Velocidad de aplicacion", "Correr a velocidad objetivo documentada.", "Velocidad sostenida dentro del objetivo."],
    ["reject_handling", "LINE", "Gestion de rechazo", "Forzar y registrar unidades rechazadas.", "Rechazos segregados y reconciliados."],
    ["operator_instructions", "UX", "Instrucciones de operador", "Ejecutar el SOP con operador de linea.", "SOP comprensible sin soporte de ingenieria."],
    ["line_interruptions", "LINE", "Interrupciones", "Registrar paradas atribuibles al carrier.", "Dentro del limite acordado."],
  ].map(templateTuple),
};

const CUSTOM_TEMPLATE: PackagingLabTemplateTest[] = [
  ["substrate_identification", "MATERIAL", "Identificacion de sustrato", "Documentar el material real y su tratamiento superficial.", "Material y condicion de superficie identificados."],
  ["custom_rf_validation", "RF", "Validacion RF sobre envase real", "Medir lectura sobre una muestra representativa en la posicion propuesta.", "Tasa de lectura y distancia dentro del objetivo acordado."],
  ["mobile_device_matrix", "UX", "Matriz de dispositivos", "Probar la matriz de telefonos o lectores acordada.", "Experiencia de lectura repetible."],
].map(templateTuple);

function templateTuple(tuple: string[]): PackagingLabTemplateTest {
  return {
    code: tuple[0],
    category: tuple[1] as PackagingTestCategory,
    name: tuple[2],
    method: tuple[3],
    target: tuple[4],
    required: true,
    waiverAllowed: !["substrate_identification", "filled_bag_read", "filled_empty_read", "body_label_read", "line_application"].includes(tuple[0]),
  };
}

const SECURE_SAMPLE_TEST: PackagingLabTemplateTest = {
  code: "secure_sample_validates",
  category: "CRYPTO",
  name: "Muestra segura valida",
  method: "Escanear una muestra fisica registrada y adjuntar el recibo canonico sin query SUN cruda.",
  target: "SUN/CMAC valido, UID en manifiesto y contexto tenant/batch consistente.",
  required: true,
  waiverAllowed: false,
};

const REPLAY_TEST: PackagingLabTemplateTest = {
  code: "replay_rejected",
  category: "CRYPTO",
  name: "Replay rechazado",
  method: "Reutilizar el payload original y adjuntar el recibo canonico de replay.",
  target: "El backend detecta replay y bloquea acciones sensibles.",
  required: true,
  waiverAllowed: false,
};

const TT_TESTS: PackagingLabTemplateTest[] = [
  {
    code: "tt_closed",
    category: "CRYPTO",
    name: "TT cerrado",
    method: "Escanear muestra cerrada y verificar TTStatus de dos bytes en evidencia canonica.",
    target: "VALID_CLOSED con placement que cruza la apertura.",
    required: true,
    waiverAllowed: false,
  },
  {
    code: "tt_opened",
    category: "CRYPTO",
    name: "TT abierto sacrificial",
    method: "Abrir una muestra sacrificial, volver a escanear y retirar el UID de venta.",
    target: "VALID_OPENED/OPENED_PREVIOUSLY con contador posterior.",
    required: true,
    waiverAllowed: false,
  },
];

function requiredText(value: unknown, field: string, max: number) {
  const normalized = typeof value === "string" || typeof value === "number"
    ? String(value).trim().replace(/\s+/g, " ")
    : "";
  if (!normalized) throw new Error(`${field}_required`);
  if (normalized.length > max) throw new Error(`${field}_too_long`);
  return normalized;
}

function optionalText(value: unknown, field: string, max: number) {
  if (value === undefined || value === null || value === "") return null;
  return requiredText(value, field, max);
}

function secretSafeText(value: unknown, field: string, max: number, required = false) {
  const normalized = required ? requiredText(value, field, max) : optionalText(value, field, max);
  if (normalized && auditFreeformContainsSecret(normalized)) throw new Error(`${field}_secret_forbidden`);
  return normalized;
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  const normalized = requiredText(value, field, 80).toLowerCase();
  if (!allowed.includes(normalized as T[number])) throw new Error(`${field}_invalid`);
  return normalized as T[number];
}

function uuid(value: unknown, field: string) {
  const normalized = requiredText(value, field, 80).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`${field}_invalid`);
  }
  return normalized;
}

function operationKey(value: unknown) {
  const normalized = requiredText(value, "operation_key", 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(normalized)) throw new Error("operation_key_invalid");
  return normalized;
}

export function packagingLabTemplateFor(packagingType: PackagingType): PackagingLabTemplateCode {
  if (["seed_bag", "woven_bag", "laminated_bag"].includes(packagingType)) return "seed_bag";
  if (["jerry_can", "cap"].includes(packagingType)) return "jerry_can";
  if (["box", "pallet"].includes(packagingType)) return "roll_line";
  return "custom";
}

export function packagingLabTemplateTests(template: PackagingLabTemplateCode, carrierProfileCode: unknown) {
  const carrier = normalizeCarrierProfileCode(carrierProfileCode);
  if (!carrier) throw new Error("carrier_profile_code_invalid");
  const base = template === "custom" ? CUSTOM_TEMPLATE : BASE_TEMPLATES[template];
  const crypto = carrier === "ntag424_dna" || carrier === "ntag424_dna_tt"
    ? [SECURE_SAMPLE_TEST, REPLAY_TEST, ...(carrier === "ntag424_dna_tt" ? TT_TESTS : [])]
    : [];
  return [...base, ...crypto].map((test, index) => ({ ...test, sequence: index + 1 }));
}

export function normalizePackagingEvidenceUrls(value: unknown) {
  const entries = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  const normalized = entries.map((entry) => requiredText(entry, "evidence_url", 2_048));
  for (const entry of normalized) {
    if (/[?&](?:picc_data|enc|cmac|kmeta|kfile|key|secret|token)=/i.test(entry)
      || /(?:K_META|K_FILE|PRIVATE_KEY|DATABASE_URL)/i.test(entry)) {
      throw new Error("packaging_lab_raw_secret_evidence_forbidden");
    }
    if (/^https?:/i.test(entry)) {
      const parsed = new URL(entry);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
        throw new Error("packaging_lab_evidence_url_must_be_client_safe");
      }
    } else if (!/^(?:evidence|vault|sha256):/i.test(entry)) {
      throw new Error("packaging_lab_evidence_reference_invalid");
    }
  }
  return [...new Set(normalized)].slice(0, 24);
}

export function buildPackagingCarrierSpecFromApprovedSnapshot(input: {
  carrierProfileCode: unknown;
  deliveryFormat: unknown;
  name: unknown;
  specSnapshot: unknown;
  targetSubstrates?: unknown;
  forbiddenConditions?: unknown;
  notes?: unknown;
}) {
  const carrierProfileCode = normalizeCarrierProfileCode(input.carrierProfileCode);
  if (!carrierProfileCode) throw new Error("carrier_profile_code_invalid");
  const contract = enterpriseCarrierContract(carrierProfileCode);
  if (!contract) throw new Error("carrier_profile_code_invalid");
  const deliveryFormat = enumValue(input.deliveryFormat, PACKAGING_DELIVERY_FORMATS, "delivery_format");
  const spec = normalizeSupplierPackagingSpec(input.specSnapshot);
  const explicitTargets = Array.isArray(input.targetSubstrates)
    ? input.targetSubstrates.map((value) => requiredText(value, "target_substrate", 160))
    : [];
  const forbiddenConditions = Array.isArray(input.forbiddenConditions)
    ? input.forbiddenConditions.map((value) => requiredText(value, "forbidden_condition", 240))
    : [];
  return {
    name: requiredText(input.name, "carrier_spec_name", 160),
    carrier_profile_code: carrierProfileCode,
    delivery_format: deliveryFormat,
    antenna_width_mm: spec.geometry.antennaWidthMm,
    antenna_height_mm: spec.geometry.antennaHeightMm,
    die_cut_width_mm: spec.geometry.labelWidthMm,
    die_cut_height_mm: spec.geometry.labelHeightMm,
    total_thickness_mm: null,
    adhesive_code: spec.adhesive,
    adhesive_description: spec.adhesive,
    liner_type: spec.liner,
    roll_core_mm: spec.roll.coreDiameterMm,
    pitch_mm: spec.geometry.pitchMm,
    web_width_mm: spec.geometry.webWidthMm,
    unwind_direction: spec.roll.unwindDirection ? String(spec.roll.unwindDirection) : null,
    target_substrates: [...new Set([
      ...explicitTargets,
      spec.substrateMaterial,
      spec.applicationSurface,
    ].filter((value): value is string => Boolean(value)))],
    forbidden_conditions: [...new Set(forbiddenConditions)],
    metal_clearance_mm: spec.environment.metalProximity ? 5 : null,
    operating_temperature: {
      min_c: spec.environment.minTemperatureC,
      max_c: spec.environment.maxTemperatureC,
    },
    humidity_test_required: true,
    chemical_test_required: spec.environment.chemicalExposure.length > 0,
    abrasion_test_required: true,
    assurance_model: contract.assuranceModel,
    tamper_evidence_mode: contract.tamperEvidenceMode,
    key_material_policy: contract.requiresBatchKeys ? "batch_sun" : "none",
    notes: secretSafeText(input.notes, "carrier_spec_notes", 2_000),
  };
}

export type CreatePackagingLabProjectInput = {
  tenantId: unknown;
  supplierOrderId: unknown;
  actorId: unknown;
  authSessionId: unknown;
  operationKey: unknown;
  carrierProfileCode: unknown;
  approvedPackagingRevision: unknown;
  approvedPackagingHash: unknown;
  carrierSpecId?: unknown;
  placementId?: unknown;
  carrierSpec?: unknown;
  productId?: unknown;
  sku?: unknown;
  packagingType: unknown;
  placementZone: unknown;
  placementImageUrl?: unknown;
  crossesOpening?: unknown;
  requiresTailBreak?: unknown;
  objective: unknown;
  ownerUserId: unknown;
};

export async function createPackagingLabProject(input: CreatePackagingLabProjectInput) {
  const carrierProfileCode = normalizeCarrierProfileCode(input.carrierProfileCode);
  if (!carrierProfileCode) throw new Error("carrier_profile_code_invalid");
  const packagingType = enumValue(input.packagingType, PACKAGING_TYPES, "packaging_type");
  const carrierSpecId = input.carrierSpecId ? uuid(input.carrierSpecId, "carrier_spec_id") : null;
  const placementId = input.placementId ? uuid(input.placementId, "placement_id") : null;
  const tagTamper = carrierProfileCode === "ntag424_dna_tt";
  const crossesOpening = input.crossesOpening === true;
  const requiresTailBreak = input.requiresTailBreak === true;
  // Existing placements are immutable, tenant-bound records. Their opening
  // geometry is revalidated by the database, so callers must not restate it.
  if (!placementId && !tagTamper && (crossesOpening || requiresTailBreak)) throw new Error("packaging_non_tt_tamper_claim_forbidden");
  if (!placementId && tagTamper && (!crossesOpening || !requiresTailBreak)) throw new Error("packaging_tt_opening_placement_required");
  const templateCode = packagingLabTemplateFor(packagingType);
  const tests = packagingLabTemplateTests(templateCode, carrierProfileCode);
  const approvedPackagingRevision = Number(input.approvedPackagingRevision);
  if (!Number.isSafeInteger(approvedPackagingRevision) || approvedPackagingRevision < 1) {
    throw new Error("approved_packaging_revision_invalid");
  }
  const approvedPackagingHash = requiredText(input.approvedPackagingHash, "approved_packaging_hash", 80).toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/.test(approvedPackagingHash)) throw new Error("approved_packaging_hash_invalid");

  const payload = {
    tenant_id: uuid(input.tenantId, "tenant_id"),
    supplier_order_id: uuid(input.supplierOrderId, "supplier_order_id"),
    actor_id: uuid(input.actorId, "actor_id"),
    auth_session_id: uuid(input.authSessionId, "auth_session_id"),
    operation_key: operationKey(input.operationKey),
    carrier_profile_code: carrierProfileCode,
    approved_packaging_revision: approvedPackagingRevision,
    approved_packaging_hash: approvedPackagingHash,
    carrier_spec_id: carrierSpecId,
    placement_id: placementId,
    carrier_spec: input.carrierSpec || null,
    product_id: optionalText(input.productId, "product_id", 160),
    sku: optionalText(input.sku, "sku", 160),
    packaging_type: packagingType,
    placement_zone: placementId ? null : requiredText(input.placementZone, "placement_zone", 240),
    placement_image_url: placementId ? null : input.placementImageUrl
      ? normalizePackagingEvidenceUrls([input.placementImageUrl])[0]
      : null,
    crosses_opening: crossesOpening,
    requires_tail_break: requiresTailBreak,
    objective: secretSafeText(input.objective, "objective", 2_000, true),
    owner_user_id: uuid(input.ownerUserId, "owner_user_id"),
    template_code: templateCode,
    template_tests: tests,
  };
  const rows = await sql/*sql*/`
    SELECT *
    FROM public.nexid_create_packaging_lab_project_v1(${JSON.stringify(payload)}::jsonb)
  `;
  if (!rows[0]) throw new Error("packaging_lab_project_create_failed");
  return rows[0];
}

export async function recordPackagingLabTest(input: {
  tenantId: unknown;
  projectId: unknown;
  testCaseId: unknown;
  actorId: unknown;
  authSessionId: unknown;
  expectedVersion: unknown;
  status: unknown;
  result?: unknown;
  evidenceUrls?: unknown;
  requestId?: unknown;
}) {
  const status = String(input.status || "").trim().toUpperCase();
  if (!PACKAGING_TEST_STATUSES.includes(status as PackagingTestStatus)) throw new Error("packaging_test_status_invalid");
  const expectedVersion = Number(input.expectedVersion);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new Error("packaging_test_version_invalid");
  const result = secretSafeText(input.result, "packaging_test_result", 4_000);
  if (status !== "PENDING" && !result) throw new Error("packaging_test_result_required");
  const rows = await sql/*sql*/`
    SELECT *
    FROM public.nexid_record_packaging_lab_test_v1(${JSON.stringify({
      tenant_id: uuid(input.tenantId, "tenant_id"),
      project_id: uuid(input.projectId, "project_id"),
      test_case_id: uuid(input.testCaseId, "test_case_id"),
      actor_id: uuid(input.actorId, "actor_id"),
      auth_session_id: uuid(input.authSessionId, "auth_session_id"),
      expected_version: expectedVersion,
      status,
      result,
      evidence_urls: normalizePackagingEvidenceUrls(input.evidenceUrls),
      request_id: optionalText(input.requestId, "request_id", 160),
    })}::jsonb)
  `;
  if (!rows[0]) throw new Error("packaging_lab_test_record_failed");
  return rows[0];
}

export async function decidePackagingLabProject(input: {
  tenantId: unknown;
  projectId: unknown;
  actorId: unknown;
  authSessionId: unknown;
  operationKey: unknown;
  decision: unknown;
  reason?: unknown;
  recommendation?: unknown;
  override?: unknown;
  overrideReason?: unknown;
  requestId?: unknown;
}) {
  const decision = String(input.decision || "").trim().toUpperCase();
  if (!['APPROVE', 'FAIL', 'ARCHIVE'].includes(decision)) throw new Error("packaging_lab_decision_invalid");
  const reason = secretSafeText(input.reason, "packaging_lab_decision_reason", 2_000);
  if (decision !== "APPROVE" && !reason) throw new Error("packaging_lab_decision_reason_required");
  const override = input.override === true;
  const overrideReason = secretSafeText(input.overrideReason, "packaging_lab_override_reason", 2_000);
  if (override !== Boolean(overrideReason) || (overrideReason && overrideReason.length < 16)) {
    throw new Error("packaging_lab_override_reason_required");
  }
  const rows = await sql/*sql*/`
    SELECT *
    FROM public.nexid_decide_packaging_lab_project_v1(${JSON.stringify({
      tenant_id: uuid(input.tenantId, "tenant_id"),
      project_id: uuid(input.projectId, "project_id"),
      actor_id: uuid(input.actorId, "actor_id"),
      auth_session_id: uuid(input.authSessionId, "auth_session_id"),
      operation_key: operationKey(input.operationKey),
      decision,
      reason,
      recommendation: secretSafeText(input.recommendation, "packaging_lab_recommendation", 4_000),
      override,
      override_reason: overrideReason,
      request_id: optionalText(input.requestId, "request_id", 160),
    })}::jsonb)
  `;
  if (!rows[0]) throw new Error("packaging_lab_decision_failed");
  return rows[0];
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildPackagingLabCsvReport(input: {
  orderName: string;
  carrierProfileCode: string;
  project: Record<string, unknown>;
  carrierSpec: Record<string, unknown>;
  placement: Record<string, unknown>;
  tests: Array<Record<string, unknown>>;
  approval?: Record<string, unknown> | null;
}) {
  const header = ["order", "project_status", "carrier", "packaging_type", "sku", "placement", "test_code", "category", "test", "target", "result", "status", "evidence_refs"];
  const rows = input.tests.map((test) => [
    input.orderName,
    input.project.status,
    input.carrierProfileCode,
    input.project.packaging_type,
    input.project.sku || input.project.product_id || "",
    input.placement.placement_zone,
    test.code,
    test.category,
    test.name,
    test.target,
    test.result || "",
    test.status,
    Array.isArray(test.evidence_urls) ? test.evidence_urls.join(" | ") : "",
  ]);
  return Buffer.from([header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n", "utf8");
}

function escapePdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function buildPackagingLabPdfReport(input: {
  orderName: string;
  tenantLabel: string;
  carrierProfileCode: string;
  project: Record<string, any>;
  carrierSpec: Record<string, any>;
  placement: Record<string, any>;
  tests: Array<Record<string, any>>;
  approval?: Record<string, any> | null;
}) {
  const passed = input.tests.filter((test) => test.status === "PASS").length;
  const failed = input.tests.filter((test) => test.status === "FAIL").length;
  const waived = input.tests.filter((test) => test.status === "WAIVED").length;
  const lines = [
    "nexID Packaging Lab - Client-safe report",
    `Tenant: ${input.tenantLabel}`,
    `Order: ${input.orderName}`,
    `Carrier: ${input.carrierProfileCode}`,
    `Construction: ${input.carrierSpec.name || ""} / ${input.carrierSpec.delivery_format || ""}`,
    `Material: ${(input.carrierSpec.target_substrates || []).join(", ")}`,
    `Packaging: ${input.project.packaging_type || ""}`,
    `Product/SKU: ${input.project.product_id || input.project.sku || "not supplied"}`,
    `Placement: ${input.placement.placement_zone || ""}`,
    `Placement image/evidence: ${input.placement.placement_image_url || "not supplied"}`,
    `Opening bridge: ${input.placement.crosses_opening === true ? "yes" : "no"}`,
    `Status: ${input.project.status || "DRAFT"}`,
    `Tests: ${passed} pass / ${failed} fail / ${waived} waived / ${input.tests.length} total`,
    ...input.tests.slice(0, 17).map((test) => `${test.status} - ${test.name}: ${test.result || "pending"}`),
    `Recommendation: ${input.project.recommendation || "Pending lab conclusion."}`,
    `Approval receipt: ${input.approval?.receipt_digest || "not approved"}`,
    "Evidence references are client-safe pointers; NFC keys and raw SUN query values are excluded.",
  ];
  const stream = [
    "BT",
    "/F2 16 Tf",
    "44 752 Td",
    `(${escapePdfText(lines[0]).slice(0, 120)}) Tj`,
    "/F1 9 Tf",
    ...lines.slice(1).flatMap((line) => ["0 -20 Td", `(${escapePdfText(line).slice(0, 132)}) Tj`]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(""), "utf8");
}

export type PackagingCarrierSpecSnapshot = ReturnType<typeof buildPackagingCarrierSpecFromApprovedSnapshot>;
export type PackagingCarrierSpec = PackagingCarrierSpecSnapshot & {
  id: string;
  tenant_id: string;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};
export type PackagingPlacement = {
  id: string;
  tenant_id: string;
  product_id: string | null;
  sku: string | null;
  packaging_type: PackagingType;
  carrier_spec_id: string;
  placement_zone: string;
  placement_image_url: string | null;
  crosses_opening: boolean;
  requires_tail_break: boolean;
  validated: boolean;
  validation_report_id: string | null;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};
export type ApprovedSupplierPackagingSnapshot = SupplierPackagingSpec;
