"use client";

import { useEffect, useRef, useState } from "react";
import type { ConsumerReward } from "./consumer-rewards-model";

export const MAX_REWARD_PRESENTATION_DELAY_MS = 2_147_483_647;
export type RewardClock = { items: ConsumerReward[]; checkedAt: string; serverMs: number; startedAt: number; lastSample: number; fresh: boolean };
export type RewardPresentation = { status: "preparing" | "fresh" | "stale"; code: string | null; expired: boolean };

/** This local presentation estimate is never authority to redeem or spend points. */
export function createRewardClock(items: ConsumerReward[], checkedAt: string, sample: number): RewardClock {
  const serverMs = Date.parse(checkedAt);
  const canonical = Number.isFinite(serverMs) && new Date(serverMs).toISOString() === checkedAt;
  return { items, checkedAt, serverMs, startedAt: sample, lastSample: sample,
    fresh: canonical && Number.isFinite(sample) && sample >= 0 };
}

/** Pure observation for render; retirement and sample commits happen outside render. */
function observeRewardClock(clock: RewardClock, sample: number, visible: boolean): number | null {
  if (!clock.fresh || !visible || !Number.isFinite(sample) || sample < clock.lastSample || sample < clock.startedAt) return null;
  const now = clock.serverMs + (sample - clock.startedAt);
  return Number.isFinite(now) && Math.abs(now) <= Number.MAX_SAFE_INTEGER ? now : null;
}

export function rewardClockNow(clock: RewardClock, sample: number, visible: boolean): number | null {
  const now = observeRewardClock(clock, sample, visible);
  if (now === null) { clock.fresh = false; return null; }
  clock.lastSample = sample;
  return now;
}

function presentRewardAt(clock: RewardClock, item: ConsumerReward, now: number | null): RewardPresentation {
  if (now === null || !clock.items.includes(item)) return { status: "stale", code: null, expired: false };
  const expiresAt = item.expiresAt ? Date.parse(item.expiresAt) : Number.NaN;
  const claimed = item.hasClaim && item.state === "claimed";
  const expired = claimed && Number.isFinite(expiresAt) && expiresAt <= now;
  return { status: "fresh", expired, code: claimed && item.code && Number.isFinite(expiresAt) && expiresAt > now ? item.code : null };
}

export function rewardPresentation(clock: RewardClock, item: ConsumerReward, sample: number, visible: boolean): RewardPresentation {
  return presentRewardAt(clock, item, rewardClockNow(clock, sample, visible));
}

/** One bounded wake-up at the nearest future expiry; no network or recurring interval. */
export function nextRewardExpiryDelay(clock: RewardClock, sample: number, visible: boolean): number | null {
  const now = rewardClockNow(clock, sample, visible);
  if (now === null) return null;
  let nearest = Number.POSITIVE_INFINITY;
  for (const item of clock.items) {
    if (!item.hasClaim || item.state !== "claimed" || !item.code || !item.expiresAt) continue;
    const expiry = Date.parse(item.expiresAt);
    if (Number.isFinite(expiry) && expiry > now) nearest = Math.min(nearest, expiry);
  }
  return Number.isFinite(nearest) ? Math.min(MAX_REWARD_PRESENTATION_DELAY_MS, Math.max(1, Math.ceil(nearest - now))) : null;
}

/** Missing rows in a bounded private read do not prove that an existing receipt vanished. */
export function retainsRewardClaims(previous: ConsumerReward[], next: ConsumerReward[]): boolean {
  return previous.filter(item => item.hasClaim).every(item => next.some(row => row.hasClaim
    && row.key === item.key && row.id === item.id && row.tenant === item.tenant));
}

export function useRewardPresentationClock(items: ConsumerReward[], checkedAt: string) {
  const latest = useRef({ items, checkedAt });
  latest.current = { items, checkedAt };
  const anchor = useRef<RewardClock | null>(null);
  const cancelTimer = useRef<() => void>(() => {});
  const [, rerender] = useState(0);
  const notify = () => rerender(value => value + 1);
  const matches = (clock: RewardClock | null): clock is RewardClock => Boolean(clock && clock.items === latest.current.items && clock.checkedAt === latest.current.checkedAt);
  const renderClock = matches(anchor.current) ? anchor.current : null;
  const renderSample = renderClock ? performance.now() : null;
  const renderVisible = renderClock ? document.visibilityState === "visible" : false;
  const renderNow = renderClock && renderSample !== null ? observeRewardClock(renderClock, renderSample, renderVisible) : null;
  useEffect(() => {
    const clock = createRewardClock(items, checkedAt, performance.now());
    anchor.current = clock;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
    cancelTimer.current = clear;
    const owns = () => !disposed && anchor.current === clock && matches(clock);
    const invalidate = () => { if (!owns()) return; clock.fresh = false; clear(); notify(); };
    const schedule = () => {
      clear(); if (!owns()) return;
      const delay = nextRewardExpiryDelay(clock, performance.now(), document.visibilityState === "visible");
      if (delay !== null) timer = setTimeout(() => { if (owns()) { notify(); schedule(); } }, delay);
    };
    const visibility = () => { if (document.visibilityState !== "visible") invalidate(); };
    const pageShow = (event: PageTransitionEvent) => { if (event.persisted) invalidate(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", pageShow);
    schedule(); notify();
    return () => {
      disposed = true; clear(); clock.fresh = false;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", pageShow);
      if (anchor.current === clock) anchor.current = null;
    };
  }, [items, checkedAt]);
  useEffect(() => {
    // A committed invalid observation retires this owner without healing it on
    // the next good sample. Never clear a replacement owner's alarm here.
    if (!renderClock || anchor.current !== renderClock || !matches(renderClock)) return;
    if (renderNow === null) { renderClock.fresh = false; cancelTimer.current(); }
    else if (renderClock.fresh && renderSample !== null) renderClock.lastSample = Math.max(renderClock.lastSample, renderSample);
  }, [items, checkedAt, renderClock, renderSample, renderVisible, renderNow]);

  const inspect = (item: ConsumerReward): RewardPresentation => renderClock ? presentRewardAt(renderClock, item, renderNow)
    : { status: "preparing", code: null, expired: false };
  const live = useRef<(item: ConsumerReward) => string | null>(() => null);
  live.current = item => {
    const clock = anchor.current;
    if (!matches(clock)) return null;
    const wasFresh = clock.fresh;
    const code = rewardPresentation(clock, item, performance.now(), document.visibilityState === "visible").code;
    if (wasFresh && !clock.fresh) { cancelTimer.current(); notify(); }
    else if (code === null && clock.items.includes(item) && item.state === "claimed" && item.code) notify();
    return code;
  };
  // Retained event handlers consult this ref instead of a receipt/source closure from an older render.
  const getCode = useRef((item: ConsumerReward) => live.current(item)).current;
  const invalidate = () => { if (matches(anchor.current)) { anchor.current.fresh = false; cancelTimer.current(); notify(); } };
  const status: RewardPresentation["status"] = !renderClock ? "preparing" : renderNow === null ? "stale" : "fresh";
  return { inspect, getCode, invalidate, status };
}
