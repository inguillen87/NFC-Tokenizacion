import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { stripConsumerTapCapabilityCookies } from "../../api/_lib/consumer-tap-handoff";
import { consumerSessionState, fetchConsumerJson } from "./consumer-bounded-fetch";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

type JsonMap = Record<string, unknown>;
type ConsumerContact = JsonMap & { id: string; email?: string | null; phone?: string | null; status?: string };

function jsonRecord(value: unknown): JsonMap | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonMap : null;
}

async function readJson(path: string) {
  const incomingHeaders = await headers();
  const cookie = stripConsumerTapCapabilityCookies(incomingHeaders.get("cookie"));
  return fetchConsumerJson(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: {
      cookie,
      "x-forwarded-for": incomingHeaders.get("x-forwarded-for") || "",
      "user-agent": incomingHeaders.get("user-agent") || "nexid-web-portal",
    },
  });
}

async function fetchJson(path: string): Promise<JsonMap | null> {
  const result = await readJson(path);
  return result.status === "ready" ? jsonRecord(result.data) : null;
}

export async function fetchConsumerMe(): Promise<(JsonMap & { consumer: ConsumerContact | null; stats: JsonMap | null }) | null> {
  const payload = await fetchJson("/consumer/me");
  if (!payload) return null;
  const source = jsonRecord(payload.consumer);
  const consumer: ConsumerContact | null = source && typeof source.id === "string" && source.id.trim()
    ? {
      ...source, id: source.id,
      email: typeof source.email === "string" ? source.email : null,
      phone: typeof source.phone === "string" ? source.phone : null,
      status: typeof source.status === "string" ? source.status : undefined,
    } : null;
  return { ...payload, consumer, stats: jsonRecord(payload.stats) };
}

export async function fetchConsumerSession() {
  return fetchJson("/consumer/session");
}

export type ConsumerHomeSessionRead = { status: "ready" } | { status: "unavailable" };

/** The home page handles an unavailable session as a recoverable read state. */
export async function readConsumerHomeSession(nextPath = "/me"): Promise<ConsumerHomeSessionRead> {
  const result = await readJson("/consumer/session");
  const state = consumerSessionState(result);
  if (state === "unauthenticated") {
    redirect(`/login?consumer=1&next=${encodeURIComponent(nextPath)}`);
  }
  return { status: state === "authenticated" ? "ready" : "unavailable" };
}

export async function requireConsumerSession(nextPath = "/me") {
  const result = await readJson("/consumer/session");
  const state = consumerSessionState(result);
  if (state === "unauthenticated") {
    redirect(`/login?consumer=1&next=${encodeURIComponent(nextPath)}`);
  }
  if (state !== "authenticated" || result.status !== "ready") {
    // A failed lookup is not proof that a private session has expired.
    throw new Error("consumer_session_unavailable");
  }
  return result.data as { ok: true; authenticated: true };
}

export async function fetchConsumerPath(path: string): Promise<(JsonMap & { item?: JsonMap | null }) | null> {
  const payload = await fetchJson(`/consumer/${path}`);
  if (!payload) return null;
  return Object.hasOwn(payload, "item") ? { ...payload, item: jsonRecord(payload.item) } : payload;
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

export function buildConsumerNextPath(path: string, params?: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) query.append(key, item);
      });
      return;
    }
    if (value) query.set(key, value);
  });
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}
