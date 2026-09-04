import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Redis } from "@upstash/redis";

import {
  publishUpstashRealtimeEvent,
  resolveRealtimeDeploymentEnvironment,
  resolveUpstashPublishChannels,
  resolveUpstashRealtimeChannel,
  resolveUpstashRealtimeConfig,
  subscribeUpstashRealtimeEvent,
} from "../src/lib/realtime-upstash-transport.ts";

const CANARY_OPT_IN = "REALTIME_UPSTASH_CANARY";
const CANARY_TIMEOUT_MS = 30_000;
const EXPECTED_EVENT_TIMEOUT_MS = 8_000;

function createRecorder(label) {
  const messages = [];
  const waiters = new Set();
  let terminalError = null;

  const settleWaiters = () => {
    for (const waiter of [...waiters]) {
      if (terminalError) {
        waiters.delete(waiter);
        clearTimeout(waiter.timeout);
        waiter.reject(terminalError);
        continue;
      }
      const match = messages.find(waiter.predicate);
      if (!match) continue;
      waiters.delete(waiter);
      clearTimeout(waiter.timeout);
      waiter.resolve(match);
    }
  };

  return {
    messages,
    onData(message) {
      messages.push(message);
      settleWaiters();
    },
    onTransportReset() {
      terminalError = new Error(`canary_transport_reset:${label}`);
      settleWaiters();
    },
    waitFor(predicate) {
      if (terminalError) return Promise.reject(terminalError);
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          reject,
          timeout: setTimeout(() => {
            waiters.delete(waiter);
            reject(new Error(`canary_event_timeout:${label}`));
          }, EXPECTED_EVENT_TIMEOUT_MS),
        };
        waiter.timeout.unref?.();
        waiters.add(waiter);
      });
    },
  };
}

function isCanaryEvent(runId, eventName) {
  return (message) => {
    const payload = message?.envelope?.payload;
    return payload?.canary_run_id === runId && payload?.canary_event === eventName;
  };
}

function canaryPayload(runId, tenantSlug, eventName) {
  return {
    event_type: "realtime.canary",
    tenant_slug: tenantSlug,
    canary_run_id: runId,
    canary_event: eventName,
    created_at: new Date().toISOString(),
  };
}

