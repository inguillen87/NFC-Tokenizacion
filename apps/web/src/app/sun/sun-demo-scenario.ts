/** Sample scenarios carry no NFC identity, permission or evidence. */
export type SunDemoScenario = "closed" | "opened" | "invalid";

function isScenario(value: unknown): value is SunDemoScenario {
  return value === "closed" || value === "opened" || value === "invalid";
}

/** Explicit sample choices only; legacy handoffs retain their caller's default. */
export function resolveSunDemoScenario(value: unknown, fallback: SunDemoScenario = "opened"): SunDemoScenario {
  return isScenario(value) ? value : isScenario(fallback) ? fallback : "opened";
}

export function sunDemoScenarioSignals(scenario: SunDemoScenario) {
  const safe = isScenario(scenario) ? scenario : "invalid";
  if (safe === "invalid") {
    return Object.freeze({
      ok: false,
      code: "DEMO_READ_INVALID",
      label: "Lectura no válida · demo",
      tone: "risk" as const,
      summary: "Ejemplo de lectura rechazada: la ficha sigue disponible y las acciones protegidas se bloquean. No corresponde a una etiqueta evaluada.",
      productState: "INVALID",
      tamperStatus: "UNKNOWN",
      tagStatus: "unknown",
      tagAvailable: false,
    });
  }
  const closed = safe === "closed";
  return Object.freeze({
    ok: true,
    code: "AUTH_OK",
    label: closed ? "Sello cerrado · demo" : "Sello abierto · demo",
    tone: closed ? "good" as const : "warn" as const,
    summary: closed
      ? "Escenario ilustrativo de sello cerrado. No corresponde a una lectura NFC ni valida el contenido físico."
      : "Escenario ilustrativo de sello abierto. Una apertura no demuestra falsificación; no corresponde a una etiqueta evaluada.",
    productState: closed ? "VALID_CLOSED" : "VALID_OPENED",
    tamperStatus: closed ? "CLOSED" : "OPENED",
    tagStatus: closed ? "closed" : "opened",
    tagAvailable: true,
  });
}
