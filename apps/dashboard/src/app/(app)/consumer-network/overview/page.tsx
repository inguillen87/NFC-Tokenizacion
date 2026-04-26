import { WorldMapRealtime } from "@product/ui";

const enterprisePoints = [
  { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 124, risk: 1, status: "AUTH_OK", lastSeen: new Date().toISOString() },
  { city: "Córdoba", country: "Argentina", lat: -31.4201, lng: -64.1888, scans: 88, risk: 0, status: "VIP_OK", lastSeen: new Date().toISOString() },
  { city: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332, scans: 63, risk: 2, status: "DUPLICATE_BLOCKED", lastSeen: new Date().toISOString() },
  { city: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333, scans: 79, risk: 1, status: "OPENED_EVENT", lastSeen: new Date().toISOString() },
  { city: "Bogotá", country: "Colombia", lat: 4.711, lng: -74.0721, scans: 51, risk: 0, status: "PACKAGE_VERIFIED", lastSeen: new Date().toISOString() },
];

const enterpriseFeed: Array<{ title: string; place: string; vertical: string; severity: "opened" | "ok" | "risk" }> = [
  { title: "Bottle uncorked", place: "Mendoza, AR", vertical: "Wine", severity: "opened" },
  { title: "VIP wristband validated", place: "Córdoba, AR", vertical: "Events", severity: "ok" },
  { title: "Duplicate access blocked", place: "Mexico City, MX", vertical: "Events", severity: "risk" },
  { title: "Chain of custody checkpoint", place: "Bogotá, CO", vertical: "Pharma", severity: "ok" },
  { title: "Bag open event", place: "Rosario, AR", vertical: "Agro", severity: "opened" },
];

function severityTone(severity: "opened" | "ok" | "risk") {
  if (severity === "risk") return "text-rose-300 border-rose-300/20 bg-rose-500/10";
  if (severity === "opened") return "text-violet-200 border-violet-300/20 bg-violet-500/10";
  return "text-emerald-200 border-emerald-300/20 bg-emerald-500/10";
}

export default function PortalUsuariosOverviewPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Portal de Usuarios</h1>
        <p className="mt-1 text-sm text-slate-400">Métricas de adquisición, retención, conversión y eventos live en red enterprise.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Usuarios Registrados</p>
          <p className="mt-2 text-3xl font-bold text-white">2,358</p>
          <p className="mt-1 text-xs text-emerald-400">+12% este mes</p>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Tappers Anónimos</p>
          <p className="mt-2 text-3xl font-bold text-white">8,402</p>
          <p className="mt-1 text-xs text-slate-500">No completaron registro</p>
        </article>
        <article className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-cyan-400">Conversión a Lead</p>
          <p className="mt-2 text-3xl font-bold text-cyan-100">22%</p>
          <p className="mt-1 text-xs text-cyan-300">Tap → Cuenta Creada</p>
        </article>
        <article className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4">
          <p className="text-xs uppercase tracking-widest text-violet-400">Tappers Recurrentes</p>
          <p className="mt-2 text-3xl font-bold text-violet-100">14%</p>
          <p className="mt-1 text-xs text-violet-300">Han escaneado &gt; 1 producto</p>
        </article>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <WorldMapRealtime
          title="Geo Intelligence · Consumer Network"
          subtitle="Flujo mundial de taps, autenticaciones y eventos de riesgo por tenant."
          points={enterprisePoints}
          initialExpanded={false}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
          <h3 className="mb-4 text-sm font-bold text-white">Últimos Miembros Activos</h3>
          <ul className="space-y-4">
            <li className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">MC</div>
                <div>
                  <p className="text-sm font-medium text-white">Martina Costa</p>
                  <p className="text-xs text-slate-400">martina@example.com</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">1,200 pts</p>
                <p className="text-[10px] text-slate-500">Nivel Embajador</p>
              </div>
            </li>
            <li className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">JP</div>
                <div>
                  <p className="text-sm font-medium text-white">Juan Pérez</p>
                  <p className="text-xs text-slate-400">juan.perez@example.com</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">450 pts</p>
                <p className="text-[10px] text-slate-500">Nivel Explorador</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
          <h3 className="mb-4 text-sm font-bold text-white">Feed Enterprise (live)</h3>
          <div className="space-y-2">
            {enterpriseFeed.map((event) => (
              <div key={`${event.title}-${event.place}`} className={`rounded-lg border px-3 py-2 text-xs ${severityTone(event.severity)}`}>
                <p className="font-semibold">{event.vertical}: {event.title}</p>
                <p className="mt-0.5 opacity-80">{event.place}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
