"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker, Popup, StyleSpecification } from "maplibre-gl";
import { resolveTrustMapSource } from "@product/ui/trust-map-source";
import styles from "./sun-passport-map.module.css";

export type SunPassportMapLocation = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  evidence: string;
  mapHref?: string | null;
  accuracyM?: number | null;
  source?: "browser_gps_approximate_consent" | "browser_gps" | "browser_gps_reported" | "ip_geo" | "edge_ip_approx" | "declared_origin" | "demo" | null;
};

type SunPassportMapProps = {
  origin: SunPassportMapLocation | null;
  tap: SunPassportMapLocation | null;
  showRoute: boolean;
  distanceLabel: string;
  tapTimeLabel?: string | null;
};

type LoadState = "waiting" | "loading" | "ready" | "empty" | "error";

const LEGACY_CARTO_TEMPLATE = "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";
const FALLBACK_WORLD_STREET_MAP_TEMPLATE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const FALLBACK_WORLD_STREET_MAP_ATTRIBUTION = "Esri World Street Map / OpenStreetMap contributors";
const TRUST_MAP_SOURCE = resolveTrustMapSource();
const USE_CONFIGURED_RASTER = TRUST_MAP_SOURCE.rasterTileTemplate !== LEGACY_CARTO_TEMPLATE;

function isLightTheme() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return root.dataset.theme === "light" || root.classList.contains("theme-light");
}

function configuredRasterStyle(light: boolean): StyleSpecification {
  const tileTemplate = USE_CONFIGURED_RASTER
    ? TRUST_MAP_SOURCE.rasterTileTemplate
    : FALLBACK_WORLD_STREET_MAP_TEMPLATE;
  const attribution = USE_CONFIGURED_RASTER
    ? TRUST_MAP_SOURCE.attribution
    : FALLBACK_WORLD_STREET_MAP_ATTRIBUTION;
  return {
    version: 8,
    sources: {
      "configured-basemap": {
        type: "raster",
        tiles: [tileTemplate],
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      {
        id: "configured-basemap",
        type: "raster",
        source: "configured-basemap",
        paint: light
          ? { "raster-saturation": -0.12, "raster-contrast": 0.04 }
          : { "raster-saturation": -0.3, "raster-brightness-max": 0.64, "raster-contrast": 0.12 },
      },
    ],
  };
}

function mapStyleForTheme(light: boolean): StyleSpecification {
  // A small inline raster style avoids a remote style/sprite/glyph dependency
  // chain. The provider or configured enterprise source supplies the actual
  // geography; nexID only adds its origin/tap evidence layers.
  return configuredRasterStyle(light);
}

function effectiveAccuracyRadiusM(point: SunPassportMapLocation) {
  const isConsentedGps = point.source === "browser_gps_approximate_consent"
    || point.source === "browser_gps"
    || point.source === "browser_gps_reported";
  if (!isConsentedGps) return 0;
  const reportedAccuracyM = Number(point.accuracyM);
  // Public SUN coordinates are intentionally coarsened to two decimals. The
  // circle must include that half-cell uncertainty instead of drawing the more
  // precise, private browser accuracy around a rounded public point.
  const latitudeHalfCellM = 111_320 * 0.005;
  const longitudeHalfCellM = latitudeHalfCellM * Math.max(0.05, Math.abs(Math.cos(point.lat * Math.PI / 180)));
  const publicCoordinateUncertaintyM = Math.hypot(latitudeHalfCellM, longitudeHalfCellM);
  return Math.min(
    (Number.isFinite(reportedAccuracyM) && reportedAccuracyM > 0 ? reportedAccuracyM : 0) + publicCoordinateUncertaintyM,
    50_000,
  );
}

function accuracyPolygon(point: SunPassportMapLocation) {
  const radiusM = effectiveAccuracyRadiusM(point);
  if (!Number.isFinite(radiusM) || radiusM <= 0) return null;
  const earthRadiusM = 6_371_008.8;
  const angularDistance = radiusM / earthRadiusM;
  const latitude = point.lat * Math.PI / 180;
  const longitude = point.lng * Math.PI / 180;
  const coordinates: [number, number][] = [];

  for (let index = 0; index <= 64; index += 1) {
    const bearing = index / 64 * Math.PI * 2;
    const nextLat = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance)
      + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const nextLng = longitude + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLat),
    );
    coordinates.push([nextLng * 180 / Math.PI, nextLat * 180 / Math.PI]);
  }

  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coordinates] },
  };
}

