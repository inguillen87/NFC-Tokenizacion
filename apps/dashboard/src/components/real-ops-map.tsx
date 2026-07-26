"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { GlobalOpsPoint } from "@product/ui/global-ops-map";

const GlobalOpsMap = dynamic(() => import("@product/ui/global-ops-map").then((mod) => mod.GlobalOpsMap), { ssr: false });

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
    lastSeen: point.lastSeen || "",
    uid: point.uid,
    device: point.device,
  })), [points, scopeLabel]);

  return (
    <GlobalOpsMap
      title={scopeLabel.includes("multi") ? "Actividad geográfica global" : "Actividad geográfica del tenant"}
      subtitle="Eventos reportados por ciudad o zona. Los puntos independientes no se convierten en una ruta y la ausencia de fecha no se presenta como actividad reciente."
      mode={scopeLabel.includes("multi") ? "global" : "tenant"}
      points={normalizedPoints}
      routes={[]}
      playbackEnabled={false}
    />
  );
}
