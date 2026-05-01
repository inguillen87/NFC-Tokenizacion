import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

function correlationIdFrom(req: Request) {
  return req.headers.get("x-correlation-id") || crypto.randomUUID();
}

export async function proxyToApi(req: Request, targetPath: string) {
  const method = req.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await req.text();
  const correlationId = correlationIdFrom(req);
  const response = await fetch(`${productUrls.api}${targetPath}`, {
    method,
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      cookie: req.headers.get("cookie") || "",
      "x-correlation-id": correlationId,
    },
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
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) next.headers.set("set-cookie", setCookie);
  return next;
}
