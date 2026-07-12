export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type SimulationMode = "valid" | "tamper" | "replay";

const MAX_PAYLOAD_BYTES = 4_096;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const MAX_RATE_BUCKETS = 2_048;
const DEFAULT_DEMO_BID = "DEMO-PUBLIC-LAB";
const DEFAULT_DEMO_UID = "04D3A0B0C0D0E0";
const DEMO_BID_RE = /^DEMO-[A-Z0-9._:-]{1,115}$/;
const DEMO_UID_RE = /^[0-9A-F]{8,20}$/;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const SYNTHETIC_OUTCOMES: Record<SimulationMode, {
  verdict: string;
  tagState: string;
  syntheticSun: string;
}> = {
  valid: {
    verdict: "AUTHENTICATED",
    tagState: "closed",
    syntheticSun: "SYNTHETIC-SUN-VALID-0001",
  },
  tamper: {
    verdict: "TAMPER_PREVIEW",
    tagState: "opened",
    syntheticSun: "SYNTHETIC-SUN-TAMPER-0001",
  },
  replay: {
    verdict: "REPLAY_BLOCKED",
    tagState: "replay_suspect",
    syntheticSun: "SYNTHETIC-SUN-REPLAY-0001",
  },
};

function json(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-nexid-demo-mode": "preview",
      ...headers,
    },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function clientKey(req: Request) {
  const forwarded = clean(req.headers.get("x-forwarded-for")).split(",")[0]?.trim();
  return forwarded || clean(req.headers.get("x-real-ip")) || "unknown";
}

function consumeRateLimit(key: string, now: number) {
  if (!rateBuckets.has(key) && rateBuckets.size >= MAX_RATE_BUCKETS) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    while (rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldestKey = rateBuckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      rateBuckets.delete(oldestKey);
    }
  }

  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return 0;
  }
  if (current.count >= RATE_LIMIT_MAX) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  }
  current.count += 1;
  return 0;
}

function parsePayload(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
    return json({ ok: false, reason: "payload_too_large" }, 413);
  }

  const retryAfter = consumeRateLimit(clientKey(req), Date.now());
  if (retryAfter > 0) {
    return json(
      { ok: false, reason: "rate_limited", preview: true, persisted: false, chain_write: false },
      429,
      { "retry-after": String(retryAfter) },
    );
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) {
    return json({ ok: false, reason: "payload_too_large" }, 413);
  }

  const payload = parsePayload(raw);
  if (!payload) return json({ ok: false, reason: "invalid_json" }, 400);

  const mode = clean(payload.mode).toLowerCase() as SimulationMode;
  if (!Object.hasOwn(SYNTHETIC_OUTCOMES, mode)) {
    return json({ ok: false, reason: "invalid_demo_mode" }, 400);
  }

  const bid = clean(payload.bid || payload.demoBid || DEFAULT_DEMO_BID).toUpperCase();
  if (!DEMO_BID_RE.test(bid)) {
    return json({ ok: false, reason: "invalid_demo_bid" }, 400);
  }

  const uidHex = clean(payload.uidHex || payload.uid_hex || payload.uid || DEFAULT_DEMO_UID).toUpperCase();
  if (!DEMO_UID_RE.test(uidHex)) {
    return json({ ok: false, reason: "invalid_demo_uid" }, 400);
  }

  const outcome = SYNTHETIC_OUTCOMES[mode];
  const syntheticPayload = {
    source: "synthetic_sun",
    execution: "preview",
    preview: true,
    persisted: false,
    chain_write: false,
    event_id: null,
    bid,
    uid_hex: uidHex,
    verdict: outcome.verdict,
    tag_state: outcome.tagState,
    synthetic_sun: outcome.syntheticSun,
  };

  return json({
    ok: true,
    degraded: true,
    source: "synthetic_sun",
    execution: "preview",
    preview: true,
    persisted: false,
    chain_write: false,
    mode,
    bid,
    uidHex,
    verdict: outcome.verdict,
    tag_state: outcome.tagState,
    synthetic_sun: outcome.syntheticSun,
    reason: "Vista previa sintetica: no se persistio el scan ni hubo escritura on-chain.",
    payload: syntheticPayload,
  });
}
