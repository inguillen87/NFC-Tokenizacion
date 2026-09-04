import { NextRequest, NextResponse } from "next/server";

import {
  consumePublicApiRateLimit,
  isJsonRequest,
  isSameOriginRequest,
  parseJsonRecord,
  readBoundedText,
} from "../../../../lib/public-api-guard";
import { SUN_LOCALE_COOKIE, isSunLocale } from "../../../sun/sun-locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const MAX_PAYLOAD_BYTES = 256;

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Origin");
  return response;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return noStore(NextResponse.json({ ok: false, error: "origin_not_allowed" }, { status: 403 }));
  }
  if (!isJsonRequest(request)) {
    return noStore(NextResponse.json({ ok: false, error: "unsupported_media_type" }, { status: 415 }));
  }

  const retryAfter = consumePublicApiRateLimit("sun-locale", request, { max: 30, windowMs: 60_000 });
  if (retryAfter > 0) {
    const response = NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    response.headers.set("Retry-After", String(retryAfter));
    return noStore(response);
  }

  const bounded = await readBoundedText(request, MAX_PAYLOAD_BYTES);
  if (!bounded.ok) {
    return noStore(NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 }));
  }

  const payload = parseJsonRecord(bounded.text);
  const locale = typeof payload?.locale === "string" ? payload.locale.trim() : "";
  if (!isSunLocale(locale)) {
    return noStore(NextResponse.json({ ok: false, error: "invalid_locale" }, { status: 400 }));
  }

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set({
    name: SUN_LOCALE_COOKIE,
    value: locale,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    httpOnly: true,
  });
  return noStore(response);
}
