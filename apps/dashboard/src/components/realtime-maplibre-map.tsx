"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import { resolveTrustMapSource } from "@product/ui/trust-map-source";
import { resolveEventMapCoordinate, type MapCoordinatePrecision } from "../lib/geo-coordinates";
import { classifyLocationProvenance, locationProvenanceLabel, type LocationProvenanceClass } from "../lib/location-provenance";
import { isRealtimeRisk, type TenantTapRealtimeEvent } from "../lib/realtime-feed";

type MapMode = "tenant" | "global";
type MapView = "heat" | "points" | "nearby";
export type BaseMapLayer = "dark" | "light" | "satellite" | "terrain";
export type MapDataState = "real" | "demo" | "unavailable";

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
    locationClass: LocationProvenanceClass;
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

const TRUST_MAP_SOURCE = resolveTrustMapSource({
  styleUrl: process.env.NEXT_PUBLIC_NEXID_MAP_STYLE_URL,
  darkStyleUrl: process.env.NEXT_PUBLIC_NEXID_DARK_MAP_STYLE_URL,
  rasterTileTemplate: process.env.NEXT_PUBLIC_NEXID_RASTER_TILE_TEMPLATE,
  attribution: process.env.NEXT_PUBLIC_NEXID_MAP_ATTRIBUTION,
});

const SATELLITE_MAP_STYLE = {
  version: 8,
  sources: {
    esriWorldImagery: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Esri",
    },
  },
  layers: [
    { id: "esri-satellite", type: "raster", source: "esriWorldImagery", paint: { "raster-opacity": 0.9 } },
  ],
};

function rasterMapStyle(template: string) {
  return {
    version: 8,
    sources: {
      operatorRaster: {
        type: "raster",
        tiles: [template],
        tileSize: 256,
        attribution: TRUST_MAP_SOURCE.attribution,
      },
    },
    layers: [
      { id: "operator-raster", type: "raster", source: "operatorRaster" },
    ],
  };
}

function basemapStyle(layer: BaseMapLayer) {
  if (layer === "satellite") return SATELLITE_MAP_STYLE;
  if (TRUST_MAP_SOURCE.rasterTileTemplate) return rasterMapStyle(TRUST_MAP_SOURCE.rasterTileTemplate);
  return layer === "dark" || layer === "terrain" ? TRUST_MAP_SOURCE.darkStyleUrl : TRUST_MAP_SOURCE.styleUrl;
}

function basemapStyleKey(layer: BaseMapLayer) {
  if (layer === "satellite") return "satellite";
  if (TRUST_MAP_SOURCE.rasterTileTemplate) return "operator-raster";
  return layer === "dark" || layer === "terrain" ? "openfreemap-dark" : "openfreemap-light";
}

function addMissingCircleImage(map: MapLibreMap, imageId: string) {
  const match = /^circle-(\d+)$/.exec(imageId);
  if (!match || map.hasImage(imageId)) return;

  const size = Math.max(8, Math.min(32, Number(match[1]) || 11));
  const pixels = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  const radius = Math.max(2, center - 0.75);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center);
      if (distance > radius) continue;
      const offset = (y * size + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = distance > radius - 1 ? Math.round((radius - distance) * 255) : 255;
    }
  }

  map.addImage(imageId, { width: size, height: size, data: pixels });
}

