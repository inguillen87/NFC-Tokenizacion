/**
 * Cloudflare Cron Trigger for Nexid's private webhook outbox worker.
 * This worker is intentionally not deployed by the repository; production
 * provisioning must add secrets with `wrangler secret put`.
 */
export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runRecovery(env));
  },
};

export async function runRecovery(env, fetchImpl = fetch) {
  const origin = String(env.NEXID_API_ORIGIN || "").trim().replace(/\/$/, "");
  const key = String(env.INTERNAL_WEBHOOK_WORKER_KEY || "").trim();
  if (!origin || !key || !origin.startsWith("https://")) {
    console.error("webhook recovery disabled: HTTPS origin and secret are required");
    return;
  }

  const response = await fetchImpl(`${origin}/internal/webhooks/worker`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-webhook-key": key,
      "user-agent": "nexid-cloudflare-webhook-recovery/1",
    },
    body: JSON.stringify({ limit: 50 }),
  });
  if (!response.ok) {
    console.error(`webhook recovery failed: HTTP ${response.status}`);
    return;
  }
  const payload = await response.json().catch(() => null);
  console.log(JSON.stringify({ ok: true, claimed: payload?.claimed ?? null, dead_letter: payload?.dead_letter ?? null }));
}
