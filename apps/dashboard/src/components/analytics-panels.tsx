"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OpsPanel, StatCard, StatusChip } from "@product/ui";
import { DemoOpsMap } from "./demo-ops-map";

type AnalyticsPanelsProps = {
  kpis: {
    scans: string;
    validInvalid: string;
    duplicates: string;
    tamper: string;
    scansDelta: string;
    validInvalidDelta: string;
    duplicatesDelta: string;
    tamperDelta: string;
    trendTitle: string;
    statusTitle: string;
  };
  extra: {
    activeBatches: string;
    activeBatchesDelta: string;
    activeTenants: string;
    activeTenantsDelta: string;
    resellerPerformance: string;
    resellerPerformanceDelta: string;
    geoDistribution: string;
    geoDistributionDelta: string;
  };
  data?: {
    kpis?: { scans?: number; validRate?: number; invalidRate?: number; duplicates?: number; tamper?: number; activeBatches?: number; activeTenants?: number; geoRegions?: number; resellerPerformance?: number };
    trend?: Array<{ day: string; scans: number; duplicates: number; tamper: number }>;
    batchStatus?: Array<{ name: string; value: number }>;
    geoPoints?: Array<{ city: string; country?: string; scans?: number; risk?: number; lat: number; lng: number }>;
    deviceSignals?: Array<{ device: string; scans: number; countries: number; validRate: number; risk: number }>;
    geography?: { countries?: Array<{ country: string; scans: number; risk: number }>; cities?: Array<{ city: string; country: string; lat: number | null; lng: number | null; scans: number; risk: number; lastSeen: string | null }> };
    devices?: { os?: Array<{ label: string; count: number }>; browser?: Array<{ label: string; count: number }>; deviceType?: Array<{ label: string; count: number }>; timezones?: Array<{ label: string; count: number }>; mobileShare?: number };
    feed?: Array<{ id: number; uidHex: string; bid: string; result: string; city: string; country: string; device: string; createdAt: string }>;
    products?: Array<{ uidHex: string; bid: string; productName: string; winery: string; region: string; vintage: string; scanCount: number; firstSeenAt: string | null; lastSeenAt: string | null; lastVerifiedCity: string; lastVerifiedCountry: string; tokenization: { status: string; network: string; txHash: string | null; tokenId: string | null } }>;
    tagJourney?: Array<{ uid: string; taps: number; firstSeenAt: string | null; lastSeenAt: string | null; origin: { city: string; country: string; lat: number | null; lng: number | null }; current: { city: string; country: string; lat: number | null; lng: number | null }; lastDevice: string }>;
  };
  mapMode?: "demo" | "tenant" | "global";
};

