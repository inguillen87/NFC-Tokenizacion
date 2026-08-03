export const QUOTE_VERTICALS = [
  "wine",
  "agro",
  "chemicals",
  "pharma",
  "logistics",
  "hospitality",
  "circular",
] as const;

export const QUOTE_CARRIERS = [
  "qr-gs1",
  "ntag-basic",
  "ntag424",
  "ntag424tt",
  "uhf",
  "iot",
] as const;

export const QUOTE_SECURITY_LEVELS = ["standard", "sun", "tamper", "regulated"] as const;
export const QUOTE_PACKAGING = [
  "digital-only",
  "blank-inlay",
  "printed-roll",
  "converted-label",
  "tamper-seal",
  "industrial-line",
] as const;
export const QUOTE_INTEGRATIONS = ["guided", "api-webhooks", "erp-crm", "managed"] as const;
export const QUOTE_OFFLINE_LEVELS = ["online", "capture-sync", "public-certificate", "field-bundle"] as const;
export const QUOTE_PROOF_LAYERS = ["none", "iota", "polygon", "both"] as const;
export const QUOTE_MODULES = [
  "core",
  "secure",
  "seal",
  "ownership",
  "proof",
  "industrial",
  "events",
  "hospitality",
  "agro",
] as const;

export type QuoteVertical = (typeof QUOTE_VERTICALS)[number];
export type QuoteCarrier = (typeof QUOTE_CARRIERS)[number];
export type QuoteSecurityLevel = (typeof QUOTE_SECURITY_LEVELS)[number];
export type QuotePackaging = (typeof QUOTE_PACKAGING)[number];
export type QuoteIntegration = (typeof QUOTE_INTEGRATIONS)[number];
export type QuoteOfflineLevel = (typeof QUOTE_OFFLINE_LEVELS)[number];
export type QuoteProofLayer = (typeof QUOTE_PROOF_LAYERS)[number];
export type QuoteModule = (typeof QUOTE_MODULES)[number];

export type QuoteConfiguratorInput = {
  vertical: QuoteVertical;
  quantity: number;
  carrier: QuoteCarrier;
  security: QuoteSecurityLevel;
  packaging: QuotePackaging;
  modules: QuoteModule[];
  integration: QuoteIntegration;
  offline: QuoteOfflineLevel;
  proof: QuoteProofLayer;
};

export type BudgetRange = {
  min: number;
  max: number;
};

export type QuoteWarning =
  | "estimate-only"
  | "carrier-upgraded"
  | "hybrid-carrier"
  | "tamper-packaging-validation"
  | "offline-not-live-sun"
  | "iota-event-driven"
  | "polygon-event-driven"
  | "network-fees-excluded"
  | "iot-discovery";

export type QuoteRecommendation = {
  packageName: string;
  effectiveCarriers: QuoteCarrier[];
  modules: QuoteModule[];
  hardware: BudgetRange;
  setup: BudgetRange;
  monthlySaas: BudgetRange;
  pilot: {
    minUnits: number;
    maxUnits: number;
    weeks: number;
  };
  warnings: QuoteWarning[];
};

type CarrierBudget = {
  unit: BudgetRange;
  setup: BudgetRange;
  pilot: BudgetRange;
};

const CARRIER_BUDGETS: Record<QuoteCarrier, CarrierBudget> = {
  "qr-gs1": { unit: { min: 0.03, max: 0.18 }, setup: { min: 0, max: 1_500 }, pilot: { min: 2_500, max: 10_000 } },
  "ntag-basic": { unit: { min: 0.18, max: 0.65 }, setup: { min: 500, max: 2_500 }, pilot: { min: 1_000, max: 5_000 } },
  ntag424: { unit: { min: 0.65, max: 1.45 }, setup: { min: 2_500, max: 7_500 }, pilot: { min: 500, max: 5_000 } },
  ntag424tt: { unit: { min: 0.9, max: 2.2 }, setup: { min: 4_000, max: 11_000 }, pilot: { min: 500, max: 2_500 } },
  uhf: { unit: { min: 0.12, max: 0.9 }, setup: { min: 4_000, max: 14_000 }, pilot: { min: 500, max: 2_500 } },
  iot: { unit: { min: 15, max: 180 }, setup: { min: 12_000, max: 48_000 }, pilot: { min: 25, max: 100 } },
};

