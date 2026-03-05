import { SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../../components/admin-action-forms";
import { getDashboardI18n } from "../../../lib/locale";

export default async function BatchesPage() {
  const { t } = await getDashboardI18n();

  return (
    <main>
      <SectionHeading
        eyebrow={t.dashboard.batches}
        title={t.dashboard.batchLifecycleTitle}
        description={t.dashboard.batchLifecycleDescription}
      />
      <div className="mt-8">
        <AdminActionForms copy={t.dashboard.forms} />
      </div>
    </main>
  );
}
