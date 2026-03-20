import { redirect } from "next/navigation";
import { buildDashboardDemoUrl } from "../../../lib/dashboard-demo-url";

export default async function DemoLabEncodeRedirectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(buildDashboardDemoUrl("/demo-lab/encode", await searchParams));
}
