import Link from "next/link";
import { SectionHeading } from "@product/ui";
import { BadgeCheck, Boxes, ClipboardCheck, ImagePlus, Store, WandSparkles } from "lucide-react";
import { SupplierBatchWizard } from "../../../components/supplier-batch-wizard";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";

const rolloutSteps = [
  {
    title: "Recibi la caja de tags",
    body: "QR, NTAG215 o NTAG 424 DNA TT llegan con lote, carrier y cantidad esperada.",
    Icon: Boxes,
  },
  {
    title: "Cargo manifest + fotos",
    body: "CSV con UIDs, producto, lote, foto real, etiqueta frontal, tag aplicado y modelo 3D opcional.",
    Icon: ImagePlus,
  },
  {
    title: "Valido antes de pegar",
    body: "El sistema revisa duplicados, carrier, politica SUN, assets y preparacion de passport.",
    Icon: ClipboardCheck,
  },
  {
    title: "Producto listo para vender",
    body: "El tap abre autenticidad, origen, club, garantia, marketplace y certificado cuando corresponda.",
    Icon: Store,
  },
];

export default async function OnboardingPage() {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession();
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";
  const isTenantAdmin = session.role === "tenant-admin";

  const onboardingTitle = isTenantAdmin ? "Tenant Batch Onboarding" : "Supplier Batch Onboarding";
  const onboardingDescription = isTenantAdmin
    ? "Flujo operativo del tenant para recibir tags, cargar productos reales, validar lote y dejar todo listo para gondola."
    : "Flujo guiado para que reseller, auditor o administrador pasen de una caja de tags a productos pegados, probados y vendiendo.";

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
      <section className="dashboard-hero-panel dashboard-hero-panel--cyan rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.9),rgba(2,6,23,0.96))] p-5 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              operacion para gente no tecnica
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              De tags recibidos a producto premium verificable, sin depender de un tecnico.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              La persona que opera el lote ve que falta, que esta bloqueado y cual es el proximo paso:
              cargar manifest, asociar fotos reales, validar tags, probar un tap y publicar el producto.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/batches" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100">
                Ver batches
              </Link>
              <Link href="/tokenization" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100">
                Banco de assets
              </Link>
              {!isTenantAdmin ? (
                <Link href="/demo-lab" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-slate-100">
                  Abrir demo lab
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {rolloutSteps.map(({ title, body, Icon }, index) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Icon className="h-5 w-5 text-cyan-200" aria-hidden="true" />
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-black text-cyan-100">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-black text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <WandSparkles className="mt-0.5 h-5 w-5 text-emerald-200" aria-hidden="true" />
          <div>
            <p className="text-sm font-black text-white">Regla premium del rollout</p>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-300">
              No publicamos un lote solo porque existe el UID. Cada producto debe tener identidad visual, carrier correcto,
              reglas de reclamo, prueba de tap y un camino claro para passport, club, marketplace y NFT opcional.
            </p>
          </div>
        </div>
      </section>
      <SupplierBatchWizard locale={locale} />
    </main>
  );
}
