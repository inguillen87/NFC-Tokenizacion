export type WalletBrandPoints = {
  slug: string | null;
  name: string | null;
  balance: number | null;
  lifetime: number | null;
};

export type WalletBrandPointsSource =
  | { status: "ready"; data: WalletBrandPoints[] }
  | { status: "unavailable"; data: null };

export type WalletNetworkPointsSource =
  | { status: "ready"; balance: number | null; lifetime: number | null }
  | { status: "disabled" }
  | { status: "unavailable" };

export type ConsumerWalletPointsModel = {
  brands: WalletBrandPointsSource;
  network: WalletNetworkPointsSource;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function reportedWalletPoints(value: unknown): number | null {
  const candidate = typeof value === "number" ? value
    : typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value) ? Number(value) : null;
  return candidate !== null && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null;
}

export function buildConsumerWalletPointsModel(payload: unknown): ConsumerWalletPointsModel {
  const envelope = record(payload);
  if (envelope?.ok !== true) {
    return { brands: { status: "unavailable", data: null }, network: { status: "unavailable" } };
  }

  const brandRows = Array.isArray(envelope.tenantWallets) ? envelope.tenantWallets.map(record) : null;
  const brands: WalletBrandPointsSource = brandRows && brandRows.every((row) => row !== null)
    ? {
      status: "ready",
      data: brandRows.map((row) => ({
        slug: text(row!.slug), name: text(row!.name),
        balance: reportedWalletPoints(row!.points_balance), lifetime: reportedWalletPoints(row!.lifetime_points),
      })),
    }
    : { status: "unavailable", data: null };

  const network = record(envelope.networkWallet);
  if (!network) return { brands, network: { status: "unavailable" } };
  // The API's no-account fallback includes zero values with enabled:false.
  // Those zeroes are not a confirmed balance, and brand points are not a
  // replacement for this separate network-scoped account.
  if (network.enabled === false) return { brands, network: { status: "disabled" } };
  if ((network.enabled !== undefined && network.enabled !== true)
    || (!Object.hasOwn(network, "points_balance") && !Object.hasOwn(network, "lifetime_points") && network.enabled !== true)) {
    return { brands, network: { status: "unavailable" } };
  }
  // Existing account rows omit enabled; accept their explicitly reported
  // amounts without promoting them into a promise of redemption eligibility.
  return {
    brands,
    network: {
      status: "ready",
      balance: reportedWalletPoints(network.points_balance), lifetime: reportedWalletPoints(network.lifetime_points),
    },
  };
}
