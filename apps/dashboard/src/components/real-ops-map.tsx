"use client";

import { useMemo, useState } from "react";

type MapPoint = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  scans: number;
  risk: number;
  status?: string;
};

export function RealOpsMap({
  points,
  scopeLabel,
}: {
  points: MapPoint[];
  scopeLabel: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePoint = points[activeIndex] || points[0];

  const mapUrl = useMemo(() => {
    if (!activePoint) return "";
    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    const minLat = Math.min(...lats) - 0.18;
    const maxLat = Math.max(...lats) + 0.18;
    const minLng = Math.min(...lngs) - 0.25;
    const maxLng = Math.max(...lngs) + 0.25;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${activePoint.lat}%2C${activePoint.lng}`;
  }, [activePoint, points]);

  return (
    <div className="overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950/70">
      <div className="border-b border-white/10 px-3 py-2 text-xs text-cyan-100">
        Real-time map · <b>{scopeLabel}</b> · {points.length} hubs visibles
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[1fr_19rem]">
        <div className="overflow-hidden rounded-lg border border-white/10">
          <iframe title="ops-real-map" src={mapUrl} className="h-[24rem] w-full bg-slate-950" loading="lazy" />
        </div>
        <div className="space-y-2 overflow-auto rounded-lg border border-white/10 bg-slate-900/70 p-2">
          {points.slice(0, 20).map((point, index) => (
            <button
              key={`${point.city}-${point.lat}-${point.lng}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`w-full rounded-lg border px-2 py-2 text-left text-xs ${index === activeIndex ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-950/70 text-slate-300"}`}
            >
              <p className="font-semibold">{point.city}, {point.country}</p>
              <p>Scans: {point.scans} · Risk: {point.risk}</p>
              <p className="text-[11px] opacity-80">({point.lat.toFixed(4)}, {point.lng.toFixed(4)})</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
