import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileSearch,
  Layers,
  LockKeyhole,
  Network,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@product/ui";
import { productUrls } from "@product/config";
import { BackLink } from "../../../components/back-link";
import { ProofFocusTarget } from "./proof-focus-target";

type VerifyMatch = {
  anchor_id: string;
  provider: string;
  network: string;
  merkle_root: string;
  tx_hash: string | null;
  explorer_url: string | null;
  status: string;
  anchored_at: string | null;
};

type DemoEvent = {
  id: string;
  title: string;
  event_type: string;
  hash: string;
  summary: string;
};

type DemoCase = {
  id: string;
  title: string;
  vertical: string;
  headline: string;
  body: string;
  primary_event_hash: string;
  anchor_id: string;
  provider: string;
  network: string;
  status: string;
  merkle_root: string;
  resource_type: string;
  resource_id: string;
  anchored_at: string;
  explorer_url: string | null;
  tx_hash: string | null;
  network_verification?: {
    anchor?: { verified?: boolean; checked?: boolean; confirmations?: number | null; reason?: string | null } | null;
    receipt?: { verified?: boolean; checked?: boolean; confirmations?: number | null; memo_matches?: boolean; reason?: string | null } | null;
  };
  public_receipt: {
    title: string;
    business_claim: string;
    manager_explanation: string;
    on_chain_memo: string;
    receipt_hash: string;
    tx_hash: string | null;
    explorer_url: string | null;
    status?: string;
    public_fields: string[];
    private_fields: string[];
  };
  events: DemoEvent[];
  proof_layers: Array<{
    layer: string;
    purpose: string;
    status: string;
  }>;
};

type VerifyResponse = {
  ok: boolean;
  valid?: boolean;
  included?: boolean;
  externally_confirmed?: boolean;
  verification_state?: "confirmed" | "submitted" | "local" | "failed" | "not_included" | "unavailable" | "invalid";
  evidence_level?: "testnet_rpc" | "testnet_fixture" | "external_anchor" | "registry_only" | "none";
  demo?: boolean;
  event_hash?: string;
  provider?: string | null;
  network?: string | null;
  merkle_root?: string | null;
  tx_hash?: string | null;
  explorer_url?: string | null;
  matches?: VerifyMatch[];
  demo_case?: DemoCase | null;
  network_verification?: {
    anchor?: { verified?: boolean; checked?: boolean; confirmations?: number | null; reason?: string | null } | null;
    receipt?: { verified?: boolean; checked?: boolean; confirmations?: number | null; memo_matches?: boolean; reason?: string | null } | null;
  } | null;
  reason?: string;
  registry_warning?: string | null;
  privacy?: string;
};

type DemoCasesResponse = {
  ok: boolean;
  cases?: DemoCase[];
  testnet?: {
    iota?: {
      mode?: string;
      network?: string;
      rpc_configured?: boolean;
      contract_configured?: boolean;
      signer_configured?: boolean;
      deployer_address?: string | null;
      contract_address?: string | null;
      contract_explorer_url?: string | null;
      demo_tx_hash?: string | null;
      demo_tx_explorer_url?: string | null;
      demo_txs?: Record<string, {
        tx_hash?: string | null;
        explorer_url?: string | null;
        receipt_tx_hash?: string | null;
        receipt_explorer_url?: string | null;
      }>;
      rpc_verified?: boolean;
      verified_anchor_count?: number;
      verified_receipt_count?: number;
    };
    polygon?: {
      network?: string;
      rpc_configured?: boolean;
      contract_configured?: boolean;
      signer_configured?: boolean;
      rpc_verified?: boolean;
      verification_state?: string | null;
      evidence_level?: string | null;
      verified_at?: string | null;
      contract_address?: string | null;
      owner_address?: string | null;
      owner_custody?: string | null;
      wallet_control_verified?: boolean;
      claim_state?: string | null;
      contract_explorer_url?: string | null;
      owner_explorer_url?: string | null;
      demo_tx_hash?: string | null;
      demo_tx_explorer_url?: string | null;
      demo_token_id?: string | null;
      metadata_url?: string | null;
      metadata_verified?: boolean;
      mint_events_match?: boolean;
      source_verified?: boolean;
      ownership_certificate_url?: string | null;
      certificate_url?: string | null;
    };
  };
};

type DecodedProofField = {
  key: string;
  label: string;
  value: string;
  meaning: string;
};

type DecodeResponse = {
  ok: boolean;
  receipt_matched?: boolean;
  receipt_verified?: boolean;
  publication_configured?: boolean;
  verification_status?: "verified_demo_receipt" | "matched_demo_receipt" | "parsed_only";
  publication_tx_hash?: string | null;
  publication_explorer_url?: string | null;
  network_verification?: { verified?: boolean; checked?: boolean; confirmations?: number | null; memo_matches?: boolean; reason?: string | null } | null;
  reason?: string;
  message?: string;
  input_format?: "hex_raw_input" | "plain_memo";
  raw_input_hex?: string;
  decoded_memo?: string;
  protocol?: string;
  fields?: Record<string, string>;
  field_explanations?: DecodedProofField[];
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

export const metadata: Metadata = {
  title: "Proof Verifier | nexID",
  description: "Verificador publico hash-only para anchors, Merkle roots y evidencia DPP, QA y logistica en nexID.",
};

const ENTERPRISE_PROOF_CONSOLE_URL = `${productUrls.app}/proof`;
const DEMO_LAB_PROOF_HANDOFF_SCENARIOS: ReadonlySet<string> = new Set([
  "hub",
  "qr-gs1",
  "nfc-424",
  "offline-verifier",
  "polygon-ownership",
  "iota-proof",
  "dual-proof",
  "sensor-evidence",
  "authorized-network",
]);

type ProofHandoffContext = {
  scenario: string;
  returnTo: string;
};

const proofFlow = [
  {
    label: "1. Evento",
    title: "nexID registra el hecho",
    body: "Puede ser un tap valido, QA de lote, entrega, custodia, DPP o reporte logistico.",
  },
  {
    label: "2. Hash",
    title: "Se calcula evidencia minima",
    body: "El sistema genera un sha256 del evento canonico. No publica UIDs, clientes, rutas privadas ni keys.",
  },
  {
    label: "3. Anchor",
    title: "Se agrupa en un Merkle root",
    body: "Varios hashes se consolidan en un root auditable local o externo, segun politica del tenant.",
  },
  {
    label: "4. Recibo publico",
    title: "Se publica un memo entendible",
    body: "IOTA puede guardar un texto publico minimo: caso, recurso, eventos, root y privacy=hash-only.",
  },
  {
    label: "5. Verificacion",
    title: "El tercero comprueba inclusion",
    body: "Con el hash, un auditor o cliente confirma si esa evidencia esta incluida sin ver el dato privado.",
  },
];

const connectionCards = [
  {
    title: "Demo Lab",
    body: "Muestra el recorrido comercial: producto, custodia, DPP, riesgo y proof. Es la demo para explicar el concepto.",
    href: "/demo-lab?scenario=iota-proof",
    cta: "Abrir demo IOTA",
  },
  {
    title: "SDK & API",
    body: "El cliente integra taps, POS, ERP, sensores o app mobile. La API puede crear eventos y consultar proofs por hash.",
    href: "/sdk",
    cta: "Ver SDK",
  },
  {
    title: "Consola privada enterprise",
    body: "Operaciones gestiona anchors, estados y evidencia autorizada sin exponer datos sensibles en la vista publica.",
    href: ENTERPRISE_PROOF_CONSOLE_URL,
    cta: "Abrir consola de Proof",
    external: true,
  },
  {
    title: "IOTA / Polygon",
    body: "IOTA sirve como proof/auditoria opcional. Polygon queda separado para ownership, certificados y warranty transfer.",
    href: "/proof/ownership",
    cta: "Abrir certificado Polygon",
  },
];

const businessProofPoints = [
  {
    title: "Cliente o auditor",
    body: "Pega un SHA o Raw input y ve si la evidencia existia, sin acceder al dato privado.",
  },
  {
    title: "Empresa",
    body: "Muestra integridad externa para QA, DPP, custodia o reclamos sin publicar UIDs ni rutas.",
  },
  {
    title: "Inversor o C-level",
    body: "Entiende en una pantalla que IOTA prueba evidencia y Polygon prueba ownership separado.",
  },
];

const FALLBACK_PUBLIC_PROOF_DEMO_CASES: DemoCase[] = [
  {
    id: "secure-delivery",
    title: "Secure Delivery",
    vertical: "logistica-premium",
    headline: "Entrega fisica con sello, custodia y receptor verificable.",
    body: "Caso de logistica premium: sello aplicado, transferencia de custodia y recepcion se prueban sin publicar manifiesto, cliente ni direccion.",
    primary_event_hash: "sha256:fd056fe8caf73243fec9c83075f2a693311cbcb5af81264c6ad0bf4388d2089d",
    anchor_id: "11111111-1111-4111-8111-111111111111",
    provider: "iota",
    network: "iota-evm-testnet-ready",
    status: "demo_ready",
    merkle_root: "sha256:f27117194b62885a39abda2e5dcb1dc70b3d31eb887acc56b7ba1439be674917",
    resource_type: "secure_delivery_pack",
    resource_id: "SDL-AR-2026-0007",
    anchored_at: "2026-07-02T22:59:35-03:00",
    explorer_url: null,
    tx_hash: null,
    public_receipt: {
      title: "Secure Delivery public proof receipt",
      business_claim: "Demuestra custodia y entrega verificable para un activo fisico sin exponer manifiesto ni destinatario.",
      manager_explanation: "Para ventas y compliance: el tercero comprueba que los hitos existian y que el recibo publico usa privacy=hash-only.",
      on_chain_memo: "nexID-proof-v1|case=secure-delivery|vertical=logistica-premium|resource=secure_delivery_pack:SDL-AR-2026-0007|events=3|root=sha256:f27117194b62885a39abda2e5dcb1dc70b3d31eb887acc56b7ba1439be674917|privacy=hash-only",
      receipt_hash: "sha256:5f3d043787078d92611be1219039ca859afa08a413d3a3ac0f15e3007f38ad16",
      tx_hash: null,
      explorer_url: null,
      public_fields: ["case", "vertical", "resource class", "event count", "Merkle root", "privacy policy"],
      private_fields: ["UID/NFC secret material", "recipient identity", "route manifest", "delivery address", "commercial contract data"],
    },
    events: [
      {
        id: "seal_applied",
        title: "Sello aplicado",
        event_type: "SEAL_APPLIED",
        hash: "sha256:fd056fe8caf73243fec9c83075f2a693311cbcb5af81264c6ad0bf4388d2089d",
        summary: "El paquete queda asociado a un sello NFC/QR autorizado antes de salir.",
      },
      {
        id: "custody_transfer",
        title: "Custodia transferida",
        event_type: "CUSTODY_TRANSFER",
        hash: "sha256:a1981863bbd87e9e7f0871f048437a982a6efa4ffc3551904184ebd3dd6bb1ec",
        summary: "El cambio de responsable queda registrado como hito verificable.",
      },
      {
        id: "recipient_verified",
        title: "Receptor verificado",
        event_type: "RECIPIENT_VERIFIED",
        hash: "sha256:c46e3a8c5fce125d4b52f084c1f761fe1f93b3bf93d4176386003144f3ae94bf",
        summary: "La entrega se cierra sin publicar identidad privada del receptor.",
      },
    ],
    proof_layers: [
      { layer: "nexID", purpose: "Eventos, policies y datos privados permanecen en el tenant.", status: "activo" },
      { layer: "IOTA", purpose: "Public proof hash-only para auditoria externa.", status: "testnet-ready" },
      { layer: "Polygon", purpose: "Certificado o ownership opcional si el activo lo requiere.", status: "opcional" },
    ],
  },
  {
    id: "pharma-cold-chain",
    title: "Pharma Cold Chain",
    vertical: "pharma-regulado",
    headline: "Lote regulado con QA, cadena de frio y revision de tamper.",
    body: "Caso pharma: un lote puede mostrar evidencia publica de QA y frio sin revelar pacientes, rutas internas ni documentos de calidad.",
    primary_event_hash: "sha256:46da892d32fdb4cca3fbf47fcb1a635a8ebd5580d47c023152af770ac9be7eb5",
    anchor_id: "22222222-2222-4222-8222-222222222222",
    provider: "iota",
    network: "iota-evm-testnet-ready",
    status: "demo_ready",
    merkle_root: "sha256:1e22212d42fc7a553cd08c8e7e8f4fcf5b76b74e461dcf967ed934c230b016c7",
    resource_type: "pharma_batch",
    resource_id: "PHR-LOT-2026-0142",
    anchored_at: "2026-07-02T22:59:35-03:00",
    explorer_url: null,
    tx_hash: null,
    public_receipt: {
      title: "Pharma Cold Chain public proof receipt",
      business_claim: "Demuestra QA, frio y tamper review para un lote regulado sin publicar datos clinicos ni documentos internos.",
      manager_explanation: "Para un comprador enterprise: el hash prueba integridad externa; nexID conserva los datos sensibles y el expediente completo.",
      on_chain_memo: "nexID-proof-v1|case=pharma-cold-chain|vertical=pharma-regulado|resource=pharma_batch:PHR-LOT-2026-0142|events=3|root=sha256:1e22212d42fc7a553cd08c8e7e8f4fcf5b76b74e461dcf967ed934c230b016c7|privacy=hash-only",
      receipt_hash: "sha256:a866ca593d0e90ea805203730a86c63a1eddd5290d67a4989451f717c38cee03",
      tx_hash: null,
      explorer_url: null,
      public_fields: ["case", "vertical", "batch class", "event count", "Merkle root", "privacy policy"],
      private_fields: ["patient identity", "internal QA documents", "route manifest", "temperature raw stream", "commercial contract data"],
    },
    events: [
      {
        id: "qa_batch_release",
        title: "QA de lote liberado",
        event_type: "QA_BATCH_RELEASE",
        hash: "sha256:46da892d32fdb4cca3fbf47fcb1a635a8ebd5580d47c023152af770ac9be7eb5",
        summary: "El lote queda habilitado por calidad sin publicar el expediente interno.",
      },
      {
        id: "cold_chain_checkpoint",
        title: "Checkpoint de frio",
        event_type: "COLD_CHAIN_CHECKPOINT",
        hash: "sha256:1e3e1a4f15024a7f029c474e7848208c954b467e6989071864fe1504eb9e100d",
        summary: "La cadena de frio queda incluida como hito de evidencia.",
      },
      {
        id: "tamper_review",
        title: "Revision tamper",
        event_type: "TAMPER_REVIEW",
        hash: "sha256:92fdd6fc4a58cbd646c1f54ada796b6c052079d9a32c2a854a3afa2a4b1d2a89",
        summary: "El estado de apertura o integridad queda auditado sin exponer datos operativos.",
      },
    ],
    proof_layers: [
      { layer: "nexID", purpose: "Conserva lote, QA, permisos y documentacion sensible.", status: "activo" },
      { layer: "IOTA", purpose: "Public proof hash-only para auditoria de calidad.", status: "testnet-ready" },
      { layer: "Polygon", purpose: "Certificado transferible opcional para garantia o ownership.", status: "opcional" },
    ],
  },
  {
    id: "agro-stewardship",
    title: "Agro Stewardship",
    vertical: "agro-quimico",
    headline: "Origen, canal autorizado, escaneo de campo y politica de reclamo.",
    body: "Ejemplo agro enterprise: lote, canal, stewardship y reclamo se entienden sin nombrar clientes ni publicar datos operativos sensibles.",
    primary_event_hash: "sha256:0ea0478b694f01a5a76eda955a78c74701786b3d13ac241e6f6cfc3363938320",
    anchor_id: "33333333-3333-4333-8333-333333333333",
    provider: "iota",
    network: "iota-evm-testnet-ready",
    status: "demo_ready",
    merkle_root: "sha256:5387aaf504ca3b0a6cab83a3af0bfa158f36b04ab2a3558c94907337fc7c7369",
    resource_type: "agro_input_batch",
    resource_id: "AGR-STW-2026-0031",
    anchored_at: "2026-07-02T22:59:35-03:00",
    explorer_url: null,
    tx_hash: null,
    public_receipt: {
      title: "Agro Stewardship public proof receipt",
      business_claim: "Demuestra origen, canal autorizado, escaneo de campo y politica de reclamo para un insumo agricola.",
      manager_explanation: "Para canal y compliance: prueba stewardship y trazabilidad de uso responsable sin exponer clientes, lotes comerciales reales ni ubicaciones sensibles.",
      on_chain_memo: "nexID-proof-v1|case=agro-stewardship|vertical=agro-quimico|resource=agro_input_batch:AGR-STW-2026-0031|events=3|root=sha256:5387aaf504ca3b0a6cab83a3af0bfa158f36b04ab2a3558c94907337fc7c7369|privacy=hash-only",
      receipt_hash: "sha256:5395e58f92df05c6b36f48c67833fed53f12fe60870978b2665c73c5e29d2129",
      tx_hash: null,
      explorer_url: null,
      public_fields: ["case", "vertical", "resource class", "event count", "Merkle root", "privacy policy"],
      private_fields: ["customer identity", "field coordinates", "commercial route", "internal claim notes", "channel contract data"],
    },
    events: [
      {
        id: "origin_attested",
        title: "Origen atestado",
        event_type: "ORIGIN_ATTESTED",
        hash: "sha256:0ea0478b694f01a5a76eda955a78c74701786b3d13ac241e6f6cfc3363938320",
        summary: "El lote se emite con canal y politica de uso responsable.",
      },
      {
        id: "field_scan",
        title: "Escaneo de campo",
        event_type: "FIELD_SCAN",
        hash: "sha256:72ed2d884d008e430617c7a1ed43b63b6f10cfcee3490e9468b91b0192a6954f",
        summary: "El verificador offline valida producto en zona de baja conectividad.",
      },
      {
        id: "claim_policy_opened",
        title: "Reclamo habilitado",
        event_type: "CLAIM_POLICY_OPENED",
        hash: "sha256:bca3f082a5839daf37249285a92c92fa297d640bbd8fe48a239ab6a284214310",
        summary: "Si hay tamper o canal invalido, queda abierto el camino de reclamo.",
      },
    ],
    proof_layers: [
      { layer: "nexID", purpose: "Reglas de canal, UID, lote y datos sensibles quedan privados.", status: "activo" },
      { layer: "IOTA", purpose: "Public proof hash-only para stewardship y auditoria.", status: "testnet-ready" },
      { layer: "Polygon", purpose: "Certificado o claim transferible opcional.", status: "opcional" },
    ],
  },
];

const FALLBACK_PUBLIC_PROOF_DEMO_RESPONSE: DemoCasesResponse = {
  ok: false,
  cases: FALLBACK_PUBLIC_PROOF_DEMO_CASES,
  testnet: {
    iota: {
      mode: "fallback",
      network: "iota-evm-testnet-ready",
      rpc_configured: false,
      contract_configured: false,
      signer_configured: false,
      deployer_address: null,
      contract_address: null,
      contract_explorer_url: null,
      demo_tx_hash: null,
      demo_tx_explorer_url: null,
      demo_txs: {},
    },
    polygon: {
      network: "amoy",
      rpc_configured: false,
      contract_configured: false,
      signer_configured: false,
      contract_address: null,
      owner_address: null,
      contract_explorer_url: null,
      owner_explorer_url: null,
      demo_tx_hash: null,
      demo_tx_explorer_url: null,
    },
  },
};

const PROOF_API_FALLBACK_URL = "https://api.nexid.lat";
const PUBLIC_PROOF_FETCH_TIMEOUT_MS = 6_000;

function proofApiBases() {
  const configuredApiUrl = String(productUrls.api || "").replace(/\/$/, "").trim();
  return [configuredApiUrl || PROOF_API_FALLBACK_URL];
}

async function fetchProofApiJson<T>(path: string): Promise<{ data: T | null; ok: boolean; status: number } | null> {
  let lastResult: { data: T | null; ok: boolean; status: number } | null = null;

  for (const baseUrl of proofApiBases()) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(PUBLIC_PROOF_FETCH_TIMEOUT_MS),
      });
      const data = await response.json().catch(() => null) as T | null;
      const result = { data, ok: response.ok, status: response.status };
      if (data && response.ok) return result;
      lastResult = result;
    } catch {
      lastResult = { data: null, ok: false, status: 0 };
    }
  }

  return lastResult;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function resolveProofHandoff(
  params: Record<string, string | string[] | undefined>,
  requestedLayer: string,
): ProofHandoffContext {
  const requestedScenario = first(params.scenario).trim().toLowerCase();
  const layerScenario = requestedLayer === "polygon"
    ? "polygon-ownership"
    : requestedLayer === "iota"
      ? "iota-proof"
      : "hub";
  const scenario = DEMO_LAB_PROOF_HANDOFF_SCENARIOS.has(requestedScenario)
    ? requestedScenario
    : layerScenario;
  const expectedReturnTo = scenario === "hub"
    ? "/demo-lab"
    : `/demo-lab?scenario=${encodeURIComponent(scenario)}`;
  const requestedReturnTo = first(params.return_to).trim();

  return {
    scenario,
    returnTo: requestedReturnTo === expectedReturnTo
      ? requestedReturnTo
      : expectedReturnTo,
  };
}

