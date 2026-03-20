import { redirect } from "next/navigation";
import { buildDashboardDemoUrl } from "../../lib/dashboard-demo-url";

export default async function InvestorSnapshotRedirectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(buildDashboardDemoUrl("/investor-snapshot", await searchParams));
}
