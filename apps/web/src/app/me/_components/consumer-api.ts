import { headers } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://api.nexid.lat";

type JsonMap = Record<string, unknown>;

async function fetchJson(path: string) {
  const incomingHeaders = await headers();
  const cookie = incomingHeaders.get("cookie") || "";
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: {
      cookie,
      "x-forwarded-for": incomingHeaders.get("x-forwarded-for") || "",
      "user-agent": incomingHeaders.get("user-agent") || "nexid-web-portal",
    },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

export async function fetchConsumerMe() {
  return fetchJson("/consumer/me");
}

export async function fetchConsumerPath(path: string) {
  return fetchJson(`/consumer/${path}`);
}

export async function fetchMarketplacePath(path: string) {
  return fetchJson(`/marketplace/${path}`);
}

export function asArray<T = JsonMap>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const map = value as JsonMap;
    const firstArray = Object.values(map).find((item) => Array.isArray(item));
    if (Array.isArray(firstArray)) return firstArray as T[];
  }
  return [];
}
