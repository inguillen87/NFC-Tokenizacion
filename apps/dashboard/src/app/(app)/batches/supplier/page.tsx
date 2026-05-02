import { SectionHeading, Card } from "@product/ui";
import { SupplierBatchWizard } from "../../../../components/supplier-batch-wizard";
import { getDashboardI18n } from "../../../../lib/locale";

export default async function SupplierBatchPage() {
  const { locale } = await getDashboardI18n();

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow="Supplier batches"
        title="Registro profesional de lotes reales"
        description="Flujo seguro para crear tenants completos, registrar batches de proveedor, importar manifests auditables y validar URLs SUN antes de entregar el rollout."
      />
      <Card className="p-5 text-sm text-slate-300">
        <p className="font-semibold text-white">Uso recomendado</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Usa esta pantalla cuando el proveedor ya entrego o va a programar K_META_BATCH y K_FILE_BATCH concretas.</li>
          <li>Completa primero el passport del tenant: vertical, producto, origen, politica de ownership y politica de manifest.</li>
          <li>Importa TXT/CSV con preflight antes de activar: UID, batch, SKU, producto, lote y serial quedan auditados.</li>
          <li>Valida una URL SUN real de muestra antes de habilitar portal, marketplace, tokenizacion u ownership claim.</li>
        </ul>
        <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Supplier mode: <b>K_META_BATCH</b> y <b>K_FILE_BATCH</b> son obligatorias. No se autogeneran llaves para batches de proveedor.
        </p>
      </Card>
      <SupplierBatchWizard locale={locale} />
    </main>
  );
}
