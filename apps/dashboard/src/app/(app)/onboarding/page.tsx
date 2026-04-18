import { SectionHeading } from "@product/ui";
import { SupplierBatchWizard } from "../../../components/supplier-batch-wizard";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import Link from "next/link";

export default async function OnboardingPage() {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";
  const isTenantAdmin = session.role === "tenant-admin";

  const onboardingTitle = isTenantAdmin ? "Tenant Batch Onboarding" : "Supplier Batch Onboarding";
  const onboardingDescription = isTenantAdmin
    ? "Flujo operativo del tenant para registrar lote, importar UIDs, activar tags y validar URL SUN sin ruido de demo."
    : "Flujo guiado para registrar lote real, importar UIDs, activar tags y validar URL SUN en un único wizard.";

  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Onboarding"
        title={onboardingTitle}
        description={onboardingDescription}
      />
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>.
      </section>
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">CEO quick brief</p>
        <h2 className="mt-2 text-lg font-semibold text-white">Qué tiene que pasar para que esto funcione</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>El proveedor programa los tags y comparte <span className="text-white">K_META / K_FILE</span> + archivo de UIDs.</li>
          <li>En este wizard registrás el batch y activás UIDs en un flujo único.</li>
          <li>Luego validás una URL SUN real para confirmar que responde en `/sun`.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/batches" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            Ver batches
          </Link>
          {!isTenantAdmin ? (
            <Link href="/demo-lab" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-100">
              Abrir demo lab
            </Link>
          ) : null}
        </div>
      </section>
      <SupplierBatchWizard locale={locale} />
    </main>
  );
}
