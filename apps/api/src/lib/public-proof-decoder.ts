import { findPublicProofDemoCaseById, findPublicProofDemoCaseByMerkleRoot } from "./public-proof-demos";

export type PublicProofDecodedField = {
  key: string;
  label: string;
  value: string;
  meaning: string;
};

export type PublicProofDecodeResult = {
  ok: boolean;
  receipt_matched?: boolean;
  receipt_verified?: boolean;
  verification_status?: "verified_demo_receipt" | "matched_demo_receipt" | "parsed_only";
  publication_tx_hash?: string | null;
  publication_explorer_url?: string | null;
  reason?: string;
  message?: string;
  input_format?: "hex_raw_input" | "plain_memo";
  raw_input_hex?: string;
  decoded_memo?: string;
  protocol?: string;
  fields?: Record<string, string>;
  field_explanations?: PublicProofDecodedField[];
  executive_summary?: string;
  business_meaning?: string;
  verification_steps?: string[];
  private_data_not_published?: string[];
  matching_demo_case?: {
    id: string;
    title: string;
    vertical: string;
    primary_event_hash: string;
    anchor_id: string;
    verify_path: string;
  } | null;
  warnings?: string[];
};

function cleanInput(value: unknown) {
  return String(value || "").trim();
}

function cleanEnv(value: unknown) {
  const text = cleanInput(value);
  if (!text || text === "\"\"" || text === "''") return "";
  return text.replace(/^['"]|['"]$/g, "").trim();
}

function envKeySuffix(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function demoReceiptTxFor(caseId: string) {
  return cleanEnv(process.env[`PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH_${envKeySuffix(caseId)}`])
    || cleanEnv(process.env.PUBLIC_PROOF_RECEIPT_IOTA_TX_HASH);
}

function receiptExplorerUrl(txHash: string) {
  if (!txHash) return null;
  const baseUrl = cleanEnv(process.env.IOTA_EXPLORER_BASE_URL) || "https://explorer.evm.testnet.iota.cafe";
  return `${baseUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

function isHexRawInput(value: string) {
  const normalized = value.trim();
  return /^0x[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0;
}

function textToHex(value: string) {
  return `0x${Buffer.from(value, "utf8").toString("hex")}`;
}

function hexToText(value: string) {
  const hex = value.replace(/^0x/i, "");
  return Buffer.from(hex, "hex").toString("utf8").replace(/\0/g, "").trim();
}

function slugToLabel(value: string) {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseMemoFields(memo: string) {
  const parts = memo.split("|").map((part) => part.trim()).filter(Boolean);
  const protocol = parts.shift() || "";
  const fields: Record<string, string> = {};
  for (const part of parts) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key && value) fields[key] = value;
  }
  return { protocol, fields };
}

function explainField(key: string, value: string): PublicProofDecodedField {
  if (key === "case") {
    return {
      key,
      label: "Caso de negocio",
      value,
      meaning: `Identifica el flujo que genero el recibo publico: ${slugToLabel(value)}.`,
    };
  }
  if (key === "vertical") {
    return {
      key,
      label: "Vertical",
      value,
      meaning: `Ubica la prueba en una industria o unidad de negocio: ${slugToLabel(value)}.`,
    };
  }
  if (key === "resource") {
    const [resourceType, resourceId] = value.split(":");
    return {
      key,
      label: "Recurso auditado",
      value,
      meaning: `Clase ${resourceType || "desconocida"} con referencia publica ${resourceId || "sin id publico"}. No revela UID/NFC secreto ni cliente final.`,
    };
  }
  if (key === "events") {
    return {
      key,
      label: "Eventos incluidos",
      value,
      meaning: `Cantidad de hitos de negocio incluidos en el Merkle root: ${value}.`,
    };
  }
  if (key === "root") {
    return {
      key,
      label: "Merkle root",
      value,
      meaning: "Huella criptografica que resume los hashes de eventos. Si un hash cambia, este root deja de coincidir.",
    };
  }
  if (key === "privacy") {
    return {
      key,
      label: "Politica de privacidad",
      value,
      meaning: value === "hash-only"
        ? "Solo se publica evidencia minima. Los datos sensibles quedan dentro de nexID."
        : "Define que parte de la evidencia es publica y que parte queda privada.",
    };
  }
  return {
    key,
    label: slugToLabel(key),
    value,
    meaning: "Campo publico del recibo. Su interpretacion depende de la politica del tenant.",
  };
}

function businessMeaning(fields: Record<string, string>) {
  const vertical = fields.vertical || "";
  if (vertical.includes("pharma")) {
    return "Lectura de negocio: prueba que un lote regulado tuvo hitos de calidad incluidos en una evidencia publica, sin exponer pacientes, rutas internas ni documentos QA.";
  }
  if (vertical.includes("agro")) {
    return "Lectura de negocio: prueba stewardship, origen/canal autorizado y uso responsable de un insumo, sin exponer clientes, ubicaciones sensibles ni acuerdos comerciales.";
  }
  if (vertical.includes("logistica") || vertical.includes("delivery")) {
    return "Lectura de negocio: prueba custodia y entrega verificable de un activo fisico, sin publicar manifiesto, receptor ni direccion privada.";
  }
  return "Lectura de negocio: prueba que un conjunto de eventos existia y fue anclado sin convertir la blockchain en una base de datos publica.";
}

export function decodePublicProofInput(input: unknown): PublicProofDecodeResult {
  const cleaned = cleanInput(input);
  if (!cleaned) {
    return { ok: false, reason: "input_required", message: "Paste Raw input hex or a nexID proof memo." };
  }

  let decodedMemo = cleaned;
  let inputFormat: PublicProofDecodeResult["input_format"] = "plain_memo";
  let rawInputHex = textToHex(cleaned);
  const warnings: string[] = [];

  if (cleaned.startsWith("0x")) {
    if (!isHexRawInput(cleaned)) {
      return { ok: false, reason: "raw_input_invalid", message: "Raw input must be 0x-prefixed hex with an even number of characters." };
    }
    inputFormat = "hex_raw_input";
    rawInputHex = cleaned.toLowerCase();
    decodedMemo = hexToText(cleaned);
  }

  if (!decodedMemo.startsWith("nexID-proof-v1")) {
    return {
      ok: false,
      reason: "unsupported_memo_format",
      message: "This decoder currently supports nexID public proof memos. If the explorer shows a contract method call, paste the receipt memo transaction Raw input.",
      input_format: inputFormat,
      raw_input_hex: rawInputHex,
      decoded_memo: decodedMemo,
    };
  }

  const { protocol, fields } = parseMemoFields(decodedMemo);
  const requiredFields = ["case", "resource", "events", "root", "privacy"];
  const missing = requiredFields.filter((field) => !fields[field]);
  if (missing.length) {
    warnings.push(`missing_fields:${missing.join(",")}`);
  }
  if (fields.root && !/^sha256:[0-9a-f]{64}$/i.test(fields.root)) {
    warnings.push("root_is_not_sha256");
  }
  if (fields.privacy && fields.privacy !== "hash-only") {
    warnings.push("privacy_policy_requires_review");
  }

  const demoCandidate = (fields.case ? findPublicProofDemoCaseById(fields.case) : null)
    || (fields.root ? findPublicProofDemoCaseByMerkleRoot(fields.root) : null);
  const demoCase = demoCandidate?.public_receipt.on_chain_memo === decodedMemo ? demoCandidate : null;
  const publicationTxHash = demoCase ? demoReceiptTxFor(demoCase.id) : "";
  const receiptVerified = Boolean(demoCase && publicationTxHash);
  if (demoCandidate && !demoCase) {
    warnings.push("demo_receipt_mismatch");
  }
  if (demoCase && !receiptVerified) warnings.push("receipt_publication_unavailable");
  if (!receiptVerified) warnings.push("receipt_not_verified");
  const resource = fields.resource || "recurso no informado";
  const events = fields.events || "eventos no informados";
  const executiveSummary = receiptVerified
    ? `${demoCase?.title}: el memo coincide exactamente y tiene una transaccion publica configurada para ${events} eventos sobre ${resource}.`
    : demoCase
      ? `${demoCase.title}: el memo coincide con el recibo esperado, pero falta una transaccion publica configurada para confirmar su publicacion.`
      : `Memo parseado: declara ${events} eventos sobre ${resource}, pero el texto por si solo no confirma que haya sido publicado on-chain.`;

  return {
    ok: true,
    receipt_matched: Boolean(demoCase),
    receipt_verified: receiptVerified,
    verification_status: receiptVerified ? "verified_demo_receipt" : demoCase ? "matched_demo_receipt" : "parsed_only",
    publication_tx_hash: publicationTxHash || null,
    publication_explorer_url: receiptExplorerUrl(publicationTxHash),
    input_format: inputFormat,
    raw_input_hex: rawInputHex,
    decoded_memo: decodedMemo,
    protocol,
    fields,
    field_explanations: Object.entries(fields).map(([key, value]) => explainField(key, value)),
    executive_summary: executiveSummary,
    business_meaning: receiptVerified
      ? businessMeaning(fields)
      : "Lectura del contenido declarado. Para convertirlo en evidencia hay que comprobar la transaccion, el Raw input y la inclusion del SHA.",
    verification_steps: [
      "Abrir la transaccion en el explorer y copiar Raw input.",
      "Pegar Raw input en el decoder de nexID.",
      "Comparar el memo decodificado, el Merkle root y la politica hash-only.",
      "Verificar el hash del evento en Proof Verify si se quiere comprobar inclusion exacta.",
    ],
    private_data_not_published: demoCase?.public_receipt.private_fields || [
      "UID/NFC secret material",
      "customer or patient identity",
      "route manifest",
      "internal QA documents",
      "commercial contract data",
    ],
    matching_demo_case: demoCase ? {
      id: demoCase.id,
      title: demoCase.title,
      vertical: demoCase.vertical,
      primary_event_hash: demoCase.primary_event_hash,
      anchor_id: demoCase.anchor_id,
      verify_path: `/proof/verify?event_hash=${encodeURIComponent(demoCase.primary_event_hash)}&anchor_id=${encodeURIComponent(demoCase.anchor_id)}`,
    } : null,
    warnings,
  };
}
