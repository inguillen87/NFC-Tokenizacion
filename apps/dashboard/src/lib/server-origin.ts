import { headers } from "next/headers";

export async function getServerOrigin() {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const host = forwardedHost || h.get("host");
  const forwardedProto = h.get("x-forwarded-proto");
  const proto = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3002";
}
