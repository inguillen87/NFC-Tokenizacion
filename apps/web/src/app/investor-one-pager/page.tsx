import Link from "next/link";

const bullets = [
  "nexID es infraestructura enterprise para autenticidad NFC, anti-fraude y trazabilidad.",
  "No vendemos solo chips: monetizamos hardware encodeado, setup, SaaS, API, soporte y reseller.",
  "La capa blockchain/tokenization es opcional y solo para clientes premium con ROI.",
  "Wedge inicial: wine/spirits, events, cosmetics y agro/pharma.",
  "Moat: infraestructura de validación + data graph + switching costs operativos.",
];

export default function InvestorOnePagerPage() {
  return (
    <main className="container-shell py-10 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(14,165,233,.12),transparent_45%),#020617] p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">One-pager</p>
        <h1 className="mt-2 text-2xl font-semibold">nexID · enterprise anti-fraud + traceability SaaS</h1>
        <p className="mt-3 text-sm text-slate-300">
          Combinamos NFC, software y API para convertir productos físicos en activos verificables, trazables y operables.
          Para clientes premium, activamos ownership/provenance/warranty y tokenización opcional.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-200">
          {bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/investor-snapshot" className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">Back to deck view</Link>
          <Link href="/sun" className="rounded-lg border border-violet-300/35 bg-violet-500/10 px-4 py-2 text-sm text-violet-100">Run live SUN demo</Link>
          <Link href="/?contact=quote&intent=investor_snapshot#contact-modal" className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">Request meeting</Link>
        </div>
      </section>
    </main>
  );
}
