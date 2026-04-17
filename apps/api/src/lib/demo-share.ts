import { createHmac, timingSafeEqual } from "node:crypto";

export type DemoSharePayload = { bid: string; uid: string; exp: number };

function secret() {
  const value = process.env.PUBLIC_DEMO_SHARE_SECRET;
  if (!value) throw new Error("PUBLIC_DEMO_SHARE_SECRET is not set");
  return value;
}

function encodeBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function decodeBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createDemoShareToken(payload: DemoSharePayload) {
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifyDemoShareToken(token: string | null | undefined): DemoSharePayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as DemoSharePayload;
    if (!payload.bid || !payload.uid || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
