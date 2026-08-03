import { createHash, webcrypto } from "node:crypto";

export const OFFLINE_PUBLIC_CERTIFICATE_PROFILE = "nexid-offline-public-certificate/v1" as const;
export const OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM = "ES256" as const;
export const OFFLINE_PUBLIC_CERTIFICATE_TYPE = "nexid-offline-public-certificate+jws" as const;
export const OFFLINE_PUBLIC_CERTIFICATE_MAX_BYTES = 16_384;
export const OFFLINE_PUBLIC_CERTIFICATE_DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const OFFLINE_PUBLIC_CERTIFICATE_MAX_TTL_SECONDS = 30 * 24 * 60 * 60;

const PRIVATE_JWK_ENV = "OFFLINE_PUBLIC_CERTIFICATE_PRIVATE_JWK";
const PUBLIC_JWKS_ENV = "OFFLINE_PUBLIC_CERTIFICATE_JWKS";
const KID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const BID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const QUALIFIER_RE = /^[\x21-\x7e]{1,20}$/;

export type OfflinePublicCertificatePayload = {
  schema_version: typeof OFFLINE_PUBLIC_CERTIFICATE_PROFILE;
  scope: "PUBLIC_PRODUCT_INFORMATION";
  issuer: string;
  tenant_slug: string;
  product_id: string;
  batch_id: string;
  gtin: string;
  lot?: string;
  serial?: string;
  issued_at: string;
  expires_at: string;
  public_data: {
    display_name?: string;
    brand?: string;
    sku?: string;
    description?: string;
    image_url?: string;
    safety_sheet_url?: string;
    stewardship_url?: string;
    manual_url?: string;
    dpp_url?: string;
  };
  assurance: {
    public_information_signature: "VERIFIABLE_OFFLINE";
    nfc_sun_freshness: "NOT_EVALUATED";
    physical_authenticity: "NOT_ASSERTED";
  };
};

export type OfflinePublicCertificateEnvelope = {
  schema_version: typeof OFFLINE_PUBLIC_CERTIFICATE_PROFILE;
  alg: typeof OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM;
  kid: string;
  jwks_url: string;
  protected: string;
  payload: OfflinePublicCertificatePayload;
  payload_hash: `sha256-${string}`;
  signature: string;
};

type JsonObject = Record<string, unknown>;

export class OfflinePublicCertificateError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 503) {
    super(code);
    this.name = "OfflinePublicCertificateError";
    this.code = code;
    this.status = status;
  }
}

function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Deterministic JSON used by the certificate signature. Objects are sorted by
 * key and unsupported JSON values are rejected instead of being silently lost.
 */
export function canonicalizeOfflineCertificateJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new OfflinePublicCertificateError("offline_certificate_payload_invalid", 400);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeOfflineCertificateJson(entry)).join(",")}]`;
  }
  if (!isPlainObject(value)) {
    throw new OfflinePublicCertificateError("offline_certificate_payload_invalid", 400);
  }
  const entries = Object.keys(value).sort().map((key) => {
    const entry = value[key];
    if (entry === undefined || typeof entry === "function" || typeof entry === "symbol" || typeof entry === "bigint") {
      throw new OfflinePublicCertificateError("offline_certificate_payload_invalid", 400);
    }
    return `${JSON.stringify(key)}:${canonicalizeOfflineCertificateJson(entry)}`;
  });
  return `{${entries.join(",")}}`;
}

function base64Url(value: Uint8Array | string) {
  return Buffer.from(value).toString("base64url");
}

function parseJsonEnvironment(name: string, maxBytes: number) {
  const raw = String(process.env[name] || "").trim();
  if (!raw || Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
}

function strictBase64UrlBytes(value: unknown, expectedBytes: number) {
  const encoded = String(value || "");
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return false;
  try {
    const decoded = Buffer.from(encoded, "base64url");
    return decoded.length === expectedBytes && decoded.toString("base64url") === encoded;
  } catch {
    return false;
  }
}

function cleanPublicJwk(value: unknown) {
  if (!isPlainObject(value)) throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  const kid = String(value.kid || "");
  const keyOps = Array.isArray(value.key_ops) ? value.key_ops.map(String) : [];
  if (
    value.kty !== "EC"
    || value.crv !== "P-256"
    || value.alg !== OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM
    || value.use !== "sig"
    || !KID_RE.test(kid)
    || keyOps.length !== 1
    || keyOps[0] !== "verify"
    || !strictBase64UrlBytes(value.x, 32)
    || !strictBase64UrlBytes(value.y, 32)
    || Object.prototype.hasOwnProperty.call(value, "d")
  ) {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: String(value.x),
    y: String(value.y),
    use: "sig",
    alg: OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM,
    kid,
    key_ops: ["verify"],
  } satisfies JsonWebKey & { kid: string };
}

function readPublicJwksConfiguration() {
  const jwksCandidate = parseJsonEnvironment(PUBLIC_JWKS_ENV, 32_768);
  if (!isPlainObject(jwksCandidate) || !Array.isArray(jwksCandidate.keys)) {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  if (jwksCandidate.keys.length < 1 || jwksCandidate.keys.length > 10) {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  const keys = jwksCandidate.keys.map(cleanPublicJwk);
  if (new Set(keys.map((key) => key.kid)).size !== keys.length) {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  return { keys: keys.sort((left, right) => left.kid.localeCompare(right.kid)) };
}

function readSigningConfiguration() {
  const privateCandidate = parseJsonEnvironment(PRIVATE_JWK_ENV, 8_192);
  if (!isPlainObject(privateCandidate)) {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  const jwks = readPublicJwksConfiguration();
  const privateKid = String(privateCandidate.kid || "");
  const privateOps = Array.isArray(privateCandidate.key_ops) ? privateCandidate.key_ops.map(String) : [];
  if (
    privateCandidate.kty !== "EC"
    || privateCandidate.crv !== "P-256"
    || privateCandidate.alg !== OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM
    || privateCandidate.use !== "sig"
    || !KID_RE.test(privateKid)
    || privateOps.length !== 1
    || privateOps[0] !== "sign"
    || !strictBase64UrlBytes(privateCandidate.x, 32)
    || !strictBase64UrlBytes(privateCandidate.y, 32)
    || !strictBase64UrlBytes(privateCandidate.d, 32)
  ) {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  const publicKey = jwks.keys.find((key) => key.kid === privateKid);
  if (!publicKey || publicKey.x !== privateCandidate.x || publicKey.y !== privateCandidate.y) {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  return {
    privateKey: { ...privateCandidate } as JsonWebKey,
    kid: privateKid,
    jwks,
  };
}

function configuredIssuer() {
  const candidate = String(process.env.OFFLINE_PUBLIC_CERTIFICATE_ISSUER || "https://api.nexid.lat").trim();
  try {
    const url = new URL(candidate);
    const localDevelopment = process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !localDevelopment) || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
      throw new Error("invalid");
    }
    return url.origin;
  } catch {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
}

function configuredTtlSeconds() {
  const raw = String(process.env.OFFLINE_PUBLIC_CERTIFICATE_TTL_SECONDS || "").trim();
  if (!raw) return OFFLINE_PUBLIC_CERTIFICATE_DEFAULT_TTL_SECONDS;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 300 || parsed > OFFLINE_PUBLIC_CERTIFICATE_MAX_TTL_SECONDS) {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  return parsed;
}

function isValidGtin14(gtin: string) {
  if (!/^\d{14}$/.test(gtin)) return false;
  let sum = 0;
  for (let index = 0; index < 13; index += 1) sum += Number(gtin[index]) * (index % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(gtin[13]);
}

function cleanPublicText(value: unknown, maxLength: number) {
  const text = typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
    : "";
  return text ? text.slice(0, maxLength) : undefined;
}

function cleanPublicHttpsUrl(value: unknown) {
  const candidate = cleanPublicText(value, 2_048);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function selectOfflinePublicProductData(displayName: unknown, metadata: unknown) {
  const source = isPlainObject(metadata) && isPlainObject(metadata.offline_public)
    ? metadata.offline_public
    : {};
  return Object.fromEntries(Object.entries({
    display_name: cleanPublicText(displayName, 240),
    brand: cleanPublicText(source.brand, 160),
    sku: cleanPublicText(source.sku, 120),
    description: cleanPublicText(source.description, 1_000),
    image_url: cleanPublicHttpsUrl(source.image_url),
    safety_sheet_url: cleanPublicHttpsUrl(source.safety_sheet_url),
    stewardship_url: cleanPublicHttpsUrl(source.stewardship_url),
    manual_url: cleanPublicHttpsUrl(source.manual_url),
    dpp_url: cleanPublicHttpsUrl(source.dpp_url),
  }).filter(([, value]) => value !== undefined)) as OfflinePublicCertificatePayload["public_data"];
}

function normalizeIdentity(input: {
  tenantSlug: unknown;
  bid: unknown;
  gtin: unknown;
  lot?: unknown;
  serial?: unknown;
}) {
  const tenantSlug = String(input.tenantSlug || "").trim().toLowerCase();
  const batchId = String(input.bid || "").trim();
  const gtin = String(input.gtin || "").trim();
  const lot = String(input.lot || "").trim();
  const serial = String(input.serial || "").trim();
  if (
    !TENANT_SLUG_RE.test(tenantSlug)
    || !BID_RE.test(batchId)
    || !isValidGtin14(gtin)
    || (lot && (!QUALIFIER_RE.test(lot) || /[\/?#]/.test(lot)))
    || (serial && (!QUALIFIER_RE.test(serial) || /[\/?#]/.test(serial)))
  ) {
    throw new OfflinePublicCertificateError("offline_certificate_identity_invalid", 400);
  }
  return { tenantSlug, batchId, gtin, lot, serial };
}

function digitalLinkProductId(identity: ReturnType<typeof normalizeIdentity>) {
  let path = `/01/${encodeURIComponent(identity.gtin)}`;
  if (identity.lot) path += `/10/${encodeURIComponent(identity.lot)}`;
  if (identity.serial) path += `/21/${encodeURIComponent(identity.serial)}`;
  return `https://id.nexid.lat${path}`;
}

