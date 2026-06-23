"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import type { TenantTapRealtimeEvent } from "../lib/realtime-feed";

type MapMode = "tenant" | "global";
type MapView = "heat" | "points" | "nearby";

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

const FALLBACK_COORDS: Array<{ match: RegExp; country: string; lat: number; lng: number }> = [
  { match: /san\s*martin|buenos\s*aires|caba/i, country: "AR", lat: -34.6037, lng: -58.3816 },
  { match: /mendoza|valle\s+de\s+uco|tunuyan|tupungato|lujan/i, country: "AR", lat: -32.8895, lng: -68.8458 },
  { match: /cordoba/i, country: "AR", lat: -31.4201, lng: -64.1888 },
  { match: /rosario/i, country: "AR", lat: -32.9442, lng: -60.6505 },
  { match: /neuquen/i, country: "AR", lat: -38.9516, lng: -68.0591 },
  { match: /mar\s*del\s*plata/i, country: "AR", lat: -38.0055, lng: -57.5426 },
];

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
      attribution: "© OpenStreetMap © CARTO",
    },
  },
  layers: [{ id: "carto-dark", type: "raster", source: "cartoDark" }],
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function fallbackCoordinate(city: string, country: string) {
  const normalizedCountry = country.toUpperCase();
  return FALLBACK_COORDS.find((item) => item.country === normalizedCountry && item.match.test(city)) || null;
}

function jitter(lng: number, lat: number, seed: string, fallbackUsed: boolean): [number, number] {
  if (!fallbackUsed) return [lng, lat];
  const hash = hashString(seed);
  const lngDelta = (((hash % 100) / 100) - 0.5) * 0.18;
  const latDelta = ((((hash >> 8) % 100) / 100) - 0.5) * 0.18;
  return [lng + lngDelta, lat + latDelta];
}

function deviceSummary(row: TenantTapRealtimeEvent) {
  return [row.deviceLabel, row.deviceOs, row.deviceType].map((item) => String(item || "").trim()).filter(Boolean).join(" · ") || "Dispositivo sin clasificar";
}

function eventToFeature(row: TenantTapRealtimeEvent, index: number): TapFeature | null {
  const city = String(row.city || "Unknown");
  const country = String(row.country || "--");
  const fallback = fallbackCoordinate(city, country);
  const hasRealCoords = Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng));
  const lat = hasRealCoords ? Number(row.lat) : fallback?.lat;
  const lng = hasRealCoords ? Number(row.lng) : fallback?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const verdict = String(row.verdict || "VALID").toUpperCase();
  const risk = verdict === "VALID" ? 0 : 1;
  const seed = String(row.eventId || row.uidMasked || row.occurredAt || index);
  const coordinates = jitter(Number(lng), Number(lat), seed, !hasRealCoords);

  return {
    type: "Feature",
    properties: {
      eventId: String(row.eventId || seed),
      uid: String(row.uidMasked || "UID n/a"),
      city,
      country,
      tenant: String(row.tenantSlug || "tenant"),
      verdict,
      risk,
      device: deviceSummary(row),
      occurredAt: String(row.occurredAt || ""),
      weight: risk ? 2.4 : 1,
    },
    geometry: {
      type: "Point",
      coordinates,
    },
  };
}

function buildGeojson(events: TenantTapRealtimeEvent[]): TapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map(eventToFeature).filter((item): item is TapFeature => Boolean(item)),
  };
}

function ensureLayers(map: MapLibreMap, data: TapFeatureCollection) {
  if (!map.getSource("tap-events")) {
    map.addSource("tap-events", {
      type: "geojson",
      data,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 42,
    });
  }

  if (!map.getLayer("tap-heat")) {
    map.addLayer({
      id: "tap-heat",
      type: "heatmap",
      source: "tap-events",
      maxzoom: 13,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 2.5, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.55, 9, 1.55],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 12, 9, 26],
        "heatmap-opacity": 0.72,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(2,6,23,0)",
          0.22,
          "rgba(34,211,238,.35)",
          0.48,
          "rgba(34,197,94,.55)",
          0.72,
          "rgba(250,204,21,.72)",
          1,
          "rgba(239,68,68,.78)",
        ],
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
        "circle-radius": ["step", ["get", "point_count"], 13, 8, 16, 25, 20, 60, 24],
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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 14, 10, 32],
        "circle-color": "rgba(34,211,238,.06)",
        "circle-stroke-color": "rgba(125,211,252,.46)",
        "circle-stroke-width": 1,
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
        "circle-radius": ["case", ["==", ["get", "risk"], 1], 5, 4],
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
  set("tap-nearby-radius", view === "nearby");
  set("tap-clusters", true);
  set("tap-points", true);
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
  mode,
  zoom,
}: {
  hotspots: MapHotspot[];
  events: TenantTapRealtimeEvent[];
  mapView: MapView;
  mode: MapMode;
  zoom: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [loaded, setLoaded] = useState(false);

  const geojson = useMemo(() => buildGeojson(events), [events]);
  const signature = useMemo(
    () => geojson.features.map((feature) => `${feature.properties.eventId}:${feature.geometry.coordinates.join(",")}`).join("|"),
    [geojson],
  );

  useEffect(() => {
    let cancelled = false;
    let cleanupResize: (() => void) | null = null;

    const boot = async () => {
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
        fitData(maplibre, map, geojson, zoom);
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
              <small>${escapeHtml(props.verdict)} · ${escapeHtml(props.device)}</small>
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

    void boot();
    return () => {
      cancelled = true;
      cleanupResize?.();
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
  }, [geojson, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    setLayerVisibility(map, mapView);
  }, [loaded, mapView]);

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
      data-zoom={zoom.toFixed(2)}
      className="relative h-full min-h-[300px] overflow-hidden rounded-xl border border-white/8 bg-[#061322] shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
    >
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/10 bg-slate-950/72 px-3 py-2 text-xs text-slate-300 shadow-xl backdrop-blur">
        <b className="text-cyan-200">{events.length}</b> taps · {hotspots.length} hotspots · {mode === "tenant" ? "tenant" : "global"}
      </div>
      {!geojson.features.length ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/55 text-center text-sm text-slate-300">
          <div>
            <b className="block text-white">Sin taps geolocalizados en esta ventana</b>
            Cambiá tenant o rango temporal para poblar el mapa.
          </div>
        </div>
      ) : null}
    </div>
  );
}
