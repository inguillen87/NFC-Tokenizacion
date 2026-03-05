import { SectionHeading } from "@product/ui";
import { AnalyticsPanels } from "../../../components/analytics-panels";

export default function AnalyticsPage() {
  return (
    <main>
      <SectionHeading eyebrow="Analytics" title="Scans, duplicates, tamper and geo" description="Monitoring UX for security teams and operations leadership." />
      <div className="mt-8"><AnalyticsPanels /></div>
    </main>
  );
}
