"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import type { HomeRolesCopy } from "./home-copy";
import styles from "./nexid-home-v4.module.css";

type OperationsPreviewProps = {
  copy: HomeRolesCopy["workspace"];
  outcome: string;
  scenarioLabel: string;
};

const ROUTE_POINTS = [
  { label: "Mendoza", time: "09:42", coordinates: [-68.8458, -32.8895] as [number, number], status: "active" },
  { label: "Córdoba", time: "11:08", coordinates: [-64.1888, -31.4201] as [number, number], status: "active" },
  { label: "Buenos Aires", time: "14:31", coordinates: [-58.3816, -34.6037] as [number, number], status: "review" },
] as const;

const ACTIVITY_SERIES = [
  { time: "08:00", accepted: 18, review: 1 },
  { time: "09:00", accepted: 31, review: 2 },
  { time: "10:00", accepted: 27, review: 1 },
  { time: "11:00", accepted: 46, review: 3 },
  { time: "12:00", accepted: 39, review: 2 },
  { time: "13:00", accepted: 57, review: 4 },
  { time: "14:00", accepted: 51, review: 3 },
  { time: "15:00", accepted: 64, review: 5 },
] as const;

function themeIsDark() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("theme-dark") || document.documentElement.getAttribute("data-theme") === "dark";
}

function buildStyle(dark: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {
      cartoLight: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "OpenStreetMap / CARTO",
      },
      cartoDark: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "OpenStreetMap / CARTO",
      },
      route: {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: ROUTE_POINTS.map((point) => point.coordinates),
          },
        },
      },
    },
    layers: [
      { id: "base-light", type: "raster", source: "cartoLight", layout: { visibility: dark ? "none" : "visible" } },
      { id: "base-dark", type: "raster", source: "cartoDark", layout: { visibility: dark ? "visible" : "none" } },
      {
        id: "route-shadow",
        type: "line",
        source: "route",
        paint: {
          "line-color": dark ? "rgba(2, 10, 7, .68)" : "rgba(255, 255, 255, .92)",
          "line-width": 7,
          "line-blur": 1.5,
        },
      },
      {
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": dark ? "#72e0c4" : "#087d6c",
          "line-width": 3,
          "line-dasharray": [1.1, 1.25],
        },
      },
    ],
  };
}

function ChartTooltip({ active, payload, label, copy }: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: string | number; color?: string }>;
  label?: string | number;
  copy: HomeRolesCopy["workspace"];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.operationsTooltip}>
      <small>{copy.activityLabel} · {label}</small>
      {payload.map((item) => (
        <span key={String(item.dataKey)}>
          <i style={{ background: item.color }} />
          {item.dataKey === "review" ? copy.reviewLabel : copy.activeLabel}
          <b>{item.value}</b>
        </span>
      ))}
    </div>
  );
}

