import { requireDashboardDestination } from "../../../lib/dashboard-destination-guard";

export default async function ServiceLevelsLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardDestination("serviceLevels");
  return children;
}