function popupContent(kind: "origin" | "tap", point: SunPassportMapLocation) {
  const container = document.createElement("div");
  container.className = styles.popup;

  const eyebrow = document.createElement("span");
  eyebrow.className = styles.popupEyebrow;
  eyebrow.textContent = kind === "origin" ? "Origen declarado" : tapSourcePresentation(point).eyebrow;

  const title = document.createElement("strong");
  title.className = styles.popupTitle;
  title.textContent = point.label;

  const meta = document.createElement("p");
  meta.className = styles.popupMeta;
  meta.textContent = point.evidence;

  container.append(eyebrow, title, meta);
  return container;
}

function tapSourcePresentation(point: SunPassportMapLocation | null) {
  if (!point) {
    return {
      eyebrow: "Zona de esta lectura",
      badge: "Sin ubicación",
      explanation: "El tap no informó coordenadas. El pasaporte sigue disponible y no se inventa una posición.",
    };
  }

  if (point.source === "edge_ip_approx" || point.source === "ip_geo") {
    return {
      eyebrow: "Zona estimada por red",
      badge: "Red / IP · aproximada",
      explanation: "Es una referencia amplia calculada por la conexión. No es GPS del teléfono ni una ubicación exacta.",
    };
  }

  if (
    point.source === "browser_gps_approximate_consent"
    || point.source === "browser_gps"
    || point.source === "browser_gps_reported"
  ) {
    return {
      eyebrow: "Zona compartida por el teléfono",
      badge: "GPS · con permiso",
      explanation: "El navegador compartió esta zona después del tap y con consentimiento. La coordenada pública está redondeada.",
    };
  }

  if (point.source === "demo") {
    return {
      eyebrow: "Zona de muestra",
      badge: "Demo simulado",
      explanation: "Este punto pertenece al Demo Lab y no representa un teléfono ni una lectura física.",
    };
  }

  return {
    eyebrow: "Zona de esta lectura",
    badge: "Fuente reportada",
    explanation: "Se muestra la coordenada informada por la fuente sin atribuirle una precisión adicional.",
  };
}

