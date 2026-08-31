"use client";

import { useCallback, useState } from "react";
import { SunPassportMap, type SunPassportMapLocation } from "./sun-passport-map";
import {
  TapPrecisionTelemetry,
  type LocationReceipt,
  type TapPrecisionTelemetryProps,
} from "./tap-precision-telemetry";

type SunLocationExperienceProps = {
  origin: SunPassportMapLocation | null;
  tap: SunPassportMapLocation | null;
  showRoute: boolean;
  distanceLabel: string;
  tapTimeLabel?: string | null;
  telemetry: Omit<TapPrecisionTelemetryProps, "onLocationConfirmed">;
};

function openStreetMapHref(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=11/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`;
}

function distanceKm(origin: SunPassportMapLocation, tap: SunPassportMapLocation) {
  const earthRadiusKm = 6_371;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(tap.lat - origin.lat);
  const deltaLng = radians(tap.lng - origin.lng);
  const originLat = radians(origin.lat);
  const tapLat = radians(tap.lat);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(originLat) * Math.cos(tapLat) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function distanceLabelFor(kilometers: number) {
  if (!Number.isFinite(kilometers)) return "N/D";
  if (kilometers < 1) return `${Math.max(1, Math.round(kilometers * 1_000))} m`;
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: kilometers < 10 ? 1 : 0 }).format(kilometers)} km`;
}

export function SunLocationExperience({
  origin,
  tap,
  showRoute,
  distanceLabel,
  tapTimeLabel,
  telemetry,
}: SunLocationExperienceProps) {
  const [confirmedTap, setConfirmedTap] = useState<SunPassportMapLocation | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const onLocationConfirmed = useCallback((receipt: LocationReceipt) => {
    const lat = Number(receipt.lat);
    const lng = Number(receipt.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const label = [receipt.city, receipt.countryCode].filter(Boolean).join(", ") || "Zona aproximada confirmada";
    const accuracy = typeof receipt.accuracyM === "number" && Number.isFinite(receipt.accuracyM)
      ? ` · precisión reportada ±${Math.round(receipt.accuracyM)} m o más`
      : "";

    setConfirmedTap({
      id: `confirmed-${telemetry.eventId || telemetry.uid || telemetry.bid}`,
      lat,
      lng,
      label,
      evidence: `GPS del navegador con permiso, medido después del tap${accuracy}. Zona pública redondeada.`,
      accuracyM: typeof receipt.accuracyM === "number" ? receipt.accuracyM : null,
      source: "browser_gps_approximate_consent",
      mapHref: openStreetMapHref(lat, lng),
    });
    setConfirmedAt(receipt.measuredAt || receipt.receivedAt || null);
  }, [telemetry.bid, telemetry.eventId, telemetry.uid]);

  const effectiveTap = confirmedTap || tap;
  const effectiveDistanceLabel = confirmedTap && origin
    ? distanceLabelFor(distanceKm(origin, confirmedTap))
    : distanceLabel;
  const confirmedDate = confirmedAt ? new Date(confirmedAt) : null;
  const effectiveTapTime = confirmedDate && Number.isFinite(confirmedDate.getTime())
    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(confirmedDate)
    : tapTimeLabel;

  return (
    <>
      {telemetry.enabled ? (
        <div id="tap-location-consent" className="scroll-mt-24">
          <TapPrecisionTelemetry {...telemetry} onLocationConfirmed={onLocationConfirmed} />
        </div>
      ) : null}
      <div id="geo-trace">
        <SunPassportMap
          origin={origin}
          tap={effectiveTap}
          showRoute={showRoute}
          distanceLabel={effectiveDistanceLabel}
          tapTimeLabel={effectiveTapTime}
        />
      </div>
    </>
  );
}
