export type InvestorAiProvenanceMode =
  | "idle"
  | "checking"
  | "live"
  | "server-fallback"
  | "local-fallback";

export type InvestorAiProvenance = {
  mode: InvestorAiProvenanceMode;
  provider?: string;
  model?: string;
  reason?: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function classifyInvestorAiResponse(payload: unknown): InvestorAiProvenance {
  if (!isRecord(payload)) {
    return { mode: "server-fallback", reason: "invalid_response" };
  }

  const provider = nonEmptyString(payload.provider);
  const model = nonEmptyString(payload.model);
  const reason = nonEmptyString(payload.reason);

  if (payload.fallback === false && provider && model) {
    return { mode: "live", provider, model };
  }

  return {
    mode: "server-fallback",
    provider,
    model,
    reason: reason || (payload.fallback === true ? "provider_fallback" : "provider_provenance_missing"),
  };
}

export function describeInvestorAiProvenance(
  provenance: InvestorAiProvenance,
  tokenConfigured = false,
) {
  switch (provenance.mode) {
    case "live":
      return {
        badge: `LLM LIVE · ${provenance.provider} · ${provenance.model}`,
        detail: "Respuesta confirmada por el proveedor y modelo indicados.",
        tone: "live" as const,
      };
    case "checking":
      return {
        badge: "VERIFICANDO PROVEEDOR",
        detail: "La ejecución todavía no confirmó proveedor ni modelo.",
        tone: "checking" as const,
      };
    case "server-fallback":
      return {
        badge: "FALLBACK DETERMINÍSTICO · SERVIDOR",
        detail: "El proveedor no quedó confirmado; se usó la respuesta segura del servidor.",
        tone: "fallback" as const,
      };
    case "local-fallback":
      return {
        badge: "FALLBACK DETERMINÍSTICO · NAVEGADOR",
        detail: "La llamada falló y la demo resolvió el resultado localmente.",
        tone: "fallback" as const,
      };
    default:
      return tokenConfigured
        ? {
            badge: "TOKEN CONFIGURADO · SIN VERIFICAR",
            detail: "El token no prueba una conexión live; ejecutá una consulta para verificar proveedor y modelo.",
            tone: "idle" as const,
          }
        : {
            badge: "SIN TOKEN · FALLBACK DISPONIBLE",
            detail: "La demo usará una respuesta determinística hasta confirmar un proveedor live.",
            tone: "idle" as const,
          };
  }
}

export function shortInvestorAiProvenanceLabel(provenance?: InvestorAiProvenance) {
  if (!provenance) return "Contenido demo curado";
  if (provenance.mode === "live") return `LLM live · ${provenance.provider} / ${provenance.model}`;
  if (provenance.mode === "checking") return "Verificando proveedor";
  if (provenance.mode === "server-fallback") return "Fallback determinístico · servidor";
  if (provenance.mode === "local-fallback") return "Fallback determinístico · navegador";
  return "Contenido demo curado";
}
