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

  return (
    <Card className="worldmap-card relative overflow-hidden p-6">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
      <div className="worldmap-shell mt-6 grid h-64 place-items-center rounded-2xl border border-white/5 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12),transparent_55%)]">
        <div className="worldmap-canvas relative h-48 w-full max-w-4xl overflow-hidden rounded-[2rem] border border-cyan-400/10 bg-slate-950">
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          <svg viewBox="0 0 1000 420" className="absolute inset-0 h-full w-full opacity-50" aria-hidden>
            <g fill="rgba(148,163,184,0.18)" stroke="rgba(148,163,184,0.22)" strokeWidth="1.2">
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
            const size = Math.max(8, Math.min(18, 8 + Math.round((point.scans || 0) / 1800)));
            return (
              <div key={`${point.city}-${point.lat}-${point.lng}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full bg-cyan-300/50" />
                <span className="relative inline-block rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(103,232,249,0.95)]" style={{ width: size, height: size }} />
                <div className="mt-1 rounded-lg border border-cyan-400/30 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-100">
                  {point.city} {point.country ? `· ${point.country}` : ""}
                  {point.scans ? <span className="text-cyan-300"> · {point.scans.toLocaleString()} scans</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] md:grid-cols-3">
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">valid · normal traffic</div>
        <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-200">duplicate · repeat scans</div>
        <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-rose-200">tamper · risk event</div>
      </div>
    </Card>
  );
}
