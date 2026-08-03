export const NEXID_API_BASE_URL = "https://api.nexid.lat";
export const NEXID_VERIFY_ROUTE = "/api/v1/sdk/verify";

export type DeveloperDataMode = "production" | "demo" | "unknown";

export const NEXID_WEBHOOK_SIGNATURE_CONTRACT = {
  version: "v2",
  supportedVersions: ["v1", "v2"],
  algorithm: "HMAC-SHA256",
  toleranceSeconds: 300,
  headers: {
    version: "x-nexid-signature-version",
    timestamp: "x-nexid-timestamp",
    keyId: "x-nexid-key-id",
    deliveryId: "x-nexid-delivery-id",
    eventId: "x-nexid-event-id",
    signature: "x-nexid-signature",
  },
} as const;

function payloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function resolveDeveloperResponseDataMode(input: {
  payload: unknown;
  headerDataMode?: string | null;
  headerDemoData?: string | null;
}): Exclude<DeveloperDataMode, "unknown"> {
  const payload = payloadRecord(input.payload);
  const headerMode = String(input.headerDataMode || "").trim().toLowerCase();
  const headerDemo = String(input.headerDemoData || "").trim().toLowerCase();
  const payloadMode = String(payload.dataSource || "").trim().toLowerCase();
  const isDemo = headerMode === "demo"
    || headerDemo === "demo data"
    || payloadMode === "demo"
    || payload.demoMode === true;
  return isDemo ? "demo" : "production";
}

export function combineDeveloperDataModes(modes: readonly DeveloperDataMode[]): DeveloperDataMode {
  if (modes.includes("demo")) return "demo";
  if (modes.length > 0 && modes.every((mode) => mode === "production")) return "production";
  return "unknown";
}

export function isCurrentDeveloperLoad(input: {
  requestId: number;
  activeRequestId: number;
  aborted?: boolean;
}) {
  return !input.aborted && input.requestId === input.activeRequestId;
}

export function developerMutationsAllowed(input: {
  dataMode: DeveloperDataMode;
  loading: boolean;
}) {
  return input.dataMode === "production" && !input.loading;
}

export const SDK_SCOPE_OPTIONS = [
  {
    value: "sdk:verify",
    label: "Verificar tags",
    description: "Valida el mensaje NFC y, cuando aplica, CMAC y contador; no certifica por sí solo el contenido físico.",
    access: "write",
  },
  {
    value: "sdk:products",
    label: "Leer productos",
    description: "Consulta producto, lote, carrier y estado operativo.",
    access: "read",
  },
  {
    value: "sdk:pos",
    label: "Activar compras POS",
    description: "Registra una compra y emite un token POS de vida corta.",
    access: "write",
  },
  {
    value: "sdk:claim",
    label: "Gestionar ownership",
    description: "Crea claims sujetos a la política de compra del lote.",
    access: "write",
  },
  {
    value: "sdk:events",
    label: "Reportar eventos",
    description: "Incorpora eventos externos desde ERP, CRM o e-commerce.",
    access: "write",
  },
  {
    value: "sdk:logistics",
    label: "Operar logística",
    description: "Registra estados TT, handoffs y controles de recepción; no prueba por sí solo contenido ni custodia física.",
    access: "write",
  },
  {
    value: "sdk:epcis:read",
    label: "Consultar EPCIS",
    description: "Consulta y exporta el perfil EPCIS/CBV 2.0 acotado del tenant con paginación por cursor.",
    access: "read",
  },
  {
    value: "sdk:epcis:write",
    label: "Capturar EPCIS",
    description: "Captura documentos EPCIS JSON/JSON-LD validados contra el registro GS1 del tenant; no equivale a autenticación NFC.",
    access: "write",
  },
] as const;

export type SdkApiKeyScope = (typeof SDK_SCOPE_OPTIONS)[number]["value"];

