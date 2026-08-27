export type SunSensorEvidenceKind = "reported" | "simulated" | "none";

export type SunSensorTimelineEvent = {
  at?: string | null;
  stage?: string | null;
  sensorTempC?: number | null;
  sensorHumidity?: number | null;
  sensorSource?: "tenant_manual" | "csv_import" | "json_import" | "live_sensor" | null;
  sensorPrivacyScope?: string | null;
  sensorResponsible?: string | null;
};

export type SunSensorHistoryItem = {
  at: string | null;
  stage: string;
  temperatureC: number | null;
  humidityPct: number | null;
  barrelAgeMonths: number | null;
  alert: string | null;
  source: SunSensorTimelineEvent["sensorSource"];
  privacyScope: string | null;
  responsible: string | null;
};

const SUPPORTED_SENSOR_ORIGINS = ["tenant_manual", "csv_import", "json_import", "live_sensor"] as const;
const SUPPORTED_SENSOR_PRIVACY_SCOPES = ["public", "tenant_only", "private", "internal"] as const;

type BuildSunSensorEvidenceInput = {
  timeline: SunSensorTimelineEvent[];
  fallbackStorage?: string | null;
  barrelMonths?: number | null;
  simulatedTempC?: number | string | null;
  simulatedHumidityPct?: number | string | null;
  simulatedLight?: string | null;
  simulatedShock?: string | null;
  allowSimulation: boolean;
  now?: string;
};

function finiteNumber(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function observationTime(value: string | null) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function normalizeSunSensorPrivacyScope(value: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return SUPPORTED_SENSOR_PRIVACY_SCOPES.includes(normalized as (typeof SUPPORTED_SENSOR_PRIVACY_SCOPES)[number])
    ? normalized
    : "not_reported";
}

export function publicSunSensorResponsible(value: unknown, privacyScope: string | null) {
  if (normalizeSunSensorPrivacyScope(privacyScope) !== "public") return null;
  const responsible = typeof value === "string" ? value.trim().slice(0, 120) : "";
  return responsible || null;
}

export function isPublicSunSensorObservation(privacyScope: string | null) {
  return normalizeSunSensorPrivacyScope(privacyScope) === "public";
}

/**
 * Builds the public sensor contract without turning product defaults into
 * telemetry. Reported readings win. Synthetic values are emitted only when
 * the caller explicitly allows a simulation, and remain labelled simulated.
 */
export function buildSunSensorEvidence(input: BuildSunSensorEvidenceInput) {
  const measured = input.timeline.filter((event) => (
    event.sensorTempC != null || event.sensorHumidity != null
  ) && isPublicSunSensorObservation(event.sensorPrivacyScope || null));

  if (measured.length) {
    const stages = ["cellar", "distribution", "retail", "consumer"];
    const history: SunSensorHistoryItem[] = measured.map((event, index) => {
      const temperatureC = finiteNumber(event.sensorTempC);
      const humidityPct = finiteNumber(event.sensorHumidity);
      const privacyScope = normalizeSunSensorPrivacyScope(event.sensorPrivacyScope || null);
      return {
        at: event.at || null,
        stage: event.stage || stages[Math.min(index, stages.length - 1)],
        temperatureC,
        humidityPct,
        barrelAgeMonths: input.barrelMonths ?? null,
        // Wine, seed, pharma and chemicals cannot share an invented global
        // threshold. Alerts require an explicit, versioned tenant policy.
        alert: null,
        source: event.sensorSource || null,
        privacyScope,
        // Responsibility belongs to the tenant/operator domain. It can only be
        // projected into the public SUN contract when this exact observation
        // explicitly opts into public visibility.
        responsible: publicSunSensorResponsible(event.sensorResponsible, privacyScope),
      };
    });
    const latestFirst = history
      .map((item, index) => ({ item, index }))
      .sort((left, right) => observationTime(right.item.at) - observationTime(left.item.at) || left.index - right.index)
      .map(({ item }) => item);
    const latestObservation = latestFirst[0] || null;
    const privacyScope = normalizeSunSensorPrivacyScope(latestObservation?.privacyScope || null);
    return {
      kind: "reported" as const,
      history,
      provenance: {
        origin: latestObservation?.source || "event_reported_unknown",
        capturedAt: latestObservation?.at || null,
        privacyScope,
        // A named person or operator is public only when that exact observation
        // explicitly opts into public visibility. Tenant/internal responsibility
        // stays private even though the aggregate reading may be published.
        responsible: privacyScope === "public" ? latestObservation?.responsible || null : null,
        supportedOrigins: SUPPORTED_SENSOR_ORIGINS,
      },
      snapshot: {
        // Snapshot and provenance are atomic: values never borrow a different
        // observation, timestamp, source or privacy decision.
        cellarTemperature: latestObservation?.temperatureC != null
          ? `${latestObservation.temperatureC.toFixed(1)}°C`
          : null,
        humidity: latestObservation?.humidityPct != null
          ? `${latestObservation.humidityPct.toFixed(0)}%`
          : null,
        lightExposure: null,
        transitShock: null,
      },
    };
  }

  if (!input.allowSimulation) {
    return {
      kind: "none" as const,
      history: [] as SunSensorHistoryItem[],
      provenance: {
        origin: "none" as const,
        capturedAt: null,
        privacyScope: "not_applicable",
        responsible: null,
        supportedOrigins: SUPPORTED_SENSOR_ORIGINS,
      },
      snapshot: {
        cellarTemperature: null,
        humidity: null,
        lightExposure: null,
        transitShock: null,
      },
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
    barrelAgeMonths: input.barrelMonths ?? null,
    alert: null,
    source: null,
    privacyScope: null,
    responsible: null,
  }];

  return {
    kind: "simulated" as const,
    history,
    provenance: {
      origin: "illustrative_scenario" as const,
      capturedAt: history[0]?.at || null,
      privacyScope: "not_applicable",
      responsible: null,
      supportedOrigins: SUPPORTED_SENSOR_ORIGINS,
    },
    snapshot: {
      cellarTemperature: `${temperatureC.toFixed(1)}°C`,
      humidity: `${humidityPct.toFixed(0)}%`,
      lightExposure: input.simulatedLight || "Exposición baja simulada",
      transitShock: input.simulatedShock || "Sin golpes críticos en la simulación",
    },
  };
}
