const MAX_READINESS_RESPONSE_BYTES = 64 * 1024;

type ReadinessSource = Record<string, string | undefined>;

export type PolygonExecutorReadiness = {
  configured: boolean;
  liveVerified: boolean;
  reason: string;
  chainId: string | null;
  contractAddress: string | null;
  contractDeployed: boolean;
  signerAddress: string | null;
  signerAuthorized: boolean;
  signerBalancePol: number | null;
  signerMode: string | null;
};

function result(input: Partial<PolygonExecutorReadiness> = {}): PolygonExecutorReadiness {
  return {
    configured: false,
    liveVerified: false,
    reason: "executor_not_configured",
    chainId: null,
    contractAddress: null,
    contractDeployed: false,
    signerAddress: null,
    signerAuthorized: false,
    signerBalancePol: null,
    signerMode: null,
    ...input,
  };
}

function boundedTimeout(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2_500;
  return Math.max(500, Math.min(5_000, Math.trunc(parsed)));
}

function readinessUrl(rawUrl: string, production: boolean) {
  const url = new URL(rawUrl);
  if (url.username || url.password) throw new Error("executor_readiness_url_credentials_forbidden");
  if (production && url.protocol !== "https:") throw new Error("executor_readiness_https_required");
  if (!production && !["http:", "https:"].includes(url.protocol)) throw new Error("executor_readiness_protocol_invalid");
  url.pathname = "/ready";
  url.search = "?capability=polygon";
  url.hash = "";
  return url.toString();
}

async function readBoundedJson(response: Response) {
  if (!String(response.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    throw new Error("executor_readiness_content_type_invalid");
  }
  const declared = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_READINESS_RESPONSE_BYTES) {
    throw new Error("executor_readiness_response_too_large");
  }
  if (!response.body) throw new Error("executor_readiness_body_missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    received += next.value.byteLength;
    if (received > MAX_READINESS_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("executor_readiness_response_too_large");
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    throw new Error("executor_readiness_json_invalid");
  }
}

export async function probePolygonExecutorReadiness(options: {
  source?: ReadinessSource;
  fetchImpl?: typeof fetch;
  timeoutMs?: number | string;
} = {}): Promise<PolygonExecutorReadiness> {
  const source = options.source || process.env;
  const rawUrl = String(source.TOKENIZATION_EXECUTOR_URL || "").trim();
  const secret = String(source.TOKENIZATION_EXECUTOR_SECRET || "").trim();
  if (!rawUrl) return result();
  if (!secret) return result({ configured: true, reason: "executor_secret_missing" });

  let url = "";
  try {
    const production = String(source.NODE_ENV || "").toLowerCase() === "production"
      || String(source.VERCEL_ENV || "").toLowerCase() === "production";
    if (production && Buffer.byteLength(secret, "utf8") < 32) {
      return result({ configured: true, reason: "executor_secret_too_short" });
    }
    url = readinessUrl(rawUrl, production);
  } catch (error) {
    return result({ configured: true, reason: error instanceof Error ? error.message : "executor_readiness_url_invalid" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), boundedTimeout(options.timeoutMs ?? source.TOKENIZATION_EXECUTOR_TIMEOUT_MS));
  try {
    const response = await (options.fetchImpl || fetch)(url, {
      method: "GET",
      headers: { "x-tokenization-secret": secret },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) return result({ configured: true, reason: `executor_readiness_http_${response.status}` });
    const payload = await readBoundedJson(response);
    const capabilities = Array.isArray(payload.capabilities) ? payload.capabilities.map(String) : [];
    const chains = payload.chains && typeof payload.chains === "object" ? payload.chains as Record<string, unknown> : {};
    const polygon = chains.polygon && typeof chains.polygon === "object" ? chains.polygon as Record<string, unknown> : {};
    const contract = polygon.contract && typeof polygon.contract === "object" ? polygon.contract as Record<string, unknown> : {};
    const signer = polygon.signer && typeof polygon.signer === "object" ? polygon.signer as Record<string, unknown> : {};
    const chainId = polygon.chain_id == null ? null : String(polygon.chain_id);
    const contractAddress = typeof contract.address === "string" ? contract.address : null;
    const signerAddress = typeof signer.address === "string" ? signer.address : null;
    const signerBalancePol = typeof signer.balance_pol === "number" && Number.isFinite(signer.balance_pol) ? signer.balance_pol : null;
    const liveVerified = payload.ok === true
      && capabilities.includes("polygon")
      && polygon.ok === true
      && polygon.live_verified === true
      && chainId === "80002"
      && contract.deployed === true
      && signer.authorized === true
      && signerBalancePol != null
      && signerBalancePol > 0;
    return result({
      configured: true,
      liveVerified,
      reason: liveVerified ? "live_verified" : "executor_readiness_unverified",
      chainId,
      contractAddress,
      contractDeployed: contract.deployed === true,
      signerAddress,
      signerAuthorized: signer.authorized === true,
      signerBalancePol,
      signerMode: typeof polygon.signer_mode === "string" ? polygon.signer_mode : null,
    });
  } catch {
    return result({
      configured: true,
      reason: controller.signal.aborted ? "executor_readiness_timeout" : "executor_readiness_unavailable",
    });
  } finally {
    clearTimeout(timeout);
  }
}
