import { createHash } from "node:crypto";
import { validateSommelierAnswer, sommelierFallback, sommelierMessages, SOMMELIER_OUTPUT_SCHEMA, SOMMELIER_VERSION, type SommelierAnswerRejection, type SommelierContext, type SommelierRequest } from "./sommelier-contract";
import { reserveSommelierBuckets, sommelierProviderBuckets, type SommelierQuotaResult } from "./sommelier-quota";
import type { SommelierEnv } from "./sommelier-access";
import { syngentaGuideMessages, validateSyngentaGuideAnswer, syngentaGuideFallback, SYNGENTA_GUIDE_OUTPUT_SCHEMA, SYNGENTA_GUIDE_VERSION } from "./syngenta-guide-contract";
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
type ProviderFailureStage = "fetch" | "http" | "body" | "receipt_model" | "receipt_choice" | "receipt_usage" | "answer_parse";
type ProviderFailureCategory = "http_rejected" | "fetch_failed" | "body_invalid" | "receipt_model_mismatch" | "receipt_choice_invalid" | "receipt_usage_invalid" | "answer_json_invalid" | "attempt_timeout" | SommelierAnswerRejection;
export type SommelierProviderDiagnostic = { provider: ProviderName; stage: ProviderFailureStage; category: ProviderFailureCategory; httpStatus: number | null };
type Dependencies = { fetch?: typeof fetch; reserve?: (tenant: string, charge: number) => Promise<SommelierQuotaResult>; signal?: AbortSignal; deadlineMs?: number; nowMs?: () => number; diagnostic?: (event: SommelierProviderDiagnostic) => void };
const DIAGNOSTIC_HTTP_STATUSES = new Set([200, 400, 401, 402, 403, 404, 408, 409, 413, 422, 429, 500, 502, 503, 504]);
function providerDiagnostic(event: SommelierProviderDiagnostic, logger?: Dependencies["diagnostic"]) {
  try { if (logger) logger(event); else console.warn("[sommelier_provider_rejected]", JSON.stringify(event)); } catch { /* Diagnostics cannot alter fail-closed handling. */ }
}
export function sommelierProviderBody(provider: ProviderName, input: SommelierRequest, context: SommelierContext) {
  const agro = context.source === "syngenta_demo";
  return { model: PROVIDERS[provider].model, messages: agro ? syngentaGuideMessages(input, context) : sommelierMessages(input, context), stream: false, ...(provider === "huggingface" ? { max_tokens: SOMMELIER_OUTPUT_TOKENS, reasoning_effort: "low" } : { max_completion_tokens: SOMMELIER_OUTPUT_TOKENS, reasoning_effort: "none", store: false }), response_format: { type: "json_schema", json_schema: { name: agro ? "nexid_product_guide_answer" : "nexid_sommelier_answer", strict: true, schema: agro ? SYNGENTA_GUIDE_OUTPUT_SCHEMA : SOMMELIER_OUTPUT_SCHEMA } } };
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
  const agro = context.source === "syngenta_demo";
  return { ok: true, version: agro ? SYNGENTA_GUIDE_VERSION : SOMMELIER_VERSION, answer: agro ? syngentaGuideFallback(input.locale) : sommelierFallback(input.locale), source: "fallback" as const, fallback: true, reason, contextSource: context.source, demo: context.demo, ...(agro ? { demoProfile: "syngenta" as const } : {}), sources: [], suggestedQuestions: [] };
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
      let stage: ProviderFailureStage = "fetch";
      let httpStatus: number | null = null;
      const reject = (category: ProviderFailureCategory) => providerDiagnostic({ provider: candidate.name, stage, category, httpStatus }, dependencies.diagnostic);
      try {
        const response = await (dependencies.fetch || fetch)(PROVIDERS[candidate.name].url, { method: "POST", headers: { "authorization": `Bearer ${candidate.key}`, "content-type": "application/json" }, body, signal: perAttempt.signal, cache: "no-store", redirect: "error" });
        stage = "http";
        httpStatus = DIAGNOSTIC_HTTP_STATUSES.has(response.status) ? response.status : null;
        if (!response.ok) {
          if (!controller.signal.aborted && !perAttempt.signal.aborted && candidate.name === "huggingface" && openAiFallbackReady && hfFingerprint && [401, 402, 403].includes(response.status)) hfRejectionCooldown = { fingerprint: hfFingerprint, until: now() + HF_REJECTION_COOLDOWN_MS };
          reject("http_rejected"); void response.body?.cancel().catch(() => undefined); continue;
        }
        stage = "body";
        const receipt = await boundedResponse(response, perAttempt.signal);
        const choice = receipt?.choices?.[0];
        stage = "receipt_model";
        if (receipt?.model !== PROVIDERS[candidate.name].model && receipt?.model !== PROVIDERS[candidate.name].model.split(":")[0]) { reject("receipt_model_mismatch"); continue; }
        stage = "receipt_choice";
        if (!Array.isArray(receipt.choices) || receipt.choices.length !== 1 || choice?.finish_reason !== "stop" || choice?.message?.refusal || choice?.message?.tool_calls || typeof choice?.message?.content !== "string" || choice.message.content.length > 4000) { reject("receipt_choice_invalid"); continue; }
        stage = "receipt_usage";
        const usage = receipt.usage;
        if (!usage || ![usage.prompt_tokens, usage.completion_tokens, usage.total_tokens].every(Number.isSafeInteger)
          || usage.prompt_tokens < 1 || usage.prompt_tokens > Buffer.byteLength(body, "utf8")
          || usage.completion_tokens < 1 || usage.completion_tokens > SOMMELIER_OUTPUT_TOKENS
          || usage.total_tokens !== usage.prompt_tokens + usage.completion_tokens) { reject("receipt_usage_invalid"); continue; }
        stage = "answer_parse";
        const agro = context.source === "syngenta_demo";
        const validated = agro ? validateSyngentaGuideAnswer(JSON.parse(choice.message.content), context, input.locale) : validateSommelierAnswer(JSON.parse(choice.message.content), context);
        if (!validated.ok) { reject(validated.reason); continue; }
        if (controller.signal.aborted) { reject("attempt_timeout"); continue; }
        const answer = validated.value;
        return { ok: true, version: agro ? SYNGENTA_GUIDE_VERSION : SOMMELIER_VERSION, ...answer, source: "live" as const, fallback: false, provider: candidate.name, model: PROVIDERS[candidate.name].model, contextSource: context.source, demo: context.demo, ...(agro ? { demoProfile: "syngenta" as const } : {}),
          usage: { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, reservedMicroUsd: charge } };
      } catch { reject(controller.signal.aborted || perAttempt.signal.aborted ? "attempt_timeout" : stage === "answer_parse" ? "answer_json_invalid" : stage === "body" ? "body_invalid" : "fetch_failed"); }
      finally { clearTimeout(attemptTimer); controller.signal.removeEventListener("abort", onAbort); }
    }
    return fallback(input, context, controller.signal.aborted ? "sommelier_provider_timeout" : "sommelier_provider_unavailable");
  };
  try { return await Promise.race([work(), expired]); }
  finally { clearTimeout(timer!); dependencies.signal?.removeEventListener("abort", abort); controller.abort(); }
}
