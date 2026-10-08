import { createHash } from "node:crypto";
import { parseSommelierAnswer, sommelierFallback, sommelierMessages, SOMMELIER_OUTPUT_SCHEMA, SOMMELIER_VERSION, type SommelierContext, type SommelierRequest } from "./sommelier-contract";
import { reserveSommelierBuckets, sommelierProviderBuckets, type SommelierQuotaResult } from "./sommelier-quota";
import type { SommelierEnv } from "./sommelier-access";
export const SOMMELIER_HF_MODEL = "openai/gpt-oss-20b:deepinfra";
export const SOMMELIER_OPENAI_MODEL = "gpt-6-luna";
export const SOMMELIER_PROVIDER_DEADLINE_MS = 9000;
export const SOMMELIER_OUTPUT_TOKENS = 1024;
const PROVIDERS = {
  huggingface: { url: "https://router.huggingface.co/v1/chat/completions", model: SOMMELIER_HF_MODEL, inputMicroUsdPerMillion: 30_000, outputMicroUsdPerMillion: 140_000 },
  openai: { url: "https://api.openai.com/v1/chat/completions", model: SOMMELIER_OPENAI_MODEL, inputMicroUsdPerMillion: 100_000, outputMicroUsdPerMillion: 500_000 },
} as const;
// Warm-instance optimization only; distributed quota admission stays mandatory.
// One bounded entry, no credentials, response bodies, logging or persistence.
const HF_REJECTION_COOLDOWN_MS = 5 * 60 * 1000;
let hfRejectionCooldown: { fingerprint: string; until: number } | null = null;
function hfKeyFingerprint(key: string) {
  return createHash("sha256").update("nexid-sommelier-hf:v1\0").update(SOMMELIER_HF_MODEL).update("\0").update(key).digest("hex");
}
type ProviderName = keyof typeof PROVIDERS;
type Dependencies = { fetch?: typeof fetch; reserve?: (tenant: string, charge: number) => Promise<SommelierQuotaResult>; signal?: AbortSignal; deadlineMs?: number; nowMs?: () => number };
export function sommelierProviderBody(provider: ProviderName, input: SommelierRequest, context: SommelierContext) {
  return { model: PROVIDERS[provider].model, messages: sommelierMessages(input, context), stream: false, ...(provider === "huggingface" ? { max_tokens: SOMMELIER_OUTPUT_TOKENS, reasoning_effort: "low" } : { max_completion_tokens: SOMMELIER_OUTPUT_TOKENS, reasoning_effort: "none", store: false }), response_format: { type: "json_schema", json_schema: { name: "nexid_sommelier_answer", strict: true, schema: SOMMELIER_OUTPUT_SCHEMA } } };
}
/** One UTF-8 request byte reserves one input token, plus the complete output
 * cap (including reasoning). Pinned price caps are configuration-era estimates,
 * not a live provider invoice; the attempt/token caps remain independent.
 */
