export type PricingScenarioInputs = {
  annualUnits: number;
  tagUnitCost: number;
  platformBudget: number;
  incidentRate: number;
  incidentCost: number;
  addressableRate: number;
  traceEventsPerUnit: number;
  iotaAnchorEvery: number;
  polygonActionRate: number;
};

export type PricingScenarioModel = {
  addressableValue: number;
  annualAnchors: number;
  annualIotaAnchors: number;
  annualPolygonActions: number;
  annualTraceEvents: number;
  costPerUnit: number;
  netModeledValue: number;
  offChainEvents: number;
  paybackMonths: number | null;
  roi: number;
  totalFirstYearInvestment: number;
};

const INTEGER_INPUTS = new Set<keyof PricingScenarioInputs>(["annualUnits", "iotaAnchorEvery"]);

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizePricingInput(
  key: keyof PricingScenarioInputs,
  value: number,
  min: number,
  max: number,
) {
  const bounded = clamp(value, min, max);
  return INTEGER_INPUTS.has(key) ? Math.round(bounded) : bounded;
}

export function parsePricingDraftInput(
  key: keyof PricingScenarioInputs,
  rawValue: string,
  min: number,
  max: number,
): number | null {
  if (rawValue.trim() === "") return null;
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) return null;
  return normalizePricingInput(key, parsedValue, min, max);
}

export function modelPricingScenario(inputs: PricingScenarioInputs): PricingScenarioModel {
  const annualUnits = Math.max(0, Math.round(Number(inputs.annualUnits) || 0));
  const iotaAnchorEvery = Math.max(0, Math.round(Number(inputs.iotaAnchorEvery) || 0));
  const encodedCarrierCost = annualUnits * inputs.tagUnitCost;
  const totalFirstYearInvestment = encodedCarrierCost + inputs.platformBudget;
  const annualExposure = annualUnits * (inputs.incidentRate / 100) * inputs.incidentCost;
  const addressableValue = annualExposure * (inputs.addressableRate / 100);
  const netModeledValue = addressableValue - totalFirstYearInvestment;
  const roi = totalFirstYearInvestment > 0 ? (netModeledValue / totalFirstYearInvestment) * 100 : 0;
  const paybackMonths = netModeledValue >= 0 && addressableValue > 0
    ? totalFirstYearInvestment / (addressableValue / 12)
    : null;
  const annualTraceEvents = Math.ceil(annualUnits * inputs.traceEventsPerUnit);
  const annualIotaAnchors = annualTraceEvents > 0 && iotaAnchorEvery > 0
    ? Math.ceil(annualTraceEvents / iotaAnchorEvery)
    : 0;
  const annualPolygonActions = inputs.polygonActionRate > 0
    ? Math.ceil(annualUnits * (inputs.polygonActionRate / 100))
    : 0;
  const annualAnchors = annualIotaAnchors + annualPolygonActions;
  const offChainEvents = iotaAnchorEvery === 1 ? 0 : annualTraceEvents;
  const costPerUnit = annualUnits > 0 ? totalFirstYearInvestment / annualUnits : 0;

  return {
    addressableValue,
    annualAnchors,
    annualIotaAnchors,
    annualPolygonActions,
    annualTraceEvents,
    costPerUnit,
    netModeledValue,
    offChainEvents,
    paybackMonths,
    roi,
    totalFirstYearInvestment,
  };
}
