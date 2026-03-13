"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MapPoint = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  scans: number;
  risk: number;
};

type EventFilter = "all" | "clean" | "risk";

declare global {
  interface Window {
    maplibregl?: any;
  }
}

const STYLE_CANDIDATES = [
  process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL,
  "https://tiles.openfreemap.org/styles/liberty",
  "https://demotiles.maplibre.org/style.json",
].filter(Boolean) as string[];

const JS_CANDIDATES = [
  process.env.NEXT_PUBLIC_MAPLIBRE_JS_URL,
  "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js",
].filter(Boolean) as string[];

const CSS_CANDIDATES = [
  process.env.NEXT_PUBLIC_MAPLIBRE_CSS_URL,
  "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css",
].filter(Boolean) as string[];

async function loadScript(url: string) {
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-maplibre-src="${url}"]`);
    if (existing) {
      if (window.maplibregl) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`MapLibre script failed: ${url}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.maplibre = "1";
    script.dataset.maplibreSrc = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`MapLibre script failed: ${url}`));
    document.head.appendChild(script);
  });
}

function loadCss(url: string) {
  const existing = document.querySelector<HTMLLinkElement>(`link[data-maplibre-css="${url}"]`);
  if (existing) return;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = url;
  css.dataset.maplibreCss = url;
  document.head.appendChild(css);
}

async function ensureMapLibre(): Promise<{ maplibre: any; scriptUrl: string; cssUrl: string } | null> {
  if (typeof window === "undefined") return null;
  if (window.maplibregl) {
    return { maplibre: window.maplibregl, scriptUrl: "already-loaded", cssUrl: "already-loaded" };
  }

  let lastError: unknown = null;
  for (const cssUrl of CSS_CANDIDATES) {
    loadCss(cssUrl);
    for (const scriptUrl of JS_CANDIDATES) {
      try {
        await loadScript(scriptUrl);
        if (window.maplibregl) {
          return { maplibre: window.maplibregl, scriptUrl, cssUrl };
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export function DemoOpsMap({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const styleIndexRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [playback, setPlayback] = useState(false);
  const [index, setIndex] = useState(100);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [country, setCountry] = useState("ALL");
  const [loadNote, setLoadNote] = useState("initializing");

  const countries = useMemo(() => ["ALL", ...Array.from(new Set(points.map((point) => point.country))).sort()], [points]);

  const filteredPoints = useMemo(
    () =>
      points.filter((point) => {
        const countryMatch = country === "ALL" ? true : point.country === country;
        const eventMatch = eventFilter === "all" ? true : eventFilter === "clean" ? point.risk === 0 : point.risk > 0;
        return countryMatch && eventMatch;
      }),
    [points, country, eventFilter]
  );

  const playablePoints = useMemo(() => {
    const total = filteredPoints.length;
    if (total === 0) return [];
    const limit = Math.max(1, Math.round((index / 100) * total));
    return filteredPoints.slice(0, limit);
  }, [filteredPoints, index]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await ensureMapLibre();
        if (!active || !loaded || !containerRef.current) return;

        const styleUrl = STYLE_CANDIDATES[0];
        if (!styleUrl) throw new Error("No MapLibre style URL available");

        const map = new loaded.maplibre.Map({
          container: containerRef.current,
          style: styleUrl,
          center: [-70, -20],
          zoom: 2,
        });
        mapRef.current = map;
        setLoadNote(`script=${loaded.scriptUrl} | css=${loaded.cssUrl} | style=${styleUrl}`);

        map.on("error", () => {
          const currentIndex = styleIndexRef.current;
          const nextIndex = currentIndex + 1;
          if (nextIndex < STYLE_CANDIDATES.length && mapRef.current) {
            styleIndexRef.current = nextIndex;
            const nextStyle = STYLE_CANDIDATES[nextIndex] as string;
            setLoadNote(`style fallback -> ${nextStyle}`);
            mapRef.current.setStyle(nextStyle);
          }
        });

        map.on("load", () => {
          if (!active) return;
          const source = map.getSource("events");
          if (!source) {
            map.addSource("events", {
              type: "geojson",
              data: { type: "FeatureCollection", features: [] },
              cluster: true,
              clusterMaxZoom: 10,
              clusterRadius: 45,
            });

            map.addLayer({
              id: "heat",
              type: "heatmap",
              source: "events",
              paint: {
                "heatmap-weight": ["interpolate", ["linear"], ["get", "risk"], 0, 0.4, 1, 1],
                "heatmap-intensity": 1,
                "heatmap-radius": 20,
              },
            });

            map.addLayer({
              id: "clusters",
              type: "circle",
              source: "events",
              filter: ["has", "point_count"],
              paint: {
                "circle-color": "#22d3ee",
                "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 30, 24],
                "circle-opacity": 0.75,
              },
            });

            map.addLayer({
              id: "cluster-count",
              type: "symbol",
              source: "events",
              filter: ["has", "point_count"],
              layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
            });

            map.addLayer({
              id: "unclustered",
              type: "circle",
              source: "events",
              filter: ["!", ["has", "point_count"]],
              paint: {
                "circle-color": ["case", ["==", ["get", "risk"], 0], "#10b981", "#f43f5e"],
                "circle-radius": 6,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
              },
            });
          }

          setReady(true);
        });
      } catch (error) {
        setReady(false);
        setLoadNote(error instanceof Error ? error.message : "MapLibre init failed");
      }
    })();

    return () => {
      active = false;
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const src = mapRef.current.getSource("events");
    if (!src) return;

    src.setData({
      type: "FeatureCollection",
      features: playablePoints.map((point) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
        properties: { city: point.city, country: point.country, scans: point.scans, risk: point.risk },
      })),
    });
  }, [playablePoints, ready]);

  useEffect(() => {
    if (!playback) return;
    const timer = setInterval(() => {
      setIndex((value) => {
        if (value >= 100) return 10;
        return Math.min(100, value + 10);
      });
    }, 700);
    return () => clearInterval(timer);
  }, [playback]);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Ops Map Pro (MapLibre)</h3>
          <p className="text-xs text-slate-400">Clusters + heatmap + playback + filtros. URLs configurables con fallback automático.</p>
        </div>
        <button type="button" className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white" onClick={() => setPlayback((value) => !value)}>
          {playback ? "Pause playback" : "Play playback"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <select className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white" value={eventFilter} onChange={(event) => setEventFilter(event.target.value as EventFilter)}>
          <option value="all">Todos los eventos</option>
          <option value="clean">AUTH OK</option>
          <option value="risk">Solo riesgo</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs text-white" value={country} onChange={(event) => setCountry(event.target.value)}>
          {countries.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 h-[340px] overflow-hidden rounded-lg border border-white/10 bg-slate-950">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      <div className="mt-3">
        <input type="range" min={10} max={100} step={10} value={index} onChange={(event) => setIndex(Number(event.target.value))} className="w-full" />
      </div>

      {!ready ? (
        <p className="mt-2 text-xs text-amber-300">
          Mapa no inicializado aún. {loadNote}. Si lo querés 100% productivo, definí URLs propias en `NEXT_PUBLIC_MAPLIBRE_*`.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">Map source: {loadNote}</p>
      )}
    </div>
  );
}
