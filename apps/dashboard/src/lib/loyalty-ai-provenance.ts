export type LoyaltyOptimizerMode = "idle" | "live-provider" | "server-fallback" | "local-fallback";

export type LoyaltyAiProvenanceKind =
  | "live-provider"
  | "server-fallback"
  | "local-rules"
  | "ready"
  | "checking";

export type LoyaltyAiProvenance = {
  kind: LoyaltyAiProvenanceKind;
  isLive: boolean;
  tabBadge: string;
  headline: string;
  detail: string;
};

type ResolveLoyaltyAiProvenanceInput = {
  mode: LoyaltyOptimizerMode;
  provider?: string | null;
  model?: string | null;
  requestPending?: boolean;
  serverConfigured?: boolean | null;
  serverUnavailable?: boolean;
  serverModel?: string | null;
};

function clean(value?: string | null) {
  return String(value || "").trim();
}

function displayProvider(provider: string) {
  return provider === "huggingface-router" ? "Hugging Face Router" : provider;
}

export function resolveLoyaltyAiProvenance({
  mode,
  provider,
  model,
  requestPending = false,
  serverConfigured = null,
  serverUnavailable = false,
  serverModel,
}: ResolveLoyaltyAiProvenanceInput): LoyaltyAiProvenance {
  const confirmedProvider = clean(provider);
  const confirmedModel = clean(model);

  if (requestPending) {
    return {
      kind: "checking",
      isLive: false,
      tabBadge: "Procesando",
      headline: "Solicitud en curso · procedencia pendiente",
      detail: "El resultado todavía no tiene proveedor ni modelo confirmados; no se presenta como IA live.",
    };
  }

  if (mode === "live-provider" && confirmedProvider && confirmedModel) {
    const providerLabel = displayProvider(confirmedProvider);
    return {
      kind: "live-provider",
      isLive: true,
      tabBadge: "LLM live",
      headline: `Proveedor confirmado: ${providerLabel}`,
      detail: `La última reescritura fue respondida por ${providerLabel} con el modelo ${confirmedModel}.`,
    };
  }

  // Defensive downgrade: a response without both provider and model is never live.
  if (mode === "live-provider" || mode === "server-fallback") {
    return {
      kind: "server-fallback",
      isLive: false,
      tabBadge: "Fallback",
      headline: "Fallback determinístico del servidor",
      detail: "No se confirmó una respuesta live con proveedor y modelo; se muestra el resultado seguro del servidor.",
    };
  }

  if (mode === "local-fallback") {
    return {
      kind: "local-rules",
      isLive: false,
      tabBadge: "Reglas locales",
      headline: "Motor de reglas local · sin LLM",
      detail: "La API no respondió; la reescritura se generó con el diccionario determinístico de este navegador.",
    };
  }

  if (serverUnavailable) {
    return {
      kind: "checking",
      isLive: false,
      tabBadge: "Sin confirmar",
      headline: "Configuración del proveedor no disponible",
      detail: "No se pudo consultar el estado del servidor. El borrador se conserva; no se afirma que haya un proveedor activo.",
    };
  }

  if (serverConfigured === true) {
    const configuredModel = clean(serverModel);
    return {
      kind: "ready",
      isLive: false,
      tabBadge: "Configurado",
      headline: "Proveedor LLM configurado · todavía sin ejecutar",
      detail: configuredModel
        ? `El servidor intentará usar ${configuredModel}. Configurado no significa que exista una respuesta live.`
        : "El servidor tiene un proveedor configurado. Solo se indicará live al confirmar proveedor y modelo en una respuesta.",
    };
  }

  if (serverConfigured === null) {
    return {
      kind: "checking",
      isLive: false,
      tabBadge: "Verificando",
      headline: "Verificando configuración del optimizador",
      detail: "Aún no se confirmó un proveedor; las herramientas locales siguen disponibles.",
    };
  }

  return {
    kind: "local-rules",
    isLive: false,
    tabBadge: "Reglas locales",
    headline: "Optimizador local · sin proveedor LLM",
    detail: "La reescritura y los scores funcionan con reglas y estimaciones locales; no se llama a un modelo externo.",
  };
}
