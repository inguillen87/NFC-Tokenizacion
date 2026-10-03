// Explicit local QA only: remap the server-side consumer API to loopback.
if (process.env.CONSUMER_PORTAL_LOADING_QA !== "1") throw Error("portal_loading_fixture_requires_explicit_qa");
const api = new URL(process.env.CONSUMER_PORTAL_LOADING_QA_API || "");
if (api.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(api.hostname)) throw Error("portal_loading_fixture_requires_loopback_api");
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = init?.method || (input instanceof Request ? input.method : "GET");
  if (url.hostname === "api.nexid.lat") {
    if (method !== "GET" || !url.pathname.startsWith("/consumer/")) throw Error("portal_loading_fixture_forbids_api_mutation");
    const mapped = new URL(url.pathname + url.search, api);
    const requestInit = input instanceof Request ? { method: input.method, headers: input.headers, signal: input.signal, ...init } : init;
    return original(mapped, requestInit);
  }
  if (["127.0.0.1", "localhost"].includes(url.hostname)) return original(input, init);
  throw Error("portal_loading_fixture_forbids_external_fetch");
};
