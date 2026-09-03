"use client";

import { RealGeographicMap } from "./real-geographic-map";
import type { TrustMapSourceOverrides } from "./trust-map-source";

export type VectorMapTone = "origin" | "tap" | "hub" | "risk" | "token";
export type VectorMapEvidenceTone = "origin" | "tap" | "token" | "risk" | "loyalty" | "marketplace";

export type VectorMapPoint = {
  id: string;
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
  scans?: number;
  risk?: number;
  tone?: VectorMapTone;
  stageLabel?: string;
  evidence?: string;
  lastSeen?: string;
  /** Explicit provenance for a reported point. Consumer maps only accept consented browser geolocation. */
  locationSource?: string;
  /** Approximate horizontal uncertainty in metres. Never interpreted as exact device coordinates. */
  locationAccuracyM?: number;
};

export type VectorMapRoute = {
  id: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  label?: string;
  tone?: "info" | "warn" | "success";
  distanceLabel?: string;
  evidence?: string;
};

export type VectorMapEvidenceStep = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: VectorMapEvidenceTone;
};

export type VectorMapLedgerItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: VectorMapEvidenceTone;
};

export type MapDensity = "balanced" | "heat" | "route";
export type MapChrome = "full" | "compact" | "minimal" | "enterprise-atlas" | "consumer";

/**
 * Serializable UI copy for the shared geographic map.
 *
 * Dynamic values use named placeholders so localized labels can cross the
 * server/client boundary without passing formatter functions. Supported
 * placeholders are documented by the defaults in RealGeographicMap.
 */
export type PremiumVectorMapLabels = {
  defaultTitle: string;
  defaultSubtitle: string;
  routeFallbackLabel: string;
  consumerAccuracyUnknown: string;
  consumerAccuracyKnown: string;
  tileLoadError: string;
  tileLoadWarning: string;
  mapInitError: string;
  localGridSource: string;
  legendAriaLabel: string;
  legendEvent: string;
  legendDeclaredOrigin: string;
  legendSeparateRisk: string;
  heatLegend: string;
  loadingLocalGrid: string;
  loadingApproximateLocation: string;
  loadingGeographicMap: string;
  mapUnavailableTitle: string;
  mapUnavailableSummary: string;
  emptyConsumerTitle: string;
  emptyConsumerBody: string;
  emptyMapTitle: string;
  emptyMapBody: string;
  consumerPointSummary: string;
  consumerEmptySummary: string;
  mapSummary: string;
  detailsSummary: string;
  popupObservedEvents: string;
  popupReportedPoint: string;
  detailsEventCount: string;
  attributionToggle: string;
  navigationZoomIn: string;
  navigationZoomOut: string;
  popupClose: string;
  cooperativeWindows: string;
  cooperativeMac: string;
  cooperativeMobile: string;
};

export type PremiumVectorMapProps = {
  points: VectorMapPoint[];
  routes?: VectorMapRoute[];
  selectedPointId?: string;
  onPointSelect?: (point: VectorMapPoint) => void;
  title?: string;
  subtitle?: string;
  caption?: string;
  className?: string;
  heightClassName?: string;
  density?: MapDensity;
  chrome?: MapChrome;
  maxPoints?: number;
  maxRoutes?: number;
  evidenceSteps?: VectorMapEvidenceStep[];
  ledgerItems?: VectorMapLedgerItem[];
  mapSource?: TrustMapSourceOverrides;
  ariaLabel?: string;
  /** Optional localized UI copy. Omitted keys retain the current Spanish defaults. */
  labels?: Partial<PremiumVectorMapLabels>;
  /** Disable all third-party basemap/style requests while keeping a local coordinate surface. */
  externalTiles?: boolean;
};

/** Stable public entry point for the shared MapLibre geographic renderer. */
export function PremiumVectorMap(props: PremiumVectorMapProps) {
  return <RealGeographicMap {...props} />;
}
