import { requireDashboardDestination } from "../../../lib/dashboard-destination-guard";

export default async function SalesPlaybookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDashboardDestination("salesPlaybook");
  return children;
}
