import crypto from "node:crypto";

export type SunPayloadParts = {
  bid: string | null;
  piccDataHex: string;
  encHex: string;
  cmacHex: string;
  sourceUrl: string | null;
};

export type SunPayloadHashes = {
  piccDataHash: string;
  encHash: string;
  cmacHash: string;
  rawUrlHash: string;
};

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function getColumn(row: Record<string, string>, names: string[]) {
  const lowered = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), String(value || "").trim()]));
  for (const name of names) {
    const value = lowered.get(name.toLowerCase());
    if (value) return value;
  }
  return "";
}

export function sha256Fingerprint(value: string) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

export function normalizeSunHex(value: unknown) {
  return String(value || "").trim().replace(/^0x/i, "").toUpperCase();
}

export function isSunHex(value: string, options: { minBytes?: number; maxBytes?: number } = {}) {
  if (!value || !/^[0-9A-F]+$/.test(value) || value.length % 2 !== 0) return false;
  const byteLen = value.length / 2;
  if (options.minBytes && byteLen < options.minBytes) return false;
  if (options.maxBytes && byteLen > options.maxBytes) return false;
  return true;
}

export function buildSunPayloadHashes(input: {
  bid: string;
  piccDataHex: string;
  encHex: string;
  cmacHex: string;
}): SunPayloadHashes {
  const bid = String(input.bid || "").trim();
  const picc = normalizeSunHex(input.piccDataHex);
  const enc = normalizeSunHex(input.encHex);
  const cmac = normalizeSunHex(input.cmacHex);
  const canonicalPayload = `bid=${bid}&picc_data=${picc}&enc=${enc}&cmac=${cmac}`;
  return {
    piccDataHash: sha256Fingerprint(picc),
    encHash: sha256Fingerprint(enc),
    cmacHash: sha256Fingerprint(cmac),
    rawUrlHash: sha256Fingerprint(canonicalPayload),
  };
}

export function parseSunPayloadFromUrl(value: unknown, fallbackBid?: string | null): SunPayloadParts | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const bid = firstString(url.searchParams.get("bid"), fallbackBid) || null;
  const piccDataHex = normalizeSunHex(firstString(
    url.searchParams.get("picc_data"),
    url.searchParams.get("picc"),
    url.searchParams.get("p"),
  ));
  const encHex = normalizeSunHex(firstString(
    url.searchParams.get("enc"),
    url.searchParams.get("encrypted_data"),
    url.searchParams.get("e"),
  ));
  const cmacHex = normalizeSunHex(firstString(
    url.searchParams.get("cmac"),
    url.searchParams.get("mac"),
    url.searchParams.get("c"),
  ));
  if (!bid || !isSunHex(piccDataHex, { minBytes: 16 }) || !isSunHex(encHex, { minBytes: 1 }) || !isSunHex(cmacHex, { minBytes: 8, maxBytes: 16 })) {
    return null;
  }
  return { bid, piccDataHex, encHex, cmacHex, sourceUrl: raw };
}

export function parseSunPayloadFromFields(input: {
  bid?: unknown;
  url?: unknown;
  sampleUrl?: unknown;
  picc_data?: unknown;
  picc?: unknown;
  enc?: unknown;
  encrypted_data?: unknown;
  cmac?: unknown;
  mac?: unknown;
}, fallbackBid?: string | null): SunPayloadParts | null {
  const urlPayload = parseSunPayloadFromUrl(input.url || input.sampleUrl, fallbackBid);
  if (urlPayload) return urlPayload;

  const piccDataHex = normalizeSunHex(firstString(input.picc_data, input.picc));
  const encHex = normalizeSunHex(firstString(input.enc, input.encrypted_data));
  const cmacHex = normalizeSunHex(firstString(input.cmac, input.mac));
  if (!piccDataHex && !encHex && !cmacHex) return null;

  const bid = firstString(input.bid, fallbackBid) || null;
  return { bid, piccDataHex, encHex, cmacHex, sourceUrl: null };
}

export function parseSunPayloadFromManifestRow(row: Record<string, string>, expectedBid: string): SunPayloadParts | null {
  const urlPayload = parseSunPayloadFromUrl(getColumn(row, [
    "sun_url",
    "url",
    "ndef_url",
    "encoded_url",
    "tap_url",
    "dynamic_url",
    "ntag_url",
    "nfc_url",
  ]), expectedBid);
  if (urlPayload) return urlPayload;

  const piccDataHex = normalizeSunHex(getColumn(row, ["picc_data", "picc", "p"]));
  const encHex = normalizeSunHex(getColumn(row, ["enc", "encrypted_data", "e"]));
  const cmacHex = normalizeSunHex(getColumn(row, ["cmac", "mac", "c"]));
  if (!piccDataHex && !encHex && !cmacHex) return null;

  const bid = firstString(getColumn(row, ["payload_bid", "sun_bid", "batch_id", "batchId", "bid"]), expectedBid) || null;
  if (!bid || !isSunHex(piccDataHex, { minBytes: 16 }) || !isSunHex(encHex, { minBytes: 1 }) || !isSunHex(cmacHex, { minBytes: 8, maxBytes: 16 })) {
    return {
      bid,
      piccDataHex,
      encHex,
      cmacHex,
      sourceUrl: null,
    };
  }
  return { bid, piccDataHex, encHex, cmacHex, sourceUrl: null };
}

export function isCompleteSunPayload(payload: SunPayloadParts | null): payload is SunPayloadParts {
  return Boolean(
    payload
      && payload.bid
      && isSunHex(payload.piccDataHex, { minBytes: 16 })
      && isSunHex(payload.encHex, { minBytes: 1 })
      && isSunHex(payload.cmacHex, { minBytes: 8, maxBytes: 16 }),
  );
}
