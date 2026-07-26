export type SunSensorEvidenceKind = "reported" | "simulated" | "none";

export type SunSensorTimelineEvent = {
  at?: string | null;
  stage?: string | null;
  sensorTempC?: number | null;
  sensorHumidity?: number | null;
};

export type SunSensorHistoryItem = {
  at: string | null;
  stage: string;
  temperatureC: number | null;
  humidityPct: number | null;
  barrelAgeMonths: number | null;
  alert: string | null;
};

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

/**
 * Builds the public sensor contract without turning product defaults into
 * telemetry. Reported readings win. Synthetic values are emitted only when
 * the caller explicitly allows a simulation, and remain labelled simulated.
 */
export function buildSunSensorEvidence(input: BuildSunSensorEvidenceInput) {
  const measured = input.timeline.filter((event) => event.sensorTempC != null || event.sensorHumidity != null);

  if (measured.length) {
    const stages = ["cellar", "distribution", "retail", "consumer"];
    const history: SunSensorHistoryItem[] = measured.map((event, index) => {
      const temperatureC = finiteNumber(event.sensorTempC);
      const humidityPct = finiteNumber(event.sensorHumidity);
      return {
        at: event.at || null,
        stage: event.stage || stages[Math.min(index, stages.length - 1)],
        temperatureC,
        humidityPct,
        barrelAgeMonths: input.barrelMonths ?? null,
        // Wine, seed, pharma and chemicals cannot share an invented global
        // threshold. Alerts require an explicit, versioned tenant policy.
        alert: null,
      };
    });
    const latestFirst = history
      .map((item, index) => ({ item, index }))
      .sort((left, right) => observationTime(right.item.at) - observationTime(left.item.at) || left.index - right.index)
      .map(({ item }) => item);
    const latestTemp = latestFirst.find((item) => item.temperatureC != null)?.temperatureC ?? null;
    const latestHumidity = latestFirst.find((item) => item.humidityPct != null)?.humidityPct ?? null;
    return {
      kind: "reported" as const,
      history,
      snapshot: {
        cellarTemperature: latestTemp != null ? `${latestTemp.toFixed(1)}°C` : null,
        humidity: latestHumidity != null ? `${latestHumidity.toFixed(0)}%` : null,
        lightExposure: null,
        transitShock: null,
      },
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
  }];

  return {
    kind: "simulated" as const,
    history,
    snapshot: {
      cellarTemperature: `${temperatureC.toFixed(1)}°C`,
      humidity: `${humidityPct.toFixed(0)}%`,
      lightExposure: input.simulatedLight || "Exposición baja simulada",
      transitShock: input.simulatedShock || "Sin golpes críticos en la simulación",
    },
  };
}
