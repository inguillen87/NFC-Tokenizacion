export type CognitiveSummaryDelivery =
  | {
      mode: "live_provider";
      text: string;
      provider: "huggingface-router";
      model: string;
      reason: null;
    }
  | {
      mode: "deterministic_fallback";
      text: string;
      provider: null;
      model: null;
      reason: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value: unknown, max = 160) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function safeReason(value: unknown) {
  const reason = clean(value, 80).toLowerCase();
  return /^[a-z0-9_-]+$/.test(reason) ? reason : "provider_unavailable";
}

export function deterministicCognitiveSummary(
  reason = "not_requested",
  text = "",
): CognitiveSummaryDelivery {
  return {
    mode: "deterministic_fallback",
    text: clean(text, 4_000),
    provider: null,
    model: null,
    reason: safeReason(reason),
  };
}

export function resolveCognitiveSummaryDelivery(payload: unknown): CognitiveSummaryDelivery {
  if (!isRecord(payload)) return deterministicCognitiveSummary("invalid_payload");

  const text = clean(payload.optimizedText, 4_000);
  const provider = clean(payload.provider, 80);
  const model = clean(payload.model, 160);
  if (text && payload.fallback !== true && provider === "huggingface-router" && model) {
    return { mode: "live_provider", text, provider, model, reason: null };
  }

  return deterministicCognitiveSummary(
    payload.fallback === true ? safeReason(payload.reason) : "provider_unconfirmed",
    text,
  );
}

function reasonLabel(reason: string) {
  if (reason === "hugging_face_402") return "proveedor sin cuota disponible (HTTP 402)";
  if (reason === "hugging_face_429") return "límite temporal del proveedor (HTTP 429)";
  if (reason === "hugging_face_token_missing") return "proveedor no configurado";
  if (reason === "provider_request_pending") return "verificando disponibilidad del proveedor";
  if (reason === "not_requested") return "sin solicitud a proveedor";
  return "proveedor no disponible o no confirmado";
}

export function describeCognitiveSummary(delivery: CognitiveSummaryDelivery) {
  if (delivery.mode === "live_provider") {
    return {
      subtitle: `Acción generada por un proveedor de IA confirmado para estos KPIs. Modelo: ${delivery.model}.`,
      badge: `Proveedor confirmado: Hugging Face · ${delivery.model}`,
    };
  }
  return {
    subtitle: "Resumen determinístico basado únicamente en los KPIs visibles; no afirma un proveedor de IA en vivo.",
    badge: `Fallback determinístico · ${reasonLabel(delivery.reason)}`,
  };
}
