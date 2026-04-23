export type RiskInputs = {
  replayRate: number;
  invalidRate: number;
  tamperRate: number;
  revokedTapRate: number;
  geoAnomalyRate: number;
};

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

// Deterministic risk formula shared across overview/table modules.
export function computeRiskScore(input: RiskInputs) {
  return clamp(
    input.replayRate * 45 +
    input.invalidRate * 25 +
    input.tamperRate * 50 +
    input.revokedTapRate * 35 +
    input.geoAnomalyRate * 20
  );
}