const PACKAGING_BUDGETS: Record<QuotePackaging, { unit: BudgetRange; setup: BudgetRange }> = {
  "digital-only": { unit: { min: 0, max: 0 }, setup: { min: 0, max: 0 } },
  "blank-inlay": { unit: { min: 0.01, max: 0.05 }, setup: { min: 0, max: 1_000 } },
  "printed-roll": { unit: { min: 0.05, max: 0.22 }, setup: { min: 750, max: 3_000 } },
  "converted-label": { unit: { min: 0.12, max: 0.45 }, setup: { min: 1_500, max: 6_000 } },
  "tamper-seal": { unit: { min: 0.2, max: 0.85 }, setup: { min: 3_000, max: 12_000 } },
  "industrial-line": { unit: { min: 0.1, max: 0.55 }, setup: { min: 5_000, max: 22_000 } },
};

const INTEGRATION_BUDGETS: Record<QuoteIntegration, BudgetRange> = {
  guided: { min: 0, max: 1_500 },
  "api-webhooks": { min: 2_500, max: 8_000 },
  "erp-crm": { min: 7_500, max: 25_000 },
  managed: { min: 18_000, max: 60_000 },
};

const OFFLINE_BUDGETS: Record<QuoteOfflineLevel, BudgetRange> = {
  online: { min: 0, max: 0 },
  "capture-sync": { min: 1_500, max: 5_000 },
  "public-certificate": { min: 3_500, max: 10_000 },
  "field-bundle": { min: 8_000, max: 25_000 },
};

const PROOF_BUDGETS: Record<QuoteProofLayer, BudgetRange> = {
  none: { min: 0, max: 0 },
  iota: { min: 2_500, max: 8_000 },
  polygon: { min: 4_000, max: 14_000 },
  both: { min: 7_000, max: 20_000 },
};

const VERTICAL_SETUP: Record<QuoteVertical, BudgetRange> = {
  wine: { min: 1_000, max: 4_000 },
  agro: { min: 2_500, max: 8_000 },
  chemicals: { min: 3_500, max: 11_000 },
  pharma: { min: 4_000, max: 14_000 },
  logistics: { min: 3_000, max: 10_000 },
  hospitality: { min: 500, max: 3_000 },
  circular: { min: 1_500, max: 6_000 },
};

const MODULE_LABELS: Record<QuoteModule, string> = {
  core: "nexID Core",
  secure: "nexID Secure",
  seal: "nexID Seal",
  ownership: "nexID Ownership",
  proof: "nexID Proof Layer",
  industrial: "nexID Industrial Trace",
  events: "nexID Events",
  hospitality: "nexID Hospitality",
  agro: "nexID Agro",
};

export const DEFAULT_QUOTE_INPUT: QuoteConfiguratorInput = {
  vertical: "agro",
  quantity: 10_000,
  carrier: "ntag424",
  security: "sun",
  packaging: "converted-label",
  modules: ["core"],
  integration: "api-webhooks",
  offline: "capture-sync",
  proof: "none",
};

function clampQuantity(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_QUOTE_INPUT.quantity;
  return Math.min(5_000_000, Math.max(100, Math.round(value)));
}

function roundBudget(value: number, increment: number) {
  return Math.max(increment, Math.round(value / increment) * increment);
}

function addRange(...ranges: BudgetRange[]): BudgetRange {
  return ranges.reduce(
    (total, range) => ({ min: total.min + range.min, max: total.max + range.max }),
    { min: 0, max: 0 },
  );
}

