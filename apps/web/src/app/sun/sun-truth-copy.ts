export const SUN_DEMO_BADGE = "MUESTRA DEMO · SIN TAP FÍSICO";

export const SUN_DEMO_COPY = {
  decision: "Resultado de muestra: la etiqueta digital informa una apertura en este ejemplo. No se realizó un tap físico ni existe evidencia real en esta vista.",
  trust: "Vista guiada: el producto, el estado del sello, la ruta y las acciones son datos simulados. No describen un envase real ni su contenido.",
  productStatusTitle: "Producto físico de muestra",
  productStatusBody: "Esta fixture permite recorrer la ficha y la trazabilidad simulada. Un resultado real requiere leer la etiqueta física y validar la evidencia del evento.",
  productBadge: "Producto físico · muestra",
  stageTitle: "Sello abierto en esta simulación",
  stageBody: "La etiqueta digital de muestra informa una apertura. No se realizó un toque NFC real ni se inspeccionó un envase físico.",
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
  gatedActions: "El estado del sello y las acciones son simulados. La garantía, la procedencia y la propiedad digital reales requieren un toque NFC y la política de la marca.",
  tokenModal: "La muestra ilustra una solicitud de token asociada al lifecycle; no confirma el estado físico del sello, la propiedad ni evidencia on-chain real.",
} as const;

export function qualifySunStatusForPreview(isDemoPreview: boolean, status: string) {
  return isDemoPreview ? `SIMULACIÓN · ${status}` : status;
}

export function selectSunTruthCopy(isDemoPreview: boolean, demoCopy: string, realCopy: string) {
  return isDemoPreview ? demoCopy : realCopy;
}
