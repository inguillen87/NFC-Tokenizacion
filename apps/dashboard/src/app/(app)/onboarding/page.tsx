import { SectionHeading } from "@product/ui";
import { SupplierBatchWizard } from "../../../components/supplier-batch-wizard";
import { getDashboardI18n } from "../../../lib/locale";

export default async function OnboardingPage() {
  const { locale } = await getDashboardI18n();

  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Onboarding"
        title="Supplier Batch Onboarding"
        description="Flujo guiado para registrar lote real, importar UIDs, activar tags y validar URL SUN en un único wizard."
      />
      <SupplierBatchWizard locale={locale} />
    </main>
  );
}
