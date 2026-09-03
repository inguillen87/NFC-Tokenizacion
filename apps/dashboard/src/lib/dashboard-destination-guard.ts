import "server-only";

import { notFound } from "next/navigation";
import {
  dashboardCanOpenDestination,
  type DashboardDestinationKey,
} from "./dashboard-destination-policy";
import {
  requireDashboardSession,
  type DashboardSession,
} from "./session";

export function dashboardSessionCanOpenDestination(
  session: DashboardSession,
  destination: DashboardDestinationKey,
) {
  return dashboardCanOpenDestination(destination, {
    role: session.role,
    permissions: session.permissions,
    deniedPermissions: session.deniedPermissions,
    isDemo: session.isDemo,
  });
}

export function assertDashboardDestination(
  session: DashboardSession,
  destination: DashboardDestinationKey,
) {
  if (!dashboardSessionCanOpenDestination(session, destination)) notFound();
  return session;
}

export async function requireDashboardDestination(
  destination: DashboardDestinationKey,
) {
  const session = await requireDashboardSession();
  return assertDashboardDestination(session, destination);
}
