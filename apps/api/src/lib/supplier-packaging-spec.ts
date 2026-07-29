export const SUPPLIER_PACKAGING_SPEC_VERSION = 1 as const;

export const INLAY_FORMS = [
  "converted_smart_label",
  "wet_inlay",
  "dry_inlay",
  "hard_tag",
  "undecided",
] as const;

export const APPLICATION_SURFACES = [
  "paper",
  "corrugated",
  "glass",
  "plastic_hdpe",
  "plastic_pet",
  "flexible_bag",
  "composite",
  "metal",
  "other",
] as const;

export const PACKAGING_PLACEMENTS = [
  "cap",
  "neck",
  "body",
  "back_label",
  "under_existing_label",
  "bag_seam",
  "carton",
  "pallet",
  "custom",
] as const;

export const APPLICATION_MODES = [
  "automatic_labeler",
  "manual",
  "label_converter",
  "in_mold",
  "undecided",
] as const;

export const WINDING_MODES = ["face_out", "face_in", "sheets", "not_applicable"] as const;

export type InlayForm = typeof INLAY_FORMS[number];
export type ApplicationSurface = typeof APPLICATION_SURFACES[number];
export type PackagingPlacement = typeof PACKAGING_PLACEMENTS[number];
export type ApplicationMode = typeof APPLICATION_MODES[number];
export type WindingMode = typeof WINDING_MODES[number];

export type SupplierPackagingSpec = {
  version: typeof SUPPLIER_PACKAGING_SPEC_VERSION;
  inlayForm: InlayForm;
  applicationSurface: ApplicationSurface;
  placement: PackagingPlacement;
  applicationMode: ApplicationMode;
  substrateMaterial: string | null;
  faceStock: string | null;
  adhesive: string | null;
  liner: string | null;
  geometry: {
    labelWidthMm: number | null;
    labelHeightMm: number | null;
    antennaWidthMm: number | null;
    antennaHeightMm: number | null;
    pitchMm: number | null;
    webWidthMm: number | null;
  };
  roll: {
    coreDiameterMm: number | null;
    maxOuterDiameterMm: number | null;
    winding: WindingMode;
    unwindDirection: number | null;
    quantityPerRoll: number | null;
  };
  line: {
    unitsPerMinute: number | null;
    printerEncoderModel: string | null;
  };
  environment: {
    minTemperatureC: number | null;
    maxTemperatureC: number | null;
    liquidProximity: boolean;
    metalProximity: boolean;
    outdoorUv: boolean;
    chemicalExposure: string[];
  };
  tagTamper: {
    required: boolean;
    bridgesOpening: boolean | null;
    tailLengthMm: number | null;
    placementApproved: boolean;
  };
  qa: {
    rfSampleApproved: boolean;
    lineTrialApproved: boolean;
    adhesiveApproved: boolean;
    artworkApproved: boolean;
    encodingTrialApproved: boolean;
  };
  notes: string | null;
};

export type PackagingSpecIssue = {
  code: string;
  field: string;
  message: string;
};

export type PackagingSpecValidation = {
  ok: boolean;
  productionReady: boolean;
  normalized: SupplierPackagingSpec;
  errors: PackagingSpecIssue[];
  readinessGaps: PackagingSpecIssue[];
  warnings: PackagingSpecIssue[];
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function boundedText(value: unknown, max = 240) {
  const normalized = typeof value === "string" || typeof value === "number"
    ? String(value).trim().replace(/\s+/g, " ")
    : "";
  return normalized ? normalized.slice(0, max) : null;
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  const normalized = boundedText(value, 80)?.toLowerCase();
  return allowed.includes(normalized as T[number]) ? normalized as T[number] : fallback;
}

function finiteNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function positiveInteger(value: unknown, max: number) {
  const parsed = finiteNumber(value, 1, max);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function booleanValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (["true", "1", "yes", "si", "sí"].includes(value.trim().toLowerCase())) return true;
    if (["false", "0", "no"].includes(value.trim().toLowerCase())) return false;
  }
  return fallback;
}

function stringList(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\n]+/) : [];
  return [...new Set(values.map((item) => boundedText(item, 80)).filter((item): item is string => Boolean(item)))].slice(0, 24);
}