export const SDK_INTEGRATION_PROFILES = [
  {
    id: "pilot",
    label: "Piloto / pyme",
    title: "Evidencia NFC y catálogo",
    description: "La ruta mínima para validar tags desde un backend y consultar el lote.",
    scopes: ["sdk:verify", "sdk:products"],
    keyName: "production · verify backend",
    webhookEvents: ["sdk.verify"],
  },
  {
    id: "commerce",
    label: "Comercio",
    title: "POS + ownership",
    description: "Para e-commerce o retail que separa lectura, compra y reclamo de propiedad.",
    scopes: ["sdk:verify", "sdk:products", "sdk:pos", "sdk:claim"],
    keyName: "production · commerce backend",
    webhookEvents: ["sdk.verify", "sdk.pos.activated", "sdk.claim.created", "sdk.claim.claimed"],
  },
  {
    id: "supply-chain",
    label: "Enterprise",
    title: "Supply chain",
    description: "Para ERP, secuencias de manipulación declaradas, controles de recepción y eventos externos.",
    scopes: ["sdk:verify", "sdk:products", "sdk:events", "sdk:logistics", "sdk:epcis:read", "sdk:epcis:write"],
    keyName: "production · supply-chain service",
    webhookEvents: ["sdk.verify", "sdk.external_event"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  title: string;
  description: string;
  scopes: readonly SdkApiKeyScope[];
  keyName: string;
  webhookEvents: readonly WebhookEventName[];
}[];

export type SdkIntegrationProfileId = (typeof SDK_INTEGRATION_PROFILES)[number]["id"];

export const WEBHOOK_EVENT_OPTIONS = [
  { value: "sdk.verify", label: "Verificación", description: "Resultado de validación del mensaje NFC." },
  { value: "sdk.pos.activated", label: "Compra POS", description: "Activación emitida por una compra válida." },
  { value: "sdk.claim.created", label: "Claim creado", description: "Inicio del flujo de ownership." },
  { value: "sdk.claim.claimed", label: "Ownership confirmado", description: "Claim confirmado según la política del lote." },
  { value: "sdk.external_event", label: "Evento externo", description: "Evento aceptado desde un sistema del cliente." },
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENT_OPTIONS)[number]["value"];

export type DeveloperReadinessStep = {
  id: "tenant" | "key" | "first-call" | "webhook" | "delivery";
  label: string;
  detail: string;
  complete: boolean;
  optional: boolean;
};

export function developerReadiness(input: {
  tenantSelected: boolean;
  activeKeys: number;
  monthRequests: number;
  enabledWebhooks: number;
  successfulDeliveries: number;
  dataMode?: DeveloperDataMode;
}) {
  const dataMode = input.dataMode || "production";
  const productionEvidence = dataMode === "production";
  const tenantEvidence = productionEvidence && input.tenantSelected;
  const steps: DeveloperReadinessStep[] = [
    {
      id: "tenant",
      label: "Tenant confirmado",
      detail: productionEvidence
        ? "Toda credencial y entrega queda aislada dentro de este tenant."
        : "La selección demo no acredita un tenant operativo de producción.",
      complete: tenantEvidence,
      optional: false,
    },
    {
      id: "key",
      label: "Key de mínimo privilegio",
      detail: productionEvidence
        ? "Usá una key por servicio y sólo los scopes necesarios."
        : "Las credenciales de muestra no cuentan como evidencia de integración.",
      complete: tenantEvidence && input.activeKeys > 0,
      optional: false,
    },
    {
      id: "first-call",
      label: "Primera llamada recibida",
      detail: productionEvidence
        ? "La métrica mensual confirma que el backend cliente llegó a nexID."
        : "El tráfico simulado no completa el onboarding de producción.",
      complete: tenantEvidence && input.monthRequests > 0,
      optional: false,
    },
    {
      id: "webhook",
      label: "Webhook firmado",
      detail: productionEvidence
        ? "Necesario cuando ERP, CRM o e-commerce deben reaccionar a eventos."
        : "El destino de ejemplo es ilustrativo y permanece en sólo lectura.",
      complete: tenantEvidence && input.enabledWebhooks > 0,
      optional: true,
    },
    {
      id: "delivery",
      label: "Entrega 2xx observada",
      detail: productionEvidence
        ? "Una entrega real valida URL, firma y respuesta del receptor."
        : "Una entrega demo no prueba conectividad con el receptor del cliente.",
      complete: tenantEvidence && input.successfulDeliveries > 0,
      optional: true,
    },
  ];
  const required = steps.filter((step) => !step.optional);
  const requiredComplete = required.filter((step) => step.complete).length;
  return {
    steps,
    requiredComplete,
    requiredTotal: required.length,
    percentage: Math.round((requiredComplete / required.length) * 100),
    productionReady: tenantEvidence && requiredComplete === required.length,
    dataMode,
  };
}

function safeTenantSlug(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(normalized) || /^[a-z0-9]$/.test(normalized)
    ? normalized
    : "your-tenant";
}

function safeBatchId(value: string) {
  const normalized = String(value || "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(normalized) ? normalized : "YOUR-BATCH-ID";
}

export function buildVerifyQuickstart(input: { tenantSlug: string; bid: string }) {
  const tenantSlug = safeTenantSlug(input.tenantSlug);
  const bid = safeBatchId(input.bid);
  const payload = {
    bid,
    picc_data: "PICC_DATA_FROM_NFC_READ",
    enc: "ENC_FROM_NFC_READ",
    cmac: "CMAC_FROM_NFC_READ",
  };
  const prettyPayload = JSON.stringify(payload, null, 2);

  return {
    curl: `export NEXID_API_KEY="read-from-your-secret-manager"

curl --fail-with-body --request POST "${NEXID_API_BASE_URL}${NEXID_VERIFY_ROUTE}" \\
  --header "content-type: application/json" \\
  --header "x-nexid-api-key: $NEXID_API_KEY" \\
  --header "x-nexid-tenant-slug: ${tenantSlug}" \\
  --data-binary @- <<'JSON'
${prettyPayload}
JSON`,
    node: `const apiKey = process.env.NEXID_API_KEY;
if (!apiKey) throw new Error("NEXID_API_KEY is required");

const response = await fetch("${NEXID_API_BASE_URL}${NEXID_VERIFY_ROUTE}", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-nexid-api-key": apiKey,
    "x-nexid-tenant-slug": "${tenantSlug}",
  },
  body: JSON.stringify(${prettyPayload}),
});

const result = await response.json();
if (!response.ok) {
  throw new Error(\`nexID \${response.status}: \${result.reason ?? "request_failed"}\`);
}
console.log({ verdict: result.verdict, traceId: result.traceId });`,
  };
}

export function buildWebhookVerificationQuickstart() {
  return `import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.NEXID_WEBHOOK_SECRET;
if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
  throw new Error("NEXID_WEBHOOK_SECRET must contain at least 32 bytes");
}

export async function POST(request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const header = (name) => request.headers.get(name)?.trim() || "";
  const version = header("x-nexid-signature-version");
  const timestampHeader = header("x-nexid-timestamp");
  const keyId = header("x-nexid-key-id");
  const deliveryId = header("x-nexid-delivery-id");
  const eventId = header("x-nexid-event-id");
  const signature = header("x-nexid-signature");
  const timestamp = Number(timestampHeader);

  const headersAreValid = (version === "v1" || version === "v2")
    && /^\\d{1,12}$/.test(timestampHeader)
    && Number.isSafeInteger(timestamp)
    && timestamp > 0
    && Boolean(keyId && deliveryId && eventId);
  const timestampIsFresh = Math.abs(Math.floor(Date.now() / 1000) - timestamp) <= 300;
  const signatureMatch = new RegExp(\`^\${version}=([a-f0-9]{64})$\`).exec(signature);
  if (!headersAreValid || !timestampIsFresh || !signatureMatch) {
    return new Response("invalid webhook signature", { status: 401 });
  }

  const authenticatedKeyId = version === "v2"
    ? [Buffer.byteLength(keyId, "utf8"), keyId]
    : [];
  const prefix = [
    version,
    timestampHeader,
    ...authenticatedKeyId,
    Buffer.byteLength(deliveryId, "utf8"),
    deliveryId,
    Buffer.byteLength(eventId, "utf8"),
    eventId,
    rawBody.byteLength,
    "",
  ].join(".");
  const expected = createHmac("sha256", secret)
    .update(prefix, "utf8")
    .update(rawBody)
    .digest();
  const received = Buffer.from(signatureMatch[1], "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return new Response("invalid webhook signature", { status: 401 });
  }

  const event = JSON.parse(rawBody.toString("utf8"));
  return Response.json({
    received: true,
    eventId,
    type: event.type,
    keyIdAuthenticated: version === "v2",
  });
}`;
}

const DEVELOPER_ERROR_COPY: Record<string, string> = {
  tenant_not_found: "El tenant no existe o no está disponible para tu sesión.",
  tenant_required_or_not_found: "Seleccioná un tenant válido antes de crear la credencial.",
  invalid_scope_set: "La combinación de scopes no es válida. Elegí un perfil recomendado o revisá la selección.",
  empty_scope_set: "Seleccioná al menos un scope para esta integración.",
  webhook_signing_secret_required: "El webhook activo necesita un signing secret de al menos 32 bytes.",
  webhook_signing_secret_too_short: "El signing secret es demasiado corto: usá al menos 32 bytes aleatorios.",
  webhook_private_ip_not_allowed: "La URL resuelve a una red privada o reservada. Usá un endpoint HTTPS público.",
  webhook_redirect_not_allowed: "El endpoint respondió con una redirección. Configurá la URL HTTPS final.",
  rate_limited: "Se alcanzó el límite de solicitudes. Esperá el Retry-After antes de reintentar.",
};

export function developerErrorMessage(reason: unknown, fallback: string) {
  const normalized = String(reason || "").trim();
  if (!normalized) return fallback;
  return DEVELOPER_ERROR_COPY[normalized] || normalized.replaceAll("_", " ");
}

export function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}
