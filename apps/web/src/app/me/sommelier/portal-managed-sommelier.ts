import {
  consumerSommelierFailureKind, requestManagedSommelierAnswer, sommelierHistory,
  type ManagedSommelierResult,
} from "../../../lib/managed-sommelier";

export type PortalSommelierMessage = {
  sender: string; text: string; provenance?: { mode: string }; delivery?: "pending" | "received" | "unconfirmed";
};

/** URL names are local declared context only. This adapter sends no facts, tenant, event or demo grant. */
export function portalSommelierHistory(messages: readonly PortalSommelierMessage[]) {
  return sommelierHistory(messages.filter(message => message.delivery !== "unconfirmed" && message.delivery !== "pending"
    && message.provenance?.mode !== "local-fallback"));
}

export function requestPortalSommelierAnswer(question: string, messages: readonly PortalSommelierMessage[], options: {
  signal?: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number;
} = {}) {
  return requestManagedSommelierAnswer(question, {
    locale: "es-AR", history: portalSommelierHistory(messages),
    signal: options.signal, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs,
  });
}

export function portalSommelierFailure(result: Extract<ManagedSommelierResult, { status: "unavailable" }>) {
  const kind = consumerSommelierFailureKind(result);
  if (kind === "session") return { kind: "session" as const, allowLocalGuide: false,
    feedback: "Tu sesión no está disponible. Tu pregunta sigue visible: podés copiarla antes de volver a ingresar." };
  if (kind === "access") return { kind: "access" as const, allowLocalGuide: false,
    feedback: "El servicio no autorizó esta consulta. Tu pregunta sigue visible. Volvé a tus productos para revisar tu acceso." };
  if (result.reason === "http-error" && result.httpStatus === 429) return { kind: "limit" as const, allowLocalGuide: false,
    feedback: "Alcanzamos el límite temporal de consultas. Tu pregunta sigue visible. Esperá un momento y volvé a intentarlo." };
  return { kind: "service" as const, allowLocalGuide: true,
    feedback: result.reason === "timeout"
      ? "El servicio no respondió a tiempo. Tu pregunta sigue visible. La guía local no confirma una respuesta de IA."
      : "No pudimos recibir una respuesta del servicio. Conservamos tu consulta para que puedas volver a enviarla. La guía local no confirma una respuesta de IA." };
}