function issue(code: string, field: string, message: string): PackagingSpecIssue {
  return { code, field, message };
}

export function normalizeSupplierPackagingSpec(input: unknown): SupplierPackagingSpec {
  const raw = record(input);
  const geometry = record(raw.geometry);
  const roll = record(raw.roll);
  const line = record(raw.line);
  const environment = record(raw.environment);
  const tagTamper = record(raw.tagTamper ?? raw.tag_tamper);
  const qa = record(raw.qa);

  return {
    version: SUPPLIER_PACKAGING_SPEC_VERSION,
    inlayForm: enumValue(raw.inlayForm ?? raw.inlay_form, INLAY_FORMS, "undecided"),
    applicationSurface: enumValue(raw.applicationSurface ?? raw.application_surface, APPLICATION_SURFACES, "other"),
    placement: enumValue(raw.placement, PACKAGING_PLACEMENTS, "custom"),
    applicationMode: enumValue(raw.applicationMode ?? raw.application_mode, APPLICATION_MODES, "undecided"),
    substrateMaterial: boundedText(raw.substrateMaterial ?? raw.substrate_material),
    faceStock: boundedText(raw.faceStock ?? raw.face_stock),
    adhesive: boundedText(raw.adhesive),
    liner: boundedText(raw.liner),
    geometry: {
      labelWidthMm: finiteNumber(geometry.labelWidthMm ?? geometry.label_width_mm, 1, 1000),
      labelHeightMm: finiteNumber(geometry.labelHeightMm ?? geometry.label_height_mm, 1, 1000),
      antennaWidthMm: finiteNumber(geometry.antennaWidthMm ?? geometry.antenna_width_mm, 1, 1000),
      antennaHeightMm: finiteNumber(geometry.antennaHeightMm ?? geometry.antenna_height_mm, 1, 1000),
      pitchMm: finiteNumber(geometry.pitchMm ?? geometry.pitch_mm, 1, 2000),
      webWidthMm: finiteNumber(geometry.webWidthMm ?? geometry.web_width_mm, 1, 2000),
    },
    roll: {
      coreDiameterMm: finiteNumber(roll.coreDiameterMm ?? roll.core_diameter_mm, 5, 500),
      maxOuterDiameterMm: finiteNumber(roll.maxOuterDiameterMm ?? roll.max_outer_diameter_mm, 10, 2000),
      winding: enumValue(roll.winding, WINDING_MODES, "not_applicable"),
      unwindDirection: positiveInteger(roll.unwindDirection ?? roll.unwind_direction, 8),
      quantityPerRoll: positiveInteger(roll.quantityPerRoll ?? roll.quantity_per_roll, 1_000_000),
    },
    line: {
      unitsPerMinute: finiteNumber(line.unitsPerMinute ?? line.units_per_minute, 0.1, 100_000),
      printerEncoderModel: boundedText(line.printerEncoderModel ?? line.printer_encoder_model),
    },
    environment: {
      minTemperatureC: finiteNumber(environment.minTemperatureC ?? environment.min_temperature_c, -100, 250),
      maxTemperatureC: finiteNumber(environment.maxTemperatureC ?? environment.max_temperature_c, -100, 250),
      liquidProximity: booleanValue(environment.liquidProximity ?? environment.liquid_proximity),
      metalProximity: booleanValue(environment.metalProximity ?? environment.metal_proximity),
      outdoorUv: booleanValue(environment.outdoorUv ?? environment.outdoor_uv),
      chemicalExposure: stringList(environment.chemicalExposure ?? environment.chemical_exposure),
    },
    tagTamper: {
      required: booleanValue(tagTamper.required),
      bridgesOpening: tagTamper.bridgesOpening === null || tagTamper.bridges_opening === null
        ? null
        : booleanValue(tagTamper.bridgesOpening ?? tagTamper.bridges_opening),
      tailLengthMm: finiteNumber(tagTamper.tailLengthMm ?? tagTamper.tail_length_mm, 1, 500),
      placementApproved: booleanValue(tagTamper.placementApproved ?? tagTamper.placement_approved),
    },
    qa: {
      rfSampleApproved: booleanValue(qa.rfSampleApproved ?? qa.rf_sample_approved),
      lineTrialApproved: booleanValue(qa.lineTrialApproved ?? qa.line_trial_approved),
      adhesiveApproved: booleanValue(qa.adhesiveApproved ?? qa.adhesive_approved),
      artworkApproved: booleanValue(qa.artworkApproved ?? qa.artwork_approved),
      encodingTrialApproved: booleanValue(qa.encodingTrialApproved ?? qa.encoding_trial_approved),
    },
    notes: boundedText(raw.notes, 2000),
  };
}