function ensureTerrainEnhancement(map: MapLibreMap, activeLayer: BaseMapLayer) {
  if (activeLayer !== "terrain") {
    try { map.setTerrain(null); } catch { /* Progressive enhancement only. */ }
    return;
  }
  if (!map.getSource("terrainSource")) {
    map.addSource("terrainSource", { type: "raster-dem", url: "https://tiles.mapterhorn.com/tilejson.json" });
  }
  if (!map.getSource("hillshadeSource")) {
    map.addSource("hillshadeSource", { type: "raster-dem", url: "https://tiles.mapterhorn.com/tilejson.json" });
  }
  if (!map.getLayer("terrain-hillshade")) {
    map.addLayer({
      id: "terrain-hillshade",
      type: "hillshade",
      source: "hillshadeSource",
      paint: {
        "hillshade-exaggeration": 0.55,
        "hillshade-shadow-color": "#020617",
        "hillshade-highlight-color": "#67e8f9",
        "hillshade-accent-color": "#0f766e",
      },
    });
  }
  try { map.setTerrain({ source: "terrainSource", exaggeration: 0.65 }); } catch { /* Progressive enhancement only. */ }
}

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
      locationClass: classifyLocationProvenance(coordinate.source),
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

  if (!map.getLayer("tap-heat-network")) {
    map.addLayer({
      id: "tap-heat-network",
      type: "heatmap",
      source: "tap-events-heat",
      filter: ["==", ["get", "locationClass"], "network_approx"],
      maxzoom: 14,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.42, 9, 1.05, 13, 1.45],
        // Network/IP coordinates represent a wider uncertainty area, not the phone position.
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 20, 8, 38, 12, 58],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.42, 9, 0.54, 12, 0.32, 14, 0.08],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(2,6,23,0)",
          0.2,
          "rgba(251,191,36,.18)",
          0.52,
          "rgba(245,158,11,.34)",
          0.78,
          "rgba(249,115,22,.48)",
          1,
          "rgba(234,88,12,.6)",
        ],
      },
    });
  }

  if (!map.getLayer("tap-heat-other")) {
    map.addLayer({
      id: "tap-heat-other",
      type: "heatmap",
      source: "tap-events-heat",
      filter: ["in", ["get", "locationClass"], ["literal", ["mixed_approx", "other_reported"]]],
      maxzoom: 14,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 9, 1, 13, 1.35],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 14, 8, 26, 12, 42],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.36, 9, 0.48, 12, 0.28, 14, 0.07],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(2,6,23,0)",
          0.22,
          "rgba(148,163,184,.18)",
          0.56,
          "rgba(139,92,246,.34)",
          1,
          "rgba(109,40,217,.5)",
        ],
      },
    });
  }

  if (!map.getLayer("tap-heat-gps")) {
    map.addLayer({
      id: "tap-heat-gps",
      type: "heatmap",
      source: "tap-events-heat",
      filter: ["==", ["get", "locationClass"], "consented_gps"],
      maxzoom: 14,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.58, 9, 1.5, 13, 2.1],
        // Consented browser GPS is privacy-rounded but materially narrower than network/IP.
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 8, 8, 16, 12, 26],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.72, 9, 0.84, 12, 0.52, 14, 0.14],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(2,6,23,0)",
          0.16,
          "rgba(34,211,238,.34)",
          0.4,
          "rgba(20,184,166,.6)",
          0.68,
          "rgba(16,185,129,.78)",
          1,
          "rgba(5,150,105,.94)",
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
        "circle-color": [
          "case",
          ["==", ["get", "risk"], 1], "#fb7185",
          ["==", ["get", "locationClass"], "consented_gps"], "#2dd4bf",
          ["==", ["get", "locationClass"], "network_approx"], "#f59e0b",
          "#a78bfa",
        ],
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
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          ["case", ["==", ["get", "locationClass"], "network_approx"], 18, 10],
          10,
          ["case", ["==", ["get", "locationClass"], "network_approx"], 54, 30],
          13,
          ["case", ["==", ["get", "locationClass"], "network_approx"], 88, 48],
        ],
        "circle-color": ["case", ["==", ["get", "locationClass"], "network_approx"], "rgba(245,158,11,.055)", "rgba(34,211,238,.055)"],
        "circle-stroke-color": ["case", ["==", ["get", "locationClass"], "network_approx"], "rgba(251,191,36,.48)", "rgba(94,234,212,.52)"],
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
        "circle-color": [
          "case",
          ["==", ["get", "risk"], 1], "#fb7185",
          ["==", ["get", "locationClass"], "consented_gps"], "#2dd4bf",
          ["==", ["get", "locationClass"], "network_approx"], "#f59e0b",
          "#a78bfa",
        ],
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
  set("tap-heat-network", view === "heat");
  set("tap-heat-other", view === "heat");
  set("tap-heat-gps", view === "heat");
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

function mapMotionDuration(duration: number) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return duration;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
}

