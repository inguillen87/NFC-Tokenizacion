export type CampaignMeasurement = "confirmed" | "demo_model" | "draft_unmeasured";

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function describeTriviaSummary(summary: {
  attempts?: unknown;
  avgScorePct?: unknown;
  topCity?: unknown;
  topProduct?: unknown;
}) {
  const attempts = Math.max(0, finiteNumber(summary.attempts));
  const hasMeasurements = attempts > 0;
  const topCity = String(summary.topCity || "").trim();
  const topProduct = String(summary.topProduct || "").trim();

  return {
    attempts,
    hasMeasurements,
    avgScoreLabel: hasMeasurements ? `${finiteNumber(summary.avgScorePct)}%` : "Sin base",
    avgScoreHint: hasMeasurements ? "intentos confirmados" : "no equivale a 0%",
    topCityLabel: hasMeasurements && topCity ? topCity : "Sin base",
    topCityHint: hasMeasurements ? topProduct || "producto no informado" : "requiere intentos confirmados",
  };
}

export function describeQuestionRate(attempts: unknown, correctRatePct: unknown) {
  return finiteNumber(attempts) > 0 ? `${finiteNumber(correctRatePct)}%` : "Sin base";
}

export function describeCampaignMeasurement(measurement: CampaignMeasurement, conversion: string) {
  if (measurement === "confirmed") {
    return { badge: "Medicion confirmada", conversion, conversionLabel: "Conversion medida" };
  }
  if (measurement === "demo_model") {
    return { badge: "Demo modelado", conversion, conversionLabel: "Conversion demo modelada" };
  }
  return { badge: "Sin medicion", conversion: "Sin base", conversionLabel: "Conversion no medida" };
}
