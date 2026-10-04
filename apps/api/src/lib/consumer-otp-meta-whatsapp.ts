import { createHash } from "node:crypto";

// This transport serves platform consumer login only. It never reads tenant
// campaign credentials and never falls back to another WhatsApp provider.
export const META_OTP_TIMEOUT_MS = 10_000;
export const META_OTP_MAX_RESPONSE_BYTES = 16 * 1024;
const LANGUAGES = new Set(["es", "es_AR", "es_ES", "es_MX", "pt_BR", "pt_PT", "en", "en_US", "en_GB"]);

type MetaOtpErrorCode = "meta_configuration_missing" | "meta_configuration_invalid" | "meta_payload_invalid" | "meta_authentication_failed" | "meta_delivery_failed" | "meta_delivery_timeout" | "meta_receipt_invalid";
type MetaOtpDiagnostics = { httpStatus?: number; errorCode?: number; providerStatus: string };
const ERROR_STATUS: Record<MetaOtpErrorCode, string> = {
  meta_configuration_missing: "configuration_missing", meta_configuration_invalid: "configuration_invalid", meta_payload_invalid: "invalid_payload",
  meta_authentication_failed: "authentication_failed", meta_delivery_failed: "request_failed", meta_delivery_timeout: "timeout", meta_receipt_invalid: "invalid_receipt",
};
export class ConsumerMetaOtpError extends Error {
  public readonly code: MetaOtpErrorCode;
  public readonly diagnostics: MetaOtpDiagnostics;
  constructor(code: MetaOtpErrorCode, diagnostics: MetaOtpDiagnostics) {
    const safeCode = typeof code === "string" && Object.hasOwn(ERROR_STATUS, code) ? code : "meta_delivery_failed";
    super(safeCode);
    this.name = "ConsumerMetaOtpError";
    this.code = safeCode;
    this.diagnostics = Object.freeze({
      providerStatus: ERROR_STATUS[safeCode],
      ...(Number.isInteger(diagnostics?.httpStatus) && diagnostics.httpStatus! >= 100 && diagnostics.httpStatus! <= 599 ? { httpStatus: diagnostics.httpStatus } : {}),
      ...(Number.isSafeInteger(diagnostics?.errorCode) && diagnostics.errorCode! >= 0 ? { errorCode: diagnostics.errorCode } : {}),
    });
  }
}

type Environment = Record<string, unknown>;
type MetaOtpConfig = { version: string; phoneNumberId: string; accessToken: string; templateName: string; language: string };
type MetaOtpPayload = { contact: string; code: string };
export type MetaOtpReceipt = { httpStatus: number; receiptHash: string; providerStatus: "accepted" };

export function readConsumerMetaWhatsappConfig(environment: Environment): MetaOtpConfig {
  const names = ["META_CONSUMER_OTP_GRAPH_VERSION", "META_CONSUMER_OTP_PHONE_NUMBER_ID", "META_CONSUMER_OTP_ACCESS_TOKEN", "META_CONSUMER_OTP_TEMPLATE_NAME", "META_CONSUMER_OTP_TEMPLATE_LANGUAGE"] as const;
  const values = names.map((name) => environment[name]);
  if (values.some((value) => value === undefined || value === null || value === "")) {
    throw new ConsumerMetaOtpError("meta_configuration_missing", { providerStatus: "configuration_missing" });
  }
  if (values.some((value) => typeof value !== "string")) {
    throw new ConsumerMetaOtpError("meta_configuration_invalid", { providerStatus: "configuration_invalid" });
  }
  const [version, phoneNumberId, accessToken, templateName, language] = values as string[];
  if (!/^v[1-9]\d{0,2}\.0$/.test(version) || !/^[1-9]\d{0,31}$/.test(phoneNumberId) ||
      !/^[A-Za-z0-9._~-]{20,4096}$/.test(accessToken) || !/^[a-z0-9_]{1,512}$/.test(templateName) || !LANGUAGES.has(language)) {
    throw new ConsumerMetaOtpError("meta_configuration_invalid", { providerStatus: "configuration_invalid" });
  }
  return { version, phoneNumberId, accessToken, templateName, language };
}

function cancelBody(response: Response) {
  // Do not await cancellation: a broken stream must not extend the timeout.
  void response.body?.cancel().catch(() => {});
}