export function sommelierReservedCost(provider: ProviderName, body: string) {
  const price = PROVIDERS[provider];
  return Math.max(1, Math.ceil((Buffer.byteLength(body, "utf8") * price.inputMicroUsdPerMillion + SOMMELIER_OUTPUT_TOKENS * price.outputMicroUsdPerMillion) / 1_000_000));
}
function fallback(input: SommelierRequest, context: SommelierContext, reason: string) {
  return { ok: true, version: SOMMELIER_VERSION, answer: sommelierFallback(input.locale), source: "fallback" as const, fallback: true, reason, contextSource: context.source, demo: context.demo, sources: [], suggestedQuestions: [] };
}
async function boundedResponse(response: Response, signal: AbortSignal) {
  if (!response.body || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new Error("provider_receipt_invalid");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new Error("provider_timeout");
      const { value, done } = await reader.read();
      if (signal.aborted) throw new Error("provider_timeout");
      if (done) break;
      if (value) { bytes += value.length; if (bytes > 16_384) throw new Error("provider_receipt_invalid"); chunks.push(value); }
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { signal.removeEventListener("abort", abort); void reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export async function requestLiveSommelier(input: SommelierRequest, context: SommelierContext, env: SommelierEnv, dependencies: Dependencies = {}) {
  if (env.NEXID_SOMMELIER_ENABLED !== "true") return fallback(input, context, "sommelier_disabled");
  const candidates: Array<{ name: ProviderName; key: string }> = [];
  const hf = env.HF_TOKEN || env.HUGGINGFACE_API_KEY;
  const openAiFallbackReady = env.NEXID_SOMMELIER_OPENAI_FALLBACK_ENABLED === "true" && !!env.OPENAI_API_KEY;
  const now = dependencies.nowMs || Date.now;
  const hfFingerprint = hf && openAiFallbackReady ? hfKeyFingerprint(hf) : null;
  const hfCoolingDown = hfFingerprint !== null && hfRejectionCooldown?.fingerprint === hfFingerprint && now() < hfRejectionCooldown.until;
  if (hf && !hfCoolingDown) candidates.push({ name: "huggingface", key: hf });
  if (openAiFallbackReady) candidates.push({ name: "openai", key: env.OPENAI_API_KEY! });
  if (!candidates.length) return fallback(input, context, "sommelier_provider_not_configured");
  const controller = new AbortController();
  const deadlineMs = Math.min(SOMMELIER_PROVIDER_DEADLINE_MS, Math.max(1, dependencies.deadlineMs ?? SOMMELIER_PROVIDER_DEADLINE_MS));
  const abort = () => controller.abort();
  if (dependencies.signal?.aborted) controller.abort();
  dependencies.signal?.addEventListener("abort", abort, { once: true });
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<ReturnType<typeof fallback>>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(fallback(input, context, "sommelier_provider_timeout")); }, deadlineMs); });
  const work = async () => {
    for (const candidate of candidates) {
      if (controller.signal.aborted) return fallback(input, context, "sommelier_provider_timeout");
      const body = JSON.stringify(sommelierProviderBody(candidate.name, input, context));
      if (Buffer.byteLength(body, "utf8") > 16_384) return fallback(input, context, "sommelier_context_too_large");
      const charge = sommelierReservedCost(candidate.name, body);
      const quota = await (dependencies.reserve || ((tenant, cost) => reserveSommelierBuckets(sommelierProviderBuckets(tenant, cost), env)))(context.tenantId, charge);
      if (!quota.ok) return fallback(input, context, quota.reason);
      if (controller.signal.aborted) return fallback(input, context, "sommelier_provider_timeout");
      // Each actual fallback attempt is separately reserved before any fetch.
      const perAttempt = new AbortController();
      const onAbort = () => perAttempt.abort();
      controller.signal.addEventListener("abort", onAbort, { once: true });
      const attemptTimer = setTimeout(() => perAttempt.abort(), candidate.name === "huggingface" && candidates.length > 1 ? 5500 : deadlineMs);
      try {
        const response = await (dependencies.fetch || fetch)(PROVIDERS[candidate.name].url, { method: "POST", headers: { "authorization": `Bearer ${candidate.key}`, "content-type": "application/json" }, body, signal: perAttempt.signal, cache: "no-store", redirect: "error" });
        if (!response.ok) {
          if (!controller.signal.aborted && !perAttempt.signal.aborted && candidate.name === "huggingface" && openAiFallbackReady && hfFingerprint && [401, 402, 403].includes(response.status)) hfRejectionCooldown = { fingerprint: hfFingerprint, until: now() + HF_REJECTION_COOLDOWN_MS };
          void response.body?.cancel().catch(() => undefined); continue;
        }
        const receipt = await boundedResponse(response, perAttempt.signal);
        const choice = receipt?.choices?.[0];
        if (receipt?.model !== PROVIDERS[candidate.name].model && receipt?.model !== PROVIDERS[candidate.name].model.split(":")[0]) continue;
        if (!Array.isArray(receipt.choices) || receipt.choices.length !== 1 || choice?.finish_reason !== "stop" || choice?.message?.refusal || choice?.message?.tool_calls || typeof choice?.message?.content !== "string" || choice.message.content.length > 4000) continue;
        const usage = receipt.usage;
        if (!usage || ![usage.prompt_tokens, usage.completion_tokens, usage.total_tokens].every(Number.isSafeInteger)
          || usage.prompt_tokens < 1 || usage.prompt_tokens > Buffer.byteLength(body, "utf8")
          || usage.completion_tokens < 1 || usage.completion_tokens > SOMMELIER_OUTPUT_TOKENS
          || usage.total_tokens !== usage.prompt_tokens + usage.completion_tokens) continue;
        const answer = parseSommelierAnswer(JSON.parse(choice.message.content), context);
        if (!answer || controller.signal.aborted) continue;
        return { ok: true, version: SOMMELIER_VERSION, ...answer, source: "live" as const, fallback: false, provider: candidate.name, model: PROVIDERS[candidate.name].model, contextSource: context.source, demo: context.demo,
          usage: { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, reservedMicroUsd: charge } };
      } catch { /* No provider errors, bodies, credentials or private prompts leave this service. */ }
      finally { clearTimeout(attemptTimer); controller.signal.removeEventListener("abort", onAbort); }
    }
    return fallback(input, context, controller.signal.aborted ? "sommelier_provider_timeout" : "sommelier_provider_unavailable");
  };
  try { return await Promise.race([work(), expired]); }
  finally { clearTimeout(timer!); dependencies.signal?.removeEventListener("abort", abort); controller.abort(); }
}
