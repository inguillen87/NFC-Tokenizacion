import { createHmac } from "node:crypto";

export function createDemoShareToken(payload: { bid: string; uid: string; exp: number }) {
  const secret = process.env.PUBLIC_DEMO_SHARE_SECRET;
  if (!secret) return "";
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}