function quantityFactors(quantity: number): BudgetRange {
  if (quantity >= 500_000) return { min: 0.62, max: 0.76 };
  if (quantity >= 100_000) return { min: 0.72, max: 0.82 };
  if (quantity >= 50_000) return { min: 0.78, max: 0.88 };
  if (quantity >= 10_000) return { min: 0.88, max: 0.94 };
  return { min: 1, max: 1 };
}

function effectiveCarriers(input: QuoteConfiguratorInput): QuoteCarrier[] {
  const needsTamper = input.security === "tamper";
  const needsSecureNfc = input.security === "sun" || input.security === "regulated";
  const isIndustrial = input.carrier === "uhf" || input.carrier === "iot";

  if (needsTamper) return isIndustrial ? [input.carrier, "ntag424tt"] : ["ntag424tt"];
  if (needsSecureNfc) {
    if (isIndustrial) return [input.carrier, "ntag424"];
    if (input.carrier === "qr-gs1" || input.carrier === "ntag-basic") return ["ntag424"];
  }
  return [input.carrier];
}

function recommendedModules(input: QuoteConfiguratorInput, carriers: QuoteCarrier[]): QuoteModule[] {
  const modules = new Set<QuoteModule>(["core", ...input.modules]);
  if (carriers.includes("ntag424") || carriers.includes("ntag424tt")) modules.add("secure");
  if (carriers.includes("ntag424tt")) modules.add("seal");
  if (carriers.includes("uhf") || carriers.includes("iot") || input.vertical === "logistics") modules.add("industrial");
  if (input.vertical === "agro") modules.add("agro");
  if (input.vertical === "hospitality") modules.add("hospitality");
  if (input.proof === "iota" || input.proof === "both") modules.add("proof");
  if (input.proof === "polygon" || input.proof === "both") modules.add("ownership");
  return QUOTE_MODULES.filter((module) => modules.has(module));
}

function packageName(modules: QuoteModule[], carriers: QuoteCarrier[]) {
  const primary = carriers.includes("iot") || carriers.includes("uhf")
    ? "industrial"
    : modules.includes("seal")
      ? "seal"
      : modules.includes("secure")
        ? "secure"
        : "core";
  const vertical = modules.includes("agro") ? "agro" : modules.includes("hospitality") ? "hospitality" : null;
  return vertical
    ? `${MODULE_LABELS[vertical]} + ${MODULE_LABELS[primary].replace("nexID ", "")}`
    : MODULE_LABELS[primary];
}

function warningSet(input: QuoteConfiguratorInput, carriers: QuoteCarrier[]): QuoteWarning[] {
  const warnings = new Set<QuoteWarning>(["estimate-only"]);
  if (carriers.length > 1) warnings.add("hybrid-carrier");
  else if (carriers[0] !== input.carrier) warnings.add("carrier-upgraded");
  if (carriers.includes("ntag424tt")) warnings.add("tamper-packaging-validation");
  if (input.offline !== "online") warnings.add("offline-not-live-sun");
  if (input.proof === "iota" || input.proof === "both") warnings.add("iota-event-driven");
  if (input.proof === "polygon" || input.proof === "both") warnings.add("polygon-event-driven");
  if (input.proof !== "none") warnings.add("network-fees-excluded");
  if (carriers.includes("iot")) warnings.add("iot-discovery");
  return [...warnings];
}

export function normalizeQuoteQuantity(value: number) {
  return clampQuantity(value);
}

