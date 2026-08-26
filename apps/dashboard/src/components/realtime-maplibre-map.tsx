"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import { resolveEventMapCoordinate, type MapCoordinatePrecision } from "../lib/geo-coordinates";
import { isRealtimeRisk, type TenantTapRealtimeEvent } from "../lib/realtime-feed";

type MapMode = "tenant" | "global";
type MapView = "heat" | "points" | "nearby";
export type BaseMapLayer = "dark" | "light" | "satellite" | "terrain";

type MapHotspot = {
  key: string;
  city: string;
  country: string;
  taps: number;
  valid: number;
  risk: number;
};

type TapFeature = {
  type: "Feature";
  properties: {
    eventId: string;
    uid: string;
    city: string;
    country: string;
    tenant: string;
    verdict: string;
    risk: number;
    device: string;
    occurredAt: string;
    weight: number;
    localTaps: number;
    locationAccuracyM: number | null;
    locationLabel: string;
    locationPrecision: MapCoordinatePrecision;
    locationSource: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
};

type TapFeatureCollection = {
  type: "FeatureCollection";
  features: TapFeature[];
};

const MAP_STYLE = {
  version: 8,
  sources: {
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
    esriWorldImagery: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Esri",
    },
    terrainSource: {
      type: "raster-dem",
      url: "https://tiles.mapterhorn.com/tilejson.json",
    },
    hillshadeSource: {
      type: "raster-dem",
      url: "https://tiles.mapterhorn.com/tilejson.json",
    },
  },
  layers: [
    { id: "carto-dark", type: "raster", source: "cartoDark" },
    { id: "carto-light", type: "raster", source: "cartoLight", layout: { visibility: "none" } },
    { id: "esri-satellite", type: "raster", source: "esriWorldImagery", layout: { visibility: "none" }, paint: { "raster-opacity": 0.9 } },
    {
      id: "terrain-hillshade",
      type: "hillshade",
      source: "hillshadeSource",
      layout: { visibility: "none" },
      paint: {
        "hillshade-exaggeration": 0.55,
        "hillshade-shadow-color": "#020617",
        "hillshade-highlight-color": "#67e8f9",
        "hillshade-accent-color": "#0f766e",
      },
    },
  ],
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function deviceSummary(row: TenantTapRealtimeEvent) {
  return [row.deviceLabel, row.deviceOs, row.deviceType].map((item) => String(item || "").trim()).filter(Boolean).join(" / ") || "Dispositivo sin clasificar";
}

function eventToFeature(row: TenantTapRealtimeEvent, index: number): TapFeature | null {
  const city = String(row.city || "Unknown");
  const country = String(row.country || "--");
  const verdict = String(row.verdict || "UNKNOWN").toUpperCase();
  const risk = isRealtimeRisk(row.verdict, row.reason) ? 1 : 0;
  const coordinate = resolveEventMapCoordinate({
    lat: row.lat,
    lng: row.lng,
    city,
    country,
    locationSource: row.locationSource,
    locationAccuracyM: row.locationAccuracyM,
  });
  if (!coordinate) return null;

  return {
    type: "Feature",
    properties: {
      eventId: String(row.eventId || `${row.uidMasked || "evt"}-${row.occurredAt || index}`),
      uid: String(row.uidMasked || "UID n/a"),
      city,
      country,
      tenant: String(row.tenantSlug || "tenant"),
      verdict,
      risk,
      device: deviceSummary(row),
      occurredAt: String(row.occurredAt || ""),
      weight: 1,
      localTaps: 1,
      locationAccuracyM: coordinate.accuracyM,
      locationLabel: coordinate.label,
      locationPrecision: coordinate.precision,
      locationSource: coordinate.source,
    },
    geometry: {
      type: "Point",
      coordinates: [coordinate.lng, coordinate.lat],
    },
  };
}

export function buildGeojson(events: TenantTapRealtimeEvent[]): TapFeatureCollection {
  const features = events.map(eventToFeature).filter((item): item is TapFeature => Boolean(item));
  const localBuckets = new Map<string, number>();

  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates;
    const key = `${Math.round(lng * 100) / 100}|${Math.round(lat * 100) / 100}|${feature.properties.tenant}`;
    localBuckets.set(key, (localBuckets.get(key) || 0) + 1);
  }

  return {
    type: "FeatureCollection",
    features: features.map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const key = `${Math.round(lng * 100) / 100}|${Math.round(lat * 100) / 100}|${feature.properties.tenant}`;
      const localTaps = localBuckets.get(key) || 1;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          localTaps,
          // Every observed event contributes the same amount to the heat layer.
          // Risk remains an independent marker and never inflates activity volume.
          weight: 1,
        },
      };
    }),
  };
}

