import Link from "next/link";
import { BackLink } from "../../components/back-link";

export default function ResellersPage() {
  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <h1 className="text-4xl font-black text-white">White-label para partners que quieren vender sin construir toda la infraestructura.</h1>
      <p className="max-w-3xl text-slate-300">nexID permite a agencias, converters, imprentas e integradores operar sobre una plataforma central con control de marca y operación.</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200"><h2 className="font-semibold text-white">Co-branded</h2><p className="mt-2 text-sm">Operás rápido con marca compartida.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200"><h2 className="font-semibold text-white">Private-label</h2><p className="mt-2 text-sm">Aislás clientes, lotes y operación bajo tu marca.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200"><h2 className="font-semibold text-white">Commercial model</h2><p className="mt-2 text-sm">Setup, margen por hardware, SaaS recurrente y expansión por canal.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200"><h2 className="font-semibold text-white">Partner workflow</h2><p className="mt-2 text-sm">Onboarding, emisión, soporte y monitoreo desde un mismo workspace.</p></div>
      </div>

      <Link href="/?contact=reseller#contact-modal" className="inline-flex rounded-xl border border-violet-300/35 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-100">Quiero ser reseller</Link>
    </main>
  );
}
