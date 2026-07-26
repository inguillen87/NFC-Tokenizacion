export type TraceabilityMapTruthState =
  | "fixture"
  | "unavailable"
  | "recorded_events"
  | "public_evidence";

export type TraceabilitySummaryInput = {
  degraded?: boolean | null;
  source?: string | null;
  events?: readonly unknown[] | null;
  evidenceVerified?: boolean | null;
  evidenceUrl?: string | null;
} | null;

export function resolveTraceabilityMapTruth(summary?: TraceabilitySummaryInput): TraceabilityMapTruthState {
  if (!summary) return "unavailable";
  const source = String(summary.source || "").trim().toLowerCase();
  if (summary.degraded === true || source.includes("synthetic") || source.includes("visual-demo")) return "fixture";

  const eventCount = Array.isArray(summary.events) ? summary.events.length : 0;
  if (eventCount === 0) return "unavailable";

  const hasPublicEvidence = source === "public-proof"
    && summary.evidenceVerified === true
    && /^https:\/\//i.test(String(summary.evidenceUrl || ""));
  return hasPublicEvidence ? "public_evidence" : "recorded_events";
}

export function describeTraceabilityMapTruth(state: TraceabilityMapTruthState) {
  if (state === "public_evidence") {
    return {
      badge: "EVIDENCIA PÚBLICA",
      sourceLabel: "Fuente pública verificada",
      routeLabel: "Conexión respaldada por evidencia pública",
      pointLabel: "Evento con evidencia",
      metricLabel: "eventos verificados",
    } as const;
  }
  if (state === "recorded_events") {
    return {
      badge: "EVENTOS REGISTRADOS",
      sourceLabel: "Fuente registrada · sin prueba pública",
      routeLabel: "Conexión visual derivada de eventos registrados",
      pointLabel: "Evento registrado",
      metricLabel: "eventos registrados",
    } as const;
  }
  if (state === "unavailable") {
    return {
      badge: "SIN FUENTE",
      sourceLabel: "Fuente operativa no disponible",
      routeLabel: "Sin ruta confirmada",
      pointLabel: "Punto sin confirmar",
      metricLabel: "sin datos",
    } as const;
  }
  return {
    badge: "DEMO / FIXTURE",
    sourceLabel: "Datos simulados · no auditados",
    routeLabel: "Ruta ilustrativa · no representa custodia real",
    pointLabel: "Punto simulado",
    metricLabel: "eventos demo",
  } as const;
}
