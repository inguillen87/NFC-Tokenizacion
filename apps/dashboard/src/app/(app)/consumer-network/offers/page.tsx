import { requireDashboardSession } from "../../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function getOffers() {
  try {
    const response = await fetch(`${API_BASE}/marketplace/offers`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

const PRESETS = [
  { id: "off-1", title: "20% Off Primera Compra", description: "Descuento en tu próxima botella de Gran Reserva.", status: "active", type: "discount", visibility: "verified_tappers", tenant_slug: "demobodega", product_title: "Gran Reserva Malbec" },
  { id: "off-2", title: "Early Access Malbec 2026", description: "Acceso exclusivo a preventa limitada.", status: "active", type: "request_to_buy", visibility: "tenant_members_only", tenant_slug: "demobodega", product_title: "Gran Reserva Malbec" }
];

export default async function TenantOffersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const requestedTenant = typeof query.tenant === "string" ? query.tenant : "";
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : requestedTenant;

  const fetchedOffers = await getOffers();
  const rawOffers = fetchedOffers.length ? fetchedOffers : PRESETS;
  const offers = tenantScope
    ? rawOffers.filter((o: any) => String(o.tenant_slug || "").toLowerCase() === tenantScope.toLowerCase())
    : rawOffers;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ofertas & Drops</h1>
          <p className="mt-1 text-sm text-slate-400">Promociones exclusivas para usuarios de la red NexID y el Marketplace cruzado.</p>
        </div>
        <button suppressHydrationWarning className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold rounded-lg transition-colors">
          + Crear Oferta
        </button>
      </header>

      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
         <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-white/10 bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400">
               <tr>
                  <th className="px-4 py-3 font-medium">Oferta</th>
                  <th className="px-4 py-3 font-medium">Producto Asociado</th>
                  <th className="px-4 py-3 font-medium">Segmento / Visibilidad</th>
                  <th className="px-4 py-3 font-medium">Tipo / Canal</th>
                  <th className="px-4 py-3 font-medium text-right">Estado</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
               {offers.length ? offers.map((item: any, idx: number) => {
                 const isPaused = item.status === "paused" || item.status === "draft";
                 return (
                   <tr key={`${item.id}-${idx}`} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                         <p className="font-bold text-white">{item.title}</p>
                         <p className="text-[10px] text-slate-500">{item.description}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                         {item.product_title || "Genérico (Sin producto)"}
                      </td>
                      <td className="px-4 py-3">
                         <span className="inline-flex px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold">
                           {item.visibility || "Global Network"}
                         </span>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase font-mono tracking-wide text-slate-400">
                         {item.type || "discount"}
                      </td>
                      <td className="px-4 py-3 text-right">
                         <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                           isPaused ? "bg-slate-500/20 text-slate-400" : "bg-emerald-500/20 text-emerald-400"
                         }`}>
                            {item.status || "Activa"}
                         </span>
                      </td>
                   </tr>
                 );
               }) : (
                 <tr>
                   <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                     No hay ofertas creadas para este scope todavía.
                   </td>
                 </tr>
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}