function ensureLayers(map: MapLibreMap, data: TapFeatureCollection) {
  if (!map.getSource("tap-events-heat")) {
    map.addSource("tap-events-heat", {
      type: "geojson",
      data,
    });
  }

  if (!map.getSource("tap-events")) {
    map.addSource("tap-events", {
      type: "geojson",
      data,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 30,
    });
  }

  if (!map.getLayer("tap-heat")) {
    map.addLayer({
      id: "tap-heat",
      type: "heatmap",
      source: "tap-events-heat",
      maxzoom: 14,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 9, 1.45, 13, 2.05],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 10, 8, 20, 12, 32],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 9, 0.82, 12, 0.48, 14, 0.12],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(2,6,23,0)",
          0.16,
          "rgba(34,211,238,.3)",
          0.38,
          "rgba(20,184,166,.55)",
          0.62,
          "rgba(37,99,235,.7)",
          0.82,
          "rgba(79,70,229,.82)",
          1,
          "rgba(124,58,237,.92)",
        ],
      },
    });
  }

  if (!map.getLayer("tap-bubbles")) {
    map.addLayer({
      id: "tap-bubbles",
      type: "circle",
      source: "tap-events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "localTaps"], 1, 3, 4, 5, 12, 8, 30, 12],
        "circle-color": ["case", ["==", ["get", "risk"], 1], "#fb7185", "#22d3ee"],
        "circle-blur": ["interpolate", ["linear"], ["zoom"], 7, 1.15, 11, 0.32],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 9, 0.12, 11, 0.58, 13, 0.78],
        "circle-stroke-color": "rgba(255,255,255,.8)",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 0, 11, 1],
        "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 11, 0.72],
      },
    });
  }

  if (!map.getLayer("tap-clusters")) {
    map.addLayer({
      id: "tap-clusters",
      type: "circle",
      source: "tap-events",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ["step", ["get", "point_count"], "#0891b2", 8, "#22c55e", 25, "#facc15", 60, "#ef4444"],
        "circle-radius": ["step", ["get", "point_count"], 7, 8, 10, 25, 13, 60, 16],
        "circle-stroke-color": "rgba(255,255,255,.78)",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.9,
      },
    });
  }

  if (!map.getLayer("tap-nearby-radius")) {
    map.addLayer({
      id: "tap-nearby-radius",
      type: "circle",
      source: "tap-events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 12, 10, 38, 13, 60],
        "circle-color": "rgba(34,211,238,.055)",
        "circle-stroke-color": "rgba(125,211,252,.46)",
        "circle-stroke-width": 1,
      },
    });
  }

  if (!map.getLayer("tap-pulse")) {
    map.addLayer({
      id: "tap-pulse",
      type: "circle",
      source: "tap-events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 0, 10, 12, 13, 22],
        "circle-color": "rgba(34,211,238,0)",
        "circle-stroke-color": ["case", ["==", ["get", "risk"], 1], "#fb7185", "#22d3ee"],
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.28,
      },
    });
  }

  if (!map.getLayer("tap-points")) {
    map.addLayer({
      id: "tap-points",
      type: "circle",
      source: "tap-events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "localTaps"], 1, ["case", ["==", ["get", "risk"], 1], 4.5, 3.5], 8, 6.5, 18, 9],
        "circle-color": ["case", ["==", ["get", "risk"], 1], "#fb7185", "#67e8f9"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
        "circle-opacity": 0.95,
      },
    });
  }
}

