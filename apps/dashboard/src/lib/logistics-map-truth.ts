export type LogisticsStats = {
  total: number;
  in_transit: number;
  delivered: number;
  alerts: number;
};

export type LogisticsSourceState = "production" | "demo" | "unconfirmed" | "unavailable";

export type LogisticsStatsResult = {
  stats: LogisticsStats | null;
  source: LogisticsSourceState;
  availability: "confirmed" | "unavailable";
};

const STAT_KEYS = ["total", "in_transit", "delivered", "alerts"] as const;

export function resolveLogisticsStatsPayload(payload: unknown, responseOk: boolean): LogisticsStatsResult {
  if (!responseOk || !payload || typeof payload !== "object") {
    return { stats: null, source: "unavailable", availability: "unavailable" };
  }

  const record = payload as Record<string, unknown>;
  const rawStats = record.stats;
  if (!rawStats || typeof rawStats !== "object") {
    return { stats: null, source: "unavailable", availability: "unavailable" };
  }

  const statsRecord = rawStats as Record<string, unknown>;
  const values = STAT_KEYS.map((key) => Number(statsRecord[key]));
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return { stats: null, source: "unavailable", availability: "unavailable" };
  }

  const source = record.demoMode === true || record.dataSource === "demo"
    ? "demo"
    : record.dataSource === "production"
      ? "production"
      : "unconfirmed";

  return {
    stats: {
      total: values[0],
      in_transit: values[1],
      delivered: values[2],
      alerts: values[3],
    },
    source,
    availability: "confirmed",
  };
}

export function describeLogisticsSource(source: LogisticsSourceState) {
  if (source === "production") return { badge: "FUENTE OPERATIVA", detail: "Métricas confirmadas por la API del tenant." } as const;
  if (source === "demo") return { badge: "DATOS DEMO", detail: "Métricas del sandbox; no representan envíos reales." } as const;
  if (source === "unconfirmed") return { badge: "FUENTE SIN CONFIRMAR", detail: "La API respondió, pero no declaró la procedencia de las métricas." } as const;
  return { badge: "FUENTE NO DISPONIBLE", detail: "No se muestran ceros como si fueran inventario confirmado." } as const;
}
