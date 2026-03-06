"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, WorldMapPlaceholder } from "@product/ui";

type LiveEvent = {
  id: number;
  created_at: string;
  result: string;
  uid_hex?: string;
  city?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  device_label?: string;
  product_name?: string;
  sku?: string;
  winery?: string;
  region?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3003";

function stateLabel(result: string) {
  if (result === "VALID") return "Authentic";
  if (result === "REPLAY_SUSPECT") return "Replay suspect";
  if (result === "TAMPER") return "Tamper / opened";
  return "Verification required";
}

export function LiveDemoSurfaces() {
  const [items, setItems] = useState<LiveEvent[]>([]);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      const res = await fetch(`${API_BASE}/demo/live?tenant=demobodega&limit=25`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      if (active) setItems(Array.isArray(data.items) ? data.items : []);
    };
    void tick();
    const id = setInterval(tick, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const latest = items[0];
  const points = useMemo(
    () =>
      items
        .filter((it) => typeof it.lat === "number" && typeof it.lng === "number")
        .map((it) => ({
          city: it.city || "Unknown",
          country: it.country_code || "--",
          lat: Number(it.lat),
          lng: Number(it.lng),
          scans: 1,
          risk: it.result === "VALID" ? 0 : 1,
        })),
    [items]
  );

  return (
    <section className="container-shell py-16 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Live demo surfaces</p>
        <h2 className="text-2xl font-semibold text-white">Live map + mobile preview</h2>
      </div>

      <WorldMapPlaceholder
        title="Global live scans"
        subtitle="Demo + production-format events streaming from Demo Bodega."
        points={points}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">Live event feed</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            {items.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded-lg border border-white/10 bg-slate-900/70 p-3">
                {event.result} · {event.city || "--"}, {event.country_code || "--"} · {event.product_name || event.uid_hex || "Bottle"}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">Mobile preview</h3>
          <div className="mx-auto mt-4 max-w-[280px] rounded-[2rem] border-[10px] border-slate-800 bg-slate-950 p-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-wide text-cyan-300">{stateLabel(latest?.result || "")}</p>
              <p className="mt-2 text-lg font-semibold text-white">{latest?.product_name || "Demo Bodega Reserva"}</p>
              <p className="text-xs text-slate-400">{latest?.sku || "DB-001"} · {latest?.winery || "Demo Bodega"}</p>
              <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2 text-xs">
                {latest?.city || "Mendoza"}, {latest?.country_code || "AR"}
              </div>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>Varietal: Malbec</li>
                <li>Barrel: 14 months</li>
                <li>Alcohol: 14.2%</li>
                <li>Harvest: 2022</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
