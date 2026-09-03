import { requireDashboardDestination } from "../../../lib/dashboard-destination-guard";

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardDestination("analytics");
  return children;
}
