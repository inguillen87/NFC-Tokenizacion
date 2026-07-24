import { lookup as systemLookup } from "node:dns/promises";
import { request as systemHttpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";

const DEFAULT_DNS_TIMEOUT_MS = 3_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;

export type WebhookAddress = { address: string; family: 4 | 6 };
export type WebhookLookup = (hostname: string) => Promise<ReadonlyArray<WebhookAddress>>;

type HttpsRequest = typeof systemHttpsRequest;

export class WebhookDeliveryError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(code: string, options?: { retryable?: boolean; statusCode?: number | null; cause?: unknown }) {
    super(code, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "WebhookDeliveryError";
    this.code = code;
    this.retryable = Boolean(options?.retryable);
    this.statusCode = options?.statusCode ?? null;
  }
}

function boundedInteger(raw: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function stripIpv6Brackets(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function ipv4ToInteger(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function ipv4InCidr(address: number, base: number, prefix: number) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (base & mask);
}

function isPublicIpv4(address: string) {
  const value = ipv4ToInteger(address);
  if (value === null) return false;
  const blocked: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  return !blocked.some(([base, prefix]) => ipv4InCidr(value, ipv4ToInteger(base)!, prefix));
}

function parseIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (!normalized || normalized.includes(":::")) return null;

  let source = normalized;
  let embeddedIpv4: number | null = null;
  const lastColon = source.lastIndexOf(":");
  if (source.includes(".") && lastColon >= 0) {
    embeddedIpv4 = ipv4ToInteger(source.slice(lastColon + 1));
    if (embeddedIpv4 === null) return null;
    source = `${source.slice(0, lastColon)}:${(embeddedIpv4 >>> 16).toString(16)}:${(embeddedIpv4 & 0xffff).toString(16)}`;
  }

  const halves = source.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const omitted = halves.length === 2 ? 8 - left.length - right.length : 0;
  if ((halves.length === 1 && left.length !== 8) || (halves.length === 2 && omitted < 1)) return null;
  const groups = [...left, ...Array(omitted).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  let value = 0n;
  for (const group of groups) value = (value << 16n) | BigInt(Number.parseInt(group, 16));
  return { value, embeddedIpv4 };
}

function ipv6InCidr(address: bigint, base: bigint, prefix: number) {
  if (prefix === 0) return true;
  const shift = BigInt(128 - prefix);
  return (address >> shift) === (base >> shift);
}

function ipv6Base(address: string) {
  const parsed = parseIpv6(address);
  if (!parsed) throw new Error(`invalid internal IPv6 CIDR base: ${address}`);
  return parsed.value;
}

function isPublicIpv6(address: string) {
  const parsed = parseIpv6(address);
  if (!parsed) return false;

  // IPv4-compatible and IPv4-mapped IPv6 addresses inherit the IPv4 policy.
  const ipv4Compatible = (parsed.value >> 32n) === 0n;
  const ipv4Mapped = (parsed.value >> 48n) === 0n && Number((parsed.value >> 32n) & 0xffffn) === 0xffff;
  if (ipv4Compatible || ipv4Mapped || parsed.embeddedIpv4 !== null) {
    if (ipv4Mapped || parsed.embeddedIpv4 !== null) {
      const value = Number(parsed.value & 0xffffffffn) >>> 0;
      return isPublicIpv4(`${value >>> 24}.${(value >>> 16) & 255}.${(value >>> 8) & 255}.${value & 255}`);
    }
    return false;
  }

  // Current globally routable unicast allocation is within 2000::/3. Treat
  // every other IPv6 scope as non-public instead of guessing future semantics.
  if (!ipv6InCidr(parsed.value, ipv6Base("2000::"), 3)) return false;

  const blocked: Array<[bigint, number]> = [
    [ipv6Base("64:ff9b::"), 96],
    [ipv6Base("64:ff9b:1::"), 48],
    [ipv6Base("100::"), 64],
    [ipv6Base("2001::"), 32],
    [ipv6Base("2001:2::"), 48],
    [ipv6Base("2001:10::"), 28],
    [ipv6Base("2001:db8::"), 32],
    [ipv6Base("2002::"), 16],
    [ipv6Base("fc00::"), 7],
    [ipv6Base("fe80::"), 10],
    [ipv6Base("fec0::"), 10],
    [ipv6Base("ff00::"), 8],
  ];
  return !blocked.some(([base, prefix]) => ipv6InCidr(parsed.value, base, prefix));
}

export function isPublicWebhookAddress(address: string) {
  const normalized = stripIpv6Brackets(address.trim());
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family === 6) return isPublicIpv6(normalized);
  return false;
}

export function normalizeWebhookUrl(rawUrl: unknown) {
  const value = String(rawUrl || "").trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WebhookDeliveryError("invalid_webhook_url");
  }
  if (url.protocol !== "https:") throw new WebhookDeliveryError("webhook_https_required");
  if (url.username || url.password) throw new WebhookDeliveryError("webhook_userinfo_not_allowed");
  if (url.port && url.port !== "443") throw new WebhookDeliveryError("webhook_port_not_allowed");
  if (!url.hostname) throw new WebhookDeliveryError("invalid_webhook_url");
  if (url.hash) url.hash = "";
  return url;
}

const defaultLookup: WebhookLookup = async (hostname) => {
  const rows = await systemLookup(hostname, { all: true, verbatim: true });
  return rows
    .filter((row): row is { address: string; family: 4 | 6 } => row.family === 4 || row.family === 6)
    .map((row) => ({ address: row.address, family: row.family }));
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new WebhookDeliveryError(code, { retryable: true })), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function resolveWebhookDestination(
  rawUrl: unknown,
  options?: { lookup?: WebhookLookup; dnsTimeoutMs?: number },
) {
  const url = normalizeWebhookUrl(rawUrl);
  const hostname = stripIpv6Brackets(url.hostname);
  const literalFamily = isIP(hostname);
  let addresses: ReadonlyArray<WebhookAddress>;
  if (literalFamily === 4 || literalFamily === 6) {
    addresses = [{ address: hostname, family: literalFamily }];
  } else {
    const timeoutMs = options?.dnsTimeoutMs ?? boundedInteger(process.env.WEBHOOK_DNS_TIMEOUT_MS, DEFAULT_DNS_TIMEOUT_MS, 250, 10_000);
    try {
      addresses = await withTimeout((options?.lookup || defaultLookup)(hostname), timeoutMs, "webhook_dns_timeout");
    } catch (error) {
      if (error instanceof WebhookDeliveryError) throw error;
      throw new WebhookDeliveryError("webhook_dns_resolution_failed", { retryable: true, cause: error });
    }
  }
  if (addresses.length === 0) throw new WebhookDeliveryError("webhook_dns_no_addresses", { retryable: true });
  if (addresses.some((row) => !isPublicWebhookAddress(row.address))) {
    throw new WebhookDeliveryError("webhook_private_address_blocked");
  }

  // Every returned address was validated; this exact address is injected into the
  // socket lookup below so DNS cannot change between policy evaluation and connect.
  const selected = addresses[0];
  return { url, address: selected.address, family: selected.family, addresses: [...addresses] };
}

export function classifyWebhookStatus(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) return { ok: true, code: "delivered", retryable: false };
  if (statusCode >= 300 && statusCode < 400) return { ok: false, code: "webhook_redirect_not_allowed", retryable: false };
  const retryable = statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode >= 500;
  return { ok: false, code: `webhook_http_${statusCode}`, retryable };
}

