import { requireDashboardDestination } from "../../../../lib/dashboard-destination-guard";

export default async function ConsumerOverviewLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardDestination("consumerOverview");
  return children;
}