function setLayerVisibility(map: MapLibreMap, view: MapView) {
  const set = (id: string, visible: boolean) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  };
  set("tap-heat", view === "heat");
  set("tap-bubbles", view === "heat");
  set("tap-nearby-radius", view === "nearby");
  set("tap-clusters", view !== "nearby");
  set("tap-pulse", view === "points" || view === "nearby");
  set("tap-points", view === "points" || view === "nearby");
}

function defaultBaseMapLayer(): BaseMapLayer {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("theme-light") || document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function setBasemapLayer(map: MapLibreMap, layer: BaseMapLayer) {
  if (map.getLayer("carto-dark")) map.setLayoutProperty("carto-dark", "visibility", layer === "dark" || layer === "terrain" ? "visible" : "none");
  if (map.getLayer("carto-light")) map.setLayoutProperty("carto-light", "visibility", layer === "light" ? "visible" : "none");
  if (map.getLayer("esri-satellite")) map.setLayoutProperty("esri-satellite", "visibility", layer === "satellite" ? "visible" : "none");
  if (map.getLayer("terrain-hillshade")) map.setLayoutProperty("terrain-hillshade", "visibility", layer === "terrain" ? "visible" : "none");
  try {
    map.setTerrain(layer === "terrain" && map.getSource("terrainSource") ? { source: "terrainSource", exaggeration: 0.65 } : null);
  } catch {
    // Terrain is a progressive enhancement; keep the live map usable if the DEM source is unavailable.
  }
  map.easeTo({ pitch: layer === "terrain" ? 52 : 0, bearing: layer === "terrain" ? -18 : 0, duration: 500 });
  const pointStroke = layer === "light" ? "#0f172a" : "#ffffff";
  if (map.getLayer("tap-points")) map.setPaintProperty("tap-points", "circle-stroke-color", pointStroke);
  if (map.getLayer("tap-clusters")) map.setPaintProperty("tap-clusters", "circle-stroke-color", layer === "light" ? "rgba(15,23,42,.72)" : "rgba(255,255,255,.78)");
}

function fitData(maplibre: typeof import("maplibre-gl"), map: MapLibreMap, data: TapFeatureCollection, zoom: number) {
  if (!data.features.length) {
    map.easeTo({ center: [-64.2, -34.6], zoom: 3.7 + (zoom - 1) * 3, duration: 500 });
    return;
  }

  if (data.features.length === 1) {
    map.easeTo({ center: data.features[0].geometry.coordinates, zoom: 8 + (zoom - 1) * 4, duration: 500 });
    return;
  }

  const bounds = new maplibre.LngLatBounds();
  data.features.forEach((feature) => bounds.extend(feature.geometry.coordinates));
  map.fitBounds(bounds, {
    padding: { top: 72, bottom: 56, left: 56, right: 56 },
    maxZoom: 8.4 + (zoom - 1) * 3,
    duration: 650,
  });
}

export function RealtimeMapLibreMap({
  hotspots,
  events,
  mapView,
  baseMap,
  mode,
  zoom,
}: {
  hotspots: MapHotspot[];
  events: TenantTapRealtimeEvent[];
  mapView: MapView;
  baseMap?: BaseMapLayer;
  mode: MapMode;
  zoom: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const mapTitleId = useId();
  const mapSummaryId = useId();
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [themeBaseMap, setThemeBaseMap] = useState<BaseMapLayer>("light");

  const geojson = useMemo(() => buildGeojson(events), [events]);
  const signature = useMemo(
    () => geojson.features.map((feature) => `${feature.properties.eventId}:${feature.geometry.coordinates.join(",")}`).join("|"),
    [geojson],
  );
  const precisionSummary = useMemo(() => geojson.features.reduce((summary, feature) => {
    summary[feature.properties.locationPrecision] += 1;
    return summary;
  }, { reported: 0, approximate: 0 } as Record<MapCoordinatePrecision, number>), [geojson]);
  const textualHotspots = hotspots.slice(0, 5);

  useEffect(() => {
    setThemeBaseMap(defaultBaseMapLayer());
    const observer = new MutationObserver(() => setThemeBaseMap(defaultBaseMapLayer()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanupResize: (() => void) | null = null;
    let cleanupAnimation: (() => void) | null = null;

    const boot = async () => {
      setMapError(null);
      const maplibre = await import("maplibre-gl");
      if (cancelled || !containerRef.current || mapRef.current) return;

      maplibreRef.current = maplibre;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: MAP_STYLE as any,
        center: [-64.2, -34.6],
        zoom: 3.7,
        attributionControl: false,
        cooperativeGestures: true,
        fadeDuration: 0,
      });

      mapRef.current = map;
      map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");

      map.on("load", () => {
        ensureLayers(map, geojson);
        setLayerVisibility(map, mapView);
        setBasemapLayer(map, baseMap || defaultBaseMapLayer());
        fitData(maplibre, map, geojson, zoom);
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          let frame = 0;
          const animatePulse = () => {
            const wave = (Math.sin((performance.now() / 900) * Math.PI) + 1) / 2;
            if (map.getLayer("tap-pulse")) {
              map.setPaintProperty("tap-pulse", "circle-stroke-opacity", 0.12 + wave * 0.28);
            }
            frame = requestAnimationFrame(animatePulse);
          };
          frame = requestAnimationFrame(animatePulse);
          cleanupAnimation = () => cancelAnimationFrame(frame);
        }
        setLoaded(true);
      });

      map.on("click", "tap-clusters", async (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        const source = map.getSource("tap-events") as GeoJSONSource | undefined;
        if (!feature || !source || clusterId == null) return;
        const expansionZoom = await source.getClusterExpansionZoom(clusterId);
        const coords = (feature.geometry as { coordinates?: [number, number] }).coordinates;
        if (coords) map.easeTo({ center: coords, zoom: expansionZoom, duration: 450 });
      });

      map.on("click", "tap-points", (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0] as TapFeature | undefined;
        const coordinates = feature?.geometry.coordinates;
        const props = feature?.properties;
        if (!coordinates || !props) return;
        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({ closeButton: false, closeOnClick: true, className: "nexid-map-popup" })
          .setLngLat(coordinates)
          .setHTML(`
            <div class="nexid-map-popup-card">
              <b>${escapeHtml(props.uid)}</b>
              <span>${escapeHtml(props.city)}, ${escapeHtml(props.country)}</span>
              <small>${escapeHtml(props.verdict)} / ${escapeHtml(props.device)}</small>
              <small>${escapeHtml(props.locationLabel)}</small>
              <small>Fuente de ubicación: ${escapeHtml(props.locationSource)}</small>
              <small>${escapeHtml(props.localTaps)} taps en la zona</small>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseenter", "tap-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "tap-points", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "tap-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "tap-clusters", () => { map.getCanvas().style.cursor = ""; });

      if ("ResizeObserver" in window && containerRef.current) {
        const observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);
        cleanupResize = () => observer.disconnect();
      }
    };

    void boot().catch(() => {
      if (!cancelled) {
        setLoaded(false);
        setMapError("No se pudo iniciar el motor geográfico en este dispositivo.");
      }
    });
    return () => {
      cancelled = true;
      cleanupResize?.();
      cleanupAnimation?.();
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const source = map.getSource("tap-events") as GeoJSONSource | undefined;
    source?.setData(geojson as any);
    const heatSource = map.getSource("tap-events-heat") as GeoJSONSource | undefined;
    heatSource?.setData(geojson as any);
  }, [geojson, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    setLayerVisibility(map, mapView);
  }, [loaded, mapView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    setBasemapLayer(map, baseMap || themeBaseMap);
  }, [baseMap, loaded, themeBaseMap]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !loaded) return;
    fitData(maplibre, map, geojson, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, signature, zoom]);

  return (
    <div
      data-testid="crm-maplibre-map"
      data-map-view={mapView}
      data-base-map={baseMap || themeBaseMap}
      data-zoom={zoom.toFixed(2)}
      aria-labelledby={mapTitleId}
      aria-describedby={mapSummaryId}
      className="nexid-realtime-map relative h-full min-h-[300px] overflow-hidden rounded-xl border border-white/8 bg-[#061322] shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
      role="region"
    >
      <h3 id={mapTitleId} className="sr-only">Mapa operativo de lecturas con precisión geográfica declarada</h3>
      <div ref={containerRef} className="h-full w-full" />
      <div id={mapSummaryId} className="nexid-map-status pointer-events-none absolute left-16 top-20 max-w-[calc(100%-5rem)] rounded-lg border border-white/10 bg-slate-950/72 px-3 py-2 text-xs text-slate-300 shadow-xl backdrop-blur sm:top-16 lg:top-20">
        <b className="text-cyan-200">{geojson.features.length}</b> ubicaciones mapeables / {hotspots.length} zonas / {mode === "tenant" ? "tenant" : "global"}
        <span className="mt-1 block text-[10px] text-slate-400">
          {precisionSummary.reported} reportadas · {precisionSummary.approximate} aproximadas · sin coordenada persistida, el evento no se dibuja
        </span>
      </div>
      {!loaded && !mapError ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-center text-sm text-slate-300" role="status" aria-busy="true">
          <div>
            <span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-cyan-300/25 border-t-cyan-300 motion-reduce:animate-none" aria-hidden="true" />
            <b className="block text-white">Preparando mapa operativo</b>
            Cargando capas, controles y eventos geográficos.
          </div>
        </div>
      ) : null}
      {mapError ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/90 p-6 text-center text-sm text-slate-300" role="alert">
          <div className="max-w-md">
            <b className="block text-rose-200">Mapa visual no disponible</b>
            <span className="mt-1 block">{mapError} El resumen textual conserva las zonas disponibles y explicita su nivel de precisión.</span>
          </div>
        </div>
      ) : null}
      {loaded && !mapError && !geojson.features.length ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/55 text-center text-sm text-slate-300">
          <div>
            <b className="block text-white">Sin ubicaciones utilizables en esta ventana</b>
            Cambia tenant o rango temporal, o realiza un tap con ciudad/GPS informado.
          </div>
        </div>
      ) : null}
      <details className="absolute bottom-8 right-3 z-10 max-w-[min(22rem,calc(100%-1.5rem))] rounded-lg border border-white/10 bg-slate-950/85 text-xs text-slate-300 shadow-xl backdrop-blur">
        <summary className="cursor-pointer px-3 py-2 font-black text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
          Resumen textual del mapa
        </summary>
        <div className="border-t border-white/10 px-3 py-2">
          {textualHotspots.length ? (
            <ol className="space-y-1.5">
              {textualHotspots.map((hotspot) => (
                <li key={hotspot.key}>
                  <b className="text-white">{hotspot.city}, {hotspot.country}</b>: {hotspot.taps} taps, {hotspot.valid} válidos, {hotspot.risk} con riesgo. Resumen por zona; no implica GPS exacto.
                </li>
              ))}
            </ol>
          ) : (
            <p>No hay zonas agregadas para los filtros activos.</p>
          )}
        </div>
      </details>
    </div>
  );
}