async function main() {
  if (process.env[CANARY_OPT_IN] !== "1") {
    throw new Error("realtime_upstash_canary_explicit_opt_in_required");
  }

  const environment = resolveRealtimeDeploymentEnvironment(process.env);
  if (!environment) throw new Error("realtime_upstash_canary_environment_required");
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("realtime_upstash_canary_credentials_required");
  }

  const runId = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  // The canary never accepts a caller-provided namespace. Every run receives a
  // unique, environment-suffixed namespace that cannot overlap application data.
  const channelPrefix = `nexid:rt:canary-${runId}:${environment}`;
  const canaryEnvironment = {
    ...process.env,
    REALTIME_UPSTASH_CHANNEL_PREFIX: channelPrefix,
    REALTIME_UPSTASH_HISTORY_MAX_LENGTH: "50",
    REALTIME_UPSTASH_HISTORY_TTL_SECONDS: "60",
    REALTIME_UPSTASH_REPLAY_LIMIT: "20",
    REALTIME_UPSTASH_REPLAY_WINDOW_SECONDS: "60",
    REALTIME_UPSTASH_HISTORY_READ_TIMEOUT_MS: "5000",
  };
  const config = resolveUpstashRealtimeConfig(canaryEnvironment);
  if (!config) throw new Error("realtime_upstash_canary_configuration_invalid");

  const tenantA = `canary-a-${runId}`;
  const tenantB = `canary-b-${runId}`;
  const channelA = resolveUpstashRealtimeChannel({ tenantSlug: tenantA }, channelPrefix);
  const channelB = resolveUpstashRealtimeChannel({ tenantSlug: tenantB }, channelPrefix);
  const globalChannel = resolveUpstashRealtimeChannel({ global: true }, channelPrefix);
  assert.ok(channelA && channelB && globalChannel);
  const channels = [channelA, channelB, globalChannel];
  const redis = new Redis({
    url: config.url,
    token: config.token,
    enableTelemetry: false,
    retry: false,
  });

  const abortController = new AbortController();
  const overallTimeout = setTimeout(() => {
    abortController.abort(new Error("realtime_upstash_canary_timeout"));
  }, CANARY_TIMEOUT_MS);
  overallTimeout.unref?.();
  const subscriptions = [];
  let deletedChannels = 0;

  try {
    const tenantARecorder = createRecorder("tenant_a");
    const tenantBRecorder = createRecorder("tenant_b");
    const globalRecorder = createRecorder("global");

    const tenantASubscription = await subscribeUpstashRealtimeEvent({
      config,
      channel: channelA,
      signal: abortController.signal,
      onData: tenantARecorder.onData,
      onTransportReset: tenantARecorder.onTransportReset,
    });
    subscriptions.push(tenantASubscription);
    const tenantBSubscription = await subscribeUpstashRealtimeEvent({
      config,
      channel: channelB,
      signal: abortController.signal,
      onData: tenantBRecorder.onData,
      onTransportReset: tenantBRecorder.onTransportReset,
    });
    subscriptions.push(tenantBSubscription);
    const globalSubscription = await subscribeUpstashRealtimeEvent({
      config,
      channel: globalChannel,
      signal: abortController.signal,
      onData: globalRecorder.onData,
      onTransportReset: globalRecorder.onTransportReset,
    });
    subscriptions.push(globalSubscription);

    assert.equal(tenantASubscription.replay, "bounded_history");
    assert.equal(tenantBSubscription.replay, "bounded_history");
    assert.equal(globalSubscription.replay, "bounded_history");

    const eventA1 = "tenant-a-live";
    const eventB1 = "tenant-b-live";
    const payloadA1 = canaryPayload(runId, tenantA, eventA1);
    const payloadB1 = canaryPayload(runId, tenantB, eventB1);
    const publishChannelsA = resolveUpstashPublishChannels(payloadA1, { tenantSlug: tenantA }, channelPrefix);
    const publishChannelsB = resolveUpstashPublishChannels(payloadB1, { tenantSlug: tenantB }, channelPrefix);
    assert.deepEqual(publishChannelsA, [channelA, globalChannel]);
    assert.deepEqual(publishChannelsB, [channelB, globalChannel]);

    await publishUpstashRealtimeEvent({
      config,
      channels: publishChannelsA,
      source: `canary-${runId}`,
      payload: payloadA1,
    });
    await publishUpstashRealtimeEvent({
      config,
      channels: publishChannelsB,
      source: `canary-${runId}`,
      payload: payloadB1,
    });

    const [tenantAEvent] = await Promise.all([
      tenantARecorder.waitFor(isCanaryEvent(runId, eventA1)),
      tenantBRecorder.waitFor(isCanaryEvent(runId, eventB1)),
      globalRecorder.waitFor(isCanaryEvent(runId, eventA1)),
      globalRecorder.waitFor(isCanaryEvent(runId, eventB1)),
    ]);
    // Give already-published frames one event-loop window to surface before
    // proving that neither tenant received the other tenant's message.
    await delay(250, undefined, { signal: abortController.signal });
    assert.equal(tenantARecorder.messages.some(isCanaryEvent(runId, eventB1)), false);
    assert.equal(tenantBRecorder.messages.some(isCanaryEvent(runId, eventA1)), false);

    const replayCursor = tenantAEvent.cursor;
    assert.match(replayCursor, /^\d+-\d+$/);
    tenantASubscription.unsubscribe();

    const eventA2 = "tenant-a-replay";
    const payloadA2 = canaryPayload(runId, tenantA, eventA2);
    const publishChannelsA2 = resolveUpstashPublishChannels(payloadA2, { tenantSlug: tenantA }, channelPrefix);
    assert.deepEqual(publishChannelsA2, [channelA, globalChannel]);
    await publishUpstashRealtimeEvent({
      config,
      channels: publishChannelsA2,
      source: `canary-${runId}`,
      payload: payloadA2,
    });

    const replayRecorder = createRecorder("tenant_a_replay");
    const replaySubscription = await subscribeUpstashRealtimeEvent({
      config,
      channel: channelA,
      after: replayCursor,
      signal: abortController.signal,
      onData: replayRecorder.onData,
      onTransportReset: replayRecorder.onTransportReset,
    });
    subscriptions.push(replaySubscription);
    assert.equal(replaySubscription.replay, "cursor");
    assert.equal(replaySubscription.replayResetReason, null);
    await replayRecorder.waitFor(isCanaryEvent(runId, eventA2));
    assert.equal(tenantBRecorder.messages.some(isCanaryEvent(runId, eventA2)), false);
  } finally {
    clearTimeout(overallTimeout);
    abortController.abort(new Error("realtime_upstash_canary_complete"));
    for (const subscription of subscriptions) subscription.unsubscribe();
    // Cleanup is deliberately limited to the three exact ephemeral keys. This
    // script never scans, flushes or deletes an application namespace.
    deletedChannels = await redis.del(...channels);
  }

  assert.equal(deletedChannels, channels.length, "all ephemeral canary channels must be removed");
  console.log(JSON.stringify({
    ok: true,
    environment,
    tenants: 2,
    global: true,
    isolation: true,
    replay: true,
    cleanup: true,
  }));
}

main().catch((error) => {
  const candidate = error instanceof Error ? error.message : "";
  const errorCode = /^(?:realtime_upstash_|canary_)[a-z0-9_:.-]{1,120}$/i.test(candidate)
    ? candidate
    : "realtime_upstash_canary_failed";
  console.error(JSON.stringify({
    ok: false,
    error: errorCode,
  }));
  process.exitCode = 1;
});
