import { createHmac } from "node:crypto";

const AUDIENCE = "nexid:experience-event:v1";
const PURPOSE = "public_experience_event_share";
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const UID_OR_EVENT_RE = /^(?:[0-9A-F]{8,20}|EVENT-\d+)$/;

/** This key signs only public activity scope, never a commercial capability. */
export function createPublicExperienceShareToken(input: { bid: string; uid: string; exp: number }) {
  const key = process.env.PUBLIC_EXPERIENCE_SHARE_SECRET || "";
  if (Buffer.byteLength(key, "utf8") < 32) return "";
  const payload = {
    aud: AUDIENCE,
    purpose: PURPOSE,
    bid: input.bid.trim(),
    uid: input.uid.trim().toUpperCase(),
    exp: input.exp,
  };
  if (!BID_RE.test(payload.bid) || !UID_OR_EVENT_RE.test(payload.uid)
    || !Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return "";
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", key).update(`${AUDIENCE}\0${body}`, "utf8").digest("base64url");
  return `${body}.${signature}`;
}
