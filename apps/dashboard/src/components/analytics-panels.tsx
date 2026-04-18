"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, StatCard } from "@product/ui";
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
    kpis?: {
      scans?: number;
      validRate?: number;
      invalidRate?: number;
      duplicates?: number;
      tamper?: number;
      activeBatches?: number;
      activeTenants?: number;
      geoRegions?: number;
      resellerPerformance?: number;
    };
    trend?: Array<{ day: string; scans: number; duplicates: number; tamper: number }>;
    batchStatus?: Array<{ name: string; value: number }>;
    geoPoints?: Array<{ city: string; country?: string; scans?: number; risk?: number; lat: number; lng: number }>;
    deviceSignals?: Array<{ device: string; scans: number; countries: number; validRate: number; risk: number }>;
    geography?: {
      countries?: Array<{ country: string; scans: number; risk: number }>;
      cities?: Array<{ city: string; country: string; lat: number | null; lng: number | null; scans: number; risk: number; lastSeen: string | null }>;
    };
    devices?: {
      os?: Array<{ label: string; count: number }>;
      browser?: Array<{ label: string; count: number }>;
      timezones?: Array<{ label: string; count: number }>;
      mobileShare?: number;
    };
    feed?: Array<{ id: number; uidHex: string; bid: string; result: string; city: string; country: string; device: string; createdAt: string }>;
    products?: Array<{
      uidHex: string;
      bid: string;
      productName: string;
      winery: string;
      region: string;
      vintage: string;
      scanCount: number;
      firstSeenAt: string | null;
      lastSeenAt: string | null;
      lastVerifiedCity: string;
      lastVerifiedCountry: string;
      tokenization: { status: string; network: string; txHash: string | null; tokenId: string | null };
    }>;
    tagJourney?: Array<{
      uid: string;
      taps: number;
      firstSeenAt: string | null;
      lastSeenAt: string | null;
      origin: { city: string; country: string; lat: number | null; lng: number | null };
      current: { city: string; country: string; lat: number | null; lng: number | null };
      lastDevice: string;
    }>;
  };
  mapMode?: "demo" | "tenant" | "global";
};

const fallbackScans = [
  { day: "Mon", scans: 2400, duplicates: 20, tamper: 3 },
  { day: "Tue", scans: 2210, duplicates: 28, tamper: 4 },
  { day: "Wed", scans: 2890, duplicates: 19, tamper: 2 },
  { day: "Thu", scans: 3120, duplicates: 36, tamper: 6 },
  { day: "Fri", scans: 4200, duplicates: 42, tamper: 8 },
  { day: "Sat", scans: 3980, duplicates: 31, tamper: 5 },
  { day: "Sun", scans: 3670, duplicates: 26, tamper: 4 },
];

const fallbackBatchStatus = [
  { name: "Active", value: 68 },
  { name: "Pending", value: 22 },
  { name: "Revoked", value: 10 },
];

