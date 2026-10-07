import { normalizeSommelierProductContext, type SommelierProductContext } from "./sommelier-guidance";

export const SOMMELIER_REQUEST_TIMEOUT_MS = 12_000;
export const SOMMELIER_QUESTION_MAX_CHARS = 2_000;

export function sommelierSelection(params: { product?: unknown; brand?: unknown }): SommelierProductContext {
  const text = (value: unknown) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ") : "";
  return normalizeSommelierProductContext({ productName: text(params.product), brandName: text(params.brand) });
}

export function sommelierWelcome(context: SommelierProductContext): string {
  const { productName, brandName } = normalizeSommelierProductContext(context);
  return productName
    ? `Podemos conversar sobre servicio y maridajes de "${productName}"${brandName ? ` de "${brandName}"` : ""}. El nombre indicado no reemplaza la ficha técnica de la marca.`
    : "Podemos conversar sobre servicio, conservación y maridajes de vinos. No seleccionaste un producto; las respuestas serán una orientación general.";
}

type SommelierResponse =
  | { status: "received"; data: Record<string, unknown> & { optimizedText: string } }
  | { status: "unavailable"; reason: "timeout" | "connection" | "invalid-response" | "http-error" | "cancelled" };

/** A single deadline covers both headers and JSON, including transports that ignore abort. */
export async function requestSommelierAnswer(
  question: string,
  context: SommelierProductContext,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number; postTapEventId?: string | null } = {},
): Promise<SommelierResponse> {
  const controller = new AbortController();
  let response: Response | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finishInterrupted: (result: SommelierResponse) => void = () => {};
  const interrupted = new Promise<SommelierResponse>((resolve) => { finishInterrupted = resolve; });
  const cancel = (reason: "timeout" | "cancelled") => {
    controller.abort();
    try { void response?.body?.cancel().catch(() => {}); } catch { /* JSON reader may own the body. */ }
    finishInterrupted({ status: "unavailable", reason });
  };
  const onAbort = () => cancel("cancelled");
  if (options.signal?.aborted) return { status: "unavailable", reason: "cancelled" };
  options.signal?.addEventListener("abort", onAbort, { once: true });
  timer = setTimeout(() => cancel("timeout"), options.timeoutMs ?? SOMMELIER_REQUEST_TIMEOUT_MS);
  const request = (async (): Promise<SommelierResponse> => {
    try {
      response = await (options.fetchImpl ?? fetch)("/api/cognitive-ai", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: question, tone: "sommelier-chat", productContext: normalizeSommelierProductContext(context),
          ...(Object.hasOwn(options, "postTapEventId") ? { postTapEventId: options.postTapEventId } : {}) }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return interrupted;
      if (!response.ok) return { status: "unavailable", reason: "http-error" };
      const payload: unknown = await response.json();
      if (controller.signal.aborted) return interrupted;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { status: "unavailable", reason: "invalid-response" };
      const record = payload as Record<string, unknown>;
      if (typeof record.optimizedText !== "string" || !record.optimizedText.trim()) return { status: "unavailable", reason: "invalid-response" };
      return { status: "received", data: { ...record, optimizedText: record.optimizedText.trim() } };
    } catch {
      return controller.signal.aborted ? interrupted : { status: "unavailable", reason: "connection" };
    }
  })();
  try { return await Promise.race([request, interrupted]); }
  finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
