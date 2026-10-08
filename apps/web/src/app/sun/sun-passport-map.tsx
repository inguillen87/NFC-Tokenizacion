"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker, Popup, StyleSpecification } from "maplibre-gl";
import { resolveTrustMapSource } from "@product/ui/trust-map-source";
import styles from "./sun-passport-map.module.css";
import {configureSunMapWorker} from "../../lib/sun-map-worker";
import {googlePointLink, googleComparisonLink, sunMapInsets} from "../../lib/sun-external-map";
import { sunReferenceMapStyle } from "./sun-reference-map";
import type { SunLocale } from "./sun-locale";

export type SunPassportMapLocation = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  evidence: string;
  mapHref?: string | null;
  accuracyM?: number | null;
  source?: "browser_geolocation_approximate_consent" | "browser_gps_approximate_consent" | "browser_gps" | "browser_gps_reported" | "ip_geo" | "edge_ip_approx" | "declared_origin" | "demo" | "public_producer_reference" | "demo_browser_approximate_consent" | null;
};

type SunPassportMapProps = {
  origin: SunPassportMapLocation | null;
  tap: SunPassportMapLocation | null;
  showRoute: boolean;
  distanceLabel: string;
  tapTimeLabel?: string | null;
  cartography?: "reference";
  locale?: SunLocale;
};

type LoadState = "waiting" | "loading" | "ready" | "empty" | "error";

const LEGACY_CARTO_TEMPLATE = "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";
const FALLBACK_WORLD_STREET_MAP_TEMPLATE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const FALLBACK_WORLD_STREET_MAP_ATTRIBUTION = "Esri World Street Map / OpenStreetMap contributors";
// Compact visible credit; source and licence names remain accessible and readable.
const FALLBACK_WORLD_STREET_MAP_CREDIT = '© <a href="https://www.esri.com/en-us/legal/copyright-trademarks" target="_blank" rel="noopener noreferrer">Esri</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

const TRUST_MAP_SOURCE = resolveTrustMapSource();
const USE_CONFIGURED_RASTER = Boolean(
  TRUST_MAP_SOURCE.rasterTileTemplate
  && TRUST_MAP_SOURCE.rasterTileTemplate !== LEGACY_CARTO_TEMPLATE,
);

function isLightTheme() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return root.dataset.theme === "light" || root.classList.contains("theme-light");
}

function configuredRasterStyle(light: boolean): StyleSpecification {
  const tileTemplate = USE_CONFIGURED_RASTER && TRUST_MAP_SOURCE.rasterTileTemplate
    ? TRUST_MAP_SOURCE.rasterTileTemplate
    : FALLBACK_WORLD_STREET_MAP_TEMPLATE;
  const attribution = USE_CONFIGURED_RASTER
    ? TRUST_MAP_SOURCE.attribution
    : FALLBACK_WORLD_STREET_MAP_CREDIT;
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
        // MapLibre mixes brightness-min to brightness-max per raster channel.
        // Reversing these endpoints makes light cartography charcoal with light
        // labels; only this basemap layer changes, never the evidence overlays.
        // https://maplibre.org/maplibre-style-spec/layers/#raster-brightness-min
        paint: light
          ? { "raster-saturation": -0.12, "raster-contrast": 0.04 }
          : {
              "raster-saturation": -1,
              "raster-brightness-min": 0.94,
              "raster-brightness-max": 0.08,
              "raster-contrast": 0.08,
            },
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
  const isConsentedBrowserLocation = point.source === "browser_geolocation_approximate_consent"
    || point.source === "browser_gps_approximate_consent"
    || point.source === "demo_browser_approximate_consent";
  if (!isConsentedBrowserLocation) return 0;
  const reportedAccuracyM = Number(point.accuracyM);
  // Public SUN coordinates are intentionally coarsened to two decimals. The
  // circle must include that half-cell uncertainty instead of drawing the more
  // precise, private browser accuracy around a rounded public point.
  const latitudeHalfCellM = 111_320 * 0.005;
  const longitudeHalfCellM = latitudeHalfCellM * Math.max(0.05, Math.abs(Math.cos(point.lat * Math.PI / 180)));
  const publicCoordinateUncertaintyM = Math.hypot(latitudeHalfCellM, longitudeHalfCellM);
  return (Number.isFinite(reportedAccuracyM) && reportedAccuracyM > 0 ? reportedAccuracyM : 0)
    + publicCoordinateUncertaintyM;
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
  eyebrow.textContent = kind === "origin" ? originPresentation(point).eyebrow : tapSourcePresentation(point).eyebrow;

  const title = document.createElement("strong");
  title.className = styles.popupTitle;
  title.textContent = point.label;

  const meta = document.createElement("p");
  meta.className = styles.popupMeta;
  meta.textContent = point.evidence;

  container.append(eyebrow, title, meta);
  return container;
}

