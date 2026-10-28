/** The browser carries conversation only; product facts and spend authorization belong to API. */
export type SommelierHistoryMessage = { role: "user" | "assistant"; content: string };
export type SommelierSource = { id: string; label: string; url: string | null };
export const MANAGED_SOMMELIER_QUESTION_MAX_CHARS = 1_500;
const HISTORY_MAX_BYTES = 6_000;
const DEADLINE_MS = 12_000;
const encoder = new TextEncoder();

export function sommelierHistory(messages: readonly { sender: string; text: string; provenance?: { mode: string } }[]): SommelierHistoryMessage[] {
  const candidates = messages.filter(message => (message.sender === "user" || message.sender === "sommelier") && message.provenance?.mode !== "context")
    .map(message => ({ role: message.sender === "user" ? "user" as const : "assistant" as const, content: message.text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 1_000) }))
    .filter(message => message.content).slice(-6);
  while (candidates.length && encoder.encode(JSON.stringify(candidates)).length > HISTORY_MAX_BYTES) candidates.shift();
  return candidates;
}

export function sommelierSources(value: unknown, demo = false, profile?: "valle-secreto" | "syngenta"): SommelierSource[] {
  if (!Array.isArray(value) || value.length > 6) return [];
  const sources: SommelierSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !/^[a-zA-Z][a-zA-Z0-9_:-]{0,63}$/.test(record.id)
      || typeof record.label !== "string" || !record.label.trim() || record.label.length > 160) continue;
    let url: string | null = null;
    if (typeof record.url === "string") {
      try {
        const parsed = new URL(record.url);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port
          || (demo && profile === "syngenta" && (parsed.search || parsed.hash))
          || (demo && !(profile === "syngenta"
            ? ["syngenta.com.ar", "www.syngenta.com.ar", "www.nxp.com"]
            : ["vallesecreto.cl", "www.vallesecreto.cl", "www.sustainable.cl", "sustainable.cl"]).includes(parsed.hostname))) continue;
        url = parsed.href;
      } catch { continue; }
    } else if (record.url !== null && record.url !== undefined) continue;
    if (!sources.some(source => source.id === record.id)) sources.push({ id: record.id, label: record.label.trim(), url });
  }
  return sources;
}


const SOMMELIER_RECOVERY_REASONS = [
  "sommelier_rate_limited", "sommelier_budget_exhausted", "sommelier_quota_unavailable", "sommelier_disabled",
  "sommelier_provider_not_configured", "sommelier_context_too_large", "sommelier_provider_timeout", "sommelier_provider_unavailable",
] as const;
export type SommelierRecoveryReason = typeof SOMMELIER_RECOVERY_REASONS[number];
export type SommelierRecovery = { reason?: SommelierRecoveryReason; retryAfter?: number };
const recoveryReasons = new Set<string>(SOMMELIER_RECOVERY_REASONS);
const quotaRecoveryReasons = new Set<string>(["sommelier_rate_limited", "sommelier_budget_exhausted", "sommelier_quota_unavailable"]);
function boundedRecoveryDelay(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 86_400 ? value : undefined;
}
function parsedRecovery(reason: unknown, delay: unknown, httpWait = false): SommelierRecovery | undefined {
  const safeReason = typeof reason === "string" && recoveryReasons.has(reason) ? reason as SommelierRecoveryReason : undefined;
  const retryAfter = httpWait || safeReason && quotaRecoveryReasons.has(safeReason) ? boundedRecoveryDelay(delay) : undefined;
  return safeReason || retryAfter !== undefined ? { ...(safeReason ? { reason: safeReason } : {}), ...(retryAfter !== undefined ? { retryAfter } : {}) } : undefined;
}
function headerRecoveryDelay(value: unknown) {
  return typeof value === "string" && /^[1-9]\d{0,4}$/.test(value) ? boundedRecoveryDelay(Number(value)) : undefined;
}
export function managedSommelierRecovery(result: ManagedSommelierResult) {
  return result.status === "received" ? result.data.fallback ? result.data.recovery : undefined : result.recovery;
}

