import { verifyDemoShareToken } from "./demo-share";

const UID_OR_EVENT_RE = /^(?:[0-9A-F]{8,20}|EVENT-\d+)$/;
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;

export function requireShareToken(req: Request, bid: string, uid: string) {
  const normalizedBid = bid.trim();
  const normalizedUid = uid.trim().toUpperCase();
  if (!BID_RE.test(normalizedBid) || !UID_OR_EVENT_RE.test(normalizedUid)) {
    return { ok: false as const, reason: "invalid bid or uid format", share_token_status: "invalid_payload" as const };
  }

  const url = new URL(req.url);
  const share = String(url.searchParams.get("share") || "").trim();
  const bodyShare = (req.headers.get("x-demo-share-token") || "").trim();
  const providedToken = share || bodyShare;
  const secretConfigured = Boolean((process.env.PUBLIC_DEMO_SHARE_SECRET || "").trim());
  const allowInsecureDemo = process.env.ALLOW_INSECURE_DEMO_CTA !== "0";
  if (!secretConfigured && allowInsecureDemo && normalizedBid.toUpperCase().startsWith("DEMO-")) {
    return {
      ok: true as const,
      payload: { bid: normalizedBid, uid: normalizedUid, exp: Math.floor(Date.now() / 1000) + 300 },
      share_token_status: "insecure_demo_no_secret" as const,
    };
  }

  const payload = verifyDemoShareToken(providedToken);
  if (!providedToken) {
    return { ok: false as const, reason: "missing share token", share_token_status: "missing" as const };
  }
  if (!payload) {
    return { ok: false as const, reason: "invalid or expired share token", share_token_status: "invalid_or_expired" as const };
  }
  if (payload.bid !== normalizedBid || payload.uid.toUpperCase() !== normalizedUid) {
    return { ok: false as const, reason: "share token does not match bid/uid", share_token_status: "mismatch" as const };
  }
  return { ok: true as const, payload, share_token_status: "valid" as const };
}