function originPresentation(point: SunPassportMapLocation | null) {
  return point?.source === "public_producer_reference"
    ? { eyebrow: "Viña · punto público", meta: "Referencia del sitio oficial" }
    : { eyebrow: "Origen declarado", meta: "Informado por la empresa" };
}

function tapSourcePresentation(point: SunPassportMapLocation | null) {
  if (point?.source === "demo_browser_approximate_consent") {
    return {
      kind: "demo_browser" as const,
      eyebrow: "Tu zona · sólo en esta demo",
      badge: "Con permiso · demo",
      legend: "Tu zona aproximada",
      explanation: "Esta zona aproximada sólo se muestra en la demo. No se guarda ni crea una lectura NFC o un registro del CRM.",
    };
  }
  if (!point) {
    return {
      kind: "none" as const,
      eyebrow: "Zona de esta lectura",
      badge: "Sin ubicación",
      legend: "Sin ubicación",
      explanation: "El tap no informó coordenadas. El pasaporte sigue disponible y no se inventa una posición.",
    };
  }

  if (point.source === "edge_ip_approx" || point.source === "ip_geo") {
    return {
      kind: "network" as const,
      eyebrow: "Zona estimada por red",
      badge: "Red / IP · aproximada",
      legend: "Zona por red / IP",
      explanation: "Es una referencia amplia calculada por la conexión. No es GPS del teléfono ni una ubicación exacta.",
    };
  }

  if (
    point.source === "browser_geolocation_approximate_consent"
    || point.source === "browser_gps_approximate_consent"
  ) {
    return {
      kind: "consented_browser" as const,
      eyebrow: "Zona compartida por el teléfono",
      badge: "Navegador · aproximada",
      legend: "Navegador consentido",
      explanation: "El navegador compartió esta zona aproximada después del tap y con consentimiento. La coordenada pública está redondeada.",
    };
  }

  if (point.source === "browser_gps" || point.source === "browser_gps_reported") {
    return {
      kind: "reported" as const,
      eyebrow: "Ubicación informada por integración",
      badge: "Fuente heredada · no confirmada",
      legend: "Fuente reportada",
      explanation: "La integración informó esta coordenada, pero el registro no acredita consentimiento del navegador ni una posición exacta.",
    };
  }

  if (point.source === "demo") {
    return {
      kind: "demo" as const,
      eyebrow: "Zona de muestra",
      badge: "Demo simulado",
      legend: "Punto demo",
      explanation: "Este punto es ilustrativo y no representa un teléfono ni una lectura física.",
    };
  }

  return {
    kind: "reported" as const,
    eyebrow: "Zona de esta lectura",
    badge: "Fuente reportada",
    legend: "Fuente reportada",
    explanation: "Se muestra la coordenada informada por la fuente sin atribuirle una precisión adicional.",
  };
}

