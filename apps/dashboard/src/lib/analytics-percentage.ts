type CountBucket = {
  label: string;
  count: number;
};

function clampPercentagePoints(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function reportedShareToPercentagePoints(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return clampPercentagePoints(parsed <= 1 ? parsed * 100 : parsed);
}

export function resolveMobileSharePercent(
  deviceTypes: CountBucket[],
  reportedShare: unknown,
) {
  const buckets = deviceTypes.map((item) => ({
    label: String(item.label || "").trim().toLowerCase(),
    count: Number.isFinite(Number(item.count)) ? Math.max(0, Number(item.count)) : 0,
  }));
  const total = buckets.reduce((sum, item) => sum + item.count, 0);

  if (total > 0) {
    const mobile = buckets
      .filter((item) => item.label === "mobile")
      .reduce((sum, item) => sum + item.count, 0);
    return clampPercentagePoints((mobile / total) * 100);
  }

  // Compatibility boundary: the production API historically returned 0..1,
  // while an isolated demo fixture returned 0..100 percentage points.
  return reportedShareToPercentagePoints(reportedShare);
}

export function formatAnalyticsPercentage(value: number) {
  return `${clampPercentagePoints(value).toFixed(1)}%`;
}