export function SunPassportMap({ origin, tap, showRoute, distanceLabel, tapTimeLabel }: SunPassportMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupsRef = useRef<Record<string, Popup>>({});
  const fitAllRef = useRef<() => void>(() => undefined);
  const focusRef = useRef<(point: SunPassportMapLocation) => void>(() => undefined);
  const [loadState, setLoadState] = useState<LoadState>("waiting");
  const [isDegraded, setIsDegraded] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const points = useMemo(
    () => [origin ? { kind: "origin" as const, point: origin } : null, tap ? { kind: "tap" as const, point: tap } : null].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [origin, tap],
  );
  const pointKey = points.map(({ kind, point }) => (
    `${kind}:${point.id}:${point.lat}:${point.lng}:${point.accuracyM || 0}:${point.source || ""}:${point.label}:${point.evidence}:${point.mapHref || ""}`
  )).join("|");

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (!points.length) {
      setLoadState("empty");
      return;
    }

    let disposed = false;
    let started = false;
    let observer: IntersectionObserver | null = null;
    let themeObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let loadTimeoutId: number | null = null;
    let styleReady = false;

    const start = async () => {
      if (started || disposed) return;
      started = true;
      setIsDegraded(false);
      setLoadState("loading");
      loadTimeoutId = window.setTimeout(() => {
        if (!disposed && !styleReady) setLoadState("error");
      }, 8_000);

      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !mapContainerRef.current) return;

        const map = new maplibre.Map({
          container: mapContainerRef.current,
          style: mapStyleForTheme(isLightTheme()),
          center: [points[0].point.lng, points[0].point.lat],
          zoom: points.length === 1 ? 10 : 4,
          minZoom: 2,
          maxZoom: 17,
          maxPitch: 0,
          dragRotate: false,
          pitchWithRotate: false,
          scrollZoom: false,
          cooperativeGestures: true,
          locale: {
            "NavigationControl.ZoomIn": "Acercar",
            "NavigationControl.ZoomOut": "Alejar",
            "NavigationControl.ResetBearing": "Restablecer orientación",
            "AttributionControl.ToggleAttribution": "Mostrar atribución",
            "AttributionControl.MapFeedback": "Informar un problema del mapa",
            "Popup.Close": "Cerrar",
            "CooperativeGesturesHandler.WindowsHelpText": "Usá Ctrl + desplazamiento para acercar el mapa",
            "CooperativeGesturesHandler.MacHelpText": "Usá ⌘ + desplazamiento para acercar el mapa",
            "CooperativeGesturesHandler.MobileHelpText": "Usá dos dedos para mover el mapa",
          },
          attributionControl: false,
        });
        mapRef.current = map;
        map.on("styleimagemissing", (event) => {
          if (map.hasImage(event.id)) return;
          const size = 32;
          const data = new Uint8Array(size * size * 4);
          const center = (size - 1) / 2;
          const radius = 10;
          for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
              if (Math.hypot(x - center, y - center) > radius) continue;
              const offset = (y * size + x) * 4;
              data[offset] = 100;
              data[offset + 1] = 116;
              data[offset + 2] = 139;
              data[offset + 3] = 230;
            }
          }
          map.addImage(event.id, { width: size, height: size, data }, { pixelRatio: 2 });
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibre.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
        map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-left");

        const clearLoadTimers = () => {
          if (loadTimeoutId != null) window.clearTimeout(loadTimeoutId);
          loadTimeoutId = null;
        };
        const markReady = () => {
          if (disposed) return;
          clearLoadTimers();
          setLoadState("ready");
        };

        const duration = (milliseconds: number) => (
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : milliseconds
        );
        const focusZoom = (point: SunPassportMapLocation) => {
          if (point.source === "ip_geo" || point.source === "edge_ip_approx") return 7;
          const radiusM = effectiveAccuracyRadiusM(point);
          if (radiusM >= 25_000) return 7;
          if (radiusM >= 10_000) return 8;
          if (radiusM >= 5_000) return 9;
          if (radiusM >= 2_000) return 10;
          if (radiusM >= 1_000) return 11;
          return 12;
        };
        const fitAll = (animated = true) => {
          if (!mapRef.current) return;
          if (points.length === 1 && points[0].kind === "origin") {
            mapRef.current.easeTo({
              center: [points[0].point.lng, points[0].point.lat],
              zoom: 10.5,
              duration: animated ? duration(450) : 0,
            });
            return;
          }
          const bounds = new maplibre.LngLatBounds();
          points.forEach(({ point }) => bounds.extend([point.lng, point.lat]));
          if (tap && effectiveAccuracyRadiusM(tap) > 0) {
            const radiusM = effectiveAccuracyRadiusM(tap);
            const latitudeDelta = radiusM / 111_320;
            const longitudeDelta = radiusM / (111_320 * Math.max(0.05, Math.abs(Math.cos(tap.lat * Math.PI / 180))));
            bounds.extend([tap.lng - longitudeDelta, tap.lat - latitudeDelta]);
            bounds.extend([tap.lng + longitudeDelta, tap.lat + latitudeDelta]);
          }
          mapRef.current.fitBounds(bounds, {
            padding: window.innerWidth < 640 ? { top: 72, right: 42, bottom: 64, left: 42 } : { top: 82, right: 72, bottom: 72, left: 72 },
            maxZoom: points.length === 1 && tap ? focusZoom(tap) : 10.5,
            duration: animated ? duration(550) : 0,
          });
        };
        fitAllRef.current = () => fitAll(true);

        points.forEach(({ kind, point }, index) => {
          const markerAnchor = document.createElement("div");
          markerAnchor.className = styles.markerAnchor;
          const element = document.createElement("button");
          element.type = "button";
          element.className = `${styles.marker} ${kind === "tap" ? styles.markerTap : ""}`;
          element.setAttribute("aria-label", `${kind === "origin" ? "Origen declarado" : tapSourcePresentation(point).eyebrow}: ${point.label}`);
          const number = document.createElement("span");
          number.textContent = String(index + 1);
          element.append(number);
          markerAnchor.append(element);

          const popup = new maplibre.Popup({ offset: 24, closeButton: true, closeOnClick: false, maxWidth: "260px" })
            .setDOMContent(popupContent(kind, point));
          popupsRef.current[point.id] = popup;

          element.addEventListener("click", () => {
            Object.values(popupsRef.current).forEach((openPopup) => openPopup.remove());
            popup.setLngLat([point.lng, point.lat]).addTo(map);
            map.easeTo({
              center: [point.lng, point.lat],
              zoom: Math.min(Math.max(map.getZoom(), 8), focusZoom(point)),
              duration: duration(350),
            });
          });

          const marker = new maplibre.Marker({ element: markerAnchor, anchor: "bottom" })
            .setLngLat([point.lng, point.lat])
            .addTo(map);
          markersRef.current.push(marker);
        });

        focusRef.current = (point) => {
          const popup = popupsRef.current[point.id];
          if (!popup) return;
          Object.values(popupsRef.current).forEach((openPopup) => openPopup.remove());
          popup.setLngLat([point.lng, point.lat]).addTo(map);
          map.easeTo({
            center: [point.lng, point.lat],
            zoom: Math.min(Math.max(map.getZoom(), 8), focusZoom(point)),
            duration: duration(350),
          });
        };

        let tileErrorCount = 0;
        map.on("error", (event) => {
          const sourceId = String((event as { sourceId?: string }).sourceId || "");
          const message = String(event.error?.message || "");
          const isBaseMapFailure = Boolean(sourceId) || /tile|source|fetch|network|cors|style|sprite|glyph/i.test(message);
          if (!isBaseMapFailure) return;
          tileErrorCount += 1;
          // A vector style may report optional glyph/sprite/tile failures while
          // the useful basemap and markers are already visible. Never cover a
          // rendered map with a fatal overlay because one auxiliary request
          // failed; surface the partial state as a small badge instead.
          if (styleReady && tileErrorCount >= 3 && !disposed) setIsDegraded(true);
        });
        map.on("idle", () => {
          if (disposed || !map.areTilesLoaded()) return;
          tileErrorCount = 0;
          markReady();
        });

        const addOperationalLayers = () => {
          if (tap) {
            const polygon = accuracyPolygon(tap);
            if (polygon && !map.getSource("sun-tap-accuracy")) {
              map.addSource("sun-tap-accuracy", { type: "geojson", data: polygon });
              map.addLayer({
                id: "sun-tap-accuracy-fill",
                type: "fill",
                source: "sun-tap-accuracy",
                paint: { "fill-color": "#2563eb", "fill-opacity": 0.1 },
              });
              map.addLayer({
                id: "sun-tap-accuracy-line",
                type: "line",
                source: "sun-tap-accuracy",
                paint: { "line-color": "#2563eb", "line-width": 1.5, "line-opacity": 0.5 },
              });
            }
          }

          if (showRoute && origin && tap && !map.getSource("sun-demo-connection")) {
            map.addSource("sun-demo-connection", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: { kind: "demo_only" },
                geometry: { type: "LineString", coordinates: [[origin.lng, origin.lat], [tap.lng, tap.lat]] },
              },
            });
            map.addLayer({
              id: "sun-demo-connection-line",
              type: "line",
              source: "sun-demo-connection",
              layout: { "line-cap": "round" },
              paint: {
                "line-color": "#0891b2",
                "line-width": 2.5,
                "line-dasharray": [2, 2.5],
                "line-opacity": 0.72,
              },
            });
          }
        };

        map.on("style.load", () => {
          if (disposed) return;
          styleReady = true;
          addOperationalLayers();
          fitAll(false);
          markReady();
        });
        map.on("render", () => {
          if (!disposed && map.loaded() && map.areTilesLoaded()) markReady();
        });
        map.on("load", () => {
          if (disposed) return;
          addOperationalLayers();
          fitAll(false);
          markReady();
        });

        let currentLightTheme = isLightTheme();
        const syncTheme = () => {
          const nextLightTheme = isLightTheme();
          if (nextLightTheme === currentLightTheme) return;
          currentLightTheme = nextLightTheme;
          styleReady = false;
          setIsDegraded(false);
          setLoadState("loading");
          loadTimeoutId = window.setTimeout(() => {
            if (!disposed && !styleReady) setLoadState("error");
          }, 8_000);
          map.setStyle(mapStyleForTheme(nextLightTheme));
        };
        themeObserver = new MutationObserver(syncTheme);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(container);
      } catch {
        if (!disposed) setLoadState("error");
      }
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          void start();
        }
      }, { rootMargin: "320px 0px" });
      observer.observe(container);
    } else {
      void start();
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      themeObserver?.disconnect();
      resizeObserver?.disconnect();
      if (loadTimeoutId != null) window.clearTimeout(loadTimeoutId);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      Object.values(popupsRef.current).forEach((popup) => popup.remove());
      popupsRef.current = {};
      mapRef.current?.remove();
      mapRef.current = null;
      fitAllRef.current = () => undefined;
      focusRef.current = () => undefined;
    };
  // Coordinates and evidence changes rebuild markers after a consented local update.
  }, [pointKey, showRoute, retryNonce]);

  const renderLocation = (kind: "origin" | "tap", point: SunPassportMapLocation | null, index: number) => {
    const tapPresentation = tapSourcePresentation(point);
    if (!point) {
      return (
        <div className={styles.locationStatic}>
          <span className={`${styles.locationIndex} ${kind === "tap" ? styles.locationIndexTap : ""}`}>{index}</span>
          <span className={styles.locationCopy}>
            <span className={styles.locationEyebrow}>{kind === "origin" ? "Origen" : tapPresentation.eyebrow}</span>
            <span className={styles.locationTitle}>{kind === "origin" ? "Origen no geolocalizado" : "Ubicación no confirmada"}</span>
            <span className={styles.locationMeta}>{kind === "origin" ? "La empresa todavía no informó coordenadas." : tapPresentation.explanation}</span>
          </span>
        </div>
      );
    }

    return (
      <div className={styles.locationRow}>
        <button
          type="button"
          className={styles.locationButton}
          onClick={() => focusRef.current(point)}
          aria-label={`Enfocar ${kind === "origin" ? "origen" : "tap"} en el mapa: ${point.label}`}
        >
          <span className={`${styles.locationIndex} ${kind === "tap" ? styles.locationIndexTap : ""}`}>{index}</span>
          <span className={styles.locationCopy}>
            <span className={styles.locationEyebrow}>{kind === "origin" ? "Origen declarado" : tapPresentation.eyebrow}</span>
            <span className={styles.locationTitle}>{point.label}</span>
            <span className={styles.locationMeta}>{kind === "origin" ? "Informado por la empresa" : tapPresentation.badge}</span>
          </span>
        </button>
        {point.mapHref ? <a className={styles.externalLink} href={point.mapHref} target="_blank" rel="noreferrer" aria-label={`Abrir ${kind === "origin" ? "origen" : "tap"} en OpenStreetMap`}>Abrir mapa ↗</a> : <span />}
      </div>
    );
  };

  const tapPresentation = tapSourcePresentation(tap);
  const isNetworkEstimate = tap?.source === "edge_ip_approx" || tap?.source === "ip_geo";

  return (
    <div className={styles.shell} data-sun-passport-map="maplibre" data-route-mode={showRoute ? "demo" : "no-route"}>
      <div className={styles.mapFrame} role="region" aria-label="Mapa interactivo del origen declarado y la zona de esta lectura">
        <div ref={mapContainerRef} className={styles.map} />
        {loadState === "waiting" || loadState === "loading" ? (
          <div className={styles.loading} aria-live="polite">
            <div>
              <span className={styles.loadingDot} />
              <strong>Cargando cartografía</strong>
              <p className="mt-1 text-xs">Origen y tap siguen disponibles en la lista.</p>
            </div>
          </div>
        ) : null}
        {loadState === "error" ? (
          <div className={styles.fallback} role="status">
            <div>
              <strong>La cartografía no pudo cargarse.</strong>
              <p className="mt-2 text-xs leading-5">Las ubicaciones y sus enlaces siguen accesibles debajo.</p>
              <button type="button" className={styles.retryButton} onClick={() => { setLoadState("waiting"); setRetryNonce((value) => value + 1); }}>Reintentar mapa</button>
            </div>
          </div>
        ) : null}
        {loadState === "empty" ? (
          <div className={styles.empty} role="status">
            <div><strong>No hay ubicaciones reportadas.</strong><p className="mt-2 text-xs leading-5">La empresa no informó coordenadas de origen y el usuario no confirmó una zona para esta lectura.</p></div>
          </div>
        ) : null}
        {loadState === "ready" ? (
          <>
            <div className={styles.mapLegend} aria-hidden="true">
              {origin ? <span className={styles.legendItem}><i className={styles.legendDot} />Origen</span> : null}
              {tap ? <span className={styles.legendItem}><i className={`${styles.legendDot} ${styles.legendDotTap}`} />{isNetworkEstimate ? "Zona por red" : "Esta lectura"}</span> : null}
              {showRoute && origin && tap ? <span className={styles.demoBadge}>Demo · conexión ilustrativa</span> : null}
              {isDegraded ? <span className={styles.degradedBadge}>Cartografía parcial</span> : null}
            </div>
            <button type="button" className={styles.fitButton} onClick={() => fitAllRef.current()}>Reencuadrar</button>
          </>
        ) : null}
      </div>
      <div className={styles.details}>
        {renderLocation("origin", origin, 1)}
        {renderLocation("tap", tap, 2)}
      </div>
      <div className={styles.locationSourceSummary}>
        <span className={styles.sourceBadge}>{tapPresentation.badge}</span>
        <p>{tapPresentation.explanation}</p>
      </div>
      <details className={styles.technicalDetails}>
        <summary>Cómo se obtuvo esta ubicación</summary>
        <div className={styles.technicalBody}>
          {tap ? <p><strong>Fuente de esta lectura:</strong> {tap.evidence}</p> : null}
          {origin ? <p><strong>Origen:</strong> coordenada declarada por la empresa; no medida por el NFC.</p> : null}
          <p>
            {showRoute && origin && tap
              ? `Demo: la línea punteada conecta dos puntos simulados (${distanceLabel}); no representa un recorrido físico.`
              : origin && tap && !isNetworkEstimate
                ? `La separación en línea recta es ${distanceLabel}. No demuestra recorrido, custodia ni presencia física del producto.`
                : origin && tap
                  ? "No calculamos una distancia para el usuario porque la ubicación de red es demasiado amplia para presentarla como una medición precisa."
                  : "Se muestra únicamente la ubicación disponible. No se inventa una posición ni una ruta para el punto faltante."}
          </p>
          {tapTimeLabel ? <p><strong>Lectura informada:</strong> {tapTimeLabel}.</p> : null}
          {tap && !isNetworkEstimate ? <p>El área alrededor del tap incluye como mínimo el redondeo de la coordenada pública; la fuente puede ser menos precisa.</p> : null}
          <p className={styles.attribution}>
            Cartografía: {USE_CONFIGURED_RASTER ? TRUST_MAP_SOURCE.attribution : FALLBACK_WORLD_STREET_MAP_ATTRIBUTION}.
            {" "}La política <code>no-referrer</code> evita enviar la URL o el identificador del pasaporte al proveedor cartográfico.
          </p>
        </div>
      </details>
    </div>
  );
}
