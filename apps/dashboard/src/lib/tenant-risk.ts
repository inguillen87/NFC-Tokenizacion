import { aggregateTenantMetrics, clamp } from "@product/core";

function finiteCount(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function resolveCanonicalTenantRisk(row: Record<string, unknown>) {
  const supplied = Number(row.risk_score ?? row.riskScore);
  if (Number.isFinite(supplied)) return Number(clamp(supplied).toFixed(1));

  const scans = finiteCount(row.scans);
  const valid = finiteCount(row.valid);
  // Lifecycle and unclassified events are intentionally not inferred as fraud.
  // Older payloads without an explicit invalid count therefore contribute zero
  // invalid events instead of using the misleading `scans - valid` shortcut.
  const invalid = finiteCount(row.invalid);
  return aggregateTenantMetrics({
    counts: {
      scans,
      valid,
      invalid,
      duplicates: finiteCount(row.duplicates),
      tamper: finiteCount(row.tamper),
      revoked: finiteCount(row.revoked),
    },
  }).riskScore;
}
