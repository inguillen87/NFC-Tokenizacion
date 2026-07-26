"use client";

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { OpsPanel, StatCard, StatusChip } from "@product/ui";
import { DemoOpsMap } from "./demo-ops-map";
import { DeviceRiskMatrix } from "./charts/device-risk-matrix";
import { RiskRadarChart } from "./charts/risk-radar-chart";
import { TapVelocityChart } from "./charts/tap-velocity-chart";
import { TopProductsTable } from "./charts/top-products-table";
import { TrustFunnelChart } from "./charts/trust-funnel-chart";
import { classifyEventAlertSeverity, matchesSeverityFilter } from "../lib/alert-severity";
import { formatAnalyticsPercentage, resolveMobileSharePercent } from "../lib/analytics-percentage";
import {
  describeCognitiveSummary,
  deterministicCognitiveSummary,
  resolveCognitiveSummaryDelivery,
  type CognitiveSummaryDelivery,
} from "../lib/cognitive-summary-contract";

const GlobalOpsMap = dynamic(() => import("@product/ui/global-ops-map").then((mod) => mod.GlobalOpsMap), { ssr: false });

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
    kpis?: { scans?: number; validRate?: number; invalidRate?: number; duplicates?: number; tamper?: number; activeBatches?: number; activeTenants?: number; geoRegions?: number; resellerPerformance?: number | null; riskScore?: number };
    billing?: { resellerMrrAmount?: number | null; currency?: string | null; source?: string | null; period?: string | null };
    trend?: Array<{ day: string; scans: number; duplicates: number; tamper: number }>;
    batchStatus?: Array<{ name: string; value: number }>;
    geoPoints?: Array<{ city: string; country?: string; scans?: number; risk?: number; lat: number; lng: number }>;
    deviceSignals?: Array<{ device: string; scans: number; countries: number; validRate: number; risk: number }>;
    geography?: { countries?: Array<{ country: string; scans: number; risk: number }>; cities?: Array<{ city: string; country: string; lat: number | null; lng: number | null; scans: number; risk: number; lastSeen: string | null }> };
    devices?: { os?: Array<{ label: string; count: number }>; browser?: Array<{ label: string; count: number }>; deviceType?: Array<{ label: string; count: number }>; timezones?: Array<{ label: string; count: number }>; mobileShare?: number };
    feed?: Array<{ id: number; uidHex: string; bid: string; result: string; city: string; country: string; device: string; createdAt: string }>;
    products?: Array<{ uidHex: string; bid: string; productName: string; winery: string; region: string; vintage: string; scanCount: number; firstSeenAt: string | null; lastSeenAt: string | null; lastVerifiedCity: string; lastVerifiedCountry: string; tokenization: { status: string; network: string; txHash: string | null; tokenId: string | null } }>;
    tagJourney?: Array<{ uid: string; taps: number; firstSeenAt: string | null; lastSeenAt: string | null; originSource?: string | null; origin: { city: string; country: string; lat: number | null; lng: number | null }; current: { city: string; country: string; lat: number | null; lng: number | null }; lastDevice: string }>;
  };
  mapMode?: "demo" | "tenant" | "global";
  dataSource: "production" | "demo" | "imported" | "mixed";
  sourceDetail: string;
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

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadBlob(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function analyticsCsvRows(data: AnalyticsPanelsProps["data"]) {
  const rows: Array<Record<string, unknown>> = [];
  const api = data?.kpis || {};
  rows.push({ section: "kpi", metric: "scans", value: api.scans || 0 });
  rows.push({ section: "kpi", metric: "validRate", value: typeof api.validRate === "number" ? api.validRate : "N/D" });
  rows.push({ section: "kpi", metric: "duplicates", value: api.duplicates || 0 });
  rows.push({ section: "kpi", metric: "tamper", value: api.tamper || 0 });
  (data?.feed || []).forEach((item) => rows.push({ section: "feed", metric: item.uidHex, value: item.result, city: item.city, country: item.country, createdAt: item.createdAt }));
  (data?.products || []).forEach((item) => rows.push({ section: "product", metric: item.uidHex, value: item.scanCount, product: item.productName, lastCity: item.lastVerifiedCity, token: item.tokenization?.status }));
  (data?.tagJourney || []).forEach((item) => rows.push({ section: "journey", metric: item.uid, value: item.taps, originSource: item.originSource || "unreported", origin: `${item.origin.city}, ${item.origin.country}`, current: `${item.current.city}, ${item.current.country}` }));
  return rows;
}

function buildAnalyticsCsv(data: AnalyticsPanelsProps["data"]) {
  const rows = analyticsCsvRows(data);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const header = columns.map(escapeCsv).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(",")).join("\n");
  return `${header}\n${body}`;
}

