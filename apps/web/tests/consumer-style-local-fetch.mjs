// Explicit CSS QA only: synthetic GETs terminate at owned loopback services.
if (process.env.CONSUMER_STYLE_QA !== "1") throw Error("consumer_style_requires_explicit_qa");
const api = new URL(process.env.CONSUMER_STYLE_QA_API || "");
const site = new URL(process.env.CONSUMER_STYLE_QA_ORIGIN || "");
for (const url of [api, site]) {
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.username || url.password) {
    throw Error("consumer_style_requires_owned_loopback");
  }
}
const original = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (!["GET", "HEAD"].includes(method)) throw Error("consumer_style_forbids_mutations");
  if (url.hostname === "api.nexid.lat") {
    if (method === "GET" && url.pathname === "/sun/snapshot/0"
      && url.searchParams.get("trace") === "synthetic" && url.searchParams.get("access") === "invalid") {
      return Response.json({ ok: false, reason: "snapshot_not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
    }
    if (method !== "GET" || !url.pathname.startsWith("/consumer/")) throw Error("consumer_style_forbids_unscoped_api_reads");
    const requestInit = input instanceof Request ? { method: input.method, headers: input.headers, signal: input.signal, ...init } : init;
    return original(new URL(url.pathname + url.search, api), requestInit);
  }
  if (url.origin === site.origin || url.origin === api.origin) return original(input, init);
  throw Error("consumer_style_forbids_external_fetch");
};
