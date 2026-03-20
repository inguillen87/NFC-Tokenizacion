import { redirect } from "next/navigation";
import { buildDashboardDemoUrl } from "../../lib/dashboard-demo-url";

export default async function DemoSandboxRedirectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(buildDashboardDemoUrl("/demo-sandbox", await searchParams));
}
