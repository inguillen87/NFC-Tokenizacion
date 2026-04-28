import { clamp, computeRiskScore as computeRiskScoreBreakdown, type RiskScoreBreakdown, type RiskScoreInput } from "@product/core";

export type RiskInputs = RiskScoreInput;
export type { RiskScoreBreakdown };
export { clamp };

export function computeRiskScore(input: RiskInputs) {
  return computeRiskScoreBreakdown(input).score;
}
