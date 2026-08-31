export type SunSensorEvidenceKind = "reported" | "declared_static" | "simulated" | "none";

export type SunSensorTimelineEvent = {
  at?: string | null;
  stage?: string | null;
  sensorTempC?: number | null;
  sensorHumidity?: number | null;
  sensorLightExposure?: string | null;
  sensorTransitShock?: string | null;
  sensorMeasuredAt?: string | null;
  sensorDeviceId?: string | null;
  sensorSource?: string | null;
};

export type SunDeclaredStaticSensorInput = {
  observedAt: string | null;
  deviceId: string | null;
  temperatureC: number | null;
  humidityPct: number | null;
  lightExposure: string | null;
  transitShock: string | null;
  stage: string | null;
};

export type SunSensorHistoryItem = {
  at: string | null;
  stage: string;
  temperatureC: number | null;
  humidityPct: number | null;
  lightExposure: string | null;
  transitShock: string | null;
  barrelAgeMonths: number | null;
  alert: string | null;
  evidenceKind: Exclude<SunSensorEvidenceKind, "none">;
  source: "event_measurement" | "manifest" | "simulation" | string;
  deviceId: string | null;
};

type BuildSunSensorEvidenceInput = {
  timeline: SunSensorTimelineEvent[];
  declaredStatic?: SunDeclaredStaticSensorInput | null;
  fallbackStorage?: string | null;
  barrelMonths?: number | null;
  simulatedTempC?: number | string | null;
  simulatedHumidityPct?: number | string | null;
  simulatedLight?: string | null;
  simulatedShock?: string | null;
  allowSimulation: boolean;
  now?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textOrNull(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = textOrNull(value);
    if (text) return text;
  }
  return null;
}

