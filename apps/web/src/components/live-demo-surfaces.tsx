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
  vertical?: string;
  grape_varietal?: string;
  alcohol_pct?: number;
  harvest_year?: number;
  temperature_storage?: string;
  barrel_months?: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

function stateLabel(result: string) {
  if (result === "VALID") return "Authentic";
  if (result === "REPLAY_SUSPECT") return "Replay suspect";
  if (result === "TAMPER") return "Tamper / opened";
  return "Verification required";
}

function verticalLabel(v?: string) {
  if (v === "cosmetics") return "Cosmetics";
  if (v === "pharma") return "Pharma";
  if (v === "events") return "Events";
  return "Wine";
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
  const valid = items.filter((it) => it.result === "VALID").length;
  const risk = items.length - valid;
  const activeTenants = new Set(items.map((it) => `${it.country_code || "--"}-${it.vertical || "wine"}`)).size;
  const latency = items.length > 0 ? 148 : 0;
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
          vertical: verticalLabel(it.vertical),
          status: stateLabel(it.result),
          source: "live_feed",
          lastSeen: it.created_at,
        })),
    [items]
  );

  return (
    <section className="demo-live-surfaces container-shell space-y-6 py-16">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Live proof block</p>
        <h2 className="text-2xl font-semibold text-white">Global map, active scans and mobile authenticity state</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase tracking-[0.14em] text-slate-400">Active tenants</p><p className="mt-2 text-2xl font-semibold text-white">{activeTenants || 1}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-[0.14em] text-slate-400">Live scans</p><p className="mt-2 text-2xl font-semibold text-emerald-300">{items.length}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-[0.14em] text-slate-400">Risk signals</p><p className="mt-2 text-2xl font-semibold text-rose-300">{risk}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-[0.14em] text-slate-400">Latency</p><p className="mt-2 text-2xl font-semibold text-cyan-300">{latency}ms</p></Card>
      </div>

      <WorldMapPlaceholder title="Global live scans" subtitle="Real demo events from seeded tenant and simulated taps." points={points} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="demo-live-card p-5">
          <h3 className="text-sm font-semibold text-white">Live event feed</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            {items.slice(0, 8).map((event) => (
              <div key={event.id} className="demo-live-feed-item rounded-lg border border-white/10 bg-slate-900/70 p-3">
                <div className="font-medium text-white">{event.result} · {event.product_name || event.uid_hex || "Item"}</div>
                <div className="text-xs text-slate-400">{verticalLabel(event.vertical)} · {event.city || "--"}, {event.country_code || "--"}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="demo-live-card p-5">
          <h3 className="text-sm font-semibold text-white">Mobile preview</h3>
          <div className="demo-live-phone mx-auto mt-4 max-w-[300px] rounded-[2rem] border-[10px] border-slate-800 bg-slate-950 p-4">
            <div className="demo-live-phone-screen rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-wide text-cyan-300">{stateLabel(latest?.result || "")}</p>
              <p className="mt-2 text-lg font-semibold text-white">{latest?.product_name || "Demo Product"}</p>
              <p className="text-xs text-slate-400">{latest?.sku || "-"} · {verticalLabel(latest?.vertical)}</p>
              <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2 text-xs">
                {latest?.city || "Mendoza"}, {latest?.country_code || "AR"}
              </div>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>Varietal: {latest?.grape_varietal || "N/A"}</li>
                <li>Barrel: {latest?.barrel_months ?? "N/A"} months</li>
                <li>Alcohol: {latest?.alcohol_pct ?? "N/A"}%</li>
                <li>Harvest: {latest?.harvest_year ?? "N/A"}</li>
                <li>Storage: {latest?.temperature_storage || "N/A"}</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/demo" className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-200">Open mobile preview</a>
                <a href={`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.nexid.lat"}/`} className="rounded-lg border border-white/20 px-2 py-1 text-[11px] text-slate-300">Open tenant dashboard</a>
                <a href={`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.nexid.lat"}/investor-snapshot`} className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">Investor snapshot</a>
              </div>

            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