function buildAnalyticsExcel(data: AnalyticsPanelsProps["data"]) {
  const rows = analyticsCsvRows(data);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const header = columns.map((column) => `<th>${column}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${String(row[column] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8" /><title>nexID analytics</title></head><body><table border="1"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

function AnalyticsExportActions({ data }: { data?: AnalyticsPanelsProps["data"] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button suppressHydrationWarning type="button" onClick={() => downloadBlob("nexid-analytics.csv", "text/csv;charset=utf-8", buildAnalyticsCsv(data))} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20">Export CSV</button>
      <button suppressHydrationWarning type="button" onClick={() => downloadBlob("nexid-analytics.xls", "application/vnd.ms-excel;charset=utf-8", buildAnalyticsExcel(data))} className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20">Export Excel</button>
      <button suppressHydrationWarning type="button" onClick={() => window.print()} className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/20">Export PDF</button>
    </div>
  );
}

function isDeclaredProductOrigin(originSource?: string | null) {
  return String(originSource || "").trim().toLowerCase() === "product_passport_declared";
}

function journeyInitialPointLabel(originSource?: string | null) {
  const source = String(originSource || "").trim().toLowerCase();
  if (source === "product_passport_declared") return "Origen declarado";
  if (source === "first_observed_event") return "Primer tap reportado";
  return "Punto inicial reportado (fuente no clasificada)";
}

type GeoOfferSource = {
  city: string;
  country?: string;
  scans?: number;
  risk?: number;
  lat: number | null;
  lng: number | null;
  lastSeen?: string | null;
};

function GamificationGeoOfferStudio({
  cities,
  geoPoints,
  mapMode,
}: {
  cities: GeoOfferSource[];
  geoPoints: GeoOfferSource[];
  mapMode: "demo" | "tenant" | "global";
}) {
  const baseClaimRate = 0.14;
  const boostedClaimRate = 0.22;
  const pointsPerTap = 10;
  const [multipliers, setMultipliers] = useState<Record<string, number>>({});
  const rows = useMemo(() => {
    const source = cities.length ? cities : geoPoints;
    return source
      .filter((item) => typeof item.lat === "number" && typeof item.lng === "number")
      .map((item) => {
        const key = `${item.city}-${item.country || "--"}`.toLowerCase();
        return {
          key,
          city: item.city || "Unknown",
          country: item.country || "--",
          lat: Number(item.lat),
          lng: Number(item.lng),
          scans: Number(item.scans || 0),
          risk: Number(item.risk || 0),
          lastSeen: item.lastSeen || "",
          multiplier: multipliers[key] || 1,
        };
      })
      .sort((a, b) => b.scans - a.scans)
      .slice(0, 8);
  }, [cities, geoPoints, multipliers]);
  const totalScans = rows.reduce((sum, row) => sum + row.scans, 0);
  const projectedClaims = rows.reduce((sum, row) => sum + Math.round(row.scans * (row.multiplier > 1 ? boostedClaimRate : baseClaimRate)), 0);
  const projectedPoints = rows.reduce((sum, row) => sum + Math.round(row.scans * row.multiplier * pointsPerTap), 0);
  const mapPoints = rows.map((row) => ({
    id: `geo-offer-${row.key}`,
    city: row.city,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
    scans: Math.max(row.scans, 1),
    risk: row.risk,
    verdict: row.risk > 0 ? "RISK" : "VALID",
    tenantSlug: "geo-offers",
    lastSeen: row.lastSeen,
    uid: row.key,
    role: "tap" as const,
    productName: `Loyalty x${row.multiplier}`,
  }));

  function setMultiplier(key: string, multiplier: number) {
    setMultipliers((current) => ({ ...current, [key]: multiplier }));
  }

  return (
    <OpsPanel title="Gamification & geotargeted offers studio" subtitle="Simulación de multiplicadores sobre los puntos del dataset visible. No ejecuta campañas ni implica geolocalización continua.">
      {!rows.length ? (
        <p className="text-sm text-slate-400">Sin coordenadas suficientes para activar ofertas por zona. Hace un tap con GPS o revisa la resolucion de ciudad.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
          <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
            <GlobalOpsMap
              title="Heatmap de ofertas localizadas"
              subtitle="Hotspots, recurrencia y zonas candidatas para puntos extra."
              mode={mapMode}
              points={mapPoints}
              routes={[]}
              playbackEnabled={false}
              riskOnly={false}
            />
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                <p className="uppercase tracking-[0.12em] text-cyan-200/80">Taps base</p>
                <p className="mt-1 text-lg font-semibold">{totalScans}</p>
              </div>
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                <p className="uppercase tracking-[0.12em] text-emerald-200/80">Claims simulados</p>
                <p className="mt-1 text-lg font-semibold">{projectedClaims}</p>
              </div>
              <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 p-3 text-xs text-violet-100">
                <p className="uppercase tracking-[0.12em] text-violet-200/80">Puntos simulados</p>
                <p className="mt-1 text-lg font-semibold">{projectedPoints}</p>
              </div>
            </div>
            <div className="space-y-2">
              {rows.slice(0, 6).map((row) => (
                <div key={row.key} className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{row.city}, {row.country}</p>
                      <p className="text-slate-400">{row.scans} taps - risk {row.risk}</p>
                    </div>
                    <StatusChip label={`x${row.multiplier}`} tone={row.multiplier > 1 ? "good" : "neutral"} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[1, 1.5, 2, 3].map((value) => (
                      <button
                        key={`${row.key}-${value}`}
                        type="button"
                        suppressHydrationWarning
                        onClick={() => setMultiplier(row.key, value)}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${row.multiplier === value ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100" : "border-white/10 bg-white/5 text-slate-300 hover:text-white"}`}
                      >
                        x{value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-100">
              Modelo editable sólo por multiplicador: claim base 14%, claim con incentivo 22% y 10 puntos por tap antes del multiplicador. No son conversiones observadas ni una audiencia contactable.
            </p>
          </div>
        </div>
      )}
    </OpsPanel>
  );
}

