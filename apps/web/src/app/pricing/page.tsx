import { BackLink } from "../../components/back-link";

export default function PricingPage() {
  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <h1 className="text-4xl font-black text-white">No vendemos chips sueltos. Vendemos casos con distinto nivel de riesgo.</h1>
      <p className="max-w-3xl text-slate-300">El precio depende de volumen, formato físico, nivel de seguridad, integración y operación requerida.</p>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold text-cyan-200">Basic</h2>
          <p className="mt-2 text-sm text-slate-300">Para activaciones, acceso general, warranty, loyalty y serialización operacional.</p>
          <p className="mt-3 text-sm font-semibold text-white">Incluye</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300"><li>• Tag codificado</li><li>• Flujo tap-to-web</li><li>• Analytics</li><li>• Reglas simples</li></ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold text-violet-200">Secure</h2>
          <p className="mt-2 text-sm text-slate-300">Para autenticidad fuerte, apertura, vouchers, documentos y verticales sensibles.</p>
          <p className="mt-3 text-sm font-semibold text-white">Incluye</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300"><li>• Hardware secure</li><li>• Validación criptográfica</li><li>• Reglas anti-duplicado</li><li>• Evento backend</li><li>• Soporte de piloto</li></ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold text-emerald-200">Enterprise / Reseller</h2>
          <p className="mt-2 text-sm text-slate-300">Para operadores, partners y marcas que necesitan branding, integración y control.</p>
          <p className="mt-3 text-sm font-semibold text-white">Incluye</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300"><li>• Workspace white-label</li><li>• API y webhooks</li><li>• SLA y soporte operativo</li><li>• Configuración multi-cuenta</li></ul>
        </section>
      </div>

      <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-5 text-cyan-100">Cotizamos por caso, volumen y nivel de riesgo. No por precio unitario de chip.</div>
    </main>
  );
}
