import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

function correlationIdFrom(req: Request) {
  return req.headers.get("x-correlation-id") || crypto.randomUUID();
}

function buildProxyHeaders(req: Request, correlationId: string) {
  const headers: Record<string, string> = {
    "content-type": req.headers.get("content-type") || "application/json",
    cookie: req.headers.get("cookie") || "",
    "x-correlation-id": correlationId,
  };

  const userAgent = req.headers.get("user-agent");
  const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  if (userAgent) headers["user-agent"] = userAgent;
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;
  return headers;
}

function getSetCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const one = response.headers.get("set-cookie");
  return one ? [one] : [];
}

function rewriteApiCookieDomain(cookie: string) {
  return cookie.replace(/;\s*Domain=[^;]+/gi, "");
}

export async function proxyToApi(req: Request, targetPath: string) {
  const method = req.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await req.text();
  const correlationId = correlationIdFrom(req);
  const response = await fetch(`${productUrls.api}${targetPath}`, {
    method,
    headers: buildProxyHeaders(req, correlationId),
    body,
    cache: "no-store",
  }).catch((error) => {
    const message = error instanceof Error ? error.message : "api_unavailable";
    return Response.json({ ok: false, error: "api_unavailable", detail: message }, { status: 503 });
  });
  const text = await response.text();
  const next = new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
      "x-correlation-id": correlationId,
    },
  });
  for (const cookie of getSetCookies(response)) {
    next.headers.append("set-cookie", rewriteApiCookieDomain(cookie));
  }
  return next;
}
