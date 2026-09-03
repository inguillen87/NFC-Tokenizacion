import { requireDashboardDestination } from "../../../../lib/dashboard-destination-guard";

export default async function DemoEncoderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDashboardDestination("demoEncoder");
  return children;
}
