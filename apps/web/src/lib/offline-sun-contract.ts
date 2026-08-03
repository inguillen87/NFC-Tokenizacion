export const OFFLINE_LEVEL1_SCHEMA_VERSION = 1 as const;

export const OFFLINE_SUN_STATUSES = [
  "PENDING_BACKEND_VERIFICATION",
  "SYNCING",
  "SYNCED_VALID",
  "SYNCED_INVALID",
  "REPLAY_SUSPECT",
  "SYNC_FAILED",
] as const;

export type OfflineSunStatus = (typeof OFFLINE_SUN_STATUSES)[number];

export type OfflineSunParams = {
  v?: "1";
  bid: string;
  picc_data: string;
  enc: string;
  cmac: string;
};

export type OfflinePublicProduct = {
  bid: string;
  name?: string;
  brand?: string;
  region?: string;
  origin?: string;
  storage?: string;
  notes?: string;
  agro?: {
    crop?: string;
    seedVariety?: string;
    productFamily?: string;
    activeIngredient?: string;
    formulation?: string;
    registrationNumber?: string;
    batchLot?: string;
    productionDate?: string;
    expirationDate?: string;
    distributor?: string;
    authorizedChannel?: string;
    ppeSummary?: string;
    ppeItems?: string[];
    stewardshipSummary?: string;
    stewardshipItems?: string[];
  };
  cachedAt: string;
};

export type RedactedOfflineSunResult = {
  status: Extract<OfflineSunStatus, "SYNCED_VALID" | "SYNCED_INVALID" | "REPLAY_SUSPECT">;
  verdict: "MESSAGE_VALID" | "MESSAGE_NOT_VALID" | "REPLAY_SUSPECT";
  title: string;
  message: string;
  checkedAt: string;
  publicProduct?: OfflinePublicProduct;
};

const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const HEX_RE = /^[0-9A-F]+$/i;
const SCAN_ID_RE = /^[0-9a-f]{64}$/;
const ALLOWED_PARAM_KEYS = new Set(["v", "bid", "picc_data", "enc", "cmac"]);
const MAX_PICC_DATA_HEX_CHARS = 256;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeOfflineSunParams(value: unknown):
  | { ok: true; params: OfflineSunParams }
  | { ok: false; reason: "invalid_params" | "unexpected_param" } {
  if (!isRecord(value)) return { ok: false, reason: "invalid_params" };
  if (Object.keys(value).some((key) => !ALLOWED_PARAM_KEYS.has(key))) {
    return { ok: false, reason: "unexpected_param" };
  }

  const bid = typeof value.bid === "string" ? value.bid.trim() : "";
  const piccData = typeof value.picc_data === "string" ? value.picc_data.trim().toUpperCase() : "";
  const enc = typeof value.enc === "string" ? value.enc.trim().toUpperCase() : "";
  const cmac = typeof value.cmac === "string" ? value.cmac.trim().toUpperCase() : "";
  const version = value.v == null || value.v === "" ? undefined : value.v;

  if (!BID_RE.test(bid)) return { ok: false, reason: "invalid_params" };
  if (
    !HEX_RE.test(piccData)
    || piccData.length < 2
    || piccData.length > MAX_PICC_DATA_HEX_CHARS
    || piccData.length % 2 !== 0
  ) {
    return { ok: false, reason: "invalid_params" };
  }
  if (!HEX_RE.test(enc) || enc.length !== 32) return { ok: false, reason: "invalid_params" };
  if (!HEX_RE.test(cmac) || cmac.length !== 16) return { ok: false, reason: "invalid_params" };
  if (version !== undefined && version !== "1") return { ok: false, reason: "invalid_params" };

  return {
    ok: true,
    params: {
      ...(version === "1" ? { v: "1" as const } : {}),
      bid,
      picc_data: piccData,
      enc,
      cmac,
    },
  };
}

export function canonicalOfflineSunPath(params: OfflineSunParams) {
  const query = new URLSearchParams();
  if (params.v) query.set("v", params.v);
  query.set("bid", params.bid);
  query.set("picc_data", params.picc_data);
  query.set("enc", params.enc);
  query.set("cmac", params.cmac);
  return `/sun?${query.toString()}`;
}

export async function offlineSunIdFromParams(params: OfflineSunParams) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalOfflineSunPath(params)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isOfflineSunScanId(value: unknown): value is string {
  return typeof value === "string" && SCAN_ID_RE.test(value);
}

export function buildConfiguredSunTarget(apiBase: string, params: OfflineSunParams) {
  const target = new URL("/sun", apiBase);
  const canonical = new URL(canonicalOfflineSunPath(params), "https://offline.invalid");
  canonical.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  return target;
}

export type OfflineSunSyncExecution =
  | { ok: true; result: RedactedOfflineSunResult }
  | {
      ok: false;
      reason: "rate_limited" | "sync_unavailable" | "invalid_upstream_response";
      status: 429 | 502 | 503;
      retryAfter?: number;
    };

function boundedRetryAfter(value: string | null) {
  const parsed = Number(value || "0");
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 300 ? parsed : 30;
}

