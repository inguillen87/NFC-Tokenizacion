"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@product/ui";
import { WorldMapRealtime } from "@product/ui/world-map-realtime";
import type { AppLocale } from "@product/config";
import { ProductExitLink } from "./product-exit-link";
import {
  hasLiveDemoItems,
  LIVE_DEMO_REQUEST_TIMEOUT_MS,
} from "./live-demo-feed";

type LiveEvent = {
  id: number;
  created_at: string;
  result: string;
  uid_masked?: string;
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

type DemoFeedLoadState = "loading" | "ready" | "error";
type DemoFeedMetadata = { source: string; locationPrecision: string };

const liveCopy: Record<AppLocale, {
  eyebrow: string;
  title: string;
  lead: string;
  source: string;
  loading: string;
  empty: string;
  error: string;
  staleError: string;
  contexts: string;
  events: string;
  risk: string;
  latency: string;
  notMeasured: string;
  mapTitle: string;
  mapSubtitle: string;
  feedTitle: string;
  phoneTitle: string;
  phoneEmpty: string;
  sourceNote: string;
  refresh: string;
  refreshing: string;
  openMobile: string;
  openDashboard: string;
}> = {
  "es-AR": {
    eyebrow: "Feed demo · API identificada",
    title: "Mapa de calor y eventos de la demostración",
    lead: "La intensidad se calcula sólo con eventos geolocalizados que devuelve la API demo. Si el feed está vacío, el mapa queda vacío.",
    source: "Fuente: tenant demobodega",
    loading: "Consultando el feed demo…",
    empty: "El feed respondió sin eventos geolocalizados. No se generan puntos ni zonas de calor artificiales.",
    error: "La API demo no respondió. No mostramos valores nuevos; podés reintentar con «Actualizar datos».",
    staleError: "La API demo no respondió. Conservamos la última respuesta válida; podés actualizarla manualmente.",
    contexts: "Contextos demo",
    events: "Eventos API",
    risk: "Señales de riesgo",
    latency: "Latencia",
    notMeasured: "No medida · fuente demo",
    mapTitle: "Intensidad de lecturas del feed demo",
    mapSubtitle: "Agrupación por coordenada reportada y volumen de eventos. El riesgo se muestra por separado; no representa un recorrido físico.",
    feedTitle: "Eventos recibidos",
    phoneTitle: "Vista mobile del último evento",
    phoneEmpty: "Todavía no llegó un evento demo",
    sourceNote: "Fuente: API demo registrada. No es ubicación en vivo del dispositivo.",
    refresh: "Actualizar datos",
    refreshing: "Actualizando…",
    openMobile: "Abrir vista mobile",
    openDashboard: "Abrir dashboard",
  },
  "pt-BR": {
    eyebrow: "Feed demo · API identificada",
    title: "Mapa de calor e eventos da demonstração",
    lead: "A intensidade usa somente eventos geolocalizados retornados pela API demo. Se o feed estiver vazio, o mapa permanece vazio.",
    source: "Fonte: tenant demobodega",
    loading: "Consultando o feed demo…",
    empty: "O feed respondeu sem eventos geolocalizados. Nenhum ponto ou zona de calor artificial é criado.",
    error: "A API demo não respondeu. Não mostramos valores novos; tente novamente com «Atualizar dados».",
    staleError: "A API demo não respondeu. Mantemos a última resposta válida; você pode atualizá-la manualmente.",
    contexts: "Contextos demo",
    events: "Eventos API",
    risk: "Sinais de risco",
    latency: "Latência",
    notMeasured: "Não medida · fonte demo",
    mapTitle: "Intensidade de leituras do feed demo",
    mapSubtitle: "Agrupamento por coordenada reportada e volume de eventos. O risco aparece separado; não representa rota física.",
    feedTitle: "Eventos recebidos",
    phoneTitle: "Vista mobile do último evento",
    phoneEmpty: "Ainda não chegou um evento demo",
    sourceNote: "Fonte: API demo registrada. Não é localização ao vivo do dispositivo.",
    refresh: "Atualizar dados",
    refreshing: "Atualizando…",
    openMobile: "Abrir vista mobile",
    openDashboard: "Abrir dashboard",
  },
  en: {
    eyebrow: "Demo feed · identified API",
    title: "Demo heatmap and event feed",
    lead: "Intensity uses only geolocated events returned by the demo API. When the feed is empty, the map stays empty.",
    source: "Source: demobodega tenant",
    loading: "Reading the demo feed…",
    empty: "The feed returned no geolocated events. No artificial points or hotspots are generated.",
    error: "The demo API did not respond. No new values are shown; use “Refresh data” to try again.",
    staleError: "The demo API did not respond. The last valid response is retained and can be refreshed manually.",
    contexts: "Demo contexts",
    events: "API events",
    risk: "Risk signals",
    latency: "Latency",
    notMeasured: "Not measured · demo source",
    mapTitle: "Demo-feed reading intensity",
    mapSubtitle: "Grouped by reported coordinate and event volume. Risk is separate; this does not represent a physical route.",
    feedTitle: "Received events",
    phoneTitle: "Latest-event mobile view",
    phoneEmpty: "No demo event has arrived yet",
    sourceNote: "Source: recorded demo API. This is not live device location.",
    refresh: "Refresh data",
    refreshing: "Refreshing…",
    openMobile: "Open mobile view",
    openDashboard: "Open dashboard",
  },
};

function stateLabel(result: string, locale: AppLocale) {
  if (!result) return locale === "en" ? "No demo event" : locale === "pt-BR" ? "Sem evento demo" : "Sin evento demo";
  if (result === "VALID") return locale === "en" ? "Valid NFC message" : locale === "pt-BR" ? "Mensagem NFC válida" : "Mensaje NFC válido";
  if (result === "REPLAY_SUSPECT") return locale === "en" ? "Replay signal" : locale === "pt-BR" ? "Sinal de replay" : "Señal de replay";
  if (result === "TAMPER") return locale === "en" ? "Reported tamper signal" : locale === "pt-BR" ? "Sinal de abertura reportado" : "Señal de apertura reportada";
  return locale === "en" ? "Review required" : locale === "pt-BR" ? "Revisão necessária" : "Requiere revisión";
}

function verticalLabel(v: string | undefined, locale: AppLocale) {
  if (v === "cosmetics") return "Cosmetics";
  if (v === "pharma") return "Pharma";
  if (v === "events") return "Events";
  if (v === "wine") return "Wine";
  if (!v) return "N/D";
  return locale === "en" ? "Other" : locale === "pt-BR" ? "Outro" : "Otro";
}

export function LiveDemoSurfaces({ locale = "es-AR" }: { locale?: AppLocale }) {
  const [items, setItems] = useState<LiveEvent[]>([]);
  const [loadState, setLoadState] = useState<DemoFeedLoadState>("loading");
  const [hasValidSnapshot, setHasValidSnapshot] = useState(false);
  const [feedMetadata, setFeedMetadata] = useState<DemoFeedMetadata>({ source: "pending", locationPrecision: "not_reported" });
  const [refreshRequest, setRefreshRequest] = useState(0);
  const copy = liveCopy[locale];

  useEffect(() => {
    let disposed = false;
    let requestInFlight = false;
    let activeController: AbortController | undefined;

    const load = async () => {
      if (disposed || document.hidden || requestInFlight) return;

      requestInFlight = true;
      setLoadState("loading");
      const controller = new AbortController();
      activeController = controller;
      const requestTimeout = window.setTimeout(() => {
        controller.abort();
      }, LIVE_DEMO_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${API_BASE}/demo/live?tenant=demobodega&limit=25`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`demo_feed_http_${response.status}`);

        const data: unknown = await response.json();
        if (!hasLiveDemoItems(data)) throw new Error("demo_feed_invalid_payload");
        if (disposed || controller.signal.aborted) return;

        setItems(data.items as LiveEvent[]);
        setFeedMetadata({
          source: String((data as { source?: unknown }).source || "not_reported"),
          locationPrecision: String((data as { locationPrecision?: unknown }).locationPrecision || "not_reported"),
        });
        setHasValidSnapshot(true);
        setLoadState("ready");
      } catch {
        if (disposed) return;

        setLoadState("error");
      } finally {
        window.clearTimeout(requestTimeout);
        requestInFlight = false;
        if (activeController === controller) activeController = undefined;
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) void load();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (!document.hidden) void load();

    return () => {
      disposed = true;
      activeController?.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshRequest]);

  const latest = items[0];
  const riskSignals = items.filter((it) => ["REPLAY_SUSPECT", "TAMPER", "INVALID"].includes(it.result)).length;
  const activeDemoContexts = new Set(items.map((it) => `${it.country_code || "--"}-${it.vertical || "unknown"}`)).size;
  const points = useMemo(
    () => {
      const buckets = new Map<string, {
        city: string;
        country: string;
        lat: number;
        lng: number;
        scans: number;
        risk: number;
        vertical: string;
        status: string;
        source: string;
        lastSeen: string;
      }>();
      items
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
        .forEach((item) => {
          const lat = Number(item.lat);
          const lng = Number(item.lng);
          const key = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
          const current = buckets.get(key);
          const risk = ["REPLAY_SUSPECT", "TAMPER", "INVALID"].includes(item.result) ? 1 : 0;
          if (current) {
            current.scans += 1;
            current.risk += risk;
            if (Date.parse(item.created_at) > Date.parse(current.lastSeen)) {
              current.lastSeen = item.created_at;
              current.status = stateLabel(item.result, locale);
            }
            return;
          }
          buckets.set(key, {
            city: item.city || (locale === "en" ? "Unknown" : "Sin dato"),
            country: item.country_code || "--",
            lat,
            lng,
            scans: 1,
            risk,
            vertical: verticalLabel(item.vertical, locale),
            status: stateLabel(item.result, locale),
            source: `${feedMetadata.source}:${feedMetadata.locationPrecision}`,
            lastSeen: item.created_at,
          });
        });
      return [...buckets.values()];
    },
    [feedMetadata.locationPrecision, feedMetadata.source, items, locale]
  );

  return (
    <section className="demo-live-surfaces container-shell space-y-6 py-16" data-demo-api-state={loadState} data-demo-api-stale={loadState === "error" && hasValidSnapshot ? "true" : "false"} data-demo-api-points={points.length} data-demo-api-source={feedMetadata.source} data-demo-location-precision={feedMetadata.locationPrecision}>
      <div className="demo-live-heading">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">{copy.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{copy.lead}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="demo-live-source-chip">{copy.source} · {feedMetadata.locationPrecision}</span>
          <button
            type="button"
            onClick={() => setRefreshRequest((request) => request + 1)}
            disabled={loadState === "loading"}
            className="min-h-11 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60"
          >
            {loadState === "loading" ? copy.refreshing : copy.refresh}
          </button>
        </div>
      </div>

      <p className={`demo-live-feed-state demo-live-feed-state--${loadState}`} role="status" aria-live="polite">
        <span aria-hidden="true" />
        {loadState === "loading"
          ? copy.loading
          : loadState === "error"
            ? hasValidSnapshot ? copy.staleError : copy.error
            : points.length
              ? `${items.length} ${copy.events.toLowerCase()} · ${points.length} ${locale === "en" ? "grouped areas" : locale === "pt-BR" ? "áreas agrupadas" : "zonas agrupadas"}`
              : copy.empty}
      </p>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="demo-live-metric p-4"><p className="text-xs uppercase tracking-[0.14em] text-slate-400">{copy.contexts}</p><p className="mt-2 text-2xl font-semibold text-white">{hasValidSnapshot ? activeDemoContexts : "—"}</p></Card>
        <Card className="demo-live-metric p-4"><p className="text-xs uppercase tracking-[0.14em] text-slate-400">{copy.events}</p><p className="mt-2 text-2xl font-semibold text-emerald-300">{hasValidSnapshot ? items.length : "—"}</p></Card>
        <Card className="demo-live-metric p-4"><p className="text-xs uppercase tracking-[0.14em] text-slate-400">{copy.risk}</p><p className="mt-2 text-2xl font-semibold text-rose-300">{hasValidSnapshot ? riskSignals : "—"}</p></Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{copy.latency}</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-300">N/D</p>
          <p className="mt-1 text-[11px] text-slate-500">{copy.notMeasured}</p>
        </Card>
      </div>

      <div className="demo-live-map-shell" data-map-truth={points.length ? "demo-api-recorded-events" : "empty-demo-api-feed"}>
        {points.length ? (
          <WorldMapRealtime
            title={copy.mapTitle}
            subtitle={copy.mapSubtitle}
            points={points}
          />
        ) : (
          <Card className="demo-live-map-empty" role="status" aria-live="polite">
            <div className="demo-live-map-empty__grid" aria-hidden="true"><span /><span /><span /></div>
            <div className="demo-live-map-empty__copy">
              <span>{copy.source}</span>
              <strong>{copy.mapTitle}</strong>
              <p>{loadState === "error" ? hasValidSnapshot ? copy.staleError : copy.error : copy.empty}</p>
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="demo-live-card p-5">
          <h3 className="text-sm font-semibold text-white">{copy.feedTitle}</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            {items.length ? items.slice(0, 8).map((event) => (
              <div key={event.id} className="demo-live-feed-item rounded-lg border border-white/10 bg-slate-900/70 p-3">
                <div className="font-medium text-white">{stateLabel(event.result, locale)} · {event.product_name || event.uid_masked || "Item"}</div>
                <div className="text-xs text-slate-400">{verticalLabel(event.vertical, locale)} · {event.city || "--"}, {event.country_code || "--"}</div>
              </div>
            )) : <p className="demo-live-card-empty">{loadState === "error" ? hasValidSnapshot ? copy.staleError : copy.error : copy.empty}</p>}
          </div>
        </Card>

        <Card className="demo-live-card p-5">
          <h3 className="text-sm font-semibold text-white">{copy.phoneTitle}</h3>
          <div className="demo-live-phone mx-auto mt-4 max-w-[300px] rounded-[2rem] border-[10px] border-slate-800 bg-slate-950 p-4">
            <div className="demo-live-phone-screen rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-wide text-cyan-300">{stateLabel(latest?.result || "", locale)}</p>
              <p className="mt-2 text-lg font-semibold text-white">{latest?.product_name || copy.phoneEmpty}</p>
              <p className="text-xs text-slate-400">{latest?.sku || "N/D"} · {verticalLabel(latest?.vertical, locale)}</p>
              <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2 text-xs">
                {latest ? `${latest.city || "N/D"}, ${latest.country_code || "N/D"}` : "N/D · demo source"}
              </div>
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li>Varietal: {latest?.grape_varietal || "N/A"}</li>
                <li>Barrel: {latest?.barrel_months ?? "N/A"} months</li>
                <li>Alcohol: {latest?.alcohol_pct ?? "N/A"}%</li>
                <li>Harvest: {latest?.harvest_year ?? "N/A"}</li>
                <li>Storage: {latest?.temperature_storage || "N/A"}</li>
              </ul>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">{copy.sourceNote}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/demo" className="demo-live-action rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-[11px] text-cyan-200">{copy.openMobile}</a>
                <a href={`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.nexid.lat"}/`} className="demo-live-action rounded-lg border border-white/20 px-3 py-2 text-[11px] text-slate-300">{copy.openDashboard}</a>
                <ProductExitLink kind="investorSnapshot" className="demo-live-action rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">Investor snapshot</ProductExitLink>
              </div>

            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
