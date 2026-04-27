"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { GlobalOpsPoint } from "@product/ui";

const GlobalOpsMap = dynamic(() => import("@product/ui").then((mod) => mod.GlobalOpsMap), { ssr: false });

type MapPoint = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  scans: number;
  risk: number;
  status?: string;
  source?: string;
  tenantSlug?: string;
  lastSeen?: string;
  uid?: string;
  device?: string;
};

export function RealOpsMap({
  points,
  scopeLabel,
}: {
  points: MapPoint[];
  scopeLabel: string;
}) {
  const normalizedPoints = useMemo<GlobalOpsPoint[]>(() => points.map((point, index) => ({
    id: `${point.tenantSlug || "tenant"}-${point.city}-${index}`,
    city: point.city,
    country: point.country,
    lat: point.lat,
    lng: point.lng,
    scans: point.scans,
    risk: point.risk,
    verdict: point.status || "VALID",
    tenantSlug: point.tenantSlug || scopeLabel,
    lastSeen: point.lastSeen || new Date().toISOString(),
    uid: point.uid,
    device: point.device,
  })), [points, scopeLabel]);

  const routes = useMemo(() => normalizedPoints.slice(1, 120).map((point, index) => ({
    id: `route-${index}-${point.id}`,
    fromLat: normalizedPoints[index]?.lat ?? point.lat,
    fromLng: normalizedPoints[index]?.lng ?? point.lng,
    toLat: point.lat,
    toLng: point.lng,
    uid: point.uid || point.id,
    risk: point.risk,
    taps: point.scans,
    firstSeenAt: normalizedPoints[index]?.lastSeen ?? point.lastSeen,
    lastSeenAt: point.lastSeen,
  })), [normalizedPoints]);

  return <GlobalOpsMap mode={scopeLabel.includes("multi") ? "global" : "tenant"} points={normalizedPoints} routes={routes} playbackEnabled />;
}
