"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { OpsPanel, StatCard, StatusChip } from "@product/ui";
import { DemoOpsMap } from "./demo-ops-map";
import { DeviceRiskMatrix } from "./charts/device-risk-matrix";
import { RiskRadarChart } from "./charts/risk-radar-chart";
import { TapVelocityChart } from "./charts/tap-velocity-chart";
import { TopProductsTable } from "./charts/top-products-table";
import { TrustFunnelChart } from "./charts/trust-funnel-chart";
import { classifyEventAlertSeverity, matchesSeverityFilter } from "../lib/alert-severity";

const GlobalOpsMap = dynamic(() => import("@product/ui").then((mod) => mod.GlobalOpsMap), { ssr: false });

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
    kpis?: { scans?: number; validRate?: number; invalidRate?: number; duplicates?: number; tamper?: number; activeBatches?: number; activeTenants?: number; geoRegions?: number; resellerPerformance?: number; riskScore?: number };
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

function distanceKm(fromLat: number | null, fromLng: number | null, toLat: number | null, toLng: number | null) {
  if (fromLat == null || fromLng == null || toLat == null || toLng == null) return null;
  const radiusKm = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value)} km`;
}

function mapHref(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function AnalyticsPanels({ kpis, extra, data, mapMode = "demo" }: AnalyticsPanelsProps) {
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [riskCategoryFilter, setRiskCategoryFilter] = useState<string>("ALL");
  const [feedSeverityFilter, setFeedSeverityFilter] = useState<string>("all");
  const api = data?.kpis || {};
  const trend = data?.trend || [];
  const countries = data?.geography?.countries || [];
  const cities = data?.geography?.cities || [];
  const deviceSignals = data?.deviceSignals || [];
  const feed = data?.feed || [];
  const products = data?.products || [];
  const tagJourney = data?.tagJourney || [];
  const devices = data?.devices;
  const productByUid = useMemo(() => new Map(products.map((product) => [String(product.uidHex || "").toUpperCase(), product])), [products]);
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
    `Risk Score calculado para este periodo: ${api.riskScore || 0}/100.`,
    `Prioridad sugerida: ${riskSignals > 0 ? "investigar outliers de riesgo y reforzar onboarding operativo" : "escalar escaneos reales y ampliar cobertura comercial del pasaporte digital"}.`,
  ];
  const hasOperationalData = scansTotal > 0 || trend.length > 0 || feed.length > 0 || products.length > 0 || tagJourney.length > 0;
  const filteredFeed = useMemo(() => feed.filter((item) => {
    const dayMatch = selectedDay ? String(item.createdAt || "").includes(selectedDay) : true;
    const riskMatch = riskCategoryFilter === "ALL"
      ? true
      : riskCategoryFilter === "Replay / duplicates"
      ? ["DUPLICATE", "REPLAY_SUSPECT"].includes(String(item.result || "").toUpperCase())
      : riskCategoryFilter === "Tamper alerts"
      ? ["TAMPER", "TAMPERED", "OPENED"].includes(String(item.result || "").toUpperCase())
      : true;
    const severity = classifyEventAlertSeverity(item.result);
    const severityMatch = matchesSeverityFilter(severity, feedSeverityFilter);
    return dayMatch && riskMatch && severityMatch;
  }), [feed, feedSeverityFilter, riskCategoryFilter, selectedDay]);
  const trustFunnel = useMemo(() => {
    const taps = scansTotal;
    const valid = Math.round(taps * ((api.validRate || 0) / 100));
    const claims = Math.min(valid, Math.max(0, tagJourney.length));
    const warranty = Math.round(claims * 0.35);
    const marketplace = Math.round(claims * 0.2);
    return [
      { stage: "Tap", value: taps },
      { stage: "Valid passport", value: valid },
      { stage: "Claim", value: claims },
      { stage: "Warranty", value: warranty },
      { stage: "Marketplace", value: marketplace },
    ];
  }, [api.validRate, scansTotal, tagJourney.length]);
  const journeyMapPoints = tagJourney.flatMap((item, idx) => {
    const product = productByUid.get(String(item.uid || "").toUpperCase());
    const originPoint = item.origin.lat != null && item.origin.lng != null
      ? [{
        id: `${item.uid}-origin-${idx}`,
        city: item.origin.city || "Origin",
        country: item.origin.country || "--",
        lat: Number(item.origin.lat),
        lng: Number(item.origin.lng),
        scans: item.taps,
        risk: 0,
        verdict: "ORIGIN",
        tenantSlug: "tenant",
        lastSeen: item.firstSeenAt || item.lastSeenAt || new Date().toISOString(),
        uid: item.uid,
        device: item.lastDevice || "unknown",
        role: "origin" as const,
        productName: product?.productName,
      }]
      : [];
    const currentPoint = item.current.lat != null && item.current.lng != null
      ? [{
        id: `${item.uid}-current-${idx}`,
        city: item.current.city || "Current",
        country: item.current.country || "--",
        lat: Number(item.current.lat),
        lng: Number(item.current.lng),
        scans: item.taps,
        risk: item.taps > 20 ? 0 : 1,
        verdict: item.taps > 20 ? "VALID" : "RISK",
        tenantSlug: "tenant",
        lastSeen: item.lastSeenAt || new Date().toISOString(),
        uid: item.uid,
        device: item.lastDevice || "unknown",
        role: "tap" as const,
        productName: product?.productName,
      }]
      : [];
    return [...originPoint, ...currentPoint];
  });
  const journeyRoutes = tagJourney
    .filter((item) => item.origin.lat != null && item.origin.lng != null && item.current.lat != null && item.current.lng != null)
    .slice(0, 120)
    .map((item, idx) => {
      const product = productByUid.get(String(item.uid || "").toUpperCase());
      return {
        id: `journey-route-${idx}-${item.uid}`,
        fromLat: Number(item.origin.lat),
        fromLng: Number(item.origin.lng),
        toLat: Number(item.current.lat),
        toLng: Number(item.current.lng),
        uid: item.uid,
        risk: item.taps > 20 ? 0 : 1,
        taps: item.taps,
        firstSeenAt: item.firstSeenAt || item.lastSeenAt || new Date().toISOString(),
        lastSeenAt: item.lastSeenAt || new Date().toISOString(),
        fromLabel: `${item.origin.city || "Origin"}, ${item.origin.country || "--"}`,
        toLabel: `${item.current.city || "Tap"}, ${item.current.country || "--"}`,
        productName: product?.productName,
      };
    });

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
        <OpsPanel title={kpis.trendTitle} subtitle="Volumen y señales de riesgo en el rango seleccionado. Click en un punto para filtrar feed.">
          {!trend.length ? <p className="text-sm text-slate-400">Sin datos para el período seleccionado.</p> : (
            <TapVelocityChart data={trend} onSelectDay={setSelectedDay} />
          )}
          {selectedDay ? <p className="mt-2 text-xs text-cyan-200">Drill-down day activo: {selectedDay}</p> : null}
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
          <div className="mt-4">
            <TrustFunnelChart data={trustFunnel} />
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
          <div className="mt-3">
            <DeviceRiskMatrix rows={deviceSignals} />
          </div>
        </OpsPanel>
      </div>

      <DemoOpsMap mode={mapMode} points={(data?.geoPoints || []).map((point) => ({ city: point.city, country: point.country || "--", lat: point.lat, lng: point.lng, scans: point.scans || 1, risk: point.risk || 0 }))} />
      <OpsPanel title="Journey map (tenant premium taps)" subtitle="Origen del producto vs tap actual del cliente, con distancia estimada, linea punteada y links a ubicacion.">
        {journeyMapPoints.length ? (
          <GlobalOpsMap
            mode={mapMode === "global" ? "global" : "tenant"}
            points={journeyMapPoints}
            routes={journeyRoutes}
            playbackEnabled
            riskOnly={false}
          />
        ) : <p className="text-sm text-slate-400">Sin coordenadas suficientes para dibujar journeys todavía.</p>}
      </OpsPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <OpsPanel title="Live tap feed" subtitle="Actividad reciente y contexto operativo real.">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-300">
            <p>Badge automático de alerta por severidad derivada del evento.</p>
            <label>
              Severity
              <select value={feedSeverityFilter} onChange={(event) => setFeedSeverityFilter(event.target.value)} className="ml-2 rounded border border-white/10 bg-slate-950 px-2 py-1 text-slate-100">
                <option value="all">all</option>
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="none">none</option>
              </select>
            </label>
          </div>
          <div className="space-y-2">
            {(filteredFeed.length ? filteredFeed : []).slice(0, 10).map((item) => {
              const severity = classifyEventAlertSeverity(item.result);
              const tone = severity === "critical" ? "risk" : severity === "high" ? "warn" : severity === "medium" ? "neutral" : "good";
              return (
                <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                  <p className="flex flex-wrap items-center gap-2"><b>{item.result}</b> · {item.uidHex} · {item.bid} {severity !== "none" ? <StatusChip label={`alert ${severity}`} tone={tone} /> : null}</p>
                  <p className="text-slate-400">{item.city}, {item.country} · {item.device} · {fmtDate(item.createdAt)}</p>
                </div>
              );
            })}
            {!filteredFeed.length ? <p className="text-sm text-slate-400">Sin eventos recientes para este scope/filtro.</p> : null}
          </div>
        </OpsPanel>

        <OpsPanel title="Top tags / products" subtitle="Activos con más lecturas, última ubicación verificada y tokenización.">
          <TopProductsTable items={products} />
        </OpsPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <OpsPanel title="Risk radar (operational)" subtitle="Semáforo rápido por dimensión crítica del tenant.">
          <RiskRadarChart data={riskRadar} onSelectCategory={(label) => setRiskCategoryFilter(label)} />
          <p className="mt-2 text-xs text-cyan-200">Drill-down risk: {riskCategoryFilter}</p>
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
            {tagJourney.map((item) => {
              const product = productByUid.get(String(item.uid || "").toUpperCase());
              const distance = distanceKm(item.origin.lat, item.origin.lng, item.current.lat, item.current.lng);
              const originHref = mapHref(item.origin.lat, item.origin.lng);
              const currentHref = mapHref(item.current.lat, item.current.lng);
              return (
                <div key={item.uid} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{product?.productName || item.uid}</p>
                    <p>{item.taps} taps - {fmtDistance(distance)}</p>
                  </div>
                  <p className="mt-1 text-slate-300">Origen: <b>{item.origin.city}, {item.origin.country}</b> - tap actual: <b>{item.current.city}, {item.current.country}</b></p>
                  <p className="text-slate-400">Primer tap: {fmtDate(item.firstSeenAt)} - ultimo tap: {fmtDate(item.lastSeenAt)} - {item.lastDevice}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {originHref ? <a href={originHref} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/30 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-400/10">Ver origen</a> : null}
                    {currentHref ? <a href={currentHref} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/30 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-400/10">Ver tap</a> : null}
                  </div>
                </div>
              );
            })}
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
