import { createServer } from "node:http";

import { readEnterpriseEphemeralE2eConfig } from "./enterprise-ephemeral-e2e-safety.mjs";

const LOOPBACK_REMOTE_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function normalizeMethod(value) {
  const method = String(value || "GET").trim().toUpperCase();
  if (!/^[A-Z]{3,12}$/.test(method)) throw new Error("ephemeral_http_method_invalid");
  return method;
}

function assertRoute(route, index) {
  if (!route || typeof route !== "object") throw new Error(`ephemeral_http_route_invalid:${index}`);
  if (typeof route.match !== "function" || typeof route.handle !== "function") {
    throw new Error(`ephemeral_http_route_invalid:${index}`);
  }
  return {
    method: normalizeMethod(route.method),
    match: route.match,
    handle: route.handle,
  };
}

function sendJson(res, status, body) {
  if (res.headersSent || res.destroyed) return;
  const encoded = Buffer.from(JSON.stringify(body), "utf8");
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(encoded.byteLength),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(encoded);
}

async function readBoundedIncomingBody(req, maxBodyBytes) {
  const declaredLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    const error = new Error("ephemeral_http_request_body_too_large");
    error.status = 413;
    throw error;
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.byteLength;
    if (received > maxBodyBytes) {
      const error = new Error("ephemeral_http_request_body_too_large");
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return chunks.length ? Buffer.concat(chunks, received) : null;
}

async function writeWebResponse(res, response) {
  res.statusCode = response.status;
  for (const [name, value] of response.headers.entries()) {
    if (!HOP_BY_HOP_RESPONSE_HEADERS.has(name.toLowerCase())) res.setHeader(name, value);
  }
  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (!res.destroyed) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (!res.write(Buffer.from(chunk.value))) {
        await new Promise((resolve) => res.once("drain", resolve));
      }
    }
  } finally {
    if (res.destroyed) await reader.cancel().catch(() => null);
  }
  if (!res.destroyed) res.end();
}

/**
 * Starts a disposable, loopback-only HTTP transport in the same process as the
 * enterprise E2E SQL adapter. It crosses a real TCP/HTTP boundary and invokes
 * the production route handlers, while deliberately not claiming coverage of
 * the Next.js router, middleware, edge platform, DNS or TLS termination.
 */
export async function startEnterpriseEphemeralHttpHarness({
  env = process.env,
  routes,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
} = {}) {
  readEnterpriseEphemeralE2eConfig(env);
  if (!Array.isArray(routes) || routes.length === 0) throw new Error("ephemeral_http_routes_required");
  const safeRoutes = routes.map(assertRoute);
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1024 || maxBodyBytes > DEFAULT_MAX_BODY_BYTES) {
    throw new Error("ephemeral_http_max_body_bytes_invalid");
  }

  const server = createServer(async (req, res) => {
    if (!LOOPBACK_REMOTE_ADDRESSES.has(String(req.socket.remoteAddress || ""))) {
      sendJson(res, 403, { ok: false, reason: "ephemeral_http_loopback_required" });
      return;
    }

    const method = normalizeMethod(req.method);
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let selected = null;
    let context = null;
    for (const route of safeRoutes) {
      if (route.method !== method) continue;
      const match = route.match(url);
      if (match !== null && match !== false && match !== undefined) {
        selected = route;
        context = match === true ? {} : match;
        break;
      }
    }
    if (!selected) {
      sendJson(res, 404, { ok: false, reason: "ephemeral_http_route_not_registered" });
      return;
    }

    try {
      const body = method === "GET" || method === "HEAD"
        ? null
        : await readBoundedIncomingBody(req, maxBodyBytes);
      const requestUrl = new URL(`${url.pathname}${url.search}`, `http://127.0.0.1:${server.address().port}`);
      const request = new Request(requestUrl, {
        method,
        headers: req.headers,
        ...(body ? { body } : {}),
      });
      const response = await selected.handle(request, context || {});
      if (!(response instanceof Response)) throw new Error("ephemeral_http_handler_response_invalid");
      await writeWebResponse(res, response);
    } catch (error) {
      const status = Number(error?.status) === 413 ? 413 : 500;
      sendJson(res, status, {
        ok: false,
        reason: status === 413 ? "request_body_too_large" : "ephemeral_http_route_failed",
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string" || address.address !== "127.0.0.1") {
    await new Promise((resolve) => server.close(resolve));
    throw new Error("ephemeral_http_loopback_bind_failed");
  }
  const origin = `http://127.0.0.1:${address.port}`;
  let closed = false;

  return {
    origin,
    async fetch(pathname, init = {}) {
      if (closed) throw new Error("ephemeral_http_harness_closed");
      if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//")) {
        throw new Error("ephemeral_http_relative_path_required");
      }
      const target = new URL(pathname, origin);
      if (target.origin !== origin) throw new Error("ephemeral_http_external_target_forbidden");
      return globalThis.fetch(target, { ...init, redirect: "manual" });
    },
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