function sha256Base64Url(value: string) {
  return base64Url(createHash("sha256").update(value, "utf8").digest());
}

export function readOfflinePublicCertificateJwks() {
  return readPublicJwksConfiguration();
}

export async function createOfflinePublicCertificate(input: {
  tenantSlug: unknown;
  bid: unknown;
  gtin: unknown;
  lot?: unknown;
  serial?: unknown;
  displayName?: unknown;
  metadata?: unknown;
  now?: Date;
}) {
  const identity = normalizeIdentity(input);
  const { privateKey, kid } = readSigningConfiguration();
  const issuer = configuredIssuer();
  const now = input.now ? new Date(input.now) : new Date();
  if (!Number.isFinite(now.getTime())) throw new OfflinePublicCertificateError("offline_certificate_time_invalid", 400);
  const expiresAt = new Date(now.getTime() + configuredTtlSeconds() * 1_000);
  const payload: OfflinePublicCertificatePayload = {
    schema_version: OFFLINE_PUBLIC_CERTIFICATE_PROFILE,
    scope: "PUBLIC_PRODUCT_INFORMATION",
    issuer,
    tenant_slug: identity.tenantSlug,
    product_id: digitalLinkProductId(identity),
    batch_id: identity.batchId,
    gtin: identity.gtin,
    ...(identity.lot ? { lot: identity.lot } : {}),
    ...(identity.serial ? { serial: identity.serial } : {}),
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    public_data: selectOfflinePublicProductData(input.displayName, input.metadata),
    assurance: {
      public_information_signature: "VERIFIABLE_OFFLINE",
      nfc_sun_freshness: "NOT_EVALUATED",
      physical_authenticity: "NOT_ASSERTED",
    },
  };
  const protectedHeader = {
    alg: OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM,
    kid,
    typ: OFFLINE_PUBLIC_CERTIFICATE_TYPE,
    cty: "application/json",
    schema: OFFLINE_PUBLIC_CERTIFICATE_PROFILE,
  };
  const canonicalPayload = canonicalizeOfflineCertificateJson(payload);
  if (Buffer.byteLength(canonicalPayload, "utf8") > OFFLINE_PUBLIC_CERTIFICATE_MAX_BYTES) {
    throw new OfflinePublicCertificateError("offline_certificate_payload_too_large", 413);
  }
  const protectedValue = base64Url(canonicalizeOfflineCertificateJson(protectedHeader));
  const signingInput = `${protectedValue}.${base64Url(canonicalPayload)}`;
  let signature: ArrayBuffer;
  try {
    const key = await webcrypto.subtle.importKey(
      "jwk",
      privateKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    signature = await webcrypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput),
    );
  } catch {
    throw new OfflinePublicCertificateError("offline_public_certificate_signer_unavailable");
  }
  const envelope: OfflinePublicCertificateEnvelope = {
    schema_version: OFFLINE_PUBLIC_CERTIFICATE_PROFILE,
    alg: OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM,
    kid,
    jwks_url: `${issuer}/public/offline-certificates/jwks`,
    protected: protectedValue,
    payload,
    payload_hash: `sha256-${sha256Base64Url(canonicalPayload)}`,
    signature: base64Url(new Uint8Array(signature)),
  };
  if (Buffer.byteLength(canonicalizeOfflineCertificateJson(envelope), "utf8") > OFFLINE_PUBLIC_CERTIFICATE_MAX_BYTES) {
    throw new OfflinePublicCertificateError("offline_certificate_payload_too_large", 413);
  }
  return envelope;
}
