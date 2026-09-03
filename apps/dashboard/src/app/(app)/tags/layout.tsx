import { requireDashboardDestination } from "../../../lib/dashboard-destination-guard";

export default async function TagsLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardDestination("tags");
  return children;
}