export function SunPassportMap({ origin, tap, showRoute, distanceLabel, tapTimeLabel, cartography, locale = "es-AR" }: SunPassportMapProps) {
  const mapId = useId();
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [controlNotice, setControlNotice] = useState("");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupsRef = useRef<Record<string, Popup>>({});
  const fitAllRef = useRef<() => void>(() => undefined);
  const focusRef = useRef<(point: SunPassportMapLocation, trigger: HTMLButtonElement, keyboard: boolean) => void>(() => undefined);
  const closePopupRef = useRef<() => boolean>(() => false);
  const [loadState, setLoadState] = useState<LoadState>(() => origin || tap ? "waiting" : "empty");
  const [isDegraded, setIsDegraded] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const points = useMemo(
    () => [origin ? { kind: "origin" as const, point: origin } : null, tap ? { kind: "tap" as const, point: tap } : null].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [origin, tap],
  );
  const pointKey = points.map(({ kind, point }) => (
    `${kind}:${point.id}:${point.lat}:${point.lng}:${point.accuracyM || 0}:${point.source || ""}:${point.label}:${point.evidence}:${point.mapHref || ""}`
  )).join("|");
  const showDemoConnection = Boolean(showRoute && origin && tap?.source === "demo");

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
    let fullyReady = false;
    let rasterTileLoaded = false;
    let activePopup: {
      popup: Popup;
      trigger: HTMLButtonElement;
      closeButton: HTMLButtonElement | null;
      onDismiss: (event: Event) => void;
    } | null = null;
    const closePopup = (restoreFocus = false) => {
      const session = activePopup;
      if (!session) return false;
      // Clear the session before MapLibre fires its synchronous close callback.
      activePopup = null;
      session.closeButton?.removeEventListener("click", session.onDismiss, true);
      session.popup.remove();
      if (restoreFocus && session.trigger.isConnected && !session.trigger.disabled && !session.trigger.closest("[inert]")) {
        session.trigger.focus({ preventScroll: true });
      }
      return true;
    };

    const start = async () => {
      if (started || disposed) return;
      started = true;
      setIsDegraded(false);
      setLoadState("loading");
      loadTimeoutId = window.setTimeout(() => {
        if (!disposed && !fullyReady) setLoadState("error");
      }, 8_000);

      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !mapContainerRef.current) return;

        configureSunMapWorker(maplibre, window.location.origin);
        const map = new maplibre.Map({
          container: mapContainerRef.current,
          style: cartography === "reference" ? sunReferenceMapStyle(isLightTheme()) : mapStyleForTheme(isLightTheme()),
          center: [points[0].point.lng, points[0].point.lat],
          zoom: points.length === 1 ? 10 : 4,
          minZoom: cartography === "reference" ? -2 : 2,
          maxZoom: cartography === "reference" ? 8 : 17,
          renderWorldCopies: cartography !== "reference",
          // The overview needs room outside the world edge for readable pins.
          // Default Mercator constraints can discard fitBounds padding near a pole.
          transformConstrain: cartography === "reference" ? (center, zoom) => ({
            center: new maplibre.LngLat(center.lng, Math.max(-85, Math.min(85, center.lat))),
            zoom: Math.max(-2, Math.min(8, zoom)),
          }) : undefined,
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
          if (disposed || !rasterTileLoaded) return;
          fullyReady = true;
          clearLoadTimers();
          setLoadState("ready");
        };

        const duration = (milliseconds: number) => (
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : milliseconds
        );
        const focusZoom = (point: SunPassportMapLocation) => {
          if (cartography === "reference") return 7;
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
          mapRef.current.stop();
          closePopup();
          Object.values(popupsRef.current).forEach(popup => popup.remove());
          if (points.length === 1 && points[0].kind === "origin") {
            mapRef.current.easeTo({
              center: [points[0].point.lng, points[0].point.lat],
              zoom: cartography === "reference" ? 7 : 10.5,
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
            const south = tap.lat - latitudeDelta;
            const north = tap.lat + latitudeDelta;
            bounds.extend([tap.lng - longitudeDelta, cartography === "reference" ? Math.max(-85, south) : south]);
            bounds.extend([tap.lng + longitudeDelta, cartography === "reference" ? Math.min(85, north) : north]);
          }
          mapRef.current.fitBounds(bounds, {
            padding: cartography === "reference" ? { top: 96, bottom: 64, left: 48, right: 96 } : sunMapInsets(container.clientWidth, container.clientHeight),
            maxZoom: cartography === "reference" ? 7 : points.length === 1 && tap ? focusZoom(tap) : 10.5,
            duration: animated ? duration(550) : 0,
          });
        };
        fitAllRef.current = () => fitAll(true);
        closePopupRef.current = () => closePopup(true);

        const openPopup = (point: SunPassportMapLocation, trigger: HTMLButtonElement, keyboard: boolean) => {
          const popup = popupsRef.current[point.id];
          if (disposed || !popup) return;
          closePopup();
          Object.values(popupsRef.current).forEach((openPopup) => openPopup.remove());
          popup.setLngLat([point.lng, point.lat]).addTo(map);
          const closeButton = popup.getElement().querySelector<HTMLButtonElement>(".maplibregl-popup-close-button");
          const onDismiss = (event: Event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            closePopup(true);
          };
          closeButton?.addEventListener("click", onDismiss, true);
          activePopup = { popup, trigger, closeButton, onDismiss };
          // Pointer activation keeps its natural focus; keyboard users enter the detail.
          if (keyboard) closeButton?.focus({ preventScroll: true });
          map.easeTo({
            center: [point.lng, point.lat],
            zoom: Math.min(Math.max(map.getZoom(), 8), focusZoom(point)),
            duration: duration(350),
          });
        };
        focusRef.current = openPopup;

        points.forEach(({ kind, point }) => {
          const markerAnchor = document.createElement("div");
          markerAnchor.className = styles.markerAnchor;
          const element = document.createElement("button");
          element.type = "button";
          element.className = `${styles.marker} ${kind === "tap" ? styles.markerTap : ""}`;
          element.setAttribute("aria-label", `${kind === "origin" ? originPresentation(point).eyebrow : tapSourcePresentation(point).eyebrow}: ${point.label}`);
          const markerCode = document.createElement("span");
          markerCode.textContent = kind === "origin" ? "O" : "T";
          markerCode.setAttribute("aria-hidden", "true");
          element.append(markerCode);
          markerAnchor.append(element);

          const popup = new maplibre.Popup({ offset: 24, closeButton: true, closeOnClick: false, focusAfterOpen: false, maxWidth: "260px" })
            .setDOMContent(popupContent(kind, point));
          popupsRef.current[point.id] = popup;
          popup.on("close", () => {
            if (activePopup?.popup !== popup) return;
            const session = activePopup;
            activePopup = null;
            session.closeButton?.removeEventListener("click", session.onDismiss, true);
          });
          element.addEventListener("click", (event) => openPopup(point, element, event.detail === 0));

          const marker = new maplibre.Marker({ element: markerAnchor, anchor: "bottom" })
            .setLngLat([point.lng, point.lat])
            .addTo(map);
          markersRef.current.push(marker);
        });

        if (cartography === "reference") {
          // HTML labels avoid a glyph provider. Coordinates are only public country references.
          for (const place of [{ label: "CHILE", lat: -35.7, lng: -72.1 }, { label: "ARGENTINA", lat: -33.5, lng: -65.8 }]) {
            const element = document.createElement("span");
            element.className = styles.countryLabel;
            element.textContent = place.label;
            element.setAttribute("aria-hidden", "true");
            markersRef.current.push(new maplibre.Marker({ element }).setLngLat([place.lng, place.lat]).addTo(map));
          }
        }

        map.on("sourcedata", (event) => {
          if (event.sourceId === "configured-basemap" && event.tile?.state === "loaded") rasterTileLoaded = true;
          if (cartography === "reference" && event.sourceId === "geography" && event.isSourceLoaded) rasterTileLoaded = true;
        });
        let tileErrorCount = 0;
        map.on("error", (event) => {
          const sourceId = String((event as { sourceId?: string }).sourceId || "");
          const message = String(event.error?.message || "");
          const isBaseMapFailure = Boolean(sourceId) || /tile|source|fetch|network|cors|style|sprite|glyph/i.test(message);
          if (!isBaseMapFailure) return;
          tileErrorCount += 1;
          // A raster source may report transient tile failures while other
          // tiles and the evidence markers remain useful. Keep the rendered
          // map available, but disclose repeated failures as a partial state.
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

          if (showDemoConnection && origin && tap && !map.getSource("sun-demo-connection")) {
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
        });
        map.on("render", () => {
          if (!disposed && map.loaded() && map.areTilesLoaded()) markReady();
        });
        map.on("webglcontextlost", () => {
          if (disposed) return;
          fullyReady = false;
          clearLoadTimers();
          setLoadState("error");
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
          fullyReady = false;
          // Theme paint changes reuse the same raster source and already decoded tiles.
          clearLoadTimers();
          setIsDegraded(false);
          setLoadState("loading");
          loadTimeoutId = window.setTimeout(() => {
            if (!disposed && !fullyReady) setLoadState("error");
          }, 8_000);
          map.setStyle(cartography === "reference" ? sunReferenceMapStyle(nextLightTheme) : mapStyleForTheme(nextLightTheme));
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
      closePopup();
      closePopupRef.current = () => false;
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
  }, [pointKey, retryNonce, showDemoConnection, cartography]);

  useEffect(() => {
    if (!mapRef.current) return;
    const frame = requestAnimationFrame(() => {
      mapRef.current?.resize();
      fitAllRef.current();
    });
    return () => cancelAnimationFrame(frame);
  }, [expanded]);
  const comparisonHref = googleComparisonLink(origin, tap);
  const originHref = googlePointLink(origin, "origin");
  const tapHref = googlePointLink(tap, "tap");
  function centerPoints() {
    fitAllRef.current();
    setControlNotice("Origen y zona centrados en este mapa.");
  }
  function toggleExpanded() {
    setExpanded(value => !value);
    setControlNotice(expanded ? "Mapa reducido dentro del pasaporte." : "Mapa ampliado dentro de NexID. Los puntos conservan su ubicación.");
  }

  const renderLocation = (kind: "origin" | "tap", point: SunPassportMapLocation | null) => {
    const tapPresentation = tapSourcePresentation(point);
    const locationCode = kind === "origin" ? "O" : "T";
    if (!point) {
      return (
        <div className={styles.locationStatic}>
          <span className={`${styles.locationIndex} ${kind === "tap" ? styles.locationIndexTap : ""}`} aria-hidden="true">{locationCode}</span>
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
          disabled={loadState !== "ready"}
          onClick={event => focusRef.current(point, event.currentTarget, event.detail === 0)}
          aria-label={`Enfocar ${kind === "origin" ? "origen" : "tap"} en el mapa: ${point.label}`}
        >
          <span className={`${styles.locationIndex} ${kind === "tap" ? styles.locationIndexTap : ""}`} aria-hidden="true">{locationCode}</span>
          <span className={styles.locationCopy}>
            <span className={styles.locationEyebrow}>{kind === "origin" ? originPresentation(point).eyebrow : tapPresentation.eyebrow}</span>
            <span className={styles.locationTitle}>{point.label}</span>
            <span className={styles.locationMeta}>{kind === "origin" ? originPresentation(point).meta : tapPresentation.badge}</span>
          </span>
        </button>
        {point.mapHref ? <a className={styles.externalLink} href={point.mapHref} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Abrir ${kind === "origin" ? "origen" : "tap"} en OpenStreetMap`}>OpenStreetMap ↗</a> : <span />}
      </div>
    );
  };

  const tapPresentation = tapSourcePresentation(tap);
  const isNetworkEstimate = tap?.source === "edge_ip_approx" || tap?.source === "ip_geo";
  const mapAriaLabel = cartography === "reference"
    ? locale === "en" ? "Interactive map of the public vineyard point and the demo area" : locale === "pt-BR" ? "Mapa interativo do ponto público da vinícola e da área de exemplo" : "Mapa interactivo del punto público de la viña y la zona de la demo"
    : origin && tap
    ? "Mapa interactivo del origen declarado y la zona informada para esta lectura"
    : origin
      ? "Mapa interactivo del origen declarado; esta lectura no informó coordenadas"
      : tap
        ? "Mapa interactivo de la zona informada para esta lectura; no hay origen geolocalizado"
        : "Mapa interactivo sin ubicaciones informadas";

  return (
    <div
      className={`${styles.shell} ${expanded ? styles.expanded : ""}`}
      data-map-expanded={expanded}
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        if (event.target instanceof Element) {
          const menu = event.target.closest("details");
          if (menu?.open) {
            event.preventDefault();
            event.stopPropagation();
            menu.open = false;
            menu.querySelector("summary")?.focus();
            return;
          }
        }
        if (closePopupRef.current()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (expanded) {
          event.preventDefault();
          setExpanded(false);
          setControlNotice("Mapa reducido dentro del pasaporte.");
          expandButtonRef.current?.focus();
        }
      }}
      data-sun-passport-map="maplibre"
      data-route-mode={showDemoConnection ? "demo" : "no-route"}
      data-basemap={cartography === "reference" ? "local-reference" : "configured-raster"}
      data-basemap-state={isDegraded && loadState === "ready" ? "degraded" : loadState}
      data-location-source={tapPresentation.kind}
    >
      <div className={styles.mapToolbar}>
        <div className={styles.toolbarIntro}><span>{cartography === "reference" ? "VIÑA Y EXPERIENCIA DE MUESTRA" : "UBICACIONES DE ESTA LECTURA"}</span><p>{cartography === "reference" ? "Mapa general, sin calles. Explorá ambos puntos." : "Explorá el mapa sin salir del pasaporte."}</p></div>
        <div className={styles.toolbarActions}>
          <button ref={expandButtonRef} type="button" className={styles.expandButton} aria-expanded={expanded} aria-controls={mapId} disabled={!points.length} onClick={toggleExpanded}>{expanded ? "Reducir mapa" : "Ampliar mapa"}</button>
          {(originHref || tapHref) ? <details className={styles.externalMenu}>
            <summary><span>Abrir en Google Maps</span><span aria-hidden="true">↗</span></summary>
            <div className={styles.externalChoices}>
              <p>Se abrirá una aplicación externa con las coordenadas públicas elegidas. No se envían el identificador ni el enlace de esta lectura.</p>
              {comparisonHref ? <>
                <a href={comparisonHref} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Ver ambos en Google Maps ↗</a>
                <small>Google puede calcular una ruta sugerida entre el origen declarado y la zona aproximada compartida. No representa el recorrido del producto.</small>
              </> : null}
              {originHref ? <a href={originHref} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir origen declarado ↗</a> : null}
              {tapHref ? <a href={tapHref} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{tap?.source === "ip_geo" || tap?.source === "edge_ip_approx" ? "Ver zona estimada de red ↗" : "Abrir zona compartida ↗"}</a> : null}
              {!comparisonHref && (tap?.source === "ip_geo" || tap?.source === "edge_ip_approx") ? <small>La zona estimada por la red no se usa como destino preciso ni para calcular una ruta.</small> : null}
            </div>
          </details> : null}
        </div>
        <span className={styles.controlNotice} role="status" aria-live="polite">{controlNotice}</span>
      </div>

      <div ref={mapFrameRef} id={mapId} className={styles.mapFrame} role="region" aria-label={mapAriaLabel} aria-busy={loadState === "loading"}>
        <div ref={mapContainerRef} className={styles.map} />
        {loadState === "waiting" || loadState === "loading" ? (
          <div className={styles.loading} aria-live="polite">
            <div>
              <span className={styles.loadingDot} data-waiting={loadState === "waiting"} aria-hidden="true"/>
              <strong>{loadState === "waiting" ? "Mapa disponible al llegar a esta sección" : "Cargando cartografía"}</strong>
              <p className="mt-1 text-xs">{loadState === "waiting" ? "Se carga al acercarte para priorizar el pasaporte." : "Las ubicaciones informadas siguen disponibles en la lista."}</p>
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
              {origin ? <span className={styles.legendItem}><i className={styles.legendDot} />{cartography === "reference" ? (locale === "en" ? "Vineyard" : locale === "pt-BR" ? "Vinícola" : "Viña") : "Origen"}</span> : null}
              {tap ? <span className={styles.legendItem}><i className={`${styles.legendDot} ${styles.legendDotTap}`} />{cartography === "reference" ? (tap.source === "demo" ? "Mendoza" : locale === "en" ? "Your area" : locale === "pt-BR" ? "Sua área" : "Tu zona") : tapPresentation.legend}</span> : null}
              {origin && !tap ? <span className={styles.missingTapBadge}>Solo origen · lectura sin coordenadas</span> : null}
              {showDemoConnection && cartography !== "reference" ? <span className={styles.demoBadge}>Demo · conexión ilustrativa</span> : null}
              {isDegraded ? <span className={styles.degradedBadge}>Cartografía parcial</span> : null}
            </div>
            {points.length > 1 && cartography !== "reference" ? <button type="button" className={styles.fitButton} title="Reencuadrar origen y zona dentro de este mapa" onClick={centerPoints}>Centrar puntos</button> : null}
          </>
        ) : null}
      </div>
      {loadState === "ready" && points.length > 1 && cartography === "reference" ? <button type="button" className={`${styles.fitButton} ${styles.referenceFitButton}`} data-sun-dock-avoid title="Reencuadrar viña y zona de la demo" onClick={centerPoints}>Centrar puntos</button> : null}
      <div className={styles.details} data-sun-dock-avoid>
        {renderLocation("origin", origin)}
        {renderLocation("tap", tap)}
      </div>
      <div className={styles.locationSourceSummary} data-sun-dock-avoid>
        <span className={styles.sourceBadge}>{tapPresentation.badge}</span>
        <p>{tapPresentation.explanation}</p>
      </div>
      <details className={styles.technicalDetails}>
        <summary>Cómo se obtuvo esta ubicación</summary>
        <div className={styles.technicalBody}>
          {tap ? <p><strong>Fuente de esta lectura:</strong> {tap.evidence}</p> : null}
          {origin ? <p><strong>Origen:</strong> {origin.evidence}</p> : null}
          <p>
            {showDemoConnection && origin && tap
              ? cartography === "reference"
                ? locale === "en" ? `Demo: the line links the public vineyard point and the Mendoza example (${distanceLabel}); it does not represent a physical journey.` : locale === "pt-BR" ? `Demo: a linha conecta o ponto público da vinícola e o exemplo de Mendoza (${distanceLabel}); não representa um percurso físico.` : `Demo: la línea une el punto público de la viña y el ejemplo de Mendoza (${distanceLabel}); no representa un recorrido físico.`
                : `Demo: la línea punteada conecta dos puntos simulados (${distanceLabel}); no representa un recorrido físico.`
              : origin && tap && tapPresentation.kind === "demo_browser"
                ? locale === "en" ? `Approximate straight-line separation: ${distanceLabel}. For this demo only; not the journey of a bottle.` : locale === "pt-BR" ? `Separação aproximada em linha reta: ${distanceLabel}. Apenas para esta demo; não representa o percurso de uma garrafa.` : `Separación aproximada en línea recta: ${distanceLabel}. Sólo para esta demo; no representa el recorrido de una botella.`
              : origin && tap && tapPresentation.kind === "consented_browser"
                ? `La separación en línea recta es ${distanceLabel}. No demuestra recorrido, custodia ni presencia física del producto.`
                : origin && tap && isNetworkEstimate
                  ? "No calculamos una distancia para el usuario porque la ubicación de red es demasiado amplia para presentarla como una medición precisa."
                  : origin && tap
                    ? "No calculamos una distancia porque la fuente de esta ubicación no acredita una medición consentida y comparable."
                  : "Se muestra únicamente la ubicación disponible. No se inventa una posición ni una ruta para el punto faltante."}
          </p>
          {tapTimeLabel ? <p><strong>Lectura informada:</strong> {tapTimeLabel}.</p> : null}
          {tapPresentation.kind === "demo_browser" ? <p>{locale === "en" ? "The shaded area includes rounding of the area shown in this demo and the browser's reported uncertainty." : locale === "pt-BR" ? "A área sombreada inclui o arredondamento da área mostrada nesta demo e a incerteza informada pelo navegador." : "El área sombreada incluye el redondeo de la zona mostrada en esta demo y la incertidumbre informada por el navegador."}</p> : tapPresentation.kind === "consented_browser" ? <p>El área alrededor del tap incluye como mínimo el redondeo de la coordenada pública; la fuente puede ser menos precisa.</p> : null}
          <p className={styles.attribution}>
            <span>Cartografía:</span> {cartography === "reference" ? <><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Natural Earth</a>. Mapa general servido desde NexID; sin consultas cartográficas externas.</> : <>{USE_CONFIGURED_RASTER ? TRUST_MAP_SOURCE.attribution : FALLBACK_WORLD_STREET_MAP_ATTRIBUTION}. <span>El proveedor cartográfico recibe la IP de red y el área de las teselas solicitadas. La URL y el identificador del pasaporte no se envían mediante la política no-referrer.</span></>}
          </p>
        </div>
      </details>
    </div>
  );
}