export function validateSupplierPackagingSpec(
  input: unknown,
  options: { carrierProfileCode?: string | null; requireProductionApproval?: boolean } = {},
): PackagingSpecValidation {
  const normalized = normalizeSupplierPackagingSpec(input);
  const errors: PackagingSpecIssue[] = [];
  const readinessGaps: PackagingSpecIssue[] = [];
  const warnings: PackagingSpecIssue[] = [];
  const secureTagTamper = String(options.carrierProfileCode || "").toLowerCase() === "ntag424_dna_tt";
  const automatic = normalized.applicationMode === "automatic_labeler";

  if (normalized.inlayForm === "undecided") {
    readinessGaps.push(issue("packaging_construction_undecided", "inlayForm", "Choose the construction before requesting a production supplier pack."));
  }
  if (normalized.applicationMode === "undecided") {
    readinessGaps.push(issue("packaging_application_mode_undecided", "applicationMode", "Record whether application is automatic, manual, converter-led or in-mold."));
  }
  if (!normalized.substrateMaterial) {
    readinessGaps.push(issue("packaging_substrate_required", "substrateMaterial", "Record the real packaging substrate; a product category alone is not an RF or adhesive specification."));
  }
  if (normalized.inlayForm === "dry_inlay" && normalized.applicationMode !== "label_converter" && normalized.applicationMode !== "in_mold") {
    errors.push(issue("dry_inlay_requires_conversion", "inlayForm", "A raw dry inlay has no pressure-sensitive adhesive or finished face stock and must be integrated by a converter or in-mold process."));
  }
  if (normalized.inlayForm === "wet_inlay" && !normalized.adhesive) {
    readinessGaps.push(issue("wet_inlay_adhesive_required", "adhesive", "Specify the adhesive system and confirm compatibility with the actual surface."));
  }
  if (normalized.inlayForm === "converted_smart_label") {
    if (!normalized.faceStock) readinessGaps.push(issue("facestock_required", "faceStock", "Specify the printable face stock for the finished smart label."));
    if (!normalized.adhesive) readinessGaps.push(issue("adhesive_required", "adhesive", "Specify the production adhesive for the finished smart label."));
    if (!normalized.liner) readinessGaps.push(issue("liner_required", "liner", "Specify the release liner compatible with dispensing equipment."));
  }

  for (const [field, value] of Object.entries({
    "geometry.labelWidthMm": normalized.geometry.labelWidthMm,
    "geometry.labelHeightMm": normalized.geometry.labelHeightMm,
    "geometry.antennaWidthMm": normalized.geometry.antennaWidthMm,
    "geometry.antennaHeightMm": normalized.geometry.antennaHeightMm,
  })) {
    if (value === null) readinessGaps.push(issue("packaging_geometry_required", field, "Record finished-label and antenna dimensions in millimetres."));
  }

  if (automatic) {
    for (const [field, value] of Object.entries({
      "geometry.pitchMm": normalized.geometry.pitchMm,
      "geometry.webWidthMm": normalized.geometry.webWidthMm,
      "roll.coreDiameterMm": normalized.roll.coreDiameterMm,
      "roll.maxOuterDiameterMm": normalized.roll.maxOuterDiameterMm,
      "roll.quantityPerRoll": normalized.roll.quantityPerRoll,
      "line.unitsPerMinute": normalized.line.unitsPerMinute,
    })) {
      if (value === null) readinessGaps.push(issue("automatic_line_spec_required", field, "Automatic application requires a numeric roll/line specification."));
    }
    if (!normalized.roll.unwindDirection) readinessGaps.push(issue("unwind_direction_required", "roll.unwindDirection", "Record unwind direction 1-8 for the selected applicator."));
    if (!['face_out', 'face_in'].includes(normalized.roll.winding)) readinessGaps.push(issue("winding_required", "roll.winding", "Record face-in or face-out winding for roll application."));
  }

  const nearRfDetuningMaterial = normalized.applicationSurface === "metal"
    || normalized.environment.metalProximity
    || normalized.environment.liquidProximity;
  if (nearRfDetuningMaterial && !normalized.qa.rfSampleApproved) {
    readinessGaps.push(issue("rf_sample_required", "qa.rfSampleApproved", "Metal and liquid proximity can detune NFC; approve an RF sample on the real filled package and placement."));
  }
  if (normalized.applicationSurface === "metal" && normalized.inlayForm !== "hard_tag") {
    warnings.push(issue("on_metal_construction_review", "applicationSurface", "Standard label inlays are not automatically suitable on metal; require an on-metal construction and measured read-range approval."));
  }
  if (normalized.environment.chemicalExposure.length && !normalized.qa.adhesiveApproved) {
    readinessGaps.push(issue("chemical_adhesive_test_required", "qa.adhesiveApproved", "Approve face stock, adhesive and print durability against the declared chemicals."));
  }
  if (
    normalized.environment.minTemperatureC !== null
    && normalized.environment.maxTemperatureC !== null
    && normalized.environment.minTemperatureC > normalized.environment.maxTemperatureC
  ) {
    errors.push(issue("temperature_range_invalid", "environment", "Minimum temperature cannot exceed maximum temperature."));
  }

  if (secureTagTamper || normalized.tagTamper.required) {
    if (normalized.tagTamper.bridgesOpening !== true) {
      readinessGaps.push(issue("tagtamper_must_bridge_opening", "tagTamper.bridgesOpening", "The TT conductive tail must bridge the actual opening path; placement on a static body cannot evidence opening."));
    }
    if (normalized.tagTamper.tailLengthMm === null) {
      readinessGaps.push(issue("tagtamper_tail_geometry_required", "tagTamper.tailLengthMm", "Record tail length and die-cut geometry for the closure."));
    }
    if (!normalized.tagTamper.placementApproved) {
      readinessGaps.push(issue("tagtamper_placement_trial_required", "tagTamper.placementApproved", "Approve closed/open TT behavior on a physical packaging sample."));
    }
  }

  const approvals: Array<[keyof SupplierPackagingSpec["qa"], string]> = [
    ["rfSampleApproved", "RF sample"],
    ["lineTrialApproved", "packaging-line trial"],
    ["adhesiveApproved", "adhesive compatibility"],
    ["artworkApproved", "artwork/die-line"],
    ["encodingTrialApproved", "encoding and read-back trial"],
  ];
  for (const [field, label] of approvals) {
    if (!normalized.qa[field]) readinessGaps.push(issue("production_approval_required", `qa.${field}`, `Approve ${label} before factory release.`));
  }

  if (options.requireProductionApproval && readinessGaps.length) {
    errors.push(issue("packaging_spec_not_production_ready", "packagingSpec", "The packaging specification still has unresolved production gates."));
  }

  return {
    ok: errors.length === 0,
    productionReady: errors.length === 0 && readinessGaps.length === 0,
    normalized,
    errors,
    readinessGaps,
    warnings,
  };
}

export function recommendIndustrialConstruction(input: {
  existingPressureSensitiveLabelLine?: boolean;
  converterWillIntegrate?: boolean;
  directManualApplication?: boolean;
  tagTamperRequired?: boolean;
}) {
  if (input.existingPressureSensitiveLabelLine) {
    return {
      inlayForm: "converted_smart_label" as const,
      rationale: "Deliver a finished, encoded smart label on a qualified roll so the existing applicator receives a normal production consumable.",
    };
  }
  if (input.converterWillIntegrate) {
    return {
      inlayForm: "dry_inlay" as const,
      rationale: "Use the inlay as a converter component, not as the customer's finished consumable; the converter owns adhesive, face stock, liner and die-cut integration.",
    };
  }
  if (input.directManualApplication && !input.tagTamperRequired) {
    return {
      inlayForm: "wet_inlay" as const,
      rationale: "A wet inlay can support controlled manual pilots, but adhesive, protection, placement and RF behavior still require physical approval.",
    };
  }
  return {
    inlayForm: "converted_smart_label" as const,
    rationale: "Default to a finished converted construction until the packaging converter and line owner approve a different integration.",
  };
}