function setBasemapLayer(map: MapLibreMap, layer: BaseMapLayer) {
  ensureTerrainEnhancement(map, layer);
  if (map.getLayer("operator-raster")) {
    const dark = layer === "dark" || layer === "terrain";
    map.setPaintProperty("operator-raster", "raster-brightness-max", dark ? 0.58 : 1);
    map.setPaintProperty("operator-raster", "raster-saturation", dark ? -0.32 : 0);
    map.setPaintProperty("operator-raster", "raster-contrast", dark ? 0.16 : 0);
  }
  map.easeTo({ pitch: layer === "terrain" ? 52 : 0, bearing: layer === "terrain" ? -18 : 0, duration: mapMotionDuration(500) });
  const pointStroke = layer === "light" ? "#0f172a" : "#ffffff";
  if (map.getLayer("tap-points")) map.setPaintProperty("tap-points", "circle-stroke-color", pointStroke);
  if (map.getLayer("tap-clusters")) map.setPaintProperty("tap-clusters", "circle-stroke-color", layer === "light" ? "rgba(15,23,42,.72)" : "rgba(255,255,255,.78)");
}

function fitData(maplibre: typeof import("maplibre-gl"), map: MapLibreMap, data: TapFeatureCollection, zoom: number) {
  if (!data.features.length) {
    map.easeTo({ center: [-64.2, -34.6], zoom: 3.7 + (zoom - 1) * 3, duration: mapMotionDuration(500) });
    return;
  }

  if (data.features.length === 1) {
    map.easeTo({ center: data.features[0].geometry.coordinates, zoom: 8 + (zoom - 1) * 4, duration: mapMotionDuration(500) });
    return;
  }

  const bounds = new maplibre.LngLatBounds();
  data.features.forEach((feature) => bounds.extend(feature.geometry.coordinates));
  map.fitBounds(bounds, {
    padding: { top: 72, bottom: 56, left: 56, right: 56 },
    maxZoom: 8.4 + (zoom - 1) * 3,
    duration: mapMotionDuration(650),
  });
}

