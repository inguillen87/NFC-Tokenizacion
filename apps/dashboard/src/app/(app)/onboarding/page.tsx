import { SectionHeading } from "@product/ui";
import { SupplierBatchWizard } from "../../../components/supplier-batch-wizard";
import { getDashboardI18n } from "../../../lib/locale";
import Link from "next/link";

export default async function OnboardingPage() {
  const { locale } = await getDashboardI18n();

  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Onboarding"
        title="Supplier Batch Onboarding"
        description="Flujo guiado para registrar lote real, importar UIDs, activar tags y validar URL SUN en un único wizard."
      />
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">CEO quick brief</p>
        <h2 className="mt-2 text-lg font-semibold text-white">Qué tiene que pasar para que esto funcione</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>El proveedor programa los tags y comparte <span className="text-white">K_META / K_FILE</span> + archivo de UIDs.</li>
          <li>En este wizard registrás el batch y activás UIDs en 1 flujo.</li>
          <li>Luego validás una URL SUN real para confirmar que responde en `/sun`.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/batches" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            Ver batches
          </Link>
          <Link href="/demo-lab" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-100">
            Abrir demo lab
          </Link>
        </div>
      </section>
      <SupplierBatchWizard locale={locale} />
    </main>
  );
}
