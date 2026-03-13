import { Card } from "./card";

type GeoPoint = {
  city: string;
  country?: string;
  scans?: number;
  risk?: number;
  lat: number;
  lng: number;
};

function project(lat: number, lng: number) {
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x, y };
}

const defaultPoints: GeoPoint[] = [
  { city: "Mendoza", country: "AR", scans: 4200, risk: 42, lat: -32.8895, lng: -68.8458 },
  { city: "São Paulo", country: "BR", scans: 3800, risk: 35, lat: -23.5558, lng: -46.6396 },
  { city: "New York", country: "US", scans: 2400, risk: 18, lat: 40.7128, lng: -74.006 },
  { city: "London", country: "UK", scans: 1900, risk: 16, lat: 51.5072, lng: -0.1276 },
  { city: "Tokyo", country: "JP", scans: 2200, risk: 20, lat: 35.6764, lng: 139.65 },
];

export function WorldMapPlaceholder({
  title = "Global scan footprint",
  subtitle = "Mapa operativo de autenticaciones, riesgo y cobertura multi-tenant.",
  points = defaultPoints,
}: {
  title?: string;
  subtitle?: string;
  points?: GeoPoint[];
}) {
  const safePoints = points.length > 0 ? points : defaultPoints;
  const totalScans = safePoints.reduce((acc, point) => acc + (point.scans || 0), 0);
  const riskSignals = safePoints.reduce((acc, point) => acc + (point.risk || 0), 0);

  return (
    <Card className="worldmap-card relative overflow-hidden p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
        </div>
        <div className="flex gap-2 text-[11px]">
          <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">{safePoints.length} hubs</div>
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">{totalScans.toLocaleString()} scans</div>
          <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-rose-100">{riskSignals.toLocaleString()} risk</div>
        </div>
      </div>

      <div className="worldmap-shell mt-5 grid h-72 place-items-center rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,0.16),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.16),transparent_40%),#020617]">
        <div className="worldmap-canvas relative h-60 w-full max-w-5xl overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950/95 shadow-[inset_0_0_80px_rgba(2,6,23,0.85)]">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <svg viewBox="0 0 1000 420" className="absolute inset-0 h-full w-full opacity-60" aria-hidden>
            <g fill="rgba(56,189,248,0.15)" stroke="rgba(125,211,252,0.4)" strokeWidth="1.2">
              <path d="M102 136l34-24 58 8 28 30 38 9 22 44-20 41-66 24-36-20-26-35-32-8-32-37z" />
              <path d="M278 267l45 9 18 24 30 16 14 45-25 44-44 11-31-22-8-45 8-40z" />
              <path d="M406 120l63-22 108 10 86 19 68-8 58 29-7 33-65 15-31 33-83-1-52 26-47 11-88-24-38-31z" />
              <path d="M549 262l59-15 45 14 46 29-18 48-66 16-48-23-29-44z" />
              <path d="M734 254l69-8 64 12 42 27 2 38-50 22-70-9-57-27z" />
              <path d="M848 117l40-20 56 8 30 20-12 25-45 13-38-7-23-20z" />
            </g>
          </svg>

          {safePoints.map((point) => {
            const c = project(point.lat, point.lng);
            const size = Math.max(8, Math.min(20, 8 + Math.round((point.scans || 0) / 1400)));
            const tone = (point.risk || 0) > 0 ? "bg-rose-300 shadow-[0_0_22px_rgba(251,113,133,0.95)]" : "bg-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.95)]";
            return (
              <div key={`${point.city}-${point.lat}-${point.lng}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-cyan-300/40" />
                <span className={`relative inline-block rounded-full ${tone}`} style={{ width: size, height: size }} />
                <div className="mt-1 rounded-lg border border-cyan-300/30 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-100">
                  {point.city} {point.country ? `· ${point.country}` : ""}
                  {point.scans ? <span className="text-cyan-300"> · {point.scans.toLocaleString()}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] md:grid-cols-3">
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">AUTH_OK · tráfico normal</div>
        <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-200">DUPLICATE_RISK · repetición anómala</div>
        <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-rose-200">TAMPER_RISK · estado abierto/sospechoso</div>
      </div>
    </Card>
  );
}
