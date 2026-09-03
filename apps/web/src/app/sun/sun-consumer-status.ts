export type SunConsumerStatusTone = "closed" | "opened" | "verified" | "review" | "risk" | "info";

export type SunConsumerStatus = {
  tone: SunConsumerStatusTone;
  label: string;
  headline: string;
  copy: string;
  identityLabel: string;
  sealLabel: string;
};

type ResolveSunConsumerStatusInput = {
  isDemoPreview: boolean;
  isQrScan: boolean;
  isTechnicallyAuthentic: boolean;
  isVerifiedClosedState: boolean;
  isVerifiedOpenedState: boolean;
  isInvalidSealState: boolean;
  isTamperRisk: boolean;
  isReplay: boolean;
  isSunProfileMismatch: boolean;
  isSnapshotView: boolean;
};

function resolveSunConsumerStatusEs(input: ResolveSunConsumerStatusInput): SunConsumerStatus {
  if (input.isDemoPreview) {
    return {
      tone: "opened",
      label: "Ejemplo del Demo Lab",
      headline: "El tag de muestra informa: sello abierto",
      copy: "Simulación sin tap físico: muestra cómo se comunica una apertura sin crear evidencia real.",
      identityLabel: "Simulada",
      sealLabel: "Abierto (demo)",
    };
  }

  if (input.isQrScan) {
    return {
      tone: "info",
      label: "Ficha informativa",
      headline: "Información pública del producto",
      copy: "El QR abre la ficha del producto; las acciones protegidas requieren un tap NFC nuevo.",
      identityLabel: "Informativa",
      sealLabel: "No informado",
    };
  }

  if (input.isReplay) {
    return {
      tone: "risk",
      label: "Nuevo tap requerido",
      headline: "Este enlace ya fue utilizado",
      copy: "La URL ya se usó. Repetí el tap físico para obtener una lectura fresca antes de activar servicios.",
      identityLabel: "Por revisar",
      sealLabel: "No aplicable",
    };
  }

  if (input.isSunProfileMismatch) {
    return {
      tone: "risk",
      label: "Lectura por revisar",
      headline: "No pudimos validar esta lectura",
      copy: "El producto fue identificado, pero el perfil técnico del lote no coincide con esta lectura.",
      identityLabel: "No confirmada",
      sealLabel: "No confirmado",
    };
  }

  if (input.isInvalidSealState) {
    return {
      tone: "risk",
      label: "Estado del sello no válido",
      headline: "No pudimos validar el estado del sello",
      copy: "La lectura del estado TT es inválida. Repetí el tap y, si continúa, no uses el producto y avisá a la marca.",
      identityLabel: input.isTechnicallyAuthentic ? "Verificada" : "No confirmada",
      sealLabel: "No válido",
    };
  }

  if (input.isTamperRisk) {
    return {
      tone: "risk",
      label: "Señal de riesgo detectada",
      headline: "Revisá el producto antes de usarlo",
      copy: input.isTechnicallyAuthentic
        ? "La identidad digital pasó los controles, pero la lectura reportó una señal de riesgo. No uses el producto hasta revisarlo y avisá a la marca."
        : "La lectura reportó una señal de riesgo y no permitió confirmar la identidad digital. Repetí el tap y avisá a la marca.",
      identityLabel: input.isTechnicallyAuthentic ? "Verificada" : "No confirmada",
      sealLabel: "Por revisar",
    };
  }

  if (!input.isTechnicallyAuthentic) {
    return {
      tone: "risk",
      label: "Lectura por revisar",
      headline: "La lectura necesita revisión",
      copy: "No pudimos confirmar la identidad digital. Repetí el tap y, si continúa, avisá a la marca.",
      identityLabel: "No confirmada",
      sealLabel: "No confirmado",
    };
  }

  if (input.isVerifiedClosedState && input.isVerifiedOpenedState) {
    return {
      tone: "review",
      label: "Lectura NFC verificada",
      headline: "El estado del sello es inconsistente",
      copy: "La identidad digital pasó los controles, pero las fuentes reportaron estados de sello incompatibles. Revisá los detalles o avisá a la marca.",
      identityLabel: "Verificada",
      sealLabel: "Inconsistente",
    };
  }

  if (input.isVerifiedClosedState) {
    return {
      tone: "closed",
      label: input.isSnapshotView ? "Registro de una lectura NFC" : "Lectura NFC verificada",
      headline: input.isSnapshotView ? "En esa lectura, el tag informó: sello cerrado" : "El tag informa: sello cerrado",
      copy: input.isSnapshotView
        ? "Es un registro histórico: en esa lectura la identidad digital pasó los controles y el chip reportó estado cerrado. No describe necesariamente el estado actual."
        : "La lectura digital pasó los controles y el chip reporta estado cerrado. Esto no certifica por sí solo el contenido ni una inspección física del envase.",
      identityLabel: "Verificada",
      sealLabel: "Cerrado",
    };
  }

  if (input.isVerifiedOpenedState) {
    return {
      tone: "opened",
      label: input.isSnapshotView ? "Registro de una lectura NFC" : "Lectura NFC verificada",
      headline: input.isSnapshotView ? "En esa lectura, el tag informó: sello abierto" : "El tag informa: sello abierto",
      copy: input.isSnapshotView
        ? "Es un registro histórico: en esa lectura la identidad digital pasó los controles y el chip reportó una apertura. No describe necesariamente el estado actual."
        : "La lectura digital pasó los controles, pero el chip reporta una apertura. Si vos no lo abriste o ves daños, no uses el producto y avisá a la marca.",
      identityLabel: "Verificada",
      sealLabel: "Abierto",
    };
  }

  return {
    tone: "verified",
    label: input.isSnapshotView ? "Registro de una lectura NFC" : "Lectura NFC verificada",
    headline: input.isSnapshotView ? "En esa lectura se validó la identidad NFC" : "Identidad NFC validada",
    copy: input.isSnapshotView
      ? "Es un registro histórico: la identidad digital pasó los controles, pero el estado del sello no fue informado."
      : "La identidad digital pasó los controles, pero el estado del sello no fue informado.",
    identityLabel: "Verificada",
    sealLabel: "No informado",
  };
}

export function resolveSunConsumerStatus(
  input: ResolveSunConsumerStatusInput,
  locale: SunLocale = "es-AR",
): SunConsumerStatus {
  const status = resolveSunConsumerStatusEs(input);
  return {
    ...status,
    label: translateSunUiText(status.label, locale),
    headline: translateSunUiText(status.headline, locale),
    copy: translateSunUiText(status.copy, locale),
    identityLabel: translateSunUiText(status.identityLabel, locale),
    sealLabel: translateSunUiText(status.sealLabel, locale),
  };
}
import type { SunLocale } from "./sun-locale.ts";
import { translateSunUiText } from "./sun-locale.ts";