export function buildQuoteRecommendation(rawInput: QuoteConfiguratorInput): QuoteRecommendation {
  const input = { ...rawInput, quantity: clampQuantity(rawInput.quantity) };
  const carriers = effectiveCarriers(input);
  const modules = recommendedModules(input, carriers);
  const factors = quantityFactors(input.quantity);
  const carrierUnit = carriers.reduce(
    (total, carrier) => ({
      min: total.min + CARRIER_BUDGETS[carrier].unit.min,
      max: total.max + CARRIER_BUDGETS[carrier].unit.max,
    }),
    { min: 0, max: 0 },
  );
  const packaging = PACKAGING_BUDGETS[input.packaging];
  const hardware = {
    min: roundBudget(input.quantity * (carrierUnit.min + packaging.unit.min) * factors.min, 100),
    max: roundBudget(input.quantity * (carrierUnit.max + packaging.unit.max) * factors.max, 100),
  };

  const carrierSetup = carriers.reduce(
    (total, carrier) => addRange(total, CARRIER_BUDGETS[carrier].setup),
    { min: 0, max: 0 },
  );
  const regulatedSetup = input.security === "regulated" ? { min: 4_000, max: 14_000 } : { min: 0, max: 0 };
  const optionalModuleCount = Math.max(0, modules.length - 1);
  const moduleSetup = { min: optionalModuleCount * 750, max: optionalModuleCount * 2_500 };
  const setupRaw = addRange(
    { min: 2_500, max: 6_000 },
    carrierSetup,
    packaging.setup,
    INTEGRATION_BUDGETS[input.integration],
    OFFLINE_BUDGETS[input.offline],
    PROOF_BUDGETS[input.proof],
    VERTICAL_SETUP[input.vertical],
    regulatedSetup,
    moduleSetup,
  );
  const setup = {
    min: roundBudget(setupRaw.min, 500),
    max: roundBudget(setupRaw.max, 500),
  };

  const volumeMonthly = input.quantity >= 500_000
    ? { min: 2_500, max: 6_000 }
    : input.quantity >= 100_000
      ? { min: 1_200, max: 3_500 }
      : input.quantity >= 25_000
        ? { min: 600, max: 2_000 }
        : input.quantity >= 5_000
          ? { min: 300, max: 1_100 }
          : { min: 250, max: 750 };
  const integrationMonthly = input.integration === "managed"
    ? { min: 900, max: 3_000 }
    : input.integration === "erp-crm"
      ? { min: 350, max: 1_200 }
      : input.integration === "api-webhooks"
        ? { min: 100, max: 500 }
        : { min: 0, max: 0 };
  const offlineMonthly = input.offline === "field-bundle"
    ? { min: 350, max: 1_400 }
    : input.offline === "public-certificate"
      ? { min: 150, max: 650 }
      : input.offline === "capture-sync"
        ? { min: 75, max: 350 }
        : { min: 0, max: 0 };
  const proofMonthly = input.proof === "both"
    ? { min: 250, max: 1_100 }
    : input.proof === "none"
      ? { min: 0, max: 0 }
      : { min: 100, max: 600 };
  const moduleMonthly = { min: optionalModuleCount * 40, max: optionalModuleCount * 160 };
  const monthlyRaw = addRange(volumeMonthly, integrationMonthly, offlineMonthly, proofMonthly, moduleMonthly);
  const monthlySaas = {
    min: roundBudget(monthlyRaw.min, 50),
    max: roundBudget(monthlyRaw.max, 50),
  };

  const pilotCarrier = carriers.includes("iot")
    ? "iot"
    : carriers.includes("uhf")
      ? "uhf"
      : carriers.includes("ntag424tt")
        ? "ntag424tt"
        : carriers.includes("ntag424")
          ? "ntag424"
          : carriers[0];
  const pilotBudget = CARRIER_BUDGETS[pilotCarrier].pilot;
  const pilotMin = Math.min(input.quantity, pilotBudget.min);
  const pilotMax = Math.min(input.quantity, Math.max(pilotMin, pilotBudget.max));
  const complexityWeeks = input.integration === "managed" || carriers.includes("iot")
    ? 12
    : input.integration === "erp-crm" || input.offline === "field-bundle" || input.proof === "both"
      ? 10
      : carriers.includes("ntag424tt") || input.proof !== "none"
        ? 8
        : 6;

  return {
    packageName: packageName(modules, carriers),
    effectiveCarriers: carriers,
    modules,
    hardware,
    setup,
    monthlySaas,
    pilot: { minUnits: pilotMin, maxUnits: pilotMax, weeks: complexityWeeks },
    warnings: warningSet(input, carriers),
  };
}
