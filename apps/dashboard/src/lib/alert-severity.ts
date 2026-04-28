export type AlertSeverityLevel = "none" | "medium" | "high" | "critical";

export function classifyEventAlertSeverity(result: string): AlertSeverityLevel {
  const normalized = String(result || "").toUpperCase();
  if (["REPLAY_SUSPECT", "DUPLICATE"].includes(normalized)) return "high";
  if (["TAMPER", "TAMPERED", "BROKEN", "REVOKED"].includes(normalized)) return "critical";
  if (["INVALID", "OPENED"].includes(normalized)) return "medium";
  return "none";
}

export function matchesSeverityFilter(level: AlertSeverityLevel, filter: string) {
  return filter === "all" ? true : level === filter;
}
