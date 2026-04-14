import { verifyDemoShareToken } from "./demo-share";

export function requireShareToken(req: Request, bid: string, uid: string) {
  const url = new URL(req.url);
  const share = String(url.searchParams.get("share") || "").trim();
  const bodyShare = (req.headers.get("x-demo-share-token") || "").trim();
  const payload = verifyDemoShareToken(share || bodyShare);
  if (!payload) return { ok: false as const, reason: "missing or invalid share token" };
  if (payload.bid !== bid || payload.uid.toUpperCase() !== uid.toUpperCase()) {
    return { ok: false as const, reason: "share token does not match bid/uid" };
  }
  return { ok: true as const, payload };
}