export function RealtimeMapLibreMap({
  hotspots,
  events,
  mapView,
  baseMap,
  mode,
  zoom,
  dataState,
  dataStateDetail,
}: {
  hotspots: MapHotspot[];
  events: TenantTapRealtimeEvent[];
  mapView: MapView;
  baseMap?: BaseMapLayer;
  mode: MapMode;
  zoom: number;
  dataState: MapDataState;
  dataStateDetail: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const geojsonRef = useRef<TapFeatureCollection>({ type: "FeatureCollection", features: [] });
  const mapViewRef = useRef<MapView>(mapView);
  const zoomRef = useRef(zoom);
  const activeBaseMapRef = useRef<BaseMapLayer>(baseMap || "light");
  const activeStyleKeyRef = useRef("");
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
  const sourceSummary = useMemo(() => geojson.features.reduce((summary, feature) => {
    summary[feature.properties.locationClass] += 1;
    return summary;
  }, {
    consented_gps: 0,
    network_approx: 0,
    mixed_approx: 0,
    other_reported: 0,
  } as Record<LocationProvenanceClass, number>), [geojson]);
  const textualHotspots = hotspots.slice(0, 5);
  geojsonRef.current = geojson;
  mapViewRef.current = mapView;
  zoomRef.current = zoom;

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
      const initialBaseMap = baseMap || defaultBaseMapLayer();
      activeBaseMapRef.current = initialBaseMap;
      activeStyleKeyRef.current = basemapStyleKey(initialBaseMap);
      const map = new maplibre.Map({
        container: containerRef.current,
        style: basemapStyle(initialBaseMap) as any,
        center: [-64.2, -34.6],
        zoom: 3.7,
        attributionControl: false,
        cooperativeGestures: true,
        fadeDuration: 0,
      });

      mapRef.current = map;
      map.on("styleimagemissing", (event) => addMissingCircleImage(map, event.id));
      map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-right");

      let pulseStarted = false;
      map.on("style.load", () => {
        if (cancelled) return;
        const currentData = geojsonRef.current;
        ensureTerrainEnhancement(map, activeBaseMapRef.current);
        ensureLayers(map, currentData);
        setLayerVisibility(map, mapViewRef.current);
        setBasemapLayer(map, activeBaseMapRef.current);
        fitData(maplibre, map, currentData, zoomRef.current);
        if (!pulseStarted && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          pulseStarted = true;
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
        if (coords) map.easeTo({ center: coords, zoom: expansionZoom, duration: mapMotionDuration(450) });
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
              <small>Fuente: ${escapeHtml(locationProvenanceLabel(props.locationSource))}</small>
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
    const nextBaseMap = baseMap || themeBaseMap;
    const nextStyleKey = basemapStyleKey(nextBaseMap);
    activeBaseMapRef.current = nextBaseMap;
    if (nextStyleKey !== activeStyleKeyRef.current) {
      activeStyleKeyRef.current = nextStyleKey;
      setLoaded(false);
      map.setStyle(basemapStyle(nextBaseMap) as any);
      return;
    }
    setBasemapLayer(map, nextBaseMap);
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
      data-map-data-state={dataState}
      data-zoom={zoom.toFixed(2)}
      aria-labelledby={mapTitleId}
      aria-describedby={mapSummaryId}
      className="nexid-realtime-map relative h-full min-h-[300px] overflow-hidden rounded-xl border border-white/8 bg-[#061322] shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
      role="region"
    >
      <h3 id={mapTitleId} className="sr-only">Mapa operativo de lecturas con precisión geográfica declarada</h3>
      <div ref={containerRef} className="h-full w-full" />
      <div id={mapSummaryId} className="nexid-map-status pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-xl border border-white/10 bg-slate-950/78 px-3.5 py-2.5 text-sm font-semibold text-slate-300 shadow-xl backdrop-blur sm:max-w-[32rem]">
        <span data-testid="crm-maplibre-data-state" data-state={dataState} className={`nexid-map-data-badge mb-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${dataState === "real" ? "border-emerald-300/30 bg-emerald-400/12 text-emerald-100" : dataState === "demo" ? "border-violet-300/30 bg-violet-400/12 text-violet-100" : "border-amber-300/30 bg-amber-400/12 text-amber-100"}`}>
          {dataState === "real" ? "Eventos reales confirmados" : dataState === "demo" ? "Eventos demo aislados" : "Capa de eventos sin confirmar"}
        </span>
        <span className="nexid-map-status-summary block">
          <b className="nexid-map-status-count text-base font-black text-cyan-200">{geojson.features.length}</b> ubicaciones mapeables <span aria-hidden="true">·</span> {hotspots.length} zonas <span aria-hidden="true">·</span> {mode === "tenant" ? "tenant" : "global"}
        </span>
        {dataState === "unavailable" ? (
          <span className="nexid-map-status-detail mt-1 block text-[11px] font-medium leading-4 text-amber-100/90">{dataStateDetail}</span>
        ) : (
          <>
            <span className="nexid-map-status-precision mt-1 block text-[11px] font-medium leading-4 text-slate-400">
              {precisionSummary.reported} reportadas · {precisionSummary.approximate} aproximadas · sin coordenada persistida, el evento no se dibuja
            </span>
            <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold" aria-label="Procedencia de las ubicaciones visibles">
              <span className="text-emerald-200"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />GPS consentido {sourceSummary.consented_gps}</span>
              <span className="text-amber-200"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />Red/IP {sourceSummary.network_approx}</span>
              <span className="text-violet-200"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-400" aria-hidden="true" />Mixta/otra {sourceSummary.mixed_approx + sourceSummary.other_reported}</span>
            </span>
          </>
        )}
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
        <div data-testid="crm-map-empty-state" className="nexid-map-empty-state pointer-events-none absolute inset-x-3 top-1/2 z-10 flex -translate-y-1/2 justify-center text-center text-sm text-slate-300">
          <div className="nexid-map-empty-state-card max-w-md rounded-2xl border border-white/12 bg-slate-950/82 px-5 py-4 shadow-2xl backdrop-blur-xl">
            <b className="block text-white">{dataState === "unavailable" ? "Cartografía disponible · eventos sin confirmar" : dataState === "demo" ? "Demo sin ubicaciones utilizables" : "Sin ubicaciones utilizables en esta ventana"}</b>
            <span className="mt-1 block leading-5">{dataState === "unavailable" ? "Podés explorar la base geográfica; los puntos aparecerán al confirmar tenant, ventana y fuente." : "Cambia tenant o rango temporal, o realiza un tap con ciudad o GPS informado."}</span>
          </div>
        </div>
      ) : null}
      <details className="absolute bottom-8 right-3 z-10 max-w-[min(22rem,calc(100%-1.5rem))] rounded-xl border border-white/10 bg-slate-950/85 text-xs text-slate-300 shadow-xl backdrop-blur">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 font-black text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
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
