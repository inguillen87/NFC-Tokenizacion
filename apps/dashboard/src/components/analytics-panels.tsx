"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OpsPanel, StatCard, StatusChip, WorldMapPlaceholder } from "@product/ui";
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

function pct(value: number, total: number) {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
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
  const scansTotal = Number(api.scans || 0);
  const riskSignals = Number(api.duplicates || 0) + Number(api.tamper || 0);
  const journeyCoverage = tagJourney.length ? Math.min(100, (tagJourney.length / Math.max(products.length, 1)) * 100) : 0;
  const riskRadar = [
    { label: "Replay / duplicates", value: Number(api.duplicates || 0), max: Math.max(scansTotal, 1) },
    { label: "Tamper alerts", value: Number(api.tamper || 0), max: Math.max(scansTotal, 1) },
    { label: "Geo dispersion", value: Number(api.geoRegions || 0), max: 20 },
    { label: "Device anomalies", value: deviceSignals.filter((item) => item.risk >= 8).length, max: Math.max(deviceSignals.length, 1) },
  ];
  const aiSummary = [
    `Se registraron ${scansTotal} taps en el scope actual, con ${(api.validRate ?? 0).toFixed(1)}% de validación.`,
    `Las señales de riesgo (duplicados + tamper) son ${riskSignals} (${pct(riskSignals, Math.max(scansTotal, 1))}).`,
    `La cobertura de journey trazable alcanza ${journeyCoverage.toFixed(1)}% en ${tagJourney.length} UIDs.`,
    `Prioridad sugerida: ${riskSignals > 0 ? "investigar outliers de riesgo y reforzar onboarding operativo" : "escalar escaneos reales y ampliar cobertura comercial del pasaporte digital"}.`,
  ];
  const hasOperationalData = scansTotal > 0 || trend.length > 0 || feed.length > 0 || products.length > 0 || tagJourney.length > 0;
  const journeyMapPoints = tagJourney.flatMap((item) => {
    const originPoint = item.origin.lat != null && item.origin.lng != null
      ? [{
        city: item.origin.city || "Origin",
        country: item.origin.country || "--",
        lat: Number(item.origin.lat),
        lng: Number(item.origin.lng),
        scans: item.taps,
        risk: 0,
        status: "ORIGIN",
        source: "tag_origin",
      }]
      : [];
    const currentPoint = item.current.lat != null && item.current.lng != null
      ? [{
        city: item.current.city || "Current",
        country: item.current.country || "--",
        lat: Number(item.current.lat),
        lng: Number(item.current.lng),
        scans: item.taps,
        risk: item.taps > 20 ? 0 : 1,
        status: "CURRENT",
        source: "last_verified",
      }]
      : [];
    return [...originPoint, ...currentPoint];
  });
  const journeyRoutes = tagJourney
    .filter((item) => item.origin.lat != null && item.origin.lng != null && item.current.lat != null && item.current.lng != null)
    .slice(0, 24)
    .map((item) => ({
      fromLat: Number(item.origin.lat),
      fromLng: Number(item.origin.lng),
      toLat: Number(item.current.lat),
      toLng: Number(item.current.lng),
      label: item.uid,
      tone: item.taps > 20 ? "info" as const : "warn" as const,
    }));

  if (!hasOperationalData) {
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

        <OpsPanel title="Operational storytelling board" subtitle="Lectura ejecutiva multi-tenant para operaciones, riesgo y trazabilidad comercial.">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Operational throughput</p><p className="mt-1 text-2xl font-semibold text-cyan-200">{api.scans ?? 0}</p></div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Trust posture</p><p className="mt-1 text-2xl font-semibold text-emerald-300">{(api.validRate ?? 0).toFixed(1)}%</p></div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Risk density</p><p className="mt-1 text-2xl font-semibold text-amber-200">{pct(riskSignals, scansTotal)}</p></div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Journey coverage</p><p className="mt-1 text-2xl font-semibold text-indigo-200">{journeyCoverage.toFixed(1)}%</p></div>
          </div>
        </OpsPanel>
        <OpsPanel title="Resumen IA ejecutivo" subtitle="Resumen accionable para owner/admin con exportación PDF por impresión.">
          <div className="space-y-2 text-sm text-slate-200">
            {aiSummary.map((line) => <p key={line}>• {line}</p>)}
          </div>
          <button type="button" onClick={() => window.print()} className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20">
            Exportar PDF (imprimir reporte)
          </button>
        </OpsPanel>

        <OpsPanel title="No operational data yet" subtitle="Todavía no hay escaneos reales en el scope elegido.">
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Confirmá tenant/source/rango/country en filtros.</li>
            <li>• Validá que existan eventos SUN reales para este tenant.</li>
            <li>• Si estás onboardeando, escaneá 1-2 NFC activos para inicializar el feed.</li>
          </ul>
        </OpsPanel>
      </div>
    );
  }

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

      <OpsPanel title="Operational storytelling board" subtitle="Lectura ejecutiva multi-tenant para operaciones, riesgo y trazabilidad comercial.">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Operational throughput</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-200">{api.scans ?? 0}</p>
            <p className="text-xs text-slate-400">Taps totales en el scope actual.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Trust posture</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{(api.validRate ?? 0).toFixed(1)}%</p>
            <p className="text-xs text-slate-400">Validación autenticada sobre taps.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Risk density</p>
            <p className="mt-1 text-2xl font-semibold text-amber-200">{pct(riskSignals, scansTotal)}</p>
            <p className="text-xs text-slate-400">{riskSignals} señales de riesgo (dup + tamper).</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Journey coverage</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-200">{journeyCoverage.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">UIDs con historia de origen/destino visible.</p>
          </div>
        </div>
      </OpsPanel>
      <OpsPanel title="Resumen IA ejecutivo" subtitle="Resumen accionable para owner/admin con exportación PDF por impresión.">
        <div className="space-y-2 text-sm text-slate-200">
          {aiSummary.map((line) => <p key={line}>• {line}</p>)}
        </div>
        <button type="button" onClick={() => window.print()} className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20">
          Exportar PDF (imprimir reporte)
        </button>
      </OpsPanel>

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

      <OpsPanel title="Operational storytelling board" subtitle="Lectura ejecutiva multi-tenant para operaciones, riesgo y trazabilidad comercial.">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Operational throughput</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-200">{api.scans ?? 0}</p>
            <p className="text-xs text-slate-400">Taps totales en el scope actual.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Trust posture</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{(api.validRate ?? 0).toFixed(1)}%</p>
            <p className="text-xs text-slate-400">Validación autenticada sobre taps.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Risk density</p>
            <p className="mt-1 text-2xl font-semibold text-amber-200">{pct(riskSignals, scansTotal)}</p>
            <p className="text-xs text-slate-400">{riskSignals} señales de riesgo (dup + tamper).</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Journey coverage</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-200">{journeyCoverage.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">UIDs con historia de origen/destino visible.</p>
          </div>
        </div>
      </OpsPanel>

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
      <OpsPanel title="Journey map (tenant premium taps)" subtitle="Mapa interactivo de origen de bodega vs última ubicación verificada por UID, con rutas animadas.">
        {journeyMapPoints.length ? (
          <WorldMapPlaceholder
            title="Recorrido de activos premium"
            subtitle="Cada ruta muestra origen inicial y último tap verificado para clientes del tenant."
            points={journeyMapPoints}
            routes={journeyRoutes}
          />
        ) : <p className="text-sm text-slate-400">Sin coordenadas suficientes para dibujar journeys todavía.</p>}
      </OpsPanel>

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
        <OpsPanel title="Risk radar (operational)" subtitle="Semáforo rápido por dimensión crítica del tenant.">
          <div className="space-y-3">
            {riskRadar.map((item) => {
              const ratio = Math.max(0, Math.min(100, (item.value / Math.max(item.max, 1)) * 100));
              const tone = ratio >= 40 ? "bg-rose-500/70" : ratio >= 20 ? "bg-amber-400/70" : "bg-emerald-400/70";
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                    <span>{item.label}</span>
                    <span>{item.value} · {ratio.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className={`h-2 rounded-full ${tone}`} style={{ width: `${ratio}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </OpsPanel>

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

      <OpsPanel title="Traceability lane by UID" subtitle="Journey visual para storytelling comercial y auditoría operacional por activo.">
        <div className="space-y-3">
          {tagJourney.slice(0, 8).map((item) => (
            <div key={`lane-${item.uid}`} className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-200">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">{item.uid}</p>
                <StatusChip label={`${item.taps} taps`} tone={item.taps > 20 ? "good" : "neutral"} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-slate-300">
                <span className="rounded bg-emerald-500/20 px-2 py-1 text-[11px]">{item.origin.city}, {item.origin.country}</span>
                <span className="text-slate-500">→</span>
                <span className="rounded bg-cyan-500/20 px-2 py-1 text-[11px]">{item.current.city}, {item.current.country}</span>
                <span className="ml-auto text-slate-400">{item.lastDevice}</span>
              </div>
            </div>
          ))}
          {!tagJourney.length ? <p className="text-sm text-slate-400">Sin journeys para construir lane visual.</p> : null}
        </div>
      </OpsPanel>
    </div>
  );
}