function finiteNumber(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = typeof value === "number" ? value : Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function observationTime(value: string | null) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/**
 * Reads the allow-listed sensor projection stored with an imported unit
 * manifest. It intentionally does not return the raw JSON object: arbitrary
 * manifest keys are not part of the public passport contract.
 */
export function declaredStaticSensorFromLocaleData(localeData: unknown): SunDeclaredStaticSensorInput | null {
  const data = asRecord(localeData);
  const manifest = asRecord(data.manifest);
  const iot = { ...asRecord(manifest.iot), ...asRecord(data.iot) };
  if (!Object.keys(iot).length) return null;

  const declared: SunDeclaredStaticSensorInput = {
    observedAt: firstText(iot.measuredAt, iot.measured_at, iot.capturedAt, iot.sensor_at),
    deviceId: firstText(iot.deviceId, iot.device_id, iot.sensor_id, iot.logger_id),
    temperatureC: finiteNumber(iot.temperatureC ?? iot.temperature_c ?? iot.cellarTemperatureC ?? iot.storageTemperatureC),
    humidityPct: finiteNumber(iot.humidityPct ?? iot.humidity_pct ?? iot.humidity ?? iot.relativeHumidityPct),
    lightExposure: firstText(iot.lightExposure, iot.light_exposure, iot.light, iot.lux),
    transitShock: firstText(iot.transitShock, iot.transit_shock, iot.shock, iot.impact_g),
    stage: firstText(iot.stage, iot.storageZone, iot.storage_zone),
  };
  return Object.values(declared).some((value) => value != null) ? declared : null;
}

function publicDeclaredStaticSensor(input: SunDeclaredStaticSensorInput | null | undefined) {
  if (!input) return null;
  return {
    evidenceKind: "declared_static" as const,
    source: "manifest" as const,
    observedAt: input.observedAt,
    deviceId: input.deviceId,
    temperatureC: finiteNumber(input.temperatureC),
    humidityPct: finiteNumber(input.humidityPct),
    lightExposure: textOrNull(input.lightExposure),
    transitShock: textOrNull(input.transitShock),
    stage: textOrNull(input.stage),
  };
}

/**
 * Builds the public sensor contract without turning product defaults into
 * telemetry. Reported readings win. Synthetic values are emitted only when
 * the caller explicitly allows a simulation, and remain labelled simulated.
 */
export function buildSunSensorEvidence(input: BuildSunSensorEvidenceInput) {
  const measured = input.timeline.filter((event) => (
    event.sensorTempC != null
    || event.sensorHumidity != null
    || textOrNull(event.sensorLightExposure) != null
    || textOrNull(event.sensorTransitShock) != null
  ));
  const declaredStatic = publicDeclaredStaticSensor(input.declaredStatic);

  if (measured.length) {
    const stages = ["cellar", "distribution", "retail", "consumer"];
    const history: SunSensorHistoryItem[] = measured.map((event, index) => {
      const temperatureC = finiteNumber(event.sensorTempC);
      const humidityPct = finiteNumber(event.sensorHumidity);
      return {
        at: event.sensorMeasuredAt || event.at || null,
        stage: event.stage || stages[Math.min(index, stages.length - 1)],
        temperatureC,
        humidityPct,
        lightExposure: textOrNull(event.sensorLightExposure),
        transitShock: textOrNull(event.sensorTransitShock),
        barrelAgeMonths: input.barrelMonths ?? null,
        // Wine, seed, pharma and chemicals cannot share an invented global
        // threshold. Alerts require an explicit, versioned tenant policy.
        alert: null,
        evidenceKind: "reported" as const,
        source: event.sensorSource?.trim() || "event_measurement",
        deviceId: event.sensorDeviceId?.trim() || null,
      };
    });
    const latestFirst = history
      .map((item, index) => ({ item, index }))
      .sort((left, right) => observationTime(right.item.at) - observationTime(left.item.at) || left.index - right.index)
      .map(({ item }) => item);
    const latestObservation = latestFirst[0] || null;
    return {
      kind: "reported" as const,
      history: latestFirst,
      snapshot: {
        // A snapshot is one observation, never a synthetic blend of the newest
        // value for each metric from different devices or timestamps.
        cellarTemperature: latestObservation?.temperatureC != null ? `${latestObservation.temperatureC.toFixed(1)}°C` : null,
        humidity: latestObservation?.humidityPct != null ? `${latestObservation.humidityPct.toFixed(0)}%` : null,
        lightExposure: latestObservation?.lightExposure ?? null,
        transitShock: latestObservation?.transitShock ?? null,
        ...(latestObservation?.at ? { observedAt: latestObservation.at } : {}),
        ...(latestObservation?.source ? { source: latestObservation.source } : {}),
        ...(latestObservation?.deviceId ? { deviceId: latestObservation.deviceId } : {}),
      },
      declaredStatic,
    };
  }

  if (declaredStatic) {
    const history: SunSensorHistoryItem[] = [{
      at: declaredStatic.observedAt,
      stage: declaredStatic.stage || "manifest_iot",
      temperatureC: declaredStatic.temperatureC,
      humidityPct: declaredStatic.humidityPct,
      lightExposure: declaredStatic.lightExposure,
      transitShock: declaredStatic.transitShock,
      barrelAgeMonths: input.barrelMonths ?? null,
      alert: null,
      evidenceKind: "declared_static",
      source: "manifest",
      deviceId: declaredStatic.deviceId,
    }];
    return {
      kind: "declared_static" as const,
      history,
      snapshot: {
        cellarTemperature: declaredStatic.temperatureC != null ? `${declaredStatic.temperatureC.toFixed(1)}°C` : null,
        humidity: declaredStatic.humidityPct != null ? `${declaredStatic.humidityPct.toFixed(0)}%` : null,
        lightExposure: declaredStatic.lightExposure,
        transitShock: declaredStatic.transitShock,
        ...(declaredStatic.observedAt ? { observedAt: declaredStatic.observedAt } : {}),
        source: "manifest" as const,
        ...(declaredStatic.deviceId ? { deviceId: declaredStatic.deviceId } : {}),
      },
      declaredStatic,
    };
  }

  if (!input.allowSimulation) {
    return {
      kind: "none" as const,
      history: [] as SunSensorHistoryItem[],
      snapshot: {
        cellarTemperature: null,
        humidity: null,
        lightExposure: null,
        transitShock: null,
      },
      declaredStatic: null,
    };
  }

  const storageTemp = finiteNumber(String(input.fallbackStorage || "").replace(/[^\d.-]/g, ""));
  const temperatureC = finiteNumber(input.simulatedTempC) ?? storageTemp ?? 16;
  const humidityPct = finiteNumber(input.simulatedHumidityPct) ?? 68;
  const history: SunSensorHistoryItem[] = [{
    at: input.now || new Date().toISOString(),
    stage: "simulation",
    temperatureC,
    humidityPct,
    lightExposure: input.simulatedLight || "Exposición baja simulada",
    transitShock: input.simulatedShock || "Sin golpes críticos en la simulación",
    barrelAgeMonths: input.barrelMonths ?? null,
    alert: null,
    evidenceKind: "simulated",
    source: "simulation",
    deviceId: null,
  }];

  return {
    kind: "simulated" as const,
    history,
    snapshot: {
      cellarTemperature: `${temperatureC.toFixed(1)}°C`,
      humidity: `${humidityPct.toFixed(0)}%`,
      lightExposure: history[0].lightExposure,
      transitShock: history[0].transitShock,
      observedAt: history[0].at,
      source: "simulation" as const,
    },
    declaredStatic: null,
  };
}
