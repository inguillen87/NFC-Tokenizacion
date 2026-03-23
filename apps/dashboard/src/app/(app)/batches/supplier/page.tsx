import { SectionHeading, Card } from "@product/ui";
import { SupplierBatchWizard } from "../../../../components/supplier-batch-wizard";
import { getDashboardI18n } from "../../../../lib/locale";

export default async function SupplierBatchPage() {
  const { locale } = await getDashboardI18n();

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow="Supplier batches" title="Supplier-backed batch registration" description="Flujo seguro para lotes reales programados por proveedor usando las keys exactas acordadas." />
      <Card className="p-5 text-sm text-slate-300">
        <p className="font-semibold text-white">Uso recomendado</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Usar esta pantalla cuando el proveedor ya tiene o va a tener K_META_BATCH y K_FILE_BATCH definidos.</li>
          <li>No crear el lote real desde el flujo rápido si las tags ya fueron negociadas con llaves concretas.</li>
          <li>Registrar primero el batch con esas llaves; después importar manifest; recién después validar sample URLs reales.</li>
        </ul>
      </Card>
      <SupplierBatchWizard locale={locale} />
    </main>
  );
}
