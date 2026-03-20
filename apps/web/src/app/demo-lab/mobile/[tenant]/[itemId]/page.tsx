import { redirect } from "next/navigation";
import { buildDashboardDemoUrl } from "../../../../../lib/dashboard-demo-url";

export default async function DemoLabMobileRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, itemId } = await params;
  redirect(buildDashboardDemoUrl(`/demo-lab/mobile/${tenant}/${itemId}`, await searchParams));
}
