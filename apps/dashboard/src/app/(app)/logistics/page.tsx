import Link from "next/link";
import { SectionHeading } from "@product/ui";
import { ShieldAlert, PackageCheck, Package, ShieldCheck, Navigation, Truck, Zap, Activity } from "lucide-react";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";
import { SecureDeliveryOpsConsole } from "../../../components/secure-delivery-ops-console";
import { describeLogisticsSource, resolveLogisticsStatsPayload } from "../../../lib/logistics-map-truth";

async function getLogisticsStats(context: AdminPageContext) {
  try {
    const response = await fetchAdminPage(context, "logistics/shipments");
    const payload = await response.json().catch(() => null);
    return resolveLogisticsStatsPayload(payload, response.ok);
  } catch {
    return resolveLogisticsStatsPayload(null, false);
  }
}

export default async function LogisticsHubPage() {
  const session = await requireDashboardSession("logistics:read");
  const adminContext = await createAdminPageContext(session);
  const tenantScope = adminContext.tenantSlug;

  const statsResult = await getLogisticsStats(adminContext);
  const stats = statsResult.stats;
  const sourceCopy = describeLogisticsSource(statsResult.source);

  return (
    <main className="space-y-8 pb-12" data-logistics-source={statsResult.source} data-logistics-availability={statsResult.availability}>
      <SectionHeading 
        eyebrow="Secure Delivery" 
        title="Logistics Hub" 
        description="Manage tenant-scoped shipments, seal assignments and recorded handling events. These records document operator declarations; they do not prove physical custody or contents by themselves. The process view below is non-geographic and operational metrics disclose their API source."
      />
      
      {/* The API summary has counts but no shipment coordinates. Render a process model, not a fake map. */}
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl md:p-8"
        aria-labelledby="logistics-process-title"
        data-logistics-visual="non-geographic-process"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.08),transparent_34%)]" />
        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                  Modelo de proceso · no geográfico
                </span>
                <h2 id="logistics-process-title" className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Cadena operativa declarada
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  La API actual no entrega coordenadas de los envíos. Esta secuencia explica el flujo de trabajo sin inventar mapas, recorridos ni ubicaciones.
                </p>
              </div>
              <span className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
                Sin telemetría geográfica
              </span>
            </div>

            <ol className="mt-7 grid gap-3 md:grid-cols-4" aria-label="Etapas del proceso logístico declarado">
              <li className="relative rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] p-4 md:after:absolute md:after:-right-3 md:after:top-1/2 md:after:z-10 md:after:-translate-y-1/2 md:after:text-lg md:after:font-black md:after:text-cyan-300 md:after:content-['→']">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">01 · Registro</span>
                  <Package className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                </div>
                <strong className="mt-6 block text-sm text-white">Crear el envío</strong>
                <p className="mt-2 text-xs leading-5 text-slate-400">Tenant, referencias y alcance declarados.</p>
              </li>
              <li className="relative rounded-2xl border border-sky-300/20 bg-sky-400/[0.07] p-4 md:after:absolute md:after:-right-3 md:after:top-1/2 md:after:z-10 md:after:-translate-y-1/2 md:after:text-lg md:after:font-black md:after:text-sky-300 md:after:content-['→']">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200">02 · Asignación</span>
                  <PackageCheck className="h-5 w-5 text-sky-300" aria-hidden="true" />
                </div>
                <strong className="mt-6 block text-sm text-white">Vincular sellos</strong>
                <p className="mt-2 text-xs leading-5 text-slate-400">UID y unidad logística quedan asociados.</p>
              </li>
              <li className="relative rounded-2xl border border-violet-300/20 bg-violet-400/[0.07] p-4 md:after:absolute md:after:-right-3 md:after:top-1/2 md:after:z-10 md:after:-translate-y-1/2 md:after:text-lg md:after:font-black md:after:text-violet-300 md:after:content-['→']">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">03 · Traspaso</span>
                  <Truck className="h-5 w-5 text-violet-300" aria-hidden="true" />
                </div>
                <strong className="mt-6 block text-sm text-white">Registrar el handoff</strong>
                <p className="mt-2 text-xs leading-5 text-slate-400">El operador documenta el evento reportado.</p>
              </li>
              <li className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.07] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">04 · Recepción</span>
                  <ShieldCheck className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                </div>
                <strong className="mt-6 block text-sm text-white">Cerrar la entrega</strong>
                <p className="mt-2 text-xs leading-5 text-slate-400">La recepción queda registrada, no probada físicamente.</p>
              </li>
            </ol>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-5" aria-label="Procedencia y métricas operativas">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Resumen operativo</h3>
                <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-200">{sourceCopy.badge}</p>
              </div>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-slate-400">{sourceCopy.detail}</p>
            <dl className="mt-5 space-y-4 text-xs font-medium text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" /> In-transit records</dt>
                <dd className="font-mono text-sm text-cyan-100">{stats?.in_transit ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> Delivered records</dt>
                <dd className="font-mono text-sm text-emerald-100">{stats?.delivered ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" /> Alert records</dt>
                <dd className="font-mono text-sm text-rose-100">{stats?.alerts ?? "—"}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 transition-all duration-300 hover:bg-slate-800/80 hover:shadow-lg hover:-translate-y-1 group">
          <div className="absolute -right-6 -top-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
            <Package className="h-32 w-32" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 border border-white/5 text-slate-300 shadow-inner">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm text-slate-400">Total Shipments</h3>
          </div>
          <p className="mt-5 text-4xl font-light tracking-tight text-white">{stats?.total ?? "—"}</p>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-md border border-cyan-500/20 p-6 transition-all duration-300 hover:bg-slate-800/80 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:-translate-y-1 group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent"></div>
          <div className="absolute -right-6 -top-6 opacity-[0.05] group-hover:opacity-10 transition-opacity">
            <PackageCheck className="h-32 w-32 text-cyan-400" />
          </div>
          <div className="relative flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              <PackageCheck className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm text-cyan-400/80">In Transit</h3>
          </div>
          <p className="relative mt-5 text-4xl font-light tracking-tight text-white">{stats?.in_transit ?? "—"}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-md border border-emerald-500/20 p-6 transition-all duration-300 hover:bg-slate-800/80 hover:shadow-[0_0_20px_rgba(52,211,153,0.1)] hover:-translate-y-1 group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"></div>
          <div className="absolute -right-6 -top-6 opacity-[0.05] group-hover:opacity-10 transition-opacity">
            <ShieldCheck className="h-32 w-32 text-emerald-400" />
          </div>
          <div className="relative flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm text-emerald-400/80">Delivered Intact</h3>
          </div>
          <p className="relative mt-5 text-4xl font-light tracking-tight text-white">{stats?.delivered ?? "—"}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-md border border-rose-500/20 p-6 transition-all duration-300 hover:bg-slate-800/80 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:-translate-y-1 group">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent"></div>
          <div className="absolute -right-6 -top-6 opacity-[0.05] group-hover:opacity-10 transition-opacity">
            <ShieldAlert className="h-32 w-32 text-rose-400" />
          </div>
          <div className="relative flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm text-rose-400/80">Tamper Alerts</h3>
          </div>
          <p className="relative mt-5 text-4xl font-light tracking-tight text-white">{stats?.alerts ?? "—"}</p>
        </div>
      </div>

      <SecureDeliveryOpsConsole tenantSlug={tenantScope || null} role={session.role} />

      <div className="rounded-3xl border border-white/5 bg-slate-900/30 backdrop-blur-xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Command Center</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/logistics/shipments" className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 p-6 transition-all duration-300 hover:bg-slate-900 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] hover:-translate-y-1">
            <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.15] transition-all duration-500 transform group-hover:scale-110 translate-x-4 translate-y-4">
              <Navigation className="h-32 w-32 text-cyan-400" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-cyan-400 mb-3 flex items-center gap-2">
                View All Shipments
                <Navigation className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                Review tenant shipment records, seal assignments and persisted handling events. Freshness and source remain visible in each operational response.
              </p>
            </div>
          </Link>

          <Link href="/supplier-orders" className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 p-6 transition-all duration-300 hover:bg-slate-900 hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:-translate-y-1">
            <div className="absolute right-0 bottom-0 opacity-[0.03] group-hover:opacity-[0.15] transition-all duration-500 transform group-hover:scale-110 translate-x-4 translate-y-4">
              <Package className="h-32 w-32 text-purple-400" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-purple-400 mb-3 flex items-center gap-2">
                Order Seals
                <Package className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                Request new pre-encoded secure NFC tags to replenish your warehouse distribution pool.
              </p>
            </div>
          </Link>

          <a href="#secure-delivery-ops" className="group relative block overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-950/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-slate-900 hover:shadow-[0_0_30px_rgba(52,211,153,0.15)]">
            <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-4 translate-y-4">
              <Activity className="h-32 w-32" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-emerald-400 mb-3 flex items-center gap-3">
                Scan & Assign
                <span className="text-[9px] uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">App</span>
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300">
                Create shipments, record seal UID assignments, courier handoffs and recipient checks without treating a scan as proof of package contents.
              </p>
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}