export function NexidOperationsPreview({ copy, outcome, scenarioLabel }: OperationsPreviewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [dark, setDark] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());
  const chartColors = useMemo(() => ({
    accent: dark ? "#72e0c4" : "#087d6c",
    review: dark ? "#e0b270" : "#a66c29",
    grid: dark ? "rgba(224,239,232,.14)" : "rgba(16,34,27,.12)",
    tick: dark ? "#9db0a7" : "#60736b",
  }), [dark]);

  useEffect(() => {
    const syncTheme = () => setDark(themeIsDark());
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    const boot = async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      const map = new maplibre.Map({
        container: mapContainerRef.current,
        style: buildStyle(themeIsDark()),
        center: [-63.6, -33.25],
        zoom: 4.05,
        minZoom: 3.2,
        maxZoom: 8.5,
        attributionControl: false,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: 0,
        locale: {
          "NavigationControl.ZoomIn": copy.mapZoomIn,
          "NavigationControl.ZoomOut": copy.mapZoomOut,
          "AttributionControl.ToggleAttribution": copy.mapAttribution,
        },
      });

      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibre.ScaleControl({ unit: "metric", maxWidth: 90 }), "bottom-left");
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");

      let previewReady = false;
      const revealPreview = () => {
        if (cancelled || previewReady) return;
        previewReady = true;
        markersRef.current = ROUTE_POINTS.map((point, index) => {
          const marker = document.createElement("div");
          marker.className = styles.operationsMapMarker;
          marker.dataset.status = point.status;
          marker.innerHTML = `<em>${String(index + 1).padStart(2, "0")}</em><span><b>${point.label}</b><small>${point.time}</small></span>`;
          return new maplibre.Marker({ element: marker, anchor: "bottom-left" }).setLngLat(point.coordinates).addTo(map);
        });
        setLoaded(true);
      };

      map.once("style.load", revealPreview);
      map.once("load", revealPreview);
      readyTimer = setTimeout(revealPreview, 2400);

      map.on("error", (event) => {
        // A missing raster tile should not hide a useful route and its signals.
        if (String(event?.error?.message || "").toLowerCase().includes("tile")) return;
        if (!cancelled) setMapError(true);
      });

      if ("ResizeObserver" in window && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(mapContainerRef.current);
      }
    };

    void boot().catch(() => {
      if (!cancelled) setMapError(true);
    });

    return () => {
      cancelled = true;
      if (readyTimer) clearTimeout(readyTimer);
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [copy.mapAttribution, copy.mapZoomIn, copy.mapZoomOut]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (map.getLayer("base-light")) map.setLayoutProperty("base-light", "visibility", dark ? "none" : "visible");
    if (map.getLayer("base-dark")) map.setLayoutProperty("base-dark", "visibility", dark ? "visible" : "none");
    if (map.getLayer("route-shadow")) map.setPaintProperty("route-shadow", "line-color", dark ? "rgba(2, 10, 7, .68)" : "rgba(255, 255, 255, .92)");
    if (map.getLayer("route-line")) map.setPaintProperty("route-line", "line-color", dark ? "#72e0c4" : "#087d6c");
  }, [dark, loaded]);

  return (
    <div className={styles.operationsBoard}>
      <section className={styles.signalMap} aria-label={`${copy.sequenceLabel}: Mendoza, Córdoba, Buenos Aires`}>
        <div className={styles.mapHeading}>
          <div><small>{copy.sequenceLabel} · {scenarioLabel}</small><strong>{outcome}</strong></div>
          <div className={styles.mapLegend} aria-label={copy.signalsTitle}>
            <span><i />{copy.activeLabel}</span>
            <span><i />{copy.reviewLabel}</span>
          </div>
        </div>
        <div className={styles.mapCanvas}>
          <div ref={mapContainerRef} className={styles.mapLibreCanvas} />
          {!loaded && !mapError && <span className={styles.mapLoading}>{copy.sequenceLabel}</span>}
          {mapError && (
            <div className={styles.mapFallback}>
              <strong>Mendoza</strong><i /><strong>Córdoba</strong><i /><strong>Buenos Aires</strong>
            </div>
          )}
        </div>
      </section>

      <aside className={styles.signalPanel} aria-label={copy.signalsTitle}>
        <div className={styles.signalPanelHeading}><small>{copy.signalsTitle}</small></div>
        {copy.signals.map((signal, index) => (
          <div key={signal}>
            <span>0{index + 1}</span>
            <b>{signal}</b>
            <em data-review={index === 2 ? "true" : "false"}>{index === 2 ? copy.reviewLabel : copy.activeLabel}</em>
          </div>
        ))}
      </aside>

      <section className={styles.signalChart} aria-label={copy.activityLabel}>
        <table className={styles.visuallyHidden}>
          <caption>{copy.activityLabel} · {scenarioLabel}</caption>
          <thead><tr><th>{copy.sequenceLabel}</th><th>{copy.activeLabel}</th><th>{copy.reviewLabel}</th></tr></thead>
          <tbody>
            {ACTIVITY_SERIES.map((point) => (
              <tr key={point.time}><th>{point.time}</th><td>{point.accepted}</td><td>{point.review}</td></tr>
            ))}
          </tbody>
        </table>
        <div className={styles.signalChartHeading}>
          <div><small>{copy.activityLabel} · {scenarioLabel}</small><strong>{copy.sequenceLabel}</strong></div>
          <div className={styles.chartLegend}>
            <span><i style={{ background: chartColors.accent }} />{copy.activeLabel}</span>
            <span><i style={{ background: chartColors.review }} />{copy.reviewLabel}</span>
          </div>
        </div>
        <div className={styles.signalChartCanvas}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ACTIVITY_SERIES} margin={{ top: 10, right: 10, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id="nexid-operations-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.34} />
                  <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chartColors.grid} strokeDasharray="3 5" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: chartColors.tick, fontSize: 10 }} interval={1} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.tick, fontSize: 10 }} width={38} />
              <Tooltip content={<ChartTooltip copy={copy} />} cursor={{ stroke: chartColors.grid, strokeWidth: 1 }} />
              <Area type="monotone" dataKey="accepted" stroke={chartColors.accent} strokeWidth={2.4} fill="url(#nexid-operations-area)" activeDot={{ r: 4 }} isAnimationActive={!reduceMotion} />
              <Line type="monotone" dataKey="review" stroke={chartColors.review} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={!reduceMotion} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
