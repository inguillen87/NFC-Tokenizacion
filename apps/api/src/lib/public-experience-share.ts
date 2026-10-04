import { createHmac, timingSafeEqual } from "node:crypto";

export const PUBLIC_EXPERIENCE_SHARE_AUDIENCE = "nexid:experience-event:v1";
export const PUBLIC_EXPERIENCE_SHARE_PURPOSE = "public_experience_event_share";
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const UID_OR_EVENT_RE = /^(?:[0-9A-F]{8,20}|EVENT-\d+)$/;

type PublicExperienceSharePayload = {
  aud: typeof PUBLIC_EXPERIENCE_SHARE_AUDIENCE;
  purpose: typeof PUBLIC_EXPERIENCE_SHARE_PURPOSE;
  bid: string;
  uid: string;
  exp: number;
};

function secret() {
  const value = process.env.PUBLIC_EXPERIENCE_SHARE_SECRET || "";
  return Buffer.byteLength(value, "utf8") >= 32 ? value : "";
}

function signature(body: string, key: string) {
  return createHmac("sha256", key)
    .update(`${PUBLIC_EXPERIENCE_SHARE_AUDIENCE}\0${body}`, "utf8")
    .digest("base64url");
}

export function createPublicExperienceShareToken(input: { bid: string; uid: string; exp: number }) {
  const key = secret();
  if (!key) return "";
  const payload: PublicExperienceSharePayload = {
    aud: PUBLIC_EXPERIENCE_SHARE_AUDIENCE,
    purpose: PUBLIC_EXPERIENCE_SHARE_PURPOSE,
    bid: input.bid.trim(),
    uid: input.uid.trim().toUpperCase(),
    exp: input.exp,
  };
  if (!BID_RE.test(payload.bid) || !UID_OR_EVENT_RE.test(payload.uid)
    || !Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return "";
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signature(body, key)}`;
}

export function verifyPublicExperienceShareToken(token: string | null | undefined) {
  const key = secret();
  if (!key || !token || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, suppliedSignature] = parts;
  const left = Buffer.from(suppliedSignature), right = Buffer.from(signature(body, key));
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const bytes = Buffer.from(body, "base64url");
    if (bytes.toString("base64url") !== body) return null;
    const payload = JSON.parse(bytes.toString("utf8")) as PublicExperienceSharePayload;
    if (payload.aud !== PUBLIC_EXPERIENCE_SHARE_AUDIENCE || payload.purpose !== PUBLIC_EXPERIENCE_SHARE_PURPOSE
      || typeof payload.bid !== "string" || !BID_RE.test(payload.bid)
      || typeof payload.uid !== "string" || !UID_OR_EVENT_RE.test(payload.uid)
      || !Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** A public activity scope is separate from NFC freshness and commercial rights. */
export function requirePublicExperienceShare(req: Request, bid: string, uid: string) {
  const normalizedBid = bid.trim(), normalizedUid = uid.trim().toUpperCase();
  if (!BID_RE.test(normalizedBid) || !UID_OR_EVENT_RE.test(normalizedUid)) {
    return { ok: false as const, reason: "invalid bid or uid format", share_token_status: "invalid_payload" as const };
  }
  const token = String(new URL(req.url).searchParams.get("share") || req.headers.get("x-demo-share-token") || "").trim();
  if (!token) return { ok: false as const, reason: "missing share token", share_token_status: "missing" as const };
  if (!secret()) return { ok: false as const, reason: "share secret missing", share_token_status: "missing" as const };
  const payload = verifyPublicExperienceShareToken(token);
  if (!payload) return { ok: false as const, reason: "invalid or expired share token", share_token_status: "invalid_or_expired" as const };
  if (payload.bid !== normalizedBid || payload.uid !== normalizedUid) {
    return { ok: false as const, reason: "share token does not match bid/uid", share_token_status: "mismatch" as const };
  }
  return { ok: true as const, payload, share_token_status: "valid" as const };
}
