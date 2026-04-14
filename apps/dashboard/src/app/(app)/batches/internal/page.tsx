import { Card, SectionHeading } from "@product/ui";
import { AdminActionForms } from "../../../../components/admin-action-forms";
import { dashboardContent } from "../../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../../lib/locale";

export default async function InternalBatchPage() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow="Internal batches" title="Create internal batch" description="Flujo para lotes nacidos dentro de nexID. Puede usar keys autogeneradas según política." />
      <Card className="p-5 text-sm text-slate-300">
        <p className="font-semibold text-white">Cuándo usar este modo</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Cuando el lote no viene preprogramado por proveedor.</li>
          <li>Cuando querés emitir piloto interno rápido con manifest controlado.</li>
          <li>Si el lote es supplier-programmed, usá <b>/batches/supplier</b>.</li>
        </ul>
      </Card>
      <AdminActionForms copy={t.dashboard.forms} roles={copy.roles} readyLabel={copy.shell.ready} currentRole="super-admin" />
    </main>
  );
}
