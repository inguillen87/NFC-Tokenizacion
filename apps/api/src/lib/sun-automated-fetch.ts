export type SunAutomatedFetchReason =
  | "google_read_aloud"
  | "crawler"
  | "link_preview"
  | "prefetch_header";

export type SunAutomatedFetchClassification = {
  automated: boolean;
  reason: SunAutomatedFetchReason | null;
};

const GOOGLE_READ_ALOUD_USER_AGENT_TOKEN = "google-read-aloud";
const CRAWLER_USER_AGENT_TOKENS = [
  "googlebot",
  "bingbot",
  "duckduckbot",
  "yandexbot",
  "baiduspider",
  "applebot",
  "pinterestbot",
  "semrushbot",
  "ahrefsbot",
  "gptbot",
  "chatgpt-user",
  "claudebot",
  "perplexitybot",
] as const;
const LINK_PREVIEW_USER_AGENT_TOKENS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "telegrambot",
  "skypeuripreview",
] as const;

export const SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE = [
  GOOGLE_READ_ALOUD_USER_AGENT_TOKEN,
  ...CRAWLER_USER_AGENT_TOKENS,
  ...LINK_PREVIEW_USER_AGENT_TOKENS,
].join("|");

const CRAWLER_USER_AGENT_RE = new RegExp(CRAWLER_USER_AGENT_TOKENS.join("|"), "i");
const LINK_PREVIEW_USER_AGENT_RE = new RegExp(LINK_PREVIEW_USER_AGENT_TOKENS.join("|"), "i");
const PREFETCH_HEADER_RE = /(?:^|[\s,;])(?:prefetch|prerender|preview)(?:$|[\s,;])/i;

/**
 * Classifies server-side readers that dereference a SUN URL without a fresh
 * physical NFC interaction. Keep the list explicit: broad `bot` matching can
 * incorrectly reject accessibility tools or an embedded human browser.
 */
export function classifySunAutomatedFetch(headers: Headers): SunAutomatedFetchClassification {
  const userAgent = headers.get("user-agent") || "";
  if (userAgent.toLowerCase().includes(GOOGLE_READ_ALOUD_USER_AGENT_TOKEN)) {
    return { automated: true, reason: "google_read_aloud" };
  }
  if (CRAWLER_USER_AGENT_RE.test(userAgent)) {
    return { automated: true, reason: "crawler" };
  }
  if (LINK_PREVIEW_USER_AGENT_RE.test(userAgent)) {
    return { automated: true, reason: "link_preview" };
  }

  for (const name of ["purpose", "sec-purpose", "x-purpose", "x-moz"]) {
    if (PREFETCH_HEADER_RE.test(headers.get(name) || "")) {
      return { automated: true, reason: "prefetch_header" };
    }
  }
  return { automated: false, reason: null };
}

export function sunAutomatedFetchResponse(params: {
  traceId: string;
  reason: SunAutomatedFetchReason;
  wantsHtml: boolean;
}) {
  const headers = new Headers({
    "cache-control": "private, no-store, max-age=0",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-nexid-automated-fetch": "ignored",
    "x-nexid-trace-id": params.traceId,
    "x-request-id": params.traceId,
    "x-robots-tag": "noindex, nofollow, noarchive",
  });

  if (params.wantsHtml) {
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(
      "<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex,nofollow,noarchive\"><title>nexID</title><body><p>La lectura se procesa únicamente en el dispositivo que realizó el toque NFC.</p></body></html>",
      { status: 200, headers },
    );
  }

  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({
    ok: true,
    processed: false,
    result: "AUTOMATED_FETCH_IGNORED",
    reason: params.reason,
    request_id: params.traceId,
  }), { status: 200, headers });
}
