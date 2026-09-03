"use client";

import { useCallback, useState } from "react";
import { SunPassportMap, type SunPassportMapLocation } from "./sun-passport-map";
import {
  TapPrecisionTelemetry,
  type LocationReceipt,
  type TapPrecisionTelemetryProps,
} from "./tap-precision-telemetry";
import { useSunLocale } from "./sun-locale-provider";
import { formatSunDateTime } from "./sun-locale";

type SunLocationExperienceProps = {
  origin: SunPassportMapLocation | null;
  tap: SunPassportMapLocation | null;
  showRoute: boolean;
  distanceLabel: string;
  tapTimeLabel?: string | null;
  tapTimeIso?: string | null;
  tapTimeZone?: string | null;
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

function distanceLabelFor(kilometers: number, locale: Intl.LocalesArgument) {
  if (!Number.isFinite(kilometers)) return "N/D";
  if (kilometers < 1) return `${Math.max(1, Math.round(kilometers * 1_000))} m`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: kilometers < 10 ? 1 : 0 }).format(kilometers)} km`;
}

export function SunLocationExperience({
  origin,
  tap,
  showRoute,
  distanceLabel,
  tapTimeLabel,
  tapTimeIso,
  tapTimeZone,
  telemetry,
}: SunLocationExperienceProps) {
  const { locale } = useSunLocale();
  const [confirmedTap, setConfirmedTap] = useState<SunPassportMapLocation | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const onLocationConfirmed = useCallback((receipt: LocationReceipt) => {
    const lat = Number(receipt.lat);
    const lng = Number(receipt.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const label = [receipt.city, receipt.countryCode].filter(Boolean).join(", ") || "Zona aproximada confirmada";
    const accuracy = typeof receipt.accuracyM === "number" && Number.isFinite(receipt.accuracyM)
      ? ` · precisión informada ±${Math.round(receipt.accuracyM)} m como mínimo`
      : "";
    const source = receipt.source === "browser_gps_approximate_consent"
      ? "browser_gps_approximate_consent"
      : "browser_geolocation_approximate_consent";

    setConfirmedTap({
      id: `confirmed-${telemetry.eventId || telemetry.uid || telemetry.bid}`,
      lat,
      lng,
      label,
      evidence: `Geolocalización aproximada del navegador con permiso, medida después del tap${accuracy}. Zona pública redondeada; valores reportados por el cliente.`,
      accuracyM: typeof receipt.accuracyM === "number" ? receipt.accuracyM : null,
      source,
      mapHref: openStreetMapHref(lat, lng),
    });
    setConfirmedAt(receipt.measuredAt || receipt.receivedAt || null);
  }, [telemetry.bid, telemetry.eventId, telemetry.uid]);

  const effectiveTap = confirmedTap || tap;
  const effectiveDistanceLabel = confirmedTap && origin
    ? distanceLabelFor(distanceKm(origin, confirmedTap), locale)
    : distanceLabel;
  const confirmedDate = confirmedAt ? new Date(confirmedAt) : null;
  const sourceTapDate = tapTimeIso ? new Date(tapTimeIso) : null;
  const effectiveTapTime = confirmedDate && Number.isFinite(confirmedDate.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(confirmedDate)
    : sourceTapDate && Number.isFinite(sourceTapDate.getTime())
      ? formatSunDateTime(sourceTapDate, locale, tapTimeZone)
    : tapTimeLabel;

  return (
    <>
      {telemetry.enabled ? (
        <div id="tap-location-consent" className="scroll-mt-24" data-sun-dock-avoid>
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