/** Closed local copy only. A transport status or unknown provider text never describes account credit. */
export function sommelierRecoveryNotice(recovery: SommelierRecovery | undefined, locale: "es-AR" | "en" | "pt-BR", waiting: boolean): string | null {
  if (!recovery) return null;
  const copy = {
    "es-AR": {
      wait: (seconds: number) => `El asistente indicó una pausa de ${seconds} s. Podés seguir editando tu pregunta; el envío se habilitará al terminar.`,
      ready: "La pausa terminó. Tu pregunta sigue disponible y vos decidís cuándo enviarla.",
      unavailable: "El asistente no está disponible en este momento. Tu pregunta sigue disponible; podés consultar la ficha del producto.",
      unconfirmed: "El servicio no confirmó una respuesta de IA. Tu pregunta sigue disponible.",
    },
    en: {
      wait: (seconds: number) => `The assistant requested a ${seconds} s pause. You can keep editing your question; sending will be available when the pause ends.`,
      ready: "The pause has ended. Your question is still available; you decide when to send it.",
      unavailable: "The assistant is currently unavailable. Your question is still available; you can consult the product sheet.",
      unconfirmed: "The service did not confirm an AI answer. Your question is still available.",
    },
    "pt-BR": {
      wait: (seconds: number) => `O assistente indicou uma pausa de ${seconds} s. Você pode continuar editando sua pergunta; o envio será habilitado ao terminar.`,
      ready: "A pausa terminou. Sua pergunta continua disponível e você decide quando enviá-la.",
      unavailable: "O assistente está indisponível no momento. Sua pergunta continua disponível; você pode consultar a ficha do produto.",
      unconfirmed: "O serviço não confirmou uma resposta de IA. Sua pergunta continua disponível.",
    },
  }[locale];
  if (recovery.retryAfter !== undefined) return waiting ? copy.wait(recovery.retryAfter) : copy.ready;
  return recovery.reason === "sommelier_disabled" || recovery.reason === "sommelier_provider_not_configured" || recovery.reason === "sommelier_context_too_large"
    || recovery.reason && quotaRecoveryReasons.has(recovery.reason) ? copy.unavailable : copy.unconfirmed;
}

type SommelierAccessReason = "sommelier_consumer_session_required" | "sommelier_event_not_authorized" | "sommelier_origin_rejected";
export type ManagedSommelierResult =
  | { status: "received"; data: { optimizedText: string; fallback: boolean; provider?: string; model?: string; sources: SommelierSource[]; suggestedQuestions: string[]; demo: boolean; recovery?: SommelierRecovery } }
  | { status: "unavailable"; reason: "timeout" | "cancelled" | "connection" | "http-error" | "invalid-response"; httpStatus?: number; serviceReason?: SommelierAccessReason; recovery?: SommelierRecovery };

/** Known API access reasons only; provider text must never become customer copy. */
function httpFailure(status: number, payload: unknown, retryHeader?: unknown): ManagedSommelierResult {
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  const reason = record?.ok === false ? record.reason : null;
  const serviceReason = reason === "sommelier_consumer_session_required" || reason === "sommelier_event_not_authorized" || reason === "sommelier_origin_rejected" ? reason : undefined;
  const recovery = status === 429 || status === 503 ? parsedRecovery(reason, headerRecoveryDelay(retryHeader), true) : undefined;
  return { status: "unavailable", reason: "http-error", ...(recovery ? { recovery } : {}), ...(Number.isInteger(status) && status >= 400 && status <= 599 ? { httpStatus: status } : {}), ...(serviceReason ? { serviceReason } : {}) };
}

export function consumerSommelierFailureKind(result: Extract<ManagedSommelierResult, { status: "unavailable" }>): "session" | "access" | "service" | "other" {
  if (result.reason !== "http-error") return "other";
  // Consumer API uses 403 for missing session as well as denied product scope.
  if (result.httpStatus === 401 || (result.httpStatus === 403 && result.serviceReason === "sommelier_consumer_session_required")) return "session";
  if (result.httpStatus === 403) return "access";
  if (result.httpStatus !== undefined && result.httpStatus >= 500) return "service";
  return "other";
}

