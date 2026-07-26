export type SommelierProvenance = {
  mode: "context" | "live" | "server-fallback" | "local-fallback";
  provider?: string;
  model?: string;
};

export type SommelierProductContext = {
  productName?: string;
  brandName?: string;
};

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function normalizeSommelierProductContext(value: unknown): SommelierProductContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    productName: clean(record.productName),
    brandName: clean(record.brandName),
  };
}

export function classifySommelierResponse(payload: unknown): SommelierProvenance {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { mode: "server-fallback" };
  const record = payload as Record<string, unknown>;
  const provider = clean(record.provider, 80);
  const model = clean(record.model, 160);
  if (record.fallback === false && provider && model) return { mode: "live", provider, model };
  return { mode: "server-fallback" };
}

export function sommelierProvenanceLabel(provenance?: SommelierProvenance) {
  if (!provenance || provenance.mode === "context") return "Orientación general · producto no verificado";
  if (provenance.mode === "live") return `Proveedor confirmado · ${provenance.provider} / ${provenance.model} · no es ficha técnica`;
  if (provenance.mode === "local-fallback") return "Fallback local · orientación general, no ficha técnica";
  return "Fallback del servidor · orientación general, no ficha técnica";
}

export function safeSommelierGuidance(question: string, context: SommelierProductContext = {}) {
  const cleanQuestion = clean(question, 800).toLowerCase();
  const product = clean(context.productName) || "este producto";

  if (/premio|punto|suckling|decanter|medalla|calificaci[oó]n/.test(cleanQuestion)) {
    return `No tengo premios ni puntajes verificados para ${product}. Consultá la ficha publicada por la marca o el pasaporte del lote antes de comunicar ese dato.`;
  }
  if (/cata|aroma|sabor|nota|oler|barrica|roble|terroir|crianza/.test(cleanQuestion)) {
    return `No puedo inferir notas de cata, terroir ni crianza de ${product} sin una ficha técnica validada. Puedo ayudarte a interpretar esos datos cuando la marca los publique.`;
  }
  if (/temperatura|servir|fr[ií]o|caliente/.test(cleanQuestion)) {
    return `La temperatura de servicio depende del tipo y estilo del vino. Sin ficha técnica validada para ${product}, revisá la etiqueta o la recomendación oficial de la bodega.`;
  }
  if (/guarda|guardar|tiempo|a[nñ]os|vencer/.test(cleanQuestion)) {
    return `No puedo estimar la guarda de ${product} sin conocer añada, composición, elaboración y conservación. Usá la ficha técnica de la marca o consultá a un profesional.`;
  }
  if (/maridaje|comer|comida|acompa[nñ]ar/.test(cleanQuestion)) {
    return `Como orientación general, el maridaje depende de acidez, cuerpo, dulzor y preparación del plato. Sin ficha técnica validada de ${product}, tomá la recomendación como guía y no como atributo del vino.`;
  }
  if (/regalo|cena|rom[aá]ntic|ocasi[oó]n|evento|festejo/.test(cleanQuestion)) {
    return `Como orientación general, ${product} puede presentarse con la historia y datos que la marca haya publicado. No puedo garantizar su estilo, guarda, premios ni adecuación a la ocasión sin ficha validada.`;
  }
  return `Puedo brindar orientación general sobre servicio y maridaje, pero no tengo una ficha técnica verificada de ${product}. No voy a inventar origen, premios, terroir, crianza ni notas de cata.`;
}

export function containsUnverifiedSommelierClaim(text: string) {
  return /(james\s+suckling|decanter|medalla|\b\d{2,3}\s*puntos\b|terroir|crianza|roble|barrica|\d+\s*meses?\s+de\s+guarda|a[nñ]ada|cosecha|mendoza|valle\s+de\s+uco|\b\d{1,2}\s*°\s*c|notas?\s+de\s+cata|frutas?\s+(rojas?|negras?)|ciruela|mora\s+madura|tabaco|vainilla|\b\d+\s*(a|-)\s*\d+\s*a[nñ]os|acierto\s+garantizado)/i.test(text);
}
