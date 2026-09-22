import { evidenceCarrier } from "../../lib/passport-evidence-summary";

export type PassportEvidenceMode = "fresh" | "historical" | "qr" | "demo" | "unknown";

export type PassportEvidenceResourcesProps = {
  mode: PassportEvidenceMode;
  occurredAt?: string | null;
  eventReference?: string | null;
  statusLabel?: string | null;
  carrierCode?: string | null;
  certificateHref?: string | null;
  technicalSheetHref?: string | null;
  safetySheetHref?: string | null;
  showProductNotices?: boolean;
  currentEditorial?: unknown;
};

export const passportEvidenceCopy = {
  "es-AR": {
    title: "Evidencia y recursos", reading: "Lectura NFC", historical: "Registro histórico", fresh: "Lectura reciente",
    unknown: "Consulta de evidencia", qr: "Consulta QR", demo: "Ficha de muestra", registered: "Fecha del registro",
    missingDate: "Fecha no disponible", reference: "Referencia", missingStatus: "Resultado no informado",
    historicalHelp: "Conserva el resultado de aquella lectura. Consultarlo no equivale a un nuevo TAP.",
    freshHelp: "El resultado corresponde al mensaje de la etiqueta. Cada acción protegida tiene sus propios requisitos.",
    unknownHelp: "La vigencia de la lectura no está confirmada. Consultar la evidencia no habilita acciones protegidas.",
    qrHelp: "El QR abre información del producto; no aporta una autenticación NFC.",
    demoHelp: "Ejemplo ilustrativo, sin lectura física ni certificado de un producto real.",
    declared: "Perfil y documentos: información presentada en esta ficha, separada de la evidencia NFC.",
    demoDeclared: "Perfil ilustrativo; no representa información verificada de un producto real.",
    informational: "Sin autenticación NFC", unknownCarrier: "Tecnología no informada",
    informationalHelp: "El registro aporta información del producto, sin verificar un mensaje NFC seguro.",
    documentBoundary: "Los enlaces son los aportados en esta ficha. Fecha de publicación y vigencia no disponibles.",
    historicalDocumentHelp: "Enlace conservado en esta lectura",
    historicalDocumentBoundary: "Enlaces conservados en esta lectura. No confirman la versión vigente ni la fecha de revisión de los documentos.",
    resources: "Recursos disponibles", certificate: "Ver certificado de la lectura", certificateHelp: "Evidencia digital; no certifica el producto físico.",
    technical: "Ficha técnica", safety: "Ficha de seguridad", documentHelp: "Enlace publicado en esta ficha", external: "Sitio externo",
    notices: "Avisos del producto", noticesHelp: "Consultar el estado actual del lote", empty: "Esta ficha no incluye recursos adicionales.",
  },
  en: {
    title: "Evidence and resources", reading: "NFC reading", historical: "Historical record", fresh: "Recent reading",
    unknown: "Evidence view", qr: "QR information", demo: "Sample passport", registered: "Record date",
    missingDate: "Date unavailable", reference: "Reference", missingStatus: "Result not reported",
    historicalHelp: "Preserves the result of that reading. Viewing it is not a new tap.",
    freshHelp: "The result concerns the tag message. Each protected action has its own requirements.",
    unknownHelp: "Reading freshness is unconfirmed. Viewing evidence does not enable protected actions.",
    qrHelp: "The QR opens product information; it does not provide NFC authentication.",
    demoHelp: "Illustrative example, with no physical reading or certificate for a real product.",
    declared: "Profile and documents: information shown in this passport, separate from NFC evidence.",
    demoDeclared: "Illustrative profile; it does not represent verified information about a real product.",
    informational: "No NFC authentication", unknownCarrier: "Technology not reported",
    informationalHelp: "The record provides product information without verifying a secure NFC message.",
    documentBoundary: "These links were supplied in this passport. Publication date and current validity are unavailable.",
    historicalDocumentHelp: "Link preserved with this reading",
    historicalDocumentBoundary: "Links preserved with this reading. They do not confirm the current version or the document review date.",
    resources: "Available resources", certificate: "View reading certificate", certificateHelp: "Digital evidence; it does not certify the physical product.",
    technical: "Technical sheet", safety: "Safety sheet", documentHelp: "Link published in this passport", external: "External site",
    notices: "Product notices", noticesHelp: "Check the current batch notice status", empty: "This passport includes no additional resources.",
  },
  "pt-BR": {
    title: "Evidências e recursos", reading: "Leitura NFC", historical: "Registro histórico", fresh: "Leitura recente",
    unknown: "Consulta de evidências", qr: "Consulta QR", demo: "Ficha de exemplo", registered: "Data do registro",
    missingDate: "Data indisponível", reference: "Referência", missingStatus: "Resultado não informado",
    historicalHelp: "Preserva o resultado daquela leitura. Consultá-lo não equivale a um novo toque.",
    freshHelp: "O resultado corresponde à mensagem da etiqueta. Cada ação protegida tem seus próprios requisitos.",
    unknownHelp: "A atualidade da leitura não foi confirmada. Consultar evidências não habilita ações protegidas.",
    qrHelp: "O QR abre informações do produto; não fornece autenticação NFC.",
    demoHelp: "Exemplo ilustrativo, sem leitura física nem certificado de um produto real.",
    declared: "Perfil e documentos: informações apresentadas nesta ficha, separadas das evidências NFC.",
    demoDeclared: "Perfil ilustrativo; não representa informações verificadas sobre um produto real.",
    informational: "Sem autenticação NFC", unknownCarrier: "Tecnologia não informada",
    informationalHelp: "O registro fornece informações do produto sem verificar uma mensagem NFC segura.",
    documentBoundary: "Os links foram fornecidos nesta ficha. Data de publicação e validade atual indisponíveis.",
    historicalDocumentHelp: "Link preservado nesta leitura",
    historicalDocumentBoundary: "Links preservados nesta leitura. Não confirmam a versão vigente nem a data de revisão dos documentos.",
    resources: "Recursos disponíveis", certificate: "Ver certificado da leitura", certificateHelp: "Evidência digital; não certifica o produto físico.",
    technical: "Ficha técnica", safety: "Ficha de segurança", documentHelp: "Link publicado nesta ficha", external: "Site externo",
    notices: "Avisos do produto", noticesHelp: "Consultar o estado atual dos avisos do lote", empty: "Esta ficha não inclui recursos adicionais.",
  },
} as const;