export function AnalyticsPanels({ kpis, extra, data, mapMode = "demo" }: AnalyticsPanelsProps) {
  const api = data?.kpis || {};
  const trend = data?.trend?.length ? data.trend : fallbackScans;
  const batchStatus = data?.batchStatus?.length ? data.batchStatus : fallbackBatchStatus;
  const deviceSignals = data?.deviceSignals || [];
  const countries = data?.geography?.countries || [];
  const cities = data?.geography?.cities || [];
  const osBreakdown = data?.devices?.os || [];
  const browserBreakdown = data?.devices?.browser || [];
  const timezoneBreakdown = data?.devices?.timezones || [];
  const mobileShare = data?.devices?.mobileShare ?? 0;
  const feed = data?.feed || [];
  const products = data?.products || [];
  const tagJourney = data?.tagJourney || [];

  function formatDate(value: string | null) {
    if (!value) return "n/a";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "n/a";
    return date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={kpis.scans} value={`${((api.scans || 22400) / 1000).toFixed(1)}k`} delta={kpis.scansDelta} tone="good" />
        <StatCard label={kpis.validInvalid} value={`${api.validRate ?? 98.8} / ${api.invalidRate ?? 1.2}`} delta={kpis.validInvalidDelta} tone="good" />
        <StatCard label={kpis.duplicates} value={String(api.duplicates ?? 202)} delta={kpis.duplicatesDelta} tone="warn" />
        <StatCard label={kpis.tamper} value={String(api.tamper ?? 32)} delta={kpis.tamperDelta} tone="warn" />
        <StatCard label={extra.activeBatches} value={String(api.activeBatches ?? 68)} delta={extra.activeBatchesDelta} tone="good" />
        <StatCard label={extra.activeTenants} value={String(api.activeTenants ?? 27)} delta={extra.activeTenantsDelta} tone="good" />
        <StatCard label={extra.resellerPerformance} value={`USD ${(api.resellerPerformance ?? 40200).toLocaleString()}`} delta={extra.resellerPerformanceDelta} tone="good" />
        <StatCard label={extra.geoDistribution} value={`${api.geoRegions ?? 8} regions`} delta={extra.geoDistributionDelta} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">{kpis.trendTitle}</h3>
          <div className="mt-4 h-72">
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
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">{kpis.statusTitle}</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={batchStatus}>
                <CartesianGrid stroke="rgba(148,163,184,.2)" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">Heatmap markets (countries/cities)</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <p className="text-xs font-semibold text-slate-200">Top countries</p>
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                {(countries.length ? countries : [{ country: "--", scans: 0, risk: 0 }]).slice(0, 6).map((item) => (
                  <p key={item.country}>{item.country}: <b>{item.scans}</b> taps · risk <b>{item.risk}</b></p>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <p className="text-xs font-semibold text-slate-200">Top cities</p>
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                {(cities.length ? cities : [{ city: "Unknown", country: "--", scans: 0, risk: 0, lastSeen: null }]).slice(0, 6).map((item) => (
                  <p key={`${item.city}-${item.country}`}>{item.city}, {item.country}: <b>{item.scans}</b> · lastSeen {formatDate(item.lastSeen)}</p>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">Device breakdown</h3>
          <p className="mt-1 text-xs text-slate-400">OS / browser / timezone agregados desde contexto SUN.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">OS</p>
              {(osBreakdown.length ? osBreakdown : [{ label: "Unknown", count: 0 }]).slice(0, 4).map((item) => <p key={item.label}>{item.label}: <b>{item.count}</b></p>)}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">Browser</p>
              {(browserBreakdown.length ? browserBreakdown : [{ label: "Unknown", count: 0 }]).slice(0, 4).map((item) => <p key={item.label}>{item.label}: <b>{item.count}</b></p>)}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">Timezone</p>
              {(timezoneBreakdown.length ? timezoneBreakdown : [{ label: "Unknown", count: 0 }]).slice(0, 4).map((item) => <p key={item.label}>{item.label}: <b>{item.count}</b></p>)}
              <p className="mt-2">Mobile share: <b>{(mobileShare * 100).toFixed(1)}%</b></p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">Live feed (verified taps)</h3>
          <div className="mt-3 space-y-2">
            {(feed.length ? feed : [{ id: 0, uidHex: "-", bid: "-", result: "NO_DATA", city: "-", country: "-", device: "-", createdAt: null as unknown as string }]).slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <p><b>{item.result}</b> · {item.uidHex} · {item.bid}</p>
                <p className="text-slate-400">{item.city}, {item.country} · {item.device} · {formatDate(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">Top products / bottles</h3>
          <div className="mt-3 space-y-2">
            {(products.length ? products : [{
              uidHex: "-",
              bid: "-",
              productName: "No data",
              winery: "-",
              region: "-",
              vintage: "-",
              scanCount: 0,
              firstSeenAt: null,
              lastSeenAt: null,
              lastVerifiedCity: "-",
              lastVerifiedCountry: "-",
              tokenization: { status: "none", network: "-", txHash: null, tokenId: null },
            }]).slice(0, 10).map((item) => (
              <div key={`${item.bid}-${item.uidHex}`} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <p><b>{item.productName}</b> · {item.uidHex}</p>
                <p className="text-slate-400">{item.winery} / {item.region} / {item.vintage} · scans {item.scanCount}</p>
                <p className="text-slate-400">Última ubicación verificada: {item.lastVerifiedCity}, {item.lastVerifiedCountry} · tokenization {item.tokenization.status}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <DemoOpsMap mode={mapMode} points={(data?.geoPoints || []).map((point) => ({
        city: point.city,
        country: point.country || "--",
        lat: point.lat,
        lng: point.lng,
        scans: point.scans || 1,
        risk: point.risk || 0,
      }))} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">Device intelligence (mobile taps)</h3>
          <p className="mt-1 text-xs text-slate-400">Modelos de celular/browser que están leyendo tus tags en calle y ratio de riesgo.</p>
          <div className="mt-4 space-y-2">
            {deviceSignals.length ? deviceSignals.map((device) => (
              <div key={device.device} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">{device.device}</p>
                  <p className="text-slate-300">{device.scans} taps</p>
                </div>
                <p className="mt-1 text-slate-400">
                  Países activos: <b className="text-slate-200">{device.countries}</b> · Valid rate: <b className="text-emerald-300">{device.validRate}%</b> · Riesgo: <b className="text-amber-200">{device.risk}</b>
                </p>
              </div>
            )) : (
              <p className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                Aún no hay señales de dispositivo suficientes para este tenant.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white">Traceability by tag (origin → current)</h3>
          <p className="mt-1 text-xs text-slate-400">Seguimiento por UID para ver dónde nació el tap y dónde está ahora cada botella.</p>
          <div className="mt-4 space-y-2">
            {tagJourney.length ? tagJourney.map((item) => (
              <div key={item.uid} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{item.uid}</p>
                  <p className="text-slate-300">{item.taps} taps</p>
                </div>
                <p className="mt-1 text-slate-300">
                  Origen: <b>{item.origin.city}, {item.origin.country}</b> → Ahora: <b>{item.current.city}, {item.current.country}</b>
                </p>
                <p className="mt-1 text-slate-400">
                  Primer tap: {formatDate(item.firstSeenAt)} · Último tap: {formatDate(item.lastSeenAt)} · Último dispositivo: {item.lastDevice}
                </p>
              </div>
            )) : (
              <p className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                Sin trazas suficientes todavía para construir journey por UID.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
