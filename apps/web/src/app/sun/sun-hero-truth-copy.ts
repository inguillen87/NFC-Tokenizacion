type SunHeroTraceState = "idle" | "opened" | "blocked";

export type SunHeroTraceCopy = {
  originSublabel: string;
  originStageLabel: string;
  originEvidence: string;
  originPinLabel: string;
  tapSublabel: string;
  tapStageLabel: string;
  tapEvidence: string;
  tapPinLabel: string;
  routeLabel: string;
  routeEvidence: string;
};

function getSunHeroTraceCopyEs(isDemoPreview: boolean, state: SunHeroTraceState): SunHeroTraceCopy {
  if (isDemoPreview) {
    return {
      originSublabel: "Origen de muestra",
      originStageLabel: "Origen simulado",
      originEvidence: "Lote, productor y pasaporte de muestra",
      originPinLabel: "Origen demo",
      tapSublabel: "Evento simulado · sin tap físico",
      tapStageLabel: "Tap simulado",
      tapEvidence: state === "opened"
        ? "Apertura de sello simulada en la muestra"
        : "Lectura simulada · sin tap físico",
      tapPinLabel: "Evento demo",
      routeLabel: "Origen -> evento simulado",
      routeEvidence: "Recorrido de muestra · no representa una ruta física verificada",
    };
  }

  return {
    originSublabel: "Origen declarado",
    originStageLabel: "Origen declarado",
    originEvidence: "Lote, productor y pasaporte registrados por el tenant",
    originPinLabel: "Origen declarado",
    tapSublabel: "Lectura NFC registrada",
    tapStageLabel: "Lectura NFC",
    tapEvidence: state === "opened" ? "Mensaje SUN válido y TT abierto reportado" : "Mensaje NFC del chip validado",
    tapPinLabel: "Lectura",
    routeLabel: "Origen declarado -> lectura",
    routeEvidence: "Segmento calculado entre registros; no prueba el recorrido físico",
  };
}

export function getSunHeroTraceCopy(
  isDemoPreview: boolean,
  state: SunHeroTraceState,
  translate: (value: string) => string = (value) => value,
): SunHeroTraceCopy {
  const copy = getSunHeroTraceCopyEs(isDemoPreview, state);
  return Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [key, translate(value)]),
  ) as SunHeroTraceCopy;
}
