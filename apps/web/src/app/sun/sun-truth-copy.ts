export const SUN_DEMO_BADGE = "MUESTRA DEMO · SIN TAP FÍSICO";

export const SUN_DEMO_COPY = {
  decision: "Resultado de muestra: la fixture ilustra un mensaje SUN válido y un estado TT abierto reportado por el tag. No se realizó un tap físico ni existe persistencia o evidencia pública en esta vista.",
  trust: "Preview guiado: la identidad digital, el estado TT reportado, la ruta y las acciones son datos simulados. No verifican el sello físico, el contenido ni la custodia.",
  productStatusTitle: "Producto físico de muestra",
  productStatusBody: "Esta fixture permite recorrer la ficha y la trazabilidad simulada. Un resultado real requiere leer la etiqueta física y validar la evidencia del evento.",
  productBadge: "Producto físico · muestra",
  stageTitle: "Producto físico de muestra · TT abierto reportado en la simulación",
  stageBody: "El estado TT reportado y el resultado SUN forman parte del preview. No se realizó ningún tap físico ni se inspeccionó el sello.",
  journeyLabel: "Producto físico de muestra",
  journeyDetail: "Preview simulado",
  passportEventLabel: "Se simuló",
  passportEventTitle: "Producto físico de muestra",
  passportEventBody: "La fixture ilustra cómo se presentarían el chip y la política del tenant después de una lectura real.",
  passportNowTitle: "Explorar preview",
  passportNowBody: "Podés recorrer la ficha de muestra. Garantía, beneficios y certificado requieren un tap físico y evidencia real.",
  claimIntro: "Esta muestra explica cómo un tap físico y una validación separada del comprador protegerían garantía, beneficios o propiedad.",
  claimTapLabel: "Tap físico",
  claimTapState: "No realizado · muestra",
  gatedActions: "El estado TT reportado y las acciones son simulados. No certifican el sello físico; la garantía, procedencia y tokenización reales requieren un tap físico y la política de la marca.",
  tokenModal: "La muestra ilustra una solicitud de token asociada al lifecycle; no confirma el estado físico del sello, la propiedad ni evidencia on-chain real.",
} as const;

export function qualifySunStatusForPreview(isDemoPreview: boolean, status: string) {
  return isDemoPreview ? `SIMULACIÓN · ${status}` : status;
}

export function selectSunTruthCopy(isDemoPreview: boolean, demoCopy: string, realCopy: string) {
  return isDemoPreview ? demoCopy : realCopy;
}
