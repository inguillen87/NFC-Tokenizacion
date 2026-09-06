import {
  dashboardCanOpenDestination,
  type DashboardDestinationAccess,
  type DashboardDestinationKey,
} from "./dashboard-destination-policy";

export const OPS_DESTINATION_KEYS = [
  "overview", "batches", "supplierBatches", "tags", "events", "tokenization",
  "rewards", "sdkVision", "apiKeys", "campaigns",
] as const satisfies readonly DashboardDestinationKey[];

export type OpsDestinationKey = (typeof OPS_DESTINATION_KEYS)[number];
export type OpsDestinationAccess = Readonly<Partial<Record<OpsDestinationKey, boolean>>>;

// Presentation only: the server passes the same validated session used by the
// sidebar and destination guards. This map never grants route or API access.
export function resolveOpsDestinationAccess(access: DashboardDestinationAccess): OpsDestinationAccess {
  return Object.fromEntries(OPS_DESTINATION_KEYS.map((destination) => [
    destination,
    dashboardCanOpenDestination(destination, access),
  ]));
}
