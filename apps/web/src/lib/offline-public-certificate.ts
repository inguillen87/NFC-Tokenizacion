export const OFFLINE_PUBLIC_CERTIFICATE_PROFILE = "nexid-offline-public-certificate/v1" as const;
export const OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM = "ES256" as const;
export const OFFLINE_PUBLIC_CERTIFICATE_TYPE = "nexid-offline-public-certificate+jws" as const;
export const OFFLINE_PUBLIC_CERTIFICATE_MAX_BYTES = 16_384;

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
  public_data: Record<string, string>;
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
  payload_hash: string;
  signature: string;
};

export type OfflinePublicCertificateVerification =
  | { valid: true; reason: "verified"; payload: OfflinePublicCertificatePayload; kid: string }
  | { valid: false; reason: "malformed" | "unsupported" | "key_not_found" | "signature_invalid" | "not_yet_valid" | "expired" | "crypto_unavailable" };

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function canonicalizeOfflineCertificateJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("malformed");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeOfflineCertificateJson).join(",")}]`;
  if (!isPlainObject(value)) throw new Error("malformed");
  return `{${Object.keys(value).sort().map((key) => {
    const entry = value[key];
    if (entry === undefined || typeof entry === "function" || typeof entry === "symbol" || typeof entry === "bigint") {
      throw new Error("malformed");
    }
    return `${JSON.stringify(key)}:${canonicalizeOfflineCertificateJson(entry)}`;
  }).join(",")}}`;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToBytes(value: unknown, expectedBytes?: number) {
  const encoded = String(value || "");
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("malformed");
  const padding = "=".repeat((4 - (encoded.length % 4)) % 4);
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if ((expectedBytes !== undefined && bytes.length !== expectedBytes) || bytesToBase64Url(bytes) !== encoded) {
    throw new Error("malformed");
  }
  return bytes;
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function ownedArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function isValidGtin14(gtin: string) {
  if (!/^\d{14}$/.test(gtin)) return false;
  let sum = 0;
  for (let index = 0; index < 13; index += 1) sum += Number(gtin[index]) * (index % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(gtin[13]);
}

function validHttpsUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validQualifier(value: unknown) {
  const text = String(value || "");
  return !text || (QUALIFIER_RE.test(text) && !/[\/?#]/.test(text));
}

function expectedProductId(payload: JsonObject) {
  const gtin = String(payload.gtin || "");
  const lot = String(payload.lot || "");
  const serial = String(payload.serial || "");
  let path = `/01/${encodeURIComponent(gtin)}`;
  if (lot) path += `/10/${encodeURIComponent(lot)}`;
  if (serial) path += `/21/${encodeURIComponent(serial)}`;
  return `https://id.nexid.lat${path}`;
}

function validPayload(payload: unknown): payload is OfflinePublicCertificatePayload {
  if (!isPlainObject(payload) || !isPlainObject(payload.public_data) || !isPlainObject(payload.assurance)) return false;
  if (
    payload.schema_version !== OFFLINE_PUBLIC_CERTIFICATE_PROFILE
    || payload.scope !== "PUBLIC_PRODUCT_INFORMATION"
    || !validHttpsUrl(payload.issuer)
    || new URL(String(payload.issuer)).origin !== payload.issuer
    || !TENANT_SLUG_RE.test(String(payload.tenant_slug || ""))
    || !BID_RE.test(String(payload.batch_id || ""))
    || !isValidGtin14(String(payload.gtin || ""))
    || !validQualifier(payload.lot)
    || !validQualifier(payload.serial)
    || payload.product_id !== expectedProductId(payload)
    || payload.assurance.public_information_signature !== "VERIFIABLE_OFFLINE"
    || payload.assurance.nfc_sun_freshness !== "NOT_EVALUATED"
    || payload.assurance.physical_authenticity !== "NOT_ASSERTED"
  ) return false;
  const allowedPublicKeys = new Set([
    "display_name", "brand", "sku", "description", "image_url",
    "safety_sheet_url", "stewardship_url", "manual_url", "dpp_url",
  ]);
  for (const [key, value] of Object.entries(payload.public_data)) {
    if (!allowedPublicKeys.has(key) || typeof value !== "string" || value.length > 2_048 || /[\u0000-\u001f\u007f]/.test(value)) return false;
    if (key.endsWith("_url") && !validHttpsUrl(value)) return false;
  }
  return true;
}

function cleanPublicJwk(jwks: unknown, kid: string) {
  if (!isPlainObject(jwks) || !Array.isArray(jwks.keys) || jwks.keys.length < 1 || jwks.keys.length > 10) return null;
  const matches = jwks.keys.filter((entry) => isPlainObject(entry) && entry.kid === kid);
  if (matches.length !== 1) return null;
  const key = matches[0];
  const keyOps = Array.isArray(key.key_ops) ? key.key_ops.map(String) : [];
  if (
    key.kty !== "EC"
    || key.crv !== "P-256"
    || key.alg !== OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM
    || key.use !== "sig"
    || !KID_RE.test(String(key.kid || ""))
    || keyOps.length !== 1
    || keyOps[0] !== "verify"
    || Object.prototype.hasOwnProperty.call(key, "d")
  ) return null;
  try {
    base64UrlToBytes(key.x, 32);
    base64UrlToBytes(key.y, 32);
  } catch {
    return null;
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: String(key.x),
    y: String(key.y),
    use: "sig",
    alg: OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM,
    kid,
    key_ops: ["verify"],
  } as JsonWebKey & { kid: string };
}

