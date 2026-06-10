import { requireDashboardSession } from "../../../../lib/session";
import { getServerOrigin } from "../../../../lib/server-origin";
import { headers } from "next/headers";
import { Card } from "@product/ui";

async function getRewards(origin: string, tenantScope: string, cookie?: string) {
  try {
    const query = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
    const response = await fetch(`${origin}/api/admin/loyalty/rewards${query}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.rewards || [];
  } catch {
    return [];
  }
}

const PRESETS = [
  { code: "DEG-2X1", title: "Degustación Premium 2x1", points: 300, status: "active", description: "Visitá la bodega y disfrutá un upgrade en tu degustación de la línea Reserva." },
  { code: "MIX-6B", title: "Caja Mix 6 Botellas Edición Limitada", points: 1200, status: "active", description: "Selección especial del enólogo. Envío incluido a nivel nacional." },
  { code: "MAG-15L", title: "Botella Magnum 1.5L", points: 2500, status: "paused", description: "Formato especial ideal para guarda. Solo para nivel Embajador." }
];

export default async function RewardsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchParams ? await searchParams : {};
  const session = await requireDashboardSession();
  const requestedTenant = typeof query.tenant === "string" ? query.tenant : "";
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : requestedTenant;
  const origin = await getServerOrigin();
  const cookie = (await headers()).get("cookie") || "";

  const fetchedRewards = await getRewards(origin, tenantScope, cookie);
  const rewards = fetchedRewards.length ? fetchedRewards : PRESETS;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Catálogo de Beneficios</h1>
          <p className="mt-1 text-sm text-slate-400">Gestioná los premios, experiencias y descuentos disponibles para tus usuarios.</p>
        </div>
        <button suppressHydrationWarning className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors">
          + Nuevo Beneficio
        </button>
      </header>

      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         {rewards.map((item: any, idx: number) => {
           const emoji = item.code.includes("DEG") || item.title.toLowerCase().includes("degus") ? "🎟️" : item.code.includes("MIX") ? "📦" : "🍷";
           const isPaused = item.status === "paused" || item.status === "draft";
           return (
             <div key={`${item.code}-${idx}`} className={`rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden flex flex-col group ${isPaused ? "opacity-60 grayscale-[50%]" : ""}`}>
                <div className="h-32 bg-slate-800 flex items-center justify-center text-4xl relative">
                   {emoji}
                   <div className={`absolute top-2 right-2 px-2 py-0.5 border text-[10px] font-bold rounded uppercase tracking-widest ${
                     isPaused 
                       ? "bg-slate-500/20 border-slate-500/30 text-slate-400" 
                       : item.points >= 1200 
                         ? "bg-amber-500/20 border-amber-500/30 text-amber-400" 
                         : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                   }`}>
                      {item.status || "active"}
                   </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                     {item.points >= 1000 ? "PRODUCTO FÍSICO" : "EXPERIENCIA"}
                   </p>
                   <h3 className="text-base font-bold text-white leading-tight">{item.title}</h3>
                   <p className="text-xs text-slate-400 mt-2 line-clamp-2">{item.description || "Sin descripción cargada."}</p>

                   <div className="mt-auto pt-4 flex items-center justify-between">
                      <div>
                         <p className="text-sm font-bold text-white">{item.points} pts</p>
                         <p className="text-[10px] text-slate-500">Código: {item.code}</p>
                      </div>
                      <button suppressHydrationWarning className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">Editar</button>
                   </div>
                </div>
             </div>
           );
         })}
      </div>
    </div>
  );
}