export async function requestManagedSommelierAnswer(question: string, options: {
  locale: "es-AR" | "en" | "pt-BR";
  history?: SommelierHistoryMessage[];
  demoProfile?: "valle-secreto" | "syngenta";
  eventId?: string | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ManagedSommelierResult> {
  const controller = new AbortController();
  let response: Response | undefined;
  let interrupt: (result: ManagedSommelierResult) => void = () => {};
  const interrupted = new Promise<ManagedSommelierResult>(resolve => { interrupt = resolve; });
  const cancel = (reason: "timeout" | "cancelled") => {
    controller.abort();
    try { void response?.body?.cancel().catch(() => {}); } catch { /* Reader may own the body. */ }
    interrupt({ status: "unavailable", reason });
  };
  if (options.signal?.aborted) return { status: "unavailable", reason: "cancelled" };
  const onAbort = () => cancel("cancelled");
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => cancel("timeout"), options.timeoutMs ?? DEADLINE_MS);
  const request = (async (): Promise<ManagedSommelierResult> => {
    const post = async (path: string, body: unknown) => {
      response = await (options.fetchImpl ?? fetch)(path, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal,
      });
      if (controller.signal.aborted) return null;
      const payload: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return null;
      return { ok: response.ok, httpStatus: response.status, payload, retryAfter: response.headers.get("retry-after") };
    };
    try {
      const text = question.trim().slice(0, MANAGED_SOMMELIER_QUESTION_MAX_CHARS);
      if (!text || !["es-AR", "en", "pt-BR"].includes(options.locale)
        || (options.demoProfile && (!(["valle-secreto", "syngenta"] as const).includes(options.demoProfile) || options.eventId !== undefined))) return { status: "unavailable", reason: "invalid-response" };
      if (options.demoProfile) {
        const session = await post("/api/sommelier/demo/session", { profile: options.demoProfile, locale: options.locale });
        if (!session) return interrupted;
        if (!session.ok || !session.payload || typeof session.payload !== "object" || (session.payload as { ok?: unknown }).ok !== true) return httpFailure(session.httpStatus, session.payload, session.retryAfter);
        if (options.demoProfile === "syngenta" && (session.payload as { profile?: unknown }).profile !== "syngenta") return { status: "unavailable", reason: "invalid-response" };
        if (options.demoProfile === "valle-secreto" && (session.payload as { profile?: unknown }).profile !== undefined && (session.payload as { profile?: unknown }).profile !== "valle-secreto") return { status: "unavailable", reason: "invalid-response" };
      }
      const result = await post("/api/sommelier/chat", {
        mode: options.demoProfile ? "demo" : "consumer", question: text, locale: options.locale, history: options.history ?? [],
        ...(options.demoProfile === "syngenta" ? { demoProfile: "syngenta" } : {}),
        ...(!options.demoProfile && Object.hasOwn(options, "eventId") ? { eventId: options.eventId } : {}),
      });
      if (!result) return interrupted;
      if (!result.ok) return httpFailure(result.httpStatus, result.payload, result.retryAfter);
      if (!result.payload || typeof result.payload !== "object" || Array.isArray(result.payload)) return { status: "unavailable", reason: "invalid-response" };
      const data = result.payload as Record<string, unknown>;
      if (data.ok !== true || typeof data.answer !== "string" || !data.answer.trim() || data.answer.length > 5_000
        || typeof data.fallback !== "boolean" || data.demo !== Boolean(options.demoProfile)
        || (data.source !== "live" && data.source !== "fallback") || (data.source === "live") === data.fallback
        || (options.demoProfile === "syngenta" && (data.demoProfile !== "syngenta" || data.contextSource !== "syngenta_demo"))
        || (options.demoProfile === "valle-secreto" && ((data.demoProfile !== undefined && data.demoProfile !== "valle-secreto") || (data.contextSource !== undefined && data.contextSource !== "valle_secreto_demo")))
        || (!data.fallback && (typeof data.provider !== "string" || !data.provider || typeof data.model !== "string" || !data.model))) return { status: "unavailable", reason: "invalid-response" };
      const sources = sommelierSources(data.sources, Boolean(options.demoProfile), options.demoProfile);
      if (options.demoProfile === "syngenta" && !sources.some(source => source.url !== null)) return { status: "unavailable", reason: "invalid-response" };
      const recovery = data.fallback ? parsedRecovery(data.reason, data.retryAfter) : undefined;
      return { status: "received", data: {
        ...(recovery ? { recovery } : {}),
        optimizedText: data.answer.trim(), fallback: data.fallback, demo: Boolean(data.demo),
        ...(!data.fallback ? { provider: data.provider as string, model: data.model as string } : {}),
        sources,
        suggestedQuestions: Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions.filter((q): q is string => typeof q === "string" && q.trim().length > 0 && q.length <= 200).slice(0, 3) : [],
      } };
    } catch {
      return controller.signal.aborted ? interrupted : { status: "unavailable", reason: "connection" };
    }
  })();
  try { return await Promise.race([request, interrupted]); }
  finally { clearTimeout(timer); options.signal?.removeEventListener("abort", onAbort); }
}