export async function verifyOfflinePublicCertificate(
  envelopeInput: unknown,
  jwks: unknown,
  options: { now?: Date; clockSkewSeconds?: number; crypto?: Crypto } = {},
): Promise<OfflinePublicCertificateVerification> {
  let envelopeCanonical: string;
  try {
    envelopeCanonical = canonicalizeOfflineCertificateJson(envelopeInput);
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (new TextEncoder().encode(envelopeCanonical).byteLength > OFFLINE_PUBLIC_CERTIFICATE_MAX_BYTES || !isPlainObject(envelopeInput)) {
    return { valid: false, reason: "malformed" };
  }
  const envelope = envelopeInput as JsonObject;
  const kid = String(envelope.kid || "");
  if (
    envelope.schema_version !== OFFLINE_PUBLIC_CERTIFICATE_PROFILE
    || envelope.alg !== OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM
    || !KID_RE.test(kid)
    || !validHttpsUrl(envelope.jwks_url)
    || typeof envelope.payload_hash !== "string"
  ) return { valid: false, reason: "unsupported" };
  if (!validPayload(envelope.payload)) return { valid: false, reason: "unsupported" };
  if (envelope.jwks_url !== `${envelope.payload.issuer}/public/offline-certificates/jwks`) {
    return { valid: false, reason: "unsupported" };
  }

  let protectedBytes: Uint8Array;
  let signature: Uint8Array;
  let protectedHeader: JsonObject;
  try {
    protectedBytes = base64UrlToBytes(envelope.protected);
    signature = base64UrlToBytes(envelope.signature, 64);
    protectedHeader = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(protectedBytes)) as JsonObject;
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (
    !isPlainObject(protectedHeader)
    || protectedHeader.alg !== OFFLINE_PUBLIC_CERTIFICATE_ALGORITHM
    || protectedHeader.kid !== kid
    || protectedHeader.typ !== OFFLINE_PUBLIC_CERTIFICATE_TYPE
    || protectedHeader.cty !== "application/json"
    || protectedHeader.schema !== OFFLINE_PUBLIC_CERTIFICATE_PROFILE
    || textToBase64Url(canonicalizeOfflineCertificateJson(protectedHeader)) !== envelope.protected
  ) return { valid: false, reason: "unsupported" };

  const canonicalPayload = canonicalizeOfflineCertificateJson(envelope.payload);
  const cryptoApi = options.crypto || globalThis.crypto;
  if (!cryptoApi?.subtle) return { valid: false, reason: "crypto_unavailable" };
  const expectedHash = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(canonicalPayload)).catch(() => null);
  if (!expectedHash) return { valid: false, reason: "crypto_unavailable" };
  let suppliedHash: Uint8Array;
  try {
    if (!String(envelope.payload_hash).startsWith("sha256-")) throw new Error("malformed");
    suppliedHash = base64UrlToBytes(String(envelope.payload_hash).slice(7), 32);
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (!bytesEqual(new Uint8Array(expectedHash), suppliedHash)) return { valid: false, reason: "signature_invalid" };

  const publicJwk = cleanPublicJwk(jwks, kid);
  if (!publicJwk) return { valid: false, reason: "key_not_found" };
  const signingInput = `${String(envelope.protected)}.${textToBase64Url(canonicalPayload)}`;
  try {
    const publicKey = await cryptoApi.subtle.importKey(
      "jwk",
      publicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const verified = await cryptoApi.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      ownedArrayBuffer(signature),
      new TextEncoder().encode(signingInput),
    );
    if (!verified) return { valid: false, reason: "signature_invalid" };
  } catch {
    return { valid: false, reason: "signature_invalid" };
  }

  const now = options.now ? new Date(options.now) : new Date();
  const issuedAt = Date.parse(envelope.payload.issued_at);
  const expiresAt = Date.parse(envelope.payload.expires_at);
  const requestedSkew = options.clockSkewSeconds === undefined ? 300 : Number(options.clockSkewSeconds);
  const skewMs = Math.min(Math.max(Number.isFinite(requestedSkew) ? requestedSkew : 300, 0), 900) * 1_000;
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt || expiresAt - issuedAt > 30 * 24 * 60 * 60 * 1_000) {
    return { valid: false, reason: "malformed" };
  }
  if (issuedAt > now.getTime() + skewMs) return { valid: false, reason: "not_yet_valid" };
  if (expiresAt <= now.getTime() - skewMs) return { valid: false, reason: "expired" };
  return { valid: true, reason: "verified", payload: envelope.payload, kid };
}