export async function postPinnedWebhook(
  input: {
    url: URL;
    address: string;
    family: 4 | 6;
    body: string;
    headers: Record<string, string>;
    timeoutMs?: number;
    maxResponseBytes?: number;
  },
  options?: { request?: HttpsRequest },
) {
  const timeoutMs = input.timeoutMs ?? boundedInteger(process.env.WEBHOOK_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS, 500, 30_000);
  const maxResponseBytes = input.maxResponseBytes ?? boundedInteger(process.env.WEBHOOK_MAX_RESPONSE_BYTES, DEFAULT_MAX_RESPONSE_BYTES, 1_024, 1024 * 1024);
  const requestImpl = options?.request || systemHttpsRequest;

  return await new Promise<{ statusCode: number }>((resolve, reject) => {
    let settled = false;
    let totalBytes = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback();
    };
    const requestOptions: RequestOptions = {
      protocol: "https:",
      hostname: stripIpv6Brackets(input.url.hostname),
      port: 443,
      method: "POST",
      path: `${input.url.pathname}${input.url.search}`,
      headers: {
        ...input.headers,
        "content-length": Buffer.byteLength(input.body, "utf8"),
      },
      agent: false,
      lookup: (_hostname, _options, callback) => callback(null, input.address, input.family),
    };
    const req = requestImpl(requestOptions, (response) => {
      const statusCode = response.statusCode || 0;
      const classification = classifyWebhookStatus(statusCode);
      response.on("data", (chunk: Buffer | string) => {
        totalBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
        if (totalBytes > maxResponseBytes) {
          response.destroy();
          finish(() => reject(new WebhookDeliveryError("webhook_response_too_large")));
        }
      });
      response.on("end", () => {
        if (classification.ok) {
          finish(() => resolve({ statusCode }));
        } else {
          finish(() => reject(new WebhookDeliveryError(classification.code, { retryable: classification.retryable, statusCode })));
        }
      });
      response.on("error", (error) => finish(() => reject(new WebhookDeliveryError("webhook_response_failed", { retryable: true, cause: error }))));
    });
    timer = setTimeout(() => req.destroy(new WebhookDeliveryError("webhook_request_timeout", { retryable: true })), timeoutMs);
    req.on("error", (error) => {
      if (error instanceof WebhookDeliveryError) return finish(() => reject(error));
      const code = typeof (error as NodeJS.ErrnoException)?.code === "string" ? String((error as NodeJS.ErrnoException).code) : "";
      const retryable = !["ERR_TLS_CERT_ALTNAME_INVALID", "DEPTH_ZERO_SELF_SIGNED_CERT", "CERT_HAS_EXPIRED"].includes(code);
      finish(() => reject(new WebhookDeliveryError(retryable ? "webhook_network_failed" : "webhook_tls_validation_failed", { retryable, cause: error })));
    });
    req.end(input.body);
  });
}

export async function deliverWebhookRequest(input: {
  url: string;
  body: string;
  headers: Record<string, string>;
}) {
  const target = await resolveWebhookDestination(input.url);
  return postPinnedWebhook({
    url: target.url,
    address: target.address,
    family: target.family,
    body: input.body,
    headers: input.headers,
  });
}

export function safeWebhookError(error: unknown) {
  if (error instanceof WebhookDeliveryError) {
    return { code: error.code.slice(0, 96), retryable: error.retryable, statusCode: error.statusCode };
  }
  return { code: "webhook_delivery_failed", retryable: true, statusCode: null };
}
