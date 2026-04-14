import { verifyDemoShareToken } from "./demo-share";

export function requireShareToken(req: Request, bid: string, uid: string) {
  const url = new URL(req.url);
  const share = String(url.searchParams.get("share") || "").trim();
  const bodyShare = (req.headers.get("x-demo-share-token") || "").trim();
  const providedToken = share || bodyShare;
  const payload = verifyDemoShareToken(providedToken);
  if (!providedToken) {
    return { ok: false as const, reason: "missing share token", share_token_status: "missing" as const };
  }
  if (!payload) {
    return { ok: false as const, reason: "invalid or expired share token", share_token_status: "invalid_or_expired" as const };
  }
  if (payload.bid !== bid || payload.uid.toUpperCase() !== uid.toUpperCase()) {
    return { ok: false as const, reason: "share token does not match bid/uid", share_token_status: "mismatch" as const };
  }
  return { ok: true as const, payload, share_token_status: "valid" as const };
}