export function AnalyticsPanels({ kpis, extra, data, mapMode = "demo", dataSource, sourceDetail }: AnalyticsPanelsProps) {
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [riskCategoryFilter, setRiskCategoryFilter] = useState<string>("ALL");
  const [feedSeverityFilter, setFeedSeverityFilter] = useState<string>("all");
  const [dynamicSummary, setDynamicSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [summaryDelivery, setSummaryDelivery] = useState<CognitiveSummaryDelivery>(() => deterministicCognitiveSummary());

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
  const cityLastSeenByKey = useMemo(
    () => new Map(cities.map((item) => [`${String(item.city || "").trim().toLowerCase()}|${String(item.country || "--").trim().toUpperCase()}`, item.lastSeen || ""])),
    [cities],
  );
  const scansTotal = Number(api.scans || 0);
  const validRate = typeof api.validRate === "number" && Number.isFinite(api.validRate)
    ? Math.min(100, Math.max(0, api.validRate))
    : null;
  const invalidRate = typeof api.invalidRate === "number" && Number.isFinite(api.invalidRate)
    ? Math.min(100, Math.max(0, api.invalidRate))
    : null;
  const riskScore = typeof api.riskScore === "number" && Number.isFinite(api.riskScore)
    ? Math.min(100, Math.max(0, api.riskScore))
    : null;
  const riskSignals = Number(api.duplicates || 0) + Number(api.tamper || 0);
  const billingAmount = typeof data?.billing?.resellerMrrAmount === "number" && Number.isFinite(data.billing.resellerMrrAmount)
    ? data.billing.resellerMrrAmount
    : null;
  const billingSource = String(data?.billing?.source || "").trim();
  const billingCurrencyCandidate = String(data?.billing?.currency || "USD").trim().toUpperCase();
  const billingCurrency = /^[A-Z]{3}$/.test(billingCurrencyCandidate) ? billingCurrencyCandidate : "USD";
  const billingConfirmed = billingAmount !== null && Boolean(billingSource);
  const resellerRevenueDisplay = billingConfirmed
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: billingCurrency, maximumFractionDigits: 0 }).format(billingAmount)
    : "N/D";
  const resellerRevenueDetail = billingConfirmed
    ? `Fuente billing: ${billingSource}${data?.billing?.period ? ` · ${data.billing.period}` : ""}`
    : extra.resellerPerformanceDelta;
  const validityDisplay = scansTotal > 0 && validRate != null && invalidRate != null
    ? `${validRate} / ${invalidRate}`
    : "N/D";
  const riskRate = scansTotal > 0 ? pct(riskSignals, scansTotal) : "sin base";
  const journeyCoverage = products.length > 0 ? Math.min(100, (tagJourney.length / products.length) * 100) : null;
  const mobileSharePercent = resolveMobileSharePercent(devices?.deviceType || [], devices?.mobileShare);

  const metricText = `Taps totales: ${scansTotal}. Tasa de mensajes validos: ${validRate == null ? "N/D" : `${validRate.toFixed(1)}%`}. Tasa de resultados INVALID explicitos: ${invalidRate == null ? "N/D" : `${invalidRate.toFixed(1)}%`}. Duplicados/replay: ${api.duplicates ?? 0}. Senales TT/tamper reportadas: ${api.tamper ?? 0}. Regiones geograficas reportadas: ${api.geoRegions ?? 0}. Score de riesgo general: ${riskScore == null ? "N/D" : `${riskScore}/100`}.`;

  useEffect(() => {
    if (!scansTotal) {
      setDynamicSummary("");
      setSummaryDelivery(deterministicCognitiveSummary("not_requested"));
      setLoadingSummary(false);
      return;
    }
    let cancelled = false;
    setLoadingSummary(true);
    setDynamicSummary("");
    setSummaryDelivery(deterministicCognitiveSummary("provider_request_pending"));
    fetch("/api/cognitive-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: metricText,
        tone: "executive-summary",
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Status: " + res.status);
        return res.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const delivery = resolveCognitiveSummaryDelivery(payload);
        setSummaryDelivery(delivery);
        setDynamicSummary(delivery.mode === "live_provider" ? delivery.text : "");
      })
      .catch(() => {
        if (!cancelled) {
          setDynamicSummary("");
          setSummaryDelivery(deterministicCognitiveSummary("provider_request_failed"));
        }
        console.info("[ops_copilot] provider unavailable; deterministic summary selected");
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scansTotal, validRate, invalidRate, api.duplicates, api.tamper, api.geoRegions, riskScore]);

  const riskRadar = [
    { label: "Replay / duplicates", value: Number(api.duplicates || 0), max: Math.max(scansTotal, 1) },
    { label: "Tamper alerts", value: Number(api.tamper || 0), max: Math.max(scansTotal, 1) },
    { label: "Geo dispersion", value: Number(api.geoRegions || 0), max: 20 },
    { label: "Device anomalies", value: deviceSignals.filter((item) => item.risk >= 8).length, max: Math.max(deviceSignals.length, 1) },
  ];
  const aiSummary = [
    `Taps del scope actual: ${scansTotal}. Mensajes aceptados: ${validRate == null ? "N/D" : `${validRate.toFixed(1)}%`}.`,
    `Riesgo activo: ${riskSignals} senales entre duplicados y tamper (${riskRate}).`,
    `Risk Score: ${scansTotal > 0 && riskScore != null ? `${riskScore}/100` : "N/D"}.`,
    `Proxima accion: ${scansTotal <= 0 ? "capturar y confirmar el primer tap del scope" : riskSignals > 0 ? "abrir feed filtrado por riesgo y bloquear acciones comerciales sensibles" : "activar marketplace, club y puntos sobre taps validos"}.`,
  ];
  const summaryTruth = describeCognitiveSummary(summaryDelivery);
  const sourceLabel = dataSource === "production" ? "Producción confirmada" : dataSource === "demo" ? "Demo identificada" : dataSource === "imported" ? "Importado identificado" : "Fuentes mixtas identificadas";
  const sourceTone = dataSource === "demo" ? "border-amber-300/30 bg-amber-500/10 text-amber-100" : "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";
  const sourceBanner = (
    <div data-analytics-source={dataSource} className={`rounded-2xl border p-4 ${sourceTone}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em]">{sourceLabel}</p>
      <p className="mt-1 text-xs opacity-80">{sourceDetail}</p>
    </div>
  );
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
    const measured = [{ stage: "Taps reportados", value: taps }];
    if (validRate != null) {
      measured.push({ stage: "Mensajes NFC válidos (derivado)", value: Math.round(taps * (validRate / 100)) });
    }
    return measured;
  }, [scansTotal, validRate]);
  const journeyMapPoints = tagJourney.flatMap((item, idx) => {
    const product = productByUid.get(String(item.uid || "").toUpperCase());
    const declaredOrigin = isDeclaredProductOrigin(item.originSource);
    const originPoint = item.origin.lat != null && item.origin.lng != null
      ? [{
        id: `${item.uid}-initial-${idx}`,
        city: item.origin.city || (declaredOrigin ? "Declared origin" : "First reported tap"),
        country: item.origin.country || "--",
        lat: Number(item.origin.lat),
        lng: Number(item.origin.lng),
        scans: item.taps,
        risk: 0,
        verdict: declaredOrigin ? "DECLARED_ORIGIN" : "FIRST_OBSERVED",
        tenantSlug: "tenant",
        lastSeen: item.firstSeenAt || item.lastSeenAt || "",
        uid: item.uid,
        device: item.lastDevice || "unknown",
        role: declaredOrigin ? "origin" as const : "tap" as const,
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
        risk: 0,
        verdict: "REPORTED",
        tenantSlug: "tenant",
        lastSeen: item.lastSeenAt || "",
        uid: item.uid,
        device: item.lastDevice || "unknown",
        role: "tap" as const,
        productName: product?.productName,
      }]
      : [];
    return [...originPoint, ...currentPoint];
  });
  const journeyRoutes = tagJourney
    .filter((item) => isDeclaredProductOrigin(item.originSource) && item.origin.lat != null && item.origin.lng != null && item.current.lat != null && item.current.lng != null)
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
        risk: 0,
        taps: item.taps,
        firstSeenAt: item.firstSeenAt || item.lastSeenAt || "",
        lastSeenAt: item.lastSeenAt || "",
        fromLabel: `Origen declarado: ${item.origin.city || "sin ciudad"}, ${item.origin.country || "--"}`,
        toLabel: `${item.current.city || "Tap"}, ${item.current.country || "--"}`,
        productName: product?.productName,
      };
    });
  const geoOfferPoints: GeoOfferSource[] = (data?.geoPoints || []).map((point) => ({
    city: point.city,
    country: point.country || "--",
    lat: point.lat,
    lng: point.lng,
    scans: point.scans || 0,
    risk: point.risk || 0,
    lastSeen: cityLastSeenByKey.get(`${String(point.city || "").trim().toLowerCase()}|${String(point.country || "--").trim().toUpperCase()}`) || null,
  }));

  if (!hasOperationalData) {
    return (
      <div className="space-y-6">
        {sourceBanner}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Exportaciones</p>
              <p className="mt-1 text-xs text-slate-400">Datos del scope activo.</p>
            </div>
            <AnalyticsExportActions data={data} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={kpis.scans} value={String(api.scans ?? 0)} delta={kpis.scansDelta} tone="good" />
          <StatCard label={kpis.validInvalid} value={validityDisplay} delta={kpis.validInvalidDelta} tone="good" />
          <StatCard label={kpis.duplicates} value={String(api.duplicates ?? 0)} delta={kpis.duplicatesDelta} tone="warn" />
          <StatCard label={kpis.tamper} value={String(api.tamper ?? 0)} delta={kpis.tamperDelta} tone="warn" />
          <StatCard label={extra.activeBatches} value={String(api.activeBatches ?? 0)} delta={extra.activeBatchesDelta} tone="good" />
          <StatCard label={extra.activeTenants} value={String(api.activeTenants ?? 0)} delta={extra.activeTenantsDelta} tone="good" />
          <StatCard label={extra.resellerPerformance} value={resellerRevenueDisplay} delta={resellerRevenueDetail} />
          <StatCard label={extra.geoDistribution} value={`${api.geoRegions ?? 0} regions`} delta={extra.geoDistributionDelta} />
        </div>

        <OpsPanel title="Control operativo" subtitle="KPIs del scope activo. Sin datos reales, no se inventa actividad.">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Taps</p><p className="mt-1 text-2xl font-semibold text-cyan-200">{api.scans ?? 0}</p></div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Mensajes válidos</p><p className="mt-1 text-2xl font-semibold text-emerald-300">{scansTotal > 0 && validRate != null ? `${validRate.toFixed(1)}%` : "N/D"}</p></div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Riesgo</p><p className="mt-1 text-2xl font-semibold text-amber-200">{riskRate}</p></div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Cobertura</p><p className="mt-1 text-2xl font-semibold text-indigo-200">{journeyCoverage == null ? "sin base" : `${journeyCoverage.toFixed(1)}%`}</p></div>
          </div>
        </OpsPanel>
        <OpsPanel title="Ops Copilot (AI Summary)" subtitle={summaryTruth.subtitle}>
          <p className={`mb-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${summaryDelivery.mode === "live_provider" ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : "border-amber-300/25 bg-amber-500/10 text-amber-100"}`}>
            {summaryTruth.badge}
          </p>
          {loadingSummary ? (
            <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>Consultando proveedor; el resumen determinístico permanece disponible.</span>
            </div>
          ) : dynamicSummary ? (
            <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950/60 border border-white/5 rounded-2xl p-4">
              {dynamicSummary}
            </div>
          ) : (
            <div className="space-y-2 text-xs text-slate-300">
              {aiSummary.map((line) => <p key={line}>- {line}</p>)}
            </div>
          )}
          <button suppressHydrationWarning type="button" onClick={() => window.print()} className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20">
            Exportar PDF (imprimir reporte)
          </button>
        </OpsPanel>

        <GamificationGeoOfferStudio cities={cities} geoPoints={geoOfferPoints} mapMode={mapMode} />

        <OpsPanel title="Dataset vacío confirmado" subtitle={`No hay escaneos en ${sourceLabel.toLowerCase()} para el scope elegido.`}>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>- Revisar tenant, source, rango y pais en filtros.</li>
            <li>- Confirmar que existan eventos SUN reales para este tenant.</li>
            <li>- Escanear 1 NFC activo para inicializar feed, mapa y analytics.</li>
          </ul>
        </OpsPanel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sourceBanner}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Exportaciones</p>
            <p className="mt-1 text-xs text-slate-400">KPIs, feed, productos y journeys del scope actual.</p>
          </div>
          <AnalyticsExportActions data={data} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={kpis.scans} value={String(api.scans ?? 0)} delta={kpis.scansDelta} tone="good" />
        <StatCard label={kpis.validInvalid} value={validityDisplay} delta={kpis.validInvalidDelta} tone="good" />
        <StatCard label={kpis.duplicates} value={String(api.duplicates ?? 0)} delta={kpis.duplicatesDelta} tone="warn" />
        <StatCard label={kpis.tamper} value={String(api.tamper ?? 0)} delta={kpis.tamperDelta} tone="warn" />
        <StatCard label={extra.activeBatches} value={String(api.activeBatches ?? 0)} delta={extra.activeBatchesDelta} tone="good" />
        <StatCard label={extra.activeTenants} value={String(api.activeTenants ?? 0)} delta={extra.activeTenantsDelta} tone="good" />
        <StatCard label={extra.resellerPerformance} value={resellerRevenueDisplay} delta={resellerRevenueDetail} />
        <StatCard label={extra.geoDistribution} value={`${api.geoRegions ?? 0} regions`} delta={extra.geoDistributionDelta} />
      </div>

      <OpsPanel title="Control operativo" subtitle={`Resumen calculado exclusivamente sobre ${sourceLabel.toLowerCase()}.`}>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Taps</p>
            <p className="mt-1 text-2xl font-semibold text-cyan-200">{api.scans ?? 0}</p>
            <p className="text-xs text-slate-400">Taps totales en el scope actual.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Confianza</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{validRate == null ? "N/D" : `${validRate.toFixed(1)}%`}</p>
            <p className="text-xs text-slate-400">Mensajes NFC aceptados por la política del scope.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Riesgo</p>
            <p className="mt-1 text-2xl font-semibold text-amber-200">{riskRate}</p>
            <p className="text-xs text-slate-400">{riskSignals} senales de riesgo (dup + tamper).</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Cobertura</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-200">{journeyCoverage == null ? "sin base" : `${journeyCoverage.toFixed(1)}%`}</p>
            <p className="text-xs text-slate-400">UIDs con puntos inicial y final reportados; no implica una ruta.</p>
          </div>
        </div>
      </OpsPanel>
      <OpsPanel title="Ops Copilot (AI Summary)" subtitle={summaryTruth.subtitle}>
        <p className={`mb-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${summaryDelivery.mode === "live_provider" ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : "border-amber-300/25 bg-amber-500/10 text-amber-100"}`}>
          {summaryTruth.badge}
        </p>
        {loadingSummary ? (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Consultando proveedor; el resumen determinístico permanece disponible.</span>
          </div>
        ) : dynamicSummary ? (
          <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950/60 border border-white/5 rounded-2xl p-4">
            {dynamicSummary}
          </div>
        ) : (
          <div className="space-y-2 text-xs text-slate-300">
            {aiSummary.map((line) => <p key={line}>- {line}</p>)}
          </div>
        )}
        <button suppressHydrationWarning type="button" onClick={() => window.print()} className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20">
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

        <OpsPanel title="Mensajes y señales de riesgo" subtitle="Etapas calculadas sólo con taps y tasa válida del API. Claim, garantía y marketplace quedan N/D hasta tener eventos propios.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400">Valid rate</p>
              <p className="text-2xl font-semibold text-emerald-300">{validRate == null ? "N/D" : `${validRate.toFixed(1)}%`}</p>
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

        <OpsPanel title="Device breakdown" subtitle={`OS, browser, dispositivo y timezone sobre ${sourceLabel.toLowerCase()}.`}>
          <div className="grid gap-3 md:grid-cols-2">
            <DeviceBucket title="OS" items={devices?.os || []} />
            <DeviceBucket title="Browser" items={devices?.browser || []} />
            <DeviceBucket title="Device type" items={devices?.deviceType || []} />
            <DeviceBucket title="Timezone" items={devices?.timezones || []} />
          </div>
          <p className="mt-2 text-xs text-slate-300">Mobile share: <b>{formatAnalyticsPercentage(mobileSharePercent)}</b></p>
          <div className="mt-3">
            <DeviceRiskMatrix rows={deviceSignals} />
          </div>
        </OpsPanel>
      </div>

      <GamificationGeoOfferStudio cities={cities} geoPoints={geoOfferPoints} mapMode={mapMode} />

      <DemoOpsMap mode={mapMode} points={(data?.geoPoints || []).map((point) => ({
        city: point.city,
        country: point.country || "--",
        lat: point.lat,
        lng: point.lng,
        scans: point.scans ?? 0,
        risk: point.risk || 0,
        lastSeen: cityLastSeenByKey.get(`${String(point.city || "").trim().toLowerCase()}|${String(point.country || "--").trim().toUpperCase()}`) || undefined,
      }))} />
      <OpsPanel title="Journey map (tenant premium taps)" subtitle="Referencia inicial y ultimo tap reportado. Solo se dibuja un conector cuando originSource=product_passport_declared; first_observed_event no se presenta como ruta logistica.">
        {journeyMapPoints.length ? (
          <GlobalOpsMap
            title="Conectores de eventos por UID"
            subtitle="Origen declarado o primer tap reportado vs ultimo tap. Un conector requiere origen declarado; el conector visual no representa un recorrido físico."
            mode={mapMode === "global" ? "global" : "tenant"}
            points={journeyMapPoints}
            routes={journeyRoutes}
            playbackEnabled={false}
            riskOnly={false}
          />
        ) : <p className="text-sm text-slate-400">Sin coordenadas suficientes para dibujar journeys todavía.</p>}
      </OpsPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <OpsPanel title="Live tap feed" subtitle={`Actividad reciente del dataset ${sourceLabel.toLowerCase()}.`}>
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-300">
            <p>Eventos recientes del tenant.</p>
            <label>
              Severity
              <select suppressHydrationWarning value={feedSeverityFilter} onChange={(event) => setFeedSeverityFilter(event.target.value)} className="ml-2 rounded border border-white/10 bg-slate-950 px-2 py-1 text-slate-100">
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

        <OpsPanel title="Top tags / products" subtitle="Activos con más lecturas, última ubicación reportada y tokenización.">
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

        <OpsPanel title="Tag journey" subtitle="Distingue origen declarado de primer tap reportado; no reconstruye un recorrido fisico.">
          <div className="space-y-2">
            {tagJourney.map((item) => {
              const product = productByUid.get(String(item.uid || "").toUpperCase());
              const declaredOrigin = isDeclaredProductOrigin(item.originSource);
              const initialLabel = journeyInitialPointLabel(item.originSource);
              const distance = declaredOrigin ? distanceKm(item.origin.lat, item.origin.lng, item.current.lat, item.current.lng) : null;
              const originHref = mapHref(item.origin.lat, item.origin.lng);
              const currentHref = mapHref(item.current.lat, item.current.lng);
              return (
                <div key={item.uid} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{product?.productName || item.uid}</p>
                    <p>{item.taps} taps - {declaredOrigin ? `distancia recta ${fmtDistance(distance)}` : "sin distancia logistica"}</p>
                  </div>
                  <p className="mt-1 text-slate-300">{initialLabel}: <b>{item.origin.city}, {item.origin.country}</b> - ultimo tap: <b>{item.current.city}, {item.current.country}</b></p>
                  <p className="text-slate-400">Primer tap: {fmtDate(item.firstSeenAt)} - ultimo tap: {fmtDate(item.lastSeenAt)} - {item.lastDevice}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {originHref ? <a href={originHref} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/30 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-400/10">{declaredOrigin ? "Ver origen declarado" : "Ver primer tap"}</a> : null}
                    {currentHref ? <a href={currentHref} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/30 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-400/10">Ver tap</a> : null}
                  </div>
                </div>
              );
            })}
            {!tagJourney.length ? <p className="text-sm text-slate-400">Sin trazas de journey para el scope actual.</p> : null}
          </div>
        </OpsPanel>
      </div>

      <OpsPanel title="Traceability lane by UID" subtitle="Comparacion de puntos reportados por activo; solo un origen de pasaporte se etiqueta como declarado.">
        <div className="space-y-3">
          {tagJourney.slice(0, 8).map((item) => {
            const declaredOrigin = isDeclaredProductOrigin(item.originSource);
            return <div key={`lane-${item.uid}`} className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-200">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">{item.uid}</p>
                <StatusChip label={`${item.taps} taps`} tone={item.taps > 20 ? "good" : "neutral"} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-slate-300">
                <span className="rounded bg-emerald-500/20 px-2 py-1 text-[11px]">{journeyInitialPointLabel(item.originSource)}: {item.origin.city}, {item.origin.country}</span>
                <span className="text-slate-500">{declaredOrigin ? "referencia / tap" : "antes / despues; sin ruta"}</span>
                <span className="rounded bg-cyan-500/20 px-2 py-1 text-[11px]">Ultimo tap: {item.current.city}, {item.current.country}</span>
                <span className="ml-auto text-slate-400">{item.lastDevice}</span>
              </div>
            </div>;
          })}
          {!tagJourney.length ? <p className="text-sm text-slate-400">Sin journeys para construir lane visual.</p> : null}
        </div>
      </OpsPanel>
    </div>
  );
}
