import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { resolveLoyaltyAiProvenance } = await import("../src/lib/loyalty-ai-provenance.ts");

const loyaltyClient = await readFile(
  new URL("../src/app/(app)/loyalty/campaigns/loyalty-campaigns-client.tsx", import.meta.url),
  "utf8",
);

test("loyalty optimizer says live only with confirmed provider and model", () => {
  const live = resolveLoyaltyAiProvenance({
    mode: "live-provider",
    provider: "huggingface-router",
    model: "zai-org/GLM-5.2:together",
  });

  assert.equal(live.kind, "live-provider");
  assert.equal(live.isLive, true);
  assert.match(live.tabBadge, /live/i);
  assert.match(live.headline, /Hugging Face Router/);
  assert.match(live.detail, /zai-org\/GLM-5\.2:together/);
});

test("missing live provenance is defensively downgraded", () => {
  const missingProvider = resolveLoyaltyAiProvenance({
    mode: "live-provider",
    model: "zai-org/GLM-5.2:together",
  });
  const missingModel = resolveLoyaltyAiProvenance({
    mode: "live-provider",
    provider: "huggingface-router",
  });

  for (const result of [missingProvider, missingModel]) {
    assert.equal(result.kind, "server-fallback");
    assert.equal(result.isLive, false);
    assert.doesNotMatch(result.tabBadge, /live/i);
    assert.match(`${result.headline} ${result.detail}`, /Fallback|no se confirmó/i);
  }
});

test("server fallback, browser rules and pending requests disclose non-live origin", () => {
  const serverFallback = resolveLoyaltyAiProvenance({ mode: "server-fallback" });
  const localRules = resolveLoyaltyAiProvenance({ mode: "local-fallback" });
  const pending = resolveLoyaltyAiProvenance({
    mode: "idle",
    requestPending: true,
    serverConfigured: true,
  });

  assert.equal(serverFallback.isLive, false);
  assert.match(serverFallback.headline, /Fallback determinístico/);
  assert.equal(localRules.isLive, false);
  assert.match(`${localRules.headline} ${localRules.detail}`, /reglas|diccionario determinístico/i);
  assert.equal(pending.isLive, false);
  assert.match(pending.headline, /procedencia pendiente/);
});

test("loyalty UI derives top badges from provenance and labels BotIA as rule simulation", () => {
  assert.match(loyaltyClient, /resolveLoyaltyAiProvenance\(\{/);
  assert.match(loyaltyClient, /hasConfirmedLiveProvenance[\s\S]*confirmedProvider && confirmedModel/);
  assert.match(loyaltyClient, /\{aiProvenance\.tabBadge\}/);
  assert.match(loyaltyClient, /\{aiProvenance\.headline\}/);
  assert.match(loyaltyClient, /Reglas locales · simulación conversacional/);
  assert.match(loyaltyClient, />\s*Sin LLM\s*</);
  assert.doesNotMatch(loyaltyClient, />\s*Live\s*</);
  assert.doesNotMatch(loyaltyClient, /Cognitive AI Suite Activo/);
  assert.doesNotMatch(loyaltyClient, /optimizadas en tiempo real/);
});