async function readBoundedResponseRecord(response: Response, maxBytes: number) {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  let raw = "";
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } else {
    raw = await response.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) return null;
  }
  try {
    const value = JSON.parse(raw) as unknown;
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export async function executeConfiguredOfflineSunSync(
  apiBase: string,
  params: OfflineSunParams,
  options: {
    fetcher?: typeof fetch;
    maxResponseBytes?: number;
    timeoutMs?: number;
    checkedAt?: string;
  } = {},
): Promise<OfflineSunSyncExecution> {
  const target = buildConfiguredSunTarget(apiBase, params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  let upstream: Response;
  try {
    upstream = await (options.fetcher || fetch)(target, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    return { ok: false, reason: "sync_unavailable", status: 503, retryAfter: 15 };
  } finally {
    clearTimeout(timeout);
  }

  if (upstream.status === 429) {
    return {
      ok: false,
      reason: "rate_limited",
      status: 429,
      retryAfter: boundedRetryAfter(upstream.headers.get("retry-after")),
    };
  }
  if (upstream.status >= 500 || [401, 403, 405].includes(upstream.status)) {
    return { ok: false, reason: "sync_unavailable", status: 503, retryAfter: 15 };
  }

  const payload = await readBoundedResponseRecord(upstream, options.maxResponseBytes ?? 65_536);
  if (!payload) return { ok: false, reason: "invalid_upstream_response", status: 502 };
  return {
    ok: true,
    result: redactOfflineSunUpstream(payload, params.bid, options.checkedAt),
  };
}

function upper(value: unknown) {
  return cleanText(value, 80).toUpperCase();
}

function sanitizePublicProduct(payload: Record<string, unknown>, bid: string, checkedAt: string) {
  const product = isRecord(payload.product) ? payload.product : {};
  const agro = isRecord(product.agro) ? product.agro : {};
  const ppe = isRecord(agro.ppe) ? agro.ppe : {};
  const stewardship = isRecord(agro.stewardship) ? agro.stewardship : {};
  const tenant = isRecord(payload.tenant) ? payload.tenant : {};
  const provenance = isRecord(payload.provenance) ? payload.provenance : {};
  const cleanList = (value: unknown) => Array.isArray(value)
    ? value.map((item) => cleanText(item, 180)).filter(Boolean).slice(0, 12)
    : [];
  const agroCandidate = {
    crop: cleanText(agro.crop, 120) || undefined,
    seedVariety: cleanText(agro.seedVariety, 160) || undefined,
    productFamily: cleanText(agro.productFamily, 160) || undefined,
    activeIngredient: cleanText(agro.activeIngredient, 240) || undefined,
    formulation: cleanText(agro.formulation, 160) || undefined,
    registrationNumber: cleanText(agro.registrationNumber, 160) || undefined,
    batchLot: cleanText(agro.batchLot, 160) || undefined,
    productionDate: cleanText(agro.productionDate, 40) || undefined,
    expirationDate: cleanText(agro.expirationDate, 40) || undefined,
    distributor: cleanText(agro.distributor, 200) || undefined,
    authorizedChannel: cleanText(agro.authorizedChannel, 200) || undefined,
    ppeSummary: cleanText(ppe.summary, 600) || undefined,
    ppeItems: cleanList(ppe.items),
    stewardshipSummary: cleanText(stewardship.summary, 1_000) || undefined,
    stewardshipItems: cleanList(stewardship.items),
  };
  const candidate: OfflinePublicProduct = {
    bid,
    name: cleanText(product.name, 120) || undefined,
    brand: cleanText(tenant.name, 120) || cleanText(product.winery, 120) || undefined,
    region: cleanText(product.region, 120) || undefined,
    origin: cleanText(provenance.origin, 160) || undefined,
    storage: cleanText(product.storage, 180) || undefined,
    notes: cleanText(product.notes, 320) || undefined,
    agro: Object.values(agroCandidate).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value))
      ? agroCandidate
      : undefined,
    cachedAt: checkedAt,
  };
  return Object.values(candidate).some((value) => Boolean(value) && value !== bid && value !== checkedAt)
    ? candidate
    : undefined;
}

export function redactOfflineSunUpstream(
  payload: unknown,
  bid: string,
  checkedAt = new Date().toISOString(),
): RedactedOfflineSunResult {
  const root = isRecord(payload) ? payload : {};
  const status = isRecord(root.status) ? root.status : {};
  const code = upper(status.code || root.verdict);
  const productState = upper(status.productState);
  const reason = upper(status.reason || root.reason);
  const combined = `${code} ${productState} ${reason}`;
  const publicProduct = sanitizePublicProduct(root, bid, checkedAt);

  if (combined.includes("REPLAY")) {
    return {
      status: "REPLAY_SUSPECT",
      verdict: "REPLAY_SUSPECT",
      title: "Repetición detectada",
      message: "El backend reconoció un mensaje ya utilizado. Hacé un nuevo tap físico para obtener una lectura fresca.",
      checkedAt,
      ...(publicProduct ? { publicProduct } : {}),
    };
  }

  const isValid =
    root.ok === true
    && (
      productState.startsWith("VALID_")
      || ["VALID", "AUTH_OK", "OPENED", "OPENED_PREVIOUSLY", "MANUAL_OPENED"].includes(code)
    );
  if (isValid) {
    return {
      status: "SYNCED_VALID",
      verdict: "MESSAGE_VALID",
      title: "Validación online completada",
      message: "El backend aceptó el mensaje SUN/CMAC. Este resultado no acredita por sí solo contenido físico, origen, custodia ni propiedad.",
      checkedAt,
      ...(publicProduct ? { publicProduct } : {}),
    };
  }

  return {
    status: "SYNCED_INVALID",
    verdict: "MESSAGE_NOT_VALID",
    title: "Lectura no validada",
    message: "El backend no pudo validar el mensaje. No uses esta lectura para habilitar acciones sensibles; repetí el tap físico.",
    checkedAt,
    ...(publicProduct ? { publicProduct } : {}),
  };
}

export function isTerminalOfflineSunStatus(status: OfflineSunStatus) {
  return status === "SYNCED_VALID" || status === "SYNCED_INVALID" || status === "REPLAY_SUSPECT";
}

export function isOfflineSunStatus(value: unknown): value is OfflineSunStatus {
  return typeof value === "string" && OFFLINE_SUN_STATUSES.some((status) => status === value);
}