function appendProofHandoff(query: URLSearchParams, handoff?: ProofHandoffContext) {
  if (!handoff) return query;
  query.set("scenario", handoff.scenario);
  query.set("return_to", handoff.returnTo);
  return query;
}

function proofPageHref(query: URLSearchParams, target?: string) {
  const search = query.toString();
  return `/proof/verify${search ? `?${search}` : ""}${target ? `#${target}` : ""}`;
}

function shortHash(value: string | null | undefined) {
  const text = String(value || "");
  if (text.length <= 24) return text || "-";
  return `${text.slice(0, 18)}...${text.slice(-10)}`;
}

function utf8ToHex(value: string | null | undefined) {
  const text = String(value || "");
  if (!text) return "-";
  const bytes = new TextEncoder().encode(text);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function isHexRawInput(value: string) {
  const normalized = value.trim();
  return /^0x[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0;
}

function hexToUtf8(value: string) {
  const hex = value.replace(/^0x/i, "");
  const bytes = hex.match(/.{1,2}/g)?.map((pair) => Number.parseInt(pair, 16)) || [];
  if (bytes.some((byte) => Number.isNaN(byte))) return "";
  return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\0/g, "").trim();
}

function slugToLabel(value: string) {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseProofMemoFields(memo: string) {
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

function findFallbackDemoCase(fields: Record<string, string>) {
  return FALLBACK_PUBLIC_PROOF_DEMO_CASES.find((demoCase) => demoCase.id === fields.case)
    || FALLBACK_PUBLIC_PROOF_DEMO_CASES.find((demoCase) => demoCase.merkle_root === fields.root)
    || null;
}

function explainProofMemoField(key: string, value: string): DecodedProofField {
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

function decodeProofInputLocally(input: string): DecodeResponse {
  const cleaned = String(input || "").trim();
  if (!cleaned) {
    return { ok: false, reason: "input_required", message: "Pegue Raw input hex o un memo nexID-proof-v1." };
  }

  let decodedMemo = cleaned;
  let inputFormat: DecodeResponse["input_format"] = "plain_memo";
  let rawInputHex = utf8ToHex(cleaned);
  const warnings: string[] = [];

  if (cleaned.startsWith("0x")) {
    if (!isHexRawInput(cleaned)) {
      return { ok: false, reason: "raw_input_invalid", message: "Raw input debe ser hex 0x con cantidad par de caracteres." };
    }
    inputFormat = "hex_raw_input";
    rawInputHex = cleaned.toLowerCase();
    decodedMemo = hexToUtf8(cleaned);
  }

  if (!decodedMemo.startsWith("nexID-proof-v1")) {
    return {
      ok: false,
      reason: "unsupported_memo_format",
      message: "Este decoder soporta memos publicos nexID-proof-v1. Si el explorer muestra un contract call, pegue el Raw input de la transaccion memo.",
      input_format: inputFormat,
      raw_input_hex: rawInputHex,
      decoded_memo: decodedMemo,
    };
  }

  const { protocol, fields } = parseProofMemoFields(decodedMemo);
  const missing = ["case", "resource", "events", "root", "privacy"].filter((field) => !fields[field]);
  if (missing.length) warnings.push(`missing_fields:${missing.join(",")}`);
  if (fields.root && !/^sha256:[0-9a-f]{64}$/i.test(fields.root)) warnings.push("root_is_not_sha256");
  if (fields.privacy && fields.privacy !== "hash-only") warnings.push("privacy_policy_requires_review");

  const demoCandidate = findFallbackDemoCase(fields);
  const demoCase = demoCandidate?.public_receipt.on_chain_memo === decodedMemo ? demoCandidate : null;
  const publicationConfigured = Boolean(demoCase?.public_receipt.tx_hash && demoCase.public_receipt.explorer_url);
  const receiptVerified = false;
  if (demoCandidate && !demoCase) warnings.push("demo_receipt_mismatch");
  if (demoCase && !publicationConfigured) warnings.push("receipt_publication_unavailable");
  if (demoCase && publicationConfigured) warnings.push("receipt_network_check_required");
  warnings.push("receipt_not_verified");
  const resource = fields.resource || "recurso no informado";
  const events = fields.events || "eventos no informados";

  return {
    ok: true,
    receipt_matched: Boolean(demoCase),
    receipt_verified: receiptVerified,
    publication_configured: publicationConfigured,
    verification_status: demoCase ? "matched_demo_receipt" : "parsed_only",
    publication_tx_hash: demoCase?.public_receipt.tx_hash || null,
    publication_explorer_url: demoCase?.public_receipt.explorer_url || null,
    input_format: inputFormat,
    raw_input_hex: rawInputHex,
    decoded_memo: decodedMemo,
    protocol,
    fields,
    field_explanations: Object.entries(fields).map(([key, value]) => explainProofMemoField(key, value)),
    executive_summary: demoCase
      ? publicationConfigured
        ? `${demoCase.title}: el memo coincide y la transaccion esta configurada, pero la API no esta disponible para verificar receipt y Raw input por RPC.`
        : `${demoCase.title}: el memo coincide con el recibo esperado, pero falta una transaccion publica configurada para confirmar su publicacion.`
        : `Memo parseado: declara ${events} eventos sobre ${resource}, pero el texto por si solo no confirma que haya sido publicado on-chain.`,
    business_meaning: "Lectura del contenido declarado. Para convertirlo en evidencia hay que comprobar la transaccion, el Raw input y la inclusion del SHA.",
    verification_steps: [
      "Abrir la transaccion en el explorer y copiar Raw input.",
      "Pegar Raw input en el decoder de nexID.",
      "Comparar memo decodificado, Merkle root y politica hash-only.",
      "Verificar el hash del evento en Proof Verify para comprobar inclusion exacta.",
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
      verify_path: verifyHrefForDemo(demoCase),
    } : null,
    warnings,
  };
}

function explorerLink(url: string | null | undefined, label: string) {
  if (!url) return null;
  return (
    <a href={url} className="proof-explorer-link inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.1em]" target="_blank" rel="noreferrer">
      {label} <ArrowRight className="h-3.5 w-3.5" />
    </a>
  );
}

function verifyHrefForIdentity(
  eventHash: string,
  anchorId: string,
  handoff?: ProofHandoffContext,
) {
  const params = appendProofHandoff(new URLSearchParams({
    event_hash: eventHash,
    anchor_id: anchorId,
  }), handoff);
  return proofPageHref(params, "proof-result");
}

function verifyHrefForDemo(demoCase: DemoCase, handoff?: ProofHandoffContext) {
  return verifyHrefForIdentity(
    demoCase.primary_event_hash,
    demoCase.anchor_id,
    handoff,
  );
}

function decoderHrefForDemo(demoCase: DemoCase, handoff?: ProofHandoffContext) {
  const params = appendProofHandoff(new URLSearchParams({
    event_hash: demoCase.primary_event_hash,
    anchor_id: demoCase.anchor_id,
    decode_input: utf8ToHex(demoCase.public_receipt.on_chain_memo),
  }), handoff);
  return proofPageHref(params, "proof-decoder");
}

function proofLayerHref(layer: "iota" | "polygon", target: string, handoff: ProofHandoffContext) {
  const params = appendProofHandoff(new URLSearchParams({ layer }), handoff);
  return proofPageHref(params, target);
}

function statusTone(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "confirmed") return "border-emerald-300/50 bg-emerald-50 text-emerald-800";
  if (["submitted", "demo_ready"].includes(normalized)) return "border-cyan-300/60 bg-cyan-50 text-cyan-800";
  if (normalized === "local") return "border-amber-300/60 bg-amber-50 text-amber-800";
  if (["failed"].includes(normalized)) return "border-rose-300/60 bg-rose-50 text-rose-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function decoderWarningLabel(warning: string) {
  if (warning === "receipt_not_verified") return "El memo se pudo leer, pero su publicacion on-chain no fue verificada por este decoder.";
  if (warning === "receipt_publication_unavailable") return "El memo coincide con un recibo demo conocido, pero falta la tx publica para confirmar que fue publicado.";
  if (warning === "demo_receipt_mismatch") return "El caso o Merkle root se parece a un demo conocido, pero el memo no coincide exactamente con el recibo publicado.";
  if (warning === "root_is_not_sha256") return "El Merkle root no tiene formato sha256 valido.";
  if (warning === "privacy_policy_requires_review") return "La politica declarada no es hash-only y requiere revision.";
  if (warning.startsWith("missing_fields:")) return `Faltan campos obligatorios: ${warning.slice("missing_fields:".length)}.`;
  return warning;
}

async function verifyProof(eventHash: string, anchorId: string): Promise<VerifyResponse | null> {
  if (!eventHash) return null;
  const params = new URLSearchParams({ event_hash: eventHash });
  if (anchorId) params.set("anchor_id", anchorId);
  const response = await fetchProofApiJson<VerifyResponse>(`/public/proof/verify?${params.toString()}`);
  if (!response) {
    return { ok: false, reason: "proof_verifier_unavailable" };
  }
  if (!response.data) return { ok: false, reason: response.status ? `proof_verifier_http_${response.status}` : "proof_verifier_unavailable" };
  if (!response.ok && !response.data.reason) return { ...response.data, ok: false, reason: `proof_verifier_http_${response.status}` };
  return response.data;
}

async function loadDemoCases(): Promise<DemoCasesResponse> {
  const response = await fetchProofApiJson<DemoCasesResponse>("/public/proof/demo-cases");
  if (!response?.data || !response.ok || !response.data.cases?.length) return FALLBACK_PUBLIC_PROOF_DEMO_RESPONSE;
  return response.data;
}

async function decodeProofInput(input: string): Promise<DecodeResponse | null> {
  if (!input) return null;
  const params = new URLSearchParams({ input });
  const response = await fetchProofApiJson<DecodeResponse>(`/public/proof/decode?${params.toString()}`);
  if (!response) {
    return decodeProofInputLocally(input);
  }
  if (!response.data) return decodeProofInputLocally(input);
  if (!response.ok && response.data.ok === false) {
    const localResult = decodeProofInputLocally(input);
    return localResult.ok ? localResult : response.data;
  }
  return response.data;
}

export default async function ProofVerifierPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const eventHash = first(params.event_hash || params.eventHash || params.hash).trim();
  const anchorId = first(params.anchor_id || params.anchorId).trim();
  const requestedDecoderInput = first(params.decode_input || params.raw_input || params.rawInput || params.memo || params.data).trim();
  const requestedLayer = first(params.layer || params.network).trim().toLowerCase();
  const proofHandoff = resolveProofHandoff(params, requestedLayer);
  const demoLabBackHref = proofHandoff.returnTo;
  const demoLabBackLabel = proofHandoff.scenario === "hub"
    ? "Volver al Demo Lab"
    : "Volver al escenario";
  const proofVerifierHref = proofPageHref(appendProofHandoff(new URLSearchParams(), proofHandoff));
  const architectureRequested = requestedLayer === "polygon" || requestedLayer === "iota";
  const focusTargetId = requestedDecoderInput
    ? "proof-decoder"
    : eventHash
      ? "proof-result"
      : requestedLayer === "polygon"
        ? "polygon-ownership"
        : requestedLayer === "iota"
          ? "iota-proof"
          : "";
  const decoderInput = requestedDecoderInput;
  const [result, demoCatalog, decodedProof] = await Promise.all([
    verifyProof(eventHash, anchorId),
    loadDemoCases(),
    decoderInput ? decodeProofInput(decoderInput) : Promise.resolve(null),
  ]);
  const matches = result?.matches || [];
  const included = Boolean(result?.included);
  const verificationState = result?.verification_state
    || (!eventHash ? "not_included" : result?.ok === false ? "unavailable" : included ? "local" : "not_included");
  const invalidInput = result?.reason === "event_hash_invalid" || result?.reason === "event_hash_required" || result?.reason === "anchor_id_invalid";
  const registryUnavailable = verificationState === "unavailable" || result?.reason === "private_anchor_registry_unavailable";
  const resultIsDemoFixture = Boolean(result?.demo || result?.evidence_level === "testnet_fixture" || result?.evidence_level === "testnet_rpc");
  const registryExternallyConfirmed = !resultIsDemoFixture
    && result?.verification_state === "confirmed"
    && result?.externally_confirmed === true;
  const externallyConfirmed = resultIsDemoFixture
    ? result?.network_verification?.anchor?.verified === true
      && result?.network_verification?.receipt?.verified === true
    : registryExternallyConfirmed;
  const demoCases = demoCatalog.cases || [];
  const activeDemo = result?.demo_case || demoCases.find((demoCase) =>
    demoCase.events.some((event) => event.hash.toLowerCase() === eventHash.toLowerCase()),
  ) || null;
  const demoFixture = Boolean(resultIsDemoFixture || activeDemo);
  const showcaseDemo = activeDemo || demoCases.find((demoCase) => demoCase.tx_hash && demoCase.public_receipt?.tx_hash) || demoCases[0] || null;
  const guidedDemo = activeDemo;
  const confirmedIotaAnchors = demoCases.filter((demoCase) => demoCase.network_verification?.anchor?.verified === true).length;
  const confirmedMemoReceipts = demoCases.filter((demoCase) => demoCase.network_verification?.receipt?.verified === true).length;
  const polygonRpcVerified = demoCatalog.testnet?.polygon?.rpc_verified === true;
  const liveTestnetReady = confirmedIotaAnchors > 0
    || demoCatalog.testnet?.iota?.rpc_verified === true
    || polygonRpcVerified;
  const activeReceiptMemoHex = guidedDemo ? utf8ToHex(guidedDemo.public_receipt.on_chain_memo) : "";
  const decoderWarnings = decodedProof?.warnings?.filter(Boolean) || [];
  const decoderReceiptMatched = Boolean(decodedProof?.receipt_matched);
  const decoderReceiptVerified = decodedProof?.network_verification?.verified === true;
  const decoderNeedsReview = !decoderReceiptVerified || decoderWarnings.length > 0;
  const liveProofMetrics = [
    {
      label: "IOTA anchors",
      value: String(confirmedIotaAnchors),
      body: "Merkle roots reales en testnet para delivery, pharma y agro.",
      live: confirmedIotaAnchors > 0,
    },
    {
      label: "Memo receipts",
      value: String(confirmedMemoReceipts),
      body: "Raw input legible y decodificable desde explorer.",
      live: confirmedMemoReceipts > 0,
    },
    {
      label: "IOTA contract",
      value: demoCatalog.testnet?.iota?.contract_address ? "live" : "pending",
      body: "Anchor contract separado de datos privados nexID.",
      live: Boolean(demoCatalog.testnet?.iota?.contract_address),
    },
    {
      label: "Polygon ownership",
      value: polygonRpcVerified ? "verified" : "checking",
      body: polygonRpcVerified
        ? "Mint, owner y metadata verificados; el piloto sigue bajo custodia nexID."
        : "Contrato configurado; la UI espera confirmacion RPC antes de afirmar evidencia.",
      live: polygonRpcVerified,
    },
  ];
  const decodedDemoCase = decodedProof?.matching_demo_case;
  const decodedReceiptMatchesQuery = Boolean(
    decodedProof?.publication_explorer_url
      && (
        (!eventHash && !anchorId)
        || (
          decodedDemoCase
          && (!eventHash || decodedDemoCase.primary_event_hash.toLowerCase() === eventHash.toLowerCase())
          && (!anchorId || decodedDemoCase.anchor_id.toLowerCase() === anchorId.toLowerCase())
        )
      ),
  );
  const guidedDemoMatchesQuery = Boolean(
    guidedDemo
      && (!eventHash || guidedDemo.events.some((event) => event.hash.toLowerCase() === eventHash.toLowerCase()))
      && (!anchorId || guidedDemo.anchor_id.toLowerCase() === anchorId.toLowerCase()),
  );
  const decodedReceiptExplorerUrl = decodedReceiptMatchesQuery
    ? decodedProof?.publication_explorer_url || ""
    : "";
  const receiptExplorerUrl = decodedReceiptExplorerUrl
    || (guidedDemoMatchesQuery ? guidedDemo?.public_receipt?.explorer_url : "")
    || "";
  const anchorExplorerUrl = matches.find((match) => Boolean(match.explorer_url))?.explorer_url
    || (guidedDemoMatchesQuery ? guidedDemo?.explorer_url : "")
    || "";
  const separateAnchorExplorerUrl = anchorExplorerUrl && anchorExplorerUrl !== receiptExplorerUrl
    ? anchorExplorerUrl
    : "";
  const anchorRpcVerified = resultIsDemoFixture
    ? result?.network_verification?.anchor?.verified === true
    : externallyConfirmed;
  const receiptRpcVerified = resultIsDemoFixture
    ? result?.network_verification?.receipt?.verified === true
    : decoderReceiptVerified;
  const resultHeadline = !eventHash
    ? "Listo para probar"
    : invalidInput
      ? "Hash o anchor invalido"
      : registryUnavailable
        ? "Registro temporalmente no disponible"
        : externallyConfirmed
          ? demoFixture
            ? "Evidencia testnet verificada por RPC"
            : "Anclaje externo confirmado"
          : included
            ? verificationState === "failed"
              ? "Anchor fallido"
              : verificationState === "submitted"
                ? "Anchor enviado, aun no confirmado"
                : "Incluido en registro local"
            : "Evidencia no incluida";
  const resultExplanation = !eventHash
    ? "Carga un caso demo o pega un SHA. La pantalla devuelve un veredicto entendible antes de mostrar detalles tecnicos."
    : invalidInput
      ? "El valor no tiene el formato esperado. Usa sha256 seguido de 64 caracteres hexadecimales y un UUID solo si quieres limitar la busqueda a un anchor."
      : registryUnavailable
        ? "No se pudo consultar el registro en este intento. Esto no equivale a no inclusion; vuelve a intentar antes de tomar una decision."
        : externallyConfirmed
          ? demoFixture
            ? "IOTA RPC confirmo la red, la wallet publicadora, el contrato, el Merkle root y el memo exacto. Esto prueba la publicacion del caso demo, no una operacion privada de cliente."
            : "El SHA esta incluido en un anchor con transaccion externa confirmada."
          : included
            ? "El SHA aparece en el registro, pero todavia no tiene confirmacion externa suficiente para presentarlo como prueba publica final."
            : "No se encontro inclusion para este SHA en el registro consultado.";
  const resultTone = externallyConfirmed
    ? "proof-console-card--success"
    : invalidInput || registryUnavailable || verificationState === "failed"
      ? "proof-console-card--warning"
      : included || eventHash
        ? "proof-console-card--info"
        : "proof-console-card--neutral";
  const resultChipLabel = !eventHash
    ? "ready"
    : invalidInput
      ? "invalid"
      : registryUnavailable
        ? "unavailable"
        : externallyConfirmed
          ? demoFixture ? "RPC verified demo" : "confirmed"
          : included
            ? verificationState
            : "not included";
  const resultChipClass = externallyConfirmed
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : invalidInput || registryUnavailable || verificationState === "failed"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : included
        ? "border-cyan-300 bg-cyan-50 text-cyan-800"
        : "border-slate-300 bg-slate-100 text-slate-600";
  const proofConsoleCards = [
    {
      label: "1. Decision",
      title: resultHeadline,
      body: resultExplanation,
      tone: resultTone,
    },
    {
      label: "2. Recibo legible",
      title: receiptExplorerUrl
        ? receiptRpcVerified ? "Receipt confirmado por RPC" : "Receipt configurado, chequeo pendiente"
        : "Receipt tx pendiente",
      body: receiptExplorerUrl
        ? receiptRpcVerified
          ? "RPC comprobo que el Raw input coincide exactamente con el memo publico esperado y fue emitido por la wallet nexID configurada."
          : "La transaccion esta disponible para inspeccion, pero la interfaz no la presenta como prueba final hasta completar el chequeo RPC."
        : "El verificador puede operar con registry local/API, pero no promete Raw input hasta tener una receipt tx publicada.",
      tone: receiptRpcVerified ? "proof-console-card--success" : receiptExplorerUrl ? "proof-console-card--info" : "proof-console-card--neutral",
    },
    {
      label: "3. Anchor tecnico",
      title: anchorExplorerUrl
        ? anchorRpcVerified ? "Anchor confirmado por RPC" : "Anchor configurado, chequeo pendiente"
        : "Anchor tx pendiente",
      body: anchorExplorerUrl
        ? anchorRpcVerified
          ? "RPC comprobo red, contrato, publisher, tenant hash, Merkle root, recurso y cantidad de eventos. El anchor sigue separado del memo legible."
          : "La transaccion tecnica esta disponible, pero no se presenta como anchor confirmado hasta comparar su calldata por RPC."
        : "El anchor tecnico aparecera cuando el Merkle root tenga una transaccion externa asociada.",
      tone: anchorRpcVerified ? "proof-console-card--success" : anchorExplorerUrl ? "proof-console-card--info" : "proof-console-card--neutral",
    },
    {
      label: "4. Privacidad",
      title: "Hash-only por diseno",
      body: "La empresa demuestra integridad sin publicar UIDs, clientes, rutas, manifiestos, lotes sensibles ni contratos comerciales.",
      tone: "proof-console-card--info",
    },
  ];
  const executiveReadout = [
    {
      label: "Veredicto",
      value: !eventHash ? "Demo lista" : resultHeadline,
      body: !eventHash ? "Arranca con un caso demo y muestra la cadena completa en menos de un minuto." : resultExplanation,
    },
    {
      label: "Red publica",
      value: receiptExplorerUrl
        ? demoFixture
          ? receiptRpcVerified && anchorRpcVerified ? "IOTA testnet · RPC verified" : "IOTA testnet · checking"
          : "Receipt publico"
        : "API/registry",
      body: receiptExplorerUrl
        ? receiptRpcVerified
          ? "La receipt tx fue consultada por RPC y su Raw input coincide con el memo esperado."
          : "La receipt tx puede abrirse en explorer, pero sigue separada de un veredicto RPC confirmado."
        : "La pantalla no atribuye un memo legible a la transaccion tecnica del anchor.",
    },
    {
      label: "Privacidad",
      value: decodedProof?.fields?.privacy === "hash-only" ? "Hash-only" : "Datos protegidos",
      body: "Se prueba integridad sin publicar UID secreto, cliente, manifiesto, QA interno ni contrato.",
    },
    {
      label: "Proxima accion",
      value: receiptExplorerUrl ? "Abrir receipt tx" : "Cargar demo",
      body: receiptExplorerUrl
        ? "Abrir la receipt tx en IOTA Explorer, copiar Raw input y pasarlo por el decoder de nexID."
        : "Usar Demo Lab o SDK/API para generar el receipt antes de enseñar un Raw input.",
    },
    {
      label: "Anchor",
      value: anchorExplorerUrl ? "Merkle root publicado" : "Pendiente",
      body: anchorExplorerUrl
        ? "El anchor tiene su propio explorer para auditar el Merkle root; no es el enlace del memo."
        : "Todavia no hay una transaccion tecnica de anchor asociada a este resultado.",
    },
  ];
  const explorerProofPath = [
    {
      title: "1. Transaccion",
      body: "El boton Receipt tx abre la transaccion real del recibo publico en IOTA Explorer, no el contract call del anchor.",
    },
    {
      title: "2. Raw input",
      body: "Dentro de esa receipt tx, Transaction details - Raw input contiene el memo como hex.",
    },
    {
      title: "3. Decoder nexID",
      body: "Pegando ese hex aca, la pantalla traduce el memo a lenguaje de negocio.",
    },
  ];

  return (
    <main className="proof-verify-page min-h-screen text-slate-950">
      <ProofFocusTarget
        targetId={focusTargetId}
        returnHref={demoLabBackHref}
        returnLabel={demoLabBackLabel}
      />
      <style>{`
        .proof-verify-page {
          --proof-page-bg:
            radial-gradient(circle at 14% 2%, rgba(34, 211, 238, 0.18), transparent 34%),
            radial-gradient(circle at 84% 12%, rgba(124, 58, 237, 0.16), transparent 30%),
            linear-gradient(180deg, #020617 0%, #08111f 48%, #020617 100%);
          --proof-card-bg: rgba(15, 23, 42, 0.78);
          --proof-soft-bg: rgba(15, 23, 42, 0.62);
          --proof-cyan-bg: rgba(8, 145, 178, 0.13);
          --proof-emerald-bg: rgba(16, 185, 129, 0.12);
          --proof-amber-bg: rgba(245, 158, 11, 0.12);
          --proof-border: rgba(148, 163, 184, 0.18);
          --proof-border-strong: rgba(34, 211, 238, 0.28);
          --proof-title: #f8fafc;
          --proof-text: #e2e8f0;
          --proof-muted: #94a3b8;
          --proof-accent: #67e8f9;
          --proof-success: #bbf7d0;
          --proof-success-strong: #dcfce7;
          --proof-warning: #fde68a;
          --proof-warning-strong: #fef3c7;
          --proof-shadow: 0 24px 90px rgba(0, 0, 0, 0.34);
          background: var(--proof-page-bg);
          color: var(--proof-text);
        }

        .helpbot-hint {
          display: none !important;
        }

        @media (max-width: 1023px) {
          .helpbot-surface,
          .helpbot-trigger,
          .helpbot-hint {
            display: none !important;
          }
        }

        html[data-theme="light"] .proof-verify-page,
        html.theme-light .proof-verify-page {
          --proof-page-bg:
            radial-gradient(circle at 15% 0%, rgba(34, 211, 238, 0.18), transparent 32%),
            linear-gradient(180deg, #f7fbff 0%, #eef5fb 52%, #f8fbff 100%);
          --proof-card-bg: rgba(255, 255, 255, 0.86);
          --proof-soft-bg: rgba(248, 250, 252, 0.92);
          --proof-cyan-bg: rgba(236, 254, 255, 0.78);
          --proof-emerald-bg: rgba(236, 253, 245, 0.95);
          --proof-amber-bg: rgba(255, 251, 235, 0.95);
          --proof-border: rgba(15, 23, 42, 0.12);
          --proof-border-strong: rgba(14, 116, 144, 0.24);
          --proof-title: #0f172a;
          --proof-text: #334155;
          --proof-muted: #64748b;
          --proof-accent: #0e7490;
          --proof-success: #065f46;
          --proof-success-strong: #064e3b;
          --proof-warning: #92400e;
          --proof-warning-strong: #78350f;
          --proof-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
        }

        .proof-verify-page [class*="bg-white"],
        .proof-verify-page form,
        .proof-verify-page article {
          background: var(--proof-card-bg) !important;
          border-color: var(--proof-border) !important;
          backdrop-filter: blur(16px);
        }

        .proof-verify-page .proof-elevated {
          box-shadow: var(--proof-shadow) !important;
          min-width: 0;
        }

        .proof-verify-page .proof-flat,
        .proof-verify-page .proof-flat [class*="bg-white"] {
          box-shadow: none !important;
          backdrop-filter: none !important;
          min-width: 0;
        }

        .proof-verify-page [class*="bg-slate-50"],
        .proof-verify-page [class*="bg-slate-100"] {
          background: var(--proof-soft-bg) !important;
          border-color: var(--proof-border) !important;
        }

        .proof-verify-page [class*="bg-cyan-50"] {
          background: var(--proof-cyan-bg) !important;
          border-color: var(--proof-border-strong) !important;
        }

        .proof-verify-page [class*="bg-emerald-50"] {
          background: var(--proof-emerald-bg) !important;
          border-color: rgba(52, 211, 153, 0.3) !important;
        }

        .proof-verify-page [class*="bg-amber-50"] {
          background: var(--proof-amber-bg) !important;
          border-color: rgba(251, 191, 36, 0.32) !important;
        }

        .proof-verify-page [class*="text-slate-950"],
        .proof-verify-page [class*="text-slate-900"],
        .proof-verify-page [class*="text-slate-800"],
        .proof-verify-page [class*="text-slate-700"] {
          color: var(--proof-title) !important;
        }

        .proof-verify-page [class*="text-slate-600"],
        .proof-verify-page [class*="text-slate-500"],
        .proof-verify-page [class*="text-slate-400"] {
          color: var(--proof-muted) !important;
        }

        .proof-verify-page [class*="text-cyan-700"],
        .proof-verify-page [class*="text-cyan-800"] {
          color: var(--proof-accent) !important;
        }

        .proof-verify-page [class*="text-violet-700"],
        .proof-verify-page [class*="text-violet-800"] {
          color: #c4b5fd !important;
        }

        html[data-theme="light"] .proof-verify-page [class*="text-violet-700"],
        html[data-theme="light"] .proof-verify-page [class*="text-violet-800"],
        html.theme-light .proof-verify-page [class*="text-violet-700"],
        html.theme-light .proof-verify-page [class*="text-violet-800"] {
          color: #6d28d9 !important;
        }

        .proof-verify-page [class*="text-emerald-950"],
        .proof-verify-page [class*="text-emerald-900"],
        .proof-verify-page [class*="text-emerald-800"],
        .proof-verify-page [class*="text-emerald-700"] {
          color: var(--proof-success) !important;
        }

        .proof-verify-page [class*="text-amber-950"],
        .proof-verify-page [class*="text-amber-900"],
        .proof-verify-page [class*="text-amber-800"],
        .proof-verify-page [class*="text-amber-700"] {
          color: var(--proof-warning) !important;
        }

        .proof-verify-page input,
        .proof-verify-page textarea {
          background: var(--proof-soft-bg) !important;
          border-color: var(--proof-border) !important;
          color: var(--proof-title) !important;
        }

        .proof-verify-page :where(a, button, input, textarea, summary):focus-visible {
          outline: 3px solid var(--proof-accent) !important;
          outline-offset: 3px !important;
        }

        .proof-verify-page :where(#proof-result, #proof-decoder, #polygon-ownership, #iota-proof):focus {
          outline: none;
        }

        .proof-verify-page .proof-decoder-input {
          overflow-x: hidden;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .proof-verify-page .proof-decoder-code {
          max-height: 8.5rem;
          overflow: auto;
          overflow-wrap: anywhere;
          word-break: break-all;
        }

        .proof-verify-page .proof-field-details[open] .proof-field-details-icon {
          transform: rotate(90deg);
        }

        .proof-verify-page input::placeholder,
        .proof-verify-page textarea::placeholder {
          color: var(--proof-muted);
        }

        .proof-verify-page form button {
          background: linear-gradient(135deg, #06b6d4, #14b8a6) !important;
          color: #020617 !important;
          box-shadow: 0 18px 50px rgba(20, 184, 166, 0.22) !important;
        }

        .proof-verify-page .theme-toggle {
          min-height: 2.75rem;
          border-color: var(--proof-border-strong) !important;
          background: var(--proof-card-bg) !important;
          color: var(--proof-text) !important;
        }

        .proof-verify-page .proof-topbar {
          align-items: center;
        }

        .proof-verify-page .proof-top-actions {
          min-width: 0;
        }

        .proof-verify-page .proof-top-cta {
          min-height: 2.75rem;
          border-color: var(--proof-border-strong) !important;
          background: var(--proof-card-bg) !important;
          color: var(--proof-text) !important;
        }

        .proof-verify-page .proof-top-cta--enterprise {
          border-color: rgba(52, 211, 153, 0.42) !important;
          background: rgba(16, 185, 129, 0.16) !important;
          color: #d1fae5 !important;
        }

        html[data-theme="light"] .proof-verify-page .proof-top-cta--enterprise,
        html.theme-light .proof-verify-page .proof-top-cta--enterprise {
          border-color: rgba(5, 150, 105, 0.28) !important;
          background: #ecfdf5 !important;
          color: #065f46 !important;
        }

        .proof-verify-page .proof-explorer-link {
          width: 100%;
          min-height: 2.75rem;
          border-color: rgba(34, 211, 238, 0.3) !important;
          background: rgba(2, 6, 23, 0.76) !important;
          color: #cffafe !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
          text-align: center;
        }

        html[data-theme="light"] .proof-verify-page .proof-explorer-link,
        html.theme-light .proof-verify-page .proof-explorer-link {
          border-color: rgba(14, 116, 144, 0.24) !important;
          background: #ecfeff !important;
          color: #075985 !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }

        .proof-verify-page .proof-receipt-status-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          max-width: 100%;
          border: 1px solid rgba(34, 211, 238, 0.38) !important;
          background: linear-gradient(135deg, #a7f3d0 0%, #67e8f9 100%) !important;
          color: #042f2e !important;
          box-shadow: 0 14px 34px rgba(20, 184, 166, 0.2);
          text-shadow: none !important;
          white-space: normal;
          text-align: center;
        }

        .proof-verify-page .proof-receipt-status-chip svg {
          color: #064e3b !important;
        }

        .proof-verify-page .proof-result-status-chip {
          flex-shrink: 0;
          min-width: 6.25rem;
          justify-content: center;
          white-space: nowrap;
          text-align: center;
          line-height: 1;
        }

        .proof-verify-page .proof-receipt-action-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          width: 100%;
          min-height: 2.75rem;
          border-radius: 0.9rem;
          border: 1px solid rgba(34, 211, 238, 0.28) !important;
          background: rgba(2, 6, 23, 0.78) !important;
          color: #cffafe !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
          text-align: center;
        }

        html[data-theme="light"] .proof-verify-page .proof-receipt-action-link,
        html.theme-light .proof-verify-page .proof-receipt-action-link {
          background: #083344 !important;
          color: #ecfeff !important;
        }

        .proof-verify-page .proof-secondary-cta {
          border-color: rgba(103, 232, 249, 0.36) !important;
          background: rgba(8, 145, 178, 0.18) !important;
          color: #cffafe !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        html[data-theme="light"] .proof-verify-page .proof-secondary-cta,
        html.theme-light .proof-verify-page .proof-secondary-cta {
          border-color: rgba(14, 116, 144, 0.24) !important;
          background: rgba(255, 255, 255, 0.82) !important;
          color: #0e7490 !important;
        }

        .proof-verify-page .proof-nav-cta {
          border-color: rgba(103, 232, 249, 0.42) !important;
          background: rgba(8, 145, 178, 0.2) !important;
          color: #e0f2fe !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .proof-verify-page .proof-nav-cta--neutral {
          border-color: rgba(148, 163, 184, 0.38) !important;
          background: rgba(15, 23, 42, 0.48) !important;
          color: #f8fafc !important;
        }

        html[data-theme="light"] .proof-verify-page .proof-nav-cta,
        html.theme-light .proof-verify-page .proof-nav-cta {
          border-color: rgba(14, 116, 144, 0.34) !important;
          background: #ecfeff !important;
          color: #075985 !important;
        }

        html[data-theme="light"] .proof-verify-page .proof-nav-cta--neutral,
        html.theme-light .proof-verify-page .proof-nav-cta--neutral {
          border-color: rgba(15, 23, 42, 0.16) !important;
          background: #f8fafc !important;
          color: #0f172a !important;
        }

        .proof-verify-page details > summary {
          cursor: pointer;
          list-style: none;
        }

        .proof-verify-page details > summary::-webkit-details-marker {
          display: none;
        }

        .proof-verify-page .proof-disclosure-summary__icon {
          transition: transform 180ms ease;
        }

        .proof-verify-page details[open] > .proof-disclosure-summary .proof-disclosure-summary__icon {
          transform: rotate(90deg);
        }

        .proof-verify-page .proof-architecture-disclosure,
        .proof-verify-page .proof-anchors-panel,
        .proof-verify-page .proof-decoder-panel,
        .proof-verify-page .proof-manager-panel,
        .proof-verify-page .proof-executive-method,
        .proof-verify-page .proof-explorer-guide {
          overflow: clip;
        }

        .proof-verify-page .proof-architecture-content > section,
        .proof-verify-page .proof-architecture-content > article {
          min-width: 0;
        }

        .proof-verify-page .proof-shell > * {
          order: 10;
        }

        .proof-verify-page .proof-topbar {
          order: 0;
        }

        .proof-verify-page .proof-hero-grid {
          order: 1;
        }

        .proof-verify-page .proof-fast-path {
          order: 2;
        }

        .proof-verify-page .proof-architecture-disclosure {
          order: 3;
        }

        .proof-verify-page .proof-verification-console {
          order: 4;
          overflow: hidden;
        }

        .proof-verify-page .proof-console-grid {
          display: grid;
          gap: 0.9rem;
          min-width: 0;
        }

        .proof-verify-page .proof-console-card {
          min-width: 0;
          border: 1px solid var(--proof-border);
          background: var(--proof-soft-bg);
          box-shadow: none !important;
        }

        .proof-verify-page .proof-console-card--success {
          border-color: rgba(52, 211, 153, 0.34) !important;
          background: var(--proof-emerald-bg) !important;
        }

        .proof-verify-page .proof-console-card--warning {
          border-color: rgba(251, 191, 36, 0.36) !important;
          background: var(--proof-amber-bg) !important;
        }

        .proof-verify-page .proof-console-card--info {
          border-color: var(--proof-border-strong) !important;
          background: var(--proof-cyan-bg) !important;
        }

        .proof-verify-page .proof-console-card--neutral {
          border-color: var(--proof-border) !important;
          background: var(--proof-soft-bg) !important;
        }

        .proof-verify-page .proof-exec-steps {
          display: grid;
          gap: 0.75rem;
        }

        .proof-verify-page .proof-exec-readout-grid {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .proof-verify-page .proof-exec-readout-card {
          border: 1px solid var(--proof-border);
          background: var(--proof-soft-bg);
          min-width: 0;
        }

        .proof-verify-page .proof-explorer-proof-path {
          display: grid;
          gap: 0.6rem;
        }

        .proof-verify-page .proof-exec-step {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.75rem;
          align-items: start;
          border: 1px solid var(--proof-border);
          background: var(--proof-card-bg);
        }

        .proof-verify-page .proof-exec-step__badge {
          display: grid;
          height: 2rem;
          width: 2rem;
          place-items: center;
          border-radius: 999px;
          border: 1px solid var(--proof-border-strong);
          background: rgba(34, 211, 238, 0.12);
          color: var(--proof-accent);
          font-size: 0.68rem;
          font-weight: 900;
        }

        .proof-verify-page .proof-workstation-grid {
          display: grid;
          gap: 1.25rem;
          grid-template-columns: minmax(0, 1fr);
          order: 5;
        }

        .proof-verify-page .proof-fast-path-card {
          min-width: 0;
          overflow: hidden;
        }

        .proof-verify-page .proof-fast-path-card p,
        .proof-verify-page .proof-fast-path-card strong,
        .proof-verify-page .proof-fast-path-card a {
          overflow-wrap: anywhere;
        }

        .proof-verify-page .proof-fast-path-card__headline {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        .proof-verify-page .proof-fast-path-card a {
          border-color: rgba(103, 232, 249, 0.38) !important;
          background: rgba(8, 145, 178, 0.22) !important;
          color: #e0f2fe !important;
        }

        .proof-verify-page .proof-fast-path-card a[href*="decode_input"] {
          border-color: rgba(52, 211, 153, 0.36) !important;
          background: rgba(16, 185, 129, 0.18) !important;
          color: #dcfce7 !important;
        }

        html[data-theme="light"] .proof-verify-page .proof-fast-path-card a,
        html.theme-light .proof-verify-page .proof-fast-path-card a {
          background: #ecfeff !important;
          color: #075985 !important;
        }

        html[data-theme="light"] .proof-verify-page .proof-fast-path-card a[href*="decode_input"],
        html.theme-light .proof-verify-page .proof-fast-path-card a[href*="decode_input"] {
          background: #ecfdf5 !important;
          color: #065f46 !important;
        }

        .proof-verify-page .proof-workstation-grid > *,
        .proof-verify-page .proof-workstation-sidebar,
        .proof-verify-page .proof-workstation-grid dl,
        .proof-verify-page .proof-workstation-grid dd {
          min-width: 0;
        }

        .proof-verify-page .proof-workstation-grid dd,
        .proof-verify-page .proof-workstation-grid p,
        .proof-verify-page .proof-workstation-grid a,
        .proof-verify-page .proof-workstation-grid span,
        .proof-verify-page .proof-workstation-grid strong {
          overflow-wrap: anywhere;
        }

        .proof-verify-page .proof-workstation-sidebar {
          display: grid;
          gap: 1.25rem;
          min-width: 0;
        }

        .proof-verify-page .proof-executive-panel,
        .proof-verify-page .proof-decoder-panel,
        .proof-verify-page .proof-manager-panel {
          min-width: 0;
        }

        .proof-verify-page .proof-decoder-translation-grid,
        .proof-verify-page .proof-manager-explain-grid {
          display: grid;
          gap: 0.75rem;
        }

        @media (min-width: 1024px) {
          .proof-verify-page .proof-exec-readout-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .proof-verify-page .proof-workstation-sidebar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: stretch;
          }

          .proof-verify-page .proof-decoder-panel,
          .proof-verify-page .proof-manager-panel {
            grid-column: 1 / -1;
          }

          .proof-verify-page .proof-decoder-translation-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .proof-verify-page .proof-manager-explain-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (min-width: 1180px) {
          .proof-verify-page .proof-console-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .proof-verify-page .proof-workstation-grid {
            grid-template-columns: minmax(0, 0.88fr) minmax(28rem, 1.12fr);
            align-items: start;
            gap: 1.5rem;
          }

          .proof-verify-page .proof-workstation-sidebar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: stretch;
          }

          .proof-verify-page .proof-decoder-panel,
          .proof-verify-page .proof-manager-panel {
            grid-column: 1 / -1;
          }

          .proof-verify-page .proof-workstation-result-panel,
          .proof-verify-page .proof-workstation-sidebar {
            align-self: start;
          }
        }

        @media (max-width: 640px) {
          .proof-verify-page {
            padding-bottom: 6rem;
          }

          .proof-verify-page .proof-decoder-code {
            max-height: none;
            overflow: visible;
          }

          .proof-verify-page .proof-shell {
            gap: 1.5rem;
            padding-top: 1.25rem;
          }

          .proof-verify-page .proof-hero-grid {
            gap: 1.25rem;
          }

          .proof-verify-page .proof-fast-path {
            padding: 1rem;
          }

          .proof-verify-page .proof-fast-path-card {
            padding: 0.875rem;
          }

          .proof-verify-page .back-link {
            flex: 0 0 2.75rem;
            min-height: 2.75rem;
            min-width: 2.75rem;
            width: 2.75rem;
            justify-content: center;
            padding-left: 0;
            padding-right: 0;
          }

          .proof-verify-page .back-link__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .proof-verify-page .proof-topbar {
            gap: 0.75rem;
          }

          .proof-verify-page .proof-top-actions {
            display: grid;
            flex: 1;
            grid-template-columns: 2.75rem minmax(0, 1fr);
            justify-items: stretch;
          }

          .proof-verify-page .proof-top-actions .theme-toggle {
            width: 2.75rem;
            min-width: 2.75rem;
            overflow: hidden;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .proof-verify-page .proof-top-actions .theme-toggle .theme-toggle__glyph {
            flex: 0 0 auto;
          }

          .proof-verify-page .proof-top-actions .theme-toggle span:not(.theme-toggle__glyph) {
            display: none;
          }

          .proof-verify-page .proof-top-actions .proof-top-cta {
            width: 100%;
          }

          .proof-verify-page .proof-top-actions .proof-top-cta--enterprise,
          .proof-verify-page .proof-top-actions .proof-top-cta--sdk {
            grid-column: 1 / -1;
          }

          .proof-verify-page .back-link span:last-child {
            display: none;
          }

        }
      `}</style>
      <section className="proof-shell mx-auto flex w-full max-w-[1540px] flex-col gap-6 px-5 py-8 sm:gap-10 sm:px-8 lg:px-10">
        <div className="proof-topbar flex items-center justify-between gap-4">
          <BackLink href="/" label="Volver a nexID" />
          <div className="proof-top-actions flex flex-wrap items-center justify-end gap-2">
            <ThemeToggle />
            <Link
              href={demoLabBackHref}
              className="proof-top-cta inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              {demoLabBackLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={ENTERPRISE_PROOF_CONSOLE_URL}
              target="_blank"
              rel="noreferrer"
              className="proof-top-cta proof-top-cta--enterprise inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] shadow-sm transition"
            >
              Consola privada <ExternalLink className="h-4 w-4" />
            </a>
            <Link
              href="/sdk"
              className="proof-top-cta proof-top-cta--sdk inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              SDK/API
            </Link>
          </div>
        </div>

        <div className="proof-hero-grid grid gap-5 lg:grid-cols-[1.02fr_0.98fr] lg:items-end lg:gap-8">
          <div className="space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/75 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-800 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Public proof verifier
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-normal text-slate-950 sm:text-6xl">
                Prueba publica para evidencia privada.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Proof Verify permite que un cliente, auditor o inversor compruebe que una evidencia existia y no fue cambiada, sin ver el dato sensible que genero esa evidencia.
              </p>
            </div>
            {showcaseDemo ? (
              <div className="proof-mobile-demo-actions grid gap-2 sm:grid-cols-2 lg:hidden">
                <Link href={verifyHrefForDemo(showcaseDemo, proofHandoff)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-cyan-900/10">
                  Probar SHA demo <FileSearch className="h-4 w-4" />
                </Link>
                <Link href={decoderHrefForDemo(showcaseDemo, proofHandoff)} className="proof-secondary-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">
                  Leer memo real <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>

          <form action="/proof/verify#proof-result" className="proof-elevated rounded-[1.5rem] border border-cyan-100 bg-white/88 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <input type="hidden" name="scenario" value={proofHandoff.scenario} />
            <input type="hidden" name="return_to" value={demoLabBackHref} />
            <div className="grid gap-3">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-6 text-slate-700">
                <strong className="block text-slate-950">Que pega una empresa en este campo?</strong>
                Un hash de evento autorizado: por ejemplo QA de lote, entrega, claim, DPP o checkpoint logistico. Si el hash aparece en un anchor, la evidencia quedo incluida.
              </div>
              <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Event hash
                <input
                  name="event_hash"
                  defaultValue={eventHash}
                  placeholder="sha256:..."
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-mono text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                />
              </label>
              <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Anchor ID opcional
                <input
                  name="anchor_id"
                  defaultValue={anchorId}
                  placeholder="uuid"
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 font-mono text-sm normal-case tracking-normal text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                />
              </label>
              <button className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-cyan-900/10 transition hover:bg-cyan-900">
                Verificar prueba <FileSearch className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        {showcaseDemo ? (
          <section className="proof-fast-path proof-elevated rounded-[1.5rem] border border-cyan-200 bg-white/84 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Arranque guiado</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">Proba un proof completo sin saber blockchain.</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Elegi un caso, verificá su SHA y abrí el decoder del Raw input. La pantalla separa lo que prueba nexID, lo que ancla IOTA y lo que queda para Polygon ownership.
                </p>
              </div>
              <div className="proof-fast-path-actions grid gap-2 sm:grid-cols-3 lg:min-w-[34rem]">
                <Link href={verifyHrefForDemo(showcaseDemo, proofHandoff)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-cyan-900">
                  Verificar SHA demo <FileSearch className="h-4 w-4" />
                </Link>
                <Link href={decoderHrefForDemo(showcaseDemo, proofHandoff)} className="proof-secondary-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">
                  Decodificar memo <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href={proofLayerHref("polygon", "polygon-ownership", proofHandoff)} className="proof-secondary-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">
                  Ver mint Amoy <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="proof-live-ribbon mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-2.5">
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-emerald-700">IOTA testnet</span>
                <strong className="mt-1 block text-sm text-slate-950">{confirmedIotaAnchors} anchors reales</strong>
              </div>
              <div className="rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-3 py-2.5">
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-cyan-700">Memo publico</span>
                <strong className="mt-1 block text-sm text-slate-950">{confirmedMemoReceipts} recibos decodificables</strong>
              </div>
              <div className="rounded-xl border border-violet-300/40 bg-violet-400/10 px-3 py-2.5">
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] text-violet-700">Polygon Amoy</span>
                <strong className="mt-1 block text-sm text-slate-950">
                  {polygonRpcVerified
                    ? demoCatalog.testnet?.polygon?.owner_custody === "platform_managed"
                      ? "Mint RPC verificado · custodia nexID"
                      : "Mint RPC verificado"
                    : demoCatalog.testnet?.polygon?.demo_tx_hash
                      ? "Verificacion RPC pendiente"
                      : "Sin emision verificada"}
                </strong>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {demoCases.slice(0, 3).map((demoCase) => (
                <article key={demoCase.id} className="proof-fast-path-card rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-700">{demoCase.vertical}</p>
                      <strong className="mt-2 block text-base leading-tight text-slate-950">{demoCase.title}</strong>
                    </div>
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] text-cyan-800">
                      {demoCase.events.length} eventos
                    </span>
                  </div>
                  <p className="proof-fast-path-card__headline mt-2 text-sm leading-6 text-slate-600">{demoCase.headline}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Link href={verifyHrefForDemo(demoCase, proofHandoff)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-cyan-900">
                      Ver SHA
                    </Link>
                    <Link href={decoderHrefForDemo(demoCase, proofHandoff)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-emerald-900">
                      Leer memo
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <details className="proof-architecture-disclosure proof-elevated rounded-[1.5rem] border border-cyan-200 bg-white/84 p-4 shadow-sm sm:p-5" open={architectureRequested}>
          <summary className="proof-disclosure-summary flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-2xl px-1 text-left">
            <span>
              <span className="block text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-700">Arquitectura y redes</span>
              <strong className="mt-1 block text-lg leading-tight text-slate-950">Ver contratos, flujo Merkle y demos tecnicas</strong>
            </span>
            <span aria-hidden="true" className="proof-disclosure-summary__icon grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-800">
              <ArrowRight className="h-4 w-4" />
            </span>
          </summary>
          <div className="proof-architecture-content mt-5 grid gap-6">
        <section className="proof-elevated rounded-[1.6rem] border border-cyan-200 bg-white/84 p-4 shadow-sm sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr] xl:items-stretch">
            <div className="rounded-[1.35rem] border border-cyan-200 bg-cyan-50/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Testnet live cockpit</p>
                  <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950">Prueba real, explicada sin jerga.</h2>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.12em] ${liveTestnetReady ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                  {liveTestnetReady ? "live" : "setup"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Esta pantalla conecta Demo Lab, API, IOTA y Polygon: nexID genera el evento privado, publica solo evidencia hash-only y deja que un tercero lo verifique sin acceder a datos sensibles.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Link href={showcaseDemo ? verifyHrefForDemo(showcaseDemo, proofHandoff) : "/demo-lab?scenario=iota-proof"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-cyan-900">
                  {showcaseDemo ? "Probar verificacion real" : "Abrir demo IOTA"} <FileSearch className="h-4 w-4" />
                </Link>
                <Link href={showcaseDemo ? decoderHrefForDemo(showcaseDemo, proofHandoff) : proofVerifierHref} className="proof-secondary-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white/78 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-cyan-900 transition hover:border-cyan-300 hover:bg-cyan-50">
                  {showcaseDemo ? "Decodificar memo real" : "Usar decoder manual"} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {liveProofMetrics.map((metric) => (
                <article key={metric.label} className="proof-flat rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                    <span className={`h-2.5 w-2.5 rounded-full ${metric.live ? "bg-emerald-400" : "bg-amber-400"}`} />
                  </div>
                  <p className="mt-3 text-3xl font-black leading-none text-slate-950">{metric.value}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{metric.body}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="proof-flat rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">Para empresarios</p>
              <p className="mt-2 text-sm leading-6 text-emerald-900">No hace falta entender blockchain: se verifica si la evidencia esta incluida y que informacion quedo privada.</p>
            </div>
            <div className="proof-flat rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-800">Para auditores</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">El SHA, el Merkle root, la tx y el Raw input se pueden contrastar contra el explorer externo.</p>
            </div>
            <div className="proof-flat rounded-2xl border border-violet-200 bg-white/72 p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-violet-700">Para producto</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">IOTA queda para evidencia; Polygon queda para propiedad, warranty y certificados transferibles.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          {businessProofPoints.map((item) => (
            <article key={item.title} className="proof-flat rounded-[1.25rem] border border-cyan-200 bg-cyan-50/70 p-4">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-cyan-700">Para {item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {proofFlow.map((item) => (
            <article key={item.label} className="proof-flat rounded-[1.25rem] border border-slate-200 bg-white/82 p-4 shadow-sm">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-cyan-700">{item.label}</p>
              <h2 className="mt-3 text-lg font-black leading-tight text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
            </article>
          ))}
        </section>

        <section id="trust-networks" className="grid scroll-mt-24 gap-4 lg:grid-cols-2">
          <article id="polygon-ownership" tabIndex={-1} className="proof-elevated scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Polygon ownership layer</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">Contrato real NXDT en Amoy.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Esta capa emite un certificado transferible despues de la validacion nexID. Hoy el token publico demuestra mint, holder, metadata y codigo en testnet; sigue bajo custodia nexID y no se presenta como propiedad del comprador.
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] ${polygonRpcVerified ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                {polygonRpcVerified ? "RPC verified" : demoCatalog.testnet?.polygon?.contract_address ? "checking" : "pending"}
              </span>
            </div>
            <dl className="mt-5 grid gap-3">
              <div className="proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Contrato</dt>
                <dd className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCatalog.testnet?.polygon?.contract_address || "-"}</dd>
                <div className="mt-3">{explorerLink(demoCatalog.testnet?.polygon?.contract_explorer_url, "Abrir contrato")}</div>
              </div>
              <div className="proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Titular on-chain actual</dt>
                <dd className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCatalog.testnet?.polygon?.owner_address || "-"}</dd>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {demoCatalog.testnet?.polygon?.wallet_control_verified
                    ? "Control de wallet verificado."
                    : "Custodia de plataforma: todavia no prueba control de wallet del comprador."}
                </p>
                <div className="mt-3">{explorerLink(demoCatalog.testnet?.polygon?.owner_explorer_url, "Abrir wallet")}</div>
              </div>
              {demoCatalog.testnet?.polygon?.demo_tx_hash ? (
                <div className={`proof-flat rounded-2xl border p-4 ${polygonRpcVerified ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <dt className={`text-[0.68rem] font-black uppercase tracking-[0.14em] ${polygonRpcVerified ? "text-emerald-800" : "text-amber-800"}`}>
                    {polygonRpcVerified ? "Emision testnet verificada por RPC" : "Transaccion configurada; verificacion pendiente"}
                  </dt>
                  <dd className={`mt-2 break-all font-mono text-xs font-bold ${polygonRpcVerified ? "text-emerald-950" : "text-amber-950"}`}>{demoCatalog.testnet.polygon.demo_tx_hash}</dd>
                  <div className="mt-3">{explorerLink(demoCatalog.testnet.polygon.demo_tx_explorer_url, "Abrir tx")}</div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 text-[0.65rem] font-black uppercase tracking-[0.08em] text-slate-700">
                <span>Metadata {demoCatalog.testnet?.polygon?.metadata_verified ? "verificada" : "pendiente"}</span>
                <span aria-hidden="true">·</span>
                <span>Eventos {demoCatalog.testnet?.polygon?.mint_events_match ? "coinciden" : "pendientes"}</span>
                <span aria-hidden="true">·</span>
                <span>Codigo {demoCatalog.testnet?.polygon?.source_verified ? "publicado" : "pendiente"}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href="/proof/ownership" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-violet-800">
                  Abrir certificado legible <ArrowRight className="h-4 w-4" />
                </Link>
                {demoCatalog.testnet?.polygon?.metadata_url ? (
                  <a href={demoCatalog.testnet.polygon.metadata_url} target="_blank" rel="noreferrer" className="proof-nav-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-black uppercase tracking-[0.1em]">
                    Ver metadata HTTPS <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </dl>
          </article>

          <article id="iota-proof" tabIndex={-1} className="proof-elevated scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">IOTA proof layer</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">Merkle root para auditoria publica.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Esta capa prueba que un evento existia sin mostrar el evento. Es ideal para DPP, QA, cadena de custodia y auditoria externa.
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] ${demoCatalog.testnet?.iota?.rpc_verified ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                {demoCatalog.testnet?.iota?.rpc_verified ? "RPC verified" : demoCatalog.testnet?.iota?.contract_configured ? "deployed / checking" : "testnet-ready"}
              </span>
            </div>
            <dl className="mt-5 grid gap-3">
              <div className="proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Deployer testnet</dt>
                <dd className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCatalog.testnet?.iota?.deployer_address || "-"}</dd>
              </div>
              <div className="proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">Contrato anchor</dt>
                <dd className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCatalog.testnet?.iota?.contract_address || "Aparece aca cuando el caso tenga anchor publicado."}</dd>
                <div className="mt-3">{explorerLink(demoCatalog.testnet?.iota?.contract_explorer_url, "Abrir contrato")}</div>
              </div>
              {demoCatalog.testnet?.iota?.demo_tx_hash ? (
                <div className="proof-flat rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">{demoCatalog.testnet?.iota?.rpc_verified ? "Anchor RPC confirmado" : "Anchor configurado"}</dt>
                  <dd className="mt-2 break-all font-mono text-xs font-bold text-emerald-950">{demoCatalog.testnet.iota.demo_tx_hash}</dd>
                  <div className="mt-3">{explorerLink(demoCatalog.testnet.iota.demo_tx_explorer_url, "Abrir anchor tx")}</div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Este entorno todavia no muestra una tx publica para este caso. La verificacion local ya prueba hash y Merkle root; cuando operaciones publique el anchor, este mismo panel muestra explorer real sin exponer datos privados.
                </div>
              )}
            </dl>
          </article>
        </section>

        <section className="proof-elevated rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Demos publicos verificables</p>
              <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950">Entrar, elegir un caso y verificar un SHA real.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Estos casos no usan marcas reales ni datos sensibles. El backend calcula hashes canonicos, Merkle roots reales y muestra la transaccion IOTA testnet cuando ese caso ya fue anclado.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/75 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-cyan-800">
              IOTA {demoCatalog.testnet?.iota?.mode || "disabled"} - Polygon {demoCatalog.testnet?.polygon?.network || "amoy"}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {demoCases.length ? demoCases.map((demoCase) => (
              <article key={demoCase.id} className="proof-flat rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-700">{demoCase.vertical}</p>
                    <h3 className="mt-2 text-xl font-black leading-tight text-slate-950">{demoCase.title}</h3>
                  </div>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] text-cyan-800">
                    {demoCase.events.length} eventos
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{demoCase.headline}</p>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-3">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">SHA principal</p>
                  <p className="mt-2 break-all font-mono text-xs font-bold text-slate-900">{demoCase.primary_event_hash}</p>
                </div>
                {demoCase.tx_hash ? (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">{demoCase.network_verification?.anchor?.verified ? "IOTA anchor RPC confirmado" : "IOTA anchor configurado"}</p>
                    <p className="mt-2 break-all font-mono text-[0.72rem] font-bold text-emerald-950">{shortHash(demoCase.tx_hash)}</p>
                    <div className="mt-2">{explorerLink(demoCase.explorer_url, "Abrir anchor tx")}</div>
                  </div>
                ) : null}
                {demoCase.public_receipt?.tx_hash ? (
                  <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-800">{demoCase.network_verification?.receipt?.verified ? "Memo RPC confirmado en IOTA" : "Memo configurado en IOTA"}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-700">{demoCase.public_receipt.business_claim}</p>
                    <div className="mt-2">{explorerLink(demoCase.public_receipt.explorer_url, "Abrir memo tx")}</div>
                  </div>
                ) : null}
                <Link
                  href={verifyHrefForDemo(demoCase, proofHandoff)}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-cyan-900"
                >
                  Verificar este SHA <FileSearch className="h-4 w-4" />
                </Link>
              </article>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600 lg:col-span-3">
                La API de demos no respondio ahora. El verificador manual sigue funcionando si pegas un hash autorizado.
              </div>
            )}
          </div>
        </section>
          </div>
        </details>

        <section className="proof-verification-console proof-elevated rounded-[1.6rem] border border-cyan-200 bg-white/84 p-5 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr] xl:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Consola de verificacion publica</p>
              <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950">Un veredicto legible antes del detalle tecnico.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Pensado para un gerente, auditor o inversor: primero muestra si la evidencia existe, despues abre la prueba externa y finalmente explica que datos nunca se publican.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:justify-end">
              {guidedDemo ? (
                <Link href={verifyHrefForDemo(guidedDemo, proofHandoff)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-cyan-900">
                  Probar caso demo <FileSearch className="h-4 w-4" />
                </Link>
              ) : null}
              {receiptExplorerUrl ? (
                <a data-proof-explorer="receipt" href={receiptExplorerUrl} className="proof-receipt-action-link text-xs font-black uppercase tracking-[0.12em]" target="_blank" rel="noreferrer">
                  Abrir receipt tx con Raw input <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <Link href="/demo-lab?scenario=iota-proof" className="proof-secondary-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">
                  Ir a Demo Lab <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {separateAnchorExplorerUrl ? (
                <a data-proof-explorer="anchor" href={separateAnchorExplorerUrl} className="proof-explorer-link inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]" target="_blank" rel="noreferrer">
                  Abrir anchor tx (Merkle root) <ArrowRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="proof-console-grid mt-5">
            {proofConsoleCards.map((card) => (
              <article key={card.label} className={`proof-console-card rounded-2xl p-4 ${card.tone}`}>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-700">{card.label}</p>
                <h3 className="mt-2 text-xl font-black leading-tight text-slate-950">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="proof-result" aria-live="polite" tabIndex={-1} className="proof-workstation-grid scroll-mt-24">
          <div className="proof-workstation-result-panel proof-elevated rounded-[1.5rem] border border-slate-200 bg-white/82 p-5 shadow-sm">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Resultado</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{resultHeadline}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{resultExplanation}</p>
              </div>
              <span className={`proof-result-status-chip inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${resultChipClass}`}>
                <BadgeCheck className="h-4 w-4" />
                {resultChipLabel}
              </span>
            </div>

            {eventHash ? (
            <dl className="mt-6 grid gap-3 text-sm">
              <div className="proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Event hash</dt>
                <dd className="mt-2 break-all font-mono text-slate-900">{eventHash || "sha256:..."}</dd>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Provider</dt>
                  <dd className="mt-2 font-mono text-slate-900">{result?.provider || "-"}</dd>
                </div>
                <div className="proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Network</dt>
                  <dd className="mt-2 font-mono text-slate-900">{result?.network || "-"}</dd>
                </div>
              </div>
              <div className="proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Merkle root</dt>
                <dd className="mt-2 break-all font-mono text-slate-900">{result?.merkle_root || "-"}</dd>
              </div>
            </dl>
            ) : (
              <div className="proof-start-state mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-800">Como empezar</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["1", "Elegi un caso"],
                    ["2", "Verifica el SHA"],
                    ["3", "Abri la prueba real"],
                  ].map(([step, label]) => (
                    <div key={step} className="proof-flat rounded-xl border border-cyan-200 bg-white/70 px-3 py-3">
                      <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-cyan-700">Paso {step}</span>
                      <strong className="mt-1 block text-sm text-slate-950">{label}</strong>
                    </div>
                  ))}
                </div>
                {showcaseDemo ? (
                  <Link href={verifyHrefForDemo(showcaseDemo, proofHandoff)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white">
                    Probar con {showcaseDemo.title} <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            )}
            {result?.registry_warning ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                El demo publico verifico con el anchor testnet disponible. El registry privado no respondio en este intento, por eso no se muestran anchors internos.
              </div>
            ) : null}
            {guidedDemo ? (
              <div className="proof-flat mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-800">{demoFixture ? "Caso demo explicado" : activeDemo ? "Caso explicado" : "Caso demo sugerido"}</p>
                <h3 className="mt-2 text-xl font-black leading-tight text-slate-950">{guidedDemo.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {activeDemo
                    ? guidedDemo.body
                    : `${guidedDemo.body} Usa este ejemplo para ver la cadena completa: hash canonico, Merkle root, memo publico y datos privados protegidos.`}
                </p>
                {!eventHash ? (
                  <Link href={verifyHrefForDemo(guidedDemo, proofHandoff)} className="proof-secondary-cta mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">
                    Cargar SHA de este caso <FileSearch className="h-4 w-4" />
                  </Link>
                ) : null}
                <div className="mt-4 grid gap-2">
                  {guidedDemo.events.map((event, index) => (
                    <div key={event.id} className="proof-flat rounded-2xl border border-cyan-100 bg-white/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-slate-950">{index + 1}. {event.title}</strong>
                        <span className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-cyan-800">{event.event_type}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{event.summary}</p>
                      <details className="mt-2 rounded-xl border border-cyan-100 bg-cyan-50/40 px-3 py-2">
                        <summary className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-cyan-800">Ver hash canonico</summary>
                        <p className="mt-2 break-all font-mono text-[0.72rem] font-bold text-slate-800">{event.hash}</p>
                      </details>
                    </div>
                  ))}
                </div>
                <div className="proof-flat mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-emerald-800">Recibo publico on-chain</p>
                      <h4 className="mt-2 text-lg font-black leading-tight text-emerald-950">{guidedDemo.public_receipt.title}</h4>
                    </div>
                    {guidedDemo.network_verification?.receipt?.verified === true ? (
                      <span className="proof-receipt-status-chip rounded-full px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.1em]">
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                        Memo en Raw input confirmado
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-emerald-900">{guidedDemo.public_receipt.business_claim}</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">{guidedDemo.public_receipt.manager_explanation}</p>
                  <details className="proof-flat mt-4 rounded-2xl border border-emerald-200 bg-white/70 p-3">
                    <summary className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">Ver texto exacto escrito como data de transaccion</summary>
                    <p className="mt-2 break-all font-mono text-[0.72rem] font-bold leading-5 text-slate-900">{guidedDemo.public_receipt.on_chain_memo}</p>
                  </details>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="proof-flat rounded-2xl border border-emerald-200 bg-white/70 p-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">Hash del memo</p>
                      <p className="mt-2 break-all font-mono text-[0.72rem] font-bold text-slate-900">{guidedDemo.public_receipt.receipt_hash}</p>
                    </div>
                    <div className="proof-flat rounded-2xl border border-emerald-200 bg-white/70 p-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-800">Transaccion memo</p>
                      <p className="mt-2 break-all font-mono text-[0.72rem] font-bold text-slate-900">{shortHash(guidedDemo.public_receipt.tx_hash)}</p>
                      {guidedDemo.public_receipt.explorer_url ? (
                        <a href={guidedDemo.public_receipt.explorer_url} className="proof-receipt-action-link mt-3 text-xs font-black uppercase tracking-[0.12em]" target="_blank" rel="noreferrer">
                          Abrir tx con memo en IOTA Explorer <ArrowRight className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="proof-flat rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-800">Publico</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{guidedDemo.public_receipt.public_fields.join(", ")}</p>
                    </div>
                    <div className="proof-flat rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-amber-800">Privado dentro de nexID</p>
                      <p className="mt-2 text-sm leading-6 text-amber-900">{guidedDemo.public_receipt.private_fields.join(", ")}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="proof-workstation-sidebar grid gap-5 xl:self-start">
          <div className="proof-executive-panel proof-elevated rounded-[1.5rem] border border-cyan-200 bg-cyan-50/75 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Lectura ejecutiva</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">
                  Que entiende un gerente sin leer blockchain?
                </h2>
              </div>
              <BadgeCheck className="mt-1 h-6 w-6 shrink-0 text-cyan-700" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Resume el proof en tres ideas: que hecho queda probado, donde se ve la evidencia externa y que datos siguen privados dentro de nexID.
            </p>
            <div className="proof-exec-readout-grid mt-4">
              {executiveReadout.map((item) => (
                <div key={item.label} className="proof-exec-readout-card rounded-2xl p-3">
                  <p className="text-[0.64rem] font-black uppercase tracking-[0.14em] text-cyan-700">{item.label}</p>
                  <strong className="mt-2 block text-base leading-tight text-slate-950">{item.value}</strong>
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
            <details className="proof-executive-method proof-flat mt-4 rounded-2xl border border-cyan-200 bg-white/70 p-3">
              <summary className="proof-disclosure-summary flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-black text-slate-950">
                <span>Como se construye la prueba</span>
                <ArrowRight className="proof-disclosure-summary__icon h-4 w-4 shrink-0 text-cyan-700" />
              </summary>
            <div className="proof-exec-steps mt-3">
              {[
                {
                  badge: "01",
                  title: "Evento autorizado",
                  body: "Hash de QA, custodia, claim o DPP. Si cambia el evento, cambia el SHA.",
                },
                {
                  badge: "02",
                  title: "Prueba externa",
                  body: "IOTA muestra tx y Merkle root. nexID traduce el Raw input a negocio.",
                },
                {
                  badge: "03",
                  title: "Datos protegidos",
                  body: "No se publican UIDs, rutas, clientes ni contratos comerciales.",
                },
              ].map((step) => (
                <div key={step.badge} className="proof-exec-step rounded-2xl p-3">
                  <span className="proof-exec-step__badge">{step.badge}</span>
                  <div>
                    <strong className="block text-sm leading-tight text-slate-950">{step.title}</strong>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            </details>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {receiptExplorerUrl ? (
                <a data-proof-explorer="receipt" href={receiptExplorerUrl} className="proof-receipt-action-link text-xs font-black uppercase tracking-[0.12em]" target="_blank" rel="noreferrer">
                  Abrir receipt tx donde esta el memo <ArrowRight className="h-4 w-4" />
                </a>
              ) : null}
              {guidedDemo ? (
                <Link href={decoderHrefForDemo(guidedDemo, proofHandoff)} className="proof-secondary-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">
                  Decodificar Raw input <FileSearch className="h-4 w-4" />
                </Link>
              ) : null}
              {separateAnchorExplorerUrl ? (
                <a data-proof-explorer="anchor" href={separateAnchorExplorerUrl} className="proof-explorer-link inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]" target="_blank" rel="noreferrer">
                  Abrir anchor tx sin memo <ArrowRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            <details className="proof-explorer-guide proof-flat mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3" open={Boolean(requestedDecoderInput)}>
              <summary className="proof-disclosure-summary flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-black text-slate-950">
                <span>Donde esta el memo en la blockchain?</span>
                <ArrowRight className="proof-disclosure-summary__icon h-4 w-4 shrink-0 text-cyan-700" />
              </summary>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                En IOTA EVM no aparece como una frase grande en la cabecera. Esta dentro de <span className="font-mono font-black">Transaction details - Raw input</span>. El explorer muestra bytes; nexID los traduce.
              </p>
              <div className="proof-explorer-proof-path mt-3">
                {explorerProofPath.map((step) => (
                  <div key={step.title} className="rounded-2xl border border-cyan-200 bg-white/70 p-3">
                    <strong className="block text-sm text-slate-950">{step.title}</strong>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-600">{step.body}</p>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <details className="proof-anchors-panel proof-elevated rounded-[1.5rem] border border-slate-200 bg-white/82 p-4 shadow-sm" open={Boolean(eventHash && matches.length)}>
            <summary className="proof-disclosure-summary flex min-h-12 cursor-pointer items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Anchors</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{matches.length} coincidencias</h2>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700">
                <Network className="h-5 w-5" />
              </span>
            </summary>

            <div className="mt-4 grid gap-3">
              {matches.length ? matches.map((match) => (
                <article key={match.anchor_id} className="proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-sm font-bold text-slate-900">{shortHash(match.anchor_id)}</p>
                    <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em] ${statusTone(match.status)}`}>{match.status}</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <div>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">Provider</p>
                      <p className="mt-1 font-mono text-slate-900">{match.provider} / {match.network}</p>
                    </div>
                    <div>
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">Tx</p>
                      <p className="mt-1 font-mono text-slate-900">{shortHash(match.tx_hash)}</p>
                    </div>
                  </div>
                  {match.explorer_url ? (
                    <a data-proof-explorer="anchor" href={match.explorer_url} className="proof-explorer-link mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.1em]" target="_blank" rel="noreferrer">
                      Abrir anchor tx (Merkle root) <ArrowRight className="h-4 w-4" />
                    </a>
                  ) : null}
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
                  {result?.ok === false ? `El verificador respondio: ${result.reason || "error"}.` : "Ingresar un hash valido devuelve anchors compatibles y estado de inclusion."}
                </div>
              )}
            </div>
          </details>

          <details id="proof-decoder" tabIndex={-1} className="proof-decoder-panel proof-elevated scroll-mt-24 rounded-[1.5rem] border border-cyan-200 bg-cyan-50/75 p-4 shadow-sm" open={Boolean(requestedDecoderInput)}>
              <summary className="proof-disclosure-summary flex min-h-12 cursor-pointer items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Proof Decoder</p>
                  <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">Traducir Raw input a negocio.</h2>
                </div>
                <FileSearch className="mt-1 h-6 w-6 shrink-0 text-cyan-700" />
              </summary>
              <div className="proof-disclosure-body mt-4">
                <p className="text-sm leading-6 text-slate-700">
                  En IOTA EVM el memo queda dentro del campo <span className="font-mono font-black">Raw input</span>. El explorer lo muestra como hex; nexID lo decodifica como texto UTF-8 y lo explica para gerencia, auditoria o ventas.
                </p>

              <form action="/proof/verify#proof-decoder" className="proof-flat mt-4 grid gap-3 rounded-2xl border border-cyan-200 bg-white/72 p-4">
                <input type="hidden" name="scenario" value={proofHandoff.scenario} />
                <input type="hidden" name="return_to" value={demoLabBackHref} />
                {eventHash ? <input type="hidden" name="event_hash" value={eventHash} /> : null}
                {anchorId ? <input type="hidden" name="anchor_id" value={anchorId} /> : null}
                <label className="grid gap-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-800">
                  Raw input, memo o data de explorer
                  <textarea
                    name="decode_input"
                    defaultValue={decoderInput}
                    wrap="soft"
                    rows={5}
                    placeholder="0x6e657849442d70726f6f662d76317c..."
                    className="proof-decoder-input min-h-32 resize-y rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs font-bold normal-case leading-5 tracking-normal text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                  />
                </label>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-cyan-900">
                  Decodificar prueba <FileSearch className="h-4 w-4" />
                </button>
              </form>

              {decodedProof?.ok ? (
                <div className={`mt-4 rounded-2xl border p-4 ${decoderNeedsReview ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <p className={`text-[0.68rem] font-black uppercase tracking-[0.14em] ${decoderNeedsReview ? "text-amber-800" : "text-emerald-800"}`}>
                    {decoderReceiptVerified ? "Recibo demo + tx verificados" : decoderReceiptMatched ? "Recibo conocido, tx no disponible" : "Memo parseado, origen no verificado"}
                  </p>
                  <h3 className={`mt-2 text-lg font-black leading-tight ${decoderNeedsReview ? "text-amber-950" : "text-emerald-950"}`}>{decodedProof.matching_demo_case?.title || "Contenido nexID-proof-v1"}</h3>
                  <p className={`mt-2 text-sm leading-6 ${decoderNeedsReview ? "text-amber-900" : "text-emerald-900"}`}>{decodedProof.executive_summary}</p>
                  <p className={`mt-2 text-sm leading-6 ${decoderNeedsReview ? "text-amber-900" : "text-emerald-900"}`}>{decodedProof.business_meaning}</p>
                  {decoderWarnings.length ? (
                    <div className="proof-decoder-warning-panel mt-3 rounded-2xl border border-amber-200 bg-white/70 p-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-amber-800">Observaciones del decoder</p>
                      <ul className="mt-2 grid gap-1 text-sm leading-6 text-amber-900">
                        {decoderWarnings.map((warning) => (
                          <li key={warning}>- {decoderWarningLabel(warning)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : decoderInput ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  {decodedProof?.message || "No se pudo decodificar esa entrada. Pegue el Raw input completo del memo tx o un memo nexID-proof-v1."}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                <div className="proof-flat rounded-2xl border border-cyan-200 bg-white/75 p-4">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-800">Explorer Decoder para C-level</p>
                  <div className="proof-decoder-translation-grid mt-3">
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-slate-950">Raw input = memo publico</strong>
                        <span className="rounded-full border border-cyan-200 bg-white/70 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-cyan-800">IOTA Explorer</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        Esto es lo que se copia del explorer. Se ve como hex, pero representa el recibo publico escrito en la transaccion.
                      </p>
                      <p className="proof-decoder-code mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[0.72rem] font-bold leading-5 text-slate-900">
                        {decodedProof?.raw_input_hex || activeReceiptMemoHex || "Pegue un Raw input para ver el hex aca."}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-emerald-950">nexID lo traduce a negocio</strong>
                        <span className="rounded-full border border-emerald-200 bg-white/70 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-emerald-800">legible</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-emerald-900">
                        Mismo contenido, sin hex: caso, vertical, recurso, cantidad de eventos, Merkle root y politica de privacidad.
                      </p>
                      <p className="proof-decoder-code mt-2 rounded-xl border border-emerald-200 bg-white/70 p-3 font-mono text-[0.72rem] font-bold leading-5 text-emerald-950">
                        {decodedProof?.decoded_memo || guidedDemo?.public_receipt.on_chain_memo || "El texto legible aparece despues de decodificar."}
                      </p>
                    </div>
                  </div>
                </div>

                {decodedProof?.ok && decodedProof.field_explanations?.length ? (
                  <details className="proof-field-details proof-flat rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="flex items-center justify-between gap-3 text-sm font-black text-slate-950">
                      <span>Ver campos decodificados para auditoria</span>
                      <ArrowRight className="proof-field-details-icon h-4 w-4 shrink-0 text-cyan-700 transition" />
                    </summary>
                    <div className="mt-3 grid gap-2">
                      {decodedProof.field_explanations.map((field) => (
                        <div key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <strong className="text-sm text-slate-950">{field.label}</strong>
                            <span className="font-mono text-[0.68rem] font-bold text-cyan-800">{field.key}</span>
                          </div>
                          <p className="mt-1 break-all font-mono text-[0.72rem] font-bold text-slate-900">{field.value}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{field.meaning}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                {decodedProof?.ok && decodedProof.verification_steps?.length ? (
                  <div className="proof-flat rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan-800">Checklist de verificacion</p>
                    <ol className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                      {decodedProof.verification_steps.map((step, index) => (
                        <li key={step} className="grid grid-cols-[1.8rem_1fr] gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-full border border-cyan-200 bg-white/70 text-[0.68rem] font-black text-cyan-800">{index + 1}</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {decodedProof?.ok && decodedProof.private_data_not_published?.length ? (
                  <div className="proof-flat rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-amber-800">Datos privados que no se publicaron</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {decodedProof.private_data_not_published.map((item) => (
                        <span key={item} className="rounded-full border border-amber-200 bg-white/70 px-3 py-1.5 text-xs font-bold leading-tight text-amber-900">{item}</span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { title: "1. Explorer", body: "Abrir memo tx y copiar Raw input." },
                    { title: "2. Decoder", body: "nexID traduce hex a contexto." },
                    { title: "3. SHA", body: "Verificar inclusion exacta." },
                  ].map((step) => (
                    <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-700">{step.title}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{step.body}</p>
                    </div>
                  ))}
                </div>

                {decodedProof?.matching_demo_case ? (
                  <Link
                    href={verifyHrefForIdentity(
                      decodedProof.matching_demo_case.primary_event_hash,
                      decodedProof.matching_demo_case.anchor_id,
                      proofHandoff,
                    )}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-900"
                  >
                    Verificar SHA del caso <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}

                {decoderReceiptVerified && decodedProof?.publication_explorer_url ? (
                  <a href={decodedProof.publication_explorer_url} className="proof-receipt-action-link text-xs font-black uppercase tracking-[0.12em]" target="_blank" rel="noreferrer">
                    Abrir tx verificada del recibo <ArrowRight className="h-4 w-4" />
                  </a>
                ) : null}

                {!decoderReceiptVerified && decodedProof?.publication_explorer_url ? (
                  <a href={decodedProof.publication_explorer_url} className="proof-receipt-action-link text-xs font-black uppercase tracking-[0.12em]" target="_blank" rel="noreferrer">
                    Inspeccionar tx configurada <ArrowRight className="h-4 w-4" />
                  </a>
                ) : null}

                {guidedDemo?.public_receipt.explorer_url ? (
                  <a href={guidedDemo.public_receipt.explorer_url} className="proof-receipt-action-link text-xs font-black uppercase tracking-[0.12em]" target="_blank" rel="noreferrer">
                    {guidedDemo.network_verification?.receipt?.verified === true ? "Abrir tx con memo real, RPC confirmado" : "Inspeccionar memo configurado"} <ArrowRight className="h-4 w-4" />
                  </a>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href={demoLabBackHref} className="proof-nav-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">
                    {demoLabBackLabel} <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/sdk" className="proof-nav-cta proof-nav-cta--neutral inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]">
                    Ver SDK/API <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              </div>
            </details>

          <details className="proof-manager-panel proof-elevated rounded-[1.5rem] border border-emerald-200 bg-emerald-50/75 p-4 shadow-sm">
            <summary className="proof-disclosure-summary flex min-h-12 cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-emerald-800">Como se lo explicas a gerencia</span>
                <strong className="mt-2 block text-xl leading-tight text-slate-950">El explorer prueba fecha y red. nexID prueba contexto.</strong>
              </span>
              <ArrowRight className="proof-disclosure-summary__icon h-5 w-5 shrink-0 text-emerald-700" />
            </summary>
            <div className="proof-manager-explain-grid mt-4">
              <div className="proof-flat rounded-2xl border border-emerald-200 bg-white/70 p-4">
                <strong className="block text-sm text-emerald-950">Lo publico</strong>
                <p className="mt-2 text-sm leading-6 text-emerald-900">Caso, tipo de recurso, cantidad de eventos, Merkle root y politica hash-only.</p>
              </div>
              <div className="proof-flat rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <strong className="block text-sm text-amber-950">Lo privado</strong>
                <p className="mt-2 text-sm leading-6 text-amber-900">UID secreto, cliente, manifiesto, ruta, QA interno, precio, contrato y datos personales.</p>
              </div>
              <div className="proof-flat rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <strong className="block text-sm text-slate-950">El valor comercial</strong>
                <p className="mt-2 text-sm leading-6 text-slate-700">Auditoria externa sin convertir blockchain en base de datos publica. Sirve para ventas, compliance, DPP, QA y reclamos.</p>
              </div>
            </div>
          </details>
          </div>
        </section>

        {activeDemo ? (
          <section className="rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-800">
                <Network className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Capas del caso</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Que se prueba en nexID, IOTA y Polygon</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {activeDemo.proof_layers.map((layer) => (
                <article key={layer.layer} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-700">{layer.status}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{layer.layer}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{layer.purpose}</p>
                </article>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {activeDemo.tx_hash
                ? "Este caso ya tiene hash, Merkle root y transaccion IOTA testnet reales. Sirve para mostrar auditoria externa sin publicar datos privados; produccion cambia llaves, saldo, monitoreo y politica de retencion."
                : "Este caso ya tiene hash y Merkle root reales. Cuando operaciones ancla el root en testnet o mainnet, la misma pantalla muestra tx y explorer sin cambiar la experiencia."}
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-800">
                <Layers className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Como se conecta</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">De demo a prueba verificable</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {connectionCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  target={card.external ? "_blank" : undefined}
                  rel={card.external ? "noreferrer" : undefined}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/60"
                >
                  <strong className="block text-sm text-slate-950">{card.title}</strong>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">{card.body}</span>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-800">
                    {card.cta}
                    {card.external
                      ? <ExternalLink className="h-3.5 w-3.5" />
                      : <ArrowRight className="h-3.5 w-3.5" />}
                  </span>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-slate-200 bg-white/84 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-800">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Para gente normal</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Que demuestra y que no</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <strong className="text-sm text-emerald-950">Demuestra</strong>
                <p className="mt-2 text-sm leading-6 text-emerald-900">Que ese hash fue incluido en un anchor con fecha, provider, red, Merkle root y, si aplica, transaccion externa.</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <strong className="text-sm text-amber-950">No demuestra solo</strong>
                <p className="mt-2 text-sm leading-6 text-amber-900">No reemplaza la validacion NFC/SUN, el dashboard privado ni el certificado Polygon. Es una prueba externa de integridad, no una copia de toda la base.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <strong className="text-sm text-slate-950">Como se usa en ventas</strong>
                <p className="mt-2 text-sm leading-6 text-slate-600">Mostras Demo Lab, elegis un evento de negocio, ensenas su hash y despues lo verificas aca. La empresa entiende privacidad, auditoria y compliance en menos de un minuto.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 rounded-[1.5rem] border border-cyan-100 bg-cyan-50/70 p-5 text-sm leading-7 text-slate-700 sm:grid-cols-3">
          <div className="flex gap-3">
            <LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-cyan-800" />
            <p>Solo se verifica el hash. La prueba no revela UIDs, manifests ni identidad del destinatario.</p>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-800" />
            <p>Polygon queda para ownership/certificados. IOTA/local proof queda para auditoria y DPP.</p>
          </div>
          <div className="flex gap-3">
            <Network className="mt-1 h-5 w-5 shrink-0 text-cyan-800" />
            <p>La API acepta POST JSON en <span className="font-mono">/public/proof/verify</span> y <span className="font-mono">/public/proof/decode</span>.</p>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-900 bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Mensaje comercial correcto</p>
              <h2 className="mt-2 text-3xl font-black leading-tight">IOTA prueba evidencia. Polygon prueba ownership.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Proof Verify existe para explicar auditoria sin complejidad blockchain: el cliente no necesita ver contratos, wallets ni payloads privados para comprobar integridad.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Database className="mb-3 h-5 w-5 text-cyan-300" />
                <strong className="block text-sm">Backend nexID</strong>
                <span className="mt-2 block text-xs leading-5 text-slate-400">Fuente privada de verdad, policies y eventos.</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Network className="mb-3 h-5 w-5 text-emerald-300" />
                <strong className="block text-sm">IOTA opcional</strong>
                <span className="mt-2 block text-xs leading-5 text-slate-400">Anchors de hashes o Merkle roots para auditoria.</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-violet-300" />
                <strong className="block text-sm">Polygon opcional</strong>
                <span className="mt-2 block text-xs leading-5 text-slate-400">Certificados, claims, ownership y garantia transferible.</span>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
