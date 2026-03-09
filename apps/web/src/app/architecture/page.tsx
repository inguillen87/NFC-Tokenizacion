import { BackLink } from "../../components/back-link";

export default function ArchitecturePage() {
  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <h1 className="text-4xl font-black text-white">Una identidad digital por ítem. Múltiples carriers por canal.</h1>
      <p className="max-w-3xl text-slate-300">NFC para la interacción premium. QR como fallback. Backend único para emitir, validar y automatizar.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Issuance</h2><p className="mt-2 text-sm text-slate-300">Alta de lotes, encoding y asignación por vertical.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Validation</h2><p className="mt-2 text-sm text-slate-300">Resolución de autenticidad, estado y reglas de negocio.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Events</h2><p className="mt-2 text-sm text-slate-300">Webhooks, dashboards y alertas de duplicado o tamper.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Ownership</h2><p className="mt-2 text-sm text-slate-300">Claim, transferencia, warranty y proveniencia.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:col-span-2"><h2 className="font-semibold text-white">Integración</h2><p className="mt-2 text-sm text-slate-300">API para CRM, e-commerce, eventos y sistemas internos. Modelo carrier-agnostic y GS1 Digital Link-ready (QR + NFC).</p></div>
      </div>
    </main>
  );
}
