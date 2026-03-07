import { SectionHeading } from "@product/ui";
import { AnalyticsPanels } from "../../../components/analytics-panels";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function getAnalytics() {
  try {
    const response = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default async function AnalyticsPage() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const analyticsData = await getAnalytics();

  return (
    <main>
      <SectionHeading eyebrow={copy.nav.analytics} title={copy.pages.analytics.title} description={copy.pages.analytics.description} />
      <div className="mt-8">
        <AnalyticsPanels kpis={t.dashboard.kpis} extra={copy.analytics} data={analyticsData || undefined} />
      </div>
    </main>
  );
}
