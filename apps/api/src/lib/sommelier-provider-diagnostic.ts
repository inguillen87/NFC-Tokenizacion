/** Private diagnostics only. This module never fetches, reserves quota or logs. */
export const SOMMELIER_DIAGNOSTIC_MAX_BYTES = 2_048;
export const SOMMELIER_DIAGNOSTIC_MAX_MS = 50;

export type SommelierProviderHttpReason =
  | "unknown"
  | "provider_credit_balance_declared"
  | "provider_org_spend_declared"
  | "provider_project_spend_declared"
  | "provider_org_usage_declared"
  | "provider_rate_ramp_declared"
  | "provider_model_capacity_declared";
export type SommelierDiagnosticRead =
  | "parsed" | "skipped" | "non_json" | "too_large" | "invalid"
  | "aborted" | "timeout" | "read_failed";
export type SommelierProviderHttpProjection = Readonly<{
  providerReason: SommelierProviderHttpReason;
  reasonEvidence: "allowlisted_error_code" | "none";
}>;
export type SommelierProviderHttpDiagnostic = SommelierProviderHttpProjection & Readonly<{
  diagnosticRead: SommelierDiagnosticRead;
}>;
export type SommelierDiagnosticScope = Readonly<{
  provider: string;
  isLastCandidate: boolean;
  signal: AbortSignal;
}>;

const UNKNOWN: SommelierProviderHttpProjection = Object.freeze({
  providerReason: "unknown", reasonEvidence: "none",
});
const QUOTA_CODES = Object.freeze({
  credit_balance_exhausted: "provider_credit_balance_declared",
  organization_spend_limit_exceeded: "provider_org_spend_declared",
  project_spend_limit_exceeded: "provider_project_spend_declared",
  organization_usage_limit_exceeded: "provider_org_usage_declared",
} satisfies Record<string, SommelierProviderHttpReason>);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function declared(providerReason: SommelierProviderHttpReason): SommelierProviderHttpProjection {
  return Object.freeze({ providerReason, reasonEvidence: "allowlisted_error_code" });
}
function result(
  diagnosticRead: SommelierDiagnosticRead,
  projection: SommelierProviderHttpProjection = UNKNOWN,
): SommelierProviderHttpDiagnostic {
  return Object.freeze({
    providerReason: projection.providerReason,
    reasonEvidence: projection.reasonEvidence,
    diagnosticRead,
  });
}

/** Exact provider/status/code allowlist. No message, param, URL or arbitrary code escapes. */
export function projectSommelierProviderHttpError(
  provider: string,
  httpStatus: number,
  payload: unknown,
): SommelierProviderHttpProjection {
  if (provider !== "openai" || (httpStatus !== 429 && httpStatus !== 503)) return UNKNOWN;
  try {
    const error = record(record(payload)?.error);
    if (!error) return UNKNOWN;
    const code = error.code;
    if (typeof code !== "string" || code.length > 64) return UNKNOWN;
    if (httpStatus === 429 && Object.hasOwn(QUOTA_CODES, code)) {
      return declared(QUOTA_CODES[code as keyof typeof QUOTA_CODES]);
    }
    if (httpStatus === 429 && code === "slow_down" && error.type === "rate_limit_error") {
      return declared("provider_rate_ramp_declared");
    }
    if (httpStatus === 503 && code === "server_is_overloaded" && error.type === "service_unavailable_error") {
      return declared("provider_model_capacity_declared");
    }
    return UNKNOWN;
  } catch {
    // A malformed synthetic envelope/getter must never escape into provider handling.
    return UNKNOWN;
  }
}

/**
 * Only the already-received error of the last OpenAI candidate is eligible.
 * 50 ms is a timer budget within the caller's existing abort signal, not a
 * guarantee against event-loop starvation. At most 2 KiB of response bytes are
 * admitted; bounded decode copies are transient.
 * The caller still owns immediate cancellation for skipped/non-JSON responses.
 */
export async function readSommelierProviderHttpDiagnostic(
  response: Response,
  scope: SommelierDiagnosticScope,
): Promise<SommelierProviderHttpDiagnostic> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let signal: AbortSignal | undefined;
  let onAbort: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  let stopped: "aborted" | "timeout" | null = null;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    if (scope.provider !== "openai" || scope.isLastCandidate !== true) return result("skipped");
    const status = response.status;
    if (status !== 429 && status !== 503) return result("skipped");
    signal = scope.signal;
    if (signal.aborted) return result("aborted");
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "application/json") return result("non_json");
    const body = response.body;
    if (!body) return result("invalid");
    reader = body.getReader();

    let stop: (reason: "aborted" | "timeout") => void = () => undefined;
    const stopPromise = new Promise<SommelierProviderHttpDiagnostic>(resolve => {
      stop = reason => {
        if (finished) return;
        stopped = reason;
        finished = true;
        resolve(result(reason));
      };
    });
    onAbort = () => stop("aborted");
    signal.addEventListener("abort", onAbort, { once: true });
    // Covers abort between the first check and listener registration.
    if (signal.aborted) onAbort();
    if (!finished) timer = setTimeout(() => stop("timeout"), SOMMELIER_DIAGNOSTIC_MAX_MS);

    const read = async (): Promise<SommelierProviderHttpDiagnostic> => {
      try {
        while (true) {
          if (finished) return result(stopped ?? "aborted");
          const next = await reader!.read();
          if (finished) return result(stopped ?? "aborted");
          if (signal!.aborted) return result("aborted");
          if (next.done) {
            try {
              const joined = new Uint8Array(bytes);
              let offset = 0;
              for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
              const text = new TextDecoder("utf-8", { fatal: true }).decode(joined);
              return result("parsed", projectSommelierProviderHttpError(scope.provider, status, JSON.parse(text)));
            } catch {
              return result("invalid");
            }
          }
          const value = next.value;
          if (!(value instanceof Uint8Array) || value.byteLength === 0) return result("read_failed");
          if (value.byteLength > SOMMELIER_DIAGNOSTIC_MAX_BYTES - bytes) return result("too_large");
          const copy = new Uint8Array(value.byteLength);
          copy.set(value);
          bytes += copy.byteLength;
          chunks.push(copy);
        }
      } catch {
        return result(stopped ?? (signal!.aborted ? "aborted" : "read_failed"));
      }
    };
    return await Promise.race([read(), stopPromise]);
  } catch {
    return result("read_failed");
  } finally {
    finished = true;
    if (timer !== undefined) clearTimeout(timer);
    if (signal && onAbort) {
      try { signal.removeEventListener("abort", onAbort); } catch {}
    }
    if (reader) {
      // Never await an uncooperative cancel promise or retain its rejection details.
      try { void reader.cancel().catch(() => undefined); } catch {}
      try { reader.releaseLock(); } catch {}
    }
    chunks.length = 0;
    bytes = 0;
  }
}