function fmtDate(value: string | null) {
  if (!value) return "n/a";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "n/a" : d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function DeviceBucket({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
      <p className="font-semibold text-slate-100">{title}</p>
      <div className="mt-2 space-y-1">
        {(items.length ? items : [{ label: "Unknown", count: 0 }]).slice(0, 5).map((item) => <p key={item.label}>{item.label}: <b>{item.count}</b></p>)}
      </div>
    </div>
  );
}

export function AnalyticsPanels({ kpis, extra, data, mapMode = "demo" }: AnalyticsPanelsProps) {
  const api = data?.kpis || {};
  const trend = data?.trend || [];
  const countries = data?.geography?.countries || [];
  const cities = data?.geography?.cities || [];
  const deviceSignals = data?.deviceSignals || [];
  const feed = data?.feed || [];
  const products = data?.products || [];
  const tagJourney = data?.tagJourney || [];
  const devices = data?.devices;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={kpis.scans} value={String(api.scans ?? 0)} delta={kpis.scansDelta} tone="good" />
        <StatCard label={kpis.validInvalid} value={`${api.validRate ?? 0} / ${api.invalidRate ?? 0}`} delta={kpis.validInvalidDelta} tone="good" />
        <StatCard label={kpis.duplicates} value={String(api.duplicates ?? 0)} delta={kpis.duplicatesDelta} tone="warn" />
        <StatCard label={kpis.tamper} value={String(api.tamper ?? 0)} delta={kpis.tamperDelta} tone="warn" />
        <StatCard label={extra.activeBatches} value={String(api.activeBatches ?? 0)} delta={extra.activeBatchesDelta} tone="good" />
        <StatCard label={extra.activeTenants} value={String(api.activeTenants ?? 0)} delta={extra.activeTenantsDelta} tone="good" />
        <StatCard label={extra.resellerPerformance} value={`USD ${(api.resellerPerformance ?? 0).toLocaleString()}`} delta={extra.resellerPerformanceDelta} tone="good" />
        <StatCard label={extra.geoDistribution} value={`${api.geoRegions ?? 0} regions`} delta={extra.geoDistributionDelta} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <OpsPanel title={kpis.trendTitle} subtitle="Volumen y señales de riesgo en el rango seleccionado.">
          {!trend.length ? <p className="text-sm text-slate-400">Sin datos para el período seleccionado.</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <CartesianGrid stroke="rgba(148,163,184,.2)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Area type="monotone" dataKey="scans" stroke="#06b6d4" fill="rgba(6,182,212,.2)" />
                  <Area type="monotone" dataKey="duplicates" stroke="#f59e0b" fill="rgba(245,158,11,.15)" />
                  <Area type="monotone" dataKey="tamper" stroke="#ef4444" fill="rgba(239,68,68,.12)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </OpsPanel>

        <OpsPanel title="Trust / Risk split" subtitle="Lecturas válidas frente a señales de invalidación y manipulación.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400">Valid rate</p>
              <p className="text-2xl font-semibold text-emerald-300">{(api.validRate ?? 0).toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400">Risk signals</p>
              <p className="text-2xl font-semibold text-amber-200">{(api.duplicates ?? 0) + (api.tamper ?? 0)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusChip label={`Duplicates ${api.duplicates ?? 0}`} tone="warn" />
            <StatusChip label={`Tamper ${api.tamper ?? 0}`} tone="risk" />
          </div>
        </OpsPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <OpsPanel title="Geographic hotspots" subtitle="Países y ciudades con mayor actividad y riesgo.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
              {(countries.length ? countries : [{ country: "--", scans: 0, risk: 0 }]).slice(0, 6).map((c) => <p key={c.country}>{c.country}: <b>{c.scans}</b> · risk <b>{c.risk}</b></p>)}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
              {(cities.length ? cities : [{ city: "Unknown", country: "--", scans: 0, risk: 0, lastSeen: null }]).slice(0, 6).map((c) => <p key={`${c.city}-${c.country}`}>{c.city}, {c.country}: <b>{c.scans}</b> · {fmtDate(c.lastSeen)}</p>)}
            </div>
          </div>
        </OpsPanel>

        <OpsPanel title="Device breakdown" subtitle="OS, browser, tipo de dispositivo y timezone por tap real.">
          <div className="grid gap-3 md:grid-cols-2">
            <DeviceBucket title="OS" items={devices?.os || []} />
            <DeviceBucket title="Browser" items={devices?.browser || []} />
            <DeviceBucket title="Device type" items={devices?.deviceType || []} />
            <DeviceBucket title="Timezone" items={devices?.timezones || []} />
          </div>
          <p className="mt-2 text-xs text-slate-300">Mobile share: <b>{((devices?.mobileShare || 0) * 100).toFixed(1)}%</b></p>
        </OpsPanel>
      </div>

      <DemoOpsMap mode={mapMode} points={(data?.geoPoints || []).map((point) => ({ city: point.city, country: point.country || "--", lat: point.lat, lng: point.lng, scans: point.scans || 1, risk: point.risk || 0 }))} />

      <div className="grid gap-6 xl:grid-cols-2">
        <OpsPanel title="Live tap feed" subtitle="Actividad reciente y contexto operativo real.">
          <div className="space-y-2">
            {(feed.length ? feed : []).slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <p><b>{item.result}</b> · {item.uidHex} · {item.bid}</p>
                <p className="text-slate-400">{item.city}, {item.country} · {item.device} · {fmtDate(item.createdAt)}</p>
              </div>
            ))}
            {!feed.length ? <p className="text-sm text-slate-400">Sin eventos recientes para este scope.</p> : null}
          </div>
        </OpsPanel>

        <OpsPanel title="Top tags / products" subtitle="Activos con más lecturas, última ubicación verificada y tokenización.">
          <div className="space-y-2">
            {(products.length ? products : []).slice(0, 10).map((item) => (
              <div key={`${item.bid}-${item.uidHex}`} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <p><b>{item.productName}</b> · {item.uidHex}</p>
                <p className="text-slate-400">{item.winery} / {item.region} / {item.vintage} · scans {item.scanCount}</p>
                <p className="text-slate-400">Last verified: {item.lastVerifiedCity}, {item.lastVerifiedCountry} · tokenization {item.tokenization.status}</p>
              </div>
            ))}
            {!products.length ? <p className="text-sm text-slate-400">No hay productos/tags para el período.</p> : null}
          </div>
        </OpsPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <OpsPanel title="Device intelligence" subtitle="Modelos y combinaciones con mayor riesgo relativo.">
          <div className="space-y-2">
            {deviceSignals.map((device) => (
              <div key={device.device} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <div className="flex items-center justify-between gap-2"><p className="font-semibold text-white">{device.device}</p><p>{device.scans} taps</p></div>
                <p className="text-slate-400">Países: <b>{device.countries}</b> · Valid: <b>{device.validRate}%</b> · Riesgo: <b>{device.risk}</b></p>
              </div>
            ))}
            {!deviceSignals.length ? <p className="text-sm text-slate-400">Sin señales de dispositivo suficientes.</p> : null}
          </div>
        </OpsPanel>

        <OpsPanel title="Tag journey" subtitle="Origen de primer tap y última ubicación verificada por UID.">
          <div className="space-y-2">
            {tagJourney.map((item) => (
              <div key={item.uid} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <div className="flex justify-between"><p className="font-semibold">{item.uid}</p><p>{item.taps} taps</p></div>
                <p className="text-slate-300">Origen: <b>{item.origin.city}, {item.origin.country}</b> → Último verificado: <b>{item.current.city}, {item.current.country}</b></p>
                <p className="text-slate-400">Primer tap: {fmtDate(item.firstSeenAt)} · Último tap: {fmtDate(item.lastSeenAt)} · {item.lastDevice}</p>
              </div>
            ))}
            {!tagJourney.length ? <p className="text-sm text-slate-400">Sin trazas de journey para el scope actual.</p> : null}
          </div>
        </OpsPanel>
      </div>
    </div>
  );
}
