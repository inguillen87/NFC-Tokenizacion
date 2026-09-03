import { requireDashboardDestination } from "../../../../lib/dashboard-destination-guard";

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardDestination("marketplace");
  return children;
}