export type PassportEvidenceLocale = keyof typeof passportEvidenceCopy;
type ResourceKind = "certificate" | "technical" | "safety" | "notices";

function boundedText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

/** Accept only the existing local certificate destination; never create access. */
function certificateLink(value: unknown, reference: string) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  if (!/^\/certificado\/[1-9]\d{0,18}\?/.test(value)) return null;
  try {
    const url = new URL(value, "https://nexid.example");
    if (url.origin !== "https://nexid.example" || !/^\/certificado\/[1-9]\d{0,18}$/.test(url.pathname) || url.hash) return null;
    if (url.pathname !== `/certificado/${reference}`) return null;
    const entries = [...url.searchParams.entries()];
    if (entries.length !== 1 || entries[0][0] !== "share" || !/^[A-Za-z0-9._-]{1,512}$/.test(entries[0][1])) return null;
    return value;
  } catch { return null; }
}

function documentLink(value: unknown) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if ([...url.searchParams.keys()].some(key => /^(uid|uid_hex|cmac|picc_data|enc|fresh|fresh_token|snapshot_access)$/i.test(key))) return null;
    return url.href;
  } catch { return null; }
}

function recordedTime(value: unknown, locale: PassportEvidenceLocale) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  if (new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return {
    iso: date.toISOString(),
    label: `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC", hourCycle: "h23" }).format(date).replace(/[\u00a0\u202f]/g, " ")} UTC`,
  };
}

export function passportEvidenceResourcesModel(input: PassportEvidenceResourcesProps, locale: PassportEvidenceLocale = "es-AR") {
  const copy = passportEvidenceCopy[locale];
  const mode = ["fresh", "historical", "qr", "demo"].includes(input.mode) ? input.mode : "unknown";
  const reading = mode !== "demo" && mode !== "qr";
  const carrier = evidenceCarrier(input.carrierCode || "", mode === "qr");
  const cryptographic = carrier === "secure_nfc" || carrier === "tagtamper";
  const reference = reading && typeof input.eventReference === "string" && /^[1-9]\d{0,18}$/.test(input.eventReference)
    && BigInt(input.eventReference) <= 9_223_372_036_854_775_807n ? input.eventReference : null;
  const resources: Array<{ kind: ResourceKind; href: string; label: string; detail: string; external: boolean }> = [];
  const certificate = reading && reference ? certificateLink(input.certificateHref, reference) : null;
  if (certificate) resources.push({ kind: "certificate", href: certificate, label: copy.certificate, detail: copy.certificateHelp, external: false });
  if (mode !== "demo") {
    for (const [kind, value] of [["technical", input.technicalSheetHref], ["safety", input.safetySheetHref]] as const) {
      const href = documentLink(value);
      if (href) resources.push({ kind, href, label: copy[kind], detail: `${mode === "historical" ? copy.historicalDocumentHelp : copy.documentHelp} · ${new URL(href).hostname}`, external: true });
    }
    if (input.showProductNotices === true) resources.push({ kind: "notices", href: "#product-notices", label: copy.notices, detail: copy.noticesHelp, external: false });
  }
  return {
    mode, reading, carrier, reference, recordedAt: reading ? recordedTime(input.occurredAt, locale) : null,
    title: copy[mode],
    explanation: reading && !cryptographic
      ? `${mode === "historical" ? `${copy.historicalHelp} ` : mode === "unknown" ? `${copy.unknownHelp} ` : ""}${copy.informationalHelp}`
      : copy[`${mode}Help`],
    statusLabel: reading ? cryptographic ? boundedText(input.statusLabel, 160) || copy.missingStatus : carrier === "unknown" ? copy.unknownCarrier : copy.informational : null,
    resources, hasDocuments: resources.some(resource => resource.kind === "technical" || resource.kind === "safety"),
    documentBoundary: mode === "historical" ? copy.historicalDocumentBoundary : copy.documentBoundary,
  };
}
