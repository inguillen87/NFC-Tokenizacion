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
type MapChrome = "full" | "compact" | "minimal" | "enterprise-atlas";

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
};

/**
 * Stable public entry point for the shared MapLibre geographic renderer.
 */
export function PremiumVectorMap(props: PremiumVectorMapProps) {
  return <RealGeographicMap {...props} />;
}
