import { Card, SectionHeading } from "@product/ui";
import { getDashboardI18n } from "../../../lib/locale";

export default async function EventsPage() {
  const { t } = await getDashboardI18n();

  return (
    <main>
      <SectionHeading
        eyebrow={t.dashboard.events}
        title={t.dashboard.eventsTitle}
        description={t.dashboard.eventsDescription}
      />
      <Card className="mt-8 p-6">
        <p className="text-sm text-slate-300">Real-time event stream with duplicate, replay and tamper scoring.</p>
      </Card>
    </main>
  );
}