async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const advertised = response.headers.get("content-length");
  if (advertised !== null && (!/^\d{1,12}$/.test(advertised) || Number(advertised) > META_OTP_MAX_RESPONSE_BYTES)) {
    cancelBody(response);
    throw new ConsumerMetaOtpError("meta_receipt_invalid", { httpStatus: response.status, providerStatus: "invalid_receipt" });
  }
  if (!response.body) throw new ConsumerMetaOtpError("meta_receipt_invalid", { httpStatus: response.status, providerStatus: "invalid_receipt" });
  const reader = response.body.getReader();
  const abortRead = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abortRead, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > META_OTP_MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => {});
        throw new ConsumerMetaOtpError("meta_receipt_invalid", { httpStatus: response.status, providerStatus: "invalid_receipt" });
      }
      chunks.push(chunk.value);
    }
  } finally {
    signal.removeEventListener("abort", abortRead);
    reader.releaseLock();
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined)); }
  catch { throw new ConsumerMetaOtpError("meta_receipt_invalid", { httpStatus: response.status, providerStatus: "invalid_receipt" }); }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function sendConsumerMetaWhatsappOtp(environment: Environment, payload: MetaOtpPayload, transport: typeof fetch = fetch): Promise<MetaOtpReceipt> {
  const config = readConsumerMetaWhatsappConfig(environment);
  if (typeof payload?.contact !== "string" || !/^\+[1-9]\d{7,14}$/.test(payload.contact) || typeof payload?.code !== "string" || !/^\d{6}$/.test(payload.code)) {
    throw new ConsumerMetaOtpError("meta_payload_invalid", { providerStatus: "invalid_payload" });
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let response: Response | undefined;
  let timedOut = false;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      if (response) cancelBody(response);
      reject(new ConsumerMetaOtpError("meta_delivery_timeout", { providerStatus: "timeout" }));
    }, META_OTP_TIMEOUT_MS);
  });
  const request = async (): Promise<MetaOtpReceipt> => {
    response = await transport(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`, {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: payload.contact.slice(1), type: "template", template: {
        name: config.templateName, language: { code: config.language }, components: [
          { type: "body", parameters: [{ type: "text", text: payload.code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: payload.code }] },
        ],
      } }),
    });
    // A transport that ignores abort can resolve later. Do not read or accept it.
    if (timedOut) { cancelBody(response); throw new ConsumerMetaOtpError("meta_delivery_timeout", { providerStatus: "timeout" }); }
    let data: unknown;
    try { data = await boundedJson(response, controller.signal); }
    catch (error) { if (response.ok) throw error; }
    const body = record(data);
    if (!response.ok || response.status < 200 || response.status >= 300) {
      const code = record(body?.error)?.code;
      // Graph also returns HTTP 400 with OAuth code 190 for an invalid token.
      const authentication = response.status === 401 || response.status === 403 || code === 190;
      throw new ConsumerMetaOtpError(authentication ? "meta_authentication_failed" : "meta_delivery_failed", {
        httpStatus: response.status, providerStatus: authentication ? "authentication_failed" : "request_failed",
        ...(typeof code === "number" && Number.isSafeInteger(code) && code >= 0 ? { errorCode: code } : {}),
      });
    }
    const messages = body?.messages;
    const message = Array.isArray(messages) && messages.length === 1 ? record(messages[0]) : null;
    const id = message?.id;
    const validStatus = !Object.hasOwn(message || {}, "message_status") || message?.message_status === "accepted";
    if (timedOut || !validStatus || body?.messaging_product !== "whatsapp" || Object.hasOwn(body || {}, "error") || typeof id !== "string" || !/^wamid\.[A-Za-z0-9+/=_-]{1,2048}$/.test(id)) {
      throw new ConsumerMetaOtpError("meta_receipt_invalid", { httpStatus: response.status, providerStatus: "invalid_receipt" });
    }
    return { httpStatus: response.status, providerStatus: "accepted", receiptHash: createHash("sha256").update(id).digest("hex").slice(0, 16) };
  };
  try { return await Promise.race([request(), deadline]); }
  catch (error) {
    if (timedOut) throw new ConsumerMetaOtpError("meta_delivery_timeout", { providerStatus: "timeout" });
    if (error instanceof ConsumerMetaOtpError) throw new ConsumerMetaOtpError(error.code, error.diagnostics);
    // Fetch/stream/provider exception text can contain the phone, OTP or token.
    throw new ConsumerMetaOtpError("meta_delivery_failed", { providerStatus: "request_failed" });
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
