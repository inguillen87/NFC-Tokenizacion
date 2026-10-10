import "server-only";

const BYPASS_HEADER = "x-vercel-protection-bypass";
const BYPASS_COOKIE_HEADER = "x-vercel-set-bypass-cookie";

function unavailable(): never {
  // Configuration and transport errors must not expose credentials or URLs.
  throw new Error("api_unavailable");
}

function previewCredential(target: URL): string | null {
  // Production and local development never read or use this Preview credential.
  if (process.env.VERCEL_ENV !== "preview") return null;
  const origin = process.env.NEXID_PREVIEW_API_ORIGIN;
  const allowedHost = process.env.NEXID_PREVIEW_API_ALLOWED_HOST;
  const secret = process.env.NEXID_PREVIEW_API_AUTOMATION_BYPASS;
  if (!origin && !allowedHost && !secret) return null;
  if (!origin || !allowedHost || !secret) return unavailable();

  let configured: URL;
  try { configured = new URL(origin); } catch { return unavailable(); }
  // Both values are reviewed server configuration, never a caller header or
  // URL. No wildcard/suffix allowlist, credentials, ports or URL path is allowed.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(allowedHost)
    || configured.protocol !== "https:" || configured.port
    || configured.username || configured.password || configured.search || configured.hash
    || configured.pathname !== "/" || configured.hostname !== allowedHost
    || origin !== configured.origin || target.origin !== configured.origin
    || target.username || target.password
    || /[\r\n]/.test(secret) || secret !== secret.trim()) return unavailable();
  return secret;
}

/** Server-side API transport. It never creates a grant or a browser bypass cookie. */
export const fetchRuntimeApi: typeof fetch = async (input, init = {}) => {
  let target: URL;
  try { target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url); }
  catch { return unavailable(); }
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  // Caller-supplied protection headers cannot authorize the upstream hop.
  headers.delete(BYPASS_HEADER);
  headers.delete(BYPASS_COOKIE_HEADER);
  const secret = previewCredential(target);
  if (secret) headers.set(BYPASS_HEADER, secret);

  let response: Response;
  try {
    response = await fetch(input, { ...init, headers, redirect: "error" });
  } catch { return unavailable(); }
  // Native fetch rejects redirects above. Reject them also when an adapter
  // returns a redirect response without obeying the requested policy.
  if (response.redirected || (response.status >= 300 && response.status < 400)) {
    try { void response.body?.cancel().catch(() => {}); } catch { /* No diagnostic data leaves the server. */ }
    return unavailable();
  }
  return response;
};
