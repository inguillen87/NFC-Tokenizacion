import { requireDashboardDestination } from "../../../lib/dashboard-destination-guard";

export default async function InvestorSnapshotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDashboardDestination("investorSnapshot");
  return children;
}
